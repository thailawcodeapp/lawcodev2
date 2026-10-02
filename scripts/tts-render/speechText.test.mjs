import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildSpeechText, BOOK_KEYS, speechTextPath } from './speechText.mjs';
import { collectParagraphs } from './corpus.mjs';
import { VOICES } from '../../src/lib/audioManifest.js';

describe('buildSpeechText', () => {
  const built = buildSpeechText();

  it('files every paragraph under the book key its sectionId carries', () => {
    expect(Object.keys(built).sort()).toEqual([...BOOK_KEYS].sort());
  });

  // The whole point of the file: native has an entry's URL and nothing else,
  // and the URL's basename is the hash. Keyed on anything but the hash and the
  // lookup could not be done from what native holds.
  it('keys on the audio hash, which is what a queue entry carries', () => {
    const paragraph = collectParagraphs('leda').find((p) => p.sectionId === 'pp-1448');
    expect(built.pp[paragraph.hash]).toBe(paragraph.text);
  });

  // One file serves every voice. The wording differs between them for the 459
  // sections that carry a "(n)" label — "อนุ 1" against "อนุมาตรา 1" — and each
  // wording hashes to its own file name, so both spellings have to be in here
  // or the fallback would read a paragraph in wording that does not match the
  // voice the listener chose.
  it('covers every voice, not just the default', () => {
    for (const voice of VOICES) {
      for (const p of collectParagraphs(voice)) {
        const book = p.sectionId.slice(0, p.sectionId.indexOf('-'));
        expect(built[book][p.hash], `${voice} ${p.sectionId} ¶${p.paraIndex}`).toBe(p.text);
      }
    }
  });

  it('writes where the app bundle will carry it into the APK', () => {
    expect(speechTextPath('pp')).toBe('public/data/speech-pp.json');
  });
});

describe('the committed files', () => {
  // Generated, committed, and read by Java at runtime — three places for the
  // same text to drift apart. Regenerating is a script; noticing it was not
  // regenerated is this test.
  it('are up to date with the corpus', () => {
    const built = buildSpeechText();
    for (const book of BOOK_KEYS) {
      const onDisk = JSON.parse(readFileSync(speechTextPath(book), 'utf8'));
      expect(onDisk, `${book} is stale — run npm run speech:text`).toEqual(built[book]);
    }
  });
});
