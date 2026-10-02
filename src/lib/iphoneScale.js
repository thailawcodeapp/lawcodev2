// iPhone UI scaling (iOS iPhone only).
//
// The app's phone layout was designed small; on iPhone it renders full-screen
// but everything (fonts, cards, spacing) looked ~25% too small. We scale the
// whole phone shell up with a CSS transform — the same proven technique as
// ipadScale.js — so every element grows uniformly and proportionally.
//
// Unlike iPad (where the zoom is derived from screen size), the iPhone zoom is
// driven by the user's font-size setting (S/M/L/XL). "M" is the new +25%
// baseline; S is a bit smaller, L/XL progressively larger. This makes the
// existing S/M/L/XL picker control the overall app font + card size.
//
// Strictly iOS-iPhone only: Android and iPad never get the class, so their
// layouts are completely untouched. iPad is handled separately by ipadScale.js.

// Zoom factor per font-size setting. M = 1.20 (the +20% baseline), 10% steps.
const IPHONE_ZOOM = { S: 1.1, M: 1.2, L: 1.3, XL: 1.4 };

const MAX_IPHONE_DIM = 500;   // iPhone min-dimension is ≤440pt; iPad is ≥744pt.

/** True only on an iOS iPhone (not iPad, not Android, not web). */
export function isIphone() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.getPlatform?.() !== 'ios') return false;
  // iPad (min dimension > 500pt) is handled by ipadScale.js — exclude it here.
  return Math.min(window.screen.width, window.screen.height) <= MAX_IPHONE_DIM;
}

/**
 * Apply (or refresh) the iPhone UI scale for the given font-size setting.
 * Safe to call anytime; a no-op on Android, iPad and web.
 * @param {'S'|'M'|'L'|'XL'} [fontScale]
 */
export function applyIphoneScale(fontScale = 'M') {
  if (typeof window === 'undefined') return;
  const el = document.documentElement;
  if (!isIphone()) {
    el.classList.remove('iphone-scale');
    el.style.removeProperty('--iphone-zoom');
    return;
  }
  const z = IPHONE_ZOOM[fontScale] ?? IPHONE_ZOOM.M;
  el.style.setProperty('--iphone-zoom', z.toFixed(3));
  el.classList.add('iphone-scale');
}
