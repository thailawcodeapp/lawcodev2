// Proves the rendered audio is complete and audible before any of it is
// uploaded. The failure that matters here is not an error — errors are
// counted and retried by render.mjs — but a 200 response carrying truncated
// or silent audio, which nothing else in the pipeline would notice and which
// nobody can catch by listening to 6,764 files.
//
// Usage, from the repository root:
//   node scripts/tts-render/verify.mjs
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';
import { collectParagraphs } from './corpus.mjs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));

// Measured from real th-TH-Chirp3-HD-Gacrux output (three phase-2 pilot
// sections), not derived from a spec estimate:
//   civil 1    :  47 chars /  4.7s = 10.0 chars/s
//   civil 420  : 215 chars / 21.3s = 10.1 chars/s
//   civil 968  : 583 chars / 57.7s = 10.1 chars/s
// A 7.5 figure (carried over from a pre-measurement spec estimate) put every
// healthy file at ratio ~0.73, leaving only 0.13 of margin below the 0.6
// floor of TOLERANCE=0.4 — nearly blind to real truncation. Re-measure this
// if the voice ever changes.
const CHARS_PER_SECOND = 10.1;

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
const DURATION_ALLOWANCE_SECONDS = 0.25;

export function expectedSeconds(text) {
  return text.length / CHARS_PER_SECOND;
}

export function checkDuration(text, actualSeconds) {
  const expected = expectedSeconds(text);
  const predicted = expected + DURATION_ALLOWANCE_SECONDS;
  const ratio = actualSeconds / predicted;
  if (ratio < 1 - TOLERANCE) return { ok: false, reason: `too short: ${actualSeconds.toFixed(1)}s vs ~${expected.toFixed(1)}s` };
  if (ratio > 1 + TOLERANCE) return { ok: false, reason: `too long: ${actualSeconds.toFixed(1)}s vs ~${expected.toFixed(1)}s` };
  return { ok: true };
}

export function summarize(results) {
  return {
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
  };
}

async function main() {
  const paragraphs = collectParagraphs();
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

  const { passed, failed } = summarize(results);
  console.log(`${passed} ok, ${failed.length} failed of ${results.length}`);
  for (const f of failed.slice(0, 50)) {
    console.log(`  ${f.p.book} ${f.p.number} ¶${f.p.paraIndex} (${f.p.text.length} chars): ${f.reason}`);
  }
  if (failed.length > 50) console.log(`  ...and ${failed.length - 50} more`);

  if (failed.length) {
    console.log('\ndelete the failing files from out/ and re-run render.mjs to redo just those');
    process.exit(1);
  }
  console.log('\nall files complete and audible — safe to upload');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
