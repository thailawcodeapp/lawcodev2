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

// A section number may carry a trailing Thai ordinal suffix in the source
// TOC ("๓๓๖ ทวิ", "๓๔๐ ตรี"). The actual data files store these as plain
// numbers ("336", "340"), so for range bounds we keep only the numeric part.
// Note: "อัฎฐ" appears with both ฏ (ปฏัก) and ฎ (ชฎา) spellings in source docs.
const THAI_SUFFIX = '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|อัฎฐ|นว|ทศ|เอกาทศ|ทวาทศ|ปัญจทศ|โสฬส)';
// Matches a bound like "336", "29/1", or "336 ทวิ" / "269/15"
const BOUND = `[\\d/]+(?:\\s*${THAI_SUFFIX})?`;

function stripSuffix(bound) {
  // "336 ทวิ" → "336" ; "29/1" → "29/1"
  return thaiToArabic(bound).replace(new RegExp(`\\s*${THAI_SUFFIX}\\s*$`), '').trim();
}

function parseRange(text) {
  const arabicized = thaiToArabic(text);
  // Trailing "<from>-<to>" where each bound may have a Thai suffix.
  const rangeRe = new RegExp(`(${BOUND})\\s*[-–]\\s*(${BOUND})\\s*$`);
  const m = arabicized.match(rangeRe);
  if (m) {
    return { from: stripSuffix(m[1]), to: stripSuffix(m[2]), rest: arabicized.slice(0, m.index).trim() };
  }
  // Single number "๓๔๐" or "๓๔๐ ทวิ" → { from: 340, to: 340 }
  const singleRe = new RegExp(`(${BOUND})\\s*$`);
  const single = arabicized.match(singleRe);
  if (single) {
    const v = stripSuffix(single[1]);
    return { from: v, to: v, rest: arabicized.slice(0, single.index).trim() };
  }
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

// ── Orphan absorption ─────────────────────────────────────────────────────
// After parsing, some real sections fall just past a leaf's `to` bound:
//   • "/N" sub-variants (287/1 after a 276-287 range)
//   • a stray section the source TOC range under-counts (608, 609)
// We extend each leaf's `to` to swallow any section that sits in the GAP
// between that leaf and the next one — so every section maps to a category.
const numKey = (s) => {
  const [m, sub] = String(s).split('/');
  return (parseFloat(m) || 0) * 1000 + (parseFloat(sub) || 0);
};

function collectLeaves(nodes, out = []) {
  for (const n of nodes) {
    if (n.children && n.children.length) collectLeaves(n.children, out);
    else if (n.range) out.push(n);
  }
  return out;
}

function absorbOrphans(tree, sections) {
  const leaves = collectLeaves(tree).sort((a, b) => numKey(a.range.from) - numKey(b.range.from));
  if (!leaves.length) return;
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    const next = leaves[i + 1];
    const lo = numKey(leaf.range.from);
    const hiBound = next ? numKey(next.range.from) : Infinity;
    // Find the highest section number that belongs to this leaf (>= its
    // current `to`, < the next leaf's `from`).
    let maxNum = leaf.range.to;
    let maxKey = numKey(leaf.range.to);
    for (const s of sections) {
      const k = numKey(s.number);
      if (k >= lo && k < hiBound && k > maxKey) {
        maxKey = k;
        maxNum = String(s.number);
      }
    }
    if (maxNum !== leaf.range.to) leaf.range.to = maxNum;
  }
}

const books = ['civil','criminal','civil_proc','criminal_proc'];
const dataFile = {
  civil: 'civil-th', criminal: 'criminal-th',
  civil_proc: 'civil-proc-th', criminal_proc: 'criminal-proc-th',
};
for (const bookId of books) {
  const src = join(srcDir, bookId + '.txt');
  const text = readFileSync(src, 'utf8');
  const lines = text.split(/\r?\n/);
  const tree = parseBook(lines);

  // Absorb orphan sections into the nearest leaf, then roll ranges up.
  const data = JSON.parse(readFileSync(join(outDir, dataFile[bookId] + '.json'), 'utf8'));
  absorbOrphans(tree, data.sections || []);
  for (const n of tree) fillRanges(n);

  const out = join(outDir, 'toc-' + bookId + '.json');
  writeFileSync(out, JSON.stringify(tree, null, 2), 'utf8');
  console.log('wrote', out, '— roots:', tree.length);
}
