/**
 * Low-poly props for every place. Lambert materials only (cheap on Chromebook GPUs);
 * "neon" comes from emissive colour and thin edge lines, never from post-processing.
 */

import { THREE } from './renderer.js';
import { screenTexture, labelSprite } from './textures.js';
import { settings } from '../core/settings.js';

export const STYLES = {
  hub: { bg: 0x07040f, floorA: 0x2b2352, floorB: 0x221c44, line: 0xff3df0, wall: 0x261c4a, wallTop: 0x4b3a8f, accent: 0x00e5ff, sky: 0x6b5cff, ground: 0x1a0f2e, music: 'hub' },
  anglo: { bg: 0x120a03, floorA: 0x2e1d0a, floorB: 0x261808, line: 0xffb000, wall: 0x3d270e, wallTop: 0x6b4515, accent: 0xffb000, sky: 0xffc46b, ground: 0x2a1600, music: 'anglo' },
  latin: { bg: 0x0d0f13, floorA: 0x83868e, floorB: 0x71747c, line: 0xdfe8f5, wall: 0xa3a7af, wallTop: 0xc9cdd4, accent: 0x9fc6ff, sky: 0xdfe8ff, ground: 0x3a3d44, music: 'latin' },
  greek: { bg: 0x020615, floorA: 0x0c1a3c, floorB: 0x0a1532, line: 0x38b6ff, wall: 0x14244e, wallTop: 0x22407e, accent: 0x38b6ff, sky: 0x8fd8ff, ground: 0x050a1c, music: 'greek' },
  lingo: { bg: 0xc9d3de, floorA: 0xe3e7ec, floorB: 0xd7dce3, line: 0x2f6fde, wall: 0xf3f5f8, wallTop: 0xffffff, accent: 0x2f6fde, sky: 0xffffff, ground: 0x9aa4b2, music: 'lingo' },
  rot: { bg: 0x030704, floorA: 0x0f1a10, floorB: 0x0b140c, line: 0x7dff3a, wall: 0x1a2a17, wallTop: 0x2f4a26, accent: 0x7dff3a, sky: 0xa6ff7a, ground: 0x0a0f08, music: 'rot' },
  arcade: { bg: 0x05020c, floorA: 0x120a24, floorB: 0x0c061a, line: 0xff3df0, wall: 0x1d1240, wallTop: 0x3b1f7a, accent: 0x00e5ff, sky: 0xff7ae0, ground: 0x10051e, music: 'arcade' },
};

const mats = new Map();
export function mat(color, { emissive = 0x000000, ei = 1, map = null, transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
  const key = `${color}:${emissive}:${ei}:${map ? map.uuid : ''}:${transparent}:${opacity}:${side}`;
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei, map, transparent, opacity, side });
  mats.set(key, m);
  return m;
}
export const glowMat = (color, opacity = 1) => mat(color, { emissive: color, ei: 1, transparent: opacity < 1, opacity });

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  torus: new THREE.TorusGeometry(0.5, 0.05, 6, 32),
  plane: new THREE.PlaneGeometry(1, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 16),
};

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo.box, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}
export function cyl(r, h, material, x = 0, y = 0, z = 0, seg8 = false) {
  const m = new THREE.Mesh(seg8 ? geo.cyl8 : geo.cyl, material);
  m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y, z);
  return m;
}
export function sphere(r, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo.sphere, material);
  m.scale.setScalar(r * 2);
  m.position.set(x, y, z);
  return m;
}
export function ring(r, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo.torus, material);
  m.scale.setScalar(r * 2);
  m.position.set(x, y, z);
  return m;
}
export function screen(w, h, texture, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  m.scale.set(w, h, 1);
  m.position.set(x, y, z);
  return m;
}
export function edges(mesh, color, opacity = 0.9) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
  e.scale.copy(mesh.scale);
  e.position.copy(mesh.position);
  e.rotation.copy(mesh.rotation);
  return e;
}

const hex = (n) => `#${new THREE.Color(n).getHexString()}`;

// ── Interactables ─────────────────────────────────────────────────

export function terminal(style, title = 'TERMINAL') {
  const S = STYLES[style];
  const g = new THREE.Group();
  g.add(box(0.7, 0.75, 0.5, mat(S.wall), 0, 0.375, 0));
  const scr = screen(0.62, 0.42, screenTexture([title, '▶ USE'], { fg: hex(S.accent) }), 0, 0.98, 0.05);
  scr.rotation.x = -0.35;
  const frame = box(0.72, 0.5, 0.08, mat(S.wallTop), 0, 0.98, 0.0);
  frame.rotation.x = -0.35;
  g.add(frame, scr);
  g.add(edges(box(0.7, 0.75, 0.5, null, 0, 0.375, 0), S.accent, 0.8));
  return g;
}

// A vertical flame gradient (red at the floor, gold at the top), shared by every firewall gate.
let flameTex = null;
function flameTexture() {
  if (flameTex) return flameTex;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, '#ff1e00');
  grad.addColorStop(0.5, '#ff7a00');
  grad.addColorStop(1, '#ffe14a');
  x.fillStyle = grad;
  x.fillRect(0, 0, 4, 64);
  flameTex = new THREE.CanvasTexture(c);
  flameTex.colorSpace = THREE.SRGBColorSpace;
  return flameTex;
}

/**
 * A FIREWALL gate across the corridor: a full-height wall of glowing flame bars, a padlock and
 * a FIREWALL sign. It pulses gently while sealed; setOpen(true) sinks the bars into the floor.
 */
const GATE_H = 1.6;
export function gate(style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  const posts = [-0.45, 0.45].map((z) => box(0.14, GATE_H + 0.1, 0.14, mat(S.wallTop), 0, (GATE_H + 0.1) / 2, z));
  g.add(...posts, box(0.16, 0.05, 0.16, glowMat(0xff6a00), 0, GATE_H + 0.12, -0.45), box(0.16, 0.05, 0.16, glowMat(0xff6a00), 0, GATE_H + 0.12, 0.45));

  // Everything that drops into the floor lives in `bars`.
  const bars = new THREE.Group();
  const barrier = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  barrier.scale.set(0.8, GATE_H, 1);
  barrier.rotation.y = Math.PI / 2;
  barrier.position.y = GATE_H / 2;
  const barMat = new THREE.MeshBasicMaterial({ map: flameTexture(), toneMapped: false });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false });
  const tips = [];
  for (let i = 0; i < 7; i++) {
    const z = -0.33 + i * 0.11;
    bars.add(box(0.05, GATE_H - 0.05, 0.045, barMat, 0, (GATE_H - 0.05) / 2, z));
    const tip = new THREE.Mesh(geo.cone, flameMat);
    tip.scale.set(0.07, 0.16, 0.07);
    tip.position.set(0, GATE_H + 0.02, z);
    bars.add(tip);
    tips.push(tip);
  }
  [0.12, GATE_H * 0.5, GATE_H - 0.12].forEach((y) => bars.add(box(0.035, 0.035, 0.8, barMat, 0, y, 0)));

  // The padlock, centred on the bars and readable from either side.
  const lock = new THREE.Group();
  const gold = mat(0xffd23f, { emissive: 0x8a5a00, ei: 0.9 });
  lock.add(box(0.14, 0.2, 0.24, gold, 0, 0, 0), box(0.15, 0.06, 0.03, mat(0x1a0d00), 0, -0.02, 0));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 6, 16, Math.PI), mat(0xd9dde6, { emissive: 0x555a66 }));
  shackle.rotation.y = Math.PI / 2;
  shackle.position.y = 0.1;
  lock.add(shackle);
  lock.position.y = GATE_H * 0.62;
  bars.add(barrier, lock);
  g.add(bars);

  const sign = labelSprite('FIREWALL', { color: '#ffd23f', bg: 'rgba(40,6,0,0.92)', border: '#ff6a00', height: 0.3 });
  sign.position.y = GATE_H + 0.5;
  g.add(sign);

  // Animate from the posts' render hook (they are always drawn), so the gate needs no update call.
  let open = null;
  let dropStart = 0;
  const DROP_MS = 700;
  posts[0].onBeforeRender = () => {
    const now = performance.now();
    if (open) {
      if (!bars.visible) return;
      const k = Math.min(1, (now - dropStart) / DROP_MS);
      bars.position.y = -GATE_H * k * k;
      sign.material.opacity = 1 - k;
      if (k >= 1) { bars.visible = false; sign.visible = false; }
      return;
    }
    if (settings.reducedMotion) return;
    const t = now / 1000;
    const p = 0.5 + 0.5 * Math.sin(t * 2.2);
    barrier.material.opacity = 0.22 + p * 0.22;
    barMat.color.setScalar(0.8 + p * 0.2);
    tips.forEach((f, i) => { f.scale.y = 0.16 * (1 + Math.sin(t * 9 + i * 1.7) * 0.25); });
  };

  g.userData.barrier = barrier;
  g.userData.bars = bars;
  g.userData.setOpen = (next) => {
    next = !!next;
    if (next === open) return;
    const first = open === null;
    open = next;
    if (!open) {
      bars.position.y = 0;
      bars.visible = sign.visible = true;
      sign.material.opacity = 1;
      return;
    }
    // A gate that loads already open, or with reduced motion, is simply gone.
    if (first || settings.reducedMotion) { bars.visible = sign.visible = false; return; }
    dropStart = performance.now();
  };
  return g;
}

export function port(style, { color = null, label = null, locked = false, axis = 'x' } = {}) {
  const S = STYLES[style];
  const c = color ?? S.accent;
  const g = new THREE.Group();
  const frameMat = locked ? mat(0x333344) : glowMat(c);
  const arch = new THREE.Group();
  arch.add(box(0.12, 1.5, 0.12, frameMat, 0, 0.75, -0.48), box(0.12, 1.5, 0.12, frameMat, 0, 0.75, 0.48), box(0.12, 0.12, 1.08, frameMat, 0, 1.5, 0));
  if (axis === 'z') arch.rotation.y = Math.PI / 2;
  g.add(arch);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: locked ? 0x333344 : c, transparent: true, opacity: 0.55 }));
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 0.12;
  g.add(disk);
  if (label) {
    const s = labelSprite(label, { color: locked ? '#9aa' : hex(c), border: locked ? '#555' : hex(c), height: 0.36 });
    s.position.set(0, 2.0, 0);
    g.add(s);
  }
  g.userData.disk = disk;
  return g;
}

export function linkNode(style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  g.add(cyl(0.32, 0.25, mat(S.wall), 0, 0.125, 0));
  g.add(cyl(0.05, 0.9, glowMat(S.accent), 0, 0.65, 0));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const b = cyl(0.03, 0.5, glowMat(S.accent), Math.cos(a) * 0.18, 0.95, Math.sin(a) * 0.18);
    b.rotation.z = Math.cos(a) * 0.7;
    b.rotation.x = -Math.sin(a) * 0.7;
    g.add(b, sphere(0.08, glowMat(0x9dff7a), Math.cos(a) * 0.36, 1.15, Math.sin(a) * 0.36));
  }
  const s = labelSprite('LINK', { color: hex(S.accent), height: 0.26 });
  s.position.y = 1.55;
  g.add(s);
  return g;
}

export function newWordConsole(style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  g.add(box(0.75, 0.6, 0.55, mat(S.wall), 0, 0.3, 0));
  const q = screen(0.5, 0.5, screenTexture(['?'], { fg: '#ffd23f', bg: 'transparent', w: 128, h: 128, font: 100 }), 0, 1.05, 0);
  q.material.transparent = true;
  g.add(q);
  g.userData.spin = q;
  const s = labelSprite('UNKNOWN FILE', { color: '#ffd23f', height: 0.26 });
  s.position.y = 1.55;
  g.add(s);
  return g;
}

export function core(style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  g.add(cyl(0.5, 0.2, mat(S.wall), 0, 0.1, 0));
  const crystal = new THREE.Mesh(geo.octa, mat(S.accent, { emissive: S.accent, ei: 0.55 }));
  crystal.scale.set(0.55, 1.1, 0.55);
  crystal.position.y = 0.95;
  g.add(crystal);
  const r1 = ring(0.5, glowMat(S.accent), 0, 0.95, 0);
  const r2 = ring(0.42, glowMat(0xffffff), 0, 0.95, 0);
  r1.rotation.x = Math.PI / 2;
  g.add(r1, r2);
  g.userData.spin = crystal;
  g.userData.rings = [r1, r2];
  const s = labelSprite('ROOM CORE', { color: hex(S.accent), height: 0.26 });
  s.position.y = 1.9;
  g.add(s);
  return g;
}

/** The free Morph Compiler console in the hub: a little drum on a stand. */
export function compilerConsole(style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  g.add(box(0.9, 0.55, 0.6, mat(S.wall), 0, 0.275, 0));
  for (let i = 0; i < 3; i++) {
    const c = cyl(0.17, 0.24, mat([0x39d0ff, 0xffd23f, 0xff4fd8][i], { emissive: [0x39d0ff, 0xffd23f, 0xff4fd8][i], ei: 0.5 }), -0.26 + i * 0.26, 0.78, 0, true);
    c.rotation.z = Math.PI / 2;
    g.add(c);
  }
  const s = labelSprite('MORPH COMPILER', { color: '#ffd23f', height: 0.26 });
  s.position.y = 1.35;
  g.add(s);
  g.userData.drums = g.children.slice(1, 4);
  return g;
}

export function avatarBooth(style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  g.add(cyl(0.48, 0.1, mat(S.wall), 0, 0.05, 0));
  for (let i = 0; i < 3; i++) {
    const r = ring(0.42, glowMat(0xff4fd8), 0, 0.3 + i * 0.45, 0);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  const s = labelSprite('CUSTOMIZE', { color: '#ff4fd8', height: 0.26 });
  s.position.y = 1.7;
  g.add(s);
  g.userData.rings = g.children.slice(1, 4);
  return g;
}

export function arcadeCabinet(title = 'OVERCLOCK', color = 0xff3df0, locked = false) {
  const g = new THREE.Group();
  const body = mat(locked ? 0x2a2a35 : 0x1c1033);
  g.add(box(0.7, 1.5, 0.6, body, 0, 0.75, 0));
  g.add(box(0.72, 0.18, 0.62, glowMat(locked ? 0x444455 : color), 0, 1.55, 0));
  const scr = screen(0.56, 0.42, screenTexture(locked ? ['LOCKED'] : [title, 'INSERT', 'WORDS'], { fg: locked ? '#777' : '#ffd23f', font: 26 }), 0, 1.1, 0.31);
  g.add(scr);
  g.add(box(0.6, 0.08, 0.3, mat(0x111122), 0, 0.82, 0.38));
  g.add(sphere(0.05, glowMat(0xff3b5c), -0.12, 0.88, 0.42), sphere(0.05, glowMat(0x39d0ff), 0.1, 0.88, 0.42));
  return g;
}

/** The ornate Secret Secretary Desk with its golden plaque. Drawers glow faintly once a clue is known. */
export function secretaryDesk() {
  const g = new THREE.Group();
  const wood = mat(0x5a2e14);
  const dark = mat(0x3a1c0b);
  const gold = mat(0xe6b84a, { emissive: 0x6b4a10, ei: 0.6 });
  g.add(box(1.0, 0.75, 0.6, wood, 0, 0.375, 0));
  g.add(box(1.04, 0.06, 0.64, dark, 0, 0.78, 0));
  // slanted writing surface
  const slant = box(1.0, 0.05, 0.42, wood, 0, 0.95, 0.08);
  slant.rotation.x = 0.55;
  g.add(slant);
  // upper cabinet with pigeonholes
  g.add(box(0.9, 0.6, 0.3, wood, 0, 1.3, -0.15));
  g.add(box(0.94, 0.06, 0.34, dark, 0, 1.63, -0.15));
  for (let i = 0; i < 3; i++) g.add(box(0.22, 0.2, 0.02, dark, -0.28 + i * 0.28, 1.32, 0.0));
  // crown
  const crown = box(0.5, 0.12, 0.2, gold, 0, 1.72, -0.15);
  g.add(crown);
  // three drawers with gold handles (the three locks)
  const drawers = [];
  for (let i = 0; i < 3; i++) {
    const d = box(0.28, 0.2, 0.02, dark, -0.31 + i * 0.31, 0.45, 0.31);
    const knob = sphere(0.035, gold, -0.31 + i * 0.31, 0.45, 0.33);
    g.add(d, knob);
    drawers.push(knob);
  }
  // legs
  [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]].forEach(([x, z]) => g.add(box(0.07, 0.12, 0.07, dark, x, 0.06, z)));
  // golden plaque on the desktop
  const plaque = screen(0.62, 0.16, screenTexture(['SECRET SECRETARY DESK'], { fg: '#3a2408', bg: '#e6b84a', w: 512, h: 128, font: 40, border: '#8a6420' }), 0, 0.99, 0.2);
  plaque.rotation.x = -Math.PI / 2 + 0.55;
  g.add(plaque);
  g.userData.knobs = drawers;
  return g;
}

/** The Lexicon Tree: a fractal trunk with one glowing leaf per word the player has compiled. */
export function lexiconTree() {
  const g = new THREE.Group();
  const trunkMat = mat(0x2a1c55, { emissive: 0x1b0f4a, ei: 0.6 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 });
  const tips = [];
  const pts = [];
  function branch(from, dir, len, depth) {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    const c = cyl(Math.max(0.02, 0.12 * Math.pow(0.62, 4 - depth)), len, trunkMat);
    c.position.copy(from.clone().lerp(to, 0.5));
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.add(c);
    pts.push(from, to);
    if (depth === 0) { tips.push(to); return; }
    const n = depth > 2 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + depth * 1.3;
      const nd = dir.clone().add(new THREE.Vector3(Math.cos(a) * 0.75, 0.25, Math.sin(a) * 0.75)).normalize();
      branch(to, nd, len * 0.72, depth - 1);
    }
  }
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 1.0, 4);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  g.add(cyl(0.5, 0.1, mat(0x1d1440), 0, 0.05, 0));
  const leafGeo = new THREE.OctahedronGeometry(0.07, 0);
  const leafMat = new THREE.MeshBasicMaterial({ color: 0x9dff7a });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 300);
  leaves.count = 0;
  leaves.frustumCulled = false;
  const lamp = new THREE.PointLight(0x9dff7a, 0.4, 7, 1.6);
  lamp.position.y = 1.7;
  g.add(leaves, lamp);
  const m4 = new THREE.Matrix4();
  const colors = [new THREE.Color(0xffb000), new THREE.Color(0xdfe8f5), new THREE.Color(0x38b6ff), new THREE.Color(0x2f6fde), new THREE.Color(0x9dff7a)];
  g.userData.setLeaves = (n, originsFn, glow = 0) => {
    const count = Math.min(300, n);
    for (let i = 0; i < count; i++) {
      const tip = tips[i % tips.length];
      const k = Math.floor(i / tips.length);
      const a = i * 2.39996;
      const r = 0.06 + k * 0.05;
      m4.makeTranslation(tip.x + Math.cos(a) * r, tip.y + Math.sin(i * 1.7) * 0.07 + k * 0.03, tip.z + Math.sin(a) * r);
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, colors[originsFn ? originsFn(i) : 4]);
    }
    leaves.count = count;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    lamp.intensity = 0.35 + Math.max(0, Math.min(1, glow)) * 8;
  };
  g.scale.setScalar(1.15);
  return g;
}

// ── Decorative props per style ────────────────────────────────────

export function decor(style, ch, seed = 0) {
  const S = STYLES[style];
  const g = new THREE.Group();
  const r = (n) => (Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1;
  if (style === 'anglo') {
    if (ch === 'o') {
      g.add(arcadeCabinet(['PONG', 'BLOCKS', 'RUNE', 'SNAKE'][Math.abs(seed) % 4], 0xffb000));
    } else {
      g.add(box(0.6, 0.45, 0.5, mat(0x3a2a14), 0, 0.225, 0));
      const s = screen(0.46, 0.32, screenTexture(['> HELP', '> PLAY', '> KIND'], { fg: '#ffb000', font: 22 }), 0, 0.27, 0.26);
      g.add(s, box(0.5, 0.06, 0.3, mat(0x2a1c0c), 0, 0.03, 0.4));
      const coil = ring(0.18, mat(0x1a1a1a), 0.3, 0.05, -0.2);
      coil.rotation.x = Math.PI / 2;
      g.add(coil);
    }
  } else if (style === 'latin') {
    if (ch === 'o') {
      g.add(cyl(0.22, 1.6, mat(0xc9ccd2), 0, 0.8, 0));
      g.add(box(0.55, 0.12, 0.55, mat(0xb1b4bb), 0, 1.66, 0), box(0.55, 0.12, 0.55, mat(0xb1b4bb), 0, 0.06, 0));
      for (let i = 0; i < 5; i++) g.add(sphere(0.025, glowMat(0x9fc6ff), 0.22, 0.4 + i * 0.25, 0.05));
    } else {
      g.add(box(0.6, 1.4, 0.55, mat(0x8a8d95), 0, 0.7, 0));
      for (let i = 0; i < 6; i++) g.add(box(0.46, 0.04, 0.02, glowMat(i % 2 ? 0x9fc6ff : 0xdfe8f5), 0, 0.25 + i * 0.2, 0.28));
    }
  } else if (style === 'greek') {
    if (ch === 'o') {
      g.add(cyl(0.06, 0.8, mat(0x22407e), 0, 0.4, 0));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xdfe8ff, { side: THREE.DoubleSide }));
      dish.position.y = 0.95;
      dish.rotation.x = -0.9;
      g.add(dish, sphere(0.05, glowMat(0x38b6ff), 0, 1.15, 0.2));
    } else {
      const globe = sphere(0.28, mat(0x0c1a3c, { emissive: 0x38b6ff, ei: 0.25 }), 0, 0.75, 0);
      const r1 = ring(0.34, glowMat(0x38b6ff), 0, 0.75, 0);
      r1.rotation.x = 1.1;
      g.add(cyl(0.05, 0.5, mat(0x22407e), 0, 0.25, 0), globe, r1);
      g.userData.spin = globe;
    }
  } else if (style === 'lingo') {
    if (ch === 'o') {
      g.add(box(0.8, 0.05, 0.5, mat(0xc8a27a), 0, 0.55, 0));
      [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]].forEach(([x, z]) => g.add(box(0.04, 0.55, 0.04, mat(0x7a7f88), x, 0.275, z)));
      const lid = screen(0.36, 0.24, screenTexture(['CyberMorph'], { fg: '#2f6fde', bg: '#e8f0ff', font: 30 }), 0, 0.72, -0.1);
      lid.rotation.x = -0.2;
      g.add(box(0.38, 0.02, 0.26, mat(0x333a44), 0, 0.59, 0.05), lid, box(0.36, 0.25, 0.015, mat(0x333a44), 0, 0.72, -0.115));
      g.add(box(0.36, 0.04, 0.34, mat(0x2f6fde), 0, 0.3, 0.45));
    } else {
      // The Smart Board on the left wall.
      const board = screen(2.2, 1.1, screenTexture(['fix + ing + to', '→ finna'], { fg: '#1d2b4f', bg: '#ffffff', w: 512, h: 256, font: 52, border: '#2f6fde' }), 0, 1.25, 0);
      board.rotation.y = Math.PI / 2;
      g.add(board, box(0.08, 1.2, 2.3, mat(0x333a44), -0.05, 1.25, 0), box(0.2, 0.06, 2.2, mat(0x333a44), 0.08, 0.66, 0));
    }
  } else if (style === 'rot') {
    const c = new THREE.Mesh(geo.ico, mat(0x2a5a1a, { emissive: 0x7dff3a, ei: 0.35 }));
    c.scale.set(0.4 + r(1) * 0.3, 0.8 + r(2) * 0.6, 0.4);
    c.position.y = c.scale.y / 2;
    c.rotation.z = (r(3) - 0.5) * 0.6;
    g.add(c);
  } else {
    g.add(cyl(0.12, 1.4, mat(S.wall), 0, 0.7, 0));
    g.add(ring(0.16, glowMat(ch === 'o' ? 0xff3df0 : 0x00e5ff), 0, 1.0, 0));
    g.children[1].rotation.x = Math.PI / 2;
  }
  return g;
}

// ── Morpheme props: furniture named by each room's morphemes ─────
// Every model is a handful of primitives so the larger rooms stay cheap to draw.

export function morphProp(model, style) {
  const S = STYLES[style];
  const g = new THREE.Group();
  const acc = S.accent;
  const add = (...m) => g.add(...m);
  const lastAt = (y) => { g.children[g.children.length - 1].position.y = y; };
  switch (model) {
    // Anglo-Saxon
    case 'keyboard': {
      add(box(1.0, 0.5, 0.5, mat(0x3a2a14), 0, 0.25, 0), box(0.9, 0.06, 0.4, mat(0x1b130a), 0, 0.53, 0));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) add(box(0.07, 0.04, 0.06, glowMat(i === 3 && j > 2 && j < 7 ? acc : 0xffd36b), -0.36 + j * 0.09, 0.58, -0.13 + i * 0.09));
      break;
    }
    case 'desktop': {
      // A small desk with a monitor and a keyboard on top.
      add(box(1.0, 0.05, 0.55, mat(0x6b4515), 0, 0.55, 0));
      [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]].forEach(([x, z]) => add(box(0.06, 0.53, 0.06, mat(0x3a2a14), x, 0.265, z)));
      add(box(0.3, 0.2, 0.5, mat(0x3a2a14), 0.32, 0.42, 0));
      add(box(0.16, 0.02, 0.12, mat(0x222222), 0, 0.585, -0.12), box(0.04, 0.18, 0.04, mat(0x222222), 0, 0.67, -0.14));
      add(box(0.6, 0.38, 0.03, mat(0x222222), 0, 0.92, -0.15));
      add(screen(0.54, 0.32, screenTexture(['desk + top'], { fg: '#ffb000', font: 30 }), 0, 0.92, -0.13));
      add(box(0.46, 0.025, 0.14, mat(0x1b130a), -0.04, 0.585, 0.12));
      for (let i = 0; i < 2; i++) for (let j = 0; j < 7; j++) add(box(0.05, 0.02, 0.04, glowMat(0xffd36b), -0.22 + j * 0.06, 0.6, 0.09 + i * 0.06));
      add(box(0.06, 0.025, 0.09, mat(0x222222), 0.3, 0.585, 0.12));
      break;
    }
    case 'laptop': {
      add(box(0.6, 0.5, 0.45, mat(0x3a2a14), 0, 0.25, 0), box(0.55, 0.03, 0.38, mat(0x222222), 0, 0.52, 0.03));
      const lid = screen(0.52, 0.34, screenTexture(['lap + top'], { fg: '#ffb000', font: 30 }), 0, 0.71, -0.15);
      lid.rotation.x = -0.25;
      add(lid, box(0.55, 0.36, 0.02, mat(0x222222), 0, 0.71, -0.165));
      break;
    }
    case 'network': {
      add(cyl(0.04, 1.2, mat(0x5a3a18), -0.4, 0.6, 0), cyl(0.04, 1.2, mat(0x5a3a18), 0.4, 0.6, 0));
      const pts = [];
      for (let i = 0; i <= 5; i++) {
        pts.push(new THREE.Vector3(-0.4, 0.25 + i * 0.17, 0), new THREE.Vector3(0.4, 0.25 + i * 0.17, 0));
        pts.push(new THREE.Vector3(-0.4 + i * 0.16, 0.25, 0), new THREE.Vector3(-0.4 + i * 0.16, 1.1, 0));
      }
      add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: acc })));
      for (let i = 0; i < 4; i++) add(sphere(0.04, glowMat(0xffd36b), -0.24 + i * 0.16, 0.42 + (i % 2) * 0.34, 0.02));
      break;
    }
    case 'rainbow': {
      [0xff3b5c, 0xff9d1f, 0xffd23f, 0x6bff7a, 0x38b6ff, 0x8a5cff].forEach((c, i) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.62 - i * 0.07, 0.035, 6, 24, Math.PI), glowMat(c));
        r.position.y = 0.08;
        add(r);
      });
      add(sphere(0.16, mat(0xffffff, { emissive: 0x666666 }), -0.6, 0.12, 0), sphere(0.16, mat(0xffffff, { emissive: 0x666666 }), 0.6, 0.12, 0));
      break;
    }
    case 'windmill': {
      add(cyl(0.22, 1.1, mat(0x8a5a22), 0, 0.55, 0, true), new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 8), mat(0x5a3a18)));
      lastAt(1.25);
      const blades = new THREE.Group();
      for (let i = 0; i < 4; i++) { const p = new THREE.Group(); p.add(box(0.08, 0.55, 0.02, mat(0xf3e2b5), 0, 0.28, 0)); p.rotation.z = (i * Math.PI) / 2; blades.add(p); }
      blades.position.set(0, 0.95, 0.24);
      add(blades);
      g.userData.spinZ = blades;
      break;
    }
    // Latin
    case 'dictionary': {
      add(cyl(0.1, 0.8, mat(0xb1b4bb), 0, 0.4, 0), box(0.5, 0.06, 0.4, mat(0x9ea2aa), 0, 0.82, 0));
      const book = box(0.46, 0.08, 0.34, mat(0x5a2e14), 0, 0.89, 0);
      book.rotation.x = -0.25;
      add(book, box(0.42, 0.02, 0.3, mat(0xf3eedd), 0, 0.94, 0));
      break;
    }
    case 'structure': {
      [-0.35, 0.35].forEach((x) => add(cyl(0.09, 1.2, mat(0xd3d6dc), x, 0.6, 0)));
      add(box(0.95, 0.14, 0.3, mat(0xc9ccd2), 0, 1.25, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.3, 4), mat(0xc9ccd2));
      roof.position.y = 1.47;
      roof.rotation.y = Math.PI / 4;
      add(roof);
      break;
    }
    case 'tractor': {
      add(box(0.6, 0.3, 0.42, mat(0x2f8a3a), 0.05, 0.42, 0), box(0.3, 0.32, 0.38, mat(0x3a9a46), -0.18, 0.72, 0));
      const wheel = (x, z, r) => { const w = cyl(r, 0.12, mat(0x1a1a1a), x, r, z); w.rotation.x = Math.PI / 2; return w; };
      add(wheel(-0.2, 0.25, 0.26), wheel(-0.2, -0.25, 0.26), wheel(0.28, 0.22, 0.15), wheel(0.28, -0.22, 0.15), cyl(0.03, 0.3, mat(0x333333), 0.25, 0.75, 0));
      break;
    }
    case 'projector': {
      add(cyl(0.05, 0.8, mat(0x555a66), 0, 0.4, 0), box(0.45, 0.25, 0.32, mat(0x7d8088), 0, 0.9, 0));
      const lens = cyl(0.08, 0.1, glowMat(0xfff3c9), 0.27, 0.9, 0);
      lens.rotation.z = Math.PI / 2;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c9, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      beam.rotation.z = Math.PI / 2;
      beam.position.set(0.8, 0.9, 0);
      add(lens, beam);
      break;
    }
    case 'aqueduct': {
      for (let i = 0; i < 3; i++) add(box(0.14, 0.8, 0.3, mat(0xc9ccd2), -0.4 + i * 0.4, 0.4, 0));
      add(box(1.0, 0.16, 0.34, mat(0xb1b4bb), 0, 0.88, 0), box(0.96, 0.05, 0.2, glowMat(0x7fd0ff), 0, 0.98, 0));
      break;
    }
    case 'cart': {
      add(box(0.7, 0.3, 0.45, mat(0x8a5a22), 0, 0.45, 0), box(0.25, 0.25, 0.25, mat(0xd3d6dc), -0.12, 0.72, 0), box(0.2, 0.2, 0.2, mat(0xb1b4bb), 0.15, 0.7, 0.05));
      const w = (x, z) => { const m = cyl(0.14, 0.06, mat(0x333333), x, 0.14, z); m.rotation.x = Math.PI / 2; return m; };
      add(w(-0.25, 0.25), w(0.25, 0.25), w(-0.25, -0.25), w(0.25, -0.25));
      break;
    }
    case 'tablet': {
      add(box(0.7, 0.9, 0.14, mat(0xd3d6dc), 0, 0.5, 0), box(0.8, 0.1, 0.3, mat(0xb1b4bb), 0, 0.05, 0));
      add(screen(0.56, 0.6, screenTexture(['IN', 'SCRIPT', 'ION'], { fg: '#3a3d44', bg: '#d3d6dc', font: 34, w: 256, h: 256 }), 0, 0.55, 0.075));
      break;
    }
    // Greek
    case 'telescope': {
      [-1, 0, 1].forEach((i) => { const l = cyl(0.025, 0.8, mat(0x22407e), i * 0.18, 0.4, i === 0 ? 0.18 : -0.1); l.rotation.z = i * 0.25; add(l); });
      const tube = cyl(0.09, 0.9, mat(0xdfe8ff), 0, 0.95, 0);
      tube.rotation.z = -0.9;
      add(tube, sphere(0.06, glowMat(acc), 0.35, 1.2, 0));
      break;
    }
    case 'microscope': {
      add(box(0.45, 0.06, 0.4, mat(0x14244e), 0, 0.03, 0), cyl(0.04, 0.6, mat(0x22407e), -0.12, 0.33, 0));
      const tube = cyl(0.06, 0.38, mat(0xdfe8ff), 0.02, 0.62, 0);
      tube.rotation.z = -0.35;
      add(tube, box(0.25, 0.03, 0.25, mat(0x22407e), 0.08, 0.32, 0), sphere(0.03, glowMat(acc), 0.08, 0.36, 0));
      break;
    }
    case 'telephone': {
      add(box(0.4, 0.5, 0.3, mat(0x14244e), 0, 0.25, 0), box(0.45, 0.16, 0.34, mat(0x22407e), 0, 0.58, 0));
      const handset = cyl(0.05, 0.42, mat(0x0b0b1a), 0, 0.72, 0);
      handset.rotation.z = Math.PI / 2;
      add(handset, ring(0.1, glowMat(acc), 0, 0.42, 0.16));
      break;
    }
    case 'thermometer': {
      add(cyl(0.07, 1.1, mat(0xdfe8ff, { transparent: true, opacity: 0.6 }), 0, 0.65, 0), cyl(0.035, 0.75, glowMat(0xff3b5c), 0, 0.5, 0), sphere(0.11, glowMat(0xff3b5c), 0, 0.12, 0));
      for (let i = 0; i < 6; i++) add(box(0.08, 0.012, 0.02, mat(0xffffff), 0.1, 0.35 + i * 0.12, 0));
      break;
    }
    case 'globe': {
      add(cyl(0.18, 0.06, mat(0x22407e), 0, 0.03, 0), cyl(0.03, 0.5, mat(0x22407e), 0, 0.28, 0));
      const earth = new THREE.Group();
      earth.position.y = 0.82;
      earth.add(sphere(0.3, mat(0x2a6fd6, { emissive: 0x0a2a6a })));
      for (let i = 0; i < 4; i++) earth.add(sphere(0.09, mat(0x3ccf6a), Math.cos(i * 1.6) * 0.24, Math.sin(i * 2) * 0.15, Math.sin(i * 1.6) * 0.24));
      add(earth, ring(0.34, glowMat(acc), 0, 0.82, 0));
      g.userData.spinY = earth;
      break;
    }
    case 'clock': {
      add(box(0.12, 0.9, 0.12, mat(0x22407e), 0, 0.45, 0));
      const face = cyl(0.32, 0.06, mat(0xdfe8ff), 0, 1.15, 0);
      face.rotation.x = Math.PI / 2;
      const hands = new THREE.Group();
      hands.position.set(0, 1.15, 0.05);
      hands.add(box(0.03, 0.24, 0.02, mat(0x0b0b1a), 0, 0.1, 0));
      add(face, ring(0.33, glowMat(acc), 0, 1.15, 0.03), hands);
      g.userData.spinZ = hands;
      break;
    }
    case 'camera': {
      [-1, 0, 1].forEach((i) => { const l = cyl(0.02, 0.8, mat(0x14244e), i * 0.16, 0.4, i === 0 ? 0.16 : -0.08); l.rotation.z = i * 0.2; add(l); });
      add(box(0.36, 0.26, 0.24, mat(0x0b0b1a), 0, 0.92, 0));
      const lens = cyl(0.08, 0.14, mat(0x22407e), 0, 0.92, 0.18);
      lens.rotation.x = Math.PI / 2;
      add(lens, sphere(0.04, glowMat(0xffffff), 0.12, 1.07, 0));
      break;
    }
    // Lingo
    case 'backpack': {
      add(box(0.45, 0.55, 0.25, mat(0x2f6fde), 0, 0.3, 0), box(0.35, 0.2, 0.08, mat(0x1f4fb0), 0, 0.22, 0.15));
      add(box(0.07, 0.4, 0.04, mat(0x1a1a1a), -0.14, 0.4, -0.14), box(0.07, 0.4, 0.04, mat(0x1a1a1a), 0.14, 0.4, -0.14));
      break;
    }
    case 'trophy': {
      const gold = mat(0xe6b84a, { emissive: 0x6b4a10 });
      add(box(0.36, 0.12, 0.36, mat(0x3a2a14), 0, 0.06, 0), cyl(0.05, 0.3, gold, 0, 0.27, 0));
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.32, 14), gold);
      cup.position.y = 0.58;
      const tag = labelSprite('G.O.A.T.', { color: '#3a2408', bg: 'rgba(246,210,122,0.95)', height: 0.16 });
      tag.position.y = 0.95;
      add(cup, tag);
      break;
    }
    case 'lavalamp': {
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.55, 12), mat(0xff7ad9, { emissive: 0xb0189f, ei: 0.6, transparent: true, opacity: 0.85 }));
      glass.position.y = 0.4;
      const blob = sphere(0.06, glowMat(0xffd23f), 0, 0.35, 0);
      add(cyl(0.12, 0.12, mat(0x333a44), 0, 0.06, 0), glass, blob);
      g.userData.bob = blob;
      break;
    }
    case 'tray': {
      add(box(0.5, 0.55, 0.4, mat(0xc8a27a), 0, 0.27, 0), box(0.56, 0.03, 0.42, mat(0x7a7f88), 0, 0.57, 0));
      add(sphere(0.07, mat(0xffd23f), -0.14, 0.62, 0), box(0.14, 0.04, 0.1, mat(0xc8752a), 0.05, 0.6, 0.05), cyl(0.05, 0.12, mat(0xff7a6b), 0.17, 0.64, -0.08));
      break;
    }
    case 'caphook': {
      add(box(0.06, 1.3, 0.06, mat(0x7a7f88), 0, 0.65, 0), box(0.24, 0.03, 0.03, mat(0x7a7f88), 0.1, 1.15, 0));
      const cap = sphere(0.14, mat(0xff3b5c), 0.2, 1.05, 0);
      cap.scale.y = 0.5;
      add(cap, box(0.16, 0.02, 0.12, mat(0xd02a48), 0.3, 1.0, 0));
      break;
    }
    case 'mirror': {
      add(box(0.6, 0.9, 0.06, mat(0xf3f5f8), 0, 0.75, 0), box(0.5, 0.78, 0.02, mat(0xbfd8ff, { emissive: 0x405a80 }), 0, 0.75, 0.04));
      for (let i = 0; i < 6; i++) add(sphere(0.03, glowMat(0xffd23f), -0.3 + (i % 2) * 0.6, 0.4 + Math.floor(i / 2) * 0.35, 0.05));
      add(box(0.3, 0.3, 0.2, mat(0xc8a27a), 0, 0.15, 0));
      break;
    }
    default:
      add(box(0.5, 0.5, 0.5, mat(S.wall), 0, 0.25, 0));
  }
  return g;
}

/** Idle motion for the props that have some (flames, blades, globes, lamps). */
export function animateProp(g, t, dt) {
  const u = g.userData;
  if (u.flicker) u.flicker.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.15; });
  if (u.spinZ) u.spinZ.rotation.z -= dt * 0.8;
  if (u.spinY) u.spinY.rotation.y += dt * 0.5;
  if (u.bob) u.bob.position.y = 0.35 + Math.sin(t * 1.5) * 0.15;
  if (u.tick) u.tick(t, dt);
}

/** The tree's small click zone: a softly pulsing disc at the base of the trunk. */
export function treeBaseZone() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), new THREE.MeshBasicMaterial({ color: 0x9dff7a, transparent: true, opacity: 0.35, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.16;
  const halo = ring(0.42, glowMat(0x9dff7a), 0, 0.17, 0);
  halo.rotation.x = Math.PI / 2;
  const tag = labelSprite('LEXICON TREE', { color: '#9dff7a', border: '#9dff7a', height: 0.34 });
  tag.position.y = 0.9;
  g.add(disc, halo, tag);
  g.userData.pulse = (t) => {
    const k = 0.5 + 0.5 * Math.sin(t * 2.4);
    disc.material.opacity = 0.18 + k * 0.32;
    halo.scale.setScalar(1 + k * 0.12);
  };
  return g;
}
