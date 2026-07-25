// The law text is the product. Nothing in this repo writes to these files,
// and this test makes an accidental edit impossible to merge unnoticed.
// If a corpus change IS intended, run scripts/update-corpus-checksums.mjs
// and commit the checksum diff alongside it.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import checksums from './corpus.checksums.json';

describe('law corpus integrity', () => {
  for (const [file, expected] of Object.entries(checksums)) {
    it(`${file} is unchanged`, () => {
      const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
      expect(actual).toBe(expected);
    });
  }
});
