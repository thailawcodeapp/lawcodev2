import { describe, expect, it } from 'vitest';
import { LAW_BOOKS_META } from './lawMeta.js';

describe('Wave labels and colours', () => {
  it('has the short labels from the spec, in book order', () => {
    expect(LAW_BOOKS_META.map(m => m.shortLabel)).toEqual([
      'แพ่ง', 'อาญา', 'วิแพ่ง', 'วิอาญา', 'รัฐธรรมนูญ', 'พระธรรมนูญ', 'แรงงาน',
      'ศาลแขวง', 'ศาลปกครอง', 'ล้มละลาย', 'ลิขสิทธิ์', 'ผู้บริโภค', 'ศาลเยาวชน',
    ]);
  });

  it('gives every book its own colour', () => {
    const colours = LAW_BOOKS_META.map(m => m.waveColor);
    expect(colours.every(c => /^#[0-9A-F]{6}$/.test(c))).toBe(true);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
