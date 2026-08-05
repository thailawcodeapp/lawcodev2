import { describe, it, expect, vi } from 'vitest';
import { validateApple, APPLE_PRODUCTION_URL, APPLE_SANDBOX_URL } from './apple.js';

const NOW = Date.parse('2026-08-05T00:00:00Z');

const jsonResponse = (body) => ({ ok: true, json: async () => body });

const receiptInfo = (overrides = {}) => ({
  product_id: 'com.lawcodev2.app.pro_monthly',
  original_transaction_id: '2000000111',
  purchase_date_ms: String(NOW - 86400000),
  expires_date_ms: String(NOW + 86400000),
  ...overrides,
});

const call = (fetchImpl) => validateApple({
  appStoreReceipt: 'BASE64', bundleId: 'com.lawcodev2.app',
  sharedSecret: 'SECRET', now: NOW, fetchImpl,
});

describe('validateApple', () => {
  it('reports an active subscription with its real expiry', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 0, latest_receipt_info: [receiptInfo()] }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(true);
    expect(payload.data.collection).toEqual([{
      id: 'com.lawcodev2.app.pro_monthly',
      transactionId: '2000000111',
      purchaseDate: NOW - 86400000,
      isExpired: false,
      expiryDate: NOW + 86400000,
    }]);
  });

  it('reports a lapsed subscription as expired', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0, latest_receipt_info: [receiptInfo({ expires_date_ms: String(NOW - 1) })],
    }));
    const payload = await call(fetchImpl);
    expect(payload.data.collection[0].isExpired).toBe(true);
  });

  it('keeps only the newest renewal per product', async () => {
    // latest_receipt_info holds every renewal ever. Emitting all of them would
    // put an expired older entry in the collection, and VerifiedReceipts.find
    // picks by purchaseDate — a stale pick would revoke a paying subscriber.
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0,
      latest_receipt_info: [
        receiptInfo({ purchase_date_ms: String(NOW - 5000000), expires_date_ms: String(NOW - 4000000) }),
        receiptInfo({ purchase_date_ms: String(NOW - 1000), expires_date_ms: String(NOW + 86400000) }),
      ],
    }));
    const payload = await call(fetchImpl);
    expect(payload.data.collection).toHaveLength(1);
    expect(payload.data.collection[0].isExpired).toBe(false);
  });

  it('retries against sandbox on status 21007 — every TestFlight build hits this', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 21007 }))
      .mockResolvedValueOnce(jsonResponse({ status: 0, latest_receipt_info: [receiptInfo()] }));
    const payload = await call(fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe(APPLE_PRODUCTION_URL);
    expect(fetchImpl.mock.calls[1][0]).toBe(APPLE_SANDBOX_URL);
    expect(payload.ok).toBe(true);
  });

  it('sends the shared secret and asks for the latest transactions only', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 0, latest_receipt_info: [] }));
    await call(fetchImpl);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body['receipt-data']).toBe('BASE64');
    expect(body.password).toBe('SECRET');
    expect(body['exclude-old-transactions']).toBe(true);
  });

  it('succeeds with an empty collection when the user never subscribed', async () => {
    // A free user's app receipt is valid and has no latest_receipt_info. That
    // is an authoritative "not Pro", not an error — it must return ok so the
    // client downgrades instead of holding a stale flag.
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 0 }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(true);
    expect(payload.data.collection).toEqual([]);
  });

  it('errors — never silently succeeds — on a non-zero Apple status', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 21002 }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain('21002');
  });

  it('errors when Apple is unreachable, so the client keeps its cached state', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ETIMEDOUT'); });
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777014);
  });
});
