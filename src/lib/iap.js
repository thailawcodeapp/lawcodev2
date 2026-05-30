// In-app purchase wrapper for the one-time "Pro Unlock" product.
// Uses cordova-plugin-purchase (CdvPurchase) via the global `CdvPurchase`
// object the Cordova plugin injects at runtime.

export const PRO_PRODUCT_ID = 'pro_lifetime';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

let storePromise = null;

function getStore() {
  if (typeof window === 'undefined') return null;
  return window.CdvPurchase?.store ?? null;
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
        const { ProductType, Platform, LogLevel } = window.CdvPurchase;
        store.verbosity = LogLevel.WARNING;

        store.register([{
          id: PRO_PRODUCT_ID,
          type: ProductType.NON_CONSUMABLE,
          platform: Platform.GOOGLE_PLAY,
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

        store.initialize([Platform.GOOGLE_PLAY]).then(() => {
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
    return store.owned(PRO_PRODUCT_ID);
  } catch {
    return false;
  }
}

/**
 * Launch the Play Store purchase dialog for the Pro product.
 * Resolves when the user closes the dialog (success or cancel).
 */
export async function buyPro() {
  if (!isNative()) {
    // Web fallback — pretend the purchase succeeded for dev/testing.
    return { ok: true, dev: true };
  }
  const store = getStore();
  if (!store) return { ok: false, error: 'Store not ready' };

  try {
    const product = store.get(PRO_PRODUCT_ID);
    if (!product) return { ok: false, error: 'Product not found' };
    const offer = product.getOffer();
    if (!offer) return { ok: false, error: 'No offer available' };
    await store.order(offer);
    return { ok: true };
  } catch (e) {
    console.error('[IAP] buyPro failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Re-query Google Play for past purchases — used by "Restore" button. */
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

/** Format the localised price string for display. */
export function getPriceString() {
  const store = getStore();
  if (!store) return '';
  try {
    const product = store.get(PRO_PRODUCT_ID);
    const offer = product?.getOffer();
    const phase = offer?.pricingPhases?.[0];
    return phase?.price || '';
  } catch {
    return '';
  }
}
