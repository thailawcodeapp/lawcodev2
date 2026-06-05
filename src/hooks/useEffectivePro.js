// Combines the three signals into a single "is Pro really active now" value.
//
// effectivePro = playStoreActive && (flag-off ? true : (signedIn && deviceAllowed))
//
// When the cloud-sync flag is OFF this reduces to plain settings.isPro —
// every existing call site can switch to useEffectivePro() with no
// behaviour change until the flag flips.

import { useApp } from '../context/AppContext';
import { useAuthUser } from './useAuthUser';
import { useDeviceGate } from './useDeviceGate';
import { ENABLE_AUTH_GATE } from '../config';

export function useEffectivePro() {
  const { settings } = useApp();
  const { user, loading: authLoading } = useAuthUser();
  const { allowed: deviceAllowed, devices, myDeviceId, revoke, loading: deviceLoading } = useDeviceGate(user?.uid);

  const playStoreActive = !!settings.isPro;

  let effectivePro;
  let state; // 'pro' | 'needs-signin' | 'needs-device-slot' | 'free' | 'loading'

  if (!ENABLE_AUTH_GATE) {
    effectivePro = playStoreActive;
    state = playStoreActive ? 'pro' : 'free';
  } else if (authLoading) {
    effectivePro = false;
    state = 'loading';
  } else if (!playStoreActive) {
    effectivePro = false;
    state = 'free';
  } else if (!user) {
    effectivePro = false;
    state = 'needs-signin';
  } else if (deviceLoading) {
    effectivePro = false;
    state = 'loading';
  } else if (!deviceAllowed) {
    effectivePro = false;
    state = 'needs-device-slot';
  } else {
    effectivePro = true;
    state = 'pro';
  }

  return {
    isPro: effectivePro,
    state,
    playStoreActive,
    user,
    devices,
    myDeviceId,
    revokeDevice: revoke,
  };
}
