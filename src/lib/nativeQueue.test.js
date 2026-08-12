import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./audioCache', () => ({ cachedUri: vi.fn() }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, USE_NATIVE_QUEUE: true };
});
vi.mock('@capgo/native-audio', () => ({
  NativeAudio: {
    setQueue: vi.fn(), skipToQueueIndex: vi.fn(), pauseQueue: vi.fn(),
    resumeQueue: vi.fn(), clearQueue: vi.fn(), setQueueRepeat: vi.fn(),
    setQueueRate: vi.fn(), getQueueState: vi.fn(), addListener: vi.fn(),
  },
}));

import { cachedUri } from './audioCache';
import {
  startQueue, skipToQueueIndex, pauseQueue, resumeQueue, clearQueue,
  setQueueRepeat, setQueueRate, queueState, setQueueHandlers,
  isNativeQueueAvailable, canQueue, buildEntries,
} from './nativeQueue';
import { NativeAudio } from '@capgo/native-audio';

const unit = (over = {}) => ({
  itemIndex: 0, chunkIndex: 0, paraIndex: 0,
  text: 'ข้อความ', audioHash: 'h0', audioVoice: 'm', ...over,
});

const metadataFor = (u) => ({
  title: `มาตรา ${u.itemIndex}`,
  artist: `ย่อหน้า ${u.paraIndex + 1}`,
  artworkUrl: 'https://cdn.example/now-playing.png',
});

beforeEach(() => {
  vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'android' } });
  cachedUri.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('isNativeQueueAvailable', () => {
  it('is true on Android', () => {
    expect(isNativeQueueAvailable()).toBe(true);
  });

  it('is false when the kill switch is off, so Android falls back to the JS loop', async () => {
    vi.resetModules();
    vi.doMock('../config', () => ({ USE_NATIVE_QUEUE: false }));
    const fresh = await import('./nativeQueue');
    expect(fresh.isNativeQueueAvailable()).toBe(false);
    vi.doUnmock('../config');
  });

  it('is false on iOS and web — both keep the JavaScript loop', () => {
    vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'ios' } });
    expect(isNativeQueueAvailable()).toBe(false);
    vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'web' } });
    expect(isNativeQueueAvailable()).toBe(false);
  });

  it('is false when Capacitor is absent entirely', () => {
    vi.stubGlobal('window', {});
    expect(isNativeQueueAvailable()).toBe(false);
  });
});

describe('canQueue', () => {
  // Native never speaks with the device voice — every section in the corpus
  // has a rendered file, so a unit without one means audio is switched off
  // (empty AUDIO_BASE_URL) or the playlist was built before it was. Either
  // way the whole playlist has to go back to the JavaScript loop, because a
  // native queue cannot represent a paragraph it has no file for.
  it('accepts a playlist where every unit has a file', () => {
    expect(canQueue([unit(), unit({ audioHash: 'h1' })])).toBe(true);
  });

  it('rejects a playlist with any unit lacking a file', () => {
    expect(canQueue([unit(), unit({ audioHash: null })])).toBe(false);
  });

  it('rejects an empty playlist', () => {
    expect(canQueue([])).toBe(false);
  });
});

describe('buildEntries', () => {
  it('carries the position fields native needs for repeat and skip', async () => {
    const flat = [unit({ itemIndex: 3, paraIndex: 1, audioHash: 'abc' })];
    const [entry] = await buildEntries(flat, 0, metadataFor);
    expect(entry.itemIndex).toBe(3);
    expect(entry.paraIndex).toBe(1);
  });

  it('carries the lock-screen metadata from the same source the JS loop uses', async () => {
    const [entry] = await buildEntries([unit({ itemIndex: 7 })], 0, metadataFor);
    expect(entry.title).toBe('มาตรา 7');
    expect(entry.artist).toBe('ย่อหน้า 1');
    expect(entry.artworkUrl).toBe('https://cdn.example/now-playing.png');
  });

  it('uses the cached file for entries at the start, so playback begins instantly', async () => {
    cachedUri.mockResolvedValue('file:///cache/audio/m/abc.mp3');
    const [entry] = await buildEntries([unit({ audioHash: 'abc' })], 0, metadataFor);
    expect(entry.url).toBe('file:///cache/audio/m/abc.mp3');
  });

  it('falls back to the remote URL when the file is not cached', async () => {
    const [entry] = await buildEntries([unit({ audioHash: 'abc' })], 0, metadataFor);
    expect(entry.url).toMatch(/abc\.mp3$/);
    expect(entry.url).toMatch(/^https:/);
  });

  it('only checks the cache near the start — a 6,764-entry playlist must not stat every file', async () => {
    const flat = Array.from({ length: 50 }, (_, i) =>
      unit({ itemIndex: i, audioHash: `h${i}` }));
    await buildEntries(flat, 0, metadataFor);
    expect(cachedUri.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('checks the cache around startIndex, not around zero', async () => {
    const flat = Array.from({ length: 50 }, (_, i) =>
      unit({ itemIndex: i, audioHash: `h${i}` }));
    await buildEntries(flat, 20, metadataFor);
    expect(cachedUri).toHaveBeenCalledWith('h20', 'm');
    expect(cachedUri).not.toHaveBeenCalledWith('h0', 'm');
  });

  it('passes each unit\'s own voice, so a rebuilt section cannot fetch the other voice', async () => {
    await buildEntries([unit({ audioHash: 'abc', audioVoice: 'f' })], 0, metadataFor);
    expect(cachedUri).toHaveBeenCalledWith('abc', 'f');
  });
});

describe('queue commands', () => {
  beforeEach(() => {
    NativeAudio.setQueue.mockResolvedValue(undefined);
    NativeAudio.getQueueState.mockResolvedValue({
      index: 4, itemIndex: 2, paraIndex: 1, playing: true, stalled: false, error: null,
    });
  });

  it('starts the queue with the entries, the start index, repeat and rate', async () => {
    const flat = [unit({ audioHash: 'a' }), unit({ audioHash: 'b', itemIndex: 1 })];
    const ok = await startQueue(flat, 1, { repeat: 'all', rate: 1.5 }, metadataFor);

    expect(ok).toBe(true);
    const arg = NativeAudio.setQueue.mock.calls[0][0];
    expect(arg.entries).toHaveLength(2);
    expect(arg.startIndex).toBe(1);
    expect(arg.repeat).toBe('all');
    expect(arg.rate).toBe(1.5);
  });

  it('refuses a playlist native cannot represent, so the caller can use the JS loop', async () => {
    const ok = await startQueue([unit({ audioHash: null })], 0, {}, metadataFor);
    expect(ok).toBe(false);
    expect(NativeAudio.setQueue).not.toHaveBeenCalled();
  });

  it('sends the remaining control commands straight through', async () => {
    await skipToQueueIndex(9);
    expect(NativeAudio.skipToQueueIndex).toHaveBeenCalledWith({ index: 9 });
    await pauseQueue();
    expect(NativeAudio.pauseQueue).toHaveBeenCalled();
    await resumeQueue();
    expect(NativeAudio.resumeQueue).toHaveBeenCalled();
    await clearQueue();
    expect(NativeAudio.clearQueue).toHaveBeenCalled();
    await setQueueRepeat('section');
    expect(NativeAudio.setQueueRepeat).toHaveBeenCalledWith({ repeat: 'section' });
    await setQueueRate(2);
    expect(NativeAudio.setQueueRate).toHaveBeenCalledWith({ rate: 2 });
  });

  it('never rejects — a failed native call must not break the caller', async () => {
    NativeAudio.pauseQueue.mockRejectedValue(new Error('no queue'));
    await expect(pauseQueue()).resolves.toBeUndefined();
  });

  it('reads the state native reports', async () => {
    await expect(queueState()).resolves.toMatchObject({ index: 4, itemIndex: 2, playing: true });
  });

  it('reports an empty queue rather than throwing when native has none', async () => {
    NativeAudio.getQueueState.mockRejectedValue(new Error('no queue'));
    await expect(queueState()).resolves.toMatchObject({ index: -1, playing: false });
  });
});

describe('queue events', () => {
  let startQueue_, setQueueHandlers_;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('./nativeQueue');
    startQueue_ = module.startQueue;
    setQueueHandlers_ = module.setQueueHandlers;
  });

  it('routes each native event to its handler', async () => {
    const onAdvance = vi.fn(), onEnded = vi.fn(), onStalled = vi.fn();
    setQueueHandlers_({ onAdvance, onEnded, onStalled });
    await startQueue_([unit({ audioHash: 'a' })], 0, {}, metadataFor);

    const fire = (name, payload) => {
      const call = NativeAudio.addListener.mock.calls.find(([n]) => n === name);
      expect(call, `no listener registered for ${name}`).toBeTruthy();
      call[1](payload);
    };

    fire('queueAdvance', { index: 3, itemIndex: 1, paraIndex: 2 });
    expect(onAdvance).toHaveBeenCalledWith({ index: 3, itemIndex: 1, paraIndex: 2 });
    fire('queueEnded', {});
    expect(onEnded).toHaveBeenCalled();
    fire('queueStalled', { index: 3, error: 'source' });
    expect(onStalled).toHaveBeenCalledWith({ index: 3, error: 'source' });
  });

  it('registers its listeners once however many times the queue is started', async () => {
    await startQueue_([unit({ audioHash: 'a' })], 0, {}, metadataFor);
    await startQueue_([unit({ audioHash: 'b' })], 0, {}, metadataFor);
    const advanceListeners = NativeAudio.addListener.mock.calls.filter(([n]) => n === 'queueAdvance');
    expect(advanceListeners).toHaveLength(1);
  });
});
