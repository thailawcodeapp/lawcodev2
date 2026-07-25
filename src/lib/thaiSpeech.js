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

export function normalizeForSpeech(text) {
  if (!text) return '';
  return String(text).replace(SLASH_RE, (full, left, right, offset, str) => {
    const isSubClause = str[offset - 1] === '(' && str[offset + full.length] === ')';
    const followsMaatra = /มาตรา[\s฀-๿]{0,8}$/
      .test(str.slice(Math.max(0, offset - LOOKBACK), offset));
    return isSubClause || followsMaatra ? `${left} ทับ ${right}` : full;
  });
}
