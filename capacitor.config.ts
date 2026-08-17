import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arpixelgram.app',
  appName: 'AR Pixelgram',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
