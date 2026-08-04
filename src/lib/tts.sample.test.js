import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cache = { ensure: vi.fn(), removeCached: vi.fn(async () => {}) };
let playFileResolve;
const player = {
  playFile: vi.fn(() => new Promise((res) => { playFileResolve = res; })),
  stopAudio: vi.fn(), pauseAudio: vi.fn(), resumeAudio: vi.fn(),
  isAudioActive: vi.fn(() => false), preloadFile: vi.fn(),
};
const tts = {
  speak: vi.fn(() => new Promise(() => {})),   // device voice: stays speaking
  stop: vi.fn(async () => {}),
  getSupportedVoices: vi.fn(async () => ({ voices: [] })),
};
vi.mock('./audioCache', () => cache);
vi.mock('./audioPlayer', () => player);
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: tts }));
vi.mock('./audioManifest', () => ({
  isAudioEnabled: () => true,
  audioHashFor: (sectionId) => (sectionId === 'cr-59' ? 'hash-59' : null),
  audioUrl: (h) => `https://cdn/audio/${h}.mp3`,
}));

const lib = await import('./tts');

beforeEach(() => {
  cache.ensure.mockReset().mockResolvedValue('file:///a.mp3');
  player.playFile.mockClear();
  player.stopAudio.mockClear();
  tts.speak.mockClear();
  global.window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => { lib.stopSample(); lib.stop(); delete global.window; });

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('preview sample — file', () => {
  it('plays the rendered file and reports itself playing', async () => {
    lib.toggleSampleFile('cr-59', 0, 'สำรอง');
    await flush();
    expect(player.playFile).toHaveBeenCalledWith('file:///a.mp3', expect.objectContaining({ rate: expect.any(Number) }));
    expect(lib.isSamplePlaying()).toBe(true);
    expect(lib.samplePlayingKind()).toBe('audio');
  });

  it('a second press stops it instead of starting again', async () => {
    lib.toggleSampleFile('cr-59', 0, 'สำรอง');
    await flush();
    expect(player.playFile).toHaveBeenCalledTimes(1);

    lib.toggleSampleFile('cr-59', 0, 'สำรอง');   // press again
    await flush();
    expect(player.stopAudio).toHaveBeenCalled();
    expect(lib.isSamplePlaying()).toBe(false);
    expect(player.playFile).toHaveBeenCalledTimes(1);   // did NOT restart
  });

  it('clears itself when the clip finishes on its own', async () => {
    lib.toggleSampleFile('cr-59', 0, 'สำรอง');
    await flush();
    playFileResolve();                 // clip ends
    await flush();
    expect(lib.isSamplePlaying()).toBe(false);
  });

  it('never starts the playlist — no quota, no position', async () => {
    lib.toggleSampleFile('cr-59', 0, 'สำรอง');
    await flush();
    // isSpeaking() is the playlist flag; a sample must leave it false so the
    // quota gate and statistics that hang off playItems never fire.
    expect(lib.isSpeaking()).toBe(false);
  });

  it('falls back to the device voice when the section has no file', async () => {
    lib.toggleSampleFile('no-such', 0, 'อ่านด้วยเสียงเครื่อง');
    await flush();
    expect(player.playFile).not.toHaveBeenCalled();
    expect(tts.speak).toHaveBeenCalled();
    expect(lib.samplePlayingKind()).toBe('device');
  });
});

describe('preview sample — device', () => {
  it('toggles the device voice on and off', async () => {
    lib.toggleSampleDevice('ทดสอบ');
    await flush();
    expect(tts.speak).toHaveBeenCalledTimes(1);
    expect(lib.samplePlayingKind()).toBe('device');

    lib.toggleSampleDevice('ทดสอบ');   // press again
    await flush();
    expect(tts.stop).toHaveBeenCalled();
    expect(lib.isSamplePlaying()).toBe(false);
    expect(tts.speak).toHaveBeenCalledTimes(1);
  });
});

describe('preview sample — does not fight the playlist', () => {
  it('refuses to start while a section is playing', async () => {
    lib.playItems([{
      sectionId: 's', bookId: 'b', number: '1', title: '',
      chunks: [{ text: 'x', paraIndex: 0, audioHash: 'h' }],
    }]);
    await flush();
    player.playFile.mockClear();
    lib.toggleSampleFile('cr-59', 0, 'สำรอง');
    await flush();
    expect(lib.samplePlayingKind()).toBe(null);
  });
});
