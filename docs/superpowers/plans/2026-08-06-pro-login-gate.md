# Pro Login Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro features only work when the device is signed in (Google or Apple) and within the 3-device cap on that account, so one paid subscription can no longer be used for free by sharing an App Store / Google Play account across an unlimited number of devices.

**Architecture:** The pure decision logic already exists (`useEffectivePro`, `useDeviceGate`) but is wired into exactly one place (`CloudSyncCard`). This plan (1) lifts that decision to a single provider mounted once at the app root so the auth listener and the Firestore device-list fetch each run once, not once per consumer, (2) adds Sign in with Apple alongside the existing Google sign-in — mandatory once login gates paid functionality, per App Store Review Guideline 4.8 — behind one shared button component used everywhere sign-in is offered, and (3) rewires every real Pro check (TTS quota, folder creation, highlight, bookmark, ad banner/interstitial) from the raw `settings.isPro` flag to the gated value, adding a state-aware modal so a subscriber who forgot to sign in sees "sign in to unlock the Pro you already bought," never the generic "buy Pro" upsell.

**Tech Stack:** React context, `@capacitor-firebase/authentication` (already a dependency, Apple provider confirmed present in v8.3.0), existing `useEffectivePro`/`useDeviceGate`/`useAuthUser` hooks, existing `BottomSheet`/`ProGateModal`/`ConfirmDialog` component family, vitest.

## Global Constraints

- Push only to the `audio-3b` branch (this plan continues that branch). Never to `main`.
- Never modify `public/data/*.json`. Never hand-edit `src/data/audio-manifest.json`.
- Bump together, in one commit: `APP_VERSION_CODE` (`src/config.js`), `versionCode` (`android/app/build.gradle`), `CURRENT_PROJECT_VERSION` (`ios/App/App.xcodeproj/project.pbxproj`, **2 occurrences** — Debug and Release). `APP_VERSION_NAME` must equal gradle `versionName`. The branch is currently at build 65, already used for a real TestFlight upload (the receipt-validator test) — this plan's build must be **66**.
- No `window.confirm()` / `window.alert()` — use `ConfirmDialog`.
- No hard-coded hex for rules/dividers — use `var(--rule-hair)` / `var(--rule-strong)` / `var(--row-alt)`.
- Every new button needs `.tap-row` (paper rows) or `.tap-btn` (buttons/dark surfaces) because Tailwind is `hoverOnlyWhenSupported`.
- Tap targets under 44px need `.hit-44`, except adjacent buttons doing different things.
- Never `key={index}` on lists that swap content in place.
- No `requestAnimationFrame` for mount animation — use CSS `@keyframes`.
- Reuse `BottomSheet.jsx`, `ConfirmDialog.jsx`, `ProGateModal.jsx`, `showToast()` from `lib/toast.js`, `lib/tapFeedback.js`.
- `ENABLE_AUTH_GATE` in `src/config.js` is `true` on this branch — every task below assumes it stays `true`; no task needs to handle the flag-off path specially beyond what the existing hooks already do.
- Every test added must be proven by mutation: break the implementation, confirm the test fails, restore it.

---

## Reference: what already exists (read, do not rebuild)

`src/hooks/useEffectivePro.js` — combines three signals into one verdict:
```js
export function useEffectivePro() {
  const { settings } = useApp();
  const { user, loading: authLoading } = useAuthUser();
  const { allowed: deviceAllowed, devices, myDeviceId, revoke, loading: deviceLoading } = useDeviceGate(user?.uid);
  // ... returns { isPro, state, playStoreActive, user, devices, myDeviceId, revokeDevice }
  // state is one of: 'pro' | 'needs-signin' | 'needs-device-slot' | 'free' | 'loading'
}
```
`playStoreActive` is `!!settings.isPro` — the raw, receipt-verified entitlement (untouched by this plan; it is what `App.jsx`'s IAP-sync and offline-lapse-revoke effects read and write, and stays exactly as is). `isPro` is the gated value this plan wires everywhere a Pro perk is granted.

`src/hooks/useDeviceGate.js` — registers the device on sign-in, exposes `{ devices, allowed, myDeviceId, loading, refresh, revoke }`. Calls Firestore (`listDevices`, `isDeviceAllowed`) — this is the read this plan must stop duplicating per consumer.

`src/hooks/useAuthUser.js` — wraps `onAuthChanged` (a Firebase listener) into `{ user, loading }`. This is the listener this plan must stop duplicating per consumer.

`src/services/sync/auth.js` — `signInWithGoogle()`, `signOut()`, `onAuthChanged()`, `getCurrentUser()`, all guarded by `syncEnabledOnPlatform()`. This plan adds `signInWithApple()` here, mirroring `signInWithGoogle()` exactly.

`src/components/CloudSyncCard.jsx` — the one existing consumer of `useEffectivePro()`. Already renders all three non-`pro`, non-`loading` states correctly (`needs-signin` → sign-in button; `needs-device-slot` → device list + revoke; `pro` → status + sign-out). This plan repoints its data source to the new shared context and swaps its Google-only button for the new shared `SignInButtons`.

`src/components/ProGateModal.jsx` — the existing "you need Pro, go see the packages" modal, used by `ReaderScreen.jsx` (highlight, bookmark) and `SelectScreen.jsx` (folder create). Untouched by this plan — it stays correct for genuinely free users. A new sibling modal (`SignInGateModal`) covers the other two blocked states.

Real Pro-check call sites this plan rewires (all currently read `settings.isPro` directly):
- `src/App.jsx:174` — native ad banner show/hide.
- `src/context/TtsContext.jsx:13-14,57,71` — the daily-listen quota gate (`isProRef`).
- `src/components/TtsPlayer.jsx:58` — the quota-blocked prompt bar (currently always offers "watch an ad," even to a Pro subscriber who forgot to sign in).
- `src/screens/SelectScreen.jsx:48,655,662,681` — folder creation.
- `src/screens/ReaderScreen.jsx:79,90-91,269,299` — interstitial/banner ads, highlight, bookmark.
- `src/components/AdBanner.jsx:15` — browser dev-preview only, low stakes, included for consistency.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/context/ProAccessContext.jsx` | New. Mounts `useEffectivePro()` exactly once; provides `{ isPro, state, playStoreActive, user, devices, myDeviceId, revokeDevice }` via `useProAccess()`. |
| `src/lib/proAccessCopy.js` | New. Pure function mapping `(state, feature)` → `{ title, body }` copy for the sign-in gate. No JSX, no React — fully unit-testable. |
| `src/components/SignInButtons.jsx` | New. Google button always; Apple button only when `Capacitor.getPlatform() === 'ios'`. Used by `CloudSyncCard` and `SignInGateModal`. |
| `src/components/SignInGateModal.jsx` | New. Same visual family as `ProGateModal`/`ConfirmDialog`. Renders `SignInButtons` inline for `needs-signin`; a "จัดการอุปกรณ์" (manage devices) link to Settings for `needs-device-slot`. |
| `src/services/sync/auth.js` | Modified. Add `signInWithApple()`. |
| `src/App.jsx` | Modified. Mount `ProAccessProvider`; `CloudSyncBootstrap` reads `user` from context instead of its own `useAuthUser()` call; ad-banner effect reads `useProAccess().isPro`. |
| `src/context/TtsContext.jsx` | Modified. Quota gate reads `useProAccess().isPro`; context value exposes `proAccessState` for `TtsPlayer`. |
| `src/components/TtsPlayer.jsx` | Modified. Quota-blocked bar branches on `proAccessState`. |
| `src/components/CloudSyncCard.jsx` | Modified. Reads `useProAccess()` instead of calling the hook itself; swaps its button for `SignInButtons`. |
| `src/screens/SelectScreen.jsx` | Modified. Folder-create gate branches by state. |
| `src/screens/ReaderScreen.jsx` | Modified. Highlight/bookmark gates branch by state; ad calls read `useProAccess().isPro`. |
| `src/components/AdBanner.jsx` | Modified. Reads `useProAccess().isPro`. |
| `ios/App/App/App.entitlements` | New. Sign in with Apple capability. |
| `ios/App/App.xcodeproj/project.pbxproj` | Modified. `CODE_SIGN_ENTITLEMENTS` in both build configs; version bump. |

---

## Task 1: `ProAccessContext` — one mount point

**Files:**
- Create: `src/context/ProAccessContext.jsx`
- Create: `src/context/ProAccessContext.test.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useEffectivePro` from `../hooks/useEffectivePro` (unchanged, existing).
- Produces: `export function ProAccessProvider({ children })`, `export function useProAccess()` returning `{ isPro, state, playStoreActive, user, devices, myDeviceId, revokeDevice }` — the exact same shape `useEffectivePro()` already returns, so every later task's consumer code reads identically to a direct `useEffectivePro()` call.

- [ ] **Step 1: Write the failing test**

`src/context/ProAccessContext.test.jsx`:
```jsx
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const mockResult = {
  isPro: true, state: 'pro', playStoreActive: true,
  user: { uid: 'u1' }, devices: [{ id: 'd1' }], myDeviceId: 'd1',
  revokeDevice: vi.fn(),
};
const useEffectiveProMock = vi.fn(() => mockResult);
vi.mock('../hooks/useEffectivePro', () => ({ useEffectivePro: useEffectiveProMock }));

const { ProAccessProvider, useProAccess } = await import('./ProAccessContext');

function Probe() {
  const access = useProAccess();
  return createElement('div', null, JSON.stringify({ isPro: access.isPro, state: access.state }));
}

describe('ProAccessProvider', () => {
  it('calls useEffectivePro exactly once regardless of how many descendants read it', () => {
    useEffectiveProMock.mockClear();
    const tree = createElement(ProAccessProvider, null,
      createElement(Probe), createElement(Probe), createElement(Probe));
    renderToStaticMarkup(tree);
    // Three Probes each call useProAccess(); only the Provider itself may call
    // the real hook — that is the entire point of lifting it out of each
    // consumer, since useEffectivePro mounts a Firebase auth listener and a
    // Firestore device-list fetch.
    expect(useEffectiveProMock).toHaveBeenCalledTimes(1);
  });

  it('gives every descendant the same value the hook returned', () => {
    const tree = createElement(ProAccessProvider, null, createElement(Probe));
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('"isPro":true');
    expect(html).toContain('"state":"pro"');
  });

  it('throws a clear error when used outside the provider, not a silent undefined', () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/useProAccess/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/ProAccessContext.test.jsx`
Expected: FAIL — `Failed to resolve import "./ProAccessContext"`.

- [ ] **Step 3: Write minimal implementation**

`src/context/ProAccessContext.jsx`:
```jsx
// One mount point for `useEffectivePro()`.
//
// The hook mounts a Firebase auth listener (`useAuthUser`) and, once signed
// in, a Firestore device-list fetch (`useDeviceGate`). Calling it from every
// screen and component that needs to know "is Pro usable right now" would
// mean N listeners and N device-list reads for one signed-in session. This
// provider calls it once at the app root; every consumer reads the same
// value via `useProAccess()`.
import { createContext, useContext } from 'react';
import { useEffectivePro } from '../hooks/useEffectivePro';

const ProAccessCtx = createContext(null);

export function ProAccessProvider({ children }) {
  const access = useEffectivePro();
  return <ProAccessCtx.Provider value={access}>{children}</ProAccessCtx.Provider>;
}

export function useProAccess() {
  const ctx = useContext(ProAccessCtx);
  if (!ctx) throw new Error('useProAccess must be used within ProAccessProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/context/ProAccessContext.test.jsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Mount it in App.jsx and repoint CloudSyncBootstrap**

In `src/App.jsx`, add the import next to the other context imports:
```js
import { ProAccessProvider, useProAccess } from './context/ProAccessContext';
```

Replace `CloudSyncBootstrap` (currently calls its own `useAuthUser()`):
```jsx
function CloudSyncBootstrap() {
  // Drives cloud sync (pull-on-sign-in + push-on-resume) when the flag is on.
  // `user` comes from the shared ProAccessProvider so this does not open a
  // second Firebase auth listener alongside the one the provider already has.
  const { user } = useProAccess();
  useCloudSync(user);
  return null;
}
```

Remove the now-unused `useAuthUser` import from `App.jsx` (grep confirms `CloudSyncBootstrap` was its only call site in this file):
```bash
grep -n "useAuthUser" src/App.jsx
```
Delete the `import { useAuthUser } from './hooks/useAuthUser';` line.

Wrap `AppRoutes` in the provider, in `LawCodeApp` at the bottom of the file:
```jsx
export default function LawCodeApp() {
  // Row press feedback. Delegated from the document, so it must be installed
  // once for the whole app rather than per screen. Runs in the browser too.
  useEffect(() => { initTapFeedback(); }, []);
```
(context above unchanged) — find the `return` statement of `LawCodeApp` and change it from:
```jsx
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
```
to:
```jsx
  return (
    <AppProvider>
      <ProAccessProvider>
        <AppRoutes />
      </ProAccessProvider>
    </AppProvider>
  );
```
`ProAccessProvider` must be inside `AppProvider` (it needs `useApp()` transitively, via `useEffectivePro`'s own `useApp()` call) and outside `AppRoutes` (so `TtsProvider`, which is inside `AppRoutes`, can read the context in Task 8).

- [ ] **Step 6: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS. `CloudSyncBootstrap`'s behaviour is unchanged (still receives a `user`, still drives `useCloudSync`), just sourced from the shared provider.

- [ ] **Step 7: Prove the "exactly once" test can fail (mutation)**

Temporarily change `Probe` in the test to call `useEffectivePro` directly (bypassing the context) instead of `useProAccess()`, confirm the "called exactly once" assertion now fails (3 calls, not 1), then revert the test file to its Step 1 content.

- [ ] **Step 8: Commit**

```bash
git add src/context/ProAccessContext.jsx src/context/ProAccessContext.test.jsx src/App.jsx
git commit -m "feat: mount useEffectivePro once via a shared ProAccessProvider"
```

---

## Task 2: Sign in with Apple — the auth call

**Files:**
- Modify: `src/services/sync/auth.js`
- Test: `src/services/sync/auth.test.js` (new — this file has none today; the existing functions in `auth.js` are also currently untested, but this task only tests the function it adds, not a retrofit of the whole file)

**Interfaces:**
- Consumes: `FirebaseAuthentication` from `@capacitor-firebase/authentication` (already imported in this file), `syncEnabledOnPlatform` from `./firebase` (already imported).
- Produces: `export async function signInWithApple()` → `Promise<{ ok: boolean, user?: object, error?: string }>` — identical shape to the existing `signInWithGoogle()`.

- [ ] **Step 1: Write the failing test**

`src/services/sync/auth.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithApple = vi.fn();
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithApple },
}));
vi.mock('./firebase', () => ({ syncEnabledOnPlatform: () => true }));

const { signInWithApple: signIn } = await import('./auth');

beforeEach(() => { signInWithApple.mockReset(); });

describe('signInWithApple', () => {
  it('returns ok + the signed-in user on success', async () => {
    signInWithApple.mockResolvedValue({ user: { uid: 'u1', email: 'a@b.com' } });
    const r = await signIn();
    expect(r).toEqual({ ok: true, user: { uid: 'u1', email: 'a@b.com' } });
  });

  it('returns ok with a null user rather than throwing when the plugin gives none', async () => {
    signInWithApple.mockResolvedValue({});
    const r = await signIn();
    expect(r).toEqual({ ok: true, user: null });
  });

  it('returns ok:false with the error message when the native call rejects', async () => {
    // The most common case in practice: the user cancels the system sheet.
    signInWithApple.mockRejectedValue(new Error('User canceled'));
    const r = await signIn();
    expect(r.ok).toBe(false);
    expect(r.error).toBe('User canceled');
  });
});

describe('signInWithApple when sync is unavailable on this platform', () => {
  it('short-circuits without calling the native plugin', async () => {
    vi.resetModules();
    vi.doMock('./firebase', () => ({ syncEnabledOnPlatform: () => false }));
    const { signInWithApple: signInDisabled } = await import('./auth');
    const r = await signInDisabled();
    expect(r.ok).toBe(false);
    expect(signInWithApple).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/sync/auth.test.js`
Expected: FAIL — `signIn is not a function` (nothing named `signInWithApple` exported yet).

- [ ] **Step 3: Write minimal implementation**

In `src/services/sync/auth.js`, add directly below `signInWithGoogle`:
```js
// Trigger the Apple sign-in flow. Returns { ok, user?, error? }.
//
// Mandatory once login gates a paid feature (App Store Review Guideline
// 4.8: an app offering third-party/social login to set up its account
// system must offer Sign in with Apple as an equivalent option). Mirrors
// signInWithGoogle exactly so both can sit behind one shared button
// component with no special-casing at the call site.
export async function signInWithApple() {
  if (!syncEnabledOnPlatform()) {
    return { ok: false, error: 'Sync not available on this platform' };
  }
  try {
    const result = await FirebaseAuthentication.signInWithApple();
    return { ok: true, user: result?.user || null };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/sync/auth.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```
Expected: PASS, no regressions.

- [ ] **Step 6: Prove the tests can fail (mutation)**

Change `return { ok: true, user: result?.user || null };` to `return { ok: true, user: result.user };` and confirm the "null user rather than throwing" test now fails (a `result` of `{}` makes `result.user` `undefined`, which the test's `toEqual({ ok: true, user: null })` rejects — actually run it to see the real failure mode and confirm it fails, not just reason about it). Restore.

- [ ] **Step 7: Commit**

```bash
git add src/services/sync/auth.js src/services/sync/auth.test.js
git commit -m "feat: add Apple as a sign-in provider alongside Google"
```

---

## Task 3: `SignInButtons` — the one shared entry point

**Files:**
- Create: `src/components/SignInButtons.jsx`

**Interfaces:**
- Consumes: `signInWithGoogle`, `signInWithApple` from `../services/sync/auth`.
- Produces: `export default function SignInButtons({ onSignedIn, onError })` — calls `onSignedIn()` after a successful sign-in of either kind, `onError(message)` on failure. No internal navigation, no internal toast — the caller decides what happens next (this component is used inside both a full-screen card and a small modal, which want different follow-up behaviour).

There is no unit test for this component — it is a thin, purely presentational wrapper with no branching logic beyond a platform check, and its correctness (which provider fires which native call) is exercised by Task 2's already-covered functions. This mirrors how `VoiceSettings.jsx` has no test file in this codebase.

- [ ] **Step 1: Implement**

`src/components/SignInButtons.jsx`:
```jsx
// The one place both sign-in providers are offered. Used by CloudSyncCard
// (the Settings screen) and SignInGateModal (the inline gate). Apple only
// renders on iOS — Android/web have no Apple ID to sign in with, and Apple's
// own guidance is that the button should not appear on platforms where it
// cannot work.
import { useState } from 'react';
import { signInWithGoogle, signInWithApple } from '../services/sync/auth';

const isIos = () =>
  typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'ios';

export default function SignInButtons({ onSignedIn, onError }) {
  const [busy, setBusy] = useState(null); // 'google' | 'apple' | null

  const run = async (kind, fn) => {
    setBusy(kind);
    const r = await fn();
    setBusy(null);
    if (r.ok) onSignedIn?.();
    else onError?.(r.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run('google', signInWithGoogle)}
        className="tap-btn hit-44 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper disabled:opacity-50"
      >
        {busy === 'google' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google'}
      </button>
      {isIos() && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('apple', signInWithApple)}
          className="tap-btn hit-44 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-ink dark:bg-paper text-paper dark:text-ink disabled:opacity-50"
        >
          {busy === 'apple' ? 'กำลังเข้าสู่ระบบ…' : ' เข้าสู่ระบบด้วย Apple'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS (no test file added in this task; this confirms no syntax/import error).

- [ ] **Step 3: Commit**

```bash
git add src/components/SignInButtons.jsx
git commit -m "feat: add a shared Google + Apple sign-in button pair"
```

---

## Task 4: Repoint `CloudSyncCard` at the shared context and buttons

**Files:**
- Modify: `src/components/CloudSyncCard.jsx`

**Interfaces:**
- Consumes: `useProAccess` from `../context/ProAccessContext` (Task 1), `SignInButtons` from `./SignInButtons` (Task 3).
- Produces: nothing new — `CloudSyncCard`'s own external interface (a component with no props, rendered by `SettingsScreen.jsx`) is unchanged.

- [ ] **Step 1: Swap the data source**

In `src/components/CloudSyncCard.jsx`, change the import:
```js
import { useEffectivePro } from '../hooks/useEffectivePro';
```
to:
```js
import { useProAccess } from '../context/ProAccessContext';
```
and the call site:
```js
const { state, user, devices, myDeviceId, revokeDevice } = useEffectivePro();
```
to:
```js
const { state, user, devices, myDeviceId, revokeDevice } = useProAccess();
```

- [ ] **Step 2: Swap the sign-in button for the shared component**

Replace the `handleSignIn` function and the button in the `needs-signin` branch. Current code:
```jsx
  const handleSignIn = async () => {
    setBusy('signin'); setMsg('');
    const r = await signInWithGoogle();
    setBusy(null);
    if (!r.ok) setMsg(r.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };
```
Delete this function entirely (and the now-unused `signInWithGoogle` import — check `signOut` is still imported and used, it is, for `handleSignOut`).

In the `needs-signin` render branch, current code:
```jsx
        <button
          disabled={busy === 'signin'}
          onClick={handleSignIn}
          className="mt-3 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper disabled:opacity-50"
        >
          {busy === 'signin' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>
        {msg && <div className="mt-2 font-ui text-[10px] text-accent">{msg}</div>}
```
Replace with:
```jsx
        <div className="mt-3">
          <SignInButtons onSignedIn={() => {}} onError={setMsg} />
        </div>
        {msg && <div className="mt-2 font-ui text-[10px] text-accent">{msg}</div>}
```
Add the import at the top:
```js
import SignInButtons from './SignInButtons';
```
Remove `signInWithGoogle` from the `import { signInWithGoogle, signOut } from '../services/sync/auth';` line, leaving:
```js
import { signOut } from '../services/sync/auth';
```

- [ ] **Step 2: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/CloudSyncCard.jsx
git commit -m "feat: offer Apple sign-in from the Settings sync card, sourced from the shared context"
```

---

## Task 5: `proAccessCopy` — the pure gate-content decision

**Files:**
- Create: `src/lib/proAccessCopy.js`
- Create: `src/lib/proAccessCopy.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function gateContentFor(state, feature)` → `{ kind: 'buy' | 'signin' | 'device-slot', title, body }`. `feature` is one of `'folder' | 'highlight' | 'bookmark' | 'listen'` — each has its own Thai copy for the `'buy'` kind (matching what each call site already hard-codes today); the `'signin'` and `'device-slot'` copy is feature-agnostic (one message covers all four call sites, since the ask — "sign in" / "manage devices" — is identical regardless of which feature triggered it).

This is the one piece of new logic in the whole plan that decides WHICH modal a blocked action shows, so it is the piece most worth pinning with tests and mutation, independent of any component.

- [ ] **Step 1: Write the failing test**

`src/lib/proAccessCopy.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { gateContentFor } from './proAccessCopy';

describe('gateContentFor', () => {
  it('tells a genuinely free user to buy Pro, with feature-specific copy', () => {
    const c = gateContentFor('free', 'folder');
    expect(c.kind).toBe('buy');
    expect(c.title).toContain('โฟลเดอร์');
  });

  it('gives each feature its own buy-Pro copy, not one generic message', () => {
    const folder = gateContentFor('free', 'folder');
    const highlight = gateContentFor('free', 'highlight');
    const bookmark = gateContentFor('free', 'bookmark');
    const listen = gateContentFor('free', 'listen');
    const titles = new Set([folder.title, highlight.title, bookmark.title, listen.title]);
    expect(titles.size).toBe(4);
  });

  it('tells a subscriber who has not signed in to sign in, not to buy Pro again', () => {
    // This is the whole point of the plan: someone who already paid must
    // never be told to buy Pro a second time.
    const c = gateContentFor('needs-signin', 'folder');
    expect(c.kind).toBe('signin');
    expect(c.title).not.toContain('ฟีเจอร์ Pro');
    expect(c.body).not.toMatch(/ซื้อ|สมัคร/); // never says "buy" / "subscribe"
  });

  it('tells a subscriber over the device cap to manage devices, not to sign in again', () => {
    const c = gateContentFor('needs-device-slot', 'listen');
    expect(c.kind).toBe('device-slot');
    expect(c.body).toMatch(/อุปกรณ์/); // mentions devices
  });

  it('is feature-agnostic once the blocker is signin or device-slot', () => {
    const a = gateContentFor('needs-signin', 'folder');
    const b = gateContentFor('needs-signin', 'listen');
    expect(a).toEqual(b);
  });

  it('returns null for pro and loading — nothing should be gated', () => {
    expect(gateContentFor('pro', 'folder')).toBe(null);
    expect(gateContentFor('loading', 'folder')).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/proAccessCopy.test.js`
Expected: FAIL — `Failed to resolve import "./proAccessCopy"`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/proAccessCopy.js`:
```js
// What to tell the user when a Pro-gated action is blocked, and why.
//
// Three distinct reasons can block the same tap, and each needs different
// copy: a free user needs to be sold on Pro; a subscriber who has not
// signed in already paid and must never be told to buy again; a subscriber
// over the device cap needs to manage devices, not sign in somewhere else.
// Kept as a pure function (no JSX, no React) so the decision is testable on
// its own and every call site renders whichever component the `kind` calls
// for.

const BUY_COPY = {
  folder: {
    title: 'สร้างโฟลเดอร์ — ฟีเจอร์ Pro',
    body: 'สมาชิก Pro สร้างโฟลเดอร์จัดหมวดมาตราได้ไม่จำกัด',
  },
  highlight: {
    title: 'ไฮไลท์ตัวบท — ฟีเจอร์ Pro',
    body: 'สมาชิก Pro ระบายสีเน้นข้อความในตัวบทได้ และไฮไลท์จะถูกบันทึกไว้',
  },
  bookmark: {
    title: 'บุ๊กมาร์ก — ฟีเจอร์ Pro',
    body: 'สมาชิก Pro บันทึกมาตราที่สนใจไว้ในคลังส่วนตัว เข้าถึงได้ทุกเมื่อ',
  },
  listen: {
    title: 'โควต้าการฟังหมดแล้ววันนี้',
    body: 'สมัคร Pro เพื่อฟังไม่จำกัด หรือดูโฆษณาเพื่อรับโควต้าเพิ่ม',
  },
};

const SIGNIN_COPY = {
  title: 'เข้าสู่ระบบเพื่อใช้งาน Pro',
  body: 'คุณสมัคร Pro แล้ว — เข้าสู่ระบบเพื่อเปิดใช้งานฟีเจอร์ Pro บนเครื่องนี้',
};

const DEVICE_SLOT_COPY = {
  title: 'ใช้งานครบจำนวนอุปกรณ์แล้ว',
  body: 'บัญชีนี้ใช้ Pro ได้สูงสุด 3 อุปกรณ์ — จัดการอุปกรณ์ในหน้าตั้งค่าเพื่อเปิดใช้บนเครื่องนี้',
};

export function gateContentFor(state, feature) {
  if (state === 'free') return { kind: 'buy', ...BUY_COPY[feature] };
  if (state === 'needs-signin') return { kind: 'signin', ...SIGNIN_COPY };
  if (state === 'needs-device-slot') return { kind: 'device-slot', ...DEVICE_SLOT_COPY };
  return null; // 'pro' and 'loading' — nothing is blocked
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/proAccessCopy.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole suite**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 6: Prove the tests can fail (mutation)**

Change `if (state === 'free') return { kind: 'buy', ...BUY_COPY[feature] };` to always use `BUY_COPY.folder` regardless of `feature` — confirm the "each feature its own copy" test fails (only 1 unique title, not 4). Restore. Change `if (state === 'pro' ...` guard by removing the final `return null` and instead falling through to `SIGNIN_COPY` — confirm the "nothing gated for pro/loading" test fails. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/lib/proAccessCopy.js src/lib/proAccessCopy.test.js
git commit -m "feat: decide gate copy by blocking reason, never re-selling an already-bought subscription"
```

---

## Task 6: `SignInGateModal`

**Files:**
- Create: `src/components/SignInGateModal.jsx`

**Interfaces:**
- Consumes: `gateContentFor` from `../lib/proAccessCopy` (Task 5), `SignInButtons` from `./SignInButtons` (Task 3).
- Produces: `export default function SignInGateModal({ state, feature, onClose })`. Renders `null` if `gateContentFor(state, feature)` is `null` or its `kind` is `'buy'` (that case is `ProGateModal`'s job, not this component's — callers decide which modal to render, per Task 9-11; this component only ever needs to handle `'signin'` and `'device-slot'`, but takes the full `state`/`feature` pair rather than a pre-computed content object so every call site has one shared decision point instead of duplicating the `gateContentFor` call and the null-check).

- [ ] **Step 1: Implement**

`src/components/SignInGateModal.jsx`:
```jsx
// The gate for a subscriber who already paid but is blocked by sign-in or
// the device cap — as opposed to ProGateModal, which sells Pro to someone
// who has not bought it. Same visual family (ConfirmDialog/ProGateModal).
import { useNavigate } from 'react-router-dom';
import { gateContentFor } from '../lib/proAccessCopy';
import SignInButtons from './SignInButtons';

export default function SignInGateModal({ state, feature, onClose }) {
  const navigate = useNavigate();
  const content = gateContentFor(state, feature);
  if (!content || content.kind === 'buy') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative bg-paper dark:bg-dark-bg rounded-2xl shadow-2xl p-5 max-w-xs w-full text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-[18px] font-medium italic">{content.title}</div>
        <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft mt-1.5 leading-snug">
          {content.body}
        </div>

        {content.kind === 'signin' && (
          <div className="mt-4">
            <SignInButtons onSignedIn={onClose} onError={() => {}} />
          </div>
        )}

        {content.kind === 'device-slot' && (
          <button
            onClick={() => { onClose?.(); navigate('/settings'); }}
            className="tap-btn hit-44 mt-4 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper"
          >
            จัดการอุปกรณ์
          </button>
        )}

        <button
          onClick={onClose}
          className="tap-btn mt-2 w-full font-ui text-[11px] py-2 text-ink-soft dark:text-rule-soft"
        >
          ไว้ก่อน
        </button>
      </div>
    </div>
  );
}
```

No unit test for this component, for the same reason as Task 3's `SignInButtons`: it is presentational, its one piece of decision logic (`gateContentFor`) is already unit-tested in Task 5, and this codebase does not test components at this layer (`ProGateModal.jsx`, which this mirrors, has no test file either).

- [ ] **Step 2: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/SignInGateModal.jsx
git commit -m "feat: add the sign-in/device-cap gate modal for subscribers who already paid"
```

---

## Task 7: Wire the ad banner (`App.jsx`) and the TTS quota gate (`TtsContext.jsx`)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/context/TtsContext.jsx`

**Interfaces:**
- Consumes: `useProAccess` from `../context/ProAccessContext` (Task 1).
- Produces: `TtsContext`'s value gains one new field, `proAccessState: string`, alongside the existing `quotaBlocked` — Task 8 (`TtsPlayer`) reads it.

- [ ] **Step 1: Wire the ad banner**

In `src/App.jsx`, `ThemeWrapper` currently:
```jsx
  useEffect(() => {
    if (!isNative()) return;
    if (settings.isPro) {
      removeBanner();
    } else {
      showBanner(false);
    }
  }, [settings.isPro]);
```
`ThemeWrapper` is rendered inside `ProAccessProvider` (Task 1 mounted the provider around `AppRoutes`, and `ThemeWrapper` is inside `AppRoutes`), so it can call the hook directly. Add the import:
```js
import { useProAccess } from './context/ProAccessContext';
```
and change the effect to read the gated value, keeping the raw flag only where it already matters (the IAP-sync and offline-lapse effects elsewhere in this same component stay on `settings.isPro`/`settings.proExpiresAt` — those are about whether the subscription itself is valid, not about whether this device is allowed to use it):
```jsx
  const { isPro: proAccessIsPro } = useProAccess();

  useEffect(() => {
    if (!isNative()) return;
    if (proAccessIsPro) {
      removeBanner();
    } else {
      showBanner(false);
    }
  }, [proAccessIsPro]);
```
Place the `const { isPro: proAccessIsPro } = useProAccess();` line near the top of `ThemeWrapper`, alongside its existing `const { settings, setSettings } = useApp();`.

- [ ] **Step 2: Wire the TTS quota gate**

In `src/context/TtsContext.jsx`, add the import:
```js
import { useProAccess } from './ProAccessContext';
```
Change:
```js
  const { settings, setSettings } = useApp();
  const isProRef = useRef(settings.isPro);
  useEffect(() => { isProRef.current = settings.isPro; }, [settings.isPro]);
```
to:
```js
  const { settings, setSettings } = useApp();
  const { isPro: proAccessIsPro, state: proAccessState } = useProAccess();
  const isProRef = useRef(proAccessIsPro);
  useEffect(() => { isProRef.current = proAccessIsPro; }, [proAccessIsPro]);
```
`isProRef` is read inside `tts.setHooks`'s `onItemStart` callback and inside `playSections` — both already reference `isProRef.current`, so neither needs further changes; they now gate on the signed-in, device-capped value instead of the raw flag.

Add `proAccessState` to the context value object (near `quotaBlocked`):
```js
    quotaBlocked,
    setQuotaBlocked,
    proAccessState,
```

- [ ] **Step 3: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/context/TtsContext.jsx
git commit -m "feat: gate the ad banner and the TTS quota on signed-in Pro access, not the raw entitlement"
```

---

## Task 8: `TtsPlayer` — quota-blocked bar tells a subscriber to sign in, not to watch an ad

**Files:**
- Modify: `src/components/TtsPlayer.jsx`

**Interfaces:**
- Consumes: `proAccessState` from `useTts()` (Task 7 added it to `TtsContext`'s value), `gateContentFor` from `../lib/proAccessCopy` (Task 5).

- [ ] **Step 1: Read the gate content and branch the bar**

In `src/components/TtsPlayer.jsx`, add the import:
```js
import { gateContentFor } from '../lib/proAccessCopy';
```
Add `proAccessState` to the destructured `useTts()` call:
```js
  const {
    playing, paused, currentItem, itemIndex, itemCount, items, voiceKind,
    pause, resume, stop, next, prev, goToItem,
    quotaBlocked, setQuotaBlocked, proAccessState,
  } = useTts();
```

Replace the quota-blocked branch's body. Current:
```jsx
  if (quotaBlocked && !active) {
    return (
      <div
        className="fixed left-0 right-0 z-40 px-3"
        style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`, paddingBottom: 8 }}
      >
        <div className="bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-4 py-3">
          <div className="font-display text-[14px] font-medium mb-0.5">โควต้าการฟังหมดแล้ววันนี้</div>
          <div className="font-ui text-[11px] opacity-70 mb-2.5">
            ผู้ใช้ฟรีฟังได้วันละ {DAILY_FREE} มาตรา — ดูโฆษณาเพื่อรับเพิ่มอีก {REWARD_AMOUNT} มาตรา
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReward}
              disabled={busy}
              className="tap-btn flex-1 font-ui text-[12px] font-bold bg-accent text-paper rounded-lg py-2.5 disabled:opacity-50"
            >
              {busy ? 'กำลังโหลด…' : `ดูโฆษณา +${REWARD_AMOUNT} มาตรา`}
            </button>
            <button
              onClick={() => setQuotaBlocked(false)}
              className="tap-btn font-ui text-[12px] px-4 rounded-lg border border-paper/30 dark:border-ink/30"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  }
```
Replace with:
```jsx
  if (quotaBlocked && !active) {
    // A user blocked by sign-in or the device cap already paid for
    // unlimited listening — offering "watch an ad" here would be telling a
    // Pro subscriber to earn back a quota they should never have hit.
    const gate = gateContentFor(proAccessState, 'listen');
    const isSubscriberBlocked = gate && gate.kind !== 'buy';

    return (
      <div
        className="fixed left-0 right-0 z-40 px-3"
        style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`, paddingBottom: 8 }}
      >
        <div className="bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-4 py-3">
          <div className="font-display text-[14px] font-medium mb-0.5">
            {isSubscriberBlocked ? gate.title : 'โควต้าการฟังหมดแล้ววันนี้'}
          </div>
          <div className="font-ui text-[11px] opacity-70 mb-2.5">
            {isSubscriberBlocked
              ? gate.body
              : `ผู้ใช้ฟรีฟังได้วันละ ${DAILY_FREE} มาตรา — ดูโฆษณาเพื่อรับเพิ่มอีก ${REWARD_AMOUNT} มาตรา`}
          </div>
          {isSubscriberBlocked ? (
            <button
              onClick={() => { setQuotaBlocked(false); navigate('/settings'); }}
              className="tap-btn hit-44 w-full font-ui text-[12px] font-bold bg-accent text-paper rounded-lg py-2.5"
            >
              {gate.kind === 'signin' ? 'เข้าสู่ระบบ' : 'จัดการอุปกรณ์'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleReward}
                disabled={busy}
                className="tap-btn flex-1 font-ui text-[12px] font-bold bg-accent text-paper rounded-lg py-2.5 disabled:opacity-50"
              >
                {busy ? 'กำลังโหลด…' : `ดูโฆษณา +${REWARD_AMOUNT} มาตรา`}
              </button>
              <button
                onClick={() => setQuotaBlocked(false)}
                className="tap-btn font-ui text-[12px] px-4 rounded-lg border border-paper/30 dark:border-ink/30"
              >
                ปิด
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
```
`navigate` is already available in this component (`const navigate = useNavigate();` near the top) — the sign-in button routes to Settings rather than opening `SignInButtons` inline here, because this bar is deliberately small and fixed-position; Settings already has the full sign-in card (`CloudSyncCard`, Task 4).

- [ ] **Step 2: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TtsPlayer.jsx
git commit -m "fix: tell a blocked subscriber to sign in, not to watch an ad they don't need"
```

---

## Task 9: `SelectScreen` — folder creation gate

**Files:**
- Modify: `src/screens/SelectScreen.jsx`

**Interfaces:**
- Consumes: `useProAccess` from `../context/ProAccessContext` (Task 1), `gateContentFor` from `../lib/proAccessCopy` (Task 5), `SignInGateModal` from `../components/SignInGateModal` (Task 6).

- [ ] **Step 1: Swap the entitlement source and branch the gate**

Add imports:
```js
import { useProAccess } from '../context/ProAccessContext';
import { gateContentFor } from '../lib/proAccessCopy';
import SignInGateModal from '../components/SignInGateModal';
```

Change:
```js
  const { books, loadingData, settings } = useApp();
  const { playSections, playing, stop } = useTts();
  const isPro = !!settings.isPro; // v18 #4: folder creation is Pro-only
```
to:
```js
  const { books, loadingData } = useApp();
  const { playSections, playing, stop } = useTts();
  const { isPro, state: proAccessState } = useProAccess(); // v18 #4: folder creation is Pro-only
```
(Verified `settings.isPro` at this line is the only `settings.` reference in this file — `settings` is safe to drop from the `useApp()` destructure entirely, not just its `isPro` field.)

The click handler that opens `setProHint(true)` for a blocked tap:
```jsx
                onClick={() => isPro ? setFolderModal({ open: true, mode: 'create', focusId: null }) : setProHint(true)}
```
This line is unchanged — `isPro` now already carries the full gate (signed-in + device-allowed), so a blocked tap still sets `proHint`. What changes is what `proHint` renders. Current:
```jsx
      {proHint && (
        <ProGateModal
          title="สร้างโฟลเดอร์ — ฟีเจอร์ Pro"
          body="สมาชิก Pro สร้างโฟลเดอร์จัดหมวดมาตราได้ไม่จำกัด"
          onClose={() => setProHint(false)}
        />
      )}
```
Replace with a branch on `gateContentFor`'s `kind`:
```jsx
      {proHint && gateContentFor(proAccessState, 'folder')?.kind === 'buy' && (
        <ProGateModal
          title="สร้างโฟลเดอร์ — ฟีเจอร์ Pro"
          body="สมาชิก Pro สร้างโฟลเดอร์จัดหมวดมาตราได้ไม่จำกัด"
          onClose={() => setProHint(false)}
        />
      )}
      {proHint && gateContentFor(proAccessState, 'folder')?.kind !== 'buy' && (
        <SignInGateModal state={proAccessState} feature="folder" onClose={() => setProHint(false)} />
      )}
```

- [ ] **Step 2: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SelectScreen.jsx
git commit -m "feat: gate folder creation on signed-in Pro access, distinguishing unpaid from unsigned-in"
```

---

## Task 10: `ReaderScreen` — highlight, bookmark, and ad calls

**Files:**
- Modify: `src/screens/ReaderScreen.jsx`

**Interfaces:**
- Consumes: `useProAccess` from `../context/ProAccessContext` (Task 1), `gateContentFor` from `../lib/proAccessCopy` (Task 5), `SignInGateModal` from `../components/SignInGateModal` (Task 6).

- [ ] **Step 1: Add the shared imports and the gated value**

Add imports:
```js
import { useProAccess } from '../context/ProAccessContext';
import { gateContentFor } from '../lib/proAccessCopy';
import SignInGateModal from '../components/SignInGateModal';
```
Add, near wherever `settings` is currently destructured from `useApp()` in this component:
```js
  const { isPro: proAccessIsPro, state: proAccessState } = useProAccess();
```

- [ ] **Step 2: Wire the ad calls**

Three call sites currently read `settings.isPro`:
```js
  useEffect(() => { loadInterstitial(settings.isPro); }, []); // eslint-disable-line react-hooks/exhaustive-deps
```
and
```js
      if (shouldShowAd) showInterstitial(settings.isPro);
      refreshBanner(settings.isPro);
```
Replace all three `settings.isPro` with `proAccessIsPro`:
```js
  useEffect(() => { loadInterstitial(proAccessIsPro); }, []); // eslint-disable-line react-hooks/exhaustive-deps
```
```js
      if (shouldShowAd) showInterstitial(proAccessIsPro);
      refreshBanner(proAccessIsPro);
```

- [ ] **Step 3: Wire the highlight and bookmark gates**

Find how `proGate` (the state that triggers `ProGateModal`) is declared and rendered in this file — it is a `useState` holding `{ title, body }` or `null`, set by the two `else setProGate({...})` calls already read in this plan's context section. Change the highlight button's handler from:
```jsx
              onClick={() => {
                if (settings.isPro) setHlMode(v => !v);
                else setProGate({
                  title: 'ไฮไลท์ตัวบท — ฟีเจอร์ Pro',
                  body: 'สมาชิก Pro ระบายสีเน้นข้อความในตัวบทได้ และไฮไลท์จะถูกบันทึกไว้',
                });
              }}
```
to:
```jsx
              onClick={() => {
                if (proAccessIsPro) setHlMode(v => !v);
                else setProGate('highlight');
              }}
```
and the bookmark button's handler from:
```jsx
              onClick={() => {
                if (settings.isPro) toggleBookmark(section);
                else setProGate({
                  title: 'บุ๊กมาร์ก — ฟีเจอร์ Pro',
                  body: 'สมาชิก Pro บันทึกมาตราที่สนใจไว้ในคลังส่วนตัว เข้าถึงได้ทุกเมื่อ',
                });
              }}
```
to:
```jsx
              onClick={() => {
                if (proAccessIsPro) toggleBookmark(section);
                else setProGate('bookmark');
              }}
```
`setProGate` now stores the FEATURE NAME (`'highlight'` | `'bookmark'`) instead of a `{title, body}` object, so the render site can look up `gateContentFor(proAccessState, proGate)` and pick the right modal. Find the render of `proGate` (search `{proGate &&` in this file) — it currently renders `<ProGateModal title={proGate.title} body={proGate.body} onClose={...} />`. Replace it with:
```jsx
      {proGate && gateContentFor(proAccessState, proGate)?.kind === 'buy' && (
        <ProGateModal
          title={gateContentFor(proAccessState, proGate).title}
          body={gateContentFor(proAccessState, proGate).body}
          onClose={() => setProGate(null)}
        />
      )}
      {proGate && gateContentFor(proAccessState, proGate)?.kind !== 'buy' && (
        <SignInGateModal state={proAccessState} feature={proGate} onClose={() => setProGate(null)} />
      )}
```
(If `setProGate(null)` differs from the file's existing "closed" sentinel — e.g. it might use `false` — match whatever the existing `useState` initializer and other call sites already use, so the closed state stays consistent. Check `const [proGate, setProGate] = useState(...)` for the exact initial value before writing the reset calls.)

- [ ] **Step 4: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ReaderScreen.jsx
git commit -m "feat: gate highlight, bookmark, and ads on signed-in Pro access"
```

---

## Task 11: `AdBanner` dev-preview consistency

**Files:**
- Modify: `src/components/AdBanner.jsx`

**Interfaces:**
- Consumes: `useProAccess` from `../context/ProAccessContext` (Task 1).

This component only renders in the browser dev-preview (native builds return `null` unconditionally before reaching the Pro check) — low stakes, included so no `settings.isPro` reference is left inconsistent with the rest of the app.

- [ ] **Step 1: Swap the source**

Change:
```jsx
import { useApp } from '../context/AppContext';
```
to:
```jsx
import { useProAccess } from '../context/ProAccessContext';
```
and:
```jsx
  const { settings } = useApp();
  const isPro = settings.isPro;
```
to:
```jsx
  const { isPro } = useProAccess();
```

- [ ] **Step 2: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdBanner.jsx
git commit -m "chore: match AdBanner's dev-preview gate to the rest of the app"
```

---

## Task 12: Sign in with Apple — iOS entitlement

**Files:**
- Create: `ios/App/App/App.entitlements`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`
- Create: `ios/APPLE_SIGNIN_SETUP.md` (owner runbook)

**Interfaces:**
- Consumes: nothing.
- Produces: the entitlements file the CI-driven `xcodebuild archive` step (`.github/workflows/build-ipa.yml`) embeds into the signed IPA.

Sign in with Apple requires a capability that only exists once (a) the App ID in the Apple Developer portal has "Sign In with Apple" enabled, and (b) the provisioning profile used to sign the build is regenerated after that. Both are account actions the owner must do — this task creates the file side of the pairing and documents the owner's half; it cannot complete the pairing itself.

- [ ] **Step 1: Create the entitlements file**

`ios/App/App/App.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
</dict>
</plist>
```

- [ ] **Step 2: Point both build configurations at it**

In `ios/App/App.xcodeproj/project.pbxproj`, the Debug config (`504EC3171FED79650016851F`) currently reads:
```
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 65;
				INFOPLIST_FILE = App/Info.plist;
```
Add `CODE_SIGN_ENTITLEMENTS` immediately after `CODE_SIGN_STYLE`:
```
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 65;
				INFOPLIST_FILE = App/Info.plist;
```
The Release config (`504EC3181FED79650016851F`) currently reads:
```
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 65;
				INFOPLIST_FILE = App/Info.plist;
```
Apply the identical addition:
```
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 65;
				INFOPLIST_FILE = App/Info.plist;
```
(Leave `CURRENT_PROJECT_VERSION = 65;` as-is here — Task 13 bumps it to 66 in both places together with the other three version files, in the same pass as the rest of that task's version bump, to keep every version-touching edit in one commit as this plan's other tasks have done throughout.)

- [ ] **Step 3: Write the owner runbook**

`ios/APPLE_SIGNIN_SETUP.md`:
```markdown
# Sign in with Apple — owner setup

Code-side wiring (entitlements file, CODE_SIGN_ENTITLEMENTS build setting,
Firebase Apple provider, the in-app buttons) is already done. Two account
actions remain, both on the Apple Developer / Firebase side, neither doable
from a checked-out repo:

## 1. Enable the capability on the App ID

1. https://developer.apple.com/account → Certificates, Identifiers & Profiles → Identifiers
2. Select the App ID for `com.lawcodev2.app`
3. Check **Sign In with Apple** → Save

## 2. Regenerate the provisioning profile

The existing "Juris Voice App Store" profile (referenced by
`ios/ExportOptions.plist` and the Release build config) was generated
before the capability existed on the App ID, so it does not grant the
entitlement — Apple ties provisioning profiles to the exact capability set
present on the App ID at generation time.

1. Profiles → find "Juris Voice App Store" → Edit
2. Confirm Sign In with Apple now appears as an available capability (it
   will, automatically, once step 1 is saved) → Save (this regenerates the
   profile; the name stays the same)
3. Download the regenerated `.mobileprovision`
4. Re-encode it and update the `IOS_PROVISIONING_PROFILE_BASE64` GitHub
   Actions secret the same way the original was set:
   ```bash
   base64 -i "Juris Voice App Store.mobileprovision" | pbcopy
   ```
   (or on Windows, `certutil -encode` then strip the header/footer lines)
   then paste into the repo's Settings → Secrets → Actions →
   `IOS_PROVISIONING_PROFILE_BASE64`.

## 3. Enable the provider in the Firebase console

Firebase project `juris-voice` → Authentication → Sign-in method → Apple →
Enable. No extra configuration is required for the Firebase-SDK flow this
app uses (no server-side client secret / private key needed — that is only
for the web OAuth redirect flow, which this app does not use).

## Verifying

After the next CI build, TestFlight → the two sign-in buttons should both
appear in Settings and in any Pro-gated sign-in prompt on iOS; on Android
only the Google button appears (Apple's guidance is not to show it where
it cannot work). Tapping Apple should present the native system sheet, not
an error — a "invalid_client" or entitlement-related failure means step 1
or step 2 above did not take effect yet (profile regeneration can take a
few minutes to propagate).
```

- [ ] **Step 4: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS — this task touches no JS, only iOS project files and a doc, so this step is a regression guard, not new coverage.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/App.entitlements ios/App/App.xcodeproj/project.pbxproj ios/APPLE_SIGNIN_SETUP.md
git commit -m "feat(ios): add the Sign in with Apple entitlement and owner setup runbook"
```

---

## Task 13: Version bump and device checklist

**Files:**
- Modify: `src/config.js`
- Modify: `android/app/build.gradle`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`
- Create: `docs/superpowers/plans/2026-08-06-pro-login-gate-checklist.md`

**Interfaces:**
- Consumes: everything above.
- Produces: build 66.

- [ ] **Step 1: Bump all four numbers together**

`src/config.js`: `export const APP_VERSION_CODE = 66;`
`android/app/build.gradle`: `versionCode 66`
`ios/App/App.xcodeproj/project.pbxproj`: `CURRENT_PROJECT_VERSION = 66;` in **both** the Debug and Release configurations (the same two blocks Task 12 Step 2 touched).

Leave `APP_VERSION_NAME` and gradle `versionName` at `1.0.4` — they must stay equal to each other; this is not a marketing-version change.

- [ ] **Step 2: Run the version-sync test**

```bash
npx vitest run src/config.versionSync.test.js
```
Expected: PASS.

- [ ] **Step 3: Write the device checklist**

`docs/superpowers/plans/2026-08-06-pro-login-gate-checklist.md`:
```markdown
# Pro login gate — device checklist (build 66)

## iOS

- [ ] 1. Buy Pro in sandbox, do NOT sign in with Google or Apple. Open Settings:
      Pro card shows "Pro รอเปิดใช้งาน" with both sign-in buttons — Apple's
      button uses the native system style, appears above/beside Google's.
- [ ] 2. From Reader, tap highlight without signing in. Modal reads
      "เข้าสู่ระบบเพื่อใช้งาน Pro" — NOT "ไฮไลท์ตัวบท — ฟีเจอร์ Pro". Tapping the
      sign-in button inside the modal, completing sign-in, closes the modal
      and the tap's underlying action is now available (tap highlight again
      — it toggles).
- [ ] 3. Same check for bookmark (Reader) and folder creation (เลือกฟัง tab).
- [ ] 4. Sign in with Google. Ads disappear, folder creation works, listening
      is unlimited (no quota bar).
- [ ] 5. Sign out. Ads reappear, quota bar reappears, highlight/bookmark/folder
      gates re-block with the sign-in modal again (not the "buy Pro" modal —
      the subscription itself is still owned).
- [ ] 6. Sign in with Apple instead of Google on a fresh sandbox tester Apple
      ID. Same result as step 4. Confirm no "invalid_client" or entitlement
      error appears (see `ios/APPLE_SIGNIN_SETUP.md` if one does).
- [ ] 7. Sign in on 4 different sandbox-capable simulators/devices with the
      SAME account. The 4th shows "ใช้งานครบจำนวนอุปกรณ์แล้ว" (device-slot gate,
      not the sign-in gate) with a "จัดการอุปกรณ์" button that lands on
      Settings' device list.
- [ ] 8. From Settings on any already-signed-in device, revoke one of the
      other 3 devices. The 4th device (from step 7), on its next Pro-gated
      tap, is now allowed.
- [ ] 9. A genuinely FREE (non-purchasing) account still sees the original
      "buy Pro" modals (ProGateModal) everywhere, unchanged from before this
      plan — never the sign-in modal.
- [ ] 10. TTS quota-blocked bar: a signed-out subscriber sees "เข้าสู่ระบบ" as
      the button, not "ดูโฆษณา +N มาตรา". A genuinely free user still sees the
      ad-watch button as before.

## Android

- [ ] 11. Repeat steps 1, 2, 4, 5 on Android. Only the Google button appears
      anywhere sign-in is offered — no Apple button.
- [ ] 12. Existing Pro subscribers who were already signed in before this
      build: reopen the app. Nothing changes for them — Pro still active,
      no new prompt (this build only starts gating previously-ungated call
      sites; someone who already satisfies `useEffectivePro`'s `'pro'` state
      sees no behavior change at all).

## Rollback

If anything above fails and cannot be fixed quickly: this plan added no new
flag to gate itself behind (unlike the receipt validator's
`RECEIPT_VALIDATOR_URL`), because the underlying `useEffectivePro`/
`useDeviceGate` machinery was already live and correct — this plan only
wires MORE call sites to it. Reverting means re-pointing the 6 call sites in
Tasks 7–11 back to `settings.isPro` (`git revert` those commits) and
shipping a build without the sign-in requirement; Apple sign-in itself
(Tasks 2–4, 12) can stay shipped and simply unused.
```

- [ ] **Step 4: Run the whole suite and build**

```bash
npm test && npm run build
```
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.js android/app/build.gradle ios/App/App.xcodeproj/project.pbxproj docs/superpowers/plans/2026-08-06-pro-login-gate-checklist.md
git commit -m "chore: bump to build 66 for the Pro login gate"
```

Do not push — the controller pushes once the plan's tasks and final review are complete, per this branch's established workflow.

---

## Self-review notes

- **Spec coverage:** device-cap infrastructure reused not rebuilt (Tasks 1, 4); Apple sign-in added and made mandatory-equivalent with Google per Guideline 4.8 (Tasks 2, 3, 12); single shared context so the auth listener and device fetch run once (Task 1); every real Pro gate named in the brief is rewired — TTS quota (Task 7), TtsPlayer's quota-blocked prompt (Task 8), folder creation (Task 9), highlight/bookmark/ads (Task 10), ad banner (Tasks 7, 11).
- **The one property every wiring task shares:** a subscriber who already paid must never see "buy Pro" copy again — only "sign in" or "manage devices." This is centralized in one pure, mutation-tested function (Task 5) precisely so it cannot drift per call site the way the four `ProGateModal` copies had already started to (each was hand-written separately before this plan).
- **Deliberately not built (YAGNI):** no new feature flag — `ENABLE_AUTH_GATE` and the device-cap logic were already live in production paths (`CloudSyncCard`) before this plan; adding a second flag on top would gate an already-shipped, already-correct decision a second time for no reason. No change to `useDeviceGate`, `useEffectivePro`, or the Firestore device schema — all reused as-is.
- **Not addressed here:** Android equivalent of Apple's Guideline 4.8 (none — Google has no analogous requirement); a "restore purchases then prompt sign-in" combined flow (out of scope — sign-in and purchase restore are already two independent, already-working actions, and this plan does not need to merge them into one button); revoking a device server-side when Apple/Google itself reports the subscription canceled (that is the receipt validator's job, already shipped, and orthogonal to this plan's device-cap machinery).
