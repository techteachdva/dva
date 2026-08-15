/**
 * Every hand-held object in the lab, built once and shared.
 *
 * Two rules drive the shapes in here:
 *
 *   1. A player must know what a thing is from across a dark room, before the
 *      flashlight reaches it. The batteries always managed that - a yellow
 *      cylinder with a silver cap is unmistakable - and everything else is held
 *      to the same bar. The old cheetos bag was a red rectangle, which read as
 *      "a red box", so it is now a puffed, crimped, labelled chip bag.
 *   2. Silhouette carries the meaning, colour only confirms it. That is what
 *      keeps the loot legible to a colourblind player, and it is also what makes
 *      it legible in the dark, where every colour is nearly black anyway.
 *
 * Labels are drawn to a canvas at build time, so the folder stays dependency
 * free with no image files to load or lose. Triangle counts are noted per model
 * because this has to hold 60fps on integrated graphics.
 */

import * as THREE from '../../vendor/three.module.js';
import { COLORS } from '../config.js';

let geo = null;
let tex = null;
const mats = [];

/* ---------------------------------------------------------------- textures */

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/** Front-of-bag label: flame, big word, zigzag. Reads at a couple of pixels. */
function makeCheetosLabel() {
  const c = canvas(96, 80);
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, 80);
  bg.addColorStop(0, hex(COLORS.cheeto));
  bg.addColorStop(1, '#c2400a');
  g.fillStyle = bg;
  g.fillRect(0, 0, 96, 80);

  // Flame motif behind the wordmark
  g.fillStyle = 'rgba(255,240,120,0.9)';
  g.beginPath();
  g.moveTo(48, 8);
  g.bezierCurveTo(66, 26, 74, 40, 62, 54);
  g.bezierCurveTo(56, 62, 40, 62, 34, 54);
  g.bezierCurveTo(22, 40, 30, 26, 48, 8);
  g.fill();
  g.fillStyle = '#e02a12';
  g.beginPath();
  g.moveTo(48, 20);
  g.bezierCurveTo(58, 32, 62, 42, 55, 51);
  g.bezierCurveTo(51, 56, 43, 56, 39, 51);
  g.bezierCurveTo(32, 42, 38, 32, 48, 20);
  g.fill();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 27px Verdana, Tahoma, sans-serif';
  g.lineWidth = 4;
  g.strokeStyle = '#3a0b00';
  g.strokeText('HOT', 48, 40);
  g.fillStyle = '#fffbe8';
  g.fillText('HOT', 48, 40);

  g.font = 'bold 12px Verdana, Tahoma, sans-serif';
  g.strokeStyle = '#3a0b00';
  g.lineWidth = 3;
  g.strokeText('CHIPS', 48, 64);
  g.fillStyle = '#fffbe8';
  g.fillText('CHIPS', 48, 64);

  // Torn-foil zigzag along the top so the crimp reads even without the geometry
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= 96; x += 8) {
    g.lineTo(x, x % 16 === 0 ? 5 : 11);
  }
  g.stroke();
  return finish(c);
}

/** Wrapped can label. Cylinder UVs wrap horizontally, so the text is upright. */
function makeSodaLabel() {
  const c = canvas(128, 64);
  const g = c.getContext('2d');

  g.fillStyle = '#f2f5ff';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = hex(COLORS.soda);
  g.fillRect(0, 12, 128, 40);

  // White diagonal swoosh, the universal soft-drink cue
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(-6, 48);
  g.bezierCurveTo(34, 22, 92, 44, 134, 18);
  g.stroke();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 21px Verdana, Tahoma, sans-serif';
  g.lineWidth = 4;
  g.strokeStyle = '#5c0022';
  g.strokeText('SODA', 64, 32);
  g.fillStyle = '#ffffff';
  g.fillText('SODA', 64, 32);

  // Bubbles
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y, r] of [[18, 22, 3], [30, 44, 2], [104, 26, 3], [92, 46, 2], [112, 42, 2]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c);
}

/** Disc face: iridescent rings, a shield, and a readable hub. */
function makeAntivirusLabel() {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const cx = 64;

  g.fillStyle = '#0b1626';
  g.fillRect(0, 0, 128, 128);

  // Rainbow sheen: what makes a CD read as a CD
  const rings = ['#7fe9ff', '#bfe9ff', '#c79bff', '#7cffb2', '#ffe566', '#ff8cb0'];
  for (let i = 0; i < 20; i++) {
    g.strokeStyle = rings[i % rings.length];
    g.globalAlpha = 0.16 + (i % 3) * 0.1;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cx, 60 - i * 2.6, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;

  // Shield
  g.fillStyle = 'rgba(10,22,38,0.9)';
  g.beginPath();
  g.moveTo(64, 34);
  g.lineTo(88, 46);
  g.lineTo(88, 70);
  g.bezierCurveTo(88, 86, 76, 94, 64, 100);
  g.bezierCurveTo(52, 94, 40, 86, 40, 70);
  g.lineTo(40, 46);
  g.closePath();
  g.fill();
  g.strokeStyle = hex(COLORS.antivirus);
  g.lineWidth = 4;
  g.stroke();

  // Tick inside the shield
  g.strokeStyle = '#7cffb2';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(53, 66);
  g.lineTo(62, 78);
  g.lineTo(78, 52);
  g.stroke();
  g.lineCap = 'butt';

  // Hub
  g.fillStyle = '#05070d';
  g.beginPath();
  g.arc(cx, cx, 13, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(191,233,255,0.6)';
  g.lineWidth = 2;
  g.stroke();
  return finish(c);
}

/**
 * A white glyph with a hard dark-then-light outline, drawn on a transparent
 * square. These are pinned above enemies as the non-colour channel: the shape
 * says what a thing is even in greyscale, at distance, or with the light off.
 */
function makeGlyphTexture(shape) {
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const path = () => {
    g.beginPath();
    if (shape === 'triangle') {
      g.moveTo(32, 9);
      g.lineTo(56, 52);
      g.lineTo(8, 52);
    } else if (shape === 'hex') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24);
      }
    } else {
      g.arc(32, 32, 22, 0, Math.PI * 2);
    }
    g.closePath();
  };

  // Dark backing first so the white edge survives against a lit wall
  g.lineJoin = 'round';
  path();
  g.strokeStyle = 'rgba(4,6,11,0.95)';
  g.lineWidth = 9;
  g.stroke();
  path();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.stroke();
  path();
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fill();
  return finish(c);
}

/* ---------------------------------------------------------------- geometry */

export function getModelGeometry() {
  if (geo) return geo;
  geo = {
    // Puffed pillow: a low-poly sphere squashed into a bag is ~80 triangles and
    // reads instantly as "snack packet" where a box never did
    bagBody: new THREE.SphereGeometry(0.2, 8, 6),
    bagCrimp: new THREE.BoxGeometry(0.33, 0.05, 0.085),
    bagLabel: new THREE.PlaneGeometry(0.26, 0.21),
    battery: new THREE.CylinderGeometry(0.075, 0.075, 0.3, 8),
    batteryCap: new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8),
    canBody: new THREE.CylinderGeometry(0.088, 0.088, 0.25, 10, 1, true),
    canLid: new THREE.CylinderGeometry(0.09, 0.088, 0.022, 10),
    canTab: new THREE.BoxGeometry(0.05, 0.008, 0.022),
    disc: new THREE.CylinderGeometry(0.17, 0.17, 0.013, 16),
    discFace: new THREE.CircleGeometry(0.168, 16),
    glyph: new THREE.PlaneGeometry(0.42, 0.42),
    dust: new THREE.BoxGeometry(0.09, 0.09, 0.09),
    shockwave: new THREE.SphereGeometry(1, 10, 7),
  };
  return geo;
}

function getTextures() {
  if (tex) return tex;
  tex = {
    cheetos: makeCheetosLabel(),
    soda: makeSodaLabel(),
    antivirus: makeAntivirusLabel(),
    triangle: makeGlyphTexture('triangle'),
    hex: makeGlyphTexture('hex'),
    circle: makeGlyphTexture('circle'),
  };
  return tex;
}

/**
 * Materials are cached by name and shared by every instance. Twenty-two loot
 * items on the floor would otherwise mean sixty-odd unique materials, and each
 * one is a state change the renderer has to make on a Chromebook GPU.
 */
const matCache = new Map();

function sharedMat(name, make) {
  let m = matCache.get(name);
  if (!m) {
    m = make();
    matCache.set(name, m);
    mats.push(m);
  }
  return m;
}

/* ------------------------------------------------------------------ models */

/**
 * Puffy single-serving hot chip bag: four meshes, ~110 triangles.
 *
 * The old bag was a red box, which players read as "a red box". A squashed
 * sphere plus two crimped seams gives the pillowed silhouette of a packet
 * holding air, and the label plane carries the flame and the word, so it says
 * "hot chips" even before the flashlight lands on it.
 */
export function makeCheetosBag() {
  const g = getModelGeometry();
  const t = getTextures();
  const group = new THREE.Group();

  const body = new THREE.Mesh(g.bagBody, sharedMat(
    'bag', () => new THREE.MeshBasicMaterial({ color: COLORS.cheeto }),
  ));
  // Pillowed: tall, wide, and thin enough to look like it is holding air
  body.scale.set(1.02, 1.3, 0.62);
  group.add(body);

  const crimpMat = sharedMat('bagCrimp', () => new THREE.MeshBasicMaterial({ color: 0x9e3305 }));
  for (const y of [0.245, -0.245]) {
    const crimp = new THREE.Mesh(g.bagCrimp, crimpMat);
    crimp.position.y = y;
    group.add(crimp);
  }

  // One double-sided plane rather than two: the back of a snack bag being a
  // mirror of the front costs nobody anything and saves a draw call per bag
  const label = new THREE.Mesh(g.bagLabel, sharedMat(
    'bagLabel', () => new THREE.MeshBasicMaterial({ map: t.cheetos, side: THREE.DoubleSide }),
  ));
  label.position.z = 0.127;
  group.add(label);
  return group;
}

/** The quality bar the others are measured against. Left alone on purpose. */
export function makeBattery() {
  const g = getModelGeometry();
  const group = new THREE.Group();
  const body = new THREE.Mesh(g.battery, sharedMat(
    'battery', () => new THREE.MeshBasicMaterial({ color: COLORS.battery }),
  ));
  group.add(body);
  const cap = new THREE.Mesh(g.batteryCap, sharedMat(
    'batteryCap', () => new THREE.MeshBasicMaterial({ color: 0xc9c9d2 }),
  ));
  cap.position.y = 0.17;
  group.add(cap);
  return group;
}

/** Soda can: wrapped label, silver lid, pull tab. ~120 triangles. */
export function makeSodaCan() {
  const g = getModelGeometry();
  const t = getTextures();
  const group = new THREE.Group();

  // A cylinder's UVs wrap the long way round, so the wordmark stays upright and
  // legible from every angle without a second mesh
  const body = new THREE.Mesh(g.canBody, sharedMat(
    'can', () => new THREE.MeshBasicMaterial({ map: t.soda, side: THREE.DoubleSide }),
  ));
  group.add(body);

  const metal = sharedMat('canMetal', () => new THREE.MeshBasicMaterial({ color: 0xd7dbe6 }));
  const top = new THREE.Mesh(g.canLid, metal);
  top.position.y = 0.132;
  group.add(top);
  const bottom = new THREE.Mesh(g.canLid, metal);
  bottom.position.y = -0.132;
  group.add(bottom);

  const tab = new THREE.Mesh(g.canTab, sharedMat(
    'canTab', () => new THREE.MeshBasicMaterial({ color: 0x9aa3b2 }),
  ));
  tab.position.set(0.02, 0.146, 0);
  group.add(tab);
  return group;
}

/** Anti-virus disc. Rare, so it is the shiniest thing on the floor. */
export function makeAntivirusDisc() {
  const g = getModelGeometry();
  const t = getTextures();
  const group = new THREE.Group();

  const edge = new THREE.Mesh(g.disc, sharedMat(
    'discEdge', () => new THREE.MeshBasicMaterial({ color: 0x8fa6bd }),
  ));
  group.add(edge);

  const faceMat = sharedMat('discFace', () => new THREE.MeshBasicMaterial({ map: t.antivirus }));
  for (const y of [0.008, -0.008]) {
    const face = new THREE.Mesh(g.discFace, faceMat);
    face.position.y = y;
    face.rotation.x = y > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(face);
  }
  return group;
}

/**
 * The identity glyph that floats above an entity: two triangles and a shared
 * white texture. This is the channel that still works when colour does not, so
 * every enemy class gets its own shape and keeps it at every distance.
 *
 * Each shape needs its own material because the opacity is animated per entity,
 * but they are cached per shape so all the mice share one.
 */
export function makeEntityGlyph(shape, scale = 1) {
  const g = getModelGeometry();
  const t = getTextures();
  const mat = new THREE.MeshBasicMaterial({
    map: t[shape] || t.circle,
    transparent: true,
    depthWrite: false,
    // Drawn over whatever it sits in front of, because a marker you can lose
    // behind a desk leg is not a marker
    depthTest: false,
  });
  mats.push(mat);
  const mesh = new THREE.Mesh(g.glyph, mat);
  mesh.scale.setScalar(scale);
  mesh.renderOrder = 5;
  return mesh;
}

export function makeModel(kind) {
  if (kind === 'cheetos') return makeCheetosBag();
  if (kind === 'soda') return makeSodaCan();
  if (kind === 'antivirus') return makeAntivirusDisc();
  return makeBattery();
}

/** Resting height above the floor for each loot type. */
export const REST_Y = {
  cheetos: 0.34,
  battery: 0.28,
  soda: 0.26,
  antivirus: 0.2,
};

export function disposeModels() {
  for (const m of mats) m.dispose();
  mats.length = 0;
  matCache.clear();
  if (tex) {
    for (const k in tex) tex[k].dispose();
    tex = null;
  }
  if (geo) {
    for (const k in geo) geo[k].dispose();
    geo = null;
  }
}
