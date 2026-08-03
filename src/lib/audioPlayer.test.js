import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let completeHandler = null;
const na = {
  configure: vi.fn(async () => {}),
  preload: vi.fn(async () => {}),
  play: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  resume: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  unload: vi.fn(async () => {}),
  setRate: vi.fn(async () => {}),
  addListener: vi.fn(async (event, cb) => {
    if (event === 'complete') completeHandler = cb;
    return { remove: vi.fn() };
  }),
};
vi.mock('@capgo/native-audio', () => ({ NativeAudio: na }));

// Each test gets a fresh module instance (and so a fresh one-time `_configured`
// gate) via vi.resetModules() + a dynamic re-import, rather than relying on
// mock implementations surviving mockReset(). The mocked plugin object itself
// (`na`) stays shared across reloads via vi.mock's module cache.
let playFile, preloadFile, pauseAudio, resumeAudio, stopAudio, isAudioActive;

beforeEach(async () => {
  vi.resetModules();
  for (const fn of Object.values(na)) if (fn.mockReset) fn.mockReset();
  na.configure.mockImplementation(async () => {});
  na.preload.mockImplementation(async () => {});
  na.play.mockImplementation(async () => {});
  na.pause.mockImplementation(async () => {});
  na.resume.mockImplementation(async () => {});
  na.stop.mockImplementation(async () => {});
  na.unload.mockImplementation(async () => {});
  na.setRate.mockImplementation(async () => {});
  na.addListener.mockImplementation(async (event, cb) => {
    if (event === 'complete') completeHandler = cb;
    return { remove: vi.fn() };
  });
  global.window = { Capacitor: { isNativePlatform: () => true } };

  ({ playFile, preloadFile, pauseAudio, resumeAudio, stopAudio, isAudioActive } =
    await import('./audioPlayer'));
});
afterEach(() => { stopAudio(); delete global.window; completeHandler = null; });

describe('playFile', () => {
  it('resolves when the plugin reports the clip finished', async () => {
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await expect(p).resolves.toBeUndefined();
  });

  it('configures the session once, before the first play, not on every call', async () => {
    // Without this the audio stops the moment the screen locks — the whole
    // reason this plugin was chosen over an HTML5 element. Re-applying the
    // AVAudioSession category or re-taking Android audio focus on every play
    // is unverified behaviour the device spike never exercised, so this must
    // happen exactly once, not per clip.
    const p1 = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalledTimes(1));
    expect(na.configure).toHaveBeenCalledTimes(1);
    expect(na.configure).toHaveBeenCalledWith({ background: true, showNotification: true, focus: true });
    const configureOrder = na.configure.mock.invocationCallOrder[0];
    const firstPlayOrder = na.play.mock.invocationCallOrder[0];
    expect(configureOrder).toBeLessThan(firstPlayOrder);

    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p1;

    const p2 = playFile('file:///b.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalledTimes(2));
    expect(na.configure).toHaveBeenCalledTimes(1);

    completeHandler({ assetId: na.play.mock.calls[1][0].assetId });
    await p2;
  });

  it('ignores a completion belonging to some other clip', async () => {
    // Preloading the next paragraph means two assets are loaded at once. A
    // stale completion resolving the wrong promise would skip a paragraph.
    let settled = false;
    const p = playFile('file:///a.mp3', { rate: 1 }).then(() => { settled = true; });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: 'some-other-asset' });
    await Promise.resolve();
    expect(settled).toBe(false);
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p;
    expect(settled).toBe(true);
  });

  it('rejects with canceled when stopped mid-clip', async () => {
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    stopAudio();
    await expect(p).rejects.toThrow('canceled');
  });

  it('rejects with canceled if stopped during the load window, before play begins', async () => {
    // _current must be registered before the preload await, not after: a stop
    // that lands while the asset is still loading has to find the pending
    // clip so it can reject it. Otherwise the clip plays through anyway and
    // RESOLVES, turning a stop press into "advance to the next paragraph".
    let releasePreload;
    na.preload.mockImplementation(() => new Promise((resolve) => { releasePreload = resolve; }));

    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.preload).toHaveBeenCalled());
    expect(na.play).not.toHaveBeenCalled();

    stopAudio();
    releasePreload();

    await expect(p).rejects.toThrow('canceled');
    await Promise.resolve();
    await Promise.resolve();
    expect(na.play).not.toHaveBeenCalled();
  });

  it('unloads the asset once the clip is done', async () => {
    // 6,764 paragraphs in a playlist would otherwise stay resident.
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    const assetId = na.play.mock.calls[0][0].assetId;
    completeHandler({ assetId });
    await p;
    expect(na.unload).toHaveBeenCalledWith({ assetId });
  });

  it('rejects on web rather than pretending to play', async () => {
    global.window = { Capacitor: { isNativePlatform: () => false } };
    await expect(playFile('file:///a.mp3', { rate: 1 })).rejects.toThrow();
  });
});

describe('pause and resume', () => {
  it('holds the promise open across a pause', async () => {
    // The play loop awaits this promise. Resolving on pause would advance to
    // the next paragraph; rejecting would stop the playlist.
    let settled = false;
    const p = playFile('file:///a.mp3', { rate: 1 }).then(() => { settled = true; });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    pauseAudio();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(na.pause).toHaveBeenCalled();
    resumeAudio();
    expect(na.resume).toHaveBeenCalled();
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p;
  });
});

describe('isAudioActive', () => {
  it('is false before anything plays and true while a clip is in flight', async () => {
    expect(isAudioActive()).toBe(false);
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    expect(isAudioActive()).toBe(true);
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p;
    expect(isAudioActive()).toBe(false);
  });
});

describe('preloadFile', () => {
  it('loads without playing', async () => {
    await preloadFile('file:///next.mp3');
    expect(na.preload).toHaveBeenCalled();
    expect(na.play).not.toHaveBeenCalled();
  });

  it('resolves only after the underlying preload settles', async () => {
    let releasePreload;
    na.preload.mockImplementation(() => new Promise((resolve) => { releasePreload = resolve; }));

    let resolved = false;
    const p = preloadFile('file:///next.mp3').then(() => { resolved = true; });

    await vi.waitFor(() => expect(na.preload).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    releasePreload();
    await p;
    expect(resolved).toBe(true);
  });

  it('does not disturb an in-flight clip: the clip still resolves and the listener is registered only once', async () => {
    // A later task in the plan calls preloadFile() for the next paragraph
    // while the current one is still playing. If configure()/addListener()
    // ran again here, the old listener would be torn down and there would be
    // a window with no JS handler at all — a 'complete' event for the
    // in-flight clip landing in that window would be dropped and its promise
    // would never settle, freezing the playlist on that paragraph.
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    const playingAssetId = na.play.mock.calls[0][0].assetId;

    await preloadFile('file:///b.mp3');

    expect(na.addListener).toHaveBeenCalledTimes(1);

    completeHandler({ assetId: playingAssetId });
    await expect(p).resolves.toBeUndefined();
  });
});
