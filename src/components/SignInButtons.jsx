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
