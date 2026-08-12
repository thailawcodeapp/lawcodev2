// TTS engine — playlist of sections.
// Native Android: @capacitor-community/text-to-speech
// Browser/web: Web Speech API fallback
//
// v10 pause/resume fix:
//   Native: pause() stops speech + saves _pausePos, then bumps _gen to kill
//           the old loop. resume() starts a fresh loop from _pausePos.
//   Web:    pause() calls speechSynthesis.pause() (freezes in-flight utterance).
//           resume() calls speechSynthesis.resume() (continues it).
//           No gen bump needed — the promise stays alive while frozen.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { speechUnits } from './thaiSpeech';
import { isAudioEnabled, audioHashFor, DEFAULT_VOICE } from './audioManifest';
import { AUDIO_BASE_URL } from '../config';
import { ensure, removeCached } from './audioCache';
import { recordAudioIssue, markAlive, markTimerAlive } from './audioLog';
import { playFile, stopAudio, pauseAudio, resumeAudio, isAudioActive, preloadFile, setRemoteHandlers } from './audioPlayer';
import {
  isNativeQueueAvailable, startQueue, skipToQueueIndex, pauseQueue, resumeQueue,
  clearQueue, setQueueRepeat as nativeSetRepeat, setQueueRate as nativeSetRate,
  queueState, setQueueHandlers,
} from './nativeQueue';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const platform = () =>
  typeof window !== 'undefined' ? (window.Capacitor?.getPlatform?.() ?? 'web') : 'web';

// ─── State ───────────────────────────────────────────────────────────────────
let _items = [];
let _flat  = [];
let _pos   = -1;
let _gen   = 0;       // bumped on every destructive control action
let _playing = false;
let _paused  = false;
let _pausePos = 0;   // flat-array position to resume from (native only)
let _curItemIndex = -1;
// Which engine the listener is actually hearing: 'audio' for a rendered file,
// 'device' for the on-device voice. Set after the decision is made, not
// before, because a file that fails to decode still ends as 'device'.
let _voiceKind = null;

// Which pre-rendered voice the listener chose: 'm' (Gemini male, the default)
// or 'f' (the Chirp3 female voice that shipped first). It selects both the
// hash to fetch AND the wording spoken, because the two differ — the male
// voice says "อนุ 1" where the female says "อนุมาตรา 1" — and the device-voice
// fallback has to say the same thing the file would have.
let _audioVoice = DEFAULT_VOICE;
export function setAudioVoice(voice) {
  _audioVoice = voice === 'f' ? 'f' : 'm';
  if (!_nativeQueue) return;

  // Rebuild every section that still knows its paragraphs, then hand the
  // whole queue over again from wherever playback had reached. Position is
  // recovered by section and paragraph rather than by index: the rebuild is
  // what changes the list, so an index taken before it cannot be trusted
  // after it.
  const here = _flat[_pos];
  _items = _items.map((it) => (it.paragraphs ? buildSectionItem(it) : it));
  _flat = flatten(_items);
  const at = here
    ? _flat.findIndex((f) => f.itemIndex === here.itemIndex && f.paraIndex === here.paraIndex)
    : -1;

  const myGen = ++_gen;
  startQueue(_flat, at < 0 ? 0 : at, { repeat: _repeat, rate: _rate }, nowPlayingFor)
    .then((accepted) => { if (myGen === _gen) _nativeQueue = accepted; });
}
export function currentAudioVoice() { return _audioVoice; }

// Repeat mode.
//
//   'off'     stop at the end of the playlist, which is what it has always done
//   'section' replay the section now playing, forever
//   'all'     replay the whole playlist from the top
//
// Read by runLoop when a unit finishes rather than captured when the loop
// starts, so changing it mid-listen takes effect at the next boundary instead
// of requiring playback to be restarted.
// What the lock screen and notification shade show for the clip now playing.
// The section, not the paragraph, is the thing a listener recognises — the
// paragraph number is only useful as a position within it.
//
// Served from the same bucket as the audio, not from the app's own bundle.
// Both platforms' plugins take an artworkUrl, decide it is remote because the
// scheme is neither absent nor "file", and then fetch it with a plain
// URLSession / URL.openConnection from native code — which cannot see the
// WebView's origin at all. capacitor://localhost/now-playing.png and
// http://localhost/now-playing.png both fail there, silently, which is why the
// first build shipped with no cover art on either platform.
function artworkUrl() {
  if (!isAudioEnabled()) return undefined;
  return `${AUDIO_BASE_URL.replace(/\/+$/, '')}/now-playing.png`;
}

function nowPlayingFor(unit) {
  const item = _items[unit?.itemIndex];
  if (!item) return undefined;
  const total = item.chunks?.length ?? 0;
  // Section title leads, paragraph position follows. The reverse was tried and
  // read badly: the position is only meaningful once you know which section it
  // is a position in, so it cannot come first even though it is the part that
  // changes as you listen.
  const where = total > 1 ? `ย่อหน้า ${(unit.paraIndex ?? 0) + 1}/${total}` : '';
  const art = artworkUrl();
  return {
    title: item.label || `มาตรา ${item.number}`,
    artist: [item.title || '', where].filter(Boolean).join(' · '),
    ...(art ? { artworkUrl: art } : {}),
  };
}

export const REPEAT_MODES = ['off', 'section', 'all'];
let _repeat = 'off';
export function setRepeat(mode) {
  _repeat = REPEAT_MODES.includes(mode) ? mode : 'off';
  if (_nativeQueue) nativeSetRepeat(_repeat);
  notify();
}
export function currentRepeat() { return _repeat; }
// A Settings/home preview is playing, and which kind: 'audio' | 'device' |
// null. Kept apart from the playlist entirely — a sample never touches quota,
// never moves _pos, and a second press on its button stops it. Tracked so the
// button can flip to a stop icon and so doStop() can clear a stale one.
let _sampleKind = null;
// Latched at pause() time — which branch resume() must take. isAudioActive()
// is a moving target: a paragraph can still be inside `await ensure(...)` when
// pause() runs (no clip registered yet → false) and become active by the time
// resume() runs, because ensure() resolved and playFile() started in between.
// Sampling isAudioActive() again in resume() would then take the "clip is
// held" branch for a clip that was never paused — resumeAudio() on a live
// clip is a no-op, no loop is restarted, and playback silently dies once that
// clip ends. Deciding once, at pause, and having resume() act on the decision
// closes that window.
let _pausedAudio = false;

// True once the playlist has actually been handed to native. Not the same
// question as isNativeQueueAvailable(): a playlist native cannot represent
// (audio switched off, so no unit has a file) falls back to the loop even on
// Android, and every control below has to follow it there.
let _nativeQueue = false;

// Where the queue really is. JavaScript stops running roughly 80 seconds
// after the app is backgrounded, so by the time anyone looks at this module
// again it may have missed hundreds of advances — _pos and _curItemIndex are
// whatever they were when the freeze began. Asking native and overwriting
// both is the only way back to the truth, and it costs one call.
async function resyncFromNative() {
  if (!_nativeQueue) return;
  const s = await queueState();
  if (s.index < 0) return;
  _pos = s.index;
  if (s.itemIndex !== _curItemIndex) {
    _curItemIndex = s.itemIndex;
    _onItemStart?.(_items[s.itemIndex]);
  }
  _playing = s.playing || s.stalled;
  _paused = !s.playing && !s.stalled;
  _onChange?.(s.itemIndex, 0, s.paraIndex);
  notify();
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resyncFromNative();
  });
}

// Progress reported while JavaScript happens to be awake. Never load-bearing:
// correctness comes from resyncFromNative() above, and these only spare the UI
// from waiting for the next time the app is looked at.
setQueueHandlers({
  onAdvance: ({ index, itemIndex, paraIndex }) => {
    if (!_nativeQueue) return;
    _pos = index;
    if (itemIndex !== _curItemIndex) {
      _curItemIndex = itemIndex;
      _onItemStart?.(_items[itemIndex]);
    }
    _onChange?.(itemIndex, 0, paraIndex);
  },
  onEnded: () => { if (_nativeQueue) { _nativeQueue = false; finish(); } },
  onStalled: ({ index, error }) => {
    if (!_nativeQueue) return;
    recordAudioIssue({
      phase: 'queueStalled',
      sectionId: _items[_flat[index]?.itemIndex]?.sectionId,
      paraIndex: _flat[index]?.paraIndex,
      error: error || 'unknown',
    });
    notify();
  },
});

let _rate  = 1.0;
let _pitch = 1.0;
let _voice = null;

let _onChange    = null;
let _onItemStart = null;
let _onState     = null;
let _onFinish    = null;

let _keepAlive       = null;
let _currentUtterance = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const notify = () => _onState?.();

// The badge only ever has something to say when the feature is on. With
// AUDIO_BASE_URL empty no unit can be an audio unit, so a 'device' label would
// be a permanent caption on the only voice there is — and, because units are
// then 180-character chunks, notifying per unit re-renders the whole TtsContext
// provider several times a paragraph for a value that never changes. Off: stay
// null and say nothing. On: report, but only when the answer actually moved.
function setVoiceKind(kind) {
  if (!isAudioEnabled()) return;
  if (_voiceKind === kind) return;
  _voiceKind = kind;
  notify();
}

// normalizeForSpeech turns a section number like "1246/2" into the three
// space-separated tokens "1246 ทับ 2" so it reads correctly — but that also
// makes it a candidate cut point for the paragraph splitter below. A cut
// landing inside that span stops mid-number with sentence-final intonation
// on a bare "ทับ N" or a numeral with no explanation for the pause. Guard
// against it by nudging the cut to the start of the whole "N ทับ M" span
// (pushing it into the next chunk whole) whenever a candidate cut would land
// inside one.
const THAB_SPAN_RE = /\S+ ทับ \S+/g;

function guardCut(rest, cut) {
  THAB_SPAN_RE.lastIndex = 0;
  let m;
  while ((m = THAB_SPAN_RE.exec(rest))) {
    const start = m.index;
    const end = start + m[0].length;
    if (cut > start && cut < end) {
      // Move the whole span to the next chunk; if it's already at the very
      // start of `rest` (nothing to push it after), keep it in this chunk
      // instead so we never emit a zero-length chunk.
      return start > 0 ? start : end;
    }
  }
  return cut;
}

function splitLong(text, max = 180) {
  const out = [];
  let rest = (text || '').trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    const stop = Math.max(
      rest.lastIndexOf('।', max),
      rest.lastIndexOf('. ', max),
      rest.lastIndexOf('ๆ', max),
    );
    if (stop > max * 0.5) cut = stop + 1;
    if (cut <= 0) cut = max;
    cut = guardCut(rest, cut);
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// `label` and `number` stay as written — they are rendered in the player.
// Only the chunk text, which exists solely to be spoken, is normalized.
//
// A paragraph with audio is one unit no matter how long it is: the file holds
// the whole paragraph, and splitting it would only invent seams the recording
// does not have. Without audio the 180-character rule still applies, because
// that rule exists for the speech engine, not for files.
export function buildSectionItem({ sectionId, bookId, number, title, paragraphs }) {
  const chunks = [];
  // The voice is captured onto each chunk rather than read from module state
  // at speak time, so a setting changed mid-section cannot have this item's
  // text ("อนุ 1") played against the other voice's file ("อนุมาตรา 1").
  const audioVoice = _audioVoice;
  speechUnits(number, paragraphs, audioVoice).forEach((unit, paraIndex) => {
    const audioHash = isAudioEnabled() ? audioHashFor(sectionId, paraIndex, audioVoice) : null;
    if (audioHash) {
      chunks.push({ text: unit, paraIndex, audioHash, audioVoice });
      return;
    }
    for (const c of splitLong(unit)) chunks.push({ text: c, paraIndex, audioHash: null, audioVoice });
  });
  // `paragraphs` is kept, not just the chunks built from it, so a section that
  // has not started yet can be rebuilt in a voice chosen after the queue was
  // made — see rebuildItemForVoice. It is the text already in memory, so this
  // costs nothing but a reference.
  return {
    sectionId, bookId, number, title: title || '',
    label: `มาตรา ${number}`, chunks, paragraphs,
  };
}

// A voice changed mid-playlist has to reach the sections that have not played
// yet, or choosing a voice while a queue runs appears to do nothing until the
// queue is restarted — which is how it behaved when the voice was captured
// once per item and never revisited.
//
// The section now playing is deliberately left alone: its text and its files
// are two halves of one choice ("อนุ 1" against "อนุมาตรา 1"), so swapping
// either underneath a clip that is already playing would say one and fetch the
// other. Rebuilding at the boundary gets both.
//
// Returns true when it rebuilt, so callers that hold a unit know to re-read it.
function rebuildItemForVoice(unit) {
  const item = _items[unit?.itemIndex];
  const built = item?.chunks?.[0]?.audioVoice ?? DEFAULT_VOICE;
  if (!item || built === _audioVoice || unit.chunkIndex !== 0) return false;
  if (!item.paragraphs) return false;   // built by an older caller; nothing to rebuild from

  _items[unit.itemIndex] = buildSectionItem(item);
  _flat = flatten(_items);
  return true;
}

function flatten(items) {
  const flat = [];
  items.forEach((it, itemIndex) => {
    it.chunks.forEach((c, chunkIndex) =>
      flat.push({
        itemIndex,
        chunkIndex,
        text: c.text,
        paraIndex: c.paraIndex,
        audioHash: c.audioHash ?? null,
        audioVoice: c.audioVoice ?? DEFAULT_VOICE,
      }));
  });
  return flat;
}

// ─── iOS voice quality auto-pick ─────────────────────────────────────────────
// iOS ships the Thai voice (Kanya) in three qualities: compact (default,
// robotic), enhanced, and premium. AVSpeechSynthesizer falls back to compact
// unless a specific voice is requested, which is why iOS sounds worse than
// Android's Google TTS out of the box. When the user hasn't picked a voice,
// prefer the best-quality Thai voice installed on the device.
// Android is untouched: this resolver returns null there and the engine
// default (Google TTS) is used, same as before.
//
// The result is cached because getSupportedVoices() is a native round-trip on
// every chunk, but the cache must be droppable: users download the Enhanced
// voice from iOS Settings *while the app is backgrounded*, and the WebView
// survives that trip. A cache with no way out meant they kept hearing the
// compact voice until they force-quit.
//
// Two independent caches share that guarantee: this one for the auto-pick
// path, and _voiceIndexPromise below for users who explicitly chose a voice.
// Both are cleared by clearVoiceCache(), and setVoice() also clears the
// index cache since a newly chosen id invalidates any lookup already in
// flight for the previous one.
let _iosVoicePromise = null;

// id→index lookup for an explicitly-chosen voice (resolveVoiceIndex below).
// Without this, resolveVoiceIndex() called getSupportedVoices() on every
// chunk — a 10k-section corpus produces 10k+ chunks, so users who picked a
// voice paid a native round-trip per chunk while auto-pick users got the
// cache above for free.
let _voiceIndexPromise = null;
let _voiceIndexFor = null; // the _voice id the cached promise resolved for

export function clearVoiceCache() {
  _iosVoicePromise = null;
  _voiceIndexPromise = null;
  _voiceIndexFor = null;
}

function resolveIosBestVoice() {
  if (_iosVoicePromise) return _iosVoicePromise;
  _iosVoicePromise = (async () => {
    try {
      const r = await TextToSpeech.getSupportedVoices();
      const th = (r.voices || [])
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v.lang === 'th-TH' || v.lang?.startsWith('th'));
      if (!th.length) return null;
      // voiceURI examples: com.apple.voice.premium.th-TH.Kanya,
      // com.apple.voice.enhanced.th-TH.Kanya, com.apple.ttsbundle.Kanya-compact
      const rank = ({ v }) => {
        const u = `${v.voiceURI || ''} ${v.name || ''}`.toLowerCase();
        if (u.includes('premium')) return 0;
        if (u.includes('enhanced')) return 1;
        return 2;
      };
      th.sort((a, b) => rank(a) - rank(b));
      return th[0].i;
    } catch {
      return null;
    }
  })();
  return _iosVoicePromise;
}

// The plugin's speak() takes a position in the system voice list, but that
// position moves whenever a voice is installed or removed. Persist the stable
// id and look up its current position each time we speak.
//
// The id must be derived the same way getVoices() derives it, or the lookup
// misses on Android, where the plugin may not report a voiceURI at all.
async function resolveVoiceIndex() {
  if (_voice) {
    if (_voiceIndexPromise && _voiceIndexFor === _voice) return _voiceIndexPromise;
    _voiceIndexFor = _voice;
    _voiceIndexPromise = (async () => {
      try {
        const r = await TextToSpeech.getSupportedVoices();
        const i = (r.voices || []).findIndex((v, n) => (v.voiceURI || String(n)) === _voice);
        return i >= 0 ? i : null;
      } catch {
        return null;
      }
    })();
    const i = await _voiceIndexPromise;
    if (i != null) return i;
    // Chosen voice is gone — fall through rather than speak in whichever
    // language now occupies that slot.
  }
  if (platform() === 'ios') return resolveIosBestVoice();
  return null; // Android: let the engine default (Google TTS) decide
}

// ─── Low-level speak ─────────────────────────────────────────────────────────
function speakOne(text) {
  return new Promise((resolve, reject) => {
    if (isNative()) {
      const opts = { text, lang: 'th-TH', rate: _rate, pitch: _pitch, category: 'playback' };
      resolveVoiceIndex()
        .then((idx) => {
          if (idx != null) opts.voice = idx;
          return TextToSpeech.speak(opts);
        })
        .then(resolve)
        .catch(() => reject(new Error('canceled')));
    } else {
      const u = new SpeechSynthesisUtterance(text);
      u.lang   = 'th-TH';
      u.rate   = _rate;
      u.pitch  = _pitch;
      const v = pickWebVoice();
      if (v) u.voice = v;
      u.onend  = () => { _currentUtterance = null; resolve(); };
      u.onerror = (e) => {
        _currentUtterance = null;
        (e.error === 'canceled' || e.error === 'interrupted')
          ? reject(new Error('canceled'))
          : resolve();
      };
      _currentUtterance = u;
      speechSynthesis.speak(u);
    }
  });
}

// One playable unit: a pre-rendered file if there is one, the device voice if
// there is not. Spec §7.7 — cached file, then download, then the voice, so
// there is no path that ends in silence.
//
// The one rejection that must NOT fall back is 'canceled': that is the user
// pressing stop, and answering it by starting the device voice on the same
// paragraph would be the opposite of what they asked for.
// `isCurrent` is how this function asks whether the unit it was handed is
// still the one the listener is waiting for. `await ensure(...)` can run for
// seconds on a cold download, and stop / pause / next / previous all land
// inside that window; the loop's generation counter is loop-private, so
// runLoop passes a predicate closed over its own `myGen`. Direct callers may
// omit it, in which case the unit is treated as current throughout.
//
// `onStarted` fires once, at the moment this unit has actually claimed the
// player (or the device voice). runLoop uses it to warm the unit after next —
// see the prefetch comment there.
// Which paragraph a unit is, in the terms someone reading the log would use.
// The unit itself only knows its index into _items, and "itemIndex 4" is not
// something anyone can look up.
function whereIs(unit) {
  return {
    sectionId: _items[unit?.itemIndex]?.sectionId,
    paraIndex: unit?.paraIndex,
  };
}

export async function speakUnit(unit, isCurrent, onStarted) {
  const { text, audioHash, audioVoice = DEFAULT_VOICE } = unit;
  const stale = () => typeof isCurrent === 'function' && !isCurrent();
  let started = false;
  const start = () => { if (!started) { started = true; onStarted?.(); } };

  // Gating on isAudioEnabled() already happened once, in buildSectionItem —
  // a unit only carries a non-null audioHash when the feature was on at build
  // time. Re-checking isAudioEnabled() here would require it to still be true
  // at speak time too, which breaks nothing today (AUDIO_BASE_URL is '' and no
  // unit ever gets a real hash) but is redundant with the upstream gate and
  // couples this function to a global it does not need.
  if (audioHash) {
    let uri = null;
    try {
      uri = await ensure(audioHash, audioVoice);
    } catch {
      uri = null;
    }
    // A control was pressed while the download ran. Starting the clip now
    // would play a paragraph the user stopped, paused, or skipped past, and
    // falling back to the device voice would do the same thing in the other
    // voice. Behave exactly as a cancellation instead — that is the one
    // unwind path the loop already knows how to take.
    if (stale()) throw new Error('canceled');
    if (uri) {
      try {
        // playFile() adopts a preload held for this uri synchronously, before
        // it returns its promise, so this is the earliest point at which the
        // asset warmed for this unit can no longer be stolen from it.
        const playing = playFile(uri, { rate: _rate, metadata: nowPlayingFor(unit) });
        start();
        await playing;
        setVoiceKind('audio');
        return;
      } catch (err) {
        if (err?.message === 'canceled') throw err;
        // Anything else — a corrupt file, a decoder error — is worth the
        // fallback rather than a gap. Drop the file on the way past:
        // cachedUri() only checks that the size is non-zero, so a truncated
        // or undecodable file would be handed back on every future replay and
        // this paragraph would read in the device voice for the life of the
        // install. Deleting it lets the next attempt re-download.
        recordAudioIssue({
          phase: 'play', hash: audioHash, voice: audioVoice,
          ...whereIs(unit), error: err?.message || String(err),
        });
        removeCached(audioHash, audioVoice).catch(() => {});
      }
    }

    // Reached only by falling through the whole chain, which is the event
    // anybody actually notices: the voice changed. ensure() has already
    // recorded WHY if the download is what failed; this records WHICH
    // paragraph, which is the half a listener can report back.
    recordAudioIssue({ phase: 'fallback', hash: audioHash, voice: audioVoice, ...whereIs(unit) });
  }

  setVoiceKind('device');
  start();
  // The 180-character rule belongs to the engine, so it is applied here rather
  // than in buildSectionItem, where an audio unit must stay whole.
  for (const piece of splitLong(text)) {
    await speakOne(piece);
  }
}

function pickWebVoice() {
  const vs = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : [];
  if (!vs.length) return null;
  if (_voice) { const f = vs.find(v => v.voiceURI === _voice); if (f) return f; }
  return vs.find(v => v.lang === 'th-TH') || vs.find(v => v.lang?.startsWith('th')) || null;
}

function hardCancel() {
  // Both engines, unconditionally. Tracking which one is live and cancelling
  // only that one leaves the other running whenever the two disagree, and the
  // stop button has to be right every time.
  stopAudio();
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
  } else if (typeof speechSynthesis !== 'undefined') {
    _currentUtterance = null;
    speechSynthesis.cancel();
  }
}

function startKeepAlive() {
  stopKeepAlive();
  if (isNative()) return;
  _keepAlive = setInterval(() => {
    if (_playing && !_paused &&
        typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 9000);
}
function stopKeepAlive() {
  if (_keepAlive) { clearInterval(_keepAlive); _keepAlive = null; }
}

// A second, independent pulse — see audioLog.js's markTimerAlive for why one
// pulse per paragraph (below, in runLoop) cannot tell "the JS engine itself
// stopped" apart from "the loop is stuck awaiting a promise that never
// settles": both look identical from a per-paragraph heartbeat, and a device
// test found the failure lands at a fixed ~60 seconds after leaving the app
// regardless of how many paragraphs that covers — a wall-clock signature the
// per-paragraph pulse cannot see at all. A plain timer, owing nothing to the
// loop, is the only thing that can.
//
// Native-only: this exists to investigate a native-platform failure, and
// running it on web would just be a pointless localStorage write every five
// seconds for a build where the question does not apply.
let _timerHeartbeat = null;
function startTimerHeartbeat() {
  stopTimerHeartbeat();
  if (!isNative()) return;
  markTimerAlive(); // an immediate pulse at t=0, not just the first one 5s in
  _timerHeartbeat = setInterval(markTimerAlive, 5000);
}
function stopTimerHeartbeat() {
  if (_timerHeartbeat) { clearInterval(_timerHeartbeat); _timerHeartbeat = null; }
}

// How many paragraphs ahead of the one playing are fetched to disk.
//
// It was one, which meant one paragraph of buffer: a single download that
// failed dropped that paragraph to the device voice, because speakUnit treats
// "no file" as an ordinary outcome and speaks instead. In the foreground a
// download rarely fails and one was enough. Backgrounded it is not — Android
// puts an app with no foreground service under Doze, which defers its network
// access, and a listener with the screen off heard the voice change under them
// without ever losing signal.
//
// Three deepens the buffer to roughly three paragraphs of playback, which
// covers a Doze window rather than being cut by it. It does not FIX the
// underlying restriction — that needs a real foreground service on Android —
// but it stops the usual case from being audible.
//
// Not larger: every fetch is a file written to Directory.Cache, and reading
// far ahead of where someone is actually listening spends their storage and
// their data on paragraphs they may skip past.
const PREFETCH_DEPTH = 3;

// ─── Main loop ───────────────────────────────────────────────────────────────
//
// Web loop: never calls hardCancel on pause — relies on speechSynthesis.pause()
//   to freeze the in-flight promise. When speechSynthesis.resume() is called,
//   the promise resolves normally and the loop advances.
//
// Native loop: pause() bumps _gen, so the old loop exits immediately via the
//   gen-check. resume() starts a fresh loop from _pausePos.
function runLoop(startPos, myGen) {
  (async () => {
    let p = startPos;
    while (p < _flat.length) {
      if (myGen !== _gen) return;  // generation changed → bail out

      _pos = p;
      // Rebuilt before it is read, not after: a section about to start in a
      // voice the listener has since changed away from is rebuilt here, at
      // the only point where doing so is safe. Every unit before p belongs to
      // an item that already played and keeps its chunk count, so p still
      // names the first unit of this item after the rebuild; only counts at
      // or after p can move, and those have not been visited.
      rebuildItemForVoice(_flat[p]);
      const unit = _flat[p];

      // Notify item change
      if (unit.chunkIndex === 0 && unit.itemIndex !== _curItemIndex) {
        _curItemIndex = unit.itemIndex;
        if (_onItemStart && _onItemStart(_items[unit.itemIndex]) === false) {
          doStop();
          return;
        }
      }
      _onChange?.(unit.itemIndex, unit.chunkIndex, unit.paraIndex);
      // A pulse from the loop itself — see audioLog.js. Cheap enough to do
      // unconditionally once per paragraph: this is what proves, next time
      // playback goes silent with the screen off, whether JavaScript was
      // still running right up to that moment or had already stopped.
      markAlive({ sectionId: _items[unit.itemIndex]?.sectionId, paraIndex: unit.paraIndex });

      // Warm the next unit, but only once THIS one has claimed the player.
      // The player holds at most one warm asset, so a preload issued for
      // p + 2 before unit p + 1 has adopted its own would unload the very
      // asset it was about to play — the download half of the prefetch still
      // paid off, the player-warming half delivered nothing, and on an
      // already-cached playlist (offline replay, the case this feature exists
      // for) that was the usual outcome. Handing it to speakUnit as the
      // "started" callback fires it after playFile() has taken ownership.
      //
      // Still deliberately not awaited: a download that stalls must not delay
      // a clip that is already ready, and every failure here is a normal
      // outcome the fallback chain covers.
      //
      // The unit after next, and the one after that, are DOWNLOADED but not
      // handed to the player — see PREFETCH_DEPTH. Only p + 1 gets warmed,
      // because the player holds one asset and warming p + 2 would take that
      // asset away from p + 1 again.
      const upcoming = _flat[p + 1];
      const warmNext = () => {
        if (myGen !== _gen) return;
        if (upcoming?.audioHash) {
          ensure(upcoming.audioHash, upcoming.audioVoice ?? DEFAULT_VOICE)
            .then((uri) => { if (uri && myGen === _gen) preloadFile(uri, nowPlayingFor(upcoming)); })
            .catch(() => {});
        }
        for (let ahead = 2; ahead <= PREFETCH_DEPTH; ahead++) {
          const later = _flat[p + ahead];
          if (later?.audioHash) {
            ensure(later.audioHash, later.audioVoice ?? DEFAULT_VOICE).catch(() => {});
          }
        }
      };

      try {
        await speakUnit(unit, () => myGen === _gen, warmNext);
      } catch {
        // canceled — for web this means the utterance was interrupted;
        // for native this branch is unreachable (gen already bumped → returned above).
        return;
      }

      if (myGen !== _gen) return;

      // Section repeat is decided at the section's last chunk, not at the
      // playlist's end, so it works the same whether the section sits in the
      // middle of a queue or on its own.
      const following = _flat[p + 1];
      if (_repeat === 'section' && (!following || following.itemIndex !== unit.itemIndex)) {
        const back = _flat.findIndex((f) => f.itemIndex === unit.itemIndex);
        if (back >= 0) { p = back; continue; }
      }
      p++;
    }
    if (myGen !== _gen) return;

    if (_repeat === 'all' && _flat.length) {
      // Cleared so the first section announces itself again on the new pass —
      // runLoop only fires _onItemStart when the item index actually changes,
      // and without this a one-section playlist would announce once ever.
      _curItemIndex = -1;
      runLoop(0, myGen);
      return;
    }
    finish();
  })();
}

function finish() {
  _playing = false;
  _paused  = false;
  _pos     = -1;
  _curItemIndex = -1;
  // The last clip is deliberately left loaded when it ends — audioPlayer holds
  // it so the lock-screen card never goes owner-less between paragraphs. At
  // the end of the queue there is no next paragraph to take it over, so this
  // is the one place that has to say so; without it the card would sit on the
  // lock screen showing a section that finished playing minutes ago.
  stopAudio();
  stopKeepAlive();
  stopTimerHeartbeat();
  _onChange?.(-1, -1, -1);
  _onFinish?.();
  notify();
}

function doStop() {
  if (_nativeQueue) { _nativeQueue = false; clearQueue(); }
  _gen++;
  _playing = false;
  _paused  = false;
  _pausedAudio = false;
  _pos     = -1;
  _curItemIndex = -1;
  _voiceKind = null;
  // hardCancel() below stops whatever a sample was playing, so its flag would
  // otherwise be left set with nothing behind it.
  _sampleKind = null;
  stopKeepAlive();
  stopTimerHeartbeat();
  hardCancel();
  _onChange?.(-1, -1, -1);
  notify();
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function isTtsAvailable() {
  if (isNative()) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function setHooks({ onChange, onItemStart, onState, onFinish }) {
  if (onChange    !== undefined) _onChange    = onChange;
  if (onItemStart !== undefined) _onItemStart = onItemStart;
  if (onState     !== undefined) _onState     = onState;
  if (onFinish    !== undefined) _onFinish    = onFinish;
}

export function setRate(r)  {
  _rate = Math.max(0.5, Math.min(2.0, r));
  if (_nativeQueue) nativeSetRate(_rate);
}
export function setPitch(p) { _pitch = Math.max(0.5, Math.min(2.0, p)); }
// Older builds persisted the plugin's array index here. That index is not
// stable across voice installs, so an old value cannot be translated into a
// voiceURI after the fact — drop it and fall back to auto-pick.
export function setVoice(v) {
  _voice = typeof v === 'string' && v !== '' ? v : null;
}
export function getRate()   { return _rate;  }
export function getPitch()  { return _pitch; }
export function getVoice()  { return _voice; }

export function currentVoiceKind()   { return _voiceKind; }

export function isSpeaking()         { return _playing; }
export function isPaused()           { return _paused;  }
export function currentItemIndex()   { return _curItemIndex; }
export function currentItem()        { return _items[_curItemIndex] || null; }
export function itemCount()          { return _items.length; }
export function getItems()           { return _items.slice(); }

export async function getVoices() {
  try {
    if (isNative()) {
      const r = await TextToSpeech.getSupportedVoices();
      const all = (r.voices || []).map((v, i) => {
        let name = v.name || v.voiceURI || `เสียง ${i + 1}`;
        // iOS lists the same voice (e.g. "Kanya") in several qualities with
        // identical names — tag them so users can tell which one sounds best.
        const uri = (v.voiceURI || '').toLowerCase();
        if (uri.includes('premium')) name += ' (พรีเมียม)';
        else if (uri.includes('enhanced')) name += ' (คุณภาพสูง)';
        else if (uri.includes('compact')) name += ' (มาตรฐาน)';
        const lang = v.lang || '';
        const isThai = lang === 'th-TH' || lang.startsWith('th');
        // voiceURI is AVSpeechSynthesisVoice.identifier — stable across
        // installs, unlike the array position the plugin's speak() wants.
        return { id: v.voiceURI || String(i), name, lang, isThai };
      });
      // Thai voices only, both platforms. Note: Siri voices can NOT be
      // offered — Apple does not expose them to third-party apps through
      // AVSpeechSynthesizer; only the "Spoken Content" voices (Kanya in
      // compact/enhanced/premium) are available. Showing every installed
      // voice (previous version) just flooded the list with foreign
      // languages and still contained no Siri voices.
      return all.filter(v => v.isThai).map(({ isThai, ...v }) => v);
    }
    return (speechSynthesis.getVoices() || [])
      .filter(v => v.lang === 'th-TH' || v.lang?.startsWith('th'))
      .map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
  } catch { return []; }
}

export function playItems(items, startItemIndex = 0) {
  doStop();
  _items = items;
  _flat  = flatten(items);
  if (!_flat.length) return;
  const startPos = _flat.findIndex(f => f.itemIndex === startItemIndex && f.chunkIndex === 0);
  const from = startPos < 0 ? 0 : startPos;
  _gen++;
  const myGen = _gen;
  _playing = true;
  _paused  = false;
  _pausedAudio = false;
  _curItemIndex = -1;

  if (isNativeQueueAvailable()) {
    // Native owns the advance from here. The keep-alive and the heartbeats
    // belong to the JavaScript loop and would only measure a thread that is
    // no longer driving anything.
    startQueue(_flat, from, { repeat: _repeat, rate: _rate }, nowPlayingFor)
      .then((accepted) => {
        if (myGen !== _gen) return;
        _nativeQueue = accepted;
        if (!accepted) {
          startKeepAlive();
          startTimerHeartbeat();
          runLoop(from, myGen);
        }
        notify();
      });
    notify();
    return;
  }

  startKeepAlive();
  startTimerHeartbeat();
  notify();
  runLoop(from, myGen);
}

// ─── Pause / Resume (v10 fix) ────────────────────────────────────────────────
export function pause() {
  if (!_playing || _paused) return;
  if (_nativeQueue) { _paused = true; pauseQueue(); notify(); return; }
  _paused   = true;
  _pausePos = _pos;   // remember where we are

  // An audio clip can be held where it is, so hold it: the native TTS path
  // has no real pause and rebuilds from _pausePos, which for a paragraph-sized
  // unit would mean replaying up to two minutes.
  //
  // Decide once, here, and latch it. resume() must act on this decision
  // rather than sampling isAudioActive() again — by the time resume() runs,
  // an in-flight ensure()/playFile() that hadn't registered a clip yet at
  // pause time may have started one, flipping isAudioActive() to true behind
  // resume()'s back.
  _pausedAudio = isAudioActive();
  if (_pausedAudio) {
    pauseAudio();
    stopKeepAlive();
    notify();
    return;
  }

  if (isNative()) {
    // Bump gen → running loop sees myGen !== _gen and exits cleanly.
    _gen++;
    TextToSpeech.stop().catch(() => {});
    stopKeepAlive();
  } else if (typeof speechSynthesis !== 'undefined') {
    // Web: freeze the in-flight utterance; the loop's await stays pending.
    speechSynthesis.pause();
    stopKeepAlive();
  }
  notify();
}

export function resume() {
  if (!_playing || !_paused) return;
  if (_nativeQueue) { _paused = false; resumeQueue(); notify(); return; }
  _paused = false;

  // A held clip is still in flight and its promise is still pending, so the
  // loop is exactly where it was — nothing to restart. Act on the branch
  // pause() latched, not on a fresh isAudioActive() read: that flag can have
  // flipped to true after pause() ran (a clip that started mid-ensure()), in
  // which case pause() never actually held anything and this resume() must
  // still restart the loop, not silently no-op on a clip nobody paused.
  if (_pausedAudio) {
    _pausedAudio = false;
    resumeAudio();
    startKeepAlive();
    notify();
    return;
  }

  if (isNative()) {
    // Start a fresh loop from the position we saved on pause.
    const myGen = ++_gen;
    startKeepAlive();
    notify();
    runLoop(_pausePos, myGen);
  } else if (typeof speechSynthesis !== 'undefined') {
    // Web: unfreeze the utterance; the existing loop's await resolves naturally.
    speechSynthesis.resume();
    startKeepAlive();
    notify();
  }
}

export function stop() { doStop(); }

function jumpToItem(i) {
  const pos = _flat.findIndex(f => f.itemIndex === i && f.chunkIndex === 0);
  if (pos < 0) return;
  if (_nativeQueue) {
    _curItemIndex = i;
    _paused = false;
    skipToQueueIndex(pos);
    notify();
    return;
  }
  const myGen = ++_gen;
  _curItemIndex = -1;
  _paused  = false;
  _playing = true;
  hardCancel();
  startKeepAlive();
  notify();
  runLoop(pos, myGen);
}

export function next() {
  const ni = _curItemIndex + 1;
  if (ni >= _items.length) return;
  jumpToItem(ni);
}

export function prev() {
  const pi = _curItemIndex - 1;
  jumpToItem(pi < 0 ? 0 : pi);
}

export function goToItem(i) {
  if (i < 0 || i >= _items.length) return;
  jumpToItem(i);
}

// The lock screen's buttons, pointed at the same functions the in-app player
// uses, so state cannot diverge between the two. Fast-forward and rewind move
// by section rather than by paragraph: the plugin has no next/previous-track
// command, and a section is the unit someone listening to a queue with the
// screen off is actually trying to skip.
setRemoteHandlers({
  onPlay: () => resume(),
  onPause: () => pause(),
  onStop: () => stop(),
  onNext: () => next(),
  onPrev: () => prev(),
});

// ─── Preview samples ─────────────────────────────────────────────────────────
//
// A sample is a one-off preview that lives outside the playlist: it never
// consumes quota, never moves _pos, and a second press on its button stops it
// rather than restarting. It also refuses to start while the playlist itself
// is playing, since these buttons sit on screens reachable mid-listen.

export function isSamplePlaying() { return _sampleKind !== null; }
// 'audio' | 'device' | null — lets a UI put the stop icon on the right button
// when both a premium-sample and a device-sample button are shown together.
export function samplePlayingKind() { return _sampleKind; }

export function stopSample() {
  if (!_sampleKind) return;
  _sampleKind = null;
  stopAudio();
  if (isNative()) TextToSpeech.stop().catch(() => {});
  else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  notify();
}

// Plays a real rendered paragraph, so a preview of the new voice is the new
// voice rather than a description of it. If it cannot reach the file it speaks
// the same text with the device voice — which is honest, because that is
// exactly what that paragraph would sound like anyway.
// `voice` lets Settings preview either one without changing the saved
// setting first, which is the whole point of a preview button.
export async function toggleSampleFile(sectionId, paraIndex, fallbackText, voice = _audioVoice) {
  if (_sampleKind) { stopSample(); return; }
  if (_playing) return;

  const hash = isAudioEnabled() ? audioHashFor(sectionId, paraIndex, voice) : null;
  if (!hash) { toggleSampleDevice(fallbackText); return; }

  // Set the flag before the await so a second press during the download stops
  // it; the guard after the await catches that case.
  _sampleKind = 'audio';
  notify();
  let uri = null;
  try { uri = await ensure(hash, voice); } catch { uri = null; }
  if (_sampleKind !== 'audio') return;          // stopped while loading
  if (!uri) { _sampleKind = null; toggleSampleDevice(fallbackText); return; }

  try { await playFile(uri, { rate: _rate }); } catch { /* stopped or failed */ }
  if (_sampleKind === 'audio') { _sampleKind = null; notify(); }
}

// The device's own voice, for comparison against the premium one.
export function toggleSampleDevice(text) {
  if (_sampleKind) { stopSample(); return; }
  if (_playing) return;
  _sampleKind = 'device';
  notify();
  speakSample(text).finally(() => {
    if (_sampleKind === 'device') { _sampleKind = null; notify(); }
  });
}

// Speaks one string through the device engine, resolving when it finishes.
// Kept as a named export because VoiceSettings' old button imported it; now
// only toggleSampleDevice should call it directly.
export function speakSample(text) {
  return new Promise((resolve) => {
    try {
      if (isNative()) {
        // The user reaches this button right after installing a voice — always
        // re-resolve so the preview reflects what is actually on the device now.
        clearVoiceCache();
        const opts = { text, lang: 'th-TH', rate: _rate, pitch: _pitch, category: 'playback' };
        TextToSpeech.stop().catch(() => {});
        resolveVoiceIndex()
          .then((idx) => {
            if (idx != null) opts.voice = idx;
            return TextToSpeech.speak(opts);
          })
          .then(resolve, resolve);
        return;
      }
      if (typeof speechSynthesis === 'undefined') { resolve(); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = 'th-TH';
      u.rate  = _rate;
      u.pitch = _pitch;
      const v = pickWebVoice();
      if (v) u.voice = v;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    } catch { resolve(); }
  });
}
