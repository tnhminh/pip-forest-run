// 3D runner engine (three.js r147 globals). No DOM UI here: it reports through onEvent/onFrame.
/* global THREE */
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createEngine(canvas, opts = {}) {
  const emit = (e, d) => opts.onEvent && opts.onEvent(e, d);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let quality = opts.quality === 'low' ? 'low' : 'high';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  THREE.ColorManagement.legacyMode = false;
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const prFor = q => Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.75 : 1);
  renderer.setPixelRatio(prFor(quality));

  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#4b3b5f');
  scene.fog = new THREE.FogExp2(FOG, 0.0165);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

  // ================= TEXTURES =================
  function ctex(w, h, draw, rx = 1, ry = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  function noise(g, w, h, cols, n, r0, r1) { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.globalAlpha = rnd(.3, 1); g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(r0, r1), 0, 7); g.fill(); } g.globalAlpha = 1; }
  const texGrass = ctex(256, 256, (g, w, h) => { g.fillStyle = '#22402c'; g.fillRect(0, 0, w, h); noise(g, w, h, ['#1a3423', '#2a4d33', '#2f5a39', '#1c3a2a', '#3a5f37'], 900, 1, 4); }, 90, 90);
  const texGravel = ctex(256, 256, (g, w, h) => { g.fillStyle = '#4a4547'; g.fillRect(0, 0, w, h); noise(g, w, h, ['#5d5759', '#3a3638', '#6e6766', '#2f2c2e', '#7a706b'], 2200, 1, 3.2); }, 3, 90);
  const texWood = ctex(128, 32, (g, w, h) => { g.fillStyle = '#6e4a30'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4f321f'; for (let i = 0; i < 14; i++) { g.globalAlpha = rnd(.3, .8); g.lineWidth = rnd(.5, 1.6); g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd(-3, 3), w * .7, y + rnd(-3, 3), w, y); g.stroke(); } g.globalAlpha = 1; });
  const texBark = ctex(128, 128, (g, w, h) => { g.fillStyle = '#6b4226'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = pick(['#4a2c17', '#7d5232', '#3d2312']); g.fillRect(Math.random() * w, 0, rnd(1, 4), h); } noise(g, w, h, ['#3d2312', '#8a5d3a'], 200, 1, 2); }, 2, 1);
  const texRings = ctex(128, 128, (g) => { g.fillStyle = '#d9a86a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#a8743f'; for (let r = 6; r < 64; r += rnd(4, 8)) { g.lineWidth = rnd(1, 2.2); g.beginPath(); g.arc(64 + rnd(-2, 2), 64 + rnd(-2, 2), r, 0, 7); g.stroke(); } g.strokeStyle = '#5a3418'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 61, 0, 7); g.stroke(); });
  const texHazard = ctex(256, 64, (g, w, h) => { g.fillStyle = '#f2b51f'; g.fillRect(0, 0, w, h); g.fillStyle = '#16130f'; for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); });
  const texPanel = ctex(256, 128, (g, w, h) => { g.fillStyle = '#d5d9dd'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.beginPath(); g.moveTo(w / 2, 6); g.lineTo(w / 2, h - 6); g.stroke(); g.fillStyle = 'rgba(0,0,0,.4)'; for (const x of [16, w / 2 - 10, w / 2 + 10, w - 16]) for (const y of [16, h - 16]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); } noise(g, w, h, ['rgba(90,60,40,.35)', 'rgba(0,0,0,.15)'], 120, 1, 5); });
  const texGlow = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  function iconTex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = g.strokeStyle = '#0b1220'; g.lineCap = g.lineJoin = 'round';
    if (kind === 'magnet') { g.lineWidth = 22; g.beginPath(); g.moveTo(36, 24); g.lineTo(36, 66); g.arc(64, 66, 28, Math.PI, 0, true); g.lineTo(92, 24); g.stroke(); g.fillStyle = '#fff'; g.fillRect(25, 18, 22, 16); g.fillRect(81, 18, 22, 16); }
    else if (kind === 'shield') { g.beginPath(); g.moveTo(64, 14); g.lineTo(104, 30); g.lineTo(104, 62); g.quadraticCurveTo(100, 100, 64, 116); g.quadraticCurveTo(28, 100, 24, 62); g.lineTo(24, 30); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.moveTo(46, 64); g.lineTo(60, 78); g.lineTo(84, 50); g.stroke(); }
    else { g.font = '76px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×2', 64, 70); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  const ICON = { magnet: iconTex('magnet'), shield: iconTex('shield'), dbl: iconTex('dbl') };
  if (document.fonts) document.fonts.ready.then(() => { ICON.dbl.image = iconTex('dbl').image; ICON.dbl.needsUpdate = true; });

  // ================= SKY =================
  const MOON_DIR = new THREE.Vector3(-0.55, 0.32, -1).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uFog: { value: FOG }, uGlow: { value: new THREE.Color('#d66d5c') }, uMid: { value: new THREE.Color('#3f2f63') }, uTop: { value: new THREE.Color('#0b1430') }, uMoon: { value: MOON_DIR }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader: `uniform vec3 uFog,uGlow,uMid,uTop,uMoon;uniform float uTime;varying vec3 vDir;
    float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec3 d=normalize(vDir);float h=d.y;
      vec3 c=mix(uFog,uGlow,smoothstep(-.02,.06,h));c=mix(c,uMid,smoothstep(.05,.28,h));c=mix(c,uTop,smoothstep(.25,.75,h));
      float m=dot(d,uMoon);c+=vec3(1.,.85,.6)*pow(max(m,0.),60.)*.35+vec3(.6,.5,.7)*pow(max(m,0.),6.)*.12;
      float disk=smoothstep(.99935,.9996,m);float crater=h21(floor(d.xy*900.))*.15;c=mix(c,vec3(2.6,2.35,1.9)*(1.-crater),disk);
      vec2 g=vec2(atan(d.x,d.z)*180.,asin(clamp(h,-1.,1.))*180.);float s=h21(floor(g));vec2 f=fract(g)-.5;
      float star=step(.985,s)*smoothstep(.12,0.,length(f))*smoothstep(.08,.35,h)*(.6+.4*sin(uTime*3.+s*80.));
      c+=vec3(1.4,1.35,1.6)*star*(1.-disk);gl_FragColor=vec4(c,1.);}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat); sky.renderOrder = -1; scene.add(sky);
  function ridge(z, height, color, seed, width = 1600) {
    const pts = [], N = 90;
    for (let i = 0; i <= N; i++) { const x = -width / 2 + width * i / N; const u = i / N * 7 + seed; pts.push([x, height * (.55 + .25 * Math.sin(u * 1.3) + .14 * Math.sin(u * 3.7 + seed) + .06 * Math.sin(u * 9.1))]); }
    const pos = [], col = [], top = new THREE.Color(color);
    for (let i = 0; i < N; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; pos.push(x0, -20, 0, x1, -20, 0, x1, y1, 0, x0, -20, 0, x1, y1, 0, x0, y0, 0); for (const c of [FOG, FOG, top, FOG, top, top]) col.push(c.r, c.g, c.b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false })); m.position.z = z; m.renderOrder = -1; scene.add(m); return m;
  }
  const ridges = [ridge(-560, 150, '#2c2648', 1.3), ridge(-430, 95, '#1d2438', 4.1), ridge(-330, 55, '#16202a', 7.7)];

  // ================= LIGHTS =================
  scene.add(new THREE.HemisphereLight(new THREE.Color('#8a86c8'), new THREE.Color('#1d3326'), 0.8));
  const moon = new THREE.DirectionalLight(new THREE.Color('#b9c8ff'), 1.35);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 20, bottom: -12, near: 1, far: 70 });
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03; scene.add(moon); scene.add(moon.target);
  const rim = new THREE.DirectionalLight(new THREE.Color('#ff9a6b'), 0.55); rim.position.set(0, 6, -30); scene.add(rim);
  const mkPoint = (c, i, d) => { const l = new THREE.PointLight(new THREE.Color(c), i, d, 2); scene.add(l); return l; };
  const lampLights = [mkPoint('#ffb45e', 0, 14), mkPoint('#ffb45e', 0, 14)];
  const cartLights = [mkPoint('#fff0c0', 0, 16), mkPoint('#fff0c0', 0, 16)];
  { const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat)); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }

  // ================= TRACK =================
  const L = 1.6, BASE = 0.16, SPAN = 170;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: texGrass, color: '#a9c7a4', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -260; ground.receiveShadow = true; scene.add(ground);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(6.4, .14, 600), new THREE.MeshStandardMaterial({ color: '#2e2a2a', roughness: 1 })); bank.position.set(0, 0, -260); bank.receiveShadow = true; scene.add(bank);
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 600), new THREE.MeshStandardMaterial({ map: texGravel, roughness: .95 }));
  gravel.rotation.x = -Math.PI / 2; gravel.position.set(0, .071, -260); gravel.receiveShadow = true; scene.add(gravel);
  const SLP = 1.2, NSLP = 140;
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, .1, .32), new THREE.MeshStandardMaterial({ map: texWood, roughness: .85 }), NSLP * 3);
  { const o = new THREE.Object3D(); let k = 0; for (let i = 0; i < NSLP; i++) for (const ln of [-1, 0, 1]) { o.position.set(ln * L + rnd(-.03, .03), .11, 8 - i * SLP); o.rotation.y = rnd(-.03, .03); o.updateMatrix(); sleepers.setMatrixAt(k++, o.matrix); } }
  sleepers.receiveShadow = true; sleepers.frustumCulled = false;
  const sleeperGroup = new THREE.Group(); sleeperGroup.add(sleepers); scene.add(sleeperGroup);
  const railMat = new THREE.MeshStandardMaterial({ color: '#9aa4ae', metalness: .65, roughness: .42 });
  for (const ln of [-1, 0, 1]) for (const s of [-.43, .43]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.09, .11, 600), railMat); r.position.set(ln * L + s, .215, -260); r.receiveShadow = true; scene.add(r); }

  // ================= SCENERY =================
  const BGU = THREE.BufferGeometryUtils;
  function paint(geo, hex) { const c = new THREE.Color(hex); const n = geo.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; }
  const pine = (c1, c2, c3) => BGU.mergeBufferGeometries([
    paint(new THREE.CylinderGeometry(.12, .2, 1.2, 6).translate(0, .6, 0), '#3b2618'),
    paint(new THREE.ConeGeometry(1.25, 1.7, 7).translate(0, 1.55, 0), c1),
    paint(new THREE.ConeGeometry(.95, 1.5, 7).translate(0, 2.45, 0), c2),
    paint(new THREE.ConeGeometry(.6, 1.3, 7).translate(0, 3.25, 0), c3)]);
  const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .92 });
  const scatters = []; const dummy = new THREE.Object3D();
  function scatter(geo, mat, n, xmin, xmax, smin, smax, cast) {
    const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.castShadow = cast; im.receiveShadow = true; scene.add(im);
    const items = []; for (let i = 0; i < n; i++) items.push({ wz: rnd(-12, SPAN - 12), x: (Math.random() < .5 ? -1 : 1) * rnd(xmin, xmax), s: rnd(smin, smax), r: Math.random() * 6.28 });
    scatters.push({ im, items, xmin, xmax, smin, smax });
  }
  scatter(pine('#1f4a33', '#24573b', '#2b6443'), vcMat, 60, 4.4, 26, .9, 1.7, true);
  scatter(pine('#173b2b', '#1c4633', '#21503a'), vcMat, 60, 4.4, 26, 1.0, 2.0, true);
  scatter(pine('#2a4a3a', '#30573f', '#3a6447'), vcMat, 40, 6, 30, 1.2, 2.3, true);
  scatter(paint(new THREE.DodecahedronGeometry(.45, 0).translate(0, .2, 0), '#6b6870'), vcMat, 50, 3.3, 12, .5, 1.4, true);
  scatter(BGU.mergeBufferGeometries([paint(new THREE.ConeGeometry(.35, .6, 5).translate(.15, .3, 0), '#2f6a3c'), paint(new THREE.ConeGeometry(.3, .5, 5).translate(-.15, .25, .1), '#3b7a45'), paint(new THREE.ConeGeometry(.25, .45, 5).translate(0, .22, -.15), '#2a5e36')]), vcMat, 120, 3.2, 16, .7, 1.4, false);
  {
    const n = 60;
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .05, .22, 6).translate(0, .11, 0), new THREE.MeshStandardMaterial({ color: '#e8e2d0' }), n);
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .7, 1).translate(0, .21, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fe3ff').multiplyScalar(2.2) }), n);
    for (const m of [stems, caps]) { m.frustumCulled = false; scene.add(m); }
    const items = []; for (let i = 0; i < n; i++) items.push({ wz: rnd(-12, SPAN - 12), x: (Math.random() < .5 ? -1 : 1) * rnd(3.4, 9), s: rnd(.8, 1.8), r: Math.random() * 6.28 });
    scatters.push({ im: stems, items, xmin: 3.4, xmax: 9, smin: .8, smax: 1.8, twin: caps });
  }
  function updScatter() {
    for (const sc of scatters) {
      const { im, items } = sc;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.wz - D < -14) { it.wz += SPAN; it.x = (Math.random() < .5 ? -1 : 1) * rnd(sc.xmin, sc.xmax); it.s = rnd(sc.smin, sc.smax); }
        dummy.position.set(it.x, .07, -(it.wz - D)); dummy.rotation.set(0, it.r, 0); dummy.scale.setScalar(it.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix); if (sc.twin) sc.twin.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true; if (sc.twin) sc.twin.instanceMatrix.needsUpdate = true;
    }
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: '#2a2b30', metalness: .6, roughness: .5 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb860').multiplyScalar(4) });
  const lamps = [];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group(), side = i % 2 ? 1 : -1;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 3, 8), lampMat); post.position.y = 1.5; post.castShadow = true; g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, .06), lampMat); arm.position.set(-side * .32, 2.9, 0); g.add(arm);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .34, 6), new THREE.MeshStandardMaterial({ color: '#1b1c20', metalness: .5, roughness: .6, transparent: true, opacity: .35 })); cage.position.set(-side * .62, 2.68, 0); g.add(cage);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), bulbMat); bulb.position.copy(cage.position); g.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: new THREE.Color('#ff9a40').multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 })); halo.scale.setScalar(2.4); halo.position.copy(cage.position); g.add(halo);
    g.userData = { wz: i * 17 + 8, side }; g.position.x = side * 3.25; scene.add(g); lamps.push(g);
  }

  // ================= PARTICLES =================
  const ptsVS = `attribute float aSize;attribute float aAlpha;attribute vec3 aColor;varying vec3 vC;varying float vA;uniform float uScale;
  void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*uScale/max(.1,-mv.z);vC=aColor;vA=aAlpha;}`;
  const ptsFS = `varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;if(vA*a<.003)discard;gl_FragColor=vec4(vC*a*vA,1.);}`;
  function pointSys(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 } }, vertexShader: ptsVS, fragmentShader: ptsFS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    p.frustumCulled = false; scene.add(p); return p;
  }
  const sparks = pointSys(700); const SP = []; for (let i = 0; i < 700; i++) SP.push({ life: 0 }); let spI = 0;
  function emitP(x, y, wz, vx, vy, vz, life, size, c, grav = 6, drag = 1.5) { const p = SP[spI]; spI = (spI + 1) % SP.length; Object.assign(p, { x, y, wz, vx, vy, vz, life, max: life, size, r: c[0], g: c[1], b: c[2], grav, drag }); }
  function burst(x, y, wz, c, n, spd = 3) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = rnd(-.4, 1); emitP(x, y, wz, Math.cos(a) * spd * rnd(.3, 1), e * spd + 1, Math.sin(a) * spd * rnd(.3, 1), rnd(.4, .8), rnd(.12, .28), c); } }
  function updSparks(dt) {
    const pa = sparks.geometry.attributes;
    for (let i = 0; i < SP.length; i++) {
      const p = SP[i];
      if (p.life > 0) { p.life -= dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.wz -= p.vz * dt; if (p.y < .1) { p.y = .1; p.vy *= -.3; } }
      const a = Math.max(0, p.life / (p.max || 1));
      pa.position.array[i * 3] = p.x || 0; pa.position.array[i * 3 + 1] = p.y || 0; pa.position.array[i * 3 + 2] = -((p.wz || 0) - D);
      pa.aColor.array[i * 3] = p.r || 0; pa.aColor.array[i * 3 + 1] = p.g || 0; pa.aColor.array[i * 3 + 2] = p.b || 0;
      pa.aSize.array[i] = p.size || 0; pa.aAlpha.array[i] = a;
    }
    pa.position.needsUpdate = pa.aColor.needsUpdate = pa.aSize.needsUpdate = pa.aAlpha.needsUpdate = true;
  }
  const flies = pointSys(170); const FL = [];
  for (let i = 0; i < 170; i++) FL.push({ x: (Math.random() < .5 ? -1 : 1) * rnd(2.8, 16), y: rnd(.4, 4), wz: rnd(-10, 110), ph: Math.random() * 20, sp: rnd(.5, 1.5) });
  { const a = flies.geometry.attributes; for (let i = 0; i < FL.length; i++) { a.aColor.array.set(Math.random() < .7 ? [2.4, 2.0, .6] : [.7, 2.2, 1.6], i * 3); a.aSize.array[i] = rnd(.08, .16); } a.aColor.needsUpdate = a.aSize.needsUpdate = true; }
  function updFlies(t) {
    const a = flies.geometry.attributes;
    for (let i = 0; i < FL.length; i++) {
      const f = FL[i]; if (f.wz - D < -10) { f.wz += 120; f.x = (Math.random() < .5 ? -1 : 1) * rnd(2.8, 16); }
      a.position.array[i * 3] = f.x + Math.sin(t * f.sp + f.ph) * .6; a.position.array[i * 3 + 1] = f.y + Math.sin(t * f.sp * 1.3 + f.ph * 2) * .4; a.position.array[i * 3 + 2] = -(f.wz - D);
      a.aAlpha.array[i] = clamp(.5 + .6 * Math.sin(t * 3 * f.sp + f.ph), 0, 1);
    }
    a.position.needsUpdate = a.aAlpha.needsUpdate = true;
  }

  // ================= PIP =================
  const pip = new THREE.Group(); scene.add(pip);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .75, flatShading: true }, o));
  const matCloak = M('#2f7a52'), matSkin = M('#f3cfa3', { flatShading: false, roughness: .6 }), matCap = M('#e0412b', { flatShading: false, roughness: .45 }), matDot = M('#fff4e2', { flatShading: false }), matBoot = M('#3a2418'), matScarf = M('#ff8a3d');
  function part(geo, mat, x, y, z, parent = pip) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
  const body = new THREE.Group(); pip.add(body);
  const legs = [];
  for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * .13, .42, 0); body.add(hip); part(new THREE.CylinderGeometry(.065, .06, .34, 8).translate(0, -.17, 0), matBoot, 0, 0, 0, hip); part(new THREE.SphereGeometry(.1, 10, 8).scale(1, .7, 1.4), matBoot, 0, -.36, -.04, hip); legs.push(hip); }
  part(new THREE.ConeGeometry(.42, .85, 9), matCloak, 0, .82, 0, body);
  part(new THREE.TorusGeometry(.19, .07, 8, 16).rotateX(Math.PI / 2), matScarf, 0, 1.16, 0, body);
  const tail = part(new THREE.BoxGeometry(.12, .32, .04), matScarf, .1, 1.0, .2, body); tail.rotation.z = .3;
  const head = new THREE.Group(); head.position.y = 1.36; body.add(head);
  part(new THREE.SphereGeometry(.25, 20, 14), matSkin, 0, 0, 0, head);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(.04, 8, 6), M('#14161c', { flatShading: false }), s * .09, .02, -.22, head);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(.045, 8, 6), M('#ff9c8a', { flatShading: false, transparent: true, opacity: .7 }), s * .15, -.06, -.18, head);
  const cap = new THREE.Group(); cap.position.y = .13; head.add(cap);
  part(new THREE.SphereGeometry(.46, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .72, 1), matCap, 0, 0, 0, cap);
  part(new THREE.CircleGeometry(.46, 24).rotateX(Math.PI / 2), M('#f4e3c4', { side: THREE.DoubleSide }), 0, .005, 0, cap);
  for (const [th, ph, r] of [[.5, .3, .07], [.8, 1.4, .06], [.95, 2.4, .08], [.6, 3.3, .06], [.9, 4.3, .07], [.55, 5.3, .06], [1.15, .9, .05], [1.1, 3.8, .05], [.15, 0, .07]])
    part(new THREE.SphereGeometry(r, 10, 8).scale(1, .5, 1), matDot, Math.sin(th) * Math.cos(ph) * .46, Math.cos(th) * .46 * .72, Math.sin(th) * Math.sin(ph) * .46, cap);
  const arms = [];
  for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(s * .28, 1.04, 0); body.add(sh); part(new THREE.CylinderGeometry(.05, .045, .36, 7).translate(0, -.18, 0), matCloak, 0, 0, 0, sh); part(new THREE.SphereGeometry(.06, 8, 6), matSkin, 0, -.37, 0, sh); arms.push(sh); }
  const lantern = new THREE.Group(); lantern.position.set(0, -.48, 0); arms[1].add(lantern);
  part(new THREE.CylinderGeometry(.075, .09, .16, 6), M('#2a2a2f', { metalness: .6, transparent: true, opacity: .45 }), 0, 0, 0, lantern);
  part(new THREE.SphereGeometry(.055, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46b').multiplyScalar(6) }), 0, 0, 0, lantern);
  const lHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: new THREE.Color('#ffa64a').multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .7 })); lHalo.scale.setScalar(1.1); lantern.add(lHalo);
  const lanternLight = new THREE.PointLight(new THREE.Color('#ffae55'), 2.4, 9, 2); lantern.add(lanternLight);
  const shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8dff7a').multiplyScalar(1.5), wireframe: true, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  shieldMesh.position.y = .85; shieldMesh.scale.set(.75, .95, .75); pip.add(shieldMesh);
  const shieldGlow = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5cff6a'), transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false }));
  shieldGlow.position.y = .85; shieldGlow.scale.set(.78, .98, .78); pip.add(shieldGlow);
  const magRing = new THREE.Mesh(new THREE.TorusGeometry(.62, .035, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#6fd0ff').multiplyScalar(2.5), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  magRing.position.y = .12; pip.add(magRing);
  for (const m of [shieldMesh, shieldGlow, magRing]) m.castShadow = false;

  function setSkin(s) {
    matCap.color.set(s.cap); matDot.color.set(s.dots); matCloak.color.set(s.cloak); matScarf.color.set(s.scarf);
    matCap.metalness = s.metal ? .75 : 0; matCap.roughness = s.metal ? .25 : .45;
    matCap.emissive.set(s.metal ? '#5a3a00' : '#000000');
    matDot.emissive.set(s.glow ? s.dots : '#000000'); matDot.emissiveIntensity = s.glow ? 2.2 : 0;
    matScarf.emissive.set(s.glow ? s.scarf : '#000000'); matScarf.emissiveIntensity = s.glow ? .6 : 0;
  }

  // ================= OBSTACLES & PICKUPS =================
  const pools = { log: [], beam: [], cart: [], mcart: [], acorn: [], power: [] };
  const blinkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3020').multiplyScalar(4) });
  const matPost = M('#4f3b2c'), matHaz = new THREE.MeshStandardMaterial({ map: texHazard, roughness: .6 }), matDark = M('#2a2b31', { metalness: .7, roughness: .4, flatShading: false });
  const matOre = M('#5b5560'), matGold = new THREE.MeshStandardMaterial({ color: '#ffb627', metalness: .7, roughness: .28, emissive: new THREE.Color('#ff9a1f'), emissiveIntensity: .55 });
  const matCap2 = M('#7a4520', { roughness: .95 });
  const matPaintGray = new THREE.MeshStandardMaterial({ map: texPanel, color: '#7c8b99', metalness: .55, roughness: .45 }), matPaintRed = new THREE.MeshStandardMaterial({ map: texPanel, color: '#c8342a', metalness: .45, roughness: .4 });
  const matLog = new THREE.MeshStandardMaterial({ map: texBark, roughness: .95 }), matRings = new THREE.MeshStandardMaterial({ map: texRings, roughness: .9 });
  const shadowAll = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
  const BUILD = {
    log() {
      const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(.33, .35, 1.42, 14), [matLog, matRings, matRings]); c.rotation.z = Math.PI / 2; c.position.y = .34; g.add(c);
      const br = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, .4, 6), matLog); br.position.set(.3, .62, 0); br.rotation.z = -.7; g.add(br);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(.16, .14, .5), matPost); w.position.set(s * .5, .07, 0); g.add(w); }
      return shadowAll(g);
    },
    beam() {
      const g = new THREE.Group();
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.95, .16), matPost); p.position.set(s * .7, .97, 0); g.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), blinkMat); b.position.set(s * .7, 2.0, 0); g.add(b); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.62, .5, .16), [matPost, matPost, matPost, matPost, matHaz, matHaz]); bar.position.y = 1.42; g.add(bar);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.62, .08, .3), matPost); plank.position.y = 1.7; g.add(plank);
      return shadowAll(g);
    },
    cart(red) {
      const g = new THREE.Group(); const len = 3.2;
      const bodyM = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.0, len), red ? matPaintRed : matPaintGray); bodyM.position.y = .8; g.add(bodyM);
      const rimM = new THREE.Mesh(new THREE.BoxGeometry(1.42, .09, len + .1), matDark); rimM.position.y = 1.32; g.add(rimM);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.36, .1, len + .04), matDark); band.position.y = .5; g.add(band);
      for (let i = 0; i < 9; i++) { const o = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(.2, .32), 0), Math.random() < .22 ? matGold : matOre); o.position.set(rnd(-.4, .4), 1.3 + rnd(0, .15), rnd(-1.2, 1.2)); o.rotation.set(rnd(0, 3), rnd(0, 3), 0); g.add(o); }
      const wheels = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .12, 14), matDark); w.rotation.z = Math.PI / 2; w.position.set(sx * .62, .24, sz * 1.05); g.add(w); wheels.push(w); }
      shadowAll(g);
      if (red) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2c4').multiplyScalar(6) })); lamp.position.set(0, 1.0, len / 2 + .06); g.add(lamp);
        const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: new THREE.Color('#ffd27a').multiplyScalar(2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); h.scale.setScalar(2.6); h.position.copy(lamp.position); g.add(h);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 3.5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a0'), transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        cone.position.set(0, 1.0, len / 2 + .1); g.add(cone);
      }
      g.userData.wheels = wheels; return g;
    },
    acorn() {
      const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
      const nut = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12).scale(1, 1.22, 1), matGold); inner.add(nut);
      const c = new THREE.Mesh(new THREE.SphereGeometry(.225, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .75, 1), matCap2); c.position.y = .1; inner.add(c);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .12, 6), matCap2); st.position.y = .3; st.rotation.z = .3; inner.add(st);
      inner.scale.setScalar(1.25); nut.castShadow = c.castShadow = true; g.userData.inner = inner; return g;
    },
    power() {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff' })); g.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.48, .035, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff' })); g.add(ring);
      const ring2 = ring.clone(); ring2.material = ring.material; g.add(ring2);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9 })); halo.scale.setScalar(2.2); g.add(halo);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICON.magnet, transparent: true, depthTest: false })); icon.scale.setScalar(.42); icon.renderOrder = 5; g.add(icon);
      g.userData = { core, ring, ring2, halo, icon }; return g;
    },
  };
  const PCOL = { magnet: '#6fd0ff', shield: '#8dff7a', dbl: '#ff7fd8' };
  function take(kind) { const p = pools[kind]; const m = p.length ? p.pop() : (kind === 'cart' ? BUILD.cart(false) : kind === 'mcart' ? BUILD.cart(true) : BUILD[kind]()); m.visible = true; scene.add(m); return m; }
  function release(o) { if (o.mesh) { scene.remove(o.mesh); pools[o.pool].push(o.mesh); o.mesh = null; } }

  // ================= POST =================
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .85, .55, .92); composer.addPass(bloom);
  const finalPass = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHit: { value: 0 }, uSpeed: { value: 0 }, uSat: { value: 1 }, uGrain: { value: 1 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uHit,uSpeed,uSat,uGrain;varying vec2 vUv;
    vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec2 d=vUv-.5;float r2=dot(d,d);float ca=(.006+uSpeed*.012)*r2;
      vec3 c=vec3(texture2D(tDiffuse,vUv+d*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*ca).b);
      c=aces(c*1.08);c=pow(c,vec3(1./2.2));float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat*1.08);
      c+=(1.-l)*vec3(-.012,.004,.03)+l*vec3(.025,.008,-.02);
      float vig=smoothstep(.95,.25,length(d*vec2(1.15,1.)));c*=mix(.5,1.,vig);
      c=mix(c,vec3(.95,.15,.12),uHit*(1.-vig*.8)*.65);
      c+=(h(vUv*vec2(1733.,977.)+fract(uTime))-.5)*.03*uGrain;gl_FragColor=vec4(c,1.);}`,
  });
  composer.addPass(finalPass);

  function applyQuality() {
    const hi = quality === 'high';
    renderer.setPixelRatio(prFor(quality)); composer.setPixelRatio(prFor(quality));
    if (renderer.shadowMap.enabled !== hi) { renderer.shadowMap.enabled = hi; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }
    bloom.enabled = hi; flies.visible = true;
    resize();
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ================= AUDIO =================
  const audio = { sfx: true, music: true };
  let actx = null, master = null, noiseBuf = null;
  function unlockAudio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = .7; master.connect(actx.destination);
        noiseBuf = actx.createBuffer(1, actx.sampleRate * .5, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  const canPlay = kind => actx && actx.state === 'running' && audio[kind];
  function tone(f, d, type = 'square', v = .06, slide = 0, t0 = 0, kind = 'sfx') { if (!canPlay(kind)) return; const t = actx.currentTime + t0, o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .02); }
  function hiss(d, v, freq = 6000, t0 = 0, kind = 'sfx') { if (!canPlay(kind)) return; const t = actx.currentTime + t0, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + d); }
  const SFX = {
    coin() { const f = pick([1318, 1480, 1568]); tone(f, .07, 'square', .03); tone(f * 1.5, .12, 'square', .025, 0, .05); },
    jump() { tone(300, .2, 'triangle', .08, 500); }, slide() { hiss(.25, .05, 1500); }, lane() { tone(700, .05, 'triangle', .035); },
    power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .06, 0, i * .06)); },
    shield() { tone(220, .35, 'sawtooth', .07, -120); hiss(.3, .06, 2500); },
    crash() { tone(140, .6, 'sawtooth', .12, -100); hiss(.5, .12, 800); },
    go() { tone(880, .25, 'square', .05); }, beep() { tone(440, .15, 'square', .05); },
    whoosh() { hiss(.6, .08, 900); tone(200, .6, 'sine', .06, 600); },
  };
  const CH = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]; const mtof = m => 440 * Math.pow(2, (m - 69) / 12); let mStep = 0, mNext = 0;
  const ARP = [0, 3, 6, 8, 10, 13], ARPN = [0, 1, 2, 3, 2, 1];
  function music() {
    if (!canPlay('music') || !(state === 'play' || state === 'count')) { if (actx) mNext = actx.currentTime; return; }
    const spb = .13;
    if (mNext < actx.currentTime) mNext = actx.currentTime;
    while (mNext < actx.currentTime + .2) {
      const t0 = mNext - actx.currentTime; const ch = CH[Math.floor(mStep / 16) % 4], s = mStep % 16;
      if (s % 4 === 0) { const t = actx.currentTime + t0, o = actx.createOscillator(), g = actx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .16); g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.connect(g).connect(master); o.start(t); o.stop(t + .22); }
      if (s % 4 === 2) hiss(.04, .035, 8000, t0, 'music');
      if (s % 8 === 0) tone(mtof(ch[0] - 12), spb * 3.5, 'triangle', .07, 0, t0, 'music');
      const ai = ARP.indexOf(s); if (ai >= 0) tone(mtof(ch[ARPN[ai]] + 12), .12, 'square', .018, 0, t0, 'music');
      mStep++; mNext += spb;
    }
  }
  setInterval(music, 60);

  // ================= STATE =================
  let D = 0, T = 0, state = 'menu', S = null, objs = [], countT = 0, lastCount = 0, timeScale = 1, durations = { magnet: 9, shield: 12, dbl: 10 }, mult = 1;
  const HS_SPEED = 2.6;
  function newRun(o = {}) {
    for (const ob of objs) release(ob); objs = [];
    S = { start: D, speed: 15, score: 0, coins: 0, t: 0, lane: 0, px: 0, py: 0, vy: 0, slide: 0,
      nextRow: D + 70, lastObst: [-999, -999, -999], magnet: 0, shield: 0, dbl: 0, invuln: 0, crashT: 0, shake: 0, hit: 0, dust: 0,
      milestone: 500, reason: '', jumps: 0, slides: 0, powerups: 0, carts: 0, revives: 0, boostEnd: 0, boostPending: !!o.headStart,
      tut: o.tutorial ? { rows: [], shown: -1 } : null, started: false };
    if (S.tut) {
      const b = D + 75;
      S.tut.rows = [{ wz: b, need: 'jump' }, { wz: b + 38, need: 'slide' }, { wz: b + 76, need: 'lane' }];
      S.nextRow = b + 120;
    }
  }
  newRun();

  function placeObstacle(type, ln, wz, moving) {
    const o = { type, lane: ln, x: ln * L, wz, vz: 0, len: type === 'cart' ? 3.2 : .5, y: 0 };
    if (moving) { o.vz = moving; o.moving = true; }
    o.pool = type === 'cart' ? (o.moving ? 'mcart' : 'cart') : type; o.mesh = take(o.pool); objs.push(o); S.lastObst[ln + 1] = wz + o.len; return o;
  }
  function addAcorn(ln, wz, y) { const o = { type: 'acorn', lane: ln, x: ln * L, wz, y, len: 0, pool: 'acorn' }; o.mesh = take('acorn'); objs.push(o); }
  function spawnRow(wz) {
    const lanes = [-1, 0, 1], free = pick(lanes), diff = Math.min(1, (wz - S.start) / 3000);
    const nObs = Math.random() < .4 - diff * .25 ? 1 : 2;
    const others = lanes.filter(l => l !== free).sort(() => Math.random() - .5).slice(0, nObs);
    for (const ln of others) {
      const type = pick(['log', 'beam', 'cart', 'cart', 'log', 'beam']);
      const moving = type === 'cart' && Math.random() < .22 + diff * .33 && wz - S.lastObst[ln + 1] > 50 ? 7 + diff * 6 : 0;
      placeObstacle(type, ln, wz, moving);
      if (type === 'log' && Math.random() < .65) for (let i = 0; i < 5; i++) { const u = (i - 2) / 2; addAcorn(ln, wz - 3 + i * 1.5 + .25, .65 + 1.15 * (1 - u * u)); }
    }
    if (Math.random() < .78) { const n = 5 + Math.floor(Math.random() * 6); for (let i = 0; i < n; i++) addAcorn(free, wz - n * 1.4 + i * 1.4 + 2, .65); }
    else if (Math.random() < .55) {
      const kind = pick(['magnet', 'shield', 'dbl']); const o = { type: 'power', kind, lane: free, x: free * L, wz, y: 1.0, len: 0, pool: 'power' }; o.mesh = take('power');
      const u = o.mesh.userData, c = new THREE.Color(PCOL[kind]); u.core.material.color.copy(c).multiplyScalar(2.2); u.ring.material.color.copy(c).multiplyScalar(3); u.halo.material.color.copy(c); u.icon.material.map = ICON[kind]; objs.push(o);
    }
  }
  function spawnSkyRow(wz) { const ln = pick([-1, 0, 1]); for (let i = 0; i < 8; i++) addAcorn(ln, wz + i * 1.6, 2.6); }
  function spawnTutorial() {
    for (const r of S.tut.rows) {
      if (r.spawned) continue; r.spawned = true;
      if (r.need === 'jump') for (const ln of [-1, 0, 1]) placeObstacle('log', ln, r.wz);
      if (r.need === 'slide') for (const ln of [-1, 0, 1]) placeObstacle('beam', ln, r.wz);
      if (r.need === 'lane') { r.free = S.lane === 1 ? 0 : S.lane + 1; for (const ln of [-1, 0, 1]) if (ln !== r.free) placeObstacle('cart', ln, r.wz); for (let i = 0; i < 6; i++) addAcorn(r.free, r.wz - 6 + i * 1.4, .65); }
    }
  }

  // ================= INPUT =================
  function act(a) {
    if (!(state === 'play' || state === 'count') || S.crashT || S.boostEnd > D) return;
    if (a === 'L' && S.lane > -1) { S.lane--; SFX.lane(); }
    if (a === 'R' && S.lane < 1) { S.lane++; SFX.lane(); }
    if (a === 'U' && S.py <= .001) { S.vy = 10.2; S.slide = 0; S.jumps++; SFX.jump(); emit('jump'); for (let i = 0; i < 8; i++) emitP(S.px + rnd(-.3, .3), .2, D + rnd(-.2, .2), rnd(-1.5, 1.5), rnd(.5, 1.5), rnd(-1, 1), .5, .3, [.35, .3, .28], 2, 3); }
    if (a === 'D') { if (S.py > .001) S.vy = -18; if (S.slide <= 0) { S.slides++; emit('slide'); } S.slide = .7; SFX.slide(); }
  }

  // ================= UPDATE =================
  const REASON = { log: 'Tripped over a log', beam: 'Clonked by a warning beam', cart: 'Ran into a parked mine cart', mcart: 'Flattened by a runaway cart' };
  function hitObstacle(o) {
    if (S.invuln > 0) return false;
    if (S.shield > 0) { S.shield = 0; S.invuln = .8; S.shake = .35; S.hit = .4; SFX.shield(); burst(S.px, 1, D, [.8, 3, .8], 40, 5); o.dead = true; release(o); emit('shieldBreak'); return false; }
    S.crashT = .0001; S.shake = .7; S.hit = 1; S.reason = REASON[o.pool]; SFX.crash();
    burst(S.px, .9, D, [3, 1.8, .6], 50, 6); for (let i = 0; i < 30; i++) emitP(S.px + rnd(-.5, .5), rnd(.2, 1.2), D + rnd(-.5, .5), rnd(-3, 3), rnd(1, 5), rnd(-2, 2), rnd(.6, 1.2), rnd(.2, .4), [.5, .42, .36], 9, 1);
    state = 'dying'; emit('crash', { reason: S.reason }); return true;
  }
  function stepPlay(dt) {
    S.t += dt;
    const boosting = S.boostEnd > D;
    S.speed = S.tut ? 14 : Math.min(38, 15 + S.t * .3);
    const v = boosting ? Math.max(S.speed, 18) * HS_SPEED : S.speed;
    const dd = v * dt; D += dd;
    S.score += dd * (S.dbl > 0 ? 2 : 1) * .6 * mult;
    for (const k of ['magnet', 'shield', 'dbl', 'invuln']) S[k] = Math.max(0, S[k] - dt);
    if (S.boostEnd && !boosting && S.boostEnd > 0) { S.boostEnd = 0; S.invuln = 2.5; S.vy = 2; emit('boostEnd'); }
    const dist = D - S.start; if (dist >= S.milestone) { emit('milestone', S.milestone); S.milestone += 500; SFX.power(); }
    if (S.tut) spawnTutorial();
    while (S.nextRow < D + 135) {
      if (S.boostEnd && S.nextRow < S.boostEnd) { spawnSkyRow(S.nextRow); S.nextRow += 18; }
      else { if (S.boostEnd && S.nextRow < S.boostEnd + 40) S.nextRow = S.boostEnd + 40; spawnRow(S.nextRow); S.nextRow += rnd(15, 22) + S.speed * .28; }
    }
    stepPlayer(dt);
    if (S.tut) stepTutorial();
    for (const o of objs) {
      if (o.dead) continue; o.wz -= o.vz * dt; const rz = o.wz - D;
      if (o.type === 'acorn' || o.type === 'power') {
        if ((S.magnet > 0 || boosting) && o.type === 'acorn' && rz < 18 && rz > -1) { const k = Math.min(1, dt * 9); o.x += (S.px - o.x) * k; o.y += ((S.py + .7) - o.y) * k; o.wz -= rz * Math.min(1, dt * 7); }
        if (Math.abs(o.wz - D) < .9 && Math.abs(o.x - S.px) < .85 && Math.abs(o.y - (S.py + .7)) < 1.15) {
          o.dead = true;
          if (o.type === 'acorn') { S.coins++; S.score += 10 * mult * (S.dbl > 0 ? 2 : 1); SFX.coin(); burst(o.x, o.y, o.wz, [3, 2, .5], 10, 2.5); emit('coin'); }
          else { S[o.kind] = durations[o.kind]; S.powerups++; SFX.power(); const c = new THREE.Color(PCOL[o.kind]); burst(o.x, o.y, o.wz, [c.r * 3, c.g * 3, c.b * 3], 36, 5); emit('power', o.kind); }
          release(o);
        }
        continue;
      }
      if (o.moving && !o.counted && rz + o.len < -.5) { o.counted = true; S.carts++; emit('cartDodged'); }
      if (boosting) continue;
      if (rz < .35 && rz + o.len > -.35 && Math.abs(o.x - S.px) < .9) {
        const bad = o.type === 'log' ? S.py < .72 : o.type === 'beam' ? !(S.slide > 0 && S.py < .45) : true;
        if (bad && hitObstacle(o)) return;
      }
    }
  }
  function stepTutorial() {
    const rows = S.tut.rows; let slow = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const rz = r.wz - D;
      if (r.passed) continue;
      if (rz < -1) { r.passed = true; if (i === rows.length - 1) { S.tut = null; timeScale = 1; emit('tutorial', null); emit('tutorialDone'); return; } continue; }
      const ok = r.need === 'jump' ? S.py > .55 : r.need === 'slide' ? S.slide > 0 : Math.abs(S.px - r.free * L) < .35;
      if (rz < 7.5 && rz > 0 && !ok && !r.ok) {
        slow = true;
        if (S.tut.shown !== i) { S.tut.shown = i; emit('tutorial', { need: r.need, dir: r.need === 'lane' ? (r.free > S.lane ? 'right' : 'left') : null }); }
      }
      if (ok && !r.ok && rz < 7.5) { r.ok = true; emit('tutorial', null); }
      break;
    }
    timeScale = slow ? .08 : 1;
  }
  function stepPlayer(dt) {
    const tx = S.lane * L; S.px += (tx - S.px) * Math.min(1, dt * 15);
    const boosting = S.boostEnd > D;
    if (boosting) { S.py += (2.0 - S.py) * Math.min(1, dt * 3); S.vy = 0; if (Math.random() < dt * 40) emitP(S.px + rnd(-.3, .3), S.py + .2, D + .3, rnd(-.5, .5), rnd(-1, 0), rnd(-2, -4), .6, rnd(.12, .25), pick([[3, 2, .6], [2.5, 1.2, .3], [3, 3, 1.5]]), -1, 1); return; }
    const wasAir = S.py > 0; S.vy -= 30 * dt; S.py += S.vy * dt;
    if (S.py <= 0) { S.py = 0; if (wasAir && S.vy < -6) for (let i = 0; i < 10; i++) emitP(S.px + rnd(-.3, .3), .2, D, rnd(-2, 2), rnd(.3, 1), rnd(-1, 1), .45, .3, [.35, .3, .28], 2, 3); S.vy = 0; }
    S.slide = Math.max(0, S.slide - dt);
    S.dust -= dt; if (S.py === 0 && S.dust <= 0) { S.dust = .04; emitP(S.px + rnd(-.2, .2), .18, D + .1, rnd(-.4, .4), rnd(.2, .8), rnd(-.5, .5), .5, S.slide ? .45 : .25, [.28, .25, .24], 1, 2); }
    if (Math.random() < dt * 6) emitP(S.px + .3, 1.0 + S.py, D, rnd(-.3, .3), rnd(.5, 1.2), rnd(-.2, .3), rnd(.5, .9), rnd(.05, .09), [3, 1.6, .4], -.5, 1);
  }

  // ================= VISUAL SYNC =================
  const camLook = new THREE.Vector3(0, 1, 0), camAng = { a: 0, r: 4.6, h: 2.0 }, lookTarget = new THREE.Vector3();
  let runPhase = 0;
  function syncWorld(dt) {
    updScatter();
    sleeperGroup.position.z = D % SLP;
    texGravel.offset.y = D / 600 * 90; texGrass.offset.y = D / 600 * 90;
    for (const l of lamps) { if (l.userData.wz - D < -12) l.userData.wz += 170; l.position.z = -(l.userData.wz - D); }
    const near = lamps.filter(l => { const z = l.userData.wz - D; return z > -2 && z < 60; }).sort((a, b) => a.userData.wz - b.userData.wz);
    lampLights.forEach((li, i) => { const l = near[i]; if (l) { li.position.set(l.position.x - l.userData.side * .62, 2.6, l.position.z); li.intensity = 2.2; } else li.intensity = 0; });
    blinkMat.color.setRGB(Math.sin(T * 8) > 0 ? 4 : .3, .3, .2);
    const movers = [];
    for (const o of objs) {
      if (!o.mesh) continue; const m = o.mesh, z = -(o.wz - D);
      if (o.type === 'cart') { m.position.set(o.x, BASE, z - o.len / 2); if (o.moving) { movers.push(o); for (const w of m.userData.wheels) w.rotation.x += dt * (o.vz + S.speed) * 2.5; } }
      else if (o.type === 'acorn') { m.position.set(o.x, o.y + Math.sin(T * 4 + o.wz) * .06, z); m.userData.inner.rotation.y = T * 3 + o.wz; }
      else if (o.type === 'power') { const u = m.userData; m.position.set(o.x, o.y + Math.sin(T * 3) * .15, z); u.ring.rotation.set(T * 2, T * 1.3, 0); u.ring2.rotation.set(Math.PI / 2 + T * 1.1, 0, T * 1.7); u.icon.position.z = .42; u.halo.scale.setScalar(2.2 * (1 + Math.sin(T * 6) * .08)); }
      else m.position.set(o.x, BASE, z);
    }
    movers.sort((a, b) => a.wz - b.wz);
    cartLights.forEach((li, i) => { const o = movers[i]; if (o && o.wz - D < 70 && o.wz - D > -3) { li.position.set(o.x, 1.3, -(o.wz - D) + 1.2); li.intensity = 3; } else li.intensity = 0; });
    for (let i = objs.length - 1; i >= 0; i--) { const o = objs[i]; if (o.dead || o.wz - D + o.len < -8) { release(o); objs.splice(i, 1); } }

    const boosting = S.boostEnd > D;
    const air = S.py > .01, sl = S.slide > 0 && S.py < .45, running = state === 'play' || state === 'count' || state === 'menu';
    const spd = state === 'menu' ? 9 : S.speed;
    if (running) runPhase += dt * spd * .62;
    pip.position.set(S.px, BASE + S.py, 0);
    const tx = S.lane * L;
    if (state === 'dying' || state === 'downed' || state === 'over') { const k = Math.min(1, S.crashT * 3); body.rotation.x = -1.35 * k; body.position.y = .05 * k; pip.rotation.z = .4 * k * (S.lane >= 0 ? -1 : 1); }
    else {
      body.rotation.x += ((boosting ? -.5 : sl ? .85 : air ? -.15 : -.08) - body.rotation.x) * Math.min(1, dt * 14);
      body.position.y += ((sl ? -.25 : 0) - body.position.y) * Math.min(1, dt * 14);
      pip.rotation.z = -(tx - S.px) * .22;
      body.position.y += (air || sl ? 0 : Math.abs(Math.sin(runPhase)) * .07) * .4;
    }
    const sw = air || sl ? 0 : Math.sin(runPhase);
    legs[0].rotation.x = boosting ? .3 : air ? -.9 : sl ? -1.3 : sw * .95; legs[1].rotation.x = boosting ? .5 : air ? .4 : sl ? -1.3 : -sw * .95;
    arms[0].rotation.x = boosting ? -2.9 : air ? -2.4 : -sw * .8; arms[1].rotation.x = boosting ? -2.9 : air ? -2.0 : sw * .6 - .25; arms[0].rotation.z = -.15; arms[1].rotation.z = .15 + (air ? .3 : 0);
    head.rotation.y = state === 'menu' ? Math.sin(T * .7) * .35 : 0;
    cap.rotation.z = Math.sin(runPhase * 2) * .04;
    tail.rotation.x = .4 + Math.sin(T * 18) * .25 * (spd / 20);
    lanternLight.intensity = (boosting ? 4 : 2.2) + Math.sin(T * 23) * .15 + Math.sin(T * 7) * .2;
    pip.visible = !(S.invuln > 0 && !boosting && Math.sin(T * 30) < -.2 && state === 'play');
    shieldMesh.visible = shieldGlow.visible = S.shield > 0 || boosting;
    if (shieldMesh.visible) { shieldMesh.rotation.y = T * 1.2; shieldMesh.rotation.x = T * .7; const f = S.shield > 0 && S.shield < 2 ? (Math.sin(T * 20) > 0 ? 1 : .2) : 1; shieldMesh.material.opacity = .35 * f; shieldGlow.material.opacity = .12 * f; }
    magRing.visible = S.magnet > 0; if (magRing.visible) { magRing.scale.setScalar(1 + .15 * Math.sin(T * 8)); magRing.rotation.y = T * 3; }
    moon.position.set(S.px - 9, 18, 8); moon.target.position.set(S.px, 0, -6);
  }
  function syncCamera(dt) {
    const front = state === 'menu', port = camera.aspect < .8;
    const boosting = S.boostEnd > D;
    const tA = front ? Math.sin(T * .22) * .55 : Math.PI;
    const tR = front ? (port ? 6.4 : 4.4) : (port ? 6.2 : 5.3) + (boosting ? 1.2 : 0);
    const tH = front ? (port ? 2.3 : 1.55) : (port ? 3.5 : 3.05) + S.py * .35;
    const k = 1 - Math.exp(-dt * (front ? 1.6 : 2.6));
    camAng.a += (tA - camAng.a) * k; camAng.r += (tR - camAng.r) * k; camAng.h += (tH - camAng.h) * k;
    const cx = front ? S.px : S.px * .7;
    camera.position.set(cx + Math.sin(camAng.a) * camAng.r, camAng.h, -Math.cos(camAng.a) * camAng.r);
    if (front) lookTarget.set(S.px + .6, 1.0, 0); else lookTarget.set(S.px * .55, 1.15 + S.py * .3, -7);
    camLook.lerp(lookTarget, k);
    if (S.shake > 0 && !REDUCED) { camera.position.x += (Math.random() - .5) * S.shake * .5; camera.position.y += (Math.random() - .5) * S.shake * .5; }
    camera.lookAt(camLook);
    const fov = (front ? 44 : 58 + (S.speed - 15) * .55 + (boosting ? 14 : 0)) + (port ? 8 : 0);
    if (Math.abs(camera.fov - fov) > .01) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);
    for (const r of ridges) r.position.x = camera.position.x * .9;
    const sc = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    sparks.material.uniforms.uScale.value = flies.material.uniforms.uScale.value = sc;
  }

  // ================= LOOP =================
  let last = performance.now(), fpsAcc = 0, fpsN = 0;
  function frame(now) {
    let dt = Math.min(.05, (now - last) / 1000); last = now;
    if (state === 'play') { fpsAcc += dt; fpsN++; if (fpsAcc > 4) { emit('fps', fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; } }
    if (state !== 'paused') {
      const sdt = dt * timeScale;
      T += dt;
      if (state === 'menu') { D += 9 * dt; S.start = D; S.nextRow = D + 70; if (S.tut) { const b = D + 75; S.tut.rows.forEach((r, i) => { r.wz = b + i * 38; }); S.nextRow = b + 120; } }
      else if (state === 'count') {
        countT -= dt; D += (S.started ? S.speed * .5 : S.speed) * dt; stepPlayer(dt);
        if (!S.started) { S.start = D; S.nextRow = Math.max(S.nextRow, D + 70); if (S.tut) { const b = D + 75; S.tut.rows.forEach((r, i) => { r.wz = b + i * 38; }); S.nextRow = b + 120; } }
        const n = Math.ceil(countT - .2);
        if (n !== lastCount) { lastCount = n; emit('count', n); n > 0 ? SFX.beep() : SFX.go(); }
        if (countT <= 0) {
          state = 'play';
          if (!S.started) { S.started = true; emit('start'); if (S.boostPending) { S.boostPending = false; S.boostEnd = D + 520; SFX.whoosh(); emit('boost'); } }
        }
      }
      else if (state === 'play') stepPlay(sdt);
      else if (state === 'dying') { S.crashT += dt; if (S.crashT > 1.1) { state = 'downed'; emit('downed', stats()); } dt *= .35; }
      else if (state === 'downed' || state === 'over') S.crashT += dt;
      S.shake = Math.max(0, S.shake - dt * 1.2); S.hit = Math.max(0, S.hit - dt * 1.6);
      updSparks(state === 'play' ? sdt : dt); updFlies(T); syncWorld(state === 'play' ? sdt : dt); syncCamera(dt);
      skyMat.uniforms.uTime.value = T;
      finalPass.uniforms.uTime.value = T; finalPass.uniforms.uHit.value = S.hit;
      finalPass.uniforms.uSpeed.value = state === 'play' ? (S.boostEnd > D ? 1 : clamp((S.speed - 15) / 23, 0, 1)) : 0;
      finalPass.uniforms.uSat.value = state === 'over' || state === 'downed' ? .55 : 1;
      if (opts.onFrame && S.started) opts.onFrame(stats());
    }
    composer.render();
    requestAnimationFrame(frame);
  }

  function stats() {
    return { score: Math.floor(S.score), dist: Math.floor(Math.max(0, D - S.start)), coins: S.coins, jumps: S.jumps, slides: S.slides, powerups: S.powerups, carts: S.carts,
      magnet: S.magnet, shield: S.shield, dbl: S.dbl, mult, reason: S.reason, revives: S.revives, boosting: S.boostEnd > D, boostLeft: Math.max(0, S.boostEnd - D), tutorial: !!S.tut };
  }

  applyQuality();
  requestAnimationFrame(frame);

  return {
    get state() { return state; },
    stats,
    act,
    unlockAudio,
    setAudio(a) { Object.assign(audio, a); },
    setSkin,
    setDurations(d) { durations = d; },
    setMultiplier(m) { mult = m; },
    setQuality(q) { quality = q === 'low' ? 'low' : 'high'; applyQuality(); },
    get quality() { return quality; },
    startRun({ headStart = false, tutorial = false } = {}) { newRun({ headStart, tutorial }); timeScale = 1; state = 'count'; countT = 3.2; lastCount = 0; },
    revive() {
      if (state !== 'downed') return;
      for (const o of objs) if (o.type !== 'acorn' && o.wz - D < 60) { o.dead = true; }
      S.crashT = 0; S.revives++; S.invuln = 3; S.t = Math.max(0, S.t - 6); S.nextRow = Math.max(S.nextRow, D + 60);
      body.rotation.x = 0; body.position.y = 0; pip.rotation.z = 0; S.slide = 0; S.py = 0; S.vy = 0;
      burst(S.px, 1, D, [2, 3, 1], 40, 4); SFX.power();
      state = 'count'; countT = 2.2; lastCount = 0;
    },
    endRun() { if (state === 'downed' || state === 'dying') { state = 'over'; emit('end', stats()); } },
    toMenu() { newRun(); timeScale = 1; state = 'menu'; },
    pause() { if (state === 'play' || state === 'count') { S.prev = state; state = 'paused'; return true; } return false; },
    resume() { if (state === 'paused') { state = S.prev; last = performance.now(); } },
  };
}
