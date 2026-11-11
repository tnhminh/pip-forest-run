// Renders the app icon / splash / store graphics from SVG with Playwright.
const { chromium } = require('playwright');
const fs = require('fs');
const pip = (s = 1, glow = true) => `
<g transform="scale(${s})">
  ${glow ? '<circle cx="0" cy="40" r="300" fill="url(#lg)"/>' : ''}
  <path d="M-150 330 Q0 60 150 330 Z" fill="#2f7a52"/>
  <path d="M-150 330 Q0 60 150 330 Z" fill="url(#shade)"/>
  <ellipse cx="0" cy="118" rx="96" ry="30" fill="#ff8a3d"/>
  <path d="M40 120 l40 70 l-30 6 z" fill="#ff8a3d"/>
  <circle cx="0" cy="40" r="92" fill="#f3cfa3"/>
  <circle cx="-34" cy="46" r="13" fill="#14161c"/><circle cx="34" cy="46" r="13" fill="#14161c"/>
  <circle cx="-30" cy="41" r="4.5" fill="#fff"/><circle cx="38" cy="41" r="4.5" fill="#fff"/>
  <ellipse cx="-58" cy="74" rx="17" ry="11" fill="#ff9c8a" opacity=".8"/><ellipse cx="58" cy="74" rx="17" ry="11" fill="#ff9c8a" opacity=".8"/>
  <path d="M-16 88 Q0 102 16 88" stroke="#7a3b2a" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M-205 -10 C-200 -150 -90 -215 0 -215 C90 -215 200 -150 205 -10 C140 12 -140 12 -205 -10 Z" fill="#e0412b"/>
  <path d="M-205 -10 C-200 -150 -90 -215 0 -215 C90 -215 200 -150 205 -10 C140 12 -140 12 -205 -10 Z" fill="url(#capshade)"/>
  <path d="M-196 -6 C-130 22 130 22 196 -6 C150 30 -150 30 -196 -6Z" fill="#f4e3c4"/>
  <ellipse cx="-95" cy="-110" rx="34" ry="22" fill="#fff4e2"/><ellipse cx="15" cy="-165" rx="40" ry="22" fill="#fff4e2"/>
  <ellipse cx="110" cy="-95" rx="30" ry="20" fill="#fff4e2"/><ellipse cx="-30" cy="-75" rx="22" ry="14" fill="#fff4e2"/>
  <ellipse cx="160" cy="-35" rx="18" ry="12" fill="#fff4e2"/><ellipse cx="-160" cy="-45" rx="18" ry="12" fill="#fff4e2"/>
  <g transform="translate(150 230)"><rect x="-22" y="-32" width="44" height="58" rx="10" fill="#2a2a2f"/><circle cx="0" cy="-2" r="20" fill="#ffd27a"/><circle cx="0" cy="-2" r="62" fill="url(#lantern)"/></g>
</g>`;
const defs = `<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#5a4380"/><stop offset=".55" stop-color="#2a2550"/><stop offset="1" stop-color="#0b1430"/></radialGradient>
  <radialGradient id="lg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb860" stop-opacity=".35"/><stop offset="1" stop-color="#ffb860" stop-opacity="0"/></radialGradient>
  <radialGradient id="lantern" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a40" stop-opacity="0"/></radialGradient>
  <linearGradient id="capshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
</defs>`;
const bgRect = (w, h) => `<rect width="${w}" height="${h}" fill="url(#bg)"/>${Array.from({ length: 46 }, (_, i) => { const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1, r2 = Math.abs(Math.sin(i * 78.233) * 12345.678) % 1; return `<circle cx="${(r1 * w).toFixed(1)}" cy="${(r2 * h * .6).toFixed(1)}" r="${(w / 1024) * (1.2 + (i % 3))}" fill="#fff" opacity="${.3 + (i % 4) * .15}"/>`; }).join('')}
  <path d="M0 ${h * .78} Q${w * .25} ${h * .7} ${w * .5} ${h * .76} T${w} ${h * .74} V${h} H0Z" fill="#16202a"/>`;
const svg = (w, h, inner, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${bg ? bgRect(w, h) : ''}${inner}</svg>`;

const jobs = {
  'assets/icon-only.png': [1024, 1024, svg(1024, 1024, `<g transform="translate(512 560)">${pip(1.38)}</g>`)],
  'assets/icon-foreground.png': [1024, 1024, svg(1024, 1024, `<g transform="translate(512 545)">${pip(.98)}</g>`, false)],
  'assets/icon-background.png': [1024, 1024, svg(1024, 1024, '')],
  'assets/splash.png': [2732, 2732, svg(2732, 2732, `<g transform="translate(1366 1300)">${pip(1.5)}</g><text x="1366" y="1960" text-anchor="middle" font-family="Lilita One" font-size="190" fill="#ffc23a">Pip's Forest Run</text>`)],
  'assets/splash-dark.png': [2732, 2732, svg(2732, 2732, `<g transform="translate(1366 1300)">${pip(1.5)}</g><text x="1366" y="1960" text-anchor="middle" font-family="Lilita One" font-size="190" fill="#ffc23a">Pip's Forest Run</text>`)],
  'store/feature-graphic-1024x500.png': [1024, 500, svg(1024, 500, `<g transform="translate(800 270)">${pip(.62)}</g><text x="60" y="210" font-family="Lilita One" font-size="62" fill="#e9eef3">Pip's</text><text x="56" y="320" font-family="Lilita One" font-size="118" fill="#ffc23a">Forest Run</text><text x="62" y="380" font-family="Nunito" font-weight="800" font-size="30" fill="#cdd7e1">Dodge. Slide. Collect acorns.</text>`)],
};
(async () => {
  const b64 = f => fs.readFileSync(f).toString('base64');
  const fontCss = `@font-face{font-family:"Lilita One";src:url(data:font/woff2;base64,${b64('www/fonts/lilita-one.woff2')})}@font-face{font-family:"Nunito";src:url(data:font/woff2;base64,${b64('www/fonts/nunito.woff2')});font-weight:600 900}`;
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [out, [w, h, s]] of Object.entries(jobs)) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<style>${fontCss}html,body{margin:0;background:transparent}</style>${s}`);
    await p.evaluate(async () => { await document.fonts.load('100px "Lilita One"'); await document.fonts.load('800 30px Nunito'); await document.fonts.ready; });
    await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    console.log('wrote', out);
  }
  await b.close();
})();
