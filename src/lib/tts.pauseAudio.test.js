import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const player = {
  playFile: vi.fn(() => new Promise(() => {})),   // never settles: a clip in flight
  stopAudio: vi.fn(), pauseAudio: vi.fn(), resumeAudio: vi.fn(),
  isAudioActive: vi.fn(() => true), preloadFile: vi.fn(),
};
vi.mock('./audioPlayer', () => player);
vi.mock('./audioCache', () => ({ ensure: vi.fn(async () => 'file:///a.mp3') }));
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));

const ttsLib = await import('./tts');

beforeEach(() => {
  player.pauseAudio.mockReset();
  player.resumeAudio.mockReset();
  player.stopAudio.mockReset();
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { ttsLib.stop(); delete global.window; });

describe('pause during an audio unit', () => {
  it('pauses the clip instead of cancelling it', async () => {
    // A paragraph runs up to two minutes. Cancelling and restarting it on
    // resume — which is what the native TTS path does — would replay the
    // whole thing from the top.
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'ก'.repeat(1000), paraIndex: 0, audioHash: 'abc' }],
    }]);
    await vi.waitFor(() => expect(player.playFile).toHaveBeenCalled());
    // playItems() itself unconditionally clears prior state via hardCancel(),
    // which calls stopAudio() once — that's setup, not what pause() does.
    // Clear it so the assertion below isolates pause()'s own behavior.
    player.stopAudio.mockClear();

    ttsLib.pause();
    expect(player.pauseAudio).toHaveBeenCalled();
    expect(player.stopAudio).not.toHaveBeenCalled();

    ttsLib.resume();
    expect(player.resumeAudio).toHaveBeenCalled();
    // Still the first play: resume did not start the paragraph over.
    expect(player.playFile).toHaveBeenCalledTimes(1);
  });

  it('reports paused state while a clip is held', async () => {
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'ก', paraIndex: 0, audioHash: 'abc' }],
    }]);
    await vi.waitFor(() => expect(player.playFile).toHaveBeenCalled());
    ttsLib.pause();
    expect(ttsLib.isPaused()).toBe(true);
    ttsLib.resume();
    expect(ttsLib.isPaused()).toBe(false);
  });
});
