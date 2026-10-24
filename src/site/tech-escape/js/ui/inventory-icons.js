/**
 * Tiny spinning copies of the loot models, drawn into the HUD sockets.
 * One small WebGL canvas is blitted into each filled slot. If a second
 * context cannot start, the sockets stay as colored wells.
 */

import * as THREE from '../../vendor/three.module.js';
import { makeModel } from '../entities/models.js?v=3.26';
import { settings } from '../meta/settings.js?v=3.21';

const SIZE = 64;
const FRAME = {
  cheetos: { y: 0.02, cam: [0.9, 0.35, 1.7], scale: 1 },
  soda: { y: 0, cam: [0.7, 0.28, 1.35], scale: 1.2 },
  battery: { y: 0, cam: [0.55, 0.22, 1.15], scale: 1.45 },
  antivirus: { y: 0, cam: [0.55, 0.45, 1.05], scale: 1.35 },
};
const KINDS = ['battery', 'cheetos', 'soda', 'antivirus'];

let renderer = null;
let scene = null;
let camera = null;
let models = null;
let spin = 0;
let failed = false;

function boot() {
  if (renderer || failed) return !failed;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'default',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    camera = new THREE.PerspectiveCamera(32, 1, 0.05, 10);
    models = {};
    for (const kind of KINDS) {
      const mesh = makeModel(kind);
      const frame = FRAME[kind];
      const wrap = new THREE.Group();
      mesh.scale.setScalar(frame.scale);
      mesh.position.y = frame.y;
      wrap.add(mesh);
      wrap.visible = false;
      scene.add(wrap);
      models[kind] = wrap;
    }
    return true;
  } catch {
    failed = true;
    return false;
  }
}

function paint(target, kind) {
  const model = models[kind];
  const frame = FRAME[kind];
  if (!model || !frame) return;
  for (const key of KINDS) models[key].visible = key === kind;
  camera.position.set(frame.cam[0], frame.cam[1], frame.cam[2]);
  camera.lookAt(0, frame.y, 0);
  model.rotation.y = spin;
  renderer.render(scene, camera);
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(renderer.domElement, 0, 0, target.width, target.height);
}

export const inventoryIcons = {
  tick(dt) {
    if (!boot()) return;
    if (!settings.get('reduceMotion')) spin += dt * 1.35;
    const nodes = document.querySelectorAll('#inventory-bar .inv-canvas');
    for (const canvas of nodes) {
      if (canvas.dataset.filled !== '1') {
        if (canvas.dataset.drew === '1') {
          canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
          canvas.dataset.drew = '0';
        }
        continue;
      }
      paint(canvas, canvas.dataset.kind);
      canvas.dataset.drew = '1';
    }
  },
};
