// Phase 2 pilot — renders ten real sections so the engine and voice can be
// chosen by ear rather than from a marketing demo, and so the first bill
// tells us the real per-character cost before committing to 6,770 files.
//
// Throwaway: not imported by the app, not run in CI.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/tts-pilot/render.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { normalizeForSpeech } from '../../src/lib/thaiSpeech.js';

// Chosen to cover what the corpus actually throws at a synthesiser:
// the longest paragraph, a slash number, a Thai ordinal, a real fraction,
// a multi-paragraph section, and a couple of ordinary ones.
//
// Note: '172 ทวิ/1' lives in criminal-proc-th, not criminal-th — verified
// against public/data/criminal-proc-th.json before this list was written.
const SAMPLES = [
  ['civil-th', '420'],        // 9 clause-separating spaces — the phrasing case
  ['civil-th', '193/30'],     // slash number
  ['civil-th', '968'],        // real fraction, must stay a fraction
  ['civil-th', '1598/21'],    // slash in the body too
  ['criminal-th', '288'],     // short and well known
  ['criminal-proc-th', '172 ทวิ/1'], // Thai ordinal before the slash
  ['criminal-proc-th', '7'],  // list-heavy
  ['civil-proc-th', '4 ฉ'],   // the ฉ suffix
  ['civil-proc-th', '222/12'], // procedural, dense cross-references
  ['civil-th', '1'],          // the opening section
];

// Star-named Chirp 3 voices, picked for a 43-hour listen: clear and even
// beats characterful. Upbeat and breathy voices tire the ear over an hour.
const CHIRP_VOICES = ['th-TH-Chirp3-HD-Gacrux', 'th-TH-Chirp3-HD-Charon', 'th-TH-Chirp3-HD-Schedar'];

const OUT = new URL('./out/', import.meta.url).pathname;

function loadSection(book, number) {
  const j = JSON.parse(readFileSync(`public/data/${book}.json`, 'utf8'));
  const s = j.sections.find((x) => String(x.number) === number);
  if (!s) throw new Error(`not found: ${book} ${number}`);
  return s;
}

// Same unit the render pipeline will use: one paragraph per request.
function paragraphsOf(section) {
  return (section.text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizeForSpeech);
}

const client = new TextToSpeechClient();
let totalChars = 0;

mkdirSync(OUT, { recursive: true });

for (const [book, number] of SAMPLES) {
  const paragraphs = paragraphsOf(loadSection(book, number));
  for (const voice of CHIRP_VOICES) {
    const parts = [];
    for (const text of paragraphs) {
      const bytes = Buffer.byteLength(text, 'utf8');
      if (bytes > 5000) throw new Error(`paragraph over the 5000-byte limit: ${bytes}`);
      totalChars += text.length;
      const [res] = await client.synthesizeSpeech({
        input: { text },
        voice: { languageCode: 'th-TH', name: voice },
        audioConfig: { audioEncoding: 'MP3' },
      });
      parts.push(Buffer.from(res.audioContent, 'base64'));
    }
    const safe = `${book}-${number}`.replace(/[^\w.-]/g, '_');
    writeFileSync(`${OUT}${voice}-${safe}.mp3`, Buffer.concat(parts));
    console.log(`ok  ${voice}  ${book} ${number}  (${paragraphs.length} paragraphs)`);
  }
}

console.log(`\ncharacters billed this run: ${totalChars}`);
console.log('compare against the Cloud console billing page to get the real per-character rate');
