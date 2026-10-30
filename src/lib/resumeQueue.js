// The queue Wave's hero resumes (spec 4): the whole list that was playing and
// where it stopped. A section counts as heard once the next one starts, so
// resuming replays the cut-off section from its start and goes on from there
// — 1–10 stopped inside section 2 resumes 2, 3 … 10.
import { LAW_BOOKS_META } from '../data/lawMeta';

const KEY = 'lawcode-th-resume';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; }
  catch { return null; }
}

function write(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function defaultLabel(items) {
  const first = items?.[0];
  if (!first) return '';
  const meta = LAW_BOOKS_META.find(m => m.id === first.bookId);
  return `${meta?.shortLabel ?? meta?.shortName ?? ''} ม.${first.number}`.trim();
}

export function startQueue(items, startIndex = 0, label) {
  const refs = (items || [])
    .filter(i => i?.sectionId && i?.bookId)
    .map(i => ({ bookId: i.bookId, sectionId: i.sectionId }));
  if (!refs.length) return;
  write({
    label: label || defaultLabel(items),
    refs,
    index: Math.max(0, Math.min(startIndex, refs.length - 1)),
    done: false,
    updatedAt: Date.now(),
  });
}

export function markItem(index) {
  const r = read();
  if (!r || !Array.isArray(r.refs) || !(index >= 0) || index >= r.refs.length) return;
  write({ ...r, index, done: false, updatedAt: Date.now() });
}

export function markDone() {
  const r = read();
  if (r) write({ ...r, done: true, updatedAt: Date.now() });
}

export function getResume() {
  const r = read();
  return r && Array.isArray(r.refs) && r.refs.length ? r : null;
}

export function clearResume() {
  write(null);
}

// Drop sections the loaded corpus no longer has, moving the index back by
// each one dropped before it. Null when finished or nothing is left.
export function resolveResume(record, books) {
  if (!record || record.done) return null;
  const has = (ref) => books.some(b => b.id === ref.bookId && b.sections?.some(s => s.id === ref.sectionId));
  const refs = [];
  let index = record.index;
  record.refs.forEach((ref, i) => {
    if (has(ref)) refs.push(ref);
    else if (i < record.index) index--;
  });
  if (!refs.length) return null;
  return { label: record.label, refs, index: Math.min(Math.max(index, 0), refs.length - 1) };
}
