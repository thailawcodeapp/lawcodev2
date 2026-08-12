# Native Playback Queue (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand the whole remaining playlist to Android at play time so native drives paragraph-to-paragraph advance, letting background playback survive the WebView's JavaScript engine freezing ~80 seconds after the app is backgrounded.

**Architecture:** A new `PlaybackQueue` class in the patched `@capgo/native-audio` plugin wraps a single ExoPlayer instance holding the whole queue as a media playlist. ExoPlayer supplies advance, buffer-ahead, the shared disk cache, repeat off/all, playback speed and audio-focus handling; only repeat-section, retry-then-stall, and notification updates are hand-written. On the JavaScript side a new `src/lib/nativeQueue.js` builds the entry list and owns the plugin conversation, and `tts.js` routes to it on Android only — the existing JS loop is not modified and continues to serve web and iOS.

**Tech Stack:** Capacitor 8, React + Vite, Vitest, `@capgo/native-audio` 8.4.2 (patched via patch-package), androidx.media3 1.10.0 (already a plugin dependency), Java 17 / Android Gradle.

## Global Constraints

- **Android only.** Web and iOS must keep running the existing `runLoop` in `src/lib/tts.js` unchanged. No step in this plan edits `runLoop`, `speakUnit`, `finish`, or `doStop`.
- **The existing test suite must stay green.** 429 tests pass today; run `npm test` before every commit.
- **Spec:** `docs/superpowers/specs/2026-08-12-native-playback-queue-design.md`. Section numbers below refer to it.
- **Repeat modes** are exactly `'off' | 'section' | 'all'`, matching `REPEAT_MODES` in `src/lib/tts.js`.
- **Retry policy on load failure:** 3 retries at 1000 ms, 3000 ms, 8000 ms, then stall. Never skip a paragraph.
- **Every Java change must be captured in the patch.** After native edits run `npx patch-package @capgo/native-audio` and commit the regenerated `patches/@capgo+native-audio+8.4.2.patch`.
- **Local Gradle builds do not work** in this environment (SDK platform naming, `android-36` vs `android-36.1`). Compilation is verified by the `build-aab.yml` GitHub Actions workflow.
- **Kill switch:** `USE_NATIVE_QUEUE` in `src/config.js`. When false, Android falls back to the existing JS loop with no other change.

## File Structure

**Created:**
- `src/lib/nativeQueue.js` — the only module that talks to the plugin's queue API. Builds entries from the flattened playlist, sends commands, receives events, and answers "what is native playing right now".
- `src/lib/nativeQueue.test.js` — unit tests for the above.
- `node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/PlaybackQueue.java` — ExoPlayer-backed queue. Knows nothing about Capacitor; talks to the plugin through a `Callback` interface.

**Modified:**
- `src/config.js` — add `USE_NATIVE_QUEUE`.
- `src/lib/tts.js` — route the public API to `nativeQueue` on Android. `runLoop` untouched.
- `src/lib/audioCache.js` — add `mediaCacheBytes()` and extend `clearCache()` to clear the plugin's media cache.
- `src/components/AudioStorageRow.jsx` — include the plugin's media cache in the total.
- `.../ee/forgr/audio/NativeAudio.java` — queue plugin methods, media-session routing, notification updates, cache-size method.
- `.../ee/forgr/audio/RemoteAudioAsset.java` — expose the shared `SimpleCache` and its size.
- `patches/@capgo+native-audio+8.4.2.patch` — regenerated.

---

### Task 1: Kill switch and queue-entry building

The pure, testable half of the JavaScript side: deciding whether the native queue may be used at all, and turning `_flat` into the entry list the plugin wants (spec §6.1).

**Files:**
- Modify: `src/config.js`
- Create: `src/lib/nativeQueue.js`
- Test: `src/lib/nativeQueue.test.js`

**Interfaces:**
- Consumes: `cachedUri(hash, voice)` from `src/lib/audioCache.js` (resolves to a `file://` URI or `null`); `audioUrl(hash, voice)` and `DEFAULT_VOICE` from `src/lib/audioManifest.js`.
- Produces:
  - `isNativeQueueAvailable(): boolean`
  - `canQueue(flat: Unit[]): boolean`
  - `buildEntries(flat, startIndex, metadataFor): Promise<Entry[]>` where `metadataFor(unit) => { title, artist, artworkUrl? }` and `Entry = { url, title, artist, artworkUrl, itemIndex, paraIndex }`

- [ ] **Step 1: Add the kill switch**

Append to `src/config.js`:

```js
// ── Native playback queue (Android) ─────────────────────────────────────────
// The whole remaining playlist is handed to native at play time so paragraph
// advance no longer needs JavaScript — which stops running about 80 seconds
// after the app is backgrounded. See
// docs/superpowers/specs/2026-08-12-native-playback-queue-design.md.
//
// False falls back to the JavaScript loop that web and iOS use. Native code
// can only be changed through a CI build, so this is the one-build way back
// if the queue misbehaves on a real device.
export const USE_NATIVE_QUEUE = true;
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/nativeQueue.test.js`:

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./audioCache', () => ({ cachedUri: vi.fn() }));
vi.mock('../config', () => ({ USE_NATIVE_QUEUE: true }));

import { cachedUri } from './audioCache';
import { isNativeQueueAvailable, canQueue, buildEntries } from './nativeQueue';

const unit = (over = {}) => ({
  itemIndex: 0, chunkIndex: 0, paraIndex: 0,
  text: 'ข้อความ', audioHash: 'h0', audioVoice: 'm', ...over,
});

const metadataFor = (u) => ({
  title: `มาตรา ${u.itemIndex}`,
  artist: `ย่อหน้า ${u.paraIndex + 1}`,
  artworkUrl: 'https://cdn.example/now-playing.png',
});

beforeEach(() => {
  vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'android' } });
  cachedUri.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('isNativeQueueAvailable', () => {
  it('is true on Android', () => {
    expect(isNativeQueueAvailable()).toBe(true);
  });

  it('is false when the kill switch is off, so Android falls back to the JS loop', async () => {
    vi.resetModules();
    vi.doMock('../config', () => ({ USE_NATIVE_QUEUE: false }));
    const fresh = await import('./nativeQueue');
    expect(fresh.isNativeQueueAvailable()).toBe(false);
    vi.doUnmock('../config');
  });

  it('is false on iOS and web — both keep the JavaScript loop', () => {
    vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'ios' } });
    expect(isNativeQueueAvailable()).toBe(false);
    vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'web' } });
    expect(isNativeQueueAvailable()).toBe(false);
  });

  it('is false when Capacitor is absent entirely', () => {
    vi.stubGlobal('window', {});
    expect(isNativeQueueAvailable()).toBe(false);
  });
});

describe('canQueue', () => {
  // Native never speaks with the device voice — every section in the corpus
  // has a rendered file, so a unit without one means audio is switched off
  // (empty AUDIO_BASE_URL) or the playlist was built before it was. Either
  // way the whole playlist has to go back to the JavaScript loop, because a
  // native queue cannot represent a paragraph it has no file for.
  it('accepts a playlist where every unit has a file', () => {
    expect(canQueue([unit(), unit({ audioHash: 'h1' })])).toBe(true);
  });

  it('rejects a playlist with any unit lacking a file', () => {
    expect(canQueue([unit(), unit({ audioHash: null })])).toBe(false);
  });

  it('rejects an empty playlist', () => {
    expect(canQueue([])).toBe(false);
  });
});

describe('buildEntries', () => {
  it('carries the position fields native needs for repeat and skip', async () => {
    const flat = [unit({ itemIndex: 3, paraIndex: 1, audioHash: 'abc' })];
    const [entry] = await buildEntries(flat, 0, metadataFor);
    expect(entry.itemIndex).toBe(3);
    expect(entry.paraIndex).toBe(1);
  });

  it('carries the lock-screen metadata from the same source the JS loop uses', async () => {
    const [entry] = await buildEntries([unit({ itemIndex: 7 })], 0, metadataFor);
    expect(entry.title).toBe('มาตรา 7');
    expect(entry.artist).toBe('ย่อหน้า 1');
    expect(entry.artworkUrl).toBe('https://cdn.example/now-playing.png');
  });

  it('uses the cached file for entries at the start, so playback begins instantly', async () => {
    cachedUri.mockResolvedValue('file:///cache/audio/m/abc.mp3');
    const [entry] = await buildEntries([unit({ audioHash: 'abc' })], 0, metadataFor);
    expect(entry.url).toBe('file:///cache/audio/m/abc.mp3');
  });

  it('falls back to the remote URL when the file is not cached', async () => {
    const [entry] = await buildEntries([unit({ audioHash: 'abc' })], 0, metadataFor);
    expect(entry.url).toMatch(/abc\.mp3$/);
    expect(entry.url).toMatch(/^https:/);
  });

  it('only checks the cache near the start — a 6,764-entry playlist must not stat every file', async () => {
    const flat = Array.from({ length: 50 }, (_, i) =>
      unit({ itemIndex: i, audioHash: `h${i}` }));
    await buildEntries(flat, 0, metadataFor);
    expect(cachedUri.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('checks the cache around startIndex, not around zero', async () => {
    const flat = Array.from({ length: 50 }, (_, i) =>
      unit({ itemIndex: i, audioHash: `h${i}` }));
    await buildEntries(flat, 20, metadataFor);
    expect(cachedUri).toHaveBeenCalledWith('h20', 'm');
    expect(cachedUri).not.toHaveBeenCalledWith('h0', 'm');
  });

  it('passes each unit\'s own voice, so a rebuilt section cannot fetch the other voice', async () => {
    await buildEntries([unit({ audioHash: 'abc', audioVoice: 'f' })], 0, metadataFor);
    expect(cachedUri).toHaveBeenCalledWith('abc', 'f');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/nativeQueue.test.js`
Expected: FAIL — `Failed to resolve import "./nativeQueue"`

- [ ] **Step 4: Write the implementation**

Create `src/lib/nativeQueue.js`:

```js
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/nativeQueue.test.js`
Expected: PASS, 14 tests

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, 443 tests (429 existing + 14 new)

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/lib/nativeQueue.js src/lib/nativeQueue.test.js
git commit -m "feat(audio): build native queue entries from the playlist"
```

---

### Task 2: Queue commands, events and state re-sync

The rest of the JavaScript side: sending commands, receiving progress events, and — the part that keeps the UI honest — asking native where playback actually is when the app comes back on screen (spec §7).

**Files:**
- Modify: `src/lib/nativeQueue.js`
- Test: `src/lib/nativeQueue.test.js`

**Interfaces:**
- Consumes: `NativeAudio` from `@capgo/native-audio`; `buildEntries`, `canQueue` from Task 1.
- Produces:
  - `startQueue(flat, startIndex, { repeat, rate }, metadataFor): Promise<boolean>` — false when the playlist cannot be queued
  - `skipToQueueIndex(index): Promise<void>`
  - `pauseQueue(): Promise<void>` / `resumeQueue(): Promise<void>` / `clearQueue(): Promise<void>`
  - `setQueueRepeat(repeat): Promise<void>` / `setQueueRate(rate): Promise<void>`
  - `queueState(): Promise<{ index, itemIndex, paraIndex, playing, stalled, error }>`
  - `setQueueHandlers({ onAdvance, onEnded, onStalled })`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/nativeQueue.test.js`:

```js
import {
  startQueue, skipToQueueIndex, pauseQueue, resumeQueue, clearQueue,
  setQueueRepeat, setQueueRate, queueState, setQueueHandlers,
} from './nativeQueue';
import { NativeAudio } from '@capgo/native-audio';

describe('queue commands', () => {
  beforeEach(() => {
    NativeAudio.setQueue.mockResolvedValue(undefined);
    NativeAudio.getQueueState.mockResolvedValue({
      index: 4, itemIndex: 2, paraIndex: 1, playing: true, stalled: false, error: null,
    });
  });

  it('starts the queue with the entries, the start index, repeat and rate', async () => {
    const flat = [unit({ audioHash: 'a' }), unit({ audioHash: 'b', itemIndex: 1 })];
    const ok = await startQueue(flat, 1, { repeat: 'all', rate: 1.5 }, metadataFor);

    expect(ok).toBe(true);
    const arg = NativeAudio.setQueue.mock.calls[0][0];
    expect(arg.entries).toHaveLength(2);
    expect(arg.startIndex).toBe(1);
    expect(arg.repeat).toBe('all');
    expect(arg.rate).toBe(1.5);
  });

  it('refuses a playlist native cannot represent, so the caller can use the JS loop', async () => {
    const ok = await startQueue([unit({ audioHash: null })], 0, {}, metadataFor);
    expect(ok).toBe(false);
    expect(NativeAudio.setQueue).not.toHaveBeenCalled();
  });

  it('sends the remaining control commands straight through', async () => {
    await skipToQueueIndex(9);
    expect(NativeAudio.skipToQueueIndex).toHaveBeenCalledWith({ index: 9 });
    await pauseQueue();
    expect(NativeAudio.pauseQueue).toHaveBeenCalled();
    await resumeQueue();
    expect(NativeAudio.resumeQueue).toHaveBeenCalled();
    await clearQueue();
    expect(NativeAudio.clearQueue).toHaveBeenCalled();
    await setQueueRepeat('section');
    expect(NativeAudio.setQueueRepeat).toHaveBeenCalledWith({ repeat: 'section' });
    await setQueueRate(2);
    expect(NativeAudio.setQueueRate).toHaveBeenCalledWith({ rate: 2 });
  });

  it('never rejects — a failed native call must not break the caller', async () => {
    NativeAudio.pauseQueue.mockRejectedValue(new Error('no queue'));
    await expect(pauseQueue()).resolves.toBeUndefined();
  });

  it('reads the state native reports', async () => {
    await expect(queueState()).resolves.toMatchObject({ index: 4, itemIndex: 2, playing: true });
  });

  it('reports an empty queue rather than throwing when native has none', async () => {
    NativeAudio.getQueueState.mockRejectedValue(new Error('no queue'));
    await expect(queueState()).resolves.toMatchObject({ index: -1, playing: false });
  });
});

describe('queue events', () => {
  it('routes each native event to its handler', async () => {
    const onAdvance = vi.fn(), onEnded = vi.fn(), onStalled = vi.fn();
    setQueueHandlers({ onAdvance, onEnded, onStalled });
    await startQueue([unit({ audioHash: 'a' })], 0, {}, metadataFor);

    const fire = (name, payload) => {
      const call = NativeAudio.addListener.mock.calls.find(([n]) => n === name);
      expect(call, `no listener registered for ${name}`).toBeTruthy();
      call[1](payload);
    };

    fire('queueAdvance', { index: 3, itemIndex: 1, paraIndex: 2 });
    expect(onAdvance).toHaveBeenCalledWith({ index: 3, itemIndex: 1, paraIndex: 2 });
    fire('queueEnded', {});
    expect(onEnded).toHaveBeenCalled();
    fire('queueStalled', { index: 3, error: 'source' });
    expect(onStalled).toHaveBeenCalledWith({ index: 3, error: 'source' });
  });

  it('registers its listeners once however many times the queue is started', async () => {
    await startQueue([unit({ audioHash: 'a' })], 0, {}, metadataFor);
    await startQueue([unit({ audioHash: 'b' })], 0, {}, metadataFor);
    const advanceListeners = NativeAudio.addListener.mock.calls.filter(([n]) => n === 'queueAdvance');
    expect(advanceListeners).toHaveLength(1);
  });
});
```

Add the plugin mock at the top of the file, directly below the existing `vi.mock('./audioCache', ...)` line:

```js
vi.mock('@capgo/native-audio', () => ({
  NativeAudio: {
    setQueue: vi.fn(), skipToQueueIndex: vi.fn(), pauseQueue: vi.fn(),
    resumeQueue: vi.fn(), clearQueue: vi.fn(), setQueueRepeat: vi.fn(),
    setQueueRate: vi.fn(), getQueueState: vi.fn(), addListener: vi.fn(),
  },
}));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/nativeQueue.test.js`
Expected: FAIL — `startQueue is not a function`

- [ ] **Step 3: Write the implementation**

Append to `src/lib/nativeQueue.js`, and add `import { NativeAudio } from '@capgo/native-audio';` to the imports at the top:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/nativeQueue.test.js`
Expected: PASS, 22 tests

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 451 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/nativeQueue.js src/lib/nativeQueue.test.js
git commit -m "feat(audio): queue commands, events and state read-back"
```

---

### Task 3: Route tts.js to the native queue on Android

`tts.js`'s public API keeps its exact shape (spec §6.4); only the destination changes, and only on Android. `runLoop` is not touched.

**Files:**
- Modify: `src/lib/tts.js`
- Test: `src/lib/tts.nativeQueue.test.js` (create)

**Interfaces:**
- Consumes: everything Task 2 produced.
- Produces: no new exports. `playItems`, `pause`, `resume`, `next`, `prev`, `goToItem`, `stop`, `setRepeat`, `setRate` gain an Android branch, and `resyncFromNative()` is added as a non-exported internal wired to `visibilitychange`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tts.nativeQueue.test.js`:

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./nativeQueue', () => ({
  isNativeQueueAvailable: vi.fn(() => true),
  startQueue: vi.fn(async () => true),
  skipToQueueIndex: vi.fn(async () => {}),
  pauseQueue: vi.fn(async () => {}),
  resumeQueue: vi.fn(async () => {}),
  clearQueue: vi.fn(async () => {}),
  setQueueRepeat: vi.fn(async () => {}),
  setQueueRate: vi.fn(async () => {}),
  queueState: vi.fn(async () => ({
    index: 2, itemIndex: 1, paraIndex: 0, playing: true, stalled: false, error: null,
  })),
  setQueueHandlers: vi.fn(),
}));
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));
vi.mock('./audioPlayer', () => ({
  playFile: vi.fn(() => new Promise(() => {})), stopAudio: vi.fn(),
  pauseAudio: vi.fn(), resumeAudio: vi.fn(), isAudioActive: vi.fn(() => false),
  preloadFile: vi.fn(), setRemoteHandlers: vi.fn(),
}));
vi.mock('./audioCache', () => ({ ensure: vi.fn(async () => null), removeCached: vi.fn(async () => {}) }));

import * as nq from './nativeQueue';

const section = (number, paragraphs) => ({
  sectionId: `civil-${number}`, bookId: 'civil', number,
  title: 'ชื่อมาตรา', paragraphs,
});

let tts;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() });
  vi.clearAllMocks();
  nq.isNativeQueueAvailable.mockReturnValue(true);
  nq.startQueue.mockResolvedValue(true);
  tts = await import('./tts');
});
afterEach(() => vi.unstubAllGlobals());

describe('playItems on Android', () => {
  it('hands the playlist to native instead of starting the JS loop', async () => {
    const items = [tts.buildSectionItem(section('1', ['ก'])), tts.buildSectionItem(section('2', ['ข']))];
    tts.playItems(items, 1);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    const [, startIndex] = nq.startQueue.mock.calls[0];
    expect(startIndex).toBeGreaterThan(0);   // started at the second section
    expect(tts.isSpeaking()).toBe(true);
  });

  it('falls back to the JS loop when native refuses the playlist', async () => {
    nq.startQueue.mockResolvedValue(false);
    const items = [tts.buildSectionItem(section('1', ['ก']))];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    // The loop owns playback now; the native controls must stay untouched.
    expect(nq.pauseQueue).not.toHaveBeenCalled();
  });
});

describe('controls on Android', () => {
  beforeEach(async () => {
    tts.playItems([tts.buildSectionItem(section('1', ['ก', 'ข']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
  });

  it('pause and resume drive the queue, not a single clip', () => {
    tts.pause();
    expect(nq.pauseQueue).toHaveBeenCalled();
    tts.resume();
    expect(nq.resumeQueue).toHaveBeenCalled();
  });

  it('stop clears the queue', () => {
    tts.stop();
    expect(nq.clearQueue).toHaveBeenCalled();
  });

  it('repeat and rate changes reach native mid-playback', () => {
    tts.setRepeat('section');
    expect(nq.setQueueRepeat).toHaveBeenCalledWith('section');
    tts.setRate(1.5);
    expect(nq.setQueueRate).toHaveBeenCalledWith(1.5);
  });

  it('goToItem skips within the queue rather than rebuilding it', () => {
    nq.startQueue.mockClear();
    tts.goToItem(0);
    expect(nq.skipToQueueIndex).toHaveBeenCalled();
    expect(nq.startQueue).not.toHaveBeenCalled();
  });
});

describe('changing voice mid-queue', () => {
  it('re-sends the queue, because the voice is part of every URL in it', async () => {
    tts.playItems([tts.buildSectionItem(section('1', ['ก']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.startQueue.mockClear();
    tts.setAudioVoice('f');
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
  });
});

describe('re-sync after the app comes back on screen', () => {
  it('takes its position from native rather than from what it remembers', async () => {
    const items = [
      tts.buildSectionItem(section('1', ['ก'])),
      tts.buildSectionItem(section('2', ['ข'])),
    ];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.queueState.mockResolvedValue({
      index: 1, itemIndex: 1, paraIndex: 0, playing: true, stalled: false, error: null,
    });
    const onVisible = document.addEventListener.mock.calls
      .find(([name]) => name === 'visibilitychange')?.[1];
    expect(onVisible, 'no visibilitychange listener registered').toBeTypeOf('function');

    onVisible();
    await vi.waitFor(() => expect(tts.currentItemIndex()).toBe(1));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tts.nativeQueue.test.js`
Expected: FAIL — `startQueue` never called; `playItems` still runs the JS loop

- [ ] **Step 3: Add the imports and the routing helper to `src/lib/tts.js`**

Add below the existing `audioPlayer` import:

```js
import {
  isNativeQueueAvailable, startQueue, skipToQueueIndex, pauseQueue, resumeQueue,
  clearQueue, setQueueRepeat as nativeSetRepeat, setQueueRate as nativeSetRate,
  queueState, setQueueHandlers,
} from './nativeQueue';
```

Add after the `_pausedAudio` declaration:

```js
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
```

- [ ] **Step 4: Route `playItems`**

Replace the body of `playItems` in `src/lib/tts.js` with:

```js
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
```

- [ ] **Step 5: Route the remaining controls**

In `pause()`, insert immediately after the `if (!_playing || _paused) return;` guard:

```js
  if (_nativeQueue) { _paused = true; pauseQueue(); notify(); return; }
```

In `resume()`, insert immediately after the `if (!_playing || !_paused) return;` guard:

```js
  if (_nativeQueue) { _paused = false; resumeQueue(); notify(); return; }
```

In `doStop()`, insert as the first statement of the function body:

```js
  if (_nativeQueue) { _nativeQueue = false; clearQueue(); }
```

In `jumpToItem(i)`, insert immediately after the `if (pos < 0) return;` guard:

```js
  if (_nativeQueue) {
    _curItemIndex = i;
    _paused = false;
    skipToQueueIndex(pos);
    notify();
    return;
  }
```

In `setRepeat(mode)`, insert immediately before the existing `notify();`:

```js
  if (_nativeQueue) nativeSetRepeat(_repeat);
```

Replace `setRate` with:

```js
export function setRate(r)  {
  _rate = Math.max(0.5, Math.min(2.0, r));
  if (_nativeQueue) nativeSetRate(_rate);
}
```

- [ ] **Step 6: Re-send the queue when the voice changes (spec §6.5)**

The JS loop can rebuild lazily at the next section boundary because it visits every boundary. A handed-over queue has no such moment — native holds URLs, and the voice is baked into every one of them.

Replace `setAudioVoice` in `src/lib/tts.js` with:

```js
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
```

- [ ] **Step 7: Run the new tests**

Run: `npx vitest run src/lib/tts.nativeQueue.test.js`
Expected: PASS, 9 tests

- [ ] **Step 8: Run the whole suite — the existing loop must be untouched**

Run: `npm test`
Expected: PASS, 460 tests. Every one of the 429 original tests still passes; if any `tts.test.js` test fails, the JS-loop path was changed and must be restored.

- [ ] **Step 9: Commit**

```bash
git add src/lib/tts.js src/lib/tts.nativeQueue.test.js
git commit -m "feat(audio): route playback through the native queue on Android"
```

---

### Task 4: The ExoPlayer-backed queue in Java

**Files:**
- Create: `node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/PlaybackQueue.java`
- Modify: `node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/RemoteAudioAsset.java`

**Interfaces:**
- Consumes: `RemoteAudioAsset.sharedCache(Context)` — added in this task.
- Produces, for Task 5:
  - `PlaybackQueue(Context, Callback)`
  - `void setQueue(List<Entry> entries, int startIndex, String repeat, float rate)`
  - `void skipTo(int index)` / `void pause()` / `void resume()` / `void clear()`
  - `void setRepeat(String repeat)` / `void setRate(float rate)`
  - `boolean isActive()` / `int index()` / `Entry current()` / `boolean isPlaying()` / `boolean isStalled()` / `String error()`
  - `static class Entry { String url, title, artist, artworkUrl; int itemIndex, paraIndex; }`
  - `interface Callback { void onAdvance(int index, Entry e); void onEnded(); void onStalled(int index, Entry e, String error); void onPlayingChanged(boolean playing); }`

- [ ] **Step 1: Expose the shared media cache**

In `RemoteAudioAsset.java`, change the cache field's declaration from `private static SimpleCache cache;` to:

```java
    // PATCH: package-private so PlaybackQueue can share the one cache rather
    // than open a second SimpleCache over the same directory — two instances
    // pointed at one folder is an IllegalStateException in media3, and one
    // cache is also what lets Settings report a single honest number.
    static SimpleCache cache;
```

Then add this method to the class, immediately after `clearCache`:

```java
    /**
     * PATCH: the one SimpleCache both RemoteAudioAsset and PlaybackQueue use.
     * Creates it on first call with the same directory, size and evictor the
     * player path has always used.
     */
    @UnstableApi
    static synchronized SimpleCache sharedCache(Context context) {
        if (cache == null) {
            File cacheDir = new File(context.getCacheDir(), "media");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            cache = new SimpleCache(
                cacheDir,
                new LeastRecentlyUsedCacheEvictor(MAX_CACHE_SIZE),
                new StandaloneDatabaseProvider(context)
            );
        }
        return cache;
    }
```

Replace the cache-creating block inside `initializePlayer` (the `if (cache == null) { ... }` block) with:

```java
        SimpleCache sharedCache = sharedCache(owner.getContext());
```

and change the `CacheDataSource.Factory` line `.setCache(cache)` to `.setCache(sharedCache)`.

- [ ] **Step 2: Write PlaybackQueue.java**

Create the file with exactly this content:

```java
package ee.forgr.audio;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import java.util.ArrayList;
import java.util.List;

/**
 * PATCH: the whole remaining playlist, driven by native.
 *
 * The app that owns this patch reads Thai legal statutes aloud, one paragraph
 * per audio file, and its playback loop used to live in JavaScript: native
 * reported "clip finished" and JavaScript answered with "play the next one".
 * A device session on 2026-08-12 showed why that cannot work in the
 * background — the WebView's JavaScript engine stops running about 80 seconds
 * after the app leaves the screen, while the process, the foreground service
 * and the player all stay healthy. The clip that was to play next had already
 * been downloaded and was sitting loaded when the silence began; the only
 * thing missing was the instruction to start it.
 *
 * So the queue moved here. ExoPlayer already supplies almost all of it —
 * playlist, gapless advance, buffering ahead, the shared disk cache, repeat
 * off/all, playback speed, and audio-focus handling (ducking, pausing for a
 * notification, stopping for a phone call). What is written by hand is only
 * what ExoPlayer has no opinion about: repeating one section, retrying a
 * failed download before giving up, and never skipping a paragraph.
 */
@UnstableApi
class PlaybackQueue {

    /** One paragraph: where its audio is, and where it sits in the playlist. */
    static class Entry {

        final String url;
        final String title;
        final String artist;
        final String artworkUrl;
        final int itemIndex;
        final int paraIndex;

        Entry(String url, String title, String artist, String artworkUrl, int itemIndex, int paraIndex) {
            this.url = url;
            this.title = title;
            this.artist = artist;
            this.artworkUrl = artworkUrl;
            this.itemIndex = itemIndex;
            this.paraIndex = paraIndex;
        }
    }

    interface Callback {
        void onAdvance(int index, Entry entry);
        void onEnded();
        void onStalled(int index, Entry entry, String error);
        void onPlayingChanged(boolean playing);
    }

    static final String REPEAT_OFF = "off";
    static final String REPEAT_SECTION = "section";
    static final String REPEAT_ALL = "all";

    // Three retries, widening. A brief mobile-network stall is the common case
    // and clears well inside the first two; anything still failing after eight
    // seconds is not a blip. Skipping the paragraph instead was considered and
    // rejected: silently dropping a paragraph of a statute is worse for a
    // listener than stopping somewhere they can find again.
    private static final long[] RETRY_DELAYS_MS = { 1000L, 3000L, 8000L };

    private final Context context;
    private final Callback callback;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private ExoPlayer player;
    private final List<Entry> entries = new ArrayList<>();
    private String repeat = REPEAT_OFF;
    private int retries = 0;
    private boolean stalled = false;
    private String error = null;
    // Which section repeat-section is holding. Captured when playback starts
    // or the listener skips, not read from the current entry each time: the
    // whole point is to notice when the queue tries to leave that section.
    private int sectionAnchor = -1;

    PlaybackQueue(Context context, Callback callback) {
        this.context = context;
        this.callback = callback;
    }

    // ── lifecycle ────────────────────────────────────────────────────────────

    private void ensurePlayer() {
        if (player != null) {
            return;
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(15000);

        CacheDataSource.Factory cacheFactory = new CacheDataSource.Factory()
            .setCache(RemoteAudioAsset.sharedCache(context))
            .setUpstreamDataSourceFactory(http)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);

        player = new ExoPlayer.Builder(context)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(cacheFactory))
            .build();

        // handleAudioFocus = true hands ExoPlayer the whole focus problem:
        // duck for a navigation prompt, pause for a notification and resume
        // after it, stop for a phone call. Doing this by hand is what left the
        // JavaScript loop waiting forever on a clip that had already been
        // stopped underneath it.
        player.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .build(),
            true
        );
        // A partial wake lock plus a wifi lock, held only while actually
        // playing and released as soon as playback stops.
        player.setWakeMode(C.WAKE_MODE_NETWORK);

        player.addListener(
            new Player.Listener() {
                @Override
                public void onMediaItemTransition(MediaItem mediaItem, int reason) {
                    handleTransition();
                }

                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) {
                        retries = 0;
                        stalled = false;
                        error = null;
                    } else if (state == Player.STATE_ENDED) {
                        handleEnded();
                    }
                }

                @Override
                public void onIsPlayingChanged(boolean isPlaying) {
                    callback.onPlayingChanged(isPlaying);
                }

                @Override
                public void onPlayerError(PlaybackException e) {
                    handleError(e);
                }
            }
        );
    }

    void setQueue(List<Entry> newEntries, int startIndex, String newRepeat, float rate) {
        ensurePlayer();
        entries.clear();
        entries.addAll(newEntries);
        retries = 0;
        stalled = false;
        error = null;

        List<MediaItem> items = new ArrayList<>(entries.size());
        for (Entry e : entries) {
            items.add(
                new MediaItem.Builder()
                    .setUri(e.url)
                    .setMediaMetadata(new MediaMetadata.Builder().setTitle(e.title).setArtist(e.artist).build())
                    .build()
            );
        }

        int start = Math.max(0, Math.min(startIndex, Math.max(0, entries.size() - 1)));
        sectionAnchor = entries.isEmpty() ? -1 : entries.get(start).itemIndex;

        applyRepeat(newRepeat);
        player.setPlaybackSpeed(rate <= 0 ? 1f : rate);
        player.setMediaItems(items, start, 0L);
        player.prepare();
        player.play();
        // setMediaItems does not fire onMediaItemTransition for the item it
        // starts on, so the first paragraph would never be announced.
        callback.onAdvance(start, entries.get(start));
    }

    void skipTo(int index) {
        if (player == null || index < 0 || index >= entries.size()) {
            return;
        }
        retries = 0;
        stalled = false;
        error = null;
        sectionAnchor = entries.get(index).itemIndex;
        player.seekTo(index, 0L);
        player.play();
    }

    void pause() {
        if (player != null) {
            player.pause();
        }
    }

    void resume() {
        if (player == null) {
            return;
        }
        if (stalled) {
            // Whatever failed may work now — a resume is the listener asking
            // for exactly that, so try the paragraph again rather than sitting
            // on the stall.
            retries = 0;
            stalled = false;
            error = null;
            player.prepare();
        }
        player.play();
    }

    void clear() {
        if (player != null) {
            player.release();
            player = null;
        }
        entries.clear();
        handler.removeCallbacksAndMessages(null);
        retries = 0;
        stalled = false;
        error = null;
        sectionAnchor = -1;
    }

    void setRepeat(String newRepeat) {
        applyRepeat(newRepeat);
        if (REPEAT_SECTION.equals(repeat) && isActive()) {
            sectionAnchor = entries.get(index()).itemIndex;
        }
    }

    void setRate(float rate) {
        if (player != null) {
            player.setPlaybackSpeed(rate <= 0 ? 1f : rate);
        }
    }

    // ── state ────────────────────────────────────────────────────────────────

    boolean isActive() {
        return player != null && !entries.isEmpty();
    }

    int index() {
        if (!isActive()) {
            return -1;
        }
        int i = player.getCurrentMediaItemIndex();
        return (i >= 0 && i < entries.size()) ? i : -1;
    }

    Entry current() {
        int i = index();
        return i < 0 ? null : entries.get(i);
    }

    boolean isPlaying() {
        return player != null && player.isPlaying();
    }

    boolean isStalled() {
        return stalled;
    }

    String error() {
        return error;
    }

    // ── internals ────────────────────────────────────────────────────────────

    private void applyRepeat(String newRepeat) {
        repeat = (newRepeat == null) ? REPEAT_OFF : newRepeat;
        if (player == null) {
            return;
        }
        // Only "all" maps onto ExoPlayer's own repeat. "section" is handled in
        // handleTransition/handleEnded, because ExoPlayer's REPEAT_MODE_ONE
        // repeats one media item — one paragraph — and a section is however
        // many paragraphs it happens to have.
        player.setRepeatMode(REPEAT_ALL.equals(repeat) ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF);
    }

    private int firstIndexOfSection(int itemIndex) {
        for (int i = 0; i < entries.size(); i++) {
            if (entries.get(i).itemIndex == itemIndex) {
                return i;
            }
        }
        return -1;
    }

    private void handleTransition() {
        int i = index();
        if (i < 0) {
            return;
        }
        Entry e = entries.get(i);

        if (REPEAT_SECTION.equals(repeat) && sectionAnchor >= 0 && e.itemIndex != sectionAnchor) {
            int back = firstIndexOfSection(sectionAnchor);
            if (back >= 0) {
                player.seekTo(back, 0L);
                return; // the seek fires its own transition
            }
        }

        retries = 0;
        callback.onAdvance(i, e);
    }

    private void handleEnded() {
        if (REPEAT_SECTION.equals(repeat) && sectionAnchor >= 0) {
            int back = firstIndexOfSection(sectionAnchor);
            if (back >= 0) {
                player.seekTo(back, 0L);
                player.play();
                return;
            }
        }
        callback.onEnded();
    }

    private void handleError(PlaybackException e) {
        int i = index();
        Entry entry = i < 0 ? null : entries.get(i);

        if (retries < RETRY_DELAYS_MS.length) {
            long delay = RETRY_DELAYS_MS[retries];
            retries++;
            handler.postDelayed(
                () -> {
                    if (player != null) {
                        player.prepare();
                        player.play();
                    }
                },
                delay
            );
            return;
        }

        stalled = true;
        error = e.getErrorCodeName();
        callback.onStalled(i, entry, error);
    }
}
```

- [ ] **Step 3: Commit the Java (it is compiled in Task 5's CI run)**

```bash
git add node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/PlaybackQueue.java \
        node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/RemoteAudioAsset.java
git commit -m "feat(android): ExoPlayer-backed playback queue"
```

Note: `node_modules` is normally git-ignored. If the add is refused, that is expected — the Java lives in the patch instead, and Task 7 regenerates it. Skip this commit in that case and carry the working-tree changes into Task 5.

---

### Task 5: Plugin methods and media-session routing

**Files:**
- Modify: `node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/NativeAudio.java`

**Interfaces:**
- Consumes: everything Task 4 produced.
- Produces: the plugin methods `setQueue`, `skipToQueueIndex`, `pauseQueue`, `resumeQueue`, `setQueueRepeat`, `setQueueRate`, `getQueueState`, `clearQueue`, matching spec §6.1, plus the events `queueAdvance`, `queueEnded`, `queueStalled` from §6.2.

- [ ] **Step 1: Add the field and the callback**

Add next to the other fields (near `private MediaSessionCompat mediaSession;`):

```java
    // PATCH: the native-driven playlist. Null until the app hands one over.
    private PlaybackQueue playbackQueue;
```

Add these methods to the class, immediately before `dispatchComplete`:

```java
    // PATCH: everything below drives the native playback queue. See
    // PlaybackQueue.java for why the queue had to leave JavaScript.

    private PlaybackQueue queue() {
        if (playbackQueue == null) {
            playbackQueue = new PlaybackQueue(
                getContext(),
                new PlaybackQueue.Callback() {
                    @Override
                    public void onAdvance(int index, PlaybackQueue.Entry entry) {
                        JSObject ret = new JSObject();
                        ret.put("index", index);
                        ret.put("itemIndex", entry.itemIndex);
                        ret.put("paraIndex", entry.paraIndex);
                        notifyListeners("queueAdvance", ret);
                        startForegroundPlaybackService();
                        showQueueNotification(entry, true);
                    }

                    @Override
                    public void onEnded() {
                        notifyListeners("queueEnded", new JSObject());
                        clearNotification();
                    }

                    @Override
                    public void onStalled(int index, PlaybackQueue.Entry entry, String error) {
                        JSObject ret = new JSObject();
                        ret.put("index", index);
                        ret.put("itemIndex", entry == null ? -1 : entry.itemIndex);
                        ret.put("paraIndex", entry == null ? -1 : entry.paraIndex);
                        ret.put("error", error);
                        notifyListeners("queueStalled", ret);
                        // Deliberately NOT clearNotification(): a stall is the
                        // one moment a listener needs the card most, because it
                        // is the only thing on screen that says where playback
                        // stopped. Left up, showing paused.
                        if (entry != null) {
                            showQueueNotification(entry, false);
                        }
                    }

                    @Override
                    public void onPlayingChanged(boolean playing) {
                        updatePlaybackState(
                            playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED
                        );
                        PlaybackQueue.Entry entry = playbackQueue == null ? null : playbackQueue.current();
                        if (entry != null) {
                            showQueueNotification(entry, playing);
                        }
                    }
                }
            );
        }
        return playbackQueue;
    }

    // Reuses artworkCache, so the one cover image this app uses is fetched and
    // decoded once per process rather than once per paragraph.
    private void showQueueNotification(PlaybackQueue.Entry entry, boolean isPlaying) {
        if (!showNotification) {
            return;
        }
        Bitmap art = isStringValid(entry.artworkUrl) ? artworkCache.get(entry.artworkUrl) : null;
        if (art == null && isStringValid(entry.artworkUrl)) {
            final String url = entry.artworkUrl;
            final String title = entry.title;
            final String artist = entry.artist;
            new Thread(() -> {
                Bitmap fetched = loadArtwork(url);
                if (fetched != null) {
                    artworkCache.put(url, fetched);
                    getActivity().runOnUiThread(() -> showNotification(title, artist, fetched, isPlaying));
                }
            }).start();
        }
        showNotification(entry.title, entry.artist, art, isPlaying);
    }

    @PluginMethod
    public void setQueue(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                JSArray raw = call.getArray("entries");
                List<PlaybackQueue.Entry> parsed = new ArrayList<>();
                if (raw != null) {
                    for (Object o : raw.toList()) {
                        JSONObject j = (JSONObject) o;
                        parsed.add(
                            new PlaybackQueue.Entry(
                                j.optString("url", ""),
                                j.optString("title", ""),
                                j.optString("artist", ""),
                                j.optString("artworkUrl", ""),
                                j.optInt("itemIndex", -1),
                                j.optInt("paraIndex", 0)
                            )
                        );
                    }
                }
                if (parsed.isEmpty()) {
                    call.reject("queue is empty");
                    return;
                }
                queue().setQueue(
                    parsed,
                    call.getInt("startIndex", 0),
                    call.getString("repeat", PlaybackQueue.REPEAT_OFF),
                    call.getFloat("rate", 1f)
                );
                call.resolve();
            } catch (Exception ex) {
                Log.e(TAG, "setQueue failed", ex);
                call.reject("setQueue failed: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void skipToQueueIndex(final PluginCall call) {
        final int index = call.getInt("index", -1);
        getActivity().runOnUiThread(() -> {
            queue().skipTo(index);
            call.resolve();
        });
    }

    @PluginMethod
    public void pauseQueue(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            queue().pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void resumeQueue(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            queue().resume();
            call.resolve();
        });
    }

    @PluginMethod
    public void setQueueRepeat(final PluginCall call) {
        final String repeat = call.getString("repeat", PlaybackQueue.REPEAT_OFF);
        getActivity().runOnUiThread(() -> {
            queue().setRepeat(repeat);
            call.resolve();
        });
    }

    @PluginMethod
    public void setQueueRate(final PluginCall call) {
        final float rate = call.getFloat("rate", 1f);
        getActivity().runOnUiThread(() -> {
            queue().setRate(rate);
            call.resolve();
        });
    }

    @PluginMethod
    public void getQueueState(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject ret = new JSObject();
            PlaybackQueue q = playbackQueue;
            PlaybackQueue.Entry entry = (q == null) ? null : q.current();
            ret.put("index", q == null ? -1 : q.index());
            ret.put("itemIndex", entry == null ? -1 : entry.itemIndex);
            ret.put("paraIndex", entry == null ? -1 : entry.paraIndex);
            ret.put("playing", q != null && q.isPlaying());
            ret.put("stalled", q != null && q.isStalled());
            ret.put("error", q == null ? null : q.error());
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void clearQueue(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (playbackQueue != null) {
                playbackQueue.clear();
            }
            clearNotification();
            call.resolve();
        });
    }
```

Add the imports these need, alongside the existing imports:

```java
import com.getcapacitor.JSArray;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;
```

- [ ] **Step 2: Find the artwork loader this reuses**

Run: `grep -n "Bitmap loadArtwork\|private Bitmap" node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/NativeAudio.java`

If the existing helper has a different name than `loadArtwork(String)`, change the call in `showQueueNotification` to match it. If no such helper exists, add this one immediately above `showQueueNotification`:

```java
    private Bitmap loadArtwork(String url) {
        try {
            java.net.URLConnection conn = new java.net.URL(url).openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            try (java.io.InputStream in = conn.getInputStream()) {
                return android.graphics.BitmapFactory.decodeStream(in);
            }
        } catch (Exception ex) {
            Log.e(TAG, "artwork fetch failed: " + url, ex);
            return null;
        }
    }
```

- [ ] **Step 3: Route the lock-screen buttons to the queue**

The lock-screen transport currently reports the button press to JavaScript and lets it act — which is why the buttons stop working once JavaScript freezes. When a queue is loaded, act natively instead.

In the `mediaSession.setCallback(...)` block, add this line as the **first statement** of each named callback:

```java
                public void onPlay() {
                    if (playbackQueue != null && playbackQueue.isActive()) { playbackQueue.resume(); return; }
```

```java
                public void onPause() {
                    if (playbackQueue != null && playbackQueue.isActive()) { playbackQueue.pause(); return; }
```

```java
                public void onStop() {
                    if (playbackQueue != null && playbackQueue.isActive()) { playbackQueue.clear(); clearNotification(); return; }
```

For `onSkipToNext` and `onSkipToPrevious`, the queue moves by section rather than by paragraph — the same unit the JavaScript handlers used. Add as the first statement of each:

```java
                public void onSkipToNext() {
                    if (playbackQueue != null && playbackQueue.isActive()) { skipQueueSection(1); return; }
```

```java
                public void onSkipToPrevious() {
                    if (playbackQueue != null && playbackQueue.isActive()) { skipQueueSection(-1); return; }
```

And add this helper next to the other queue methods:

```java
    // Lock-screen skip moves by section, not by paragraph: someone listening
    // with the screen off is trying to leave the section, not the line.
    private void skipQueueSection(int direction) {
        PlaybackQueue q = playbackQueue;
        if (q == null || !q.isActive()) {
            return;
        }
        PlaybackQueue.Entry here = q.current();
        if (here == null) {
            return;
        }
        int target = here.itemIndex + direction;
        int i = q.indexOfSection(target);
        // Before the first section, restart the one playing — the same thing
        // every other player does with a previous-track press.
        if (i < 0 && direction < 0) {
            i = q.indexOfSection(here.itemIndex);
        }
        if (i >= 0) {
            q.skipTo(i);
        }
    }
```

- [ ] **Step 4: Add the lookup that helper needs to PlaybackQueue.java**

Add to `PlaybackQueue`, next to `firstIndexOfSection`:

```java
    /** Package-private view of firstIndexOfSection, for lock-screen skips. */
    int indexOfSection(int itemIndex) {
        return firstIndexOfSection(itemIndex);
    }
```

- [ ] **Step 5: Verify it compiles**

Local Gradle builds do not work in this environment, so compilation is checked by CI:

```bash
git add -A && git commit -m "feat(android): plugin methods and lock-screen routing for the queue"
git push
```

Then watch the Android workflow:

```bash
gh run watch
```

Expected: `build-aab.yml` succeeds. If `javac` reports an error, fix it and push again before continuing — every later task assumes this compiles.

---

### Task 6: Report the media cache in Settings

Files fetched by native land in the plugin's ExoPlayer cache, which `AudioStorageRow` cannot see today, so the number shown to the listener is lower than what is actually on their phone (spec §9).

**Files:**
- Modify: `node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/NativeAudio.java`
- Modify: `src/lib/audioCache.js`
- Modify: `src/components/AudioStorageRow.jsx`
- Test: `src/lib/audioCache.test.js`

**Interfaces:**
- Consumes: `RemoteAudioAsset.sharedCache(Context)` from Task 4.
- Produces: `NativeAudio.getMediaCacheBytes() => { bytes }`; `mediaCacheBytes(): Promise<number>` from `src/lib/audioCache.js`.

- [ ] **Step 1: Add the native size method**

Add to `NativeAudio.java`, next to the existing `clearCache` plugin method:

```java
    @PluginMethod
    public void getMediaCacheBytes(final PluginCall call) {
        JSObject ret = new JSObject();
        try {
            ret.put("bytes", RemoteAudioAsset.sharedCache(getContext()).getCacheSpace());
        } catch (Exception ex) {
            Log.e(TAG, "getMediaCacheBytes failed", ex);
            ret.put("bytes", 0);
        }
        call.resolve(ret);
    }
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/audioCache.test.js`:

```js
describe('mediaCacheBytes', () => {
  // Audio fetched by the native queue lands in the plugin's own ExoPlayer
  // cache, not in the app's. Without this the storage row in Settings reports
  // a number well under what is really on the phone.
  it('reports what the plugin holds', async () => {
    const { NativeAudio } = await import('@capgo/native-audio');
    NativeAudio.getMediaCacheBytes.mockResolvedValue({ bytes: 4096 });
    const { mediaCacheBytes } = await import('./audioCache');
    await expect(mediaCacheBytes()).resolves.toBe(4096);
  });

  it('reports zero rather than throwing when the plugin has no answer', async () => {
    const { NativeAudio } = await import('@capgo/native-audio');
    NativeAudio.getMediaCacheBytes.mockRejectedValue(new Error('not implemented'));
    const { mediaCacheBytes } = await import('./audioCache');
    await expect(mediaCacheBytes()).resolves.toBe(0);
  });
});
```

If `src/lib/audioCache.test.js` does not already mock `@capgo/native-audio`, add at the top of the file:

```js
vi.mock('@capgo/native-audio', () => ({
  NativeAudio: { getMediaCacheBytes: vi.fn(), clearCache: vi.fn() },
}));
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/audioCache.test.js`
Expected: FAIL — `mediaCacheBytes is not a function`

- [ ] **Step 4: Implement it**

Add to `src/lib/audioCache.js`, and add `import { NativeAudio } from '@capgo/native-audio';` to its imports:

```js
// What the plugin's own ExoPlayer cache holds. The native queue fetches
// straight into it, so audio downloaded while the app was backgrounded is
// invisible to the folder this module manages — reporting only that folder
// would tell the listener their audio takes less room than it does.
export async function mediaCacheBytes() {
  if (!isNative()) return 0;
  try {
    const { bytes } = await NativeAudio.getMediaCacheBytes();
    return typeof bytes === 'number' ? bytes : 0;
  } catch {
    return 0;
  }
}
```

Then extend `clearCache` so clearing means clearing. Add as the last statement before it returns, when called with no voice argument:

```js
  if (voice === null) {
    await Promise.resolve(NativeAudio.clearCache()).catch(() => {});
  }
```

- [ ] **Step 5: Show it in Settings**

In `src/components/AudioStorageRow.jsx`, change the import to include the new function:

```jsx
import { cacheBytes, cacheBytesByVoice, mediaCacheBytes, clearCache } from '../lib/audioCache';
```

and replace the `cacheBytes().then(setBytes)` line with:

```jsx
    Promise.all([cacheBytes(), mediaCacheBytes()])
      .then(([own, media]) => setBytes(own + media))
      .catch(() => setBytes(0));
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS, 462 tests

- [ ] **Step 7: Commit**

```bash
git add src/lib/audioCache.js src/lib/audioCache.test.js src/components/AudioStorageRow.jsx \
        node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/NativeAudio.java
git commit -m "fix(settings): count the plugin's media cache in the storage row"
```

---

### Task 7: Regenerate the patch, bump the version, prove it on the device

**Files:**
- Modify: `patches/@capgo+native-audio+8.4.2.patch`
- Modify: `android/app/build.gradle`, `src/config.js`, `ios/App/App.xcodeproj/project.pbxproj` (all through `npm run bump`)

- [ ] **Step 1: Regenerate the patch**

```bash
npx patch-package @capgo/native-audio
```

Expected: `patches/@capgo+native-audio+8.4.2.patch` updated, now including `PlaybackQueue.java`.

- [ ] **Step 2: Prove the patch actually reapplies**

A patch that only works against the tree it was cut from is worse than none — it passes here and fails for CI.

```bash
rm -rf node_modules/@capgo/native-audio
npm install
grep -c "PlaybackQueue" node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/NativeAudio.java
ls node_modules/@capgo/native-audio/android/src/main/java/ee/forgr/audio/PlaybackQueue.java
```

Expected: `npm install` runs `patch-package` cleanly with no "failed to apply" warning, the grep finds several matches, and `PlaybackQueue.java` exists.

- [ ] **Step 3: Bump the version**

```bash
npm run bump
```

Expected: build 81, and the four version locations stay in agreement. If it refuses, the locations have drifted — fix that first.

- [ ] **Step 4: Commit and build**

```bash
git add patches/ android/app/build.gradle src/config.js ios/App/App.xcodeproj/project.pbxproj
git commit -m "build: native playback queue, build 81"
git push
gh run watch
```

Expected: `build-aab.yml` succeeds and produces the AAB.

- [ ] **Step 5: Install the build and clear the old diagnostics**

Install build 81 on the device, then in the app open Settings → บันทึกปัญหาเสียง and clear all three logs.

- [ ] **Step 6: Run the acceptance test (spec §4 and §10.2)**

With the phone connected over USB, start playing a long queue, press Home, then run:

```bash
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
PID=$("$ADB" shell pidof com.lawcodev2.app | tr -d '\r\n')
for i in $(seq 1 1200); do
  echo "$(date +%H:%M:%S) : $("$ADB" shell "dumpsys audio | grep '/$PID state:'" | sed -E 's/.*piid:([0-9]+).*state:([a-z]+).*/\1=\2/' | tr -d '\r' | tr '\n' ' ')"
  sleep 3
done
```

**Pass:** for the full 60 minutes a player is `started` at every sample and the piid numbers keep climbing — the queue is still advancing. **Fail:** any run of samples with no `started` player.

- [ ] **Step 7: Confirm the signature that proves the cause was addressed**

Reopen the app, go to Settings → บันทึกปัญหาเสียง.

Expected: both heartbeats stop about a minute after the app was backgrounded — JavaScript still freezes, exactly as before — while the hour of audio played anyway. That contrast is the evidence that JavaScript is out of the critical path rather than merely delayed. If the heartbeats instead ran the whole hour, something kept the WebView awake and the test did not exercise what it was meant to; re-run it with the screen off.

- [ ] **Step 8: Record the result**

```bash
git commit --allow-empty -m "test: 60-minute background playback verified on device"
git push
```

---

## Rollback

If the queue misbehaves on real devices, set `USE_NATIVE_QUEUE = false` in `src/config.js`, bump, and ship. Android returns to the JavaScript loop with no other change; nothing else in this plan needs reverting.
