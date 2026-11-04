import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLongPress, LONG_PRESS_MS } from './longPress';

let onTap, onLongPress, h;
beforeEach(() => {
  vi.useFakeTimers();
  onTap = vi.fn();
  onLongPress = vi.fn();
  h = createLongPress({ onTap, onLongPress });
});
afterEach(() => { vi.useRealTimers(); });

describe('createLongPress', () => {
  it('a quick tap runs onTap only', () => {
    h.onPointerDown();
    vi.advanceTimersByTime(100);
    h.onPointerUp();
    h.onClick();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('holding past the delay runs onLongPress and swallows the release click', () => {
    h.onPointerDown();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    h.onPointerUp();
    h.onClick();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('contextmenu counts as a long press, once, even if the timer also fires', () => {
    const preventDefault = vi.fn();
    h.onPointerDown();
    vi.advanceTimersByTime(LONG_PRESS_MS - 100);
    h.onContextMenu({ preventDefault });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('pointercancel before the delay stops the timer but a later contextmenu still counts', () => {
    h.onPointerDown();
    h.onPointerCancel();
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(onLongPress).not.toHaveBeenCalled();
    h.onContextMenu({});
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('a long press whose click never arrives does not swallow the next tap', () => {
    h.onPointerDown();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    h.onPointerUp(); // no click after the long press
    h.onPointerDown();
    h.onPointerUp();
    h.onClick();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('sliding off the button cancels the long press', () => {
    h.onPointerDown();
    h.onPointerLeave();
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
