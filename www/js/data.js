// Game content tables: skins, upgrades, missions, daily rewards, store products.

export const SKINS = [
  { id: 'classic', name: 'Fly Agaric', desc: 'The cap Pip was born with.', price: 0,
    cap: '#e0412b', dots: '#fff4e2', cloak: '#2f7a52', scarf: '#ff8a3d' },
  { id: 'bluecap', name: 'Bluecap', desc: 'Cool as a mountain stream.', price: 2500,
    cap: '#2f6be0', dots: '#e8f3ff', cloak: '#36466e', scarf: '#ffd23d' },
  { id: 'chanterelle', name: 'Chanterelle', desc: 'Golden frills, forest-floor cloak.', price: 6000,
    cap: '#f5a524', dots: '#ffe3a1', cloak: '#6b4c2a', scarf: '#d8432f' },
  { id: 'midnight', name: 'Midnight Glow', desc: 'Day 7 daily reward. Spots that glow.', price: null, unlock: 'daily',
    cap: '#4a2a7a', dots: '#8ff0ff', cloak: '#1e2442', scarf: '#8ff0ff', glow: true },
  { id: 'golden', name: 'Golden Lantern', desc: 'Starter Pack exclusive, or 25,000 acorns.', price: 25000, unlock: 'starter',
    cap: '#ffcf3d', dots: '#fff8de', cloak: '#8a1f2a', scarf: '#ffcf3d', metal: true },
];

export const UPGRADES = {
  magnet: { name: 'Acorn Magnet', unit: 's', base: 9, per: 2, color: '#6fd0ff' },
  shield: { name: 'Bark Shield', unit: 's', base: 12, per: 3, color: '#8dff7a' },
  dbl: { name: 'Double Score', unit: 's', base: 10, per: 2, color: '#ff7fd8' },
};
export const UPGRADE_COST = [400, 1200, 3000, 6000, 10000];
export const MAX_UPGRADE = UPGRADE_COST.length;
export const upgradeDuration = (key, lvl) => UPGRADES[key].base + UPGRADES[key].per * lvl;

export const HEADSTART_PRICE = 400;
export const HEADSTART_METERS = 520;

export const DAILY = [
  { acorns: 100 }, { acorns: 150 }, { acorns: 200 }, { acorns: 300 },
  { acorns: 400 }, { acorns: 600 }, { skin: 'midnight', fallback: 1500 },
];

const r50 = n => Math.round(n / 50) * 50;
export const MISSIONS = [
  { t: 'run_acorns', scope: 'run', text: n => `Collect ${n} acorns in one run`, target: L => 40 + L * 15 },
  { t: 'run_dist', scope: 'run', text: n => `Run ${n} m in one run`, target: L => r50(400 + L * 150) },
  { t: 'run_score', scope: 'run', text: n => `Score ${n.toLocaleString('en-US')} in one run`, target: L => r50(700 + L * 900) },
  { t: 'run_jumps', scope: 'run', text: n => `Jump ${n} times in one run`, target: L => 8 + L * 3 },
  { t: 'run_slides', scope: 'run', text: n => `Slide ${n} times in one run`, target: L => 6 + L * 3 },
  { t: 'total_acorns', scope: 'total', text: n => `Collect ${n} acorns in total`, target: L => r50(150 + L * 90) },
  { t: 'total_powerups', scope: 'total', text: n => `Grab ${n} power-ups`, target: L => 2 + L },
  { t: 'total_carts', scope: 'total', text: n => `Dodge ${n} runaway carts`, target: L => 2 + L },
  { t: 'total_runs', scope: 'total', text: n => `Play ${n} runs`, target: () => 3 },
];
export const missionReward = L => 80 + L * 20;
export const MAX_LEVEL = 29; // multiplier = level + 1, so x30 cap

export const REVIVE_BASE_PRICE = 150;
export const FREE_AD_ACORNS = 100;

// Store products. IDs must match the products you create in Google Play Console,
// App Store Connect and RevenueCat. `price` is a fallback label for the web preview;
// on device the localized store price is shown instead.
export const PRODUCTS = [
  { id: 'pip_starter_pack', kind: 'nonconsumable', title: 'Starter Pack', price: '$3.99', tag: 'One time',
    lines: ['No interstitial ads, forever', '5,000 acorns', 'Golden Lantern outfit'], acorns: 5000, removeAds: true, skin: 'golden' },
  { id: 'pip_remove_ads', kind: 'nonconsumable', title: 'No Ads', price: '$2.99',
    lines: ['Removes interstitial ads', 'Bonus ads you choose still work'], removeAds: true },
  { id: 'pip_acorns_small', kind: 'consumable', title: 'Pouch of Acorns', price: '$0.99', lines: ['1,500 acorns'], acorns: 1500 },
  { id: 'pip_acorns_large', kind: 'consumable', title: 'Barrel of Acorns', price: '$4.99', tag: 'Best value', lines: ['9,000 acorns'], acorns: 9000 },
];
