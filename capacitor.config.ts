import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oseitv.app',
  appName: 'Osei TV',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
