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
    title: "La sala digitale dell’ISISS Matese",
    intro: "Una dimensione digitale di Natale tutta da esplorare prima della visita: l’albero, il presepe ai suoi piedi, il camino acceso e il logo della scuola. Nel visore cammini con la levetta sinistra e giri con la destra; sul computer usi la tastiera e il mouse.",
    hint: "Punta e premi il grilletto su albero, camino e logo. Vicino al presepe, premi per entrare nel presepe VR/AR.", natTitle: "Presepe VR / AR", natGo: "Premi per entrare", natNear: "Avvicinati e premi per entrare",
    btnLoad: "Carico la sala…", btnVR: "Entra nella sala (VR)", btnPc: "Anteprima da computer", btnPreview: "Avvia l’anteprima",
    back: "← Torna alla Natività", ended: "Sei uscito dalla sala. Puoi rientrare quando vuoi.",
    hud: "<b>W A S D</b> cammini · <b>trascina</b> il mouse per guardare · <b>clic</b> su albero, presepe, camino, logo",
    bannerA: "Benvenuti alla Natività", bannerB: "dell’ISISS Matese · la visita inizia tra poco",
    noVR: "Il visore non è stato trovato: puoi provare la sala dall’anteprima da computer.", fail: "Non riesco ad avviare la sessione VR: "
  },
  en: {
    title: "The ISISS Matese digital hall",
    intro: "A digital Christmas dimension to explore before the visit: the tree, the nativity at its foot, the burning fireplace and the school logo. In the headset walk with the left stick and turn with the right one; on a computer use keyboard and mouse.",
    hint: "Point and pull the trigger on the tree, the fireplace and the logo. Near the nativity, press to enter the VR/AR nativity.", natTitle: "Nativity VR / AR", natGo: "Press to enter", natNear: "Come closer and press to enter",
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
const TABLE = { x: .8, z: -3.0, w: 1.8, d: .9, h: .76 };   // il tavolo sta in fondo, sotto il logo, lontano dall’albero
const TREE = { x: -2.2, z: -2.8 };
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
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000503); scene.fog = new THREE.FogExp2(0x000503, .03);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .02, 40);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);     // il "carrellino": muovendolo ti muovi nella stanza
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType("local-floor"); renderer.xr.setFoveation(1); renderer.xr.setFramebufferScaleFactor(1);
document.body.appendChild(renderer.domElement);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .28;

scene.add(new THREE.HemisphereLight(0xa8ffd0, 0x021008, .6));
const moon = new THREE.DirectionalLight(0x55ffaa, .35); moon.position.set(-6, 4, 1); scene.add(moon);
const treeLight = new THREE.PointLight(0xffc27a, 9, 7, 1.6); treeLight.position.set(TREE.x + .3, 1.5, TREE.z + .7); scene.add(treeLight);
const fireLight = new THREE.PointLight(0xff7a2a, 9, 8, 1.5); fireLight.position.set(2.95, .7, -1.3); scene.add(fireLight);
const natSpot = new THREE.SpotLight(0xffe2b0, 32, 6, .62, .7, 1.6); natSpot.position.set(NAT.x + .5, 2.6, NAT.z + 1.4); natSpot.target.position.set(NAT.x, NAT.rise, NAT.z); scene.add(natSpot, natSpot.target);

/* ---------- la dimensione digitale: piattaforma, griglia, pioggia di codice ---------- */
const GR = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+<>";
function rainTex() {
  return tex(512, 1024, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.font = "bold 18px monospace"; g.textAlign = "center"; g.textBaseline = "top";
    for (let c = 0; c < 32; c++) {
      if (rnd() < .3) continue; const x = c * 16 + 8, len = 8 + rnd() * 24 | 0, head = rnd() * h;
      for (let i = 0; i < len; i++) { g.fillStyle = i === 0 ? "#eafff1" : `rgba(40,255,110,${(1 - i / len) * .9})`; const ch = GR[rnd() * GR.length | 0]; for (const o of [-h, 0, h]) g.fillText(ch, x, head - i * 18 + o); }
    }
  });
}
const rains = [[15, .1, 9, 2.4, .9], [10, .2, 7, 3.2, .5]].map(([r, spd, rx, ry, op]) => {
  const t = rainTex(); t.repeat.set(rx, ry);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 34, 64, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: op, toneMapped: false }));
  m.position.y = 10; scene.add(m); return { t, spd };
});
const gridTex = tex(256, 256, (g, w, h) => {
  g.strokeStyle = "rgba(60,255,130,.9)"; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  g.strokeStyle = "rgba(60,255,130,.35)"; g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
}, [RW, RD]);
box(RW, .1, RD, M(0x020d07, { metalness: .7, roughness: .25 }), 0, -.05, 0);                     // la piattaforma di vetro scuro
const gridPl = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .6, toneMapped: false })); gridPl.position.y = .003; scene.add(gridPl);
{
  const neon = new THREE.MeshBasicMaterial({ color: 0x39ff88, toneMapped: false });
  for (const sz of [-1, 1]) { box(RW + .05, .03, .05, neon, 0, 0, sz * RD / 2); box(.05, .03, RD + .05, neon, sz * RW / 2, 0, 0); }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5, color: 0x20ff70, toneMapped: false })); halo.position.y = -.3; scene.add(halo);
  const far = tex(256, 256, (g, w, h) => { g.strokeStyle = "rgba(60,255,130,.8)"; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }, [60, 60]);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: far, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .22, toneMapped: false })); deep.position.y = -3; scene.add(deep);
}
const NSN = 420, snowPos = new Float32Array(NSN * 3), snowSpd = new Float32Array(NSN);
for (let i = 0; i < NSN; i++) { snowPos[i * 3] = -5 + rnd() * 10; snowPos[i * 3 + 1] = rnd() * 5; snowPos[i * 3 + 2] = -5 + rnd() * 10; snowSpd[i] = .3 + rnd() * .5; }
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: .045, map: glowTex, transparent: true, depthWrite: false, color: 0xbfffd8, toneMapped: false })); snowPts.frustumCulled = false; scene.add(snowPts);

/* ---------- logo sulla parete di fondo ---------- */
const logoGrp = new THREE.Group(); logoGrp.position.set(.3, 2.1, -RD / 2 + .35); scene.add(logoGrp);
const logoTex = new THREE.TextureLoader().load("guida.png", t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; });
const logoFace = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, alphaTest: .02, side: THREE.DoubleSide, toneMapped: false })); logoFace.position.z = .01; logoGrp.add(logoFace);
const logoGlow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .2, color: 0x7dffb0, toneMapped: false })); logoGlow.position.z = -.02; logoGrp.add(logoGlow);

function drawClock() {}

/* ---------- tappeto e tavolo con il presepe ---------- */
const RUG = { w: RW - .1, d: RD - .1 };    // un solo tappeto, grande quanto la piattaforma
const rugTex = tex(896, 1024, (g, w, h) => {
  g.fillStyle = "#6e1220"; g.fillRect(0, 0, w, h);
  const band = (i, col) => { g.fillStyle = col; g.fillRect(i, i, w - 2 * i, h - 2 * i); };
  band(0, "#f2c14e"); band(8, "#5b0e1a"); band(22, "#16553a"); band(70, "#f3e6c8"); band(78, "#8a1726");
  g.fillStyle = "#c9a227";
  const dia = (x, y) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y - 8); g.lineTo(x + 20, y); g.lineTo(x + 10, y + 8); g.fill(); };
  for (let x = 40; x < w - 40; x += 38) { dia(x, 46); dia(x, h - 46); }
  for (let y = 40; y < h - 40; y += 38) { dia(34, y); dia(w - 54, y); }
  g.save(); g.beginPath(); g.rect(78, 78, w - 156, h - 156); g.clip();
  g.strokeStyle = "rgba(243,230,200,.28)"; g.lineWidth = 2;
  for (let i = -14; i < 30; i++) { const x0 = i * 56; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 1100, h); g.moveTo(x0 + 1100, 0); g.lineTo(x0, h); g.stroke(); }
  g.restore();
  const cx = w / 2, cy = h / 2;
  g.fillStyle = "#16553a"; g.beginPath(); g.ellipse(cx, cy, 290, 235, 0, 0, 7); g.fill(); g.strokeStyle = "#f2c14e"; g.lineWidth = 9; g.stroke();
  g.fillStyle = "#8a1726"; g.beginPath(); g.ellipse(cx, cy, 235, 182, 0, 0, 7); g.fill();
  g.strokeStyle = "#f3e6c8"; g.lineWidth = 8; g.lineCap = "round";
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 160, cy + Math.sin(a) * 125); g.stroke(); for (const k of [.45, .75]) for (const sg of [-1, 1]) { const px = cx + Math.cos(a) * 160 * k, py = cy + Math.sin(a) * 125 * k; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + sg * .8) * 30, py + Math.sin(a + sg * .8) * 30); g.stroke(); } }
  g.fillStyle = "#f2c14e"; g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.fill();
  for (const [px, py] of [[150, 150], [w - 150, 150], [150, h - 150], [w - 150, h - 150]]) { g.fillStyle = "#16553a"; g.beginPath(); g.arc(px, py, 46, 0, 7); g.fill(); g.strokeStyle = "#f2c14e"; g.lineWidth = 5; g.stroke(); g.fillStyle = "#f3e6c8"; g.beginPath(); g.arc(px, py, 12, 0, 7); g.fill(); }
});
const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 })); rug.position.set(0, .006, 0); scene.add(rug);

const tableGrp = new THREE.Group(); tableGrp.position.set(TABLE.x, 0, TABLE.z); scene.add(tableGrp);
{
  const grain = tex(512, 256, (g, w, h) => {
    g.fillStyle = "#5a3520"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) { g.fillStyle = `hsl(24,42%,${22 + rnd() * 5}%)`; g.fillRect(0, i * h / 3, w, h / 3); g.strokeStyle = "rgba(20,8,2,.55)"; g.lineWidth = 2; g.strokeRect(0, i * h / 3, w, h / 3); }
    for (let k = 0; k < 160; k++) { const y = rnd() * h; g.strokeStyle = `rgba(${rnd() < .5 ? "30,12,4" : "120,70,35"},${.08 + rnd() * .14})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd() * 8 - 4, w * .65, y + rnd() * 8 - 4, w, y); g.stroke(); }
  });
  const top = M(0xffffff, { map: grain, roughness: .4 }), dark = M(0x3d2314, { roughness: .55 }), W = TABLE.w, Dp = TABLE.d, H = TABLE.h;
  box(W, .04, Dp, top, 0, H - .02, 0, tableGrp); box(W + .03, .012, Dp + .03, dark, 0, H - .046, 0, tableGrp);          // piano in noce con bordo
  for (const sz of [-1, 1]) box(W - .24, .09, .025, dark, 0, H - .1, sz * (Dp / 2 - .09), tableGrp);                    // fasce sotto il piano
  for (const sx of [-1, 1]) box(.025, .09, Dp - .22, dark, sx * (W / 2 - .1), H - .1, 0, tableGrp);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * (W / 2 - .1), lz = sz * (Dp / 2 - .09); cyl(.036, .02, H - .06, dark, lx, (H - .06) / 2, lz, tableGrp, 14); cyl(.042, .042, .03, dark, lx, H - .09, lz, tableGrp, 14); cyl(.024, .024, .012, M(COL.gold, { metalness: .7, roughness: .4 }), lx, .006, lz, tableGrp, 14); }
  const rm = M(0x8a1726, { roughness: .9 }), gm = M(COL.gold, { metalness: .5, roughness: .45 });                          // runner rosso con bordi dorati
  box(W + .16, .006, .34, rm, 0, H + .003, 0, tableGrp);
  for (const sz of [-1, 1]) box(W + .16, .007, .012, gm, 0, H + .0035, sz * .15, tableGrp);
  for (const sx of [-1, 1]) { box(.006, .2, .34, rm, sx * (W / 2 + .08), H - .097, 0, tableGrp); box(.008, .016, .34, gm, sx * (W / 2 + .08), H - .19, 0, tableGrp); }
  const tl = new THREE.PointLight(0xffb347, 3, 3.2, 1.8); tl.position.set(TABLE.x, H + .4, TABLE.z); scene.add(tl);        // luce calda delle candele
}
const TOP = TABLE.h + .008;
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
candle(-.55, 0); candle(.55, 0);
{ // apparecchiatura: piatti, posate, calici, panettone e mandarini
  const china = M(0xfff8ec, { roughness: .3 }), silver = M(0xcfd3d6, { metalness: .9, roughness: .25 }), gold = M(COL.gold, { metalness: .6, roughness: .4 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .28, roughness: .04, side: THREE.DoubleSide });
  const goblet = new THREE.LatheGeometry([[0, 0], [.026, 0], [.004, .004], [.004, .07], [.03, .086], [.033, .13], [0, .13]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * .42, pz = sz * .27;
    cyl(.115, .085, .014, china, px, TOP + .007, pz, tableGrp, 28);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.1, .003, 6, 32).rotateX(Math.PI / 2), gold); ring.position.set(px, TOP + .014, pz); tableGrp.add(ring);
    box(.07, .004, .07, M(COL.red, { roughness: .9 }), px, TOP + .016, pz, tableGrp).rotation.y = .8;
    box(.008, .003, .1, silver, px - .15, TOP + .0015, pz, tableGrp); box(.008, .003, .1, silver, px + .15, TOP + .0015, pz, tableGrp);
    const gx = px + sx * .12, gz = pz - sz * .16, gl = new THREE.Mesh(goblet, glassM); gl.position.set(gx, TOP, gz); tableGrp.add(gl);
    cyl(.027, .024, .035, M(0x6a0f1c, { roughness: .2 }), gx, TOP + .1, gz, tableGrp, 14);
  }
  cyl(.07, .075, .085, M(0xd9a74a, { roughness: .8 }), -.3, TOP + .0425, 0, tableGrp, 18);                    // panettone
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 10), M(0xd9a05b, { roughness: .9 })); dome.scale.y = .6; dome.position.set(-.3, TOP + .085, 0); tableGrp.add(dome);
  const rb = new THREE.Mesh(new THREE.TorusGeometry(.073, .006, 6, 24).rotateX(Math.PI / 2), M(COL.red, { roughness: .6 })); rb.position.set(-.3, TOP + .05, 0); tableGrp.add(rb);
  cyl(.08, .05, .05, china, .3, TOP + .025, 0, tableGrp, 20);                                                  // ciotola di mandarini
  for (let i = 0; i < 7; i++) { const a = i / 6 * 6.283, o = new THREE.Mesh(new THREE.SphereGeometry(.033, 10, 8), M(0xf28c1e, { roughness: .7 })); o.position.set(.3 + (i < 6 ? Math.cos(a) * .05 : 0), TOP + .06 + (i < 6 ? 0 : .04), i < 6 ? Math.sin(a) * .05 : 0); tableGrp.add(o); }
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
  const gifts = [[1.15, .15, .55, .3, .24, 0xd62839, COL.gold, .3], [1.5, .1, .15, .26, .3, 0x1f8a4c, 0xff5566, -.4], [1.25, .12, -.35, .34, .22, 0x2b6fd6, COL.gold, .1], [.95, .09, -.8, .22, .18, COL.gold, 0xd62839, .6], [-1.0, .1, -.5, .24, .22, 0xf2f2f2, COL.red, .8], [-.7, .12, -.95, .3, .26, 0x8a1c8f, COL.gold, -.2]];
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
const fireZ = -1.3, fireP = []; let coalMat = null, emberT = 0;
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
  box(.46, 3.6, ow + col * 2 - .12, stone, x - .02, 1.25 + 1.8, fireZ);                                      // la canna fumaria sale nel buio
  const coalTex = tex(128, 128, (g, w, h) => { g.fillStyle = "#1a0804"; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const px = rnd() * w, py = rnd() * h, r = 4 + rnd() * 9, gr = g.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, "rgba(255,140,40,1)"); gr.addColorStop(.5, "rgba(200,50,10,.8)"); gr.addColorStop(1, "rgba(60,10,0,0)"); g.fillStyle = gr; g.fillRect(px - r, py - r, 2 * r, 2 * r); } });
  coalMat = new THREE.MeshBasicMaterial({ map: coalTex, toneMapped: false }); box(.62, .05, .8, coalMat, RW / 2 - .26, .07, fireZ);   // letto di brace
  for (let i = 0; i < 64; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); sp.visible = false; scene.add(sp); fireP.push({ s: sp, life: 0, max: 1, x0: 0, z0: 0, ph: 0, w: 1 }); }
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

const FC = [0xfff6c0, 0xffb02e, 0xe8420a, 0x601000].map(h => new THREE.Color(h)), fcTmp = new THREE.Color();
function fireReset(p) { p.max = .55 + rnd() * .55; p.life = 0; p.z0 = fireZ + (rnd() - .5) * .62; p.x0 = RW / 2 - .24 - rnd() * .06; p.w = .7 + rnd() * .6; p.ph = rnd() * 9; }
fireP.forEach(p => { fireReset(p); p.life = rnd() * p.max; });

const hangStars = [];   // niente stelle appese: resta solo quella sull’albero

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
proxy(new THREE.BoxGeometry(1.2, .8, .8), NAT.x, NAT.rise + .4, NAT.z, "nat");
proxy(new THREE.BoxGeometry(.5, 1.0, 1.9), RW / 2 - .3, .55, fireZ, "fire");
proxy(new THREE.CircleGeometry(.8, 20), .3, 2.1, -RD / 2 + .42, "logo");

/* ---------- porta verso il presepe VR/AR (index.html) ---------- */
const NAT_NEAR = 2.4;                 // entro questa distanza (in metri) il clic sul presepe ti porta dentro
const natLbl = { cv: document.createElement("canvas"), key: "" };
natLbl.cv.width = 512; natLbl.cv.height = 160;
natLbl.tex = new THREE.CanvasTexture(natLbl.cv); natLbl.tex.colorSpace = THREE.SRGBColorSpace;
natLbl.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: natLbl.tex, transparent: true, toneMapped: false, depthWrite: false }));
natLbl.sp.scale.set(1.2, .375, 1); natLbl.sp.position.set(NAT.x, NAT.rise + .95, NAT.z); natLbl.sp.visible = false; scene.add(natLbl.sp);
function drawNatLabel(state) {
  const key = LANG + state; if (natLbl.key === key) return; natLbl.key = key;
  const g = natLbl.cv.getContext("2d"), w = 512, h = 160; g.clearRect(0, 0, w, h);
  g.fillStyle = "rgba(2,10,5,.85)"; g.fillRect(0, 0, w, h); g.strokeStyle = "#39ff88"; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = "center"; g.fillStyle = "#fff8ec"; g.font = "bold 42px Georgia, serif"; g.fillText("✦ " + tr("natTitle") + " ✦", w / 2, 70);
  g.fillStyle = state === "go" ? "#f2c14e" : "#9dffc4"; g.font = "28px Georgia, serif"; g.fillText(state === "go" ? tr("natGo") : tr("natNear"), w / 2, 120);
  natLbl.tex.needsUpdate = true;
}
let natMsgUntil = 0, natGoing = false;
function natDist() { camera.getWorldPosition(tmpV); return Math.hypot(tmpV.x - NAT.x, tmpV.z - NAT.z); }
async function goNat() {
  if (natGoing) return; natGoing = true;
  const toIndex = () => { location.href = "index.html?from=sala"; };                     // piano B: apre la pagina e basta premere il pulsante
  const xs = renderer.xr.getSession();
  if (!xs || !navigator.xr) return toIndex();
  try {
    const html = await (await fetch("index.html")).text();                              // scarica la pagina del presepe mentre sei ancora nel VR
    await xs.end();
    window.__preSession = await navigator.xr.requestSession("immersive-ar", { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "light-estimation"] });   // la sessione AR parte subito dal tocco sul presepe
    renderer.setAnimationLoop(null); try { renderer.forceContextLoss(); } catch (_) {}
    document.open(); document.write(html); document.close();                           // stessa finestra: la sessione AR resta viva e il presepe la prende da solo
  } catch (e) { console.warn(e); window.__preSession = null; toIndex(); }
}

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
  else if (name === "nat") {
    if (natDist() > NAT_NEAR) { natMsgUntil = performance.now() + 2500; [76, 79].forEach((n, i) => bell(n, i * .12, .1)); }
    else { [84, 88, 91, 96].forEach((n, i) => bell(n, i * .14, .12)); fx.starFlash = 1; burst(new THREE.Vector3(NAT.x, NAT.rise + .4, NAT.z), 0xfff1b8, 60); setTimeout(goNat, 900); }
  }
  else if (name === "fire") { fx.fire = 1; for (let i = 0; i < 6; i++) setTimeout(() => crackle(2.2), i * 70); burst(new THREE.Vector3(RW / 2 - .35, .6, fireZ), 0xff9a3a, 50); }
  else if (name === "logo") { fx.logoSpin = 1; [67, 71, 74, 79].forEach((n, i) => bell(n, i * .1)); burst(new THREE.Vector3(.3, 2.1, -RD / 2 + .5), 0xf2c14e, 70); }
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
  [TABLE.x - TABLE.w / 2 - .12, TABLE.x + TABLE.w / 2 + .12, TABLE.z - .55, TABLE.z + .55], [TREE.x - 1.05, TREE.x + 1.05, TREE.z - 1.05, TREE.z + 1.05],
  [NAT.x - .62, NAT.x + .62, NAT.z - .42, NAT.z + .46], [2.85, 4, -2.5, -.1]
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
    let y = snowPos[i * 3 + 1] - snowSpd[i] * dt; if (y < 0) { y += 5; snowPos[i * 3] = -5 + rnd() * 10; }
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
  const boost = 1 + fx.fire * 1.2;
  for (const p of fireP) {
    p.life += dt * boost; if (p.life >= p.max) fireReset(p);
    const u = p.life / p.max, k = u < .33 ? u / .33 : u < .66 ? (u - .33) / .33 : (u - .66) / .34, a = u < .33 ? 0 : u < .66 ? 1 : 2;
    fcTmp.copy(FC[a]).lerp(FC[a + 1], k); p.s.material.color.copy(fcTmp); p.s.material.opacity = Math.min(1, u * 8) * Math.pow(1 - u, 1.3) * .85;
    const sz = .34 * (1 - u * .65) * p.w * Math.pow(boost, .3); p.s.scale.set(sz * .8, sz * 1.4, 1); p.s.visible = true;
    p.s.position.set(p.x0, .2 + u * .62 * Math.sqrt(boost), fireZ + (p.z0 - fireZ) * (1 - u * .6) + Math.sin(t * 5 + p.ph) * .04 * u);
  }
  if (coalMat) coalMat.color.setScalar(.75 + .25 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1));
  emberT += dt; if (emberT > .12) { emberT = 0; const i = bi++ % NB; bpos.set([RW / 2 - .3, .45, fireZ + (rnd() - .5) * .5], i * 3); bvel.set([-.1 - rnd() * .15, .9 + rnd() * .6, (rnd() - .5) * .4], i * 3); bcol.set([1, .5, .12], i * 3); blife[i] = .8 + rnd() * .6; }
  rains.forEach(r => { r.t.offset.y += r.spd * dt; });
  gridPl.material.opacity = .5 + .1 * Math.sin(t * 1.3);
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
  { const d = natDist(), show = d < 3.4 || performance.now() < natMsgUntil; natLbl.sp.visible = show; if (show) { drawNatLabel(d <= NAT_NEAR ? "go" : "near"); natLbl.sp.position.y = NAT.rise + .95 + Math.sin(t * 2) * .03; } }
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
  renderer.setClearColor(0x000503, 1); Object.assign(D, { x: 0, z: 1.9, yaw: 0, pitch: -.04 });
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
