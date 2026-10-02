import { describe, it, expect } from 'vitest';
import { RENDER_OVERRIDES, renderTextFor } from './renderOverrides.mjs';
import { collectParagraphs } from './corpus.mjs';

// Every voice's paragraphs, by hash. A hash is a hash of text, so a paragraph
// only appears under the voice whose wording produced it.
const byHash = new Map();
for (const voice of ['f', 'm', 'leda']) {
  for (const p of collectParagraphs(voice)) byHash.set(p.hash, p);
}

describe('render overrides', () => {
  it('names paragraphs that exist', () => {
    for (const hash of Object.keys(RENDER_OVERRIDES)) {
      expect(byHash.has(hash), `${hash} matches no paragraph — reword or delete the entry`).toBe(true);
    }
  });

  it('changes something', () => {
    for (const [hash, text] of Object.entries(RENDER_OVERRIDES)) {
      expect(text, `${hash} overrides its paragraph with itself`).not.toBe(byHash.get(hash).text);
    }
  });

  // The guard that matters. These entries exist to fix how a section NUMBER is
  // read aloud, and the audio has to keep saying what the screen says — an
  // override that quietly reworded the law would be audible to exactly one
  // listener at a time and visible to nobody. Only the two words before the
  // body may differ ("มาตรา 370" -> "มาตรา สามร้อยเจ็ดสิบ"). An override that
  // ever needs to touch the body should widen this test on purpose.
  it('leaves the paragraph itself word for word', () => {
    const body = (t) => t.split(' ').slice(2).join(' ');
    for (const [hash, text] of Object.entries(RENDER_OVERRIDES)) {
      expect(body(text), `${hash} changes the text of the law, not just the number`)
        .toBe(body(byHash.get(hash).text));
    }
  });

  it('leaves every other paragraph alone', () => {
    const untouched = collectParagraphs('leda').find((p) => !RENDER_OVERRIDES[p.hash]);
    expect(renderTextFor(untouched)).toBe(untouched.text);
  });

  it('is what gets rendered for a paragraph it names', () => {
    const [hash, text] = Object.entries(RENDER_OVERRIDES)[0];
    expect(renderTextFor(byHash.get(hash))).toBe(text);
  });
});
