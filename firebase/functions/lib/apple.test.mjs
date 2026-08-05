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

  it('errors on an unparseable expires_date_ms instead of silently granting permanent Pro', async () => {
    // A present-but-garbage expiry must not omit expiryDate (that also falls
    // through to the consumer's `return true`) and must not become NaN (NaN
    // <= now is false, so isExpired would be false too). The only honest
    // answer is a validation error, which leaves the client's cached state
    // untouched.
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0, latest_receipt_info: [receiptInfo({ expires_date_ms: 'garbage' })],
    }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777017);
  });

  it('treats an unparseable purchase_date_ms as unknown rather than failing validation', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0, latest_receipt_info: [receiptInfo({ purchase_date_ms: 'garbage' })],
    }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(true);
    expect(payload.data.collection[0].purchaseDate).toBeUndefined();
  });

  it('does not let a NaN purchase date win the newest-per-product dedup', async () => {
    // Both NaN < x and NaN > x are false, so a naive `<` comparison against a
    // bad purchase_date_ms could keep the wrong entry either way depending on
    // iteration order. The entry with the garbage date arrives first here;
    // the well-dated, still-active entry must still win.
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0,
      latest_receipt_info: [
        receiptInfo({ purchase_date_ms: 'garbage', expires_date_ms: String(NOW - 4000000) }),
        receiptInfo({ purchase_date_ms: String(NOW - 1000), expires_date_ms: String(NOW + 86400000) }),
      ],
    }));
    const payload = await call(fetchImpl);
    expect(payload.data.collection).toHaveLength(1);
    expect(payload.data.collection[0].isExpired).toBe(false);
  });

  it('errors on expires_date_ms: 0 instead of treating epoch-0 as a real expiry', async () => {
    // parseMs(0) is finite, so a naive finite-check lets 0 through as
    // expiryDateMs, purchaseEntry sets expiryDate: 0, and the consumer's
    // `if (purchase.expiryDate)` treats falsy 0 as "no expiry" -> owned
    // forever. Epoch-0 is never a real Apple timestamp, so this must fail
    // validation like any other unparseable expiry.
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0, latest_receipt_info: [receiptInfo({ expires_date_ms: 0 })],
    }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777017);
  });

  it('errors on expires_date_ms: null instead of treating it as a real expiry', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      status: 0, latest_receipt_info: [receiptInfo({ expires_date_ms: null })],
    }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777017);
  });

  it('errors with COMMUNICATION when res.json() itself rejects', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => { throw new Error('bad JSON'); },
    }));
    const payload = await call(fetchImpl);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777014);
  });
});
