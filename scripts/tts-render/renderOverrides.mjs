// Paragraphs where the engine read the text correctly as text and wrongly as
// speech, and what to send it instead.
//
// Keyed by hash, which is the point: the hash is computed from the paragraph's
// plain text, and that text is what the app looks up, what names the file in
// R2 and what the device voice speaks. An entry here changes only what the
// render script hands the TTS API — the file keeps its name, the manifest is
// untouched, and a corrected clip reaches listeners by replacing one object in
// the bucket. No app build, no new version.
//
// Keying on the hash also fails safe. Edit a paragraph's wording and its hash
// changes; the override stops matching and stops applying, which is right —
// the new wording has to be listened to before anyone can claim it needs the
// same repair.
//
// Only for genuine mis-readings. Anything that changes what the paragraph SAYS
// belongs in the corpus, not here, where it would put the audio and the text on
// screen out of step with each other.
export const RENDER_OVERRIDES = {
  // criminal 370. Gemini read "มาตรา 370" as "มาตราสามร้อยเจ็ด" — it dropped the
  // สิบ, turning section 370 into section 307, which is a different offence.
  // Spelled out, there is no number left for it to parse.
  '9aa2d610d908f4ec': 'มาตรา สามร้อยเจ็ดสิบ ผู้ใดส่งเสียง ทำให้เกิดเสียงหรือกระทำความอื้ออึง โดยไม่มีเหตุอันสมควร จนทำให้ประชาชนตกใจหรือเดือดร้อน ต้องระวางโทษปรับไม่เกินหนึ่งพันบาท',
};

/** The text to render for this paragraph — its own, unless it is listed above. */
export function renderTextFor(paragraph) {
  return RENDER_OVERRIDES[paragraph.hash] ?? paragraph.text;
}
