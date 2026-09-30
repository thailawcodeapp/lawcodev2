// One-off import of พระธรรมนูญศาลยุติธรรม from the Legal Search index into the
// app's book format. The law text is the product, so this only reshapes it:
// Thai numerals to Arabic, and the heading spacing the other four books use.
//
// Usage, from the repository root:
//   node scripts/import-court-org.mjs "<path to Legal Search>/data/processed/sections.jsonl"
//
// Titles are not in the source (section_title is null for every row) and are
// written by hand below. Review them: they are the one part of this file that
// is not the statute's own words.
import { readFileSync, writeFileSync } from 'node:fs';

const LAW_CODE = 'พ0016-1B-0001';
const BOOK_ID = 'court_org';
const OUT = 'public/data/court-org-th.json';

const TITLES = {
  '1': 'ศาลยุติธรรมมีสามชั้น',
  '2': 'ศาลชั้นต้น',
  '3': 'ศาลชั้นอุทธรณ์',
  '4': 'การแบ่งแผนก การเปิดสาขา และที่ตั้งของศาล',
  '5': 'หน้าที่ประธานศาลฎีกาในการวางระเบียบราชการฝ่ายตุลาการ',
  '6': 'การเสนอจัดตั้ง ยุบเลิก หรือเปลี่ยนแปลงเขตอำนาจศาล',
  '7': 'การกำหนดจำนวนผู้พิพากษา',
  '8': 'ประธานศาล รองประธานศาล และผู้ทำการแทน',
  '9': 'ผู้พิพากษาหัวหน้าศาลจังหวัดและศาลแขวง',
  '10': 'ผู้พิพากษาหัวหน้าแผนกหรือหน่วยงาน',
  '11': 'อำนาจหน้าที่ของประธานศาลและหัวหน้าศาล',
  '12': 'หน้าที่ของหัวหน้าแผนกหรือหน่วยงาน',
  '13': 'อธิบดีผู้พิพากษาภาค รองอธิบดี และผู้ทำการแทน',
  '14': 'อำนาจหน้าที่ของอธิบดีผู้พิพากษาภาค',
  '15': 'ห้ามรับคดีที่ศาลอื่นรับประทับฟ้องแล้ว',
  '16': 'เขตอำนาจของศาลชั้นต้น',
  '17': 'อำนาจของศาลแขวง',
  '18': 'อำนาจของศาลจังหวัด',
  '19': 'อำนาจของศาลแพ่งและศาลอาญา',
  '19/1': 'คดีที่อยู่ในอำนาจศาลแขวงแต่ยื่นฟ้องต่อศาลอื่น',
  '20': 'อำนาจของศาลยุติธรรมอื่น',
  '21': 'เขตของศาลอุทธรณ์',
  '22': 'อำนาจของศาลอุทธรณ์และศาลอุทธรณ์ภาค',
  '23': 'อำนาจของศาลฎีกา',
  '24': 'อำนาจของผู้พิพากษาคนหนึ่ง',
  '25': 'อำนาจของผู้พิพากษาคนเดียวเป็นองค์คณะในศาลชั้นต้น',
  '26': 'องค์คณะในศาลชั้นต้น',
  '27': 'องค์คณะในศาลอุทธรณ์ ศาลอุทธรณ์ภาค และศาลฎีกา',
  '28': 'ผู้พิพากษานั่งพิจารณาแทนเมื่อมีเหตุจำเป็น',
  '29': 'ผู้พิพากษาทำคำพิพากษาแทนเมื่อมีเหตุจำเป็น',
  '30': 'ความหมายของเหตุจำเป็นอื่นอันมิอาจก้าวล่วงได้',
  '31': 'เหตุจำเป็นอื่นอันมิอาจก้าวล่วงได้เพิ่มเติม',
  '32': 'การจ่ายสำนวนคดี',
  '33': 'การเรียกคืนและการโอนสำนวนคดี',
};

const TH_DIGITS = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };
const toArabic = (s) => s.replace(/[๐-๙]/g, (d) => TH_DIGITS[d]);

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/import-court-org.mjs <sections.jsonl>');
  process.exit(1);
}

const rows = readFileSync(src, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.law_code === LAW_CODE)
  .sort((a, b) => Number(a.section_seq) - Number(b.section_seq));

const sections = rows.map((r) => {
  const number = String(r.section_number);
  const title = TITLES[number];
  if (!title) throw new Error(`no title drafted for section ${number}`);

  const text = toArabic(r.text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    // The other four books put two spaces after the number.
    .replace(/^มาตรา (\S+) /, 'มาตรา $1  ');

  const heading = text.match(/^มาตรา (\S+) {2}/);
  if (!heading || heading[1] !== number) {
    throw new Error(`section ${number}: heading says ${heading?.[1]}`);
  }
  if (/[๐-๙]/.test(text)) throw new Error(`section ${number}: Thai numeral survived`);

  return { id: `${BOOK_ID}-${number}`, number, title: `มาตรา ${number} ${title}`, text, bookId: BOOK_ID };
});

const unused = Object.keys(TITLES).filter((n) => !sections.some((s) => s.number === n));
if (unused.length) throw new Error(`titles with no section: ${unused.join(', ')}`);

const book = {
  id: BOOK_ID,
  shortName: 'พระธรรมนูญศาล',
  fullName: 'พระธรรมนูญศาลยุติธรรม',
  totalSections: sections.length,
  sections,
};
writeFileSync(OUT, `${JSON.stringify(book, null, 2)}\n`);
console.log(`${sections.length} sections -> ${OUT}`);
