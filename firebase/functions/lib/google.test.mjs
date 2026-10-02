import { describe, it, expect, vi } from 'vitest';
import { validateGoogle } from './google.js';

const NOW = Date.parse('2026-08-05T00:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

const call = (subscriptionsV2) => validateGoogle({
  productId: 'pro_yearly', purchaseToken: 'TOKEN',
  packageName: 'com.lawcodev2.app', now: NOW, subscriptionsV2,
});

const okClient = (data) => ({ get: vi.fn(async () => ({ data })) });

describe('validateGoogle', () => {
  it('reports an active subscription with its real expiry', async () => {
    const client = okClient({
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      latestOrderId: 'GPA.1',
      startTime: iso(NOW - 86400000),
      lineItems: [{ productId: 'pro_yearly', expiryTime: iso(NOW + 86400000) }],
    });
    const payload = await call(client);
    expect(payload.ok).toBe(true);
    expect(payload.data.collection).toEqual([{
      id: 'pro_yearly',
      transactionId: 'GPA.1',
      purchaseDate: NOW - 86400000,
      isExpired: false,
      expiryDate: NOW + 86400000,
    }]);
  });

  it('passes the package name and token Google needs', async () => {
    const client = okClient({ lineItems: [] });
    await call(client);
    expect(client.get).toHaveBeenCalledWith({ packageName: 'com.lawcodev2.app', token: 'TOKEN' });
  });

  it('reports a lapsed subscription as expired', async () => {
    const client = okClient({
      latestOrderId: 'GPA.1', startTime: iso(NOW - 86400000),
      lineItems: [{ productId: 'pro_yearly', expiryTime: iso(NOW - 1) }],
    });
    const payload = await call(client);
    expect(payload.data.collection[0].isExpired).toBe(true);
  });

  it('reports a subscription Google says is canceled but still paid-through as active', async () => {
    // "Canceled" means auto-renew is off, not that access ended. Cutting here
    // would revoke someone who paid through the end of the period.
    const client = okClient({
      subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
      latestOrderId: 'GPA.1', startTime: iso(NOW - 86400000),
      lineItems: [{ productId: 'pro_yearly', expiryTime: iso(NOW + 86400000) }],
    });
    const payload = await call(client);
    expect(payload.data.collection[0].isExpired).toBe(false);
  });

  it('errors when Google is unreachable, so the client keeps its cached state', async () => {
    const client = { get: vi.fn(async () => { throw new Error('ECONNRESET'); }) };
    const payload = await call(client);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777014);
  });

  it('succeeds with an empty collection when there are no line items', async () => {
    const payload = await call(okClient({ lineItems: [] }));
    expect(payload.ok).toBe(true);
    expect(payload.data.collection).toEqual([]);
  });

  it('errors instead of granting permanent Pro when a line item has an unparseable expiryTime', async () => {
    // expiryTime present but unreadable must NOT fall through to "no expiry
    // known" (which purchaseEntry/the plugin treat as owned forever). That
    // would silently grant permanent Pro from bad data. Match apple.js: fail
    // verification so the client keeps whatever entitlement it already has.
    const client = okClient({
      latestOrderId: 'GPA.1', startTime: iso(NOW - 86400000),
      lineItems: [{ productId: 'pro_yearly', expiryTime: 'not-a-date' }],
    });
    const payload = await call(client);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777017);
  });
});
