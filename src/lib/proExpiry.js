// Offline enforcement of a subscription that the validator has already dated.
//
// store.owned() needs the validator to have answered, which needs the network.
// Offline, initialize() never completes and Pro correctly stays standing —
// right for a subscriber on a plane, wrong for someone who cancelled months
// ago and now runs the app offline forever. The last verified expiry closes
// that hole without ever guessing.

/**
 * Apple's billing-retry window can land a renewal days after the nominal
 * expiry. Revoking a subscriber whose card merely needed a retry is far worse
 * than granting a few extra free days, so the cached date is only trusted
 * once it is this stale.
 */
export const PRO_EXPIRY_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * @returns {'active'|'lapsed'|'unknown'} 'unknown' means "no opinion" — the
 *   caller must leave the persisted flag exactly as it found it.
 */
export function expiryVerdict({ expiresAt, now, graceMs = PRO_EXPIRY_GRACE_MS }) {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return 'unknown';
  return now <= expiresAt + graceMs ? 'active' : 'lapsed';
}

/**
 * Whether the cached expiry should revoke Pro on launch. Downgrade-only: this
 * is the offline/rollback enforcement path, so it fires ONLY when a validator
 * is actually configured. With RECEIPT_VALIDATOR_URL='' (the rollback switch,
 * and the pre-deploy state) `validatorConfigured` is false and this always
 * returns false — the app then never revokes on a cached date, exactly like
 * build 64. A stale cached expiry left behind by a previous validator build
 * must not cut a subscriber once the validator is switched off.
 */
export function shouldRevokeForCachedExpiry({ isPro, validatorConfigured, expiresAt, now, graceMs }) {
  if (!isPro) return false;
  if (!validatorConfigured) return false;
  return expiryVerdict({ expiresAt, now, graceMs }) === 'lapsed';
}
