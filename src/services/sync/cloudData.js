// Read/write of the 5 chunked data documents in Firestore.
//
// Layout:
//   users/{uid}/data/notes      { sections: { [sectionId]: [...notes] }, updatedAt }
//   users/{uid}/data/memory     { sections: { [sectionId]: status        }, updatedAt }
//   users/{uid}/data/stats      { sections: { [sectionId]: {...}         }, updatedAt }
//   users/{uid}/data/bookmarks  { items:    { [sectionId]: {...}         }, updatedAt }
//   users/{uid}/data/folders    { folders: [...], tombstones: [...], updatedAt }
//
// Why one doc per collection: keeps push to ~6 writes/user/day, well inside
// the Spark free tier. The trade-off is "all-or-nothing" — a single write
// replaces the entire collection — so we still need conflict detection.
// We use `updatedAt` (server timestamp) on the document to break ties:
// cloud wins if cloud.updatedAt > localPushBaseline.

import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { syncEnabledOnPlatform } from './firebase';

// ─── Local readers (current localStorage state) ────────────────────────────
function readLocalNotes() {
  try { return JSON.parse(localStorage.getItem('lawcode-th-notes')) || {}; }
  catch { return {}; }
}
function readLocalMemory() {
  try { return JSON.parse(localStorage.getItem('lawcode-th-memory')) || {}; }
  catch { return {}; }
}
function readLocalStats() {
  try { return JSON.parse(localStorage.getItem('lawcode-th-stats')) || {}; }
  catch { return {}; }
}
function readLocalBookmarks() {
  try { return JSON.parse(localStorage.getItem('lawcode-eng-bookmarks')) || {}; }
  catch { return {}; }
}
function readLocalFolders() {
  try { return JSON.parse(localStorage.getItem('lawcode-th-folders')) || []; }
  catch { return []; }
}
function readLocalFolderTombstones() {
  try { return JSON.parse(localStorage.getItem('lawcode-th-folders-tombstones')) || []; }
  catch { return []; }
}

// ─── Local writers (used by pull merge) ────────────────────────────────────
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// True when the user has essentially no local data — i.e. a fresh install or
// a reinstall. Used to decide whether a single-device user still needs a
// restore pull.
export function isLocalDataEmpty() {
  const notes     = readLocalNotes();
  const memory    = readLocalMemory();
  const stats     = readLocalStats();
  const bookmarks = readLocalBookmarks();
  const folders   = readLocalFolders();
  const userFolders = folders.filter(f => !f.permanent && (f.sections?.length || 0) > 0);
  const permWithData = folders.filter(f => f.permanent && (f.sections?.length || 0) > 0);
  return (
    Object.keys(notes).length === 0 &&
    Object.keys(memory).length === 0 &&
    Object.keys(stats).length === 0 &&
    Object.keys(bookmarks).length === 0 &&
    userFolders.length === 0 &&
    permWithData.length === 0
  );
}

// ─── Push ───────────────────────────────────────────────────────────────────
// dirtyCollections is the Set of collection names that need to be written.
// Returns { ok, writes: number } or { ok:false, error }.
export async function pushCollections(uid, dirtyCollections) {
  if (!syncEnabledOnPlatform() || !uid || !dirtyCollections.length) {
    return { ok: true, writes: 0 };
  }

  const now = Date.now();
  const ops = [];

  if (dirtyCollections.includes('notes')) {
    ops.push({
      reference: `users/${uid}/data/notes`,
      data: { sections: readLocalNotes(), updatedAt: now },
    });
  }
  if (dirtyCollections.includes('memory')) {
    ops.push({
      reference: `users/${uid}/data/memory`,
      data: { sections: readLocalMemory(), updatedAt: now },
    });
  }
  if (dirtyCollections.includes('stats')) {
    const stats = readLocalStats();
    const totalRounds = Object.values(stats).reduce((s, v) => s + (v.count || 0), 0);
    const totalListened = Object.keys(stats).length;
    ops.push({
      reference: `users/${uid}/data/stats`,
      data: { sections: stats, totalRounds, totalListened, updatedAt: now },
    });
  }
  if (dirtyCollections.includes('bookmarks')) {
    ops.push({
      reference: `users/${uid}/data/bookmarks`,
      data: { items: readLocalBookmarks(), updatedAt: now },
    });
  }
  if (dirtyCollections.includes('folders')) {
    ops.push({
      reference: `users/${uid}/data/folders`,
      data: {
        folders: readLocalFolders(),
        tombstones: readLocalFolderTombstones(),
        updatedAt: now,
      },
    });
  }

  // Also bump the profile's lastSyncedAt so the user can see when they last
  // pushed. This is 1 extra write but worth it for UX.
  ops.push({
    reference: `users/${uid}/profile`,
    data: { lastSyncedAt: now },
    merge: true,
  });

  try {
    // Capacitor-Firebase doesn't expose true batchedWrites, so we run them in
    // parallel — Firestore's transactional guarantees apply per-document only,
    // which is fine for our use case (each doc is independent).
    await Promise.all(ops.map(op =>
      FirebaseFirestore.setDocument({
        reference: op.reference,
        data: op.data,
        merge: op.merge === true,
      })
    ));
    return { ok: true, writes: ops.length };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ─── Pull ───────────────────────────────────────────────────────────────────
// Pulls all 5 data docs + the profile. Returns the raw cloud snapshot so the
// orchestrator can merge with local state. Returns { ok, snapshot } where
// snapshot has shape:
//   { notes, memory, stats, bookmarks, folders, foldersTombstones, profile, devices: number }
// Each field is `null` if the doc didn't exist (first sign-in scenario).
export async function pullSnapshot(uid) {
  if (!syncEnabledOnPlatform() || !uid) {
    return { ok: false, error: 'Sync not available' };
  }
  const reads = [
    'profile',
    'data/notes', 'data/memory', 'data/stats', 'data/bookmarks', 'data/folders',
  ];
  try {
    const results = await Promise.all(reads.map(p =>
      FirebaseFirestore.getDocument({ reference: `users/${uid}/${p}` })
        .then(r => r?.snapshot?.data || null)
        .catch(() => null)
    ));
    const [profile, notes, memory, stats, bookmarks, folders] = results;
    return {
      ok: true,
      snapshot: {
        profile,
        notes:     notes?.sections     || null,
        memory:    memory?.sections    || null,
        stats:     stats?.sections     || null,
        bookmarks: bookmarks?.items    || null,
        folders:   folders?.folders    || null,
        foldersTombstones: folders?.tombstones || null,
        // Embed each doc's updatedAt for conflict resolution at the
        // orchestrator layer.
        updatedAt: {
          notes:     notes?.updatedAt     || 0,
          memory:    memory?.updatedAt    || 0,
          stats:     stats?.updatedAt     || 0,
          bookmarks: bookmarks?.updatedAt || 0,
          folders:   folders?.updatedAt   || 0,
        },
      },
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Apply a cloud snapshot to local storage. Naive last-writer-wins by document.
// The orchestrator decides WHICH collections to apply based on dirty flags
// (don't overwrite local if local has unpushed changes) and updatedAt.
export function applySnapshotToLocal(snapshot, collections) {
  if (!snapshot) return;
  if (collections.includes('notes') && snapshot.notes != null) {
    writeLocal('lawcode-th-notes', snapshot.notes);
  }
  if (collections.includes('memory') && snapshot.memory != null) {
    writeLocal('lawcode-th-memory', snapshot.memory);
  }
  if (collections.includes('stats') && snapshot.stats != null) {
    writeLocal('lawcode-th-stats', snapshot.stats);
  }
  if (collections.includes('bookmarks') && snapshot.bookmarks != null) {
    writeLocal('lawcode-eng-bookmarks', snapshot.bookmarks);
  }
  if (collections.includes('folders') && snapshot.folders != null) {
    writeLocal('lawcode-th-folders', snapshot.folders);
    writeLocal('lawcode-th-folders-tombstones', snapshot.foldersTombstones || []);
  }
}

// Ensure the user has a `profile` document. Called after sign-in.
export async function ensureProfile(uid, user) {
  if (!syncEnabledOnPlatform() || !uid) return;
  try {
    await FirebaseFirestore.setDocument({
      reference: `users/${uid}/profile`,
      data: {
        email:       user?.email       || null,
        displayName: user?.displayName || null,
        lastSeen:    Date.now(),
      },
      merge: true,
    });
  } catch {
    // Non-fatal: the next sync will retry.
  }
}
