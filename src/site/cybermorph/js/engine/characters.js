/**
 * The Morpher (player avatar), the four mentors, Rotlings and morpheme pickups.
 * Every character is a few boxes and spheres: cheap to draw, easy to read from the diorama camera.
 */

import { THREE } from './renderer.js';
import { box, cyl, sphere, ring, mat, glowMat, screen } from './props.js';
import { patternTexture, faceTexture, labelSprite, morphemeTexture, screenTexture } from './textures.js';
import { AVATAR } from '../data/world.js';

const partById = (cat, id) => AVATAR[cat].find((p) => p.id === id) || AVATAR[cat][0];
const partMat = (p) => mat(0xffffff, { map: patternTexture(p.pattern, p.color), emissive: p.pattern === 'glow' ? new THREE.Color(p.color).getHex() : 0x000000, ei: p.pattern === 'glow' ? 0.35 : 1 });

export function createMorpher(avatar) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const parts = {};
  const build = (av) => {
    body.clear();
    const limbs = partMat(partById('limbs', av.limbs));
    const torso = partMat(partById('torso', av.torso));
    const head = partMat(partById('head', av.head));
    const face = partById('face', av.face);
    parts.legL = box(0.13, 0.3, 0.15, limbs, -0.1, 0.15, 0);
    parts.legR = box(0.13, 0.3, 0.15, limbs, 0.1, 0.15, 0);
    parts.torso = box(0.44, 0.38, 0.3, torso, 0, 0.5, 0);
    parts.armL = box(0.1, 0.34, 0.11, limbs, -0.29, 0.5, 0);
    parts.armR = box(0.1, 0.34, 0.11, limbs, 0.29, 0.5, 0);
    parts.head = box(0.46, 0.36, 0.38, head, 0, 0.9, 0);
    parts.face = screen(0.36, 0.26, faceTexture(face.pattern, face.color), 0, 0.9, 0.192);
    parts.ant = cyl(0.015, 0.16, mat(0x888899), 0, 1.15, 0);
    parts.bulb = sphere(0.045, glowMat(new THREE.Color(face.color).getHex()), 0, 1.25, 0);
    Object.values(parts).forEach((m) => body.add(m));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.11;
    body.add(shadow);
  };
  build(avatar);
  body.scale.setScalar(1.35);
  let t = 0;
  return {
    group: g,
    setAvatar: build,
    update(dt, moving) {
      t += dt * (moving ? 11 : 2.2);
      const s = moving ? Math.sin(t) : 0;
      parts.legL.rotation.x = s * 0.6;
      parts.legR.rotation.x = -s * 0.6;
      parts.armL.rotation.x = -s * 0.5;
      parts.armR.rotation.x = s * 0.5;
      body.position.y = 0.1 + (moving ? Math.abs(Math.sin(t)) * 0.05 : Math.sin(t) * 0.015);
      parts.bulb.scale.setScalar(0.09 * (1 + Math.sin(t * 0.7) * 0.15));
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
  } else {
    // Mr. Phil appears in the Lexinet as his own teacher avatar: a screen-head with teacher specs.
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

export function createRotling(word, { boss = false, review = false } = {}) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const segs = Math.min(5, Math.max(2, Math.ceil(word.length / 3)));
  const scale = boss ? 2.6 : 1.4;
  const body = [];
  for (let i = 0; i < segs; i++) {
    const s = sphere(0.2 - i * 0.02, ROT_BODY, (i - (segs - 1) / 2) * 0.2, 0.32, Math.sin(i) * 0.05);
    inner.add(s);
    body.push(s);
  }
  const eyeMat = glowMat(review ? 0xffd23f : 0x7dff3a);
  const headX = ((segs - 1) / 2) * 0.2;
  inner.add(sphere(0.05, eyeMat, headX + 0.06, 0.42, 0.15), sphere(0.05, eyeMat, headX - 0.06, 0.42, 0.15));
  const orbit = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = box(0.08, 0.08, 0.08, ROT_GLOW, Math.cos(i * 1.57) * 0.45, 0.4 + (i % 2) * 0.12, Math.sin(i * 1.57) * 0.45);
    orbit.add(c);
  }
  inner.add(orbit);
  const label = labelSprite(word, { color: review ? '#ffd23f' : '#c8ff9e', bg: 'rgba(20,6,30,0.85)', border: review ? '#ffd23f' : '#7dff3a', height: boss ? 0.24 : 0.28 });
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
