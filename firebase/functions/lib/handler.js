// Routes a cordova-plugin-purchase validation body to the right store.

import { errorPayload, ERROR_CODES } from './protocol.js';

export async function handleValidation(body, { validateApple, validateGoogle, now }) {
  const tx = body?.transaction;
  if (!tx?.type) {
    return errorPayload(ERROR_CODES.BAD_RESPONSE, 'Missing transaction in request body');
  }

  if (tx.type === 'ios-appstore') {
    if (!tx.appStoreReceipt) {
      return errorPayload(ERROR_CODES.BAD_RESPONSE, 'Missing appStoreReceipt');
    }
    return validateApple({ appStoreReceipt: tx.appStoreReceipt, bundleId: body.id, now });
  }

  if (tx.type === 'android-playstore') {
    if (!tx.purchaseToken) {
      return errorPayload(ERROR_CODES.BAD_RESPONSE, 'Missing purchaseToken');
    }
    return validateGoogle({ productId: body.id, purchaseToken: tx.purchaseToken, now });
  }

  return errorPayload(ERROR_CODES.BAD_RESPONSE, `Unsupported transaction type: ${tx.type}`);
}
