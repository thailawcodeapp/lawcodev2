// Feature flags + cloud-sync constants.
//
// Cloud sync is gated behind ENABLE_AUTH_GATE. When false, ALL sync code
// short-circuits to no-ops — the app behaves exactly like main branch.
// Flip to true only when:
//   1. Firebase project is created and google-services.json is in place
//   2. Internal testing track is ready
//   3. Privacy policy mentions Google account sign-in

export const ENABLE_AUTH_GATE = true;

// Push at most once every 24 hours per device.
export const SYNC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Firestore region (closest to Bangkok that supports Firestore — Singapore).
export const FIREBASE_REGION = 'asia-southeast1';

// Device cap for shared-account protection.
export const DEVICE_LIMIT = 3;

// A device is considered inactive after this many days without sign-in.
export const DEVICE_INACTIVE_DAYS = 30;

// Sync product brand name (Settings UI + Firebase project alias).
export const SYNC_PRODUCT_NAME = 'Juris Voice';

// ── Version check (JS-only, no native dep) ──────────────────────────────────
export const APP_VERSION_CODE = 27;
export const VERSION_CHECK_URL =
  'https://gist.githubusercontent.com/thailawcodeapp/a63d9965b4e158348885763fc5d8a234/raw/version.json';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.lawcodev2.app';
// Set this once the app is live on the App Store
export const APP_STORE_URL = '';
