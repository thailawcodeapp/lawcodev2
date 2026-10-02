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
