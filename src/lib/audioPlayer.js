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
let _current = null;   // { assetId, resolve, reject }
let _seq = 0;

// One asset id per play, never the hash: preloading the next paragraph while
// the current one plays means two assets are loaded at once, and a completion
// event carries only an assetId to tell them apart.
const nextAssetId = () => `para-${++_seq}`;

async function ensureSession() {
  // background keeps playing under a locked screen; showNotification gives the
  // lock-screen controls; focus takes audio focus from other apps on Android.
  // Configure on every call — cheap, idempotent, and guards against the OS
  // having dropped the session between clips.
  await NativeAudio.configure({ background: true, showNotification: true, focus: true });

  // Re-register the completion listener every time rather than once ever:
  // removing the previous handle first keeps a long playlist from stacking up
  // thousands of listeners over its lifetime.
  if (_listener) fireAndForget(_listener.remove?.());
  _listener = await NativeAudio.addListener('complete', ({ assetId }) => {
    if (!_current || assetId !== _current.assetId) return;   // a stale asset
    const done = _current;
    _current = null;
    fireAndForget(NativeAudio.unload({ assetId: done.assetId }));
    done.resolve();
  });
}

// Native calls below are fire-and-forget: we don't need their result, only to
// swallow a rejection so a failed unload/stop/pause doesn't crash the caller.
function fireAndForget(maybePromise) {
  Promise.resolve(maybePromise).catch(() => {});
}

export async function preloadFile(uri) {
  if (!isNative() || !uri) return;
  await ensureSession();
  fireAndForget(NativeAudio.preload({ assetId: `pre-${uri}`, assetPath: uri, isUrl: true }));
}

export function playFile(uri, { rate = 1 } = {}) {
  return new Promise((resolve, reject) => {
    if (!isNative()) { reject(new Error('audio playback needs a native platform')); return; }

    (async () => {
      await ensureSession();
      const assetId = nextAssetId();
      await NativeAudio.preload({ assetId, assetPath: uri, isUrl: true });
      _current = { assetId, resolve, reject };
      if (rate !== 1) await Promise.resolve(NativeAudio.setRate({ assetId, rate })).catch(() => {});
      await NativeAudio.play({ assetId });
    })().catch((err) => {
      _current = null;
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
