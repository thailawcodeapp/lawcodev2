// The one place both sign-in providers are offered. Used by CloudSyncCard
// (the Settings screen) and SignInGateModal (the inline gate). Apple only
// renders on iOS — Android/web have no Apple ID to sign in with, and Apple's
// own guidance is that the button should not appear on platforms where it
// cannot work.
//
// Long-pressing the Google button skips Android's Credential Manager and
// opens the classic Google account picker (see signInWithGoogle). It is not
// labelled: it exists for testing and for support to tell a customer about.
import { useMemo, useRef, useState } from 'react';
import { signInWithGoogle, signInWithApple } from '../services/sync/auth';
import { createLongPress } from '../lib/longPress';

const isIos = () =>
  typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'ios';

export default function SignInButtons({ onSignedIn, onError }) {
  const [busy, setBusy] = useState(null); // 'google' | 'apple' | null

  const run = async (kind, fn) => {
    if (busy !== null) return;
    setBusy(kind);
    const r = await fn();
    setBusy(null);
    if (r.ok) onSignedIn?.();
    else onError?.(r.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  // The press tracker keeps its timer across renders, so it is made once and
  // reaches the current `run` (and with it the current busy state) via a ref.
  const runRef = useRef(run);
  runRef.current = run;
  const googlePress = useMemo(() => createLongPress({
    onTap: () => runRef.current('google', () => signInWithGoogle()),
    onLongPress: () => runRef.current('google', () => signInWithGoogle({ classicPicker: true })),
  }), []);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy !== null}
        {...googlePress}
        style={{ WebkitTouchCallout: 'none' }}
        className="tap-btn hit-44 w-full select-none font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper disabled:opacity-50"
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
          {busy === 'apple' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Apple'}
        </button>
      )}
    </div>
  );
}
