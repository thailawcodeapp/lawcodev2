import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Two voices whose paragraph text differs, which is the whole reason a hash
// and its text cannot be swapped independently.
vi.mock('./thaiSpeech', () => ({
  speechUnits: (number, paragraphs, voice) =>
    (paragraphs || []).map((p, i) => (i === 0 ? `มาตรา ${number} ${voice}:${p}` : `${voice}:${p}`)),
}));

vi.mock('./audioManifest', () => ({
  DEFAULT_VOICE: 'm',
  isAudioEnabled: () => true,
  audioHashFor: (sectionId, paraIndex, voice) => `${voice}-${sectionId}-${paraIndex}`,
}));

// USE_NATIVE_QUEUE: false — this file simulates window.Capacitor android only
// to exercise the JS loop's native TTS engine choice; the per-boundary voice
// rebuild it tests is JS-loop behavior, and routing through the native queue
// (which this file does not mock) would require @capgo/native-audio.
vi.mock('../config', () => ({ AUDIO_BASE_URL: 'https://cdn.example', USE_NATIVE_QUEUE: false }));

const cache = { ensure: vi.fn(async (h) => `file:///${h}.mp3`), removeCached: vi.fn() };
vi.mock('./audioCache', () => cache);

const player = {
  playFile: vi.fn(() => Promise.resolve()),
  stopAudio: vi.fn(), pauseAudio: vi.fn(), resumeAudio: vi.fn(),
  isAudioActive: () => false, preloadFile: vi.fn(), setRemoteHandlers: vi.fn(),
};
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) } }));

const tts = await import('./tts');

const section = (n) => ({ sectionId: `s${n}`, bookId: 'b', number: String(n), title: '', paragraphs: ['ก'] });

beforeEach(() => {
  global.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } };
  cache.ensure.mockClear();
  player.playFile.mockClear();
  tts.setAudioVoice('f');
});
afterEach(() => { tts.stop(); delete global.window; });

describe('changing the voice while a playlist runs', () => {
  it('plays the next section in the newly chosen voice', async () => {
    tts.playItems([section(1), section(2)].map(tts.buildSectionItem));
    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalledWith('f-s1-0', 'f'));

    tts.setAudioVoice('m');

    // Section 2 has not started, so it is rebuilt at its boundary: the male
    // hash AND the male wording, never one with the other.
    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalledWith('m-s2-0', 'm'));
    const spoken = tts.getItems()[1].chunks[0].text;
    expect(spoken).toContain('m:');
    expect(spoken).not.toContain('f:');
  });

  it('leaves the section already playing in the voice it started in', async () => {
    tts.playItems([section(1)].map(tts.buildSectionItem));
    await vi.waitFor(() => expect(cache.ensure).toHaveBeenCalledWith('f-s1-0', 'f'));

    tts.setAudioVoice('m');

    expect(tts.getItems()[0].chunks[0].text).toContain('f:');
    expect(cache.ensure).not.toHaveBeenCalledWith('m-s1-0', 'm');
  });
});
