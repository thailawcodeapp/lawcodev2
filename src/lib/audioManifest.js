// Where a paragraph's audio lives. The manifest ships inside the app (168 KB)
// so this answers without a network round-trip, which is what lets playback
// start offline from files already cached.
import manifest from '../data/audio-manifest.json';
import { AUDIO_BASE_URL } from '../config';

export function isAudioEnabled() {
  return typeof AUDIO_BASE_URL === 'string' && AUDIO_BASE_URL.length > 0;
}

export function hashesFor(sectionId) {
  const list = manifest[sectionId];
  return Array.isArray(list) ? list : null;
}

// paraIndex is the app's own paragraph index: manifest[sectionId][i] is the
// audio for paragraph i, and paragraph 0 already has "มาตรา N " spoken at its
// front — speechUnits() in thaiSpeech.js put it there for both sides.
export function audioHashFor(sectionId, paraIndex) {
  const list = hashesFor(sectionId);
  if (!list) return null;
  if (!Number.isInteger(paraIndex) || paraIndex < 0 || paraIndex >= list.length) return null;
  return list[paraIndex];
}

export function audioUrl(hash) {
  if (!isAudioEnabled() || !hash) return null;
  return `${AUDIO_BASE_URL.replace(/\/+$/, '')}/audio/${hash}.mp3`;
}
