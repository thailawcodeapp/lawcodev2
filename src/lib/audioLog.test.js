import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  recordAudioIssue, audioIssues, clearAudioIssues, formatAudioIssues,
  markAlive, heartbeats, clearHeartbeats, formatHeartbeats,
  markTimerAlive, timerHeartbeats, clearTimerHeartbeats, formatTimerHeartbeats,
} from './audioLog';

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
  clearHeartbeats();
  clearTimerHeartbeats();
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

describe('markAlive', () => {
  // Three fixes in a row — a foreground service, a wake lock, a near-silent
  // keep-alive tone — changed nothing about when playback actually stopped.
  // recordAudioIssue() only fires when the fallback chain runs; if the real
  // failure is that the JS engine itself stops advancing, that path never
  // executes and nothing is ever recorded. This is what answers the question
  // those three attempts could not: was JS still running right up to the
  // moment the audio stopped?

  it('records a timestamped pulse with newest first', () => {
    markAlive({ sectionId: 'civil_proc-170', paraIndex: 0 });
    markAlive({ sectionId: 'civil_proc-170', paraIndex: 1 });

    const all = heartbeats();
    expect(all).toHaveLength(2);
    expect(all[0].paraIndex).toBe(1); // most recent first
    expect(all[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps only the most recent 20 — frequent by design, unlike the issue log', () => {
    for (let i = 0; i < 30; i++) markAlive({ sectionId: 's', paraIndex: i });
    const all = heartbeats();
    expect(all).toHaveLength(20);
    expect(all[0].paraIndex).toBe(29);
  });

  it('is a no-op rather than a crash when storage refuses to write', () => {
    global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => markAlive({ sectionId: 's', paraIndex: 0 })).not.toThrow();
  });

  it('does not touch the separate issue log', () => {
    markAlive({ sectionId: 's', paraIndex: 0 });
    expect(audioIssues()).toEqual([]);
    recordAudioIssue({ phase: 'fallback', hash: 'abc' });
    expect(heartbeats()).toHaveLength(1); // untouched by the issue-log write
  });
});

describe('formatHeartbeats', () => {
  it('puts the section on the same line as the timestamp', () => {
    markAlive({ sectionId: 'civil_proc-170', paraIndex: 2 });
    expect(formatHeartbeats()).toContain('civil_proc-170¶2');
  });

  it('says so plainly when nothing has played yet', () => {
    expect(formatHeartbeats()).toBe('no heartbeat recorded yet');
  });
});

describe('markTimerAlive', () => {
  // A device test found the real shape of the failure: audio stops at a
  // fixed ~60 seconds after leaving the app, screen off or not, regardless of
  // how many paragraphs that covers — a wall-clock signature, not a
  // work-based one. markAlive() cannot see that: it only pulses when the
  // playback loop advances to a new paragraph, so "the loop is stuck
  // awaiting a promise" and "the JS engine itself stopped" look identical to
  // it. This is the independent, loop-agnostic pulse that tells them apart.

  it('records a timestamped pulse with no per-paragraph context — it owes nothing to the loop', () => {
    markTimerAlive();
    const [entry] = timerHeartbeats();
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.sectionId).toBeUndefined();
  });

  it('keeps only the most recent 40 — five-second ticks, so this is a bit over three minutes', () => {
    for (let i = 0; i < 50; i++) markTimerAlive();
    expect(timerHeartbeats()).toHaveLength(40);
  });

  it('is a no-op rather than a crash when storage refuses to write', () => {
    global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => markTimerAlive()).not.toThrow();
  });

  it('is a separate log from both the paragraph heartbeat and the issue log', () => {
    markTimerAlive();
    expect(heartbeats()).toEqual([]);
    expect(audioIssues()).toEqual([]);
    markAlive({ sectionId: 's', paraIndex: 0 });
    recordAudioIssue({ phase: 'fallback', hash: 'abc' });
    expect(timerHeartbeats()).toHaveLength(1); // untouched by either of the other writes
  });
});

describe('formatTimerHeartbeats', () => {
  it('is one timestamp per line, with nothing else to say', () => {
    markTimerAlive();
    markTimerAlive();
    expect(formatTimerHeartbeats().split('\n')).toHaveLength(2);
  });

  it('says so plainly when nothing has played yet', () => {
    expect(formatTimerHeartbeats()).toBe('no timer heartbeat recorded yet');
  });
});
