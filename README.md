# Pip's Forest Run

A 3D endless rail runner for Android and iOS, built with three.js inside Capacitor.
Players switch between three rails, jump logs, slide under beams and dodge runaway carts while collecting golden acorns.

## Project layout
```
www/                 the whole game (plain ES modules, no bundler needed)
  index.html         screens and HUD markup
  css/style.css      UI styles
  js/engine.js       three.js world, player, obstacles, audio
  js/main.js         UI flow: home, run, revive, results, shop, missions, daily, settings
  js/meta.js         wallet, missions, daily streak, upgrades, outfits
  js/monetize.js     AdMob (rewarded + interstitial + consent) and RevenueCat purchases
  js/platform.js     haptics, notifications, back button, analytics hook
  js/config.js       every ID to replace before release
  js/native.js       generated from src/native-entry.js (Capacitor plugins bundle)
  vendor/three/      three.js r147 and post-processing (bundled for offline play)
android/             native Android project (Capacitor)
assets/              icon and splash sources for @capacitor/assets
store/               listing text, data-safety answers, feature graphic, screenshots
tools/               icon and screenshot generators
```

## Commands
```bash
npm install
npm run serve            # play in a browser at http://localhost:8765 (ads/purchases are simulated)
npm run build:native     # rebuild www/js/native.js after changing plugins
npm run build:android    # sync + signed release .aab + debug .apk
npm run icons            # re-render icon, splash and feature graphic
npm run screenshots      # re-render store screenshots (needs `npm run serve` running)
```
Android builds need JDK 21 and the Android SDK (`ANDROID_HOME`).

See **RELEASE.md** for the store checklist.
