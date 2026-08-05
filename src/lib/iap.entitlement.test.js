import { describe, it, expect } from 'vitest';
import { entitlementUpdate } from './iap';

// The rule that keeps a paid subscriber from being dropped on every restart.
// store.owned() is not authoritative on a cold start — it reads false until an
// explicit restore populates it — so an automatic signal may only ever
// upgrade, never downgrade. Revoking a genuine lapse is a separate,
// authoritative job (server-side check or explicit restore), not this.
describe('entitlementUpdate', () => {
  it('upgrades when the store reports the product owned', () => {
    expect(entitlementUpdate(true)).toBe(true);
  });

  it('says nothing when owned reads false — it cannot be trusted at launch', () => {
    // This is the bug that dropped Pro on every restart: owned() is false in
    // the cold-start window before restore, and reporting it wiped the
    // persisted entitlement. null leaves the persisted flag standing.
    expect(entitlementUpdate(false)).toBe(null);
  });

  it('never returns a downgrade from an automatic signal', () => {
    // The contract the whole fix rests on: no input produces false.
    expect(entitlementUpdate(true)).not.toBe(false);
    expect(entitlementUpdate(false)).not.toBe(false);
  });
});
