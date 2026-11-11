// Ads (AdMob + Google UMP consent) and in-app purchases (RevenueCat).
// On the web preview both are simulated with clearly labelled test dialogs so the
// whole economy can be played end to end without a device.
import { CONFIG } from './config.js';
import { PRODUCTS } from './data.js';
import { save, persist, today } from './save.js';
import { grantProduct } from './meta.js';
import { track } from './platform.js';

const N = () => (window.PipNative && window.PipNative.isNative ? window.PipNative : null);
const unitIds = () => (N() && N().platform === 'ios' ? CONFIG.ads.ios : CONFIG.ads.android);

// ---------------- web simulation dialog ----------------
function simDialog({ title, body, seconds = 0, okLabel, cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'overlay sim';
    wrap.innerHTML = `<div class="card sim-card" role="dialog" aria-modal="true">
      <div class="sim-tag">Web preview · test only</div>
      <h3>${title}</h3><p>${body}</p>
      ${seconds ? '<div class="sim-bar"><i></i></div>' : ''}
      <div class="row center"><button class="btn primary" data-ok disabled>${okLabel}</button><button class="btn ghost" data-cancel>${cancelLabel}</button></div></div>`;
    document.body.appendChild(wrap);
    const ok = wrap.querySelector('[data-ok]'), bar = wrap.querySelector('.sim-bar i');
    const done = v => { wrap.remove(); resolve(v); };
    let left = seconds;
    const tick = () => {
      if (bar) bar.style.width = `${100 - (left / seconds) * 100}%`;
      if (left <= 0) { ok.disabled = false; ok.focus(); return; }
      ok.textContent = `${okLabel} (${Math.ceil(left)})`;
      left -= 0.1; setTimeout(tick, 100);
    };
    if (seconds) tick(); else ok.disabled = false;
    ok.onclick = () => { ok.textContent = okLabel; done(true); };
    wrap.querySelector('[data-cancel]').onclick = () => done(false);
  });
}

// ---------------- Ads ----------------
export const Ads = {
  ready: false,
  privacyOptionsRequired: false,
  rewardedLoaded: false,
  interLoaded: false,

  async init() {
    const n = N();
    if (!n) { this.ready = true; return; }
    const { AdMob } = n;
    try {
      // Consent first (GDPR/UK/Swiss users see Google's UMP form), then initialize.
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
      const after = await AdMob.requestConsentInfo();
      this.privacyOptionsRequired = after.privacyOptionsRequirementStatus === 'REQUIRED';
      if (n.platform === 'ios') { try { await AdMob.requestTrackingAuthorization(); } catch (e) {} }
      await AdMob.initialize({ initializeForTesting: CONFIG.ads.testMode, tagForChildDirectedTreatment: false });
      this.ready = after.canRequestAds !== false;
      if (this.ready) { this.loadRewarded(); this.loadInterstitial(); }
    } catch (e) { console.warn('[ads] init failed', e); }
  },

  async loadRewarded() {
    const n = N(); if (!n || !this.ready) return;
    try { await n.AdMob.prepareRewardVideoAd({ adId: unitIds().rewarded, isTesting: CONFIG.ads.testMode }); this.rewardedLoaded = true; }
    catch (e) { this.rewardedLoaded = false; }
  },
  async loadInterstitial() {
    const n = N(); if (!n || !this.ready || save.removeAds) return;
    try { await n.AdMob.prepareInterstitial({ adId: unitIds().interstitial, isTesting: CONFIG.ads.testMode }); this.interLoaded = true; }
    catch (e) { this.interLoaded = false; }
  },

  // Resolves true only if the player earned the reward.
  async showRewarded(placement) {
    track('ad_rewarded_request', { placement });
    const n = N();
    if (!n) {
      const ok = await simDialog({ title: 'Rewarded ad', body: 'A real video ad plays here on phones. Watch it to the end to earn the reward.', seconds: 3, okLabel: 'Claim reward', cancelLabel: 'Skip' });
      track(ok ? 'ad_rewarded_earned' : 'ad_rewarded_skipped', { placement });
      return ok;
    }
    if (!this.rewardedLoaded) await this.loadRewarded();
    if (!this.rewardedLoaded) return false;
    const { AdMob } = n;
    let earned = false;
    const handles = [];
    const result = await new Promise(async resolve => {
      const safety = setTimeout(() => resolve(earned), 120000);
      const fin = () => { clearTimeout(safety); resolve(earned); };
      handles.push(await AdMob.addListener('onRewardedVideoAdReward', () => { earned = true; }));
      handles.push(await AdMob.addListener('onRewardedVideoAdDismissed', fin));
      handles.push(await AdMob.addListener('onRewardedVideoAdFailedToShow', fin));
      AdMob.showRewardVideoAd().then(r => { if (r) earned = true; }).catch(fin);
    });
    handles.forEach(h => h && h.remove && h.remove());
    this.rewardedLoaded = false; this.loadRewarded();
    track(result ? 'ad_rewarded_earned' : 'ad_rewarded_skipped', { placement });
    return result;
  },

  // Call when the player leaves the results screen. Respects caps and "No ads".
  async maybeInterstitial() {
    if (save.removeAds) return false;
    save.ads.runsSince++;
    const gap = (Date.now() - save.ads.lastAt) / 1000;
    const due = save.totals.runs >= CONFIG.ads.interstitialMinTotalRuns && save.ads.runsSince >= CONFIG.ads.interstitialEveryRuns && gap >= CONFIG.ads.interstitialMinGapSec;
    persist();
    if (!due) return false;
    const n = N();
    let shown = false;
    if (!n) shown = await simDialog({ title: 'Interstitial ad', body: 'A full-screen ad appears here every few runs on phones. Buying "No Ads" turns these off.', seconds: 2, okLabel: 'Close ad', cancelLabel: 'Close' }) || true;
    else if (this.interLoaded) {
      try { await n.AdMob.showInterstitial(); shown = true; } catch (e) {}
      this.interLoaded = false; this.loadInterstitial();
    } else this.loadInterstitial();
    if (shown) { save.ads.runsSince = 0; save.ads.lastAt = Date.now(); persist(); track('ad_interstitial_shown'); }
    return shown;
  },

  freeAdsLeft() {
    if (save.ads.freeDay !== today()) { save.ads.freeDay = today(); save.ads.freeCount = 0; }
    return Math.max(0, CONFIG.ads.freeAcornAdsPerDay - save.ads.freeCount);
  },
  useFreeAd() { this.freeAdsLeft(); save.ads.freeCount++; persist(); },

  async showPrivacyOptions() {
    const n = N(); if (!n) return false;
    try { await n.AdMob.showPrivacyOptionsForm(); return true; } catch (e) { return false; }
  },
};

// ---------------- Purchases ----------------
export const Store = {
  ready: false,
  prices: {},
  native: {},

  async init() {
    const n = N();
    if (!n) { this.ready = true; return; }
    const key = n.platform === 'ios' ? CONFIG.iap.revenuecatIosKey : CONFIG.iap.revenuecatAndroidKey;
    if (key.includes('REPLACE_ME')) { console.warn('[iap] RevenueCat key not set; store disabled'); return; }
    try {
      await n.Purchases.configure({ apiKey: key });
      const { products } = await n.Purchases.getProducts({ productIdentifiers: PRODUCTS.map(p => p.id), type: 'NON_SUBSCRIPTION' });
      for (const sp of products || []) { this.native[sp.identifier] = sp; this.prices[sp.identifier] = sp.priceString; }
      this.ready = true;
      await this.sync(false);
    } catch (e) { console.warn('[iap] init failed', e); }
  },

  available() { return this.ready && (!N() || Object.keys(this.native).length > 0); },
  priceOf(p) { return this.prices[p.id] || p.price; },

  // Grants non-consumables the store says this account owns.
  async sync(restoring) {
    const n = N(); if (!n) return 0;
    const { customerInfo } = restoring ? await n.Purchases.restorePurchases() : await n.Purchases.getCustomerInfo();
    const owned = new Set(customerInfo.allPurchasedProductIdentifiers || []);
    const ent = customerInfo.entitlements && customerInfo.entitlements.active || {};
    let count = 0;
    for (const p of PRODUCTS) if (p.kind === 'nonconsumable' && owned.has(p.id)) { if (grantProduct(p, { restoring: true })) count++; }
    if (ent[CONFIG.iap.noAdsEntitlement] && !save.removeAds) { save.removeAds = true; persist(true); count++; }
    return count;
  },

  // Resolves 'ok' | 'cancelled' | 'error'
  async buy(p) {
    track('iap_start', { id: p.id });
    const n = N();
    if (!n) {
      const ok = await simDialog({ title: `Buy ${p.title}`, body: `On a phone this opens the ${'Google Play / App Store'} payment sheet for ${p.price}. In this preview no money is charged.`, okLabel: 'Simulate purchase' });
      if (!ok) return 'cancelled';
      grantProduct(p); track('iap_success', { id: p.id, simulated: true }); return 'ok';
    }
    const sp = this.native[p.id];
    if (!sp) return 'error';
    try {
      await n.Purchases.purchaseStoreProduct({ product: sp });
      grantProduct(p);
      track('iap_success', { id: p.id, price: sp.price, currency: sp.currencyCode });
      return 'ok';
    } catch (e) {
      if (e && (e.userCancelled || e.code === '1' || e.code === 1)) return 'cancelled';
      console.warn('[iap] purchase failed', e); return 'error';
    }
  },

  async restore() {
    const n = N();
    if (!n) { return 0; }
    try { return await this.sync(true); } catch (e) { return -1; }
  },
};
