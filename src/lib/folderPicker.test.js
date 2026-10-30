import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sync/dirty', () => ({ markDirty: () => {} }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getFolders, createFolder, addSectionsToFolder, deleteFolder } = await import('./folders.js');
const {
  getRecentIds, pushRecent, pickerLists, alreadyIn, sectionCount, addToFolders, undoAdd,
} = await import('./folderPicker.js');

const sec = (n, bookId = 'criminal') => ({ sectionId: `${bookId}-${n}`, bookId, number: String(n), title: `มาตรา ${n}` });
const idsIn = (id) => getFolders().find(f => f.id === id).sections.map(s => s.sectionId);

describe('folder picker', () => {
  beforeEach(() => store.clear());

  it('adds to several folders at once and reports only what was new', () => {
    const a = createFolder('สอบเนติ');
    const b = createFolder('ก่อนนอน');
    addSectionsToFolder(a.id, [sec(288)]);
    const res = addToFolders([a.id, b.id], [sec(288), sec(289)]);
    expect(idsIn(a.id)).toEqual(['criminal-288', 'criminal-289']);
    expect(idsIn(b.id)).toEqual(['criminal-288', 'criminal-289']);
    expect(res.folderIds).toEqual([a.id, b.id]);
    expect(res.added).toEqual([
      { folderId: a.id, sectionId: 'criminal-289' },
      { folderId: b.id, sectionId: 'criminal-288' },
      { folderId: b.id, sectionId: 'criminal-289' },
    ]);
  });

  it('undo removes only what that add put in', () => {
    const a = createFolder('สอบเนติ');
    addSectionsToFolder(a.id, [sec(288)]);
    const res = addToFolders([a.id], [sec(288), sec(289)]);
    undoAdd(res.added);
    expect(idsIn(a.id)).toEqual(['criminal-288']);
  });

  it('undo of a big add writes once', () => {
    const a = createFolder('เยอะ');
    const b = createFolder('อีกอัน');
    const many = Array.from({ length: 300 }, (_, i) => sec(i + 1));
    const res = addToFolders([a.id, b.id], many);
    const spy = vi.spyOn(globalThis.localStorage, 'setItem');
    undoAdd(res.added);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    expect(idsIn(a.id)).toEqual([]);
    expect(idsIn(b.id)).toEqual([]);
  });

  it('a stats group routes each section into its book\'s leaf', () => {
    const res = addToFolders(['grp-nethi'], [sec(288), sec(420, 'civil')]);
    expect(idsIn('grp-nethi-criminal')).toEqual(['criminal-288']);
    expect(idsIn('grp-nethi-civil')).toEqual(['civil-420']);
    expect(res.added).toHaveLength(2);
    expect(sectionCount(getFolders().find(f => f.id === 'grp-nethi'))).toBe(2);
  });

  it('skips a folder deleted in the meantime', () => {
    const a = createFolder('หายไป');
    deleteFolder(a.id);
    expect(addToFolders([a.id], [sec(1)])).toEqual({ folderIds: [], added: [] });
  });

  it('knows which chosen sections a folder already has', () => {
    const a = createFolder('x');
    addSectionsToFolder(a.id, [sec(288)]);
    const f = getFolders().find(x => x.id === a.id);
    expect(alreadyIn(f, [sec(288), sec(289)]).map(s => s.number)).toEqual(['288']);
  });

  it('recent keeps three, newest first, without repeats', () => {
    pushRecent(['a']);
    pushRecent(['b', 'c']);
    pushRecent(['d']);
    pushRecent(['b']);
    expect(getRecentIds()).toEqual(['b', 'd', 'c']);
  });

  it('lists only folders that can take sections, recent first and not repeated', () => {
    const mine = createFolder('ของฉัน');
    const gone = createFolder('ลบแล้ว');
    pushRecent([gone.id, 'grp-judge']);
    deleteFolder(gone.id);
    const { recent, groups, mine: own } = pickerLists();
    expect(recent.map(f => f.id)).toEqual(['grp-judge']);
    expect(groups.map(f => f.id)).toEqual(['grp-nethi', 'grp-attorney']);
    expect(own.map(f => f.id)).toEqual([mine.id]);
    expect([...recent, ...groups, ...own].map(f => f.id)).not.toContain('grp-forgotten');
  });
});
