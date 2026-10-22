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

// The storybook camera: low (about 29 degrees above the floor), facing the room's front.
// Q/E rotate in 45-degree steps, Z/X step through ZOOMS, VIEW resets all of it.
// Dragging the floor orbits freely (orbitBy), right-drag slides the view (panBy), the wheel zooms.
export const DEFAULT_PITCH = 0.5;
export const ZOOMS = [0.55, 0.68, 0.82, 1, 1.2, 1.42, 1.68, 2.0, 2.4];
export const DEFAULT_ZOOM = 3;

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
    follow: new THREE.Vector3(),
    focus: null,
    yaw: 0,
    yawGoal: 0,
    pitch: DEFAULT_PITCH,
    dist: 16,
    goalDist: 16,
    baseDist: 16,
    focusFactor: 1,
    zoomIdx: DEFAULT_ZOOM,
    px: 0, py: 0, gx: 0, gy: 0,
    pan: new THREE.Vector3(),
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
  R.camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.5, 200);

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
/** Base distance: about 15 tiles across the screen at the default zoom, whatever the aspect ratio. */
export function fitRoom(w, h) {
  lastW = w; lastH = h;
  const vfov = THREE.MathUtils.degToRad(R.camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * R.camera.aspect);
  const byW = 7.5 / Math.tan(hfov / 2);
  const byH = 4.6 / Math.tan(vfov / 2);
  R.rig.baseDist = Math.max(byW, byH);
  R.rig.goalDist = R.rig.baseDist * ZOOMS[R.rig.zoomIdx] * R.rig.focusFactor;
}

/** Follow a point (the player) when nothing is in focus. */
export function setFollow(v) { R.rig.follow.copy(v); }

export function zoomTo(pos, factor = 0.5) {
  R.rig.focus = pos.clone();
  R.rig.focusFactor = factor / ZOOMS[R.rig.zoomIdx];
  R.rig.goalDist = R.rig.baseDist * factor;
}
export function zoomReset() {
  R.rig.focus = null;
  R.rig.focusFactor = 1;
  R.rig.goalDist = R.rig.baseDist * ZOOMS[R.rig.zoomIdx];
}
export function rotateView(dir) {
  R.rig.yawGoal += dir * (Math.PI / 4);
}
export function zoomStep(dir) {
  R.rig.zoomIdx = clamp(R.rig.zoomIdx + dir, 0, ZOOMS.length - 1);
  if (!R.rig.focus) R.rig.goalDist = R.rig.baseDist * ZOOMS[R.rig.zoomIdx];
  return R.rig.zoomIdx;
}
/** Drag to orbit: dx turns the view, dy tilts it (in pixels). */
export function orbitBy(dx, dy) {
  R.rig.yawGoal -= dx * 0.008;
  R.rig.yaw = R.rig.yawGoal - (R.rig.yawGoal - R.rig.yaw) * 0.3;
  R.rig.pitch = clamp(R.rig.pitch + dy * 0.004, 0.32, 1.15);
}
/** Right-drag to slide the view across the floor, up to about half a room from the player. */
export function panBy(dx, dy) {
  const s = R.rig.dist / Math.max(400, window.innerHeight) * 1.6;
  const yaw = R.rig.yaw;
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  R.rig.pan.addScaledVector(right, -dx * s).addScaledVector(fwd, dy * s);
  R.rig.pan.clampLength(0, 9);
}
/** Ease the slide back toward the player (called while the player walks). */
export function relaxPan(dt) {
  R.rig.pan.multiplyScalar(Math.pow(0.15, dt));
}
/** VIEW: back to the default angle, tilt and zoom, turning the short way round. */
export function resetView() {
  const full = Math.PI * 2;
  R.rig.yawGoal = Math.round(R.rig.yawGoal / full) * full;
  R.rig.pitch = DEFAULT_PITCH;
  R.rig.pan.set(0, 0, 0);
  R.rig.zoomIdx = DEFAULT_ZOOM;
  if (!R.rig.focus) R.rig.goalDist = R.rig.baseDist * ZOOMS[DEFAULT_ZOOM];
}
/** Camera yaw (radians, 0 = looking north from the south side). */
export const viewYaw = () => R.rig.yaw;
export const viewYawGoal = () => R.rig.yawGoal;
/** Face a doorway without easing: yaw 0 looks north. */
export function setViewYaw(yaw) {
  R.rig.yaw = yaw;
  R.rig.yawGoal = yaw;
}

export function snapCamera() {
  R.rig.target.copy(R.rig.focus || R.rig.follow);
  R.rig.dist = R.rig.goalDist;
  R.rig.yaw = R.rig.yawGoal;
}

export function setDim(v) { R.dimTarget = v; }
export function setFocus(on) { R.focusOn = on; }
export function setBackground(hex) { R.scene.background = new THREE.Color(hex); }

function updateCamera(dt) {
  const rig = R.rig;
  const k = 1 - Math.pow(0.002, dt);
  if (rig.focus) rig.goalTarget.copy(rig.focus);
  else rig.goalTarget.copy(rig.follow).add(rig.pan);
  rig.target.lerp(rig.goalTarget, k);
  rig.dist = lerp(rig.dist, rig.goalDist, k);
  rig.yaw = lerp(rig.yaw, rig.yawGoal, 1 - Math.pow(0.0008, dt));
  const allowParallax = !settings.reducedMotion && !R.focusOn;
  rig.gx = allowParallax ? R.pointer.x : 0;
  rig.gy = allowParallax ? R.pointer.y : 0;
  rig.px = lerp(rig.px, rig.gx, 1 - Math.pow(0.02, dt));
  rig.py = lerp(rig.py, rig.gy, 1 - Math.pow(0.02, dt));
  const yaw = rig.yaw + rig.px * 0.035;
  const pitch = clamp(rig.pitch + rig.py * 0.025, 0.3, 1.2);
  const c = R.camera;
  c.position.set(
    rig.target.x + Math.sin(yaw) * Math.cos(pitch) * rig.dist,
    rig.target.y + 0.4 + Math.sin(pitch) * rig.dist,
    rig.target.z + Math.cos(yaw) * Math.cos(pitch) * rig.dist,
  );
  c.lookAt(rig.target.x, rig.target.y + 0.4, rig.target.z);
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
