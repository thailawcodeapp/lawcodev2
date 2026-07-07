// In-app purchase wrapper for the auto-renewing "Pro" subscription.
// Uses cordova-plugin-purchase (CdvPurchase) via the global `CdvPurchase`
// object the Cordova plugin injects at runtime.

// Auto-renewing subscription product IDs.
//
// Android: ONE subscription (`pro_yearly`) with three base plans
//   (monthly-auto / quarterly-auto / yearly-auto) — matches Play Console → Subscriptions.
// iOS: App Store has no "base plans", so each duration is a SEPARATE product
//   in the same subscription group — matches App Store Connect → Subscriptions.
export const PRO_PRODUCT_ID_ANDROID       = 'pro_yearly';
export const PRO_PRODUCT_ID_IOS_MONTHLY   = 'com.lawcodev2.app.pro_monthly';
export const PRO_PRODUCT_ID_IOS_QUARTERLY = 'com.lawcodev2.app.pro_quarterly';
export const PRO_PRODUCT_ID_IOS_YEARLY    = 'com.lawcodev2.app.pro_yearly';

// Back-compat alias used by external callers that only target one platform.
export const PRO_PRODUCT_ID = PRO_PRODUCT_ID_ANDROID;

// Which iOS product a plan maps to (Android uses base plans on one product).
function iosProductForPlan(plan) {
  if (plan === 'monthly') return PRO_PRODUCT_ID_IOS_MONTHLY;
  if (plan === 'quarterly') return PRO_PRODUCT_ID_IOS_QUARTERLY;
  return PRO_PRODUCT_ID_IOS_YEARLY;
}

// Android base-plan ID (Play Console) for each plan.
const ANDROID_BASE_PLAN = {
  monthly: 'monthly-auto',
  quarterly: 'quarterly-auto',
  yearly: 'yearly-auto',
};

// ISO 8601 billing period for each plan, used to match an offer when its
// base-plan ID doesn't line up with our naming (fallback matcher).
const ANDROID_BILLING_PERIOD = {
  monthly: 'P1M',
  quarterly: 'P3M',
  yearly: 'P1Y',
};

// Find the Android base-plan offer for a plan on the single subscription product.
// Match order: (1) the specific base-plan ID (e.g. "yearly-auto"); (2) the ISO
// billing period on one of the offer's pricing phases.
//
// We deliberately do NOT match on the bare plan word ("yearly"): the product ID
// is "pro_yearly", so every offer's ID contains that substring — a loose
// includes("yearly") match returns the FIRST offer (monthly) for all plans,
// which is exactly the bug that charged the monthly price for a yearly tap.
function findAndroidOffer(product, plan) {
  if (!product || !Array.isArray(product.offers)) return null;
  const wantedBase = ANDROID_BASE_PLAN[plan];
  const wantedPeriod = ANDROID_BILLING_PERIOD[plan];
  return (
    product.offers.find(o => wantedBase && o.id?.includes(wantedBase)) ||
    product.offers.find(o =>
      wantedPeriod && (o.pricingPhases || []).some(p => p.billingPeriod === wantedPeriod)
    ) ||
    null
  );
}

// The recurring price string for an offer. Prefer the phase whose billing period
// matches the plan (skips any intro/promo phase); else the last phase (the
// recurring phase is normally last); else the first.
function offerRecurringPrice(offer, plan) {
  const phases = offer?.pricingPhases || [];
  if (!phases.length) return null;
  const wantedPeriod = ANDROID_BILLING_PERIOD[plan];
  const matched = wantedPeriod && phases.find(p => p.billingPeriod === wantedPeriod);
  const phase = matched || phases[phases.length - 1] || phases[0];
  return phase?.price || null;
}

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const platform = () =>
  typeof window !== 'undefined' ? (window.Capacitor?.getPlatform?.() ?? 'web') : 'web';

let storePromise = null;

function getStore() {
  if (typeof window === 'undefined') return null;
  return window.CdvPurchase?.store ?? null;
}

// All product IDs this platform should register with the store.
function productIdsForPlatform() {
  return platform() === 'ios'
    ? [PRO_PRODUCT_ID_IOS_MONTHLY, PRO_PRODUCT_ID_IOS_QUARTERLY, PRO_PRODUCT_ID_IOS_YEARLY]
    : [PRO_PRODUCT_ID_ANDROID];
}

function getStorePlatform() {
  const { Platform } = window.CdvPurchase ?? {};
  if (!Platform) return null;
  return platform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
}

/**
 * Initialise the in-app billing store. Safe to call multiple times — only
 * runs the real init once. Resolves once the store has processed the catalog.
 *
 * @param {(isPro: boolean) => void} onProChange  Called whenever entitlement
 *                                               state changes (purchase,
 *                                               restore, refund).
 */
export function initIAP(onProChange) {
  if (!isNative()) return Promise.resolve();
  if (storePromise) return storePromise;

  storePromise = new Promise((resolve) => {
    const tryStart = () => {
      const store = getStore();
      if (!store) {
        // Plugin not yet attached — retry next tick. Cordova plugins attach
        // after `deviceready` so a short delay is normal on cold start.
        setTimeout(tryStart, 200);
        return;
      }

      try {
        const { ProductType, LogLevel } = window.CdvPurchase;
        const storePlatform = getStorePlatform();

        store.verbosity = LogLevel.WARNING;

        store.register(
          productIdsForPlatform().map((id) => ({
            id,
            type: ProductType.PAID_SUBSCRIPTION,
            platform: storePlatform,
          })),
        );

        store.when()
          .approved((tx) => {
            console.log('[IAP] approved', tx);
            tx.verify();
          })
          .verified((receipt) => {
            console.log('[IAP] verified', receipt);
            receipt.finish();
            // Report the current entitlement unconditionally: store.owned() may
            // not have flipped to true synchronously at this instant, so a
            // guarded `if (isPro())` would drop the update and leave the paywall
            // stuck until the next app launch.
            onProChange?.(isPro());
          })
          .unverified((receipt) => {
            console.warn('[IAP] unverified', receipt);
          });

        store.error((err) => {
          console.warn('[IAP] error', err);
        });

        store.initialize([storePlatform]).then(() => {
          console.log('[IAP] initialised');
          // Refresh entitlement after restore
          onProChange?.(isPro());
          resolve();
        }).catch((e) => {
          console.error('[IAP] initialize failed', e);
          resolve();
        });
      } catch (e) {
        console.error('[IAP] setup failed', e);
        resolve();
      }
    };

    if (document.readyState === 'complete') tryStart();
    else document.addEventListener('deviceready', tryStart, { once: true });
    // Fallback if deviceready never fires (web)
    setTimeout(tryStart, 1500);
  });

  return storePromise;
}

/** Returns true if the user owns any Pro product (either iOS plan). */
export function isPro() {
  const store = getStore();
  if (!store) return false;
  try {
    return productIdsForPlatform().some((id) => store.owned(id));
  } catch {
    return false;
  }
}

/**
 * Launch the purchase dialog for the Pro product.
 * @param {'monthly'|'quarterly'|'yearly'} [plan]
 *   iOS: selects the matching separate product.
 *   Android: selects the matching base-plan offer on the single product.
 */
export async function buyPro(plan) {
  if (!isNative()) {
    return { ok: true, dev: true };
  }
  const store = getStore();
  if (!store) return { ok: false, error: 'Store not ready' };

  try {
    if (platform() === 'ios') {
      // Each plan is its own App Store product; just order its default offer.
      const productId = iosProductForPlan(plan);
      const product = store.get(productId);
      if (!product || !product.getOffer()) {
        // Distinguish "store never returned this product" (App Store Connect
        // setup problem) from a transient load failure, so the on-screen
        // message tells us which side to fix.
        console.warn('[IAP] iOS product unavailable:', productId,
          'known products:', store.products?.map?.(p => p.id));
        return {
          ok: false,
          error: `สินค้า ${productId} ยังไม่พร้อมจำหน่าย — ตรวจสถานะใน App Store Connect (ต้อง Ready to Submit) หรือรอสักครู่แล้วลองใหม่`,
        };
      }
      await store.order(product.getOffer());
      return { ok: true };
    }

    // Android: one subscription, pick the requested base-plan offer.
    const product = store.get(PRO_PRODUCT_ID_ANDROID);
    if (!product) return { ok: false, error: 'Product not found' };

    // Same matcher the price display uses, so what the user taps is what they pay.
    // If a specific plan was requested but no matching offer exists, fail loudly
    // rather than silently ordering the default offer — that would charge a
    // different plan than the one the user tapped (the bug we just fixed).
    const offer = plan ? findAndroidOffer(product, plan) : product.getOffer();
    if (!offer) {
      return {
        ok: false,
        error: plan
          ? `ไม่พบแพ็กเกจที่เลือกในร้านค้า กรุณาลองใหม่อีกครั้ง`
          : 'No offer available',
      };
    }

    await store.order(offer);
    return { ok: true };
  } catch (e) {
    console.error('[IAP] buyPro failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Re-query the store for past purchases — used by "Restore" button. */
export async function restorePurchases() {
  if (!isNative()) return { ok: true, dev: true };
  const store = getStore();
  if (!store) return { ok: false };
  try {
    await store.restorePurchases();
    return { ok: true };
  } catch (e) {
    console.warn('[IAP] restore failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Localised price for a plan: its own product (iOS) or base plan (Android). */
export function getPlanPrice(plan) {
  const store = getStore();
  if (!store) return null;
  try {
    if (platform() === 'ios') {
      const product = store.get(iosProductForPlan(plan));
      const o = product?.getOffer();
      return o?.pricingPhases?.[0]?.price || null;
    }
    const product = store.get(PRO_PRODUCT_ID_ANDROID);
    const offer = findAndroidOffer(product, plan);
    return offerRecurringPrice(offer, plan);
  } catch {
    return null;
  }
}
