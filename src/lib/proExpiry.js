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
