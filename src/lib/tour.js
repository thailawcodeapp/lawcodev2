// First-run guide drawn over the real UI (coach marks): it spotlights the
// actual tab and columns rather than showing a picture of them. Pure logic
// lives here so it can be tested without a DOM; AppTour.jsx renders it.

export const TOUR_KEY = 'lawcode-th-tour-v1';

export const TOUR_STEPS = [
  {
    id: 'tab',
    path: '/',
    target: 'tab-select',
    title: 'ฟังทีละหลายมาตรา เริ่มที่นี่',
    text: 'อยากฟังต่อเนื่องหลายมาตรา แตะแท็บ “เลือกฟัง” ด้านล่างนี้',
  },
  {
    id: 'tick',
    path: '/select',
    target: 'select-list',
    clipHeight: 250,
    title: 'ติ๊กเลือกมาตรา',
    text: 'ติ๊กช่องหน้าภาคหรือหมวดเพื่อเลือกทั้งหมด หรือแตะชื่อเพื่อเข้าไปติ๊กทีละมาตรา',
  },
  {
    id: 'play',
    path: '/select',
    target: 'select-bar',
    mock: 'bar',
    title: 'กด “ฟังเลย”',
    text: 'ติ๊กแล้วแถบล่างจะเปลี่ยนเป็นแบบนี้ กด “ฟังเลย” แอปจะเล่นต่อกันทีละมาตราจนครบ',
  },
  {
    id: 'album',
    path: '/select',
    target: 'select-folders',
    clipHeight: 250,
    title: 'เก็บเป็นอัลบั้มไว้ฟังซ้ำ',
    text: 'แตะเลือกโฟลเดอร์ก่อน แล้วติ๊กมาตราและกด “+ เพิ่มใน” ครั้งต่อไปกด ▶ ข้างโฟลเดอร์ ฟังทั้งอัลบั้มได้เลย',
  },
];

let storageOverride = null;
export function _setTourStorage(s) { storageOverride = s; }

function tourStorage() {
  if (storageOverride) return storageOverride;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function hasSeen(storage = tourStorage()) {
  try { return !!storage?.getItem(TOUR_KEY); } catch { return false; }
}

export function markSeen(storage = tourStorage()) {
  try { storage?.setItem(TOUR_KEY, '1'); } catch { /* private mode / full: shows once more next launch */ }
}

// Strict on purpose: every condition must be exactly true, so a value that is
// still unknown (data not loaded yet) never opens the tour early.
export function shouldAutoShow({ seen, pathname, dataReady, blocking }) {
  return seen === false && pathname === '/' && dataReady === true && !blocking;
}

// Rects from getBoundingClientRect are in screen pixels, but the app shell is
// scaled with a CSS transform on iPhone/iPad/Android, and the overlay lives
// inside it. Convert to the overlay's own unscaled units.
export function toLocalRect(rect, frame, zoom = 1) {
  const z = zoom || 1;
  return {
    top: (rect.top - frame.top) / z,
    left: (rect.left - frame.left) / z,
    width: rect.width / z,
    height: rect.height / z,
  };
}

export function clipRect(rect, clipHeight) {
  if (!rect || !clipHeight || rect.height <= clipHeight) return rect;
  return { ...rect, height: clipHeight };
}

export function placeCard(target, card, viewport, margin = 12) {
  const bottom = target.top + target.height;
  const roomBelow = viewport.height - bottom - margin;
  const roomAbove = target.top - margin;
  let side;
  if (roomBelow >= card.height) side = 'below';
  else if (roomAbove >= card.height) side = 'above';
  else side = roomBelow >= roomAbove ? 'below' : 'above';

  let top = side === 'below' ? bottom + margin : target.top - margin - card.height;
  top = Math.max(margin, Math.min(top, viewport.height - card.height - margin));

  let left = target.left + target.width / 2 - card.width / 2;
  left = Math.max(margin, Math.min(left, viewport.width - card.width - margin));

  return { top, left, side };
}

let open = false;
const subscribers = new Set();
const emit = () => subscribers.forEach(fn => fn());

export function isTourOpen() { return open; }

export function subscribeTour(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function startTour() {
  if (open) return;
  open = true;
  emit();
}

// Skipping and finishing both count as "seen": the tour never forces itself
// on anyone twice. It stays replayable from Settings.
export function closeTour() {
  if (!open) return;
  open = false;
  markSeen();
  emit();
}
