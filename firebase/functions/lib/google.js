// Google Play subscription validation via purchases.subscriptionsv2.get.
//
// The API client is injected rather than constructed here: googleapis needs
// credentials, and every test in this file must run with none.

import { okPayload, errorPayload, purchaseEntry, ERROR_CODES } from './protocol.js';

const msOrUndefined = (rfc3339) => {
  if (!rfc3339) return undefined;
  const ms = Date.parse(rfc3339);
  return Number.isNaN(ms) ? undefined : ms;
};

export async function validateGoogle({ productId, purchaseToken, packageName, now, subscriptionsV2 }) {
  let data;
  try {
    ({ data } = await subscriptionsV2.get({ packageName, token: purchaseToken }));
  } catch (e) {
    return errorPayload(ERROR_CODES.COMMUNICATION, `subscriptionsv2.get failed: ${e.message}`);
  }

  const purchaseDateMs = msOrUndefined(data?.startTime);
  const collection = [];
  for (const item of data?.lineItems ?? []) {
    // expiryTime present but unparseable must NOT be treated as "no expiry
    // known" — purchaseEntry (and the plugin's ownership check downstream)
    // read a missing expiryDate as owned forever. Silently falling through
    // here would grant permanent Pro from bad data, so fail verification
    // instead and let the client keep whatever entitlement it already has.
    // (Matches the approach apple.js settled on for the same trap.)
    if (item.expiryTime !== undefined && msOrUndefined(item.expiryTime) === undefined) {
      return errorPayload(
        ERROR_CODES.VERIFICATION_FAILED,
        `Google returned an unparseable expiryTime for product ${item.productId}: ${item.expiryTime}`,
      );
    }
    collection.push(
      purchaseEntry({
        id: item.productId,
        transactionId: data.latestOrderId,
        purchaseDateMs,
        // expiryTime is the paid-through date. It stays in the future while a
        // canceled-but-not-yet-lapsed subscription is still usable, which is
        // why subscriptionState is deliberately not consulted here.
        expiryDateMs: msOrUndefined(item.expiryTime),
        now,
      }),
    );
  }

  return okPayload({ id: productId, transactionType: 'android-playstore', collection });
}
