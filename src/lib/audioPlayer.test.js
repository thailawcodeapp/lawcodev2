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

const { playFile, preloadFile, pauseAudio, resumeAudio, stopAudio, isAudioActive } =
  await import('./audioPlayer');

beforeEach(() => {
  for (const fn of Object.values(na)) if (fn.mockReset) fn.mockReset();
  na.addListener.mockImplementation(async (event, cb) => {
    if (event === 'complete') completeHandler = cb;
    return { remove: vi.fn() };
  });
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { stopAudio(); delete global.window; completeHandler = null; });

describe('playFile', () => {
  it('resolves when the plugin reports the clip finished', async () => {
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await expect(p).resolves.toBeUndefined();
  });

  it('configures the session for background playback before playing', async () => {
    // Without this the audio stops the moment the screen locks — the whole
    // reason this plugin was chosen over an HTML5 element.
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    expect(na.configure).toHaveBeenCalledWith(
      expect.objectContaining({ background: true, showNotification: true }),
    );
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p;
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

  it('unloads the asset once the clip is done', async () => {
    // 6,764 paragraphs in a playlist would otherwise stay resident.
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p;
    expect(na.unload).toHaveBeenCalled();
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
});
