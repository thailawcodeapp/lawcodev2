import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ProAccessProvider, useProAccess } from './context/ProAccessContext';
import { TtsProvider } from './context/TtsContext';
import HomeScreen from './screens/HomeScreen';
import BookScreen from './screens/BookScreen';
import ReaderScreen from './screens/ReaderScreen';
import SearchScreen from './screens/SearchScreen';
import SelectScreen from './screens/SelectScreen';
import StatsScreen from './screens/StatsScreen';
import BookmarksScreen from './screens/BookmarksScreen';
import SettingsScreen from './screens/SettingsScreen';
import TtsPlayer from './components/TtsPlayer';
import ToastHost from './components/ToastHost';
import UpdateModal from './components/UpdateModal';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initAdMob, showBanner, removeBanner, requestTrackingIfNeeded } from './lib/admob';
import { initIAP } from './lib/iap';
import { shouldRevokeForCachedExpiry } from './lib/proExpiry';
import { checkForUpdate } from './lib/versionCheck';
import { applyIphoneScale } from './lib/iphoneScale';
import { applyIpadScale } from './lib/ipadScale';
import { applyAndroidScale } from './lib/androidScale';
import { initTapFeedback } from './lib/tapFeedback';
import { useCloudSync } from './hooks/useCloudSync';
import { ENABLE_AUTH_GATE, RECEIPT_VALIDATOR_URL } from './config';

// Capacitor plugins are no-ops in browser — safe to import statically
const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

function AndroidBackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isNative()) return;
    let handle;
    CapApp.addListener('backButton', () => {
      if (pathname === '/') {
        CapApp.exitApp();
      } else if (/^\/code\/[^/]+\/section\//.test(pathname)) {
        // ReaderScreen → back to BookScreen
        const bookId = pathname.split('/')[2];
        navigate(`/code/${bookId}`);
      } else if (/^\/code\/[^/]+$/.test(pathname)) {
        // BookScreen → back to Home
        navigate('/');
      } else {
        navigate(-1);
      }
    }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, [pathname, navigate]);

  return null;
}

function VersionGate() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    checkForUpdate().then(r => { if (r) setUpdate(r); });
  }, []);

  if (!update) return null;
  return (
    <UpdateModal
      type={update.type}
      message={update.message}
      onDismiss={() => setUpdate(null)}
    />
  );
}

function CloudSyncBootstrap() {
  // Drives cloud sync (pull-on-sign-in + push-on-resume) when the flag is on.
  // `user` comes from the shared ProAccessProvider so this does not open a
  // second Firebase auth listener alongside the one the provider already has.
  const { user } = useProAccess();
  useCloudSync(user);
  return null;
}

function ThemeWrapper({ children }) {
  const { settings, setSettings } = useApp();
  const { isPro: proAccessIsPro } = useProAccess();

  // Initialise IAP store; sync entitlement to settings.isPro.
  //
  // Two writers, in order. The store's own signal wins when it speaks — it is
  // backed by a validator response. When it stays silent (offline, so
  // initialize() never completes) the cached expiry is consulted instead, so a
  // subscription that lapsed months ago cannot be kept alive by staying
  // offline. A verdict of 'unknown' leaves the flag exactly as it was.
  useEffect(() => {
    initIAP((proOwned, { expiresAt } = {}) => {
      setSettings(prev => {
        const next = { ...prev };
        let changed = false;
        if (prev.isPro !== proOwned) { next.isPro = proOwned; changed = true; }
        if (expiresAt != null && prev.proExpiresAt !== expiresAt) {
          next.proExpiresAt = expiresAt; changed = true;
        }
        return changed ? next : prev;
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shouldRevokeForCachedExpiry({
      isPro: settings.isPro,
      validatorConfigured: !!RECEIPT_VALIDATOR_URL,
      expiresAt: settings.proExpiresAt,
      now: Date.now(),
    })) {
      setSettings(prev => (prev.isPro ? { ...prev, isPro: false } : prev));
    }
  }, [settings.isPro, settings.proExpiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.isDarkMode);
  }, [settings.isDarkMode]);

  // Scale the whole app UI by the S/M/L/XL setting. iPhone uses M as its +20%
  // baseline; iPad uses L as its natural screen-fill size; Android phones use
  // M as 1.00, i.e. today's layout exactly, so the default is untouched. Each
  // helper is a no-op off its own platform, so web and Android tablets stay as
  // they are. Retries cover the Capacitor platform-detect race (same cold-start
  // timing as admob); resize handles rotation and iPad split-view.
  useEffect(() => {
    const applyScales = () => {
      applyIphoneScale(settings.fontScale);
      applyIpadScale(settings.fontScale);
      applyAndroidScale(settings.fontScale);
    };
    applyScales();
    const t1 = setTimeout(applyScales, 300);
    const t2 = setTimeout(applyScales, 1500);
    window.addEventListener('resize', applyScales);
    window.addEventListener('orientationchange', applyScales);

    // iPad: returning from the background sometimes leaves WKWebView reporting
    // a stale, phone-sized viewport with no `resize` event to correct it — the
    // UI stays shrunk into the top-left corner until the app is force-quit and
    // relaunched. `appStateChange` fires on every foreground; re-applying after
    // a short delay lets WKWebView finish settling its bounds first.
    let resumeHandle;
    if (isNative()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) setTimeout(applyScales, 300);
      }).then(h => { resumeHandle = h; });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', applyScales);
      window.removeEventListener('orientationchange', applyScales);
      resumeHandle?.remove();
    };
  }, [settings.fontScale]);

  useEffect(() => {
    if (!isNative()) return;
    const bg = settings.isDarkMode ? '#0f0e0c' : '#ece4d4';
    StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
    StatusBar.setStyle({ style: settings.isDarkMode ? Style.Dark : Style.Light }).catch(() => {});
  }, [settings.isDarkMode]);

  // Persistent banner — show once at the app level, not per screen,
  // to avoid race conditions when navigating between routes.
  useEffect(() => {
    if (!isNative()) return;
    if (proAccessIsPro) {
      removeBanner();
    } else {
      showBanner(false);
    }
  }, [proAccessIsPro]);

  return <div className="phone-shell font-serif">{children}</div>;
}

function AppRoutes() {
  return (
    <HashRouter>
      <TtsProvider>
        <ThemeWrapper>
          <AndroidBackButton />
          <VersionGate />
          {ENABLE_AUTH_GATE && <CloudSyncBootstrap />}
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/code/:bookId" element={<BookScreen />} />
            <Route path="/code/:bookId/section/:sectionId" element={<ReaderScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/select" element={<SelectScreen />} />
            <Route path="/stats" element={<StatsScreen />} />
            <Route path="/bookmarks" element={<BookmarksScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
          {/* Global playback bar — survives navigation */}
          <TtsPlayer />
          <ToastHost />
        </ThemeWrapper>
      </TtsProvider>
    </HashRouter>
  );
}

export default function LawCodeApp() {
  // Row press feedback. Delegated from the document, so it must be installed
  // once for the whole app rather than per screen. Runs in the browser too.
  useEffect(() => { initTapFeedback(); }, []);

  useEffect(() => {
    if (!isNative()) return;

    const p = window.Capacitor?.getPlatform?.();
    if (p === 'ios') {
      // iOS: must request ATT only after the app is in active state, otherwise
      // the system dialog won't appear (Apple Guideline 2.1).
      const doAttThenAds = async () => {
        await requestTrackingIfNeeded();
        initAdMob();
      };

      CapApp.getState().then(({ isActive }) => {
        if (isActive) {
          doAttThenAds();
        } else {
          // Wait for the first active transition (e.g. cold start before UI is ready).
          let handle;
          CapApp.addListener('appStateChange', ({ isActive: active }) => {
            if (active) {
              handle?.then(h => h?.remove());
              doAttThenAds();
            }
          }).then(h => { handle = Promise.resolve(h); });
        }
      });
    } else {
      initAdMob();
    }
  }, []);

  return (
    <AppProvider>
      <ProAccessProvider>
        <AppRoutes />
      </ProAccessProvider>
    </AppProvider>
  );
}
