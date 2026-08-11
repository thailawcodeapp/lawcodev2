import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const seen = [];
const cache = { ensure: vi.fn(async (h) => { seen.push(h); return `file:///${h}.mp3`; }), removeCached: vi.fn(async () => {}) };
const player = {
  // tts.js registers lock-screen transport handlers at import time.
  setRemoteHandlers: vi.fn(),
  playFile: vi.fn(async () => {}), stopAudio: vi.fn(), pauseAudio: vi.fn(),
  resumeAudio: vi.fn(), isAudioActive: vi.fn(() => false), preloadFile: vi.fn(async () => {}),
};
vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));

const ttsLib = await import('./tts');

beforeEach(() => {
  seen.length = 0;
  cache.ensure.mockClear();
  player.preloadFile.mockClear();
  global.window = { Capacitor: { isNativePlatform: () => true } };
  // The clip that is "currently playing" never finishes. If runLoop can only
  // move on once playFile resolves, anything that happens to a later unit
  // while stuck here can only have come from the deliberate prefetch call —
  // not from ordinary sequential playback catching up to it.
  player.playFile.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => { ttsLib.stop(); delete global.window; });

describe('prefetch', () => {
  it('fetches and warms the next paragraph while the current one is still playing', async () => {
    // Spec §7.9: a silent gap while a download runs kills the audio session
    // on a locked screen, and the budget for that gap is zero seconds.
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: 'h1' },
      ],
    }]);

    // playFile('h0's uri) never settles, so the loop is permanently stuck
    // inside unit 0. h1 can only appear here via the prefetch line.
    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalledWith('h1', 'm'));

    expect(seen).toEqual(expect.arrayContaining(['h0', 'h1']));
    // The half that actually removes the gap: the resolved uri must reach
    // preloadFile, not just ensure(). With the notification metadata for the
    // paragraph being warmed, because an asset keeps whatever it was loaded
    // with and playFile adopts a warm preload without loading it again — a
    // preload made without metadata plays with none, which is what left every
    // paragraph but the first of a section blank on the lock screen.
    await vi.waitFor(() => expect(player.preloadFile).toHaveBeenCalledWith(
      'file:///h1.mp3',
      expect.objectContaining({ title: 'มาตรา 1', artist: expect.stringContaining('ย่อหน้า 2/2') }),
    ));
  });

  it('does not prefetch past the end of the playlist', async () => {
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'เดียว', paraIndex: 0, audioHash: 'h0' }],
    }]);

    // Give an off-by-one (reading past the end of _flat) a real chance to
    // fire before asserting nothing did.
    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));

    expect(cache.ensure).toHaveBeenCalledTimes(1);
    expect(cache.ensure).toHaveBeenCalledWith('h0', 'm');
  });

  it('does not let a stuck prefetch of the next unit block playback of the current one', async () => {
    // Spec §7.9's whole reason to exist: the prefetch call in runLoop is
    // deliberately un-awaited. Give ensure() a hash-dependent behavior so a
    // regression that awaits it (blocking the loop on the next unit's
    // download before playing the current one) has a real chance to fail
    // this test instead of sailing through on a mock that always resolves.
    cache.ensure.mockImplementation((h) => {
      seen.push(h);
      if (h === 'h1') return new Promise(() => {}); // a download stuck forever
      return Promise.resolve(`file:///${h}.mp3`);
    });

    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: 'h1' },
      ],
    }]);

    // If the prefetch of h1 were awaited before playing unit 0, this would
    // never be reached — the loop would be parked on the never-settling
    // promise. It reaching playFile with unit 0's uri is the proof.
    await vi.waitFor(() =>
      expect(player.playFile).toHaveBeenCalledWith('file:///h0.mp3', expect.objectContaining({ rate: 1 })));
  });

  it('does not throw away the asset warmed for the next unit before that unit can adopt it', async () => {
    // The player holds at most one warm asset. Issuing the prefetch for p + 2
    // before unit p + 1 has claimed its own means preloadFile unloads the
    // asset that was warmed for p + 1, and playFile has to load it a second
    // time — the download half of the prefetch pays off, the player-warming
    // half delivers nothing. On an already-cached playlist (offline replay,
    // the case this whole feature exists to serve) that was the usual outcome,
    // because the prefetch's ensure() resolves instantly and beats the unit's
    // own.
    const log = [];
    // Every unit already on disk: ensure() resolves without a network turn,
    // which is precisely the timing that made the prefetch cannibalise itself.
    cache.ensure.mockImplementation(async (h) => { seen.push(h); return `file:///${h}.mp3`; });
    player.preloadFile.mockImplementation(async (uri) => { log.push(`preload:${uri}`); });
    player.playFile.mockImplementation(async (uri) => { log.push(`play:${uri}`); });

    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: 'h1' },
        { text: 'สาม', paraIndex: 2, audioHash: 'h2' },
      ],
    }]);

    await vi.waitFor(() => expect(log).toContain('play:file:///h1.mp3'));

    // The last thing warmed before unit 1 started must be unit 1's own asset.
    const playIdx = log.indexOf('play:file:///h1.mp3');
    const lastPreload = log
      .slice(0, playIdx)
      .filter((e) => e.startsWith('preload:'))
      .pop();
    expect(lastPreload).toBe('preload:file:///h1.mp3');
  });

  it('fetches several paragraphs ahead, but only warms the very next one', async () => {
    // One paragraph of buffer was not enough backgrounded: Android defers the
    // network of an app with no foreground service, one download failed, and
    // speakUnit's "no file, speak it instead" fallback changed the voice under
    // a listener who never lost signal. Depth covers the window.
    //
    // The warming stays at one, because the player holds one asset — warming
    // p + 2 would take back the asset p + 1 is about to play.
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: 'h1' },
        { text: 'สาม', paraIndex: 2, audioHash: 'h2' },
        { text: 'สี่', paraIndex: 3, audioHash: 'h3' },
        { text: 'ห้า', paraIndex: 4, audioHash: 'h4' },
      ],
    }]);

    // Stuck on unit 0, so everything here came from the prefetch.
    await vi.waitFor(() => expect(seen).toEqual(expect.arrayContaining(['h0', 'h1', 'h2', 'h3'])));
    await new Promise((r) => setTimeout(r, 20));

    // Depth 3 means three paragraphs of buffer — h1, h2, h3 — and it stops
    // there rather than reading the whole queue onto the listener's disk.
    expect(seen).not.toContain('h4');

    const warmed = player.preloadFile.mock.calls.map((c) => c[0]);
    expect(warmed).toContain('file:///h1.mp3');
    expect(warmed).not.toContain('file:///h2.mp3');
  });

  it('skips a unit with no hash rather than prefetching null', async () => {
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: null },
      ],
    }]);

    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));

    expect(cache.ensure).toHaveBeenCalledTimes(1);
    expect(cache.ensure).toHaveBeenCalledWith('h0', 'm');
    expect(seen).not.toContain(null);
    expect(seen).not.toContain(undefined);
  });
});
