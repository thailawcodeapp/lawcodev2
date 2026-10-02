// Manages device registration + the device cap.
//
// Behaviour while the flag is OFF: returns sensible defaults (allowed=true,
// devices=[]) so consumers can render without branching on the flag.
//
// Behaviour while the flag is ON:
//   • on sign-in → registerDevice() then refresh the device list
//   • exposes { devices, allowed, refresh, revoke }

import { useCallback, useEffect, useState } from 'react';
import { ENABLE_AUTH_GATE } from '../config';
import {
  registerDevice, listDevices, isDeviceAllowed, revokeDevice, getDeviceId,
} from '../services/sync/device';

export function useDeviceGate(uid) {
  const [devices, setDevices] = useState([]);
  const [allowed, setAllowed] = useState(true);
  const [myId,    setMyId]    = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!ENABLE_AUTH_GATE || !uid) return;
    setLoading(true);
    const [list, ok, id] = await Promise.all([
      listDevices(uid),
      isDeviceAllowed(uid),
      getDeviceId(),
    ]);
    setDevices(list);
    setAllowed(ok);
    setMyId(id);
    setLoading(false);
  }, [uid]);

  // On sign-in: register this device, then refresh state
  useEffect(() => {
    let cancelled = false;
    if (!ENABLE_AUTH_GATE || !uid) {
      setDevices([]);
      setAllowed(true);
      return;
    }
    (async () => {
      await registerDevice(uid);
      if (!cancelled) await refresh();
    })();
    return () => { cancelled = true; };
  }, [uid, refresh]);

  const revoke = useCallback(async (deviceId) => {
    if (!uid) return { ok: false };
    const r = await revokeDevice(uid, deviceId);
    if (r.ok) await refresh();
    return r;
  }, [uid, refresh]);

  return { devices, allowed, myDeviceId: myId, loading, refresh, revoke };
}
