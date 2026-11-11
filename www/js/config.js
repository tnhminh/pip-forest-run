// Central place for every ID you must replace before a production release.
// Search the repo for REPLACE_ME to find them all.
export const CONFIG = {
  appVersion: '1.0.0',

  ads: {
    // true = Google's official test ad units. Set to false ONLY after you paste your
    // real AdMob ad unit IDs below, otherwise your AdMob account can be suspended.
    testMode: true,
    android: {
      rewarded: 'ca-app-pub-3940256099942544/5224354917',      // REPLACE_ME with your Android rewarded unit
      interstitial: 'ca-app-pub-3940256099942544/1033173712',  // REPLACE_ME with your Android interstitial unit
    },
    ios: {
      rewarded: 'ca-app-pub-3940256099942544/1712485313',      // REPLACE_ME with your iOS rewarded unit
      interstitial: 'ca-app-pub-3940256099942544/4411468910',  // REPLACE_ME with your iOS interstitial unit
    },
    // Interstitial frequency caps (players who bought "No ads" never see interstitials).
    interstitialEveryRuns: 3,
    interstitialMinGapSec: 150,
    interstitialMinTotalRuns: 4,
    freeAcornAdsPerDay: 5,
  },

  iap: {
    revenuecatAndroidKey: 'goog_REPLACE_ME',
    revenuecatIosKey: 'appl_REPLACE_ME',
    noAdsEntitlement: 'no_ads',
  },

  privacyUrl: 'privacy.html',
  supportEmail: 'support@REPLACE_ME.example',
};
