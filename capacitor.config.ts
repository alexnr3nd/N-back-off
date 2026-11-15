import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dualnback.android',
  appName: 'Dual N-Back',
  webDir: 'build',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    StatusBar: { overlaysWebView: false }
  }
};
export default config;
