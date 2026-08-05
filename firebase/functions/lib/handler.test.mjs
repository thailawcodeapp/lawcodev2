import { describe, it, expect, vi } from 'vitest';
import { handleValidation } from './handler.js';

const NOW = Date.parse('2026-08-05T00:00:00Z');
const OK = { ok: true, data: { id: 'x', latest_receipt: true, transaction: { type: 't' }, collection: [] } };

const deps = () => ({
  validateApple: vi.fn(async () => OK),
  validateGoogle: vi.fn(async () => OK),
  now: NOW,
});

describe('handleValidation', () => {
  it('routes an ios-appstore body to Apple with the receipt and bundle id', async () => {
    const d = deps();
    await handleValidation({
      id: 'com.lawcodev2.app', type: 'application',
      transaction: { type: 'ios-appstore', id: '200', appStoreReceipt: 'BASE64' },
    }, d);
    expect(d.validateApple).toHaveBeenCalledWith({
      appStoreReceipt: 'BASE64', bundleId: 'com.lawcodev2.app', now: NOW,
    });
    expect(d.validateGoogle).not.toHaveBeenCalled();
  });

  it('routes an android-playstore body to Google with the purchase token', async () => {
    const d = deps();
    await handleValidation({
      id: 'pro_yearly', type: 'paid subscription',
      transaction: { type: 'android-playstore', id: 'GPA.1', purchaseToken: 'TOKEN' },
    }, d);
    expect(d.validateGoogle).toHaveBeenCalledWith({
      productId: 'pro_yearly', purchaseToken: 'TOKEN', now: NOW,
    });
    expect(d.validateApple).not.toHaveBeenCalled();
  });

  it('rejects an iOS body with no receipt instead of calling Apple with undefined', async () => {
    const d = deps();
    const payload = await handleValidation({
      id: 'com.lawcodev2.app', transaction: { type: 'ios-appstore' },
    }, d);
    expect(payload.ok).toBe(false);
    expect(d.validateApple).not.toHaveBeenCalled();
  });

  it('rejects an unknown platform rather than defaulting to one', async () => {
    const d = deps();
    const payload = await handleValidation({ id: 'x', transaction: { type: 'braintree' } }, d);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe(6777018);
  });

  it('rejects a body with no transaction at all', async () => {
    const payload = await handleValidation({ id: 'x' }, deps());
    expect(payload.ok).toBe(false);
  });

  it('passes the validator payload straight through', async () => {
    const d = deps();
    const payload = await handleValidation({
      id: 'com.lawcodev2.app', transaction: { type: 'ios-appstore', appStoreReceipt: 'B' },
    }, d);
    expect(payload).toBe(OK);
  });
});
