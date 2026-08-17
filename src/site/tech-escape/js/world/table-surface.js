/**
 * Random tabletop placement with collision avoidance.
 *
 * Each table keeps a list of occupied circles so scatter dressing and loot
 * pickups never stack in the middle or overlap legs.
 */

import { CELL, TABLE } from '../config.js';

const cellKey = (c) => `${c[0]},${c[1]}`;

const HALF = TABLE.topW / 2;
const EDGE = 0.14;
const LEG = TABLE.legInset;
const LEG_PAD = 0.11;
const GAP = 0.04;

/** Approximate footprint radius on the tabletop (world units). */
export const SCATTER_FOOTPRINT = {
  pencil: 0.13,
  notebook: 0.17,
  eraser: 0.07,
  wire: 0.15,
  circuit: 0.09,
  dice: 0.05,
  meeple: 0.06,
  camera: 0.09,
  bulb: 0.11,
  cpx: 0.08,
  pixelArt: 0.13,
};

export const PICKUP_FOOTPRINT = {
  cheetos: 0.13,
  battery: 0.09,
  soda: 0.09,
  antivirus: 0.11,
};

function fitsLocal(px, pz, radius) {
  if (Math.abs(px) > HALF - EDGE - radius) return false;
  if (Math.abs(pz) > HALF - EDGE - radius) return false;
  if (Math.abs(px) > LEG - LEG_PAD - radius && Math.abs(pz) > LEG - LEG_PAD - radius) {
    return false;
  }
  return true;
}

function overlaps(px, pz, radius, placed) {
  for (const p of placed) {
    const dx = px - p.x;
    const dz = pz - p.z;
    const min = radius + p.r + GAP;
    if (dx * dx + dz * dz < min * min) return true;
  }
  return false;
}

export class TableSurfacePlanner {
  /**
   * @param {import('./maze.js').Maze} maze
   * @param {ReturnType<import('../util.js').makeRng>} rng
   */
  constructor(maze, rng) {
    this.maze = maze;
    this.rng = rng;
    /** @type {Map<string, Array<{x:number,z:number,r:number}>} */
    this._placed = new Map();
  }

  /**
   * @param {[number, number]} cell
   * @param {number} radius
   * @returns {{ cell:[number,number], x:number, z:number, localX:number, localZ:number } | null}
   */
  place(cell, radius) {
    const key = cellKey(cell);
    const list = this._placed.get(key) || [];
    const cx = this.maze.cellToWorldX(cell[0]);
    const cz = this.maze.cellToWorldZ(cell[1]);

    const lo = -HALF + EDGE + radius;
    const hi = HALF - EDGE - radius;
    if (lo >= hi) return null;

    for (let attempt = 0; attempt < 48; attempt++) {
      const px = this.rng.range(lo, hi);
      const pz = this.rng.range(lo, hi);
      if (!fitsLocal(px, pz, radius)) continue;
      if (overlaps(px, pz, radius, list)) continue;
      list.push({ x: px, z: pz, r: radius });
      this._placed.set(key, list);
      return { cell, x: cx + px, z: cz + pz, localX: px, localZ: pz };
    }

    // Tight layout: spiral search from a random seed point
    const seedA = this.rng.range(0, Math.PI * 2);
    for (let ring = 0; ring < 8; ring++) {
      const dist = (ring + 1) * (HALF - EDGE - radius) / 8;
      for (let step = 0; step < 12; step++) {
        const a = seedA + (step / 12) * Math.PI * 2;
        const px = Math.cos(a) * dist;
        const pz = Math.sin(a) * dist;
        if (!fitsLocal(px, pz, radius)) continue;
        if (overlaps(px, pz, radius, list)) continue;
        list.push({ x: px, z: pz, r: radius });
        this._placed.set(key, list);
        return { cell, x: cx + px, z: cz + pz, localX: px, localZ: pz };
      }
    }

    return null;
  }
}
