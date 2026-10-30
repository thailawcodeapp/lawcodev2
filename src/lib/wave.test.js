import { describe, expect, it } from 'vitest';
import { waveBars, barOpacity, queueBars } from './wave.js';

const secs = (n, len = (i) => 100 + i) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: 'x'.repeat(len(i)) }));

describe('waveBars', () => {
  it('makes min(nBars, sections) bars covering every section exactly once', () => {
    for (const [n, bars] of [[448, 40], [16, 28], [40, 40], [41, 40]]) {
      const out = waveBars(secs(n), new Set(), bars);
      expect(out).toHaveLength(Math.min(n, bars));
      expect(out[0].from).toBe(0);
      expect(out.at(-1).to).toBe(n);
      for (let k = 1; k < out.length; k++) expect(out[k].from).toBe(out[k - 1].to);
      for (const b of out) expect(b.to).toBeGreaterThan(b.from);
    }
  });

  it('heights run 0.16–1, the longest stretch at 1', () => {
    const out = waveBars(secs(10, (i) => (i === 7 ? 900 : 100)), new Set(), 10);
    expect(Math.max(...out.map(b => b.height))).toBe(1);
    expect(out[7].height).toBe(1);
    for (const b of out) {
      expect(b.height).toBeGreaterThanOrEqual(0.16);
      expect(b.height).toBeLessThanOrEqual(1);
    }
  });

  it('reports the share heard in each bar', () => {
    const out = waveBars(secs(8), new Set(['s0', 's1', 's2']), 4);
    expect(out.map(b => b.heard)).toEqual([1, 0.5, 0, 0]);
  });

  it('opacity is zero until something is heard', () => {
    expect(barOpacity(0)).toBe(0);
    expect(barOpacity(1)).toBeCloseTo(1);
    expect(barOpacity(0.5)).toBeCloseTo(0.675);
  });
});

describe('queueBars', () => {
  it('one bar per section, marking done and now', () => {
    const out = queueBars([100, 400, 100], 1, false);
    expect(out.map(b => b.state)).toEqual(['done', 'now', '']);
    expect(out[1].height).toBe(1);
  });

  it('a finished queue is all done', () => {
    expect(queueBars([1, 2, 3], 2, true).map(b => b.state)).toEqual(['done', 'done', 'done']);
  });

  it('groups a long queue into 40 bars', () => {
    const out = queueBars(Array(120).fill(50), 61, false);
    expect(out).toHaveLength(40);
    expect(out.filter(b => b.state === 'now')).toHaveLength(1);
    expect(out[20].state).toBe('now');
    expect(out[19].state).toBe('done');
  });
});
