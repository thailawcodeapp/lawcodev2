// The Android playback queue: the whole remaining playlist handed to native
// once, so advancing from one paragraph to the next never needs JavaScript.
//
// It has to be this way. A device session on 2026-08-12 showed the WebView's
// JavaScript engine stops running about 80 seconds after the app leaves the
// screen, while everything native — the process, the foreground service, the
// player, even the next paragraph's downloaded file — stays healthy and
// waiting. Four earlier builds tried to protect the process instead and none
// of them moved the point playback went quiet. See
// docs/superpowers/specs/2026-08-12-native-playback-queue-design.md §2.
//
// This module is the only place that talks to the plugin's queue API. tts.js
// keeps its public shape and routes here on Android; web and iOS keep the
// loop in tts.js untouched.
import { cachedUri } from './audioCache';
import { audioUrl, DEFAULT_VOICE } from './audioManifest';
import { USE_NATIVE_QUEUE } from '../config';
import { NativeAudio } from '@capgo/native-audio';
import { ensureSession } from './audioPlayer';

// How many entries near the start get a cache lookup before the rest fall
// back to their remote URL. A lookup is a Filesystem.stat round trip and a
// playlist can hold 6,764 paragraphs, so checking all of them would cost
// thousands of round trips to save a first-paragraph download that ExoPlayer's
// own cache usually already covers. Five is enough to start instantly.
const CACHE_CHECK_DEPTH = 5;

export function isNativeQueueAvailable() {
  if (!USE_NATIVE_QUEUE) return false;
  if (typeof window === 'undefined') return false;
  return window.Capacitor?.getPlatform?.() === 'android';
}

// Whether this playlist can be represented as a native queue at all.
//
// Native plays files and nothing else — it has no device-voice path, by
// deliberate choice: every one of the 3,109 sections in the corpus has
// rendered audio, so a unit without a file means the audio feature is off
// rather than that this paragraph is special. A playlist like that belongs to
// the JavaScript loop, whole, rather than half here and half there.
export function canQueue(flat) {
  if (!Array.isArray(flat) || flat.length === 0) return false;
  return flat.every((u) => !!u.audioHash);
}

/**
 * Turn the flattened playlist into the entry list the plugin takes.
 *
 * @param {Array} flat          units from tts.js's flatten()
 * @param {number} startIndex   where playback will begin
 * @param {Function} metadataFor  unit => { title, artist, artworkUrl? }
 * @returns {Promise<Array>}
 */
export async function buildEntries(flat, startIndex, metadataFor) {
  const from = Math.max(0, startIndex);
  const until = from + CACHE_CHECK_DEPTH;

  return Promise.all(
    flat.map(async (unit, i) => {
      const voice = unit.audioVoice ?? DEFAULT_VOICE;
      let url = null;
      if (i >= from && i < until) {
        url = await cachedUri(unit.audioHash, voice).catch(() => null);
      }
      const meta = metadataFor(unit) || {};
      return {
        url: url || audioUrl(unit.audioHash, voice),
        title: meta.title ?? '',
        artist: meta.artist ?? '',
        artworkUrl: meta.artworkUrl ?? '',
        itemIndex: unit.itemIndex,
        paraIndex: unit.paraIndex ?? 0,
      };
    }),
  );
}

// Fire-and-forget: every command here is a best-effort instruction to native,
// and a rejected one (no queue loaded, a race with clearQueue) must never
// propagate into the player's control flow. The queue's real state is read
// back with queueState(), not inferred from whether a command resolved.
const send = (promise) => Promise.resolve(promise).then(() => undefined, () => undefined);

let _handlers = {};
export function setQueueHandlers(handlers) {
  _handlers = handlers || {};
}

// Registered once for the life of the module, not per queue. Re-registering
// while a queue runs would open a window where a genuine advance event has
// nowhere to land — the same hazard the 'complete' listener in audioPlayer.js
// is careful about, for the same reason.
let _listening = false;
function listenOnce() {
  if (_listening) return;
  _listening = true;
  NativeAudio.addListener('queueAdvance', (e) => _handlers.onAdvance?.(e));
  NativeAudio.addListener('queueEnded', () => _handlers.onEnded?.());
  NativeAudio.addListener('queueStalled', (e) => _handlers.onStalled?.(e));
}

const EMPTY_STATE = {
  index: -1, itemIndex: -1, paraIndex: -1,
  playing: false, stalled: false, error: null,
};

/**
 * Hand the whole remaining playlist to native and start playing.
 * Returns false when the playlist cannot be represented natively, which is
 * the caller's signal to run the JavaScript loop instead.
 */
export async function startQueue(flat, startIndex, { repeat = 'off', rate = 1 } = {}, metadataFor) {
  if (!canQueue(flat)) return false;
  listenOnce();
  // The legacy per-clip path always got the lock-screen notification and
  // audio focus for free, because every clip goes through audioPlayer.js's
  // ensureSession() first. The native queue bypasses that module entirely —
  // without this call, NativeAudio never learns showNotification: true, so
  // the plugin's showQueueNotification() and updatePlaybackState() silently
  // no-op for the whole session.
  await ensureSession();
  const entries = await buildEntries(flat, startIndex, metadataFor);
  await send(NativeAudio.setQueue({
    entries,
    startIndex: Math.max(0, startIndex),
    repeat,
    rate,
  }));
  return true;
}

export const skipToQueueIndex = (index) => send(NativeAudio.skipToQueueIndex({ index }));
export const pauseQueue = () => send(NativeAudio.pauseQueue());
export const resumeQueue = () => send(NativeAudio.resumeQueue());
export const clearQueue = () => send(NativeAudio.clearQueue());
export const setQueueRepeat = (repeat) => send(NativeAudio.setQueueRepeat({ repeat }));
export const setQueueRate = (rate) => send(NativeAudio.setQueueRate({ rate }));

// The one question that makes a long background session survivable: JavaScript
// may have missed hundreds of queueAdvance events while frozen, so it does not
// try to remember where playback is — it asks.
export async function queueState() {
  try {
    const s = await NativeAudio.getQueueState();
    return { ...EMPTY_STATE, ...(s || {}) };
  } catch {
    return { ...EMPTY_STATE };
  }
}
