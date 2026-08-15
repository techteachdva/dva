/**
 * Evil computer mice.
 *
 * Ground hunters that patrol the corridors, follow a flow field when hunting,
 * and scurry in short bursts instead of gliding. They see, they hear, and -
 * unlike the viruses - they are drawn toward the flashlight beam, so the light
 * that keeps you safe from one enemy makes you a target for the other.
 */

import * as THREE from '../../vendor/three.module.js';
import { MOUSE, CELL, COLORS } from '../config.js';
import { angleDelta, clamp } from '../util.js';
import { audio } from '../audio.js';

const STATE = { PATROL: 0, HUNT: 1, SEARCH: 2 };

let sharedGeo = null;

function getGeometry() {
  if (sharedGeo) return sharedGeo;
  sharedGeo = {
    body: new THREE.SphereGeometry(0.3, 10, 7),
    eye: new THREE.SphereGeometry(0.055, 6, 5),
    tail: new THREE.BoxGeometry(0.045, 0.045, 0.5),
    button: new THREE.BoxGeometry(0.1, 0.02, 0.16),
  };
  return sharedGeo;
}

// A mouse is small, but it is treated as tall enough that a tabletop blocks it.
// That is deliberate: if mice could scurry under desks, hiding would be
// pointless and the whole safety mechanic would collapse.
const MOUSE_BODY_TOP = 1.45;

export class EvilMouse {
  constructor(maze, cell, rng, index, obstacles = null) {
    this.maze = maze;
    this.obstacles = obstacles;
    this.rng = rng;
    this.index = index;

    const c = maze.cellCenter(cell[0], cell[1]);
    this.pos = new THREE.Vector3(c.x, 0.3, c.z);
    this.vel = new THREE.Vector3();
    this.heading = rng.range(0, Math.PI * 2);

    this.state = STATE.PATROL;
    this.patrolTarget = null;
    this.searchTimer = 0;
    this.attackCooldown = 0;
    this.dashTimer = rng.range(0, MOUSE.dashTime);
    this.resting = false;
    this.speedScale = 1;
    this.wasHunting = false;
    this._skitterTimer = rng.range(0, 1.2);
    this._repathTimer = 0;
    this._patrolFlow = null;

    this.mesh = this._buildMesh();
    this.glow = {
      pos: new THREE.Vector3().copy(this.pos),
      color: COLORS.mouse,
      intensity: 1.6,
      distance: 5.5,
      active: true,
    };
  }

  _buildMesh() {
    const g = getGeometry();
    const group = new THREE.Group();

    // Squashed pale body, like a school mouse that has seen things
    const body = new THREE.Mesh(
      g.body,
      new THREE.MeshLambertMaterial({ color: 0xd8dde6 }),
    );
    body.scale.set(1, 0.72, 1.35);
    group.add(body);
    this._bodyMat = body.material;

    const buttons = new THREE.Mesh(g.button, new THREE.MeshBasicMaterial({ color: 0x8a1220 }));
    buttons.position.set(0, 0.21, -0.16);
    group.add(buttons);
    this._buttonMat = buttons.material;

    const eyeMat = new THREE.MeshBasicMaterial({ color: COLORS.mouse });
    this._eyeMat = eyeMat;
    const eyeL = new THREE.Mesh(g.eye, eyeMat);
    eyeL.position.set(-0.11, 0.08, -0.34);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(g.eye, eyeMat);
    eyeR.position.set(0.11, 0.08, -0.34);
    group.add(eyeR);

    // The tail is the USB cable
    const tail = new THREE.Mesh(g.tail, new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
    tail.position.set(0, 0.02, 0.42);
    group.add(tail);
    this._tail = tail;
    this._tailMat = tail.material;

    group.position.copy(this.pos);
    return group;
  }

  get hunting() { return this.state === STATE.HUNT; }

  /** Distance-and-sight test plus hearing plus the flashlight lure. */
  _senses(player, sightScale) {
    if (!player.alive) return false;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // Hiding under a table beats sight, but not being loud right next to one
    const hearRange = player.noise * (player.hidden ? 0.35 : 1);
    if (dist < hearRange) return true;

    if (player.hidden) return false;

    // The beam gives you away well beyond normal sight
    if (player.isLightingUp(this.pos, MOUSE.lightLureRange)) return true;

    if (dist > MOUSE.sightRange * sightScale) return false;
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;
    if (dot < Math.cos(MOUSE.sightAngle)) return false;
    return this.maze.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
  }

  update(dt, player, flow, others, diff) {
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const detected = this._senses(player, diff.sightScale);

    if (detected) {
      if (this.state !== STATE.HUNT) {
        // The first moment of being noticed gets a sting
        if (!this.wasHunting) audio.spotted();
        this.state = STATE.HUNT;
      }
      this.searchTimer = MOUSE.loseInterest;
      this.lastKnown = { x: player.pos.x, z: player.pos.z };
    } else if (this.state === STATE.HUNT) {
      this.state = STATE.SEARCH;
    }

    if (this.state === STATE.SEARCH) {
      this.searchTimer -= dt;
      if (this.searchTimer <= 0) {
        this.state = STATE.PATROL;
        this.patrolTarget = null;
      }
    }
    this.wasHunting = this.state === STATE.HUNT;

    // -------------------------------------------------------- burst movement
    this.dashTimer -= dt;
    if (this.dashTimer <= 0) {
      this.resting = !this.resting;
      this.dashTimer = this.resting ? MOUSE.restTime : MOUSE.dashTime;
    }
    // Hunting mice barely pause
    const restFactor = this.resting ? (this.state === STATE.HUNT ? 0.45 : 0.1) : 1;

    // -------------------------------------------------------------- steering
    let aimX = null;
    let aimZ = null;

    if (this.state === STATE.HUNT && flow) {
      const [mx, mz] = this.maze.worldToCell(this.pos.x, this.pos.z);
      // Straight line when we can see the target, path otherwise
      if (this.maze.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z)) {
        aimX = player.pos.x;
        aimZ = player.pos.z;
      } else {
        const step = this.maze.flowStep(flow, mx, mz);
        if (step) {
          const c = this.maze.cellCenter(step[0], step[1]);
          aimX = c.x;
          aimZ = c.z;
        } else {
          aimX = player.pos.x;
          aimZ = player.pos.z;
        }
      }
    } else if (this.state === STATE.SEARCH && this.lastKnown) {
      aimX = this.lastKnown.x;
      aimZ = this.lastKnown.z;
      if (Math.hypot(aimX - this.pos.x, aimZ - this.pos.z) < 0.8) {
        this.state = STATE.PATROL;
        this.patrolTarget = null;
      }
    } else {
      // Patrol: wander between random open cells
      this._repathTimer -= dt;
      if (!this.patrolTarget || this._repathTimer <= 0) {
        this.patrolTarget = this.rng.pick(this.maze.openCells());
        this._repathTimer = 6;
        this._patrolFlow = null;
      }
      const tc = this.maze.cellCenter(this.patrolTarget[0], this.patrolTarget[1]);
      if (Math.hypot(tc.x - this.pos.x, tc.z - this.pos.z) < CELL * 0.4) {
        this.patrolTarget = null;
        this._patrolFlow = null;
        aimX = this.pos.x;
        aimZ = this.pos.z;
      } else {
        // Patrols path too, so they do not grind against walls. The field is
        // cached per target, since recomputing it every frame is pure waste.
        if (!this._patrolFlow) {
          this.maze.invalidateFlow();
          this._patrolFlow = this.maze.buildFlow(this.patrolTarget[0], this.patrolTarget[1]);
          this.maze.invalidateFlow();
        }
        const [mx, mz] = this.maze.worldToCell(this.pos.x, this.pos.z);
        const step = this.maze.flowStep(this._patrolFlow, mx, mz);
        if (step) {
          const c = this.maze.cellCenter(step[0], step[1]);
          aimX = c.x;
          aimZ = c.z;
        } else {
          this.patrolTarget = null;
          this._patrolFlow = null;
        }
      }
    }

    const baseSpeed = this.state === STATE.HUNT ? MOUSE.chaseSpeed : MOUSE.patrolSpeed;
    const speed = baseSpeed * diff.enemySpeedScale * this.speedScale * restFactor;

    if (aimX !== null) {
      let dx = aimX - this.pos.x;
      let dz = aimZ - this.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;

      // Keep a little distance from the other mice so they do not merge
      for (const o of others) {
        if (o === this) continue;
        const ox = this.pos.x - o.pos.x;
        const oz = this.pos.z - o.pos.z;
        const d = Math.hypot(ox, oz);
        if (d > 0.001 && d < MOUSE.radius * 3) {
          const push = (MOUSE.radius * 3 - d) / (MOUSE.radius * 3);
          dx += (ox / d) * push * 1.4;
          dz += (oz / d) * push * 1.4;
        }
      }
      const l2 = Math.hypot(dx, dz) || 1;
      this.vel.x = (dx / l2) * speed;
      this.vel.z = (dz / l2) * speed;
    } else {
      this.vel.x *= 0.85;
      this.vel.z *= 0.85;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.maze.collide(this.pos, MOUSE.radius);
    if (this.obstacles) {
      this.obstacles.collide(this.pos, MOUSE.radius, 0, MOUSE_BODY_TOP);
    }

    // ------------------------------------------------------------- facing
    if (Math.hypot(this.vel.x, this.vel.z) > 0.15) {
      const want = Math.atan2(-this.vel.x, -this.vel.z);
      this.heading += clamp(
        angleDelta(this.heading, want),
        -MOUSE.turnRate * dt,
        MOUSE.turnRate * dt,
      );
    }

    // ------------------------------------------------------------- visuals
    this.mesh.position.set(this.pos.x, 0.3, this.pos.z);
    this.mesh.rotation.y = this.heading;
    // Body squash while scurrying reads as tiny frantic legs
    const scurry = Math.sin(performance.now() * 0.02) * (this.resting ? 0.01 : 0.05);
    this.mesh.scale.set(1, 1 + scurry, 1 - scurry * 0.5);
    this._tail.rotation.x = Math.sin(performance.now() * 0.006) * 0.3;

    const hot = this.state === STATE.HUNT;
    this._eyeMat.color.setHex(hot ? 0xff2233 : 0xa8323f);
    this.glow.pos.copy(this.pos);
    this.glow.intensity = hot ? 2.6 : 1.3;

    // ------------------------------------------------------------- audio
    this._skitterTimer -= dt;
    if (this._skitterTimer <= 0 && !this.resting) {
      const d = this.pos.distanceTo(player.pos);
      if (d < 20) {
        const vol = clamp(1 - d / 20, 0, 1) ** 1.6;
        if (vol > 0.05) audio.skitter(vol);
      }
      this._skitterTimer = this.state === STATE.HUNT ? 0.4 : 1.1 + Math.random() * 1.4;
    }

    // ------------------------------------------------------------- attack
    const distToPlayer = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (
      distToPlayer < MOUSE.attackRange
      && this.attackCooldown <= 0
      && player.alive
      && !player.hidden
    ) {
      this.attackCooldown = MOUSE.attackCooldown;
      return { hit: MOUSE.damage };
    }
    return null;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this._bodyMat.dispose();
    this._eyeMat.dispose();
    this._tailMat.dispose();
    this._buttonMat.dispose();
    this.glow.active = false;
  }
}

export function disposeMouseGeometry() {
  if (!sharedGeo) return;
  for (const k in sharedGeo) sharedGeo[k].dispose();
  sharedGeo = null;
}
