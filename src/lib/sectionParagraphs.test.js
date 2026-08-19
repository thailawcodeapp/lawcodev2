import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseBody, cleanTitle } from './sectionParagraphs';

describe('parseBody', () => {
  it('strips the section heading from the body', () => {
    expect(parseBody('มาตรา 420  ผู้ใดจงใจ')[0]).toBe('ผู้ใดจงใจ');
  });

  it('strips a heading whose ordinal precedes a sub-number', () => {
    expect(parseBody('มาตรา 172 ทวิ/1  ภายหลังที่ศาล')[0]).toBe('ภายหลังที่ศาล');
  });

  it('does not eat ฉ from a real word', () => {
    expect(parseBody('มาตรา 342 ฉ้อโกงประชาชน')[0]).toBe('ฉ้อโกงประชาชน');
  });

  it('prefers blank lines as the separator when the text has them', () => {
    expect(parseBody('มาตรา 1  ก\nข\n\nค')).toEqual(['ก\nข', 'ค']);
  });

  it('falls back to single newlines when there are no blank lines', () => {
    expect(parseBody('มาตรา 1  ก\nข')).toEqual(['ก', 'ข']);
  });

  it('returns an empty array for empty or heading-only input', () => {
    expect(parseBody('')).toEqual([]);
    expect(parseBody(null)).toEqual([]);
    expect(parseBody('มาตรา 1')).toEqual([]);
  });
});

describe('cleanTitle', () => {
  it('strips the heading from a title', () => {
    expect(cleanTitle('มาตรา 420 ละเมิด')).toBe('ละเมิด');
  });
});

describe('the corpus splits the same way for everyone', () => {
  // The renderer names each audio file after a hash of the paragraph text.
  // If the renderer's idea of a paragraph ever drifts from the app's, every
  // hash misses and the app silently falls back to on-device speech for the
  // entire corpus. This pins the count so that drift fails here first.
  it('yields exactly 6754 paragraphs across the four codes', () => {
    const books = [
      'public/data/civil-th.json',
      'public/data/civil-proc-th.json',
      'public/data/criminal-th.json',
      'public/data/criminal-proc-th.json',
    ];
    let total = 0;
    for (const f of books) {
      for (const s of JSON.parse(readFileSync(f, 'utf8')).sections) {
        total += parseBody(s.text).length;
      }
    }
    expect(total).toBe(6754);
  });

  it('never leaves a heading fragment in a first paragraph', () => {
    const leaks = [];
    for (const f of ['public/data/criminal-proc-th.json', 'public/data/civil-th.json']) {
      for (const s of JSON.parse(readFileSync(f, 'utf8')).sections) {
        const first = parseBody(s.text)[0] || '';
        if (/^มาตรา\s/.test(first)) leaks.push(String(s.number));
      }
    }
    expect(leaks).toEqual([]);
  });
});
