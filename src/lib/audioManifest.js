// Where a paragraph's audio lives. The manifests ship inside the app so this
// answers without a network round-trip, which is what lets playback start
// offline from files already cached.
//
// Three voices, three lookups:
//   'f'     the Chirp3 female voice, shipped first — audio/<hash>.mp3
//   'm'     the Gemini male voice                  — audio/m/<hash>.mp3
//   'leda'  the Gemini Leda voice, premium default  — audio/leda/<hash>.mp3
//
// manifest-m and manifest-leda each hold only the 459 sections whose hashes
// actually differ, because three quarters of the corpus has no "(n)" label to
// reword and so hashes identically across every short-form voice. Everything
// else falls through to the 'f' entry, which is the right answer: same hash,
// different prefix. 55 KB in the bundle instead of 167 KB, each.
//
// That shared hash is also why the prefix is load-bearing rather than tidy —
// drop it and most of a short-form voice's files would collide with the
// female voice's, on R2 and in the on-device cache alike.
import manifest from '../data/audio-manifest.json';
import manifestM from '../data/audio-manifest-m.json';
import manifestLeda from '../data/audio-manifest-leda.json';
import { AUDIO_BASE_URL } from '../config';

export const DEFAULT_VOICE = 'leda';
export const VOICES = ['f', 'm', 'leda'];

// What each voice is called on screen. Kept here, next to the codes they
// belong to, so the picker in Settings and the per-voice storage rows cannot
// drift into calling the same voice two different things.
//
// Named after the placeholder characters Thai legal exams have always used
// ("อำแดงป้อม" and "นายบุญศรี" ทำสัญญาซื้อขายที่ดินกัน) rather than described by
// what they sound like — with three voices, "เสียงหญิง" alone no longer says
// which one, and this app's audience already reads that naming everywhere
// else. "พรีเมียม"/"เดิม" in the note is what actually carries the
// distinction now.
// The note drops the "เสียง" prefix it used to carry: at three columns the
// longer form wrapped to a third line on one card and not the others, which
// left the row visibly ragged. "หญิง พรีเมียม" says the same thing in the
// space available and keeps every card two lines tall.
export const VOICE_LABELS = {
  leda: { name: 'อำแดงป้อม', note: 'หญิง พรีเมียม' },
  m: { name: 'นายบุญศรี', note: 'ชาย พรีเมียม' },
  f: { name: 'นางทองดี', note: 'หญิง เดิม' },
};

// Presentation order, which is not VOICES' order: that one is alphabetical and
// happens to put the voice nobody is steered towards first. The default voice
// reads first — left, and top of any list — because the first option shown is
// the one a reader treats as the recommendation whatever the labels say.
export const VOICE_ORDER = ['leda', 'm', 'f'];

const MANIFESTS = { f: manifest, m: manifestM, leda: manifestLeda };

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
