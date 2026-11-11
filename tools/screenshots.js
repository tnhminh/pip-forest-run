// Store screenshots: captures real game screens, then frames them with a caption at 1080x1920.
// Needs the web build served at http://localhost:8765 (npm run serve).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'store/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8765/index.html';

const shots = [
  { name: '1-run', caption: 'Dash down the old mine rails', sub: 'Jump logs, slide under beams, dodge carts', setup: 'run' },
  { name: '2-boost', caption: 'Blast off with Head Start', sub: 'Fly past trouble, scoop up acorns', setup: 'boost' },
  { name: '3-outfits', caption: 'Unlock glowing outfits', sub: 'Five looks for Pip, one from your daily streak', setup: 'shop' },
  { name: '4-missions', caption: 'Missions multiply your score', sub: 'Climb all the way to ×30', setup: 'missions' },
  { name: '5-daily', caption: 'A gift every day', sub: 'Keep your 7-day streak alive', setup: 'daily' },
  { name: '6-home', caption: 'A cozy 3D forest at dusk', sub: 'Plays offline, smooth on older phones', setup: 'home' },
];

async function waitDist(p, d) { for (let i = 0; i < 600; i++) { const s = await p.evaluate(() => __pip.engine.stats()); if (s.dist >= d) return; await p.waitForTimeout(250); } }

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const raw = {};
  for (const s of shots) {
    const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    p.setDefaultTimeout(180000);
    await p.addInitScript(() => {
      localStorage.setItem('pip.save.v1', JSON.stringify({ acorns: 7340, best: 18250, level: 3, tutorialDone: true, skins: ['classic', 'bluecap'], skin: 'classic',
        upgrades: { magnet: 2, shield: 1, dbl: 1 }, boosts: { headstart: 2 }, daily: { last: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), streak: 4 }, totals: { runs: 12, acorns: 900, dist: 9000, powerups: 9, carts: 4 },
        settings: { sfx: false, music: false, haptics: true, quality: 'high' } }));
    });
    await p.goto(BASE); await p.waitForTimeout(3500);
    if (s.setup === 'run' || s.setup === 'boost') {
      await p.evaluate(boost => { __pip.save.useHeadstart = boost; __pip.startRun(); }, s.setup === 'boost');
      if (s.setup === 'boost') await waitDist(p, 120); else await waitDist(p, 54);
    } else if (s.setup === 'shop') { await p.evaluate(() => __pip.openShop('outfits')); }
    else if (s.setup === 'missions') {
      await p.evaluate(() => { const ms = __pip.save.missions; ms[0].progress = ms[0].target; ms[0].done = true; ms[1].progress = Math.round(ms[1].target * .6); __pip.openSheet('sheetMissions', __pip.renderMissions); });
    } else if (s.setup === 'daily') {
      await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); __pip.save.daily = { last: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, streak: 4 }; __pip.openSheet('sheetDaily', __pip.renderDaily); });
    } else { await p.evaluate(() => { document.querySelectorAll('.sheet-wrap').forEach(w => w.hidden = true); }); }
    await p.waitForTimeout(1500);
    raw[s.name] = (await p.screenshot()).toString('base64');
    await p.close();
    console.log('captured', s.name);
  }
  // frame
  const b64 = f => fs.readFileSync(f).toString('base64');
  const font = `@font-face{font-family:"Lilita One";src:url(data:font/woff2;base64,${b64('www/fonts/lilita-one.woff2')})}@font-face{font-family:"Nunito";src:url(data:font/woff2;base64,${b64('www/fonts/nunito.woff2')});font-weight:600 900}`;
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const s of shots) {
    await p.setContent(`<style>${font}
      body{margin:0;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#5a4380,#1b1d3a 55%,#0c141d);font-family:Nunito;color:#e9eef3;display:flex;flex-direction:column;align-items:center}
      h1{font-family:"Lilita One";font-weight:400;font-size:92px;line-height:1;margin:96px 60px 0;text-align:center;color:#ffc23a;text-shadow:0 6px 0 #6b2c0a}
      p{font-weight:800;font-size:40px;margin:22px 60px 0;text-align:center;color:#cdd7e1}
      .phone{margin-top:70px;width:780px;height:1387px;border-radius:64px;overflow:hidden;border:14px solid #05080d;box-shadow:0 40px 120px rgba(0,0,0,.6),0 0 0 3px rgba(255,255,255,.08)}
      .phone img{width:100%;height:100%;object-fit:cover;display:block}</style>
      <h1>${s.caption}</h1><p>${s.sub}</p><div class="phone"><img src="data:image/png;base64,${raw[s.name]}"></div>`);
    await p.evaluate(async () => { await document.fonts.load('90px "Lilita One"'); await document.fonts.load('800 40px Nunito'); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${s.name}.png` });
    console.log('wrote', `${OUT}/${s.name}.png`);
  }
  await b.close();
})();
