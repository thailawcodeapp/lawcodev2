import { describe, it, expect } from 'vitest';
import { expiryVerdict, PRO_EXPIRY_GRACE_MS, shouldRevokeForCachedExpiry } from './proExpiry';

const NOW = Date.parse('2026-08-05T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('expiryVerdict', () => {
  it('says active while the cached expiry is in the future', () => {
    expect(expiryVerdict({ expiresAt: NOW + DAY, now: NOW })).toBe('active');
  });

  it('says unknown when nothing has ever been cached', () => {
    // Never seen a validator answer: this must not revoke anyone. It is the
    // state every user is in on the build that first ships validation.
    expect(expiryVerdict({ expiresAt: null, now: NOW })).toBe('unknown');
    expect(expiryVerdict({ expiresAt: undefined, now: NOW })).toBe('unknown');
  });

  it('stays active through the grace period after the nominal expiry', () => {
    // Apple's billing retry can land a renewal days late. Cutting at the
    // nominal date would revoke a subscriber whose card just needed a retry.
    expect(expiryVerdict({ expiresAt: NOW - DAY, now: NOW })).toBe('active');
  });

  it('says lapsed once the grace period is exhausted', () => {
    expect(expiryVerdict({ expiresAt: NOW - PRO_EXPIRY_GRACE_MS - 1, now: NOW })).toBe('lapsed');
  });

  it('uses a grace period of at least three days', () => {
    expect(PRO_EXPIRY_GRACE_MS).toBeGreaterThanOrEqual(3 * DAY);
  });

  it('honours an explicit graceMs over the default', () => {
    expect(expiryVerdict({ expiresAt: NOW - 1, now: NOW, graceMs: 0 })).toBe('lapsed');
  });

  it('treats a nonsense cached value as unknown rather than lapsed', () => {
    // A corrupted or half-written localStorage value must not revoke Pro.
    expect(expiryVerdict({ expiresAt: NaN, now: NOW })).toBe('unknown');
    expect(expiryVerdict({ expiresAt: 'soon', now: NOW })).toBe('unknown');
  });
});

describe('shouldRevokeForCachedExpiry', () => {
  const lapsedExpiresAt = NOW - PRO_EXPIRY_GRACE_MS - DAY;

  it('never revokes when the user is not Pro', () => {
    expect(shouldRevokeForCachedExpiry({
      isPro: false, validatorConfigured: true, expiresAt: lapsedExpiresAt, now: NOW,
    })).toBe(false);
    expect(shouldRevokeForCachedExpiry({
      isPro: false, validatorConfigured: false, expiresAt: null, now: NOW,
    })).toBe(false);
  });

  it('rollback invariant: a lapsed cached expiry never revokes when no validator is configured', () => {
    // This is the RECEIPT_VALIDATOR_URL='' rollback switch. A stale cached
    // expiry left behind by a previous validator build must not cut a
    // subscriber once the validator is switched off — exactly build 64.
    expect(shouldRevokeForCachedExpiry({
      isPro: true, validatorConfigured: false, expiresAt: lapsedExpiresAt, now: NOW,
    })).toBe(false);
  });

  it('revokes a lapsed cached expiry once a validator is configured', () => {
    expect(shouldRevokeForCachedExpiry({
      isPro: true, validatorConfigured: true, expiresAt: lapsedExpiresAt, now: NOW,
    })).toBe(true);
  });

  it('does not revoke while the cached expiry is still active', () => {
    expect(shouldRevokeForCachedExpiry({
      isPro: true, validatorConfigured: true, expiresAt: NOW + DAY, now: NOW,
    })).toBe(false);
  });

  it('does not revoke on an unknown (never-cached) expiry', () => {
    expect(shouldRevokeForCachedExpiry({
      isPro: true, validatorConfigured: true, expiresAt: null, now: NOW,
    })).toBe(false);
  });
});
