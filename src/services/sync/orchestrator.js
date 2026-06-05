// Orchestrates pull (on sign-in) and push (≤ once per day, on dirty changes).
//
// Design notes:
// • Pull is "cloud wins by collection" unless that collection has unpushed
//   local changes (it's in the dirty set). For dirty collections we keep
//   local and the next push will overwrite cloud — last-writer-wins.
// • Push runs at most once every SYNC_MIN_INTERVAL_MS. If nothing dirty,
//   it's a no-op. If a push fails, dirty flags survive so we retry on the
//   next opportunity (no exponential backoff — daily cadence is its own
//   throttle).

import { SYNC_MIN_INTERVAL_MS } from '../../config';
import { syncEnabledOnPlatform } from './firebase';
import {
  getDirty, hasDirty, clearDirty,
  getLastSyncAt, setLastSyncAt,
} from './dirty';
import {
  pushCollections, pullSnapshot, applySnapshotToLocal, ensureProfile,
} from './cloudData';

// Pull cloud snapshot and merge into local.
// Returns { ok, applied: collections[], error? }.
export async function pullAndMerge(uid, user) {
  if (!syncEnabledOnPlatform()) return { ok: false, error: 'Sync disabled' };
  if (!uid) return { ok: false, error: 'Not signed in' };

  await ensureProfile(uid, user);

  const result = await pullSnapshot(uid);
  if (!result.ok) return result;

  // Skip merge for any collection that has unpushed local changes — local
  // is newer than cloud for those by definition.
  const dirty = new Set(getDirty());
  const candidates = ['notes', 'memory', 'stats', 'bookmarks', 'folders'];
  const toApply = candidates.filter(c => !dirty.has(c));

  applySnapshotToLocal(result.snapshot, toApply);
  return { ok: true, applied: toApply };
}

// Try to push dirty collections, subject to the daily throttle.
// Returns { ok, pushed: collections[], skipped?: reason, error? }.
export async function tryPush(uid) {
  if (!syncEnabledOnPlatform()) return { ok: true, skipped: 'disabled' };
  if (!uid) return { ok: true, skipped: 'not-signed-in' };
  if (!hasDirty()) return { ok: true, skipped: 'clean' };

  const now = Date.now();
  const last = getLastSyncAt();
  if (now - last < SYNC_MIN_INTERVAL_MS) {
    return { ok: true, skipped: 'throttled', nextAt: last + SYNC_MIN_INTERVAL_MS };
  }

  const dirty = getDirty();
  const result = await pushCollections(uid, dirty);
  if (!result.ok) return result;

  // Only clear dirty flags + bump lastSyncAt if push succeeded.
  clearDirty(dirty);
  setLastSyncAt(now);
  return { ok: true, pushed: dirty };
}

// Force a push regardless of throttle. Used by "Sync now" debug action.
export async function forcePush(uid) {
  if (!syncEnabledOnPlatform()) return { ok: true, skipped: 'disabled' };
  if (!uid) return { ok: true, skipped: 'not-signed-in' };

  const dirty = getDirty();
  if (!dirty.length) return { ok: true, pushed: [] };

  const result = await pushCollections(uid, dirty);
  if (!result.ok) return result;
  clearDirty(dirty);
  setLastSyncAt(Date.now());
  return { ok: true, pushed: dirty };
}
