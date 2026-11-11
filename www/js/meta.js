// Meta progression: wallet, missions (score multiplier), daily streak, shop.
import { save, persist, today, yesterday } from './save.js';
import { SKINS, UPGRADE_COST, MAX_UPGRADE, MISSIONS, missionReward, MAX_LEVEL, DAILY, HEADSTART_PRICE, upgradeDuration } from './data.js';

const listeners = new Set();
export const onMeta = fn => listeners.add(fn);
const emit = (type, data) => { for (const fn of listeners) fn(type, data); };

// ---------- wallet ----------
export function addAcorns(n, source) { save.acorns += Math.max(0, Math.floor(n)); persist(); emit('wallet', { delta: n, source }); }
export function spend(n) { if (save.acorns < n) return false; save.acorns -= n; persist(); emit('wallet', { delta: -n }); return true; }

// ---------- multiplier ----------
export const multiplier = () => Math.min(MAX_LEVEL, save.level) + 1;

// ---------- missions ----------
function newMissionSet() {
  const L = save.level;
  const pool = MISSIONS.slice().sort(() => Math.random() - 0.5);
  const picked = [];
  for (const m of pool) {
    if (picked.length === 3) break;
    if (picked.some(p => p.scope === m.scope && p.t.split('_')[1] === m.t.split('_')[1])) continue;
    picked.push(m);
  }
  return picked.map(m => ({ t: m.t, target: m.target(L), progress: 0, done: false, claimed: false }));
}
export function ensureMissions() { if (!save.missions || save.missions.length !== 3) { save.missions = newMissionSet(); persist(); } return save.missions; }
export const missionDef = t => MISSIONS.find(m => m.t === t);
export const missionText = m => missionDef(m.t).text(m.target);
export const claimableCount = () => ensureMissions().filter(m => m.done && !m.claimed).length;

function setProgress(m, value) {
  if (m.done) return;
  m.progress = Math.min(m.target, value);
  if (m.progress >= m.target) { m.done = true; emit('missionDone', m); }
}
// called live during a run and once at the end
export function trackRun(stats, final = false) {
  const ms = ensureMissions();
  for (const m of ms) {
    if (m.done) continue;
    const def = missionDef(m.t);
    if (def.scope === 'run') {
      const v = { run_acorns: stats.coins, run_dist: stats.dist, run_score: stats.score, run_jumps: stats.jumps, run_slides: stats.slides }[m.t];
      if (v >= m.target) setProgress(m, v); else if (final) m.progress = Math.max(m.progress, Math.floor(v));
    } else {
      const base = { total_acorns: save.totals.acorns, total_powerups: save.totals.powerups, total_carts: save.totals.carts, total_runs: save.totals.runs }[m.t];
      const live = final ? 0 : { total_acorns: stats.coins, total_powerups: stats.powerups, total_carts: stats.carts, total_runs: 0 }[m.t];
      setProgress(m, (final ? base : base + live) - (m.startTotal ?? 0));
    }
  }
}
export function claimMission(i) {
  const m = ensureMissions()[i];
  if (!m || !m.done || m.claimed) return 0;
  m.claimed = true;
  const reward = missionReward(save.level);
  addAcorns(reward, 'mission');
  let leveled = false;
  if (save.missions.every(x => x.claimed)) {
    if (save.level < MAX_LEVEL) save.level++;
    save.missions = newMissionSet();
    stampTotals();
    leveled = true;
    emit('levelUp', multiplier());
  }
  persist();
  return { reward, leveled };
}
// total-scope missions count from the moment the set was created
function stampTotals() {
  for (const m of save.missions) {
    const base = { total_acorns: save.totals.acorns, total_powerups: save.totals.powerups, total_carts: save.totals.carts, total_runs: save.totals.runs }[m.t];
    if (base !== undefined) m.startTotal = base;
  }
}
export function initMissions() {
  ensureMissions();
  for (const m of save.missions) if (m.startTotal === undefined && missionDef(m.t).scope === 'total') stampTotals();
  persist();
}

export function finishRun(stats) {
  save.totals.runs++;
  save.totals.acorns += stats.coins;
  save.totals.dist += Math.floor(stats.dist);
  save.totals.powerups += stats.powerups;
  save.totals.carts += stats.carts;
  const best = stats.score > save.best;
  if (best) save.best = Math.floor(stats.score);
  addAcorns(stats.coins, 'run');
  trackRun(stats, true);
  persist(true);
  return { best };
}

// ---------- daily ----------
export function dailyState() {
  const t = today();
  const claimedToday = save.daily.last === t;
  const continuing = save.daily.last === yesterday();
  const streak = claimedToday ? save.daily.streak : continuing ? save.daily.streak : 0;
  const nextIndex = claimedToday ? (save.daily.streak - 1) % 7 : streak % 7;
  return { available: !claimedToday, streak, index: nextIndex, claimedToday };
}
export function dailyReward(i) {
  const d = DAILY[i];
  if (d.skin && save.skins.includes(d.skin)) return { acorns: d.fallback };
  return d;
}
export function claimDaily(mult = 1) {
  const st = dailyState();
  if (!st.available) return null;
  const r = dailyReward(st.index);
  save.daily.streak = st.streak + 1;
  save.daily.last = today();
  if (r.skin) { save.skins.push(r.skin); emit('skin', r.skin); }
  if (r.acorns) addAcorns(r.acorns * mult, 'daily');
  persist(true);
  return { ...r, acorns: r.acorns ? r.acorns * mult : 0, index: st.index };
}

// ---------- shop ----------
export const skinById = id => SKINS.find(s => s.id === id) || SKINS[0];
export const currentSkin = () => skinById(save.skin);
export function buySkin(id) {
  const s = skinById(id);
  if (save.skins.includes(id) || s.price == null) return false;
  if (!spend(s.price)) return false;
  save.skins.push(id); save.skin = id; persist(); emit('skin', id); return true;
}
export function equipSkin(id) { if (!save.skins.includes(id)) return false; save.skin = id; persist(); emit('skin', id); return true; }
export const upgradePrice = k => save.upgrades[k] >= MAX_UPGRADE ? null : UPGRADE_COST[save.upgrades[k]];
export function buyUpgrade(k) { const p = upgradePrice(k); if (p == null || !spend(p)) return false; save.upgrades[k]++; persist(); return true; }
export const durations = () => ({ magnet: upgradeDuration('magnet', save.upgrades.magnet), shield: upgradeDuration('shield', save.upgrades.shield), dbl: upgradeDuration('dbl', save.upgrades.dbl) });
export function buyHeadstart() { if (!spend(HEADSTART_PRICE)) return false; save.boosts.headstart++; persist(); return true; }
export function consumeHeadstart() { if (!save.useHeadstart || save.boosts.headstart <= 0) return false; save.boosts.headstart--; if (!save.boosts.headstart) save.useHeadstart = false; persist(); return true; }

// ---------- purchases ----------
export function grantProduct(p, { restoring = false } = {}) {
  if (p.kind === 'nonconsumable') {
    if (save.purchases.includes(p.id)) return false;
    save.purchases.push(p.id);
  }
  if (p.removeAds) save.removeAds = true;
  if (p.skin && !save.skins.includes(p.skin)) { save.skins.push(p.skin); if (!restoring) save.skin = p.skin; emit('skin', save.skin); }
  if (p.acorns && !restoring) addAcorns(p.acorns, 'purchase');
  persist(true);
  return true;
}
