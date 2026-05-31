// TTS engine — plays a playlist of sections.
// Native Android uses @capacitor-community/text-to-speech (real device voices);
// browser/dev falls back to the Web Speech API.
//
// Each "item" is one section: { sectionId, bookId, number, label, chunks: [str] }
// Chunks are spoken in order. The first chunk is always "มาตรา X" (#7), then the
// body split into short pieces (#6 — long text is chunked so engines don't choke).
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// ─── State ───────────────────────────────────────────────────────────────────
let _items = [];      // section items
let _flat = [];       // [{ itemIndex, chunkIndex, text }]
let _pos = -1;
let _gen = 0;         // generation token — bumps on every control action
let _playing = false;
let _paused = false;
let _curItemIndex = -1;

// Tunables (persisted by the caller via settings)
let _rate = 1.0;
let _pitch = 1.0;
let _voice = null;    // web: voiceURI string · native: numeric index

// Hooks
let _onChange = null;      // (itemIndex, chunkIndex) -> void
let _onItemStart = null;   // (item) -> false to abort (quota)
let _onState = null;       // () -> void  (UI re-render)
let _onFinish = null;      // () -> void

let _keepAlive = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const notify = () => _onState?.();

function splitLong(text, max = 180) {
  const out = [];
  let rest = (text || '').trim();
  while (rest.length > max) {
    // break at the last sentence/space boundary before max
    let cut = rest.lastIndexOf(' ', max);
    const stop = Math.max(
      rest.lastIndexOf('।', max), rest.lastIndexOf('. ', max),
      rest.lastIndexOf('ๆ', max),
    );
    if (stop > max * 0.5) cut = stop + 1;
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Build a section item. `paragraphs` is the already-cleaned body (title stripped).
// Each chunk carries the body paragraph index it came from (-1 for the spoken
// "มาตรา X" heading) so the reader can highlight the active paragraph.
export function buildSectionItem({ sectionId, bookId, number, title, paragraphs }) {
  const chunks = [{ text: `มาตรา ${number}`, paraIndex: -1 }];
  (paragraphs || []).forEach((p, pi) => {
    for (const c of splitLong(p)) chunks.push({ text: c, paraIndex: pi });
  });
  return { sectionId, bookId, number, title: title || '', label: `มาตรา ${number}`, chunks };
}

function flatten(items) {
  const flat = [];
  items.forEach((it, itemIndex) => {
    it.chunks.forEach((c, chunkIndex) =>
      flat.push({ itemIndex, chunkIndex, text: c.text, paraIndex: c.paraIndex }));
  });
  return flat;
}

// ─── Low-level speak (one chunk) ─────────────────────────────────────────────
function speakOne(text) {
  return new Promise((resolve, reject) => {
    if (isNative()) {
      const opts = { text, lang: 'th-TH', rate: _rate, pitch: _pitch, category: 'playback' };
      if (_voice != null) opts.voice = Number(_voice);
      TextToSpeech.speak(opts).then(resolve).catch((e) => reject(new Error('canceled')));
    } else {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'th-TH';
      u.rate = _rate;
      u.pitch = _pitch;
      const v = pickWebVoice();
      if (v) u.voice = v;
      u.onend = () => resolve();
      u.onerror = (e) =>
        (e.error === 'canceled' || e.error === 'interrupted')
          ? reject(new Error('canceled'))
          : resolve();
      speechSynthesis.speak(u);
    }
  });
}

function pickWebVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return null;
  if (_voice) {
    const found = vs.find(v => v.voiceURI === _voice);
    if (found) return found;
  }
  return vs.find(v => v.lang === 'th-TH') || vs.find(v => v.lang?.startsWith('th')) || null;
}

function cancelCurrent() {
  if (isNative()) TextToSpeech.stop().catch(() => {});
  else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

function startKeepAlive() {
  stopKeepAlive();
  if (isNative()) return; // only Web Speech has the 15s cutoff bug
  _keepAlive = setInterval(() => {
    if (_playing && !_paused && speechSynthesis.speaking) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 9000);
}
function stopKeepAlive() {
  if (_keepAlive) { clearInterval(_keepAlive); _keepAlive = null; }
}

// ─── Main loop ───────────────────────────────────────────────────────────────
function runLoop(startPos, myGen) {
  (async () => {
    let p = startPos;
    while (p < _flat.length) {
      if (myGen !== _gen) return;
      if (_paused) { await sleep(120); continue; }

      _pos = p;
      const unit = _flat[p];

      if (unit.chunkIndex === 0 && unit.itemIndex !== _curItemIndex) {
        _curItemIndex = unit.itemIndex;
        if (_onItemStart && _onItemStart(_items[unit.itemIndex]) === false) {
          doStop();
          return;
        }
      }
      _onChange?.(unit.itemIndex, unit.chunkIndex, unit.paraIndex);

      let ok = true;
      try {
        await speakOne(unit.text);
      } catch {
        ok = false;
      }
      if (myGen !== _gen) return;
      if (!ok && _paused) continue;  // canceled by pause → re-speak same chunk
      p++;
    }
    if (myGen === _gen) finish();
  })();
}

function finish() {
  _playing = false;
  _paused = false;
  _pos = -1;
  _curItemIndex = -1;
  stopKeepAlive();
  _onChange?.(-1, -1, -1);
  _onFinish?.();
  notify();
}

function doStop() {
  _gen++;
  _playing = false;
  _paused = false;
  _pos = -1;
  _curItemIndex = -1;
  stopKeepAlive();
  cancelCurrent();
  _onChange?.(-1, -1, -1);
  notify();
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function isTtsAvailable() {
  if (isNative()) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function setHooks({ onChange, onItemStart, onState, onFinish }) {
  if (onChange !== undefined) _onChange = onChange;
  if (onItemStart !== undefined) _onItemStart = onItemStart;
  if (onState !== undefined) _onState = onState;
  if (onFinish !== undefined) _onFinish = onFinish;
}

export function setRate(r)  { _rate = Math.max(0.5, Math.min(2.0, r)); }
export function setPitch(p) { _pitch = Math.max(0.5, Math.min(2.0, p)); }
export function setVoice(v) { _voice = v; }
export function getRate()   { return _rate; }
export function getPitch()  { return _pitch; }
export function getVoice()  { return _voice; }

export function isSpeaking() { return _playing; }
export function isPaused()   { return _paused; }
export function currentItemIndex()  { return _curItemIndex; }
export function currentItem() { return _items[_curItemIndex] || null; }
export function itemCount()  { return _items.length; }

export async function getVoices() {
  try {
    if (isNative()) {
      const r = await TextToSpeech.getSupportedVoices();
      return (r.voices || [])
        .map((v, i) => ({ id: String(i), name: v.name || v.voiceURI || `เสียง ${i + 1}`, lang: v.lang || '' }))
        .filter(v => !v.lang || v.lang.startsWith('th') || v.lang.startsWith('en'));
    }
    const vs = speechSynthesis.getVoices();
    return vs.map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
  } catch {
    return [];
  }
}

// items: array from buildSectionItem(); start at item index.
export function playItems(items, startItemIndex = 0) {
  doStop();
  _items = items;
  _flat = flatten(items);
  if (!_flat.length) return;
  const startPos = _flat.findIndex(f => f.itemIndex === startItemIndex && f.chunkIndex === 0);
  _gen++;
  _playing = true;
  _paused = false;
  _curItemIndex = -1;
  startKeepAlive();
  notify();
  runLoop(startPos < 0 ? 0 : startPos, _gen);
}

export function pause() {
  if (!_playing || _paused) return;
  _paused = true;
  cancelCurrent();
  notify();
}

export function resume() {
  if (!_playing || !_paused) return;
  _paused = false;
  notify();
}

export function stop() { doStop(); }

function jumpToItem(i) {
  const pos = _flat.findIndex(f => f.itemIndex === i && f.chunkIndex === 0);
  if (pos < 0) return;
  _gen++;
  _curItemIndex = -1;
  _paused = false;
  _playing = true;
  cancelCurrent();
  startKeepAlive();
  notify();
  runLoop(pos, _gen);
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

// Jump to an arbitrary item (used by the player's "queue" popup).
export function goToItem(i) {
  if (i < 0 || i >= _items.length) return;
  jumpToItem(i);
}

// Speak a one-off sample sentence (settings → "ทดสอบเสียง"), bypassing the
// playlist engine so it doesn't disrupt active playback.
export function speakSample(text) {
  try {
    if (isNative()) {
      const opts = { text, lang: 'th-TH', rate: _rate, pitch: _pitch, category: 'playback' };
      if (_voice != null) opts.voice = Number(_voice);
      TextToSpeech.stop().catch(() => {});
      return TextToSpeech.speak(opts).catch(() => {});
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = _rate;
    u.pitch = _pitch;
    const v = pickWebVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}

export function getItems() { return _items.slice(); }
