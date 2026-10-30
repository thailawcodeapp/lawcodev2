import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  defaultLabel, startQueue, markItem, markDone, getResume, clearResume, resolveResume,
} = await import('./resumeQueue.js');

const items = Array.from({ length: 10 }, (_, i) => ({ sectionId: `criminal-${i + 1}`, bookId: 'criminal', number: String(i + 1) }));
const book = (ids) => [{ id: 'criminal', sections: ids.map(id => ({ id })) }];
const allIds = items.map(i => i.sectionId);

describe('resume queue', () => {
  beforeEach(() => store.clear());

  it('resumes at the section that was cut off, not at the start', () => {
    startQueue(items, 0, 'สอบเนติ สมัย 78');
    markItem(0);
    markItem(1); // stopped somewhere inside section 2
    const r = resolveResume(getResume(), book(allIds));
    expect(r).toEqual({ label: 'สอบเนติ สมัย 78', refs: items.map(i => ({ bookId: 'criminal', sectionId: i.sectionId })), index: 1 });
  });

  it('a finished queue has nothing to resume', () => {
    startQueue(items, 0, 'x');
    markItem(9);
    markDone();
    expect(getResume().done).toBe(true);
    expect(resolveResume(getResume(), book(allIds))).toBeNull();
  });

  it('starting a new queue replaces the old one', () => {
    startQueue(items, 0, 'old');
    markItem(5);
    startQueue(items.slice(0, 3), 2, 'new');
    expect(getResume()).toMatchObject({ label: 'new', index: 2, done: false });
    expect(getResume().refs).toHaveLength(3);
  });

  it('shifts the index when an earlier section is gone from the corpus', () => {
    startQueue(items, 0, 'x');
    markItem(4);
    const r = resolveResume(getResume(), book(allIds.filter(id => id !== 'criminal-2' && id !== 'criminal-3')));
    expect(r.refs).toHaveLength(8);
    expect(r.index).toBe(2);
    expect(r.refs[r.index].sectionId).toBe('criminal-5');
  });

  it('nothing left after filtering resolves to null', () => {
    startQueue(items, 0, 'x');
    expect(resolveResume(getResume(), book([]))).toBeNull();
  });

  it('ignores an index outside the queue', () => {
    startQueue(items, 0, 'x');
    markItem(42);
    markItem(-1);
    expect(getResume().index).toBe(0);
  });

  it('labels a queue with the first section when no label is given', () => {
    expect(defaultLabel(items)).toBe('อาญา ม.1');
    startQueue(items, 0);
    expect(getResume().label).toBe('อาญา ม.1');
  });

  it('clearResume and corrupt storage both give null', () => {
    startQueue(items, 0, 'x');
    clearResume();
    expect(getResume()).toBeNull();
    store.set('lawcode-th-resume', '{not json');
    expect(getResume()).toBeNull();
  });
});
