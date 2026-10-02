// iPad UI scaling.
//
// The app is a phone-designed layout (390pt wide). On phones the
// `@media (max-width: 430px)` rule in index.css makes .phone-shell fill the
// screen; iPads (min dimension 744pt+) never match it, so they showed the
// desktop "phone frame" floating in the middle of the screen.
//
// On iPad we scale the whole phone UI up to fill the screen: index.css has an
// `html.ipad-scale` rule that sizes .phone-shell to (viewport / zoom) and
// transform-scales it back up by var(--ipad-zoom). Using transform (not zoom)
// makes every position:fixed element (TtsPlayer, modals) anchor to the scaled
// app box, so nothing overflows.
//
// The base zoom fills the screen; the S/M/L/XL font-size setting then fine-tunes
// it. L = 1.0 = the natural screen-fill size (the previous, unadjustable size);
// S/M shrink it, XL grows it. This mirrors the iPhone scaling (iphoneScale.js).
//
// Strictly iOS-iPad only: Android and iPhone never get the class, so their
// layout is untouched. iPhone is handled separately by iphoneScale.js.

const MIN_IPAD_DIM = 500;   // between iPhone max (440) and iPad min (744)
const DESIGN_WIDTH = 430;   // matches the phone media-query breakpoint
const MAX_ZOOM = 2;

// Multiplier on top of the screen-fill base zoom. L = current size.
const IPAD_FONT_MULT = { S: 0.85, M: 0.92, L: 1.0, XL: 1.1 };

function isIpad() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.getPlatform?.() !== 'ios') return false;
  return Math.min(window.screen.width, window.screen.height) > MIN_IPAD_DIM;
}

/**
 * Apply (or refresh) the iPad UI scale for the given font-size setting.
 * Safe to call anytime; a no-op on Android, iPhone and web.
 * @param {'S'|'M'|'L'|'XL'} [fontScale]
 */
export function applyIpadScale(fontScale = 'L') {
  if (typeof window === 'undefined') return;
  const el = document.documentElement;
  if (!isIpad()) {
    el.classList.remove('ipad-scale');
    el.style.removeProperty('--ipad-zoom');
    return;
  }
  // Scale by the smaller viewport dimension so the phone layout "grows" into
  // the iPad screen in both orientations without overflowing.
  const base = Math.max(1, Math.min(window.innerWidth, window.innerHeight) / DESIGN_WIDTH);
  const mult = IPAD_FONT_MULT[fontScale] ?? IPAD_FONT_MULT.L;
  const z = Math.min(MAX_ZOOM, base * mult);
  el.style.setProperty('--ipad-zoom', z.toFixed(3));
  el.classList.add('ipad-scale');
}
