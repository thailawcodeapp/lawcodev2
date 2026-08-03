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
let _configured = false;
let _configuring = null;
let _current = null;   // { assetId, resolve, reject }
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
    await NativeAudio.configure({ background: true, showNotification: true, focus: true });
    _listener = await NativeAudio.addListener('complete', ({ assetId }) => {
      if (!_current || assetId !== _current.assetId) return;   // a stale asset
      const done = _current;
      _current = null;
      fireAndForget(NativeAudio.unload({ assetId: done.assetId }));
      done.resolve();
    });
    _configured = true;
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
  await ensureSession();
  try {
    await NativeAudio.preload({ assetId: `pre-${uri}`, assetPath: uri, isUrl: true });
  } catch {
    // A preload failure must not break anything: the file is fetched again
    // at play time, so swallow it here rather than surfacing it to a caller
    // that only wanted a best-effort head start.
  }
}

export function playFile(uri, { rate = 1 } = {}) {
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

    const assetId = nextAssetId();
    // Register the pending clip before awaiting the preload, not after: a
    // stop() (or a second playFile) that arrives while the preload is still
    // in flight needs to find this clip so it can reject it. Assigning
    // _current only after preload resolves left a window where stopAudio saw
    // _current === null, did nothing, and the clip then played through and
    // RESOLVED — a stop that silently advanced the playlist instead of
    // halting it.
    const pending = { assetId, resolve, reject };
    _current = pending;

    (async () => {
      await ensureSession();
      await NativeAudio.preload({ assetId, assetPath: uri, isUrl: true });
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
