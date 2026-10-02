// Press feedback for list rows on touch.
//
// :active cannot do this job on Android. The browser deliberately holds the
// active state back while it works out whether the gesture is a tap or the
// start of a scroll. By the time it commits, a row that navigates has already
// been unmounted — so the flash lands on whichever element the *next* screen
// happens to have put under the finger. That is the "it flashes on the next
// page instead of the row I pressed" bug.
//
// Buttons never showed it: the add-folder button only opens a modal, and the
// tab bar survives every route change, so their :active still resolves onto
// the same node. Only rows that unmount themselves are affected, which is why
// .tap-btn keeps using plain :active and is left alone here.
//
// Binding the class ourselves on touchstart pins it to the node that was
// actually touched. If React unmounts that node the class goes with it, so
// nothing can leak forward into the next screen. touchcancel and scroll clear
// it immediately, so dragging a long list never leaves a trail of highlights.

const ACTIVE = 'tap-on';

// Keep the flash on screen this long even if the finger lifts sooner —
// a tap can be shorter than the eye can catch.
const MIN_VISIBLE_MS = 130;

let current = null;
let shownAt = 0;
let pending = null;

function release(immediate) {
  if (pending) { clearTimeout(pending); pending = null; }
  if (!current) return;
  const el = current;
  current = null;
  const wait = immediate ? 0 : Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
  if (wait === 0) el.classList.remove(ACTIVE);
  else pending = setTimeout(() => { el.classList.remove(ACTIVE); pending = null; }, wait);
}

function onTouchStart(e) {
  release(true);
  const row = e.target?.closest?.('.tap-row');
  if (!row) return;
  row.classList.add(ACTIVE);
  current = row;
  shownAt = Date.now();
}

/**
 * Install the row-press listeners. Safe to call more than once; delegated from
 * the document, so the 1,869 rows on BookScreen cost three listeners in total.
 */
export function initTapFeedback() {
  if (typeof document === 'undefined') return;
  if (document.__tapFeedbackReady) return;
  document.__tapFeedbackReady = true;

  const opts = { passive: true, capture: true };
  document.addEventListener('touchstart', onTouchStart, opts);
  document.addEventListener('touchend', () => release(false), opts);
  // Scrolling and cancellation kill the highlight at once — no lingering.
  document.addEventListener('touchcancel', () => release(true), opts);
  document.addEventListener('scroll', () => release(true), opts);
}
