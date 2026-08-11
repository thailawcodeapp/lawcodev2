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
