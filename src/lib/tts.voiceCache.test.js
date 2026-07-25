import { describe, it, expect, vi, beforeEach } from 'vitest';

// The plugin is native-only; stub it so the resolver can be exercised in Node.
const getSupportedVoices = vi.fn();
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: {
    getSupportedVoices: (...a) => getSupportedVoices(...a),
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}));

const asIos = () => {
  globalThis.window = {
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
  };
};

describe('voice resolver cache', () => {
  beforeEach(() => {
    vi.resetModules();
    getSupportedVoices.mockReset();
    asIos();
  });

  it('resolves once for a whole playback run, not once per chunk', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [{ voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' }],
    });
    const tts = await import('./tts');
    const item = tts.buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ย่อหน้าแรก', 'ย่อหน้าที่สอง'],
    });
    tts.playItems([item], 0);
    await new Promise((r) => setTimeout(r, 20));
    expect(getSupportedVoices).toHaveBeenCalledTimes(1);
    tts.stop();
  });

  it('asks again after clearVoiceCache, so a newly installed voice is seen', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [{ voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' }],
    });
    const tts = await import('./tts');
    await tts.speakSample('ทดสอบ');

    tts.clearVoiceCache();
    getSupportedVoices.mockResolvedValue({
      voices: [
        { voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' },
        { voiceURI: 'com.apple.voice.enhanced.th-TH.Kanya', name: 'Kanya', lang: 'th-TH' },
      ],
    });
    await tts.speakSample('ทดสอบ');
    expect(getSupportedVoices).toHaveBeenCalledTimes(2);
  });

  it('re-resolves on every preview tap, so a just-installed voice is heard', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [{ voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' }],
    });
    const tts = await import('./tts');
    await tts.speakSample('ทดสอบ');
    await tts.speakSample('ทดสอบ');
    expect(getSupportedVoices).toHaveBeenCalledTimes(2);
  });
});
