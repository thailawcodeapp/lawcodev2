// User-created listening folders + 4 permanent "forgotten" folders (#2).
//
// Permanent folders are stored in localStorage just like user folders,
// but they are prepended automatically if missing and cannot be deleted.
//
// Folder shape: { id, name, createdAt, sections: [...], permanent?: true }

const STORAGE_KEY = 'lawcode-th-folders';

// Fixed IDs for the 4 permanent folders — must never change.
export const PERM_FOLDER_IDS = {
  civil:         'perm-civil-forgotten',
  criminal:      'perm-criminal-forgotten',
  civil_proc:    'perm-civil-proc-forgotten',
  criminal_proc: 'perm-criminal-proc-forgotten',
};

const PERMANENT_TEMPLATES = [
  { id: PERM_FOLDER_IDS.civil,         name: 'แพ่ง จำไม่ได้',    bookId: 'civil' },
  { id: PERM_FOLDER_IDS.criminal,      name: 'อาญา จำไม่ได้',    bookId: 'criminal' },
  { id: PERM_FOLDER_IDS.civil_proc,    name: 'วิแพ่ง จำไม่ได้',  bookId: 'civil_proc' },
  { id: PERM_FOLDER_IDS.criminal_proc, name: 'วิอาญา จำไม่ได้',  bookId: 'criminal_proc' },
];

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// Ensure the 4 permanent folders exist in storage.
function ensurePermanent(list) {
  let changed = false;
  for (const tmpl of PERMANENT_TEMPLATES) {
    if (!list.find(f => f.id === tmpl.id)) {
      list.unshift({ ...tmpl, createdAt: 0, sections: [], permanent: true });
      changed = true;
    } else {
      // make sure permanent flag is set
      const f = list.find(x => x.id === tmpl.id);
      if (!f.permanent) { f.permanent = true; changed = true; }
    }
  }
  // Move permanent folders to the front
  const perms = list.filter(f => f.permanent);
  const users = list.filter(f => !f.permanent);
  const sorted = [...perms, ...users];
  if (changed || JSON.stringify(sorted.map(x => x.id)) !== JSON.stringify(list.map(x => x.id))) {
    save(sorted);
    return sorted;
  }
  return list;
}

export function getFolders() {
  const list = load();
  return ensurePermanent(list);
}

export function getFolder(id) {
  return getFolders().find(f => f.id === id) || null;
}

// Returns the permanent folder ID for a given bookId, or null.
export function permFolderIdForBook(bookId) {
  return PERM_FOLDER_IDS[bookId] || null;
}

export function createFolder(name) {
  const list = getFolders();
  const folder = {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    name: (name || 'โฟลเดอร์ใหม่').trim(),
    createdAt: Date.now(),
    sections: [],
  };
  list.push(folder);
  save(list);
  return folder;
}

export function renameFolder(id, name) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  // permanent folders cannot be renamed
  if (f && !f.permanent) { f.name = (name || f.name).trim(); save(list); }
  return f;
}

export function deleteFolder(id) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (f?.permanent) return; // permanent folders cannot be deleted
  save(list.filter(f => f.id !== id));
}

export function addSectionToFolder(id, section) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (!f) return;
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
  if (!f) return;
  for (const section of sections) {
    if (f.sections.some(s => s.sectionId === section.sectionId)) continue;
    f.sections.push({
      sectionId: section.sectionId,
      bookId:    section.bookId,
      number:    section.number,
      title:     section.title || '',
    });
  }
  save(list);
}

export function removeSectionFromFolder(id, sectionId) {
  const list = getFolders();
  const f = list.find(x => x.id === id);
  if (!f) return;
  f.sections = f.sections.filter(s => s.sectionId !== sectionId);
  save(list);
}

// Sync a section's "forgotten" status to/from its permanent folder (#2).
// Call this whenever setMemoryStatus is used.
export function syncForgottenFolder({ sectionId, bookId, number, title, isForgotten }) {
  const folderId = permFolderIdForBook(bookId);
  if (!folderId) return;
  if (isForgotten) {
    addSectionToFolder(folderId, { sectionId, bookId, number, title });
  } else {
    removeSectionFromFolder(folderId, sectionId);
  }
}
