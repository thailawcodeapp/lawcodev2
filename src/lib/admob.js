import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';

// Evaluate at runtime — Capacitor.isNativePlatform() at module-load time
// can return false on Android before the native bridge is wired into the
// WebView, locking the constant to false for the rest of the session.
const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const BANNER_ID       = 'ca-app-pub-4108810718545537/5969195900';
const INTERSTITIAL_ID = 'ca-app-pub-4108810718545537/8656737299';
const REWARDED_ID     = 'ca-app-pub-4108810718545537/5254880038';

// Reserve this many CSS pixels for the banner overlay at the top of the
// WebView. Adaptive banners are typically 50–60 dp tall; we use a slightly
// generous reserve so the first banner load doesn't push content down.
const BANNER_RESERVE_PX = 60;

let initPromise = null;
let bannerActive = false;

// ─── Top-padding management ──────────────────────────────────────────────────
// The native AdMob banner is an *overlay* that sits on top of the WebView at
// TOP_CENTER. The WebView is not auto-resized by the plugin, so without
// extra spacing the banner covers the app header. We reserve a fixed top
// padding on <html> while the banner is active and update it to the
// real banner height once the SizeChanged event reports it.

function setBannerSpace(px) {
  if (typeof document === 'undefined') return;
  // Consumed by CSS — see `.phone-shell` rules in index.css which subtract
  // the banner height from the shell's height and add a matching margin-top.
  document.documentElement.style.setProperty('--banner-height', `${px}px`);
}

function clearBannerSpace() {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty('--banner-height');
}

// ─── Init ────────────────────────────────────────────────────────────────────

export function initAdMob() {
  if (!isNative()) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await AdMob.initialize({
        initializeForTesting: false,
        testingDevices: [],
      });
      console.log('[AdMob] initialized');

      AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
        console.log('[AdMob] banner loaded');
      });
      AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
        console.warn('[AdMob] banner FAILED:', JSON.stringify(error));
      });
      AdMob.addListener(BannerAdPluginEvents.Opened, () => {
        console.log('[AdMob] banner opened');
      });
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
        // Adaptive banner reports its actual height — use it so we reserve
        // the exact amount and content sits flush below.
        const h = Number(info?.height) || BANNER_RESERVE_PX;
        if (bannerActive && h > 0) setBannerSpace(h);
      });

      AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        console.log('[AdMob] interstitial loaded');
      });
      AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
        console.warn('[AdMob] interstitial FAILED:', JSON.stringify(error));
      });
    } catch (e) {
      console.error('[AdMob] init failed:', e);
    }
  })();
  return initPromise;
}

// ─── Banner ──────────────────────────────────────────────────────────────────

export async function showBanner(isPro) {
  if (!isNative() || isPro) return;
  // Reserve space immediately so the page doesn't bounce when the banner
  // finally renders. The exact height is updated by the SizeChanged listener.
  bannerActive = true;
  setBannerSpace(BANNER_RESERVE_PX);
  await initAdMob();
  try {
    await AdMob.showBanner({
      adId: BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
      isTesting: false,
    });
    console.log('[AdMob] showBanner called');
  } catch (e) {
    console.warn('[AdMob] showBanner failed:', e);
  }
}

export async function removeBanner() {
  if (!isNative()) return;
  bannerActive = false;
  try { await AdMob.removeBanner(); } catch {}
  clearBannerSpace();
}

/**
 * Ensure the banner is visible. Called on screen transitions where we want
 * to guarantee the banner is present (e.g. opening a new section in the
 * reader). Previous implementation did hideBanner+showBanner to force a
 * fresh creative, but on @capacitor-community/admob v8 the hide call left
 * the WebView's banner slot torn down in some cases — the reader screen
 * ended up with no banner at all. AdMob's built-in rotation (configured
 * per banner unit in the AdMob console, default 60s) already refreshes
 * the creative without help, so we just guarantee the banner is showing
 * and otherwise leave it alone.
 */
export async function refreshBanner(isPro) {
  if (!isNative() || isPro) return;
  if (!bannerActive) {
    return showBanner(isPro);
  }
  // Banner already active — AdMob handles creative rotation natively.
}

// ─── Interstitial ────────────────────────────────────────────────────────────

export async function loadInterstitial(isPro) {
  if (!isNative() || isPro) return;
  await initAdMob();
  try {
    await AdMob.prepareInterstitial({
      adId: INTERSTITIAL_ID,
      isTesting: false,
    });
  } catch (e) {
    console.warn('[AdMob] loadInterstitial failed:', e);
  }
}

export async function showInterstitial(isPro) {
  if (!isNative() || isPro) return;
  try {
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('[AdMob] showInterstitial failed:', e);
  }
  // Pre-load the next one
  loadInterstitial(isPro);
}

// ─── Rewarded ─────────────────────────────────────────────────────────────────
// Show a rewarded video and resolve true if the user earned the reward.
// On web/dev (no native AdMob) we resolve true immediately so the quota
// top-up flow is testable in the browser.
export async function showRewarded() {
  if (!isNative()) return true; // dev fallback — grant reward
  await initAdMob();

  let earned = false;
  let rewardListener;
  try {
    rewardListener = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      () => { earned = true; },
    );
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_ID, isTesting: false });
    await AdMob.showRewardVideoAd();
  } catch (e) {
    console.warn('[AdMob] rewarded failed:', e);
  } finally {
    rewardListener?.remove?.();
  }
  return earned;
}
