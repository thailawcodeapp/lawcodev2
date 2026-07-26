// What counts as a paragraph, defined once.
//
// This module has no imports on purpose. The app reaches it through
// sectionText.js, and scripts/tts-render reads it directly from Node, where
// anything importing './tts' would drag in Capacitor plugins and fail to
// load. Both must agree exactly: audio files are named after a hash of the
// paragraph text, so a renderer that splits differently from the app
// produces files the app never asks for.

// Suffix words attached to section numbers in Thai legal codes
// (e.g. "มาตรา 277 ทวิ"). When they leak into the body they should
// be stripped — they belong to the number, not the text (#4).
const THAI_NUM_SUFFIX =
  '(?:ทวิ|ตรี|จัตวา|เบญจ|ฉ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ)';

// "มาตรา 277", "มาตรา 277/1", "มาตรา 277 ทวิ", "มาตรา 172 ทวิ/1".
//
// The suffix must be a STANDALONE TOKEN (followed by whitespace or
// end-of-string) so we don't eat the first character of words that happen to
// start with one of the suffix letters:
//   "มาตรา 342 ฉ้อโกง..."  → must NOT strip "ฉ" because it's part of "ฉ้อโกง"
//   "มาตรา 4 ฉ เขตอำนาจ..." → MUST strip "ฉ" because it's a real suffix
//
// The inner "/N" group requires the slash deliberately: only "172 ทวิ/1" and
// "172 ทวิ/2" occur, both slash-attached. A looser pattern that allowed a
// space would swallow a leading digit from the body.
const HEADING_RE = new RegExp(
  `^มาตรา\\s+[\\d/]+(?:\\s*${THAI_NUM_SUFFIX}(?:/[\\d/]+)?(?=\\s|$))?\\s*`,
  'i',
);

// Same standalone-token rule for a suffix that leaked to the start of a body.
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
