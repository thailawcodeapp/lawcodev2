import { describe, it, expect } from 'vitest';
import { entitlementUpdate, verificationIsTrustworthy, playReportsNotOwned } from './iap';

// Three-way decision. `verified` means the receipt validator answered
// successfully for this receipt — the only authoritative signal the client
// has. Without it, store.owned() reading false is indistinguishable from
// "the receipt has not loaded yet", which is the bug that dropped Pro on
// every restart through build 63.
describe('entitlementUpdate', () => {
  it('upgrades when the store reports the product owned', () => {
    expect(entitlementUpdate({ owned: true, verified: false })).toBe(true);
  });

  it('says nothing when owned reads false and nothing was verified', () => {
    // Cold start before any validation: leave the persisted flag standing.
    expect(entitlementUpdate({ owned: false, verified: false })).toBe(null);
  });

  it('downgrades when the validator answered and says the user does not own it', () => {
    // This is the case build 64 could not express, and the reason a lapsed
    // monthly subscriber used to keep Pro forever.
    expect(entitlementUpdate({ owned: false, verified: true })).toBe(false);
  });

  it('still upgrades when the validator answered and says owned', () => {
    expect(entitlementUpdate({ owned: true, verified: true })).toBe(true);
  });

  it('never downgrades on an unverified signal, whatever else is true', () => {
    expect(entitlementUpdate({ owned: false, verified: false })).not.toBe(false);
    expect(entitlementUpdate({ owned: true, verified: false })).not.toBe(false);
  });

  it('treats a missing argument as "nothing to say" rather than a downgrade', () => {
    // initialize().then(applyOwned) can fire before any verification exists.
    expect(entitlementUpdate({})).toBe(null);
  });
});

// `verificationIsTrustworthy` gates the `hasVerified` latch in initIAP. The
// plugin auto-fires `.verified()` with a fabricated ok:true payload (and an
// EMPTY collection) when no validator is configured (store.js:621) — a
// backward-compatibility path, not a real answer. Latching on that event
// would let the fabricated payload license a downgrade of a real subscriber.
describe('verificationIsTrustworthy', () => {
  it('is trustworthy when the store has a validator configured', () => {
    expect(verificationIsTrustworthy({ validator: 'https://x' })).toBe(true);
  });

  it('is not trustworthy when the store has no validator (fabricated-verify state)', () => {
    expect(verificationIsTrustworthy({})).toBe(false);
  });

  it('is not trustworthy when the store is null', () => {
    expect(verificationIsTrustworthy(null)).toBe(false);
  });

  it('is not trustworthy when the store is undefined', () => {
    expect(verificationIsTrustworthy(undefined)).toBe(false);
  });
});

// `playReportsNotOwned` reads Google Play's own purchase list, which the
// plugin only hands over after queryPurchasesAsync answered OK. A refund with
// revoke, or a chargeback, drops the purchase from that list — the plugin
// then marks the local receipt CANCELLED and fires nothing, while
// store.owned() keeps reading the stale verified receipt as active.
describe('playReportsNotOwned', () => {
  const IDS = ['pro_yearly'];
  const receipt = (state, id = 'pro_yearly', platform = 'android-playstore') => ({
    platform,
    transactions: [{ state, products: [{ id }] }],
  });

  it('is true when Play returned no purchases at all', () => {
    expect(playReportsNotOwned([], IDS)).toBe(true);
  });

  it('is true when the only Pro purchase was removed by Play (refund or chargeback)', () => {
    expect(playReportsNotOwned([receipt('cancelled')], IDS)).toBe(true);
  });

  it('is false while Play still lists an active Pro purchase', () => {
    expect(playReportsNotOwned([receipt('finished')], IDS)).toBe(false);
    expect(playReportsNotOwned([receipt('approved')], IDS)).toBe(false);
  });

  it('is false while a Pro purchase is still pending payment', () => {
    expect(playReportsNotOwned([receipt('initiated')], IDS)).toBe(false);
  });

  it('ignores purchases of other products', () => {
    expect(playReportsNotOwned([receipt('finished', 'something_else')], IDS)).toBe(true);
  });

  it('ignores receipts from another platform', () => {
    expect(playReportsNotOwned([receipt('finished', 'pro_yearly', 'ios-appstore')], IDS)).toBe(true);
  });

  it('says nothing (false) when the receipt list is missing', () => {
    // No list means Play never answered — never a reason to revoke.
    expect(playReportsNotOwned(undefined, IDS)).toBe(false);
    expect(playReportsNotOwned(null, IDS)).toBe(false);
  });
});
