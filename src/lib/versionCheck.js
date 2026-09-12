import { APP_VERSION_CODE, VERSION_CHECK_URL } from '../config';

// 'android' | 'ios' | 'web' — the bucket this build's threshold lives in.
// A fix that only touches one platform's native code (e.g. the Android
// playback queue) needs its own minVersion, or forcing it also forces every
// iPhone still on the last approved build, with no matching iOS release for
// it to update to.
function platform() {
  return typeof window !== 'undefined' ? (window.Capacitor?.getPlatform?.() ?? 'web') : 'web';
}

export async function checkForUpdate() {
  try {
    const res = await fetch(VERSION_CHECK_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    // Legacy flat shape ({minVersion, latestVersion, message}, no platform
    // keys) still works — old cached responses and a not-yet-updated gist
    // both fall back to it rather than forcing nothing on every platform.
    const bucket = data[platform()] ?? data;
    const { minVersion, latestVersion, message } = bucket;
    if (APP_VERSION_CODE < minVersion) {
      return { type: 'force', message };
    }
    if (APP_VERSION_CODE < latestVersion) {
      return { type: 'recommend', message };
    }
    return null;
  } catch {
    return null;
  }
}
