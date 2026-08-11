// A whisper-quiet, looping HTML5 <audio> element, played in the WebView for
// the whole duration of a native background playback session.
//
// The real audio is native (@capgo/native-audio) — from the WebView's own
// point of view, this page produces no sound at all. Chromium exempts a page
// it considers "audible" from its normal background-tab policy, which
// otherwise throttles and eventually freezes ALL JavaScript in a hidden page
// after a few minutes. That freeze would stop the very loop (tts.js's
// runLoop) that tells native what paragraph to play next — a plausible third
// explanation for playback going silent at a roughly fixed point after the
// screen turns off, on top of the Doze network cutoff and the CPU-suspend gap
// the foreground service and wake lock already close. Neither of those two
// touches this: both are about process/CPU state, not about what Chromium
// itself decides to do with a page it believes has nothing to say.
//
// Chromium's audible-tab detection is based on measured output level, not on
// whether something is nominally playing — muted or all-zero-sample media
// does not qualify. So this has to be real, unmuted, non-zero audio, just
// quiet enough that no one should ever consciously notice it — see
// scripts/make-keep-alive-wav.mjs for exactly how quiet and why that specific
// file loops with no click at the seam.
//
// This is an experiment, not a proven fix. It costs nothing to try before
// anything more invasive: worst case, it does nothing, and best case, it is
// far cheaper than moving playback control out of JavaScript entirely.

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

let _el = null;

// Quiet enough that it should be inaudible under any real content playing
// alongside it (voice, music, anything) — the file itself is already
// synthesized near-silent; this is a second, independent margin so a mistake
// in one place does not add up with a mistake in the other.
const VOLUME = 0.02;

export function startAudibleKeepAlive() {
  if (!isNative()) return; // the concern here is a backgrounded native WebView specifically
  if (typeof Audio === 'undefined') return;
  if (_el) return; // already running — playItems() calling this per section must not restart the loop audibly

  try {
    const el = new Audio('keep-alive.wav'); // bundled in public/, so it needs no network and works offline
    el.loop = true;
    el.volume = VOLUME;
    // A play() Chromium refuses (autoplay policy, in some context this
    // module cannot fully predict) must not take real playback down with it.
    // It is always called from playItems()/resume(), themselves reachable
    // only from a user's own tap — the ordinary case where autoplay is
    // allowed — but this being silent on failure means an unusual case just
    // quietly loses the keep-alive attempt rather than breaking anything.
    el.play().catch(() => {});
    _el = el;
  } catch {
    _el = null;
  }
}

export function stopAudibleKeepAlive() {
  if (!_el) return;
  try {
    _el.pause();
    _el.currentTime = 0;
  } catch {
    /* nothing left to clean up if this fails */
  }
  _el = null;
}
