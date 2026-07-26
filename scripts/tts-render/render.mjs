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

// One pacer, shared for the whole run, so the 180/min budget holds across
// every actual network call — including the extra calls a split costs —
// not just once per paragraph. Call the returned function immediately
// before every synthesizeSpeech call, split retries included.
export function makePacer() {
  let lastAt = 0;
  return async function pace() {
    await sleep(throttle(lastAt));
    lastAt = Date.now();
  };
}

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

// Google's own recorded rejection for the failure splitting exists to fix:
// `3 INVALID_ARGUMENT: This request contains sentences that are too long.
// Consider splitting up long sentences with sentence ending punctuation
// e.g. periods. Sentence starting with: "..." is too long.` INVALID_ARGUMENT
// (code 3) also covers other, unrelated bad requests, so this matches on the
// message text rather than the code alone. Anything else -- an expired
// token, an exhausted quota, a network blip -- is not something cutting the
// text in half can fix, so it must not trigger the split cascade.
export function isLengthRejection(err) {
  return /too long/i.test((err && err.message) || '');
}

// Google surfaces a rate limit as gRPC code 8 (RESOURCE_EXHAUSTED), and the
// message mentions quota or rate. Matching on both signals -- the way
// isLengthRejection matches on message text alone, deliberately -- keeps this
// from catching some other RESOURCE_EXHAUSTED condition Google might use the
// same code for, one a retry cannot help with.
export function isRateLimitError(err) {
  return !!err && err.code === 8 && /quota|rate/i.test((err && err.message) || '');
}

// Spec §7.4 calls for exponential backoff on a rate limit. Without it,
// isLengthRejection returns false for a 429, it lands straight in the
// 'other' bucket, and a sustained rate limit trips MAX_CONSECUTIVE_FAILURES
// and aborts the run -- resuming then walks straight back into the same
// ceiling. Bounded so a rate limit that never lifts still gives up and
// records an 'other' failure, letting the existing abort protect the run,
// instead of retrying forever.
export const RATE_LIMIT_MAX_ATTEMPTS = 4; // one send plus three retries
export const RATE_LIMIT_BASE_DELAY_MS = 500; // doubles each retry: 500ms, 1s, 2s

// Chirp 3 rejects a request whose sentence it considers too long. The limit is
// undocumented and lies somewhere between 255 and 378 characters of real text,
// so this sends first and splits on rejection rather than hardcoding a number
// that would silently stop matching if Google moved it. The split lands on a
// space, which in Thai legal text already separates clauses — a seam there was
// inaudible when listened to on a device.
export async function synthesizeWithSplit(client, text, { maxDepth = MAX_SPLIT_DEPTH, pace } = {}) {
  const parts = [];
  const failures = [];
  let chars = 0;
  let splits = 0;

  async function attempt(piece, depth) {
    let rateLimitRetries = 0;
    for (;;) {
      try {
        if (pace) await pace();
        const [res] = await client.synthesizeSpeech({
          input: { text: piece },
          voice: { languageCode: 'th-TH', name: VOICE },
          audioConfig: { audioEncoding: 'MP3' },
        });
        parts.push(Buffer.from(res.audioContent, 'base64'));
        chars += piece.length;
        return;
      } catch (err) {
        if (isRateLimitError(err) && rateLimitRetries < RATE_LIMIT_MAX_ATTEMPTS - 1) {
          rateLimitRetries += 1;
          await sleep(RATE_LIMIT_BASE_DELAY_MS * 2 ** (rateLimitRetries - 1));
          continue;
        }
        if (!isLengthRejection(err)) {
          failures.push({ length: piece.length, message: err.message, reason: 'other' });
          return;
        }
        const pieces = depth < maxDepth ? splitParagraph(piece) : [piece];
        if (pieces.length < 2) {
          failures.push({ length: piece.length, message: err.message, reason: 'length' });
          return;
        }
        splits += 1;
        for (const next of pieces) await attempt(next, depth + 1);
        return;
      }
    }
  }

  await attempt(text, 0);
  return { parts, chars, failures, splits };
}

// A real outage looks like many paragraphs in a row failing for a reason
// splitting cannot fix -- an expired token or an exhausted quota does not go
// away because the text got shorter. Grinding through the rest of a
// 6,800-paragraph corpus against a dead credential wastes time and billed
// characters for nothing, so this stops the whole run after this many
// consecutive non-length failures instead of only reporting them at the end.
// An unlucky patch of hard-to-synthesize text does not look like this: it
// fails once and the next paragraph succeeds, resetting the counter.
export const MAX_CONSECUTIVE_FAILURES = 10;

// Runs synthesizeWithSplit over `items` (each `{ text, ... }`) in order,
// sharing one pace() across the whole sequence. Stops early and reports
// `aborted: true` if `maxConsecutiveFailures` paragraphs in a row fail for a
// non-length reason -- a systemic failure, not a splitting problem. Scattered
// failures interleaved with successes do not trip it, since any success
// resets the streak. `onResult`, if given, is awaited after each item so the
// caller can do its own side effect (writing a file) without this function
// touching disk itself.
export async function renderMany(client, items, {
  maxDepth,
  pace,
  maxConsecutiveFailures = MAX_CONSECUTIVE_FAILURES,
  onResult,
} = {}) {
  const results = [];
  let consecutiveFailures = 0;
  let aborted = false;
  let lastError = null;

  for (const item of items) {
    const r = await synthesizeWithSplit(client, item.text, { maxDepth, pace });
    const failedSystemically = r.parts.length === 0 && r.failures.some((f) => f.reason === 'other');

    if (failedSystemically) {
      consecutiveFailures += 1;
      lastError = r.failures[r.failures.length - 1].message;
    } else {
      consecutiveFailures = 0;
    }

    results.push({ item, ...r });
    if (onResult) await onResult(item, r);

    if (consecutiveFailures >= maxConsecutiveFailures) {
      aborted = true;
      break;
    }
  }

  return { results, aborted, lastError };
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
  const pace = makePacer();

  const { aborted, lastError } = await renderMany(client, todo.slice(0, limit), {
    pace,
    onResult: async (p, r) => {
      if (r.failures.length || !r.parts.length) {
        failed.push({ ...p, failures: r.failures });
        console.log(`FAIL  ${p.book} ${p.number} ¶${p.paraIndex} (${p.text.length} chars)`);
        return;
      }
      writeFileSync(`${OUT}${p.hash}.mp3`, Buffer.concat(r.parts));
      chars += r.chars;
      splits += r.splits;
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${Math.min(todo.length, limit)} rendered`);
    },
  });

  if (aborted) {
    console.log(
      `\n!!! ABORTED after ${MAX_CONSECUTIVE_FAILURES} consecutive non-length failures !!!\n` +
        `last error: ${lastError}\n` +
        'this looks like a systemic failure (expired credentials, exhausted quota, or an outage) ' +
        'rather than bad text -- fix that first, then re-run: rendered files are skipped',
    );
  }

  console.log(`\nrendered ${done}, split ${splits}, failed ${failed.length}, characters billed ${chars}`);
  for (const f of failed) {
    console.log(`  ${f.book} ${f.number} ¶${f.paraIndex}: ${f.failures.map((x) => x.message).join('; ')}`);
  }
  if (failed.length) console.log('\nre-run to retry only the failures — rendered files are skipped');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
