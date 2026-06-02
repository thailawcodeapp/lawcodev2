// Per-section memory status (v8 #1).
// Values: 'remembered' | 'forgotten' | undefined (not marked)

const STORAGE_KEY = 'lawcode-th-memory';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function getMemoryStatus(sectionId) {
  return load()[sectionId] || null;
}

export function getAllMemory() {
  return load();
}

// Toggle through: null → 'remembered' → 'forgotten' → null
export function cycleMemoryStatus(sectionId) {
  const all = load();
  const cur = all[sectionId] || null;
  const next = cur === null ? 'remembered'
             : cur === 'remembered' ? 'forgotten'
             : null;
  if (next === null) delete all[sectionId];
  else all[sectionId] = next;
  save(all);
  return next;
}

export function setMemoryStatus(sectionId, status) {
  const all = load();
  if (status === null || status === undefined) delete all[sectionId];
  else all[sectionId] = status;
  save(all);
}

// CSS color for the title text on the Select screen (#1)
//   remembered → green, forgotten → red, else → default ink color
export function memoryColor(status) {
  if (status === 'remembered') return '#2d8c4a';
  if (status === 'forgotten')  return '#e8821e';
  return null;
}
