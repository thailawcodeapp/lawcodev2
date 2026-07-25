import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { normalizeForSpeech } from './thaiSpeech';

describe('normalizeForSpeech — converts section numbers', () => {
  it('reads a slash in a section number as ทับ', () => {
    expect(normalizeForSpeech('มาตรา 193/30')).toBe('มาตรา 193 ทับ 30');
  });

  it('converts a reference inside the body', () => {
    expect(normalizeForSpeech('ให้นำมาตรา 1598/21 มาใช้บังคับ'))
      .toBe('ให้นำมาตรา 1598 ทับ 21 มาใช้บังคับ');
  });

  it('handles a Thai ordinal between the digits and the slash', () => {
    expect(normalizeForSpeech('มาตรา 172 ทวิ/1')).toBe('มาตรา 172 ทวิ ทับ 1');
  });

  it('converts a parenthesised sub-clause number', () => {
    expect(normalizeForSpeech('(4/1) คู่สมรสฝ่ายใดฝ่ายหนึ่ง'))
      .toBe('(4 ทับ 1) คู่สมรสฝ่ายใดฝ่ายหนึ่ง');
  });

  it('converts every occurrence in one string', () => {
    expect(normalizeForSpeech('มาตรา 3/1 และมาตรา 3/2'))
      .toBe('มาตรา 3 ทับ 1 และมาตรา 3 ทับ 2');
  });
});

describe('normalizeForSpeech — leaves everything else alone', () => {
  it('does not touch a real fraction (civil s.968 discount rate)', () => {
    const t = 'ท่านให้คิดร้อยละ 1/6 ในต้นเงินอันจะพึงใช้ตามตั๋วเงิน';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('does not touch a slash with no มาตรา in front of it', () => {
    expect(normalizeForSpeech('อัตรา 3/4 ของทั้งหมด')).toBe('อัตรา 3/4 ของทั้งหมด');
  });

  it('leaves ordinary prose untouched', () => {
    const t = 'ผู้ใดจงใจหรือประมาทเลินเล่อ ทำต่อบุคคลอื่นโดยผิดกฎหมาย';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('does not insert commas or otherwise repunctuate', () => {
    const t = 'แก่ร่างกายก็ดี อนามัยก็ดี เสรีภาพก็ดี';
    expect(normalizeForSpeech(t)).toBe(t);
  });

  it('handles empty and nullish input', () => {
    expect(normalizeForSpeech('')).toBe('');
    expect(normalizeForSpeech(null)).toBe('');
    expect(normalizeForSpeech(undefined)).toBe('');
  });
});

const BOOKS = [
  'public/data/civil-th.json',
  'public/data/civil-proc-th.json',
  'public/data/criminal-th.json',
  'public/data/criminal-proc-th.json',
];

const allSections = () =>
  BOOKS.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).sections);

describe('normalizeForSpeech — against the real corpus', () => {
  it('converts exactly 437 sites and skips exactly 1', () => {
    let converted = 0;
    const skipped = [];
    for (const s of allSections()) {
      const text = s.text || '';
      for (const m of text.matchAll(/(\d+(?:\s*[฀-๿]+)?)\/(\d+)/g)) {
        const isSub = text[m.index - 1] === '(' && text[m.index + m[0].length] === ')';
        const follows = /มาตรา[\s฀-๿]{0,8}$/
          .test(text.slice(Math.max(0, m.index - 20), m.index));
        if (isSub || follows) converted += 1;
        else skipped.push(`${s.number}: ${m[0]}`);
      }
    }
    expect(converted).toBe(437);
    expect(skipped).toEqual(['968: 1/6']);
  });

  it('changes nothing but slashes anywhere in the corpus', () => {
    for (const s of allSections()) {
      const text = s.text || '';
      const spoken = normalizeForSpeech(text);
      // Strip the one construct the rule is allowed to introduce, then the
      // two strings must be identical — no dropped, reordered or added words.
      expect(spoken.replace(/ ทับ /g, '/')).toBe(text);
    }
  });
});
