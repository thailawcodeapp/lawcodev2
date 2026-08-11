import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAudibleKeepAlive, stopAudibleKeepAlive } from './audibleKeepAlive';

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 1;
    this.currentTime = 0;
    this.paused = false;
    this.playCalls = 0;
  }
  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

beforeEach(() => {
  global.Audio = FakeAudio;
});
afterEach(() => {
  stopAudibleKeepAlive();
  delete global.Audio;
  delete global.window;
});

describe('startAudibleKeepAlive', () => {
  it('does nothing off a native platform — this is a native-WebView-freeze mitigation, not a web concern', () => {
    global.window = { Capacitor: { isNativePlatform: () => false } };
    const ctor = vi.fn((...args) => new FakeAudio(...args));
    global.Audio = ctor;

    startAudibleKeepAlive();

    expect(ctor).not.toHaveBeenCalled();
  });

  it('plays a looping, near-silent, unmuted track, bundled locally rather than fetched', () => {
    global.window = { Capacitor: { isNativePlatform: () => true } };
    const ctor = vi.fn((...args) => new FakeAudio(...args));
    global.Audio = ctor;

    startAudibleKeepAlive();

    expect(ctor).toHaveBeenCalledWith('keep-alive.wav');
    const instance = ctor.mock.results[0].value;
    expect(instance.loop).toBe(true);
    expect(instance.playCalls).toBe(1);
    // Chromium's "this tab is audible" exemption is based on measured output
    // level — muted media does not count, so this can never be 0 or muted.
    expect(instance.volume).toBeGreaterThan(0);
    expect(instance.volume).toBeLessThan(0.1);
  });

  it('does not start a second element on a second call while one is already running', () => {
    global.window = { Capacitor: { isNativePlatform: () => true } };
    const ctor = vi.fn((...args) => new FakeAudio(...args));
    global.Audio = ctor;

    startAudibleKeepAlive();
    startAudibleKeepAlive();

    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh element after a stop, rather than staying stopped forever', () => {
    global.window = { Capacitor: { isNativePlatform: () => true } };
    const ctor = vi.fn((...args) => new FakeAudio(...args));
    global.Audio = ctor;

    startAudibleKeepAlive();
    stopAudibleKeepAlive();
    startAudibleKeepAlive();

    expect(ctor).toHaveBeenCalledTimes(2);
  });

  it('does not throw when the platform refuses autoplay', () => {
    global.window = { Capacitor: { isNativePlatform: () => true } };
    global.Audio = class extends FakeAudio {
      play() {
        return Promise.reject(new Error('NotAllowedError'));
      }
    };
    expect(() => startAudibleKeepAlive()).not.toThrow();
  });

  it('does not throw when window.Audio does not exist at all', () => {
    global.window = { Capacitor: { isNativePlatform: () => true } };
    delete global.Audio;
    expect(() => startAudibleKeepAlive()).not.toThrow();
  });
});

describe('stopAudibleKeepAlive', () => {
  it('pauses and rewinds the element so a later start does not resume mid-loop', () => {
    global.window = { Capacitor: { isNativePlatform: () => true } };
    const ctor = vi.fn((...args) => new FakeAudio(...args));
    global.Audio = ctor;

    startAudibleKeepAlive();
    const instance = ctor.mock.results[0].value;
    instance.currentTime = 0.4;

    stopAudibleKeepAlive();

    expect(instance.paused).toBe(true);
    expect(instance.currentTime).toBe(0);
  });

  it('is a no-op when nothing is running', () => {
    expect(() => stopAudibleKeepAlive()).not.toThrow();
  });
});
