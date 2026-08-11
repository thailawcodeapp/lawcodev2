import { describe, it, expect, vi, afterEach } from 'vitest';
import { audioHashFor, audioUrl, isAudioEnabled } from './audioManifest';
import { AUDIO_BASE_URL } from '../config';

describe('audioHashFor', () => {
  it('finds the hash for a real section and paragraph', () => {
    // civil_proc-182 has ten paragraphs; paragraph 0 carries the section number.
    const h = audioHashFor('civil_proc-182', 0);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gives different hashes to different paragraphs of one section', () => {
    expect(audioHashFor('civil_proc-182', 0)).not.toBe(audioHashFor('civil_proc-182', 1));
  });

  it('returns null for a section the manifest does not know', () => {
    expect(audioHashFor('no-such-section', 0)).toBe(null);
  });

  it('returns null for a paragraph index past the end', () => {
    expect(audioHashFor('civil_proc-182', 999)).toBe(null);
  });

  it('returns null for a negative index rather than reading from the end', () => {
    expect(audioHashFor('civil_proc-182', -1)).toBe(null);
  });
});

describe('audioUrl', () => {
  it('builds the key upload.mjs actually wrote', () => {
    // objectKey() in scripts/tts-render/upload.mjs is `audio/<hash>.mp3` for
    // the female voice and `audio/<voice>/<hash>.mp3` for any other. If these
    // two ever disagree every request 404s and the app falls back to the
    // device voice for the whole corpus, silently.
    const f = audioUrl('0123456789abcdef', 'f');
    const m = audioUrl('0123456789abcdef', 'm');
    if (!isAudioEnabled()) {
      expect(f).toBe(null);
      expect(m).toBe(null);
    } else {
      expect(f.endsWith('/audio/0123456789abcdef.mp3')).toBe(true);
      expect(m.endsWith('/audio/m/0123456789abcdef.mp3')).toBe(true);
    }
  });

  it('returns null when there is no hash', () => {
    expect(audioUrl(null)).toBe(null);
    expect(audioUrl('')).toBe(null);
  });
});

describe('isAudioEnabled', () => {
  it('agrees with the configured base URL', () => {
    expect(isAudioEnabled()).toBe(AUDIO_BASE_URL.length > 0);
  });
});

// AUDIO_BASE_URL ships as '' (see src/config.js), so every test above this
// point exercises audioUrl()'s "disabled" short-circuit, not the URL-building
// line itself. That line builds the key upload.mjs actually wrote
// (`audio/<hash>.mp3`) and is the highest-consequence invariant in phase 3B:
// if it ever drifts from objectKey() in scripts/tts-render/upload.mjs, every
// request 404s and the app falls back to the device voice for the whole
// 6,712-file corpus, silently. These tests mock ../config per-test to force
// isAudioEnabled() true and actually reach that line. vi.mock is hoisted and
// its factory can't vary between tests, so we use vi.doMock + vi.resetModules
// + a dynamic import to get a fresh, differently-configured module each time.
describe('audioUrl with a non-empty AUDIO_BASE_URL (mocked ../config)', () => {
  afterEach(() => {
    vi.doUnmock('../config');
    vi.resetModules();
  });

  it('builds exactly <base>/audio/<hash>.mp3 when the base has no trailing slash', async () => {
    vi.doMock('../config', () => ({ AUDIO_BASE_URL: 'https://pub-example.r2.dev' }));
    vi.resetModules();
    const { audioUrl: mockedAudioUrl } = await import('./audioManifest');
    expect(mockedAudioUrl('0123456789abcdef', 'f')).toBe(
      'https://pub-example.r2.dev/audio/0123456789abcdef.mp3'
    );
  });

  it('strips one or more trailing slashes so the path has no doubled slash', async () => {
    vi.doMock('../config', () => ({ AUDIO_BASE_URL: 'https://pub-example.r2.dev///' }));
    vi.resetModules();
    const { audioUrl: mockedAudioUrl } = await import('./audioManifest');
    expect(mockedAudioUrl('0123456789abcdef', 'f')).toBe(
      'https://pub-example.r2.dev/audio/0123456789abcdef.mp3'
    );
  });

  // The prefix is the only thing keeping the two voices apart: 5,048 of the
  // 6,712 paragraphs contain no "(n)" label, so their text — and therefore
  // their hash — is byte-identical between voices. Drop the prefix and the
  // male render overwrites three quarters of the female one on R2, and the
  // device cache serves whichever arrived first.
  it('puts the male voice under its own prefix, from the very same hash', async () => {
    vi.doMock('../config', () => ({ AUDIO_BASE_URL: 'https://pub-example.r2.dev' }));
    vi.resetModules();
    const { audioUrl: mockedAudioUrl } = await import('./audioManifest');
    const shared = '0123456789abcdef';
    expect(mockedAudioUrl(shared, 'm')).toBe(
      'https://pub-example.r2.dev/audio/m/0123456789abcdef.mp3'
    );
    expect(mockedAudioUrl(shared, 'm')).not.toBe(mockedAudioUrl(shared, 'f'));
  });

  it('isAudioEnabled is true when the base URL is non-empty', async () => {
    vi.doMock('../config', () => ({ AUDIO_BASE_URL: 'https://pub-example.r2.dev' }));
    vi.resetModules();
    const { isAudioEnabled: mockedIsAudioEnabled } = await import('./audioManifest');
    expect(mockedIsAudioEnabled()).toBe(true);
  });
});
