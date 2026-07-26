// Renders every paragraph the corpus needs, and nothing it already has.
//
// Authenticate first: `gcloud auth application-default login`. Google blocks
// service-account key downloads by default for organizations, and the client
// picks up your own credentials without being told where they are.
//
// Usage, from the repository root:
//   node scripts/tts-render/render.mjs            render everything missing
//   node scripts/tts-render/render.mjs --limit 50 render at most 50 paragraphs
//   node scripts/tts-render/render.mjs --manifest write the manifest only
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { collectParagraphs, buildManifest } from './corpus.mjs';

export const VOICE = 'th-TH-Chirp3-HD-Gacrux';
export const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const MANIFEST_PATH = 'src/data/audio-manifest.json';

// Chirp 3 allows 200 requests/minute. 180 leaves headroom for the retry that
// a split costs, so one rejected paragraph cannot push the run over.
const REQUESTS_PER_MINUTE = 180;
const MIN_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

export const MAX_SPLIT_DEPTH = 4; // 16 pieces worst case, so a pathological
// paragraph cannot loop forever.

export function throttle(lastAt, now = Date.now()) {
  return Math.max(0, lastAt + MIN_INTERVAL_MS - now);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function splitPoint(text) {
  const mid = Math.floor(text.length / 2);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
  }
  return best === -1 ? mid : best;
}

// Returns one element when there is nothing left on one side after trimming —
// that is what stops the caller recursing forever.
export function splitParagraph(text) {
  const cut = splitPoint(text);
  return [text.slice(0, cut).trim(), text.slice(cut).trim()].filter(Boolean);
}

// Chirp 3 rejects a request whose sentence it considers too long. The limit is
// undocumented and lies somewhere between 255 and 378 characters of real text,
// so this sends first and splits on rejection rather than hardcoding a number
// that would silently stop matching if Google moved it. The split lands on a
// space, which in Thai legal text already separates clauses — a seam there was
// inaudible when listened to on a device.
export async function synthesizeWithSplit(client, text, { maxDepth = MAX_SPLIT_DEPTH } = {}) {
  const parts = [];
  const failures = [];
  let chars = 0;
  let splits = 0;

  async function attempt(piece, depth) {
    try {
      const [res] = await client.synthesizeSpeech({
        input: { text: piece },
        voice: { languageCode: 'th-TH', name: VOICE },
        audioConfig: { audioEncoding: 'MP3' },
      });
      parts.push(Buffer.from(res.audioContent, 'base64'));
      chars += piece.length;
      return;
    } catch (err) {
      const pieces = depth < maxDepth ? splitParagraph(piece) : [piece];
      if (pieces.length < 2) {
        failures.push({ length: piece.length, message: err.message });
        return;
      }
      splits += 1;
      for (const next of pieces) await attempt(next, depth + 1);
    }
  }

  await attempt(text, 0);
  return { parts, chars, failures, splits };
}

async function main() {
  const argv = process.argv.slice(2);
  const limitArg = argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(argv[limitArg + 1]) : Infinity;

  const paragraphs = collectParagraphs();
  mkdirSync(OUT, { recursive: true });

  const manifest = buildManifest(paragraphs);
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest)}\n`);
  console.log(`manifest written: ${MANIFEST_PATH} (${Object.keys(manifest).length} sections)`);
  if (argv.includes('--manifest')) return;

  const todo = paragraphs.filter((p) => !existsSync(`${OUT}${p.hash}.mp3`));
  console.log(`${paragraphs.length} paragraphs, ${paragraphs.length - todo.length} already rendered, ${todo.length} to do`);

  const client = new TextToSpeechClient();
  let done = 0;
  let chars = 0;
  let splits = 0;
  const failed = [];
  let lastAt = 0;

  for (const p of todo.slice(0, limit)) {
    await sleep(throttle(lastAt));
    lastAt = Date.now();

    const r = await synthesizeWithSplit(client, p.text);
    if (r.failures.length || !r.parts.length) {
      failed.push({ ...p, failures: r.failures });
      console.log(`FAIL  ${p.book} ${p.number} ¶${p.paraIndex} (${p.text.length} chars)`);
      continue;
    }
    writeFileSync(`${OUT}${p.hash}.mp3`, Buffer.concat(r.parts));
    chars += r.chars;
    splits += r.splits;
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${Math.min(todo.length, limit)} rendered`);
  }

  console.log(`\nrendered ${done}, split ${splits}, failed ${failed.length}, characters billed ${chars}`);
  for (const f of failed) {
    console.log(`  ${f.book} ${f.number} ¶${f.paraIndex}: ${f.failures.map((x) => x.message).join('; ')}`);
  }
  if (failed.length) console.log('\nre-run to retry only the failures — rendered files are skipped');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
