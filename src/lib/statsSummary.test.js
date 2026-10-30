import { describe, expect, it } from 'vitest';
import { bookProgress, daysUntil, examPlan, percent, sumProgress } from './statsSummary.js';

const book = { id: 'civil', sections: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] };

describe('stats summary', () => {
  it('sorts heard sections by their mark', () => {
    expect(bookProgress(book, new Set(['a', 'b', 'c']), { a: 'remembered', b: 'forgotten' }))
      .toEqual({ total: 4, heard: 3, remembered: 1, forgotten: 1, unrated: 1 });
  });

  it('counts a marked section as heard', () => {
    expect(bookProgress(book, new Set(), { a: 'forgotten' })).toMatchObject({ heard: 1, forgotten: 1 });
  });

  it('adds laws together', () => {
    const p = { total: 4, heard: 3, remembered: 1, forgotten: 1, unrated: 1 };
    expect(sumProgress([p, p]).heard).toBe(6);
  });

  it('gives 0% of nothing', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
  });

  it('counts calendar days, whatever the time', () => {
    expect(daysUntil('2026-11-01', new Date(2026, 9, 31, 23, 59))).toBe(1);
    expect(daysUntil('2026-10-31', new Date(2026, 9, 31, 0, 1))).toBe(0);
    expect(daysUntil('2026-10-30', new Date(2026, 9, 31))).toBe(-1);
  });

  it('works out sections a day for the chosen laws only', () => {
    const other = { id: 'criminal', sections: [{ id: 'x' }] };
    const exam = { date: '2026-11-02', bookIds: ['civil'] };
    expect(examPlan(exam, [book, other], new Set(['a']), {}, new Date(2026, 9, 31)))
      .toEqual({ days: 2, left: 3, books: 1, perDay: 2 });
  });

  it('asks for nothing a day once the exam has come', () => {
    const exam = { date: '2026-10-31', bookIds: ['civil'] };
    expect(examPlan(exam, [book], new Set(), {}, new Date(2026, 9, 31)).perDay).toBe(0);
  });
});
