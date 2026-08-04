import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { normalizeForSpeech, speechUnits } from './thaiSpeech';

describe('normalizeForSpeech — ลหุโทษ', () => {
  it('spaces the syllables so the engine stops inventing a word', () => {
    // Heard on device as "ดล ละ หุ โทษ", and in criminal section 104 collapsed
    // to "โด้ด". Spacing is the whole fix.
    expect(normalizeForSpeech('ความผิดลหุโทษ')).toBe('ความผิดละ หุ โทษ');
  });

  it('fixes every occurrence in one paragraph, not just the first', () => {
    expect(normalizeForSpeech('ลหุโทษ และ ลหุโทษ')).toBe('ละ หุ โทษ และ ละ หุ โทษ');
  });

  it('leaves text without the word alone', () => {
    expect(normalizeForSpeech('ความผิดอาญา')).toBe('ความผิดอาญา');
  });

  it('still converts a section number in the same paragraph', () => {
    // The two rules run in sequence over one string; neither may eat the other.
    expect(normalizeForSpeech('มาตรา 102/1 ความผิดลหุโทษ'))
      .toBe('มาตรา 102 ทับ 1 ความผิดละ หุ โทษ');
  });
});

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

  it('changes nothing but the two known rules, anywhere in the corpus', () => {
    for (const s of allSections()) {
      const text = s.text || '';
      const spoken = normalizeForSpeech(text);
      // Undo exactly what the two rules are allowed to introduce, then the
      // strings must be identical — no dropped, reordered or added words.
      // This is the guard that the law text itself is never altered, so each
      // new rule has to be reversed here explicitly. A rule that cannot be
      // undone by a single substitution does not belong in this function.
      const undone = spoken
        .replace(/ ทับ /g, '/')
        .replace(/ละ หุ โทษ/g, 'ลหุโทษ');
      expect(undone).toBe(text);
    }
  });

  it('spaces ลหุโทษ in exactly the 17 places the corpus has it', () => {
    // Counted from the function's own output, not from a search of the source
    // — the same discipline as the slash count above. If a future rule ever
    // swallowed one of these, this number moves.
    let spaced = 0;
    const sections = new Set();
    for (const s of allSections()) {
      const hits = (normalizeForSpeech(s.text || '').match(/ละ หุ โทษ/g) || []).length;
      if (hits) { spaced += hits; sections.add(String(s.number)); }
    }
    expect(spaced).toBe(17);
    expect(sections.size).toBe(13);
  });
});
