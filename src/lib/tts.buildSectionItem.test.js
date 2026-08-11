import { describe, it, expect, vi } from 'vitest';
import { buildSectionItem } from './tts';

describe('buildSectionItem', () => {
  it('normalizes the heading chunk', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '193/30',
      title: '', paragraphs: [],
    });
    expect(item.chunks[0].text).toBe('มาตรา 193 ทับ 30');
  });

  it('leads the first paragraph with the section number, in one chunk', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '5',
      title: '', paragraphs: ['บุคคลย่อมพ้น', 'ย่อหน้าที่สอง'],
    });
    expect(item.chunks[0].text).toBe('มาตรา 5 บุคคลย่อมพ้น');
    expect(item.chunks[1].text).toBe('ย่อหน้าที่สอง');
  });

  it('normalizes references inside the body', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '5',
      title: '', paragraphs: ['ก', 'ให้นำมาตรา 1598/21 มาใช้บังคับ'],
    });
    expect(item.chunks[1].text).toBe('ให้นำมาตรา 1598 ทับ 21 มาใช้บังคับ');
  });

  it('keeps label unnormalized — it is shown on screen, not spoken', () => {
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '193/30',
      title: '', paragraphs: [],
    });
    expect(item.label).toBe('มาตรา 193/30');
    expect(item.number).toBe('193/30');
  });

  it('still maps every chunk to its paragraph index', () => {
    // No -1 chunk any more: the section number rides on paragraph 0, so the
    // reader highlights it from the first word instead of leaving nothing
    // highlighted while the number is read.
    const item = buildSectionItem({
      sectionId: 'x', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ย่อหน้าแรก', 'ย่อหน้าที่สอง'],
    });
    expect(item.chunks.map((c) => c.paraIndex)).toEqual([0, 1]);
  });
});

describe('buildSectionItem — audio units', () => {
  it('emits one chunk per paragraph, each with its hash, when audio is on', async () => {
    vi.resetModules();
    vi.doMock('./audioManifest', () => ({
      isAudioEnabled: () => true,
      audioHashFor: (sectionId, i) => `hash${i}`,
      audioUrl: (h) => `https://cdn/audio/${h}.mp3`,
  DEFAULT_VOICE: 'm',
    }));
    const { buildSectionItem: build } = await import('./tts');
    const long = 'ก'.repeat(500);   // four chunks under the 180 rule
    const item = build({
      sectionId: 'civil-1', bookId: 'civil', number: '1',
      title: '', paragraphs: [long, 'สอง'],
    });
    expect(item.chunks).toHaveLength(2);
    expect(item.chunks.map((c) => c.audioHash)).toEqual(['hash0', 'hash1']);
    expect(item.chunks[0].text.length).toBeGreaterThan(180);
    vi.doUnmock('./audioManifest');
  });

  it('falls back to 180-character chunks for a paragraph with no hash', async () => {
    // A section edited after the render has no file, and must still be read.
    vi.resetModules();
    vi.doMock('./audioManifest', () => ({
      isAudioEnabled: () => true,
      audioHashFor: () => null,
      audioUrl: () => null,
  DEFAULT_VOICE: 'm',
    }));
    const { buildSectionItem: build } = await import('./tts');
    const item = build({
      sectionId: 'civil-1', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ก'.repeat(500)],
    });
    expect(item.chunks.length).toBeGreaterThan(1);
    expect(item.chunks.every((c) => c.audioHash === null)).toBe(true);
    expect(item.chunks.every((c) => c.paraIndex === 0)).toBe(true);
    vi.doUnmock('./audioManifest');
  });

  it('keeps chunking exactly as before when audio is off', async () => {
    vi.resetModules();
    vi.doMock('./audioManifest', () => ({
      isAudioEnabled: () => false,
      audioHashFor: () => null,
      audioUrl: () => null,
  DEFAULT_VOICE: 'm',
    }));
    const { buildSectionItem: build } = await import('./tts');
    const item = build({
      sectionId: 'civil-1', bookId: 'civil', number: '1',
      title: '', paragraphs: ['ก'.repeat(500)],
    });
    expect(item.chunks.length).toBeGreaterThan(1);
    vi.doUnmock('./audioManifest');
  });
});
