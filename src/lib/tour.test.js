import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TOUR_KEY, TOUR_STEPS, hasSeen, markSeen, shouldAutoShow, toLocalRect, clipRect,
  placeCard, startTour, closeTour, isTourOpen, subscribeTour, _setTourStorage, nextRecall,
} from './tour';

describe('nextRecall', () => {
  it('sets a mark, switches between marks, and clears on a second tap of the same one', () => {
    expect(nextRecall(null, 'forgotten')).toBe('forgotten');
    expect(nextRecall('remembered', 'forgotten')).toBe('forgotten');
    expect(nextRecall('forgotten', 'forgotten')).toBe(null);
    expect(nextRecall('forgotten', 'remembered')).toBe('remembered');
  });
});

describe('recall steps', () => {
  it('teaches ✓/✗ at the สถิติ tab, then shows where จำไม่ได้ sections land', () => {
    expect(TOUR_STEPS.map(s => s.id).slice(-2)).toEqual(['recall', 'forgotten']);
    expect(TOUR_STEPS.find(s => s.id === 'recall')).toMatchObject({ target: 'tab-stats', mock: 'recall' });
    expect(TOUR_STEPS.find(s => s.id === 'forgotten').target).toBe('folder-forgotten');
  });
});

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

describe('shouldAutoShow', () => {
  const ok = { seen: false, pathname: '/', dataReady: true, blocking: false };

  it('opens for anyone who has not seen it, on the home screen, once data is ready', () => {
    expect(shouldAutoShow(ok)).toBe(true);
  });

  it('stays closed if any condition fails', () => {
    expect(shouldAutoShow({ ...ok, seen: true })).toBe(false);
    expect(shouldAutoShow({ ...ok, pathname: '/select' })).toBe(false);
    expect(shouldAutoShow({ ...ok, dataReady: false })).toBe(false);
    expect(shouldAutoShow({ ...ok, blocking: true })).toBe(false);
  });

  it('treats an unknown value as not ready rather than guessing', () => {
    expect(shouldAutoShow({ ...ok, seen: undefined })).toBe(false);
    expect(shouldAutoShow({ ...ok, dataReady: undefined })).toBe(false);
  });
});

describe('hasSeen / markSeen', () => {
  it('round-trips through storage', () => {
    const s = fakeStorage();
    expect(hasSeen(s)).toBe(false);
    markSeen(s);
    expect(hasSeen(s)).toBe(true);
    expect(s.getItem(TOUR_KEY)).toBe('1');
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(hasSeen(broken)).toBe(false);
    expect(() => markSeen(broken)).not.toThrow();
  });
});

describe('toLocalRect', () => {
  it('is identity with no offset and no zoom', () => {
    const r = { top: 10, left: 20, width: 30, height: 40 };
    expect(toLocalRect(r, { top: 0, left: 0 }, 1)).toEqual(r);
  });

  it('undoes the shell offset and scale', () => {
    // Shell scaled 1.2x and pushed down 60px by the top ad banner.
    const r = { top: 60 + 120, left: 24, width: 120, height: 60 };
    expect(toLocalRect(r, { top: 60, left: 0 }, 1.2)).toEqual({ top: 100, left: 20, width: 100, height: 50 });
  });
});

describe('clipRect', () => {
  it('caps a tall target so the card has room', () => {
    expect(clipRect({ top: 0, left: 0, width: 10, height: 600 }, 250).height).toBe(250);
  });

  it('leaves short targets and unclipped steps alone', () => {
    const r = { top: 0, left: 0, width: 10, height: 100 };
    expect(clipRect(r, 250)).toBe(r);
    expect(clipRect(r, undefined)).toBe(r);
    expect(clipRect(null, 250)).toBe(null);
  });
});

describe('placeCard', () => {
  const vp = { width: 390, height: 800 };
  const card = { width: 300, height: 180 };

  it('goes below a target near the top', () => {
    const p = placeCard({ top: 100, left: 0, width: 200, height: 250 }, card, vp);
    expect(p.side).toBe('below');
    expect(p.top).toBe(362);
  });

  it('goes above a target at the bottom, like the tab bar', () => {
    const p = placeCard({ top: 740, left: 78, width: 78, height: 50 }, card, vp);
    expect(p.side).toBe('above');
    expect(p.top).toBe(740 - 12 - 180);
  });

  it('never runs off either side of the screen', () => {
    expect(placeCard({ top: 740, left: 0, width: 40, height: 50 }, card, vp).left).toBe(12);
    expect(placeCard({ top: 740, left: 360, width: 30, height: 50 }, card, vp).left).toBe(390 - 300 - 12);
  });

  it('stays on screen even when neither side has room', () => {
    const p = placeCard({ top: 20, left: 0, width: 390, height: 760 }, card, vp);
    expect(p.top).toBeGreaterThanOrEqual(12);
    expect(p.top + card.height).toBeLessThanOrEqual(vp.height - 12);
  });
});

describe('open/close store', () => {
  let storage;
  beforeEach(() => { storage = fakeStorage(); _setTourStorage(storage); });
  afterEach(() => { closeTour(); _setTourStorage(null); });

  it('notifies subscribers and marks the tour seen on close', () => {
    let calls = 0;
    const unsub = subscribeTour(() => { calls++; });
    startTour();
    expect(isTourOpen()).toBe(true);
    closeTour();
    expect(isTourOpen()).toBe(false);
    expect(hasSeen(storage)).toBe(true);
    expect(calls).toBe(2);
    unsub();
  });

  it('does not mark seen when closing a tour that was never open', () => {
    closeTour();
    expect(hasSeen(storage)).toBe(false);
  });

  it('ignores a second start while already open', () => {
    let calls = 0;
    const unsub = subscribeTour(() => { calls++; });
    startTour();
    startTour();
    expect(calls).toBe(1);
    unsub();
  });
});

describe('TOUR_STEPS', () => {
  it('starts on the home screen at the เลือกฟัง tab, then moves to the select screen', () => {
    expect(TOUR_STEPS[0]).toMatchObject({ path: '/', target: 'tab-select' });
    expect(TOUR_STEPS.slice(1).every(s => s.path === '/select')).toBe(true);
  });

  it('gives every step a target, title and text', () => {
    for (const s of TOUR_STEPS) {
      expect(s.target).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.text).toBeTruthy();
    }
  });
});
