/* SALA DI ATTESA NATALIZIA (VR) — ISISS Matese
   Stanza costruita con la grafica di three.js (nessun file extra tranne logo.png, garland.svg e il presepe models/nativita.glb).
   Cose da personalizzare: blocco TXT (testi), COL (colori), e le misure RW / RD / RH della stanza. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const $ = s => document.querySelector(s);
let LANG = "it";
try { LANG = localStorage.getItem("nat-lang") || ((navigator.language || "it").toLowerCase().startsWith("it") ? "it" : "en"); } catch (_) {}

const TXT = {
  it: {
    title: "La sala di attesa dell’ISISS Matese",
    intro: "Una stanza di Natale tutta da esplorare prima della visita: l’albero, il camino, il presepe sul tavolo e il logo della scuola. Nel visore cammini con la levetta sinistra e giri con la destra; sul computer usi la tastiera e il mouse.",
    hint: "Punta e premi il grilletto su albero, presepe, camino e logo: succede qualcosa.",
    btnLoad: "Carico la sala…", btnVR: "Entra nella sala (VR)", btnPc: "Anteprima da computer", btnPreview: "Avvia l’anteprima",
    back: "← Torna alla Natività", ended: "Sei uscito dalla sala. Puoi rientrare quando vuoi.",
    hud: "<b>W A S D</b> cammini · <b>trascina</b> il mouse per guardare · <b>clic</b> su albero, presepe, camino, logo",
    bannerA: "Benvenuti alla Natività", bannerB: "dell’ISISS Matese · la visita inizia tra poco",
    noVR: "Il visore non è stato trovato: puoi provare la sala dall’anteprima da computer.", fail: "Non riesco ad avviare la sessione VR: "
  },
  en: {
    title: "The ISISS Matese waiting room",
    intro: "A Christmas room to explore before the visit: the tree, the fireplace, the little nativity on the table and the school logo. In the headset walk with the left stick and turn with the right one; on a computer use keyboard and mouse.",
    hint: "Point and pull the trigger on the tree, the nativity, the fireplace and the logo: something happens.",
    btnLoad: "Loading the room…", btnVR: "Enter the room (VR)", btnPc: "Preview on computer", btnPreview: "Start the preview",
    back: "← Back to the Nativity", ended: "You left the room. Come back any time.",
    hud: "<b>W A S D</b> walk · <b>drag</b> the mouse to look · <b>click</b> the tree, nativity, fireplace, logo",
    bannerA: "Welcome to the Nativity", bannerB: "of ISISS Matese · the visit begins shortly",
    noVR: "No headset found: you can try the room with the computer preview.", fail: "Could not start the VR session: "
  }
};
const tr = k => TXT[LANG][k];

/* ---------- misure e colori ---------- */
const RW = 7, RD = 8, RH = 3.2;           // larghezza (x), profondità (z), altezza della stanza in metri
const EYE = 1.6;                          // altezza degli occhi nell’anteprima da computer
const TABLE = { x: .3, z: -0.8, w: 1.7, d: 1.0, h: 0.76 };
const TREE = { x: -2.6, z: -3.0 };
const NAT = { x: TREE.x + .25, z: TREE.z + 1.3, rise: .17 };   // il presepe sta ai piedi dell’albero, su un rialzo
const NAT_SCALE = 0.105;                   // quanto è piccolo il presepe sul tavolo (1 = grandezza reale)
const COL = { red: 0xd62839, gold: 0xf2c14e, green: 0x1f8a4c, cream: 0xfff8ec };

/* ---------- utilità ---------- */
const rnd = (() => { let s = 20261102; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...o });
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); (parent || scene).add(m); return m; }
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); (parent || scene).add(m); return m; }
function tex(w, h, fn, rep) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const glowTex = tex(64, 64, (g, w, h) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h); });
function wallPlane(w, h, mat, tile = 1.4) {    // piano con le coordinate della trama in scala, così il disegno ha la stessa misura ovunque
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  return new THREE.Mesh(g, mat);
}

/* ---------- renderer, scena, luci ---------- */
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0f14);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .02, 40);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);     // il "carrellino": muovendolo ti muovi nella stanza
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType("local-floor"); renderer.xr.setFoveation(1); renderer.xr.setFramebufferScaleFactor(1);
document.body.appendChild(renderer.domElement);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .28;

scene.add(new THREE.HemisphereLight(0xffe6c8, 0x3a2418, 1.15));
const moon = new THREE.DirectionalLight(0x7f9bff, .55); moon.position.set(-6, 4, 1); scene.add(moon);
const treeLight = new THREE.PointLight(0xffc27a, 9, 7, 1.6); treeLight.position.set(TREE.x + .3, 1.5, TREE.z + .7); scene.add(treeLight);
const fireLight = new THREE.PointLight(0xff7a2a, 9, 8, 1.5); fireLight.position.set(2.95, .7, -1.3); scene.add(fireLight);
const natSpot = new THREE.SpotLight(0xffe2b0, 32, 6, .62, .7, 1.6); natSpot.position.set(NAT.x + .5, 2.6, NAT.z + 1.4); natSpot.target.position.set(NAT.x, NAT.rise, NAT.z); scene.add(natSpot, natSpot.target);

/* ---------- pavimento, pareti, soffitto ---------- */
const floorTex = tex(512, 512, (g, w, h) => {
  const n = 8, ph = h / n;
  for (let i = 0; i < n; i++) {
    const L = 52 + rnd() * 10; g.fillStyle = `hsl(26,48%,${L}%)`; g.fillRect(0, i * ph, w, ph);
    const cut = rnd() * w * .8 + w * .1; g.fillStyle = `hsl(26,46%,${L - 5}%)`; g.fillRect(cut, i * ph, w - cut, ph);
    g.strokeStyle = "rgba(60,30,12,.35)"; g.lineWidth = 2; g.strokeRect(0, i * ph, w, ph); g.beginPath(); g.moveTo(cut, i * ph); g.lineTo(cut, (i + 1) * ph); g.stroke();
    g.strokeStyle = "rgba(70,36,14,.18)"; g.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const y = i * ph + 4 + rnd() * (ph - 8); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd() * 4 - 2, w * .6, y + rnd() * 4 - 2, w, y); g.stroke(); }
  }
}, [RW / 2, RD / 2]);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), M(0xffffff, { map: floorTex, roughness: .55 })); scene.add(floor);

const paperTex = tex(256, 256, (g, w, h) => {
  g.fillStyle = "#15402d"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(242,193,78,.2)"; g.lineWidth = 2;
  for (let i = -4; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i * 64 + 256, 0); g.lineTo(i * 64, 256); g.stroke(); }
  g.fillStyle = "rgba(242,193,78,.5)"; for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.beginPath(); g.arc(x * 64 + 32 + (y % 2 ? 0 : 0), y * 64 + 32, 3, 0, 7); g.fill(); }
}, [1, 1]);
paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
const wallMat = M(0xffffff, { map: paperTex, roughness: .95 });
const woodPanelTex = tex(256, 256, (g, w, h) => {
  g.fillStyle = "#4e2a1f"; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(14, 14, w - 28, h - 28); g.fillStyle = "#5e3326"; g.fillRect(22, 22, w - 44, h - 44);
  g.strokeStyle = "rgba(242,193,78,.4)"; g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
}); woodPanelTex.wrapS = woodPanelTex.wrapT = THREE.RepeatWrapping;
const panelMat = M(0xffffff, { map: woodPanelTex, roughness: .7 });
const WP_H = 1.0;

function wallSet(len, tx, ty, tz, rotY, hole) {  // una parete (con eventuale finestra) + boiserie in legno
  const g = new THREE.Group(); g.position.set(tx, ty, tz); g.rotation.y = rotY; scene.add(g);
  const piece = (w, h, cx, cy, mat, z = 0) => { const m = wallPlane(w, h, mat, mat === panelMat ? 1 : 1.4); m.position.set(cx, cy, z); g.add(m); };
  if (!hole) piece(len, RH, 0, RH / 2, wallMat);
  else {   // hole: {a,b (da sinistra a destra, in m), y0,y1}
    const L = -len / 2, R = len / 2;
    piece(len, hole.y0, 0, hole.y0 / 2, wallMat); piece(len, RH - hole.y1, 0, (RH + hole.y1) / 2, wallMat);
    piece(hole.a - L, hole.y1 - hole.y0, (L + hole.a) / 2, (hole.y0 + hole.y1) / 2, wallMat);
    piece(R - hole.b, hole.y1 - hole.y0, (hole.b + R) / 2, (hole.y0 + hole.y1) / 2, wallMat);
  }
  if (!hole) piece(len, WP_H, 0, WP_H / 2, panelMat, .012);
  else { piece(hole.a + len / 2, WP_H, (-len / 2 + hole.a) / 2, WP_H / 2, panelMat, .012); piece(len / 2 - hole.b, WP_H, (hole.b + len / 2) / 2, WP_H / 2, panelMat, .012); piece(hole.b - hole.a, hole.y0, (hole.a + hole.b) / 2, hole.y0 / 2, panelMat, .012); }
  box(len, .05, .05, M(COL.gold, { metalness: .5, roughness: .4 }), 0, WP_H, .03, g);       // cornice dorata sopra la boiserie
  box(len, .12, .03, M(0x3a1d14), 0, .06, .02, g);                                        // battiscopa
  return g;
}
wallSet(RW, 0, 0, -RD / 2, 0);                         // fondo
wallSet(RW, 0, 0, RD / 2, Math.PI);                    // dietro di te
wallSet(RD, RW / 2, 0, 0, -Math.PI / 2);               // destra (camino)
const WIN = { z0: .2, z1: 1.8, y0: 1.05, y1: 2.35 };   // la finestra sulla parete sinistra
wallSet(RD, -RW / 2, 0, 0, Math.PI / 2, { a: -(WIN.z1 - 0) + 0, b: -(WIN.z0), y0: WIN.y0, y1: WIN.y1 });
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD).rotateX(Math.PI / 2), M(0x2a1912, { roughness: .9 })); ceil.position.y = RH; scene.add(ceil);
for (let i = -2; i <= 2; i++) box(RW, .18, .2, M(0x3b2216), 0, RH - .09, i * 1.6, scene);   // travi del soffitto

/* ---------- finestra con notte nevosa ---------- */
{
  const frameM = M(0xf0e6d2, { roughness: .6 }), x = -RW / 2 + .03, zc = (WIN.z0 + WIN.z1) / 2, wz = WIN.z1 - WIN.z0, wy = WIN.y1 - WIN.y0, yc = (WIN.y0 + WIN.y1) / 2;
  box(.1, .07, wz + .16, frameM, x, WIN.y1 + .03, zc); box(.1, .07, wz + .16, frameM, x, WIN.y0 - .03, zc);
  box(.1, wy, .07, frameM, x, yc, WIN.z0 - .03); box(.1, wy, .07, frameM, x, yc, WIN.z1 + .03);
  box(.05, wy, .04, frameM, x, yc, zc); box(.05, .04, wz, frameM, x, yc, zc);
  box(.22, .05, wz + .3, frameM, x + .08, WIN.y0 - .08, zc);
  const night = tex(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#050a1c"); sky.addColorStop(.7, "#16264d"); sky.addColorStop(1, "#27407a"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,240,${.3 + rnd() * .7})`; g.fillRect(rnd() * w, rnd() * h * .6, 1.6, 1.6); }
    const mg = g.createRadialGradient(780, 90, 4, 780, 90, 90); mg.addColorStop(0, "#fffbe8"); mg.addColorStop(.2, "#fff2c0"); mg.addColorStop(1, "rgba(255,240,180,0)"); g.fillStyle = mg; g.fillRect(660, 0, 240, 200);
    g.fillStyle = "#cfd9f0"; g.beginPath(); g.moveTo(0, 400); for (let x = 0; x <= w; x += 64) g.lineTo(x, 380 + Math.sin(x * .011) * 26 + Math.cos(x * .031) * 12); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    for (let i = 0; i < 14; i++) { const x = rnd() * w, y = 400 + rnd() * 50, s = 30 + rnd() * 40; g.fillStyle = "#0f2a2a"; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x - s * .32, y); g.lineTo(x + s * .32, y); g.fill(); }
    for (let i = 0; i < 5; i++) { const x = 80 + i * 190 + rnd() * 60, y = 430 + rnd() * 30; g.fillStyle = "#2b2a3a"; g.fillRect(x, y, 46, 30); g.fillStyle = "#d9d9f2"; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 23, y - 20); g.lineTo(x + 50, y); g.fill(); g.fillStyle = "#ffcf6a"; g.fillRect(x + 8, y + 9, 10, 10); g.fillRect(x + 28, y + 9, 10, 10); }
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), new THREE.MeshBasicMaterial({ map: night, toneMapped: false })); back.position.set(-10, 3.6, zc); back.rotation.y = Math.PI / 2; scene.add(back);
}
const NSN = 520, snowPos = new Float32Array(NSN * 3), snowSpd = new Float32Array(NSN);
for (let i = 0; i < NSN; i++) { snowPos[i * 3] = -4 - rnd() * 5; snowPos[i * 3 + 1] = rnd() * 5; snowPos[i * 3 + 2] = -5 + rnd() * 12; snowSpd[i] = .35 + rnd() * .55; }
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: .05, map: glowTex, transparent: true, depthWrite: false, color: 0xffffff, toneMapped: false })); snowPts.frustumCulled = false; scene.add(snowPts);

/* ---------- ghirlande alle pareti (stesso disegno della card) ---------- */
const garlandTex = new THREE.TextureLoader().load("garland.svg", t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; });
function garland(len, x, y, z, rotY, h = .55) {
  const t = garlandTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.x = len / (h * 320 / 104); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: 0xcfcfcf, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
}
garland(RW, 0, RH - .27, -RD / 2 + .02, 0); garland(RW, 0, RH - .27, RD / 2 - .02, Math.PI);
garland(RD, RW / 2 - .02, RH - .27, 0, -Math.PI / 2); garland(RD, -RW / 2 + .02, RH - .27, 0, Math.PI / 2);
garland(2.4, RW / 2 - .03, 1.72, -1.3, -Math.PI / 2, .6);       // sopra il camino

/* ---------- logo sulla parete di fondo ---------- */
const logoGrp = new THREE.Group(); logoGrp.position.set(0, 2.0, -RD / 2 + .08); scene.add(logoGrp);
const logoTex = new THREE.TextureLoader().load("guida.png", t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; });
const logoFace = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, alphaTest: .02, side: THREE.DoubleSide, toneMapped: false })); logoFace.position.z = .01; logoGrp.add(logoFace);
const logoGlow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .22, color: 0xffd48a, toneMapped: false })); logoGlow.position.z = -.02; logoGrp.add(logoGlow);

/* ---------- cartello di benvenuto ---------- */
{
  const t = tex(1024, 256, (g, w, h) => {
    g.fillStyle = "#6b3f22"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,20,8,${.1 + rnd() * .15})`; const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd() * 8 - 4, w * .7, y + rnd() * 8 - 4, w, y); g.stroke(); }
    g.strokeStyle = "#f2c14e"; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.textAlign = "center"; g.fillStyle = "#fff8ec"; g.font = "bold 78px Georgia, serif"; g.fillText(tr("bannerA"), w / 2, 118);
    g.fillStyle = "#f2c14e"; g.font = "40px Georgia, serif"; g.fillText(tr("bannerB"), w / 2, 190);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .7), new THREE.MeshStandardMaterial({ map: t, roughness: .7 })); sign.position.set(0, 0.92 + .52, -RD / 2 + .06); scene.add(sign);
  // il cartello poggia sul fondo della stanza, sotto il logo; due cordicelle lo reggono
  sign.position.y = 0.86;
  box(.02, .7, .02, M(0x3a2010), -1.3, 1.35, -RD / 2 + .05); box(.02, .7, .02, M(0x3a2010), 1.3, 1.35, -RD / 2 + .05);
}

/* ---------- orologio, ghirlanda tonda ---------- */
const clockCv = document.createElement("canvas"); clockCv.width = clockCv.height = 256;
const clockTex = new THREE.CanvasTexture(clockCv); clockTex.colorSpace = THREE.SRGBColorSpace;
function drawClock() {
  const g = clockCv.getContext("2d"), d = new Date(), c = 128;
  g.clearRect(0, 0, 256, 256); g.fillStyle = "#8a1c28"; g.beginPath(); g.arc(c, c, 126, 0, 7); g.fill();
  g.fillStyle = "#fff8ec"; g.beginPath(); g.arc(c, c, 108, 0, 7); g.fill();
  g.strokeStyle = "#f2c14e"; g.lineWidth = 6; g.beginPath(); g.arc(c, c, 112, 0, 7); g.stroke();
  g.fillStyle = "#3a1d14"; g.font = "bold 26px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; g.fillText(String(i), c + Math.sin(a) * 86, c - Math.cos(a) * 86); }
  const hand = (a, len, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len); g.stroke(); };
  const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60;
  hand(h * Math.PI / 6, 52, 9, "#3a1d14"); hand(m * Math.PI / 30, 80, 6, "#3a1d14"); hand(s * Math.PI / 30, 90, 2.5, "#d62839");
  g.fillStyle = "#d62839"; g.beginPath(); g.arc(c, c, 8, 0, 7); g.fill(); clockTex.needsUpdate = true;
}
{
  const clock = new THREE.Mesh(new THREE.CircleGeometry(.36, 48), new THREE.MeshBasicMaterial({ map: clockTex, transparent: true, toneMapped: false })); clock.position.set(1.75, 2.0, -RD / 2 + .05); scene.add(clock);
  // corona di Natale sul lato opposto
  const w = new THREE.Group(); w.position.set(-1.75, 2.0, -RD / 2 + .08); scene.add(w);
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(.3, .08, 10, 28), M(0x1b5e2b, { roughness: .95, flatShading: true })); w.add(wreath);
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; const b = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 8), M(i % 2 ? COL.red : COL.gold, { metalness: .5, roughness: .3 })); b.position.set(Math.cos(a) * .3, Math.sin(a) * .3, .07); w.add(b); }
  const bowM = M(COL.red, { roughness: .5 });
  for (const s of [-1, 1]) { const lp = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 10), bowM); lp.scale.set(1.5, .8, .6); lp.position.set(s * .08, -.3, .09); lp.rotation.z = s * .5; w.add(lp); const tail = box(.05, .2, .015, bowM, s * .05, -.45, .08, w); tail.rotation.z = s * .18; }
}

/* ---------- tappeto e tavolo con il presepe ---------- */
const RUG = { w: 3.1, d: 2.3 };
const rugTex = tex(1024, 760, (g, w, h) => {
  const m = 46, X = m, Y = 0, W = w - 2 * m, H = h;    // ai lati corto restano le frange
  g.strokeStyle = "#f3e6c8"; g.lineWidth = 3; for (let y = 6; y < h; y += 9) { g.beginPath(); g.moveTo(4, y); g.lineTo(m + 4, y); g.moveTo(w - m - 4, y); g.lineTo(w - 4, y); g.stroke(); }
  g.fillStyle = "#6e1220"; g.fillRect(X, Y, W, H);
  const band = (i, col) => { g.fillStyle = col; g.fillRect(X + i, Y + i, W - 2 * i, H - 2 * i); };
  band(0, "#f2c14e"); band(8, "#5b0e1a"); band(22, "#16553a"); band(70, "#f3e6c8"); band(78, "#8a1726");
  g.fillStyle = "#c9a227"; for (let x = X + 40; x < X + W - 30; x += 38) { g.beginPath(); g.moveTo(x, Y + 46); g.lineTo(x + 10, Y + 38); g.lineTo(x + 20, Y + 46); g.lineTo(x + 10, Y + 54); g.fill(); g.beginPath(); g.moveTo(x, Y + H - 46); g.lineTo(x + 10, Y + H - 38); g.lineTo(x + 20, Y + H - 46); g.lineTo(x + 10, Y + H - 54); g.fill(); }
  g.strokeStyle = "rgba(243,230,200,.28)"; g.lineWidth = 2; for (let i = -12; i < 30; i++) { g.beginPath(); g.moveTo(X + 80 + i * 56, Y + 80); g.lineTo(X + 80 + i * 56 + 400, Y + H - 80); g.moveTo(X + 80 + i * 56 + 400, Y + 80); g.lineTo(X + 80 + i * 56, Y + H - 80); g.stroke(); }
  const cx = w / 2, cy = h / 2;
  g.fillStyle = "#16553a"; g.beginPath(); g.ellipse(cx, cy, 250, 190, 0, 0, 7); g.fill(); g.strokeStyle = "#f2c14e"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#8a1726"; g.beginPath(); g.ellipse(cx, cy, 200, 148, 0, 0, 7); g.fill();
  g.strokeStyle = "#f3e6c8"; g.lineWidth = 7; g.lineCap = "round";
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 100); g.stroke(); for (const k of [.45, .75]) for (const sg of [-1, 1]) { const px = cx + Math.cos(a) * 130 * k, py = cy + Math.sin(a) * 100 * k; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + sg * .8) * 26, py + Math.sin(a + sg * .8) * 26); g.stroke(); } }
  g.fillStyle = "#f2c14e"; g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill();
  for (const [px, py] of [[X + 130, Y + 130], [X + W - 130, Y + 130], [X + 130, Y + H - 130], [X + W - 130, Y + H - 130]]) { g.fillStyle = "#16553a"; g.beginPath(); g.arc(px, py, 38, 0, 7); g.fill(); g.strokeStyle = "#f2c14e"; g.lineWidth = 4; g.stroke(); g.fillStyle = "#f3e6c8"; g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill(); }
});
const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1, transparent: true })); rug.position.set(TABLE.x, .006, TABLE.z - .1); scene.add(rug);
{ // tappetino rotondo davanti al camino
  const t = tex(256, 256, (g) => { const c = 128, r = (R, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill(); }; r(127, "#f2c14e"); r(120, "#8a1726"); r(92, "#f3e6c8"); r(84, "#16553a"); r(52, "#8a1726"); r(14, "#f2c14e"); });
  const hr = new THREE.Mesh(new THREE.CircleGeometry(.75, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 1, transparent: true })); hr.position.set(RW / 2 - 1.15, .008, -1.3); scene.add(hr);
}

const tableGrp = new THREE.Group(); tableGrp.position.set(TABLE.x, 0, TABLE.z); scene.add(tableGrp);
{
  const wood = M(0x6b4023, { roughness: .6 });
  box(TABLE.w, .06, TABLE.d, wood, 0, TABLE.h - .03, 0, tableGrp);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(.09, TABLE.h - .06, .09, wood, sx * (TABLE.w / 2 - .1), (TABLE.h - .06) / 2, sz * (TABLE.d / 2 - .1), tableGrp);
  box(TABLE.w + .12, .025, TABLE.d + .12, M(0xa31d2c, { roughness: .95 }), 0, TABLE.h + .0125, 0, tableGrp);           // tovaglia rossa
  box(TABLE.w + .13, .02, .1, M(0xb88a2a, { roughness: .6, metalness: .2 }), 0, TABLE.h + .02, 0, tableGrp);          // runner dorato
  const drape = box(TABLE.w + .12, .22, .012, M(0xa31d2c, { roughness: .95 }), 0, TABLE.h - .08, (TABLE.d + .12) / 2, tableGrp);
  box(TABLE.w + .12, .22, .012, M(0xa31d2c, { roughness: .95 }), 0, TABLE.h - .08, -(TABLE.d + .12) / 2, tableGrp);
  box(.012, .22, TABLE.d + .12, M(0xa31d2c, { roughness: .95 }), (TABLE.w + .12) / 2, TABLE.h - .08, 0, tableGrp);
  box(.012, .22, TABLE.d + .12, M(0xa31d2c, { roughness: .95 }), -(TABLE.w + .12) / 2, TABLE.h - .08, 0, tableGrp);
  void drape;
}
const TOP = TABLE.h + .03;
{ // centrotavola: stella di Natale in vaso dorato
  const g = new THREE.Group(); g.position.set(0, TOP, 0); tableGrp.add(g);
  cyl(.07, .055, .1, M(COL.gold, { metalness: .7, roughness: .35 }), 0, .05, 0, g, 16);
  const leaf = M(0x1b5e2b, { roughness: .9 }), pet = M(0xd62839, { roughness: .8 });
  for (let i = 0; i < 8; i++) for (const [r, y, m, o, k] of [[.12, .115, leaf, 0, 1.25], [.085, .15, pet, .4, 1]]) { const a = i / 8 * 6.283 + o, p = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), m); p.scale.set(k * 1.1, .18, .5 * k); p.position.set(Math.cos(a) * r, y, Math.sin(a) * r); p.rotation.y = -a; g.add(p); }
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 6), M(COL.gold, { emissive: 0xb88a2a, emissiveIntensity: .5 })); b.position.set((rnd() - .5) * .05, .185, (rnd() - .5) * .05); g.add(b); }
}
const natGrp = new THREE.Group(); natGrp.position.set(NAT.x, NAT.rise, NAT.z); scene.add(natGrp);
{ // il rialzo per presepi: base di legno, prato di muschio e neve sui bordi
  const g = new THREE.Group(); g.position.set(NAT.x, 0, NAT.z); scene.add(g);
  const wood = M(0x5a3520, { roughness: .6 }), gold = M(COL.gold, { metalness: .7, roughness: .35 });
  box(1.14, .1, .74, wood, 0, .05, 0, g); box(1.18, .018, .78, gold, 0, .1, 0, g); box(1.0, .07, .62, M(0x2f6b3a, { roughness: 1 }), 0, .135, 0, g);
  box(.9, .05, .14, wood, 0, .025, .43, g); box(1.14, .03, .01, M(COL.red, { roughness: .6 }), 0, .05, .372, g);
  const sn = M(0xf4f7ff, { roughness: .95 });
  for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), sn); p.scale.set(1.5 + rnd(), .28, 1 + rnd() * .6); p.position.set((rnd() - .5) * .95, .17, (rnd() < .5 ? -1 : 1) * (.2 + rnd() * .08)); g.add(p); }
}
const candleFlames = [];
function candle(x, z) {
  const g = new THREE.Group(); g.position.set(x, TOP, z); tableGrp.add(g);
  cyl(.04, .04, .018, M(COL.gold, { metalness: .8, roughness: .3 }), 0, .009, 0, g);
  cyl(.028, .028, .17, M(0xfff0d0, { roughness: .6 }), 0, .1, 0, g);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb347, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); f.position.y = .21; f.scale.set(.1, .14, 1); g.add(f); candleFlames.push(f);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff6c8 })); core.position.y = .2; g.add(core);
}
candle(-.68, -.18); candle(.68, -.18);
{
  const plate = cyl(.13, .1, .02, M(0xfff8ec, { roughness: .4 }), -.55, TOP + .01, .3, tableGrp);  // piatto di biscotti
  void plate;
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, c = cyl(.03, .03, .008, M(i % 2 ? 0xc98a4b : 0xe0a96a, { roughness: .8 }), -.55 + Math.cos(a) * .06, TOP + .025, .3 + Math.sin(a) * .06, tableGrp, 12); c.rotation.x = rnd() * .2; }
  cyl(.04, .035, .09, M(0xfff8ec, { roughness: .35 }), .55, TOP + .045, .3, tableGrp);                // tazza
  cyl(.034, .034, .01, M(0x4a2a14, { roughness: .3 }), .55, TOP + .088, .3, tableGrp);
}

/* ---------- l’albero di Natale ---------- */
const treeGrp = new THREE.Group(); treeGrp.position.set(TREE.x, 0, TREE.z); scene.add(treeGrp);
const TIERS = [0, 1, 2, 3, 4].map(k => ({ base: .35 + .38 * k, h: .7 + .06 * (k === 0), R: .98 - .15 * k }));
function treeR(y) { let r = 0; for (const t of TIERS) if (y >= t.base && y <= t.base + t.h) r = Math.max(r, t.R * (1 - (y - t.base) / t.h)); return r; }
let treeBodyTop = 0;
{
  const needleM = M(0x1d6b34, { roughness: .9, flatShading: true });
  for (const t of TIERS) {
    const g = new THREE.ConeGeometry(t.R, t.h, 18, 3, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (r > 1e-3) { const a = Math.atan2(z, x), k = 1 + .1 * Math.sin(a * 11 + y * 9) + (y < 0 ? .05 * Math.sin(a * 23) : 0); p.setXYZ(i, x * k, y, z * k); } }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, needleM); m.position.y = t.base + t.h / 2; treeGrp.add(m); treeBodyTop = t.base + t.h;
  }
  cyl(.09, .12, .5, M(0x4a2a14), 0, .25, 0, treeGrp, 10);
  const pot = cyl(.28, .22, .32, M(COL.red, { roughness: .5 }), 0, .16, 0, treeGrp, 16); void pot;
  cyl(1.3, 1.3, .05, M(0x9c1d2b, { roughness: .95 }), 0, .03, 0, treeGrp, 36);     // gonna dell’albero
  cyl(1.3, 1.3, .052, M(COL.gold, { metalness: .6, roughness: .4 }), 0, .026, 0, treeGrp, 36).scale.set(1, .5, 1);
  treeGrp.children[treeGrp.children.length - 1].scale.set(.0001, .0001, .0001);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, .018, 8, 48).rotateX(Math.PI / 2), M(COL.gold, { metalness: .7, roughness: .35 })); rim.position.y = .06; treeGrp.add(rim);
  // stella in cima
  const star = new THREE.Mesh(starGeo(.17, .07, .04), M(0xffd36a, { emissive: 0xffb830, emissiveIntensity: 1.4, metalness: .4, roughness: .3 })); star.position.y = treeBodyTop + .1; star.userData.spin = true; treeGrp.add(star); window.__star = star;
  const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd36a, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); sg.scale.set(.9, .9, 1); sg.position.y = treeBodyTop + .1; treeGrp.add(sg);
  // palline appese (una sola draw call)
  const NO = 76, ballG = new THREE.SphereGeometry(.058, 14, 12), balls = new THREE.InstancedMesh(ballG, M(0xffffff, { metalness: .75, roughness: .2 }), NO), mm = new THREE.Matrix4(), cc = new THREE.Color();
  const pal = [0xd62839, 0xf2c14e, 0xe8e8f0, 0x2b6fd6, 0xd62839, 0xf2c14e];
  for (let i = 0; i < NO; i++) {
    const y = .6 + rnd() * (treeBodyTop - .9), r = treeR(y) * .96, a = rnd() * 6.283, s = .8 + rnd() * .6;
    mm.makeScale(s, s, s).setPosition(Math.cos(a) * r, y, Math.sin(a) * r); balls.setMatrixAt(i, mm); balls.setColorAt(i, cc.setHex(pal[i % pal.length]));
  }
  treeGrp.add(balls);
  // festoni dorati a spirale
  for (const [off, y0, y1, turns] of [[0, .55, 2.2, 6], [3.1, .6, 2.1, 5]]) {
    const pts = []; for (let i = 0; i <= 120; i++) { const u = i / 120, y = y0 + u * (y1 - y0), r = treeR(y) * 1.03 + .01; pts.push(new THREE.Vector3(Math.cos(u * turns * 6.283 + off) * r, y, Math.sin(u * turns * 6.283 + off) * r)); }
    treeGrp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, .012, 5, false), M(COL.gold, { metalness: .9, roughness: .25, emissive: 0x3a2a00, emissiveIntensity: .3 })));
  }
  // bastoncini di zucchero
  for (let i = 0; i < 7; i++) {
    const y = .8 + rnd() * (treeBodyTop - 1.2), r = treeR(y) * .98, a = rnd() * 6.283;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.rotation.y = -a + Math.PI / 2;
    const cm = M(0xffffff, { roughness: .4 });
    cyl(.01, .01, .16, cm, 0, -.05, 0, g, 8); const hook = new THREE.Mesh(new THREE.TorusGeometry(.04, .01, 6, 12, Math.PI), cm); hook.position.set(.04, .03, 0); g.add(hook);
    for (let k = 0; k < 4; k++) cyl(.0115, .0115, .018, M(COL.red), 0, -.1 + k * .04, 0, g, 8);
    treeGrp.add(g);
  }
  // regali
  const gifts = [[.7, .15, .5, .3, .24, 0xd62839, COL.gold, .3], [-.7, .1, .6, .26, .3, 0x1f8a4c, 0xff5566, -.4], [.2, .12, 1.05, .34, .22, 0x2b6fd6, COL.gold, .1], [-.2, .09, 1.0, .22, .18, COL.gold, 0xd62839, .6], [1.0, .1, -.2, .24, .22, 0xf2f2f2, COL.red, .8], [-1.0, .12, -.1, .3, .26, 0x8a1c8f, COL.gold, -.2]];
  for (const [x, hh, z, w, h, c, rc, ry] of gifts) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; treeGrp.add(g);
    box(w, h, w, M(c, { roughness: .55 }), 0, h / 2, 0, g);
    const rm = M(rc, { roughness: .4, metalness: .2 });
    box(w + .006, h + .006, .035, rm, 0, h / 2, 0, g); box(.035, h + .006, w + .006, rm, 0, h / 2, 0, g);
    const bw = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), rm); bw.scale.set(1.4, .7, .8); bw.position.y = h + .02; g.add(bw); void hh;
  }
}
function starGeo(R, r, depth) {
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + Math.PI / 2, rad = i % 2 ? r : R, x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * .15, bevelThickness: depth * .15, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); return g;
}
// luci dell’albero: puntini luminosi che si accendono a modo loro
const NL = 120, lightPos = new Float32Array(NL * 3), lightCol = new Float32Array(NL * 3), lightBase = [];
for (let i = 0; i < NL; i++) {
  const u = i / NL, y = .5 + u * (treeBodyTop - .6), r = treeR(y) * 1.04 + .02, a = u * 6.283 * 8.5;
  lightPos[i * 3] = TREE.x + Math.cos(a) * r; lightPos[i * 3 + 1] = y; lightPos[i * 3 + 2] = TREE.z + Math.sin(a) * r;
}
const lightGeo = new THREE.BufferGeometry(); lightGeo.setAttribute("position", new THREE.BufferAttribute(lightPos, 3)); lightGeo.setAttribute("color", new THREE.BufferAttribute(lightCol, 3));
const lightPts = new THREE.Points(lightGeo, new THREE.PointsMaterial({ size: .17, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); lightPts.frustumCulled = false; scene.add(lightPts);
const MULTI = [0xff4455, 0xffc84a, 0x4cff8a, 0x4aa8ff, 0xff7be0].map(h => new THREE.Color(h)), WARM = new THREE.Color(0xffd9a0);
for (let i = 0; i < NL; i++) lightBase.push(MULTI[i % 5]);
let lightMode = 0;

/* ---------- camino con il fuoco ---------- */
const fireZ = -1.3, flames = [];
{
  const brickTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = "#2a1c18"; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { const x = c * 64 + (r % 2 ? 32 : 0), L = 38 + rnd() * 14; g.fillStyle = `hsl(14,${22 + rnd() * 10}%,${L}%)`; g.fillRect(x + 2, r * 32 + 2, 60, 28); }
  }, [1.3, 1.3]);
  const stone = M(0xffffff, { map: brickTex, roughness: .95 });
  const x = RW / 2 - .27, ow = .98, oh = .86, col = .46;
  box(.5, 1.25, col, stone, x, .625, fireZ - ow / 2 - col / 2);
  box(.5, 1.25, col, stone, x, .625, fireZ + ow / 2 + col / 2);
  box(.5, 1.25 - oh, ow + col * 2, stone, x, (oh + 1.25) / 2, fireZ);
  box(.62, .07, ow + col * 2 + .3, M(0x5b3a22, { roughness: .6 }), x - .06, 1.285, fireZ);                   // mensola in legno
  box(.55, .04, ow + col * 2 + .5, stone, x - .02, .02, fireZ);                                              // soglia
  box(.1, oh, ow, M(0x0f0807), RW / 2 - .06, oh / 2, fireZ);                                               // il fondo, nero di fuliggine
  for (const dz of [-.12, .14]) { const lg = cyl(.07, .07, .78, M(0x2a1608, { roughness: 1, emissive: 0x7a2a00, emissiveIntensity: .5 }), RW / 2 - .22, .1, fireZ + dz, scene, 10); lg.rotation.x = Math.PI / 2; lg.rotation.y = dz * .6; }
  const fm = new THREE.SpriteMaterial({ map: tex(64, 128, (g, w, h) => { const gr = g.createRadialGradient(32, 84, 2, 32, 84, 52); gr.addColorStop(0, "rgba(255,252,210,1)"); gr.addColorStop(.3, "rgba(255,190,60,.95)"); gr.addColorStop(.65, "rgba(255,80,10,.45)"); gr.addColorStop(1, "rgba(255,40,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(fm.clone()); s.position.set(RW / 2 - .26 - rnd() * .08, .28 + rnd() * .1, fireZ + (i - 3) * .12); s.userData = { b: .35 + rnd() * .3, ph: rnd() * 9, z: s.position.z }; scene.add(s); flames.push(s); }
  // calze appese
  const sock = tex(128, 192, (g, w, h) => {
    g.fillStyle = "#fff8ec"; g.fillRect(24, 4, 64, 34); g.fillStyle = "#d62839"; g.beginPath(); g.moveTo(26, 38); g.lineTo(86, 38); g.lineTo(86, 110); g.quadraticCurveTo(88, 150, 110, 160); g.quadraticCurveTo(122, 178, 88, 184); g.lineTo(60, 184); g.quadraticCurveTo(24, 160, 26, 120); g.closePath(); g.fill();
    g.fillStyle = "#1f8a4c"; g.beginPath(); g.moveTo(90, 160); g.quadraticCurveTo(122, 178, 90, 186); g.lineTo(80, 164); g.fill(); g.fillStyle = "#f2c14e"; g.beginPath(); g.arc(56, 80, 12, 0, 7); g.fill();
    g.strokeStyle = "#f2c14e"; g.lineWidth = 5; g.beginPath(); g.arc(56, 0, 18, 0, Math.PI); g.stroke();
  });
  for (const dz of [-.6, -.1, .4]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(.2, .3), new THREE.MeshBasicMaterial({ map: sock, transparent: true, alphaTest: .05, toneMapped: false, color: 0xdddddd })); s.position.set(RW / 2 - .6, 1.08, fireZ + dz); s.rotation.y = -Math.PI / 2; s.position.x = RW / 2 - .585; scene.add(s); }
}
// rami e pigne sulla mensola, due lanterne
for (const dz of [-.78, .78]) {
  const g = new THREE.Group(); g.position.set(RW / 2 - .3, 1.32, fireZ + dz); scene.add(g);
  cyl(.06, .07, .02, M(COL.gold, { metalness: .8, roughness: .3 }), 0, .01, 0, g); cyl(.045, .045, .2, M(0xfff0d0, { roughness: .5, emissive: 0x553300, emissiveIntensity: .3 }), 0, .12, 0, g);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb347, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); f.position.y = .27; f.scale.set(.13, .17, 1); g.add(f); candleFlames.push(f);
}

/* ---------- divano e finestra: arredo ---------- */
{
  const g = new THREE.Group(); g.position.set(RW / 2 - .62, 0, 2.2); g.rotation.y = -Math.PI / 2; scene.add(g);
  const vel = M(0x6e1522, { roughness: .9 });
  box(2.0, .3, .86, M(0x3a1d14), 0, .2, 0, g); box(1.9, .18, .74, vel, 0, .42, .02, g); box(2.0, .62, .2, vel, 0, .66, -.33, g);
  box(.2, .52, .86, vel, -.9, .46, 0, g); box(.2, .52, .86, vel, .9, .46, 0, g);
  const cush = (x, y, c, ry) => { const m = box(.38, .38, .12, M(c, { roughness: .95 }), x, y, .02, g); m.rotation.set(-.25, ry, .1); };
  cush(-.55, .72, 0x1f8a4c, .2); cush(.5, .72, COL.gold, -.2); cush(-.1, .7, 0xfff8ec, .05);
  const wl = box(1.1, .02, .6, M(0xfff8ec, { roughness: 1 }), .4, .53, .1, g); wl.rotation.y = .1;      // plaid
  box(1.1, .022, .12, M(COL.red, { roughness: 1 }), .4, .535, .08, g).rotation.y = .1;
}
// panca davanti alla finestra con una piccola lampada, e il cesto dei regali
{
  const g = new THREE.Group(); g.position.set(-RW / 2 + .3, 0, 1.0); scene.add(g);
  box(.5, .05, 1.8, M(0x6b4023, { roughness: .6 }), 0, .44, 0, g); for (const dz of [-.8, .8]) box(.45, .42, .06, M(0x6b4023), 0, .21, dz, g);
  for (let i = 0; i < 3; i++) { const b = box(.22, .12, .22, M([COL.red, COL.green, COL.gold][i], { roughness: .6 }), 0, .53, -.5 + i * .5, g); b.rotation.y = rnd(); }
}

/* ---------- quadri dorati sopra il divano ---------- */
{
  const L = new THREE.TextureLoader(), gold = M(COL.gold, { metalness: .7, roughness: .35 });
  const frame = (file, asp, h, z, y) => {
    const w = h * asp, g = new THREE.Group(); g.position.set(RW / 2 - .04, y, z); g.rotation.y = -Math.PI / 2; scene.add(g);
    box(w + .1, h + .1, .04, gold, 0, 0, 0, g); box(w + .04, h + .04, .045, M(0x2a1608), 0, 0, 0, g);
    const t = L.load("art/" + file, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); p.position.z = .03; g.add(p);
  };
  frame("adorazione.jpg", 1.29, .42, 1.3, 1.72); frame("famiglia.jpg", 1.29, .52, 2.2, 1.78); frame("magi.jpg", 1.63, .42, 3.1, 1.72);
}

/* ---------- stelle di carta appese al soffitto ---------- */
const hangStars = [];
{
  const sg = starGeo(.24, .1, .1), sm = M(0xffd36a, { emissive: 0xffb830, emissiveIntensity: .8, roughness: .5 });
  for (const [x, z, len] of [[-1.3, -.6, .6], [1.8, -1.5, .8], [-1.1, 1.0, .5], [1.5, 1.0, .7], [-2.2, 2.2, .9], [2.0, -3.0, .6]]) {
    const g = new THREE.Group(); g.position.set(x, RH - .1, z); scene.add(g);
    box(.006, len, .006, M(0xd8c8a0), 0, -len / 2, 0, g);
    const s = new THREE.Mesh(sg, sm); s.position.y = -len - .05; g.add(s); hangStars.push(g);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc860, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5, toneMapped: false })); gl.scale.set(.7, .7, 1); gl.position.y = -len - .05; g.add(gl);
  }
}

/* ---------- il presepe sul tavolo ---------- */
let natReady = false;
async function loadNat(onProg) {
  const res = await fetch("models/nativita.glb"); if (!res.ok) throw new Error("presepe non trovato");
  const total = +res.headers.get("content-length") || 3848780, rd = res.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onProg(Math.min(.99, got / total)); }
  const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  const model = await new Promise((ok, bad) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf.buffer, "", g => ok(g.scene), bad));
  model.scale.setScalar(1); model.updateMatrixWorld(true); { const z0 = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()); model.scale.setScalar(Math.min(.88 / z0.x, .5 / z0.z, .6 / z0.y)); }
  model.traverse(m => {
    if (!m.isMesh) return; const mat = m.material;
    if (mat.alphaTest > 0) { m.material = new THREE.MeshLambertMaterial({ map: mat.map, color: mat.color, alphaTest: mat.alphaTest, side: THREE.DoubleSide }); mat.dispose(); } else mat.side = THREE.FrontSide;
  });
  model.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(model);
  model.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);   // al centro del tavolo, appoggiato sopra
  model.updateMatrix(); model.traverse(m => { m.matrixAutoUpdate = false; });
  natGrp.add(model); natReady = true;
}

/* ---------- cose su cui puntare e premere ---------- */
const pick = [];
function proxy(geo, x, y, z, act) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); m.userData.act = act; scene.add(m); pick.push(m); return m; }
proxy(new THREE.CylinderGeometry(1.1, 1.1, 2.9, 12), TREE.x, 1.45, TREE.z, "tree");
proxy(new THREE.BoxGeometry(1.0, .5, .6), NAT.x, NAT.rise + .25, NAT.z, "nat");
proxy(new THREE.BoxGeometry(.5, 1.0, 1.9), RW / 2 - .3, .55, fireZ, "fire");
proxy(new THREE.CircleGeometry(.8, 20), 0, 2.0, -RD / 2 + .16, "logo");

/* ---------- scintille ---------- */
const NB = 260, bpos = new Float32Array(NB * 3).fill(-50), bvel = new Float32Array(NB * 3), bcol = new Float32Array(NB * 3), blife = new Float32Array(NB); let bi = 0;
const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute("position", new THREE.BufferAttribute(bpos, 3)); bgeo.setAttribute("color", new THREE.BufferAttribute(bcol, 3));
const bpts = new THREE.Points(bgeo, new THREE.PointsMaterial({ size: .08, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); bpts.frustumCulled = false; scene.add(bpts);
function burst(p, hex, n = 55) {
  const c = new THREE.Color(hex);
  for (let k = 0; k < n; k++) {
    const i = bi++ % NB, a = rnd() * 6.283, u = rnd() * 2 - 1, sp = .5 + rnd() * 1.3, rr = Math.sqrt(1 - u * u);
    bpos.set([p.x, p.y, p.z], i * 3); bvel.set([Math.cos(a) * rr * sp, u * sp + .6, Math.sin(a) * rr * sp], i * 3); bcol.set([c.r, c.g, c.b], i * 3); blife[i] = 1 + rnd() * .8;
  }
}

/* ---------- suoni: campanelle e crepitio del fuoco ---------- */
let actx = null;
function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (_) {} }
const midi = n => 440 * 2 ** ((n - 69) / 12);
function bell(n, t0 = 0, vol = .16) {
  if (!actx) return; const t = actx.currentTime + t0, f = midi(n), g = actx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + 1.8); g.connect(actx.destination);
  for (const [m, a] of [[1, 1], [2.76, .35], [5.4, .15]]) { const o = actx.createOscillator(), og = actx.createGain(); o.frequency.value = f * m; og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.9); }
}
function crackle(loud = 1) {
  if (!actx) return; const len = actx.sampleRate * .03 | 0, b = actx.createBuffer(1, len, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = actx.createBufferSource(); s.buffer = b; const g = actx.createGain(); g.gain.value = (.04 + Math.random() * .07) * loud; const f = actx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200 + Math.random() * 2400;
  s.connect(f); f.connect(g); g.connect(actx.destination); s.start();
}
setInterval(() => { if (started && Math.random() < .6) crackle(); }, 380);
const SONG_URL = "";   // qui metteremo la nuova canzone, per esempio "audio/nuova.mp3". Vuoto = nessuna musica (restano campanelle e crepitio)
const song = SONG_URL ? new Audio(SONG_URL) : null; if (song) { song.loop = true; song.volume = .35; } let musicOn = false;
const playSong = () => { if (song) song.play().then(() => { musicOn = true; }).catch(() => {}); };
const stopSong = () => { if (song) song.pause(); musicOn = false; };

/* ---------- interazione ---------- */
const fx = { starFlash: 0, fire: 0, logoSpin: 0 };
function act(name, p) {
  ensureAudio(); if (!musicOn) playSong();
  if (name === "tree") { lightMode = (lightMode + 1) % 3; [72, 76, 79].forEach((n, i) => bell(n, i * .09)); burst(new THREE.Vector3(TREE.x, treeBodyTop + .1, TREE.z), 0xffd36a, 70); }
  else if (name === "nat") { [84, 88, 91, 96].forEach((n, i) => bell(n, i * .14, .12)); fx.starFlash = 1; burst(new THREE.Vector3(NAT.x, NAT.rise + .4, NAT.z), 0xfff1b8, 60); }
  else if (name === "fire") { fx.fire = 1; for (let i = 0; i < 6; i++) setTimeout(() => crackle(2.2), i * 70); burst(new THREE.Vector3(RW / 2 - .35, .6, fireZ), 0xff9a3a, 50); }
  else if (name === "logo") { fx.logoSpin = 1; [67, 71, 74, 79].forEach((n, i) => bell(n, i * .1)); burst(new THREE.Vector3(0, 2.0, -RD / 2 + .3), 0xf2c14e, 70); }
  void p;
}
const ray = new THREE.Raycaster(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), reticle = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfff1b8, toneMapped: false }));
reticle.visible = false; scene.add(reticle);
function castFrom(obj) { tmpM.identity().extractRotation(obj.matrixWorld); ray.ray.origin.setFromMatrixPosition(obj.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); return ray.intersectObjects(pick, false)[0]; }
const ctls = [];
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i); rig.add(c); ctls.push(c);
  c.addEventListener("connected", e => {
    if (e.data.targetRayMode !== "tracked-pointer") return;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, 1.4, 6).rotateX(Math.PI / 2).translate(0, 0, -.7), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: .5, toneMapped: false }));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); c.add(line, tip); c.userData.has = true;
  });
  c.addEventListener("disconnected", () => { c.clear(); c.userData.has = false; });
  c.addEventListener("select", () => { c.updateMatrixWorld(true); const h = castFrom(c); if (h) act(h.object.userData.act, h.point); else { ensureAudio(); if (!musicOn) playSong(); } });
}

/* ---------- muoversi: nel visore e sul computer ---------- */
const BOX = [   // ostacoli (x0,x1,z0,z1): tavolo, albero, camino, divano, panca
  [TABLE.x - 1.1, TABLE.x + 1.1, TABLE.z - .75, TABLE.z + .75], [TREE.x - 1.05, TREE.x + 1.05, TREE.z - 1.05, TREE.z + 1.05],
  [NAT.x - .62, NAT.x + .62, NAT.z - .42, NAT.z + .46], [2.85, 4, -2.5, -.1], [2.3, 4, 1.15, 3.25], [-4, -2.9, .0, 2.0]
];
function resolve(x, z) {
  x = Math.max(-RW / 2 + .3, Math.min(RW / 2 - .3, x)); z = Math.max(-RD / 2 + .35, Math.min(RD / 2 - .3, z));
  for (const [x0, x1, z0, z1] of BOX) if (x > x0 && x < x1 && z > z0 && z < z1) {
    const d = [x - x0, x1 - x, z - z0, z1 - z], m = Math.min(...d), k = d.indexOf(m);
    if (k === 0) x = x0; else if (k === 1) x = x1; else if (k === 2) z = z0; else z = z1;
  }
  return [x, z];
}
const D = { x: 0, z: 1.9, yaw: 0, pitch: -.04, keys: {}, drag: false, walk: 0, moved: 0 };
function deskMove(dt) {
  const K = D.keys, sp = (K.shift ? 2.4 : 1.25) * dt, f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + D.walk, r = (K.d ? 1 : 0) - (K.a ? 1 : 0); D.walk = 0;
  if (K.arrowleft) D.yaw += 1.6 * dt; if (K.arrowright) D.yaw -= 1.6 * dt;
  const sy = Math.sin(D.yaw), cy = Math.cos(D.yaw);
  [D.x, D.z] = resolve(D.x + (-sy * f + cy * r) * sp, D.z + (-cy * f - sy * r) * sp);
  rig.position.set(D.x, 0, D.z); rig.rotation.set(0, 0, 0); camera.position.set(0, EYE, 0); camera.rotation.set(D.pitch, D.yaw, 0, "YXZ");
}
let snapReady = true;
function xrMove(dt) {
  const s = renderer.xr.getSession(); if (!s) return;
  for (const src of s.inputSources) {
    const g = src.gamepad; if (!g) continue; const a = g.axes, x = a.length >= 4 ? a[2] : a[0], y = a.length >= 4 ? a[3] : a[1];
    if (src.handedness === "left" && Math.hypot(x, y) > .15) {
      camera.getWorldDirection(tmpV); const yaw = Math.atan2(-tmpV.x, -tmpV.z), sp = 1.4 * dt, f = -y, r = x;
      rig.position.x += (-Math.sin(yaw) * f + Math.cos(yaw) * r) * sp; rig.position.z += (-Math.cos(yaw) * f - Math.sin(yaw) * r) * sp;
    } else if (src.handedness === "right") {
      if (Math.abs(x) > .7 && snapReady) {          // giro a scatti di 30°
        snapReady = false; camera.getWorldPosition(tmpV); const bx = tmpV.x, bz = tmpV.z;
        rig.rotation.y += (x > 0 ? -1 : 1) * Math.PI / 6; rig.updateMatrixWorld(true); camera.getWorldPosition(tmpV); rig.position.x += bx - tmpV.x; rig.position.z += bz - tmpV.z;
      } else if (Math.abs(x) < .3) snapReady = true;
    }
  }
  camera.getWorldPosition(tmpV); const [cx, cz] = resolve(tmpV.x, tmpV.z); rig.position.x += cx - tmpV.x; rig.position.z += cz - tmpV.z;   // non attraversi mobili e pareti
}

/* ---------- animazione della stanza ---------- */
const lc = new THREE.Color();
function updateRoom(dt, t) {
  // neve fuori dalla finestra
  for (let i = 0; i < NSN; i++) {
    let y = snowPos[i * 3 + 1] - snowSpd[i] * dt; if (y < 0) { y += 5; snowPos[i * 3] = -4 - rnd() * 5; }
    snowPos[i * 3 + 1] = y; snowPos[i * 3] += Math.sin(t * .6 + i) * .12 * dt;
  }
  snowGeo.attributes.position.needsUpdate = true;
  // luci dell’albero
  for (let i = 0; i < NL; i++) {
    const base = lightMode === 0 ? WARM : lightBase[i];
    let k = lightMode === 2 ? Math.max(.12, Math.sin(t * 5 - i * .3) * .5 + .5) : .72 + .28 * Math.sin(t * 2.1 + i * 1.7);
    lc.copy(base).multiplyScalar(k); lightCol[i * 3] = lc.r; lightCol[i * 3 + 1] = lc.g; lightCol[i * 3 + 2] = lc.b;
  }
  lightGeo.attributes.color.needsUpdate = true;
  treeLight.intensity = 9 * (.9 + .1 * Math.sin(t * 3)) + fx.starFlash * 0;
  // fuoco
  fx.fire = Math.max(0, fx.fire - dt * .9);
  for (const f of flames) {
    const u = f.userData, k = (1 + .35 * Math.sin(t * 9 + u.ph) + .2 * Math.sin(t * 17 + u.ph * 2)) * (1 + fx.fire * .9);
    f.scale.set(.2 * k * (1 + fx.fire * .3), .46 * u.b * 2 * k * .6 + .12, 1); f.position.y = .15 + f.scale.y * .42; f.position.z = u.z + Math.sin(t * 3 + u.ph) * .015;
  }
  fireLight.intensity = 9 * (.8 + .25 * Math.sin(t * 11) * Math.sin(t * 7.3) + .1 * Math.sin(t * 23)) * (1 + fx.fire * 1.6);
  // candele, stelle di carta
  candleFlames.forEach((f, i) => { const k = 1 + .15 * Math.sin(t * 10 + i * 2) + .08 * Math.sin(t * 23 + i); f.scale.set(.1 * k, .14 * k * 1.1, 1); });
  hangStars.forEach((g, i) => { g.rotation.y = t * .5 + i; g.rotation.z = Math.sin(t * .7 + i * 2) * .06; });
  // presepe: la luce si accende quando ci tocchi
  fx.starFlash = Math.max(0, fx.starFlash - dt * .8); natSpot.intensity = 32 + fx.starFlash * 70;
  // logo che gira
  if (fx.logoSpin > 0) { fx.logoSpin = Math.max(0, fx.logoSpin - dt * .55); const e = 1 - fx.logoSpin; logoGrp.rotation.y = (e * e * (3 - 2 * e)) * Math.PI * 2; } else logoGrp.rotation.y = 0;
  logoGlow.material.opacity = .22 + .06 * Math.sin(t * 1.5);
  if (window.__star) window.__star.rotation.y = t * 1.2;
  // scintille
  for (let i = 0; i < NB; i++) {
    if (blife[i] <= 0) continue; blife[i] -= dt; if (blife[i] <= 0) { bpos[i * 3 + 1] = -50; continue; }
    bvel[i * 3 + 1] -= 1.5 * dt; for (let a = 0; a < 3; a++) { bpos[i * 3 + a] += bvel[i * 3 + a] * dt; bcol[i * 3 + a] *= 1 - dt * 1.3; }
  }
  bgeo.attributes.position.needsUpdate = true; bgeo.attributes.color.needsUpdate = true;
  // il mirino segue dove punti
  let h = null;
  if (renderer.xr.isPresenting) { for (const c of ctls) if (c.userData.has) { c.updateMatrixWorld(true); h = castFrom(c); if (h) break; } }
  else { camera.updateMatrixWorld(true); ray.setFromCamera({ x: 0, y: 0 }, camera); h = ray.intersectObjects(pick, false)[0]; }
  reticle.visible = !!h; if (h) reticle.position.copy(h.point);
  if (Math.floor(t) !== updateRoom.sec) { updateRoom.sec = Math.floor(t); drawClock(); }
}

/* ---------- avvio, interfaccia ---------- */
let started = false, last = 0, session = null, vrOK = false, loaded = false;
const ui = $("#ui"), startBtn = $("#start"), pcBtn = $("#startPc"), barFill = $("#bar i"), barEl = $("#bar"), statusEl = $("#status");
function frame(time) {
  const t = time / 1000, dt = Math.min(t - last, .05); last = t;
  if (!started) return;
  if (renderer.xr.isPresenting) xrMove(dt); else deskMove(dt);
  updateRoom(dt, t); renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (!renderer.xr.isPresenting) renderer.setSize(innerWidth, innerHeight); });

function applyLang() {
  document.documentElement.lang = LANG; document.title = tr("title");
  $("#t_title").textContent = tr("title"); $("#t_intro").textContent = tr("intro"); $("#t_hint").textContent = tr("hint"); $("#t_back").textContent = tr("back");
  $("#hud").innerHTML = tr("hud"); pcBtn.textContent = tr("btnPc");
  document.querySelectorAll(".chip").forEach(b => b.classList.toggle("on", b.dataset.lang === LANG));
  refreshButton();
}
document.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { LANG = b.dataset.lang; try { localStorage.setItem("nat-lang", LANG); } catch (_) {} applyLang(); }));
function refreshButton() {
  if (!loaded) { startBtn.textContent = tr("btnLoad"); return; }
  startBtn.disabled = false; barEl.classList.add("done");
  if (vrOK) { startBtn.textContent = tr("btnVR"); pcBtn.classList.remove("hidden"); } else { startBtn.textContent = tr("btnPreview"); statusEl.textContent = navigator.xr ? tr("noVR") : ""; }
}
function startDesktop() {
  ensureAudio(); playSong(); started = true; document.body.classList.add("pc");
  renderer.setClearColor(0x0b0f14, 1); Object.assign(D, { x: 0, z: 1.9, yaw: 0, pitch: -.04 });
  ui.classList.add("hidden"); $("#hud").classList.remove("hidden"); $("#dot").classList.remove("hidden");
}
async function startVR() {
  ensureAudio(); playSong();
  try { session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] }); }
  catch (e) { stopSong(); statusEl.textContent = tr("fail") + e.message; return; }
  document.body.classList.remove("pc"); started = true; rig.position.set(0, 0, 1.9); rig.rotation.set(0, 0, 0); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  await renderer.xr.setSession(session); ui.classList.add("hidden");
  session.addEventListener("end", () => { session = null; started = false; stopSong(); ui.classList.remove("hidden"); statusEl.textContent = tr("ended"); startBtn.textContent = tr("btnVR"); }, { once: true });
}
startBtn.addEventListener("click", () => vrOK ? startVR() : startDesktop());
pcBtn.addEventListener("click", startDesktop);

// mouse e tastiera (anteprima da computer)
{
  const cv = renderer.domElement; let down = null;
  cv.addEventListener("pointerdown", e => { if (!started || renderer.xr.isPresenting) return; D.drag = true; down = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); cv.classList.add("drag"); });
  addEventListener("pointerup", e => {
    cv.classList.remove("drag"); if (!D.drag) return; D.drag = false;
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { camera.updateMatrixWorld(true); ray.setFromCamera({ x: 0, y: 0 }, camera); const h = ray.intersectObjects(pick, false)[0]; if (h) act(h.object.userData.act, h.point); }
  });
  cv.addEventListener("pointermove", e => { if (D.drag) { D.yaw -= e.movementX * .004; D.pitch = Math.max(-1.2, Math.min(1.2, D.pitch - e.movementY * .004)); } });
  cv.addEventListener("wheel", e => { if (started) { D.walk -= e.deltaY * .0025; e.preventDefault(); } }, { passive: false });
  addEventListener("keydown", e => { const k = e.key.toLowerCase(); D.keys[k] = true; if (!started) return; if (k === "m") { if (musicOn) stopSong(); else playSong(); } if (k.startsWith("arrow") || k === " ") e.preventDefault(); });
  addEventListener("keyup", e => { D.keys[e.key.toLowerCase()] = false; });
  addEventListener("blur", () => { D.keys = {}; });
}

window.__sala = { D, act, scene, camera, rig, start: startDesktop };   // solo per le prove
applyLang(); drawClock();
if (navigator.xr) navigator.xr.isSessionSupported("immersive-vr").then(ok => { vrOK = ok; refreshButton(); }).catch(() => {});
loadNat(f => { barFill.style.width = Math.round(f * 100) + "%"; })
  .then(() => { loaded = true; barFill.style.width = "100%"; refreshButton(); })
  .catch(e => { console.error(e); loaded = true; statusEl.textContent = "Il presepe non si carica (" + (e && e.message || e) + "), ma la sala funziona."; refreshButton(); });
