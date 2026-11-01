// How long has been listened to, per day. Kept on this device only.
//
// The clock cannot do this. About 80 seconds after the app leaves the screen
// JavaScript stops while native plays on, and the sections played meanwhile
// are announced in one burst on return. So a section played through counts for
// how long it takes to say; only one the listener left early is timed.

const KEY = 'lawcode-th-listen-time';

// Measured over 3,000 rendered clips at normal speed.
export const CHARS_PER_SECOND = 11;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function secondsToSay(item, rate = 1) {
  const chars = (item?.chunks || []).reduce((sum, c) => sum + (c.text || '').length, 0);
  return chars / (CHARS_PER_SECOND * (rate || 1));
}

function credit(seconds, now) {
  if (!(seconds > 0)) return;
  const log = load();
  const day = dayKey(new Date(now));
  log[day] = Math.round((log[day] || 0) + seconds);
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* private mode / full */ }
}

let open = null; // the section playing: { at, full }

// Reaching a section means the one before it played through.
export function beginSection(item, rate, now = Date.now()) {
  endSection(now);
  open = { at: now, full: secondsToSay(item, rate) };
}

export function endSection(now = Date.now()) {
  if (open) credit(open.full, now);
  open = null;
}

// Skipped or stopped partway: as long as it played, and never more than the
// whole section, so time spent paused on it does not count.
export function leaveSection(now = Date.now()) {
  if (open) credit(Math.min((now - open.at) / 1000, open.full), now);
  open = null;
}

export function listenTotals(now = new Date()) {
  const log = load();
  const week = new Set(Array.from({ length: 7 }, (_, i) => (
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))
  )));
  let weekSum = 0;
  let all = 0;
  for (const [day, sec] of Object.entries(log)) {
    all += sec;
    if (week.has(day)) weekSum += sec;
  }
  return { today: log[dayKey(now)] || 0, week: weekSum, all };
}

export function clearListenTime() {
  open = null;
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const h = Math.floor(mins / 60);
  return h ? `${h.toLocaleString()} ชม. ${mins % 60} น.` : `${mins} น.`;
}
