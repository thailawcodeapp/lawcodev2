// Open an external URL reliably across web + native.
//
// On iOS/Android Capacitor, `window.open('_blank')` is not guaranteed to route
// to the system browser, so we use @capacitor/browser (in-app Safari/Chrome
// tab) on native and fall back to window.open on web or if the plugin throws.
import { Browser } from '@capacitor/browser';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export async function openExternal(url) {
  if (!url) return;
  if (isNative()) {
    try {
      await Browser.open({ url });
      return;
    } catch (e) {
      console.warn('[openExternal] Browser.open failed, falling back', e);
    }
  }
  try {
    window.open(url, '_blank');
  } catch (e) {
    console.warn('[openExternal] window.open failed', e);
  }
}
