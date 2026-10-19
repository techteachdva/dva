/**
 * One WebGL renderer, three passes per frame:
 *   1. the world diorama (fixed three-quarter camera with gentle mouse parallax)
 *   2. a dimming quad when a panel is open
 *   3. the focus scene (the Morph Compiler drum, the avatar turntable)
 *
 * Chromebook budget: pixel ratio capped at 1.25 (auto), no shadows, no post-processing.
 * If the first seconds run under 30 fps on Auto quality, the pixel ratio drops further.
 */

import * as THREE from '../../vendor/three.module.js';
import { settings } from '../core/settings.js';
import { runTweens, clamp, lerp } from '../core/util.js';

export { THREE };

export const R = {
  renderer: null,
  scene: null,
  camera: null,
  focusScene: null,
  focusCam: null,
  focusOn: false,
  dimAmount: 0,
  dimTarget: 0,
  rig: {
    target: new THREE.Vector3(),
    goalTarget: new THREE.Vector3(),
    yaw: Math.PI / 4,
    pitch: 0.92,
    dist: 30,
    goalDist: 30,
    baseDist: 30,
    px: 0, py: 0, gx: 0, gy: 0,
  },
  pointer: { x: 0, y: 0, inside: false },
  updates: new Set(),
  frozenWorld: false,
};

const dimScene = new THREE.Scene();
const dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const dimMat = new THREE.MeshBasicMaterial({ color: 0x02010a, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat));

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

function pixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  if (settings.quality === 'low') return Math.min(dpr, 0.9);
  if (settings.quality === 'high') return Math.min(dpr, 2);
  return Math.min(dpr, 1.25);
}

export function initRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'low', powerPreference: 'default', alpha: false });
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  R.renderer = renderer;

  R.scene = new THREE.Scene();
  R.scene.background = new THREE.Color(0x07040f);
  R.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 200);

  R.focusScene = new THREE.Scene();
  R.focusCam = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);
  R.focusCam.position.set(0, 0.35, 9);
  R.focusCam.lookAt(0, 0, 0);
  const fl = new THREE.DirectionalLight(0xffffff, 2.2);
  fl.position.set(2, 4, 6);
  R.focusScene.add(fl, new THREE.AmbientLight(0xffffff, 0.7));

  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', (e) => {
    R.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    R.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  requestAnimationFrame(loop);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  R.renderer.setPixelRatio(pixelRatio() * perfScale);
  R.renderer.setSize(w, h);
  R.camera.aspect = w / h;
  R.camera.updateProjectionMatrix();
  R.focusCam.aspect = w / h;
  R.focusCam.updateProjectionMatrix();
  fitRoom(lastW, lastH);
  R.updates.forEach((u) => u.resize && u.resize());
}

let lastW = 12;
let lastH = 9;
/** Pick a camera distance that frames a w×h tile room with margin, at any aspect ratio. */
export function fitRoom(w, h) {
  lastW = w; lastH = h;
  const diag = Math.hypot(w, h) * 0.98;
  const vfov = THREE.MathUtils.degToRad(R.camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * R.camera.aspect);
  const byW = (diag / 2) / Math.tan(hfov / 2);
  const byH = (h * 0.95 + 2.2) / 2 / Math.tan(vfov / 2);
  const d = Math.max(byW, byH) * 1.06 + 3;
  R.rig.baseDist = d;
  if (!zoomed) R.rig.goalDist = d;
}

let zoomed = false;
export function zoomTo(pos, factor = 0.5) {
  zoomed = true;
  R.rig.goalTarget.copy(pos);
  R.rig.goalDist = R.rig.baseDist * factor;
}
export function zoomReset() {
  zoomed = false;
  R.rig.goalTarget.set(0, 0, 0);
  R.rig.goalDist = R.rig.baseDist;
}
export function snapCamera() {
  R.rig.target.copy(R.rig.goalTarget);
  R.rig.dist = R.rig.goalDist;
}

export function setDim(v) { R.dimTarget = v; }
export function setFocus(on) { R.focusOn = on; }
export function setBackground(hex) { R.scene.background = new THREE.Color(hex); }

function updateCamera(dt) {
  const rig = R.rig;
  const k = 1 - Math.pow(0.0015, dt);
  rig.target.lerp(rig.goalTarget, k);
  rig.dist = lerp(rig.dist, rig.goalDist, k);
  const allowParallax = !settings.reducedMotion && !R.focusOn;
  rig.gx = allowParallax ? R.pointer.x : 0;
  rig.gy = allowParallax ? R.pointer.y : 0;
  rig.px = lerp(rig.px, rig.gx, 1 - Math.pow(0.02, dt));
  rig.py = lerp(rig.py, rig.gy, 1 - Math.pow(0.02, dt));
  const yaw = rig.yaw + rig.px * 0.06;
  const pitch = clamp(rig.pitch + rig.py * 0.035, 0.5, 1.3);
  const c = R.camera;
  c.position.set(
    rig.target.x + Math.sin(yaw) * Math.cos(pitch) * rig.dist,
    rig.target.y + Math.sin(pitch) * rig.dist,
    rig.target.z + Math.cos(yaw) * Math.cos(pitch) * rig.dist,
  );
  c.lookAt(rig.target);
}

let last = performance.now();
let perfScale = 1;
let perfFrames = 0;
let perfTime = 0;
let perfChecked = false;

function loop(now) {
  requestAnimationFrame(loop);
  frame(now);
}

/** Playtest hook: advance the game without animation frames (a hidden tab gets none). */
let simNow = 0;
export function debugStep(frames = 1, dt = 1 / 30) {
  if (!simNow) simNow = performance.now();
  for (let i = 0; i < frames; i++) { simNow = Math.max(simNow + dt * 1000, performance.now()); frame(simNow); }
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  runTweens(now);
  R.updates.forEach((u) => u.update && u.update(dt, now));
  updateCamera(dt);

  R.dimAmount = lerp(R.dimAmount, R.dimTarget, 1 - Math.pow(0.001, dt));
  dimMat.opacity = R.dimAmount;

  const r = R.renderer;
  r.autoClear = true;
  r.render(R.scene, R.camera);
  if (R.dimAmount > 0.01 || R.focusOn) {
    r.autoClear = false;
    r.clearDepth();
    if (R.dimAmount > 0.01) r.render(dimScene, dimCam);
    if (R.focusOn) {
      r.clearDepth();
      r.render(R.focusScene, R.focusCam);
    }
  }

  if (!perfChecked && settings.quality === 'auto') {
    perfFrames++;
    perfTime += dt;
    if (perfTime > 4) {
      perfChecked = true;
      const fps = perfFrames / perfTime;
      if (fps < 30) {
        perfScale = 0.75;
        onResize();
      }
    }
  }
}

export function onUpdate(obj) { R.updates.add(obj); return () => R.updates.delete(obj); }

function setNdc(clientX, clientY) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
}

export function pickWorld(clientX, clientY, objects) {
  setNdc(clientX, clientY);
  raycaster.setFromCamera(ndc, R.camera);
  return raycaster.intersectObjects(objects, true);
}

export function pickFocus(clientX, clientY, objects) {
  setNdc(clientX, clientY);
  raycaster.setFromCamera(ndc, R.focusCam);
  return raycaster.intersectObjects(objects, true);
}

export function groundPoint(clientX, clientY) {
  setNdc(clientX, clientY);
  raycaster.setFromCamera(ndc, R.camera);
  const out = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, out) ? out : null;
}

const tmp = new THREE.Vector3();
export function toScreen(v, cam = R.camera) {
  tmp.copy(v).project(cam);
  return { x: (tmp.x + 1) / 2 * window.innerWidth, y: (1 - tmp.y) / 2 * window.innerHeight, behind: tmp.z > 1 };
}
