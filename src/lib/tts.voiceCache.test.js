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

  it('resolves once for a whole playback run when a voice is explicitly selected, not once per chunk', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [
        { voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' },
        { voiceURI: 'com.apple.voice.enhanced.th-TH.Kanya', name: 'Kanya', lang: 'th-TH' },
      ],
    });
    const tts = await import('./tts');
    tts.setVoice('com.apple.voice.enhanced.th-TH.Kanya');
    const item = tts.buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ย่อหน้าแรก', 'ย่อหน้าที่สอง'],
    });
    tts.playItems([item], 0);
    await new Promise((r) => setTimeout(r, 20));
    expect(getSupportedVoices).toHaveBeenCalledTimes(1);
    tts.stop();
  });

  it('clearVoiceCache forces a re-resolve on the next playback run — the resume path, not routed through speakSample', async () => {
    getSupportedVoices.mockResolvedValue({
      voices: [{ voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' }],
    });
    const tts = await import('./tts');
    const item = tts.buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ย่อหน้าแรก'],
    });

    tts.playItems([item], 0);
    await new Promise((r) => setTimeout(r, 20));
    tts.stop();
    expect(getSupportedVoices).toHaveBeenCalledTimes(1);

    // Simulate the app-resume listener (TtsContext) clearing the cache while
    // nothing is being previewed — speakSample never runs in this test, so
    // if clearVoiceCache stopped doing anything, the count below would stay
    // at 1 instead of advancing to 2.
    tts.clearVoiceCache();
    getSupportedVoices.mockResolvedValue({
      voices: [
        { voiceURI: 'com.apple.ttsbundle.Kanya-compact', name: 'Kanya', lang: 'th-TH' },
        { voiceURI: 'com.apple.voice.enhanced.th-TH.Kanya', name: 'Kanya', lang: 'th-TH' },
      ],
    });
    tts.playItems([item], 0);
    await new Promise((r) => setTimeout(r, 20));
    expect(getSupportedVoices).toHaveBeenCalledTimes(2);
    tts.stop();
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
