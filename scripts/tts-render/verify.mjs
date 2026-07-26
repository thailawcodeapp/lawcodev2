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

// The corpus is 1,165,409 characters and 43.4 hours of speech at this voice's
// default rate, i.e. about 7.5 characters per second.
const CHARS_PER_SECOND = 7.5;

// Speech rate varies with sentence structure, so the band has to be wide
// enough not to cry wolf. It is here to catch audio that stopped early, which
// is off by much more than this.
const TOLERANCE = 0.4;

export function expectedSeconds(text) {
  return text.length / CHARS_PER_SECOND;
}

export function checkDuration(text, actualSeconds) {
  const expected = expectedSeconds(text);
  const ratio = actualSeconds / expected;
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
