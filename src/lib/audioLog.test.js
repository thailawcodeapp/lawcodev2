import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { recordAudioIssue, audioIssues, clearAudioIssues, formatAudioIssues } from './audioLog';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

beforeEach(() => {
  global.localStorage = fakeStorage();
  // stubGlobal, not assignment: Node 22 defines a real globalThis.navigator
  // with only a getter, so `global.navigator = ...` throws.
  vi.stubGlobal('document', { visibilityState: 'visible' });
  vi.stubGlobal('navigator', { onLine: true });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  clearAudioIssues();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete global.localStorage;
});

describe('recordAudioIssue', () => {
  it('captures the two facts that tell the causes apart', () => {
    // Doze only restricts an app's network with the screen off, so "was the
    // app on screen" decides whether a foreground service is even the right
    // fix. And "the WebView still saw a connection" is what separates
    // "the OS cut this process off" from "the phone genuinely lost signal" —
    // the listener can only report the second, and reports it as neither.
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    recordAudioIssue({ phase: 'download', hash: 'abc', voice: 'm', error: 'timeout' });

    const [entry] = audioIssues();
    expect(entry.visible).toBe(false);
    expect(entry.online).toBe(true);
    expect(entry.error).toBe('timeout');
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps the newest first and stops at 50', () => {
    for (let i = 0; i < 60; i++) recordAudioIssue({ phase: 'fallback', hash: `h${i}` });
    const all = audioIssues();
    expect(all).toHaveLength(50);
    expect(all[0].hash).toBe('h59');
  });

  it('survives a reload, because a killed WebView is one of the suspects', () => {
    recordAudioIssue({ phase: 'fallback', hash: 'abc' });
    // A fresh module sees the same storage — the entry is not in memory.
    expect(JSON.parse(global.localStorage.getItem('lawcode-audio-issues'))).toHaveLength(1);
  });

  it('is a no-op rather than a crash when storage refuses to write', () => {
    // Private mode, a full quota. This runs inside the fallback path: a
    // diagnostic that can break playback is worse than no diagnostic.
    global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => recordAudioIssue({ phase: 'fallback', hash: 'abc' })).not.toThrow();
  });

  it('reads back as empty rather than throwing when the stored value is corrupt', () => {
    global.localStorage.setItem('lawcode-audio-issues', '{not json');
    expect(audioIssues()).toEqual([]);
  });

  it('also writes to the console, so adb logcat shows it live', () => {
    recordAudioIssue({ phase: 'download', hash: 'abc', error: 'timeout' });
    expect(console.warn).toHaveBeenCalledWith('[audio]', expect.stringContaining('"error":"timeout"'));
  });
});

describe('formatAudioIssues', () => {
  it('puts the section, the flags and the error on one pasteable line', () => {
    recordAudioIssue({
      phase: 'download', hash: 'abc', voice: 'm',
      sectionId: 'civil_proc-170', paraIndex: 0, error: 'SocketTimeoutException',
    });
    const line = formatAudioIssues();
    expect(line).toContain('civil_proc-170¶0');
    expect(line).toContain('voice=m');
    expect(line).toContain('visible=true');
    expect(line).toContain('error=SocketTimeoutException');
  });

  it('says so plainly when there is nothing to report', () => {
    expect(formatAudioIssues()).toBe('no audio issues recorded');
  });
});
