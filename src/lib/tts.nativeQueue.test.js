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
import { TextToSpeech } from '@capacitor-community/text-to-speech';

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

describe('what native needs in order to fall back on its own', () => {
  it('tells each entry which book its words are in', async () => {
    tts.playItems([tts.buildSectionItem(section('1', ['ก']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    // section() builds 'civil-1', so the book key is what precedes the dash —
    // the name of the speech-<book>.json bundled in the APK.
    const [flat] = nq.startQueue.mock.calls[0];
    expect(flat.every((u) => u.book === 'civil')).toBe(true);
  });

  it('sends the speech settings the device voice will need', async () => {
    tts.setRate(1.4);
    tts.playItems([tts.buildSectionItem(section('1', ['ก']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [, , opts] = nq.startQueue.mock.calls[0];
    expect(opts).toMatchObject({ rate: 1.4, pitch: 1 });
  });

  it('shows the device voice while native is reading with it', async () => {
    tts.playItems([tts.buildSectionItem(section('1', ['ก']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0, degraded: true });
    expect(tts.currentVoiceKind()).toBe('device');

    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0, degraded: false });
    expect(tts.currentVoiceKind()).toBe('audio');
  });

  it('does not tear down a queue native is still reading aloud', async () => {
    // degraded is playback, not a stall: native is speaking the paragraph the
    // file failed on. Pulling the playlist back into the JS loop here would
    // start a second voice over the top of it.
    tts.playItems([tts.buildSectionItem(section('1', ['ก']))], 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.queueState.mockResolvedValue({
      index: 0, itemIndex: 0, paraIndex: 0, playing: true, stalled: false, degraded: true, error: null,
    });
    const onVisible = document.addEventListener.mock.calls
      .find(([name]) => name === 'visibilitychange')?.[1];
    onVisible();

    await vi.waitFor(() => expect(tts.currentVoiceKind()).toBe('device'));
    expect(nq.clearQueue).not.toHaveBeenCalled();
    expect(TextToSpeech.speak).not.toHaveBeenCalled();
    expect(tts.isPaused()).toBe(false);
  });
});

describe('losing the network mid-queue', () => {
  // Native plays files and nothing else — PlaybackQueue has no device-voice
  // path — so an ExoPlayer error it cannot retry past ends in silence, with
  // the queue still loaded and the notification still up. iOS never showed
  // this: it runs the JavaScript loop, whose speakUnit() chain ends in the
  // device voice by design. Taking the playlist back is what gives Android
  // the same ending.
  it('hands the playlist back to the loop, which speaks in the device voice', async () => {
    // Held open so the assertions below land mid-paragraph rather than after
    // the loop has run the whole two-unit playlist out and reset itself.
    TextToSpeech.speak.mockImplementationOnce(() => new Promise(() => {}));
    const items = [tts.buildSectionItem(section('1', ['ก', 'ข']))];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    const { onStalled } = nq.setQueueHandlers.mock.calls[0][0];
    onStalled({ index: 0, itemIndex: 0, paraIndex: 0, error: 'ERROR_CODE_IO_NETWORK_CONNECTION_FAILED' });

    await vi.waitFor(() => expect(TextToSpeech.speak).toHaveBeenCalled());
    expect(nq.clearQueue).toHaveBeenCalled();   // native must not resume underneath the loop
    expect(tts.isSpeaking()).toBe(true);
    expect(tts.isPaused()).toBe(false);
    expect(tts.currentVoiceKind()).toBe('device');
  });

  it('takes over a queue found already stalled when the app comes back', async () => {
    // The stall happened while JavaScript was frozen, so the queueStalled
    // event above landed nowhere. queueState() is the only report left.
    const items = [tts.buildSectionItem(section('1', ['ก', 'ข']))];
    tts.playItems(items, 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());

    nq.queueState.mockResolvedValue({
      index: 1, itemIndex: 0, paraIndex: 1, playing: false, stalled: true, error: 'ERROR_CODE_IO_BAD_HTTP_STATUS',
    });
    const onVisible = document.addEventListener.mock.calls
      .find(([name]) => name === 'visibilitychange')?.[1];
    onVisible();

    await vi.waitFor(() => expect(TextToSpeech.speak).toHaveBeenCalled());
    expect(nq.clearQueue).toHaveBeenCalled();
    expect(tts.isPaused()).toBe(false);   // not "paused" — it is playing, in the other voice
  });
});

// A free listener's daily limit. The JavaScript check that used to stop the
// loop before each section cannot stop a queue native is playing by itself —
// least of all ~80 seconds after the app leaves the screen, when JavaScript is
// no longer running to ask. So the limit has to be in the queue native is
// handed, and every section native played has to be paid for once JavaScript
// hears about it, however late.
describe('the daily listening limit on Android', () => {
  const five = () => ['1', '2', '3', '4', '5'].map((n) => tts.buildSectionItem(section(n, ['ก'])));
  const onVisible = () => document.addEventListener.mock.calls
    .find(([name]) => name === 'visibilitychange')?.[1]();

  let started;
  let allowance;
  let refuseFrom;
  beforeEach(() => {
    started = [];
    allowance = 2;
    refuseFrom = Infinity;
    tts.setHooks({
      onItemStart: (item) => {
        started.push(item.number);
        if (started.length >= refuseFrom || allowance <= 0) return false;
        allowance -= 1;
        return true;
      },
      itemAllowance: () => allowance,
    });
  });

  it('hands native only as many sections as the listener has left', async () => {
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [flat] = nq.startQueue.mock.calls[0];
    expect([...new Set(flat.map((u) => u.itemIndex))]).toEqual([0, 1]);
  });

  it('pays for the first section without waiting for native to announce it', async () => {
    // Native announces its starting entry from inside setQueue — before
    // startQueue resolves, so before this module treats native as the owner
    // of playback — and that queueAdvance is dropped. Found on a device: every
    // Android queue's first section went unpaid.
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    expect(started).toEqual(['1']);

    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });   // if it does arrive, not twice
    expect(started).toEqual(['1']);
  });

  it('hands native nothing when the listener has no sections left', async () => {
    allowance = 0;
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(started).toEqual(['1']));   // refused, which shows the prompt
    expect(nq.startQueue).not.toHaveBeenCalled();
    expect(tts.isSpeaking()).toBe(false);
  });

  it('hands native the whole playlist when there is no limit', async () => {
    allowance = Infinity;
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [flat] = nq.startQueue.mock.calls[0];
    expect(new Set(flat.map((u) => u.itemIndex)).size).toBe(5);
  });

  it('charges for every section native played while JavaScript was frozen', async () => {
    allowance = 10;
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });

    // Three advances went by with nobody listening; native is now on the fourth.
    nq.queueState.mockResolvedValue({
      index: 3, itemIndex: 3, paraIndex: 0, playing: true, stalled: false, error: null,
    });
    onVisible();
    await vi.waitFor(() => expect(started).toEqual(['1', '2', '3', '4']));
  });

  it('stops native when a section it reached is refused', async () => {
    allowance = 10;
    refuseFrom = 2;
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });
    onAdvance({ index: 1, itemIndex: 1, paraIndex: 0 });

    expect(nq.clearQueue).toHaveBeenCalled();
    expect(tts.isSpeaking()).toBe(false);
  });

  it('asks for the next section when a cut queue ends, and stops when refused', async () => {
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance, onEnded } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });
    onAdvance({ index: 1, itemIndex: 1, paraIndex: 0 });
    refuseFrom = 3;

    onEnded();
    expect(started).toEqual(['1', '2', '3']);   // the refusal is what shows the quota prompt
    expect(tts.isSpeaking()).toBe(false);
  });

  it('carries on with a new queue when the next section is allowed after all', async () => {
    // e.g. a rewarded ad watched while the last allowed section was playing
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance, onEnded } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });
    onAdvance({ index: 1, itemIndex: 1, paraIndex: 0 });
    allowance = 5;
    nq.startQueue.mockClear();

    onEnded();
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [flat, from] = nq.startQueue.mock.calls[0];
    expect(flat[from].itemIndex).toBe(2);
    expect(tts.isSpeaking()).toBe(true);
    // Paid for once, here — not again when native announces it.
    onAdvance({ index: 2, itemIndex: 2, paraIndex: 0 });
    expect(started).toEqual(['1', '2', '3']);
  });

  it('treats a cut queue found finished on return as its end', async () => {
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });
    refuseFrom = 3;

    // queueEnded fired while JavaScript was frozen. Native keeps the queue
    // loaded, parked on its last entry.
    nq.queueState.mockResolvedValue({
      index: 1, itemIndex: 1, paraIndex: 0, playing: false, stalled: false, error: null,
    });
    onVisible();
    await vi.waitFor(() => expect(started).toEqual(['1', '2', '3']));
    expect(tts.isSpeaking()).toBe(false);
  });

  it('turns repeat-all off on a cut queue, which would otherwise loop unpaid', async () => {
    tts.setRepeat('all');
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    expect(nq.startQueue.mock.calls[0][2].repeat).toBe('off');

    nq.setQueueRepeat.mockClear();
    tts.setRepeat('all');
    expect(nq.setQueueRepeat).toHaveBeenCalledWith('off');
    expect(tts.currentRepeat()).toBe('all');   // the listener's choice is kept
  });

  it('keeps repeat-all on when the whole playlist fits', async () => {
    allowance = Infinity;
    tts.setRepeat('all');
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    expect(nq.startQueue.mock.calls[0][2].repeat).toBe('all');
  });

  it('charges a section the listener skips to', async () => {
    allowance = 10;
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });

    tts.goToItem(3);
    expect(started).toEqual(['1', '4']);
    onAdvance({ index: 3, itemIndex: 3, paraIndex: 0 });
    expect(started).toEqual(['1', '4']);
  });

  it('re-cuts the queue after a skip, so the skip cannot buy extra sections', async () => {
    allowance = 3;
    tts.playItems(five(), 0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const { onAdvance } = nq.setQueueHandlers.mock.calls[0][0];
    onAdvance({ index: 0, itemIndex: 0, paraIndex: 0 });   // queue is 1–3, 2 left
    nq.startQueue.mockClear();

    // Back to the start pays for it again, leaving 1: the old queue would
    // still run on to the 3rd section with no one left to pay for it.
    tts.goToItem(0);
    await vi.waitFor(() => expect(nq.startQueue).toHaveBeenCalled());
    const [flat] = nq.startQueue.mock.calls[0];
    expect(Math.max(...flat.map((u) => u.itemIndex))).toBe(1);
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
