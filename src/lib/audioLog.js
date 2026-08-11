// Why a paragraph read in the device voice instead of the rendered one.
//
// The fallback chain in speakUnit is deliberately silent: a file that cannot
// be fetched is an ordinary outcome there, answered by speaking the text
// instead. That is right for the listener and useless for diagnosis — the one
// symptom anybody reports ("the voice changed and I still had signal") comes
// with no evidence at all, and the failure happens with the screen off, where
// nobody is watching a console.
//
// So: record it, and record the two facts that separate the candidate causes.
//
//   visible — was the app on screen? Android's Doze only restricts an app's
//             network with the screen OFF. A failure while the app is visible
//             is a different bug and a foreground service would not fix it.
//   online  — did the WebView itself think there was a connection? "I had
//             full signal" and "the OS let this process use it" are different
//             claims, and this is the only one we can check from here.
//
// Persisted, because one of the causes being weighed is the WebView being
// killed and restarted — an in-memory log would be erased by the very event
// it is meant to catch.

const KEY = 'lawcode-audio-issues';
// Enough to cover a listening session's worth of failures without turning a
// diagnostic into a storage problem. Oldest fall off the end.
const LIMIT = 50;

const hasStorage = () => {
  try { return typeof localStorage !== 'undefined'; } catch { return false; }
};

export function audioIssues() {
  if (!hasStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];   // corrupt or written by an older shape — treat as empty
  }
}

export function clearAudioIssues() {
  if (!hasStorage()) return;
  try { localStorage.removeItem(KEY); } catch { /* nothing to do about it */ }
}

/**
 * Record one audio failure.
 *
 * Never throws and never rejects: this runs inside the fallback path, and a
 * diagnostic that can break playback is worse than no diagnostic. Every
 * failure mode here — storage full, private mode, a serialisation error — ends
 * as a silent no-op.
 *
 * @param {{phase: string, hash?: string, voice?: string, sectionId?: string,
 *          paraIndex?: number, error?: string}} event
 */
export function recordAudioIssue(event) {
  try {
    const entry = {
      at: new Date().toISOString(),
      visible: typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : null,
      online: typeof navigator !== 'undefined' ? navigator.onLine !== false : null,
      ...event,
    };
    // Also to the console, so `adb logcat` shows it live for anyone who would
    // rather watch it happen than read it afterwards. Same line, one place to
    // keep in step.
    if (typeof console !== 'undefined') console.warn('[audio]', JSON.stringify(entry));
    if (!hasStorage()) return;
    const next = [entry, ...audioIssues()].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a diagnostic must never be the thing that breaks playback */
  }
}

// One line per entry, for the copy button in Settings. Kept here rather than
// in the component because the whole point of the copy button is that the text
// gets pasted somewhere else, so its shape is data, not presentation.
export function formatAudioIssues(entries = audioIssues()) {
  if (!entries.length) return 'no audio issues recorded';
  return entries
    .map((e) => [
      e.at,
      e.phase,
      e.sectionId ? `${e.sectionId}¶${e.paraIndex ?? '?'}` : e.hash || '',
      `voice=${e.voice ?? '?'}`,
      `visible=${e.visible}`,
      `online=${e.online}`,
      e.error ? `error=${e.error}` : '',
    ].filter(Boolean).join('  '))
    .join('\n');
}

// A pulse from the playback loop itself — proof, not a guess, of whether the
// JavaScript driving playback is still running.
//
// Two builds tried to fix "playback goes silent with the screen off, resumes
// when the app is reopened" by protecting the process (a foreground service)
// and the CPU (a wake lock). Neither changed the point it happened at, and a
// third attempt — a near-silent looping tone, on the theory that the WebView
// itself was being throttled for looking "inaudible" — also made no
// difference. Three engineering guesses in a row failing is a sign to stop
// guessing: recordAudioIssue() only fires when the FALLBACK CHAIN runs, so if
// what is actually happening is that the JavaScript engine itself stops
// running — a hypothesis none of those three fixes have ruled out — nothing
// would ever be recorded, and every theory would look equally unfalsifiable
// forever.
//
// This answers the one question that separates every remaining hypothesis:
// was JavaScript still executing right up to the moment the audio stopped?
// If the last heartbeat lands within moments of the silence, the JS engine
// itself is not the problem — something further down, in the native audio
// pipeline, is. If the last heartbeat is minutes earlier, JS stopped running,
// and the search moves to why, with actual timing evidence instead of a
// fourth guess.
const HEARTBEAT_KEY = 'lawcode-audio-heartbeat';
// Small and separate from the issue log on purpose: heartbeats are frequent
// (roughly one per paragraph) and expected in the ordinary case, where the
// 50-entry issue log is empty for weeks at a time. Mixing the two would mean
// a long healthy session crowds out the failures the issue log exists to
// keep.
const HEARTBEAT_LIMIT = 20;

export function heartbeats() {
  if (!hasStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(HEARTBEAT_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function clearHeartbeats() {
  if (!hasStorage()) return;
  try { localStorage.removeItem(HEARTBEAT_KEY); } catch { /* nothing to do about it */ }
}

/**
 * Record one pulse. Called once per paragraph from the playback loop — never
 * throws, for the same reason recordAudioIssue() never does: a diagnostic
 * that can break playback defeats its own purpose.
 *
 * @param {{sectionId?: string, paraIndex?: number}} context
 */
export function markAlive(context) {
  try {
    if (!hasStorage()) return;
    const entry = { at: new Date().toISOString(), ...context };
    const next = [entry, ...heartbeats()].slice(0, HEARTBEAT_LIMIT);
    localStorage.setItem(HEARTBEAT_KEY, JSON.stringify(next));
  } catch {
    /* a diagnostic must never be the thing that breaks playback */
  }
}

export function formatHeartbeats(entries = heartbeats()) {
  if (!entries.length) return 'no heartbeat recorded yet';
  return entries
    .map((e) => [e.at, e.sectionId ? `${e.sectionId}¶${e.paraIndex ?? '?'}` : ''].filter(Boolean).join('  '))
    .join('\n');
}

// A SECOND, independent pulse — on a plain setInterval, wired to nothing the
// playback loop does. markAlive() above answers "did the loop advance to a
// new paragraph," which sounded like it settled whether JavaScript itself was
// still running, until a device test found the real shape of the failure:
// audio stops at the same ~60 seconds after leaving the app every time,
// screen off or not, 8 paragraphs in at 2x or 1 paragraph in at 1x — a fixed
// wall-clock point, not a fixed amount of work. markAlive() cannot tell two
// very different failures apart, and they call for opposite fixes:
//
//   the JS engine itself stops running   → nothing left to fix here; the
//                                           playback controller has to move
//                                           out of JavaScript entirely.
//   the loop is stuck awaiting a promise
//   that never settles                   → the engine is fine; something
//                                           specific — a native call, a bridge
//                                           message — never comes back, and
//                                           THAT is what needs fixing.
//
// Both look identical to markAlive(): in either case, the loop stops
// advancing and no new paragraph pulse appears. A timer that owes nothing to
// the loop breaks the tie: if it keeps landing every ~5 seconds right through
// the silence, the JS engine was never the problem. If it stops at the same
// moment the loop's own pulses do, the engine itself stopped, and no
// promise-level fix will touch that.
const TIMER_HEARTBEAT_KEY = 'lawcode-audio-timer-heartbeat';
// 5-second interval; 40 entries is a little over 3 minutes of history — the
// failure this exists to catch happens within the first minute, so this
// comfortably covers it with room either side.
const TIMER_HEARTBEAT_LIMIT = 40;

export function timerHeartbeats() {
  if (!hasStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(TIMER_HEARTBEAT_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function clearTimerHeartbeats() {
  if (!hasStorage()) return;
  try { localStorage.removeItem(TIMER_HEARTBEAT_KEY); } catch { /* nothing to do about it */ }
}

/** Record one timer pulse. Never throws — same reasoning as markAlive(). */
export function markTimerAlive() {
  try {
    if (!hasStorage()) return;
    const entry = { at: new Date().toISOString() };
    const next = [entry, ...timerHeartbeats()].slice(0, TIMER_HEARTBEAT_LIMIT);
    localStorage.setItem(TIMER_HEARTBEAT_KEY, JSON.stringify(next));
  } catch {
    /* a diagnostic must never be the thing that breaks playback */
  }
}

export function formatTimerHeartbeats(entries = timerHeartbeats()) {
  if (!entries.length) return 'no timer heartbeat recorded yet';
  return entries.map((e) => e.at).join('\n');
}
