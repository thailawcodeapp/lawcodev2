// Highlights persistence — localStorage-backed

const STORAGE_KEY = 'lawcode-th-highlights';

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', bg: 'rgba(255, 220, 80, 0.35)', border: '#e6c84a', label: 'เหลือง' },
  { id: 'green',  bg: 'rgba(80, 200, 120, 0.30)', border: '#3daa5e', label: 'เขียว' },
  { id: 'blue',   bg: 'rgba(80, 160, 255, 0.25)', border: '#4a90d9', label: 'น้ำเงิน' },
  { id: 'pink',   bg: 'rgba(255, 120, 150, 0.30)', border: '#d95070', label: 'ชมพู' },
];

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getHighlightsForSection(sectionId) {
  const all = loadAll();
  return all[sectionId] || [];
}

export function addHighlight(sectionId, paraIndex, startOffset, endOffset, text, color = 'yellow') {
  const all = loadAll();
  if (!all[sectionId]) all[sectionId] = [];
  const hl = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    paraIndex,
    startOffset,
    endOffset,
    text,       // store the highlighted text for display in lists
    color,
    createdAt: Date.now(),
  };
  all[sectionId].push(hl);
  saveAll(all);
  return hl;
}

export function deleteHighlight(sectionId, highlightId) {
  const all = loadAll();
  const hls = all[sectionId] || [];
  all[sectionId] = hls.filter(h => h.id !== highlightId);
  if (all[sectionId].length === 0) delete all[sectionId];
  saveAll(all);
}

export function getColorStyle(colorId) {
  return HIGHLIGHT_COLORS.find(c => c.id === colorId) || HIGHLIGHT_COLORS[0];
}
