/**
 * Solid furniture.
 *
 * Maze walls are handled by the grid in maze.js. Everything else in the lab -
 * desks, the printer, server racks, the exit door - lives here as an axis
 * aligned box with a vertical band (`y0` to `y1`).
 *
 * The vertical band is what makes crawling work. A tabletop occupies roughly
 * y 1.00 to 1.30, so a standing body (0 to 1.75) collides with it while a
 * crouched body (0 to 0.95) passes underneath. No special cases, no trigger
 * volumes: the same test gives us solid desks AND a crawl space under them.
 *
 * Boxes are bucketed per maze cell so a collision query only ever looks at the
 * handful of boxes in the 3x3 cells around the mover.
 */

const EPS = 1e-6;

export class Obstacles {
  constructor(maze) {
    this.maze = maze;
    this.boxes = [];
    // cellIndex -> array of box references
    this.buckets = new Map();
  }

  /**
   * @param {object} spec
   * @param {number} spec.x centre X
   * @param {number} spec.z centre Z
   * @param {number} spec.hx half extent on X
   * @param {number} spec.hz half extent on Z
   * @param {number} spec.y0 bottom of the solid band
   * @param {number} spec.y1 top of the solid band
   * @param {string} [spec.tag] for debugging and tests
   */
  add({ x, z, hx, hz, y0, y1, tag = '' }) {
    const box = { x, z, hx, hz, y0, y1, tag };
    this.boxes.push(box);

    // Register in every cell the footprint touches, plus a ring of one so a
    // mover near a cell edge still sees it
    const minCx = this.maze.worldToCellX(x - hx) - 1;
    const maxCx = this.maze.worldToCellX(x + hx) + 1;
    const minCz = this.maze.worldToCellZ(z - hz) - 1;
    const maxCz = this.maze.worldToCellZ(z + hz) + 1;
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = cz * this.maze.size + cx;
        let list = this.buckets.get(key);
        if (!list) {
          list = [];
          this.buckets.set(key, list);
        }
        list.push(box);
      }
    }
    return box;
  }

  /** Adds a rotated rectangle as its axis-aligned bounding footprint. */
  addRotated({ x, z, w, d, rotation, y0, y1, tag = '' }) {
    const c = Math.abs(Math.cos(rotation));
    const s = Math.abs(Math.sin(rotation));
    const hx = (w * c + d * s) / 2;
    const hz = (w * s + d * c) / 2;
    return this.add({ x, z, hx, hz, y0, y1, tag });
  }

  _near(x, z) {
    const cx = this.maze.worldToCellX(x);
    const cz = this.maze.worldToCellZ(z);
    return this.buckets.get(cz * this.maze.size + cx);
  }

  /**
   * True when a body of the given vertical span overlaps any box at this spot.
   * Used for headroom tests (can I stand up here?) without moving anything.
   */
  overlaps(x, z, radius, bodyY0, bodyY1, opts = null) {
    const skipTags = opts?.skipTags || null;
    const list = this._near(x, z);
    if (!list) return false;
    for (const b of list) {
      if (skipTags && skipTags.includes(b.tag)) continue;
      if (b.y1 <= bodyY0 + EPS || b.y0 >= bodyY1 - EPS) continue;
      const nx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx));
      const nz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  }

  /** The first box overlapping this body, or null. Handy for messages/tests. */
  blockerAt(x, z, radius, bodyY0, bodyY1, opts = null) {
    const skipTags = opts?.skipTags || null;
    const list = this._near(x, z);
    if (!list) return null;
    for (const b of list) {
      if (skipTags && skipTags.includes(b.tag)) continue;
      if (b.y1 <= bodyY0 + EPS || b.y0 >= bodyY1 - EPS) continue;
      const nx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx));
      const nz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
      const dx = x - nx;
      const dz = z - nz;
      if (dx * dx + dz * dz < radius * radius) return b;
    }
    return null;
  }

  /**
   * Pushes a circle out of any box whose band overlaps the body.
   * Mutates `pos` (needs x/z) and returns true when it moved.
   *
   * @param {{x:number,z:number}} pos
   * @param {number} radius
   * @param {number} bodyY0 bottom of the body (feet)
   * @param {number} bodyY1 top of the body (head)
   */
  collide(pos, radius, bodyY0, bodyY1, opts = null) {
    const skipTags = opts?.skipTags || null;
    let moved = false;
    // Two passes so a body wedged between two boxes settles instead of jittering
    for (let pass = 0; pass < 2; pass++) {
      const list = this._near(pos.x, pos.z);
      if (!list) return moved;
      let hitThisPass = false;

      for (const b of list) {
        if (skipTags && skipTags.includes(b.tag)) continue;
        // Skip anything we are above or below - this is the crawl space
        if (b.y1 <= bodyY0 + EPS || b.y0 >= bodyY1 - EPS) continue;

        const nx = Math.max(b.x - b.hx, Math.min(pos.x, b.x + b.hx));
        const nz = Math.max(b.z - b.hz, Math.min(pos.z, b.z + b.hz));
        let dx = pos.x - nx;
        let dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;

        moved = true;
        hitThisPass = true;

        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        } else {
          // Centre is inside the footprint: eject along the shallowest axis
          const toLeft = pos.x - (b.x - b.hx);
          const toRight = (b.x + b.hx) - pos.x;
          const toTop = pos.z - (b.z - b.hz);
          const toBottom = (b.z + b.hz) - pos.z;
          const m = Math.min(toLeft, toRight, toTop, toBottom);
          if (m === toLeft) pos.x = b.x - b.hx - radius;
          else if (m === toRight) pos.x = b.x + b.hx + radius;
          else if (m === toTop) pos.z = b.z - b.hz - radius;
          else pos.z = b.z + b.hz + radius;
        }
      }
      if (!hitThisPass) break;
    }
    return moved;
  }

  get count() { return this.boxes.length; }

  countByTag(tag) {
    return this.boxes.filter((b) => b.tag === tag).length;
  }

  /** Remove a box from collision (e.g. exit door opens). */
  remove(box) {
    const idx = this.boxes.indexOf(box);
    if (idx < 0) return;
    this.boxes.splice(idx, 1);
    for (const list of this.buckets.values()) {
      const at = list.indexOf(box);
      if (at >= 0) list.splice(at, 1);
    }
  }
}
