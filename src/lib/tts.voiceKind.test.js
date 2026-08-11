import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cache = { ensure: vi.fn(), removeCached: vi.fn(async () => {}) };
const player = {
  playFile: vi.fn(), stopAudio: vi.fn(), pauseAudio: vi.fn(),
  resumeAudio: vi.fn(), isAudioActive: vi.fn(() => false), preloadFile: vi.fn(),
  // tts.js registers lock-screen transport handlers at import time.
  setRemoteHandlers: vi.fn(),
};
vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
// The badge exists only when there is more than one voice to name, so the
// engine reports nothing at all while AUDIO_BASE_URL is empty. These tests are
// about what it says once it is set — so they say so.
vi.mock('./audioManifest', () => ({
  isAudioEnabled: () => true,
  audioHashFor: () => null,
  audioUrl: () => null,
  DEFAULT_VOICE: 'm',
}));
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));

const { speakUnit, currentVoiceKind, stop, setHooks } = await import('./tts');

beforeEach(() => {
  cache.ensure.mockReset();
  player.playFile.mockReset();
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { stop(); delete global.window; });

describe('currentVoiceKind', () => {
  it('is null before anything has played', () => {
    expect(currentVoiceKind()).toBe(null);
  });

  it('reports audio after a file played', async () => {
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockResolvedValue(undefined);
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(currentVoiceKind()).toBe('audio');
  });

  it('reports device when there was no file', async () => {
    cache.ensure.mockResolvedValue(null);
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(currentVoiceKind()).toBe('device');
  });

  it('reports device when playback failed and the voice took over', async () => {
    // The badge has to follow what the listener actually heard, not what was
    // attempted — this is the case where the two differ.
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockRejectedValue(new Error('decode failed'));
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(currentVoiceKind()).toBe('device');
  });

  it('follows the change when a playlist crosses from audio to device', async () => {
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockResolvedValue(undefined);
    await speakUnit({ text: 'หนึ่ง', audioHash: 'abc' });
    expect(currentVoiceKind()).toBe('audio');

    cache.ensure.mockResolvedValue(null);
    await speakUnit({ text: 'สอง', audioHash: 'def' });
    expect(currentVoiceKind()).toBe('device');
  });

  it('resets to null on stop, so a stale badge never outlives playback', async () => {
    // Establishes the non-null state itself rather than inheriting it from
    // whichever test ran last — otherwise reordering the file turns this into
    // an assertion that null is still null.
    cache.ensure.mockResolvedValue('file:///a.mp3');
    player.playFile.mockResolvedValue(undefined);
    await speakUnit({ text: 'ทดสอบ', audioHash: 'abc' });
    expect(currentVoiceKind()).toBe('audio');

    stop();
    expect(currentVoiceKind()).toBe(null);
  });
});

describe('currentVoiceKind — the UI has to be told', () => {
  // The badge reads through a React context that re-renders on the engine's
  // onState hook. Setting _voiceKind without calling notify() leaves the
  // value correct and the badge frozen on whatever it said last — which is
  // worse than no badge, because it would confidently name the wrong voice.
  it('notifies on the audio path and on the device path', async () => {
    const onState = vi.fn();
    setHooks({ onState });
    try {
      cache.ensure.mockResolvedValue('file:///a.mp3');
      player.playFile.mockResolvedValue(undefined);
      await speakUnit({ text: 'หนึ่ง', audioHash: 'abc' });
      expect(onState).toHaveBeenCalled();

      onState.mockClear();
      cache.ensure.mockResolvedValue(null);
      await speakUnit({ text: 'สอง', audioHash: 'def' });
      expect(onState).toHaveBeenCalled();
    } finally {
      setHooks({ onState: null });
    }
  });

  it('says nothing when the answer has not moved', async () => {
    // onState drives TtsContext's forceRender, which re-renders the whole
    // provider. Firing it once per unit — and a paragraph without audio is
    // several 180-character units — re-renders the tree repeatedly to report
    // a value that is the same every time.
    const onState = vi.fn();
    setHooks({ onState });
    try {
      cache.ensure.mockResolvedValue(null);
      await speakUnit({ text: 'หนึ่ง', audioHash: 'abc' });
      expect(currentVoiceKind()).toBe('device');
      expect(onState).toHaveBeenCalledTimes(1);

      onState.mockClear();
      await speakUnit({ text: 'สอง', audioHash: 'def' });
      await speakUnit({ text: 'สาม', audioHash: 'ghi' });
      expect(currentVoiceKind()).toBe('device');
      expect(onState).not.toHaveBeenCalled();
    } finally {
      setHooks({ onState: null });
    }
  });
});
