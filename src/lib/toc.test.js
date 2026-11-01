import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { sectionsInRange, leafNodes } from './toc';
import { LAW_BOOKS_META } from '../data/lawMeta';

const book = (...numbers) => ({ sections: numbers.map(number => ({ number })) });
const pick = (b, range) => sectionsInRange(b, range).map(s => s.number);

describe('sectionsInRange', () => {
  it('takes in the ordinals of a plain end, as the hand-built contents expect', () => {
    expect(pick(book('335', '336', '336 ทวิ', '337'), { from: '335', to: '336' }))
      .toEqual(['335', '336', '336 ทวิ']);
  });

  it('stops at the named section when the range is exact', () => {
    const b = book('12', '13', '13 ทวิ', '13 อัฏฐ', '14');
    expect(pick(b, { from: '12', to: '13', exact: true })).toEqual(['12', '13']);
    expect(pick(b, { from: '13 ทวิ', to: '13 อัฏฐ', exact: true })).toEqual(['13 ทวิ', '13 อัฏฐ']);
  });
});

describe('the contents of every book', () => {
  it.each(LAW_BOOKS_META.map(m => [m.id, m.dataFile]))('%s puts each section in a leaf', (id, dataFile) => {
    const data = JSON.parse(readFileSync(`public${dataFile}`, 'utf8'));
    const toc = JSON.parse(readFileSync(`public/data/toc-${id}.json`, 'utf8'));
    const seen = new Set(leafNodes(toc).flatMap(l => sectionsInRange(data, l.range).map(s => s.number)));
    expect(seen.size).toBe(data.sections.length);
  });

  it('puts each Revenue Code section in exactly one leaf', () => {
    const data = JSON.parse(readFileSync('public/data/revenue-th.json', 'utf8'));
    const toc = JSON.parse(readFileSync('public/data/toc-revenue.json', 'utf8'));
    const all = leafNodes(toc).flatMap(l => sectionsInRange(data, l.range).map(s => s.number));
    expect(all).toHaveLength(325);
    expect(new Set(all).size).toBe(325);
  });
});
