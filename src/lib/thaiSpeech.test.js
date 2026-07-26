import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { normalizeForSpeech, speechUnits } from './thaiSpeech';

describe('speechUnits — what one section sounds like', () => {
  it('leads paragraph 0 with the section number', () => {
    expect(speechUnits('5', ['บุคคลย่อมพ้น', 'วรรคสอง']))
      .toEqual(['มาตรา 5 บุคคลย่อมพ้น', 'วรรคสอง']);
  });

  it('normalizes the number it speaks', () => {
    expect(speechUnits('193/30', ['ก'])[0]).toBe('มาตรา 193 ทับ 30 ก');
  });

  it('still speaks the number when a section has no body', () => {
    expect(speechUnits('5', [])).toEqual(['มาตรา 5']);
    expect(speechUnits('5', null)).toEqual(['มาตรา 5']);
  });

  // Joining before normalising would put "มาตรา 5 " inside LOOKBACK's reach,
  // so a fraction at the very start of the body would be misread as a section
  // reference. Civil 968's "ร้อยละ 1/6" is exactly that shape, and it was
  // verified aloud on a device — this pins that the order stays safe.
  it('does not let the number prefix reach into the body', () => {
    expect(speechUnits('5', ['ร้อยละ 1/6 ต่อปี']))
      .toEqual(['มาตรา 5 ร้อยละ 1/6 ต่อปี']);
  });
});

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
    // Counts what the function actually did, rather than re-deriving the match
    // conditions here — a copy of the logic would keep passing after the real
    // one drifted, which is the opposite of what this test is for.
    // ' ทับ ' appears nowhere in the source text, so every occurrence in the
    // output was introduced here, and any N/M left in the output was skipped
    // on purpose.
    let converted = 0;
    const skipped = [];
    for (const s of allSections()) {
      const spoken = normalizeForSpeech(s.text || '');
      converted += (spoken.match(/ ทับ /g) || []).length;
      for (const m of spoken.matchAll(/\d+\/\d+/g)) skipped.push(`${s.number}: ${m[0]}`);
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
