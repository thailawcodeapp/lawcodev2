// Import of the acts that followed พระธรรมนูญศาลยุติธรรม, from the Legal
// Search index into the app's book format. Like import-court-org.mjs it only
// reshapes the statute: Thai numerals to Arabic, and the heading spacing the
// other books use. Two things are new:
//
//   Titles. The source has none, and 900 hand-written ones would be 900
//   unreviewed summaries. Each section is titled instead with the opening of
//   its own text, cut at a word boundary, and marked `excerpt: true` so the
//   reader does not print it twice above the paragraph it came from.
//
//   Contents. Built from each row's `path` (หมวด, then ส่วน), not by hand.
//
// Usage, from the repository root:
//   node scripts/import-acts.mjs "<path to Legal Search>/data/processed/sections.jsonl"
import { readFileSync, writeFileSync } from 'node:fs';

const ACTS = [
  {
    lawCode: 'ร0006-10-0001', id: 'constitution', file: 'constitution-th',
    shortName: 'รัฐธรรมนูญ', fullName: 'รัฐธรรมนูญแห่งราชอาณาจักรไทย',
    // The index files 262-279 under หมวด 16; they are the บทเฉพาะกาล, which
    // stands after the last หมวด without a number of its own.
    tocOverride: (toc) => splitTail(toc, '262', { word: null, num: null, name: 'บทเฉพาะกาล' }),
  },
  {
    lawCode: 'จ0005-1B-0001', id: 'district_court', file: 'district-court-th',
    shortName: 'ศาลแขวง', fullName: 'พระราชบัญญัติจัดตั้งศาลแขวงและวิธีพิจารณาความอาญาในศาลแขวง',
  },
  {
    lawCode: 'ศ0003-1B-0001', id: 'juvenile_court', file: 'juvenile-court-th',
    shortName: 'ศาลเยาวชนและครอบครัว',
    fullName: 'พระราชบัญญัติศาลเยาวชนและครอบครัวและวิธีพิจารณาคดีเยาวชนและครอบครัว',
  },
  {
    lawCode: 'ว0076-1B-0002', id: 'consumer_proc', file: 'consumer-proc-th',
    shortName: 'วิธีพิจารณาคดีผู้บริโภค', fullName: 'พระราชบัญญัติวิธีพิจารณาคดีผู้บริโภค',
  },
  {
    lawCode: 'จ0028-1B-0001', id: 'admin_court', file: 'admin-court-th',
    shortName: 'ศาลปกครอง', fullName: 'พระราชบัญญัติจัดตั้งศาลปกครองและวิธีพิจารณาคดีปกครอง',
  },
  {
    lawCode: 'ค0077-1B-0001', id: 'labour_protection', file: 'labour-protection-th',
    shortName: 'คุ้มครองแรงงาน', fullName: 'พระราชบัญญัติคุ้มครองแรงงาน',
  },
  // Added 2026-10-27. Gaps in the numbering (bankruptcy 72-75, 107, 149, 153
  // and 90/79) are repealed sections, checked against the user's copy.
  {
    lawCode: 'ล0001-1B-0001', id: 'bankruptcy', file: 'bankruptcy-th',
    shortName: 'ล้มละลาย', fullName: 'พระราชบัญญัติล้มละลาย',
  },
  {
    lawCode: 'ล0006-1B-0002', id: 'copyright', file: 'copyright-th',
    shortName: 'ลิขสิทธิ์', fullName: 'พระราชบัญญัติลิขสิทธิ์',
  },
];

// Long enough to tell neighbouring sections apart in a list, short enough to
// sit on one line of the reading list before CSS truncates it anyway.
const EXCERPT_CHARS = 60;

const TH_DIGITS = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };
const toArabic = (s) => s.replace(/[๐-๙]/g, (d) => TH_DIGITS[d]);

const words = new Intl.Segmenter('th', { granularity: 'word' });

export function excerptOf(firstParagraph) {
  let out = '';
  for (const { segment } of words.segment(firstParagraph)) {
    if (out.length + segment.length > EXCERPT_CHARS && out.trim()) {
      return `${out.trimEnd()}…`;
    }
    out += segment;
  }
  return out.trimEnd();
}

// Leaves of a หมวด/ส่วน tree split off from `from` onwards into a new last
// top-level node. Used where the index's path is known to be wrong.
function splitTail(toc, from, node) {
  const last = toc[toc.length - 1];
  const tailTo = last.range.to;
  last.range.to = String(Number(from) - 1);
  toc.push({ tier: 1, ...node, range: { from, to: tailTo }, children: [] });
  return toc;
}

// "หมวด ๓/๑ คณะกรรมการบริหารศาลปกครอง" -> { word, num, name }
function parseHeading(h) {
  const m = toArabic(h).match(/^(หมวด|ส่วนที่)\s+(\S+)\s+(.+)$/);
  if (!m) throw new Error(`unrecognised heading: ${h}`);
  return { word: m[1], num: m[2], name: m[3].trim() };
}

function buildToc(rows) {
  const toc = [];
  const opening = [];
  for (const r of rows) {
    const number = r.number;
    if (!r.path.length) {
      if (toc.length) throw new Error(`section ${number}: no path after the first หมวด`);
      opening.push(number);
      continue;
    }
    let level = toc;
    r.path.forEach((h, depth) => {
      const { word, num, name } = parseHeading(h);
      let node = level[level.length - 1];
      if (!node || node.word !== word || node.num !== num) {
        node = { tier: depth + 1, word, num, name, range: { from: number, to: number }, children: [] };
        level.push(node);
      }
      node.range.to = number;
      level = node.children;
    });
  }
  // A หมวด with ส่วน must not also hold sections of its own, or those would
  // be in no leaf and unreachable from the contents.
  const walk = (nodes) => nodes.forEach((n) => {
    if (n.children.length && n.children[0].range.from !== n.range.from) {
      throw new Error(`${n.word} ${n.num}: sections before its first child`);
    }
    walk(n.children);
  });
  walk(toc);

  if (opening.length) {
    // Sections before หมวด 1 (title, commencement, repeals, definitions) have
    // no heading in the statute. A whole act without หมวด gets one node too,
    // so the contents screen never opens empty.
    // "ข้อความเบื้องต้น" is what the codes' own contents call that part.
    const name = toc.length ? 'ข้อความเบื้องต้น' : 'ทั้งฉบับ';
    toc.unshift({ tier: 1, word: null, num: null, name, range: { from: opening[0], to: opening.at(-1) }, children: [] });
  }
  return toc;
}

function importAct(act, allRows) {
  const rows = allRows
    .filter((r) => r.law_code === act.lawCode)
    .sort((a, b) => Number(a.section_seq) - Number(b.section_seq));
  if (!rows.length) throw new Error(`${act.id}: no rows for ${act.lawCode}`);

  const sections = rows.map((r) => {
    const number = toArabic(String(r.section_number)).replace(/\s+/g, ' ').trim();
    const lines = toArabic(r.text)
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const head = `มาตรา ${number} `;
    if (!lines[0].startsWith(head)) throw new Error(`${act.id} ${number}: heading is "${lines[0].slice(0, 20)}"`);
    const first = lines[0].slice(head.length).trim();
    // The other books put two spaces after the number.
    lines[0] = `มาตรา ${number}  ${first}`;
    const text = lines.join('\n');
    if (/[๐-๙]/.test(text)) throw new Error(`${act.id} ${number}: Thai numeral survived`);

    return {
      id: `${act.id}-${number.replace(/ /g, '-')}`,
      number,
      title: `มาตรา ${number} ${excerptOf(first)}`,
      excerpt: true,
      text,
      bookId: act.id,
      path: r.path,
    };
  });

  const ids = new Set(sections.map((s) => s.id));
  if (ids.size !== sections.length) throw new Error(`${act.id}: duplicate section ids`);

  let toc = buildToc(sections);
  if (act.tocOverride) toc = act.tocOverride(toc);

  const book = {
    id: act.id,
    shortName: act.shortName,
    fullName: act.fullName,
    totalSections: sections.length,
    sections: sections.map(({ path, ...s }) => s),
  };
  writeFileSync(`public/data/${act.file}.json`, `${JSON.stringify(book, null, 2)}\n`);
  writeFileSync(`public/data/toc-${act.id}.json`, `${JSON.stringify(toc, null, 2)}\n`);
  return { id: act.id, sections: sections.length, tocNodes: toc.length };
}

const isMain = process.argv[1] && process.argv[1].endsWith('import-acts.mjs');
if (isMain) {
  const src = process.argv[2];
  if (!src) {
    console.error('usage: node scripts/import-acts.mjs <sections.jsonl>');
    process.exit(1);
  }
  const codes = new Set(ACTS.map((a) => a.lawCode));
  const allRows = readFileSync(src, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => codes.has(r.law_code));
  for (const act of ACTS) {
    const r = importAct(act, allRows);
    console.log(`${r.id}: ${r.sections} sections, ${r.tocNodes} top-level contents nodes`);
  }
}
