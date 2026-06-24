import { APP_VERSION_CODE, VERSION_CHECK_URL } from '../config';

export async function checkForUpdate() {
  try {
    const res = await fetch(VERSION_CHECK_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const { minVersion, latestVersion, message } = data;
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
