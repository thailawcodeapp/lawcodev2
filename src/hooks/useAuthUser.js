// Reactive auth state. Returns { user, loading } where user is the
// FirebaseUser object (or null) and loading is true until the first
// auth-state callback fires.

import { useEffect, useState } from 'react';
import { onAuthChanged } from '../services/sync/auth';
import { ENABLE_AUTH_GATE } from '../config';

export function useAuthUser() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(ENABLE_AUTH_GATE);

  useEffect(() => {
    if (!ENABLE_AUTH_GATE) {
      setLoading(false);
      return;
    }
    const unsub = onAuthChanged((u) => {
      setUser(u || null);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
