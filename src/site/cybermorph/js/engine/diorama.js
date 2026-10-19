/**
 * A room is a 12×9 diorama built from a text map (legend in data/anglo.js).
 * Walls on the back row and left column stand tall, walls on the front row and
 * right column stay low, so the fixed three-quarter camera always sees inside.
 */

import { THREE, R } from './renderer.js';
import { STYLES, mat, decor, glowMat } from './props.js';
import { easeOutBack, clamp, tween, tweenP } from '../core/util.js';

const BLOCKING = new Set(['#', ' ', '~', 'M', 'T', 'G', 'N', 'W', 'C', 'D', 'A', 'O', 'X', 'L', 'o', 'k']);
const PORTS = new Set(['E', 'B', 'H', '1', '2', '3', '4']);

export function buildRoom(map, style, { makeObject } = {}) {
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
  const hemi = new THREE.HemisphereLight(S.sky, S.ground, style === 'lingo' ? 1.6 : 1.15);
  const key = new THREE.DirectionalLight(0xffffff, style === 'lingo' ? 1.5 : 1.1);
  key.position.set(-4, 10, 6);
  const glow = new THREE.PointLight(S.accent, style === 'lingo' ? 2 : 8, 16, 1.6);
  glow.position.set(0, 3, 0);
  group.add(hemi, key, glow);

  // Plinth: the diorama sits on a dark slab like a model on a table.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.8, H + 0.4), mat(style === 'lingo' ? 0x8b95a3 : 0x0b0814));
  plinth.position.y = -0.52;
  group.add(plinth);
  const pe = new THREE.LineSegments(new THREE.EdgesGeometry(plinth.geometry), new THREE.LineBasicMaterial({ color: S.line, transparent: true, opacity: 0.55 }));
  pe.position.copy(plinth.position);
  group.add(pe);

  // Floor tiles (instanced) and the glowing grid lines.
  const floorCells = [];
  const wallCells = [];
  cells.forEach((row, r) => row.forEach((ch, c) => {
    if (ch === '#') wallCells.push({ c, r });
    else if (ch !== ' ' && ch !== '~') floorCells.push({ c, r });
  }));
  const tileGeo = new THREE.BoxGeometry(0.97, 0.2, 0.97);
  const floor = new THREE.InstancedMesh(tileGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), floorCells.length);
  const cA = new THREE.Color(S.floorA);
  const cB = new THREE.Color(S.floorB);
  floorCells.forEach((t, i) => floor.setColorAt(i, (t.c + t.r) % 2 ? cA : cB));
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
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: S.line, transparent: true, opacity: style === 'lingo' ? 0.18 : 0.3 }));
  group.add(grid);

  const wallH = ({ c, r }) => (r === 0 || c === 0 ? 1.4 : r === H - 1 || c === W - 1 ? 0.28 : 0.95);
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(S.wall), wallCells.length);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), mat(S.wallTop, { emissive: S.line, ei: style === 'lingo' ? 0 : 0.08 }), wallCells.length);
  group.add(walls, caps);

  // The gap and its data stream.
  const gapCells = [];
  cells.forEach((row, r) => row.forEach((ch, c) => { if (ch === '~') gapCells.push({ c, r }); }));
  let streamTex = null;
  if (gapCells.length) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const x = cv.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${new THREE.Color(S.accent).toArray().map((v) => Math.round(v * 255)).join(',')},${0.2 + Math.random() * 0.6})`;
      x.fillRect(Math.random() * 64, Math.random() * 256, 2, 10 + Math.random() * 30);
    }
    streamTex = new THREE.CanvasTexture(cv);
    streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping;
    gapCells.forEach(({ c, r }) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, opacity: 0.8 }));
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
      if (style === 'lingo' && ch === 'k') { d.position.x -= 0.4; }
      d.rotation.y = style === 'lingo' && ch === 'o' ? Math.PI : (r === 0 ? 0 : c === 0 ? Math.PI / 2 : c === W - 1 ? -Math.PI / 2 : r === H - 1 ? Math.PI : 0);
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
        // An object decides its own tile: ports and Rotling spawns are walkable, everything else blocks.
        blocked[r][c] = !o.walkable;
        objects.push(o);
      }
    }
  }));

  // Matrices for build-in animation.
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const v = new THREE.Vector3();
  const setTiles = (k, entry) => {
    floorCells.forEach((t, i) => {
      const d = Math.hypot(t.c - entry.c, t.r - entry.r) / 14;
      const kk = clamp((k - d * 0.5) / 0.5, 0, 1);
      const s = kk <= 0 ? 0.0001 : easeOutBack(kk);
      v.copy(toWorld(t.c, t.r, -0.1 - (1 - kk) * 0.6));
      sc.set(s, 1, s);
      floor.setMatrixAt(i, m4.compose(v, q, sc));
    });
    floor.instanceMatrix.needsUpdate = true;
    wallCells.forEach((t, i) => {
      const d = Math.hypot(t.c - entry.c, t.r - entry.r) / 14;
      const kk = clamp((k - d * 0.5 - 0.1) / 0.5, 0, 1);
      const h = Math.max(0.0001, wallH(t) * kk);
      v.copy(toWorld(t.c, t.r, h / 2));
      sc.set(1, h, 1);
      walls.setMatrixAt(i, m4.compose(v, q, sc));
      v.y = h + 0.03;
      sc.set(kk > 0 ? 1 : 0.0001, 1, kk > 0 ? 1 : 0.0001);
      caps.setMatrixAt(i, m4.compose(v, q, sc));
    });
    walls.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    const ok = clamp((k - 0.45) / 0.55, 0, 1);
    const os = ok <= 0 ? 0.0001 : easeOutBack(ok);
    objects.forEach((o) => { if (o.mesh) o.mesh.scale.setScalar(os); });
    decorList.forEach((d) => d.scale.setScalar(os));
  };
  setTiles(1, { c: 0, r: 0 });

  const bridges = [];
  const room = {
    W, H, group, cells, blocked, objects, marks, style, toWorld, toCell,
    find: (ch) => { const out = []; cells.forEach((row, r) => row.forEach((x, c) => { if (x === ch) out.push({ c, r }); })); return out; },
    isWalkable: (c, r) => inside(c, r) && !blocked[r][c],
    setBlocked: (c, r, b) => { if (inside(c, r)) blocked[r][c] = b; },
    isPort: (c, r) => inside(c, r) && PORTS.has(cells[r][c]),
    neighbors(c, r) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => ({ c: c + dc, r: r + dr })).filter((n) => inside(n.c, n.r)); },
    /** BFS from `from` to any cell for which goal(c, r) is true. Returns the list of cells to walk (excluding `from`). */
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
    /** Build-in animation from an entry cell; returns a promise. */
    animateIn(entry, ms = 750) {
      if (document.documentElement.classList.contains('reduced-motion')) { setTiles(1, entry); return Promise.resolve(); }
      return tweenP(ms, (k) => setTiles(k * 1.5, entry));
    },
    formBridge(row, instant = false) {
      gapCells.filter((g) => g.r === row).forEach((g, i) => {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.12, 0.8), mat(S.accent, { emissive: S.accent, ei: 0.6 }));
        plank.position.copy(toWorld(g.c, g.r, -0.06));
        group.add(plank);
        bridges.push(plank);
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
    update(dt) {
      if (streamTex) streamTex.offset.y -= dt * 0.6;
      decorList.forEach((d) => { if (d.userData.spin) d.userData.spin.rotation.y += dt * 0.5; });
      objects.forEach((o) => o.update && o.update(dt));
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

export { PORTS, glowMat };
