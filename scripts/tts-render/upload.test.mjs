import { describe, it, expect } from 'vitest';
import { objectKey, planUpload } from './upload.mjs';

describe('objectKey', () => {
  it('is a flat content-addressed path', () => {
    expect(objectKey('a1b2c3d4e5f60718')).toBe('audio/a1b2c3d4e5f60718.mp3');
  });
});

describe('planUpload', () => {
  const paragraphs = [
    { hash: 'aaaaaaaaaaaaaaaa' },
    { hash: 'bbbbbbbbbbbbbbbb' },
    { hash: 'aaaaaaaaaaaaaaaa' },
  ];

  it('skips objects already in the bucket', () => {
    const plan = planUpload(paragraphs, new Set(['audio/aaaaaaaaaaaaaaaa.mp3']));
    expect(plan).toEqual(['bbbbbbbbbbbbbbbb']);
  });

  it('uploads each hash once even when paragraphs repeat', () => {
    expect(planUpload(paragraphs, new Set())).toEqual(['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']);
  });

  it('plans nothing when the bucket already has everything', () => {
    const keys = new Set(paragraphs.map((p) => objectKey(p.hash)));
    expect(planUpload(paragraphs, keys)).toEqual([]);
  });
});
