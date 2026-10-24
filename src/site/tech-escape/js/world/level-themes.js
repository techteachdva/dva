/**
 * Per-floor visual identity: textures, emergency light colour, and a signature prop.
 */

import * as THREE from '../../vendor/three.module.js';
import { CELL, WALL_H } from '../config.js';

export const LEVEL_THEMES = {
  lab: {
    id: 'lab',
    emergencyColor: 0xff3333,
    emergencyArrow: '#ff3333',
    floorBase: '#1b2130',
    floorAccent: '#2a3548',
    wallBase: '#252d3d',
    wallCourse: '#121820',
    tableColor: 0x3a4558,
    tableLeg: 0x1a2028,
    ceiling: 0x0c1018,
    dressing: 'projector',
  },
  servers: {
    id: 'servers',
    emergencyColor: 0xff8800,
    emergencyArrow: '#ff8800',
    floorBase: '#141820',
    floorAccent: '#1e2430',
    wallBase: '#1a2030',
    wallCourse: '#0a0e14',
    tableColor: 0x2a3040,
    tableLeg: 0x121620,
    ceiling: 0x080a10,
    dressing: 'server_stack',
  },
  library: {
    id: 'library',
    emergencyColor: 0xffcc00,
    emergencyArrow: '#ffcc00',
    floorBase: '#2a2418',
    floorAccent: '#3a3224',
    wallBase: '#3a3228',
    wallCourse: '#1e1810',
    tableColor: 0x5a4a38,
    tableLeg: 0x2a2218,
    ceiling: 0x181410,
    dressing: 'bookshelf',
  },
  tunnels: {
    id: 'tunnels',
    emergencyColor: 0x33ff66,
    emergencyArrow: '#33ff66',
    floorBase: '#121614',
    floorAccent: '#1a221c',
    wallBase: '#1e2420',
    wallCourse: '#0a0c0a',
    tableColor: 0x3a4038,
    tableLeg: 0x181c18,
    ceiling: 0x060808,
    dressing: 'pipe_rack',
  },
  mainframe: {
    id: 'mainframe',
    emergencyColor: 0x3399ff,
    emergencyArrow: '#3399ff',
    floorBase: '#101828',
    floorAccent: '#182238',
    wallBase: '#1a2840',
    wallCourse: '#0a1020',
    tableColor: 0x2a3a58,
    tableLeg: 0x101828,
    ceiling: 0x081018,
    dressing: 'mainframe_core',
  },
};

export function themeForLevel(level) {
  return LEVEL_THEMES[level?.id] || LEVEL_THEMES.lab;
}

function paintNoise(g, n, alpha, size) {
  for (let i = 0; i < n; i++) {
    const v = 18 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v + 6},${v + 16},${alpha})`;
    const s = Math.random() < 0.08 ? 3 : 1;
    g.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
}

export function makeThemedFloorTexture(theme) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = theme.floorBase;
  g.fillRect(0, 0, size, size);

  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shift = ((x / tile + y / tile) % 2) ? 10 : 0;
      g.fillStyle = `rgba(255,255,255,${0.025 + shift / 400})`;
      g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      // Worn center of each tile, darker grout sits in the gap.
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x, y, tile, 2);
      g.fillRect(x, y, 2, tile);
    }
  }
  paintNoise(g, 2800, 0.35, size);

  // A scuffed traffic lane so the floor reads as a room people walk, not a swatch.
  g.strokeStyle = theme.floorAccent;
  g.globalAlpha = 0.28;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(0, size * 0.5);
  g.lineTo(size, size * 0.5);
  g.stroke();
  g.globalAlpha = 0.45;
  g.lineWidth = 2;
  g.strokeRect(8, 8, size - 16, size - 16);
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeThemedWallTexture(theme) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = theme.wallBase;
  g.fillRect(0, 0, size, size);

  // Vertical panels, a dirty baseboard, and a darker course line. The lab
  // should read as built, even under one Lambert light.
  const panel = 64;
  for (let x = 0; x <= size; x += panel) {
    g.fillStyle = theme.wallCourse;
    g.fillRect(x, 0, 3, size);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fillRect(x + 6, 18, panel - 14, size - 70);
  }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, size - 52, size, 52);
  g.fillStyle = theme.emergencyArrow;
  g.globalAlpha = 0.55;
  g.fillRect(0, size - 56, size, 4);
  g.globalAlpha = 1;
  paintNoise(g, 900, 0.28, size);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeThemedCeilingTexture(theme) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const hex = theme.ceiling ?? 0x0c1018;
  const r = (hex >> 16) & 255;
  const gv = (hex >> 8) & 255;
  const b = hex & 255;
  g.fillStyle = `rgb(${r},${gv},${b})`;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.lineWidth = 2;
  for (let y = 0; y <= size; y += 64) {
    for (let x = 0; x <= size; x += 64) g.strokeRect(x + 4, y + 4, 56, 56);
  }
  g.fillStyle = 'rgba(180,210,255,0.08)';
  g.fillRect(80, 80, 96, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft round cookie so the flashlight is a beam, not a hard math cone. */
export function makeFlashlightCookie() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 122);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(236,244,255,0.92)');
  grd.addColorStop(0.62, 'rgba(170,196,230,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function makeThemedArrowTexture(hexColor) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  const drawChevron = (fill, stroke, inset) => {
    g.fillStyle = fill;
    g.strokeStyle = stroke;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(64, 16 + inset);
    g.lineTo(20 + inset, 80 - inset);
    g.lineTo(42 + inset, 80 - inset);
    g.lineTo(42 + inset, 104 - inset);
    g.lineTo(90 - inset, 104 - inset);
    g.lineTo(90 - inset, 80 - inset);
    g.lineTo(112 - inset, 80 - inset);
    g.closePath();
    g.fill();
    g.stroke();
  };
  drawChevron('#2a0800', '#1a0400', 0);
  drawChevron(hexColor, '#ffddaa', 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Signature dressing prop per floor — large, readable from across a cell. */
export function buildLevelDressing(scene, group, maze, rng, theme, disposables) {
  const open = maze.openCells();
  if (!open.length) return;
  const cell = rng.pick(open);
  const x = maze.cellToWorldX(cell[0]);
  const z = maze.cellToWorldZ(cell[1]);
  const y = 0;

  const add = (mesh) => {
    group.add(mesh);
    disposables.push(mesh.geometry, mesh.material);
  };

  switch (theme.dressing) {
    case 'projector':
      const cart = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x2a3038 }),
      );
      cart.position.set(x, 0.28, z);
      add(cart);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.35, 10),
        new THREE.MeshBasicMaterial({ color: 0x88ccff }),
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, 0.72, z - 0.2);
      add(lens);
      break;
    case 'server_stack':
      for (let i = 0; i < 4; i++) {
        const rack = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.8, 0.55),
          new THREE.MeshLambertMaterial({ color: 0x1a2030 }),
        );
        rack.position.set(x + i * 0.35 - 0.5, 0.9, z);
        add(rack);
      }
      break;
    case 'bookshelf':
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 2.4, 0.45),
        new THREE.MeshLambertMaterial({ color: 0x4a3828 }),
      );
      shelf.position.set(x, 1.2, z);
      add(shelf);
      for (let row = 0; row < 5; row++) {
        const books = new THREE.Mesh(
          new THREE.BoxGeometry(1.9, 0.22, 0.35),
          new THREE.MeshLambertMaterial({ color: 0x6a5040 + row * 0x050505 }),
        );
        books.position.set(x, 0.35 + row * 0.42, z);
        add(books);
      }
      break;
    case 'pipe_rack':
      for (let i = 0; i < 3; i++) {
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 2.8, 8),
          new THREE.MeshLambertMaterial({ color: 0x5a6a60 }),
        );
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(x, 1.4 + i * 0.35, z);
        add(pipe);
      }
      break;
    case 'mainframe_core':
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 2.2, 1.4),
        new THREE.MeshLambertMaterial({ color: 0x1a2848, emissive: 0x2244aa, emissiveIntensity: 0.35 }),
      );
      core.position.set(x, 1.1, z);
      add(core);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x44aaff }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 2.1, z);
      add(ring);
      break;
    default:
      break;
  }
}
