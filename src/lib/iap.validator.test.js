import { describe, it, expect, vi } from 'vitest';
import { verifyLocalReceipts } from './iap';

describe('verifyLocalReceipts', () => {
  it('asks the plugin to validate every local receipt', () => {
    // On iOS the app receipt exists on disk with zero transactions attached.
    // Nothing in the plugin validates it on its own, so a cold start would
    // never learn the expiry unless we ask here.
    const a = { verify: vi.fn() };
    const b = { verify: vi.fn() };
    verifyLocalReceipts({ localReceipts: [a, b] });
    expect(a.verify).toHaveBeenCalledTimes(1);
    expect(b.verify).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the store has no receipts', () => {
    expect(() => verifyLocalReceipts({ localReceipts: [] })).not.toThrow();
  });

  it('survives a store that is missing or still loading', () => {
    expect(() => verifyLocalReceipts(null)).not.toThrow();
    expect(() => verifyLocalReceipts({})).not.toThrow();
  });

  it('does not let one failing receipt stop the others', () => {
    // A pseudo-receipt can throw on verify(); the app receipt after it is the
    // one that actually carries the subscription.
    const bad = { verify: vi.fn(() => { throw new Error('nope'); }) };
    const good = { verify: vi.fn() };
    verifyLocalReceipts({ localReceipts: [bad, good] });
    expect(good.verify).toHaveBeenCalledTimes(1);
  });
});
