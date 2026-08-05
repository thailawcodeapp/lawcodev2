// The wire format cordova-plugin-purchase expects from a receipt validator.
// See node_modules/cordova-plugin-purchase/src/ts/validator/validator-response.ts

export const ERROR_CODES = {
  COMMUNICATION: 6777014,
  VERIFICATION_FAILED: 6777017,
  BAD_RESPONSE: 6777018,
};

/**
 * One entry of the `collection[]` the plugin turns into a VerifiedPurchase.
 *
 * `expiryDate` is left OFF the object when unknown. The plugin's ownership
 * test is `if (purchase.expiryDate) return purchase.expiryDate > now`, so a
 * falsy 0 would fall through to `return true` and grant Pro forever.
 */
export function purchaseEntry({ id, transactionId, purchaseDateMs, expiryDateMs, now }) {
  const entry = {
    id,
    transactionId,
    purchaseDate: purchaseDateMs,
    isExpired: expiryDateMs !== undefined && expiryDateMs <= now,
  };
  if (expiryDateMs !== undefined) entry.expiryDate = expiryDateMs;
  return entry;
}

export function okPayload({ id, transactionType, collection }) {
  return {
    ok: true,
    data: {
      id,
      latest_receipt: true,
      transaction: { type: transactionType },
      collection,
    },
  };
}

export function errorPayload(code, message) {
  return { ok: false, code, message };
}
