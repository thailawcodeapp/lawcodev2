// Renders every paragraph the corpus needs, and nothing it already has.
//
// Authenticate first: `gcloud auth application-default login`. Google blocks
// service-account key downloads by default for organizations, and the client
// picks up your own credentials without being told where they are.
//
// Usage, from the repository root:
//   node scripts/tts-render/render.mjs                 render everything missing
//   node scripts/tts-render/render.mjs --limit 50      at most 50 more paragraphs
//   node scripts/tts-render/render.mjs --month 850000  stop once this many
//                                                      characters have been
//                                                      billed this month
//   node scripts/tts-render/render.mjs --total 850000  until the corpus has this
//                                                      many characters rendered
//   node scripts/tts-render/render.mjs --manifest      write the manifest only
//   node scripts/tts-render/render.mjs --only civil_proc-36:1
//                                                      re-render exactly these,
//                                                      overwriting their files
//
// --month is the one that protects the bill: it reads ledger.jsonl, which
// records what was actually sent, so re-renders and failed-but-billed pieces
// count too. Run the same --month command every day and it stops in the same
// place. --limit counts only what is left, so re-issuing it spends the
// allowance again.
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { collectParagraphs, buildManifest } from './corpus.mjs';
import { addRenderPauses } from '../../src/lib/thaiSpeech.js';

export const VOICE = 'th-TH-Chirp3-HD-Gacrux';
export const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const MANIFEST_PATH = 'src/data/audio-manifest.json';

// Two rendered voices, kept physically apart at every level.
//
// They must be. 5,048 of the 6,712 paragraphs contain no "(n)" label, so
// their text — and therefore their hash — is byte-identical between the two
// voices. Sharing one directory or one R2 prefix would have the second render
// overwrite three quarters of the first one's audio, and nothing would report
// it: the file names match, the sizes are plausible, and the only symptom is
// the wrong person's voice coming out of the phone.
//
// 'm' sends plain text on purpose. addRenderPauses exists because Chirp3 puts
// pauses inside words and had to be told where the boundaries are; Gemini
// places them correctly on its own, and <break> was measured in this project
// to perturb prosody far away from where it is inserted. Handing it SSML would
// be paying to make it worse.
export const VOICE_CONFIGS = {
  f: {
    label: 'Chirp3 HD Gacrux (female)',
    out: OUT,
    manifest: MANIFEST_PATH,
    manifestMode: 'full',
    ledger: fileURLToPath(new URL('./ledger.jsonl', import.meta.url)),
    voiceParams: { languageCode: 'th-TH', name: VOICE },
    prepare: addRenderPauses,
    clientOptions: () => ({}),
    // One at a time, as this corpus was rendered. Left alone rather than
    // raised: the female corpus is complete, so there is nothing to speed up
    // and no reason to re-test its pacing against Chirp3's 200/min ceiling.
    concurrency: 1,
  },
  m: {
    label: 'Gemini 3.1 Flash TTS Umbriel (male)',
    out: fileURLToPath(new URL('./out-m/', import.meta.url)),
    manifest: 'src/data/audio-manifest-m.json',
    manifestMode: 'delta',
    // Its own ledger. The shared one exists to police Chirp3's 1M-character
    // monthly free tier on the original Google account; Gemini runs on a
    // second account, is billed by audio seconds rather than characters, and
    // has no free tier at all. Appending its characters to that file would
    // make the free-tier figure read high and stop Chirp3 runs that were
    // still free.
    ledger: fileURLToPath(new URL('./ledger-m.jsonl', import.meta.url)),
    voiceParams: {
      languageCode: 'th-TH',
      name: 'Umbriel',
      modelName: 'gemini-3.1-flash-tts-preview',
    },
    prepare: (text) => text,
    // Measured: one paragraph at a time gave 4.8 requests/minute, all of it
    // waiting on Gemini rather than on any quota. Six keeps the whole corpus
    // inside a working day and still leaves the pacer's 180/min unused.
    concurrency: 6,
    clientOptions: () => ({
      projectId: requireEnv('GEMINI_TTS_PROJECT'),
      keyFilename: requireEnv('GEMINI_TTS_CREDENTIALS'),
    }),
  },
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env var ${name} — needed to reach the Gemini voice's Google account`);
    process.exit(1);
  }
  return v;
}

// Chirp 3 allows 200 requests/minute. The shared pacer (makePacer, below)
// paces every actual network call at this rate -- the initial attempt, every
// split retry, and every rate-limit retry alike -- so 180 is the sustained
// ceiling for the whole run, not a per-paragraph budget with room to spare.
// It sits under 200 to leave margin against clock drift and Google's own
// counting window.
const REQUESTS_PER_MINUTE = 180;
const MIN_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

export const MAX_SPLIT_DEPTH = 4; // 16 pieces worst case, so a pathological
// paragraph cannot loop forever.

// Gemini generates the whole clip before answering, so a long paragraph is a
// long request: civil s.119 ¶0 (659 characters) took 58.5 seconds on its own,
// and six of those in flight together push each other further out. Left at the
// client default, the failures that came back were not random — every one of
// them was 219 characters or longer and not a single short paragraph failed,
// which is a deadline, not an outage. Five minutes is far past anything
// measured here and still bounded, so a genuinely stuck call cannot pin a
// worker for the rest of the run.
export const REQUEST_TIMEOUT_MS = 300_000;

export function throttle(lastAt, now = Date.now()) {
  return Math.max(0, lastAt + MIN_INTERVAL_MS - now);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One pacer, shared for the whole run, so the 180/min budget holds across
// every actual network call — including the extra calls a split costs —
// not just once per paragraph. Call the returned function immediately
// before every synthesizeSpeech call, split retries included.
//
// The slot is claimed synchronously, before the await, because renderMany can
// now run several paragraphs at once. Recording the time *after* sleeping was
// correct only while one call was ever in flight: with six, all six would read
// the same lastAt, sleep the same interval, and fire together — a burst the
// pacer exists to prevent, and one that only shows up under load.
export function makePacer() {
  let nextAt = 0;
  return async function pace() {
    const now = Date.now();
    const wait = Math.max(0, nextAt - now);
    nextAt = Math.max(now, nextAt) + MIN_INTERVAL_MS;
    await sleep(wait);
  };
}

// Words that carry on the clause before them. A cut immediately in front of
// one is the worst place to put a seam: each piece becomes its own request, so
// the engine closes the first with sentence-final intonation and opens the
// second on a fresh contour — the listener hears "…โดยตนเองได้." followed by a
// new sentence starting "หรือ…". Picking the space nearest the middle and
// nothing else put 401 of 1,148 seams (34.9%) exactly there.
export const CONTINUATION_WORDS = [
  'หรือ', 'และ', 'แต่', 'เว้นแต่', 'ทั้งนี้',
  'รวมทั้ง', 'ตลอดจน', 'อีกทั้ง', 'กับทั้ง', 'แล้วแต่', 'หากแต่',
];

// Stepping away from a continuation word is only worth it if the step is
// small. Allowed to move anywhere, the search happily lands on a space near
// the edge and emits a 9-character piece — "มาตรา 261" alone, synthesized with
// its own intonation, which is a worse artefact than the seam it avoided.
// Requiring both sides to clear this floor keeps the fix at 44 bad seams
// (3.7%) while leaving short-fragment counts where they were: 6 pieces under
// 60 characters, the same 6 the old rule produced.
export const MIN_PIECE_CHARS = 60;

export function splitPoint(text) {
  const mid = Math.floor(text.length / 2);
  const spaces = [];
  for (let i = 0; i < text.length; i++) if (text[i] === ' ') spaces.push(i);
  if (spaces.length === 0) return mid;

  const nearestToMiddle = (pool) =>
    pool.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), pool[0]);

  const clean = spaces.filter((i) =>
    Math.min(i, text.length - i) >= MIN_PIECE_CHARS &&
    !CONTINUATION_WORDS.some((w) => text.startsWith(w, i + 1)));

  // No clean candidate means every alternative is worse than the seam, so
  // fall back to the plain nearest-the-middle choice rather than forcing one.
  return nearestToMiddle(clean.length ? clean : spaces);
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
// Gemini screens what it is asked to speak and sometimes refuses a paragraph
// of the civil code as a policy violation:
//
//   3 INVALID_ARGUMENT: Cloud Text-to-Speech could not generate audio because
//   the input text or prompt violates Vertex AI's usage guidelines.
//
// The screening is not deterministic. Civil s.82 ¶0 and s.85 ¶1 were both
// refused during a run and both accepted, unchanged, minutes later — which is
// why re-running the renderer clears most of them and why retrying in place
// clears them without a second pass. Longer paragraphs are refused more often,
// having more surface to trip on, but an 81-character one was refused too.
//
// Distinguished from the length rejection above because the remedy is
// opposite: splitting a refused paragraph does not make it acceptable, and
// asking again usually does.
export function isPolicyRejection(err) {
  return err?.code === 3 && /usage guidelines/i.test(err?.message ?? '');
}

export const POLICY_MAX_ATTEMPTS = 4;      // one send plus three retries
export const POLICY_BASE_DELAY_MS = 1000;  // 1s, 2s, 4s

export const RATE_LIMIT_MAX_ATTEMPTS = 4; // one send plus three retries
export const RATE_LIMIT_BASE_DELAY_MS = 500; // doubles each retry: 500ms, 1s, 2s

// Chirp 3 rejects a request whose sentence it considers too long. The limit is
// undocumented and lies somewhere between 255 and 378 characters of real text,
// so this sends first and splits on rejection rather than hardcoding a number
// that would silently stop matching if Google moved it. The split lands on a
// space, which in Thai legal text already separates clauses — a seam there was
// inaudible when listened to on a device.
// A piece containing thaiSpeech.js's sub-clause break tags is SSML and must
// be sent (and split) differently from plain text.
export function isSsmlPiece(text) {
  return text.includes('<break');
}

// Cuts at the <break .../> tag nearest the middle rather than at a space:
// splitParagraph's space search can land inside the tag itself (there is one
// between "break" and its time attribute), which would emit invalid XML on
// both halves. The tag represents a pause, so it belongs to neither half.
export function splitSsmlAtBreak(text) {
  const tagRe = /<break[^>]*\/>/g;
  const mid = Math.floor(text.length / 2);
  let best = null;
  let bestDist = Infinity;
  let m;
  while ((m = tagRe.exec(text))) {
    const dist = Math.abs(m.index - mid);
    if (dist < bestDist) { bestDist = dist; best = m; }
  }
  if (!best) return [text]; // no safe cut point found
  const left = text.slice(0, best.index).trim();
  const right = text.slice(best.index + best[0].length).trim();
  return [left, right].filter(Boolean);
}

export async function synthesizeWithSplit(client, text, {
  maxDepth = MAX_SPLIT_DEPTH,
  pace,
  voiceParams = VOICE_CONFIGS.f.voiceParams,
} = {}) {
  const parts = [];
  const failures = [];
  let chars = 0;
  let splits = 0;

  async function attempt(piece, depth) {
    let rateLimitRetries = 0;
    let policyRetries = 0;
    for (;;) {
      try {
        if (pace) await pace();
        const ssml = isSsmlPiece(piece);
        const [res] = await client.synthesizeSpeech({
          input: ssml ? { ssml: `<speak>${piece}</speak>` } : { text: piece },
          voice: voiceParams,
          audioConfig: { audioEncoding: 'MP3' },
        }, { timeout: REQUEST_TIMEOUT_MS });
        parts.push(Buffer.from(res.audioContent, 'base64'));
        chars += piece.length;
        return;
      } catch (err) {
        if (isPolicyRejection(err) && policyRetries < POLICY_MAX_ATTEMPTS - 1) {
          policyRetries += 1;
          await sleep(POLICY_BASE_DELAY_MS * 2 ** (policyRetries - 1));
          continue;
        }
        if (isRateLimitError(err) && rateLimitRetries < RATE_LIMIT_MAX_ATTEMPTS - 1) {
          rateLimitRetries += 1;
          await sleep(RATE_LIMIT_BASE_DELAY_MS * 2 ** (rateLimitRetries - 1));
          continue;
        }
        if (!isLengthRejection(err)) {
          failures.push({ length: piece.length, message: err.message, reason: 'other' });
          return;
        }
        const pieces = depth < maxDepth
          ? (isSsmlPiece(piece) ? splitSsmlAtBreak(piece) : splitParagraph(piece))
          : [piece];
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
// `concurrency` is how many paragraphs are in flight at once. It defaults to 1,
// which is the behaviour every caller had before it existed.
//
// It matters because throughput here is bound by latency, not by quota: a
// Gemini paragraph takes about twelve seconds to come back, so one at a time
// yields 4.8 requests/minute against a pacer that would happily allow 180. Six
// in flight turns a 23-hour corpus render into roughly four hours while still
// sitting far below any rate limit, and the pacer plus the 429 backoff below
// remain in charge if that ever stops being true.
//
// `results` is filled by index rather than pushed, so it stays in input order
// no matter what order the workers finish in.
export async function renderMany(client, items, {
  maxDepth,
  pace,
  voiceParams,
  maxConsecutiveFailures = MAX_CONSECUTIVE_FAILURES,
  concurrency = 1,
  onResult,
} = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let consecutiveFailures = 0;
  let aborted = false;
  let lastError = null;

  async function worker() {
    for (;;) {
      if (aborted) return;
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      const item = items[i];

      const r = await synthesizeWithSplit(client, item.text, { maxDepth, pace, voiceParams });
      const failedSystemically = r.parts.length === 0 && r.failures.some((f) => f.reason === 'other');

      // Counted in completion order, which is the only order that exists once
      // work overlaps. The signal it is after — many failures in a row for a
      // reason splitting cannot fix — reads the same either way.
      if (failedSystemically) {
        consecutiveFailures += 1;
        lastError = r.failures[r.failures.length - 1].message;
      } else {
        consecutiveFailures = 0;
      }

      results[i] = { item, ...r };
      if (onResult) await onResult(item, r);

      if (consecutiveFailures >= maxConsecutiveFailures) {
        aborted = true;
        return;
      }
    }
  }

  const workers = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: workers }, worker));

  return { results: results.filter(Boolean), aborted, lastError };
}

// Google offers no way to cap what this costs. Every quota it exposes for
// Text-to-Speech is per-minute and counts requests, not characters (checked
// against this project: requests, requests_chirp3, requests_neural2, …), and a
// billing budget only sends mail — it does not stop a call. The only cap that
// can actually stop one is the one on this side of the wire, which makes the
// number it counts worth getting right.
//
// Counting rendered files is not that number. A file on disk proves one
// paragraph was paid for once, but a paragraph re-rendered after --prune was
// paid for twice, and one whose file was deleted was paid for and left no
// trace at all. Both undercount, silently, in the direction that overspends.
// The ledger records what was actually sent, appended per paragraph so a
// Ctrl+C — the normal way a long run ends — keeps everything up to that point.
export const LEDGER = fileURLToPath(new URL('./ledger.jsonl', import.meta.url));

// Free-tier allowances reset on the calendar month, so that is the window the
// budget is measured over.
export function monthTotal(ledgerText, now = new Date()) {
  const prefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  let chars = 0;
  for (const line of ledgerText.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    // A truncated final line is expected: the process can be killed mid-append.
    // Skipping it loses one paragraph's count, which is the right failure —
    // aborting the whole run over it would be worse.
    try { entry = JSON.parse(line); } catch { continue; }
    if (typeof entry.at === 'string' && entry.at.startsWith(prefix)) chars += entry.chars || 0;
  }
  return chars;
}

function readLedger(path = LEDGER) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

// Takes the longest run of `todo` that fits in `remaining` characters. Stops
// at the first paragraph that would overshoot rather than skipping it, so the
// corpus is always rendered in reading order and "where did it get to" stays
// a single position rather than a set of holes.
export function takeWithinBudget(todo, remaining) {
  const taken = [];
  let used = 0;
  for (const p of todo) {
    if (used + p.text.length > remaining) break;
    used += p.text.length;
    taken.push(p);
  }
  return taken;
}

function numericFlag(argv, name) {
  const at = argv.indexOf(name);
  if (at < 0) return null;
  const n = Number(argv[at + 1]);
  // A bad value must not pass silently. Number(undefined) and Number('abc')
  // are both NaN, and slice(0, NaN) renders nothing while the run still
  // reports success — the operator would think a smoke test had passed when
  // no request was ever sent.
  if (!Number.isInteger(n) || n < 1) {
    console.error(`${name} needs a positive whole number, got ${JSON.stringify(argv[at + 1])}`);
    process.exit(1);
  }
  return n;
}

function listFlag(argv, name) {
  const at = argv.indexOf(name);
  if (at < 0) return null;
  const parts = String(argv[at + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) {
    console.error(`${name} needs a comma-separated list, got ${JSON.stringify(argv[at + 1])}`);
    process.exit(1);
  }
  return parts;
}

async function main() {
  const argv = process.argv.slice(2);
  const limit = numericFlag(argv, '--limit') ?? Infinity;
  const total = numericFlag(argv, '--total');
  const month = numericFlag(argv, '--month');

  const at = argv.indexOf('--voice');
  const voice = at >= 0 ? argv[at + 1] : 'f';
  const cfg = VOICE_CONFIGS[voice];
  if (!cfg) {
    console.error(`--voice must be one of ${Object.keys(VOICE_CONFIGS).join(', ')}, got ${JSON.stringify(voice)}`);
    process.exit(1);
  }
  const { out: OUT, ledger: LEDGER } = cfg;
  console.log(`voice: ${voice} — ${cfg.label}`);

  const paragraphs = collectParagraphs(voice);
  mkdirSync(OUT, { recursive: true });

  // Rebuilds the ledger from what is on disk, for the one situation it cannot
  // reconstruct itself: work rendered before the ledger existed, or by a
  // process still running the previous version of this file. Run it only when
  // nothing else is rendering — it replaces the month's record rather than
  // adding to it, and a concurrent run's characters would be lost.
  if (argv.includes('--seed-ledger')) {
    const onDisk = paragraphs
      .filter((p) => existsSync(`${OUT}${p.hash}.mp3`))
      .reduce((a, p) => a + p.text.length, 0);
    // Billed but absent from disk, so nothing can derive it later:
    //    7,837  the first --limit 50 run, deleted when the section number
    //           moved into paragraph 0 and every hash changed
    //   ~7,600  21 split clips deleted by `which --prune` and rendered again
    //  ~20,000  the phase-2 pilot and the sentence-length probes
    const OFF_DISK = 35_437;
    writeFileSync(LEDGER, `${JSON.stringify({
      at: new Date().toISOString(),
      chars: onDisk + OFF_DISK,
      note: `seed: ${onDisk} on disk + ${OFF_DISK} billed but not on disk`,
    })}\n`);
    console.log(`ledger seeded: ${(onDisk + OFF_DISK).toLocaleString()} characters billed this month`);
    return;
  }

  // 'm' ships only the sections whose hashes actually differ from 'f' — 459
  // of 3,109, because three quarters of the corpus has no "(n)" to reword.
  // audioHashFor falls back to the 'f' entry for the rest, which is correct:
  // the hash is the same, only the R2 prefix in front of it differs. 54.9 KB
  // in the app bundle instead of 167.2 KB, for one `??` at the lookup.
  const full = buildManifest(paragraphs);
  let manifest = full;
  if (cfg.manifestMode === 'delta') {
    const base = buildManifest(collectParagraphs('f'));
    manifest = Object.fromEntries(
      Object.entries(full).filter(([id, hashes]) => JSON.stringify(hashes) !== JSON.stringify(base[id])),
    );
  }
  writeFileSync(cfg.manifest, `${JSON.stringify(manifest)}\n`);
  console.log(
    `manifest written: ${cfg.manifest} (${Object.keys(manifest).length} sections`
    + `${cfg.manifestMode === 'delta' ? ` of ${Object.keys(full).length}, delta only` : ''})`,
  );
  if (argv.includes('--manifest')) return;

  // Both voices are non-deterministic, so a paragraph can come out mispronounced
  // while the identical wording in its neighbours reads correctly — re-sending
  // it is the whole remedy, but its file already exists and the skip above would
  // pass it over forever. --only names paragraphs to send regardless, as
  // "<sectionId>" for a whole section or "<sectionId>:<paraIndex>" for one
  // paragraph, comma-separated. It selects rather than filters what is missing:
  // naming a paragraph is the operator saying this specific clip is wrong.
  const only = listFlag(argv, '--only');
  const todo = only
    ? paragraphs.filter((p) => only.includes(p.sectionId) || only.includes(`${p.sectionId}:${p.paraIndex}`))
    : paragraphs.filter((p) => !existsSync(`${OUT}${p.hash}.mp3`));
  if (only && !todo.length) {
    console.error(`--only matched no paragraphs: ${only.join(', ')}`);
    process.exit(1);
  }
  if (only) {
    console.log(`--only: re-rendering ${todo.length} paragraph(s), existing files overwritten`);
  } else {
    console.log(`${paragraphs.length} paragraphs, ${paragraphs.length - todo.length} already rendered, ${todo.length} to do`);
  }

  // --limit counts what is LEFT, so re-running it after a pause spends the
  // same allowance a second time: stop at 500 of --limit 3774, come back
  // tomorrow, and the same command renders 3774 more. --total is stated
  // against the whole corpus instead — characters already on disk count
  // toward it — so the same command can be run every day and always stops in
  // the same place. That is the number to use for a monthly free-tier budget.
  const spent = paragraphs
    .filter((p) => existsSync(`${OUT}${p.hash}.mp3`))
    .reduce((a, p) => a + p.text.length, 0);
  let batch = todo.slice(0, limit);
  if (total !== null) {
    if (spent >= total) {
      console.log(`\nbudget reached: ${spent.toLocaleString()} of ${total.toLocaleString()} characters already rendered — nothing to do`);
      return;
    }
    batch = takeWithinBudget(batch, total - spent);
    console.log(
      `budget: ${spent.toLocaleString()} characters already rendered, ` +
        `${(total - spent).toLocaleString()} left of ${total.toLocaleString()} — this run takes ${batch.length} paragraphs`,
    );
  }

  const billedThisMonth = monthTotal(readLedger(LEDGER));
  if (month !== null) {
    if (billedThisMonth >= month) {
      console.log(
        `\nmonth budget reached: ${billedThisMonth.toLocaleString()} of ${month.toLocaleString()} characters ` +
          'already billed this month — nothing sent. Resume when the month rolls over.',
      );
      return;
    }
    // Against the paragraph's own length, which is what a clean render costs.
    // A split re-sends pieces, so the real figure lands slightly above this and
    // the ledger carries the difference into the next run rather than losing it.
    batch = takeWithinBudget(batch, month - billedThisMonth);
    console.log(
      `month budget: ${billedThisMonth.toLocaleString()} of ${month.toLocaleString()} billed so far, ` +
        `this run takes ${batch.length} paragraphs`,
    );
  } else if (billedThisMonth > 0) {
    console.log(`billed so far this month: ${billedThisMonth.toLocaleString()} characters (no --month cap set)`);
  }

  const client = new TextToSpeechClient(cfg.clientOptions());
  let done = 0;
  let chars = 0;
  let splits = 0;
  const failed = [];
  const pace = makePacer();

  // addRenderPauses is applied here, right before the API call, not inside
  // collectParagraphs — p.hash (the file name and the app's lookup key) and
  // the budget/ledger character counts above are all based on the plain
  // text collectParagraphs produced, so a paragraph's identity and its cost
  // accounting stay independent of how its pauses are marked up for Chirp3.
  // It is a no-op for any paragraph without an อนุมาตรา label, and for the
  // Gemini voice cfg.prepare is identity — see VOICE_CONFIGS.
  const ssmlBatch = batch.map((p) => ({ ...p, text: cfg.prepare(p.text) }));

  const concurrency = numericFlag(argv, '--concurrency') ?? cfg.concurrency ?? 1;
  console.log(`rendering ${batch.length} paragraphs, ${concurrency} at a time`);

  const { aborted, lastError } = await renderMany(client, ssmlBatch, {
    pace,
    concurrency,
    voiceParams: cfg.voiceParams,
    onResult: async (p, r) => {
      if (r.failures.length || !r.parts.length) {
        failed.push({ ...p, failures: r.failures });
        // A paragraph that failed overall may still have had pieces succeed
        // before it did, and Google billed those. No file is written, so the
        // ledger is the only place that cost is ever recorded.
        if (r.chars) {
          appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), chars: r.chars, hash: p.hash, failed: true })}\n`);
        }
        console.log(`FAIL  ${p.book} ${p.number} ¶${p.paraIndex} (${p.text.length} chars)`);
        return;
      }
      writeFileSync(`${OUT}${p.hash}.mp3`, Buffer.concat(r.parts));
      appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), chars: r.chars, hash: p.hash })}\n`);
      chars += r.chars;
      splits += r.splits;
      done += 1;
      if (done % 100 === 0) console.log(`  ${done}/${batch.length} rendered`);
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
  const corpusChars = paragraphs.reduce((a, p) => a + p.text.length, 0);
  console.log(`corpus now ${(spent + chars).toLocaleString()} of ${corpusChars.toLocaleString()} characters rendered`);
  for (const f of failed) {
    console.log(`  ${f.book} ${f.number} ¶${f.paraIndex}: ${f.failures.map((x) => x.message).join('; ')}`);
  }
  if (failed.length) console.log('\nre-run to retry only the failures — rendered files are skipped');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
