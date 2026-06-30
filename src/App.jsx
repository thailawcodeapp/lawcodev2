import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
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
import UpdateModal from './components/UpdateModal';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initAdMob, showBanner, removeBanner, requestTrackingIfNeeded } from './lib/admob';
import { initIAP } from './lib/iap';
import { checkForUpdate } from './lib/versionCheck';
import { useAuthUser } from './hooks/useAuthUser';
import { useCloudSync } from './hooks/useCloudSync';
import { ENABLE_AUTH_GATE } from './config';

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
  // With the flag off, useAuthUser short-circuits and useCloudSync becomes a no-op.
  const { user } = useAuthUser();
  useCloudSync(user);
  return null;
}

function ThemeWrapper({ children }) {
  const { settings, setSettings } = useApp();

  // Initialise IAP store; sync entitlement to settings.isPro
  useEffect(() => {
    initIAP((proOwned) => {
      setSettings(prev => prev.isPro === proOwned ? prev : { ...prev, isPro: proOwned });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.isDarkMode);
  }, [settings.isDarkMode]);

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
    if (settings.isPro) {
      removeBanner();
    } else {
      showBanner(false);
    }
  }, [settings.isPro]);

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
        </ThemeWrapper>
      </TtsProvider>
    </HashRouter>
  );
}

export default function LawCodeApp() {
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
      <AppRoutes />
    </AppProvider>
  );
}
