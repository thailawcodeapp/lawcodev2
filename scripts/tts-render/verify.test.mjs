import { describe, it, expect } from 'vitest';
import { expectedSeconds, checkDuration, summarize } from './verify.mjs';

describe('expectedSeconds', () => {
  it('scales with text length', () => {
    expect(expectedSeconds('ก'.repeat(150))).toBeGreaterThan(expectedSeconds('ก'.repeat(50)));
  });

  it('is around 20 seconds for a median 150-character paragraph', () => {
    const s = expectedSeconds('ก'.repeat(150));
    expect(s).toBeGreaterThan(10);
    expect(s).toBeLessThan(30);
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
