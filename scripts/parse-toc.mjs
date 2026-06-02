// Parse the extracted TOC text files into a hierarchical JSON tree.
//
// Source format (one paragraph per line):
//   บรรพ ๑  หลักทั่วไป
//   ลักษณะ ๑  บทเบ็ดเสร็จทั่วไป
//   ๔-๑๔
//   หมวด ๑  บุคคลธรรมดา
//   ส่วนที่ ๑  สภาพบุคคล๑๕-๑๘
//
// Output: public/data/toc-<bookId>.json
//   [{ type, num, name, range:{from,to}, children: [...] }]
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'store-assets', 'toc-extracted');
const outDir = join(root, 'public', 'data');

// Thai-numeral → arabic
const TH_DIGITS = { '๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9' };
function thaiToArabic(s) { return s.replace(/[๐-๙]/g, d => TH_DIGITS[d] || d); }

// Tier ranking — lower = higher in hierarchy
const TIERS = {
  'ภาค':    1,
  'บรรพ':   1,
  'ลักษณะ': 2,
  'หมวด':   3,
  'ส่วนที่': 4,
};
const TIER_RE = /^(ภาค|บรรพ|ลักษณะ|หมวด|ส่วนที่)\s+(\S+?)\s+(.*)$/;
// Range pattern: digits/Thai-digits, optional /n suffix
const RANGE_RE = /(\S+?)[\s\-–]+(\S+?)$/;

function parseRange(text) {
  // Pulls a range out of either the END of a "...๒๖๔-๒๖๙" line OR a standalone range line
  const arabicized = thaiToArabic(text);
  // Try: trailing "<from>-<to>" anywhere in the string
  const m = arabicized.match(/([\d/]+)\s*[-–]\s*([\d/]+)\s*$/);
  if (m) return { from: m[1], to: m[2], rest: arabicized.slice(0, m.index).trim() };
  // Single number "๓๔๐" → { from: 340, to: 340 }
  const single = arabicized.match(/([\d/]+)\s*$/);
  if (single) return { from: single[1], to: single[1], rest: arabicized.slice(0, single.index).trim() };
  return null;
}

function classify(line) {
  for (const [word, tier] of Object.entries(TIERS)) {
    if (line.startsWith(word + ' ') || line.startsWith(word + '\t')) {
      // Strip the marker + number, leave the name (which may have a trailing range)
      const rest = line.slice(word.length).trim();
      // First token is the number, rest is name
      const m = rest.match(/^(\S+)\s*(.*)$/);
      if (!m) return null;
      const numTh = m[1];
      const tailWithRange = m[2];
      const rng = parseRange(tailWithRange);
      return {
        tier, word,
        num: thaiToArabic(numTh),
        name: (rng ? rng.rest : tailWithRange).trim() || word + ' ' + thaiToArabic(numTh),
        range: rng ? { from: rng.from, to: rng.to } : null,
      };
    }
  }
  return null;
}

// Parse a single book file into a tree.
function parseBook(lines) {
  // Filter header lines (สารบาญ, "ประมวลกฎหมาย...", "มาตรา", "ข้อความเบื้องต้น")
  const skip = (l) =>
    l === 'สารบาญ' ||
    l === 'มาตรา' ||
    l.startsWith('ประมวลกฎหมาย');

  const stack = []; // current branch by tier
  const roots = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || skip(line)) continue;

    const cls = classify(line);
    if (cls) {
      const node = { ...cls, children: [] };
      // Pop stack to a level above this tier
      while (stack.length && stack[stack.length - 1].tier >= cls.tier) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
    } else {
      // Standalone range line — attach to the current branch as its range
      // (e.g. "๔-๑๔" right after "ลักษณะ ๑")
      const rng = parseRange(line);
      if (rng && stack.length && !stack[stack.length - 1].range) {
        stack[stack.length - 1].range = { from: rng.from, to: rng.to };
      }
      // Otherwise treat as a special node (e.g. "ข้อความเบื้องต้น๑-๓")
      else if (rng) {
        const node = { tier: 5, word: 'อื่น', num: '', name: rng.rest || line, range: rng, children: [] };
        // Put at root level for now
        roots.push(node);
      }
    }
  }
  return roots;
}

// Compute aggregate range for parent nodes from their leaves.
function fillRanges(node) {
  for (const c of node.children) fillRanges(c);
  if (!node.range && node.children.length) {
    const froms = node.children.map(c => c.range?.from).filter(Boolean);
    const tos   = node.children.map(c => c.range?.to).filter(Boolean);
    if (froms.length) node.range = { from: froms[0], to: tos[tos.length - 1] };
  }
}

const books = ['civil','criminal','civil_proc','criminal_proc'];
for (const bookId of books) {
  const src = join(srcDir, bookId + '.txt');
  const text = readFileSync(src, 'utf8');
  const lines = text.split(/\r?\n/);
  const tree = parseBook(lines);
  for (const n of tree) fillRanges(n);
  const out = join(outDir, 'toc-' + bookId + '.json');
  writeFileSync(out, JSON.stringify(tree, null, 2), 'utf8');
  console.log('wrote', out, '— roots:', tree.length);
}
