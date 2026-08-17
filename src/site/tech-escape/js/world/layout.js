/**
 * Procedural furniture layout: tables, chairs, rack props, and scatter dressing
 * without overlapping fixtures (terminals, printer, exit, start).
 */

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
 */
export function planLabFurniture(maze, rng, open, reserved, level) {
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
    const x = maze.cellToWorldX(tc[0]);
    const z = maze.cellToWorldZ(tc[1]);
    scatter.push({
      type: rng.pick(TABLE_SCATTER_TYPES),
      x: x + rng.range(-0.18, 0.18),
      z: z + rng.range(-0.18, 0.18),
      surface: 'table',
      rot: rng.range(0, Math.PI * 2),
    });
    if (rng.chance(0.55)) {
      scatter.push({
        type: rng.pick(TABLE_SCATTER_TYPES),
        x: x + rng.range(-0.22, 0.22),
        z: z + rng.range(-0.22, 0.22),
        surface: 'table',
        rot: rng.range(0, Math.PI * 2),
      });
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

  return { tableCells, chairCells, propCells, scatter };
}

/**
 * Shuffled world spots on tabletops for loot pickups.
 * @param {import('./maze.js').Maze} maze
 * @param {ReturnType<import('../util.js').makeRng>} rng
 * @param {Array<[number, number]>} tableCells
 */
export function planTableLootSlots(maze, rng, tableCells) {
  const inset = 0.24;
  return rng.shuffle(tableCells.map(([cx, cy]) => ({
    cell: [cx, cy],
    x: maze.cellToWorldX(cx) + rng.range(-inset, inset),
    z: maze.cellToWorldZ(cy) + rng.range(-inset, inset),
    onTable: true,
  })));
}
