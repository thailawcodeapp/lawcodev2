import { describe, expect, it } from 'vitest';
import { keyOf, toggleOne, toggleMany, selectionState } from './selection.js';

const s = (n) => ({ id: `criminal-${n}`, number: String(n), title: `มาตรา ${n}` });

describe('section selection', () => {
  it('keys by book and section', () => {
    expect(keyOf('criminal', 'criminal-1')).toBe('criminal::criminal-1');
  });

  it('toggles one section on and off without touching the input', () => {
    const empty = {};
    const on = toggleOne(empty, 'criminal', s(288));
    expect(empty).toEqual({});
    expect(on['criminal::criminal-288']).toEqual({ sectionId: 'criminal-288', bookId: 'criminal', number: '288', title: 'มาตรา 288' });
    expect(toggleOne(on, 'criminal', s(288))).toEqual({});
  });

  it('selects all when any is missing, clears all when all are on', () => {
    const secs = [s(1), s(2), s(3)];
    const some = toggleOne({}, 'criminal', s(2));
    const all = toggleMany(some, 'criminal', secs);
    expect(Object.keys(all)).toHaveLength(3);
    expect(toggleMany(all, 'criminal', secs)).toEqual({});
  });

  it('keeps selections from other books', () => {
    const other = toggleOne({}, 'civil', { id: 'civil-1', number: '1', title: '' });
    const both = toggleMany(other, 'criminal', [s(1)]);
    expect(Object.keys(both)).toEqual(['civil::civil-1', 'criminal::criminal-1']);
  });

  it('reports the state of a set', () => {
    const secs = [s(1), s(2)];
    expect(selectionState({}, 'criminal', [])).toEqual({ all: false, some: false, count: 0, total: 0 });
    expect(selectionState({}, 'criminal', secs)).toEqual({ all: false, some: false, count: 0, total: 2 });
    const one = toggleOne({}, 'criminal', s(1));
    expect(selectionState(one, 'criminal', secs)).toEqual({ all: false, some: true, count: 1, total: 2 });
    expect(selectionState(toggleMany(one, 'criminal', secs), 'criminal', secs)).toEqual({ all: true, some: false, count: 2, total: 2 });
  });
});
