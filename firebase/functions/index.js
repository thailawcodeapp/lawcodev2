// HTTPS endpoint for cordova-plugin-purchase's `store.validator`.
//
// This file is deliberately the only one that imports firebase-functions or
// googleapis, and the only one that touches secrets. All decisions live in
// lib/ so they can be tested with no credentials and no emulator.

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { google } from 'googleapis';

import { handleValidation } from './lib/handler.js';
import { validateApple } from './lib/apple.js';
import { validateGoogle } from './lib/google.js';
import { errorPayload, ERROR_CODES } from './lib/protocol.js';

const APPLE_SHARED_SECRET = defineSecret('APPLE_SHARED_SECRET');
const GOOGLE_PLAY_SA_JSON = defineSecret('GOOGLE_PLAY_SA_JSON');

const ANDROID_PACKAGE_NAME = 'com.lawcodev2.app';

let cachedPublisher = null;
function androidPublisher() {
  if (cachedPublisher) return cachedPublisher;
  const credentials = JSON.parse(GOOGLE_PLAY_SA_JSON.value());
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  cachedPublisher = google.androidpublisher({ version: 'v3', auth });
  return cachedPublisher;
}

export const validateReceipt = onRequest(
  {
    region: 'asia-southeast1',
    secrets: [APPLE_SHARED_SECRET, GOOGLE_PLAY_SA_JSON],
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json(errorPayload(ERROR_CODES.BAD_RESPONSE, 'POST only'));
      return;
    }

    let payload;
    try {
      payload = await handleValidation(req.body, {
        now: Date.now(),
        validateApple: (opts) =>
          validateApple({ ...opts, sharedSecret: APPLE_SHARED_SECRET.value(), fetchImpl: fetch }),
        validateGoogle: (opts) =>
          validateGoogle({
            ...opts,
            packageName: ANDROID_PACKAGE_NAME,
            subscriptionsV2: androidPublisher().purchases.subscriptionsv2,
          }),
      });
    } catch (err) {
      // A construction-time throw (e.g. GOOGLE_PLAY_SA_JSON is malformed
      // JSON) rejects before handleValidation can catch it. Still respond
      // 200 with an error payload so the client keeps its cached
      // entitlement state instead of seeing a transport failure.
      console.error('validateReceipt: unhandled error', err);
      res.status(200).json(errorPayload(ERROR_CODES.COMMUNICATION, 'Internal error'));
      return;
    }

    // Always HTTP 200: the plugin reads `payload.ok`, and a non-2xx status is
    // reported to the client as a transport failure with the body discarded,
    // which would hide "subscription expired" behind "network error".
    res.status(200).json(payload);
  },
);
