// The first five books get a leaf in every permanent group up front; the acts
// added after them get one only when something of theirs goes in, so the
// folder lists (and older app versions that receive them by sync) do not grow
// by 24 empty folders.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/sync/dirty', () => ({ markDirty: () => {} }));

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getFolders, addSectionsToGroup, syncForgottenFolder, sortSectionsByNumber } = await import('./folders.js');

const leavesOf = (groupId) => getFolders().filter(f => f.parentId === groupId).map(f => f.bookId);

describe('per-book leaves in the permanent groups', () => {
  beforeEach(() => store.clear());

  it('seeds only the first five books', () => {
    expect(leavesOf('grp-nethi')).toEqual(['civil', 'criminal', 'civil_proc', 'criminal_proc', 'court_org']);
    expect(getFolders()).toHaveLength(4 + 4 * 5);
  });

  it('makes a later book\'s leaf when a section of it is added to the group', () => {
    addSectionsToGroup('grp-judge', [
      { sectionId: 'labour_protection-118', bookId: 'labour_protection', number: '118', title: 'มาตรา 118 ให้นายจ้างจ่ายค่าชดเชย…' },
    ]);
    const leaf = getFolders().find(f => f.parentId === 'grp-judge' && f.bookId === 'labour_protection');
    expect(leaf).toMatchObject({ name: 'คุ้มครองแรงงาน', type: 'leaf', permanent: false, deletable: true });
    expect(leaf.sections.map(s => s.sectionId)).toEqual(['labour_protection-118']);
    // Only that group gained a leaf.
    expect(leavesOf('grp-nethi')).not.toContain('labour_protection');
    // And it sits in canonical book order, after the seeded five.
    expect(leavesOf('grp-judge').at(-1)).toBe('labour_protection');
  });

  it('makes the forgotten-folder leaf on demand, and leaves it read-only', () => {
    syncForgottenFolder({ sectionId: 'constitution-3', bookId: 'constitution', number: '3', title: 'มาตรา 3', isForgotten: true });
    const leaf = getFolders().find(f => f.id === 'grp-forgotten-constitution');
    expect(leaf).toMatchObject({ parentId: 'grp-forgotten', readOnly: true, deletable: false });
    expect(leaf.sections).toHaveLength(1);
  });

  it('does not recreate a group the user deleted', () => {
    store.set('lawcode-th-folders-tombstones', JSON.stringify(['grp-attorney']));
    addSectionsToGroup('grp-attorney', [{ sectionId: 'admin_court-9', bookId: 'admin_court', number: '9', title: '' }]);
    expect(getFolders().some(f => f.id === 'grp-attorney' || f.parentId === 'grp-attorney')).toBe(false);
  });

  it('sorts the acts after the codes, in book order', () => {
    const sorted = sortSectionsByNumber([
      { bookId: 'labour_protection', number: '5' },
      { bookId: 'constitution', number: '10' },
      { bookId: 'civil', number: '420' },
      { bookId: 'admin_court', number: '41/2' },
      { bookId: 'admin_court', number: '9' },
    ]);
    expect(sorted.map(s => `${s.bookId}:${s.number}`)).toEqual([
      'civil:420', 'constitution:10', 'admin_court:9', 'admin_court:41/2', 'labour_protection:5',
    ]);
  });
});
