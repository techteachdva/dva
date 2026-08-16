/**
 * Maze layout, collision, line of sight, and pathfinding.
 *
 * The lab is a grid where odd coordinates are rooms and even coordinates are
 * wall lines. A recursive-backtracker carves a perfect maze, then a pass knocks
 * out extra walls so the map has loops - dead ends only would make being chased
 * feel unfair rather than scary.
 */

import { CELL, LAYOUT } from '../config.js';

const OPEN = 0;
const SOLID = 1;

export class Maze {
  /**
   * @param {ReturnType<import('../util.js').makeRng>} rng
   * @param {object} [opts] layout overrides from the current level; omitting it
   *   reproduces the original single-layout lab exactly.
   */
  constructor(rng, opts = null) {
    this.rng = rng;
    const cfg = { ...LAYOUT, ...(opts || null) };
    // The carve algorithm walks two cells at a time, so an even size would
    // leave a dead column against the border
    this.size = cfg.size % 2 === 0 ? cfg.size + 1 : cfg.size;
    this.layout = cfg;
    this.half = (this.size - 1) / 2;
    this.grid = [];
    this._flow = null;
    this._flowTarget = -1;
    this._generate();
  }

  // ------------------------------------------------------------- construction

  _generate() {
    const N = this.size;
    // Start fully solid
    this.grid = Array.from({ length: N }, () => new Uint8Array(N).fill(SOLID));

    // Carve a perfect maze over the odd-indexed cells
    const visited = Array.from({ length: N }, () => new Uint8Array(N));
    const stack = [[1, 1]];
    this.grid[1][1] = OPEN;
    visited[1][1] = 1;

    const DIRS = [[0, -2], [2, 0], [0, 2], [-2, 0]];

    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const options = [];
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && !visited[ny][nx]) {
          options.push([nx, ny, dx, dy]);
        }
      }
      if (!options.length) {
        stack.pop();
        continue;
      }
      const [nx, ny, dx, dy] = this.rng.pick(options);
      this.grid[cy + dy / 2][cx + dx / 2] = OPEN;
      this.grid[ny][nx] = OPEN;
      visited[ny][nx] = 1;
      stack.push([nx, ny]);
    }

    this._addLoops(this.layout.loopChance);
    this._carveRooms(this.layout.rooms);
    if (this.layout.trimStubs !== false) this._trimStubs();
  }

  /** Removes interior wall segments to create loops and wider spaces. */
  _addLoops(chance) {
    const N = this.size;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        if (this.grid[y][x] === OPEN) continue;
        // Only remove wall segments between two rooms, never pillar corners
        const horiz = this.grid[y][x - 1] === OPEN && this.grid[y][x + 1] === OPEN;
        const vert = this.grid[y - 1][x] === OPEN && this.grid[y + 1][x] === OPEN;
        if ((horiz || vert) && this.rng.chance(chance)) {
          this.grid[y][x] = OPEN;
        }
      }
    }
  }

  /** Opens a few larger work areas so the lab reads as a room, not just halls. */
  _carveRooms(count) {
    const N = this.size;
    // A room can never be wide enough to eat the sealed border
    const lo = Math.max(2, Math.min(this.layout.roomMin, N - 4));
    const hi = Math.max(lo, Math.min(this.layout.roomMax, N - 4));
    for (let i = 0; i < count; i++) {
      const w = this.rng.int(lo, hi);
      const h = this.rng.int(lo, hi);
      const x0 = this.rng.int(1, N - 2 - w);
      const y0 = this.rng.int(1, N - 2 - h);
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          this.grid[y][x] = OPEN;
        }
      }
    }
    // Border must stay sealed - this is a locked lab
    for (let i = 0; i < N; i++) {
      this.grid[0][i] = SOLID;
      this.grid[N - 1][i] = SOLID;
      this.grid[i][0] = SOLID;
      this.grid[i][N - 1] = SOLID;
    }
  }

  /** Removes single floating wall pillars, which look like glitches. */
  _trimStubs() {
    const N = this.size;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        if (this.grid[y][x] !== SOLID) continue;
        const n = (this.grid[y - 1][x] === SOLID ? 1 : 0)
          + (this.grid[y + 1][x] === SOLID ? 1 : 0)
          + (this.grid[y][x - 1] === SOLID ? 1 : 0)
          + (this.grid[y][x + 1] === SOLID ? 1 : 0);
        if (n === 0 && this.rng.chance(0.6)) this.grid[y][x] = OPEN;
      }
    }
  }

  // ------------------------------------------------------------ basic queries

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  isSolid(x, y) {
    if (!this.inBounds(x, y)) return true;
    return this.grid[y][x] === SOLID;
  }

  isOpen(x, y) {
    return !this.isSolid(x, y);
  }

  openCells() {
    const out = [];
    for (let y = 1; y < this.size - 1; y++) {
      for (let x = 1; x < this.size - 1; x++) {
        if (this.grid[y][x] === OPEN) out.push([x, y]);
      }
    }
    return out;
  }

  /**
   * Open cells directly beside the outer solid wall ring — valid EXIT placements.
   * @returns {Array<{cell:[number,number], side:'west'|'east'|'north'|'south'}>}
   */
  outerWallExitCandidates() {
    const s = this.size;
    const out = [];
    for (let y = 1; y < s - 1; y++) {
      for (let x = 1; x < s - 1; x++) {
        if (this.grid[y][x] !== OPEN) continue;
        if (x === 1 && this.isSolid(0, y)) out.push({ cell: [x, y], side: 'west' });
        else if (x === s - 2 && this.isSolid(s - 1, y)) out.push({ cell: [x, y], side: 'east' });
        else if (y === 1 && this.isSolid(x, 0)) out.push({ cell: [x, y], side: 'north' });
        else if (y === s - 2 && this.isSolid(x, s - 1)) out.push({ cell: [x, y], side: 'south' });
      }
    }
    return out;
  }

  cellToWorldX(cx) { return (cx - this.half) * CELL; }
  cellToWorldZ(cy) { return (cy - this.half) * CELL; }

  cellCenter(cx, cy) {
    return { x: this.cellToWorldX(cx), z: this.cellToWorldZ(cy) };
  }

  worldToCellX(x) { return Math.round(x / CELL + this.half); }
  worldToCellZ(z) { return Math.round(z / CELL + this.half); }

  worldToCell(x, z) {
    return [this.worldToCellX(x), this.worldToCellZ(z)];
  }

  isWorldSolid(x, z) {
    return this.isSolid(this.worldToCellX(x), this.worldToCellZ(z));
  }

  cellIndex(cx, cy) { return cy * this.size + cx; }

  // -------------------------------------------------------------- collision

  /**
   * Pushes a circle out of any solid cell it overlaps. Mutates `pos` (an object
   * with x/z) and returns true when a correction happened.
   */
  collide(pos, radius) {
    const cx = this.worldToCellX(pos.x);
    const cy = this.worldToCellZ(pos.z);
    let hit = false;

    // Two passes settle corner cases where a circle is wedged between cells
    for (let pass = 0; pass < 2; pass++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 1; x <= cx + 1; x++) {
          if (!this.isSolid(x, y)) continue;
          const bx = this.cellToWorldX(x);
          const bz = this.cellToWorldZ(y);
          const h = CELL / 2;
          // Closest point on the cell box to the circle centre
          const nx = Math.max(bx - h, Math.min(pos.x, bx + h));
          const nz = Math.max(bz - h, Math.min(pos.z, bz + h));
          let dx = pos.x - nx;
          let dz = pos.z - nz;
          let d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;

          hit = true;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = radius - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
          } else {
            // Centre is inside the box: eject along the shallowest axis
            const toLeft = Math.abs(pos.x - (bx - h));
            const toRight = Math.abs(bx + h - pos.x);
            const toTop = Math.abs(pos.z - (bz - h));
            const toBottom = Math.abs(bz + h - pos.z);
            const m = Math.min(toLeft, toRight, toTop, toBottom);
            if (m === toLeft) pos.x = bx - h - radius;
            else if (m === toRight) pos.x = bx + h + radius;
            else if (m === toTop) pos.z = bz - h - radius;
            else pos.z = bz + h + radius;
          }
        }
      }
      if (!hit) break;
    }
    return hit;
  }

  // ------------------------------------------------------------ line of sight

  /**
   * Grid traversal (Amanatides & Woo) between two world points.
   * Returns true when nothing solid blocks the segment.
   */
  lineOfSight(ax, az, bx, bz) {
    let x = this.worldToCellX(ax);
    let y = this.worldToCellZ(az);
    const ex = this.worldToCellX(bx);
    const ey = this.worldToCellZ(bz);

    if (this.isSolid(x, y) || this.isSolid(ex, ey)) return false;
    if (x === ex && y === ey) return true;

    const dx = bx - ax;
    const dz = bz - az;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dz > 0 ? 1 : -1;

    // Cell boundaries in world space
    const nextBoundX = this.cellToWorldX(x) + (stepX > 0 ? CELL / 2 : -CELL / 2);
    const nextBoundZ = this.cellToWorldZ(y) + (stepY > 0 ? CELL / 2 : -CELL / 2);

    let tMaxX = Math.abs(dx) < 1e-9 ? Infinity : (nextBoundX - ax) / dx;
    let tMaxZ = Math.abs(dz) < 1e-9 ? Infinity : (nextBoundZ - az) / dz;
    const tDeltaX = Math.abs(dx) < 1e-9 ? Infinity : CELL / Math.abs(dx);
    const tDeltaZ = Math.abs(dz) < 1e-9 ? Infinity : CELL / Math.abs(dz);

    let guard = 0;
    while (guard++ < 256) {
      if (tMaxX < tMaxZ) {
        if (tMaxX > 1) return true;
        x += stepX;
        tMaxX += tDeltaX;
      } else {
        if (tMaxZ > 1) return true;
        y += stepY;
        tMaxZ += tDeltaZ;
      }
      if (this.isSolid(x, y)) return false;
      if (x === ex && y === ey) return true;
    }
    return false;
  }

  // -------------------------------------------------------------- pathfinding

  /**
   * Breadth-first flow field toward a target cell. Cached so several hunters
   * chasing the same player share one computation.
   */
  buildFlow(tx, ty) {
    const idx = this.cellIndex(tx, ty);
    if (this._flowTarget === idx && this._flow) return this._flow;

    const N = this.size;
    const dist = new Int32Array(N * N).fill(-1);
    if (this.isSolid(tx, ty)) {
      this._flow = dist;
      this._flowTarget = idx;
      return dist;
    }

    const queue = new Int32Array(N * N);
    let head = 0;
    let tail = 0;
    dist[idx] = 0;
    queue[tail++] = idx;

    while (head < tail) {
      const cur = queue[head++];
      const cy = (cur / N) | 0;
      const cx = cur - cy * N;
      const d = dist[cur];
      // 4-way keeps hunters in the middle of corridors
      if (cx > 0 && this.grid[cy][cx - 1] === OPEN && dist[cur - 1] < 0) {
        dist[cur - 1] = d + 1; queue[tail++] = cur - 1;
      }
      if (cx < N - 1 && this.grid[cy][cx + 1] === OPEN && dist[cur + 1] < 0) {
        dist[cur + 1] = d + 1; queue[tail++] = cur + 1;
      }
      if (cy > 0 && this.grid[cy - 1][cx] === OPEN && dist[cur - N] < 0) {
        dist[cur - N] = d + 1; queue[tail++] = cur - N;
      }
      if (cy < N - 1 && this.grid[cy + 1][cx] === OPEN && dist[cur + N] < 0) {
        dist[cur + N] = d + 1; queue[tail++] = cur + N;
      }
    }

    this._flow = dist;
    this._flowTarget = idx;
    return dist;
  }

  invalidateFlow() {
    this._flowTarget = -1;
  }

  /** Next cell to walk to when following a flow field, or null at the goal. */
  flowStep(flow, cx, cy) {
    const N = this.size;
    const here = flow[this.cellIndex(cx, cy)];
    if (here <= 0) return null;
    let best = null;
    let bestD = here;
    const tryCell = (x, y) => {
      if (!this.inBounds(x, y) || this.grid[y][x] !== OPEN) return;
      const d = flow[this.cellIndex(x, y)];
      if (d >= 0 && d < bestD) { bestD = d; best = [x, y]; }
    };
    tryCell(cx - 1, cy);
    tryCell(cx + 1, cy);
    tryCell(cx, cy - 1);
    tryCell(cx, cy + 1);
    return best;
  }

  /** Graph distance in cells, or -1 when unreachable. */
  flowDistance(flow, cx, cy) {
    if (!this.inBounds(cx, cy)) return -1;
    return flow[this.cellIndex(cx, cy)];
  }

  // ---------------------------------------------------------------- placement

  /**
   * Picks `count` open cells that are far apart from each other and from any
   * cell in `avoid`, used to spread the four Chromebooks around the lab.
   */
  spreadCells(count, avoid = [], minSeparation = 6) {
    const cells = this.rng.shuffle(this.openCells());
    const chosen = [];
    let sep = minSeparation;

    while (chosen.length < count && sep > 1) {
      for (const c of cells) {
        if (chosen.length >= count) break;
        const okFromChosen = chosen.every(
          (o) => Math.hypot(o[0] - c[0], o[1] - c[1]) >= sep,
        );
        const okFromAvoid = avoid.every(
          (o) => Math.hypot(o[0] - c[0], o[1] - c[1]) >= sep * 0.6,
        );
        if (okFromChosen && okFromAvoid) chosen.push(c);
      }
      sep -= 1;
    }
    // Fall back to any open cell if the layout is unusually tight
    while (chosen.length < count) chosen.push(this.rng.pick(cells));
    return chosen.slice(0, count);
  }

  /** An open cell at least `minCells` away (graph distance) from a point. */
  cellAwayFrom(cx, cy, minCells) {
    const flow = this.buildFlow(cx, cy);
    const candidates = this.openCells().filter((c) => {
      const d = this.flowDistance(flow, c[0], c[1]);
      return d >= minCells;
    });
    this.invalidateFlow();
    if (!candidates.length) return this.rng.pick(this.openCells());
    return this.rng.pick(candidates);
  }

  /** True when every open cell is reachable from the given cell. */
  isFullyConnected(cx, cy) {
    const flow = this.buildFlow(cx, cy);
    const bad = this.openCells().some((c) => this.flowDistance(flow, c[0], c[1]) < 0);
    this.invalidateFlow();
    return !bad;
  }
}
