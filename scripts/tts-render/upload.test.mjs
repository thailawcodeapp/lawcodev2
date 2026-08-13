import { describe, it, expect } from 'vitest';
import { objectKey, planUpload, selectHashes } from './upload.mjs';

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

describe('selectHashes', () => {
  const paragraphs = [
    { sectionId: 'cr-370', paraIndex: 0, hash: 'aaa' },
    { sectionId: 'cr-371', paraIndex: 0, hash: 'bbb' },
    { sectionId: 'cr-371', paraIndex: 1, hash: 'ccc' },
  ];

  it('takes a single paragraph by section and index', () => {
    expect(selectHashes(paragraphs, ['cr-371:1'])).toEqual(['ccc']);
  });

  it('takes a whole section when only the section is named', () => {
    expect(selectHashes(paragraphs, ['cr-371'])).toEqual(['bbb', 'ccc']);
  });

  // The file name is what an operator is holding when a clip sounds wrong —
  // it is what R2 lists and what the render script wrote.
  it('takes a bare hash', () => {
    expect(selectHashes(paragraphs, ['aaa'])).toEqual(['aaa']);
  });

  it('names each object once, however many ways it was asked for', () => {
    expect(selectHashes(paragraphs, ['cr-370', 'cr-370:0', 'aaa'])).toEqual(['aaa']);
  });

  it('matches nothing when nothing is named', () => {
    expect(selectHashes(paragraphs, ['cr-999'])).toEqual([]);
  });
});
