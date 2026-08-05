import { describe, it, expect, vi } from 'vitest';
import { verifyLocalReceipts, proExpiryFromReceipts } from './iap';

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

describe('proExpiryFromReceipts', () => {
  const receipt = (collection) => ({ collection });

  it('returns the latest expiry across our products', () => {
    const store = { verifiedReceipts: [
      receipt([{ id: 'com.lawcodev2.app.pro_monthly', expiryDate: 100 }]),
      receipt([{ id: 'com.lawcodev2.app.pro_yearly', expiryDate: 900 }]),
    ] };
    expect(proExpiryFromReceipts(store)).toBe(900);
  });

  it('ignores products that are not ours', () => {
    const store = { verifiedReceipts: [receipt([{ id: 'some_other_app_thing', expiryDate: 999 }])] };
    expect(proExpiryFromReceipts(store)).toBe(null);
  });

  it('returns null when nothing has been verified', () => {
    expect(proExpiryFromReceipts({ verifiedReceipts: [] })).toBe(null);
    expect(proExpiryFromReceipts(null)).toBe(null);
  });

  it('ignores an entry with no expiryDate rather than reading it as 0', () => {
    // A lifetime/non-subscription entry has no expiry. Treating it as 0 would
    // cache an epoch date and lapse the user instantly.
    const store = { verifiedReceipts: [receipt([{ id: 'pro_yearly' }])] };
    expect(proExpiryFromReceipts(store)).toBe(null);
  });

  it('ignores a literal expiryDate of 0 rather than reading it as a real date', () => {
    // The server never emits 0 (apple.js/google.js reject it), but the reader
    // should not trust a value that would make expiryVerdict(0) read 'lapsed'.
    const store = { verifiedReceipts: [receipt([{ id: 'pro_yearly', expiryDate: 0 }])] };
    expect(proExpiryFromReceipts(store)).toBe(null);
  });
});
