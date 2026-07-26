import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseFile } from 'music-metadata';
import { expectedSeconds, checkDuration, summarize } from './verify.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/gacrux-civil-1.mp3', import.meta.url));

describe('expectedSeconds', () => {
  it('scales with text length', () => {
    expect(expectedSeconds('ก'.repeat(150))).toBeGreaterThan(expectedSeconds('ก'.repeat(50)));
  });

  it('is around 14.85 seconds for a median 150-character paragraph', () => {
    // 150 / CHARS_PER_SECOND(10.1) = 14.851...
    const s = expectedSeconds('ก'.repeat(150));
    expect(s).toBeGreaterThan(12);
    expect(s).toBeLessThan(18);
  });
});

describe('checkDuration', () => {
  const text = 'ก'.repeat(150);
  const expected = expectedSeconds(text);

  it('accepts audio close to the expectation', () => {
    expect(checkDuration(text, expected).ok).toBe(true);
  });

  it('rejects audio far shorter than expected — the truncation case', () => {
    expect(checkDuration(text, expected * 0.3).ok).toBe(false);
  });

  it('rejects audio far longer than expected', () => {
    expect(checkDuration(text, expected * 3).ok).toBe(false);
  });

  it('tolerates the natural spread of speech rate', () => {
    expect(checkDuration(text, expected * 0.75).ok).toBe(true);
    expect(checkDuration(text, expected * 1.35).ok).toBe(true);
  });
});

describe('checkDuration — short-paragraph padding allowance', () => {
  it('accepts a 5-character paragraph whose audio carries ~200ms of padding', () => {
    const text = 'ก'.repeat(5);
    const expected = expectedSeconds(text); // 0.495s
    const actual = expected + 0.2; // real clip's fixed lead-in/lead-out silence
    expect(checkDuration(text, actual).ok).toBe(true);
  });

  it('still rejects a genuinely truncated ~1,000-character paragraph', () => {
    const text = 'ก'.repeat(1000);
    const expected = expectedSeconds(text);
    expect(checkDuration(text, expected * 0.4).ok).toBe(false);
  });
});

describe('summarize', () => {
  it('separates passes from failures', () => {
    const s = summarize([
      { hash: 'a', ok: true },
      { hash: 'b', ok: false, reason: 'too short' },
    ]);
    expect(s.passed).toBe(1);
    expect(s.failed).toHaveLength(1);
    expect(s.failed[0].hash).toBe('b');
  });
});

// Real output from th-TH-Chirp3-HD-Gacrux, the voice this pipeline uses
// (phase-2 pilot, civil section 1). Everything above this point exercises
// checkDuration/expectedSeconds/summarize against synthetic durations —
// this is the one place music-metadata touches an actual Google TTS MP3,
// which is the one thing that couldn't be confirmed without real audio.
describe('the real Gacrux fixture', () => {
  // The exact string that was sent to Google to produce this MP3, written out
  // rather than looked up from the corpus. It used to be read back through
  // collectParagraphs, which broke the moment speechUnits started leading
  // paragraph 0 with "มาตรา 1 ": the text grew by 8 characters, the audio did
  // not, and the calibration assertion failed for a reason that had nothing to
  // do with the calibration. A fixture has to be pinned to the text that
  // actually made it.
  const FIXTURE_TEXT = 'กฎหมายนี้ให้เรียกว่า ประมวลกฎหมายแพ่งและพาณิชย์';

  it('parses a real Google TTS MP3 and returns a duration', async () => {
    const meta = await parseFile(FIXTURE, { duration: true });
    expect(meta.format.duration).toBeGreaterThan(0);
  });

  it('accepts the fixture duration against the text that produced it', async () => {
    const meta = await parseFile(FIXTURE, { duration: true });
    const check = checkDuration(FIXTURE_TEXT, meta.format.duration);
    expect(check.ok).toBe(true);
  });

  it('rejects the same fixture truncated to half its real duration', async () => {
    const meta = await parseFile(FIXTURE, { duration: true });
    const check = checkDuration(FIXTURE_TEXT, meta.format.duration * 0.5);
    expect(check.ok).toBe(false);
  });

  // The three tests above pass at CHARS_PER_SECOND=7.5 too (verified: 0.74 is
  // inside the [6.06s, 12.12s] window that "accepts full duration" allows,
  // and 0.5x duration is rejected under both 7.5 and 10.1) — so on their own
  // they cannot catch a regression back to the old, miscalibrated constant.
  // This asserts the ratio itself, which only CHARS_PER_SECOND can move: it
  // is 1.0005 at 10.1 and 0.743 at 7.5, so this is the one assertion that
  // actually pins the calibration.
  it('the fixture duration matches the expectation within 0.1 — pins the calibration itself', async () => {
    const meta = await parseFile(FIXTURE, { duration: true });
    expect(meta.format.duration / expectedSeconds(FIXTURE_TEXT)).toBeCloseTo(1, 1);
  });
});
