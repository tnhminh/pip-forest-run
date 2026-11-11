// Bundled by esbuild into www/js/native.js (IIFE). Exposes Capacitor plugins as window.PipNative
// so the game code stays plain ES modules with no build step of its own.
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

window.PipNative = {
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  AdMob, Purchases, Haptics, ImpactStyle, NotificationType, LocalNotifications, App, StatusBar, SplashScreen,
};
