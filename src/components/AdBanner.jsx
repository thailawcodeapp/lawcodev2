import { useApp } from '../context/AppContext';

// Evaluate at runtime — calling Capacitor.isNativePlatform() at module-load
// time can return false on Android if the bridge hasn't been wired into the
// WebView yet, locking the constant to false for the rest of the session.
const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// On device  → native AdMob banner is managed centrally in App.jsx (persistent overlay).
//              This component renders nothing — its placement in DOM is only for browser preview.
// In browser → shows a placeholder div for layout preview.
// Pro users  → renders nothing in either case.
export default function AdBanner({ size = 'banner' }) {
  const { settings } = useApp();
  const isPro = settings.isPro;

  // Native: DOM is empty — the ad is a native overlay outside the WebView
  if (isNative()) return null;

  // Browser dev preview
  if (isPro) return null;
  const height = size === 'large' ? 100 : 52;
  return (
    <div
      className="w-full flex items-center justify-center border-y border-rule-soft dark:border-ink-soft bg-card dark:bg-dark-card flex-shrink-0"
      style={{ height, minHeight: height }}
    >
      <div className="flex flex-col items-center gap-1 opacity-40">
        <div className="font-ui text-[9px] tracking-widest uppercase text-ink-soft dark:text-rule-soft">
          Advertisement
        </div>
        <div className="font-display text-[11px] italic text-ink-soft dark:text-rule-soft">
          AdMob · {size === 'large' ? '320 × 100' : 'Adaptive Banner'}
        </div>
      </div>
    </div>
  );
}
