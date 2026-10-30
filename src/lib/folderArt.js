// Each folder's picture on Wave: the four built-in folders have their own
// origami art, and a folder the user makes takes one of six patterns, picked
// from its id so it keeps the same one for good. Pictures are found by file
// name in src/assets/wave/folders/ (forgotten, nethi, attorney, judge,
// own-1 … own-6); until one is there, the folder's colour and symbol stand in.
const files = import.meta.glob('../assets/wave/folders/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });
const IMAGES = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), url]),
);

const BUILT_IN = {
  'grp-forgotten': { key: 'forgotten', color: '#DD6D2E', symbol: '?' },
  'grp-nethi': { key: 'nethi', color: '#3A66AB', symbol: 'น' },
  'grp-attorney': { key: 'attorney', color: '#792322', symbol: 'อ' },
  'grp-judge': { key: 'judge', color: '#269485', symbol: 'พ' },
};

// The ground colour of each pattern's art: books, bookmark, headphones,
// star, paper airplane, lantern.
export const OWN_COLORS = ['#7752B4', '#81802D', '#C84D7A', '#2C436D', '#AF7222', '#5A707D'];

// Small, stable string hash (FNV-1a), so a folder's pattern never changes.
export function patternIndex(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % OWN_COLORS.length;
}

// { key, color, symbol, image, letter } — `letter` is set for the user's own
// folders, which show their initial over the pattern.
export function folderArt(folder, images = IMAGES) {
  const built = BUILT_IN[folder.id];
  if (built) return { ...built, image: images[built.key] ?? null, letter: null };
  const i = patternIndex(folder.id);
  const key = `own-${i + 1}`;
  const letter = (folder.name || '').trim().slice(0, 1) || '•';
  return { key, color: OWN_COLORS[i], symbol: letter, image: images[key] ?? null, letter };
}
