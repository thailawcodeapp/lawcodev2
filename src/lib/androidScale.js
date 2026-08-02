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

const MAX_PHONE_DIM = 500;   // same threshold iphoneScale.js uses to exclude iPad

/** True only on an Android phone (not an Android tablet, not iOS, not web). */
export function isAndroidPhone() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.getPlatform?.() !== 'android') return false;
  return Math.min(window.screen.width, window.screen.height) <= MAX_PHONE_DIM;
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
