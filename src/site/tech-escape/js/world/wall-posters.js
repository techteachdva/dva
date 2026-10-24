/**
 * Printed posters on the lab walls.
 * MeshLambert so the flashlight and the room light them. They do not glow.
 */

import * as THREE from '../../vendor/three.module.js';
import { CELL, WALL_H } from '../config.js';

const EAGLE = 'assets/posters/poster-eagle.jpg';
const DRAWINGS = [
  'assets/posters/phil-draw-1.jpg',
  'assets/posters/phil-draw-2.jpg',
  'assets/posters/phil-draw-3.jpg',
  'assets/posters/phil-draw-4.jpg',
];

function sheet(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 18;
  g.strokeRect(24, 24, w - 48, h - 48);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function title(g, text, y, size) {
  g.fillStyle = '#141414';
  g.font = `700 ${size}px ui-monospace, Consolas, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, g.canvas.width / 2, y);
}

function lingo() {
  return sheet(1024, 1280, (g, w) => {
    title(g, 'LAB SLANG', 120, 72);
    const rows = [
      ['COOKED', 'Done. Finished. Out of luck.'],
      ['RIZZ', 'The skill of being charming.'],
      ['LOWKEY', 'Quietly true. Not a big deal.'],
      ['CHAT', 'Everyone watching. The room.'],
    ];
    rows.forEach((row, i) => {
      const y = 280 + i * 220;
      g.fillStyle = '#10281c';
      g.fillRect(80, y, w - 160, 170);
      g.fillStyle = '#d8ffe8';
      g.font = '700 54px ui-monospace, Consolas, monospace';
      g.fillText(row[0], w / 2, y + 58);
      g.fillStyle = '#f4f1ea';
      g.font = '400 32px ui-monospace, Consolas, monospace';
      g.fillText(row[1], w / 2, y + 118);
    });
  });
}

function hardware() {
  return sheet(1024, 1280, (g, w) => {
    title(g, 'CHROMEBOOK PARTS', 110, 58);
    const parts = [
      [220, 280, 'MONITOR'],
      [220, 620, 'KEYBOARD'],
      [760, 430, 'TRACKPAD'],
      [760, 860, 'WIRED MOUSE'],
    ];
    g.strokeStyle = '#163024';
    g.lineWidth = 8;
    g.strokeRect(160, 200, 700, 220);
    g.strokeRect(160, 500, 700, 160);
    g.strokeRect(640, 700, 200, 120);
    g.beginPath();
    g.arc(780, 980, 70, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#141414';
    g.font = '700 36px ui-monospace, Consolas, monospace';
    parts.forEach(([x, y, name]) => g.fillText(name, x, y));
  });
}

function design() {
  return sheet(1280, 720, (g, w, h) => {
    title(g, 'CODEAI.ORG', 110, 48);
    const steps = ['DEFINE', 'PREPARE', 'TRY', 'REFLECT'];
    steps.forEach((step, i) => {
      const x = 120 + i * 290;
      g.fillStyle = '#10281c';
      g.fillRect(x, 220, 240, 280);
      g.fillStyle = '#f4fff8';
      g.font = '700 36px ui-monospace, Consolas, monospace';
      g.fillText(step, x + 120, 340);
      g.font = '700 64px ui-monospace, Consolas, monospace';
      g.fillText(String(i + 1), x + 120, 430);
      if (i < 3) {
        g.fillStyle = '#141414';
        g.fillText('>', x + 268, 360);
      }
    });
    g.fillStyle = '#141414';
    g.font = '400 28px ui-monospace, Consolas, monospace';
    g.fillText('DEFINE  >  PREPARE  >  TRY  >  REFLECT', w / 2, h - 90);
  });
}

function parts() {
  return sheet(1024, 1024, (g, w) => {
    title(g, 'FOUR PARTS', 120, 64);
    const items = [
      ['INPUT', 'Keys, clicks, voice'],
      ['STORAGE', 'Files kept for later'],
      ['PROCESSING', 'The work in the middle'],
      ['OUTPUT', 'Screen, sound, print'],
    ];
    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 80 + col * 450;
      const y = 220 + row * 360;
      g.strokeStyle = '#163024';
      g.lineWidth = 8;
      g.strokeRect(x, y, 400, 280);
      g.fillStyle = '#141414';
      g.font = '700 42px ui-monospace, Consolas, monospace';
      g.fillText(item[0], x + 200, y + 110);
      g.font = '400 26px ui-monospace, Consolas, monospace';
      g.fillText(item[1], x + 200, y + 180);
    });
  });
}

function demotivational(eagle) {
  return sheet(1280, 900, (g, w, h) => {
    g.fillStyle = '#111';
    g.fillRect(70, 70, w - 140, h - 220);
    if (eagle) g.drawImage(eagle, 90, 90, w - 180, h - 280);
    g.fillStyle = '#f4f1ea';
    g.fillRect(70, h - 200, w - 140, 110);
    g.fillStyle = '#141414';
    g.font = '700 34px ui-monospace, Consolas, monospace';
    g.textAlign = 'center';
    g.fillText('DOWNLOADS', w / 2, h - 155);
    g.font = '400 26px ui-monospace, Consolas, monospace';
    g.fillText('Chicken soup for your motherboard.', w / 2, h - 110);
  });
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function paper(map, w, h) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshLambertMaterial({ map, color: 0xffffff });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, geo, mat };
}

function facesOf(maze) {
  const faces = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 1; y < maze.size - 1; y++) {
    for (let x = 1; x < maze.size - 1; x++) {
      if (!maze.isOpen(x, y)) continue;
      for (const [dx, dy] of dirs) {
        if (!maze.isSolid(x + dx, y + dy)) continue;
        const c = maze.cellCenter(x, y);
        const nx = -dx;
        const nz = -dy;
        faces.push({
          x: c.x + dx * (CELL / 2 - 0.07),
          z: c.z + dy * (CELL / 2 - 0.07),
          nx,
          nz,
        });
      }
    }
  }
  return faces;
}

function hang(group, disposables, face, map, width, height, y, slide) {
  const { mesh, geo, mat } = paper(map, width, height);
  const px = -face.nz * slide;
  const pz = face.nx * slide;
  mesh.position.set(face.x + px, y, face.z + pz);
  mesh.rotation.y = Math.atan2(face.nx, face.nz);
  group.add(mesh);
  disposables.push(geo, mat, map);
}

export function installWallPosters(lab) {
  const faces = facesOf(lab.maze);
  if (!faces.length) return;
  const order = lab.rng.shuffle(faces.slice());
  const posters = [
    { map: lingo(), w: 1.15, h: 1.45 },
    { map: hardware(), w: 1.15, h: 1.45 },
    { map: design(), w: 1.55, h: 0.9 },
    { map: parts(), w: 1.2, h: 1.2 },
  ];
  const used = [];
  let pi = 0;
  for (const face of order) {
    if (pi >= posters.length) break;
    if (used.some((u) => Math.hypot(u.x - face.x, u.z - face.z) < 8)) continue;
    const p = posters[pi];
    const y = 1.35 + lab.rng.range(0, 0.55);
    const slide = lab.rng.range(-0.35, 0.35);
    hang(lab.group, lab._disposables, face, p.map, p.w, p.h, y, slide);
    used.push(face);
    pi += 1;
  }

  const cluster = order.find((face) => used.every((u) => Math.hypot(u.x - face.x, u.z - face.z) > 6));
  const demoFace = order.find((face) => used.every((u) => Math.hypot(u.x - face.x, u.z - face.z) > 7)
    && (!cluster || Math.hypot(face.x - cluster.x, face.z - cluster.z) > 6));

  loadImage(EAGLE).then((img) => {
    if (!demoFace) return;
    const map = demotivational(img);
    hang(lab.group, lab._disposables, demoFace, map, 1.6, 1.15, 1.7, lab.rng.range(-0.2, 0.2));
  });

  if (!cluster) return;
  DRAWINGS.forEach((url, i) => {
    loadImage(url).then((img) => {
      if (!img) return;
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#f7f4ee';
      g.fillRect(0, 0, 640, 800);
      g.drawImage(img, 24, 24, 592, 680);
      g.fillStyle = '#141414';
      g.font = '700 36px ui-monospace, Consolas, monospace';
      g.textAlign = 'center';
      g.fillText('MR. PHIL', 320, 750);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const slide = (col - 0.5) * 0.72 + lab.rng.range(-0.08, 0.08);
      const y = 1.15 + row * 0.95 + lab.rng.range(-0.08, 0.12);
      hang(lab.group, lab._disposables, cluster, tex, 0.62, 0.78, y, slide);
    });
  });
}
