import { describe, it, expect } from 'vitest';
import { okPayload, errorPayload, purchaseEntry, ERROR_CODES } from './protocol.js';

const NOW = Date.parse('2026-08-05T00:00:00Z');

describe('purchaseEntry', () => {
  it('marks a future expiry as active', () => {
    const e = purchaseEntry({
      id: 'pro_monthly', transactionId: '1', purchaseDateMs: 1, expiryDateMs: NOW + 1000, now: NOW,
    });
    expect(e.isExpired).toBe(false);
    expect(e.expiryDate).toBe(NOW + 1000);
  });

  it('marks a past expiry as expired — this is the whole point of the validator', () => {
    // VerifiedReceipts.isOwned returns false on isExpired, which is how a
    // lapsed monthly subscriber finally loses Pro.
    const e = purchaseEntry({
      id: 'pro_monthly', transactionId: '1', purchaseDateMs: 1, expiryDateMs: NOW - 1, now: NOW,
    });
    expect(e.isExpired).toBe(true);
  });

  it('treats an exact tie as expired, never as a free extra millisecond', () => {
    const e = purchaseEntry({
      id: 'pro_monthly', transactionId: '1', purchaseDateMs: 1, expiryDateMs: NOW, now: NOW,
    });
    expect(e.isExpired).toBe(true);
  });

  it('omits expiryDate entirely when there is none, rather than sending 0', () => {
    // The plugin reads `if (purchase.expiryDate)` — a 0 would silently mean
    // "no expiry known" and grant permanent Pro. undefined is the honest value.
    const e = purchaseEntry({ id: 'x', transactionId: '1', purchaseDateMs: 1, expiryDateMs: undefined, now: NOW });
    expect('expiryDate' in e).toBe(false);
    expect(e.isExpired).toBe(false);
  });
});

describe('okPayload', () => {
  it('shapes the response the plugin parses', () => {
    const p = okPayload({ id: 'com.lawcodev2.app', transactionType: 'ios-appstore', collection: [] });
    expect(p).toEqual({
      ok: true,
      data: {
        id: 'com.lawcodev2.app',
        latest_receipt: true,
        transaction: { type: 'ios-appstore' },
        collection: [],
      },
    });
  });
});

describe('errorPayload', () => {
  it('never claims ok on an error', () => {
    const p = errorPayload(ERROR_CODES.COMMUNICATION, 'apple unreachable');
    expect(p.ok).toBe(false);
    expect(p.code).toBe(6777014);
    expect(p.message).toBe('apple unreachable');
  });
});
