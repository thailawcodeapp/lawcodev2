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
});
