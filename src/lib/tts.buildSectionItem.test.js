import { describe, it, expect } from 'vitest';
import { buildSectionItem } from './tts';

describe('buildSectionItem', () => {
  it('normalizes the heading chunk', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '193/30',
      title: '', paragraphs: [],
    });
    expect(item.chunks[0].text).toBe('มาตรา 193 ทับ 30');
  });

  it('normalizes references inside the body', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '5',
      title: '', paragraphs: ['ให้นำมาตรา 1598/21 มาใช้บังคับ'],
    });
    expect(item.chunks[1].text).toBe('ให้นำมาตรา 1598 ทับ 21 มาใช้บังคับ');
  });

  it('keeps label unnormalized — it is shown on screen, not spoken', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '193/30',
      title: '', paragraphs: [],
    });
    expect(item.label).toBe('มาตรา 193/30');
    expect(item.number).toBe('193/30');
  });

  it('still maps every chunk to its paragraph index', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ย่อหน้าแรก', 'ย่อหน้าที่สอง'],
    });
    expect(item.chunks.map((c) => c.paraIndex)).toEqual([-1, 0, 1]);
  });
});
