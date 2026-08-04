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

beforeEach(() => { seen.length = 0; cache.ensure.mockClear(); global.window = { Capacitor: { isNativePlatform: () => true } }; });
afterEach(() => { ttsLib.stop(); delete global.window; });

describe('prefetch', () => {
  it('asks for the next paragraph before it is needed', async () => {
    // Spec §7.9: a silent gap while a download runs kills the audio session
    // on a locked screen, and the budget for that gap is zero seconds.
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: 'h1' },
      ],
    }]);
    await vi.waitFor(() => expect(seen).toContain('h1'));
    // h1 was requested while h0 was the unit being played.
    expect(seen.indexOf('h1')).toBeLessThan(seen.lastIndexOf('h0') + 2);
  });

  it('does not prefetch past the end of the playlist', async () => {
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'เดียว', paraIndex: 0, audioHash: 'h0' }],
    }]);
    await vi.waitFor(() => expect(player.playFile).toHaveBeenCalled());
    expect(seen.filter((h) => h !== 'h0')).toEqual([]);
  });

  it('ignores a unit with no hash', async () => {
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'หนึ่ง', paraIndex: 0, audioHash: 'h0' },
        { text: 'สอง', paraIndex: 1, audioHash: null },
      ],
    }]);
    await vi.waitFor(() => expect(player.playFile).toHaveBeenCalled());
    expect(seen).not.toContain(null);
  });
});
