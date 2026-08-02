// Android phone UI scaling.
//
// The S/M/L/XL setting used to change one thing on Android: the body text in
// the reader. Section lists, folder names, the contents tree, search results
// and the settings screen were all fixed pixel sizes, so a user who picked XL
// because they could not read the app got a bigger reader and no other change.
// iPhone and iPad already scale the whole shell (iphoneScale.js, ipadScale.js);
// this brings Android phones in line using the same proven transform.
//
// Three deliberate safety properties, because the Android layout was already
// considered correct and must not move for anyone who never opens the setting:
//
//   1. M is exactly 1.00, and M is the stored default. Unlike iPhone, where M
//      is a +20% baseline, Android needs no correction — today's layout IS the
//      target, so the default setting must reproduce it untouched.
//
//   2. At M no class is added at all, rather than a class carrying zoom 1.
//      That keeps the CSS on its existing path — the @media (max-width: 430px)
//      rule in index.css — instead of routing through the scale rules with a
//      no-op transform. Anything the transform might do differently (a phone
//      wider than the breakpoint, a stacking-context change) simply cannot
//      happen at the default.
//
//   3. Phones only. Android tablets and foldables keep whatever they do now;
//      the min-dimension test mirrors isIphone() in iphoneScale.js.
//
// The zoom steps are chosen so the reader body lands on its existing size at
// every setting: with the reader pinned to a 20px base, S/M/L/XL render at
// 18/20/22/24 — the exact values of the old fontSizes map. The body text does
// not change at all; the rest of the UI simply starts following it.

// Zoom per font-size setting. M = 1.00 = today's Android layout, exactly.
const ANDROID_ZOOM = { S: 0.9, M: 1.0, L: 1.1, XL: 1.2 };

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
