import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map();
beforeEach(() => {
  store.clear();
  vi.resetModules();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const load = async () => import('./whatsNew');

describe('shouldShowVoiceNews', () => {
  it('stays quiet on a fresh install', async () => {
    // Nothing stored means nobody has ever run an older build here. Announcing
    // "the voice changed" to someone who never heard the old one is noise.
    const { shouldShowVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(false);
  });

  it('records the current version on that first run', async () => {
    const { shouldShowVoiceNews } = await load();
    shouldShowVoiceNews();
    expect(store.get('lawcode-last-seen-version')).toBeTruthy();
  });

  it('shows for someone coming from an older build', async () => {
    store.set('lawcode-last-seen-version', '1');
    const { shouldShowVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(true);
  });

  it('does not show twice', async () => {
    store.set('lawcode-last-seen-version', '1');
    const { shouldShowVoiceNews, dismissVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(true);
    dismissVoiceNews();
    vi.resetModules();
    const again = await load();
    expect(again.shouldShowVoiceNews()).toBe(false);
  });

  it('does not show again after the next update either', async () => {
    // Dismissing is about this announcement, not about this version. Bumping
    // the build again must not resurrect it.
    store.set('lawcode-last-seen-version', '1');
    const { shouldShowVoiceNews, dismissVoiceNews } = await load();
    shouldShowVoiceNews();
    dismissVoiceNews();
    store.set('lawcode-last-seen-version', '2');
    vi.resetModules();
    const again = await load();
    expect(again.shouldShowVoiceNews()).toBe(false);
  });

  it('survives localStorage being unavailable', async () => {
    delete global.localStorage;
    const { shouldShowVoiceNews, dismissVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(false);
    expect(() => dismissVoiceNews()).not.toThrow();
  });

  it('shows a returning user recognised only by leftover usage data', async () => {
    // No lawcode-last-seen-version on disk — this key is new in the very
    // build that introduced it, so a genuine returning user will never have
    // it either. What they DO have is data an older build wrote when they
    // actually used the app. That, not the version key, is what must decide.
    store.set('lawcode-eng-history', '["some-section"]');
    const { shouldShowVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(true);
  });

  it('stays quiet and records the version for a truly fresh install', async () => {
    // None of the three legacy usage keys, and no stored version: nobody has
    // ever run any build on this device.
    const { shouldShowVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(false);
    expect(store.get('lawcode-last-seen-version')).toBeTruthy();
  });

  it('keeps the same answer for the life of the module, even after a later write to the version key', async () => {
    // The decision is taken once at module load and cached. A HomeScreen
    // remount calls shouldShowVoiceNews() again without reloading the
    // module, so it must not recompute from whatever is on disk right now.
    store.set('lawcode-last-seen-version', '1');
    const { shouldShowVoiceNews } = await load();
    const first = shouldShowVoiceNews();
    expect(first).toBe(true);

    // Simulate the version key having moved on (e.g. another part of the
    // app, or a stray write) — the cached decision must not budge.
    store.set('lawcode-last-seen-version', '999');
    expect(shouldShowVoiceNews()).toBe(first);
    expect(shouldShowVoiceNews()).toBe(first);
  });

  it('a dismissal recorded before a version bump still holds after it', async () => {
    store.set('lawcode-eng-history', '["some-section"]');
    const { shouldShowVoiceNews, dismissVoiceNews } = await load();
    expect(shouldShowVoiceNews()).toBe(true);
    dismissVoiceNews();

    // A later build ships and bumps the recorded version further.
    store.set('lawcode-last-seen-version', '999');
    vi.resetModules();
    const again = await load();
    expect(again.shouldShowVoiceNews()).toBe(false);
  });
});
