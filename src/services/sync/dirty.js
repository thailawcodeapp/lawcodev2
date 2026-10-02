// Dirty-collection tracker.
//
// Strategy: rather than tracking every changed sectionId individually,
// we track which DATA COLLECTION has any unpushed change. Each collection
// is sent as a single Firestore document, so flagging at the collection
// level is enough — push reads the entire local collection and writes one
// doc.
//
// Persisted in localStorage so dirty flags survive app restarts (e.g. user
// modifies a note, closes the app, opens it the next day → push triggers).
//
// All public functions are SAFE TO CALL with ENABLE_AUTH_GATE = false:
// they short-circuit to no-ops.

import { ENABLE_AUTH_GATE } from '../../config';

const STORAGE_KEY = 'lawcode-th-sync-dirty';
const LAST_SYNC_KEY = 'lawcode-th-sync-last-at';

// Collections that can be marked dirty. Adding here also requires extending
// the push/pull orchestrator in services/sync/cloudData.js.
export const COLLECTIONS = ['notes', 'memory', 'stats', 'bookmarks', 'folders'];

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = new Set(raw ? JSON.parse(raw) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...cache]));
  } catch {}
}

// Mark a collection as having unpushed local changes.
// No-op when the cloud-sync feature flag is off.
export function markDirty(collection) {
  if (!ENABLE_AUTH_GATE) return;
  if (!COLLECTIONS.includes(collection)) return;
  load();
  if (!cache.has(collection)) {
    cache.add(collection);
    persist();
  }
}

export function getDirty() {
  return [...load()];
}

export function hasDirty() {
  return load().size > 0;
}

// Clear specific collections (called after a successful push for those keys).
export function clearDirty(collections) {
  load();
  let changed = false;
  for (const c of collections) {
    if (cache.delete(c)) changed = true;
  }
  if (changed) persist();
}

// Force-clear everything (used by sign-out and dev reset).
export function clearAllDirty() {
  load();
  if (cache.size === 0) return;
  cache.clear();
  persist();
}

// Last successful push timestamp (ms epoch). 0 if never.
export function getLastSyncAt() {
  try {
    return Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
  } catch { return 0; }
}

export function setLastSyncAt(ts) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {}
}
