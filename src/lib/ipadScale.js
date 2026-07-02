// iPad UI scaling.
//
// The app is a phone-designed layout (390pt wide). On phones the
// `@media (max-width: 430px)` rule in index.css makes .phone-shell fill the
// screen; iPads (min dimension 744pt+) never match it, so they showed the
// desktop "phone frame" floating in the middle of the screen.
//
// On iPad we instead scale the whole phone UI up to fill the screen:
// index.css has an `html.ipad-scale` rule that sizes .phone-shell to
// (viewport / zoom) and transform-scales it back up by var(--ipad-zoom).
// Using transform (not zoom) makes every position:fixed element (TtsPlayer,
// modals) anchor to the scaled app box, so nothing overflows.
//
// Strictly iOS-only: Android and iPhone never get the class — their layout
// is untouched. iPhone max width is 440pt, iPad min is 744pt, so a 500pt
// threshold cleanly separates them.

const MIN_IPAD_DIM = 500;   // between iPhone max (440) and iPad min (744)
const DESIGN_WIDTH = 430;   // matches the phone media-query breakpoint
const MAX_ZOOM = 2;

function isIpad() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.getPlatform?.() !== 'ios') return false;
  return Math.min(window.screen.width, window.screen.height) > MIN_IPAD_DIM;
}

function apply() {
  const el = document.documentElement;
  if (!isIpad()) {
    el.classList.remove('ipad-scale');
    el.style.removeProperty('--ipad-zoom');
    return;
  }
  // Scale by the smaller viewport dimension so the phone layout "grows"
  // into the iPad screen in both orientations without overflowing.
  const z = Math.min(
    MAX_ZOOM,
    Math.max(1, Math.min(window.innerWidth, window.innerHeight) / DESIGN_WIDTH),
  );
  el.style.setProperty('--ipad-zoom', z.toFixed(3));
  el.classList.add('ipad-scale');
}

export function initIpadScale() {
  if (typeof window === 'undefined') return;
  apply();
  // The Capacitor bridge may not be wired into the WebView yet at
  // module-load time (same cold-start race as admob.js) — getPlatform()
  // would miss 'ios'. Retry a few times shortly after boot.
  setTimeout(apply, 300);
  setTimeout(apply, 1500);
  // Re-evaluate on rotation / split-view resize.
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
