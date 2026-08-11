import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { normalizeForSpeech, speechUnits, addRenderPauses } from './thaiSpeech';

describe('normalizeForSpeech — ลหุโทษ', () => {
  it('respells the word so the engine stops inventing one', () => {
    // Heard on device as "ดล ละ หุ โทษ", and in criminal section 104 collapsed
    // to "โด้ด". Respelling as one phonetic word is the fix; an earlier
    // spaced version paused between the syllables.
    expect(normalizeForSpeech('ความผิดลหุโทษ')).toBe('ความผิดละหุโทด');
  });

  it('fixes every occurrence in one paragraph, not just the first', () => {
    expect(normalizeForSpeech('ลหุโทษ และ ลหุโทษ')).toBe('ละหุโทด และ ละหุโทด');
  });

  it('leaves text without the word alone', () => {
    expect(normalizeForSpeech('ความผิดอาญา')).toBe('ความผิดอาญา');
  });

  it('still converts a section number in the same paragraph', () => {
    // The two rules run in sequence over one string; neither may eat the other.
    expect(normalizeForSpeech('มาตรา 102/1 ความผิดลหุโทษ'))
      .toBe('มาตรา 102 ทับ 1 ความผิดละหุโทด');
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

describe('normalizeForSpeech — sub-clause labels', () => {
  it('reads a bare label by name, plain text, no markup', () => {
    expect(normalizeForSpeech('(1) ชื่อศาลและวันเดือนปี')).toBe('อนุมาตรา 1 ชื่อศาลและวันเดือนปี');
  });

  it('converts every bare label in one paragraph', () => {
    expect(normalizeForSpeech('(1) นำทรัพย์สินไปลงทุน หรือ (2) รับคืน'))
      .toBe('อนุมาตรา 1 นำทรัพย์สินไปลงทุน หรือ อนุมาตรา 2 รับคืน');
  });

  it('spells the male label phonetically, so "อนุ 1" cannot be heard as "อนึ่ง"', () => {
    expect(normalizeForSpeech('(1) นำทรัพย์สินไปลงทุน', 'm')).toBe('อะนุ 1 นำทรัพย์สินไปลงทุน');
    // Only 1 collides, so only 1 is respelled — every other label keeps the
    // audio it already has.
    expect(normalizeForSpeech('(2) รับคืน', 'm')).toBe('อนุ 2 รับคืน');
    expect(normalizeForSpeech('(11) รับคืน', 'm')).toBe('อนุ 11 รับคืน');
    // The female voice's wording is untouched — its hashes are already shipped.
    expect(normalizeForSpeech('(1) นำทรัพย์สินไปลงทุน')).toBe('อนุมาตรา 1 นำทรัพย์สินไปลงทุน');
  });

  it('leaves a citation as digits even for the male voice', () => {
    // "อนุมาตรา 1" is the female voice's wording and has never been misread,
    // so the spelling-out that "อนุ 1" needs does not apply here.
    expect(normalizeForSpeech('ตามอนุมาตรา (1) นี้', 'm')).toBe('ตามอนุมาตรา 1 นี้');
  });

  it('does not repeat the label when the text already said it — male only', () => {
    // Thirteen paragraphs cite a sub-clause in prose, where naming it again
    // reads "อนุมาตรา อนุ 2".
    expect(normalizeForSpeech('ให้ใช้บทบัญญัติอนุมาตรา (2)', 'm'))
      .toBe('ให้ใช้บทบัญญัติอนุมาตรา 2');
    // The female voice keeps the repetition on purpose: its audio for those
    // thirteen is already rendered and shipped, and fixing the wording would
    // change their hashes. Untidy, not wrong.
    expect(normalizeForSpeech('ให้ใช้บทบัญญัติอนุมาตรา (2)'))
      .toBe('ให้ใช้บทบัญญัติอนุมาตรา อนุมาตรา 2');
  });

  it('still labels a bare number later in a paragraph that cited one earlier', () => {
    // civil_proc-36 does both: prose citing "อนุมาตรา (2)" and bare labels of
    // its own. Only the citation may lose the added word.
    expect(normalizeForSpeech('ตามอนุมาตรา (2) นี้ ให้ (3) ใช้บังคับ', 'm'))
      .toBe('ตามอนุมาตรา 2 นี้ ให้ อนุ 3 ใช้บังคับ');
  });

  it('does not touch a slash-in-parens reference, which is not a bare label', () => {
    // "(4/1)" is SLASH_RE's isSubClause case, not SUBCLAUSE_LABEL_RE's — it
    // has no bare "(digit)" anywhere.
    expect(normalizeForSpeech('(4/1) คู่สมรสฝ่ายใดฝ่ายหนึ่ง'))
      .toBe('(4 ทับ 1) คู่สมรสฝ่ายใดฝ่ายหนึ่ง');
  });

  it('never emits markup — this text also goes straight to the on-device engine', () => {
    expect(normalizeForSpeech('(1) A & B')).not.toMatch(/[<>]/);
  });
});

// addRenderPauses is SSML and is never fed to normalizeForSpeech/speechUnits
// — it is applied only inside render.mjs, right before the cloud API call,
// on text that already passed through normalizeForSpeech.
describe('addRenderPauses — cloud-render-only SSML, not part of normalizeForSpeech', () => {
  it('does nothing to a paragraph with no อนุมาตรา label', () => {
    const t = 'ผู้ใดจงใจหรือประมาทเลินเล่อ ทำต่อบุคคลอื่นโดยผิดกฎหมาย';
    expect(addRenderPauses(t)).toBe(t);
  });

  it('pauses after a label paragraph\'s word boundaries', () => {
    expect(addRenderPauses('อนุมาตรา 1 ชื่อศาลและวันเดือนปี'))
      .toBe('อนุมาตรา 1<break time="200ms"/>ชื่อศาลและวันเดือนปี');
  });

  it('does not pause between the label word and its number', () => {
    expect(addRenderPauses('อนุมาตรา 2 คดีระหว่างผู้ใด')).toMatch(/^อนุมาตรา 2<break/);
  });

  it('does not pause right before a continuation word', () => {
    expect(addRenderPauses('อนุมาตรา 1 นำทรัพย์สินไปลงทุน หรือ อนุมาตรา 2 รับคืน'))
      .toBe('อนุมาตรา 1<break time="200ms"/>นำทรัพย์สินไปลงทุน หรือ<break time="200ms"/>อนุมาตรา 2<break time="200ms"/>รับคืน');
  });

  it('does not pause around ทับ inside a section reference', () => {
    expect(addRenderPauses('อนุมาตรา 1 อ้างมาตรา 172 ทับ 2 ประกอบด้วย'))
      .toBe('อนุมาตรา 1<break time="200ms"/>อ้างมาตรา<break time="200ms"/>172 ทับ 2<break time="200ms"/>ประกอบด้วย');
  });

  it('leaves a double space in the source untouched', () => {
    expect(addRenderPauses('อนุมาตรา 1 ก  ข')).toBe('อนุมาตรา 1<break time="200ms"/>ก  ข');
  });

  it('escapes an XML-significant character', () => {
    expect(addRenderPauses('อนุมาตรา 1 A & B'))
      .toBe('อนุมาตรา 1<break time="200ms"/>A<break time="200ms"/>&amp;<break time="200ms"/>B');
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

  it('changes nothing but the three known rules, anywhere in the corpus', () => {
    for (const s of allSections()) {
      const text = s.text || '';
      const spoken = normalizeForSpeech(text);
      // Undo exactly what the three rules are allowed to introduce, then the
      // strings must be identical — no dropped, reordered or added words.
      // This is the guard that the law text itself is never altered, so each
      // new rule has to be reversed here explicitly. A rule that cannot be
      // undone by a single substitution does not belong in this function.
      // Some sections' own prose already says "อนุมาตรา 4" verbatim (civil
      // 1060) — a blind อนุมาตรา->(n) undo would wrongly rewrite that. Only
      // undo it for a section the rule could actually have fired on, i.e.
      // one whose *source* text has a bare "(digit)" label somewhere.
      const hadBareLabel = /\(\d+\)/.test(text);
      const undone = spoken
        .replace(/ ทับ /g, '/')
        .replace(/ละหุโทด/g, 'ลหุโทษ');
      const final = hadBareLabel ? undone.replace(/อนุมาตรา (\d+)/g, '($1)') : undone;
      expect(final).toBe(text);
    }
  });

  it('labels exactly the sections that have a bare sub-clause number', () => {
    // Same discipline as the ทับ and ลหุโทษ counts above: pins what the
    // function actually does today. Counts sections whose *output* contains
    // an อนุมาตรา label — one of the 405 the rule actually converted, plus
    // civil 1060, whose own prose already says "อนุมาตรา 4/5" verbatim and
    // was never touched by the rule (see the reversibility test above).
    // addRenderPauses in the render pipeline gates on this same marker, so
    // 1060 also gets pauses even though normalizeForSpeech didn't rewrite
    // it — a false positive worth knowing about rather than filtering out
    // here, since it costs nothing (no cached file for a paragraph that was
    // already plain text either way).
    const touchedSections = new Set();
    let labelOccurrences = 0;
    for (const s of allSections()) {
      const spoken = normalizeForSpeech(s.text || '');
      const hits = (spoken.match(/อนุมาตรา \d+/g) || []).length;
      if (hits) { touchedSections.add(String(s.number)); labelOccurrences += hits; }
    }
    // Fewer than the 406 sections actually touched, because a section
    // number like "5" recurs across the four books and this Set — same as
    // the ลหุโทษ count below — collapses those into one key.
    expect(touchedSections.size).toBe(406);
    expect(labelOccurrences).toBe(1828);
  });

  it('respells ลหุโทษ in exactly the 17 places the corpus has it', () => {
    // Counted from the function's own output, not from a search of the source
    // — the same discipline as the slash count above. If a future rule ever
    // swallowed one of these, this number moves.
    let respelled = 0;
    const sections = new Set();
    for (const s of allSections()) {
      const hits = (normalizeForSpeech(s.text || '').match(/ละหุโทด/g) || []).length;
      if (hits) { respelled += hits; sections.add(String(s.number)); }
    }
    expect(respelled).toBe(17);
    expect(sections.size).toBe(13);
  });
});
