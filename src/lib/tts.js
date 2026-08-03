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
import { isAudioEnabled, audioHashFor } from './audioManifest';
import { ensure } from './audioCache';
import { playFile, stopAudio } from './audioPlayer';

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
  speechUnits(number, paragraphs).forEach((unit, paraIndex) => {
    const audioHash = isAudioEnabled() ? audioHashFor(sectionId, paraIndex) : null;
    if (audioHash) {
      chunks.push({ text: unit, paraIndex, audioHash });
      return;
    }
    for (const c of splitLong(unit)) chunks.push({ text: c, paraIndex, audioHash: null });
  });
  return { sectionId, bookId, number, title: title || '', label: `มาตรา ${number}`, chunks };
}

function flatten(items) {
  const flat = [];
  items.forEach((it, itemIndex) => {
    it.chunks.forEach((c, chunkIndex) =>
      flat.push({
        itemIndex, chunkIndex, text: c.text, paraIndex: c.paraIndex, audioHash: c.audioHash ?? null,
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
export async function speakUnit(unit) {
  const { text, audioHash } = unit;

  // Gating on isAudioEnabled() already happened once, in buildSectionItem —
  // a unit only carries a non-null audioHash when the feature was on at build
  // time. Re-checking isAudioEnabled() here would require it to still be true
  // at speak time too, which breaks nothing today (AUDIO_BASE_URL is '' and no
  // unit ever gets a real hash) but is redundant with the upstream gate and
  // couples this function to a global it does not need.
  if (audioHash) {
    let uri = null;
    try {
      uri = await ensure(audioHash);
    } catch {
      uri = null;
    }
    if (uri) {
      try {
        await playFile(uri, { rate: _rate });
        return;
      } catch (err) {
        if (err?.message === 'canceled') throw err;
        // Anything else — a corrupt file, a decoder error — is worth the
        // fallback rather than a gap.
      }
    }
  }

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

      try {
        await speakUnit(unit);
      } catch {
        // canceled — for web this means the utterance was interrupted;
        // for native this branch is unreachable (gen already bumped → returned above).
        return;
      }

      if (myGen !== _gen) return;
      p++;
    }
    if (myGen === _gen) finish();
  })();
}

function finish() {
  _playing = false;
  _paused  = false;
  _pos     = -1;
  _curItemIndex = -1;
  stopKeepAlive();
  _onChange?.(-1, -1, -1);
  _onFinish?.();
  notify();
}

function doStop() {
  _gen++;
  _playing = false;
  _paused  = false;
  _pos     = -1;
  _curItemIndex = -1;
  stopKeepAlive();
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

export function setRate(r)  { _rate  = Math.max(0.5, Math.min(2.0, r)); }
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
  _gen++;
  const myGen = _gen;
  _playing = true;
  _paused  = false;
  _curItemIndex = -1;
  startKeepAlive();
  notify();
  runLoop(startPos < 0 ? 0 : startPos, myGen);
}

// ─── Pause / Resume (v10 fix) ────────────────────────────────────────────────
export function pause() {
  if (!_playing || _paused) return;
  _paused   = true;
  _pausePos = _pos;   // remember where we are

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
  _paused = false;

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

export function speakSample(text) {
  try {
    if (isNative()) {
      // The user reaches this button right after installing a voice — always
      // re-resolve so the preview reflects what is actually on the device now.
      clearVoiceCache();
      const opts = { text, lang: 'th-TH', rate: _rate, pitch: _pitch, category: 'playback' };
      TextToSpeech.stop().catch(() => {});
      return resolveVoiceIndex()
        .then((idx) => {
          if (idx != null) opts.voice = idx;
          return TextToSpeech.speak(opts);
        })
        .catch(() => {});
    }
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = 'th-TH';
    u.rate  = _rate;
    u.pitch = _pitch;
    const v = pickWebVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}
