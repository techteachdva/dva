/**
 * Noam Chomsky, the Hub mentor: a short, stout professor-gnome. Red pointed hat, short grey
 * hair, round glasses, a maroon cardigan with elbow patches over a shirt and tie, and a book
 * he never quite puts down. Same interface as createMentor: { group, update(dt), react(kind) }.
 *
 * Idle gestures take turns: push the glasses up, read a page, raise a finger to make a point.
 */

import { THREE } from './renderer.js';
import { box, cyl, sphere, mat } from './props.js';

export function createNoam() {
  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const skin = mat(0xe8bf9a);
  const cardigan = mat(0x7b2d3a);
  const patch = mat(0xb58a5a);
  const grey = mat(0xc9ccd2);
  const pants = mat(0x3b3f4a);
  const shoe = mat(0x4a2c18);
  const gold = mat(0xd9a441);
  const red = mat(0xc8262f);
  const ink = mat(0x1a1c24);

  // Shoes and short legs.
  [-0.1, 0.1].forEach((x) => {
    rig.add(box(0.13, 0.07, 0.2, shoe, x, 0.035, 0.03));
    rig.add(cyl(0.055, 0.14, pants, x, 0.13, 0));
  });
  // The stout body: a cardigan barrel with a shirt and tie showing at the neck.
  const body = new THREE.Group();
  body.position.y = 0.2;
  const barrel = cyl(0.25, 0.42, cardigan, 0, 0.21, 0);
  barrel.scale.z *= 0.85; // helpers size meshes by scale, so adjust it, never set it
  body.add(barrel);
  body.add(box(0.1, 0.16, 0.02, mat(0xf4f1ea), 0, 0.33, 0.205));
  body.add(box(0.035, 0.13, 0.015, mat(0x1f3a6e), 0, 0.31, 0.216), box(0.05, 0.03, 0.016, mat(0x1f3a6e), 0, 0.385, 0.217));
  // The cardigan opening and its buttons.
  body.add(box(0.012, 0.28, 0.01, mat(0x5a1f29), -0.055, 0.17, 0.212), box(0.012, 0.28, 0.01, mat(0x5a1f29), 0.055, 0.17, 0.212));
  [0.24, 0.16, 0.08].forEach((y) => body.add(sphere(0.016, gold, 0.07, y, 0.212)));
  body.add(box(0.12, 0.02, 0.01, patch, -0.13, 0.27, 0.2)); // a pen in the pocket line
  body.add(box(0.015, 0.06, 0.012, mat(0x2f6fde), -0.16, 0.3, 0.205));
  rig.add(body);

  // Arms from shoulder joints. Elbow patches on the forearms, a book under the left arm.
  const arm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.27, 0.57, 0);
    sh.add(sphere(0.07, cardigan, 0, 0, 0), cyl(0.05, 0.16, cardigan, 0, -0.09, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.18;
    elbow.add(sphere(0.052, patch, 0, 0, 0.005), cyl(0.045, 0.14, cardigan, 0, -0.08, 0), sphere(0.05, skin, 0, -0.17, 0));
    sh.add(elbow);
    rig.add(sh);
    return { sh, elbow };
  };
  const L = arm(-1);
  const Rt = arm(1);
  const book = new THREE.Group();
  book.position.set(0.02, -0.12, 0.08);
  book.add(box(0.2, 0.26, 0.05, mat(0x1f5a3a), 0, 0, 0), box(0.18, 0.24, 0.04, mat(0xf4ecd8), 0.012, 0, 0), box(0.1, 0.03, 0.052, gold, 0, 0.06, 0));
  book.rotation.set(0.2, 0.3, 0.1);
  L.elbow.add(book);

  // The head: round face, big nose, ears, grey hair at the sides and back, glasses, the hat.
  const head = new THREE.Group();
  head.position.y = 0.86;
  head.add(sphere(0.22, skin, 0, 0, 0));
  const nose = sphere(0.065, mat(0xe0a084), 0, -0.02, 0.21);
  nose.scale.multiply(new THREE.Vector3(1, 0.9, 1.1));
  head.add(nose);
  [-1, 1].forEach((s) => {
    const ear = sphere(0.05, skin, s * 0.215, -0.01, 0);
    ear.scale.multiply(new THREE.Vector3(0.5, 1, 0.8));
    head.add(ear);
    // Short grey hair: a tidy bank of tufts over each ear and round the back.
    [[0.17, 0.05, -0.06], [0.19, -0.04, -0.02], [0.15, 0.08, -0.13], [0.1, 0.02, -0.18]].forEach(([x, y, z]) => {
      const tuft = sphere(0.07, grey, s * x, y, z);
      tuft.scale.multiply(new THREE.Vector3(0.8, 0.9, 0.9));
      head.add(tuft);
    });
  });
  head.add(sphere(0.08, grey, 0, 0.0, -0.2));
  // Eyes behind round glasses.
  const eyes = [-0.075, 0.075].map((x) => sphere(0.025, ink, x, 0.05, 0.195));
  head.add(...eyes);
  const glasses = new THREE.Group();
  [-0.075, 0.075].forEach((x) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 18), mat(0x2a2a2a));
    rim.position.set(x, 0.05, 0.215);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.28 }));
    lens.position.set(x, 0.05, 0.216);
    glasses.add(rim, lens);
  });
  glasses.add(box(0.04, 0.01, 0.01, mat(0x2a2a2a), 0, 0.055, 0.218));
  [-1, 1].forEach((s) => glasses.add(box(0.01, 0.01, 0.16, mat(0x2a2a2a), s * 0.13, 0.055, 0.14)));
  head.add(glasses);
  const browL = box(0.07, 0.014, 0.01, grey, -0.075, 0.12, 0.2);
  const browR = box(0.07, 0.014, 0.01, grey, 0.075, 0.12, 0.2);
  head.add(browL, browR);
  const smile = box(0.07, 0.012, 0.01, mat(0x7a3a2a), 0, -0.1, 0.205);
  head.add(smile);
  // The red pointed hat, with a soft fold at the tip.
  const hat = new THREE.Group();
  hat.position.y = 0.12;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.42, 20), red);
  cone.position.y = 0.2;
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 22), mat(0xa81e26));
  brim.rotation.x = Math.PI / 2;
  const tipG = new THREE.Group();
  tipG.position.y = 0.38;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), red);
  tip.position.y = 0.06;
  tipG.add(tip);
  tipG.rotation.z = -0.7;
  hat.add(cone, brim, tipG);
  hat.rotation.z = 0.08;
  head.add(hat);
  rig.add(head);

  let t = 0;
  let act = null;
  let idleIn = 2.5;
  let idleCount = 0;
  const DUR = { pleased: 1.6, worried: 1.6, special: 2, idle: 2.6 };
  const ease = (x) => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI);

  function pose(a) {
    const breath = Math.sin(t * 1.5);
    body.scale.set(1 + breath * 0.015, 1 + breath * 0.01, 1 + breath * 0.015);
    head.position.y = 0.86 + breath * 0.008;
    head.rotation.set(0, Math.sin(t * 0.4) * 0.15, Math.sin(t * 0.27) * 0.04);
    tipG.rotation.z = -0.7 + Math.sin(t * 1.7) * 0.08;
    L.sh.rotation.set(-0.35, 0, -0.2);
    L.elbow.rotation.set(-0.9, 0, 0);
    Rt.sh.rotation.set(0, 0, 0.12 + Math.sin(t * 1.5) * 0.02);
    Rt.elbow.rotation.set(-0.2, 0, 0);
    browL.position.y = browR.position.y = 0.12;
    rig.position.y = 0;
    smile.scale.x = 0.07;
    if (!a) return;
    const p = a.t / a.dur;
    const k = ease(p);
    if (a.kind === 'pleased') {
      rig.position.y = Math.abs(Math.sin(p * Math.PI * 2)) * 0.07;
      Rt.sh.rotation.z = 0.12 + 1.3 * k;
      tipG.rotation.z = -0.7 + Math.sin(t * 10) * 0.3 * k;
      smile.scale.x = 0.07 * (1 + 0.5 * k);
    } else if (a.kind === 'worried') {
      // Hands to his head: something is bugging out.
      Rt.sh.rotation.set(-2.6 * k, 0, 0.5 * k);
      Rt.elbow.rotation.x = -0.2 - 1.2 * k;
      head.rotation.y = Math.sin(p * Math.PI * 3) * 0.25;
      browL.position.y = browR.position.y = 0.12 + 0.02 * k;
      smile.scale.x = 0.07 * (1 - 0.5 * k);
    } else if (a.kind === 'special' || (a.kind === 'idle' && a.n % 3 === 2)) {
      // Raise a finger to make a point, with a little bob of the head.
      Rt.sh.rotation.set(-1.4 * k, 0, 0.3 * k);
      Rt.elbow.rotation.x = -0.2 - 1.3 * k;
      head.rotation.x = Math.sin(p * Math.PI * 4) * 0.06 * k;
      browL.position.y = browR.position.y = 0.12 + 0.015 * k;
    } else if (a.n % 3 === 0) {
      // Push the glasses back up his nose.
      Rt.sh.rotation.set(-2.4 * k, 0, 0.35 * k);
      Rt.elbow.rotation.x = -0.2 - 1.6 * k;
      glasses.position.y = -0.015 * (1 - Math.min(1, p * 2));
    } else {
      // Bring the book round and read a page.
      L.sh.rotation.set(-0.35 - 0.6 * k, 0, -0.2 + 0.35 * k);
      L.elbow.rotation.x = -0.9 - 0.4 * k;
      head.rotation.x = 0.25 * k;
      head.rotation.y = -0.2 * k;
    }
  }

  return {
    group: g,
    react(kind) {
      if (!DUR[kind] || kind === 'idle') return;
      act = { kind, t: 0, dur: DUR[kind], n: 0 };
    },
    update(dt) {
      t += dt;
      if (act) {
        act.t += dt;
        if (act.t >= act.dur) act = null;
      } else if ((idleIn -= dt) <= 0) {
        act = { kind: 'idle', t: 0, dur: DUR.idle, n: idleCount++ };
        idleIn = 6 + Math.random() * 5;
      }
      pose(act);
    },
  };
}
