# Release checklist: Pip's Forest Run

Status legend: ✅ done in this repo · 🟡 you must do it (needs your accounts or identity)

## 1. What the build already covers

| Requirement | Status | Where |
|---|---|---|
| Native Android app (Capacitor 8, target SDK 36, min SDK 24) | ✅ | `android/` |
| Signed release bundle (.aab) for Play upload | ✅ | `android/app/build/outputs/bundle/release/app-release.aab` |
| Installable APK for testing | ✅ | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Works offline (all code, 3D library and fonts bundled; no CDN) | ✅ | `www/vendor`, `www/fonts` |
| Adaptive icon, round icon, splash (light + dark) | ✅ | generated from `assets/` with `@capacitor/assets` |
| Portrait lock, fullscreen, Android back button handled | ✅ | `AndroidManifest.xml`, `js/platform.js` |
| Pause on app background / phone call | ✅ | `visibilitychange` + App `pause` |
| First-run tutorial (jump, slide, switch rails) | ✅ | `engine.js` tutorial rows |
| GDPR/UMP consent before ads; "Privacy choices" in Settings | ✅ | `js/monetize.js` |
| iOS App Tracking Transparency request | ✅ code / 🟡 Info.plist text | `js/monetize.js` |
| Restore purchases button (Apple requirement) | ✅ | Shop → Acorns, Settings |
| Privacy policy page, in-app link | ✅ draft / 🟡 fill name + email, host it | `www/privacy.html` |
| Reset progress (data deletion) | ✅ | Settings |
| Graphics fallback for weak phones (auto FPS check) | ✅ | Settings → Graphics |
| Store text EN + VI, data-safety answers, content rating answers | ✅ | `store/` |
| Feature graphic + phone screenshots | ✅ | `store/` |

## 2. Retention hooks in the game

| Hook | How it brings players back |
|---|---|
| Daily gift, 7-day streak | Rewards grow each day; day 7 unlocks the exclusive Midnight Glow outfit. Missing a day resets the streak. Red dot on Home. |
| Local reminder notification | After the first run and after each daily claim, a reminder is scheduled for 18:30 the next day. |
| Missions → permanent score multiplier | Three goals per set; finishing a set raises the multiplier (×1 → ×30), so every future run scores more. |
| Upgrades | Five levels each for Magnet, Shield, Double Score: a long acorn sink. |
| Outfits | Visible goals at 2,500 / 6,000 / 25,000 acorns. |
| Head start boost | A consumable that makes the first 520 m feel great; first one is free. |
| Best score + "New best run!" | Classic one-more-run loop. |
| Revive offer | Ending a good run hurts; a revive keeps the session going. |

## 3. Monetization

| Source | Placement | Rules in code |
|---|---|---|
| Rewarded ad | Revive (once per run), double acorns after a run, double daily gift, free 100 acorns (5/day) | Reward only granted on the SDK reward callback |
| Interstitial ad | When leaving the results screen | Only after 4+ total runs, every 3rd run, at least 150 s apart, never for "No Ads" owners |
| IAP: Starter Pack $3.99 (non-consumable) | Shop → Acorns | No interstitials + 5,000 acorns + Golden Lantern outfit |
| IAP: No Ads $2.99 (non-consumable) | Shop → Acorns | Removes interstitials, rewarded ads stay opt-in |
| IAP: 1,500 acorns $0.99, 9,000 acorns $4.99 (consumable) | Shop → Acorns | |

All prices are suggestions; set the real ones in the store consoles.

## 4. What you must do (🟡)

### Accounts
1. Google Play Console developer account ($25 once). Apple Developer Program ($99/year) if you want iOS.
2. AdMob account → create the app (Android + iOS) → create one **Rewarded** and one **Interstitial** ad unit per platform.
3. RevenueCat account (free tier) → create a project → connect Google Play (service account JSON) and App Store (in-app purchase key).

### Replace placeholders (search the repo for `REPLACE_ME`)
1. `www/js/config.js`: your 4 ad unit IDs, then set `testMode: false`. Your 2 RevenueCat public SDK keys. Support email.
2. `android/app/src/main/res/values/strings.xml`: `admob_app_id` → your Android AdMob **app** ID (`ca-app-pub-…~…`).
3. `capacitor.config.json` + `android/app/build.gradle`: change `com.pipforestrun.game` if you want another package name (it cannot change after the first upload).
4. `www/privacy.html`: developer name, contact email, date. Host it on a public URL (GitHub Pages works) and use that URL in both consoles.

### Store products (same IDs everywhere)
| Product ID | Type in Play / App Store | RevenueCat |
|---|---|---|
| `pip_starter_pack` | Managed product / Non-consumable | attach to entitlement `no_ads` |
| `pip_remove_ads` | Managed product / Non-consumable | attach to entitlement `no_ads` |
| `pip_acorns_small` | Managed product / Consumable | mark as consumable |
| `pip_acorns_large` | Managed product / Consumable | mark as consumable |

### Signing key (important)
- The upload key was generated for you: `android/upload-keystore.jks`, passwords in `android/keystore.properties`.
- **Back up both files somewhere safe and private now.** They are git-ignored on purpose. If you lose them you must ask Google to reset the upload key.
- Enrol in Play App Signing when you create the app (default).
- If you prefer your own key, replace both files and rebuild.

### Build after changing anything
```bash
npm run build:android   # copies www/, rebuilds native.js, then Gradle bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`. Bump `versionCode` in `android/app/build.gradle` for every upload.

### Play Console flow
1. Create app → Game → Free → declarations.
2. Fill **App content**: privacy policy URL, ads = yes, app access = no login, target audience 13+, content rating questionnaire, data safety (use `store/data-safety.md`).
3. Main store listing: text from `store/listing.md`, icon 512, feature graphic, screenshots.
4. Upload the .aab to **Internal testing**, add your Gmail as tester, install from the opt-in link and test ads (test ads show "Test Ad") and purchases (add yourself as a license tester).
5. New personal accounts must run a **closed test with at least 12 testers for 14 days** before production access. Plan for this.
6. Promote to Production.

### iOS (needs a Mac with Xcode)
```bash
npm i && npx cap add ios && npx @capacitor/assets generate --ios && npx cap open ios
```
Then in Xcode: set the Team and bundle ID, add `GADApplicationIdentifier`, `SKAdNetworkItems` and `NSUserTrackingUsageDescription` to Info.plist, enable the In-App Purchase capability, archive, upload with Xcode Organizer.

## 5. Before pressing publish
- [ ] Play 10+ full runs on a real low-end Android phone; check it holds a steady frame rate on "Smooth".
- [ ] Rewarded ad grants reward only after finishing; closing early gives nothing.
- [ ] Buy each product with a license tester, uninstall, reinstall, Restore purchases.
- [ ] Airplane mode: game still starts and plays.
- [ ] `testMode: false` with your real ad unit IDs **only in the build you upload to production**. Never tap your own live ads.
