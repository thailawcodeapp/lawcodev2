import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { collectParagraphs, buildManifest, BOOKS } from './corpus.mjs';

describe('collectParagraphs', () => {
  const paragraphs = collectParagraphs();

  it('covers all four books', () => {
    expect(BOOKS).toEqual(['civil-th', 'civil-proc-th', 'criminal-th', 'criminal-proc-th']);
  });

  it('yields one entry per paragraph in the corpus', () => {
    expect(paragraphs).toHaveLength(6764);
  });

  // The whole corpus was once rendered without this: parseBody only ever sees
  // section.text, and the number lives in section.number, so every clip read
  // the body and never said which section it belonged to. Nothing failed —
  // the counts, the hashes and the manifest were all self-consistent, and the
  // gap was only audible by listening to a finished file.
  it('opens every section by saying its number', () => {
    const firsts = paragraphs.filter((p) => p.paraIndex === 0);
    expect(firsts).toHaveLength(3109);
    const head = (p) => `มาตรา ${p.number.replace('/', ' ทับ ')}`;
    expect(firsts.every((p) => p.text.startsWith(`${head(p)} `) || p.text.startsWith(`${head(p)}, `))).toBe(true);
  });

  // The comma join, pinned by count rather than only by rule: it exists to
  // stop "มาตรา 170 ห้ามมิให้ฟ้อง" being read as "หนึ่งร้อยเจ็ดสิบห้า มิให้ฟ้อง",
  // and every section it touches is a paragraph that has to be re-rendered and
  // re-uploaded. A change that quietly widened it — dropping the
  // divisible-by-ten test, say — would invalidate audio nobody meant to
  // replace, and the count is what notices.
  it('joins the number to the text with a comma in exactly the five places it must', () => {
    const commaJoined = paragraphs.filter(
      (p) => p.paraIndex === 0 && p.text.startsWith(`มาตรา ${p.number.replace('/', ' ทับ ')}, `),
    );
    expect(commaJoined.map((p) => p.sectionId).sort()).toEqual([
      'civil_proc-170', 'criminal_proc-120', 'criminal_proc-190', 'criminal_proc-220', 'pp-1040',
    ]);
  });

  // speechUnits prefixes index 0 and nothing else, and thaiSpeech.test.js
  // pins that directly. What this pins instead is the corpus side: a heading
  // leaking out of parseBody and into the body shows up as an extra paragraph
  // opening with the word มาตรา. That is exactly how "172 ทวิ/1" was found —
  // its number was read twice — and it was invisible to every count-based
  // check. Eight are legitimate: repealed sections like "มาตรา 208 (ยกเลิก)"
  // folded into a neighbouring section's text.
  it('has no section heading leaking into a body paragraph', () => {
    const opensWithMaatra = paragraphs.filter((p) => p.paraIndex > 0 && p.text.startsWith('มาตรา '));
    expect(opensWithMaatra.every((p) => p.text.includes('(ยกเลิก)'))).toBe(true);
    expect(opensWithMaatra).toHaveLength(8);
  });

  it('normalizes the text it will send', () => {
    const withSlash = paragraphs.filter((p) => p.text.includes(' ทับ '));
    expect(withSlash.length).toBeGreaterThan(0);
    expect(paragraphs.some((p) => /มาตรา \d+\/\d+/.test(p.text))).toBe(false);
  });

  it('gives every entry a 16-hex hash matching its text', () => {
    expect(paragraphs.every((p) => /^[0-9a-f]{16}$/.test(p.hash))).toBe(true);
  });

  it('numbers paragraphs from zero within each section', () => {
    const bySection = new Map();
    for (const p of paragraphs) {
      if (!bySection.has(p.sectionId)) bySection.set(p.sectionId, []);
      bySection.get(p.sectionId).push(p.paraIndex);
    }
    for (const [, indices] of bySection) {
      expect(indices).toEqual(indices.map((_, i) => i));
    }
  });

  it('never yields empty text', () => {
    expect(paragraphs.every((p) => p.text.trim().length > 0)).toBe(true);
  });
});

describe('buildManifest', () => {
  it('maps a section id to its hashes in paragraph order', () => {
    const manifest = buildManifest([
      { sectionId: 'pp-1', paraIndex: 1, hash: 'bbbbbbbbbbbbbbbb' },
      { sectionId: 'pp-1', paraIndex: 0, hash: 'aaaaaaaaaaaaaaaa' },
      { sectionId: 'pp-2', paraIndex: 0, hash: 'cccccccccccccccc' },
    ]);
    expect(manifest).toEqual({
      'pp-1': ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb'],
      'pp-2': ['cccccccccccccccc'],
    });
  });

  it('covers every section that has a paragraph', () => {
    const manifest = buildManifest(collectParagraphs());
    expect(Object.keys(manifest).length).toBeGreaterThan(3000);
  });
});

describe('the committed manifest', () => {
  // The paragraph-count pin above catches a parseBody change: the count
  // moves and the test fails. It does NOT catch a speechUnits change
  // — the count stays 6764 while every hash quietly changes underneath it,
  // and every object this pipeline uploads to R2 keeps its old, no-longer-
  // matching name. The app would then look up hashes that no file has.
  //
  // This regenerates the manifest exactly the way render.mjs's main() does
  // — `${JSON.stringify(buildManifest(collectParagraphs()))}\n` — and diffs
  // it against what is actually committed, so any drift in parseBody OR
  // speechUnits OR audioHash fails here, before a render ever runs.
  it('is exactly what the pipeline regenerates', () => {
    const regenerated = `${JSON.stringify(buildManifest(collectParagraphs()))}\n`;
    const committed = readFileSync('src/data/audio-manifest.json', 'utf8');
    expect(regenerated).toBe(committed);
  });
});
