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

  // Regression: the app's process/Activity can be recreated while this
  // module's own _paused/_nativeQueue flags survive across the gap (a
  // background freeze, not a full reload) — resumeQueue() is fire-and-forget
  // and native never rejects a "nothing to resume" command, so without this,
  // tapping play would show "playing" with dead silence and no way to notice.
  it('resends the queue when native reports it has nothing loaded after resume', async () => {
    tts.pause();
    nq.queueState.mockResolvedValueOnce({
      index: -1, itemIndex: -1, paraIndex: -1, playing: false, stalled: false, error: null,
    });
    nq.startQueue.mockClear();

    tts.resume();
    expect(nq.resumeQueue).toHaveBeenCalled(); // still fired immediately, optimistic

    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [flat] = nq.startQueue.mock.calls[0];
    expect(flat.length).toBeGreaterThan(0);   // resends the same playlist
  });

  it('does not resend the queue when native still has it loaded after resume', async () => {
    tts.pause();
    nq.startQueue.mockClear();

    tts.resume();
    await vi.waitFor(() => expect(nq.queueState).toHaveBeenCalled());
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

  it('stays resumable after the queue is paused from outside the app', async () => {
    // The notification's own play/pause button, pressed while backgrounded.
    // Native keeps the queue loaded (index >= 0) and simply stops producing
    // sound — so this is the index >= 0 branch, not the cleared-queue one.
    //
    // pause() encodes "paused" as _playing && _paused, and resume() refuses to
    // act unless BOTH hold. resyncFromNative() used to encode the same state
    // as _playing = false, which still showed the mini player (active is
    // playing || paused) with a play button on it, and made that button inert:
    // resume() returned at its first guard, silently, every time.
    const items = [tts.buildSectionItem(section('1', ['ก']))];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.queueState.mockResolvedValue({
      index: 0, itemIndex: 0, paraIndex: 0, playing: false, stalled: false, error: null,
    });
    const onVisible = document.addEventListener.mock.calls
      .find(([name]) => name === 'visibilitychange')?.[1];
    onVisible();

    await vi.waitFor(() => expect(tts.isPaused()).toBe(true));
    expect(tts.isSpeaking()).toBe(true);   // the session is still live, just paused

    nq.resumeQueue.mockClear();
    tts.resume();
    expect(nq.resumeQueue).toHaveBeenCalled();
    expect(tts.isPaused()).toBe(false);
  });

  it('recovers from a queue cleared while backgrounded — e.g. the lock-screen Stop button', async () => {
    // NativeAudio.java's onStop() releases the queue's player and clears the
    // notification, but (unlike the legacy single-clip path) never notifies
    // JavaScript — and JavaScript is usually frozen to hear it anyway. native
    // reports EMPTY_STATE (index: -1) on the next queueState() call, same as
    // "nothing has ever played". Silently ignoring that (the old behavior)
    // left _playing/_paused stuck at "still playing", so the mini player's
    // resume button did nothing at all.
    const items = [tts.buildSectionItem(section('1', ['ก']))];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.queueState.mockResolvedValue({
      index: -1, itemIndex: -1, paraIndex: -1, playing: false, stalled: false, error: null,
    });
    const onVisible = document.addEventListener.mock.calls
      .find(([name]) => name === 'visibilitychange')?.[1];

    onVisible();
    await vi.waitFor(() => expect(tts.isPaused()).toBe(true));
    expect(tts.isSpeaking()).toBe(true);   // mini player stays up, offering resume

    nq.startQueue.mockClear();
    tts.resume();
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [flat] = nq.startQueue.mock.calls[0];
    expect(flat.length).toBeGreaterThan(0);   // resends the same playlist
  });
});
