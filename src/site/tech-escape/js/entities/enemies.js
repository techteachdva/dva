/**
 * Owns every hunter in the lab and the pressure curve.
 */

import { EvilMouse, disposeMouseGeometry } from './mouse.js';
import { GhostVirus, disposeVirusGeometry } from './virus.js';
import { CircuitBug, disposeBugGeometry } from './bug.js';
import { Phisher, disposePhisherGeometry } from './phisher.js';
import { Cyberbully, disposeCyberbullyGeometry } from './cyberbully.js';
import { PRINTER } from '../config.js';

const FLOW_INTERVAL = 0.3;
const SAFE_SPAWN_CELLS = 7;

export class EnemyManager {
  constructor(scene, maze, rng, diff, obstacles = null) {
    this.scene = scene;
    this.maze = maze;
    this.rng = rng;
    this.diff = diff;
    this.obstacles = obstacles;

    this.mice = [];
    this.viruses = [];
    this.bugs = [];
    this.phishers = [];
    this.cyberbullies = [];
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
    const sp = this.diff.specialEnemy || 'virus';
    if (sp === 'virus' || sp === 'all') {
      for (let i = 0; i < this.diff.viruses; i++) this.spawnVirus(playerCell);
    }
    if (sp === 'bug' || sp === 'all') {
      for (let i = 0; i < this.diff.bugs; i++) this.spawnBug(playerCell);
    }
    if (sp === 'phisher' || sp === 'all') {
      for (let i = 0; i < this.diff.phishers; i++) this.spawnPhisher(playerCell);
    }
    if (sp === 'cyberbully' || sp === 'all') {
      for (let i = 0; i < this.diff.cyberbullies; i++) this.spawnCyberbully(playerCell);
    }
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

  spawnBug(playerCell) {
    const b = new CircuitBug(
      this.maze, this._safeCell(playerCell), this.rng, this.bugs.length, this.obstacles,
    );
    this.scene.add(b.mesh);
    this.bugs.push(b);
    return b;
  }

  spawnPhisher(playerCell) {
    const p = new Phisher(this.maze, this._safeCell(playerCell), this.rng, this.phishers.length);
    this.scene.add(p.mesh);
    this.phishers.push(p);
    return p;
  }

  spawnCyberbully(playerCell) {
    const c = new Cyberbully(
      this.maze, this._safeCell(playerCell), this.rng, this.cyberbullies.length, this.obstacles,
    );
    this.scene.add(c.mesh);
    this.cyberbullies.push(c);
    return c;
  }

  escalate(playerCell) {
    if (this.diff.noEnemies) return;
    this.escalation += this.diff.escalationPerPiece;
    const speed = 1 + this.escalation * 0.05;
    for (const m of this.mice) m.speedScale = speed;
    for (const v of this.viruses) v.speedScale = speed;
    for (const b of this.bugs) b.speedScale = speed;
    for (const p of this.phishers) p.speedScale = speed;
    for (const c of this.cyberbullies) c.speedScale = speed;

    const spawnChance = this.diff.escalationSpawnChance ?? 1;
    if (spawnChance < 1 && !this.rng.chance(spawnChance)) return;

    const sp = this.diff.specialEnemy || 'virus';
    if (this.escalation % 2 < 1) this.spawnMouse(playerCell);
    else if (sp === 'virus' || sp === 'all') this.spawnVirus(playerCell);
    else if (sp === 'bug' || sp === 'all') this.spawnBug(playerCell);
    else if (sp === 'phisher' || sp === 'all') this.spawnPhisher(playerCell);
    else if (sp === 'cyberbully' || sp === 'all') this.spawnCyberbully(playerCell);
  }

  startSwarm(playerCell) {
    if (this.diff.noEnemies) return;
    if (this.swarming) return;
    this.swarming = true;
    const sp = this.diff.specialEnemy || 'virus';
    const swarmCount = this.diff.printerSwarmSpawn ?? PRINTER.swarmSpawn;
    for (let i = 0; i < swarmCount; i++) {
      if (i % 3 === 0) this.spawnMouse(playerCell);
      else if (i % 3 === 1 && (sp === 'virus' || sp === 'all')) this.spawnVirus(playerCell);
      else if (sp === 'bug' || sp === 'all') this.spawnBug(playerCell);
      else this.spawnCyberbully(playerCell);
    }
    const s = PRINTER.swarmSpeedScale * (1 + this.escalation * 0.05);
    for (const m of this.mice) m.speedScale = s;
    for (const v of this.viruses) v.speedScale = s;
    for (const b of this.bugs) b.speedScale = s;
    for (const p of this.phishers) p.speedScale = s;
    for (const c of this.cyberbullies) c.speedScale = s;
  }

  endSwarm() {
    if (!this.swarming) return;
    this.swarming = false;
    const s = 1 + this.escalation * 0.05;
    for (const m of this.mice) m.speedScale = s;
    for (const v of this.viruses) v.speedScale = s;
    for (const b of this.bugs) b.speedScale = s;
    for (const p of this.phishers) p.speedScale = s;
    for (const c of this.cyberbullies) c.speedScale = s;
  }

  get glowSources() {
    const out = [];
    for (const m of this.mice) out.push(m.glow);
    for (const v of this.viruses) out.push(v.glow);
    for (const b of this.bugs) out.push(b.glow);
    for (const p of this.phishers) out.push(p.glow);
    for (const c of this.cyberbullies) out.push(c.glow);
    return out;
  }

  update(dt, player, lures = null, inventory = null) {
    const adt = this.frozen ? 0 : dt;
    const [pcx, pcy] = this.maze.worldToCell(player.pos.x, player.pos.z);

    this._flowTimer -= dt;
    if (this._flowTimer <= 0 || pcx !== this._flowCell[0] || pcy !== this._flowCell[1]) {
      this._flowTimer = FLOW_INTERVAL;
      this._flowCell = [pcx, pcy];
      this.maze.invalidateFlow();
      this._flow = this.maze.buildFlow(pcx, pcy);
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
    let pullFromHide = false;
    let stole = null;

    const noteHit = (ev, pos) => {
      if (!ev?.hit || !pos) return;
      const d = Math.hypot(player.pos.x - pos.x, player.pos.z - pos.z);
      if (d < attackDist) {
        attackDist = d;
        attackFrom = pos;
      }
    };

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
      nearest = Math.min(nearest, Math.hypot(player.pos.x - m.pos.x, player.pos.z - m.pos.z));
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
      nearest = Math.min(nearest, Math.hypot(player.pos.x - v.pos.x, player.pos.z - v.pos.z));
    }

    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const b = this.bugs[i];
      if (b.dead) {
        b.dispose(this.scene);
        this.bugs.splice(i, 1);
        continue;
      }
      const ev = b.update(adt, player, this._flow, this.diff, lures);
      if (ev?.hit && !this.frozen) {
        damage += ev.hit;
        noteHit(ev, ev.from);
      }
      if (b.hunting) hunters++;
      nearest = Math.min(nearest, Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z));
    }

    for (let i = this.phishers.length - 1; i >= 0; i--) {
      const p = this.phishers[i];
      if (p.dead) {
        p.dispose(this.scene);
        this.phishers.splice(i, 1);
        continue;
      }
      const ev = p.update(adt, player, this._flow, this.diff, inventory);
      if (ev?.pullFromHide && !this.frozen) pullFromHide = true;
      if (ev?.stole && !this.frozen) stole = ev.stole;
      if (p.hunting) hunters++;
      nearest = Math.min(nearest, Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z));
    }

    for (let i = this.cyberbullies.length - 1; i >= 0; i--) {
      const c = this.cyberbullies[i];
      if (c.dead) {
        c.dispose(this.scene);
        this.cyberbullies.splice(i, 1);
        continue;
      }
      const ev = c.update(adt, player, this._flow, this.diff, alertActive);
      if (ev?.hit && !this.frozen) {
        damage += ev.hit;
        noteHit(ev, ev.from);
      }
      if (c.hunting) hunters++;
      nearest = Math.min(nearest, Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.z));
    }

    return {
      damage, batteryDrain, hunters, nearest, burning, burnCharge, glitched, feeding,
      attackFrom, pullFromHide, stole,
    };
  }

  setFrozen(frozen) {
    this.frozen = !!frozen;
  }

  dispose() {
    for (const m of this.mice) m.dispose(this.scene);
    for (const v of this.viruses) v.dispose(this.scene);
    for (const b of this.bugs) b.dispose(this.scene);
    for (const p of this.phishers) p.dispose(this.scene);
    for (const c of this.cyberbullies) c.dispose(this.scene);
    this.mice.length = 0;
    this.viruses.length = 0;
    this.bugs.length = 0;
    this.phishers.length = 0;
    this.cyberbullies.length = 0;
    disposeMouseGeometry();
    disposeVirusGeometry();
    disposeBugGeometry();
    disposePhisherGeometry();
    disposeCyberbullyGeometry();
  }
}
