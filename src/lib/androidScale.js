// Android phone UI scaling.
//
// The S/M/L/XL setting used to change one thing on Android: the body text in
// the reader. Section lists, folder names, the contents tree, search results
// and the settings screen were all fixed pixel sizes, so a user who picked XL
// because they could not read the app got a bigger reader and no other change.
// iPhone and iPad already scale the whole shell (iphoneScale.js, ipadScale.js);
// this brings Android phones in line using the same proven transform.
//
// Deliberate safety properties, because the Android layout was already
// considered correct and must not move for anyone who never opens the setting:
//
//   1. Whichever step carries zoom exactly 1.00 gets no class added at all,
//      rather than a class carrying a no-op transform. That keeps the CSS on
//      its existing path — the @media (max-width: 430px) rule in index.css —
//      instead of routing through the scale rules for nothing. Originally
//      that step was M (the stored default); after this size range shifted
//      up one notch (old S dropped, old M/L/XL became the new S/M/L, and a
//      new XL was added a step above old XL) it is S, so the untouched
//      layout is now reachable by picking S rather than being the default.
//
//   2. Phones only. Android tablets and foldables keep whatever they do now;
//      the min-dimension test mirrors isIphone() in iphoneScale.js.
//
// The zoom steps were originally chosen so the reader body landed on its
// existing size at every setting (S/M/L/XL → 18/20/22/24, the old fontSizes
// map) with M untouched. That guarantee now applies to S instead of M.

// Zoom per font-size setting, in fixed 0.1 steps.
const ANDROID_ZOOM = { S: 1.0, M: 1.1, L: 1.2, XL: 1.3 };

const MAX_PHONE_DIM = 500;   // CSS px, between phone (≤430) and tablet (≥600)

/**
 * True only on an Android phone (not an Android tablet, not iOS, not web).
 *
 * Measured from the VIEWPORT, not window.screen. iphoneScale.js can use
 * window.screen because iOS reports it in points — 390 on an iPhone 14. Android
 * reports the physical display instead, so the same phone answers 1080 x 2400.
 * Copying the screen-based test over meant min() came out at 1080, sailed past
 * any sane phone threshold, and the scale silently never engaged on a real
 * device. index.html sets width=device-width, so innerWidth/innerHeight are
 * CSS pixels on both platforms and describe the box the layout actually lives
 * in — which is the thing being scaled.
 */
export function isAndroidPhone() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.getPlatform?.() !== 'android') return false;
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  if (!w || !h) return false;
  // min() so the answer survives rotation.
  return Math.min(w, h) <= MAX_PHONE_DIM;
}

/**
 * Apply (or refresh) the Android phone UI scale for the given font-size
 * setting. Safe to call anytime; a no-op on iOS, web, and Android tablets.
 * @param {'S'|'M'|'L'|'XL'} [fontScale]
 */
export function applyAndroidScale(fontScale = 'M') {
  if (typeof window === 'undefined') return;
  const el = document.documentElement;
  const z = ANDROID_ZOOM[fontScale] ?? ANDROID_ZOOM.M;

  // Off the platform, or sitting on the untouched default — leave the document
  // exactly as it would have been before this file existed.
  if (!isAndroidPhone() || z === 1) {
    el.classList.remove('android-scale');
    el.style.removeProperty('--android-zoom');
    return;
  }

  el.style.setProperty('--android-zoom', z.toFixed(3));
  el.classList.add('android-scale');
}
