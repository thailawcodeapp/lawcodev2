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
  takeWithinBudget,
  monthTotal,
  isSsmlPiece,
  splitSsmlAtBreak,
  isPolicyRejection,
  isLengthRejection,
  POLICY_MAX_ATTEMPTS,
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

  it('steps away from a space that would open the next piece with หรือ', () => {
    // Two candidates: 81 sits nearer the middle but puts หรือ at the start of
    // the second piece; 60 is further out and clean. Both leave pieces well
    // over MIN_PIECE_CHARS, so the clean one wins.
    const text = `${'ก'.repeat(60)} ${'ข'.repeat(20)} หรือ${'ค'.repeat(60)}`;
    expect(text[81]).toBe(' ');
    expect(splitPoint(text)).toBe(60);
  });

  it('keeps the seam rather than carving off a fragment to avoid it', () => {
    // The only alternative to the หรือ seam at 66 is the space at 5, which
    // would emit a 5-character piece. MIN_PIECE_CHARS rules it out and the
    // seam stands — a bad seam beats a stranded fragment.
    const text = `${'ก'.repeat(5)} ${'ข'.repeat(60)} หรือ${'ค'.repeat(60)}`;
    expect(splitPoint(text)).toBe(66);
  });

  it('does not treat a continuation word mid-piece as a seam', () => {
    // The rule looks only at what follows the cut. หรือ sitting inside the
    // left piece is untouched — it is spoken in the same breath as its clause.
    const text = `${'ก'.repeat(30)} หรือ${'ข'.repeat(30)} ${'ค'.repeat(70)}`;
    const cut = splitPoint(text);
    expect(text.slice(0, cut)).toContain('หรือ');
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

describe('isSsmlPiece', () => {
  it('is true for text with a sub-clause break tag', () => {
    expect(isSsmlPiece('อนุมาตรา 1<break time="200ms"/>ชื่อศาล')).toBe(true);
  });

  it('is false for plain paragraph text', () => {
    expect(isSsmlPiece('มาตรา 5 บุคคลย่อมพ้น')).toBe(false);
  });
});

describe('splitSsmlAtBreak', () => {
  it('cuts at the break tag nearest the middle, dropping the tag itself', () => {
    const text = 'ก'.repeat(10) + '<break time="200ms"/>' + 'ข'.repeat(10);
    const [left, right] = splitSsmlAtBreak(text);
    expect(left).toBe('ก'.repeat(10));
    expect(right).toBe('ข'.repeat(10));
  });

  it('never cuts inside a tag — any tag present in a half is intact, none partial', () => {
    const text = 'ก'.repeat(5) + '<break time="200ms"/>' + 'ข'.repeat(5)
      + '<break time="150ms"/>' + 'ค'.repeat(30);
    const [left, right] = splitSsmlAtBreak(text);
    for (const half of [left, right]) {
      const opens = (half.match(/</g) || []).length;
      const closes = (half.match(/\/>/g) || []).length;
      expect(opens).toBe(closes); // every "<" this half has is matched by a "/>" — no dangling half-tag
    }
  });

  it('returns the text unchanged when there is no break tag to cut at', () => {
    expect(splitSsmlAtBreak('no tags here')).toEqual(['no tags here']);
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

  it('sends a piece with a break tag as ssml, wrapped in <speak>', async () => {
    const client = { synthesizeSpeech: vi.fn(async ({ input }) => [{
      audioContent: Buffer.from(input.ssml ?? input.text, 'utf8').toString('base64'),
    }]) };
    const piece = 'อนุมาตรา 1<break time="200ms"/>ชื่อศาล';
    await synthesizeWithSplit(client, piece);
    const { input } = client.synthesizeSpeech.mock.calls[0][0];
    expect(input).toEqual({ ssml: `<speak>${piece}</speak>` });
  });

  it('sends plain paragraph text as text, not ssml', async () => {
    const client = fakeClient(1000);
    await synthesizeWithSplit(client, 'มาตรา 5 บุคคลย่อมพ้น');
    const { input } = client.synthesizeSpeech.mock.calls[0][0];
    expect(input).toEqual({ text: 'มาตรา 5 บุคคลย่อมพ้น' });
  });

  it('splits a too-long ssml piece at a break tag, not a raw space', async () => {
    // A naive space-based split on this piece could land inside
    // `<break time="200ms"/>` (there is one right after "break"), which
    // would send invalid XML on both halves.
    const piece = 'ก'.repeat(20) + '<break time="200ms"/>' + 'ข'.repeat(20);
    const client = {
      synthesizeSpeech: vi.fn(async ({ input }) => {
        const text = input.ssml ?? input.text;
        if (text.length > 30) {
          const err = new Error('This request contains sentences that are too long.');
          err.code = 3;
          throw err;
        }
        return [{ audioContent: Buffer.from(text, 'utf8').toString('base64') }];
      }),
    };
    const r = await synthesizeWithSplit(client, piece);
    expect(r.failures).toEqual([]);
    expect(r.splits).toBeGreaterThan(0);
    const sentInputs = client.synthesizeSpeech.mock.calls
      .map(([{ input }]) => input.ssml ?? input.text);
    for (const sent of sentInputs) expect(sent).not.toMatch(/<break time="200ms"\/>.*<break/s);
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

describe('monthTotal', () => {
  const now = new Date('2026-07-27T10:00:00Z');

  it('sums only entries from the current calendar month', () => {
    const ledger = [
      '{"at":"2026-06-30T23:00:00Z","chars":900000}',
      '{"at":"2026-07-01T00:00:00Z","chars":100}',
      '{"at":"2026-07-27T09:00:00Z","chars":50}',
      '{"at":"2026-08-01T00:00:00Z","chars":700000}',
    ].join('\n');
    expect(monthTotal(ledger, now)).toBe(150);
  });

  it('reads an empty or missing ledger as nothing spent', () => {
    expect(monthTotal('', now)).toBe(0);
    expect(monthTotal('\n\n', now)).toBe(0);
  });

  it('skips a half-written final line instead of throwing', () => {
    // Ctrl+C during an append is the normal way a long run ends, so a torn
    // last line has to cost one paragraph's count, not the whole budget check.
    const ledger = '{"at":"2026-07-02T00:00:00Z","chars":40}\n{"at":"2026-07-02T00:01:00Z","cha';
    expect(monthTotal(ledger, now)).toBe(40);
  });

  it('counts characters billed for a paragraph that ultimately failed', () => {
    // No file is written for these, so nothing else in the pipeline records
    // that they cost money.
    const ledger = '{"at":"2026-07-05T00:00:00Z","chars":300,"failed":true}';
    expect(monthTotal(ledger, now)).toBe(300);
  });
});

describe('takeWithinBudget', () => {
  const items = [{ text: 'aaa' }, { text: 'bbbb' }, { text: 'cc' }];

  it('takes the run that fits and stops there', () => {
    expect(takeWithinBudget(items, 7)).toEqual([items[0], items[1]]);
  });

  it('stops at the first overshoot rather than skipping ahead to a smaller one', () => {
    // 'cc' would fit in the leftover after 'aaa', but taking it would leave a
    // hole and make "where did it stop" two answers instead of one.
    expect(takeWithinBudget(items, 5)).toEqual([items[0]]);
  });

  it('takes nothing when even the first paragraph overshoots', () => {
    expect(takeWithinBudget(items, 2)).toEqual([]);
  });

  it('takes everything when the budget covers the lot', () => {
    expect(takeWithinBudget(items, 1000)).toEqual(items);
  });

  // The property that makes a paused run safe to resume: rendering the first
  // batch, then asking for the same total again, spends only the remainder.
  it('spends the same total whether it runs once or in two sittings', () => {
    const oneGo = takeWithinBudget(items, 9);
    const first = takeWithinBudget(items, 7);
    const spent = first.reduce((a, p) => a + p.text.length, 0);
    const second = takeWithinBudget(items.slice(first.length), 9 - spent);
    expect([...first, ...second]).toEqual(oneGo);
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

// Concurrency was added because throughput here is bound by how long Gemini
// takes to answer (~12s a paragraph, 4.8/min) rather than by any quota, which
// put the corpus at 23 hours one-at-a-time. These pin the parts of that change
// that fail silently: work that never actually overlaps, results that come
// back shuffled, and a pacer that lets six workers fire as one burst.
describe('renderMany — concurrency', () => {
  // Resolves only once `n` calls are in flight together, so the test cannot
  // pass unless the work genuinely overlaps.
  const gatedClient = (n, seen) => {
    let inFlight = 0;
    let release;
    const gate = new Promise((r) => { release = r; });
    return {
      synthesizeSpeech: async () => {
        inFlight += 1;
        seen.max = Math.max(seen.max ?? 0, inFlight);
        if (inFlight >= n) release();
        await gate;
        inFlight -= 1;
        return [{ audioContent: Buffer.from('x').toString('base64') }];
      },
    };
  };

  it('runs up to `concurrency` paragraphs at once', async () => {
    const seen = {};
    const items = Array.from({ length: 12 }, (_, i) => ({ text: `p${i}`, hash: `h${i}` }));
    await renderMany(gatedClient(6, seen), items, { concurrency: 6 });
    expect(seen.max).toBe(6);
  });

  it('defaults to one at a time, exactly as before the option existed', async () => {
    const seen = {};
    const items = Array.from({ length: 3 }, (_, i) => ({ text: `p${i}`, hash: `h${i}` }));
    await renderMany(gatedClient(1, seen), items, {});
    expect(seen.max).toBe(1);
  });

  it('returns results in input order however the workers finish', async () => {
    // Later items answer sooner, so completion order is the reverse of input.
    // The caller pairs results with items positionally; shuffled output would
    // attribute one paragraph's failures to another.
    const items = Array.from({ length: 6 }, (_, i) => ({ text: `p${i}`, hash: `h${i}` }));
    const client = {
      synthesizeSpeech: async ({ input }) => {
        const i = Number(input.text.slice(1));
        await new Promise((r) => setTimeout(r, (6 - i) * 5));
        return [{ audioContent: Buffer.from(input.text).toString('base64') }];
      },
    };
    const { results } = await renderMany(client, items, { concurrency: 6 });
    expect(results.map((r) => r.item.text)).toEqual(items.map((i) => i.text));
  });

  it('stops handing out work once the failure streak trips', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ text: `p${i}`, hash: `h${i}` }));
    let calls = 0;
    const client = {
      synthesizeSpeech: async () => {
        calls += 1;
        throw new Error('permission denied');
      },
    };
    const { aborted } = await renderMany(client, items, { concurrency: 6 });
    expect(aborted).toBe(true);
    // Six workers can be mid-flight when the streak trips, so a few requests
    // past the threshold are expected — the whole list is not.
    expect(calls).toBeLessThan(items.length);
  });
});

describe('makePacer under concurrency', () => {
  it('staggers simultaneous callers instead of releasing them together', async () => {
    // Every worker calls pace() immediately before its request. Recording the
    // slot after sleeping — as this did while only one call was ever in
    // flight — would have all four read the same value and fire at once.
    const pace = makePacer();
    const started = Date.now();
    const at = await Promise.all([0, 1, 2, 3].map(async () => {
      await pace();
      return Date.now() - started;
    }));
    const sorted = [...at].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS - 30);
    }
  });
});

// Gemini refuses some paragraphs of the civil code as policy violations, and
// the refusal is not deterministic — the same text was refused during a run
// and accepted unchanged minutes later. Retrying in place is what clears it;
// splitting, the other remedy for an INVALID_ARGUMENT, does not.
describe('policy rejection', () => {
  const policyErr = () => Object.assign(
    new Error('3 INVALID_ARGUMENT: Cloud Text-to-Speech could not generate audio because the input text or prompt violates Vertex AI\'s usage guidelines. Support codes: 54702341'),
    { code: 3 },
  );

  it('is told apart from a length rejection, which needs the opposite remedy', () => {
    expect(isPolicyRejection(policyErr())).toBe(true);
    const lengthErr = Object.assign(
      new Error('3 INVALID_ARGUMENT: This request contains sentences that are too long.'),
      { code: 3 },
    );
    expect(isPolicyRejection(lengthErr)).toBe(false);
    expect(isLengthRejection(lengthErr)).toBe(true);
  });

  it('retries the same text instead of splitting it, and succeeds when the screen relents', async () => {
    let calls = 0;
    const client = {
      synthesizeSpeech: async ({ input }) => {
        calls += 1;
        if (calls === 1) throw policyErr();
        return [{ audioContent: Buffer.from(input.text).toString('base64') }];
      },
    };
    const r = await synthesizeWithSplit(client, 'ก'.repeat(400));
    expect(calls).toBe(2);
    expect(r.splits).toBe(0);          // not split — the text was never the problem
    expect(r.failures).toEqual([]);
    expect(r.parts).toHaveLength(1);
  });

  // 1s + 2s + 4s of backoff, so this one needs more than the default budget.
  it('gives up after POLICY_MAX_ATTEMPTS rather than retrying a genuine refusal forever', async () => {
    let calls = 0;
    const client = {
      synthesizeSpeech: async () => { calls += 1; throw policyErr(); },
    };
    const r = await synthesizeWithSplit(client, 'ก'.repeat(100));
    expect(calls).toBe(POLICY_MAX_ATTEMPTS);
    expect(r.parts).toHaveLength(0);
    expect(r.failures[0].reason).toBe('other');
  }, 15000);
});
