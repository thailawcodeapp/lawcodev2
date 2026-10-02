import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The feature-off state is forced here rather than inherited from whatever
// AUDIO_BASE_URL currently holds. Reading the real config made these two pass
// only while the flag happened to be empty — and the flag is a one-line change
// away from being set, at which point the guard they exist to protect would
// stop being tested at exactly the moment it starts to matter.
vi.mock('./audioManifest', () => ({
  isAudioEnabled: () => false,
  audioHashFor: () => null,
  audioUrl: () => null,
  DEFAULT_VOICE: 'm',
}));

const cache = { ensure: vi.fn(async () => null), removeCached: vi.fn(async () => {}) };
const player = {
  playFile: vi.fn(), stopAudio: vi.fn(), pauseAudio: vi.fn(),
  resumeAudio: vi.fn(), isAudioActive: vi.fn(() => false), preloadFile: vi.fn(),
  // tts.js registers lock-screen transport handlers at import time.
  setRemoteHandlers: vi.fn(),
};
vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));

const { speakUnit, currentVoiceKind, stop, setHooks } = await import('./tts');

beforeEach(() => {
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { stop(); setHooks({ onState: null }); delete global.window; });

describe('the voice badge while the audio feature is off', () => {
  it('names no voice, because there is only one and it is the one there has always been', async () => {
    // TtsPlayer shows "📱 เสียงเครื่อง" for any non-null kind. On a build where
    // nothing changed, that badge appears during all playback and tells the
    // user about a distinction the build does not have.
    await speakUnit({ text: 'ทดสอบ', audioHash: null });
    expect(currentVoiceKind()).toBe(null);
  });

  it('does not re-render the provider once per 180-character chunk', async () => {
    // onState is TtsContext's forceRender. Without the flag check it fires for
    // every unit, and with audio off a paragraph is many units — the whole
    // provider re-rendering several times a paragraph, all playback long, to
    // publish a value nothing can read.
    const onState = vi.fn();
    setHooks({ onState });
    await speakUnit({ text: 'ก'.repeat(600), audioHash: null });
    await speakUnit({ text: 'ข'.repeat(600), audioHash: null });
    expect(onState).not.toHaveBeenCalled();
  });
});
