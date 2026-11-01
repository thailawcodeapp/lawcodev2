import { describe, expect, it } from 'vitest';
import { folderArt, ownPosition, OWN_COLORS } from './folderArt.js';

const own = (n) => ({ id: `f_${n}`, name: `โฟลเดอร์ ${n}`, type: 'leaf', createdAt: n });

describe('folder art', () => {
  it('gives the built-in folders their own art, whatever they are renamed to', () => {
    const a = folderArt({ id: 'grp-forgotten', name: 'จำไม่ได้' }, [], {});
    expect(a).toMatchObject({ key: 'forgotten', symbol: '?', image: null });
    expect(folderArt({ id: 'grp-nethi', name: 'ชื่อใหม่' }, [], {}).key).toBe('nethi');
  });

  it('uses the picture once its file is there', () => {
    expect(folderArt({ id: 'grp-judge', name: 'x' }, [], { judge: '/j.jpg' }).image).toBe('/j.jpg');
  });

  it('takes the six patterns in turn, oldest folder first, then starts over', () => {
    const folders = [own(3), own(1), own(2), own(4), own(5), own(6), own(7)];
    const keys = [1, 2, 3, 4, 5, 6, 7].map(n => folderArt(own(n), folders, {}).key);
    expect(keys).toEqual(['own-1', 'own-2', 'own-3', 'own-4', 'own-5', 'own-6', 'own-1']);
    expect(OWN_COLORS).toContain(folderArt(own(1), folders, {}).color);
  });

  it('counts only the user\'s own top-level folders', () => {
    const folders = [
      { id: 'grp-nethi', type: 'group', createdAt: 0 },
      { id: 'grp-nethi-civil', type: 'leaf', parentId: 'grp-nethi', createdAt: 0 },
      own(1), own(2),
    ];
    expect(ownPosition(own(2), folders)).toBe(1);
  });

  it('shows no letter on a folder the user made', () => {
    expect(folderArt(own(1), [own(1)], {}).symbol).toBe('');
  });
});
