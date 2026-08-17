/**
 * Owns every hunter in the lab and the pressure curve.
 *
 * All hunting mice share one breadth-first flow field toward the player, rebuilt
 * only when the player changes cell or a short timer expires, so adding more
 * enemies costs almost nothing.
 */

import { EvilMouse, disposeMouseGeometry } from './mouse.js';
import { GhostVirus, disposeVirusGeometry } from './virus.js';
import { PRINTER } from '../config.js';

const FLOW_INTERVAL = 0.3;
const SAFE_SPAWN_CELLS = 7;   // graph distance from the player when spawning

export class EnemyManager {
  constructor(scene, maze, rng, diff, obstacles = null) {
    this.scene = scene;
    this.maze = maze;
    this.rng = rng;
    this.diff = diff;
    this.obstacles = obstacles;

    this.mice = [];
    this.viruses = [];
    this.escalation = 0;
    this.swarming = false;
    this.frozen = false;
    this.globalAlertTimer = 0;

    this._flow = null;
    this._flowTimer = 0;
    this._flowCell = [-1, -1];
  }

  setGlobalAlert(seconds) {
    this.globalAlertTimer = Math.max(this.globalAlertTimer, seconds);
  }

  spawnInitial(playerCell) {
    for (let i = 0; i < this.diff.mice; i++) this.spawnMouse(playerCell);
    for (let i = 0; i < this.diff.viruses; i++) this.spawnVirus(playerCell);
  }

  _safeCell(playerCell) {
    const cell = this.maze.cellAwayFrom(playerCell[0], playerCell[1], SAFE_SPAWN_CELLS);
    return cell || this.rng.pick(this.maze.openCells());
  }

  spawnMouse(playerCell) {
    const m = new EvilMouse(
      this.maze, this._safeCell(playerCell), this.rng, this.mice.length, this.obstacles,
    );
    this.scene.add(m.mesh);
    this.mice.push(m);
    return m;
  }

  spawnVirus(playerCell) {
    const v = new GhostVirus(this.maze, this._safeCell(playerCell), this.rng, this.viruses.length);
    this.scene.add(v.mesh);
    this.viruses.push(v);
    return v;
  }

  /** Called after each code piece: the lab notices you are winning. */
  escalate(playerCell) {
    if (this.diff.noEnemies) return;
    this.escalation += this.diff.escalationPerPiece;
    const speed = 1 + this.escalation * 0.055;
    for (const m of this.mice) m.speedScale = speed;
    for (const v of this.viruses) v.speedScale = speed;

    // Alternate what gets added so both threats stay represented
    if (this.escalation % 2 < 1) this.spawnMouse(playerCell);
    else this.spawnVirus(playerCell);
  }

  /** The climax during the print: everything converges and speeds up. */
  startSwarm(playerCell) {
    if (this.diff.noEnemies) return;
    if (this.swarming) return;
    this.swarming = true;
    for (let i = 0; i < PRINTER.swarmSpawn; i++) {
      if (i % 2 === 0) this.spawnMouse(playerCell);
      else this.spawnVirus(playerCell);
    }
    const s = PRINTER.swarmSpeedScale * (1 + this.escalation * 0.055);
    for (const m of this.mice) m.speedScale = s;
    for (const v of this.viruses) v.speedScale = s;
  }

  endSwarm() {
    if (!this.swarming) return;
    this.swarming = false;
    const s = 1 + this.escalation * 0.055;
    for (const m of this.mice) m.speedScale = s;
    for (const v of this.viruses) v.speedScale = s;
  }

  get glowSources() {
    const out = [];
    for (const m of this.mice) out.push(m.glow);
    for (const v of this.viruses) out.push(v.glow);
    return out;
  }

  /**
   * @param {number} dt
   * @param {object} player
   * @param {Array<object>} [lures] armed cheetos bags the mice may divert to
   * @returns {{damage:number, batteryDrain:number, hunters:number, nearest:number}}
   */
  update(dt, player, lures = null) {
    // Frozen enemies still idle and breathe on the spot - their animations run on
    // wall-clock time - but no timer advances, so nothing closes in and nothing
    // bites while the player is reading
    const adt = this.frozen ? 0 : dt;
    const [pcx, pcy] = this.maze.worldToCell(player.pos.x, player.pos.z);

    // Rebuild the shared flow field on a timer or when the player moves cell
    this._flowTimer -= dt;
    if (this._flowTimer <= 0 || pcx !== this._flowCell[0] || pcy !== this._flowCell[1]) {
      this._flowTimer = FLOW_INTERVAL;
      this._flowCell = [pcx, pcy];
      this.maze.invalidateFlow();
      this._flow = this.maze.buildFlow(pcx, pcy);
      // Patrol paths reuse the cache, so release it for them
      this.maze.invalidateFlow();
    }

    if (this.globalAlertTimer > 0) this.globalAlertTimer -= adt;

    const alertActive = this.globalAlertTimer > 0;
    let damage = 0;
    let batteryDrain = 0;
    let hunters = 0;
    let nearest = Infinity;
    let burning = false;
    let burnCharge = 0;
    let glitched = 0;
    let attackFrom = null;
    let attackDist = Infinity;

    let feeding = 0;

    const noteHit = (ev, pos) => {
      if (!ev?.hit || !pos) return;
      const d = Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z);
      if (d < attackDist) {
        attackDist = d;
        attackFrom = pos;
      }
    };

    // Reverse iteration so a mouse that popped this frame can be reaped in place
    for (let i = this.mice.length - 1; i >= 0; i--) {
      const m = this.mice[i];
      if (m.dead) {
        m.dispose(this.scene);
        this.mice.splice(i, 1);
        continue;
      }
      const ev = m.update(adt, player, this._flow, this.mice, this.diff, lures, alertActive);
      if (ev?.hit && !this.frozen) {
        damage += ev.hit;
        noteHit(ev, ev.from);
      }
      if (m.hunting) hunters++;
      if (m.feeding) feeding++;
      const d = Math.hypot(player.pos.x - m.pos.x, player.pos.z - m.pos.z);
      if (d < nearest) nearest = d;
    }

    for (let i = this.viruses.length - 1; i >= 0; i--) {
      const v = this.viruses[i];
      if (v.dead) {
        v.dispose(this.scene);
        this.viruses.splice(i, 1);
        continue;
      }
      const ev = v.update(adt, player, this.diff, alertActive);
      if (ev?.hit && !this.frozen) {
        damage += ev.hit;
        batteryDrain += ev.batteryDrain || 0;
        noteHit(ev, ev.from);
      }
      if (ev?.glitched) glitched++;
      if (ev?.burning || v.burning) {
        burning = true;
        burnCharge = Math.max(burnCharge, ev?.charge || 0);
      }
      if (v.hunting) hunters++;
      const d = Math.hypot(player.pos.x - v.pos.x, player.pos.z - v.pos.z);
      if (d < nearest) nearest = d;
    }

    return {
      damage, batteryDrain, hunters, nearest, burning, burnCharge, glitched, feeding,
      attackFrom,
    };
  }

  /**
   * Freezes every hunter in place. Used while the player is at a terminal on the
   * two lower difficulties: reading a security prompt with something walking up
   * behind you is a memory test with a jump scare attached, and the point of the
   * terminal is the thinking.
   */
  setFrozen(frozen) {
    this.frozen = !!frozen;
  }

  dispose() {
    for (const m of this.mice) m.dispose(this.scene);
    for (const v of this.viruses) v.dispose(this.scene);
    this.mice.length = 0;
    this.viruses.length = 0;
    disposeMouseGeometry();
    disposeVirusGeometry();
  }
}
