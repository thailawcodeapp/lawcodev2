// Hierarchical folder system.
//
// Two kinds of folders stored together in one flat localStorage list:
//
//   GROUP  { id, name, type:'group', permanent, deletable, sections:[], createdAt }
//          — container; sections are stored in its children, not directly here.
//
//   LEAF   { id, name, type:'leaf', parentId?, bookId?, permanent, deletable,
//            sections:[{sectionId,bookId,number,title}], createdAt }
//          — holds actual sections.  parentId links it to a GROUP.
//
// Four permanent groups (cannot be deleted or renamed):
//   grp-forgotten  → "จำไม่ได้"
//   grp-nethi      → "สถิติเนติ"
//   grp-attorney   → "สถิติอัยการ"
//   grp-judge      → "สถิติผู้พิพากษา"
//
// Each group gets 4 permanent leaf children, one per law book.
// User folders are regular leaves with no parentId.

const STORAGE_KEY = 'lawcode-th-folders';

const BOOK_IDS   = ['civil', 'criminal', 'civil_proc', 'criminal_proc'];
const BOOK_NAMES = { civil: 'แพ่ง', criminal: 'อาญา', civil_proc: 'วิแพ่ง', criminal_proc: 'วิอาญา' };

export const PERM_GROUP_IDS = {
  forgotten: 'grp-forgotten',
  nethi:     'grp-nethi',
  attorney:  'grp-attorney',
  judge:     'grp-judge',
};

// "จำไม่ได้" is the only fully-protected group (no delete, no rename).
// The three stats groups are pre-seeded but can be deleted and renamed by the user.
const PERM_GROUPS = [
  { id: 'grp-forgotten', name: 'จำไม่ได้',        deletable: false, lockedName: true,  permanent: true },
  { id: 'grp-nethi',     name: 'สถิติเนติ',       deletable: true,  lockedName: false, permanent: false },
  { id: 'grp-attorney',  name: 'สถิติอัยการ',     deletable: true,  lockedName: false, permanent: false },
  { id: 'grp-judge',     name: 'สถิติผู้พิพากษา', deletable: true,  lockedName: false, permanent: false },
];

// Child leaf ID convention: <groupId>-<bookId> (with underscore replaced for storage)
function childLeafId(groupId, bookId) {
  // Keep old IDs for the forgotten group to preserve existing data
  if (groupId === 'grp-forgotten') {
    const legacyMap = {
      civil:         'perm-civil-forgotten',
      criminal:      'perm-criminal-forgotten',
      civil_proc:    'perm-civil-proc-forgotten',
      criminal_proc: 'perm-criminal-proc-forgotten',
    };
    return legacyMap[bookId] || `${groupId}-${bookId}`;
  }
  return `${groupId}-${bookId}`;
}

// ─── Storage ────────────────────────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// Ensure the permanent groups + their 4 children exist.
// Also handles migration: old flat permanent folders get parentId set.
function ensurePermanent(list) {
  let changed = false;

  // Track which groups the user has explicitly deleted — never re-seed them.
  const tombstones = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY + '-tombstones')) || []; }
    catch { return []; }
  })();

  // 1. Ensure group entries (skip user-deleted ones)
  for (const tmpl of PERM_GROUPS) {
    if (tombstones.includes(tmpl.id)) continue;
    let g = list.find(f => f.id === tmpl.id);
    if (!g) {
      g = {
        id: tmpl.id, name: tmpl.name, type: 'group',
        permanent: tmpl.permanent, deletable: tmpl.deletable, lockedName: tmpl.lockedName,
        sections: [], createdAt: 0,
      };
      list.push(g);
      changed = true;
    } else {
      if (!g.type) { g.type = 'group'; changed = true; }
      // Sync flags from template — but DON'T overwrite the user's rename
      if (g.permanent !== tmpl.permanent) { g.permanent = tmpl.permanent; changed = true; }
      if (g.deletable !== tmpl.deletable) { g.deletable = tmpl.deletable; changed = true; }
      if (g.lockedName !== tmpl.lockedName) { g.lockedName = tmpl.lockedName; changed = true; }
    }
  }

  // 2. Ensure leaf children for each existing group
  for (const grp of PERM_GROUPS) {
    if (tombstones.includes(grp.id)) continue;
    const parent = list.find(f => f.id === grp.id);
    if (!parent) continue;
    for (const bookId of BOOK_IDS) {
      const lid = childLeafId(grp.id, bookId);
      let leaf = list.find(f => f.id === lid);
      if (!leaf) {
        leaf = {
          id: lid, name: BOOK_NAMES[bookId], type: 'leaf',
          parentId: grp.id, bookId,
          // children of "จำไม่ได้" are protected; others are user-editable
          permanent: grp.permanent, deletable: !grp.permanent, lockedName: grp.lockedName,
          sections: [], createdAt: 0,
        };
        list.push(leaf);
        changed = true;
      } else {
        if (!leaf.parentId) { leaf.parentId = grp.id; changed = true; }
        if (!leaf.type)     { leaf.type = 'leaf'; changed = true; }
        if (!leaf.bookId)   { leaf.bookId = bookId; changed = true; }
        if (leaf.permanent !== grp.permanent)  { leaf.permanent = grp.permanent; changed = true; }
        const wantDeletable = !grp.permanent;
        if (leaf.deletable !== wantDeletable) { leaf.deletable = wantDeletable; changed = true; }
        if (leaf.lockedName !== grp.lockedName) { leaf.lockedName = grp.lockedName; changed = true; }
      }
    }
  }

  // Enforce canonical ordering: permanent groups first (in PERM_GROUPS order,
  // i.e. "จำไม่ได้" first), then their leaf children, then user folders.
  const ordered = [];
  for (const grp of PERM_GROUPS) {
    const g = list.find(f => f.id === grp.id);
    if (g) ordered.push(g);
    for (const bookId of BOOK_IDS) {
      const leaf = list.find(f => f.id === childLeafId(grp.id, bookId));
      if (leaf) ordered.push(leaf);
    }
  }
  // Append anything not already placed (user folders, stray entries)
  for (const f of list) {
    if (!ordered.includes(f)) ordered.push(f);
  }

  const orderChanged = JSON.stringify(ordered.map(x => x.id)) !== JSON.stringify(list.map(x => x.id));
  if (changed || orderChanged) save(ordered);
  return ordered;
}

// ─── Public helpers ──────────────────────────────────────────────────────────
export function getFolders() {
  return ensurePermanent(load());
}

export function getFolder(id) {
  return getFolders().find(f => f.id === id) || null;
}

// Children of a group folder
export function getChildren(groupId) {
  return getFolders().filter(f => f.parentId === groupId);
}

// Top-level items: groups + user leaf folders with no parentId
export function getTopLevel() {
  const list = getFolders();
  return list.filter(f => !f.parentId);
}

// ─── CRUD ────────────────────────────────────────────────────────────────────
export function createFolder(name, parentId = null) {
  const list = getFolders();
  const folder = {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    name: (name || 'โฟลเดอร์ใหม่').trim(),
    type: 'leaf',
    parentId: parentId || undefined,
    permanent: false,
    deletable: true,
    sections: [],
    createdAt: Date.now(),
  };
  list.push(folder);
  save(list);
  return folder;
}

export function renameFolder(id, name) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  // Cannot rename if name is locked (only "จำไม่ได้" group)
  if (f && f.lockedName !== true) {
    f.name = (name || f.name).trim();
    save(list);
  }
  return f;
}

export function deleteFolder(id) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (!f || f.deletable === false) return;
  // Tombstone permanent-but-deletable groups so ensurePermanent doesn't re-seed them
  if (PERM_GROUPS.some(g => g.id === id)) {
    try {
      const tomb = JSON.parse(localStorage.getItem(STORAGE_KEY + '-tombstones')) || [];
      if (!tomb.includes(id)) tomb.push(id);
      localStorage.setItem(STORAGE_KEY + '-tombstones', JSON.stringify(tomb));
    } catch {}
  }
  // Also delete children of a group
  const toRemove = new Set([id, ...list.filter(x => x.parentId === id).map(x => x.id)]);
  save(list.filter(f => !toRemove.has(f.id)));
}

export function addSectionToFolder(id, section) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (!f || f.type === 'group') return; // can't add directly to group
  if (f.sections.some(s => s.sectionId === section.sectionId)) return;
  f.sections.push({
    sectionId: section.sectionId,
    bookId:    section.bookId,
    number:    section.number,
    title:     section.title || '',
  });
  save(list);
}

export function addSectionsToFolder(id, sections) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (!f || f.type === 'group') return;
  for (const section of sections) {
    if (f.sections.some(s => s.sectionId === section.sectionId)) continue;
    f.sections.push({ sectionId: section.sectionId, bookId: section.bookId, number: section.number, title: section.title || '' });
  }
  save(list);
}

// Add sections to a GROUP — auto-routes each to the correct child by bookId.
export function addSectionsToGroup(groupId, sections) {
  const list = getFolders();
  let changed = false;
  for (const section of sections) {
    const child = list.find(f => f.parentId === groupId && f.bookId === section.bookId);
    if (!child) continue;
    if (child.sections.some(s => s.sectionId === section.sectionId)) continue;
    child.sections.push({ sectionId: section.sectionId, bookId: section.bookId, number: section.number, title: section.title || '' });
    changed = true;
  }
  if (changed) save(list);
}

export function removeSectionFromFolder(id, sectionId) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (!f) return;
  f.sections = f.sections.filter(s => s.sectionId !== sectionId);
  save(list);
}

// Sync "forgotten" memory status to/from the grp-forgotten group's children.
export function syncForgottenFolder({ sectionId, bookId, number, title, isForgotten }) {
  const lid = childLeafId('grp-forgotten', bookId);
  if (isForgotten) {
    addSectionToFolder(lid, { sectionId, bookId, number, title });
  } else {
    removeSectionFromFolder(lid, sectionId);
  }
}

// Total section count across a group's children
export function groupSectionCount(groupId) {
  return getFolders()
    .filter(f => f.parentId === groupId)
    .reduce((s, f) => s + f.sections.length, 0);
}
