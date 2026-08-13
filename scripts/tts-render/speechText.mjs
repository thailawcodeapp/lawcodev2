// The spoken text of every paragraph, keyed by the hash of that same text, so
// the Android side can look up what to say when there is no file to play.
//
// Why this file exists at all: when the network goes away mid-queue, playback
// has to fall back to the device voice — and on Android the code that makes
// that decision has to be Java, because the WebView's JavaScript engine stops
// running about 80 seconds after the app leaves the screen. Java therefore
// needs the text, and it cannot ask JavaScript for it: by the time the
// fallback is needed, JavaScript is frozen.
//
// The alternative was shipping the text across the bridge with every queue —
// roughly 1.5 MB of Thai on every press of play, paid by every listener,
// almost all of whom never lose their connection. This costs them 0.5 MB once,
// in the download, and Java reads only the book being listened to and only
// when a paragraph actually fails.
//
// Keyed by hash rather than by section and paragraph because a queue entry
// carries a URL and nothing else — audio/<voice>/<hash>.mp3 — so the hash is
// the one identifier native already holds. It is also what makes one file
// serve all three voices: the two spellings of a sub-clause label hash apart,
// so both can live here without colliding.
//
// Generated from collectParagraphs(), which is the same function that decided
// what to render and named every audio file. Reimplementing the wording rules
// on the Java side would put a second opinion about "อนุ 1" against "อนุมาตรา 1"
// in the app, and the two would drift the first time either changed.
import { writeFileSync } from 'node:fs';
import { collectParagraphs } from './corpus.mjs';

// Spelled out rather than imported from audioManifest.js, which reaches for
// '../config' and a JSON import that only resolve under Vite — this script has
// to run under plain node. speechText.test.mjs does import the app's real
// VOICES and checks every one of them is covered here, so a voice added there
// and forgotten here fails the suite rather than shipping a silent hole.
const VOICES = ['f', 'm', 'leda'];

// The prefix of every sectionId, which is what the app can hand to native
// without a lookup table on either side. Not the corpus file names
// ('civil-th'), which nothing outside the render scripts knows about.
export const BOOK_KEYS = ['pp', 'civil_proc', 'cr', 'criminal_proc'];

export const speechTextPath = (book) => `public/data/speech-${book}.json`;

const bookKeyOf = (sectionId) => sectionId.slice(0, sectionId.indexOf('-'));

/** @returns {Record<string, Record<string, string>>} book key -> hash -> text */
export function buildSpeechText() {
  const out = Object.fromEntries(BOOK_KEYS.map((b) => [b, {}]));
  for (const voice of VOICES) {
    for (const p of collectParagraphs(voice)) {
      const book = out[bookKeyOf(p.sectionId)];
      if (book) book[p.hash] = p.text;
    }
  }
  return out;
}

const isMain = process.argv[1] && process.argv[1].endsWith('speechText.mjs');
if (isMain) {
  const built = buildSpeechText();
  for (const [book, map] of Object.entries(built)) {
    const path = speechTextPath(book);
    // No pretty-printing: this is read by a parser, never by a person, and the
    // indentation would be a third of the file.
    writeFileSync(path, JSON.stringify(map));
    console.log(`${path}  ${Object.keys(map).length} paragraphs`);
  }
}
