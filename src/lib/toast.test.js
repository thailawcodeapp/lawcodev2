import { describe, expect, it } from 'vitest';
import { showToast, subscribeToast } from './toast.js';

describe('toast', () => {
  it('a plain call still delivers just the message', () => {
    const got = [];
    const off = subscribeToast((...args) => got.push(args));
    showToast('สวัสดี');
    off();
    expect(got).toEqual([['สวัสดี', undefined]]);
  });

  it('passes an action through', () => {
    const got = [];
    const off = subscribeToast((m, o) => got.push(o?.action?.label));
    showToast('เพิ่มแล้ว', { action: { label: 'เลิกทำ', onPress: () => {} } });
    off();
    expect(got).toEqual(['เลิกทำ']);
  });

  it('ignores an empty message', () => {
    let calls = 0;
    const off = subscribeToast(() => { calls++; });
    showToast('');
    off();
    expect(calls).toBe(0);
  });
});
