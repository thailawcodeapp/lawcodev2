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
export const APP_VERSION_CODE = 87;
// Keep in sync with `versionName` in android/app/build.gradle. Shown in the
// Settings colophon so a bug report identifies the exact build — the colophon
// used to hard-code "v1.0" and had drifted three releases behind.
export const APP_VERSION_NAME = '1.0.6';
export const VERSION_CHECK_URL =
  'https://gist.githubusercontent.com/thailawcodeapp/a63d9965b4e158348885763fc5d8a234/raw/version.json';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.lawcodev2.app';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/juris-voice/id6785985634';

// ── Legal links (required in the Pro purchase flow — App Store 3.1.2c) ──────
export const PRIVACY_POLICY_URL =
  'https://thailawcodeapp.github.io/juris-voice/privacy-policy.html';
export const TERMS_OF_USE_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// ── TTS audio (phase 3B) ─────────────────────────────────────────────────────
// Public base URL of the Cloudflare R2 bucket holding the pre-rendered audio,
// with no trailing slash — for example 'https://pub-xxxxx.r2.dev'. The object
// key underneath it is `audio/<hash>.mp3`, set by objectKey() in
// scripts/tts-render/upload.mjs; the two must agree or every fetch 404s.
//
// Empty means the feature is off and every audio path short-circuits to the
// device voice, which is exactly how the app behaved before phase 3B. Leave it
// empty until the bucket is public and the upload has been verified — a build
// that ships a wrong URL degrades silently, because the fallback works.
export const AUDIO_BASE_URL = 'https://pub-6e8b764e47df481590280f98e37b48b0.r2.dev';

// ── Receipt validation ───────────────────────────────────────────────────────
// HTTPS endpoint of the Firebase Function in firebase/functions. It asks Apple
// and Google for the real subscription expiry, which is the only way this app
// can both keep a paying subscriber's Pro across restarts and cut a lapsed one:
// on iOS the StoreKit 1 bridge never reports an expiry date, so without this
// the plugin treats every past transaction as owned forever and every cold
// start as owned by nobody.
//
// Empty disables validation entirely and the app behaves exactly like build 64
// — Pro persists and is never revoked. That is the rollback switch.
export const RECEIPT_VALIDATOR_URL =
  'https://asia-southeast1-juris-voice.cloudfunctions.net/validateReceipt';

// ── Native playback queue (Android) ─────────────────────────────────────────
// The whole remaining playlist is handed to native at play time so paragraph
// advance no longer needs JavaScript — which stops running about 80 seconds
// after the app is backgrounded. See
// docs/superpowers/specs/2026-08-12-native-playback-queue-design.md.
//
// False falls back to the JavaScript loop that web and iOS use. Native code
// can only be changed through a CI build, so this is the one-build way back
// if the queue misbehaves on a real device.
export const USE_NATIVE_QUEUE = true;
