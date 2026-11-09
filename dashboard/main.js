// Bugger dashboard: 3D model of the room plus the live distance ring.
// Units are feet. Room coords (x, y, z) map to three.js as (x, z, y), so y is "up" in three.js.

import * as THREE from 'three';
import { OrbitControls } from 'three';

const room = await (await fetch('../room/room.json')).json();
const L = room.room.length_x, W = room.room.width_y, H = room.room.ceiling_z;
const RX = room.receiver;
const CAL = room.calibration;
const PHONE_Z = room.phone_z;
const DZ = RX.z - PHONE_Z;                       // height gap between bugger and phone
const SIGMA_DB = 2.7;                            // fit error from calibration
const BAND = Math.pow(10, SIGMA_DB / (10 * CAL.n)); // one-sigma distance factor
const M_TO_FT = 3.28084;

const v3 = (x, y, z) => new THREE.Vector3(x, z, y);
const ZONES = [
  { name: 'Desk', max: 3.3, color: 0x3fb950, css: 'var(--desk)' },
  { name: 'Mid',  max: 8.2, color: 0x4c8dff, css: 'var(--mid)'  },
  { name: 'Far',  max: 1e9, color: 0xb26bff, css: 'var(--far)'  },
];
const zoneFor = (ft) => ZONES.find(z => ft < z.max);
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());

// ---------- renderer, camera ----------

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
document.getElementById('scene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
camera.position.set(L * 0.5 + 7, 17, W + 13);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(L / 2, 1.2, W / 2 - 0.5);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 6;
controls.maxDistance = 45;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- lights ----------

scene.add(new THREE.HemisphereLight(0xe4ecff, 0x3b2a1d, 1.1));
const sun = new THREE.DirectionalLight(0xffeccc, 2.6);
sun.position.copy(v3(1, -16, 15));
sun.target.position.copy(v3(4, 4, 0));
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const warm = new THREE.PointLight(0xffc68a, 22, 26, 1.5);
warm.position.copy(v3(L / 2, W / 2, H - 0.8));
scene.add(warm);

// ---------- textures ----------

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const woodTex = canvasTex(512, 512, (g, w, h) => {
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const shade = 95 + rand() * 30;
    g.fillStyle = `rgb(${shade + 22},${shade * 0.62},${shade * 0.38})`;
    g.fillRect(0, i * h / rows, w, h / rows);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, i * h / rows, w, 2);
    const cut = rand() * w;
    g.fillRect(cut, i * h / rows, 2, h / rows);
    for (let k = 0; k < 14; k++) {
      g.fillStyle = `rgba(40,20,10,${0.05 + rand() * 0.08})`;
      g.fillRect(0, i * h / rows + rand() * h / rows, w, 1);
    }
  }
}, [3, 3]);

const plaidTex = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#1b2440'; g.fillRect(0, 0, w, w);
  const bands = [[0, 46, '#121a30'], [70, 10, '#d9922e'], [100, 6, '#e8e4dc'], [150, 30, '#2c3a63'], [200, 10, '#d9922e']];
  g.globalAlpha = 0.75;
  for (const [o, s, c] of bands) { g.fillStyle = c; g.fillRect(o, 0, s, w); g.fillRect(0, o, w, s); }
}, [2, 2]);

const rugTex = canvasTex(1024, 800, (g, w, h) => {
  g.fillStyle = '#6b1a1c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d8c39a'; g.lineWidth = 46; g.strokeRect(40, 40, w - 80, h - 80);
  g.strokeStyle = '#8a2a24'; g.lineWidth = 10; g.strokeRect(40, 40, w - 80, h - 80);
  g.strokeStyle = '#3a0f12'; g.lineWidth = 8; g.strokeRect(90, 90, w - 180, h - 180);
  for (let i = 0; i < 260; i++) {
    const x = 110 + rand() * (w - 220), y = 110 + rand() * (h - 220), r = 6 + rand() * 16;
    g.fillStyle = rand() > 0.5 ? 'rgba(200,170,120,0.45)' : 'rgba(30,10,10,0.5)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.5, rand() * 3, 0, 7); g.fill();
  }
});

// ---------- materials ----------

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const MAT = {
  wall: std(0xe9dcc0, { roughness: 0.95 }),
  wood: std(0x9a5a30, { roughness: 0.6 }),
  trim: std(0xf4f1ea, { roughness: 0.5 }),
  floor: std(0xffffff, { map: woodTex, roughness: 0.55 }),
  rug: std(0xffffff, { map: rugTex, roughness: 1 }),
  frameDark: std(0x2b2420, { roughness: 0.6 }),
  bronze: std(0x3d3029, { roughness: 0.45, metalness: 0.6 }),
  sheetBlue: std(0xa9c1e2),
  green: std(0x6f7d5c, { roughness: 1 }),
  pillow: std(0xb9b8c9),
  white: std(0xf2f2f2),
  plaid: std(0xffffff, { map: plaidTex, roughness: 1 }),
  nightstand: std(0x2e2622, { roughness: 0.5 }),
  deskWood: std(0x7b4526, { roughness: 0.55 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x1d262d, roughness: 0.05, transmission: 0.4, transparent: true, opacity: 0.85 }),
  laptop: std(0x1c1f24, { roughness: 0.35, metalness: 0.4 }),
  screen: std(0x0, { emissive: 0xdfe9ff, emissiveIntensity: 0.9 }),
  leather: std(0x16181b, { roughness: 0.35 }),
  bikeRed: std(0x6b1622, { roughness: 0.3, metalness: 0.5 }),
  tire: std(0x111111, { roughness: 0.9 }),
  spoke: std(0x9aa0a6, { metalness: 0.9, roughness: 0.3 }),
  windowGlass: new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.25 }),
  mirror: std(0xb8c8d6, { metalness: 0.25, roughness: 0.12, emissive: 0x2a3440 }),
  plant: std(0x3f7a3a, { roughness: 0.9 }),
  pot: std(0xd8d4cc),
  hall: std(0x2a2522, { roughness: 1 }),
  bin: new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, roughness: 0.3, transparent: true, opacity: 0.45 }),
};

// ---------- helpers ----------

function box(x0, x1, y0, y1, z0, z1, mat, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
  m.position.copy(v3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function tube(a, b, r, mat, parent = scene) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}
function ball(p, r, mat, parent = scene) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  m.position.copy(p); m.castShadow = true; parent.add(m); return m;
}
function plant(x, y, z, s = 1) {
  box(x - 0.25 * s, x + 0.25 * s, y - 0.25 * s, y + 0.25 * s, z, z + 0.45 * s, MAT.pot);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, tip = v3(x + Math.cos(a) * 0.7 * s, y + Math.sin(a) * 0.7 * s, z + (0.9 + rand() * 0.6) * s);
    tube(v3(x, y, z + 0.45 * s), tip, 0.025 * s, MAT.plant);
  }
}

// ---------- floor, rug, hall ----------

const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), MAT.floor);
floor.rotation.x = -Math.PI / 2;
floor.position.set(L / 2, 0, W / 2);
floor.receiveShadow = true;
scene.add(floor);


// ---------- walls with cutaway ----------

const T = 0.35;
const walls = [
  { key: 'y=0',    along: 'x', len: L, n: new THREE.Vector3(0, 0, -1), c: v3(L / 2, 0, H / 2) },
  { key: `y=${W}`, along: 'x', len: L, n: new THREE.Vector3(0, 0, 1),  c: v3(L / 2, W, H / 2) },
  { key: 'x=0',    along: 'y', len: W, n: new THREE.Vector3(-1, 0, 0), c: v3(0, W / 2, H / 2) },
  { key: `x=${L}`, along: 'y', len: W, n: new THREE.Vector3(1, 0, 0),  c: v3(L, W / 2, H / 2) },
];

// Box on a wall: s along the wall, d = depth into the room from the wall face (negative = inside wall)
function onWall(w, s0, s1, z0, z1, d0, d1, mat) {
  if (w.along === 'x') {
    const y0 = w.key === 'y=0' ? d0 : W - d1, y1 = w.key === 'y=0' ? d1 : W - d0;
    return box(s0, s1, y0, y1, z0, z1, mat, w.group);
  }
  const x0 = w.key === 'x=0' ? d0 : L - d1, x1 = w.key === 'x=0' ? d1 : L - d0;
  return box(x0, x1, s0, s1, z0, z1, mat, w.group);
}

for (const w of walls) {
  w.group = new THREE.Group();
  scene.add(w.group);
  const ops = room.openings.filter(o => o.wall === w.key);
  const holes = ops.filter(o => o.type === 'window' || o.type === 'doorway').sort((a, b) => a.from - b.from);
  let s = 0;
  const solid = (a, b, z0, z1, wainscot) => {
    if (b - a < 0.01 || z1 - z0 < 0.01) return;
    onWall(w, a, b, z0, z1, -T, 0, MAT.wall);
    if (wainscot && z0 === 0) {
      onWall(w, a, b, 0, Math.min(2.9, z1), 0, 0.04, MAT.wood);
      onWall(w, a, b, 2.9, 3.0, 0, 0.07, MAT.trim);
    }
  };
  for (const h of holes) {
    solid(s, h.from, 0, H, true);
    solid(h.from, h.to, 0, h.z[0], true);
    solid(h.from, h.to, h.z[1], H, false);
    s = h.to;
  }
  solid(s, w.len, 0, H, true);
  onWall(w, 0, w.len, H - 0.25, H, 0, 0.18, MAT.trim); // crown molding
}

// wood soffit on the window and closet walls, with downlights
for (const w of [walls[0], walls[3]]) {
  onWall(w, 0, w.len, 7.6, H, 0, 0.9, MAT.wood);
  for (let s = 1.6; s < w.len; s += 3.2) {
    const p = w.along === 'x' ? v3(s, 0.45, 7.58) : v3(L - 0.45, s, 7.58);
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), std(0x0, { emissive: 0xffe2b0, emissiveIntensity: 2 }));
    light.rotation.x = Math.PI / 2; light.position.copy(p); w.group.add(light);
  }
}

// openings: window, doors
for (const o of room.openings) {
  const w = walls.find(x => x.key === o.wall);
  const [a, b] = [o.from, o.to], [z0, z1] = o.z;
  if (o.type === 'window') {
    onWall(w, a, b, z0, z1, -T * 0.5, -T * 0.5 + 0.03, MAT.windowGlass);
    for (const s of [a, (2 * a + b) / 3, (a + 2 * b) / 3, b - 0.15]) onWall(w, s, s + 0.15, z0, z1, -0.1, 0.05, MAT.trim);
    onWall(w, a, b, z0 - 0.15, z0, -0.1, 0.35, MAT.trim);           // sill
    onWall(w, a, b, (z0 + z1) / 2 - 0.06, (z0 + z1) / 2 + 0.06, -0.1, 0.05, MAT.trim);
    onWall(w, a - 0.3, b + 0.3, z1, z1 + 0.35, 0, 0.12, MAT.trim);  // header casing
    onWall(w, a, b, z1 - 0.3, z1, 0.05, 0.25, std(0x2b2f36));        // roller blind
    onWall(w, a - 1, b + 1, z0 - 1, z1 + 1, -T - 1.2, -T - 1.15, new THREE.MeshBasicMaterial({ color: 0xcfe6f7 })); // daylight
    onWall(w, a - 1, b + 1, z0 - 1, z0 + 0.6, -T - 1.1, -T - 1.0, new THREE.MeshBasicMaterial({ color: 0x5f8a4a })); // hedge outside
    continue;
  }
  // casing
  onWall(w, a - 0.3, a, 0, z1 + 0.3, 0, 0.08, MAT.trim);
  onWall(w, b, b + 0.3, 0, z1 + 0.3, 0, 0.08, MAT.trim);
  onWall(w, a, b, z1, z1 + 0.3, 0, 0.08, MAT.trim);
  if (o.type === 'door' || o.type === 'door_double') {
    const leaves = o.type === 'door_double' ? [[a, (a + b) / 2], [(a + b) / 2, b]] : [[a, b]];
    for (const [s0, s1] of leaves) {
      onWall(w, s0 + 0.02, s1 - 0.02, 0, z1, 0, 0.12, MAT.trim);
      onWall(w, s0 + 0.25, s1 - 0.25, 0.4, z1 / 2 - 0.2, 0.12, 0.15, std(0xe7e4dc));
      onWall(w, s0 + 0.25, s1 - 0.25, z1 / 2 + 0.2, z1 - 0.4, 0.12, 0.15, std(0xe7e4dc));
      const knobS = o.type === 'door_double' ? (s0 < (a + b) / 2 ? s1 - 0.25 : s0 + 0.25) : s1 - 0.3;
      onWall(w, knobS - 0.07, knobS + 0.07, 3.1, 3.3, 0.12, 0.3, MAT.bronze);
    }
    if (o.name.toLowerCase().includes('mirror')) onWall(w, a + 0.5, b - 0.5, 1.0, 6.0, 0.15, 0.18, MAT.mirror);
  }
  if (o.type === 'doorway') {
    // open door leaf swung flat against the corner wall, plus a dark hallway beyond
    box(L - 2.1, L - 0.05, b - 0.12, b, 0, z1, MAT.trim, w.group);
    const hall = new THREE.Mesh(new THREE.PlaneGeometry(4, b - a), MAT.hall);
    hall.rotation.x = -Math.PI / 2; hall.position.set(L + T + 2, 0.01, (a + b) / 2);
    w.group.add(hall);
  }
}

// ---------- furniture ----------

const builders = {
  rug(f) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.x[1] - f.x[0], f.y[1] - f.y[0]), MAT.rug);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(v3((f.x[0] + f.x[1]) / 2, (f.y[0] + f.y[1]) / 2, 0.02));
    m.receiveShadow = true;
    scene.add(m);
  },
  bed_green(f) {
    const [x0, x1] = f.x, [y0, y1] = f.y;
    box(x0, x1, y0, y1, 0.15, 0.95, MAT.frameDark);
    box(x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, 0.95, 1.6, MAT.white);
    box(x0 + 0.95, x1 + 0.06, y0 - 0.02, y1 + 0.12, 1.1, 1.95, MAT.green);  // comforter
    box(x0 + 1.6, x1 - 0.6, y0 + 0.3, y1 - 0.3, 1.95, 2.05, MAT.green);     // folds on top
    box(x0 + 0.1, x0 + 0.95, y0 + 0.15, (y0 + y1) / 2 - 0.05, 1.6, 2.05, MAT.pillow);
    box(x0 + 0.1, x0 + 0.95, (y0 + y1) / 2 + 0.05, y1 - 0.15, 1.6, 2.05, MAT.pillow);
    box(x1 - 2.6, x1 - 1.0, y1 - 1.2, y1 - 0.2, 2.0, 2.15, std(0x3c4f78));   // jeans on the bed
  },
  bed_plaid(f) {
    const [x0, x1] = f.x, [y0, y1] = f.y;
    const posts = [[x0, y0 + 0.1, 3.4], [x0, y1 - 0.1, 3.4], [x1, y0 + 0.1, 2.7], [x1, y1 - 0.1, 2.7]];
    for (const [x, y, h] of posts) { tube(v3(x, y, 0), v3(x, y, h), 0.08, MAT.bronze); ball(v3(x, y, h + 0.1), 0.13, MAT.bronze); }
    for (const [x, h] of [[x0, 3.1], [x1, 2.4]]) {
      for (const z of [1.2, h]) tube(v3(x, y0 + 0.1, z), v3(x, y1 - 0.1, z), 0.045, MAT.bronze);
      for (let y = y0 + 0.5; y < y1 - 0.3; y += 0.35) tube(v3(x, y, 1.2), v3(x, y, h), 0.025, MAT.bronze);
    }
    for (const y of [y0 + 0.1, y1 - 0.1]) tube(v3(x0, y, 1.1), v3(x1, y, 1.1), 0.05, MAT.bronze);
    box(x0 + 0.1, x1 - 0.1, y0 + 0.15, y1 - 0.15, 1.15, 1.7, MAT.sheetBlue);
    box(x0 + 1.4, x1 - 0.05, y0 + 0.05, y1 - 0.05, 1.45, 1.95, MAT.plaid);
    box(x0 + 0.15, x0 + 1.1, y0 + 0.4, y1 - 0.4, 1.7, 2.05, MAT.white);
    box(x0 + 1.5, x1 - 1.2, y0 + 0.4, y1 - 0.3, 0.05, 0.95, MAT.bin);       // storage bin
  },
  nightstand(f) {
    const [x0, x1] = f.x, [y0, y1] = f.y;
    box(x0, x1, y0, y1, 0, 2.0, MAT.nightstand);
    box(x0 + 0.05, x1 - 0.05, y0 - 0.01, y1 + 0.01, 1.3, 1.34, std(0x15110f));
    if (x1 - x0 < 1.2) {  // the small one by your bed: lamp and plant
      box(x0 + 0.2, x0 + 0.65, y0 + 0.2, y0 + 0.6, 2.0, 2.5, std(0xffffff, { emissive: 0xfff1d0, emissiveIntensity: 0.6 }));
      plant((x0 + x1) / 2, y1 - 0.3, 2.0, 0.35);
    } else {
      box(x0 + 0.4, x0 + 1.3, y0 + 0.4, y0 + 1.0, 2.0, 2.15, std(0x0d0d0d)); // clock
    }
  },
  desk(f) {
    const [x0, x1] = f.x, [y0, y1] = f.y;
    box(x0, x1, y0, y1, 2.92, 3.0, MAT.glass);
    for (const x of [x0 + 0.15, x1 - 0.15]) {  // crossed legs at each end
      tube(v3(x, y0 + 0.1, 0), v3(x, y1 - 0.1, 2.92), 0.07, MAT.deskWood);
      tube(v3(x, y1 - 0.1, 0), v3(x, y0 + 0.1, 2.92), 0.07, MAT.deskWood);
    }
    tube(v3(x0 + 0.15, y1 - 0.1, 2.85), v3(x1 - 0.15, y1 - 0.1, 2.85), 0.05, MAT.deskWood);
    box(x0 - 1.0, x0, y0 + 0.2, y0 + 1.4, 3.2, 3.28, MAT.deskWood);              // side shelf by the window
    tube(v3(x0 - 0.9, y0 + 0.8, 0), v3(x0 - 0.9, y0 + 0.8, 3.2), 0.06, MAT.deskWood);
    plant(x0 - 0.5, y0 + 0.8, 3.28, 0.6);
    // laptop
    const lx = (x0 + x1) / 2 - 0.4, ly = y0 + 0.9;
    box(lx - 0.6, lx + 0.6, ly - 0.4, ly + 0.4, 3.0, 3.05, MAT.laptop);
    const lid = new THREE.Group();
    lid.position.copy(v3(lx, ly - 0.4, 3.05));
    lid.rotation.x = -0.25;
    scene.add(lid);
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.04), MAT.laptop);
    lidM.position.set(0, 0.4, 0); lid.add(lidM);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.68), MAT.screen);
    scr.position.set(0, 0.4, 0.025); lid.add(scr);
    box(lx + 0.9, lx + 1.8, ly - 0.3, ly + 0.5, 3.0, 3.03, MAT.white);           // notebook
  },
  chair(f) {
    const [x0, x1] = f.x, [y0, y1] = f.y;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) box(x - 0.06, x + 0.06, y - 0.06, y + 0.06, 0, 1.55, MAT.deskWood);
    box(x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, 1.55, 1.75, MAT.leather);
    box(x0 - 0.05, x1 + 0.05, y1 - 0.08, y1 + 0.05, 1.75, 3.2, MAT.deskWood);
    box(x0 + 0.1, x1 - 0.1, y1 - 0.12, y1 - 0.06, 2.1, 3.1, MAT.leather);
  },
  bike(f) {
    // hung by the front wheel, wheels parallel to the closet wall
    const xp = (f.x[0] + f.x[1]) / 2 + 0.3;
    const P = (y, z) => v3(xp, y, z);
    const R = [1.95, 1.2], F = [1.35, 5.05];
    const eu = [F[0] - R[0], F[1] - R[1]], len = Math.hypot(...eu);
    eu[0] /= len; eu[1] /= len;
    const ev = [eu[1], -eu[0]];  // perpendicular, toward the room's open side
    const at = (u, v) => P(R[0] + eu[0] * u + ev[0] * v, R[1] + eu[1] * u + ev[1] * v);
    const rear = at(0, 0), front = at(len, 0), bb = at(1.45, -0.25), seat = at(1.0, 1.7), headTop = at(3.1, 1.55), headBot = at(3.25, 1.1);
    for (const c of [rear, front]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.11, 12, 48), MAT.tire);
      tire.position.copy(c); tire.rotation.y = Math.PI / 2; tire.castShadow = true; scene.add(tire);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        tube(c, c.clone().add(new THREE.Vector3(0, Math.sin(a) * 1.05, Math.cos(a) * 1.05)), 0.008, MAT.spoke);
      }
      ball(c, 0.09, MAT.spoke);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 24), MAT.spoke);
      rotor.position.copy(c).add(new THREE.Vector3(-0.12, 0, 0)); rotor.rotation.z = Math.PI / 2; scene.add(rotor);
    }
    for (const [a, b, r] of [[bb, headBot, 0.09], [seat, headTop, 0.07], [bb, seat, 0.08], [rear, bb, 0.05], [rear, seat, 0.045], [headBot, front, 0.06], [headBot, headTop, 0.09]]) tube(a, b, r, MAT.bikeRed);
    const saddle = ball(seat.clone().add(new THREE.Vector3(0, 0.1, 0)), 0.22, MAT.leather); saddle.scale.set(0.6, 0.35, 1.4);
    tube(headTop.clone().add(new THREE.Vector3(-1.2, 0, 0)), headTop.clone().add(new THREE.Vector3(0.3, 0, 0)), 0.05, MAT.leather);
    box(xp - 0.25, xp + 0.25, 3.0, 3.7, 3.6, 4.2, MAT.leather);                // frame bag
  },
};
for (const f of room.furniture) builders[f.type]?.(f);

// a few wall details from the photos
box(L - 4.4, L - 3.0, -0.0, 0.25, 5.4, 5.5, MAT.trim, walls[0].group);  // display shelf
box(1.0, 2.4, W - 0.06, W, 4.2, 6.9, std(0xd8d0bc), walls[1].group);   // posters
box(2.7, 4.0, W - 0.06, W, 4.2, 6.6, std(0x30293a), walls[1].group);
box(-0.06, 0.02, 4.2, 5.6, 4.0, 6.5, std(0x6b4a2a, { emissive: 0x7a4a1a, emissiveIntensity: 0.5 }), walls[2].group); // stained glass inset

// ---------- the bugger ----------

const bugPos = v3(RX.x, RX.y + 0.06, RX.z);
const bug = new THREE.Group();
bug.position.copy(bugPos);
scene.add(bug);
const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.05), std(0x101114, { roughness: 0.4 }));
pcb.castShadow = true; bug.add(pcb);
const chip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.03), std(0xb8bcc2, { metalness: 0.8, roughness: 0.3 }));
chip.position.set(-0.1, 0.03, 0.035); bug.add(chip);
const ledMat = std(0x0, { emissive: ZONES[0].color, emissiveIntensity: 3 });
const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), ledMat);
led.position.set(0.08, -0.04, 0.04); bug.add(led);
const ledLight = new THREE.PointLight(ZONES[0].color, 1.5, 4, 2);
ledLight.position.set(0.08, -0.04, 0.3); bug.add(ledLight);
const ping = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 48), new THREE.MeshBasicMaterial({ color: ZONES[0].color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
ping.position.z = 0.05; bug.add(ping);

// ---------- distance ring ----------

const clip = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), L),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), W),
];
const ringGroup = new THREE.Group();
ringGroup.position.set(RX.x, 0, RX.y);
scene.add(ringGroup);
const fx = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: clip, blending: THREE.AdditiveBlending });
const bandMat = fx(ZONES[0].color, 0.22), lineMat = fx(ZONES[0].color, 0.95), curtainMat = fx(ZONES[0].color, 0.09);
const band = new THREE.Mesh(new THREE.RingGeometry(1 / BAND, BAND, 192), bandMat);
band.rotation.x = -Math.PI / 2; band.position.y = 0.06; ringGroup.add(band);
let line = null;
const curtain = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4.8, 192, 1, true), curtainMat);
curtain.position.y = 2.4; ringGroup.add(curtain);
ringGroup.visible = false;

function setRing(r) {
  band.scale.setScalar(r);
  curtain.scale.set(r, 1, r);
  if (line) { ringGroup.remove(line); line.geometry.dispose(); }
  line = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 192), lineMat);
  line.rotation.x = -Math.PI / 2; line.position.y = 0.08;
  ringGroup.add(line);
}

// ---------- you (best guess) and hotspots ----------

const you = new THREE.Group();
const youMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: ZONES[0].color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 3.4, 8, 16), youMat);
body.position.y = 2.3; body.castShadow = true; you.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), youMat);
head.position.y = 4.8; head.castShadow = true; you.add(head);
const halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40), fx(0xffffff, 0.6));
halo.rotation.x = -Math.PI / 2; halo.position.y = 0.1; you.add(halo);
you.visible = false;
scene.add(you);

const hotspotMarks = room.hotspots.map(h => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(v3(h.x, h.y, 0.07));
  scene.add(m);
  return { ...h, mesh: m, dh: Math.hypot(h.x - RX.x, h.y - RX.y) };
});

function likelySpot(r) {
  // Score each spot by how well its distance matches the ring, then by how often you're there.
  let best = null, bestScore = -1;
  for (const h of hotspotMarks) {
    const err = (h.dh - r) / (0.18 * r + 0.4);
    const score = h.weight * Math.exp(-0.5 * err * err);
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best;
}

// Point on the ring, inside the room, closest to a given spot
function ringPointNear(r, spot) {
  let best = null, bestD = Infinity;
  for (let i = 0; i <= 180; i++) {
    const a = (i / 180) * Math.PI;
    const x = RX.x + Math.cos(a) * r, y = RX.y + Math.sin(a) * r;
    if (x < 0.5 || x > L - 0.5 || y < 0.5 || y > W - 0.5) continue;
    const d = Math.hypot(x - spot.x, y - spot.y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  }
  return best || { x: Math.min(L - 0.6, Math.max(0.6, spot.x)), y: Math.min(W - 0.6, Math.max(0.6, spot.y)) };
}

// ---------- particle filter ----------
// 700 guesses spread over the floor. Each second: every guess takes a random step (you walk),
// then gets weighted by how well its distance explains the measured signal. Guesses that keep
// matching survive; the rest get resampled. Because guesses move only a step at a time, the
// filter remembers which side of the room you came from, which a single distance reading cannot.

const N = 700;
// Indoors, things get between you and the receiver (your body, a bed frame) and make the signal weaker,
// almost never stronger. So the likelihood is lopsided: a reading weaker than expected is forgiven more.
const SIG_WEAK = 6.0, SIG_STRONG = 3.0; // dB
const MAX_SPEED = 4.5;                  // ft/s, brisk walk across a small room
const blocked = room.furniture.filter(f => ['desk', 'nightstand', 'bike'].includes(f.type));
const free = (x, y) => x > 0.4 && x < L - 0.4 && y > 0.4 && y < W - 0.4 &&
  !blocked.some(f => x > f.x[0] - 0.25 && x < f.x[1] + 0.25 && y > f.y[0] - 0.25 && y < f.y[1] + 0.25);
function randomFree() { for (;;) { const x = Math.random() * L, y = Math.random() * W; if (free(x, y)) return [x, y]; } }
const pf = { x: new Float32Array(N), y: new Float32Array(N), w: new Float32Array(N), lastT: 0, est: null, health: 1, recent: [], moving: true };
for (let i = 0; i < N; i++) { [pf.x[i], pf.y[i]] = randomFree(); pf.w[i] = 1 / N; }

const expectedRssi = (x, y) => CAL.A_dbm - 10 * CAL.n * Math.log10(Math.max(Math.hypot(x - RX.x, y - RX.y, DZ) / M_TO_FT, 0.1));
const prior = (x, y) => 1 + room.hotspots.reduce((s, h) => s + 0.5 * h.weight * Math.exp(-((x - h.x) ** 2 + (y - h.y) ** 2) / 2.9), 0);
const GS = 0.5, GX = Math.ceil(L / GS), GY = Math.ceil(W / GS);
const grid = new Float32Array(GX * GY), gridS = new Float32Array(GX * GY);

function pfStep(rssi) {
  const now = performance.now() / 1000;
  const dt = Math.min(3, Math.max(0.3, pf.lastT ? now - pf.lastT : 1));
  pf.lastT = now;
  // predict: mostly small steps, sometimes a walk, never faster than MAX_SPEED
  let sum = 0, like = 0;
  const cap = MAX_SPEED * dt;
  // Steady signal means you're probably standing still: keep guesses nearly frozen so they
  // can't drift along the ring. A changing signal means you're walking: let them move.
  pf.recent.push(rssi); if (pf.recent.length > 4) pf.recent.shift();
  const mean = pf.recent.reduce((a, b) => a + b, 0) / pf.recent.length;
  pf.moving = pf.recent.length < 3 || Math.abs(rssi - mean) > 3 || Math.max(...pf.recent) - Math.min(...pf.recent) > 6;
  const [sSmall, sBig, pBig] = pf.moving ? [0.9, 2.4, 0.3] : [0.2, 0.8, 0.04];
  for (let i = 0; i < N; i++) {
    const s = (Math.random() < pBig ? sBig : sSmall) * Math.sqrt(dt);
    let dx = gauss() * s, dy = gauss() * s;
    const m = Math.hypot(dx, dy);
    if (m > cap) { dx *= cap / m; dy *= cap / m; }
    const nx = pf.x[i] + dx, ny = pf.y[i] + dy;
    if (free(nx, ny)) { pf.x[i] = nx; pf.y[i] = ny; }
    const diff = rssi - expectedRssi(pf.x[i], pf.y[i]);
    const e = diff / (diff < 0 ? SIG_WEAK : SIG_STRONG);
    const l = Math.exp(-0.5 * e * e) + 1e-12;
    like += l;
    pf.w[i] *= l;
    sum += pf.w[i];
  }
  pf.health = like / N; // average fit; near zero means every guess is wrong
  let sq = 0;
  for (let i = 0; i < N; i++) { pf.w[i] /= sum; sq += pf.w[i] * pf.w[i]; }
  // resample when the weight piles onto a few guesses (systematic resampling)
  if (1 / sq < N / 2) {
    const nx = new Float32Array(N), ny = new Float32Array(N);
    let c = pf.w[0], j = 0; const u0 = Math.random() / N;
    for (let i = 0; i < N; i++) {
      const u = u0 + i / N;
      while (u > c && j < N - 1) c += pf.w[++j];
      nx[i] = pf.x[j]; ny[i] = pf.y[j];
    }
    pf.x.set(nx); pf.y.set(ny); pf.w.fill(1 / N);
    // Only scatter fresh guesses when nothing fits (phone just reappeared, page just opened).
    // Doing it every step lets the filter teleport to the far side of the room.
    if (pf.health < 0.01) for (let i = 0; i < N * 0.05; i++) { const k = Math.floor(Math.random() * N); [pf.x[k], pf.y[k]] = randomFree(); }
  }
  pf.est = pfEstimate();
  updateParticles();
}

// Densest spot, not the average: if guesses split between two corners, the average would sit in the middle of the room.
function pfEstimate() {
  grid.fill(0);
  for (let i = 0; i < N; i++) {
    const gx = Math.min(GX - 1, Math.floor(pf.x[i] / GS)), gy = Math.min(GY - 1, Math.floor(pf.y[i] / GS));
    grid[gy * GX + gx] += pf.w[i];
  }
  let best = 0, bi = 0;
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    let v = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = gx + dx, Y = gy + dy;
      if (X >= 0 && Y >= 0 && X < GX && Y < GY) v += grid[Y * GX + X];
    }
    v *= prior((gx + 0.5) * GS, (gy + 0.5) * GS) ** 0.25;
    gridS[gy * GX + gx] = v;
    if (v > best) { best = v; bi = gy * GX + gx; }
  }
  const cx = (bi % GX + 0.5) * GS, cy = (Math.floor(bi / GX) + 0.5) * GS;
  let mx = 0, my = 0, m = 0;
  for (let i = 0; i < N; i++) if (Math.hypot(pf.x[i] - cx, pf.y[i] - cy) < 1.8) { mx += pf.x[i] * pf.w[i]; my += pf.y[i] * pf.w[i]; m += pf.w[i]; }
  return m > 0 ? { x: mx / m, y: my / m, conf: m } : { x: cx, y: cy, conf: 0 };
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
const pMat = new THREE.PointsMaterial({ color: ZONES[0].color, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false });
const points = new THREE.Points(pGeo, pMat);
points.visible = false;
scene.add(points);
function updateParticles() {
  const a = pGeo.attributes.position.array;
  for (let i = 0; i < N; i++) { a[i * 3] = pf.x[i]; a[i * 3 + 1] = 0.12 + Math.min(0.6, pf.w[i] * N * 0.05); a[i * 3 + 2] = pf.y[i]; }
  pGeo.attributes.position.needsUpdate = true;
  points.visible = true;
}

// Window wall is north, closet wall is east.
function areaName(x, y) {
  const near = hotspotMarks.find(h => Math.hypot(h.x - x, h.y - y) < 2.0);
  if (near) return near.name;
  const ns = y < W / 3 ? 'N' : y > 2 * W / 3 ? 'S' : '', ew = x < L / 3 ? 'W' : x > 2 * L / 3 ? 'E' : '';
  if (ns && ew) return `${ns}${ew} corner`;
  return { N: 'North side', S: 'South side', E: 'East side', W: 'West side' }[ns || ew] || 'Middle';
}

// ---------- labels ----------

function label(text) { const d = document.createElement('div'); d.className = 'label'; d.textContent = text; document.body.appendChild(d); return d; }
const bugLabel = label('Bugger'), youLabel = label('You');
const tmp = new THREE.Vector3();
function place(el, p) {
  tmp.copy(p).project(camera);
  const vis = tmp.z < 1;
  el.style.display = vis ? 'block' : 'none';
  el.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`;
  el.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
}

// ---------- data: live SSE or demo ----------

const ui = {
  dot: document.getElementById('dot'), status: document.getElementById('status'),
  rssi: document.getElementById('rssi'), dist: document.getElementById('dist'),
  zone: document.getElementById('zone'), spot: document.getElementById('spot'),
  host: document.getElementById('host'), spark: document.getElementById('spark'),
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const params = new URLSearchParams(location.search);
ui.host.value = params.get('host') || store.get('bugger-host') || '172.20.10.4';

const data = { rssi: NaN, distFt: NaN, mode: 'connecting', last: 0, history: [] };
let es = null, simTimer = null, fallbackTimer = null;

function setStatus(mode, text) {
  data.mode = mode;
  ui.status.textContent = text;
  ui.dot.style.background = { live: 'var(--desk)', demo: 'var(--mid)', connecting: '#d29922', offline: 'var(--off)' }[mode];
  ui.dot.style.color = ui.dot.style.background;
}

function onReading(rssi, distM) {
  if (!Number.isFinite(distM) && Number.isFinite(rssi)) distM = Math.pow(10, (CAL.A_dbm - rssi) / (10 * CAL.n));
  if (Number.isFinite(rssi)) { data.rssi = rssi; data.history.push(rssi); if (data.history.length > 90) data.history.shift(); }
  if (Number.isFinite(distM)) data.distFt = distM * M_TO_FT;
  data.last = performance.now();
  const r = Number.isFinite(rssi) ? rssi : (Number.isFinite(distM) ? CAL.A_dbm - 10 * CAL.n * Math.log10(Math.max(distM, 0.1)) : NaN);
  if (Number.isFinite(r)) pfStep(r);
}

function connect(host) {
  stopSim();
  if (es) es.close();
  store.set('bugger-host', host);
  setStatus('connecting', `Connecting to ${host}…`);
  es = new EventSource(`http://${host}/events`);
  let pendingRssi = NaN;
  es.addEventListener('state', (e) => {
    let d; try { d = JSON.parse(e.data); } catch { return; }
    const id = String(d.id || d.name || '').toLowerCase();
    const val = typeof d.value === 'number' ? d.value : parseFloat(d.state);
    if (!id.includes('iphone')) return;
    if (data.mode !== 'live') setStatus('live', `Live · ${host}`);
    clearTimeout(fallbackTimer);
    if (id.includes('rssi')) { pendingRssi = val; onReading(val, NaN); }
    else if (id.includes('distance')) { data.distFt = val * M_TO_FT; }
  });
  es.onerror = () => { if (data.mode === 'live') setStatus('offline', `Lost ${host}, retrying…`); };
  clearTimeout(fallbackTimer);
  fallbackTimer = setTimeout(() => { if (data.mode !== 'live') startSim(`No data from ${host} · demo mode`); }, 7000);
}

// Demo: a simulated person walks between hotspots; the signal gets the same noise and filter as the real board.
const simTargets = [...room.hotspots, { name: 'SE corner', x: 12.9, y: 9.9 }, { name: 'SW corner', x: 1.0, y: 10.0 }];
const sim = { pos: { x: 9.2, y: 2.7 }, target: 0, dwell: 0, buf: [], fixed: null, extraLoss: 0 };
function simStep() {
  const t = sim.fixed || simTargets[sim.target];
  const dx = t.x - sim.pos.x, dy = t.y - sim.pos.y, d = Math.hypot(dx, dy);
  if (d < 0.2) { if (--sim.dwell <= 0) { sim.target = Math.floor(Math.random() * simTargets.length); sim.dwell = 6 + Math.floor(Math.random() * 6); } }
  else { const step = Math.min(d, 1.5); sim.pos.x += dx / d * step; sim.pos.y += dy / d * step; }
  const trueFt = Math.hypot(sim.pos.x - RX.x, sim.pos.y - RX.y, DZ);
  const raw = CAL.A_dbm - 10 * CAL.n * Math.log10(trueFt / M_TO_FT) + SIGMA_DB * gauss() - sim.extraLoss;
  sim.buf.push(raw); if (sim.buf.length > 5) sim.buf.shift();
  const med = [...sim.buf].sort((a, b) => a - b)[Math.floor(sim.buf.length / 2)];
  onReading(Math.round(med), NaN);
}
function startSim(text = 'Demo mode · simulated walk') {
  if (es) { es.close(); es = null; }
  clearTimeout(fallbackTimer);
  setStatus('demo', text);
  if (!simTimer) simTimer = setInterval(simStep, 1000);
}
function stopSim() { clearInterval(simTimer); simTimer = null; }

document.getElementById('go').onclick = () => connect(ui.host.value.trim());
document.getElementById('sim').onclick = () => startSim();
ui.host.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(ui.host.value.trim()); });
if (params.has('demo')) startSim(); else connect(ui.host.value.trim());

// ---------- sparkline ----------

function drawSpark(color) {
  const c = ui.spark, g = c.getContext('2d'), w = c.width = c.clientWidth * 2, h = c.height = c.clientHeight * 2;
  g.clearRect(0, 0, w, h);
  const hist = data.history;
  if (hist.length < 2) return;
  const lo = -85, hi = -35, y = (v) => h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (h - 8) - 4;
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
  for (const v of [-45, -60, -75]) { g.beginPath(); g.moveTo(0, y(v)); g.lineTo(w, y(v)); g.stroke(); }
  g.beginPath();
  hist.forEach((v, i) => { const x = (i / 89) * w; i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); });
  g.strokeStyle = color; g.lineWidth = 3; g.stroke();
  g.fillStyle = 'rgba(139,148,158,0.9)'; g.font = '18px system-ui';
  g.fillText('RSSI, last 90 s', 6, 20);
}

// ---------- frame loop ----------

let shownR = 0, lastUi = 0;
const youTarget = new THREE.Vector3(), camDir = new THREE.Vector3();
const color = new THREE.Color();

window.bugger = { scene, camera, controls, data, pf, sim }; // handy for debugging in the console

renderer.setAnimationLoop((tms) => {
  controls.update();

  // cutaway: hide walls between the camera and the room
  for (const w of walls) { camDir.subVectors(camera.position, w.c); w.group.visible = camDir.dot(w.n) <= 0; }

  const have = Number.isFinite(data.distFt);
  ringGroup.visible = you.visible = have;
  const z = have ? zoneFor(data.distFt) : null;
  if (have) {
    const r = Math.sqrt(Math.max(data.distFt * data.distFt - DZ * DZ, 0.05));
    shownR = shownR ? shownR + (r - shownR) * 0.08 : r;
    setRing(shownR);
    color.set(z.color);
    for (const m of [bandMat, lineMat, curtainMat]) m.color.lerp(color, 0.1);
    youMat.emissive.lerp(color, 0.1);
    ledMat.emissive.lerp(color, 0.1); ledLight.color.lerp(color, 0.1); ping.material.color.lerp(color, 0.1);

    const est = pf.est || ringPointNear(shownR, hotspotMarks[0]);
    const spotName = areaName(est.x, est.y);
    const px = est.x, py = est.y;
    youTarget.copy(v3(px, py, 0));
    if (!you.userData.placed) { you.position.copy(youTarget); you.userData.placed = true; }
    you.position.lerp(youTarget, 0.08);
    for (const h of hotspotMarks) h.mesh.material.opacity = h.name === spotName ? 0.55 : 0.15;
    pMat.color.lerp(color, 0.1);

    if (tms - lastUi > 250) {
      lastUi = tms;
      ui.rssi.textContent = Number.isFinite(data.rssi) ? Math.round(data.rssi) : '--';
      ui.dist.textContent = data.distFt.toFixed(1);
      ui.zone.textContent = z.name; ui.zone.style.color = z.css;
      ui.spot.textContent = spotName;
      youLabel.textContent = `You · ${spotName}`;
      drawSpark(getComputedStyle(document.documentElement).getPropertyValue(z.css.slice(4, -1)));
    }
  }

  const pulse = (tms / 1400) % 1;
  ping.scale.setScalar(1 + pulse * 2.2);
  ping.material.opacity = 0.8 * (1 - pulse);
  halo.scale.setScalar(1 + 0.15 * Math.sin(tms / 300));

  place(bugLabel, bugPos.clone().add(new THREE.Vector3(0, -0.45, 0.2)));
  if (have) place(youLabel, you.position.clone().add(new THREE.Vector3(0, 5.5, 0))); else youLabel.style.display = 'none';
  renderer.render(scene, camera);
});
