// One-time announcement that the reading voice changed, for people who had an
// earlier build. Deliberately not in the synced settings blob: this is about
// what happened on this device, and syncing it would silence the card on the
// user's second phone, which is exactly where they would want to see it.
import { APP_VERSION_CODE } from '../config';

const VERSION_KEY = 'lawcode-last-seen-version';
const DISMISSED_KEY = 'lawcode-voice-news-dismissed';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}

export function shouldShowVoiceNews() {
  const seen = read(VERSION_KEY);
  write(VERSION_KEY, APP_VERSION_CODE);

  if (seen === null) return false;                  // fresh install
  if (read(DISMISSED_KEY) === '1') return false;    // already answered
  return Number(seen) < APP_VERSION_CODE;
}

// Keyed to the announcement, not to a version number: once someone has been
// told, a later build must not tell them again.
export function dismissVoiceNews() {
  write(DISMISSED_KEY, '1');
}
