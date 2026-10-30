import { describe, expect, it } from 'vitest';
import { cheer, CHEERS } from './cheer.js';

describe('cheer', () => {
  it('uses the morning lines before noon and the evening lines after', () => {
    expect(CHEERS.MORNING).toContain(cheer(new Date(2026, 9, 30, 7)));
    expect(CHEERS.EVENING).toContain(cheer(new Date(2026, 9, 30, 12)));
    expect(CHEERS.EVENING).toContain(cheer(new Date(2026, 9, 30, 22)));
  });

  it('holds still through one part of the day', () => {
    expect(cheer(new Date(2026, 9, 30, 6, 1))).toBe(cheer(new Date(2026, 9, 30, 11, 59)));
    expect(cheer(new Date(2026, 9, 30, 13))).toBe(cheer(new Date(2026, 9, 30, 23, 59)));
  });

  it('goes through every line before one comes back', () => {
    for (const [hour, pool] of [[8, CHEERS.MORNING], [20, CHEERS.EVENING]]) {
      const seen = new Set(Array.from({ length: pool.length }, (_, d) => cheer(new Date(2026, 9, 1 + d, hour))));
      expect(seen.size).toBe(pool.length);
    }
  });
});
