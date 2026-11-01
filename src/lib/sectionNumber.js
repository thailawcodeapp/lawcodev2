// Ordering of section numbers, shared by folders and the contents. It has no
// imports so that either can use it.

// Thai ordinal suffixes used to mark inserted sections ("มาตรา 277 ทวิ"),
// ranked in order. Base (no suffix) is 1, so 277 < 277 ทวิ < 277 ตรี.
const THAI_ORDINAL_RANK = {
  'ทวิ': 2, 'ตรี': 3, 'จัตวา': 4, 'เบญจ': 5, 'ฉ': 6,
  'สัตต': 7, 'อัฏฐ': 8, 'นว': 9, 'ทศ': 10, 'เอกาทศ': 11, 'ทวาทศ': 12,
  'เตรส': 13, 'จตุทศ': 14, 'ปัณรส': 15, 'โสฬส': 16, 'สัตตรส': 17, 'อัฏฐารส': 18,
};

// Numeric ordering key for a section number: the leading integer, then each
// later part in the order it is written — "/N" as N, a Thai ordinal as its
// rank. Compared element by element, a missing part counting as 0:
//   "12"          → [12]
//   "277/1"       → [277, 1]
//   "277 ทวิ"     → [277, 2]
//   "172 ทวิ/1"   → [172, 2, 1]     172 ทวิ < 172 ทวิ/1 < 172 ตรี
//   "90/14 ทวิ"   → [90, 14, 2]     90/14 < 90/14 ทวิ < 90/15  (ล้มละลาย)
// The ordinal is matched as a whole word, so "ทศ" never matches inside "เอกาทศ".
export function sectionNumberKey(number) {
  const s = String(number ?? '').trim();
  const main = parseInt(s, 10);            // leading integer; NaN when non-numeric
  const key = [Number.isNaN(main) ? Infinity : main];
  for (const m of s.slice(String(main).length).matchAll(/\/(\d+)|([฀-๿]+)/g)) {
    key.push(m[1] ? parseInt(m[1], 10) : (THAI_ORDINAL_RANK[m[2]] ?? 0));
  }
  return key;
}

export function compareKeys(ka, kb) {
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const d = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
