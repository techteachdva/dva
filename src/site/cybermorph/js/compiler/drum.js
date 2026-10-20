/**
 * The Morph Compiler: a drum of rotating rings, one ring per matrix column.
 *
 * Columns read left to right (prefix · base · suffix), one piece per column,
 * the rule from Ramsden's word matrix. Each ring is a prism; every face is a
 * morpheme tile whose SHAPE shows its type, so the structure is learned by eye.
 * A ring with a single option is fixed (firewall locks hold the base still). It is still drawn as a
 * full dial, every face showing its one morpheme, so the base reads like any other ring.
 */

import { THREE, R, toScreen } from '../engine/renderer.js';
import { morphemeTexture, TYPE_COLOR } from '../engine/textures.js';
import { mat, glowMat, box, cyl } from '../engine/props.js';
import { morph } from '../data/morphemes.js';
import { tween, ease } from '../core/util.js';
import { sfx } from '../core/audio.js';

const FACE_H = 1.0;
const GAP = 0.22;

function specOf(opt) {
  if (opt.blank) return { spec: { text: '—', type: opt.type || 'sfx', origin: 'latin' }, blank: true };
  if (opt.id) return { spec: opt.id };
  return { spec: { text: opt.text, type: opt.type || 'word', origin: opt.origin || 'lingo' } };
}

function typeOf(opt) {
  if (opt.id) return morph(opt.id).type;
  return opt.type || 'word';
}

export function createDrum(columns) {
  const root = new THREE.Group();
  const own = []; // geometries made here (props share theirs, so leave those alone)
  const rings = [];
  let totalW = 0;

  columns.forEach((col) => {
    const opts = col.options;
    const n = opts.length;
    const fixed = n === 1;
    // Up to 8 physical faces. Longer rings are "virtual": faces swap textures as they roll out of sight.
    const N = n > 8 ? 8 : n >= 4 ? n : n * Math.ceil(4 / n);
    const step = (Math.PI * 2) / N;
    const texes = opts.map((o) => { const s = specOf(o); return morphemeTexture(s.spec, { blank: !!s.blank }); });
    const maxAspect = Math.max(...texes.map((t) => t.aspect));
    const ringW = FACE_H * maxAspect * 0.86;
    const apothem = (FACE_H / 2) / Math.tan(Math.PI / N);
    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);
    const firstReal = opts.find((o) => !o.blank) || opts[0];
    const type = col.type || typeOf(firstReal);
    const rimColor = new THREE.Color(TYPE_COLOR[type] || '#ffffff').getHex();

    const core = cyl(apothem * 0.96, ringW * 0.98, mat(0x1b1c26), 0, 0, 0, N <= 8);
    core.rotation.z = Math.PI / 2;
    spin.add(core);
    const pg = new THREE.PlaneGeometry(FACE_H * maxAspect * 0.86, FACE_H * 0.86);
    own.push(pg);
    const faces = [];
    for (let f = 0; f < N; f++) {
      const plane = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.3, toneMapped: false }));
      const pivot = new THREE.Group();
      pivot.rotation.x = f * step;
      plane.position.z = apothem + 0.012;
      pivot.add(plane);
      spin.add(pivot);
      faces.push(plane);
    }
    const rims = [];
    {
      [-1, 1].forEach((s) => {
        const tg = new THREE.TorusGeometry(apothem / Math.cos(Math.PI / N) + 0.02, 0.035, 6, Math.max(12, N * 3));
        own.push(tg);
        const rim = new THREE.Mesh(tg, glowMat(rimColor));
        rim.rotation.y = Math.PI / 2;
        rim.position.x = s * ringW * 0.5;
        g.add(rim);
        rims.push(rim);
      });
    }
    const mod = (a, b) => ((a % b) + b) % b;
    const ring = {
      col, group: g, spin, rims, n, N, step, fixed, ringW, apothem, faces,
      face: col.index ?? 0,
      get sel() { return mod(this.face, this.n); },
      angle: 0,
      /** Paint the faces around the current position with the right options. */
      refresh() {
        const half = Math.floor(N / 2);
        for (let k = -half + 1; k <= half; k++) {
          const t = texes[mod(this.face + k, n)];
          const plane = faces[mod(this.face + k, N)];
          if (plane.material.map !== t.texture) { plane.material.map = t.texture; plane.material.needsUpdate = true; }
          plane.scale.x = t.aspect / maxAspect;
        }
      },
    };
    ring.angle = -ring.face * step;
    spin.rotation.x = ring.angle;
    ring.refresh();
    rings.push(ring);
    totalW += ringW;
  });
  totalW += GAP * (rings.length - 1);

  let x = -totalW / 2;
  rings.forEach((r) => {
    r.group.position.x = x + r.ringW / 2;
    x += r.ringW + GAP;
    root.add(r.group);
  });

  // Console base and axle.
  const maxA = Math.max(0.5, ...rings.map((r) => r.apothem));
  const base = box(totalW + 1.0, 0.32, 1.7, mat(0x161722), 0, -maxA - 0.55, 0);
  const strip = box(totalW + 1.02, 0.05, 0.05, glowMat(0x00e5ff), 0, -maxA - 0.4, 0.86);
  const axle = cyl(0.06, totalW + 0.6, mat(0x555a66), 0, 0, 0);
  axle.rotation.z = Math.PI / 2;
  const capL = cyl(0.22, 0.12, mat(0x2a2c38), -totalW / 2 - 0.32, 0, 0);
  const capR = cyl(0.22, 0.12, mat(0x2a2c38), totalW / 2 + 0.32, 0, 0);
  capL.rotation.z = capR.rotation.z = Math.PI / 2;
  root.add(base, strip, axle, capL, capR);

  // Spark burst for a successful compile.
  const P = 90;
  const pGeo = new THREE.BufferGeometry();
  own.push(pGeo);
  const pos = new Float32Array(P * 3);
  const vel = new Float32Array(P * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x9dff7a, size: 0.09, transparent: true, opacity: 0, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  root.add(points);
  let pLife = 0;

  let focusIdx = rings.findIndex((r) => !r.fixed);
  if (focusIdx < 0) focusIdx = 0;

  const fitCamera = () => {
    const cam = R.focusCam;
    const vfov = THREE.MathUtils.degToRad(cam.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    const byW = (totalW / 2 + 0.9) / Math.tan(hfov / 2) / 0.82;
    const byH = (maxA * 2 + 1.6) / 2 / Math.tan(vfov / 2) / 0.5;
    const d = Math.max(byW, byH, 6);
    // Sit the drum at about 40% of the screen height, leaving room below for the arrows,
    // the meaning labels and the word-sum bar.
    const lift = 0.2 * Math.tan(vfov / 2) * d;
    cam.position.set(0, 0.25 - lift, d);
    cam.lookAt(0, -0.05 - lift, 0);
    cam.updateProjectionMatrix();
  };

  const drum = {
    root, rings,
    get focus() { return focusIdx; },
    selection() { return rings.map((r) => r.col.options[r.sel]); },
    turn(i, dir) {
      const r = rings[i];
      if (!r || r.fixed) return;
      r.face += dir;
      const from = r.angle;
      const to = -r.face * r.step;
      r.angle = to;
      r.refresh();
      sfx.tick();
      tween(170, (k) => { r.spin.rotation.x = from + (to - from) * ease(k); });
      drum.onChange && drum.onChange();
    },
    setFocus(i) {
      if (i < 0 || i >= rings.length) return;
      focusIdx = i;
      rings.forEach((r, j) => r.rims.forEach((m) => { m.scale.setScalar(j === i ? 1.12 : 1); }));
    },
    moveFocus(dir) {
      let i = focusIdx;
      for (let k = 0; k < rings.length; k++) {
        i = (i + dir + rings.length) % rings.length;
        if (!rings[i].fixed) { drum.setFocus(i); return; }
      }
    },
    /** Screen positions for the DOM arrows and gloss labels. */
    screenSlots() {
      return rings.map((r) => {
        const top = toScreen(new THREE.Vector3(r.group.position.x, r.apothem + 0.45, 0), R.focusCam);
        const bottom = toScreen(new THREE.Vector3(r.group.position.x, -r.apothem - 0.3, 0.3), R.focusCam);
        const left = toScreen(new THREE.Vector3(r.group.position.x - r.ringW / 2, 0, 0), R.focusCam);
        const right = toScreen(new THREE.Vector3(r.group.position.x + r.ringW / 2, 0, 0), R.focusCam);
        return { x: top.x, top: top.y, bottom: bottom.y, width: right.x - left.x };
      });
    },
    flash(good) {
      const color = new THREE.Color(good ? 0x9dff7a : 0xff3b5c);
      rings.forEach((r) => r.rims.forEach((m) => {
        const orig = m.material;
        m.material = glowMat(color.getHex());
        setTimeout(() => { m.material = orig; }, 650);
      }));
      if (good) {
        for (let i = 0; i < P; i++) {
          pos[i * 3] = (Math.random() - 0.5) * totalW;
          pos[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
          pos[i * 3 + 2] = 0.6;
          vel[i * 3] = (Math.random() - 0.5) * 3;
          vel[i * 3 + 1] = Math.random() * 3 + 1;
          vel[i * 3 + 2] = Math.random() * 2;
        }
        pLife = 1;
      } else {
        tween(400, (k) => { root.position.x = k < 1 ? Math.sin(k * 40) * 0.08 * (1 - k) : 0; });
      }
    },
    update(dt) {
      if (pLife > 0) {
        pLife -= dt * 1.1;
        for (let i = 0; i < P; i++) {
          vel[i * 3 + 1] -= dt * 5;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        pGeo.attributes.position.needsUpdate = true;
        pMat.opacity = Math.max(0, pLife);
      }
    },
    fitCamera,
    hitRing(object) {
      let o = object;
      while (o) {
        const idx = rings.findIndex((r) => r.group === o);
        if (idx >= 0) return idx;
        o = o.parent;
      }
      return -1;
    },
    dispose() {
      own.forEach((g) => g.dispose());
    },
  };
  drum.setFocus(focusIdx);
  fitCamera();
  return drum;
}
