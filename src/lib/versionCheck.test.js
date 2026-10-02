import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// APP_VERSION_CODE is a build-time constant, so each test that needs a
// different one gets its own fresh import of the module.
async function checkForUpdateAt(version, platform) {
  vi.resetModules();
  vi.doMock('../config', async () => {
    const actual = await vi.importActual('../config');
    return { ...actual, APP_VERSION_CODE: version };
  });
  vi.stubGlobal('window', platform
    ? { Capacitor: { getPlatform: () => platform } }
    : {});
  const { checkForUpdate } = await import('./versionCheck');
  return checkForUpdate();
}

describe('checkForUpdate', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('../config'); });

  const respond = (body) => fetch.mockResolvedValue({ ok: true, json: async () => body });

  it('forces an update from the android bucket on an Android build', async () => {
    respond({
      android: { minVersion: 92, latestVersion: 92, message: 'android msg' },
      ios: { minVersion: 69, latestVersion: 87, message: 'ios msg' },
    });
    const result = await checkForUpdateAt(91, 'android');
    expect(result).toEqual({ type: 'force', message: 'android msg' });
  });

  it('leaves an iOS build alone when only the android minVersion moved', async () => {
    respond({
      android: { minVersion: 92, latestVersion: 92, message: 'android msg' },
      ios: { minVersion: 69, latestVersion: 87, message: 'ios msg' },
    });
    const result = await checkForUpdateAt(91, 'ios');
    expect(result).toBeNull();
  });

  it('recommends rather than forces when only latestVersion is ahead', async () => {
    respond({
      android: { minVersion: 80, latestVersion: 92, message: 'android msg' },
      ios: { minVersion: 69, latestVersion: 87, message: 'ios msg' },
    });
    const result = await checkForUpdateAt(91, 'android');
    expect(result).toEqual({ type: 'recommend', message: 'android msg' });
  });

  it('returns null once the installed build meets both thresholds', async () => {
    respond({
      android: { minVersion: 80, latestVersion: 92, message: 'android msg' },
      ios: { minVersion: 69, latestVersion: 87, message: 'ios msg' },
    });
    const result = await checkForUpdateAt(92, 'android');
    expect(result).toBeNull();
  });

  it('falls back to a flat legacy JSON with no per-platform buckets', async () => {
    respond({ minVersion: 69, latestVersion: 87, message: 'legacy msg' });
    const result = await checkForUpdateAt(60, 'android');
    expect(result).toEqual({ type: 'force', message: 'legacy msg' });
  });

  it('treats a non-native platform (web) as its own bucket, not android', async () => {
    respond({
      android: { minVersion: 92, latestVersion: 92, message: 'android msg' },
    });
    const result = await checkForUpdateAt(1, undefined);
    expect(result).toBeNull();
  });

  it('returns null on a network failure', async () => {
    fetch.mockRejectedValue(new Error('offline'));
    const result = await checkForUpdateAt(1, 'android');
    expect(result).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false });
    const result = await checkForUpdateAt(1, 'android');
    expect(result).toBeNull();
  });
});
