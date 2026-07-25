// Regenerates src/data/corpus.checksums.json.
// Run this ONLY when a law-text change is intentional — the diff on the
// checksum file is the signal to a reviewer that the corpus was edited.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'public/data/civil-th.json',
  'public/data/civil-proc-th.json',
  'public/data/criminal-th.json',
  'public/data/criminal-proc-th.json',
];

const out = {};
for (const f of FILES) {
  out[f] = createHash('sha256').update(readFileSync(f)).digest('hex');
}
writeFileSync('src/data/corpus.checksums.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(out);
