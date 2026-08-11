// Plays one clip and resolves when it ends — the same contract speakOne() has
// always had, so the play loop above it does not change.
//
// @capgo/native-audio rather than an HTML5 element: device testing showed a
// backgrounded WKWebView cannot re-activate an audio session iOS closed during
// a silent gap, and the acceptable gap turned out to be zero seconds. Handing
// the session to AVFoundation is also what survives a phone call mid-playlist.
// See spec §7.9.
import { NativeAudio } from '@capgo/native-audio';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

let _listener = null;
// Loaded at full volume explicitly. A clip that follows the device voice was
// heard starting quiet and climbing, which reads as a fault in the new voice
// rather than in the handover — and the plugin only guarantees the level it
// was given, not whatever the previous engine left the session at.
const FULL_VOLUME = 1.0;

// Lock-screen / notification transport. The plugin surfaces these as
// `playbackState` events whose `reason` names the button pressed; it has no
// next/previous-track command at all, so fast-forward and rewind stand in for
// "next section" and "previous section". Skipping by paragraph would be the
// wrong unit anyway — someone listening to a queue with the screen off wants
// the next section, not the next line of the one they are on.
//
// Registered by tts.js, which owns the playlist. Without them the buttons
// still work at the audio layer but the app's own state never learns what
// happened, so the in-app player keeps showing "playing" after a pause on the
// lock screen.
let _remote = {};
export function setRemoteHandlers(handlers) {
  _remote = handlers || {};
}

const REMOTE_ACTIONS = {
  remotePlay: 'onPlay',
  remotePause: 'onPause',
  remoteStop: 'onStop',
  remoteFastForward: 'onNext',
  remoteRewind: 'onPrev',
};

let _configured = false;
let _configuring = null;
let _current = null;   // { assetId, resolve, reject }
let _preloaded = null; // { uri, assetId } — at most one held preload at a time
let _seq = 0;

// One asset id per play, never the hash: preloading the next paragraph while
// the current one plays means two assets are loaded at once, and a completion
// event carries only an assetId to tell them apart.
const nextAssetId = () => `para-${++_seq}`;

async function ensureSession() {
  // background keeps playing under a locked screen; showNotification gives the
  // lock-screen controls; focus takes audio focus from other apps on Android.
  //
  // Configured exactly once, ever, for the life of the module. Re-applying the
  // AVAudioSession category or re-taking Android audio focus mid-playlist is
  // unverified behaviour the device spike never exercised, and the 'complete'
  // listener must never be removed/re-registered while a clip is in flight:
  // a preload for the next paragraph can happen while the current clip is
  // still playing, and the gap between removing an old listener and awaiting
  // a new one is a window where a genuine completion event has nowhere to
  // land — its promise would never settle and the playlist would freeze.
  if (_configured) return;
  if (_configuring) return _configuring;
  _configuring = (async () => {
    try {
      await NativeAudio.configure({
        background: true,
        backgroundPlayback: true,
        showNotification: true,
        focus: true,
      });
      _listener = await NativeAudio.addListener('complete', ({ assetId }) => {
        if (!_current || assetId !== _current.assetId) return;   // a stale asset
        const done = _current;
        _current = null;
        fireAndForget(NativeAudio.unload({ assetId: done.assetId }));
        done.resolve();
      });

      // Transport pressed on the lock screen or in the notification shade.
      // Only remote reasons are forwarded: 'play'/'pause' are also emitted for
      // actions the app itself just took, and handing those back would have
      // resume() call itself.
      //
      // Registered alongside the 'complete' listener, inside the same
      // configure-once block, for the same reason that one is: re-registering
      // while a clip is in flight opens a window where a genuine event has
      // nowhere to land.
      await NativeAudio.addListener('playbackState', ({ reason }) => {
        const handler = _remote[REMOTE_ACTIONS[reason]];
        if (handler) handler();
      });

      _configured = true;
    } catch (err) {
      // A failed configure must not brick the module for the rest of the
      // process: clear the in-flight marker so the next playFile/preloadFile
      // retries instead of forever re-rejecting with this same stale error.
      _configuring = null;
      throw err;
    }
  })();
  await _configuring;
}

// Native calls below are fire-and-forget: we don't need their result, only to
// swallow a rejection so a failed unload/stop/pause doesn't crash the caller.
function fireAndForget(maybePromise) {
  Promise.resolve(maybePromise).catch(() => {});
}

export async function preloadFile(uri) {
  if (!isNative() || !uri) return;
  if (_preloaded && _preloaded.uri === uri) return; // already held, nothing to do

  // The URI currently in flight must never be re-preloaded: its assetId is
  // live in _current, and reloading over it would unload the very asset
  // that's playing out from under it once the "preload" completes, with
  // nothing left to ever produce a 'complete' event for it again.
  if (_current && _current.uri === uri) return;

  await ensureSession();

  // At most one preloaded asset is held at a time: a different URI arriving
  // (the playlist advanced before the held one was ever played) must unload
  // the stale one first, or preloads would accumulate one per paragraph
  // across a playlist that can hold thousands.
  if (_preloaded) {
    const stale = _preloaded;
    _preloaded = null;
    fireAndForget(NativeAudio.unload({ assetId: stale.assetId }));
  }

  const assetId = `pre-${uri}`;
  try {
    await NativeAudio.preload({ assetId, assetPath: uri, isUrl: true, volume: FULL_VOLUME });
    _preloaded = { uri, assetId };
  } catch {
    // A preload failure must not break anything: the file is fetched again
    // at play time, so swallow it here rather than surfacing it to a caller
    // that only wanted a best-effort head start.
  }
}

// `metadata` is what the lock screen shows: { title, artist }. It is passed
// per clip rather than set once, because each paragraph is its own asset and
// the notification reflects whichever asset is currently loaded — a section
// spanning eight paragraphs would otherwise show the title of paragraph one
// for the whole section and then whatever the queue moved on to.
export function playFile(uri, { rate = 1, metadata } = {}) {
  return new Promise((resolve, reject) => {
    if (!isNative()) { reject(new Error('audio playback needs a native platform')); return; }

    // A new play supersedes whatever was current: reject it now with the same
    // 'canceled' shape stopAudio uses, so its promise doesn't hang forever.
    if (_current) {
      const prev = _current;
      _current = null;
      fireAndForget(NativeAudio.stop({ assetId: prev.assetId }));
      fireAndForget(NativeAudio.unload({ assetId: prev.assetId }));
      prev.reject(new Error('canceled'));
    }

    // Reuse a held preload minted for this same URI, taking ownership of it
    // (and clearing the record so it isn't unloaded out from under us or
    // handed to a later preloadFile call) instead of loading the asset a
    // second time.
    let reusedAssetId = null;
    if (_preloaded && _preloaded.uri === uri) {
      reusedAssetId = _preloaded.assetId;
      _preloaded = null;
    }

    const assetId = reusedAssetId || nextAssetId();
    // Register the pending clip before awaiting the preload, not after: a
    // stop() (or a second playFile) that arrives while the preload is still
    // in flight needs to find this clip so it can reject it. Assigning
    // _current only after preload resolves left a window where stopAudio saw
    // _current === null, did nothing, and the clip then played through and
    // RESOLVED — a stop that silently advanced the playlist instead of
    // halting it.
    const pending = { assetId, uri, resolve, reject };
    _current = pending;

    (async () => {
      await ensureSession();
      if (!reusedAssetId) {
        await NativeAudio.preload({
          assetId, assetPath: uri, isUrl: true, volume: FULL_VOLUME,
          ...(metadata ? { notificationMetadata: metadata } : {}),
        });
      }
      // The preload may have taken long enough for a stop() or another
      // playFile() to have superseded this one. If so, its promise has
      // already been rejected above/in stopAudio — just don't play, and
      // clean up the asset we just finished loading.
      if (_current !== pending) {
        fireAndForget(NativeAudio.unload({ assetId }));
        return;
      }
      if (rate !== 1) await Promise.resolve(NativeAudio.setRate({ assetId, rate })).catch(() => {});
      await NativeAudio.play({ assetId });
    })().catch((err) => {
      if (_current === pending) _current = null;
      // A play that fails after loading (or reusing a preloaded) asset must
      // not leave it resident — every asset loaded is eventually unloaded,
      // finish, stop, supersession, or failure alike.
      fireAndForget(NativeAudio.unload({ assetId }));
      reject(err);
    });
  });
}

export function pauseAudio() {
  if (!_current) return;
  fireAndForget(NativeAudio.pause({ assetId: _current.assetId }));
}

export function resumeAudio() {
  if (!_current) return;
  fireAndForget(NativeAudio.resume({ assetId: _current.assetId }));
}

// Rejects rather than resolves, because the play loop reads a rejection as
// "canceled" and stops. Resolving would make a stop look like the paragraph
// finished and advance to the next one.
export function stopAudio() {
  // A warm preload left resident after stop has no future caller to unload
  // it — the playlist is done and nothing will ever ask for this URI again.
  if (_preloaded) {
    const stale = _preloaded;
    _preloaded = null;
    fireAndForget(NativeAudio.unload({ assetId: stale.assetId }));
  }

  if (!_current) return;
  const dying = _current;
  _current = null;
  fireAndForget(NativeAudio.stop({ assetId: dying.assetId }));
  fireAndForget(NativeAudio.unload({ assetId: dying.assetId }));
  dying.reject(new Error('canceled'));
}

export function isAudioActive() {
  return _current !== null;
}
