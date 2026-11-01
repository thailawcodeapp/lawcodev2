import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginSection, clearListenTime, dayKey, endSection, formatDuration, leaveSection, listenTotals, secondsToSay,
  CHARS_PER_SECOND,
} from './listenTime.js';

const item = (chars) => ({ chunks: [{ text: 'ก'.repeat(chars) }] });
const at = new Date(2026, 9, 30, 12).getTime();

describe('listen time', () => {
  beforeEach(() => {
    const m = new Map();
    globalThis.localStorage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
    clearListenTime();
  });

  it('estimates from the text and the speed', () => {
    expect(secondsToSay(item(CHARS_PER_SECOND * 10))).toBe(10);
    expect(secondsToSay(item(CHARS_PER_SECOND * 10), 2)).toBe(5);
  });

  it('counts a played-through section in full, even when announced in a burst', () => {
    beginSection(item(CHARS_PER_SECOND * 60), 1, at);
    beginSection(item(CHARS_PER_SECOND * 60), 1, at + 1);
    endSection(at + 2);
    expect(listenTotals(new Date(at)).today).toBe(120);
  });

  it('counts only what was heard of a section left early', () => {
    beginSection(item(CHARS_PER_SECOND * 60), 1, at);
    leaveSection(at + 20000);
    expect(listenTotals(new Date(at)).today).toBe(20);
  });

  it('does not count time paused on a section', () => {
    beginSection(item(CHARS_PER_SECOND * 60), 1, at);
    leaveSection(at + 3600000);
    expect(listenTotals(new Date(at)).today).toBe(60);
  });

  it('sums today, the last seven days and everything', () => {
    const now = new Date(2026, 9, 30, 12);
    const day = (d) => new Date(2026, 9, d, 12).getTime();
    for (const [d, s] of [[30, 10], [24, 20], [23, 40]]) {
      beginSection(item(CHARS_PER_SECOND * s), 1, day(d));
      endSection(day(d));
    }
    expect(listenTotals(now)).toEqual({ today: 10, week: 30, all: 70 });
  });

  it('pads the day key', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('writes durations in Thai', () => {
    expect(formatDuration(59)).toBe('0 น.');
    expect(formatDuration(600)).toBe('10 น.');
    expect(formatDuration(3660)).toBe('1 ชม. 1 น.');
  });
});
