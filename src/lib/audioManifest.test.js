import { describe, it, expect } from 'vitest';
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
    // objectKey() in scripts/tts-render/upload.mjs is `audio/<hash>.mp3`.
    // If these two ever disagree every request 404s and the app falls back
    // to the device voice for the whole corpus, silently.
    const url = audioUrl('0123456789abcdef');
    if (!isAudioEnabled()) {
      expect(url).toBe(null);
    } else {
      expect(url.endsWith('/audio/0123456789abcdef.mp3')).toBe(true);
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
