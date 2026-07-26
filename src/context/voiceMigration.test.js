import { describe, it, expect } from 'vitest';
import { migrateLegacyVoice } from './voiceMigration';

describe('migrateLegacyVoice', () => {
  it('clears a legacy numeric ttsVoice so the dropdown falls back to auto-pick', () => {
    expect(migrateLegacyVoice(2)).toBe(null);
  });

  it('leaves a modern voiceURI string untouched', () => {
    expect(migrateLegacyVoice('com.apple.voice.enhanced.th-TH.Kanya'))
      .toBe('com.apple.voice.enhanced.th-TH.Kanya');
  });

  it('leaves null untouched', () => {
    expect(migrateLegacyVoice(null)).toBe(null);
  });
});
