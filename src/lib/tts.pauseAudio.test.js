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
const { TextToSpeech } = await import('@capacitor-community/text-to-speech');

beforeEach(() => {
  player.playFile.mockReset();
  player.playFile.mockImplementation(() => new Promise(() => {})); // never settles by default
  player.pauseAudio.mockReset();
  player.resumeAudio.mockReset();
  player.stopAudio.mockReset();
  player.isAudioActive.mockReset();
  player.isAudioActive.mockReturnValue(true);
  TextToSpeech.speak.mockReset();
  TextToSpeech.speak.mockImplementation(async () => {});
  TextToSpeech.stop.mockReset();
  TextToSpeech.stop.mockImplementation(async () => {});
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

    // Give a wrongly-restarted loop time to be wrong: if resume() had fallen
    // through to the gen-bump/loop-restart path, the second playFile call
    // could only happen after an `await ensure(...)` — a synchronous check
    // right after resume() would pass against that bug too.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    // Still the first play: resume did not start the paragraph over.
    expect(player.playFile).toHaveBeenCalledTimes(1);
  });

  it('notifies the UI on both pause and resume of a held clip', async () => {
    const onState = vi.fn();
    ttsLib.setHooks({ onState });
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'ก', paraIndex: 0, audioHash: 'abc' }],
    }]);
    await vi.waitFor(() => expect(player.playFile).toHaveBeenCalled());

    onState.mockClear();
    ttsLib.pause();
    expect(onState).toHaveBeenCalled();

    onState.mockClear();
    ttsLib.resume();
    expect(onState).toHaveBeenCalled();

    ttsLib.setHooks({ onState: null });
  });

  it('pause latches the audio decision so a later resume cannot re-sample isAudioActive()', async () => {
    // Reproduces the uncached-paragraph race: at the moment pause() runs, no
    // clip is registered yet (speakUnit is still inside `await ensure(...)`),
    // so isAudioActive() is false and pause() must take the device-voice
    // branch. By the time resume() runs, the clip has started and
    // isAudioActive() has flipped to true — resume() must still restart the
    // loop (the branch pause() actually took), not silently call
    // resumeAudio() on a clip nobody paused.
    player.isAudioActive.mockReturnValue(false);
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'ก', paraIndex: 0, audioHash: 'abc' },
        { text: 'ข', paraIndex: 1, audioHash: null },
      ],
    }]);
    // Let the loop enter speakUnit(); isAudioActive() is false the whole time
    // (no clip ever registers because playFile() is the never-settling mock).
    await new Promise((r) => setTimeout(r, 0));

    ttsLib.pause();
    expect(player.pauseAudio).not.toHaveBeenCalled();
    expect(ttsLib.isPaused()).toBe(true);

    // Now the clip becomes "active" from resume()'s point of view.
    player.isAudioActive.mockReturnValue(true);
    const callsBeforeResume = player.playFile.mock.calls.length;

    ttsLib.resume();
    // The latched decision was "device voice", so resume() must restart the
    // loop from _pausePos rather than call resumeAudio(). A restarted loop
    // re-enters speakUnit() for the same audio-bearing unit and calls
    // playFile() again; resumeAudio() being skipped alone would also pass if
    // resume() just returned early, so require positive evidence the loop
    // actually restarted.
    expect(player.resumeAudio).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(player.playFile.mock.calls.length).toBeGreaterThan(callsBeforeResume));
  });

  it('reports paused state while a clip is held, and leaves the clip alone rather than cancelling it', async () => {
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'ก', paraIndex: 0, audioHash: 'abc' }],
    }]);
    await vi.waitFor(() => expect(player.playFile).toHaveBeenCalled());
    player.stopAudio.mockClear();

    ttsLib.pause();
    expect(ttsLib.isPaused()).toBe(true);
    // The audio branch never cancels the clip — only the generation/loop
    // branch does. This is what distinguishes this test from an assertion
    // that would pass identically against the pre-fix code.
    expect(player.stopAudio).not.toHaveBeenCalled();

    ttsLib.resume();
    expect(ttsLib.isPaused()).toBe(false);
  });

  it('leaves the device-voice path unchanged when no clip is active', async () => {
    // Pins the "non-audio paths unchanged" constraint: with isAudioActive()
    // false throughout, pause()/resume() must still take the generation-bump
    // / loop-restart path exactly as before this fix.
    //
    // TextToSpeech.speak() never settles here, same as the never-settling
    // playFile() mock used above — otherwise the tiny single-character units
    // finish the whole playlist within a couple of microtask turns and
    // _playing goes false before pause() ever runs.
    TextToSpeech.speak.mockImplementation(() => new Promise(() => {}));
    player.isAudioActive.mockReturnValue(false);
    ttsLib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [
        { text: 'ก', paraIndex: 0, audioHash: null },
        { text: 'ข', paraIndex: 1, audioHash: null },
      ],
    }]);
    await vi.waitFor(() => expect(TextToSpeech.speak).toHaveBeenCalled());

    TextToSpeech.stop.mockClear();
    ttsLib.pause();
    expect(TextToSpeech.stop).toHaveBeenCalled();
    expect(player.pauseAudio).not.toHaveBeenCalled();

    const callsBeforeResume = TextToSpeech.speak.mock.calls.length;
    ttsLib.resume();
    expect(player.resumeAudio).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(TextToSpeech.speak.mock.calls.length).toBeGreaterThan(callsBeforeResume));

    TextToSpeech.speak.mockImplementation(async () => {});
  });
});
