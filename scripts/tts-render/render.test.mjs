import { describe, it, expect, vi } from 'vitest';
import { splitPoint, splitParagraph, synthesizeWithSplit, MAX_SPLIT_DEPTH } from './render.mjs';

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
});
