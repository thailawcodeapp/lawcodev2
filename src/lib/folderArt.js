// Each folder's picture on Wave: the four built-in folders have their own
// origami art, and the user's own folders take the six patterns in turn, in
// the order they were made, so neighbours never share a picture. Pictures are
// found by file name in src/assets/wave/folders/ (forgotten, nethi, attorney,
// judge, own-1 … own-6); until one is there, the folder's colour stands in.
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

// Where this folder comes among the user's own, oldest first.
export function ownPosition(folder, folders) {
  const own = folders
    .filter(f => !BUILT_IN[f.id] && f.type !== 'group' && !f.parentId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return Math.max(0, own.findIndex(f => f.id === folder.id));
}

// { key, color, symbol, image }
export function folderArt(folder, folders = [], images = IMAGES) {
  const built = BUILT_IN[folder.id];
  if (built) return { ...built, image: images[built.key] ?? null };
  const i = ownPosition(folder, folders) % OWN_COLORS.length;
  const key = `own-${i + 1}`;
  return { key, color: OWN_COLORS[i], symbol: '', image: images[key] ?? null };
}
