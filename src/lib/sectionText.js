// Shared helpers for turning raw section text into display paragraphs and
// TTS playlist items.
import { buildSectionItem } from './tts';

export function cleanTitle(title) {
  return String(title || '').replace(/^มาตรา\s+[\d/]+\s*/i, '');
}

// Strip the leading "มาตรา X" and split the body into paragraphs.
export function parseBody(text) {
  const cleaned = String(text || '').replace(/^มาตรา\s+[\d/]+\s+/i, '').trim();
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
