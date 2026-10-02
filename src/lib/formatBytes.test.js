import { describe, it, expect } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it('says nothing is stored as zero, not as a fraction', () => {
    expect(formatBytes(0)).toBe('0 MB');
  });

  it('rounds a few hundred kilobytes up rather than showing 0 MB', () => {
    // After one section the cache holds ~200 KB. Reporting "0 MB" makes the
    // clear button look broken, because pressing it changes nothing on screen.
    expect(formatBytes(200 * 1024)).toBe('0.2 MB');
  });

  it('drops the decimal once the number is big enough not to need it', () => {
    expect(formatBytes(34 * 1024 * 1024)).toBe('34 MB');
  });

  it('handles a whole book', () => {
    expect(formatBytes(193 * 1024 * 1024)).toBe('193 MB');
  });

  it('rounds rather than truncating above the decimal threshold', () => {
    // The two cases above divide to exact integers, so they pass whether the
    // implementation rounds, floors, or does neither. A real cache size never
    // lands on a whole megabyte — these are the ones that pin the behaviour.
    expect(formatBytes(34.6 * 1024 * 1024)).toBe('35 MB');
    expect(formatBytes(34.4 * 1024 * 1024)).toBe('34 MB');
  });

  it('treats a missing or nonsense value as zero', () => {
    expect(formatBytes(null)).toBe('0 MB');
    expect(formatBytes(undefined)).toBe('0 MB');
    expect(formatBytes(NaN)).toBe('0 MB');
    expect(formatBytes(-5)).toBe('0 MB');
  });
});
