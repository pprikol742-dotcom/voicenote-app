import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.voicenote.app',
  appName: 'Блокнот',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput:false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: '#7c3aed',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
