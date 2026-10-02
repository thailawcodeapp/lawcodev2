// Proves the rendered audio is complete and audible before any of it is
// uploaded. The failure that matters here is not an error — errors are
// counted and retried by render.mjs — but a 200 response carrying truncated
// or silent audio, which nothing else in the pipeline would notice and which
// nobody can catch by listening to 6,764 files.
//
// Usage, from the repository root:
//   node scripts/tts-render/verify.mjs [--voice f|m|leda]
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';
import { collectParagraphs } from './corpus.mjs';

// Mirrors upload.mjs's OUT_DIRS and render.mjs's VOICE_CONFIGS.out — each
// voice renders into its own directory, so verification has to pick the same
// one or it silently checks the wrong (or nonexistent) files.
const OUT_DIRS = {
  f: fileURLToPath(new URL('./out/', import.meta.url)),
  m: fileURLToPath(new URL('./out-m/', import.meta.url)),
  leda: fileURLToPath(new URL('./out-leda/', import.meta.url)),
};

// Measured from real th-TH-Chirp3-HD-Gacrux output (three phase-2 pilot
// sections), not derived from a spec estimate:
//   civil 1    :  47 chars /  4.7s = 10.0 chars/s
//   civil 420  : 215 chars / 21.3s = 10.1 chars/s
//   civil 968  : 583 chars / 57.7s = 10.1 chars/s
// A 7.5 figure (carried over from a pre-measurement spec estimate) put every
// healthy file at ratio ~0.73, leaving only 0.13 of margin below the 0.6
// floor of TOLERANCE=0.4 — nearly blind to real truncation. Re-measure this
// if the voice ever changes.
// Re-fitted by least squares against 4,747 finished Gacrux clips — the whole
// July render — rather than the three pilot files the 10.1 came from.
const CHARS_PER_SECOND = 11.44;

// A digit is one character to count and a whole word to say: "1274" is four
// characters and "หนึ่งพันสองร้อยเจ็ดสิบสี่" to listen to. That mattered little
// while clips were body text, and then every section's paragraph 0 gained a
// "มาตรา 1274 " in front of it. Charging a digit its spoken weight is what
// took the false alarms from 119 to 14; the same fit that produced
// CHARS_PER_SECOND produced this.
const DIGIT_CHARS = 5.5;

// Speech rate varies with sentence structure, so the band has to be wide
// enough not to cry wolf. It is here to catch audio that stopped early, which
// is off by much more than this.
const TOLERANCE = 0.4;

// Every clip carries a fixed lead-in/lead-out silence beyond the spoken
// words themselves — the operator has observed roughly 200ms of it on short
// Gacrux clips. That padding is a flat cost, not proportional to text length,
// so a purely proportional model (chars/CHARS_PER_SECOND) underpredicts short
// clips the most: a 5-character paragraph predicts ~0.495s, and 200ms of
// padding alone is enough to push the real file past the 1+TOLERANCE ceiling
// and fail verification for a clip that is perfectly fine. Folding a fixed
// allowance into the prediction fixes that without touching TOLERANCE or
// CHARS_PER_SECOND, which are pinned by the fixture test. 0.25s gives a small
// margin over the observed ~200ms. For paragraphs in the normal 150-1,300
// character range this adds well under 2% to the predicted duration, so it
// does not meaningfully loosen the check that matters — see the fraction
// analysis in verify.test.mjs.
// Fitted alongside the other two rather than guessed at: 0.34s.
const DURATION_ALLOWANCE_SECONDS = 0.34;

// Gacrux pauses at an opening bracket, and the corpus is full of them: 1,840
// paragraphs are numbered list items opening "(3)" or "(ก)". The pause is a
// flat cost that no amount of text-length modelling predicts, and on a
// nine-character item like "(2) จำคุก" it is most of the clip — which is why
// all 25 remaining false alarms after the digit fix were bracketed text.
//
// 0.4s, chosen against all 6,712 finished clips: it takes those 25 down to 2
// while keeping the count of clips wrongly called truncated at zero. Larger
// values start failing healthy audio (1 at 0.6s, 8 at 0.8s), which is the
// expensive direction — a false "too short" invites a re-render that returns
// an identical file and bills for it again.
//
// It also makes truncation easier to catch rather than harder, because the
// old prediction was too low for these paragraphs and dragged the floor down
// with it: across the 1,840, the share of a clip that has to survive to pass
// rises from 58.0% to 61.8%, and the worst case from 29.4% to 38.7%.
const PAREN_PAUSE_SECONDS = 0.4;

export function expectedSeconds(text) {
  const digits = (text.match(/\d/g) || []).length;
  const brackets = (text.match(/[(（]/g) || []).length;
  return (text.length - digits + digits * DIGIT_CHARS) / CHARS_PER_SECOND
    + brackets * PAREN_PAUSE_SECONDS;
}

export function checkDuration(text, actualSeconds) {
  const expected = expectedSeconds(text);
  const predicted = expected + DURATION_ALLOWANCE_SECONDS;
  const ratio = actualSeconds / predicted;
  if (ratio < 1 - TOLERANCE) return { ok: false, reason: `too short: ${actualSeconds.toFixed(1)}s vs ~${expected.toFixed(1)}s` };
  if (ratio > 1 + TOLERANCE) return { ok: false, reason: `too long: ${actualSeconds.toFixed(1)}s vs ~${expected.toFixed(1)}s` };
  return { ok: true };
}

// "Not rendered yet" is the render step's business, not verification's, and
// mixing the two buries the answer: a half-finished corpus reported 2,108
// failures of which 2,017 were simply files that did not exist yet, and the
// 91 real ones were unreadable underneath. Only audio that exists and is
// wrong should decide whether this passes.
export function summarize(results) {
  return {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok && r.reason !== 'missing'),
    missing: results.filter((r) => r.reason === 'missing'),
  };
}

async function main() {
  const at = process.argv.indexOf('--voice');
  const voice = at >= 0 ? process.argv[at + 1] : 'f';
  const OUT = OUT_DIRS[voice];
  if (!OUT) {
    console.error(`--voice must be one of ${Object.keys(OUT_DIRS).join(', ')}, got ${JSON.stringify(voice)}`);
    process.exit(1);
  }

  const paragraphs = collectParagraphs(voice);
  const results = [];

  for (const p of paragraphs) {
    const file = `${OUT}${p.hash}.mp3`;
    if (!existsSync(file)) {
      results.push({ hash: p.hash, ok: false, reason: 'missing', p });
      continue;
    }
    if (statSync(file).size === 0) {
      results.push({ hash: p.hash, ok: false, reason: 'empty file', p });
      continue;
    }
    try {
      const meta = await parseFile(file, { duration: true });
      const seconds = meta.format.duration ?? 0;
      const check = checkDuration(p.text, seconds);
      results.push({ hash: p.hash, ok: check.ok, reason: check.reason, p });
    } catch (e) {
      results.push({ hash: p.hash, ok: false, reason: `unreadable: ${e.message}`, p });
    }
  }

  const { passed, failed, missing } = summarize(results);
  console.log(`${passed} ok, ${failed.length} bad, ${missing.length} not rendered yet, of ${results.length}`);
  for (const f of failed.slice(0, 50)) {
    console.log(`  ${f.p.book} ${f.p.number} ¶${f.p.paraIndex} (${f.p.text.length} chars): ${f.reason}`);
  }
  if (failed.length > 50) console.log(`  ...and ${failed.length - 50} more`);

  if (failed.length) {
    // Deleting and re-rendering is the fix for one of these two and a waste of
    // money for the other. Synthesis is deterministic: the same text yields
    // the same audio, so a clip flagged "too long" comes back identical and
    // bills again. Short clips opening with a list marker — "(3) รับขนคน…" —
    // sit there because the engine pauses on the marker, which the model has
    // no term for.
    const short = failed.filter((f) => (f.reason || '').startsWith('too short'));
    if (short.length) {
      console.log(`\n${short.length} are TOO SHORT — audio that stopped early. Delete those from out/ and re-run render.mjs.`);
    }
    if (failed.length - short.length) {
      console.log(`\n${failed.length - short.length} are TOO LONG, which is usually the prediction rather than the audio.`);
      console.log('Listen to one first — `which.mjs <hash>` names it. Re-rendering returns the same file and bills again.');
    }
    process.exit(1);
  }
  if (missing.length) {
    console.log(`\nevery rendered file is complete and audible; ${missing.length} still to render before uploading`);
    return;
  }
  console.log('\nall files complete and audible — safe to upload');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
