import { describe, expect, it } from 'vitest';
import { pushBack, runBack } from './backStack.js';

describe('back stack', () => {
  it('declines when nothing is registered', () => {
    expect(runBack()).toBe(false);
  });

  it('asks the newest handler first and stops at the one that handles it', () => {
    const calls = [];
    const offA = pushBack(() => { calls.push('a'); return true; });
    const offB = pushBack(() => { calls.push('b'); return false; });
    expect(runBack()).toBe(true);
    expect(calls).toEqual(['b', 'a']);
    offA(); offB();
  });

  it('forgets a handler once unregistered', () => {
    const off = pushBack(() => true);
    off();
    expect(runBack()).toBe(false);
  });
});
