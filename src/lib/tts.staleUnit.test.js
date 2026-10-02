import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_VOICE } from './audioManifest';

// `await ensure(hash)` is the long pause in speakUnit — seconds, on a cold
// download over a phone network. Every control the user has lands inside that
// window, and the loop's generation counter is loop-private, so without a way
// for speakUnit to re-check whether its unit is still the current one, the
// download resolves and the clip starts regardless of what was pressed.
const deferreds = new Map();
function deferred(hash) {
  if (!deferreds.has(hash)) {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    deferreds.set(hash, { promise, resolve });
  }
  return deferreds.get(hash);
}

const cache = {
  ensure: vi.fn((hash) => deferred(hash).promise),
  removeCached: vi.fn(async () => {}),
};
const player = {
  // tts.js registers lock-screen transport handlers at import time.
  setRemoteHandlers: vi.fn(),
  playFile: vi.fn(() => new Promise(() => {})),
  stopAudio: vi.fn(), pauseAudio: vi.fn(), resumeAudio: vi.fn(),
  isAudioActive: vi.fn(() => false), preloadFile: vi.fn(async () => {}),
};
const TextToSpeech = {
  speak: vi.fn(async () => {}), stop: vi.fn(async () => {}),
  getSupportedVoices: vi.fn(async () => ({ voices: [] })),
};
vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech }));

const ttsLib = await import('./tts');

// Enough turns for a resolved ensure() to travel all the way to playFile, if
// anything still lets it.
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const oneChunk = (n, hash) => ({
  sectionId: `s${n}`, bookId: 'b', number: String(n), title: '',
  chunks: [{ text: 'ทดสอบ', paraIndex: 0, audioHash: hash }],
});

beforeEach(() => {
  deferreds.clear();
  cache.ensure.mockClear();
  cache.removeCached.mockClear();
  player.playFile.mockClear();
  player.preloadFile.mockClear();
  TextToSpeech.speak.mockClear();
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { ttsLib.stop(); delete global.window; });

describe('a control pressed while the download is still running', () => {
  it('stop: the paragraph must not start playing after the user stopped it', async () => {
    // doStop() → hardCancel() → stopAudio() finds no clip registered yet and
    // does nothing at all. If speakUnit does not re-check, ensure() resolves
    // a moment later and the paragraph plays with the UI showing stopped and
    // no control on screen that can reach it.
    ttsLib.playItems([oneChunk(1, 'h0')]);
    await settle();
    expect(cache.ensure).toHaveBeenCalledWith('h0', DEFAULT_VOICE);
    expect(player.playFile).not.toHaveBeenCalled();

    ttsLib.stop();
    deferred('h0').resolve('file:///h0.mp3');
    await settle();

    expect(player.playFile).not.toHaveBeenCalled();
    // A stale unit must not reach the device voice either — 'canceled' is the
    // one rejection that never falls back, and this is the same event.
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
    expect(ttsLib.isSpeaking()).toBe(false);
  });

  it('pause: the paragraph must not start playing while the UI says paused', async () => {
    // isAudioActive() is false (no clip registered yet), so pause() takes the
    // device-voice branch and bumps the generation. Without the re-check the
    // clip starts anyway and plays a whole paragraph — up to two minutes —
    // over a paused player.
    player.isAudioActive.mockReturnValue(false);
    ttsLib.playItems([oneChunk(1, 'h0')]);
    await settle();
    expect(player.playFile).not.toHaveBeenCalled();

    ttsLib.pause();
    expect(ttsLib.isPaused()).toBe(true);
    deferred('h0').resolve('file:///h0.mp3');
    await settle();

    expect(player.playFile).not.toHaveBeenCalled();
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
  });

  it('next: the abandoned section must not supersede the one now playing', async () => {
    // The old loop is parked inside ensure() for its own paragraph. next()
    // starts a new loop, which begins a different one. When the old ensure()
    // resolves it calls playFile() with the stale uri, which supersedes and
    // rejects the LIVE clip with 'canceled' — and the new loop reads that as
    // the user pressing stop and returns. Playback dies after one paragraph
    // of the wrong section while _playing is still true.
    ttsLib.playItems([oneChunk(1, 'h0'), oneChunk(2, 'h1')]);
    await settle();
    expect(cache.ensure).toHaveBeenCalledWith('h0', DEFAULT_VOICE);

    ttsLib.next();
    deferred('h1').resolve('file:///h1.mp3');
    await settle();
    expect(player.playFile).toHaveBeenCalledWith('file:///h1.mp3', expect.objectContaining({ rate: 1 }));

    // Now the abandoned download lands.
    deferred('h0').resolve('file:///h0.mp3');
    await settle();

    const uris = player.playFile.mock.calls.map(([uri]) => uri);
    expect(uris).not.toContain('file:///h0.mp3');
    expect(player.playFile).toHaveBeenCalledTimes(1);
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
  });

  it('still plays a unit nobody interrupted, and still works with no predicate at all', async () => {
    // The re-check must not turn every slow download into a dropped
    // paragraph, and speakUnit's direct callers pass no predicate.
    ttsLib.playItems([oneChunk(1, 'h0')]);
    await settle();
    deferred('h0').resolve('file:///h0.mp3');
    await settle();
    expect(player.playFile).toHaveBeenCalledWith('file:///h0.mp3', expect.objectContaining({ rate: 1 }));

    player.playFile.mockClear();
    deferred('direct').resolve('file:///direct.mp3');
    player.playFile.mockResolvedValueOnce(undefined);
    await ttsLib.speakUnit({ text: 'ทดสอบ', audioHash: 'direct' });
    expect(player.playFile).toHaveBeenCalledWith('file:///direct.mp3', expect.objectContaining({ rate: 1 }));
  });
});
