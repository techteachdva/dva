/**
 * Circuit-board beetles — faster than mice, less aggressive, killed by a whole cheetos bag.
 */

import * as THREE from '../../vendor/three.module.js';
import { BUG, CELL, THROWN } from '../config.js';
import { clamp } from '../util.js';
import { audio } from '../audio.js';

const STATE = { PATROL: 0, HUNT: 1, FEED: 2 };

let sharedGeo = null;

function getGeometry() {
  if (sharedGeo) return sharedGeo;
  sharedGeo = {
    body: new THREE.BoxGeometry(0.42, 0.18, 0.52),
    leg: new THREE.BoxGeometry(0.06, 0.04, 0.22),
    antenna: new THREE.BoxGeometry(0.04, 0.22, 0.04),
  };
  return sharedGeo;
}

export class CircuitBug {
  constructor(maze, cell, rng, index, obstacles = null) {
    this.maze = maze;
    this.obstacles = obstacles;
    this.rng = rng;
    this.index = index;

    const c = maze.cellCenter(cell[0], cell[1]);
    this.pos = new THREE.Vector3(c.x, 0.22, c.z);
    this.vel = new THREE.Vector3();
    this.heading = rng.range(0, Math.PI * 2);
    this.state = STATE.PATROL;
    this.patrolTarget = null;
    this.attackCooldown = 0;
    this.dashTimer = rng.range(0, BUG.dashTime);
    this.resting = false;
    this.speedScale = 1;
    this.hunting = false;
    this.dead = false;
    this.feeding = false;
    this.lure = null;
    this._munchTimer = 0;

    this.mesh = this._buildMesh();
    this.glow = {
      pos: new THREE.Vector3().copy(this.pos),
      color: 0x44ff88,
      intensity: 1.8,
      distance: 5,
      active: true,
    };
  }

  _buildMesh() {
    const g = getGeometry();
    const group = new THREE.Group();
    const body = new THREE.Mesh(g.body, new THREE.MeshLambertMaterial({ color: 0x1a4028 }));
    body.position.y = 0.12;
    group.add(body);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.04, 0.46),
      new THREE.MeshBasicMaterial({ color: 0x22cc66 }),
    );
    board.position.y = 0.22;
    group.add(board);
    for (const [x, z] of [[-0.12, 0.15], [0.12, 0.15], [-0.12, -0.15], [0.12, -0.15]]) {
      const leg = new THREE.Mesh(g.leg, new THREE.MeshLambertMaterial({ color: 0x0a2018 }));
      leg.position.set(x, 0.06, z);
      group.add(leg);
    }
    group.position.copy(this.pos);
    return group;
  }

  pop() {
    if (this.dead) return false;
    this.dead = true;
    this.feeding = false;
    this.lure = null;
    return true;
  }

  _findLure(lures) {
    let best = null;
    let bestD = THROWN.bagLureRange;
    for (const l of lures) {
      const d = Math.hypot(l.pos.x - this.pos.x, l.pos.z - this.pos.z);
      if (d >= bestD) continue;
      if (d < CELL * 1.5 || this.maze.lineOfSight(this.pos.x, this.pos.z, l.pos.x, l.pos.z)) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  _senses(player, diff) {
    if (!player.alive || player.hidden && diff.hiddenEvade) return false;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < player.noise * 0.8) return true;
    if (dist > BUG.sightRange * diff.sightScale) return false;
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;
    if (dot < Math.cos(BUG.sightAngle)) return false;
    return this.maze.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
  }

  update(dt, player, flow, diff, lures = null) {
    if (this.dead) return null;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    this.lure = lures?.length ? this._findLure(lures) : null;
    if (this.lure) {
      this.state = STATE.FEED;
      this.feeding = true;
    } else if (this.state === STATE.FEED) {
      this.state = STATE.PATROL;
      this.feeding = false;
    }

    if (!this.feeding && this._senses(player, diff)) this.state = STATE.HUNT;
    else if (this.state === STATE.HUNT && !this._senses(player, diff)) this.state = STATE.PATROL;

    this.hunting = this.state === STATE.HUNT;

    this.dashTimer -= dt;
    if (this.dashTimer <= 0) {
      this.resting = !this.resting;
      this.dashTimer = this.resting ? BUG.restTime : BUG.dashTime;
    }
    const rest = this.resting ? 0.15 : 1;

    let tx = this.pos.x;
    let tz = this.pos.z;
    if (this.feeding && this.lure) {
      tx = this.lure.pos.x;
      tz = this.lure.pos.z;
    } else if (this.state === STATE.HUNT) {
      tx = player.pos.x;
      tz = player.pos.z;
    } else {
      if (!this.patrolTarget) {
        const cell = this.rng.pick(this.maze.openCells());
        this.patrolTarget = this.maze.cellCenter(cell[0], cell[1]);
      }
      tx = this.patrolTarget.x;
      tz = this.patrolTarget.z;
    }

    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const speed = (this.state === STATE.HUNT ? BUG.chaseSpeed : BUG.patrolSpeed)
      * this.speedScale * rest * diff.speedScale;
    this.heading += clamp(Math.atan2(dx, dz) - this.heading, -BUG.turnRate * dt, BUG.turnRate * dt);
    this.pos.x += (-Math.sin(this.heading)) * speed * dt;
    this.pos.z += (-Math.cos(this.heading)) * speed * dt;
    this.maze.collide(this.pos, BUG.radius);

    if (this.obstacles) {
      this.obstacles.collide(this.pos, BUG.radius, 0, 0.5);
    }

    if (this.state === STATE.PATROL && this.patrolTarget
      && Math.hypot(this.pos.x - this.patrolTarget.x, this.pos.z - this.patrolTarget.z) < 0.5) {
      this.patrolTarget = null;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.glow.pos.copy(this.pos);

    if (this.feeding && this.lure) {
      this._munchTimer += dt;
      audio.munch(clamp(1 - this.pos.distanceTo(player.pos) / 18, 0, 1));
    } else {
      this._munchTimer = 0;
    }

    if (this.state === STATE.HUNT && dist < BUG.attackRange && this.attackCooldown <= 0
      && !player.hidden) {
      this.attackCooldown = BUG.attackCooldown;
      return { hit: BUG.damage, from: this.pos.clone() };
    }
    return null;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
  }
}

export function disposeBugGeometry() {
  if (!sharedGeo) return;
  for (const g of Object.values(sharedGeo)) g.dispose?.();
  sharedGeo = null;
}
