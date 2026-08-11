// Text fixes applied on the way into the speech engine — never to the text
// shown on screen or fed to search.
//
// One rule: Thai section numbers are written "193/30" and read aloud
// "193 ทับ 30". Left alone, both the iOS and Android engines read the slash
// as a fraction ("เศษ 193 ส่วน 30"), which is wrong in 437 places.
//
// It whitelists the contexts it recognises instead of blacklisting the ones
// it doesn't, because a naive \d+/\d+ rule breaks civil s.968 —
// "ให้คิดร้อยละ 1/6" is a discount rate, and "หนึ่งทับหก" states the wrong
// one. Enumerating the exceptions (ร้อยละ, อัตรา, …) means guessing at a list
// nobody can complete; recognising "this follows the word มาตรา" is a claim
// we can actually check. Anything unrecognised keeps the engine's default
// fraction reading, which is what s.968 wants anyway.
//
// The left side accepts a trailing Thai word because sections numbered
// "มาตรา 172 ทวิ/1" put an ordinal between the digits and the slash.

const SLASH_RE = /(\d+(?:\s*[฀-๿]+)?)\/(\d+)/g;

// How far back to look for "มาตรา". Long enough for "มาตรา 1598 ทวิ",
// short enough that an unrelated มาตรา earlier in the sentence can't reach.
const LOOKBACK = 20;

// "ลหุโทษ" is read as one word, and the engine does not know it. It has been
// heard saying "ดล ละ หุ โทษ" and, in section 104, collapsing it to "โด้ด".
// Respelling it phonetically as the single word "ละหุโทด" is what the engine
// reads correctly and smoothly: an earlier attempt spaced the syllables
// ("ละ หุ โทษ"), which fixed the pronunciation but made the engine pause
// between each one — chosen by ear against three alternatives, spacing lost.
// Nothing on screen changes, because this runs on the way into the engine
// only. Thirteen sections of the criminal codes contain it.
const LAHUTHOT_RE = /ลหุโทษ/g;

// A bare "(1)" is a sub-clause label and is read by its proper name, not
// literally as "open paren one close paren". Digits only between the
// parens — "(4/1)" is the slash rule's territory (a reference, not a
// label) and is left for SLASH_RE above, which runs first.
const SUBCLAUSE_LABEL_RE = /\((\d+)\)/g;

// The statute's own word for the label, immediately before one. Matched
// against the text preceding the "(n)", so an อนุมาตรา further back in the
// sentence cannot reach.
const ALREADY_LABELLED_RE = /อนุมาตรา ?$/;

// Two pre-rendered voices exist and they say that label differently. The
// Chirp3 female voice shipped first and says "อนุมาตรา 1"; the Gemini male
// voice says "อนุ 1", which is markedly less tiring across a section with a
// dozen sub-clauses.
//
// The label is the only difference between the two texts, and that is the
// point: it changes audioHash(), so each voice gets its own file name. That
// is what lets either voice's wording be revised later and have the renderer
// and every device's cache notice on their own, instead of silently serving
// audio of the old wording forever.
//
// Only the label produced FROM "(n)" is affected. Civil s.1060's own prose
// contains the word "อนุมาตรา" written out, and substituting there would put
// words in the statute's mouth — which is why this is a parameter to the
// replacement rather than a search-and-replace over the finished string.
//
// 'f' is the default in every signature below so that existing callers, and
// every hash already in audio-manifest.json, keep their current meaning.
export const VOICES = ['f', 'm'];
// The male label is spelled the way it sounds when spoken as its own word —
// the same trick as ลหุโทษ -> ละหุโทด above, for the same reason.
//
// Written "อนุ", Gemini read "อนุ 1" as "อนึ่ง": a real Thai word, and a
// near-homophone, so it landed on the word it knew. Measured at 5 of 8 corpus
// clips of that exact text — the other 3 were correct, so the reading is not
// deterministic and re-rendering could never have been the fix. Spelling the
// number out as "อนุ หนึ่ง" did not help either (5 of 10 still wrong): both
// give the model the same run of syllables, and where it breaks them is the
// whole problem. Only 1 collides — no other label number is a Thai word.
//
// "อะนุ" forces the first syllable to be a full "อะ", which the collision
// needs swallowed. Correct in 3 of 3 takes of a probe where "อนุ หนึ่ง" and a
// phonetic-plus-spelled-out variant both failed.
//
// Applied to 1 alone. Spoken correctly the two spellings are the same sound,
// so a section reading "อะนุ 1 … อนุ 2" is indistinguishable by ear from one
// reading "อะนุ" throughout — and the 1,222 paragraphs that would otherwise
// change are all currently correct audio. Re-rendering them is not free: this
// model is non-deterministic in what it says AND in what its safety filter
// refuses, so every re-render of a good clip is a fresh roll of both dice.
const SUBCLAUSE_LABEL = { f: 'อนุมาตรา', m: 'อนุ' };
const PHONETIC_LABEL = { m: { 1: 'อะนุ' } };

const BREAK = '<break time="200ms"/>';

// Mirrors render.mjs's CONTINUATION_WORDS — not imported from it, because
// that file lives in scripts/tts-render (a Node CLI, not part of the app
// bundle) and this one ships to the browser.
const CONTINUATION_WORDS = [
  'หรือ', 'และ', 'แต่', 'เว้นแต่', 'ทั้งนี้',
  'รวมทั้ง', 'ตลอดจน', 'อีกทั้ง', 'กับทั้ง', 'แล้วแต่', 'หากแต่',
];

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Splits on runs of spaces, keeping the runs themselves as separate tokens
// (odd indices) — so a double space in the source (a handful of sections
// have one) passes through untouched instead of collapsing to one break,
// which would silently change the text's own spacing.
//
// Not called from normalizeForSpeech, and not exported to speechUnits: this
// output is SSML, valid only for the cloud render pipeline
// (render.mjs, Google's Chirp3 HD, which parses it). The app's on-device
// fallback voice (src/lib/tts.js → @capacitor-community/text-to-speech)
// takes plain text and does not parse SSML — handed a <break> tag, it would
// speak the tag literally. render.mjs is the only caller.
//
// Only a paragraph carrying an "อนุมาตรา" label is touched — that paragraph
// is already being re-rendered for the label fix, so pausing its other word
// boundaries too costs nothing extra. A plain paragraph is returned as-is:
// pausing it would invalidate its already-cached audio file for a change no
// one asked for here.
export function addRenderPauses(text) {
  if (!/อนุมาตรา \d+/.test(text)) return text;
  const tokens = text.split(/( +)/);
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      out += escapeXml(tokens[i]);
      continue;
    }
    const prevWord = tokens[i - 1];
    const nextWord = tokens[i + 1] || '';
    // "172 ทับ 2" must stay one breath — ทับ is punctuation standing in for
    // "/", not a word, so a pause on either side of it reads as three
    // separate numbers instead of one section reference. Likewise "อนุมาตรา
    // 1" is a label plus its number, not two clauses — the pause belongs
    // after the number, not between the word and it.
    const glued = tokens[i] !== ' '
      || CONTINUATION_WORDS.includes(nextWord)
      || prevWord === 'ทับ' || nextWord === 'ทับ'
      || prevWord === 'อนุมาตรา';
    out += glued ? tokens[i] : BREAK;
  }
  return out;
}

// Plain text only — safe both as the device engine's input and as the
// paragraph's identity for audioHash(). "(1)" becomes the word "อนุมาตรา 1"
// (any engine, cloud or on-device, reads that correctly on its own); pauses
// are a separate, render-only concern — see addRenderPauses below.
export function normalizeForSpeech(text, voice = 'f') {
  if (!text) return '';
  const out = String(text).replace(LAHUTHOT_RE, 'ละหุโทด').replace(SLASH_RE, (full, left, right, offset, str) => {
    const isSubClause = str[offset - 1] === '(' && str[offset + full.length] === ')';
    const followsMaatra = /มาตรา[\s฀-๿]{0,8}$/
      .test(str.slice(Math.max(0, offset - LOOKBACK), offset));
    return isSubClause || followsMaatra ? `${left} ทับ ${right}` : full;
  });

  const label = SUBCLAUSE_LABEL[voice] ?? SUBCLAUSE_LABEL.f;
  return out.replace(SUBCLAUSE_LABEL_RE, (_, num, offset) => {
    // Thirteen paragraphs cite a sub-clause in prose — "ตามอนุมาตรา (2)" —
    // where the statute has already written the word out. Naming the label
    // again there says it twice ("อนุมาตรา อนุมาตรา 2"), so when the text
    // supplied the word, only the number is added.
    // Male only. The female voice's audio for these thirteen paragraphs is
    // already rendered, uploaded and shipped, and fixing the wording would
    // change their hashes — so a build that carried the fix but not the new
    // files would leave thirteen paragraphs silent on the voice this does not
    // even default to. "อนุมาตรา อนุมาตรา 2" is untidy, not wrong, and it is
    // what those users have heard all along. Deliberately left alone; see the
    // list in the render notes if it is ever worth the re-render.
    //
    // A citation keeps the statute's own word in front of it — "อนุมาตรา 1" —
    // which is the female voice's wording, and that has never been misread.
    if (voice === 'm' && ALREADY_LABELLED_RE.test(out.slice(0, offset))) return num;
    return `${PHONETIC_LABEL[voice]?.[num] ?? label} ${num}`;
  });
}

// The spoken units of one section: what the app reads aloud and what the
// render pipeline turns into files. Both call this so a file's name can never
// describe text the app doesn't ask for.
//
// The section number leads the first paragraph rather than standing alone.
// Rendered separately it became its own clip, and the engine closed it like a
// finished sentence before opening the body on a fresh contour — an audible
// seam in the one place every section has one. Joined, "มาตรา 5 บุคคล…" is a
// single breath group. It also removes the moment where audio is playing and
// no paragraph is highlighted, since the number now belongs to paragraph 0.
//
// Each piece is normalised on its own and joined afterwards, never joined and
// then normalised: LOOKBACK would let the "มาตรา" prefix reach into the start
// of paragraph 0 and turn a slash there into ทับ, changing text that has
// already been verified aloud on a device.
export function speechUnits(number, paragraphs, voice = 'f') {
  const head = normalizeForSpeech(`มาตรา ${number}`, voice);
  const body = (paragraphs || []).map((p) => normalizeForSpeech(p, voice));
  if (body.length === 0) return [head];
  const joiner = runsIntoTheNumber(head, body[0]) ? ', ' : ' ';
  return [`${head}${joiner}${body[0]}`, ...body.slice(1)];
}

// Thai numeral words, as they appear at the start of a word. A number spoken
// immediately before one of these can be heard as continuing into it.
const NUMERAL_WORD_START =
  /^(?:เอ็ด|ยี่|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)/;

/**
 * True when the section number and the first word of the text would be read as
 * one number.
 *
 * "มาตรา 170 ห้ามมิให้ฟ้อง…" came back as "มาตราหนึ่งร้อยเจ็ดสิบห้า มิให้ฟ้อง":
 * the number's last syllable and the body's first syllable make สิบ + ห้า =
 * สิบห้า, a perfectly good Thai fifteen, and the leftover "ม" is dropped. So
 * the section is announced by the wrong number AND the statute loses a word —
 * which is why this is fixed for both voices rather than left alone the way
 * the doubled "อนุมาตรา อนุมาตรา" label was. That one was untidy; this one is
 * wrong.
 *
 * Two conditions, and both are needed:
 *
 *   - the number must END in a multiplier — สิบ, ร้อย or พัน, which is exactly
 *     the numbers divisible by ten. Those are the only tails that make a real
 *     number when a numeral word is glued on. "มาตรา 172" ends in สอง, and
 *     "สองห้า" is not a number, so nothing merges.
 *   - the body must START with a numeral word.
 *
 * Read off the finished head rather than the raw `number`, because
 * normalisation moves the tail: "172 ทวิ/1" is spoken "172 ทวิ ทับ 1" and ends
 * in หนึ่ง, not in the 172 the caller passed.
 *
 * Matches five sections in the corpus today — civil 1040, civil-proc 170,
 * criminal-proc 120, 190 and 220 — three of which were reported by ear before
 * this rule existed and two of which it found. scripts/tts-render/_scan13.mjs
 * re-derives the list if the corpus changes.
 *
 * The comma is a short pause, not a sentence break: a full stop also fixed the
 * reading in the probe but closes the number like a finished sentence, which
 * is the seam speechUnits joins the head and paragraph 0 to avoid. Spelling
 * the number out in Thai words fixed it too, and was passed over as the same
 * result for a Thai numeral-speller's worth of new code.
 */
function runsIntoTheNumber(head, firstParagraph) {
  const tail = head.match(/(\d+)$/);
  if (!tail) return false;
  if (Number(tail[1]) % 10 !== 0) return false;
  return NUMERAL_WORD_START.test(firstParagraph || '');
}
