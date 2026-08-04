import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const seen = [];
const cache = { ensure: vi.fn(async (h) => { seen.push(h); return `file:///${h}.mp3`; }) };
const player = {
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
    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalledWith('h1'));

    expect(seen).toEqual(expect.arrayContaining(['h0', 'h1']));
    // The half that actually removes the gap: the resolved uri must reach
    // preloadFile, not just ensure().
    await vi.waitFor(() => expect(player.preloadFile).toHaveBeenCalledWith('file:///h1.mp3'));
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
    expect(cache.ensure).toHaveBeenCalledWith('h0');
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
      expect(player.playFile).toHaveBeenCalledWith('file:///h0.mp3', { rate: 1 }));
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
    expect(cache.ensure).toHaveBeenCalledWith('h0');
    expect(seen).not.toContain(null);
    expect(seen).not.toContain(undefined);
  });
});
