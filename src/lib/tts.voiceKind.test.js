import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cache = { ensure: vi.fn() };
const player = {
  playFile: vi.fn(), stopAudio: vi.fn(), pauseAudio: vi.fn(),
  resumeAudio: vi.fn(), isAudioActive: vi.fn(() => false), preloadFile: vi.fn(),
};
vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));

const { speakUnit, currentVoiceKind, stop } = await import('./tts');

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

  it('resets to null on stop, so a stale badge never outlives playback', () => {
    stop();
    expect(currentVoiceKind()).toBe(null);
  });
});
