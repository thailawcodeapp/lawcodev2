import { describe, it, expect, vi, beforeEach } from 'vitest';

// The card is an announcement, and an announcement is only true when the thing
// it announces has happened. With AUDIO_BASE_URL empty the voice is identical
// to the previous build's, so the whole card must stay dark — the same rule
// AudioStorageRow already follows.
const enabled = { value: false };

vi.mock('../lib/audioManifest', () => ({
  isAudioEnabled: () => enabled.value,
}));

const news = {
  shouldShowVoiceNews: vi.fn(() => true),
  dismissVoiceNews: vi.fn(),
};
vi.mock('../lib/whatsNew', () => news);

// The card previews through the Tts context now (toggleSampleFile), so it can
// stop the sample and flip its own button to a stop label. The render-only
// tests here need the hook to exist; none of them press the button.
vi.mock('../context/TtsContext', () => ({
  useTts: () => ({ toggleSampleFile: vi.fn(), stopSample: vi.fn(), samplePlaying: false }),
}));

const { default: VoiceNewsCard } = await import('./VoiceNewsCard');
const { renderToStaticMarkup } = await import('react-dom/server');
const { createElement } = await import('react');

const render = () => renderToStaticMarkup(createElement(VoiceNewsCard));

beforeEach(() => {
  news.shouldShowVoiceNews.mockClear().mockReturnValue(true);
  news.dismissVoiceNews.mockClear();
});

describe('VoiceNewsCard', () => {
  it('renders nothing while the audio feature is off', () => {
    // Even for a returning user whom whatsNew would happily show the card to.
    enabled.value = false;
    expect(render()).toBe('');
  });

  it('never offers the ปิด button while the feature is off, so no dismissal can be recorded', () => {
    // dismissVoiceNews() writes a flag that is not version-scoped. A tap today,
    // on a build where nothing changed, would permanently silence the card for
    // the release where the voice actually does change.
    enabled.value = false;
    const html = render();
    expect(html).not.toContain('ปิด');
    expect(html).not.toContain('เสียงอ่านเปลี่ยนใหม่แล้ว');
  });

  it('renders the announcement once the feature is on', () => {
    enabled.value = true;
    const html = render();
    expect(html).toContain('เสียงอ่านเปลี่ยนใหม่แล้ว');
    expect(html).toContain('ฟังตัวอย่าง');
  });

  it('still stays quiet when the feature is on but this device has nothing to be told', () => {
    enabled.value = true;
    news.shouldShowVoiceNews.mockReturnValue(false);
    expect(render()).toBe('');
  });
});
