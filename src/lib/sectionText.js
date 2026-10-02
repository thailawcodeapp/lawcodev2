// Shared helpers for turning raw section text into display paragraphs and
// TTS playlist items.
//
// Paragraph parsing lives in sectionParagraphs.js, which has no imports, so
// scripts/tts-render can use the same definition from Node. Re-exported here
// so existing callers are unaffected.
import { buildSectionItem } from './tts';

export { cleanTitle, parseBody } from './sectionParagraphs';
import { parseBody } from './sectionParagraphs';

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
