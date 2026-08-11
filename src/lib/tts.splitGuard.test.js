import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';

// splitLong only runs on the device-voice path — a paragraph that has a
// pre-rendered file is one whole unit and is never cut. So the feature has to
// be forced off here, or every section in the corpus collapses to one chunk
// per paragraph, the boundary loop below finds no boundaries, and this whole
// file passes without testing anything. It did exactly that the moment
// AUDIO_BASE_URL was filled in.
vi.mock('./audioManifest', () => ({
  isAudioEnabled: () => false,
  audioHashFor: () => null,
  audioUrl: () => null,
  DEFAULT_VOICE: 'm',
}));

const { buildSectionItem } = await import('./tts');

// Mirrors src/lib/sectionText.js parseBody — kept in sync deliberately, not
// imported, so this test exercises the same paragraph splitting the reader
// screen actually uses without pulling in its React-adjacent module graph.
const THAI_NUM_SUFFIX =
  '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)';
const HEADING_RE = new RegExp(
  `^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX}(?:/[\\d/]+)?(?=\\s|$))?\\s*`,
  'i',
);
const LEADING_SUFFIX_RE = new RegExp(`^${THAI_NUM_SUFFIX}(?=\\s)\\s+`, 'i');

function parseBody(text) {
  const cleaned = String(text || '')
    .replace(HEADING_RE, '')
    .replace(LEADING_SUFFIX_RE, '')
    .trim();
  if (!cleaned) return [];
  const separator = /\n{2,}/.test(cleaned) ? /\n{2,}/ : /\n/;
  return cleaned.split(separator).map((p) => p.trim()).filter(Boolean);
}

function chunksFor(section) {
  const item = buildSectionItem({
    sectionId: section.id,
    bookId: section.bookId,
    number: section.number,
    title: section.title,
    paragraphs: parseBody(section.text),
  });
  return item.chunks.map((c) => c.text);
}

// A split is bad if a chunk boundary lands inside "N ทับ M": either a chunk
// ends right before " ทับ" (stranding the number with nothing to explain a
// sentence-final pause), or the next chunk starts with "ทับ" (a bare
// fraction-word with no number before it).
function badSplitSites(chunks) {
  const sites = [];
  for (let i = 0; i < chunks.length - 1; i++) {
    const end = chunks[i];
    const next = chunks[i + 1];
    if (/ ทับ$/.test(end) || /^ทับ(\s|$)/.test(next)) {
      sites.push({ end, next });
    }
  }
  return sites;
}

const BOOKS = [
  'public/data/civil-th.json',
  'public/data/civil-proc-th.json',
  'public/data/criminal-th.json',
  'public/data/criminal-proc-th.json',
];

const sectionsOf = (file) => JSON.parse(readFileSync(file, 'utf8')).sections;

const allSections = () => BOOKS.flatMap(sectionsOf);

describe('splitLong — never separates "N ทับ M"', () => {
  it('keeps civil-th 1246/4 whole across the มาตรา 1246/2 cross-reference', () => {
    const section = sectionsOf('public/data/civil-th.json').find(
      (s) => String(s.number) === '1246/4',
    );
    const chunks = chunksFor(section);
    expect(badSplitSites(chunks)).toEqual([]);
    for (const c of chunks) {
      expect(c.trim().startsWith('ทับ')).toBe(false);
    }
  });

  it('keeps civil-proc-th 121 whole across the มาตรา 120/4 cross-reference', () => {
    const section = sectionsOf('public/data/civil-proc-th.json').find(
      (s) => String(s.number) === '121',
    );
    const chunks = chunksFor(section);
    expect(badSplitSites(chunks)).toEqual([]);
    for (const c of chunks) {
      expect(c.trim().startsWith('ทับ')).toBe(false);
    }
  });

  it('has zero such splits across the whole corpus', () => {
    const bad = [];
    for (const s of allSections()) {
      const chunks = chunksFor(s);
      for (const site of badSplitSites(chunks)) {
        bad.push({ number: s.number, ...site });
      }
    }
    expect(bad).toEqual([]);
  });
});
