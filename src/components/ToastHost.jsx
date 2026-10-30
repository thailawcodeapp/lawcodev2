// Renders whatever src/lib/toast.js broadcasts. Mounted once, next to the
// player, so any screen can report a result without owning UI for it.
import { useEffect, useState } from 'react';
import { useTts } from '../context/TtsContext';
import { subscribeToast } from '../lib/toast';

const VISIBLE_MS = 2200;

// Clearances above the bottom edge: the tab bar alone, or the tab bar plus the
// floating mini-player when it is up, so the toast never lands on top of the
// transport controls.
const ABOVE_TAB_BAR = 64;
const ABOVE_PLAYER = 128;

const ACTION_MS = 4000; // long enough to reach for "เลิกทำ"

export default function ToastHost() {
  const { playing, paused } = useTts();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;
    const off = subscribeToast((msg, options) => {
      setToast({ msg, action: options?.action ?? null });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), options?.action ? ACTION_MS : VISIBLE_MS);
    });
    return () => { off(); clearTimeout(timer); };
  }, []);

  if (!toast) return null;

  // Measured from .phone-shell, which already starts above the gesture bar —
  // see the note on bottom offsets in TtsPlayer.
  const bottom = playing || paused ? ABOVE_PLAYER : ABOVE_TAB_BAR;

  return (
    <div
      className="fixed left-0 right-0 z-50 px-6 flex justify-center pointer-events-none"
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      <div className="bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-4 py-2.5 max-w-full flex items-center gap-3">
        <div className="font-ui text-[12px] font-medium text-center">{toast.msg}</div>
        {toast.action && (
          <button
            className="pointer-events-auto tap-btn font-ui text-[12px] font-bold text-ochre flex-shrink-0"
            onClick={() => { toast.action.onPress(); setToast(null); }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
