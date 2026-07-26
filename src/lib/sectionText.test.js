import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseBody } from './sectionText';

const BOOKS = [
  'public/data/civil-th.json',
  'public/data/civil-proc-th.json',
  'public/data/criminal-th.json',
  'public/data/criminal-proc-th.json',
];

const loadBook = (f) => JSON.parse(readFileSync(f, 'utf8'));

const findSection = (bookFile, number) =>
  loadBook(bookFile).sections.find((s) => String(s.number) === String(number));

// A Thai ordinal sitting between the digits and the slash, followed
// immediately by a digit/slash, is a heading fragment — not the start of
// real prose.
const HEADING_LEAK_RE =
  /^(?:มาตรา\s|(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)[\d/])/;

describe('parseBody — 172 ทวิ/1 and 172 ทวิ/2 (the reported bug)', () => {
  it('does not repeat the ordinal at the start of the first paragraph — 172 ทวิ/1', () => {
    const sec = findSection('public/data/criminal-proc-th.json', '172 ทวิ/1');
    expect(sec).toBeTruthy();
    const [first] = parseBody(sec.text);
    expect(first.startsWith('ทวิ')).toBe(false);
    expect(first.startsWith('ภายหลังที่ศาลได้ดำเนินการ')).toBe(true);
  });

  it('does not repeat the ordinal at the start of the first paragraph — 172 ทวิ/2', () => {
    const sec = findSection('public/data/criminal-proc-th.json', '172 ทวิ/2');
    expect(sec).toBeTruthy();
    const [first] = parseBody(sec.text);
    expect(first.startsWith('ทวิ')).toBe(false);
    expect(first.startsWith('ในคดีที่จำเลยเป็นนิติบุคคล')).toBe(true);
  });
});

describe('parseBody — does not eat a real word starting with an ordinal letter', () => {
  it('keeps "ฉ้อโกง" intact instead of stripping its leading ฉ', () => {
    const [first] = parseBody('มาตรา 342 ฉ้อโกง เป็นความผิดตามประมวลกฎหมายอาญา');
    expect(first.startsWith('ฉ้อโกง')).toBe(true);
  });
});

describe('parseBody — unaffected cases stay unaffected', () => {
  it('strips a plain numbered heading (172)', () => {
    const sec = findSection('public/data/criminal-proc-th.json', '172');
    const [first] = parseBody(sec.text);
    expect(first.startsWith('มาตรา')).toBe(false);
    expect(first.startsWith('การพิจารณาและสืบพยานในศาล')).toBe(true);
  });

  it('still strips a plain trailing ordinal (civil-proc-th 4 ฉ)', () => {
    const sec = findSection('public/data/civil-proc-th.json', '4 ฉ');
    expect(sec).toBeTruthy();
    const [first] = parseBody(sec.text);
    expect(first.startsWith('มาตรา')).toBe(false);
    expect(first.startsWith('คำร้องขอเกี่ยวกับทรัพย์สิน')).toBe(true);
  });
});

describe('parseBody — corpus-wide: no section leaks a heading fragment', () => {
  it('zero sections have a first paragraph starting with a heading fragment', () => {
    const leaks = [];
    for (const f of BOOKS) {
      for (const s of loadBook(f).sections) {
        const [first] = parseBody(s.text);
        if (first && HEADING_LEAK_RE.test(first)) {
          leaks.push(`${f} ${s.number}: ${JSON.stringify(first.slice(0, 20))}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
