import { describe, it, expect } from 'vitest';
import { entitlementUpdate } from './iap';

// The rule that keeps a paid subscriber from being dropped on every restart
// while still revoking one whose subscription really lapsed. The two are told
// apart only by `settled` — whether the receipt has had time to load.
describe('entitlementUpdate', () => {
  it('upgrades whenever the receipt says owned, settled or not', () => {
    // A cold start with an active sub: report Pro the instant it is known,
    // without waiting out the settle delay.
    expect(entitlementUpdate(true, false)).toBe(true);
    expect(entitlementUpdate(true, true)).toBe(true);
  });

  it('says nothing about an unowned receipt before it has settled', () => {
    // This is the bug that dropped Pro on every launch: owned reads false in
    // the pre-load window, and reporting it wiped the persisted entitlement.
    // Now it returns null — leave the persisted flag standing.
    expect(entitlementUpdate(false, false)).toBe(null);
  });

  it('downgrades an unowned receipt once settled — a genuine lapse', () => {
    // The app sells a monthly plan; an expired subscriber must not keep Pro.
    // After the receipt has loaded, owned=false is authoritative.
    expect(entitlementUpdate(false, true)).toBe(false);
  });
});
