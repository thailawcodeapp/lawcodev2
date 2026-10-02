// Google Sign-In wrapper.
//
// All public functions are guarded by the ENABLE_AUTH_GATE flag and the
// Capacitor native runtime — calling them on web or with the flag off
// returns a benign null/false rather than throwing.

import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
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

// Trigger the Google sign-in flow. Returns { ok, user?, error? }.
export async function signInWithGoogle() {
  if (!syncEnabledOnPlatform()) {
    return { ok: false, error: 'Sync not available on this platform' };
  }
  try {
    const result = await FirebaseAuthentication.signInWithGoogle();
    return { ok: true, user: result?.user || null };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
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
