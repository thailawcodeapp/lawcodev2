# Receipt Validator (Firebase Function) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app an authoritative subscription expiry so a paying subscriber never loses Pro on restart and a genuinely lapsed subscriber is cut automatically.

**Architecture:** A Firebase Cloud Function speaks cordova-plugin-purchase's receipt-validator protocol. The app sets `store.validator` to its URL; the plugin then posts the platform receipt there on every receipt update. The function asks Apple (`verifyReceipt`) or Google (Play Developer API) for the real expiry date and answers with a `collection[]` carrying `expiryDate` / `isExpired`. Once a validator is configured the plugin stops trusting local receipts and switches to `VerifiedReceipts.isOwned`, which checks expiry — so `store.owned()` becomes trustworthy in **both** directions. The app also caches the verified expiry so an offline launch can enforce it locally instead of guessing.

**Tech Stack:** Firebase Cloud Functions v2 (Node 22, ESM), `googleapis` for the Play Developer API, Apple `verifyReceipt` HTTP endpoint, vitest (the repo's existing runner) for all pure logic.

## Global Constraints

- Push only to `cloud-sync`. **Never** push to `main`.
- **Never** modify `public/data/*.json`. **Never** hand-edit `src/data/audio-manifest.json`.
- Bump together, in one commit: `APP_VERSION_CODE` (`src/config.js`), `versionCode` (`android/app/build.gradle`), `CURRENT_PROJECT_VERSION` (`ios/App/App.xcodeproj/project.pbxproj`, **2 occurrences** — Debug and Release). `APP_VERSION_NAME` must equal gradle `versionName`.
- Secrets (Apple shared secret, Play service-account JSON) are set by the **owner only**, via `firebase functions:secrets:set`. Never print them, never write them to a file in the repo — this repo is pushed to GitHub.
- `GoogleService-Info.plist` stays gitignored.
- No `window.confirm()` / `window.alert()` — use `ConfirmDialog`.
- No hard-coded hex for rules/dividers — use `var(--rule-hair)`, `var(--rule-strong)`, `var(--row-alt)`.
- Every new button needs `.tap-row` (paper rows) or `.tap-btn` (buttons/dark surfaces); Tailwind is `hoverOnlyWhenSupported`.
- Tap targets under 44px need `.hit-44`, except adjacent buttons doing different things.
- Never `key={index}` on lists that swap content in place.
- No `requestAnimationFrame` for mount animation — use CSS `@keyframes`.
- Reuse `BottomSheet.jsx`, `ConfirmDialog.jsx`, `ProGateModal.jsx`, `showToast()` from `lib/toast.js`, `lib/tapFeedback.js`.
- Firebase project is `juris-voice`; region is `asia-southeast1` (`FIREBASE_REGION` in `src/config.js`).
- Every test added must be proven by mutation: break the implementation, confirm the test fails, restore it.

---

## Reference: the two contracts this plan sits between

**Request body** the plugin POSTs (from `node_modules/cordova-plugin-purchase/src/ts/validator/validator-request.ts`):

```jsonc
// iOS (StoreKit 1 — what this app runs; there is no SK2 bridge installed)
{
  "id": "com.lawcodev2.app",          // bundle id, because type is "application"
  "type": "application",
  "transaction": {
    "type": "ios-appstore",
    "id": "2000000123456789",          // undefined on a cold start with no transactions
    "appStoreReceipt": "<base64>"      // read from disk, no network, no sign-in prompt
  }
}

// Android
{
  "id": "pro_yearly",
  "type": "paid subscription",
  "transaction": {
    "type": "android-playstore",
    "id": "GPA.1234-5678-9012-34567",
    "purchaseToken": "<token>",
    "receipt": "{\"productId\":\"pro_yearly\",...}",
    "signature": "<sig>"
  }
}
```

**Success response** the plugin expects (from `validator-response.ts` + `verified-receipt.ts`):

```jsonc
{
  "ok": true,
  "data": {
    "id": "com.lawcodev2.app",
    "latest_receipt": true,
    "transaction": { "type": "ios-appstore" },
    "collection": [
      {
        "id": "com.lawcodev2.app.pro_monthly",
        "transactionId": "2000000123456789",
        "purchaseDate": 1750000000000,   // ms
        "expiryDate":   1752678400000,   // ms
        "isExpired": false
      }
    ]
  }
}
```

**Error response:** `{ "ok": false, "code": 6777017, "message": "..." }`
Plugin error codes used here: `VERIFICATION_FAILED = 6777017`, `COMMUNICATION = 6777014`, `BAD_RESPONSE = 6777018`.

**Why this fixes the bug** (`store.js:2968`, `Internal.VerifiedReceipts.isOwned`):

```js
if (purchase.isExpired) return false;
if (purchase.expiryDate) return purchase.expiryDate > +new Date();
return true;
```

With no validator the plugin falls back to `LocalReceipts.isOwned`, and on iOS SK1 the native side never sends an `expirationDate` (`InAppPurchase.m:603` — the callback args stop at `quantity`), so every restored transaction reads as owned forever and a cold start with zero transactions reads as owned by nobody. Configuring a validator replaces both failure modes with a real date.

---

## File Structure

**Server** — new, under the existing `firebase/` directory (which today holds only Firestore rules):

| File | Responsibility |
|---|---|
| `firebase/functions/package.json` | ESM package, Node 22, `firebase-functions` + `googleapis` |
| `firebase/functions/index.js` | Only the v2 HTTPS entry point + secret binding. No logic. |
| `firebase/functions/lib/protocol.js` | Build `ok`/`error` payloads. Pure. |
| `firebase/functions/lib/apple.js` | `verifyReceipt` call + parse into `collection[]`. Network isolated behind an injected `fetch`. |
| `firebase/functions/lib/google.js` | Play Developer API call + parse into `collection[]`. Network isolated behind an injected client. |
| `firebase/functions/lib/handler.js` | Route a request body to apple/google, shape the response. Pure given injected validators. |
| `firebase/functions/lib/protocol.test.mjs` | |
| `firebase/functions/lib/apple.test.mjs` | |
| `firebase/functions/lib/google.test.mjs` | |
| `firebase/functions/lib/handler.test.mjs` | |
| `firebase/functions/README.md` | Owner runbook: secrets, deploy, rollback |

The split is deliberate: `index.js` is the only file that touches `firebase-functions`, and `apple.js`/`google.js` take their network client as an argument. That keeps every test runnable by the repo's existing vitest with no emulator and no credentials.

**Client** — modified:

| File | Change |
|---|---|
| `src/config.js` | `RECEIPT_VALIDATOR_URL` + version bump |
| `src/lib/iap.js` | set `store.validator`, verify the app receipt on cold start, new `entitlementUpdate` contract, expose `proExpiryFromReceipts()` |
| `src/lib/proExpiry.js` | new — pure cache read/write + offline decision |
| `src/lib/iap.entitlement.test.js` | rewritten for the new contract |
| `src/lib/proExpiry.test.js` | new |
| `src/App.jsx` | persist the verified expiry alongside `settings.isPro` |
| `vitest.config.js` | add `firebase/functions/**/*.test.mjs` to `include` |
| `firebase.json` | add the `functions` section |

---

## Task 1: Functions package scaffold + protocol payloads

**Files:**
- Create: `firebase/functions/package.json`
- Create: `firebase/functions/lib/protocol.js`
- Create: `firebase/functions/lib/protocol.test.mjs`
- Modify: `vitest.config.js`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `okPayload({ id, transactionType, collection }) -> { ok: true, data: {...} }`
  - `errorPayload(code, message) -> { ok: false, code, message }`
  - `ERROR_CODES = { VERIFICATION_FAILED: 6777017, COMMUNICATION: 6777014, BAD_RESPONSE: 6777018 }`
  - `purchaseEntry({ id, transactionId, purchaseDateMs, expiryDateMs, now }) -> VerifiedPurchase`

- [ ] **Step 1: Create the functions package**

`firebase/functions/package.json`:

```json
{
  "name": "juris-voice-functions",
  "type": "module",
  "private": true,
  "engines": { "node": "22" },
  "main": "index.js",
  "dependencies": {
    "firebase-functions": "^6.5.0",
    "googleapis": "^144.0.0"
  }
}
```

- [ ] **Step 2: Point firebase.json and vitest at it**

`firebase.json` — add the `functions` key alongside the existing `firestore` key:

```json
{
  "firestore": {
    "database": "(default)",
    "location": "asia-southeast1",
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "functions": {
    "source": "firebase/functions",
    "codebase": "default",
    "ignore": ["node_modules", ".git", "*.test.mjs"]
  }
}
```

`vitest.config.js` — extend `include` only; leave everything else untouched:

```js
    include: [
      'src/**/*.test.js',
      'scripts/**/*.test.mjs',
      'firebase/functions/**/*.test.mjs',
    ],
```

- [ ] **Step 3: Write the failing test**

`firebase/functions/lib/protocol.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { okPayload, errorPayload, purchaseEntry, ERROR_CODES } from './protocol.js';

const NOW = Date.parse('2026-08-05T00:00:00Z');

describe('purchaseEntry', () => {
  it('marks a future expiry as active', () => {
    const e = purchaseEntry({
      id: 'pro_monthly', transactionId: '1', purchaseDateMs: 1, expiryDateMs: NOW + 1000, now: NOW,
    });
    expect(e.isExpired).toBe(false);
    expect(e.expiryDate).toBe(NOW + 1000);
  });

  it('marks a past expiry as expired — this is the whole point of the validator', () => {
    // VerifiedReceipts.isOwned returns false on isExpired, which is how a
    // lapsed monthly subscriber finally loses Pro.
    const e = purchaseEntry({
      id: 'pro_monthly', transactionId: '1', purchaseDateMs: 1, expiryDateMs: NOW - 1, now: NOW,
    });
    expect(e.isExpired).toBe(true);
  });

  it('treats an exact tie as expired, never as a free extra millisecond', () => {
    const e = purchaseEntry({
      id: 'pro_monthly', transactionId: '1', purchaseDateMs: 1, expiryDateMs: NOW, now: NOW,
    });
    expect(e.isExpired).toBe(true);
  });

  it('omits expiryDate entirely when there is none, rather than sending 0', () => {
    // The plugin reads `if (purchase.expiryDate)` — a 0 would silently mean
    // "no expiry known" and grant permanent Pro. undefined is the honest value.
    const e = purchaseEntry({ id: 'x', transactionId: '1', purchaseDateMs: 1, expiryDateMs: undefined, now: NOW });
    expect('expiryDate' in e).toBe(false);
    expect(e.isExpired).toBe(false);
  });
});

describe('okPayload', () => {
  it('shapes the response the plugin parses', () => {
    const p = okPayload({ id: 'com.lawcodev2.app', transactionType: 'ios-appstore', collection: [] });
    expect(p).toEqual({
      ok: true,
      data: {
        id: 'com.lawcodev2.app',
        latest_receipt: true,
        transaction: { type: 'ios-appstore' },
        collection: [],
      },
    });
  });
});

describe('errorPayload', () => {
  it('never claims ok on an error', () => {
    const p = errorPayload(ERROR_CODES.COMMUNICATION, 'apple unreachable');
    expect(p.ok).toBe(false);
    expect(p.code).toBe(6777014);
    expect(p.message).toBe('apple unreachable');
  });
});
```

- [ ] **Step 4: Run it and confirm it fails**

```bash
npx vitest run firebase/functions/lib/protocol.test.mjs
```

Expected: FAIL — `Failed to resolve import "./protocol.js"`.

- [ ] **Step 5: Implement**

`firebase/functions/lib/protocol.js`:

```js
// The wire format cordova-plugin-purchase expects from a receipt validator.
// See node_modules/cordova-plugin-purchase/src/ts/validator/validator-response.ts

export const ERROR_CODES = {
  COMMUNICATION: 6777014,
  VERIFICATION_FAILED: 6777017,
  BAD_RESPONSE: 6777018,
};

/**
 * One entry of the `collection[]` the plugin turns into a VerifiedPurchase.
 *
 * `expiryDate` is left OFF the object when unknown. The plugin's ownership
 * test is `if (purchase.expiryDate) return purchase.expiryDate > now`, so a
 * falsy 0 would fall through to `return true` and grant Pro forever.
 */
export function purchaseEntry({ id, transactionId, purchaseDateMs, expiryDateMs, now }) {
  const entry = {
    id,
    transactionId,
    purchaseDate: purchaseDateMs,
    isExpired: expiryDateMs !== undefined && expiryDateMs <= now,
  };
  if (expiryDateMs !== undefined) entry.expiryDate = expiryDateMs;
  return entry;
}

export function okPayload({ id, transactionType, collection }) {
  return {
    ok: true,
    data: {
      id,
      latest_receipt: true,
      transaction: { type: transactionType },
      collection,
    },
  };
}

export function errorPayload(code, message) {
  return { ok: false, code, message };
}
```

- [ ] **Step 6: Run and confirm pass**

```bash
npx vitest run firebase/functions/lib/protocol.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Prove the tests can fail (mutation)**

Change `expiryDateMs <= now` to `expiryDateMs < now`; the "exact tie" test must fail. Restore. Then delete the `if (expiryDateMs !== undefined)` guard and always assign; the "omits expiryDate" test must fail. Restore.

- [ ] **Step 8: Commit**

```bash
git add firebase/functions/package.json firebase/functions/lib/protocol.js firebase/functions/lib/protocol.test.mjs vitest.config.js firebase.json
git commit -m "feat(functions): scaffold receipt-validator package and wire protocol payloads"
```

---

## Task 2: Apple verifyReceipt

**Files:**
- Create: `firebase/functions/lib/apple.js`
- Create: `firebase/functions/lib/apple.test.mjs`

**Interfaces:**
- Consumes: `purchaseEntry`, `okPayload`, `errorPayload`, `ERROR_CODES` from `./protocol.js`.
- Produces: `validateApple({ appStoreReceipt, bundleId, sharedSecret, now, fetchImpl }) -> Promise<Payload>`
  and `APPLE_PRODUCTION_URL` / `APPLE_SANDBOX_URL` constants.

Background: `verifyReceipt` returns `status: 0` on success with `latest_receipt_info[]`, one entry per renewal, each carrying `product_id`, `expires_date_ms` (string), `purchase_date_ms` (string), `original_transaction_id`. Status `21007` means "this is a sandbox receipt sent to production" — the documented retry, and the case every TestFlight build hits.

- [ ] **Step 1: Write the failing test**

`firebase/functions/lib/apple.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run firebase/functions/lib/apple.test.mjs
```

Expected: FAIL — `Failed to resolve import "./apple.js"`.

- [ ] **Step 3: Implement**

`firebase/functions/lib/apple.js`:

```js
// Apple receipt validation.
//
// This app runs StoreKit 1 (ios/capacitor-cordova-ios-plugins/sources/
// CordovaPluginPurchase has only InAppPurchase.m — no SK2 bridge), so the
// client hands us the monolithic base64 app receipt, read straight off disk
// by [NSBundle mainBundle].appStoreReceiptURL. No network and no sign-in
// prompt happens on the device; the only party that can read the receipt is
// Apple, which is what this module asks.

import { okPayload, errorPayload, purchaseEntry, ERROR_CODES } from './protocol.js';

export const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
export const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

/** Apple's documented "sandbox receipt sent to production" status. */
const SANDBOX_RECEIPT = 21007;

async function post(fetchImpl, url, body) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Newest renewal per product id, by purchase date. */
function newestPerProduct(entries) {
  const byProduct = new Map();
  for (const info of entries) {
    const at = Number(info.purchase_date_ms ?? 0);
    const seen = byProduct.get(info.product_id);
    if (!seen || Number(seen.purchase_date_ms ?? 0) < at) byProduct.set(info.product_id, info);
  }
  return [...byProduct.values()];
}

export async function validateApple({ appStoreReceipt, bundleId, sharedSecret, now, fetchImpl }) {
  const body = {
    'receipt-data': appStoreReceipt,
    password: sharedSecret,
    'exclude-old-transactions': true,
  };

  let data;
  try {
    data = await post(fetchImpl, APPLE_PRODUCTION_URL, body);
    if (data?.status === SANDBOX_RECEIPT) {
      data = await post(fetchImpl, APPLE_SANDBOX_URL, body);
    }
  } catch (e) {
    return errorPayload(ERROR_CODES.COMMUNICATION, `verifyReceipt failed: ${e.message}`);
  }

  if (data?.status !== 0) {
    return errorPayload(ERROR_CODES.VERIFICATION_FAILED, `Apple returned status ${data?.status}`);
  }

  const collection = newestPerProduct(data.latest_receipt_info ?? []).map((info) =>
    purchaseEntry({
      id: info.product_id,
      transactionId: info.original_transaction_id,
      purchaseDateMs: Number(info.purchase_date_ms),
      expiryDateMs: info.expires_date_ms === undefined ? undefined : Number(info.expires_date_ms),
      now,
    }),
  );

  return okPayload({ id: bundleId, transactionType: 'ios-appstore', collection });
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
npx vitest run firebase/functions/lib/apple.test.mjs
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Prove the tests can fail (mutation)**

Remove the `status === SANDBOX_RECEIPT` retry; the sandbox test must fail. Restore. Replace `newestPerProduct(...)` with the raw array; the "keeps only the newest" test must fail. Restore. Change the non-zero-status branch to `return okPayload(...)`; the "errors on non-zero status" test must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add firebase/functions/lib/apple.js firebase/functions/lib/apple.test.mjs
git commit -m "feat(functions): validate Apple receipts and report real subscription expiry"
```

---

## Task 3: Google Play validation

**Files:**
- Create: `firebase/functions/lib/google.js`
- Create: `firebase/functions/lib/google.test.mjs`

**Interfaces:**
- Consumes: `purchaseEntry`, `okPayload`, `errorPayload`, `ERROR_CODES` from `./protocol.js`.
- Produces: `validateGoogle({ productId, purchaseToken, packageName, now, subscriptionsV2 }) -> Promise<Payload>`
  where `subscriptionsV2` is an object with `get({ packageName, token }) -> Promise<{ data }>` — the shape `googleapis`' `androidpublisher.purchases.subscriptionsv2` already has, so the real client drops straight in.

Background: `subscriptionsv2.get` returns `{ subscriptionState, lineItems: [{ productId, expiryTime }], startTime, latestOrderId }`. `expiryTime` is an RFC 3339 string. Android already worked without a validator, but it must keep working once one is configured — the plugin stops consulting local receipts entirely the moment `store.validator` is set, so an Android path that returns an error would drop every Android subscriber.

- [ ] **Step 1: Write the failing test**

`firebase/functions/lib/google.test.mjs`:

```js
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
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run firebase/functions/lib/google.test.mjs
```

Expected: FAIL — `Failed to resolve import "./google.js"`.

- [ ] **Step 3: Implement**

`firebase/functions/lib/google.js`:

```js
// Google Play subscription validation via purchases.subscriptionsv2.get.
//
// The API client is injected rather than constructed here: googleapis needs
// credentials, and every test in this file must run with none.

import { okPayload, errorPayload, purchaseEntry, ERROR_CODES } from './protocol.js';

const msOrUndefined = (rfc3339) => {
  if (!rfc3339) return undefined;
  const ms = Date.parse(rfc3339);
  return Number.isNaN(ms) ? undefined : ms;
};

export async function validateGoogle({ productId, purchaseToken, packageName, now, subscriptionsV2 }) {
  let data;
  try {
    ({ data } = await subscriptionsV2.get({ packageName, token: purchaseToken }));
  } catch (e) {
    return errorPayload(ERROR_CODES.COMMUNICATION, `subscriptionsv2.get failed: ${e.message}`);
  }

  const purchaseDateMs = msOrUndefined(data?.startTime);
  const collection = (data?.lineItems ?? []).map((item) =>
    purchaseEntry({
      id: item.productId,
      transactionId: data.latestOrderId,
      purchaseDateMs,
      // expiryTime is the paid-through date. It stays in the future while a
      // canceled-but-not-yet-lapsed subscription is still usable, which is
      // why subscriptionState is deliberately not consulted here.
      expiryDateMs: msOrUndefined(item.expiryTime),
      now,
    }),
  );

  return okPayload({ id: productId, transactionType: 'android-playstore', collection });
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
npx vitest run firebase/functions/lib/google.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the tests can fail (mutation)**

Add `if (data.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED') expiryDateMs = 0;` — the "canceled but paid-through" test must fail. Restore. Change `token: purchaseToken` to `token: productId`; the argument test must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add firebase/functions/lib/google.js firebase/functions/lib/google.test.mjs
git commit -m "feat(functions): validate Google Play subscriptions via subscriptionsv2"
```

---

## Task 4: Request router

**Files:**
- Create: `firebase/functions/lib/handler.js`
- Create: `firebase/functions/lib/handler.test.mjs`

**Interfaces:**
- Consumes: `errorPayload`, `ERROR_CODES` from `./protocol.js`.
- Produces: `handleValidation(body, deps) -> Promise<Payload>` where
  `deps = { validateApple, validateGoogle, now }` — both validators already
  bound to their credentials by the caller, taking a single options object.

- [ ] **Step 1: Write the failing test**

`firebase/functions/lib/handler.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run firebase/functions/lib/handler.test.mjs
```

Expected: FAIL — `Failed to resolve import "./handler.js"`.

- [ ] **Step 3: Implement**

`firebase/functions/lib/handler.js`:

```js
// Routes a cordova-plugin-purchase validation body to the right store.

import { errorPayload, ERROR_CODES } from './protocol.js';

export async function handleValidation(body, { validateApple, validateGoogle, now }) {
  const tx = body?.transaction;
  if (!tx?.type) {
    return errorPayload(ERROR_CODES.BAD_RESPONSE, 'Missing transaction in request body');
  }

  if (tx.type === 'ios-appstore') {
    if (!tx.appStoreReceipt) {
      return errorPayload(ERROR_CODES.BAD_RESPONSE, 'Missing appStoreReceipt');
    }
    return validateApple({ appStoreReceipt: tx.appStoreReceipt, bundleId: body.id, now });
  }

  if (tx.type === 'android-playstore') {
    if (!tx.purchaseToken) {
      return errorPayload(ERROR_CODES.BAD_RESPONSE, 'Missing purchaseToken');
    }
    return validateGoogle({ productId: body.id, purchaseToken: tx.purchaseToken, now });
  }

  return errorPayload(ERROR_CODES.BAD_RESPONSE, `Unsupported transaction type: ${tx.type}`);
}
```

- [ ] **Step 4: Run and confirm pass**

```bash
npx vitest run firebase/functions/lib/handler.test.mjs
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the tests can fail (mutation)**

Delete the `if (!tx.appStoreReceipt)` guard; the "rejects an iOS body with no receipt" test must fail. Restore. Change the final `return errorPayload(...)` to fall through to `validateApple`; the "unknown platform" test must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add firebase/functions/lib/handler.js firebase/functions/lib/handler.test.mjs
git commit -m "feat(functions): route validation requests to the right store"
```

---

## Task 5: HTTPS entry point + owner runbook

**Files:**
- Create: `firebase/functions/index.js`
- Create: `firebase/functions/README.md`

**Interfaces:**
- Consumes: `handleValidation`, `validateApple`, `validateGoogle`.
- Produces: the deployed HTTPS endpoint
  `https://asia-southeast1-juris-voice.cloudfunctions.net/validateReceipt`
  (the exact URL is echoed by `firebase deploy`; Task 6 pins whatever it prints).

There is no unit test for this file — it is only wiring, and everything it wires is already covered. Keep it that way: any logic that appears here belongs in `lib/`.

- [ ] **Step 1: Write the entry point**

`firebase/functions/index.js`:

```js
// HTTPS endpoint for cordova-plugin-purchase's `store.validator`.
//
// This file is deliberately the only one that imports firebase-functions or
// googleapis, and the only one that touches secrets. All decisions live in
// lib/ so they can be tested with no credentials and no emulator.

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { google } from 'googleapis';

import { handleValidation } from './lib/handler.js';
import { validateApple } from './lib/apple.js';
import { validateGoogle } from './lib/google.js';
import { errorPayload, ERROR_CODES } from './lib/protocol.js';

const APPLE_SHARED_SECRET = defineSecret('APPLE_SHARED_SECRET');
const GOOGLE_PLAY_SA_JSON = defineSecret('GOOGLE_PLAY_SA_JSON');

const ANDROID_PACKAGE_NAME = 'com.lawcodev2.app';

let cachedPublisher = null;
function androidPublisher() {
  if (cachedPublisher) return cachedPublisher;
  const credentials = JSON.parse(GOOGLE_PLAY_SA_JSON.value());
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  cachedPublisher = google.androidpublisher({ version: 'v3', auth });
  return cachedPublisher;
}

export const validateReceipt = onRequest(
  {
    region: 'asia-southeast1',
    secrets: [APPLE_SHARED_SECRET, GOOGLE_PLAY_SA_JSON],
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json(errorPayload(ERROR_CODES.BAD_RESPONSE, 'POST only'));
      return;
    }

    const payload = await handleValidation(req.body, {
      now: Date.now(),
      validateApple: (opts) =>
        validateApple({ ...opts, sharedSecret: APPLE_SHARED_SECRET.value(), fetchImpl: fetch }),
      validateGoogle: (opts) =>
        validateGoogle({
          ...opts,
          packageName: ANDROID_PACKAGE_NAME,
          subscriptionsV2: androidPublisher().purchases.subscriptionsv2,
        }),
    });

    // Always HTTP 200: the plugin reads `payload.ok`, and a non-2xx status is
    // reported to the client as a transport failure with the body discarded,
    // which would hide "subscription expired" behind "network error".
    res.status(200).json(payload);
  },
);
```

- [ ] **Step 2: Write the owner runbook**

`firebase/functions/README.md`:

```markdown
# Receipt validator

HTTPS endpoint that cordova-plugin-purchase calls as `store.validator`. It asks
Apple and Google for the real subscription expiry so the app can keep a paying
subscriber's Pro across restarts *and* cut a lapsed one.

## Secrets (owner only — never commit these)

Two secrets must exist before the first deploy. Set them from your machine;
they are stored in Google Secret Manager, not in this repo.

### APPLE_SHARED_SECRET

App Store Connect → your app → **App Information** → *App-Specific Shared
Secret* → Generate/View. Copy the hex string.

    firebase functions:secrets:set APPLE_SHARED_SECRET

### GOOGLE_PLAY_SA_JSON

1. Google Play Console → **Setup → API access** → link the Google Cloud project.
2. Create a service account, grant it **View financial data** and
   **Manage orders and subscriptions** on the app.
3. Download its JSON key.
4. Paste the whole file contents as the secret value:

    firebase functions:secrets:set GOOGLE_PLAY_SA_JSON

## Deploy

    firebase deploy --only functions

Note the URL it prints. It goes into `RECEIPT_VALIDATOR_URL` in `src/config.js`.

## Smoke test

    curl -s -X POST <URL> -H 'Content-Type: application/json' \
      -d '{"id":"com.lawcodev2.app","transaction":{"type":"ios-appstore"}}'

Expect `{"ok":false,"code":6777018,"message":"Missing appStoreReceipt"}` —
that proves routing and deployment without needing a real receipt.

## Rollback

Set `RECEIPT_VALIDATOR_URL = ''` in `src/config.js` and ship. The client then
never configures a validator and the plugin falls back to local receipts,
i.e. exactly build 64's behaviour.
```

- [ ] **Step 3: Verify the whole suite still passes**

```bash
npm test
```

Expected: PASS. The new files add no tests here; this step guards against a
`vitest.config.js` include that accidentally picks up `index.js`.

- [ ] **Step 4: Commit**

```bash
git add firebase/functions/index.js firebase/functions/README.md
git commit -m "feat(functions): expose validateReceipt HTTPS endpoint with secret-bound clients"
```

- [ ] **Step 5: OWNER ACTION — set secrets and deploy**

This step is performed by the repository owner, not by an agent. Run the two
`firebase functions:secrets:set` commands and `firebase deploy --only functions`
from the runbook above, then run the smoke test and record the URL. Task 6
cannot be completed until this URL exists.

---

## Task 6: Client — new entitlement contract

**Files:**
- Modify: `src/config.js`
- Modify: `src/lib/iap.js:96-98` (the `entitlementUpdate` function) and its call site `applyOwned` at `src/lib/iap.js:162-165`
- Rewrite: `src/lib/iap.entitlement.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `RECEIPT_VALIDATOR_URL` (string, `''` disables validation) from `src/config.js`
  - `entitlementUpdate({ owned, verified }) -> true | false | null` from `src/lib/iap.js`

The rule changes shape. Today `entitlementUpdate(owned)` may only ever upgrade, because `owned` alone cannot distinguish "not subscribed" from "receipt not loaded yet". With a validator there is a third fact available — whether an authoritative answer came back — and only that fact licenses a downgrade.

- [ ] **Step 1: Write the failing test**

Replace the whole of `src/lib/iap.entitlement.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { entitlementUpdate } from './iap';

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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/iap.entitlement.test.js
```

Expected: FAIL — `entitlementUpdate({owned:false, verified:true})` returns `null`, not `false`.

- [ ] **Step 3: Implement**

In `src/config.js`, add below the `AUDIO_BASE_URL` block:

```js
// ── Receipt validation ───────────────────────────────────────────────────────
// HTTPS endpoint of the Firebase Function in firebase/functions. It asks Apple
// and Google for the real subscription expiry, which is the only way this app
// can both keep a paying subscriber's Pro across restarts and cut a lapsed one:
// on iOS the StoreKit 1 bridge never reports an expiry date, so without this
// the plugin treats every past transaction as owned forever and every cold
// start as owned by nobody.
//
// Empty disables validation entirely and the app behaves exactly like build 64
// — Pro persists and is never revoked. That is the rollback switch.
export const RECEIPT_VALIDATOR_URL = '';
```

Leave it `''` in this task; Task 7 fills in the deployed URL.

In `src/lib/iap.js`, replace `entitlementUpdate` (currently lines 96-98) and its
leading comment block with:

```js
// The one entitlement-sync decision, pulled out so it can be tested away from
// the native store. Returns what to tell the app:
//   true  — upgrade to Pro
//   false — revoke Pro
//   null  — say nothing, leave the persisted flag alone
//
// `verified` is true only when the receipt validator returned a successful
// payload for this receipt. It is what licenses a downgrade. Without it,
// store.owned() reading false cannot be told apart from "the receipt has not
// loaded yet" — proven on device: Pro held for the few seconds before a
// reconcile read owned()=false and dropped it, a manual restore brought it
// straight back, and with the network off it never dropped at all. Any
// automatic downgrade built on owned() alone revokes valid, paid subscribers.
export function entitlementUpdate({ owned, verified } = {}) {
  if (owned) return true;
  return verified ? false : null;
}
```

Then update the only call site. Replace `applyOwned` (currently lines 162-165) with:

```js
        // `verified` latches true once the validator has answered successfully
        // for any receipt in this session. Before that, only upgrades are
        // reported; after it, store.owned() consults the verified receipts,
        // where an expired subscription reads false — so a lapse is revoked.
        let hasVerified = false;
        const applyOwned = () => {
          const action = entitlementUpdate({ owned: isPro(), verified: hasVerified });
          if (action !== null) onProChange?.(action);
        };
```

and in the `store.when()` chain, set the latch in `.verified()` before applying:

```js
          .verified((receipt) => {
            console.log('[IAP] verified', receipt);
            receipt.finish();
            hasVerified = true;
            applyOwned();
          })
```

- [ ] **Step 4: Run and confirm pass**

```bash
npx vitest run src/lib/iap.entitlement.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```

Expected: PASS. No other test calls `entitlementUpdate`.

- [ ] **Step 6: Prove the tests can fail (mutation)**

Change `return verified ? false : null;` to `return null;` — the "downgrades
when the validator answered" test must fail. Restore. Change `if (owned) return
true;` to `if (owned) return null;` — the two upgrade tests must fail. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/lib/iap.js src/lib/iap.entitlement.test.js
git commit -m "feat(iap): let a verified receipt license a downgrade, nothing else"
```

---

## Task 7: Client — configure the validator and verify at cold start

**Files:**
- Modify: `src/config.js` (fill in the deployed URL)
- Modify: `src/lib/iap.js` (`initIAP`)
- Create: `src/lib/iap.validator.test.js`

**Interfaces:**
- Consumes: `RECEIPT_VALIDATOR_URL` from `src/config.js`; `entitlementUpdate` from Task 6.
- Produces: `verifyLocalReceipts(store) -> void`, exported from `src/lib/iap.js` — finds the receipts the plugin holds and asks it to validate them.

This is the step that makes cold start work. Nothing in the plugin validates a receipt on its own: `store.verify()` is reached only from `.approved(tx => tx.verify())` and from the expiry monitor. On iOS with zero transactions neither fires, so the app receipt sitting on disk would never be sent. `verifyLocalReceipts` closes that gap — and because the receipt is read from `[NSBundle mainBundle].appStoreReceiptURL`, it costs no prompt and no StoreKit round trip.

- [ ] **Step 1: Write the failing test**

`src/lib/iap.validator.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { verifyLocalReceipts } from './iap';

describe('verifyLocalReceipts', () => {
  it('asks the plugin to validate every local receipt', () => {
    // On iOS the app receipt exists on disk with zero transactions attached.
    // Nothing in the plugin validates it on its own, so a cold start would
    // never learn the expiry unless we ask here.
    const a = { verify: vi.fn() };
    const b = { verify: vi.fn() };
    verifyLocalReceipts({ localReceipts: [a, b] });
    expect(a.verify).toHaveBeenCalledTimes(1);
    expect(b.verify).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the store has no receipts', () => {
    expect(() => verifyLocalReceipts({ localReceipts: [] })).not.toThrow();
  });

  it('survives a store that is missing or still loading', () => {
    expect(() => verifyLocalReceipts(null)).not.toThrow();
    expect(() => verifyLocalReceipts({})).not.toThrow();
  });

  it('does not let one failing receipt stop the others', () => {
    // A pseudo-receipt can throw on verify(); the app receipt after it is the
    // one that actually carries the subscription.
    const bad = { verify: vi.fn(() => { throw new Error('nope'); }) };
    const good = { verify: vi.fn() };
    verifyLocalReceipts({ localReceipts: [bad, good] });
    expect(good.verify).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/iap.validator.test.js
```

Expected: FAIL — `verifyLocalReceipts is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/iap.js`, add the import at the top:

```js
import { RECEIPT_VALIDATOR_URL } from '../config';
```

Add the exported helper next to `isPro()`:

```js
/**
 * Ask the plugin to validate every receipt it currently holds.
 *
 * Nothing does this automatically. `store.verify()` is reached only from
 * `.approved(tx => tx.verify())` and from the expiry monitor, and on iOS a
 * cold start has no transactions at all — the app receipt sits on disk,
 * unvalidated, and store.owned() reads false. Reading it costs no prompt and
 * no StoreKit round trip (InAppPurchase.m reads appStoreReceiptURL directly),
 * so this is safe to call on every launch.
 */
export function verifyLocalReceipts(store) {
  const receipts = store?.localReceipts;
  if (!Array.isArray(receipts)) return;
  for (const receipt of receipts) {
    try {
      receipt.verify();
    } catch (e) {
      console.warn('[IAP] verify failed for a receipt', e);
    }
  }
}
```

In `initIAP`, set the validator immediately after `store.verbosity = ...` and
before `store.register(...)`:

```js
        // Configuring a validator switches the plugin from LocalReceipts.isOwned
        // to VerifiedReceipts.isOwned, which checks expiryDate/isExpired. That
        // is the only path on which an expired subscription reads as not owned.
        if (RECEIPT_VALIDATOR_URL) {
          store.validator = RECEIPT_VALIDATOR_URL;
        }
```

and in the `initialize().then()` block, ask for validation before applying:

```js
        store.initialize([storePlatform]).then(() => {
          console.log('[IAP] initialised');
          if (RECEIPT_VALIDATOR_URL) verifyLocalReceipts(store);
          // Upgrade if the receipt already says owned; a downgrade can only
          // come later, from the .verified() handler.
          applyOwned();
          resolve();
        }).catch((e) => {
```

- [ ] **Step 4: Run and confirm pass**

```bash
npx vitest run src/lib/iap.validator.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Fill in the deployed URL**

Replace the placeholder in `src/config.js` with the URL Task 5 Step 5 printed:

```js
export const RECEIPT_VALIDATOR_URL =
  'https://asia-southeast1-juris-voice.cloudfunctions.net/validateReceipt';
```

If Task 5 Step 5 has not been done yet, leave it `''`, finish the rest of this
task, and return here. Everything below still works — validation is simply off.

- [ ] **Step 6: Run the whole suite and build**

```bash
npm test && npm run build
```

Expected: both PASS.

- [ ] **Step 7: Prove the tests can fail (mutation)**

Remove the `try`/`catch` around `receipt.verify()`; the "does not let one
failing receipt stop the others" test must fail. Restore. Change
`if (!Array.isArray(receipts)) return;` to `const receipts = store.localReceipts;`
with no guard; the "missing store" test must fail. Restore.

- [ ] **Step 8: Commit**

```bash
git add src/config.js src/lib/iap.js src/lib/iap.validator.test.js
git commit -m "feat(iap): validate the app receipt at launch so cold start knows the expiry"
```

---

## Task 8: Client — cache the expiry so an offline launch can enforce it

**Files:**
- Create: `src/lib/proExpiry.js`
- Create: `src/lib/proExpiry.test.js`
- Modify: `src/lib/iap.js` (export the verified expiry)
- Modify: `src/App.jsx:88-92`

**Interfaces:**
- Consumes: `entitlementUpdate` (Task 6), `RECEIPT_VALIDATOR_URL` (Task 7).
- Produces:
  - `proExpiryFromReceipts(store) -> number | null` from `src/lib/iap.js` — the latest `expiryDate` across all verified purchases of our product ids.
  - `expiryVerdict({ expiresAt, now, graceMs }) -> 'active' | 'lapsed' | 'unknown'` from `src/lib/proExpiry.js`.
  - `PRO_EXPIRY_GRACE_MS` from `src/lib/proExpiry.js`.

Why this exists: `store.owned()` needs the validator to have answered, which needs the network. With the network off, `initialize()` never completes and the app correctly leaves Pro standing — which is right for a subscriber on a plane and wrong for someone who cancelled three months ago and now runs the app offline forever. Caching the last known expiry closes that hole without ever guessing.

A grace period is deliberate: Apple's billing-retry window means a renewal can land days after the nominal expiry, and revoking a subscriber whose card just needed a retry is far worse than three extra free days.

- [ ] **Step 1: Write the failing test**

`src/lib/proExpiry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { expiryVerdict, PRO_EXPIRY_GRACE_MS } from './proExpiry';

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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/proExpiry.test.js
```

Expected: FAIL — `Failed to resolve import "./proExpiry"`.

- [ ] **Step 3: Implement**

`src/lib/proExpiry.js`:

```js
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
```

- [ ] **Step 4: Run and confirm pass**

```bash
npx vitest run src/lib/proExpiry.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing test for the expiry reader**

Append to `src/lib/iap.validator.test.js`:

```js
import { proExpiryFromReceipts } from './iap';

describe('proExpiryFromReceipts', () => {
  const receipt = (collection) => ({ collection });

  it('returns the latest expiry across our products', () => {
    const store = { verifiedReceipts: [
      receipt([{ id: 'com.lawcodev2.app.pro_monthly', expiryDate: 100 }]),
      receipt([{ id: 'com.lawcodev2.app.pro_yearly', expiryDate: 900 }]),
    ] };
    expect(proExpiryFromReceipts(store)).toBe(900);
  });

  it('ignores products that are not ours', () => {
    const store = { verifiedReceipts: [receipt([{ id: 'some_other_app_thing', expiryDate: 999 }])] };
    expect(proExpiryFromReceipts(store)).toBe(null);
  });

  it('returns null when nothing has been verified', () => {
    expect(proExpiryFromReceipts({ verifiedReceipts: [] })).toBe(null);
    expect(proExpiryFromReceipts(null)).toBe(null);
  });

  it('ignores an entry with no expiryDate rather than reading it as 0', () => {
    // A lifetime/non-subscription entry has no expiry. Treating it as 0 would
    // cache an epoch date and lapse the user instantly.
    const store = { verifiedReceipts: [receipt([{ id: 'pro_yearly' }])] };
    expect(proExpiryFromReceipts(store)).toBe(null);
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

```bash
npx vitest run src/lib/iap.validator.test.js
```

Expected: FAIL — `proExpiryFromReceipts is not a function`.

- [ ] **Step 7: Implement the expiry reader**

In `src/lib/iap.js`, add next to `verifyLocalReceipts`:

```js
/** Every product id that grants Pro, on either platform. */
const ALL_PRO_PRODUCT_IDS = [
  PRO_PRODUCT_ID_ANDROID,
  PRO_PRODUCT_ID_IOS_MONTHLY,
  PRO_PRODUCT_ID_IOS_QUARTERLY,
  PRO_PRODUCT_ID_IOS_YEARLY,
];

/**
 * The latest verified expiry across our products, or null if nothing has been
 * verified. Cached by the app so an offline launch can still tell an active
 * subscription from one that lapsed months ago.
 */
export function proExpiryFromReceipts(store) {
  const receipts = store?.verifiedReceipts;
  if (!Array.isArray(receipts)) return null;
  let latest = null;
  for (const receipt of receipts) {
    for (const purchase of receipt?.collection ?? []) {
      if (!ALL_PRO_PRODUCT_IDS.includes(purchase.id)) continue;
      if (typeof purchase.expiryDate !== 'number') continue;
      if (latest === null || purchase.expiryDate > latest) latest = purchase.expiryDate;
    }
  }
  return latest;
}
```

- [ ] **Step 8: Run and confirm pass**

```bash
npx vitest run src/lib/iap.validator.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 9: Report the expiry to the app**

In `src/lib/iap.js`, widen the `onProChange` contract so the caller gets the
date too. Change `applyOwned` to:

```js
        let hasVerified = false;
        const applyOwned = () => {
          const action = entitlementUpdate({ owned: isPro(), verified: hasVerified });
          const expiresAt = proExpiryFromReceipts(store);
          if (action !== null) onProChange?.(action, { expiresAt });
        };
```

Update the JSDoc on `initIAP` accordingly:

```js
 * @param {(isPro: boolean, info: {expiresAt: number|null}) => void} onProChange
 *        Called whenever entitlement state changes (purchase, restore, refund,
 *        verification). `expiresAt` is the latest verified expiry in ms, or
 *        null when nothing has been verified yet.
```

- [ ] **Step 10: Persist and enforce it in App.jsx**

In `src/App.jsx`, add the imports:

```js
import { initIAP } from './lib/iap';
import { expiryVerdict } from './lib/proExpiry';
```

and replace the IAP effect (currently lines 88-92) with:

```js
  // Initialise IAP store; sync entitlement to settings.isPro.
  //
  // Two writers, in order. The store's own signal wins when it speaks — it is
  // backed by a validator response. When it stays silent (offline, so
  // initialize() never completes) the cached expiry is consulted instead, so a
  // subscription that lapsed months ago cannot be kept alive by staying
  // offline. A verdict of 'unknown' leaves the flag exactly as it was.
  useEffect(() => {
    initIAP((proOwned, { expiresAt } = {}) => {
      setSettings(prev => {
        const next = { ...prev };
        let changed = false;
        if (prev.isPro !== proOwned) { next.isPro = proOwned; changed = true; }
        if (expiresAt != null && prev.proExpiresAt !== expiresAt) {
          next.proExpiresAt = expiresAt; changed = true;
        }
        return changed ? next : prev;
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settings.isPro) return;
    if (expiryVerdict({ expiresAt: settings.proExpiresAt, now: Date.now() }) !== 'lapsed') return;
    setSettings(prev => (prev.isPro ? { ...prev, isPro: false } : prev));
  }, [settings.isPro, settings.proExpiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
```

Add `proExpiresAt: null` to the default settings object in
`src/context/AppContext.jsx` beside `isPro: false` (line 43).

- [ ] **Step 11: Run the whole suite and build**

```bash
npm test && npm run build
```

Expected: both PASS.

- [ ] **Step 12: Prove the tests can fail (mutation)**

Change `now <= expiresAt + graceMs` to `now <= expiresAt` — the grace-period
test must fail. Restore. Change the `typeof expiresAt !== 'number'` guard to
`expiresAt == null` — the "nonsense cached value" test must fail. Restore.
Change `typeof purchase.expiryDate !== 'number'` to `!purchase.expiryDate` in
`proExpiryFromReceipts` and confirm the suite still passes, then change it to
no guard at all — the "ignores an entry with no expiryDate" test must fail.
Restore.

- [ ] **Step 13: Commit**

```bash
git add src/lib/proExpiry.js src/lib/proExpiry.test.js src/lib/iap.js src/lib/iap.validator.test.js src/App.jsx src/context/AppContext.jsx
git commit -m "feat(iap): cache the verified expiry so an offline launch still lapses"
```

---

## Task 9: Version bump and device checklist

**Files:**
- Modify: `src/config.js` (`APP_VERSION_CODE`)
- Modify: `android/app/build.gradle` (`versionCode`)
- Modify: `ios/App/App.xcodeproj/project.pbxproj` (`CURRENT_PROJECT_VERSION`, **both** occurrences)
- Create: `docs/superpowers/plans/2026-08-05-receipt-validator-checklist.md`

**Interfaces:**
- Consumes: everything above.
- Produces: build 65.

- [ ] **Step 1: Bump all four numbers together**

`src/config.js`: `export const APP_VERSION_CODE = 65;`
`android/app/build.gradle`: `versionCode 65`
`ios/App/App.xcodeproj/project.pbxproj`: `CURRENT_PROJECT_VERSION = 65;` in **both** the Debug and Release configurations.

Leave `APP_VERSION_NAME` and gradle `versionName` at `1.0.4` — they must stay equal to each other, and this is not a marketing-version change.

- [ ] **Step 2: Run the version-sync test**

```bash
npx vitest run src/config.versionSync.test.js
```

Expected: PASS. This test exists precisely because build 24 shipped with a stale `CURRENT_PROJECT_VERSION` and TestFlight silently rejected it.

- [ ] **Step 3: Write the device checklist**

`docs/superpowers/plans/2026-08-05-receipt-validator-checklist.md`:

```markdown
# Receipt validator — device checklist (build 65)

Sandbox subscriptions expire in minutes (a monthly renews every 5 minutes and
stops after 6 renewals), which makes lapse testing fast and makes "still Pro
after 30 minutes" meaningless. Test on iOS first — Android never had the bug.

## iOS

- [ ] 1. Fresh install, no subscription. App opens, no Pro, no sign-in prompt.
- [ ] 2. Buy monthly in sandbox. Pro turns on.
- [ ] 3. Force-quit, reopen with network ON. **Pro survives** — this is the bug
      that shipped in every build up to 63.
- [ ] 4. Force-quit, reopen with network OFF. Pro survives.
- [ ] 5. Airplane mode for a full minute, then back on. Pro survives.
- [ ] 6. Wait for the sandbox subscription to run out its 6 renewals (~30 min),
      then reopen with network ON. **Pro is revoked.** This is the behaviour
      no previous build had.
- [ ] 7. After 6, press Restore. Pro does **not** come back (it is genuinely
      expired) and no error toast fires.
- [ ] 8. After 6, go offline and reopen. Pro stays revoked — the cached expiry
      is what enforces this.
- [ ] 9. At no point does an Apple ID password prompt appear on launch.
- [ ] 10. Settings screen does not flicker or shift on open, for Pro or free.

## Android

- [ ] 11. Existing Pro subscriber: force-quit, reopen. Pro survives.
- [ ] 12. Offline launch. Pro survives.
- [ ] 13. Cancel and let the test subscription lapse; reopen. Pro is revoked.
- [ ] 14. Purchase flow still charges the plan that was tapped (monthly vs
      quarterly vs yearly) — the base-plan matcher is untouched but this is
      the highest-cost regression in the file.

## Server

- [ ] 15. Run the smoke test from `firebase/functions/README.md`. Expect
      `{"ok":false,"code":6777018,...}`.
- [ ] 16. Firebase console → Functions → Logs: confirm no unhandled exceptions
      during the runs above, and that `validateReceipt` invocation count is
      roughly one per app launch, not one per second.

## Rollback

If anything in 1-14 fails and cannot be fixed quickly: set
`RECEIPT_VALIDATOR_URL = ''` in `src/config.js`, bump to 66, ship. The app
returns to build 64 behaviour (Pro persists, never revoked) with no server
change and no store review dependency.
```

- [ ] **Step 4: Run the whole suite and build**

```bash
npm test && npm run build
```

Expected: both PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/config.js android/app/build.gradle ios/App/App.xcodeproj/project.pbxproj docs/superpowers/plans/2026-08-05-receipt-validator-checklist.md
git commit -m "chore: bump to build 65 for receipt validation"
git push origin HEAD
```

Push to `cloud-sync` only. Never to `main`.

---

## Self-review notes

- **Rollback is a single constant.** `RECEIPT_VALIDATOR_URL = ''` restores build 64 behaviour exactly: no validator configured, `verifyLocalReceipts` never called, `hasVerified` never latches, `entitlementUpdate` degenerates to upgrade-only. No server teardown needed.
- **The riskiest new failure mode** is the function returning `ok: true` with an empty collection when it should have errored — that revokes a paying subscriber. Task 2 covers it in both directions: a free user's valid receipt must return `ok` with `[]`, and a non-zero Apple status must return an error, never `ok`.
- **Deliberately not built (YAGNI):** App Store Server Notifications, Firestore caching of entitlements, and App Store Server API JWT auth. `verifyReceipt` needs only a shared secret, works with the receipt this app already has on disk, and requires no migration for existing subscribers. If Apple retires the endpoint, only `firebase/functions/lib/apple.js` changes — its interface with `handler.js` stays the same.
- **Not addressed here:** the deferred §7.8 bulk offline download, and the iOS UI checks (BottomSheet inside `.phone-shell`, `tapFeedback.js` vs the old sticky-tap fix, ToastHost safe-area). Those remain on the `audio-3b` list.
