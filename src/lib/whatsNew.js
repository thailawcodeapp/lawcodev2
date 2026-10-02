// One-time announcement that the reading voice changed, for people who had an
// earlier build. Deliberately not in the synced settings blob: this is about
// what happened on this device, and syncing it would silence the card on the
// user's second phone, which is exactly where they would want to see it.
import { APP_VERSION_CODE } from '../config';

const VERSION_KEY = 'lawcode-last-seen-version';
const DISMISSED_KEY = 'lawcode-voice-news-dismissed';

// Written only by earlier builds, only when the user actually did something.
// Their presence — with no VERSION_KEY yet on disk — is the only evidence
// that this device ran an older build, because VERSION_KEY itself is new in
// this release and no prior build ever wrote it.
const LEGACY_USAGE_KEYS = [
  'lawcode-eng-history',
  'lawcode-eng-bookmarks',
  'lawcode-eng-settings',
];

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}

// Decided once, at module load, before this session (or the component's own
// effects) can write anything back. A route unmount/remount of the card must
// not re-run this logic and flip the answer.
function computeShouldShow() {
  if (read(DISMISSED_KEY) === '1') return false;

  const seen = read(VERSION_KEY);
  write(VERSION_KEY, APP_VERSION_CODE);

  if (seen !== null) return Number(seen) < APP_VERSION_CODE;

  // No stored version yet. Could be a fresh install, or a returning user on
  // a build that predates VERSION_KEY entirely — tell them apart by whether
  // any pre-existing usage data is on disk.
  return LEGACY_USAGE_KEYS.some((key) => read(key) !== null);
}

const showVoiceNews = computeShouldShow();

export function shouldShowVoiceNews() {
  return showVoiceNews;
}

// Keyed to the announcement, not to a version number: once someone has been
// told, a later build must not tell them again.
export function dismissVoiceNews() {
  write(DISMISSED_KEY, '1');
}
