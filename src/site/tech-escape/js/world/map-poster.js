/**
 * Dead-end map posters — birds-eye maze maps with live player tracking.
 */

import * as THREE from '../../vendor/three.module.js';
import { CELL, WALL_H } from '../config.js';

const MAP_RES = 1024;
export const MAP_POSTER_MAX = 4;

export function mazeDeadEnds(maze) {
  const ends = [];
  for (const [cx, cy] of maze.openCells()) {
    let n = 0;
    if (maze.isOpen(cx, cy - 1)) n++;
    if (maze.isOpen(cx, cy + 1)) n++;
    if (maze.isOpen(cx - 1, cy)) n++;
    if (maze.isOpen(cx + 1, cy)) n++;
    if (n === 1) ends.push([cx, cy]);
  }
  return ends;
}

export function pickPosterCells(maze, rng, avoidCells, max = MAP_POSTER_MAX) {
  const dead = mazeDeadEnds(maze).filter(([cx, cy]) =>
    !avoidCells.some(([ax, ay]) => ax === cx && ay === cy),
  );
  const picked = [];
  for (const cell of rng.shuffle([...dead])) {
    if (picked.length >= max) break;
    let ok = true;
    for (const p of picked) {
      if (Math.hypot(cell[0] - p[0], cell[1] - p[1]) < 4) ok = false;
    }
    if (ok) picked.push(cell);
  }
  return picked;
}

function corridorNeighbor(maze, cell) {
  const [cx, cy] = cell;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (maze.isOpen(cx + dx, cy + dy)) return { dx, dy };
  }
  return null;
}

export class MapPosterCanvas {
  constructor(maze, posterCell, landmarks) {
    this.maze = maze;
    this.posterCell = posterCell;
    this.landmarks = landmarks;
    this.playerCell = null;
    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_RES;
    this.canvas.height = MAP_RES;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this._draw();
  }

  setPlayerCell(cell) {
    if (!cell) return;
    if (this.playerCell && this.playerCell[0] === cell[0] && this.playerCell[1] === cell[1]) return;
    this.playerCell = [cell[0], cell[1]];
    this._draw();
  }

  _draw() {
    const maze = this.maze;
    const g = this.canvas.getContext('2d');
    const N = maze.size;
    const pad = 40;
    const area = MAP_RES - pad * 2;
    const cellPx = area / N;
    const ox = pad;
    const oy = pad;

    g.fillStyle = '#060a10';
    g.fillRect(0, 0, MAP_RES, MAP_RES);

    g.fillStyle = '#101820';
    g.fillRect(ox, oy, cellPx * N, cellPx * N);

    // Open floor tint
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!maze.isOpen(x, y)) continue;
        g.fillStyle = '#16202c';
        g.fillRect(ox + x * cellPx, oy + y * cellPx, cellPx, cellPx);
      }
    }

    // Walls — vector blocks along exposed solids
    g.fillStyle = '#dce6f4';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!maze.isSolid(x, y)) continue;
        const touch = maze.isOpen(x - 1, y) || maze.isOpen(x + 1, y)
          || maze.isOpen(x, y - 1) || maze.isOpen(x, y + 1);
        if (!touch) continue;
        g.fillRect(ox + x * cellPx - 0.5, oy + y * cellPx - 0.5, cellPx + 1, cellPx + 1);
      }
    }

    const center = (cell) => ({
      x: ox + cell[0] * cellPx + cellPx / 2,
      y: oy + cell[1] * cellPx + cellPx / 2,
    });

    for (const cell of this.landmarks.terminals) {
      const p = center(cell);
      const s = cellPx * 0.38;
      g.fillStyle = '#5ce8ff';
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      g.strokeStyle = '#083040';
      g.lineWidth = Math.max(2, cellPx * 0.06);
      g.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    const pr = center(this.landmarks.printer);
    const ts = cellPx * 0.42;
    g.fillStyle = '#ff9500';
    g.beginPath();
    g.moveTo(pr.x, pr.y - ts);
    g.lineTo(pr.x - ts, pr.y + ts * 0.65);
    g.lineTo(pr.x + ts, pr.y + ts * 0.65);
    g.closePath();
    g.fill();
    g.strokeStyle = '#402000';
    g.lineWidth = 2;
    g.stroke();

    const ex = center(this.landmarks.exit);
    g.fillStyle = '#4cff9a';
    g.beginPath();
    g.arc(ex.x, ex.y, cellPx * 0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#0a3020';
    g.lineWidth = 2;
    g.stroke();

    const mp = center(this.posterCell);
    g.fillStyle = '#ff66cc';
    g.beginPath();
    g.arc(mp.x, mp.y, cellPx * 0.24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.stroke();

    if (this.playerCell) {
      const pl = center(this.playerCell);
      g.fillStyle = '#ffee33';
      g.beginPath();
      g.arc(pl.x, pl.y, cellPx * 0.28, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#222';
      g.lineWidth = 2;
      g.stroke();
    }

    g.fillStyle = 'rgba(0,0,0,0.62)';
    g.fillRect(0, MAP_RES - 42, MAP_RES, 42);
    g.fillStyle = '#a8bcd4';
    g.font = 'bold 15px ui-monospace, monospace';
    g.textAlign = 'center';
    g.fillText('■ TERMINAL   ▲ PRINTER   ● EXIT   ● YOU   ✦ THIS MAP', MAP_RES / 2, MAP_RES - 16);

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

export function buildMapPosters(maze, posterCells, landmarks, group, disposables) {
  const posters = [];
  const posterW = CELL * 0.84;
  const posterH = WALL_H * 0.74;

  for (const cell of posterCells) {
    const n = corridorNeighbor(maze, cell);
    if (!n) continue;

    const canvas = new MapPosterCanvas(maze, cell, landmarks);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(posterW + 0.08, posterH + 0.08, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x1a2030 }),
    );
    const geo = new THREE.PlaneGeometry(posterW, posterH);
    const mat = new THREE.MeshBasicMaterial({ map: canvas.texture, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);

    const cx = maze.cellToWorldX(cell[0]);
    const cz = maze.cellToWorldZ(cell[1]);
    const inset = CELL * 0.46;
    const px = cx - n.dx * inset;
    const pz = cz - n.dy * inset;
    const rotY = Math.atan2(n.dx, n.dy);

    frame.position.set(px, posterH / 2 + 0.06, pz);
    frame.rotation.y = rotY;
    mesh.position.set(px, posterH / 2 + 0.06, pz);
    mesh.rotation.y = rotY;

    group.add(frame);
    group.add(mesh);
    disposables.push(frame.geometry, frame.material, geo, mat);

    posters.push({ mesh, canvas, cell });
  }
  return posters;
}
