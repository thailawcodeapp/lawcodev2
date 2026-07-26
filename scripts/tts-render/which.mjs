// Turns a hash back into the section it came from, so a clip that sounds
// wrong can actually be identified. Content-addressed names are what let one
// edited section invalidate exactly one file, but they also mean `out/` sorts
// by hash and tells the listener nothing — this is the way back.
//
// Usage, from the repository root:
//   node scripts/tts-render/which.mjs                 rendered files, reading order
//   node scripts/tts-render/which.mjs 9330dfb7        one file (hash prefix)
//   node scripts/tts-render/which.mjs --section 182   every clip of a section
//   node scripts/tts-render/which.mjs --split         only clips that were split
//   node scripts/tts-render/which.mjs --long          longest clips first
//   node scripts/tts-render/which.mjs --split --prune delete those, to re-render
import { existsSync, statSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectParagraphs } from './corpus.mjs';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));

// render.mjs sends a paragraph whole and splits only when Google rejects it.
// Probing put that rejection threshold between 275 and 302 characters of real
// Thai text, so anything past 275 is where a seam can exist and where an odd
// cut is worth listening for. Below it, a clip is always one unbroken request.
export const SPLIT_RISK_CHARS = 275;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};

const section = value('--section');
const prefix = argv.find((a) => /^[0-9a-f]{4,16}$/.test(a)) || null;

let rows = collectParagraphs().map((p) => {
  const file = `${OUT}${p.hash}.mp3`;
  const rendered = existsSync(file);
  return {
    ...p,
    rendered,
    kb: rendered ? Math.round(statSync(file).size / 1024) : 0,
    atRisk: p.text.length > SPLIT_RISK_CHARS,
  };
});

if (prefix) rows = rows.filter((r) => r.hash.startsWith(prefix));
else if (section) rows = rows.filter((r) => r.number === section);
else rows = rows.filter((r) => r.rendered);

if (flag('--split')) rows = rows.filter((r) => r.atRisk);
if (flag('--long')) rows.sort((a, b) => b.text.length - a.text.length);

if (rows.length === 0) {
  console.log('ไม่พบไฟล์ที่ตรงกับเงื่อนไข');
  process.exit(0);
}

for (const r of rows) {
  const mark = r.rendered ? (r.atRisk ? '✂' : ' ') : '·';
  console.log(
    `${mark} ${r.hash}  ${r.book.padEnd(17)} มาตรา ${String(r.number).padEnd(10)} ` +
      `¶${String(r.paraIndex).padEnd(3)} ${String(r.text.length).padStart(5)} อักษร ` +
      `${String(r.kb).padStart(4)} KB  ${r.text.slice(0, 55)}…`,
  );
}

const risky = rows.filter((r) => r.atRisk).length;
console.log(`\n${rows.length} รายการ | ✂ = ยาวเกิน ${SPLIT_RISK_CHARS} อักษร จึงอาจถูกตัดเป็นหลายคำขอ: ${risky}`);
console.log('· = ยังไม่ได้ render');

// Changing where splitPoint cuts changes the audio of split clips but not
// their names — the hash is of the whole paragraph, and the split is a
// delivery detail below it. So only these files are stale, and re-rendering
// them costs their characters again while every unsplit clip is untouched.
if (flag('--prune')) {
  const doomed = rows.filter((r) => r.rendered);
  for (const r of doomed) unlinkSync(`${OUT}${r.hash}.mp3`);
  const chars = doomed.reduce((a, r) => a + r.text.length, 0);
  console.log(`\nลบแล้ว ${doomed.length} ไฟล์ (${chars.toLocaleString()} อักษรที่ต้อง render ใหม่)`);
  console.log('รันคำสั่ง render เดิมซ้ำได้เลย — ไฟล์ที่เหลือจะถูกข้าม');
}
