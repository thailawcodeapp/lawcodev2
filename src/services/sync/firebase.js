// Firebase initialization wrapper.
//
// On native Android, @capacitor-firebase/app reads google-services.json
// automatically — there's nothing to call. We keep this module so other
// sync services can `await isFirebaseReady()` without worrying about
// timing.
//
// On web the same plugins behave like no-ops; auth + firestore methods
// reject and we surface that via the orchestrator.

import { ENABLE_AUTH_GATE } from '../../config';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

let readyPromise = null;

export function isFirebaseReady() {
  if (!ENABLE_AUTH_GATE) return Promise.resolve(false);
  if (!isNative()) return Promise.resolve(false);
  if (readyPromise) return readyPromise;
  // @capacitor-firebase/app loads google-services.json synchronously at
  // process start, so by the time React mounts we're already initialized.
  // Wait a tick to be safe, then mark ready.
  readyPromise = new Promise(r => setTimeout(() => r(true), 50));
  return readyPromise;
}

export function syncEnabledOnPlatform() {
  return ENABLE_AUTH_GATE && isNative();
}
