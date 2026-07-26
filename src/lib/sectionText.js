// Shared helpers for turning raw section text into display paragraphs and
// TTS playlist items.
import { buildSectionItem } from './tts';

// Suffix words attached to section numbers in Thai legal codes
// (e.g. "มาตรา 277 ทวิ"). When they leak into the body they should
// be stripped — they belong to the number, not the text (#4).
const THAI_NUM_SUFFIX =
  '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)';

// "มาตรา 277", "มาตรา 277/1", "มาตรา 277 ทวิ" — all stripped uniformly.
// v16 fix: require the Thai suffix to be a STANDALONE TOKEN (followed by
// whitespace or end-of-string) so we don't eat the first character of words
// that happen to start with one of the suffix letters. Example:
//   "มาตรา 342 ฉ้อโกง..."  → must NOT strip "ฉ" because it's part of "ฉ้อโกง"
//   "มาตรา 4 ฉ เขตอำนาจ..." → MUST strip "ฉ" because it's a real suffix
// v17 fix: the ordinal isn't always trailing — "มาตรา 172 ทวิ/1" has the
// suffix sitting BETWEEN digit groups, not after all of them. Allow a
// further sub-number after the suffix so it's still consumed as part of
// the number, while the (?=\s|$) lookahead still guards the suffix token
// itself, so "ฉ้อโกง" is untouched (its "ฉ" is followed by a Thai vowel
// sign, not whitespace/end, so the whole optional group fails to match
// and backtracks to zero-length, same as before this fix).
// The inner group requires the slash (`/[\d/]+`, no leading `\s*`)
// deliberately: "172 ทวิ/1" and "172 ทวิ/2" are the only shape observed in
// the corpus, and both are slash-attached with no space. A looser
// `\s*[\d/]+` would also match "ทวิ 5 ปี..." and silently swallow the "5"
// from real body text into the heading — a corpus edit that legitimately
// puts a number after a bare ordinal would lose a character with no test
// able to catch it (the corpus sweep only detects fragments left behind,
// not text taken away).
const HEADING_RE = new RegExp(
  `^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX}(?:/[\\d/]+)?(?=\\s|$))?\\s*`,
  'i',
);

// Same fix for the standalone-suffix-leak case: the suffix must be a whole
// token followed by whitespace. (We can't allow end-of-string here because
// a paragraph wouldn't start with just a suffix.)
const LEADING_SUFFIX_RE = new RegExp(`^${THAI_NUM_SUFFIX}(?=\\s)\\s+`, 'i');

export function cleanTitle(title) {
  return String(title || '').replace(HEADING_RE, '').replace(LEADING_SUFFIX_RE, '');
}

// Strip the leading "มาตรา X [ทวิ]" and split the body into paragraphs.
export function parseBody(text) {
  const cleaned = String(text || '')
    .replace(HEADING_RE, '')
    .replace(LEADING_SUFFIX_RE, '')
    .trim();
  if (!cleaned) return [];
  const separator = /\n{2,}/.test(cleaned) ? /\n{2,}/ : /\n/;
  return cleaned.split(separator).map(p => p.trim()).filter(Boolean);
}

// Build TTS items for a list of { sectionId, bookId } refs, looking up the
// full text from the loaded books.
export function buildItemsFromRefs(books, refs) {
  const items = [];
  for (const ref of refs) {
    const book = books.find(b => b.id === ref.bookId);
    const sec = book?.sections?.find(s => s.id === ref.sectionId);
    if (!sec) continue;
    items.push(buildSectionItem({
      sectionId: sec.id,
      bookId: book.id,
      number: sec.number,
      title: sec.title,
      paragraphs: parseBody(sec.text),
    }));
  }
  return items;
}
