/**
 * The Morpher (player avatar), the four mentors, Rotlings and morpheme pickups.
 * Every character is a few boxes and spheres: cheap to draw, easy to read from the diorama camera.
 */

import { createMrPhil, d20Mesh } from './classroom.js';
import { THREE } from './renderer.js';
import { box, cyl, sphere, ring, mat, glowMat, screen } from './props.js';
import { patternTexture, faceTexture, labelSprite, morphemeTexture, screenTexture } from './textures.js';
import { AVATAR } from '../data/world.js';

const partById = (cat, id) => AVATAR[cat].find((p) => p.id === id) || AVATAR[cat][0];
const partMat = (p) => mat(0xffffff, { map: patternTexture(p.pattern, p.color), emissive: p.pattern === 'glow' ? new THREE.Color(p.color).getHex() : 0x000000, ei: p.pattern === 'glow' ? 0.35 : 1 });

/** Head shapes. Each returns the head group and the height of its top (where the topper sits). */
function buildHead(part, face, headMat) {
  const g = new THREE.Group();
  const shape = part.shape || 'box';
  const faceTex = faceTexture(face.pattern, face.color);
  if (shape === 'round') {
    const ball = sphere(0.25, headMat, 0, 0, 0);
    ball.scale.multiply(new THREE.Vector3(1, 0.86, 0.95));
    // The face wraps onto the front of the ball (a patch of sphere just above its surface).
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.505, 20, 14, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.48, 0.96), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false }));
    ball.add(patch);
    g.add(ball);
    return { g, top: 0.2 };
  }
  if (shape === 'tv') {
    const wood = mat(new THREE.Color(part.color).getHex());
    g.add(box(0.52, 0.38, 0.38, wood, 0, 0, 0), box(0.4, 0.3, 0.02, mat(0x2a2a2a), -0.03, 0, 0.19), screen(0.33, 0.24, faceTex, -0.03, 0, 0.201));
    g.add(cyl(0.022, 0.02, mat(0xd9c39a), 0.21, 0.07, 0.19), cyl(0.022, 0.02, mat(0xd9c39a), 0.21, -0.03, 0.19));
    g.children.slice(-2).forEach((k) => { k.rotation.x = Math.PI / 2; });
    return { g, top: 0.19 };
  }
  if (shape === 'prism') {
    // A six-sided prism with a flat face to the front for the face screen.
    const gem = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.38, 6), headMat);
    gem.rotation.y = Math.PI / 6;
    g.add(gem, screen(0.24, 0.2, faceTex, 0, 0, 0.237));
    return { g, top: 0.19 };
  }
  if (shape === 'd20') {
    // The Critical d20 head: the die itself, 20 facing forward.
    const { die, faces } = d20Mesh(0.27);
    const twenty = faces.find((f) => f.num === 20);
    die.quaternion.setFromUnitVectors(twenty.n, new THREE.Vector3(0, 0, 1));
    const holder = new THREE.Group();
    holder.add(die);
    g.add(holder);
    return { g, top: 0.24, spin: holder };
  }
  g.add(box(0.46, 0.36, 0.38, headMat, 0, 0, 0), screen(0.36, 0.26, faceTex, 0, 0, 0.192));
  return { g, top: 0.18 };
}

/** Toppers: small objects on the head. Returns the group plus anything that animates. */
function buildTopper(part, face, headTop) {
  const g = new THREE.Group();
  const c = new THREE.Color(part.color).getHex();
  const anim = {};
  const add = (...m) => g.add(...m);
  switch (part.id) {
    case 'p-none': break;
    case 'p-propeller': {
      add(cyl(0.02, 0.1, mat(0x888899), 0, 0.05, 0), sphere(0.035, mat(c), 0, 0.11, 0));
      const blades = new THREE.Group();
      blades.add(box(0.36, 0.012, 0.06, mat(c), 0, 0, 0), box(0.06, 0.012, 0.36, mat(0xffd23f), 0, 0, 0));
      blades.position.y = 0.12;
      add(blades);
      anim.spinY = blades;
      break;
    }
    case 'p-cap': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c));
      add(dome, box(0.28, 0.02, 0.18, mat(c), 0, 0.005, 0.24), sphere(0.025, mat(0xffffff), 0, 0.22, 0));
      break;
    }
    case 'p-bow': {
      const l = sphere(0.07, mat(c), -0.08, 0.06, 0); l.scale.multiply(new THREE.Vector3(1.4, 1, 0.6));
      const r = sphere(0.07, mat(c), 0.08, 0.06, 0); r.scale.multiply(new THREE.Vector3(1.4, 1, 0.6));
      add(l, r, sphere(0.04, mat(0xd02a6a), 0, 0.06, 0));
      g.position.x = 0.12;
      break;
    }
    case 'p-horns': {
      add(cyl(0.24, 0.07, mat(0x8a7a5a), 0, 0.02, 0));
      [-1, 1].forEach((sd) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 10), mat(c));
        horn.position.set(sd * 0.22, 0.1, 0);
        horn.rotation.z = -sd * 0.9;
        add(horn);
      });
      break;
    }
    case 'p-laurel': {
      const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 20), mat(c));
      wreath.rotation.x = Math.PI / 2;
      wreath.position.y = -0.02;
      add(wreath);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const leaf = sphere(0.035, mat(0x7fdc5a), Math.cos(a) * 0.2, 0.0, Math.sin(a) * 0.2); leaf.scale.multiply(new THREE.Vector3(1.6, 0.6, 0.8)); leaf.rotation.y = -a; add(leaf); }
      break;
    }
    case 'p-dish': {
      add(cyl(0.02, 0.12, mat(0x888899), 0, 0.06, 0));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3), mat(c, { side: THREE.DoubleSide }));
      dish.position.y = 0.16;
      dish.rotation.x = -0.7;
      add(dish, sphere(0.025, glowMat(0x38b6ff), 0, 0.2, 0.06));
      anim.spinY = dish;
      break;
    }
    case 'p-tophat':
      add(cyl(0.2, 0.025, mat(c), 0, 0.012, 0), cyl(0.13, 0.26, mat(c), 0, 0.14, 0), cyl(0.132, 0.04, mat(0xe6b84a), 0, 0.05, 0));
      break;
    case 'p-headphones': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 6, 20, Math.PI), mat(c));
      band.position.y = -headTop * 0.5;
      add(band);
      [-1, 1].forEach((sd) => { const cup = cyl(0.08, 0.06, mat(0xff3b5c), sd * 0.26, -headTop * 0.5, 0); cup.rotation.z = Math.PI / 2; add(cup); });
      break;
    }
    case 'p-halo': {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 24), glowMat(c));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.14;
      add(halo);
      anim.bob = halo;
      break;
    }
    case 'p-crown': {
      const gold = mat(c, { emissive: 0x6b4a10 });
      add(cyl(0.17, 0.08, gold, 0, 0.04, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), gold);
        spike.position.set(Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15);
        add(spike, sphere(0.018, glowMat([0xff3b5c, 0x38b6ff, 0x3cff7a, 0xffffff, 0xb98cff][i]), Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17));
      }
      break;
    }
    case 'p-bulb': {
      add(cyl(0.05, 0.06, mat(0x9aa1ab), 0, 0.03, 0));
      const bulb = sphere(0.09, glowMat(c), 0, 0.14, 0);
      add(bulb);
      anim.pulse = bulb;
      break;
    }
    case 'p-sprout': {
      add(cyl(0.012, 0.16, mat(0x2f8a3a), 0, 0.08, 0));
      [-1, 1].forEach((sd) => { const leaf = sphere(0.06, mat(c), sd * 0.06, 0.16, 0); leaf.scale.multiply(new THREE.Vector3(1.4, 0.45, 0.8)); leaf.rotation.z = sd * 0.5; add(leaf); });
      anim.sway = g;
      break;
    }
    case 'p-grad': {
      add(cyl(0.15, 0.08, mat(c), 0, 0.03, 0), box(0.42, 0.025, 0.42, mat(c), 0, 0.08, 0), sphere(0.02, mat(0xffd23f), 0, 0.1, 0));
      const tassel = box(0.012, 0.14, 0.012, mat(0xffd23f), 0.19, 0.02, 0.19);
      add(tassel);
      anim.sway = tassel;
      break;
    }
    case 'p-books': {
      [[0xc0392b, 0.0, 0.3], [0x2f6fde, 0.05, -0.2], [0x1fa33a, 0.1, 0.15]].forEach(([col, y, rot]) => {
        const book = box(0.3, 0.05, 0.22, mat(col), 0, 0.03 + y, 0);
        book.rotation.y = rot;
        add(book, box(0.28, 0.04, 0.2, mat(0xf4f4ef), 0.012, 0.03 + y, 0));
      });
      break;
    }
    case 'p-goggles': {
      add(box(0.5, 0.05, 0.05, mat(0x2a2f38), 0, -0.07, 0.17));
      [-0.1, 0.1].forEach((x) => {
        const lens = cyl(0.075, 0.06, mat(c, { emissive: c, ei: 0.4 }), x, -0.04, 0.18);
        lens.rotation.x = Math.PI / 2;
        add(lens);
      });
      break;
    }
    case 'p-orbit': {
      const rings = new THREE.Group();
      [0, 1].forEach((i) => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.3 + i * 0.05, 0.012, 6, 32), glowMat(i ? 0xff4fd8 : c));
        r.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4);
        rings.add(r, sphere(0.035, glowMat(i ? 0x38b6ff : 0x9dff7a), (0.3 + i * 0.05) * (i ? -1 : 1), 0, 0));
      });
      rings.position.y = -0.1;
      add(rings);
      anim.spinY = rings;
      break;
    }
    case 'p-curls': {
      // Mr. Phil's wild curls, robot sized.
      let seed = 4242;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2;
        const rad = rnd() * 0.2;
        add(sphere(0.045 + rnd() * 0.03, mat(c), Math.cos(a) * rad, 0.02 + rnd() * 0.1 + (rad < 0.1 ? 0.05 : 0), Math.sin(a) * rad * 0.9));
      }
      break;
    }
    default: {
      // Antenna: its bulb glows in the face colour.
      add(cyl(0.015, 0.16, mat(0x888899), 0, 0.08, 0));
      const bulb = sphere(0.045, glowMat(new THREE.Color(face.color).getHex()), 0, 0.17, 0);
      add(bulb);
      anim.pulse = bulb;
    }
  }
  return { g, anim };
}

export function createMorpher(avatar) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const parts = {};
  let topAnim = {};
  let headSpin = null;
  const build = (av) => {
    body.clear();
    const limbs = partMat(partById('limbs', av.limbs));
    const torso = partMat(partById('torso', av.torso));
    const headPart = partById('head', av.head);
    const face = partById('face', av.face);
    parts.legL = box(0.13, 0.3, 0.15, limbs, -0.1, 0.15, 0);
    parts.legR = box(0.13, 0.3, 0.15, limbs, 0.1, 0.15, 0);
    parts.torso = box(0.44, 0.38, 0.3, torso, 0, 0.5, 0);
    parts.armL = box(0.1, 0.34, 0.11, limbs, -0.29, 0.5, 0);
    parts.armR = box(0.1, 0.34, 0.11, limbs, 0.29, 0.5, 0);
    const head = buildHead(headPart, face, partMat(headPart));
    head.g.position.y = 0.9;
    parts.head = head.g;
    headSpin = head.spin || null;
    const top = buildTopper(partById('top', av.top), face, head.top);
    top.g.position.y += 0.9 + head.top;
    parts.top = top.g;
    topAnim = top.anim;
    Object.values(parts).forEach((m) => body.add(m));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.11;
    body.add(shadow);
  };
  build(avatar);
  body.scale.setScalar(1.35);
  let t = 0;
  let clock = 0;
  return {
    group: g,
    setAvatar: build,
    update(dt, moving) {
      t += dt * (moving ? 11 : 2.2);
      clock += dt;
      const s = moving ? Math.sin(t) : 0;
      parts.legL.rotation.x = s * 0.6;
      parts.legR.rotation.x = -s * 0.6;
      parts.armL.rotation.x = -s * 0.5;
      parts.armR.rotation.x = s * 0.5;
      body.position.y = 0.1 + (moving ? Math.abs(Math.sin(t)) * 0.05 : Math.sin(t) * 0.015);
      if (topAnim.pulse) {
        const p = topAnim.pulse;
        if (!p.userData.base) p.userData.base = p.scale.x;
        p.scale.setScalar(p.userData.base * (1 + Math.sin(clock * 3) * 0.12));
      }
      if (topAnim.spinY) topAnim.spinY.rotation.y += dt * (moving ? 14 : 4);
      if (topAnim.bob) topAnim.bob.position.y = 0.14 + Math.sin(clock * 2) * 0.03;
      if (topAnim.sway) topAnim.sway.rotation.z = Math.sin(clock * 2.4) * 0.12;
      if (headSpin) headSpin.rotation.y = Math.sin(clock * 0.8) * 0.25;
    },
  };
}

export function createMentor(id) {
  const g = new THREE.Group();
  const anim = { t: 0, bob: null, spin: null };
  if (id === 'wynn') {
    const rust = mat(0x6b4515);
    g.add(box(0.7, 0.14, 0.5, mat(0x222222), 0, 0.17, 0));
    g.add(box(0.55, 0.55, 0.42, rust, 0, 0.55, 0));
    const head = new THREE.Group();
    head.add(box(0.6, 0.48, 0.5, mat(0x3d270e), 0, 0, 0));
    head.add(screen(0.46, 0.34, faceTexture('smile', '#ffb000'), 0, 0, 0.255));
    head.add(cyl(0.015, 0.25, mat(0x999999), 0.18, 0.35, 0), sphere(0.05, glowMat(0xffb000), 0.18, 0.5, 0));
    head.position.y = 1.08;
    g.add(head);
    g.add(box(0.1, 0.4, 0.1, rust, -0.34, 0.6, 0), box(0.1, 0.4, 0.1, rust, 0.34, 0.6, 0));
    anim.bob = head;
  } else if (id === 'aurelia') {
    const marble = mat(0xd3d6dc);
    g.add(cyl(0.3, 0.6, marble, 0, 0.3, 0), box(0.5, 0.08, 0.5, mat(0xb1b4bb), 0, 0.62, 0));
    const bust = new THREE.Group();
    bust.add(box(0.5, 0.22, 0.25, marble, 0, 0, 0));
    bust.add(sphere(0.2, marble, 0, 0.3, 0));
    bust.add(sphere(0.035, glowMat(0x9fc6ff), -0.07, 0.33, 0.18), sphere(0.035, glowMat(0x9fc6ff), 0.07, 0.33, 0.18));
    const laurel = ring(0.24, glowMat(0x9dff7a), 0, 0.42, 0);
    laurel.rotation.x = Math.PI / 2;
    bust.add(laurel);
    bust.position.y = 1.0;
    g.add(bust);
    anim.bob = bust;
    anim.spin = laurel;
  } else if (id === 'theo') {
    const navy = mat(0x22407e);
    g.add(cyl(0.22, 0.7, navy, 0, 0.35, 0));
    g.add(sphere(0.24, mat(0x14244e), 0, 0.82, 0));
    g.add(sphere(0.06, glowMat(0x38b6ff), 0, 0.84, 0.22));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xdfe8ff, { side: THREE.DoubleSide }));
    dish.position.y = 1.18;
    dish.rotation.x = -0.6;
    g.add(dish, cyl(0.02, 0.3, mat(0xaaaaaa), 0, 1.15, 0));
    g.add(box(0.07, 0.4, 0.07, navy, -0.28, 0.55, 0), box(0.07, 0.4, 0.07, navy, 0.28, 0.55, 0));
    anim.spin = dish;
  } else if (id === 'phil') {
    // Mr. Phil is a person, not a robot (see engine/classroom.js).
    return createMrPhil();
  } else {
    // Fallback: a screen-head teacher avatar.
    g.add(box(0.13, 0.42, 0.15, mat(0x2b3550), -0.1, 0.21, 0), box(0.13, 0.42, 0.15, mat(0x2b3550), 0.1, 0.21, 0));
    g.add(box(0.46, 0.46, 0.3, mat(0x1f8a8a), 0, 0.65, 0));
    g.add(box(0.1, 0.42, 0.11, mat(0x1f8a8a), -0.3, 0.66, 0), box(0.1, 0.42, 0.11, mat(0x1f8a8a), 0.3, 0.66, 0));
    g.add(box(0.06, 0.24, 0.02, mat(0xe03b3b), 0, 0.68, 0.16), box(0.12, 0.08, 0.02, mat(0xffffff), 0, 0.53, 0.17));
    const head = new THREE.Group();
    head.add(box(0.5, 0.4, 0.4, mat(0xf3f5f8), 0, 0, 0));
    head.add(screen(0.4, 0.3, faceTexture('glasses', '#2f6fde'), 0, 0, 0.205));
    const tag = labelSprite('MR. PHIL', { color: '#ffffff', bg: 'rgba(47,111,222,0.9)', height: 0.16 });
    tag.position.set(0, 0.32, 0);
    head.add(tag);
    head.position.y = 1.1;
    g.add(head);
    anim.bob = head;
  }
  return {
    group: g,
    update(dt) {
      anim.t += dt;
      if (anim.bob) anim.bob.position.y += Math.sin(anim.t * 2) * 0.0015;
      if (anim.spin) anim.spin.rotation.z += dt * 0.8;
    },
  };
}

const ROT_BODY = mat(0x2b0f3d, { emissive: 0x3d1a5c, ei: 0.4 });
const ROT_GLOW = glowMat(0x7dff3a);
const GOLD_BODY = mat(0x6b4a08, { emissive: 0xb07a10, ei: 0.55 });
const GOLD_GLOW = glowMat(0xffd23f);
const RET_GLOW = glowMat(0xff5c7a);

/** A Rotling. Golden ones carry a long bonus word; Rot Return ones glow red. */
export function createRotling(word, { boss = false, review = false, golden = false, ret = false } = {}) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const segs = Math.min(5, Math.max(2, Math.ceil(word.length / 3)));
  const scale = boss ? 2.6 : golden ? 1.6 : 1.4;
  const body = [];
  for (let i = 0; i < segs; i++) {
    const s = sphere(0.2 - i * 0.02, golden ? GOLD_BODY : ROT_BODY, (i - (segs - 1) / 2) * 0.2, 0.32, Math.sin(i) * 0.05);
    inner.add(s);
    body.push(s);
  }
  const eyeMat = glowMat(review || golden ? 0xffd23f : ret ? 0xff5c7a : 0x7dff3a);
  const headX = ((segs - 1) / 2) * 0.2;
  inner.add(sphere(0.05, eyeMat, headX + 0.06, 0.42, 0.15), sphere(0.05, eyeMat, headX - 0.06, 0.42, 0.15));
  const orbit = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = box(0.08, 0.08, 0.08, golden ? GOLD_GLOW : ret ? RET_GLOW : ROT_GLOW, Math.cos(i * 1.57) * 0.45, 0.4 + (i % 2) * 0.12, Math.sin(i * 1.57) * 0.45);
    orbit.add(c);
  }
  inner.add(orbit);
  const tone = review || golden ? '#ffd23f' : ret ? '#ff8aa0' : null;
  const label = labelSprite(word, { color: tone || '#c8ff9e', bg: 'rgba(20,6,30,0.85)', border: tone || '#7dff3a', height: boss ? 0.24 : 0.28 });
  label.position.y = 0.95;
  inner.add(label);
  inner.scale.setScalar(scale);
  let t = Math.random() * 10;
  return {
    group: g,
    label,
    update(dt) {
      t += dt;
      body.forEach((s, i) => { s.position.y = 0.32 + Math.sin(t * 4 + i) * 0.03; });
      orbit.rotation.y += dt * (boss ? 1.4 : 2.2);
      inner.rotation.z = Math.sin(t * 3) * 0.05;
    },
  };
}

/** A loose morpheme floating above the floor, picked up by walking over it. */
export function createPickup(id) {
  const g = new THREE.Group();
  const { texture, aspect } = morphemeTexture(id);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * aspect, 0.34), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 }));
  plane.position.y = 0.55;
  const halo = ring(0.25, glowMat(0x9dff7a, 0.8), 0, 0.14, 0);
  halo.rotation.x = Math.PI / 2;
  g.add(plane, halo);
  let t = Math.random() * 6;
  return {
    group: g,
    update(dt) {
      t += dt;
      plane.rotation.y += dt * 1.6;
      plane.position.y = 0.55 + Math.sin(t * 2.5) * 0.06;
    },
  };
}

export { screenTexture };
