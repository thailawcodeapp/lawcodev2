// User-created listening folders (#6.1) — each folder is an ordered playlist
// of sections the user wants to listen to together.
//
// Folder:  { id, name, createdAt, sections: [{ sectionId, bookId, number, title }] }

const STORAGE_KEY = 'lawcode-th-folders';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

export function getFolders() {
  return load();
}

export function getFolder(id) {
  return load().find(f => f.id === id) || null;
}

export function createFolder(name) {
  const list = load();
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
  const list = load();
  const f = list.find(x => x.id === id);
  if (f) { f.name = (name || f.name).trim(); save(list); }
  return f;
}

export function deleteFolder(id) {
  save(load().filter(f => f.id !== id));
}

export function addSectionToFolder(id, section) {
  const list = load();
  const f = list.find(x => x.id === id);
  if (!f) return;
  if (f.sections.some(s => s.sectionId === section.sectionId)) return; // no dupes
  f.sections.push({
    sectionId: section.sectionId,
    bookId: section.bookId,
    number: section.number,
    title: section.title || '',
  });
  save(list);
}

export function addSectionsToFolder(id, sections) {
  const list = load();
  const f = list.find(x => x.id === id);
  if (!f) return;
  for (const section of sections) {
    if (f.sections.some(s => s.sectionId === section.sectionId)) continue;
    f.sections.push({
      sectionId: section.sectionId,
      bookId: section.bookId,
      number: section.number,
      title: section.title || '',
    });
  }
  save(list);
}

export function removeSectionFromFolder(id, sectionId) {
  const list = load();
  const f = list.find(x => x.id === id);
  if (!f) return;
  f.sections = f.sections.filter(s => s.sectionId !== sectionId);
  save(list);
}
