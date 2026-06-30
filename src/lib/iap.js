// In-app purchase wrapper for the auto-renewing yearly "Pro" subscription.
// Uses cordova-plugin-purchase (CdvPurchase) via the global `CdvPurchase`
// object the Cordova plugin injects at runtime.

// Yearly auto-renewing subscription product IDs.
// Android: short ID matching Play Console → Monetization → Subscriptions.
// iOS: reverse-domain ID matching App Store Connect → Monetization → Subscriptions.
export const PRO_PRODUCT_ID_ANDROID = 'pro_yearly';
export const PRO_PRODUCT_ID_IOS     = 'com.lawcodev2.app.pro_yearly';

// Back-compat alias used by external callers that only target one platform.
export const PRO_PRODUCT_ID = PRO_PRODUCT_ID_ANDROID;

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const platform = () =>
  typeof window !== 'undefined' ? (window.Capacitor?.getPlatform?.() ?? 'web') : 'web';

let storePromise = null;

function getStore() {
  if (typeof window === 'undefined') return null;
  return window.CdvPurchase?.store ?? null;
}

function getProductIdForPlatform() {
  return platform() === 'ios' ? PRO_PRODUCT_ID_IOS : PRO_PRODUCT_ID_ANDROID;
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
        const productId = getProductIdForPlatform();

        store.verbosity = LogLevel.WARNING;

        store.register([{
          id: productId,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: storePlatform,
        }]);

        store.when()
          .approved((tx) => {
            console.log('[IAP] approved', tx);
            tx.verify();
          })
          .verified((receipt) => {
            console.log('[IAP] verified', receipt);
            receipt.finish();
            if (isPro()) onProChange?.(true);
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

/** Returns true if the user already owns the Pro product. */
export function isPro() {
  const store = getStore();
  if (!store) return false;
  try {
    return store.owned(getProductIdForPlatform());
  } catch {
    return false;
  }
}

/**
 * Launch the purchase dialog for the Pro product.
 * On Android: pass plan='yearly'|'quarterly' to pick a base plan offer.
 * On iOS: App Store doesn't use base plans — omit plan or pass 'yearly'.
 */
export async function buyPro(plan) {
  if (!isNative()) {
    return { ok: true, dev: true };
  }
  const store = getStore();
  if (!store) return { ok: false, error: 'Store not ready' };

  try {
    const productId = getProductIdForPlatform();
    const product = store.get(productId);
    if (!product) return { ok: false, error: 'Product not found' };

    let offer = null;
    if (plan && Array.isArray(product.offers) && platform() === 'android') {
      // Base-plan IDs in Play Console: "yearly-auto" and "quarterly-auto".
      const wantedBase = plan === 'quarterly' ? 'quarterly-auto' : 'yearly-auto';
      offer = product.offers.find(o => {
        const phases = o.pricingPhases || [];
        const cycles = phases.map(p => p.billingPeriod || '').join('|');
        return o.id?.includes(plan) ||
               o.id?.includes(wantedBase) ||
               (plan === 'quarterly' && /P3M/.test(cycles)) ||
               (plan === 'yearly' && /P1Y/.test(cycles));
      });
    }
    if (!offer) offer = product.getOffer();
    if (!offer) return { ok: false, error: 'No offer available' };

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

/** Localised price for a specific base plan (Android) or default offer (iOS). */
export function getPlanPrice(plan) {
  const store = getStore();
  if (!store) return null;
  try {
    const product = store.get(getProductIdForPlatform());
    if (!product?.offers) return null;
    if (platform() === 'ios') {
      // App Store: pick first pricing phase of the default offer
      const o = product.getOffer();
      return o?.pricingPhases?.[0]?.price || null;
    }
    const o = product.offers.find(x => x.id?.includes(plan));
    return o?.pricingPhases?.[0]?.price || null;
  } catch {
    return null;
  }
}

/** Format the localised price string for display (default offer). */
export function getPriceString() {
  const store = getStore();
  if (!store) return '';
  try {
    const product = store.get(getProductIdForPlatform());
    const offer = product?.getOffer();
    const phase = offer?.pricingPhases?.[0];
    return phase?.price || '';
  } catch {
    return '';
  }
}
