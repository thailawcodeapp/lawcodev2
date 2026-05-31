// Shared helpers for turning raw section text into display paragraphs and
// TTS playlist items.
import { buildSectionItem } from './tts';

// Suffix words attached to section numbers in Thai legal codes
// (e.g. "มาตรา 277 ทวิ"). When they leak into the body they should
// be stripped — they belong to the number, not the text (#4).
const THAI_NUM_SUFFIX =
  '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)';

// "มาตรา 277", "มาตรา 277/1", "มาตรา 277 ทวิ" — all stripped uniformly.
const HEADING_RE = new RegExp(
  `^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX})?\\s*`,
  'i',
);

// Some entries also leak just the suffix at the start of the body
// (data inconsistency) — strip that too.
const LEADING_SUFFIX_RE = new RegExp(`^${THAI_NUM_SUFFIX}\\s+`, 'i');

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
