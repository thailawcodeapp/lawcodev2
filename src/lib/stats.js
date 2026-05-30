// Listening statistics (#15) — which sections were listened to and how many
// rounds each. Stored in localStorage, keyed by sectionId.

const STORAGE_KEY = 'lawcode-th-stats';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveAll(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// Record one listening round for a section.
export function recordListen({ sectionId, bookId, number }) {
  if (!sectionId) return;
  const all = loadAll();
  const cur = all[sectionId] || { bookId, number, count: 0 };
  all[sectionId] = {
    bookId: bookId ?? cur.bookId,
    number: number ?? cur.number,
    count: cur.count + 1,
    lastAt: Date.now(),
  };
  saveAll(all);
}

export function getAllStats() {
  return loadAll();
}

// Grouped by bookId → array of { sectionId, number, count, lastAt }
export function getStatsByBook() {
  const all = loadAll();
  const byBook = {};
  for (const [sectionId, v] of Object.entries(all)) {
    const b = v.bookId || 'unknown';
    (byBook[b] = byBook[b] || []).push({ sectionId, ...v });
  }
  // Sort each book's list by section number (numeric-ish)
  for (const b of Object.keys(byBook)) {
    byBook[b].sort((a, c) => parseFloat(a.number) - parseFloat(c.number));
  }
  return byBook;
}

export function getTotals() {
  const all = loadAll();
  const sections = Object.keys(all).length;
  const rounds = Object.values(all).reduce((s, v) => s + (v.count || 0), 0);
  return { sections, rounds };
}

export function clearStats() {
  saveAll({});
}
