/**
 * A room is a tile diorama built from a text map (legend in data/layout.js).
 *
 * Outer walls stand tall, except the ones between the camera and the room: those
 * sink to a low rim, so rotating the camera never hides the room behind a wall.
 * Inner walls (between zones) stay waist-high with a glowing cap.
 */

import { THREE } from './renderer.js';
import { STYLES, mat, decor } from './props.js';
import { easeOutBack, clamp, tween, tweenP } from '../core/util.js';

// x is an invisible blocker under furniture that spans several tiles (the Lingo Room's desks and Smart Board).
const BLOCKING = new Set(['#', ' ', '~', 'M', 'T', 'G', 'F', 'N', 'W', 'C', 'D', 'A', 'O', 'X', 'L', 'o', 'k', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'P', 'Q', 'Y', 'x']);
const PORTS = new Set(['H', '1', '2', '3', '4']);
const TALL = 1.5;
const LOW = 0.26;
const INNER = 0.5;

export function buildRoom(map, style, { makeObject, flowers = false, paint = [] } = {}) {
  const S = STYLES[style];
  const H = map.length;
  const W = map[0].length;
  const cells = map.map((row) => row.split(''));
  const blocked = cells.map((row) => row.map((ch) => BLOCKING.has(ch)));
  const group = new THREE.Group();
  const toWorld = (c, r, y = 0) => new THREE.Vector3(c - (W - 1) / 2, y, r - (H - 1) / 2);
  const toCell = (v) => ({ c: Math.round(v.x + (W - 1) / 2), r: Math.round(v.z + (H - 1) / 2) });
  const inside = (c, r) => c >= 0 && r >= 0 && c < W && r < H;

  // Lights.
  const hemi = new THREE.HemisphereLight(S.sky, S.ground, style === 'lingo' ? 1.6 : 1.2);
  const key = new THREE.DirectionalLight(0xffffff, style === 'lingo' ? 1.4 : 1.05);
  key.position.set(-6, 12, 8);
  const glowA = new THREE.PointLight(S.accent, style === 'lingo' ? 2 : 9, 18, 1.6);
  glowA.position.set(-W / 4, 3, 0);
  const glowB = new THREE.PointLight(S.accent, style === 'lingo' ? 2 : 9, 18, 1.6);
  glowB.position.set(W / 4, 3, 0);
  group.add(hemi, key, glowA, glowB);

  // Plinth: the diorama sits on a slab like a model on a table.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.8, H + 0.4), mat(style === 'lingo' ? 0x8b95a3 : 0x0b0814));
  plinth.position.y = -0.52;
  const pe = new THREE.LineSegments(new THREE.EdgesGeometry(plinth.geometry), new THREE.LineBasicMaterial({ color: S.line, transparent: true, opacity: 0.55 }));
  pe.position.copy(plinth.position);
  group.add(plinth, pe);

  // Floor tiles (instanced) and the grid lines.
  const floorCells = [];
  const wallCells = [];
  cells.forEach((row, r) => row.forEach((ch, c) => {
    if (ch === '#') {
      const border = r === 0 || c === 0 || r === H - 1 || c === W - 1;
      const n = new THREE.Vector2(c === 0 ? -1 : c === W - 1 ? 1 : 0, r === 0 ? -1 : r === H - 1 ? 1 : 0);
      if (n.lengthSq()) n.normalize();
      wallCells.push({ c, r, border, normal: n, h: border ? TALL : INNER, target: border ? TALL : INNER });
    } else if (ch !== ' ' && ch !== '~') floorCells.push({ c, r });
  }));
  const tileGeo = new THREE.BoxGeometry(0.97, 0.2, 0.97);
  const floor = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), floorCells.length);
  const cA = new THREE.Color(S.floorA);
  const cB = new THREE.Color(S.floorB);
  floorCells.forEach((t, i) => floor.setColorAt(i, (t.c + t.r) % 2 ? cA : cB));
  floor.frustumCulled = false;
  group.add(floor);

  const linePts = [];
  floorCells.forEach(({ c, r }) => {
    const p = toWorld(c, r, 0.005);
    const h = 0.485;
    linePts.push(
      new THREE.Vector3(p.x - h, p.y, p.z - h), new THREE.Vector3(p.x + h, p.y, p.z - h),
      new THREE.Vector3(p.x - h, p.y, p.z - h), new THREE.Vector3(p.x - h, p.y, p.z + h),
    );
  });
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: S.line, transparent: true, opacity: style === 'lingo' ? 0.16 : 0.26 }));
  group.add(grid);

  // Walls take per-tile colour, so a room can paint a wall (the Lingo Room's green screen).
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff), wallCells.length);
  const wallColor = new THREE.Color(S.wall);
  wallCells.forEach((t, i) => {
    const pt = paint.find((p) => t.c >= p.c0 && t.c <= p.c1 && t.r >= p.r0 && t.r <= p.r1);
    walls.setColorAt(i, pt ? new THREE.Color(pt.color) : wallColor);
  });
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.07, 1), mat(S.wallTop, { emissive: S.line, ei: style === 'lingo' ? 0 : 0.12 }), wallCells.length);
  walls.frustumCulled = false;
  caps.frustumCulled = false;
  group.add(walls, caps);

  // The data chasm and its stream.
  const gapCells = [];
  cells.forEach((row, r) => row.forEach((ch, c) => { if (ch === '~') gapCells.push({ c, r }); }));
  let streamTex = null;
  if (gapCells.length) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const x = cv.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, 64, 256);
    const rgb = new THREE.Color(S.accent).toArray().map((val) => Math.round(val * 255)).join(',');
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${rgb},${0.2 + Math.random() * 0.6})`;
      x.fillRect(Math.random() * 64, Math.random() * 256, 2, 10 + Math.random() * 30);
    }
    streamTex = new THREE.CanvasTexture(cv);
    streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping;
    const gm = new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, opacity: 0.85 });
    gapCells.forEach(({ c, r }) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gm);
      m.rotation.x = -Math.PI / 2;
      m.position.copy(toWorld(c, r, -0.9));
      group.add(m);
    });
  }

  // Objects and decor.
  const objects = [];
  const decorList = [];
  const marks = {};
  cells.forEach((row, r) => row.forEach((ch, c) => {
    const pos = toWorld(c, r);
    if (ch === 'o' || ch === 'k') {
      const d = decor(style, ch, c * 7 + r * 13);
      d.position.copy(pos);
      if (style === 'lingo' && ch === 'k') d.position.x -= 0.4;
      // The Smart Board model already faces into the room from the west wall; other decor turns to face inward.
      if (style === 'lingo' && ch === 'k') d.rotation.y = 0;
      else d.rotation.y = style === 'lingo' && ch === 'o' ? Math.PI : (r <= 1 ? 0 : c <= 1 ? Math.PI / 2 : c >= W - 2 ? -Math.PI / 2 : r >= H - 2 ? Math.PI : 0);
      group.add(d);
      decorList.push(d);
      return;
    }
    if ('@&'.includes(ch)) marks[ch] = { c, r };
    if (makeObject && !'.#~ @&'.includes(ch)) {
      const o = makeObject(ch, c, r, pos);
      if (o) {
        o.c = c; o.r = r; o.ch = ch;
        if (o.mesh) {
          o.mesh.position.copy(pos);
          group.add(o.mesh);
          o.mesh.traverse((n) => { n.userData.obj = o; });
        }
        // Scenery that belongs to an object but must never take clicks (the Lexicon Tree's branches).
        if (o.scenery) {
          o.scenery.position.copy(pos);
          group.add(o.scenery);
        }
        // An object decides its own tile: ports and Rotling spawns are walkable, everything else blocks.
        blocked[r][c] = !o.walkable;
        objects.push(o);
      }
    }
  }));

  // Flowers fill the open floor (not the tiles touching the Lexicon Tree). Mushrooms and grass
  // use a different stride so Extra Credit doesn't sit in the same holes.
  let flowerHeads = null;
  let flowerStems = null;
  let shroomCaps = null;
  let shroomStems = null;
  let grassBlades = null;
  const flowerSpots = [];
  const underSpots = [];
  const nearTree = (c, r) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < H && cc < W && cells[rr][cc] === 'L') return true;
    }
    return false;
  };
  if (flowers) {
    cells.forEach((row, r) => row.forEach((ch, c) => {
      if (ch !== '.' || nearTree(c, r)) return;
      const s = ((c * 31 + r * 17) % 7) / 7;
      flowerSpots.push({ c, r, s });
      if ((c + r * 3) % 4 === 1) underSpots.push({ c, r, s });
    }));
    const petal = new THREE.IcosahedronGeometry(0.17, 0);
    petal.scale(1, 0.55, 1);
    flowerHeads = new THREE.InstancedMesh(petal, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x553355 }), Math.max(1, flowerSpots.length));
    flowerStems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 1, 5), mat(0x3ccf6a, { emissive: 0x0b3a1a }), Math.max(1, flowerSpots.length));
    flowerHeads.count = 0;
    flowerStems.count = 0;
    flowerHeads.frustumCulled = false;
    flowerStems.frustumCulled = false;
    const nUnder = Math.max(1, underSpots.length);
    shroomCaps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 7, 6), new THREE.MeshLambertMaterial({ color: 0xffe2b0 }), nUnder);
    shroomStems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 5), mat(0xfff6ea), nUnder);
    grassBlades = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 1, 0.045), mat(0x7dff6a), nUnder);
    shroomCaps.count = 0;
    shroomStems.count = 0;
    grassBlades.count = 0;
    shroomCaps.frustumCulled = false;
    shroomStems.frustumCulled = false;
    grassBlades.frustumCulled = false;
    group.add(flowerHeads, flowerStems, shroomCaps, shroomStems, grassBlades);
  }
  const FLOWER_COLORS = [0xff7ad9, 0xffd23f, 0x7fe0ff, 0xb98cff, 0xff8f6b, 0x9dff7a].map((c) => new THREE.Color(c));

  // Matrices.
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const v = new THREE.Vector3();
  let build = 1;
  const writeWalls = () => {
    wallCells.forEach((t, i) => {
      const h = Math.max(0.0001, t.h * build);
      v.copy(toWorld(t.c, t.r, h / 2));
      sc.set(1, h, 1);
      walls.setMatrixAt(i, m4.compose(v, q, sc));
      v.y = h + 0.035;
      sc.set(build > 0 ? 1 : 0.0001, 1, build > 0 ? 1 : 0.0001);
      caps.setMatrixAt(i, m4.compose(v, q, sc));
    });
    walls.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
  };
  const setTiles = (k, entry) => {
    floorCells.forEach((t, i) => {
      const d = Math.hypot(t.c - entry.c, t.r - entry.r) / 22;
      const kk = clamp((k - d * 0.5) / 0.5, 0, 1);
      const s = kk <= 0 ? 0.0001 : easeOutBack(kk);
      v.copy(toWorld(t.c, t.r, -0.1 - (1 - kk) * 0.6));
      sc.set(s, 1, s);
      floor.setMatrixAt(i, m4.compose(v, q, sc));
    });
    floor.instanceMatrix.needsUpdate = true;
    build = clamp((k - 0.2) / 0.8, 0, 1);
    writeWalls();
    const ok = clamp((k - 0.45) / 0.55, 0, 1);
    const os = ok <= 0 ? 0.0001 : easeOutBack(ok);
    objects.forEach((o) => { if (o.mesh) o.mesh.scale.setScalar(os * (o.scale || 1)); });
    decorList.forEach((d) => d.scale.setScalar(os));
  };
  setTiles(1.5, { c: 0, r: 0 });

  const camDir = new THREE.Vector2();
  let flowerT = 0;
  let flowerCount = 0;
  let flowerGrowth = 0;
  let underCount = 0;

  const room = {
    W, H, group, cells, blocked, objects, marks, style,
    // Scene entities (the player, Rotlings, the camera) live in world space. Anything parented
    // to the room uses toLocal: the room group may be yawed, and a world position parented
    // onto it would be turned a second time.
    toLocal: (c, r, y = 0) => toWorld(c, r, y),
    toWorld: (c, r, y = 0) => group.localToWorld(toWorld(c, r, y)),
    toCell: (v) => toCell(group.worldToLocal(v.clone())),
    find: (ch) => { const out = []; cells.forEach((row, r) => row.forEach((x, c) => { if (x === ch) out.push({ c, r }); })); return out; },
    isWalkable: (c, r) => inside(c, r) && !blocked[r][c],
    setBlocked: (c, r, b) => { if (inside(c, r)) blocked[r][c] = b; },
    isPort: (c, r) => inside(c, r) && PORTS.has(cells[r][c]),
    neighbors(c, r) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => ({ c: c + dc, r: r + dr })).filter((n) => inside(n.c, n.r)); },
    /** BFS from `from` to any cell for which goal(c, r) is true. Returns the cells to walk (excluding `from`). */
    path(from, goal) {
      const key = (c, r) => r * W + c;
      const prev = new Map([[key(from.c, from.r), null]]);
      const queue = [from];
      while (queue.length) {
        const cur = queue.shift();
        if (goal(cur.c, cur.r)) {
          const out = [];
          let k = key(cur.c, cur.r);
          let node = cur;
          while (prev.get(k)) { out.unshift(node); node = prev.get(k); k = key(node.c, node.r); }
          return out;
        }
        for (const n of this.neighbors(cur.c, cur.r)) {
          const nk = key(n.c, n.r);
          if (prev.has(nk) || blocked[n.r][n.c]) continue;
          prev.set(nk, cur);
          queue.push(n);
        }
      }
      return null;
    },
    animateIn(entry, ms = 900) {
      if (document.documentElement.classList.contains('reduced-motion')) { setTiles(1.5, entry); return Promise.resolve(); }
      return tweenP(ms, (k) => setTiles(k * 1.5, entry));
    },
    /** Turn the whole room so a doorway keeps the direction the player was walking. */
    setYaw(yaw) { group.rotation.y = yaw || 0; },
    /** The floor tile just inside the H door, in map space. */
    insideDoor() {
      let door = null;
      cells.forEach((row, r) => row.forEach((ch, c) => { if (ch === 'H' && !door) door = { c, r }; }));
      if (!door) return null;
      let { c, r } = door;
      if (c === 0) c = 1;
      else if (c === W - 1) c = W - 2;
      else if (r === 0) r = 1;
      else if (r === H - 1) r = H - 2;
      return { c, r };
    },
    /** Outer walls on the camera's side sink so the room stays visible from any angle. */
    setCamera(cameraPos) {
      const local = group.worldToLocal(cameraPos.clone());
      camDir.set(local.x, local.z);
      if (camDir.lengthSq() < 1e-6) return;
      camDir.normalize();
      wallCells.forEach((t) => { if (t.border) t.target = t.normal.dot(camDir) > 0.25 ? LOW : TALL; });
    },
    formBridge(row, instant = false) {
      gapCells.filter((g) => g.r === row).forEach((g, i) => {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.12, 0.8), mat(S.accent, { emissive: S.accent, ei: 0.6 }));
        plank.position.copy(toWorld(g.c, g.r, -0.06));
        group.add(plank);
        blocked[g.r][g.c] = false;
        if (!instant) {
          plank.scale.setScalar(0.001);
          tween(400 + i * 160, (k) => {
            const kk = clamp((k * (400 + i * 160) - i * 160) / 400, 0, 1);
            plank.scale.setScalar(Math.max(0.001, easeOutBack(kk)));
          });
        }
      });
    },
    /** count = how many flowers are planted, growth 0..1 = how tall they stand. */
    setFlowers(count, growth) {
      if (!flowerHeads) return;
      flowerCount = Math.min(flowerSpots.length, Math.max(0, count));
      flowerGrowth = growth;
      room.writeFlowers();
    },
    writeFlowers() {
      if (!flowerHeads) return;
      for (let i = 0; i < flowerCount; i++) {
        const step = Math.max(1, Math.floor(flowerSpots.length / Math.max(1, flowerCount)));
        const spot = flowerSpots[(i * step) % flowerSpots.length];
        const p = toWorld(spot.c, spot.r);
        const ox = (spot.s - 0.5) * 0.28;
        const oz = ((i % 5) - 2) * 0.06;
        const h = (0.25 + spot.s * 0.3) * (0.5 + flowerGrowth * 1.0);
        const sway = Math.sin(flowerT * 1.6 + i) * 0.05;
        v.set(p.x + ox + sway * 0.5, h / 2, p.z + oz);
        sc.set(1, h, 1);
        flowerStems.setMatrixAt(i, m4.compose(v, q, sc));
        v.set(p.x + ox + sway, h + 0.03, p.z + oz);
        const fs = 0.7 + flowerGrowth * 0.6;
        sc.set(fs, fs, fs);
        flowerHeads.setMatrixAt(i, m4.compose(v, q, sc));
        flowerHeads.setColorAt(i, FLOWER_COLORS[(i * 5) % FLOWER_COLORS.length]);
      }
      flowerHeads.count = flowerCount;
      flowerStems.count = flowerCount;
      flowerHeads.instanceMatrix.needsUpdate = true;
      flowerStems.instanceMatrix.needsUpdate = true;
      if (flowerHeads.instanceColor) flowerHeads.instanceColor.needsUpdate = true;
    },
    /** One mushroom and a tuft of grass per Extra Credit find. They stay after the set blooms. */
    setUndergrowth(count) {
      if (!shroomCaps) return;
      underCount = Math.min(underSpots.length, Math.max(0, count));
      room.writeUnder();
    },
    writeUnder() {
      if (!shroomCaps) return;
      for (let i = 0; i < underCount; i++) {
        const spot = underSpots[i % underSpots.length];
        const p = toWorld(spot.c, spot.r);
        const ox = 0.2 + (spot.s - 0.5) * 0.12;
        const oz = -0.16;
        const h = 0.22 + spot.s * 0.12;
        const sway = Math.sin(flowerT * 1.3 + i) * 0.02;
        v.set(p.x + ox + sway, h / 2, p.z + oz);
        sc.set(1, h, 1);
        shroomStems.setMatrixAt(i, m4.compose(v, q, sc));
        v.set(p.x + ox + sway, h + 0.035, p.z + oz);
        sc.set(1, 0.65, 1);
        shroomCaps.setMatrixAt(i, m4.compose(v, q, sc));
        v.set(p.x - ox, 0.16, p.z + 0.18);
        sc.set(1, 0.32 + spot.s * 0.1, 1);
        grassBlades.setMatrixAt(i, m4.compose(v, q, sc));
      }
      shroomCaps.count = underCount;
      shroomStems.count = underCount;
      grassBlades.count = underCount;
      shroomCaps.instanceMatrix.needsUpdate = true;
      shroomStems.instanceMatrix.needsUpdate = true;
      grassBlades.instanceMatrix.needsUpdate = true;
    },
    update(dt) {
      if (streamTex) streamTex.offset.y -= dt * 0.6;
      let moved = false;
      wallCells.forEach((t) => {
        if (Math.abs(t.h - t.target) > 0.002) { t.h += (t.target - t.h) * Math.min(1, dt * 6); moved = true; }
      });
      if (moved && build >= 1) writeWalls();
      decorList.forEach((d) => { if (d.userData.spin) d.userData.spin.rotation.y += dt * 0.5; });
      objects.forEach((o) => o.update && o.update(dt));
      if (flowerCount || underCount) { flowerT += dt; if (flowerCount) room.writeFlowers(); if (underCount) room.writeUnder(); }
    },
    dispose() {
      // Props share module-level geometries, so only free what this room made.
      tileGeo.dispose();
      grid.geometry.dispose();
      plinth.geometry.dispose();
      pe.geometry.dispose();
      if (streamTex) streamTex.dispose();
    },
  };
  return room;
}

export { PORTS };
