// Where a paragraph's audio lives. The manifests ship inside the app so this
// answers without a network round-trip, which is what lets playback start
// offline from files already cached.
//
// Two voices, two lookups:
//   'f'  the Chirp3 female voice, shipped first — audio/<hash>.mp3
//   'm'  the Gemini male voice     — audio/m/<hash>.mp3
//
// manifest-m holds only the 459 sections whose hashes actually differ, because
// three quarters of the corpus has no "(n)" label to reword and so hashes
// identically for both voices. Everything else falls through to the 'f' entry,
// which is the right answer: same hash, different prefix. 55 KB in the bundle
// instead of 167 KB.
//
// That shared hash is also why the prefix is load-bearing rather than tidy —
// drop it and 5,048 of the male voice's files would collide with the female
// voice's, on R2 and in the on-device cache alike.
import manifest from '../data/audio-manifest.json';
import manifestM from '../data/audio-manifest-m.json';
import { AUDIO_BASE_URL } from '../config';

export const DEFAULT_VOICE = 'm';
export const VOICES = ['f', 'm'];

// What each voice is called on screen. Kept here, next to the codes they
// belong to, so the picker in Settings and the per-voice storage rows cannot
// drift into calling the same voice two different things.
//
// The male voice leads because it reads the statutes' own spacing correctly,
// which is what "อ่านลื่นกว่า" is describing — not a preference. The female
// voice is the one earlier builds shipped, and saying so is for the people who
// already know it and would otherwise wonder where it went.
export const VOICE_LABELS = {
  m: { name: 'เสียงชาย', note: 'อ่านลื่นกว่า' },
  f: { name: 'เสียงหญิง', note: 'เสียงเดิม' },
};

// Presentation order, which is not VOICES' order: that one is alphabetical and
// happens to put the voice nobody is steered towards first. The default voice
// reads first — left, and top of any list — because the first option shown is
// the one a reader treats as the recommendation whatever the labels say.
export const VOICE_ORDER = ['m', 'f'];

const MANIFESTS = { f: manifest, m: manifestM };

export function isAudioEnabled() {
  return typeof AUDIO_BASE_URL === 'string' && AUDIO_BASE_URL.length > 0;
}

export function hashesFor(sectionId, voice = DEFAULT_VOICE) {
  const list = MANIFESTS[voice]?.[sectionId] ?? manifest[sectionId];
  return Array.isArray(list) ? list : null;
}

// paraIndex is the app's own paragraph index: manifest[sectionId][i] is the
// audio for paragraph i, and paragraph 0 already has "มาตรา N " spoken at its
// front — speechUnits() in thaiSpeech.js put it there for both sides.
export function audioHashFor(sectionId, paraIndex, voice = DEFAULT_VOICE) {
  const list = hashesFor(sectionId, voice);
  if (!list) return null;
  if (!Number.isInteger(paraIndex) || paraIndex < 0 || paraIndex >= list.length) return null;
  return list[paraIndex];
}

// The key under which this hash's audio is stored, both on R2 and in the
// device cache. They deliberately use the same string: a file cached under the
// key it was fetched by cannot be served for the other voice by accident.
export function objectPath(hash, voice = DEFAULT_VOICE) {
  return voice === 'f' ? `audio/${hash}.mp3` : `audio/${voice}/${hash}.mp3`;
}

export function audioUrl(hash, voice = DEFAULT_VOICE) {
  if (!isAudioEnabled() || !hash) return null;
  return `${AUDIO_BASE_URL.replace(/\/+$/, '')}/${objectPath(hash, voice)}`;
}
