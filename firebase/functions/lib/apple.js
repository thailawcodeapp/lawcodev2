// Apple receipt validation.
//
// This app runs StoreKit 1 (ios/capacitor-cordova-ios-plugins/sources/
// CordovaPluginPurchase has only InAppPurchase.m — no SK2 bridge), so the
// client hands us the monolithic base64 app receipt, read straight off disk
// by [NSBundle mainBundle].appStoreReceiptURL. No network and no sign-in
// prompt happens on the device; the only party that can read the receipt is
// Apple, which is what this module asks.

import { okPayload, errorPayload, purchaseEntry, ERROR_CODES } from './protocol.js';

export const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
export const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

/** Apple's documented "sandbox receipt sent to production" status. */
const SANDBOX_RECEIPT = 21007;

async function post(fetchImpl, url, body) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Parses a millisecond timestamp field, mapping non-finite and non-positive
 * values to `undefined`. Epoch-0 (and anything <= 0) is never a real Apple
 * timestamp in either purchase_date_ms or expires_date_ms, and a `0`
 * expiryDateMs is indistinguishable from "no expiry" to the consumer — see
 * purchaseEntry in protocol.js — so it must be treated as unparseable.
 */
function parseMs(value) {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Newest renewal per product id, by purchase date. A missing/unparseable date sorts as 0. */
function newestPerProduct(entries) {
  const byProduct = new Map();
  for (const info of entries) {
    const at = parseMs(info.purchase_date_ms) ?? 0;
    const seen = byProduct.get(info.product_id);
    if (!seen || (parseMs(seen.purchase_date_ms) ?? 0) < at) byProduct.set(info.product_id, info);
  }
  return [...byProduct.values()];
}

export async function validateApple({ appStoreReceipt, bundleId, sharedSecret, now, fetchImpl }) {
  const body = {
    'receipt-data': appStoreReceipt,
    password: sharedSecret,
    'exclude-old-transactions': true,
  };

  let data;
  try {
    data = await post(fetchImpl, APPLE_PRODUCTION_URL, body);
    if (data?.status === SANDBOX_RECEIPT) {
      data = await post(fetchImpl, APPLE_SANDBOX_URL, body);
    }
  } catch (e) {
    return errorPayload(ERROR_CODES.COMMUNICATION, `verifyReceipt failed: ${e.message}`);
  }

  if (data?.status !== 0) {
    return errorPayload(ERROR_CODES.VERIFICATION_FAILED, `Apple returned status ${data?.status}`);
  }

  const collection = [];
  for (const info of newestPerProduct(data.latest_receipt_info ?? [])) {
    if (info.expires_date_ms !== undefined && parseMs(info.expires_date_ms) === undefined) {
      return errorPayload(
        ERROR_CODES.VERIFICATION_FAILED,
        `Apple returned an unparseable expires_date_ms for product ${info.product_id}: ${info.expires_date_ms}`,
      );
    }
    collection.push(
      purchaseEntry({
        id: info.product_id,
        transactionId: info.original_transaction_id,
        purchaseDateMs: parseMs(info.purchase_date_ms),
        expiryDateMs: parseMs(info.expires_date_ms),
        now,
      }),
    );
  }

  return okPayload({ id: bundleId, transactionType: 'ios-appstore', collection });
}
