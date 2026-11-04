// Google Sign-In wrapper.
//
// All public functions are guarded by the ENABLE_AUTH_GATE flag and the
// Capacitor native runtime — calling them on web or with the flag off
// returns a benign null/false rather than throwing.

import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { App as CapApp } from '@capacitor/app';
import { syncEnabledOnPlatform } from './firebase';

// Subscribe to auth state changes. Returns an unsubscribe function.
// Listener receives the current FirebaseUser or null.
export function onAuthChanged(listener) {
  if (!syncEnabledOnPlatform()) {
    listener(null);
    return () => {};
  }
  let handle;
  FirebaseAuthentication.addListener('authStateChange', (event) => {
    listener(event?.user || null);
  }).then((h) => { handle = h; });
  // Also push the current value once
  FirebaseAuthentication.getCurrentUser()
    .then((res) => listener(res?.user || null))
    .catch(() => listener(null));
  return () => { handle?.remove(); };
}

// Returns the current FirebaseUser (or null) — synchronous-friendly poll.
export async function getCurrentUser() {
  if (!syncEnabledOnPlatform()) return null;
  try {
    const res = await FirebaseAuthentication.getCurrentUser();
    return res?.user || null;
  } catch {
    return null;
  }
}

// How long a sign-in may sit with no answer while our own screen is in
// front. Time spent in Google's own UI (the account sheet, the sign-in
// page) does not count: that UI pauses our activity, which stops the clock.
export const SIGN_IN_STALL_MS = 30_000;
export const SIGN_IN_STALLED =
  'การเข้าสู่ระบบไม่ตอบสนอง กรุณาปิดแอปแล้วเปิดใหม่ก่อนลองอีกครั้ง';

// Credential Manager (the plugin's default on Android) only offers Google
// accounts it can see on the device. When it sees none (no account, the app
// installed in Samsung Secure Folder or a work profile, Google switched off
// as a passwords provider) it fails with "No credentials available" and
// never offers a way to sign in.
const isNoCredential = (message) => /no credential/i.test(message);

const errorText = (e) => String(e?.message || e);

// Resolves with run()'s result, or with SIGN_IN_STALLED when run() has not
// settled after SIGN_IN_STALL_MS of our app being in the foreground. Some
// native failures never answer the JS call at all, which left the button
// stuck on "กำลังเข้าสู่ระบบ…" until the app was killed.
function withStallGuard(run, ms = SIGN_IN_STALL_MS) {
  return new Promise((resolve) => {
    let timer = null;
    let settled = false;
    const disarm = () => { clearTimeout(timer); timer = null; };
    const arm = () => {
      disarm();
      timer = setTimeout(() => finish({ ok: false, error: SIGN_IN_STALLED }), ms);
    };
    const listeners = [
      CapApp.addListener('pause', disarm),
      CapApp.addListener('resume', arm),
    ];
    function finish(result) {
      if (settled) return;
      settled = true;
      disarm();
      listeners.forEach((l) =>
        Promise.resolve(l).then((h) => h?.remove()).catch(() => {}));
      resolve(result);
    }
    arm();
    run().then(finish, (e) => finish({ ok: false, error: errorText(e) }));
  });
}

// Trigger the Google sign-in flow. Returns { ok, user?, error? }.
//
// Tries Credential Manager first (the smooth one-tap sheet). If it reports
// no credentials, falls back to the classic Google Sign-In picker, which
// lists every account and has "Add another account", leading to Google's
// own sign-in page.
//
// classicPicker: true skips Credential Manager and opens the classic picker
// straight away. Reached by long-pressing the button: lets us test the
// fallback on a phone where Credential Manager works, and gives support a
// way round a Credential Manager that misbehaves on one customer's phone.
export async function signInWithGoogle({ classicPicker = false } = {}) {
  if (!syncEnabledOnPlatform()) {
    return { ok: false, error: 'Sync not available on this platform' };
  }
  return withStallGuard(async () => {
    if (!classicPicker) {
      try {
        const result = await FirebaseAuthentication.signInWithGoogle();
        return { ok: true, user: result?.user || null };
      } catch (e) {
        if (!isNoCredential(errorText(e))) return { ok: false, error: errorText(e) };
      }
    }
    try {
      const result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
      return { ok: true, user: result?.user || null };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  });
}

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

// Sign out everywhere. Does NOT clear local data — only revokes the session.
export async function signOut() {
  if (!syncEnabledOnPlatform()) return { ok: true };
  try {
    await FirebaseAuthentication.signOut();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
