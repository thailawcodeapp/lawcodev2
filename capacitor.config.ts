import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lawcodev2.app',
  appName: 'ประมวลกฎหมาย',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: '#ece4d4',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ece4d4',
    },
    FirebaseAuthentication: {
      // Use the native Firebase SDK session (required for Firestore to see
      // the signed-in user on Android).
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
