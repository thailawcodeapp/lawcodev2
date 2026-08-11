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
    expect(na.configure).toHaveBeenCalledWith({ background: true, backgroundPlayback: true, showNotification: true, focus: true });
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

  it('holds a finished clip until its successor is playing, then unloads it', async () => {
    // The holding half: unloading at the boundary is what took the
    // lock-screen card down between every pair of paragraphs, and on iOS also
    // ran endSession() at the one moment no asset was playing — the gap the
    // whole preload design exists to keep at zero seconds.
    const first = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    const assetId = na.play.mock.calls[0][0].assetId;

    completeHandler({ assetId });
    await first;
    expect(na.unload).not.toHaveBeenCalledWith({ assetId });

    // The releasing half: 6,712 paragraphs would otherwise stay resident, so
    // the hold has to end the moment something else owns the session.
    const second = playFile('file:///b.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.unload).toHaveBeenCalledWith({ assetId }));

    completeHandler({ assetId: na.play.mock.calls[1][0].assetId });
    await second;
  });

  it('lets a held clip go when the playlist stops instead of leaving the card up', async () => {
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    const assetId = na.play.mock.calls[0][0].assetId;

    completeHandler({ assetId });
    await p;
    expect(na.unload).not.toHaveBeenCalledWith({ assetId });

    // Nothing is going to take this asset over — on iOS this unload is what
    // finally clears Now Playing and ends the audio session.
    stopAudio();
    expect(na.unload).toHaveBeenCalledWith({ assetId });
  });

  it('rejects on web rather than pretending to play', async () => {
    global.window = { Capacitor: { isNativePlatform: () => false } };
    await expect(playFile('file:///a.mp3', { rate: 1 })).rejects.toThrow();
  });

  it('recovers on the next call after a failed configure, instead of bricking audio for the rest of the session', async () => {
    na.configure.mockImplementationOnce(async () => { throw new Error('boom'); });

    await expect(playFile('file:///a.mp3', { rate: 1 })).rejects.toThrow('boom');

    // configure() now succeeds; a later call must retry rather than replaying
    // the same stale rejection forever.
    const p = playFile('file:///b.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await expect(p).resolves.toBeUndefined();
  });

  it('cancels a superseded playFile when a second one arrives during its preload window', async () => {
    let releaseA;
    na.preload.mockImplementationOnce(() => new Promise((resolve) => { releaseA = resolve; }));

    const pA = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.preload).toHaveBeenCalledTimes(1));

    const pB = playFile('file:///b.mp3', { rate: 1 });
    releaseA();

    await expect(pA).rejects.toThrow('canceled');

    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: na.play.mock.calls.at(-1)[0].assetId });
    await expect(pB).resolves.toBeUndefined();
  });

  it('registers the complete listener exactly once across two sequential plays', async () => {
    const p1 = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalledTimes(1));
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p1;

    // Between paragraphs is exactly where a playlist calls preloadFile for
    // the next one, and exactly the moment nothing is in flight — the one
    // place a "re-register only when idle" regression could actually fire.
    await preloadFile('file:///idle-gap.mp3');

    const p2 = playFile('file:///b.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalledTimes(2));
    completeHandler({ assetId: na.play.mock.calls[1][0].assetId });
    await p2;

    // Two events are registered now ('complete' plus the lock-screen
        // 'playbackState'), each exactly once. What this pins is that the
        // configure-once block did not run twice, not how many events it uses.
        expect(na.addListener.mock.calls.filter(([e]) => e === 'complete')).toHaveLength(1);
  });

  it('clears _current (isAudioActive) when the preload rejects', async () => {
    na.preload.mockImplementationOnce(async () => { throw new Error('load failed'); });

    await expect(playFile('file:///a.mp3', { rate: 1 })).rejects.toThrow('load failed');
    expect(isAudioActive()).toBe(false);
  });

  it('sets the playback rate on the asset actually played, before play, when a rate is given', async () => {
    const p = playFile('file:///a.mp3', { rate: 1.5 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    const assetId = na.play.mock.calls[0][0].assetId;

    expect(na.setRate).toHaveBeenCalledWith({ assetId, rate: 1.5 });
    const setRateOrder = na.setRate.mock.invocationCallOrder[0];
    const playOrder = na.play.mock.invocationCallOrder[0];
    expect(setRateOrder).toBeLessThan(playOrder);

    completeHandler({ assetId });
    await p;
  });

  it('does not call setRate for the default rate of 1', async () => {
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    expect(na.setRate).not.toHaveBeenCalled();
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await p;
  });

  it('unloads the asset it just loaded (or reused) when NativeAudio.play() rejects', async () => {
    na.play.mockImplementationOnce(async () => { throw new Error('play failed'); });

    const p = playFile('file:///a.mp3', { rate: 1 });
    await expect(p).rejects.toThrow('play failed');

    const assetId = na.preload.mock.calls[0][0].assetId;
    expect(na.unload).toHaveBeenCalledWith({ assetId });
    expect(isAudioActive()).toBe(false);
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

describe('stopAudio', () => {
  it('unloads a warm preload too, not just the playing clip', async () => {
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());

    await preloadFile('file:///next.mp3');
    const preloadedAssetId = na.preload.mock.calls.at(-1)[0].assetId;
    expect(preloadedAssetId).not.toBe(na.play.mock.calls[0][0].assetId);

    stopAudio();
    await expect(p).rejects.toThrow('canceled');

    expect(na.unload).toHaveBeenCalledWith({ assetId: preloadedAssetId });
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

    // Two events are registered now ('complete' plus the lock-screen
        // 'playbackState'), each exactly once. What this pins is that the
        // configure-once block did not run twice, not how many events it uses.
        expect(na.addListener.mock.calls.filter(([e]) => e === 'complete')).toHaveLength(1);

    completeHandler({ assetId: playingAssetId });
    await expect(p).resolves.toBeUndefined();
  });

  it('plays a preloaded URI without preloading it a second time', async () => {
    await preloadFile('file:///next.mp3');
    expect(na.preload).toHaveBeenCalledTimes(1);

    const p = playFile('file:///next.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());

    expect(na.preload).toHaveBeenCalledTimes(1); // still just the preload call, no second load
    completeHandler({ assetId: na.play.mock.calls[0][0].assetId });
    await expect(p).resolves.toBeUndefined();
  });

  it('unloads a held preload when a different URI is preloaded before it is ever played', async () => {
    await preloadFile('file:///next.mp3');
    const firstAssetId = na.preload.mock.calls[0][0].assetId;

    await preloadFile('file:///other.mp3');

    expect(na.unload).toHaveBeenCalledWith({ assetId: firstAssetId });
  });

  it('does nothing when asked to preload the URI that is currently in flight from adoption', async () => {
    // Preloading the next paragraph while the current one plays is exactly
    // what the caller does; if that "next" index is ever off by one and
    // points back at the URI already playing, reloading over its live
    // assetId would unload the very asset in flight and freeze the
    // playlist on this paragraph forever. preloadFile must be a no-op here.
    const p = playFile('file:///a.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    const playingAssetId = na.play.mock.calls[0][0].assetId;
    expect(na.preload).toHaveBeenCalledTimes(1);

    await preloadFile('file:///a.mp3');

    expect(na.preload).toHaveBeenCalledTimes(1); // no second preload for the in-flight id
    expect(na.unload).not.toHaveBeenCalled();

    completeHandler({ assetId: playingAssetId });
    await expect(p).resolves.toBeUndefined();
  });

  it('unloads the asset that actually played after a preloaded clip finishes', async () => {
    await preloadFile('file:///next.mp3');
    const assetId = na.preload.mock.calls[0][0].assetId;

    const p = playFile('file:///next.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    expect(na.play).toHaveBeenCalledWith(expect.objectContaining({ assetId }));

    completeHandler({ assetId });
    await p;

    // Adopted preloads are retired on the same terms as any other clip: held
    // until something replaces them, released when nothing will.
    stopAudio();
    expect(na.unload).toHaveBeenCalledWith({ assetId });
  });

  it('never reuses an asset id, so a repeated section cannot unload its own clip', async () => {
    // Ids used to be derived from the URI ("pre-<uri>"), which was unique
    // enough while nothing outlived its own playback. Holding a finished clip
    // past the start of its successor breaks that: repeat-section replays the
    // same file, mints the same id, and the release of the retired copy would
    // unload the live one.
    await preloadFile('file:///same.mp3');
    const firstId = na.preload.mock.calls[0][0].assetId;
    const p = playFile('file:///same.mp3', { rate: 1 });
    await vi.waitFor(() => expect(na.play).toHaveBeenCalled());
    completeHandler({ assetId: firstId });
    await p;

    await preloadFile('file:///same.mp3');
    const secondId = na.preload.mock.calls.at(-1)[0].assetId;
    expect(secondId).not.toBe(firstId);
  });
});

// The lock-screen transport. Its reasons come from
// patches/@capgo+native-audio+8.4.2.patch, which adds the skip-to-next and
// skip-to-previous commands the stock plugin never registers on either
// platform — so these names are ours to keep in step with the patch, and
// nothing else will catch them drifting apart.
describe('remote transport', () => {
  let onState = null;
  let setRemoteHandlers;

  beforeEach(async () => {
    na.addListener.mockImplementation(async (event, cb) => {
      if (event === 'complete') completeHandler = cb;
      if (event === 'playbackState') onState = cb;
      return { remove: vi.fn() };
    });
    ({ setRemoteHandlers } = await import('./audioPlayer'));
  });

  it('routes each remote reason to its handler', async () => {
    const calls = [];
    setRemoteHandlers({
      onPlay: () => calls.push('play'),
      onPause: () => calls.push('pause'),
      onStop: () => calls.push('stop'),
      onNext: () => calls.push('next'),
      onPrev: () => calls.push('prev'),
    });
    playFile('file:///a.mp3').catch(() => {});
    await vi.waitFor(() => expect(onState).toBeTypeOf('function'));

    for (const r of ['remotePlay', 'remotePause', 'remoteStop', 'remoteNextTrack', 'remotePreviousTrack']) {
      onState({ reason: r });
    }
    expect(calls).toEqual(['play', 'pause', 'stop', 'next', 'prev']);
  });

  it('ignores a reason nothing is registered for', async () => {
    setRemoteHandlers({ onNext: vi.fn() });
    playFile('file:///a.mp3').catch(() => {});
    await vi.waitFor(() => expect(onState).toBeTypeOf('function'));
    expect(() => onState({ reason: 'complete' })).not.toThrow();
  });
});
