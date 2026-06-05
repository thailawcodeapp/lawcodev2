// Triggers cloud pull/push at the right moments.
//
// Wiring (called once at app top level):
//   • on sign-in success (uid changes from null → string) → pullAndMerge once
//   • on app resume + uid present  → tryPush()  (subject to throttle)
//   • on uid changes back to null   → no-op (sign-out path)

import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { ENABLE_AUTH_GATE } from '../config';
import { pullAndMerge, tryPush } from '../services/sync/orchestrator';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export function useCloudSync(user) {
  const pulledForUidRef = useRef(null);

  // Pull once per sign-in session
  useEffect(() => {
    if (!ENABLE_AUTH_GATE || !user?.uid) return;
    if (pulledForUidRef.current === user.uid) return;
    pulledForUidRef.current = user.uid;
    pullAndMerge(user.uid, user).catch(() => {
      // Pull failure is non-fatal — the user can keep using local data.
      // Reset the gate so a later attempt (e.g. on resume) can retry.
      pulledForUidRef.current = null;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Try to push on app resume + at mount
  useEffect(() => {
    if (!ENABLE_AUTH_GATE || !user?.uid) return;

    const run = () => tryPush(user.uid).catch(() => {});
    run(); // initial attempt on mount/sign-in

    if (!isNative()) return;
    let handle;
    CapApp.addListener('appStateChange', (state) => {
      if (state.isActive) run();
    }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, [user?.uid]);
}
