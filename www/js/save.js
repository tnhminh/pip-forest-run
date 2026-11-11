// Local save game. Everything lives on the device; nothing is sent to a server.
const KEY = 'pip.save.v1';

function defaults() {
  return {
    v: 1,
    acorns: 0,
    best: 0,
    level: 0,
    missions: null,
    totals: { runs: 0, acorns: 0, dist: 0, powerups: 0, carts: 0 },
    skins: ['classic'],
    skin: 'classic',
    upgrades: { magnet: 0, shield: 0, dbl: 0 },
    boosts: { headstart: 1 },
    useHeadstart: false,
    daily: { last: null, streak: 0 },
    removeAds: false,
    purchases: [],
    tutorialDone: false,
    settings: { sfx: true, music: true, haptics: true, quality: 'auto' },
    ads: { runsSince: 0, lastAt: 0, freeDay: null, freeCount: 0 },
    notifAsked: false,
    created: Date.now(),
  };
}

function merge(base, extra) {
  for (const k of Object.keys(extra || {})) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) merge(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (e) { /* private mode or corrupted: start fresh */ }
  return defaults();
}

export const save = load();

let timer = 0;
export function persist(now = false) {
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
  clearTimeout(timer);
  if (now) write(); else timer = setTimeout(write, 120);
}

export function resetSave() {
  const fresh = defaults();
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, fresh);
  persist(true);
}

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return today(d); }
