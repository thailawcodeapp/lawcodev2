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
  // Real skip-to-next/previous, added to the plugin by
  // patches/@capgo+native-audio+8.4.2.patch. Stock 8.4.2 registers no such
  // command on either platform: Android's notification had no skip buttons at
  // all, and iOS's skip-forward seeks fifteen seconds inside the current clip,
  // which on a paragraph shorter than that reads as restarting the section.
  remoteNextTrack: 'onNext',
  remotePreviousTrack: 'onPrev',
  // The seek-based pair the patch turns off, kept mapped so a build running
  // against an unpatched plugin still moves by section rather than doing
  // nothing at all.
  remoteFastForward: 'onNext',
  remoteRewind: 'onPrev',
  // Android sends this when another app or the system takes audio focus away
  // permanently (a phone call, another player, a long-running alarm) — see
  // the KNOWN_REASONS comment below for the diagnosis this reuses onStop's
  // path to fix. Not a remote-control action, but the dispatch mechanism is
  // exactly what it needs: a real, tested "stop everything cleanly" callback.
  audioFocusLoss: 'onStop',
};

// Every `reason` the plugin's playbackState event can actually carry, other
// than the ones REMOTE_ACTIONS above already routes somewhere. Kept as an
// explicit allowlist rather than "anything unmapped is suspicious", because
// most of these ARE unmapped on purpose and are not a problem:
//
//   complete/play/pause/stop/resume — echoes of actions this file or tts.js
//     already took; reacting to them here would call our own handlers on
//     ourselves.
//   loop/playOnce — features this app does not use.
//   audioFocusGain — the other half of a transient loss, see next line.
//   audioFocusLossTransient — the plugin pauses the current asset and
//     resumes it itself once focus returns (its own internal resumeList),
//     so the clip's promise settles normally once that clip actually
//     finishes; mapping this to anything here would fight that, e.g.
//     mapping it to onPause would leave playback paused forever, because
//     nothing here maps audioFocusGain back to onPlay to undo it.
//   appPause/appResume — the Activity's own lifecycle, not a playback event.
//
// A `reason` reaching here that is in NEITHER this set NOR REMOTE_ACTIONS is
// exactly how audioFocusLoss went unnoticed for as long as it did: silently
// dropped, with nothing left behind to show it ever happened. Logged instead,
// so the next unmapped reason shows up in Settings rather than as another
// unexplained silence.
const KNOWN_INERT_REASONS = new Set([
  'complete', 'play', 'pause', 'stop', 'resume', 'loop', 'playOnce',
  'audioFocusGain', 'audioFocusLossTransient', 'appPause', 'appResume',
]);

let _configured = false;
let _configuring = null;
let _current = null;   // { assetId, resolve, reject }
let _preloaded = null; // { uri, assetId } — at most one held preload at a time
// The clip that just finished (or was superseded), NOT yet unloaded. See
// retire() — unloading it at the paragraph boundary is what tore the lock
// screen down and, on iOS, ended the audio session mid-playlist.
let _lingering = null; // { assetId }
let _seq = 0;

// One asset id per load, never the hash and never derived from the URI:
// preloading the next paragraph while the current one plays means two assets
// are loaded at once, a completion event carries only an assetId to tell them
// apart, and a retired clip can outlive the start of its successor. A counter
// is the only scheme where no two live assets can ever collide — a URI-derived
// id collides with itself the moment a section repeats.
const nextAssetId = () => `para-${++_seq}`;

// Hold a finished clip rather than unloading it now.
//
// Both plugins tear the lock-screen card down from native code the moment the
// asset that owns it is unloaded — Android's dispatchComplete calls
// clearNotification(), iOS's unload() calls clearNowPlayingInfo() — and iOS's
// unload() also runs endSession(), which deactivates the AVAudioSession
// whenever no asset is currently playing. At a paragraph boundary that is
// exactly the state we are in: the old clip has ended and the new one has not
// started. So every paragraph took the card away and gave the session back,
// which is the "player disappears between paragraphs" symptom and, once the
// screen has been off long enough that iOS refuses to reactivate a session
// from the background, the "playback stops on its own" one.
//
// Deferring the unload until the NEXT clip is playing means the card always
// has an owner and the session is never idle. At most one clip is ever held.
function retire(assetId) {
  if (_lingering && _lingering.assetId !== assetId) {
    fireAndForget(NativeAudio.unload({ assetId: _lingering.assetId }));
  }
  _lingering = assetId ? { assetId } : null;
}

// Drop the held clip, now that something else owns the session. Guarded
// against unloading an asset that is live again: nothing mints a duplicate id
// today, but the whole point of holding an asset past its own lifetime is that
// it is reachable from two places at once.
function releaseLingering() {
  if (!_lingering) return;
  const { assetId } = _lingering;
  _lingering = null;
  if (assetId === _current?.assetId || assetId === _preloaded?.assetId) return;
  fireAndForget(NativeAudio.unload({ assetId }));
}

export async function ensureSession() {
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
        retire(done.assetId);
        done.resolve();
      });

      // Transport pressed on the lock screen or in the notification shade —
      // and, since audioFocusLoss was added to REMOTE_ACTIONS above, a
      // permanent loss of audio focus too. Both dispatch through the same
      // path deliberately: on Android, `onAudioFocusChange`'s permanent-loss
      // branch stops the current asset natively but never fires 'complete'
      // and never rejects anything here, so without this the pending clip's
      // promise — and therefore the paragraph loop awaiting it — waited
      // forever with no error, on a phone that was never actually killed or
      // out of network: heartbeat evidence from a real device (Settings →
      // บันทึกปัญหาเสียง) showed the loop reaching a paragraph and then simply
      // never advancing past it, which is what a stuck await looks like from
      // outside, and this is the one path in the whole plugin that can leave
      // one stuck with nothing to say why. Routing it to onStop reuses
      // tts.js's real, already-tested "stop everything cleanly" handler
      // rather than re-deriving a second cancellation path here.
      //
      // Only remote reasons (and audioFocusLoss) are forwarded: 'play'/
      // 'pause' are also emitted for actions the app itself just took, and
      // handing those back would have resume() call itself.
      //
      // Registered alongside the 'complete' listener, inside the same
      // configure-once block, for the same reason that one is: re-registering
      // while a clip is in flight opens a window where a genuine event has
      // nowhere to land.
      await NativeAudio.addListener('playbackState', ({ reason }) => {
        const handler = _remote[REMOTE_ACTIONS[reason]];
        if (handler) { handler(); return; }
        if (!KNOWN_INERT_REASONS.has(reason)) {
          console.warn('[audio]', `unhandled playbackState reason: ${reason}`);
        }
      });

      // iOS's counterpart to audioFocusLoss, and the same suspected gap: the
      // plugin notifies that an interruption (a call, Siri, another app)
      // began, but does not itself stop or unload anything, and an
      // AVAudioPlayer's own "did finish" delegate is not expected to fire
      // just because the OS took the audio route away — so without this,
      // _current's promise could hang here too. Unverified on a real iOS
      // device; the conservative choice is to treat every interruption as a
      // full stop via the same onStop path, which is easy to recover from
      // (press play again) and cannot leave anything hanging silently the
      // way doing nothing already provably does on Android.
      //
      // `interrupted: false` — the interruption ending — is deliberately not
      // handled: by the time it fires, `interrupted: true` has already
      // treated this as a stop, so there is no still-waiting clip left to
      // resume.
      await NativeAudio.addListener('interrupt', ({ interrupted }) => {
        if (interrupted && _remote.onStop) _remote.onStop();
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

// `metadata` matters as much here as in playFile: an asset carries the
// notification text it was loaded with, and playFile adopts a warm preload
// without re-loading it. A preload made without metadata therefore plays with
// none — which is why only the first paragraph of a section, the one nothing
// had prefetched, ever showed a title on the lock screen.
export async function preloadFile(uri, metadata) {
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

  const assetId = nextAssetId();
  try {
    await NativeAudio.preload({
      assetId, assetPath: uri, isUrl: true, volume: FULL_VOLUME,
      ...(metadata ? { notificationMetadata: metadata } : {}),
    });
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
      // Retired rather than unloaded, for the same reason a finished clip is:
      // this path is the lock screen's own next/previous button, so unloading
      // here would blank the card in the half-second before the section the
      // user just asked for starts.
      retire(prev.assetId);
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
      // Only now: the new clip owns the notification and the audio session, so
      // dropping the one it replaced can no longer clear either.
      releaseLingering();
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
  // The retired clip's whole reason to still exist is that another one was
  // about to take over. Nothing is, so let it go — and on iOS this is the
  // unload that finally clears the Now Playing card and ends the session,
  // which is exactly right at the end of a playlist.
  releaseLingering();

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
