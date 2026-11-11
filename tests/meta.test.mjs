// Run: node tests/meta.test.mjs  — exercises the economy without a browser.
import assert from 'node:assert/strict';
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
globalThis.window = globalThis;
let interShown = 0;
window.PipNative = { isNative: true, platform: 'android', AdMob: { showInterstitial: async () => { interShown++; }, prepareInterstitial: async () => ({}) } };

const { save, persist, today, yesterday } = await import('../www/js/save.js');
const meta = await import('../www/js/meta.js');
const { Ads } = await import('../www/js/monetize.js');
const { PRODUCTS, missionReward, DAILY } = await import('../www/js/data.js');
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('ok -', name); };

// ---- daily streak ----
t('daily: first claim gives day 1', () => {
  const r = meta.claimDaily(); assert.equal(r.acorns, DAILY[0].acorns); assert.equal(save.daily.streak, 1);
  assert.equal(meta.claimDaily(), null, 'cannot claim twice a day');
});
t('daily: claim after yesterday continues streak', () => {
  save.daily.last = yesterday(); const r = meta.claimDaily(); assert.equal(r.index, 1); assert.equal(save.daily.streak, 2);
});
t('daily: a missed day resets the streak', () => {
  save.daily.last = '2000-01-01'; const r = meta.claimDaily(); assert.equal(r.index, 0); assert.equal(save.daily.streak, 1);
});
t('daily: day 7 unlocks Midnight outfit, later falls back to acorns', () => {
  save.daily = { last: yesterday(), streak: 6 }; const r = meta.claimDaily(); assert.equal(r.skin, 'midnight'); assert.ok(save.skins.includes('midnight'));
  save.daily = { last: yesterday(), streak: 13 }; const r2 = meta.claimDaily(); assert.equal(r2.acorns, DAILY[6].fallback);
});

// ---- missions & multiplier ----
t('missions: completing and claiming a set raises the multiplier', () => {
  meta.initMissions(); assert.equal(meta.multiplier(), 1);
  const huge = { score: 1e9, dist: 1e9, coins: 1e5, jumps: 999, slides: 999, powerups: 999, carts: 999 };
  meta.finishRun(huge); meta.finishRun(huge); meta.finishRun(huge);
  assert.ok(save.missions.every(m => m.done), JSON.stringify(save.missions));
  const before = save.acorns;
  const r = [0, 1, 2].map(i => meta.claimMission(i));
  assert.equal(save.acorns - before, missionReward(0) * 3);
  assert.ok(r[2].leveled); assert.equal(meta.multiplier(), 2);
  assert.ok(save.missions.every(m => !m.done), 'new set starts fresh');
});
t('missions: total-scope progress counts from when the set started', () => {
  const m = save.missions.find(x => x.t.startsWith('total_'));
  if (m) { meta.trackRun({ score: 0, dist: 0, coins: 0, jumps: 0, slides: 0, powerups: 0, carts: 0 }); assert.equal(m.progress, 0); }
});

// ---- shop ----
t('shop: cannot buy an outfit without enough acorns', () => { save.acorns = 100; assert.equal(meta.buySkin('bluecap'), false); });
t('shop: buying an outfit spends and equips it', () => { save.acorns = 3000; assert.ok(meta.buySkin('bluecap')); assert.equal(save.acorns, 500); assert.equal(save.skin, 'bluecap'); });
t('shop: daily-only outfit cannot be bought', () => { save.acorns = 1e6; save.skins = save.skins.filter(s => s !== 'midnight'); assert.equal(meta.buySkin('midnight'), false); });
t('shop: upgrades cap at level 5', () => { save.acorns = 1e7; for (let i = 0; i < 9; i++) meta.buyUpgrade('magnet'); assert.equal(save.upgrades.magnet, 5); assert.equal(meta.durations().magnet, 19); });
t('shop: head start is consumed once per run', () => { save.boosts.headstart = 1; save.useHeadstart = true; assert.ok(meta.consumeHeadstart()); assert.equal(meta.consumeHeadstart(), false); });

// ---- purchases ----
t('iap: starter pack grants no-ads, acorns, outfit once', () => {
  const p = PRODUCTS.find(x => x.id === 'pip_starter_pack'); const a = save.acorns;
  assert.ok(meta.grantProduct(p)); assert.ok(save.removeAds); assert.ok(save.skins.includes('golden')); assert.equal(save.acorns - a, 5000);
  assert.equal(meta.grantProduct(p), false, 'non-consumable not granted twice');
});
t('iap: consumables stack', () => { const p = PRODUCTS.find(x => x.id === 'pip_acorns_small'); const a = save.acorns; meta.grantProduct(p); meta.grantProduct(p); assert.equal(save.acorns - a, 3000); });

// ---- interstitial caps ----
save.removeAds = true; interShown = 0; for (let i = 0; i < 10; i++) await Ads.maybeInterstitial(); assert.equal(interShown, 0); console.log('ok - ads: never shown to No Ads owners');
save.removeAds = false; Ads.ready = true; Ads.interLoaded = true; save.totals.runs = 1; save.ads = { runsSince: 0, lastAt: 0 };
for (let i = 0; i < 5; i++) { Ads.interLoaded = true; await Ads.maybeInterstitial(); }
assert.equal(interShown, 0, 'no interstitials before 4 total runs'); console.log('ok - ads: none before 4 total runs');
save.totals.runs = 10; save.ads = { runsSince: 0, lastAt: 0 }; interShown = 0;
for (let i = 0; i < 3; i++) { Ads.interLoaded = true; await Ads.maybeInterstitial(); }
assert.equal(interShown, 1, 'one interstitial on the 3rd run'); console.log('ok - ads: one per 3 runs');
for (let i = 0; i < 6; i++) { Ads.interLoaded = true; await Ads.maybeInterstitial(); }
assert.equal(interShown, 1, 'gap of 150 s respected'); console.log('ok - ads: minimum time gap respected');
t('ads: free acorn ads capped per day', () => { save.ads.freeDay = null; for (let i = 0; i < 9; i++) if (Ads.freeAdsLeft()) Ads.useFreeAd(); assert.equal(Ads.freeAdsLeft(), 0); assert.equal(save.ads.freeCount, 5); });
console.log(`\nall ${pass + 4} checks passed`);
