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
  // moves and the test fails. It does NOT catch a normalizeForSpeech change
  // — the count stays 6764 while every hash quietly changes underneath it,
  // and every object this pipeline uploads to R2 keeps its old, no-longer-
  // matching name. The app would then look up hashes that no file has.
  //
  // This regenerates the manifest exactly the way render.mjs's main() does
  // — `${JSON.stringify(buildManifest(collectParagraphs()))}\n` — and diffs
  // it against what is actually committed, so any drift in parseBody OR
  // normalizeForSpeech OR audioHash fails here, before a render ever runs.
  it('is exactly what the pipeline regenerates', () => {
    const regenerated = `${JSON.stringify(buildManifest(collectParagraphs()))}\n`;
    const committed = readFileSync('src/data/audio-manifest.json', 'utf8');
    expect(regenerated).toBe(committed);
  });
});
