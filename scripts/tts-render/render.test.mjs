import { describe, it, expect, vi } from 'vitest';
import {
  splitPoint,
  splitParagraph,
  synthesizeWithSplit,
  MAX_SPLIT_DEPTH,
  renderMany,
  MAX_CONSECUTIVE_FAILURES,
  throttle,
  makePacer,
  isRateLimitError,
  RATE_LIMIT_MAX_ATTEMPTS,
} from './render.mjs';

// Chirp 3's 180 requests/minute budget, mirrored here rather than exported:
// Math.ceil(60000 / 180).
const MIN_INTERVAL_MS = 334;

// A client that rejects anything longer than `limit`, the way Chirp 3 rejects
// a sentence it considers too long.
const fakeClient = (limit) => ({
  synthesizeSpeech: vi.fn(async ({ input }) => {
    if (input.text.length > limit) {
      const err = new Error('This request contains sentences that are too long.');
      err.code = 3;
      throw err;
    }
    return [{ audioContent: Buffer.from(input.text, 'utf8').toString('base64') }];
  }),
});

// A client that always rejects with a non-length error, the way an expired
// token or an exhausted quota would.
const fakeSystemicFailureClient = (message = '7 PERMISSION_DENIED: quota exceeded') => ({
  synthesizeSpeech: vi.fn(async () => {
    const err = new Error(message);
    err.code = 7;
    throw err;
  }),
});

describe('throttle', () => {
  it('demands the full interval when called right after the last request', () => {
    expect(throttle(1000, 1000)).toBe(MIN_INTERVAL_MS);
  });

  it('shrinks as more time passes since the last request', () => {
    expect(throttle(1000, 1100)).toBe(MIN_INTERVAL_MS - 100);
  });

  it('never asks for a negative wait once the interval has fully elapsed', () => {
    expect(throttle(1000, 1000 + MIN_INTERVAL_MS)).toBe(0);
    expect(throttle(1000, 1000 + MIN_INTERVAL_MS * 10)).toBe(0);
  });
});

describe('makePacer', () => {
  // No paid render should ever start at full speed because someone deleted
  // the pacer from main() and every test stayed green. This drives the
  // pacer with a fake clock so the delay is proven without the test suite
  // actually sleeping for it.
  it('spaces out successive calls by the throttle interval, without real waiting', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10_000);
      const pace = makePacer();

      // First call: nothing paced yet, so no wait is owed. Advancing by 0ms
      // still lets a zero-delay setTimeout fire under fake timers.
      const p1 = pace();
      await vi.advanceTimersByTimeAsync(0);
      await p1;

      // A second call 100ms later is still inside the interval and must wait
      // out the remainder rather than firing immediately.
      vi.setSystemTime(10_100);
      let resolved = false;
      pace().then(() => { resolved = true; });

      await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS - 100 - 1);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(2);
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('splitPoint', () => {
  it('picks the space nearest the middle', () => {
    expect(splitPoint('aa bbbb cc')).toBe(7);
  });

  it('falls back to the midpoint when there is no space', () => {
    expect(splitPoint('abcd')).toBe(2);
  });
});

describe('splitParagraph', () => {
  it('splits into two trimmed pieces', () => {
    expect(splitParagraph('aa bbbb cc')).toEqual(['aa bbbb', 'cc']);
  });

  it('returns one piece when it cannot usefully split', () => {
    expect(splitParagraph('a')).toEqual(['a']);
  });
});

describe('synthesizeWithSplit', () => {
  it('sends a short paragraph as one request', async () => {
    const client = fakeClient(100);
    const r = await synthesizeWithSplit(client, 'สั้น');
    expect(client.synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(r.failures).toEqual([]);
    expect(r.splits).toBe(0);
  });

  it('splits a rejected paragraph and keeps the pieces in reading order', async () => {
    const client = fakeClient(10);
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc');
    expect(r.failures).toEqual([]);
    expect(r.splits).toBeGreaterThan(0);
    expect(Buffer.concat(r.parts).toString('utf8')).toBe('aaaa bbbbcccc');
  });

  it('counts only characters it actually sent', async () => {
    const client = fakeClient(10);
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc');
    expect(r.chars).toBe('aaaa bbbb'.length + 'cccc'.length);
  });

  it('gives up at the depth limit instead of recursing forever', async () => {
    const client = fakeClient(0); // rejects everything
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc dddd');
    expect(r.failures.length).toBeGreaterThan(0);
    expect(r.parts).toEqual([]);
    expect(client.synthesizeSpeech.mock.calls.length).toBeLessThanOrEqual(2 ** (MAX_SPLIT_DEPTH + 1));
  });

  it('does not split on a non-length error', async () => {
    const client = fakeSystemicFailureClient();
    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc');
    expect(client.synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(r.parts).toEqual([]);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].message).toMatch(/quota exceeded/);
  });

  it('awaits the injected pace() once per synthesizeSpeech call, including the retries a split produces', async () => {
    // Deleting the pacer from main() would leave every existing test green,
    // because none of them passed `pace` at all. This proves the call site
    // actually awaits it, for every attempt a split makes, not just the
    // first.
    const client = fakeClient(10); // rejects anything over 10 chars, forcing splits
    const events = [];
    const pace = vi.fn(async () => { events.push('pace'); });
    client.synthesizeSpeech = vi.fn(async (args) => {
      events.push('synth');
      if (args.input.text.length > 10) {
        const err = new Error('This request contains sentences that are too long.');
        err.code = 3;
        throw err;
      }
      return [{ audioContent: Buffer.from(args.input.text, 'utf8').toString('base64') }];
    });

    const r = await synthesizeWithSplit(client, 'aaaa bbbb cccc', { pace });

    expect(r.splits).toBeGreaterThan(0); // confirms this exercise actually retried
    expect(pace).toHaveBeenCalledTimes(client.synthesizeSpeech.mock.calls.length);
    expect(pace.mock.calls.length).toBeGreaterThan(1);
    // pace() is awaited strictly before the network call it paces.
    for (let i = 0; i < events.length; i += 2) {
      expect(events[i]).toBe('pace');
      expect(events[i + 1]).toBe('synth');
    }
  });
});

describe('isRateLimitError', () => {
  it('matches gRPC code 8 with a quota message', () => {
    const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
    err.code = 8;
    expect(isRateLimitError(err)).toBe(true);
  });

  it('matches gRPC code 8 with a rate message', () => {
    const err = new Error('8 RESOURCE_EXHAUSTED: rate limit exceeded, retry later');
    err.code = 8;
    expect(isRateLimitError(err)).toBe(true);
  });

  it('does not match code 8 alone, without a quota/rate message', () => {
    const err = new Error('8 RESOURCE_EXHAUSTED: something unrelated');
    err.code = 8;
    expect(isRateLimitError(err)).toBe(false);
  });

  it('does not match a quota message alone, without code 8', () => {
    const err = new Error('7 PERMISSION_DENIED: quota exceeded');
    err.code = 7;
    expect(isRateLimitError(err)).toBe(false);
  });
});

describe('synthesizeWithSplit rate-limit backoff', () => {
  it('retries a rate-limited request with exponential backoff and succeeds', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const client = {
        synthesizeSpeech: vi.fn(async ({ input }) => {
          calls += 1;
          if (calls <= 2) {
            const err = new Error('8 RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
            err.code = 8;
            throw err;
          }
          return [{ audioContent: Buffer.from(input.text, 'utf8').toString('base64') }];
        }),
      };

      const pending = synthesizeWithSplit(client, 'สั้น');
      await vi.runAllTimersAsync();
      const r = await pending;

      expect(client.synthesizeSpeech).toHaveBeenCalledTimes(3); // 2 rejections + 1 success
      expect(r.parts).toHaveLength(1);
      expect(r.failures).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up on a sustained rate limit and records an other-bucket failure instead of looping forever', async () => {
    vi.useFakeTimers();
    try {
      const client = {
        synthesizeSpeech: vi.fn(async () => {
          const err = new Error('8 RESOURCE_EXHAUSTED: rate limit exceeded');
          err.code = 8;
          throw err;
        }),
      };

      const pending = synthesizeWithSplit(client, 'สั้น');
      await vi.runAllTimersAsync();
      const r = await pending;

      expect(client.synthesizeSpeech).toHaveBeenCalledTimes(RATE_LIMIT_MAX_ATTEMPTS);
      expect(r.parts).toEqual([]);
      expect(r.failures).toHaveLength(1);
      expect(r.failures[0].reason).toBe('other');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('renderMany', () => {
  it('aborts after the consecutive-failure threshold', async () => {
    const client = fakeSystemicFailureClient();
    const items = Array.from({ length: 20 }, (_, i) => ({ text: `paragraph ${i}` }));
    const r = await renderMany(client, items, { maxConsecutiveFailures: 3 });
    expect(r.aborted).toBe(true);
    expect(r.results.length).toBe(3);
    expect(r.lastError).toMatch(/quota exceeded/);
  });

  it('does not abort on scattered failures interleaved with successes', async () => {
    let call = 0;
    const client = {
      synthesizeSpeech: vi.fn(async ({ input }) => {
        call += 1;
        if (call % 2 === 0) {
          const err = new Error('7 PERMISSION_DENIED: quota exceeded');
          throw err;
        }
        return [{ audioContent: Buffer.from(input.text, 'utf8').toString('base64') }];
      }),
    };
    const items = Array.from({ length: 10 }, (_, i) => ({ text: `paragraph ${i}` }));
    const r = await renderMany(client, items, { maxConsecutiveFailures: 3 });
    expect(r.aborted).toBe(false);
    expect(r.results.length).toBe(10);
  });

  it('aborts at ten consecutive failures by default', () => {
    // Asserting the value, not its type: `typeof number` and `> 0` were true
    // at 1 and at a billion, so the old form could not fail. Ten is low
    // enough to stop a dead run quickly and high enough that an unlucky run
    // of genuinely bad paragraphs does not trip it.
    expect(MAX_CONSECUTIVE_FAILURES).toBe(10);
  });
});
