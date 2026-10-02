import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseFile } from 'music-metadata';
import { expectedSeconds, checkDuration, summarize } from './verify.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/gacrux-civil-1.mp3', import.meta.url));

describe('expectedSeconds', () => {
  it('scales with text length', () => {
    expect(expectedSeconds('ก'.repeat(150))).toBeGreaterThan(expectedSeconds('ก'.repeat(50)));
  });

  // Asserted exactly, because these two numbers are the whole model and a
  // fixture cannot pin them: real audio varies by more than the difference
  // between a good constant and a bad one.
  it('pins CHARS_PER_SECOND at 11.44', () => {
    expect(expectedSeconds('ก'.repeat(150))).toBeCloseTo(150 / 11.44, 3);
  });

  it('allows for the pause Gacrux takes at a bracket', () => {
    // "(2) จำคุก" is nine characters and takes 2.3 seconds, because most of it
    // is the pause after the marker. 1,840 paragraphs in the corpus are
    // bracketed list items, and before this they were the entire remaining
    // population of false alarms.
    // Thai markers rather than "(1)", so the digit rule above does not also
    // move the number and hide what is being measured.
    const plain = expectedSeconds('ก'.repeat(20));
    const bracketed = expectedSeconds(`(ก) ${'ก'.repeat(16)}`);
    expect(bracketed - plain).toBeCloseTo(0.4, 3);
  });

  it('counts every bracket, not just the first', () => {
    // "(ง) มีเหตุตาม (1) (ก) หรือ (ข)" carries five.
    const one = expectedSeconds('(ก)');
    const three = expectedSeconds('(ก)(ข)(ค)');
    expect(three - one).toBeCloseTo(0.8 + 6 / 11.44, 3);
  });

  it('leaves text without brackets exactly where it was', () => {
    expect(expectedSeconds('ก'.repeat(150))).toBeCloseTo(150 / 11.44, 3);
  });

  it('charges a digit its spoken weight, not its written one', () => {
    // "1274" is 4 characters and "หนึ่งพันสองร้อยเจ็ดสิบสี่" to say. Every
    // section's paragraph 0 opens with a number, so getting this wrong made
    // 119 healthy clips look too long.
    const plain = expectedSeconds('ก'.repeat(10));
    const withNumber = expectedSeconds(`${'ก'.repeat(6)}1274`);
    expect(withNumber).toBeGreaterThan(plain);
    expect(withNumber).toBeCloseTo((6 + 4 * 5.5) / 11.44, 3);
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

  it('keeps not-yet-rendered files out of the failure count', () => {
    // A half-finished corpus once reported 2,108 failures, 2,017 of which were
    // files that simply did not exist yet. The 91 real ones were unreadable
    // underneath, which is the same as not reporting them.
    const s = summarize([
      { hash: 'a', ok: true },
      { hash: 'b', ok: false, reason: 'too short: 1.0s vs ~9.0s' },
      { hash: 'c', ok: false, reason: 'missing' },
      { hash: 'd', ok: false, reason: 'missing' },
    ]);
    expect(s.failed.map((f) => f.hash)).toEqual(['b']);
    expect(s.missing).toHaveLength(2);
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

  // The constants are pinned exactly by the expectedSeconds tests above. What
  // this fixture proves instead is that real Google output lands inside the
  // band at all — a single clip runs about 10% over the fitted line, which is
  // ordinary spread across 4,747 files (RMSE 1.26s) and exactly why a lone
  // fixture cannot be used to calibrate.
  it('leaves real Gacrux audio comfortably inside the band', async () => {
    const meta = await parseFile(FIXTURE, { duration: true });
    const ratio = meta.format.duration / (expectedSeconds(FIXTURE_TEXT) + 0.34);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.4);
  });
});
