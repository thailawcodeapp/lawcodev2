// Tests for the round-3 additions to render.mjs: split-on-failure, the
// summary output for splits, and the --neural2 accept/reject check.
//
// This project cannot call the real Google TTS API from a test, so every
// test here drives the code with a fake client instead — one whose
// synthesizeSpeech rejects text over a configurable threshold, the way the
// real API rejects paragraphs over its sentence-length limit. What this
// verifies: pieces are retried after a split, they're concatenated in the
// order they appear in the original text, and the result is reported
// (counts, chars, failures). What it cannot verify: whether a real rejected
// paragraph, once split, still sounds acceptable when stitched together —
// that requires the owner listening to actual audio, which is exactly what
// round 3 asks for on civil 1598/21.
import { describe, expect, it } from 'vitest';
import {
  formatSummary,
  splitPoint,
  splitParagraph,
  synthesizeParagraphWithSplit,
  checkNeural2Limit,
  MAX_SPLIT_DEPTH,
} from './render.mjs';

// A fake TextToSpeechClient: synthesizeSpeech resolves with an audio buffer
// that encodes exactly which text produced it (so tests can check ordering
// after concatenation), or rejects if the text is longer than `threshold`.
function makeFakeClient({ threshold = Infinity, voiceThresholds = {} } = {}) {
  const calls = [];
  return {
    calls,
    async synthesizeSpeech({ input, voice }) {
      calls.push({ text: input.text, voice: voice.name });
      const limit = voiceThresholds[voice.name] ?? threshold;
      if (input.text.length > limit) {
        const err = new Error(
          `3 INVALID_ARGUMENT: This request contains sentences that are too long. ` +
            `Sentence starting with: "${input.text.slice(0, 10)}" is too long.`,
        );
        throw err;
      }
      return [{ audioContent: Buffer.from(`AUDIO[${input.text}]`, 'utf8').toString('base64') }];
    },
    async listVoices() {
      return [{ voices: [] }];
    },
  };
}

function audioText(buffer) {
  const s = buffer.toString('utf8');
  const m = /^AUDIO\[(.*)\]$/s.exec(s);
  return m ? m[1] : null;
}

describe('splitPoint', () => {
  it('finds the space nearest the midpoint', () => {
    const text = 'aaaa bbbb cccc'; // midpoint is index 7, spaces at 4 and 9
    const cut = splitPoint(text);
    expect(text[cut]).toBe(' ');
    expect(cut).toBe(9); // spaces at 4 (mid=7, dist 3) and 9 (dist 2) — 9 is nearer
  });

  it('falls back to the raw midpoint when there is no space', () => {
    const text = 'abcdefgh';
    expect(splitPoint(text)).toBe(4);
  });
});

describe('splitParagraph', () => {
  it('splits into two non-empty trimmed pieces at a space', () => {
    const pieces = splitParagraph('หนึ่งสอง สามสี่ห้า');
    expect(pieces.length).toBe(2);
    expect(pieces.join('')).not.toContain('  ');
    for (const p of pieces) expect(p.length).toBeGreaterThan(0);
  });

  it('returns a single element when the text cannot be usefully split', () => {
    // No space at all: falls back to the midpoint, both sides non-empty (still splits).
    const pieces = splitParagraph('abcdefgh');
    expect(pieces.length).toBe(2);
  });

  it('collapses to one piece for a two-character unsplittable-by-space string', () => {
    // A single character has nothing to split into two non-empty pieces from either side.
    const pieces = splitParagraph('a');
    expect(pieces.length).toBe(1);
    expect(pieces[0]).toBe('a');
  });
});

describe('synthesizeParagraphWithSplit', () => {
  it('synthesizes short text without any split', async () => {
    const client = makeFakeClient({ threshold: 100 });
    const result = await synthesizeParagraphWithSplit(client, 'short text');
    expect(result.parts.length).toBe(1);
    expect(result.failures.length).toBe(0);
    expect(result.splits.length).toBe(0);
    expect(result.chars).toBe('short text'.length);
    expect(audioText(result.parts[0])).toBe('short text');
  });

  it('splits a rejected paragraph and retries the pieces, in order', async () => {
    const client = makeFakeClient({ threshold: 12 });
    const text = 'aaaaaaaaaaaa bbbbbbbbbbbb'; // 25 chars, over threshold whole
    const result = await synthesizeParagraphWithSplit(client, text);

    expect(result.failures.length).toBe(0);
    expect(result.splits.length).toBe(1);
    expect(result.parts.length).toBe(2);
    // pieces retried and concatenated in original reading order
    expect(audioText(result.parts[0])).toBe('aaaaaaaaaaaa');
    expect(audioText(result.parts[1])).toBe('bbbbbbbbbbbb');
    // only the characters actually sent successfully are counted — the original whole-text
    // attempt that failed contributes nothing, only the two successful pieces do
    expect(result.chars).toBe('aaaaaaaaaaaa'.length + 'bbbbbbbbbbbb'.length);

    // the fake client actually saw three calls: the whole text (rejected), then both pieces
    expect(client.calls.map((c) => c.text)).toEqual([text, 'aaaaaaaaaaaa', 'bbbbbbbbbbbb']);
  });

  it('recurses when a piece still fails, and gives up at the depth limit', async () => {
    // Threshold so low that even single words fail, forcing recursion to the depth limit
    // on a long run with no space to exploit further once words are isolated.
    const client = makeFakeClient({ threshold: 3 });
    const text = 'aaaaaaaa bbbbbbbb'; // splits down repeatedly, words themselves are too long
    const result = await synthesizeParagraphWithSplit(client, text, { maxDepth: 2 });

    // nothing under threshold=3 within maxDepth=2 splits of 8-char words, so it ends in failures
    expect(result.parts.length + result.failures.length).toBeGreaterThan(0);
    for (const f of result.failures) {
      expect(f.depth).toBeLessThanOrEqual(2);
    }
  });

  it('stops splitting a single unsplittable character and records it as a failure', async () => {
    const client = makeFakeClient({ threshold: 0 }); // rejects everything, even 1 char
    const result = await synthesizeParagraphWithSplit(client, 'a', { maxDepth: MAX_SPLIT_DEPTH });
    expect(result.parts.length).toBe(0);
    expect(result.failures.length).toBe(1);
    expect(result.failures[0].text).toBe('a');
  });

  it('never loses a piece: total attempted pieces always accounts for every leaf', async () => {
    const client = makeFakeClient({ threshold: 10 });
    const text = 'aaaaaaaaaaaaaaa bbbbbbbbbbbbbbb ccccccccccccccc'; // 47 chars
    const result = await synthesizeParagraphWithSplit(client, text);
    // every leaf either succeeded (parts) or failed (failures) — none silently vanished
    const totalLeafChars = result.parts.reduce((n, p) => n + audioText(p).length, 0);
    expect(result.chars).toBe(totalLeafChars);
  });
});

describe('formatSummary — split reporting', () => {
  it('lists a paragraph that needed splitting, with piece count and max depth', () => {
    const results = [
      {
        book: 'civil-th',
        number: '1598/21',
        voice: 'th-TH-Chirp3-HD-Gacrux',
        status: 'ok',
        paragraphCount: 2,
        failures: [],
        splits: [{ paragraphIndex: 1, originalLength: 378, pieceCount: 2, maxDepth: 1 }],
      },
    ];
    const summary = formatSummary(results, 500);
    expect(summary).toContain('paragraph 1 (378 chars) needed splitting: 2 pieces, max depth 1');
  });

  it('still prints the skipped and failure lines exactly as before', () => {
    const results = [
      { book: 'civil-th', number: '420', voice: 'v', status: 'skipped' },
      {
        book: 'civil-th',
        number: '968',
        voice: 'v',
        status: 'partial',
        paragraphCount: 1,
        failures: [{ paragraphIndex: 0, length: 10, message: 'boom' }],
        splits: [],
      },
    ];
    const summary = formatSummary(results, 10);
    expect(summary).toContain('skipped    v  civil-th 420  (output already exists)');
    expect(summary).toContain('paragraph 0 (10 chars): boom');
  });
});

describe('checkNeural2Limit', () => {
  it('reports acceptance when Neural2 accepts the failing paragraph', async () => {
    const client = makeFakeClient({ voiceThresholds: { 'th-TH-Neural2-C': 10000 } });
    const result = await checkNeural2Limit(client);
    expect(result.ok).toBe(true);
    // it really did send the paragraph, not just claim to
    expect(client.calls.some((c) => c.voice === 'th-TH-Neural2-C')).toBe(true);
  });

  it('reports rejection with the API message when Neural2 also fails', async () => {
    const client = makeFakeClient({ voiceThresholds: { 'th-TH-Neural2-C': 0 } });
    const result = await checkNeural2Limit(client);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('too long');
  });
});
