// The "เพิ่มใน…" sheet on Wave's Select screen (spec 5.2): add the ticked
// sections to several folders at once, undo exactly that, and remember the
// folders used last. Recent ids live in their own key so the synced folder
// list — which older app versions also read — keeps its schema.
import { getFolders, addSectionsToFolder, addSectionsToGroup, removeSectionsFromFolders } from './folders';

const RECENT_KEY = 'lawcode-th-folder-recent';
const RECENT_MAX = 3;
const STATS_GROUPS = ['grp-nethi', 'grp-attorney', 'grp-judge'];

export function getRecentIds() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function pushRecent(ids) {
  const next = [...ids, ...getRecentIds().filter(id => !ids.includes(id))].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
}

// Folders that can take sections by hand: the three stats groups and the
// user's own top-level folders. "จำไม่ได้" and other read-only ones are filled
// by the app and never offered.
export function pickerLists(folders = getFolders()) {
  const usable = (f) => f && !f.readOnly && !f.parentId
    && (f.type === 'group' ? STATS_GROUPS.includes(f.id) : true);
  const byId = new Map(folders.map(f => [f.id, f]));
  const recent = getRecentIds().map(id => byId.get(id)).filter(usable);
  const inRecent = new Set(recent.map(f => f.id));
  const rest = folders.filter(f => usable(f) && !inRecent.has(f.id));
  return {
    recent,
    groups: rest.filter(f => f.type === 'group'),
    mine: rest.filter(f => f.type !== 'group'),
  };
}

const sectionsOf = (folder, folders) => (folder.type === 'group'
  ? folders.filter(f => f.parentId === folder.id).flatMap(f => f.sections)
  : folder.sections);

export function alreadyIn(folder, sections, folders = getFolders()) {
  const ids = new Set(sectionsOf(folder, folders).map(s => s.sectionId));
  return sections.filter(s => ids.has(s.sectionId));
}

export function sectionCount(folder, folders = getFolders()) {
  return sectionsOf(folder, folders).length;
}

function snapshot() {
  return new Map(getFolders().map(f => [f.id, new Set((f.sections || []).map(s => s.sectionId))]));
}

// What was added is found by comparing before and after, so a group's
// per-book leaves — including one made on demand — are covered too.
export function addToFolders(folderIds, sections) {
  const before = snapshot();
  const folders = getFolders();
  const done = [];
  for (const id of folderIds) {
    const f = folders.find(x => x.id === id);
    if (!f || f.readOnly) continue;
    if (f.type === 'group') addSectionsToGroup(id, sections);
    else addSectionsToFolder(id, sections);
    done.push(id);
  }
  const added = [];
  for (const f of getFolders()) {
    const had = before.get(f.id) || new Set();
    for (const s of f.sections || []) {
      if (!had.has(s.sectionId)) added.push({ folderId: f.id, sectionId: s.sectionId });
    }
  }
  if (done.length) pushRecent(done);
  return { folderIds: done, added };
}

// One load and one save however many were added: hundreds of sections used to
// mean hundreds of parse/stringify/localStorage round trips.
export function undoAdd(added) {
  removeSectionsFromFolders(added.map(a => ({ folderId: a.folderId, sectionId: a.sectionId })));
}
