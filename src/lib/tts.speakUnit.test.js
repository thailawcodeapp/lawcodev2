import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cache = { ensure: vi.fn(), removeCached: vi.fn(async () => {}) };
const player = {
  // tts.js registers lock-screen transport handlers at import time.
  setRemoteHandlers: vi.fn(), playFile: vi.fn(), stopAudio: vi.fn(), isAudioActive: vi.fn(() => false), pauseAudio: vi.fn(), resumeAudio: vi.fn(), preloadFile: vi.fn() };
const tts = { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) };

vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: tts }));

const { speakUnit, playItems, stop } = await import('./tts');

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  cache.ensure.mockReset();
  cache.removeCached.mockReset().mockResolvedValue(undefined);
  player.playFile.mockReset();
  player.stopAudio.mockReset();
  tts.speak.mockReset().mockResolvedValue(undefined);
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { delete global.window; });

describe('speakUnit', () => {
  it('plays the file when the cache can supply one', async () => {
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockResolvedValue(undefined);
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(player.playFile).toHaveBeenCalledWith('file:///a.mp3', expect.objectContaining({ rate: 1 }));
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('speaks with the device voice when there is no file', async () => {
    cache.ensure.mockResolvedValue(null);
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(player.playFile).not.toHaveBeenCalled();
    expect(tts.speak).toHaveBeenCalled();
  });

  it('speaks with the device voice when the unit has no hash at all', async () => {
    await speakUnit({ text: 'ทดสอบ', audioHash: null });
    expect(cache.ensure).not.toHaveBeenCalled();
    expect(tts.speak).toHaveBeenCalled();
  });

  it('falls back to the voice when playback itself fails', async () => {
    // A corrupt file that got past the size check still has to produce speech
    // rather than a silent gap in the middle of a playlist.
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockRejectedValue(new Error('decode failed'));
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(tts.speak).toHaveBeenCalled();
  });

  it('does NOT fall back when the user stopped it', async () => {
    // 'canceled' means the listener pressed stop. Falling back would start
    // the device voice reading the paragraph they just stopped.
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockRejectedValue(new Error('canceled'));
    await expect(speakUnit({ text: 'ทดสอบ', audioHash: 'abc' })).rejects.toThrow('canceled');
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('drops the cached file when it fails to decode, so the next attempt can re-download', async () => {
    // cachedUri() only checks that the size is non-zero, so a truncated or
    // undecodable MP3 is indistinguishable from a good one and would be handed
    // back on every replay: that paragraph would read in the device voice for
    // the life of the install, with nothing the user could do about it.
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockRejectedValue(new Error('decode failed'));
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(cache.removeCached).toHaveBeenCalledWith('abc', 'm');
    expect(tts.speak).toHaveBeenCalled();   // and still no silent gap
  });

  it('keeps the file when the user stopped it', async () => {
    // 'canceled' says nothing about the file. Deleting a perfectly good
    // paragraph every time someone presses stop would throw the cache away
    // one paragraph at a time.
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockRejectedValue(new Error('canceled'));
    await expect(speakUnit({ text: 'ทดสอบ', audioHash: 'abc' })).rejects.toThrow('canceled');
    expect(cache.removeCached).not.toHaveBeenCalled();
  });

  it('splits a long paragraph before handing it to the voice', async () => {
    // Audio units are whole paragraphs. On the fallback path the 180-character
    // rule still has to apply, or the engine gets text it handles badly.
    cache.ensure.mockResolvedValue(null);
    await speakUnit({ text: 'ก'.repeat(500), audioHash: 'abc' });
    expect(tts.speak.mock.calls.length).toBeGreaterThan(1);
    for (const [opts] of tts.speak.mock.calls) expect(opts.text.length).toBeLessThanOrEqual(180);
  });
});

describe('stop() reaches both engines', () => {
  // hardCancel() stops the device voice and the file player unconditionally,
  // rather than the one it believes is live. Nothing asserted the second half:
  // delete stopAudio() from hardCancel and every test still passed, while a
  // stop press in the app would leave the clip playing over a halted playlist —
  // audio continuing with no way to reach it but force-quitting.
  it('stops a playing clip, not just the speech engine', async () => {
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockReturnValue(new Promise(() => {}));  // in flight, never settles

    playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'ทดสอบ', paraIndex: 0, audioHash: 'abc' }],
    }]);
    await flushMicrotasks();
    expect(player.playFile).toHaveBeenCalled();   // the loop is genuinely inside the clip

    stop();
    expect(player.stopAudio).toHaveBeenCalled();
  });
});

describe('speakUnit — flatten() must carry audioHash through (Task 4 link)', () => {
  // flatten() is private; nothing but the public API can observe whether it
  // still copies audioHash onto each flat unit. If that copy silently stopped,
  // playback would fall all the way back to the device voice with no error
  // anywhere — this test is the tripwire for that failure.
  it('routes a playItems() unit to ensure() using the hash flatten() carried over', async () => {
    vi.resetModules();
    vi.doMock('./audioManifest', () => ({
      isAudioEnabled: () => true,
      audioHashFor: () => 'hash-from-manifest',
      audioUrl: (h) => `https://cdn/audio/${h}.mp3`,
  DEFAULT_VOICE: 'm',
    }));
    const fresh = await import('./tts');
    const item = fresh.buildSectionItem({
      sectionId: 'civil-1', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ทดสอบ'],
    });
    try {
      fresh.playItems([item]);
      expect(cache.ensure).toHaveBeenCalledWith('hash-from-manifest', 'm');
    } finally {
      // resetModules gave this test its own tts instance with its own running
      // loop. Left alone it keeps going, and anything appended after this file
      // inherits a second engine nobody can see.
      fresh.stop();
      vi.doUnmock('./audioManifest');
    }
  });
});
