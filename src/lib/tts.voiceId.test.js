import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSupportedVoices = vi.fn();
const speak = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    getSupportedVoices: (...a) => getSupportedVoices(...a),
    speak: (...a) => speak(...a),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

const VOICES = [
  { voiceURI: 'com.apple.voice.compact.en-US.Samantha', name: 'Samantha', lang: 'en-US' },
  { voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' },
  { voiceURI: 'com.apple.voice.enhanced.th-TH.Kanya', name: 'Kanya', lang: 'th-TH' },
];

const asIos = () => {
  globalThis.window = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
};

describe('voice identity', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupportedVoices.mockReset();
    speak.mockClear();
    asIos();
    getSupportedVoices.mockResolvedValue({ voices: VOICES });
  });

  it('exposes the stable voiceURI as the id', async () => {
    const tts = await import('./tts');
    const list = await tts.getVoices();
    expect(list.map((v) => v.id)).toEqual([
      'com.apple.ttsbundle.Kanya-compact',
      'com.apple.voice.enhanced.th-TH.Kanya',
    ]);
  });

  it('speaks with the voice the user chose, found by id', async () => {
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.enhanced.th-TH.Kanya');
    await tts.speakSample('ทดสอบ');
    expect(speak.mock.calls[0][0].voice).toBe(2);
  });

  it('still resolves after the system list reorders', async () => {
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.enhanced.th-TH.Kanya');
    getSupportedVoices.mockResolvedValue({ voices: [VOICES[2], VOICES[0], VOICES[1]] });
    await tts.speakSample('ทดสอบ');
    expect(speak.mock.calls[0][0].voice).toBe(0);
  });

  it('falls back to auto-pick when the chosen voice is gone', async () => {
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.premium.th-TH.SomeoneElse');
    await tts.speakSample('ทดสอบ');
    // auto-pick prefers enhanced over compact
    expect(speak.mock.calls[0][0].voice).toBe(2);
  });

  it('treats a legacy numeric setting as unset', async () => {
    const tts = await import('./tts');
    tts.setVoice(2); // what older builds persisted
    await tts.speakSample('ทดสอบ');
    expect(speak.mock.calls[0][0].voice).toBe(2); // auto-pick, not "index 2" by luck
    expect(tts.getVoice()).toBe(null);
  });
});
