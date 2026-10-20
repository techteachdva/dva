/**
 * Mr. Phil's classroom, rebuilt in the Lexinet (the Lingo Room).
 *
 *   smartBoard()      the Smart Board, typing the morpheme lesson on repeat (it is also the room core)
 *   triangleDesks()   long desks in a triangle whose point aims at the Smart Board
 *   printer3d()       a blue and grey 3D printer with a moving print head
 *   chromebookCart()  a charging cart with a desktop monitor drawing a rainbow fractal
 *   createD20()       a big green d20 with white numbers and simple bounce physics
 *   createMrPhil()    Mr. Phil himself: wild curly hair, full beard, dark green glasses
 *
 * Canvas screens redraw on a clock (tick), never every frame, to stay cheap on Chromebooks.
 */

import { THREE } from './renderer.js';
import { mat, glowMat, box, cyl, sphere, screen } from './props.js';
import { labelSprite } from './textures.js';

const canvasTex = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), t };
};

// ── The Smart Board ───────────────────────────────────────────────

export const LESSON = 'Today Class we are studying Morphemes. Morphemes are the smallest unit of meaning within words. What\'s cool about morphemes is if you know one morpheme you actually know hundreds of words at once! That\'s why I am excited to teach you Morphemes today!';

/** Wrap text into lines that fit `width` pixels. */
function wrap(ctx, text, width) {
  const lines = [];
  let line = '';
  text.split(' ').forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) { lines.push(line); line = word; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

export function smartBoard() {
  const g = new THREE.Group();
  const W = 4.0;
  const H = 1.7;
  const { c, ctx, t } = canvasTex(1024, 436);
  const face = screen(W, H, t, 0, 1.2, -0.36);
  // Frame, tray and the wall bracket. The board hangs on the wall behind its tile.
  g.add(box(W + 0.16, H + 0.16, 0.08, mat(0x333a44), 0, 1.2, -0.42), face);
  g.add(box(W * 0.8, 0.06, 0.14, mat(0x7a7f88), 0, 0.3, -0.33));
  [-1.2, -1.05, 1.1].forEach((x, i) => g.add(box(0.12, 0.03, 0.03, mat([0x2f6fde, 0xe03b3b, 0x1fa33a][i]), x, 0.35, -0.3)));
  const lamp = sphere(0.035, glowMat(0x1fa33a), W / 2 - 0.12, 0.37, -0.37);
  g.add(lamp);
  const font = 40;
  const pad = 46;
  let shown = -1;
  let clock = 0;
  const draw = (n) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#2f6fde';
    ctx.fillRect(0, 0, c.width, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px Lexend, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('MR. PHIL  ·  TODAY\'S LESSON', 20, 23);
    ctx.font = `600 ${font}px Lexend, sans-serif`;
    ctx.fillStyle = '#1d2b4f';
    ctx.textBaseline = 'top';
    const lines = wrap(ctx, LESSON, c.width - pad * 2);
    let left = n;
    lines.forEach((l, i) => {
      if (left <= 0) return;
      const part = l.slice(0, left);
      left -= l.length + 1;
      ctx.fillText(part, pad, 64 + i * font * 1.22);
      if (left <= 0 && Math.floor(clock * 2) % 2 === 0) {
        const x = pad + ctx.measureText(part).width + 4;
        ctx.fillRect(x, 66 + i * font * 1.22, 4, font);
      }
    });
    t.needsUpdate = true;
  };
  draw(0);
  // Type the lesson out, hold it, wipe the board, and start again.
  const SPEED = 22;
  const HOLD = 5;
  g.userData.tick = (time, dt) => {
    clock += dt;
    const cycle = LESSON.length / SPEED + HOLD;
    const k = clock % cycle;
    const n = Math.min(LESSON.length, Math.floor(k * SPEED));
    const blink = Math.floor(clock * 2);
    if (n !== shown || (n === LESSON.length && blink !== g.userData.blink)) {
      shown = n;
      g.userData.blink = blink;
      draw(n);
    }
    lamp.material.emissiveIntensity = 0.6 + Math.sin(time * 3) * 0.4;
  };
  return g;
}

// ── Long desks in a triangle ──────────────────────────────────────

/** `pts`: the three corners in tile units, relative to the anchor tile. The first corner points at the Smart Board. */
export function triangleDesks(pts) {
  const g = new THREE.Group();
  const top = mat(0xd9c4a3);
  const leg = mat(0x7a7f88);
  const chair = mat(0x2f6fde);
  const centre = new THREE.Vector3();
  pts.forEach(([x, z]) => centre.add(new THREE.Vector3(x, 0, z)));
  centre.divideScalar(3);
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Vector3(pts[i][0], 0, pts[i][1]);
    const b = new THREE.Vector3(pts[(i + 1) % 3][0], 0, pts[(i + 1) % 3][1]);
    const len = a.distanceTo(b) - 0.5;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const desk = new THREE.Group();
    desk.position.copy(mid);
    desk.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    // Which side of the desk faces outward (students sit outside the triangle, facing in).
    const out = mid.clone().sub(centre);
    const local = out.applyAxisAngle(new THREE.Vector3(0, 1, 0), -desk.rotation.y);
    const side = local.z >= 0 ? 1 : -1;
    desk.add(box(len, 0.06, 0.62, top, 0, 0.6, 0));
    [-len / 2 + 0.1, len / 2 - 0.1].forEach((x) => desk.add(box(0.05, 0.6, 0.55, leg, x, 0.3, 0)));
    const seats = Math.max(2, Math.floor(len / 1.1));
    for (let s = 0; s < seats; s++) {
      const x = -len / 2 + (len / seats) * (s + 0.5);
      // A Chromebook on the desk, open toward the student's chair.
      const lid = box(0.36, 0.24, 0.015, mat(0x333a44), x, 0.74, -side * 0.05);
      lid.rotation.x = side * 0.25;
      desk.add(box(0.38, 0.02, 0.26, mat(0x4a5260), x, 0.64, side * 0.08), lid);
      desk.add(box(0.34, 0.2, 0.004, glowMat(0x7fb6ff), x, 0.74, -side * 0.06 + side * 0.012));
      desk.add(box(0.34, 0.05, 0.34, chair, x, 0.38, side * 0.62), box(0.34, 0.36, 0.05, chair, x, 0.58, side * 0.8), box(0.05, 0.36, 0.05, leg, x, 0.18, side * 0.62));
    }
    g.add(desk);
  }
  return g;
}

// ── 3D printer ────────────────────────────────────────────────────

export function printer3d() {
  const g = new THREE.Group();
  const blue = mat(0x2f6fde);
  const grey = mat(0x9aa1ab);
  const dark = mat(0x4a5260);
  g.add(box(0.7, 0.5, 0.6, grey, 0, 0.25, 0));
  g.add(box(0.06, 0.75, 0.06, blue, -0.3, 0.87, 0), box(0.06, 0.75, 0.06, blue, 0.3, 0.87, 0), box(0.66, 0.07, 0.08, blue, 0, 1.25, 0));
  g.add(box(0.5, 0.03, 0.45, dark, 0, 0.53, 0.02));
  const gantry = box(0.6, 0.04, 0.05, grey, 0, 0.85, 0);
  const head = new THREE.Group();
  head.add(box(0.12, 0.1, 0.12, blue, 0, 0, 0), cyl(0.015, 0.06, dark, 0, -0.07, 0));
  head.position.set(0, 0.8, 0);
  const part = box(0.16, 0.001, 0.16, mat(0x6fa8ff), 0, 0.55, 0.02);
  const spool = cyl(0.13, 0.08, blue, 0.42, 0.75, 0);
  spool.rotation.z = Math.PI / 2;
  g.add(gantry, head, part, spool, sphere(0.025, glowMat(0x3cff7a), 0.25, 0.4, 0.31));
  // The head sweeps and the little part grows, then a fresh print starts.
  g.userData.tick = (t) => {
    head.position.x = Math.sin(t * 2.4) * 0.2;
    head.position.z = Math.cos(t * 1.7) * 0.12;
    const h = (t * 0.03) % 0.18;
    part.scale.y = Math.max(0.001, h);
    part.position.y = 0.545 + h / 2;
    head.position.y = 0.62 + h;
    gantry.position.y = head.position.y + 0.05;
    spool.rotation.x += 0.01;
  };
  return g;
}

// ── Chromebook cart and the fractal desktop ───────────────────────

export function chromebookCart() {
  const g = new THREE.Group();
  const body = mat(0x5f6b7a);
  g.add(box(0.95, 0.8, 0.6, body, 0, 0.5, 0), box(1.0, 0.05, 0.65, mat(0x3a4250), 0, 0.92, 0));
  [[-0.4, -0.24], [0.4, -0.24], [-0.4, 0.24], [0.4, 0.24]].forEach(([x, z]) => g.add(cyl(0.05, 0.05, mat(0x222222), x, 0.05, z)));
  // Chromebooks standing in their slots, each with a green charge light.
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09;
    g.add(box(0.03, 0.5, 0.42, mat(0x2a2f38), x, 0.5, 0.12), sphere(0.012, glowMat(i === 6 ? 0xffb000 : 0x3cff7a), x, 0.8, 0.33));
  }
  // The desktop monitor on top.
  const { c, ctx, t } = canvasTex(320, 200);
  g.add(box(0.1, 0.25, 0.1, mat(0x222222), 0, 1.07, -0.08), box(0.3, 0.03, 0.2, mat(0x222222), 0, 0.96, -0.08));
  g.add(box(0.92, 0.6, 0.05, mat(0x15171c), 0, 1.45, -0.1), screen(0.84, 0.52, t, 0, 1.45, -0.07));
  g.add(box(0.5, 0.02, 0.16, mat(0x2a2f38), 0, 0.96, 0.17));
  // A rainbow fractal tree that sways and cycles colour.
  let acc = 0;
  const branch = (x, y, len, ang, depth, hue, spread) => {
    if (depth === 0) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y - Math.sin(ang) * len;
    ctx.strokeStyle = `hsl(${(hue + depth * 32) % 360} 100% 60%)`;
    ctx.lineWidth = depth * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    branch(x2, y2, len * 0.72, ang + spread, depth - 1, hue, spread);
    branch(x2, y2, len * 0.72, ang - spread, depth - 1, hue, spread);
  };
  const draw = (time) => {
    ctx.fillStyle = 'rgba(5, 4, 16, 0.55)';
    ctx.fillRect(0, 0, c.width, c.height);
    const hue = (time * 60) % 360;
    branch(c.width / 2, c.height - 6, 48, Math.PI / 2, 9, hue, 0.35 + Math.sin(time * 0.9) * 0.22);
    t.needsUpdate = true;
  };
  draw(0);
  g.userData.tick = (time, dt) => {
    acc += dt;
    if (acc < 1 / 12) return;
    acc = 0;
    draw(time);
  };
  return g;
}

// ── The d20 ───────────────────────────────────────────────────────

const D20_R = 0.42;
/** Height of the centre when a face lies flat on the floor (the inradius). */
const REST = D20_R * 0.7947;

function numberTexture(n) {
  const { ctx, t } = canvasTex(128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px Lexend, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 66);
  if (n === 6 || n === 9) ctx.fillRect(44, 102, 40, 7);
  return t;
}

/**
 * A big green d20 with white numbers (opposite faces add up to 21, like a real one).
 * bounds: { minX, maxX, minZ, maxZ } in room space. Returns { group, roll(), update(dt), rolling }.
 * onLand(n) fires once the die settles and turns its top face flat.
 */
export function createD20(bounds, { onBounce = null, onLand = null } = {}) {
  const group = new THREE.Group();
  const die = new THREE.Group();
  group.add(die);
  const geo = new THREE.IcosahedronGeometry(D20_R, 0);
  const body = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x18a83a, emissive: 0x05310f, flatShading: true }));
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xe8ffe8 }));
  die.add(body, lines);
  // Face centres and normals, then numbers in opposite pairs.
  const pos = geo.attributes.position;
  const faces = [];
  for (let f = 0; f < pos.count / 3; f++) {
    const cen = new THREE.Vector3();
    for (let k = 0; k < 3; k++) cen.add(new THREE.Vector3().fromBufferAttribute(pos, f * 3 + k));
    cen.divideScalar(3);
    faces.push({ cen, n: cen.clone().normalize(), num: 0 });
  }
  let next = 1;
  faces.forEach((f) => {
    if (f.num) return;
    const opp = faces.find((o) => !o.num && o !== f && o.n.dot(f.n) < -0.99);
    f.num = next;
    if (opp) opp.num = 21 - next;
    next += 1;
  });
  const planeGeo = new THREE.PlaneGeometry(0.2, 0.2);
  faces.forEach((f) => {
    const p = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: numberTexture(f.num), transparent: true, depthWrite: false, toneMapped: false }));
    p.position.copy(f.cen).multiplyScalar(1.01);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.n);
    die.add(p);
  });

  const state = {
    p: new THREE.Vector3((bounds.minX + bounds.maxX) / 2, REST, (bounds.minZ + bounds.maxZ) / 2),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    rolling: false,
    settling: 0,
    shown: null,
  };
  die.quaternion.setFromUnitVectors(faces.find((f) => f.num === 20).n, new THREE.Vector3(0, 1, 0));
  group.position.copy(state.p);

  const topFace = () => {
    let best = null;
    let bestY = -2;
    faces.forEach((f) => { const y = f.n.clone().applyQuaternion(die.quaternion).y; if (y > bestY) { bestY = y; best = f; } });
    return best;
  };
  const up = new THREE.Vector3(0, 1, 0);
  let alignFrom = null;
  let alignTo = null;
  let alignT = 0;
  let bounceCool = 0;

  const api = {
    group,
    get rolling() { return state.rolling || alignT > 0; },
    get pos() { return state.p; },
    /** Throw the die: a random sideways shove, a hop and a spin. */
    roll() {
      if (api.rolling) return false;
      const a = Math.random() * Math.PI * 2;
      const s = 3.2 + Math.random() * 2.2;
      state.v.set(Math.cos(a) * s, 4.2 + Math.random() * 1.8, Math.sin(a) * s);
      state.w.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 26);
      state.rolling = true;
      state.settling = 0;
      return true;
    },
    update(dt) {
      dt = Math.min(dt, 1 / 30);
      bounceCool -= dt;
      if (alignT > 0) {
        alignT = Math.max(0, alignT - dt / 0.3);
        die.quaternion.slerpQuaternions(alignFrom, alignTo, 1 - alignT);
        if (alignT === 0 && onLand) onLand(topFace().num);
        return;
      }
      if (!state.rolling) return;
      const { p, v, w } = state;
      v.y -= 15 * dt;
      p.addScaledVector(v, dt);
      const floor = REST;
      if (p.y < floor) {
        p.y = floor;
        if (v.y < -1.2) {
          v.y = -v.y * 0.42;
          v.x *= 0.82; v.z *= 0.82;
          w.multiplyScalar(0.72);
          if (onBounce && bounceCool <= 0) { onBounce(); bounceCool = 0.12; }
        } else {
          v.y = 0;
          // Rolling on the floor: friction slows it, and the spin follows the roll.
          const f = Math.max(0, 1 - 2.6 * dt);
          v.x *= f; v.z *= f;
          w.lerp(new THREE.Vector3(v.z / D20_R, 0, -v.x / D20_R), Math.min(1, dt * 6));
        }
      }
      // Bounce off the walls of the teacher corner.
      const r = D20_R;
      if (p.x < bounds.minX + r) { p.x = bounds.minX + r; v.x = Math.abs(v.x) * 0.6; w.z *= -1; if (onBounce && bounceCool <= 0) { onBounce(); bounceCool = 0.12; } }
      if (p.x > bounds.maxX - r) { p.x = bounds.maxX - r; v.x = -Math.abs(v.x) * 0.6; w.z *= -1; if (onBounce && bounceCool <= 0) { onBounce(); bounceCool = 0.12; } }
      if (p.z < bounds.minZ + r) { p.z = bounds.minZ + r; v.z = Math.abs(v.z) * 0.6; w.x *= -1; if (onBounce && bounceCool <= 0) { onBounce(); bounceCool = 0.12; } }
      if (p.z > bounds.maxZ - r) { p.z = bounds.maxZ - r; v.z = -Math.abs(v.z) * 0.6; w.x *= -1; if (onBounce && bounceCool <= 0) { onBounce(); bounceCool = 0.12; } }
      // Round obstacles (Mr. Phil, the cart): push out and bounce away.
      (bounds.obstacles || []).forEach((o) => {
        const dx = p.x - o.x;
        const dz = p.z - o.z;
        const dist = Math.hypot(dx, dz);
        if (dist >= o.r + r || dist < 1e-4) return;
        const nx = dx / dist;
        const nz = dz / dist;
        p.x = o.x + nx * (o.r + r);
        p.z = o.z + nz * (o.r + r);
        const dot = v.x * nx + v.z * nz;
        if (dot < 0) { v.x -= 1.6 * dot * nx; v.z -= 1.6 * dot * nz; }
        if (onBounce && bounceCool <= 0) { onBounce(); bounceCool = 0.12; }
      });
      const ang = w.length() * dt;
      if (ang > 1e-5) die.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), ang)).normalize();
      group.position.copy(p);
      const still = p.y <= floor + 1e-3 && Math.hypot(v.x, v.z) < 0.12;
      state.settling = still ? state.settling + dt : 0;
      if (state.settling > 0.15) {
        // Settle: turn the face that is most "up" flat to the floor, then report it.
        state.rolling = false;
        v.set(0, 0, 0); w.set(0, 0, 0);
        const f = topFace();
        const n = f.n.clone().applyQuaternion(die.quaternion);
        alignFrom = die.quaternion.clone();
        alignTo = new THREE.Quaternion().setFromUnitVectors(n, up).multiply(die.quaternion);
        alignT = 1;
      }
    },
    /** For playtests: the number on top right now. */
    top: () => topFace().num,
  };
  return api;
}

// ── Mr. Phil ──────────────────────────────────────────────────────

/** A seeded random so his hair is the same wild shape every visit. */
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/**
 * Mr. Phil as a person, not a robot: wild curly hair sticking up, a thick full beard and moustache,
 * dark green glasses, a button-down shirt, jeans and sneakers, average build.
 */
export function createMrPhil() {
  const g = new THREE.Group();
  const skin = mat(0xe2b48f);
  const hair = mat(0xa47a4f); // light brown
  const shirt = mat(0x6f9fd8);
  const shirtDark = mat(0x5a86bd);
  const jeans = mat(0x2d4f8a);
  const sneaker = mat(0xf2f2f2);
  const sole = mat(0x3a3f47);
  const frames = mat(0x1f5a2e);
  // Sneakers.
  [-0.1, 0.1].forEach((x) => g.add(box(0.14, 0.08, 0.26, sneaker, x, 0.05, 0.03), box(0.15, 0.025, 0.27, sole, x, 0.012, 0.03), box(0.1, 0.02, 0.02, mat(0x2f6fde), x, 0.07, 0.15)));
  // Jeans.
  const legs = [-0.1, 0.1].map((x) => box(0.15, 0.5, 0.17, jeans, x, 0.34, 0));
  g.add(...legs, box(0.36, 0.1, 0.2, jeans, 0, 0.6, 0), box(0.37, 0.04, 0.21, mat(0x4a3220), 0, 0.64, 0), box(0.06, 0.04, 0.01, mat(0xc9a94a), 0, 0.64, 0.11));
  // Button-down shirt: torso, placket, buttons, collar, rolled sleeves.
  const torso = new THREE.Group();
  torso.add(box(0.44, 0.44, 0.24, shirt, 0, 0.87, 0));
  torso.add(box(0.035, 0.42, 0.01, shirtDark, 0, 0.87, 0.123));
  for (let i = 0; i < 5; i++) torso.add(sphere(0.011, mat(0xffffff), 0, 0.71 + i * 0.08, 0.13));
  const collarL = box(0.11, 0.06, 0.02, shirt, -0.06, 1.08, 0.12);
  const collarR = box(0.11, 0.06, 0.02, shirt, 0.06, 1.08, 0.12);
  collarL.rotation.z = -0.5; collarR.rotation.z = 0.5;
  torso.add(collarL, collarR, box(0.06, 0.035, 0.03, mat(0x4a7ab5), -0.14, 0.95, 0.125));
  g.add(torso);
  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Group();
    arm.add(box(0.11, 0.26, 0.13, shirt, 0, -0.13, 0), box(0.115, 0.04, 0.135, shirtDark, 0, -0.27, 0), box(0.085, 0.16, 0.1, skin, 0, -0.36, 0), sphere(0.05, skin, 0, -0.46, 0.01));
    arm.position.set(s * 0.285, 1.06, 0);
    arm.rotation.z = s * 0.08;
    g.add(arm);
    return arm;
  });
  // Neck and head.
  g.add(cyl(0.06, 0.08, skin, 0, 1.12, 0));
  const head = new THREE.Group();
  head.position.y = 1.28;
  const skull = sphere(0.16, skin, 0, 0, 0);
  skull.scale.set(0.3, 0.35, 0.31);
  head.add(skull, sphere(0.03, skin, -0.155, -0.005, 0), sphere(0.03, skin, 0.155, -0.005, 0));
  head.add(sphere(0.026, skin, 0, -0.005, 0.16));
  // Eyes, behind dark green rimmed glasses.
  [-0.055, 0.055].forEach((x) => head.add(sphere(0.016, mat(0x1b1b1b), x, 0.03, 0.143)));
  const rimGeo = new THREE.TorusGeometry(0.04, 0.009, 6, 18);
  [-0.058, 0.058].forEach((x) => { const rim = new THREE.Mesh(rimGeo, frames); rim.position.set(x, 0.03, 0.158); rim.scale.y = 0.82; head.add(rim); });
  head.add(box(0.035, 0.012, 0.012, frames, 0, 0.035, 0.16));
  [-1, 1].forEach((s) => head.add(box(0.008, 0.012, 0.15, frames, s * 0.1, 0.035, 0.085)));
  // A thick full beard and moustache.
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.168, 18, 12, Math.PI * 0.02, Math.PI * 0.96, Math.PI * 0.52, Math.PI * 0.48), mat(0xa47a4f, { side: THREE.DoubleSide }));
  beard.position.set(0, -0.005, 0.012);
  beard.scale.set(1.02, 1.12, 1.04);
  head.add(beard, sphere(0.075, hair, 0, -0.13, 0.08));
  const stache = sphere(0.05, hair, 0, -0.035, 0.145);
  stache.scale.multiply(new THREE.Vector3(2.0, 0.55, 0.8));
  head.add(stache, sphere(0.02, mat(0x8a4a3a), 0, -0.07, 0.15));
  [-1, 1].forEach((s) => head.add(sphere(0.06, hair, s * 0.12, -0.05, 0.06)));
  // Wild curly hair: a cloud of curls on top, some sticking straight up.
  const rnd = seeded(20260519);
  const curls = new THREE.Group();
  for (let i = 0; i < 48; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = rnd() * Math.PI * 0.42;
    const rad = 0.145 + rnd() * 0.03 + (phi < 0.5 ? rnd() * 0.035 : 0);
    const x = Math.sin(phi) * Math.cos(theta) * rad * 1.15;
    const z = Math.sin(phi) * Math.sin(theta) * rad * 1.1 - 0.015;
    const y = Math.cos(phi) * rad + 0.02;
    if (z > 0.04 && y < 0.17) continue; // keep the forehead clear
    curls.add(sphere(0.026 + rnd() * 0.02, hair, x, y, z));
  }
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const tuft = sphere(0.022, hair, Math.cos(a) * 0.07, 0.2 + rnd() * 0.04, Math.sin(a) * 0.06);
    tuft.scale.multiply(new THREE.Vector3(0.8, 1.6, 0.8));
    tuft.rotation.z = (rnd() - 0.5) * 0.8;
    curls.add(tuft);
  }
  [-1, 1].forEach((s) => { for (let i = 0; i < 4; i++) curls.add(sphere(0.03, hair, s * (0.145 + rnd() * 0.02), 0.05 + i * 0.03, -0.04 - rnd() * 0.08)); });
  head.add(curls);
  g.add(head);
  const tag = labelSprite('MR. PHIL', { color: '#ffffff', bg: 'rgba(31,90,46,0.92)', height: 0.16 });
  tag.position.set(0, 1.72, 0);
  g.add(tag);
  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      head.rotation.y = Math.sin(t * 0.6) * 0.18;
      head.rotation.z = Math.sin(t * 1.1) * 0.03;
      torso.scale.y = 1 + Math.sin(t * 2) * 0.008;
      arms[1].rotation.x = Math.sin(t * 1.3) * 0.12;
      arms[0].rotation.x = -Math.sin(t * 1.3) * 0.06;
      curls.rotation.y = Math.sin(t * 2.2) * 0.02;
    },
  };
}
