// Decides what should exist, without deciding how it gets made. Keeping this
// separate from render.mjs means the expensive half can be re-run freely and
// this half can be tested without a network or credentials.
import { readFileSync } from 'node:fs';
import { parseBody } from '../../src/lib/sectionParagraphs.js';
import { speechUnits } from '../../src/lib/thaiSpeech.js';
import { audioHash } from '../../src/lib/audioHash.js';

export const BOOKS = ['civil-th', 'civil-proc-th', 'criminal-th', 'criminal-proc-th'];

// Paths are relative to the repository root; every script here runs from there.
function loadBook(book) {
  return JSON.parse(readFileSync(`public/data/${book}.json`, 'utf8'));
}

// parseBody and speechUnits are the app's own, imported rather than
// reimplemented: the file name is a hash of this text, so any divergence
// makes the app ask for files that were never rendered. An earlier version
// called parseBody directly and never saw the section number at all, because
// the number lives in section.number and not in section.text — every rendered
// clip read the body and never said which section it was. speechUnits is the
// one place that decides, so the two sides cannot drift apart again.
export function collectParagraphs() {
  const out = [];
  for (const book of BOOKS) {
    for (const section of loadBook(book).sections) {
      speechUnits(section.number, parseBody(section.text)).forEach((text, paraIndex) => {
        out.push({
          book,
          sectionId: section.id,
          number: String(section.number),
          paraIndex,
          text,
          hash: audioHash(text),
        });
      });
    }
  }
  return out;
}

export function buildManifest(paragraphs) {
  const manifest = {};
  for (const p of [...paragraphs].sort((a, b) => a.paraIndex - b.paraIndex)) {
    (manifest[p.sectionId] ||= []).push(p.hash);
  }
  return manifest;
}
