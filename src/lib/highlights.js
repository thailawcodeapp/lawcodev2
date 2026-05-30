// Highlights persistence — localStorage-backed

const STORAGE_KEY = 'lawcode-th-highlights';

// Soft pastel palette (#12)
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', bg: 'rgba(255, 241, 158, 0.75)', border: '#e8d36b', label: 'เหลือง' },
  { id: 'green',  bg: 'rgba(193, 240, 200, 0.80)', border: '#8fd0a0', label: 'เขียว' },
  { id: 'blue',   bg: 'rgba(190, 224, 255, 0.80)', border: '#92bdec', label: 'ฟ้า' },
  { id: 'pink',   bg: 'rgba(255, 206, 224, 0.80)', border: '#eaa3bd', label: 'ชมพู' },
  { id: 'purple', bg: 'rgba(223, 206, 247, 0.80)', border: '#bda3e0', label: 'ม่วง' },
  { id: 'orange', bg: 'rgba(255, 219, 186, 0.85)', border: '#e6b889', label: 'ส้ม' },
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
