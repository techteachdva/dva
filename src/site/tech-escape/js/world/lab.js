/**
 * Builds the physical Tech Lab: floor, ceiling, maze walls, tables to hide
 * under, the four Chromebook terminals, the 3D printer, and the exit door.
 *
 * Everything uses instanced boxes and unlit materials for the glowing parts, so
 * the whole lab is a handful of draw calls and runs on low-end Chromebooks.
 */

import * as THREE from '../../vendor/three.module.js';
import { CELL, WALL_H, TABLE, COLORS } from '../config.js';
import { Obstacles } from './obstacles.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _axisY = new THREE.Vector3(0, 1, 0);

/** Flat floor chevron pointing +Z in local space (before Y rotation). */
function makeFloorArrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.18);
  shape.lineTo(-0.14, -0.06);
  shape.lineTo(-0.05, -0.06);
  shape.lineTo(-0.05, -0.16);
  shape.lineTo(0.05, -0.16);
  shape.lineTo(0.05, -0.06);
  shape.lineTo(0.14, -0.06);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI);
  return geo;
}

/* ------------------------------------------------------------------ textures */

function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2130';
  g.fillRect(0, 0, 256, 256);
  // Speckle so the floor is not a flat colour under the flashlight
  for (let i = 0; i < 1800; i++) {
    const v = 26 + Math.random() * 26;
    g.fillStyle = `rgba(${v},${v + 4},${v + 12},0.5)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(80,100,130,0.34)';
  g.lineWidth = 2;
  for (let y = 0; y <= 256; y += 64) {
    for (let x = 0; x <= 256; x += 64) {
      g.strokeRect(x, y, 64, 64);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWallTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#252d3d';
  g.fillRect(0, 0, 256, 256);
  // Faint cinder-block courses
  g.strokeStyle = 'rgba(12,16,24,0.55)';
  g.lineWidth = 2;
  for (let y = 0; y <= 256; y += 32) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
  }
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 32 : 0;
    for (let x = off; x <= 256; x += 64) {
      g.beginPath(); g.moveTo(x, row * 32); g.lineTo(x, row * 32 + 32); g.stroke();
    }
  }
  for (let i = 0; i < 800; i++) {
    const v = 30 + Math.random() * 24;
    g.fillStyle = `rgba(${v},${v + 3},${v + 10},0.4)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Draws the glowing Chromebook screen. Redrawn when a terminal is solved. */
export function drawScreenTexture(canvas, opts) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const { index, state, glyphs } = opts;

  const bg = g.createLinearGradient(0, 0, 0, H);
  if (state === 'solved') {
    bg.addColorStop(0, '#06301c');
    bg.addColorStop(1, '#031a10');
  } else {
    bg.addColorStop(0, '#062a3a');
    bg.addColorStop(1, '#04141f');
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = state === 'solved' ? 'rgba(82,255,159,0.5)' : 'rgba(111,232,255,0.42)';
  g.lineWidth = 4;
  g.strokeRect(6, 6, W - 12, H - 12);

  const accent = state === 'solved' ? '#52ff9f' : '#6fe8ff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  if (state === 'solved') {
    g.fillStyle = accent;
    g.font = `bold ${Math.round(H * 0.17)}px ui-monospace, monospace`;
    g.fillText('COMPLETE', W / 2, H * 0.32);
    g.font = `bold ${Math.round(H * 0.3)}px ui-monospace, monospace`;
    g.fillText(glyphs || '***', W / 2, H * 0.62);
    g.font = `${Math.round(H * 0.1)}px ui-monospace, monospace`;
    g.fillStyle = 'rgba(180,255,215,0.7)';
    g.fillText('FRAGMENT SECURED', W / 2, H * 0.85);
  } else {
    g.fillStyle = 'rgba(150,220,240,0.75)';
    g.font = `${Math.round(H * 0.11)}px ui-monospace, monospace`;
    g.fillText(`TERMINAL 0${index + 1}`, W / 2, H * 0.2);

    g.fillStyle = accent;
    g.font = `bold ${Math.round(H * 0.34)}px ui-monospace, monospace`;
    g.fillText('? ? ?', W / 2, H * 0.5);

    g.fillStyle = 'rgba(255,200,87,0.9)';
    g.font = `bold ${Math.round(H * 0.115)}px ui-monospace, monospace`;
    g.fillText('PRESS E TO LOG IN', W / 2, H * 0.79);

    // Scanlines for CRT-ish menace
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
  }
}

/* ----------------------------------------------------------------- the build */

export class Lab {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./maze.js').Maze} maze
   * @param {ReturnType<import('../util.js').makeRng>} rng
   */
  constructor(scene, maze, rng) {
    this.scene = scene;
    this.maze = maze;
    this.rng = rng;

    this.group = new THREE.Group();
    scene.add(this.group);

    // Every solid thing that is not a maze wall
    this.obstacles = new Obstacles(maze);

    this.tables = [];      // { x, z, cell, top, height }
    this.laptops = [];     // { index, x, z, mesh, screen, canvas, texture, solved, glow }
    this.printer = null;
    this.exit = null;
    this.glowSources = []; // { pos: Vector3, color, intensity, distance, active }

    this.emergencyArrows = null;
    this._emergencyGlows = [];

    this._disposables = [];

    this._buildFloorAndCeiling();
    this._buildWalls();
  }

  // ----------------------------------------------------------------- surfaces

  _buildFloorAndCeiling() {
    const span = this.maze.size * CELL;

    const floorTex = makeFloorTexture();
    floorTex.repeat.set(this.maze.size, this.maze.size);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: floorTex }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);
    this._disposables.push(floor.geometry, floor.material, floorTex);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshLambertMaterial({ color: COLORS.ceiling }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    this.group.add(ceil);
    this._disposables.push(ceil.geometry, ceil.material);
  }

  _buildWalls() {
    const maze = this.maze;
    const cells = [];
    // Only build wall cells that actually touch open space; the rest are never seen
    for (let y = 0; y < maze.size; y++) {
      for (let x = 0; x < maze.size; x++) {
        if (!maze.isSolid(x, y)) continue;
        let exposed = false;
        for (let dy = -1; dy <= 1 && !exposed; dy++) {
          for (let dx = -1; dx <= 1 && !exposed; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (maze.inBounds(x + dx, y + dy) && maze.isOpen(x + dx, y + dy)) exposed = true;
          }
        }
        if (exposed) cells.push([x, y]);
      }
    }

    const wallTex = makeWallTexture();
    wallTex.repeat.set(1, 1);
    const geo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: wallTex });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    mesh.frustumCulled = false;

    cells.forEach(([x, y], i) => {
      _v.set(maze.cellToWorldX(x), WALL_H / 2, maze.cellToWorldZ(y));
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this._disposables.push(geo, mat, wallTex);
    this.wallMesh = mesh;

    // A dim emissive strip along the top of walls suggests dead fluorescents
    const trimGeo = new THREE.BoxGeometry(CELL * 1.002, 0.09, CELL * 1.002);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x16222e });
    const trim = new THREE.InstancedMesh(trimGeo, trimMat, cells.length);
    trim.frustumCulled = false;
    cells.forEach(([x, y], i) => {
      _v.set(maze.cellToWorldX(x), WALL_H - 0.06, maze.cellToWorldZ(y));
      _m.compose(_v, _q, _s);
      trim.setMatrixAt(i, _m);
    });
    trim.instanceMatrix.needsUpdate = true;
    this.group.add(trim);
    this._disposables.push(trimGeo, trimMat);

    this._buildEmergencyStrips(cells);
  }

  /**
   * Red floor arrows along wall bases. Each arrow rotates to point along the
   * maze path toward the nearest unsolved terminal.
   */
  _buildEmergencyStrips(wallCells) {
    const maze = this.maze;
    const faces = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const segments = [];
    for (const [wx, wy] of wallCells) {
      const wcx = maze.cellToWorldX(wx);
      const wcz = maze.cellToWorldZ(wy);
      for (const f of faces) {
        const ox = wx + f.dx;
        const oy = wy + f.dy;
        if (!maze.inBounds(ox, oy) || !maze.isOpen(ox, oy)) continue;
        segments.push({
          px: wcx + f.dx * (CELL * 0.44),
          pz: wcz + f.dy * (CELL * 0.44),
          cx: ox,
          cy: oy,
        });
      }
    }
    if (!segments.length) return;

    const geo = makeFloorArrowGeometry();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4418,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, segments.length);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;

    segments.forEach((seg, i) => {
      _v.set(seg.px, 0.062, seg.pz);
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(i, _m);

      if (i % 2 === 0) {
        const glow = {
          pos: new THREE.Vector3(seg.px, 0.14, seg.pz),
          color: 0xff5520,
          intensity: 10.5,
          distance: 7.8,
          active: true,
        };
        this.glowSources.push(glow);
        this._emergencyGlows.push(glow);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this._disposables.push(geo, mat);
    this.emergencyArrows = { mesh, segments };
  }

  /** Nearest unsolved Chromebook by maze walk distance from a cell. */
  _nearestUnsolvedLaptop(fromCell) {
    const unsolved = this.laptops.filter((lp) => !lp.solved);
    if (!unsolved.length) return null;

    let best = null;
    let bestD = Infinity;
    for (const lp of unsolved) {
      const flow = this.maze.buildFlow(lp.cell[0], lp.cell[1]);
      const d = this.maze.flowDistance(flow, fromCell[0], fromCell[1]);
      this.maze.invalidateFlow();
      if (d >= 0 && d < bestD) {
        bestD = d;
        best = lp;
      }
    }
    return best || unsolved[0];
  }

  /** Rotate floor arrows toward the nearest unsolved terminal. */
  updateEmergencyArrows(playerPos) {
    const arrows = this.emergencyArrows;
    if (!arrows) return;

    const pcx = this.maze.worldToCellX(playerPos.x);
    const pcy = this.maze.worldToCellZ(playerPos.z);
    const target = this._nearestUnsolvedLaptop([pcx, pcy]);

    if (!target) {
      arrows.mesh.visible = false;
      for (const g of this._emergencyGlows) g.active = false;
      return;
    }

    arrows.mesh.visible = true;
    for (const g of this._emergencyGlows) g.active = true;

    const flow = this.maze.buildFlow(target.cell[0], target.cell[1]);
    const { mesh, segments } = arrows;

    segments.forEach((seg, i) => {
      let angle = Math.atan2(target.x - seg.px, target.z - seg.pz);
      const step = this.maze.flowStep(flow, seg.cx, seg.cy);
      if (step) {
        const sx = this.maze.cellToWorldX(step[0]);
        const sz = this.maze.cellToWorldZ(step[1]);
        angle = Math.atan2(sx - seg.px, sz - seg.pz);
      }

      _v.set(seg.px, 0.062, seg.pz);
      _q.setFromAxisAngle(_axisY, angle);
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(i, _m);
    });

    mesh.instanceMatrix.needsUpdate = true;
    this.maze.invalidateFlow();
  }

  // ------------------------------------------------------------------- tables

  /**
   * Places tables in open cells.
   *
   * Tables are SOLID. The tabletop slab blocks a standing player, so the only
   * way in is to crouch and crawl through the gap under it - which is also the
   * only place enemies cannot reach you. The top is deliberately narrower than
   * a cell so you can still squeeze past one in a corridor while standing.
   */
  buildTables(cells) {
    const topGeo = new THREE.BoxGeometry(TABLE.topW, TABLE.topThickness, TABLE.topW);
    const topMat = new THREE.MeshLambertMaterial({ color: COLORS.table });
    const tops = new THREE.InstancedMesh(topGeo, topMat, cells.length);
    tops.frustumCulled = false;

    const legGeo = new THREE.BoxGeometry(TABLE.legW, TABLE.topY, TABLE.legW);
    const legMat = new THREE.MeshLambertMaterial({ color: COLORS.tableLeg });
    const legs = new THREE.InstancedMesh(legGeo, legMat, cells.length * 4);
    legs.frustumCulled = false;

    // Glow tape around the underside edge: the visual language for "you can
    // hide here". Unlit material so it reads even with the flashlight off.
    const tapeGeo = new THREE.BoxGeometry(TABLE.topW * 0.98, 0.035, 0.05);
    const tapeMat = new THREE.MeshBasicMaterial({
      color: 0x2fd4d0,
      transparent: true,
      opacity: 0.34,
    });
    const tape = new THREE.InstancedMesh(tapeGeo, tapeMat, cells.length * 4);
    tape.frustumCulled = false;

    const shadeGeo = new THREE.BoxGeometry(TABLE.topW * 1.05, 0.04, TABLE.topW * 1.05);
    const shadeMat = new THREE.MeshBasicMaterial({
      color: 0x04060c,
      transparent: true,
      opacity: 0.72,
    });
    const shades = new THREE.InstancedMesh(shadeGeo, shadeMat, cells.length);
    shades.frustumCulled = false;

    const patchGeo = new THREE.BoxGeometry(TABLE.topW * 1.12, 0.012, TABLE.topW * 1.12);
    const patchMat = new THREE.MeshLambertMaterial({ color: 0x0e1218 });
    const patches = new THREE.InstancedMesh(patchGeo, patchMat, cells.length);
    patches.frustumCulled = false;

    const off = TABLE.legInset;
    const tapeY = TABLE.topY - TABLE.topThickness / 2 - 0.03;
    const tapeEdge = TABLE.topW / 2 - 0.03;

    cells.forEach(([cx, cy], i) => {
      const x = this.maze.cellToWorldX(cx);
      const z = this.maze.cellToWorldZ(cy);

      _v.set(x, TABLE.topY, z);
      _m.compose(_v, _q, _s);
      tops.setMatrixAt(i, _m);

      _v.set(x, 2.55, z);
      _m.compose(_v, _q, _s);
      shades.setMatrixAt(i, _m);

      _v.set(x, 0.006, z);
      _m.compose(_v, _q, _s);
      patches.setMatrixAt(i, _m);

      _v.set(x, TABLE.topY, z);

      const corners = [[-off, -off], [off, -off], [-off, off], [off, off]];
      corners.forEach(([ox, oz], k) => {
        _v.set(x + ox, TABLE.topY / 2, z + oz);
        _m.compose(_v, _q, _s);
        legs.setMatrixAt(i * 4 + k, _m);
      });

      // Four tape strips, one per edge
      const edges = [
        { px: 0, pz: -tapeEdge, rot: 0 },
        { px: 0, pz: tapeEdge, rot: 0 },
        { px: -tapeEdge, pz: 0, rot: Math.PI / 2 },
        { px: tapeEdge, pz: 0, rot: Math.PI / 2 },
      ];
      edges.forEach((e, k) => {
        _v.set(x + e.px, tapeY, z + e.pz);
        _q.setFromAxisAngle(_axisY, e.rot);
        _m.compose(_v, _q, _s);
        tape.setMatrixAt(i * 4 + k, _m);
      });
      _q.identity();

      // --- colliders -------------------------------------------------------
      // Tabletop slab: blocks standing bodies, passable when crouched
      this.obstacles.add({
        x, z,
        hx: TABLE.topW / 2,
        hz: TABLE.topW / 2,
        y0: TABLE.bandY0,
        y1: TABLE.bandY1,
        tag: 'table-top',
      });
      // Legs are solid all the way down, so you crawl BETWEEN them
      corners.forEach(([ox, oz]) => {
        this.obstacles.add({
          x: x + ox,
          z: z + oz,
          hx: TABLE.legW / 2 + 0.02,
          hz: TABLE.legW / 2 + 0.02,
          y0: 0,
          y1: TABLE.topY,
          tag: 'table-leg',
        });
      });

      this.tables.push({
        x, z, cell: [cx, cy], height: TABLE.topY, hideable: true,
      });
    });

    tops.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
    tape.instanceMatrix.needsUpdate = true;
    shades.instanceMatrix.needsUpdate = true;
    patches.instanceMatrix.needsUpdate = true;
    this.group.add(tops);
    this.group.add(legs);
    this.group.add(tape);
    this.group.add(shades);
    this.group.add(patches);
    this._disposables.push(topGeo, topMat, legGeo, legMat, tapeGeo, tapeMat,
      shadeGeo, shadeMat, patchGeo, patchMat);
  }

  /** Hard plastic student chairs paired with tables; decorative, not solid. */
  buildChairs(chairPlacements) {
    if (!chairPlacements.length) return;

    const plasticMat = new THREE.MeshLambertMaterial({ color: 0x4a5568 });
    const seatY = 0.48;
    const seatGeo = new THREE.BoxGeometry(0.36, 0.04, 0.34);
    const backGeo = new THREE.BoxGeometry(0.36, 0.32, 0.035);
    const legGeo = new THREE.BoxGeometry(0.035, seatY, 0.035);

    for (const { cell, tableCell } of chairPlacements) {
      const x = this.maze.cellToWorldX(cell[0]);
      const z = this.maze.cellToWorldZ(cell[1]);
      const tx = this.maze.cellToWorldX(tableCell[0]);
      const tz = this.maze.cellToWorldZ(tableCell[1]);

      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(tx - x, tz - z);

      const seat = new THREE.Mesh(seatGeo, plasticMat);
      seat.position.y = seatY;
      g.add(seat);

      const back = new THREE.Mesh(backGeo, plasticMat);
      back.position.set(0, seatY + 0.18, -0.15);
      g.add(back);

      for (const [lx, lz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) {
        const leg = new THREE.Mesh(legGeo, plasticMat);
        leg.position.set(lx, seatY / 2, lz);
        g.add(leg);
      }

      this.group.add(g);
    }

    this._disposables.push(seatGeo, backGeo, legGeo, plasticMat);
  }

  /**
   * The table the point is actually underneath, or null. Tests the tabletop
   * footprint rather than the cell, because the top is narrower than a cell and
   * standing beside a desk is not the same as being under it.
   */
  tableAt(x, z, margin = -0.06) {
    const half = TABLE.topW / 2 + margin;
    const cx = this.maze.worldToCellX(x);
    const cz = this.maze.worldToCellZ(z);
    for (const t of this.tables) {
      if (t.cell[0] !== cx || t.cell[1] !== cz) continue;
      if (Math.abs(x - t.x) <= half && Math.abs(z - t.z) <= half) return t;
    }
    return null;
  }

  /** Nearest hideable table within `range`, for the "crouch to hide" hint. */
  tableNear(x, z, range = 2.4) {
    let best = null;
    let bestD = range;
    for (const t of this.tables) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // ---------------------------------------------------------------- terminals

  /** One Chromebook on a desk, per cell in `cells`. */
  buildLaptops(cells) {
    cells.forEach(([cx, cy], i) => {
      const x = this.maze.cellToWorldX(cx);
      const z = this.maze.cellToWorldZ(cy);
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      // Face the laptop a random direction so the lab feels lived-in
      group.rotation.y = this.rng.range(0, Math.PI * 2);

      const DESK_Y = 0.78;

      // Desk
      const deskTop = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.08, 1.0),
        new THREE.MeshLambertMaterial({ color: 0x39414f }),
      );
      deskTop.position.y = DESK_Y;
      group.add(deskTop);
      this._disposables.push(deskTop.geometry, deskTop.material);

      const legMat = new THREE.MeshLambertMaterial({ color: 0x20242c });
      const legGeo = new THREE.BoxGeometry(0.09, DESK_Y, 0.09);
      [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]].forEach(([ox, oz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(ox, DESK_Y / 2, oz);
        group.add(leg);
      });
      this._disposables.push(legGeo, legMat);

      // Chromebook body
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.035, 0.44),
        new THREE.MeshLambertMaterial({ color: 0x4a5261 }),
      );
      base.position.set(0, DESK_Y + 0.06, 0.06);
      group.add(base);
      this._disposables.push(base.geometry, base.material);

      const keys = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.008, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x1d222b }),
      );
      keys.position.set(0, DESK_Y + 0.082, 0.08);
      group.add(keys);
      this._disposables.push(keys.geometry, keys.material);

      // Lid + glowing screen
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      drawScreenTexture(canvas, { index: i, state: 'locked' });
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      const lid = new THREE.Group();
      lid.position.set(0, DESK_Y + 0.07, -0.16);
      lid.rotation.x = -0.28;

      const lidBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.4, 0.02),
        new THREE.MeshLambertMaterial({ color: 0x434b59 }),
      );
      lidBack.position.set(0, 0.2, -0.012);
      lid.add(lidBack);
      this._disposables.push(lidBack.geometry, lidBack.material);

      const screenMat = new THREE.MeshBasicMaterial({ map: texture });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.35), screenMat);
      screen.position.set(0, 0.2, 0.002);
      lid.add(screen);
      this._disposables.push(screen.geometry, screenMat, texture);

      group.add(lid);
      this.group.add(group);

      // The workstation is solid from floor to desktop. It is lower than a
      // tabletop but still taller than a crouching body, so there is no
      // crawling under a Chromebook station - only tables hide you.
      this.obstacles.addRotated({
        x, z,
        w: 1.7, d: 1.0,
        rotation: group.rotation.y,
        y0: 0,
        y1: DESK_Y + 0.5,
        tag: 'laptop-desk',
      });

      // Screens are the main light source in the lab
      const glow = {
        pos: new THREE.Vector3(x, DESK_Y + 0.34, z),
        color: COLORS.screenGlow,
        intensity: 8.5,
        distance: 11,
        active: true,
      };
      this.glowSources.push(glow);

      this.laptops.push({
        index: i,
        x, z,
        cell: [cx, cy],
        group,
        lid,
        screen,
        canvas,
        texture,
        solved: false,
        glow,
        position: new THREE.Vector3(x, DESK_Y + 0.3, z),
      });
    });
  }

  markLaptopSolved(index, fragment) {
    const lp = this.laptops[index];
    if (!lp || lp.solved) return;
    lp.solved = true;
    drawScreenTexture(lp.canvas, { index, state: 'solved', glyphs: fragment });
    lp.texture.needsUpdate = true;
    lp.glow.color = COLORS.exit;
    lp.glow.intensity = 6.5;
  }

  // ------------------------------------------------------------------ printer

  buildPrinter(cell) {
    const [cx, cy] = cell;
    const x = this.maze.cellToWorldX(cx);
    const z = this.maze.cellToWorldZ(cy);
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const CASE_H = 1.5;
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x2b3342 });

    // Base cabinet
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.3), frameMat);
    base.position.y = 0.275;
    group.add(base);
    this._disposables.push(base.geometry);

    // Corner posts
    const postGeo = new THREE.BoxGeometry(0.09, CASE_H, 0.09);
    [[-0.68, -0.58], [0.68, -0.58], [-0.68, 0.58], [0.68, 0.58]].forEach(([ox, oz]) => {
      const p = new THREE.Mesh(postGeo, frameMat);
      p.position.set(ox, 0.55 + CASE_H / 2, oz);
      group.add(p);
    });
    this._disposables.push(postGeo, frameMat);

    // Top rail + moving print head
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.07, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x3c4657 }),
    );
    rail.position.set(0, 0.55 + CASE_H - 0.12, 0);
    group.add(rail);
    this._disposables.push(rail.geometry, rail.material);

    const headMat = new THREE.MeshBasicMaterial({ color: 0xff7a3c });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), headMat);
    head.position.set(0, 0.55 + CASE_H - 0.28, 0);
    group.add(head);
    this._disposables.push(head.geometry, headMat);

    // Glowing print bed - this is the beacon players look for
    const bedMat = new THREE.MeshBasicMaterial({ color: 0x14384a });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.95), bedMat);
    bed.position.y = 0.6;
    group.add(bed);
    this._disposables.push(bed.geometry, bedMat);

    // Status panel
    const panelCanvas = document.createElement('canvas');
    panelCanvas.width = 128;
    panelCanvas.height = 64;
    const panelTex = new THREE.CanvasTexture(panelCanvas);
    panelTex.colorSpace = THREE.SRGBColorSpace;
    const panelMat = new THREE.MeshBasicMaterial({ map: panelTex });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), panelMat);
    panel.position.set(0, 0.36, 0.655);
    group.add(panel);
    this._disposables.push(panel.geometry, panelMat, panelTex);

    this.group.add(group);

    this.obstacles.add({
      x, z,
      hx: 0.78, hz: 0.68,
      y0: 0, y1: 0.55 + CASE_H,
      tag: 'printer',
    });

    const glow = {
      pos: new THREE.Vector3(x, 0.9, z),
      color: COLORS.printer,
      intensity: 3.0,
      distance: 9,
      active: true,
    };
    this.glowSources.push(glow);

    this.printer = {
      x, z, cell,
      group, bed, bedMat, head, headMat, glow,
      panelCanvas, panelTex,
      position: new THREE.Vector3(x, 0.9, z),
      unlocked: false,
      printed: false,
      keyMesh: null,
    };
    this.updatePrinterPanel(0);
    return this.printer;
  }

  updatePrinterPanel(pieces, printing = false, progress = 0) {
    const p = this.printer;
    if (!p) return;
    const g = p.panelCanvas.getContext('2d');
    const W = p.panelCanvas.width;
    const H = p.panelCanvas.height;
    const ready = pieces >= 4;

    g.fillStyle = ready ? '#03251a' : '#28060c';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = ready ? 'rgba(82,255,159,0.6)' : 'rgba(255,77,94,0.6)';
    g.lineWidth = 3;
    g.strokeRect(3, 3, W - 6, H - 6);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (printing) {
      g.fillStyle = '#35e0ff';
      g.font = 'bold 15px ui-monospace, monospace';
      g.fillText('PRINTING', W / 2, H * 0.32);
      g.font = 'bold 19px ui-monospace, monospace';
      g.fillText(`${Math.round(progress * 100)}%`, W / 2, H * 0.68);
    } else if (ready) {
      g.fillStyle = '#52ff9f';
      g.font = 'bold 14px ui-monospace, monospace';
      g.fillText('CODE ACCEPTED', W / 2, H * 0.34);
      g.font = 'bold 12px ui-monospace, monospace';
      g.fillText('PRESS E', W / 2, H * 0.68);
    } else {
      g.fillStyle = '#ff4d5e';
      g.font = 'bold 14px ui-monospace, monospace';
      g.fillText('LOCKED', W / 2, H * 0.32);
      g.font = 'bold 13px ui-monospace, monospace';
      g.fillText(`${pieces} / 4 CODE`, W / 2, H * 0.68);
    }
    p.panelTex.needsUpdate = true;
  }

  setPrinterUnlocked(on) {
    if (!this.printer) return;
    this.printer.unlocked = on;
    this.printer.bedMat.color.setHex(on ? 0x1f6f52 : 0x14384a);
    this.printer.glow.intensity = on ? 7.5 : 3.0;
    this.printer.glow.color = on ? COLORS.exit : COLORS.printer;
  }

  /** Spawns the printed key sitting on the print bed. */
  spawnKey() {
    if (!this.printer || this.printer.keyMesh) return this.printer.keyMesh;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.key });

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.05), mat);
    group.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), mat);
    ring.position.x = -0.22;
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), mat);
    tooth1.position.set(0.13, -0.06, 0);
    group.add(tooth1);
    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), mat);
    tooth2.position.set(0.03, -0.05, 0);
    group.add(tooth2);

    this._disposables.push(shaft.geometry, ring.geometry, tooth1.geometry, tooth2.geometry, mat);

    group.position.set(this.printer.x, 0.78, this.printer.z);
    this.group.add(group);

    const glow = {
      pos: new THREE.Vector3(this.printer.x, 0.85, this.printer.z),
      color: COLORS.key,
      intensity: 6,
      distance: 8,
      active: true,
    };
    this.glowSources.push(glow);

    this.printer.keyMesh = group;
    this.printer.keyGlow = glow;
    this.printer.printed = true;
    return group;
  }

  removeKeyMesh() {
    if (!this.printer?.keyMesh) return;
    this.group.remove(this.printer.keyMesh);
    if (this.printer.keyGlow) this.printer.keyGlow.active = false;
    this.printer.keyMesh = null;
  }

  // --------------------------------------------------------------------- exit

  static EXIT_FACING = {
    west: {
      rot: Math.PI / 2,
      ox: -CELL / 2 + 0.14,
      oz: 0,
      hinge: 'negX',
      openAngle: -Math.PI / 2,
    },
    east: {
      rot: -Math.PI / 2,
      ox: CELL / 2 - 0.14,
      oz: 0,
      hinge: 'posX',
      openAngle: Math.PI / 2,
    },
    north: {
      rot: 0,
      ox: 0,
      oz: -CELL / 2 + 0.14,
      hinge: 'negZ',
      openAngle: Math.PI / 2,
    },
    south: {
      rot: Math.PI,
      ox: 0,
      oz: CELL / 2 - 0.14,
      hinge: 'posZ',
      openAngle: -Math.PI / 2,
    },
  };

  buildExit(cell, wallSide = null) {
    const [cx, cy] = cell;
    const x = this.maze.cellToWorldX(cx);
    const z = this.maze.cellToWorldZ(cy);

    let facing = wallSide && Lab.EXIT_FACING[wallSide] ? Lab.EXIT_FACING[wallSide] : null;
    if (!facing) {
      const distances = [
        { d: cx, ...Lab.EXIT_FACING.west },
        { d: this.maze.size - 1 - cx, ...Lab.EXIT_FACING.east },
        { d: cy, ...Lab.EXIT_FACING.north },
        { d: this.maze.size - 1 - cy, ...Lab.EXIT_FACING.south },
      ].sort((a, b) => a.d - b.d)[0];
      facing = {
        rot: distances.rot,
        ox: distances.ox,
        oz: distances.oz,
        hinge: distances.hinge,
        openAngle: distances.openAngle,
      };
    }

    const dx = x + facing.ox;
    const dz = z + facing.oz;

    const DOOR_W = 1.6;
    const DOOR_H = 2.4;
    const DOOR_T = 0.12;
    const halfW = DOOR_W / 2;

    const group = new THREE.Group();
    group.position.set(dx, 0, dz);
    group.rotation.y = facing.rot;

    const doorPivot = new THREE.Group();
    switch (facing.hinge) {
      case 'negX':
        doorPivot.position.set(-halfW, 1.2, 0);
        break;
      case 'posX':
        doorPivot.position.set(halfW, 1.2, 0);
        break;
      case 'negZ':
        doorPivot.position.set(0, 1.2, -halfW);
        break;
      default:
        doorPivot.position.set(0, 1.2, halfW);
        break;
    }
    group.add(doorPivot);

    const doorMat = new THREE.MeshLambertMaterial({ color: 0x24303f });
    const door = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, DOOR_T), doorMat);
    switch (facing.hinge) {
      case 'negX':
        door.position.set(halfW, 0, 0);
        break;
      case 'posX':
        door.position.set(-halfW, 0, 0);
        break;
      case 'negZ':
        door.position.set(0, 0, halfW);
        break;
      default:
        door.position.set(0, 0, -halfW);
        break;
    }
    doorPivot.add(door);
    this._disposables.push(door.geometry, doorMat);

    const barMat = new THREE.MeshBasicMaterial({ color: 0x8a939f });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.09), barMat);
    bar.position.set(0, -0.15, 0.1);
    door.add(bar);
    this._disposables.push(bar.geometry, barMat);

    // EXIT sign above the door
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 128;
    signCanvas.height = 64;
    const sg = signCanvas.getContext('2d');
    sg.fillStyle = '#04120b';
    sg.fillRect(0, 0, 128, 64);
    sg.strokeStyle = '#52ff9f';
    sg.lineWidth = 4;
    sg.strokeRect(4, 4, 120, 56);
    sg.fillStyle = '#7dffbc';
    sg.font = 'bold 34px ui-monospace, monospace';
    sg.textAlign = 'center';
    sg.textBaseline = 'middle';
    sg.fillText('EXIT', 64, 34);
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), signMat);
    sign.position.set(0, 2.72, 0.08);
    group.add(sign);
    this._disposables.push(sign.geometry, signMat, signTex);

    this.group.add(group);

    const glow = {
      pos: new THREE.Vector3(dx, 2.7, dz),
      color: COLORS.exit,
      intensity: 5,
      distance: 12,
      active: true,
    };
    this.glowSources.push(glow);

    const obstacle = this.obstacles.addRotated({
      x: dx,
      z: dz,
      w: 1.6, d: 0.16,
      rotation: facing.rot,
      y0: 0, y1: 2.4,
      tag: 'exit-door',
    });

    this.exit = {
      x: dx,
      z: dz,
      cell: [cx, cy],
      side: wallSide,
      facing,
      group, door, doorPivot, doorMat, glow,
      obstacle,
      position: new THREE.Vector3(dx, 1.2, dz),
      open: false,
    };
    return this.exit;
  }

  openExitDoor() {
    if (!this.exit || this.exit.open) return;
    this.exit.open = true;
    this.exit.doorMat.color.setHex(0x0e3a26);
    this.exit.glow.intensity = 11;
    if (this.exit.obstacle) {
      this.obstacles.remove(this.exit.obstacle);
      this.exit.obstacle = null;
    }
    if (this.exit.doorPivot) {
      this.exit.doorPivot.rotation.y = this.exit.facing.openAngle ?? Math.PI / 2;
    }
  }

  // --------------------------------------------------------------- decoration

  /** Server racks and dead monitors, purely to make the lab feel like a lab. */
  buildProps(cells) {
    const rackMat = new THREE.MeshLambertMaterial({ color: 0x1b2029 });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x2f6f5a });

    cells.forEach(([cx, cy]) => {
      const x = this.maze.cellToWorldX(cx);
      const z = this.maze.cellToWorldZ(cy);
      const kind = this.rng.int(0, 2);
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = this.rng.range(0, Math.PI * 2);

      // Props are solid at every height, so they are cover you cannot pass
      const propBox = [
        { w: 0.9, d: 0.7, h: 2.0 },   // server rack
        { w: 0.8, d: 0.6, h: 1.3 },   // stacked tubs
        { w: 1.0, d: 0.7, h: 1.45 },  // monitor cart
      ][kind];
      this.obstacles.addRotated({
        x, z,
        w: propBox.w, d: propBox.d,
        rotation: g.rotation.y,
        y0: 0, y1: propBox.h,
        tag: 'prop',
      });

      if (kind === 0) {
        // Server rack with blinking LEDs
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.7), rackMat);
        body.position.y = 1.0;
        g.add(body);
        this._disposables.push(body.geometry);
        for (let i = 0; i < 6; i++) {
          const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), ledMat);
          led.position.set(-0.28 + (i % 3) * 0.12, 0.6 + Math.floor(i / 3) * 0.5, 0.36);
          g.add(led);
          this._disposables.push(led.geometry);
        }
      } else if (kind === 1) {
        // Stack of storage tubs
        const tubMat = new THREE.MeshLambertMaterial({ color: 0x2a3546 });
        for (let i = 0; i < this.rng.int(2, 3); i++) {
          const tub = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.6), tubMat);
          tub.position.set(this.rng.range(-0.08, 0.08), 0.21 + i * 0.44, 0);
          g.add(tub);
          this._disposables.push(tub.geometry);
        }
        this._disposables.push(tubMat);
      } else {
        // Dead monitor on a cart
        const cartMat = new THREE.MeshLambertMaterial({ color: 0x232a35 });
        const cart = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.7), cartMat);
        cart.position.y = 0.82;
        g.add(cart);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.08), cartMat);
        post.position.y = 0.41;
        g.add(post);
        const mon = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.52, 0.06),
          new THREE.MeshLambertMaterial({ color: 0x11161d }),
        );
        mon.position.set(0, 1.15, 0);
        g.add(mon);
        this._disposables.push(cart.geometry, post.geometry, cartMat, mon.geometry, mon.material);
      }

      this.group.add(g);
    });

    this._disposables.push(rackMat, ledMat);
  }

  dispose() {
    this.scene.remove(this.group);
    for (const d of this._disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    this._disposables.length = 0;
  }
}
