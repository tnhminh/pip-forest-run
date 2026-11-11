import { createEngine } from './engine.js';
import { save, persist, resetSave } from './save.js';
import { SKINS, UPGRADES, UPGRADE_COST, MAX_UPGRADE, upgradeDuration, DAILY, PRODUCTS, HEADSTART_PRICE, REVIVE_BASE_PRICE, FREE_AD_ACORNS, missionReward } from './data.js';
import * as meta from './meta.js';
import { Ads, Store } from './monetize.js';
import { haptic, track, scheduleDailyReminder, onAppEvents, nativeChrome, isNative, platformName } from './platform.js';
import { CONFIG } from './config.js';

const $ = id => document.getElementById(id);
const fmt = n => Math.floor(n).toLocaleString('en-US');
const acornSvg = '<svg><use href="#i-acorn"/></svg>';

// ======================= ENGINE =======================
function pickQuality() {
  const q = save.settings.quality;
  if (q !== 'auto') return q;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  return coarse && weak ? 'low' : 'high';
}
let engine;
try {
  if (typeof THREE === 'undefined') throw new Error('three.js failed to load');
  engine = createEngine($('game'), { quality: pickQuality(), onEvent, onFrame });
} catch (e) {
  console.error(e); $('nogl').hidden = false; $('home').hidden = true;
  throw e;
}
function applySettings() {
  engine.setAudio({ sfx: save.settings.sfx, music: save.settings.music });
  engine.setSkin(meta.currentSkin());
  engine.setDurations(meta.durations());
  engine.setMultiplier(meta.multiplier());
}
applySettings();
meta.initMissions();

// ======================= TOASTS =======================
function toast(title, sub, color) {
  const el = document.createElement('div');
  el.className = 'toast'; if (color) el.style.setProperty('--tc', color);
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  $('toasts').appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

// ======================= SCREENS =======================
let mode = 'home'; // home | run | revive | results
const stack = [];   // open sheets
function openSheet(id, render) {
  if (render) render();
  $(id).hidden = false; if (!stack.includes(id)) stack.push(id);
  const first = $(id).querySelector('[data-close]'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
}
function closeSheet(id) { $(id).hidden = true; const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1); refreshHome(); }
document.querySelectorAll('.sheet-wrap').forEach(w => {
  w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-close]')) closeSheet(w.id); });
});

function refreshHome() {
  $('hmAcorns').textContent = fmt(save.acorns);
  $('hmLevel').textContent = `Lv ${save.level + 1}`;
  $('hmMult').textContent = `×${meta.multiplier()}`;
  $('hmBest').hidden = !save.best; $('hmBestVal').textContent = fmt(save.best);
  const c = meta.claimableCount(); $('bMissions').hidden = !c; $('bMissions').textContent = c;
  $('bDaily').hidden = !meta.dailyState().available;
  $('bShop').hidden = !(Ads.freeAdsLeft() > 0 && save.totals.runs > 0) && !SKINS.some(s => s.price && !save.skins.includes(s.id) && save.acorns >= s.price);
  const hs = save.boosts.headstart;
  $('hsCount').textContent = hs ? `×${hs}` : `${HEADSTART_PRICE}`;
  $('hsLabel').textContent = hs ? 'Head start' : 'Buy head start';
  $('hsToggle').setAttribute('aria-pressed', String(!!(save.useHeadstart && hs)));
  $('shAcorns').textContent = fmt(save.acorns);
}

function showHome() {
  mode = 'home';
  for (const id of ['hud', 'revive', 'results', 'paused', 'tut']) $(id).hidden = true;
  $('home').hidden = false; $('count').hidden = true;
  engine.toMenu(); refreshHome();
}

// ======================= RUN FLOW =======================
let runCtx = null;
function startRun() {
  engine.unlockAudio();
  for (const id of stack.slice()) closeSheet(id);
  const tutorial = !save.tutorialDone;
  const headStart = !tutorial && meta.consumeHeadstart();
  runCtx = { doubled: false, tutorial };
  $('home').hidden = true; $('results').hidden = true; $('hud').hidden = false; $('hBoost').hidden = true;
  engine.setMultiplier(meta.multiplier()); engine.setDurations(meta.durations());
  engine.startRun({ headStart, tutorial });
  mode = 'run';
  track('run_start', { headStart, tutorial, level: save.level });
}

function onEvent(type, d) {
  switch (type) {
    case 'count': {
      const el = $('count'); el.hidden = false; el.classList.remove('anim', 'go'); void el.offsetWidth;
      el.textContent = d > 0 ? d : 'GO!'; if (d <= 0) el.classList.add('go'); el.classList.add('anim');
      if (d <= 0) setTimeout(() => { el.hidden = true; }, 800);
      break;
    }
    case 'boost': toast('Head start!', 'Flying past 520 m of trouble', 'rgba(255,122,61,.6)'); haptic('light'); break;
    case 'boostEnd': $('hBoost').hidden = true; break;
    case 'power': toast({ magnet: 'Acorn magnet', shield: 'Bark shield', dbl: 'Double score' }[d], null, { magnet: 'rgba(111,208,255,.6)', shield: 'rgba(141,255,122,.6)', dbl: 'rgba(255,127,216,.6)' }[d]); haptic('light'); liveTrack(); break;
    case 'shieldBreak': toast('Shield saved you!', null, 'rgba(141,255,122,.6)'); haptic('heavy'); break;
    case 'milestone': toast(`${fmt(d)} m`); liveTrack(); break;
    case 'coin': case 'jump': case 'slide': case 'cartDodged': liveTrack(); break;
    case 'crash': haptic('heavy'); $('tut').hidden = true; break;
    case 'downed': offerRevive(d); break;
    case 'end': endRun(d); break;
    case 'tutorial': showTutorial(d); break;
    case 'tutorialDone': save.tutorialDone = true; persist(); toast("You've got it!", 'Collect acorns and see how far you get', 'rgba(141,255,122,.6)'); track('tutorial_done'); break;
    case 'fps':
      if (save.settings.quality === 'auto' && engine.quality === 'high' && d < 40) { engine.setQuality('low'); toast('Switched to smooth graphics', 'Change it any time in Settings'); }
      break;
  }
}
let liveT = 0;
function liveTrack() { const now = performance.now(); if (now - liveT < 250) return; liveT = now; meta.trackRun(engine.stats()); }

const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function onFrame(s) {
  if (mode !== 'run') return;
  setText('hScore', fmt(s.score)); setText('hDist', fmt(s.dist)); setText('hMult', `×${s.mult}`);
  if (hudCache.coins !== s.coins) { if (hudCache.coins !== undefined && s.coins > hudCache.coins) { const p = $('hPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } hudCache.coins = s.coins; $('hCoins').textContent = s.coins; }
  $('hDbl').hidden = !(s.dbl > 0);
  const durs = meta.durations();
  for (const k of ['magnet', 'shield', 'dbl']) { const el = $('r-' + k); el.hidden = !(s[k] > 0); if (s[k] > 0) el.style.setProperty('--p', (s[k] / durs[k]).toFixed(3)); }
  $('hBoost').hidden = !s.boosting; if (s.boosting) $('hBoostFill').style.width = `${(s.boostLeft / 520) * 100}%`;
}

// ---------- tutorial ----------
function showTutorial(d) {
  if (!d) { $('tut').hidden = true; return; }
  const touch = matchMedia('(pointer:coarse)').matches;
  const txt = { jump: touch ? 'Swipe up to jump' : 'Press ↑ or Space to jump', slide: touch ? 'Swipe down to slide' : 'Press ↓ to slide', lane: touch ? `Swipe ${d.dir} to switch rails` : `Press ${d.dir === 'left' ? '←' : '→'} to switch rails` }[d.need];
  $('tutText').textContent = txt;
  $('tutSwipe').dataset.dir = d.need === 'jump' ? 'up' : d.need === 'slide' ? 'down' : d.dir;
  $('tutSwipe').hidden = !touch;
  $('tutKeys').textContent = d.need === 'lane' ? 'The cart blocks this rail' : d.need === 'jump' ? 'Logs are low: hop over them' : 'Beams are high: duck under them';
  $('tut').hidden = false;
}

// ---------- revive ----------
let rvTimer = 0;
function offerRevive(s) {
  if (s.tutorial) { engine.revive(); return; }
  const price = REVIVE_BASE_PRICE * Math.pow(2, s.revives);
  const canAd = s.revives === 0;
  const canPay = save.acorns >= price;
  if (!canAd && !canPay) { engine.endRun(); return; }
  mode = 'revive';
  $('rvReason').textContent = s.reason;
  $('rvAd').hidden = !canAd;
  $('rvPay').hidden = false; $('rvPay').disabled = !canPay; $('rvPrice').textContent = fmt(price);
  $('revive').hidden = false;
  let left = 6; const total = 6;
  const tick = () => {
    $('rvSec').textContent = Math.ceil(left); $('rvRing').style.setProperty('--p', (left / total).toFixed(3));
    if (left <= 0) { declineRevive(); return; }
    left -= .1; rvTimer = setTimeout(tick, 100);
  };
  clearTimeout(rvTimer); tick();
  (canAd ? $('rvAd') : $('rvPay')).focus({ preventScroll: true });
}
function declineRevive() { clearTimeout(rvTimer); $('revive').hidden = true; engine.endRun(); }
function doRevive(how) { clearTimeout(rvTimer); $('revive').hidden = true; mode = 'run'; engine.revive(); track('revive', { how }); haptic('success'); }
$('rvNo').onclick = declineRevive;
$('rvPay').onclick = () => { const price = Number($('rvPrice').textContent.replace(/,/g, '')); if (meta.spend(price)) doRevive('acorns'); };
$('rvAd').onclick = async () => {
  clearTimeout(rvTimer); $('rvAd').disabled = true;
  const ok = await Ads.showRewarded('revive');
  $('rvAd').disabled = false;
  if (ok) doRevive('ad'); else declineRevive();
};

// ---------- results ----------
function endRun(s) {
  mode = 'results';
  const { best } = meta.finishRun(s);
  $('hud').hidden = true; $('tut').hidden = true;
  $('rsReason').textContent = s.reason;
  $('rsScore').textContent = fmt(s.score); $('rsDist').textContent = `${fmt(s.dist)} m`; $('rsCoins').textContent = fmt(s.coins); $('rsBestVal').textContent = fmt(save.best);
  $('rsBest').hidden = !best;
  $('rsDouble').hidden = s.coins < 5; $('rsDouble').disabled = false; $('rsDouble').innerHTML = `<svg><use href="#i-ad"/></svg>Double your acorns (+${fmt(s.coins)})`;
  runCtx.coins = s.coins;
  $('rsMissions').innerHTML = meta.ensureMissions().map(m => `<div class="mini ${m.done ? 'done' : ''}"><span class="st">${m.done ? '<svg><use href="#i-check"/></svg>' : ''}</span><span>${meta.missionText(m)}</span><div class="bar"><i style="width:${(m.progress / m.target) * 100}%"></i></div></div>`).join('');
  $('results').hidden = false;
  track('run_end', { score: s.score, dist: s.dist, coins: s.coins, revives: s.revives });
  if (save.totals.runs === 1 || save.totals.runs === 3) setTimeout(scheduleDailyReminder, 600);
}
$('rsDouble').onclick = async () => {
  $('rsDouble').disabled = true;
  if (await Ads.showRewarded('double_acorns')) { meta.addAcorns(runCtx.coins, 'ad_double'); $('rsCoins').textContent = fmt(runCtx.coins * 2); $('rsDouble').innerHTML = '<svg><use href="#i-check"/></svg>Acorns doubled'; haptic('success'); }
  else $('rsDouble').disabled = false;
};
$('rsAgain').onclick = async () => { $('results').hidden = true; await Ads.maybeInterstitial(); startRun(); };
$('rsHome').onclick = async () => { $('results').hidden = true; await Ads.maybeInterstitial(); showHome(); maybeAutoDaily(); };

// ---------- pause ----------
function pause() { if (mode === 'run' && engine.pause()) { $('paused').hidden = false; $('resumeBtn').focus({ preventScroll: true }); } }
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = () => { $('paused').hidden = true; engine.resume(); };
$('quitBtn').onclick = () => { $('paused').hidden = true; const s = engine.stats(); if (!s.tutorial) meta.finishRun(s); showHome(); };

// ======================= INPUT =======================
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k) && mode === 'run') e.preventDefault();
  if (e.repeat) return;
  if (mode === 'run' && $('paused').hidden) {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') engine.act('L');
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') engine.act('R');
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') engine.act('U');
    else if (k === 'ArrowDown' || k === 's' || k === 'S') engine.act('D');
    else if (k === 'p' || k === 'P' || k === 'Escape') pause();
  } else if (k === 'Escape') back();
  else if ((k === 'Enter' || k === ' ') && mode === 'home' && !stack.length && document.activeElement === document.body) { e.preventDefault(); startRun(); }
});
const cv = $('game');
let sx0 = 0, sy0 = 0, st0 = 0, swiped = false;
cv.addEventListener('pointerdown', e => { engine.unlockAudio(); sx0 = e.clientX; sy0 = e.clientY; st0 = performance.now(); swiped = false; });
cv.addEventListener('pointermove', e => {
  if (swiped || !st0 || mode !== 'run') return;
  const dx = e.clientX - sx0, dy = e.clientY - sy0;
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) { swiped = true; engine.act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D')); }
});
cv.addEventListener('pointerup', () => { if (mode === 'run' && !swiped && st0 && performance.now() - st0 < 260) engine.act('U'); st0 = 0; });
document.addEventListener('pointerdown', () => engine.unlockAudio(), { once: true });

function back() {
  if (document.querySelector('.sim')) return true;
  if (stack.length) { closeSheet(stack[stack.length - 1]); return true; }
  if (mode === 'run') { if ($('paused').hidden) pause(); else { $('paused').hidden = true; engine.resume(); } return true; }
  if (mode === 'revive') { declineRevive(); return true; }
  if (mode === 'results') { $('rsHome').click(); return true; }
  return false; // home: let the OS minimise the app
}
onAppEvents({ back, pause });

// ======================= HOME BUTTONS =======================
$('playBtn').onclick = startRun;
$('hsToggle').onclick = () => {
  if (!save.boosts.headstart) { openShop('upgrades'); return; }
  save.useHeadstart = !save.useHeadstart; persist(); refreshHome();
};
$('navMissions').onclick = $('levelChip').onclick = () => openSheet('sheetMissions', renderMissions);
$('navDaily').onclick = () => openSheet('sheetDaily', renderDaily);
$('navShop').onclick = () => openShop('outfits');
$('hmWallet').onclick = () => openShop('acorns');
$('hmSettings').onclick = () => openSheet('sheetSettings', renderSettings);

// ---------- missions ----------
function renderMissions() {
  const ms = meta.ensureMissions();
  $('msLevel').textContent = `Level ${save.level + 1}`; $('msMult').textContent = `×${meta.multiplier()}`;
  const reward = missionReward(save.level);
  $('msList').innerHTML = ms.map((m, i) => `
    <div class="mission ${m.done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}">
      <p>${meta.missionText(m)}</p>
      <div class="bar"><i style="width:${(m.progress / m.target) * 100}%"></i></div>
      <div class="prog">${fmt(m.progress)} / ${fmt(m.target)}</div>
      <div class="act">${m.claimed ? '<span class="owned"><svg><use href="#i-check"/></svg>Done</span>' : m.done ? `<button class="btn primary" data-claim="${i}" type="button">Claim ${fmt(reward)}</button>` : `<span class="reward">${acornSvg}${fmt(reward)}</span>`}</div>
    </div>`).join('');
  $('msList').querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
    const r = meta.claimMission(+b.dataset.claim);
    if (r) { haptic('success'); toast(`+${fmt(r.reward)} acorns`); if (r.leveled) { toast(`Level up! Score ×${meta.multiplier()}`, 'New missions unlocked', 'rgba(255,194,58,.7)'); engine.setMultiplier(meta.multiplier()); } }
    renderMissions(); refreshHome();
  });
}

// ---------- daily ----------
function renderDaily() {
  const st = meta.dailyState();
  const doneCount = st.claimedToday ? ((st.streak - 1) % 7) + 1 : st.streak % 7;
  $('dlDays').innerHTML = DAILY.map((d, i) => {
    const r = meta.dailyReward(i);
    const got = i < doneCount, today = st.available && i === st.index;
    const label = r.skin ? '<svg style="color:#8ff0ff"><use href="#i-gift"/></svg><b style="color:#8ff0ff">Outfit</b>' : `${acornSvg}<b>${fmt(r.acorns)}</b>`;
    return `<div class="day ${i === 6 ? 'big' : ''} ${got ? 'got' : ''} ${today ? 'today' : ''}">Day ${i + 1}${label}</div>`;
  }).join('');
  const r = st.available ? meta.dailyReward(st.index) : null;
  $('dlHint').textContent = st.available ? `Day ${st.index + 1} of 7 is ready. Miss a day and the streak starts over.` : 'Claimed for today. Your next gift unlocks tomorrow.';
  $('dlActions').innerHTML = st.available
    ? `<button class="btn primary" id="dlClaim" type="button">Claim${r.acorns ? ' ' + fmt(r.acorns) : ''}</button>${r.acorns ? `<button class="btn adwide" style="width:auto" id="dlDouble" type="button"><svg><use href="#i-ad"/></svg>Claim ${fmt(r.acorns * 2)}</button>` : ''}`
    : '';
  const done = res => { if (!res) return; haptic('success'); toast(res.skin ? 'Midnight Glow unlocked!' : `+${fmt(res.acorns)} acorns`, res.skin ? 'Equip it in the Shop' : null); track('daily_claim', { day: res.index + 1 }); renderDaily(); refreshHome(); scheduleDailyReminder(); };
  if ($('dlClaim')) $('dlClaim').onclick = () => done(meta.claimDaily(1));
  if ($('dlDouble')) $('dlDouble').onclick = async () => { if (await Ads.showRewarded('daily_double')) done(meta.claimDaily(2)); };
}
function maybeAutoDaily() { if (save.tutorialDone && meta.dailyState().available && !stack.length && mode === 'home') openSheet('sheetDaily', renderDaily); }

// ---------- shop ----------
let shopTab = 'outfits';
function openShop(tab) { shopTab = tab; openSheet('sheetShop', renderShop); }
document.querySelectorAll('#sheetShop [data-tab]').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; renderShop(); });
function avatar(s) {
  const dots = [[18, 10, 10], [40, 4, 12], [60, 12, 9], [28, 24, 7], [52, 26, 8]].map(([x, y, r]) => `<i style="left:${x}px;top:${y}px;width:${r}px;height:${r}px"></i>`).join('');
  return `<div class="avatar ${s.glow ? 'glow' : ''} ${s.metal ? 'metal' : ''}" style="--cap:${s.cap};--dots:${s.dots};--cloak:${s.cloak};--scarf:${s.scarf}"><div class="cloak"></div><div class="scarf"></div><div class="face"></div><div class="capx">${dots}</div></div>`;
}
function renderShop() {
  document.querySelectorAll('#sheetShop [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === shopTab)));
  $('shAcorns').textContent = fmt(save.acorns);
  const body = $('shBody');
  if (shopTab === 'outfits') {
    body.innerHTML = `<div class="grid2">${SKINS.map(s => {
      const own = save.skins.includes(s.id), on = save.skin === s.id;
      let btn;
      if (on) btn = '<button class="btn" disabled type="button">Wearing</button>';
      else if (own) btn = `<button class="btn primary" data-equip="${s.id}" type="button">Wear</button>`;
      else if (s.unlock === 'daily') btn = '<button class="btn" disabled type="button"><svg><use href="#i-lock"/></svg>Day 7 gift</button>';
      else btn = `<button class="btn acorn" data-buy="${s.id}" type="button" ${save.acorns < s.price ? 'disabled' : ''}>${acornSvg}${fmt(s.price)}</button>`;
      return `<div class="item ${on ? 'on' : ''}">${avatar(s)}<h4>${s.name}</h4><p>${s.desc}</p>${btn}</div>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => { meta.equipSkin(b.dataset.equip); engine.setSkin(meta.currentSkin()); renderShop(); });
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { if (meta.buySkin(b.dataset.buy)) { engine.setSkin(meta.currentSkin()); haptic('success'); toast('New outfit!'); track('buy_skin', { id: b.dataset.buy }); } renderShop(); refreshHome(); });
  } else if (shopTab === 'upgrades') {
    const icons = { magnet: 'i-magnet', shield: 'i-shield', dbl: 'i-dbl' };
    body.innerHTML = Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = save.upgrades[k], price = meta.upgradePrice(k);
      return `<div class="upg"><div class="ic" style="color:${u.color}"><svg><use href="#${icons[k]}"/></svg></div>
        <div><h4>${u.name}</h4><small>${upgradeDuration(k, lvl)} s${price != null ? ` → ${upgradeDuration(k, lvl + 1)} s` : ' · max'}</small>
        <div class="pips" style="--c:${u.color}">${Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        ${price != null ? `<button class="btn acorn" data-up="${k}" type="button" ${save.acorns < price ? 'disabled' : ''}>${acornSvg}${fmt(price)}</button>` : '<span class="owned"><svg><use href="#i-check"/></svg>Max</span>'}</div>`;
    }).join('') + `<div class="section-title">Boosts</div>
      <div class="upg"><div class="ic" style="color:var(--ember)"><svg><use href="#i-rocket"/></svg></div>
      <div><h4>Head start</h4><small>Fly the first 520 m untouchable, scooping acorns. You own ${save.boosts.headstart}.</small></div>
      <button class="btn acorn" id="buyHs" type="button" ${save.acorns < HEADSTART_PRICE ? 'disabled' : ''}>${acornSvg}${fmt(HEADSTART_PRICE)}</button></div>`;
    body.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { if (meta.buyUpgrade(b.dataset.up)) { engine.setDurations(meta.durations()); haptic('success'); track('buy_upgrade', { id: b.dataset.up }); } renderShop(); refreshHome(); });
    $('buyHs').onclick = () => { if (meta.buyHeadstart()) { save.useHeadstart = true; persist(); haptic('success'); toast('Head start ready', 'It will fire on your next run'); } renderShop(); refreshHome(); };
  } else {
    const left = Ads.freeAdsLeft();
    const storeOk = Store.available();
    body.innerHTML = `
      <div class="upg"><div class="ic" style="color:var(--ad)"><svg><use href="#i-ad"/></svg></div>
        <div><h4>Free acorns</h4><small>Watch a short ad for ${FREE_AD_ACORNS} acorns. ${left} left today.</small></div>
        <button class="btn adwide" style="width:auto" id="freeAd" type="button" ${left ? '' : 'disabled'}>+${FREE_AD_ACORNS}</button></div>
      ${PRODUCTS.map(p => {
        const owned = p.kind === 'nonconsumable' && save.purchases.includes(p.id);
        const hidden = p.id === 'pip_remove_ads' && save.removeAds && !owned;
        if (hidden) return '';
        return `<div class="prod ${p.id === 'pip_starter_pack' ? 'feature' : ''}">${p.tag && !owned ? `<span class="tag">${p.tag}</span>` : ''}
          <h4>${p.title}</h4><ul>${p.lines.map(l => `<li>${l}</li>`).join('')}</ul>
          ${owned ? '<span class="owned"><svg><use href="#i-check"/></svg>Owned</span>' : `<button class="btn primary" data-iap="${p.id}" type="button" ${storeOk ? '' : 'disabled'}>${Store.priceOf(p)}</button>`}</div>`;
      }).join('')}
      ${storeOk ? '' : '<p class="fine">The store is not available right now. Check your connection and try again later.</p>'}
      <button class="btn ghost" id="shRestore" type="button">Restore purchases</button>
      <p class="fine">Purchases are optional. Everything in the game can also be earned by playing.</p>`;
    $('freeAd').onclick = async () => { if (!Ads.freeAdsLeft()) return; if (await Ads.showRewarded('free_acorns')) { Ads.useFreeAd(); meta.addAcorns(FREE_AD_ACORNS, 'ad_free'); haptic('success'); toast(`+${FREE_AD_ACORNS} acorns`); } renderShop(); refreshHome(); };
    body.querySelectorAll('[data-iap]').forEach(b => b.onclick = async () => {
      const p = PRODUCTS.find(x => x.id === b.dataset.iap); b.disabled = true;
      const r = await Store.buy(p);
      if (r === 'ok') { haptic('success'); toast('Thank you!', p.title + ' added'); engine.setSkin(meta.currentSkin()); }
      else if (r === 'error') toast('Purchase failed', 'You were not charged. Try again later.');
      renderShop(); refreshHome();
    });
    $('shRestore').onclick = restore;
  }
}
async function restore() {
  const n = await Store.restore();
  if (!isNative()) toast('Nothing to restore', 'Restoring works in the phone app');
  else if (n < 0) toast('Restore failed', 'Check your connection and try again');
  else toast(n ? 'Purchases restored' : 'No purchases found');
  engine.setSkin(meta.currentSkin()); if (!$('sheetShop').hidden) renderShop(); refreshHome();
}

// ---------- settings ----------
function renderSettings() {
  $('stSfx').checked = save.settings.sfx; $('stMusic').checked = save.settings.music; $('stHaptics').checked = save.settings.haptics;
  document.querySelectorAll('.seg [data-q]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.q === save.settings.quality)));
  $('stPrivacyOpts').hidden = !Ads.privacyOptionsRequired;
  $('stVersion').textContent = `Version ${CONFIG.appVersion} · ${platformName()}${save.removeAds ? ' · No ads' : ''}`;
  $('stReset').textContent = 'Reset progress'; $('stReset').dataset.armed = '';
}
$('stSfx').onchange = e => { save.settings.sfx = e.target.checked; persist(); applySettings(); };
$('stMusic').onchange = e => { save.settings.music = e.target.checked; persist(); applySettings(); };
$('stHaptics').onchange = e => { save.settings.haptics = e.target.checked; persist(); };
document.querySelectorAll('.seg [data-q]').forEach(b => b.onclick = () => { save.settings.quality = b.dataset.q; persist(); engine.setQuality(pickQuality()); renderSettings(); });
$('stRestore').onclick = restore;
$('stPrivacyOpts').onclick = () => Ads.showPrivacyOptions();
$('stTutorial').onclick = () => { save.tutorialDone = false; persist(); closeSheet('sheetSettings'); startRun(); };
$('stReset').onclick = () => {
  const b = $('stReset');
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to erase everything'; return; }
  const keepPurchases = save.purchases.slice();
  resetSave(); for (const id of keepPurchases) { const p = PRODUCTS.find(x => x.id === id); if (p) meta.grantProduct(p, { restoring: true }); }
  meta.initMissions(); applySettings(); closeSheet('sheetSettings'); toast('Progress reset'); showHome();
};

meta.onMeta((type, d) => {
  if (type === 'wallet') { refreshHome(); if (!$('sheetShop').hidden) $('shAcorns').textContent = fmt(save.acorns); }
  if (type === 'missionDone' && mode === 'run') { toast('Mission complete!', meta.missionText(d), 'rgba(141,255,122,.6)'); haptic('success'); }
});

// ======================= BOOT =======================
showHome();
nativeChrome();
if (!isNative() && 'serviceWorker' in navigator && location.protocol === 'https:' && !/claude|claudeusercontent/.test(location.host)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
track('app_open', { platform: platformName(), runs: save.totals.runs });
(async () => {
  await Ads.init();
  await Store.init();
  refreshHome();
  setTimeout(maybeAutoDaily, 900);
})();

// expose for the store-screenshot script only
window.__pip = { engine, save, startRun, openShop, openSheet, renderMissions, renderDaily, showHome };
