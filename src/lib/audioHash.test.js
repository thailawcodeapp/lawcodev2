import { describe, it, expect } from 'vitest';
import { audioHash } from './audioHash';

describe('audioHash', () => {
  it('is 16 lowercase hex characters', () => {
    expect(audioHash('ผู้ใดจงใจ')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is stable for the same text', () => {
    expect(audioHash('ผู้ใดจงใจ')).toBe(audioHash('ผู้ใดจงใจ'));
  });

  it('differs for different text', () => {
    expect(audioHash('ก')).not.toBe(audioHash('ข'));
  });

  it('differs when only whitespace differs, because the engine hears that', () => {
    expect(audioHash('ก ข')).not.toBe(audioHash('กข'));
  });

  it('handles empty input without throwing', () => {
    expect(audioHash('')).toMatch(/^[0-9a-f]{16}$/);
  });
});
