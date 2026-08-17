/**
 * Procedural furniture layout: tables, chairs, rack props, and scatter dressing
 * without overlapping fixtures (terminals, printer, exit, start).
 */

import { TABLE } from '../config.js';
import { PICKUP_FOOTPRINT, SCATTER_FOOTPRINT, TableSurfacePlanner } from './table-surface.js';

const cellKey = (c) => `${c[0]},${c[1]}`;

/** Dressing on tabletops — everything except floor-only litter. */
const TABLE_SCATTER_TYPES = [
  'pencil', 'notebook', 'eraser', 'wire', 'circuit',
  'dice', 'meeple', 'camera', 'bulb', 'cpx', 'pixelArt',
];

/** Only pencils and erasers may appear on the floor. */
const FLOOR_SCATTER_TYPES = ['pencil', 'eraser'];

/**
 * @param {import('./maze.js').Maze} maze
 * @param {ReturnType<import('../util.js').makeRng>} rng
 * @param {Array<[number, number]>} open
 * @param {Array<[number, number]>} reserved
 * @param {object} level
 * @param {TableSurfacePlanner} [surfacePlanner]
 */
export function planLabFurniture(maze, rng, open, reserved, level, surfacePlanner = null) {
  const planner = surfacePlanner || new TableSurfacePlanner(maze, rng);
  const used = new Set(reserved.map(cellKey));
  const freeCells = () => open.filter((c) => !used.has(cellKey(c)));
  const mark = (cells) => cells.forEach((c) => used.add(cellKey(c)));

  const avoid = reserved.slice();
  const openLen = open.length;
  const density = level.tableDensity ?? 0.1;

  let tableCount = Math.max(3, Math.round(openLen * density));
  tableCount = Math.min(tableCount, Math.max(3, Math.floor(openLen / 7)));

  const tableCells = maze.spreadCells(tableCount, avoid, 5);
  mark(tableCells);

  const chairCells = [];
  for (const tc of tableCells) {
    const neighbors = [
      [tc[0] + 1, tc[1]],
      [tc[0] - 1, tc[1]],
      [tc[0], tc[1] + 1],
      [tc[0], tc[1] - 1],
    ].filter((n) => maze.isOpen(n[0], n[1]) && !used.has(cellKey(n)));

    if (!neighbors.length) continue;
    const ch = rng.pick(neighbors);
    chairCells.push({ cell: ch, tableCell: tc });
    used.add(cellKey(ch));
  }

  const propDensity = level.propDensity ?? 0.05;
  let propCount = Math.max(2, Math.round(openLen * propDensity));
  propCount = Math.min(propCount, 7);
  const propCells = maze.spreadCells(
    propCount,
    [...avoid, ...tableCells, ...chairCells.map((c) => c.cell)],
    4,
  );
  mark(propCells);

  const scatter = [];
  for (const tc of tableCells) {
    const type1 = rng.pick(TABLE_SCATTER_TYPES);
    const spot1 = planner.place(tc, SCATTER_FOOTPRINT[type1] || 0.1);
    if (spot1) {
      scatter.push({
        type: type1,
        x: spot1.x,
        z: spot1.z,
        surface: 'table',
        rot: rng.range(0, Math.PI * 2),
      });
    }

    if (rng.chance(0.55)) {
      const type2 = rng.pick(TABLE_SCATTER_TYPES);
      const spot2 = planner.place(tc, SCATTER_FOOTPRINT[type2] || 0.1);
      if (spot2) {
        scatter.push({
          type: type2,
          x: spot2.x,
          z: spot2.z,
          surface: 'table',
          rot: rng.range(0, Math.PI * 2),
        });
      }
    }
  }

  const floorScatter = Math.min(14, Math.round(openLen * 0.05) + 4);
  const floorCells = rng.shuffle(freeCells());
  for (let i = 0; i < floorScatter && i < floorCells.length; i++) {
    const c = floorCells[i];
    scatter.push({
      type: rng.pick(FLOOR_SCATTER_TYPES),
      x: maze.cellToWorldX(c[0]) + rng.range(-0.35, 0.35),
      z: maze.cellToWorldZ(c[1]) + rng.range(-0.35, 0.35),
      surface: 'floor',
      rot: rng.range(0, Math.PI * 2),
    });
  }

  return { tableCells, chairCells, propCells, scatter, surfacePlanner: planner };
}

/**
 * Place loot under a hide-under desk or on its paired chair.
 * @param {import('./maze.js').Maze} maze
 * @param {ReturnType<import('../util.js').makeRng>} rng
 * @param {[number, number]} tableCell
 * @param {Array<{cell:[number,number], tableCell:[number,number]}>} chairCells
 * @param {'cheetos'|'battery'|'soda'|'antivirus'} kind
 * @param {Map<string, Array<{x:number,z:number,r:number}>} underPlaced
 */
export function placeLootSpot(maze, rng, tableCell, chairCells, kind, underPlaced) {
  const chair = chairCells.find(
    (c) => c.tableCell[0] === tableCell[0] && c.tableCell[1] === tableCell[1],
  );
  if (chair && rng.chance(0.32)) {
    const x = maze.cellToWorldX(chair.cell[0]);
    const z = maze.cellToWorldZ(chair.cell[1]);
    return { cell: tableCell, x, z, onChair: true };
  }
  return placeLootUnderTable(maze, rng, tableCell, kind, underPlaced);
}

function placeLootUnderTable(maze, rng, tableCell, kind, underPlaced) {
  const key = cellKey(tableCell);
  const list = underPlaced.get(key) || [];
  const cx = maze.cellToWorldX(tableCell[0]);
  const cz = maze.cellToWorldZ(tableCell[1]);
  const radius = PICKUP_FOOTPRINT[kind] || 0.1;
  const half = TABLE.topW / 2 - 0.22;
  const leg = TABLE.legInset;
  const gap = 0.06;

  for (let attempt = 0; attempt < 36; attempt++) {
    const px = rng.range(-half, half);
    const pz = rng.range(-half, half);
    if (Math.abs(px) > leg - 0.12 && Math.abs(pz) > leg - 0.12) continue;

    let ok = true;
    for (const p of list) {
      const dx = px - p.x;
      const dz = pz - p.z;
      const min = radius + p.r + gap;
      if (dx * dx + dz * dz < min * min) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    list.push({ x: px, z: pz, r: radius });
    underPlaced.set(key, list);
    return {
      cell: tableCell,
      x: cx + px,
      z: cz + pz,
      underTable: true,
    };
  }
  return null;
}
