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
// Spacing the syllables is the whole fix; nothing else about the word changes,
// and the spelling on screen is untouched because this runs on the way into
// the engine only. Thirteen sections of the criminal codes contain it.
const LAHUTHOT_RE = /ลหุโทษ/g;

export function normalizeForSpeech(text) {
  if (!text) return '';
  return String(text).replace(LAHUTHOT_RE, 'ละ หุ โทษ').replace(SLASH_RE, (full, left, right, offset, str) => {
    const isSubClause = str[offset - 1] === '(' && str[offset + full.length] === ')';
    const followsMaatra = /มาตรา[\s฀-๿]{0,8}$/
      .test(str.slice(Math.max(0, offset - LOOKBACK), offset));
    return isSubClause || followsMaatra ? `${left} ทับ ${right}` : full;
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
export function speechUnits(number, paragraphs) {
  const head = normalizeForSpeech(`มาตรา ${number}`);
  const body = (paragraphs || []).map(normalizeForSpeech);
  if (body.length === 0) return [head];
  return [`${head} ${body[0]}`, ...body.slice(1)];
}
