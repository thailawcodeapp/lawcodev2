import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./nativeQueue', () => ({
  isNativeQueueAvailable: vi.fn(() => true),
  startQueue: vi.fn(async () => true),
  skipToQueueIndex: vi.fn(async () => {}),
  pauseQueue: vi.fn(async () => {}),
  resumeQueue: vi.fn(async () => {}),
  clearQueue: vi.fn(async () => {}),
  setQueueRepeat: vi.fn(async () => {}),
  setQueueRate: vi.fn(async () => {}),
  queueState: vi.fn(async () => ({
    index: 2, itemIndex: 1, paraIndex: 0, playing: true, stalled: false, error: null,
  })),
  setQueueHandlers: vi.fn(),
}));
vi.mock('@capacitor-community/text-to-speech', () => ({
  TextToSpeech: { speak: vi.fn(async () => {}), stop: vi.fn(async () => {}), getSupportedVoices: vi.fn(async () => ({ voices: [] })) },
}));
vi.mock('./audioPlayer', () => ({
  playFile: vi.fn(() => new Promise(() => {})), stopAudio: vi.fn(),
  pauseAudio: vi.fn(), resumeAudio: vi.fn(), isAudioActive: vi.fn(() => false),
  preloadFile: vi.fn(), setRemoteHandlers: vi.fn(),
}));
vi.mock('./audioCache', () => ({ ensure: vi.fn(async () => null), removeCached: vi.fn(async () => {}) }));

import * as nq from './nativeQueue';

const section = (number, paragraphs) => ({
  sectionId: `civil-${number}`, bookId: 'civil', number,
  title: 'ชื่อมาตรา', paragraphs,
});

let tts;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() });
  vi.clearAllMocks();
  nq.isNativeQueueAvailable.mockReturnValue(true);
  nq.startQueue.mockResolvedValue(true);
  tts = await import('./tts');
});
afterEach(() => vi.unstubAllGlobals());

describe('playItems on Android', () => {
  it('hands the playlist to native instead of starting the JS loop', async () => {
    const items = [tts.buildSectionItem(section('1', ['ก'])), tts.buildSectionItem(section('2', ['ข']))];
    tts.playItems(items, 1);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    const [, startIndex] = nq.startQueue.mock.calls[0];
    expect(startIndex).toBeGreaterThan(0);   // started at the second section
    expect(tts.isSpeaking()).toBe(true);
  });

  it('falls back to the JS loop when native refuses the playlist', async () => {
    nq.startQueue.mockResolvedValue(false);
    const items = [tts.buildSectionItem(section('1', ['ก']))];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    // The loop owns playback now; the native controls must stay untouched.
    expect(nq.pauseQueue).not.toHaveBeenCalled();
  });
});

describe('controls on Android', () => {
  beforeEach(async () => {
    tts.playItems([tts.buildSectionItem(section('1', ['ก', 'ข']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
  });

  it('pause and resume drive the queue, not a single clip', () => {
    tts.pause();
    expect(nq.pauseQueue).toHaveBeenCalled();
    tts.resume();
    expect(nq.resumeQueue).toHaveBeenCalled();
  });

  it('stop clears the queue', () => {
    tts.stop();
    expect(nq.clearQueue).toHaveBeenCalled();
  });

  it('repeat and rate changes reach native mid-playback', () => {
    tts.setRepeat('section');
    expect(nq.setQueueRepeat).toHaveBeenCalledWith('section');
    tts.setRate(1.5);
    expect(nq.setQueueRate).toHaveBeenCalledWith(1.5);
  });

  it('goToItem skips within the queue rather than rebuilding it', () => {
    nq.startQueue.mockClear();
    tts.goToItem(0);
    expect(nq.skipToQueueIndex).toHaveBeenCalled();
    expect(nq.startQueue).not.toHaveBeenCalled();
  });
});

describe('changing voice mid-queue', () => {
  it('re-sends the queue, because the voice is part of every URL in it', async () => {
    tts.playItems([tts.buildSectionItem(section('1', ['ก']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.startQueue.mockClear();
    tts.setAudioVoice('f');
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
  });
});

describe('re-sync after the app comes back on screen', () => {
  it('takes its position from native rather than from what it remembers', async () => {
    const items = [
      tts.buildSectionItem(section('1', ['ก'])),
      tts.buildSectionItem(section('2', ['ข'])),
    ];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.queueState.mockResolvedValue({
      index: 1, itemIndex: 1, paraIndex: 0, playing: true, stalled: false, error: null,
    });
    const onVisible = document.addEventListener.mock.calls
      .find(([name]) => name === 'visibilitychange')?.[1];
    expect(onVisible, 'no visibilitychange listener registered').toBeTypeOf('function');

    onVisible();
    await vi.waitFor(() => expect(tts.currentItemIndex()).toBe(1));
  });
});
