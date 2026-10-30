import { describe, expect, it } from 'vitest';
import { folderArt, patternIndex, OWN_COLORS } from './folderArt.js';

describe('folder art', () => {
  it('gives the built-in folders their own art, whatever they are renamed to', () => {
    const a = folderArt({ id: 'grp-forgotten', name: 'จำไม่ได้' }, {});
    expect(a).toMatchObject({ key: 'forgotten', symbol: '?', image: null, letter: null });
    expect(folderArt({ id: 'grp-nethi', name: 'ชื่อใหม่' }, {}).key).toBe('nethi');
  });

  it('uses the picture once its file is there', () => {
    expect(folderArt({ id: 'grp-judge', name: 'x' }, { judge: '/j.jpg' }).image).toBe('/j.jpg');
  });

  it('gives a user folder a stable pattern and its initial', () => {
    const f = { id: 'f-1730000000000', name: 'สอบเนติ' };
    const a = folderArt(f, {});
    expect(a.letter).toBe('ส');
    expect(a.key).toBe(`own-${patternIndex(f.id) + 1}`);
    expect(OWN_COLORS).toContain(a.color);
    expect(folderArt({ ...f, name: 'เปลี่ยนชื่อ' }, {}).key).toBe(a.key);
  });

  it('spreads user folders over all six patterns', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => patternIndex(`f-${i}`)));
    expect(seen.size).toBe(6);
  });
});
