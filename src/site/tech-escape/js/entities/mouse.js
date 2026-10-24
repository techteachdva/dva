/**
 * Evil computer mice.
 *
 * Ground hunters that patrol the corridors, follow a flow field when hunting,
 * and scurry in short bursts instead of gliding. They see, they hear, and -
 * unlike the viruses - they are drawn toward the flashlight beam, so the light
 * that keeps you safe from one enemy makes you a target for the other.
 */

import * as THREE from '../../vendor/three.module.js';
import { MOUSE, CELL, COLORS, THROWN, PLAYER } from '../config.js';
import { angleDelta, clamp, separateFrom } from '../util.js';
import { audio } from '../audio.js';
import { easeFactor } from '../meta/ease.js';
import { makeEntityGlyph } from './models.js?v=3.25';

// FEED and FLEE both exist because of the cheetos bag: one is the distraction
// the player paid for, the other is what the survivors do afterwards.
const STATE = { PATROL: 0, HUNT: 1, SEARCH: 2, FEED: 3, FLEE: 4 };

let sharedGeo = null;

function getGeometry() {
  if (sharedGeo) return sharedGeo;
  sharedGeo = {
    body: new THREE.SphereGeometry(0.26, 12, 8),
    plate: new THREE.SphereGeometry(0.2, 10, 6),
    sensor: new THREE.SphereGeometry(0.055, 8, 6),
    pupil: new THREE.SphereGeometry(0.02, 6, 4),
    leg: new THREE.BoxGeometry(0.028, 0.2, 0.028),
    claw: new THREE.ConeGeometry(0.018, 0.055, 4),
    cable: new THREE.CylinderGeometry(0.015, 0.015, 0.18, 5),
    slit: new THREE.BoxGeometry(0.13, 0.014, 0.028),
    tooth: new THREE.ConeGeometry(0.014, 0.05, 4),
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

    // Cheetos-bag state
    this.dead = false;          // popped; the manager reaps it next frame
    this.feeding = false;       // nose down in a bag, not hunting anyone
    this.lure = null;
    this.fleeTimer = 0;
    this.fleeFrom = null;
    this._munchTimer = 0;

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
    this._mats = [];
    const mat = (m) => { this._mats.push(m); return m; };

    // A low black shell, not a toy. The red seam is a cracked button housing.
    const bodyMat = mat(new THREE.MeshLambertMaterial({ color: 0x6a2832 }));
    const body = new THREE.Mesh(g.body, bodyMat);
    body.scale.set(1.15, 0.95, 1.65);
    body.position.y = 0.12;
    group.add(body);
    this._bodyMat = bodyMat;

    const plate = new THREE.Mesh(g.plate, mat(new THREE.MeshLambertMaterial({ color: 0x2c1219 })));
    plate.scale.set(0.92, 0.38, 1.22);
    plate.position.set(0, 0.12, -0.02);
    group.add(plate);

    const slit = new THREE.Mesh(g.slit, mat(new THREE.MeshBasicMaterial({ color: 0x8a1424 })));
    slit.position.set(0, 0.17, -0.08);
    group.add(slit);

    const toothMat = mat(new THREE.MeshLambertMaterial({ color: 0xe4ddd4 }));
    for (const x of [-0.045, 0.045]) {
      const tooth = new THREE.Mesh(g.tooth, toothMat);
      tooth.position.set(x, 0.08, -0.5);
      tooth.rotation.x = Math.PI * 0.62;
      tooth.scale.setScalar(1.7);
      group.add(tooth);
    }

    // One optical sensor, not a pair of cartoon eyes.
    const sensorMat = mat(new THREE.MeshBasicMaterial({ color: 0xff1a33 }));
    const sensor = new THREE.Mesh(g.sensor, sensorMat);
    sensor.position.set(0, 0.1, -0.5);
    sensor.scale.setScalar(2.1);
    group.add(sensor);
    this._sensorMat = sensorMat;
    const pupil = new THREE.Mesh(g.pupil, mat(new THREE.MeshBasicMaterial({ color: 0x140004 })));
    pupil.position.set(0, 0.1, -0.58);
    group.add(pupil);

    const legMat = mat(new THREE.MeshLambertMaterial({ color: 0x4a1820 }));
    const clawMat = mat(new THREE.MeshLambertMaterial({ color: 0x6e1822 }));
    this._legs = [];
    for (const side of [-1, 1]) {
      [-0.18, 0.0, 0.18].forEach((z, i) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.32, 0.02, z);
        pivot.userData.phase = i + (side < 0 ? 0 : 0.6);
        const leg = new THREE.Mesh(g.leg, legMat);
        leg.position.y = -0.09;
        leg.rotation.z = side * 0.42;
        pivot.add(leg);
        const claw = new THREE.Mesh(g.claw, clawMat);
        claw.position.set(side * 0.05, -0.19, 0.01);
        claw.rotation.x = Math.PI * 0.85;
        claw.rotation.z = side * -0.5;
        pivot.add(claw);
        group.add(pivot);
        this._legs.push(pivot);
      });
    }

    const cableMat = mat(new THREE.MeshBasicMaterial({ color: 0xc45a68 }));
    this._cables = [];
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(g.cable, cableMat);
      seg.position.set((i % 2 === 0 ? -1 : 1) * 0.02, 0.03, 0.46 + i * 0.15);
      seg.rotation.x = 1.15;
      group.add(seg);
      this._cables.push(seg);
    }

    this._glyph = makeEntityGlyph('triangle', 0.62);
    this._glyph.position.y = 0.7;
    group.add(this._glyph);

    group.position.copy(this.pos);
    return group;
  }

  get hunting() { return this.state === STATE.HUNT; }

  /** Ate a whole bag. Popped for good - this is the only way a mouse dies. */
  pop() {
    if (this.dead) return false;
    this.dead = true;
    this.feeding = false;
    this.lure = null;
    return true;
  }

  /** Saw the bag go off from a safe distance and wants no part of it. */
  scare(fromX, fromZ, seconds) {
    if (this.dead) return;
    this.state = STATE.FLEE;
    this.fleeFrom = { x: fromX, z: fromZ };
    this.fleeTimer = seconds;
    this.feeding = false;
    this.lure = null;
  }

  /**
   * Nearest armed cheetos bag worth abandoning the hunt for. Line of sight is
   * preferred, but a bag around the corner still counts inside a short radius -
   * they are following their nose, not their eyes.
   */
  _findLure(lures) {
    let best = null;
    let bestD = THROWN.bagLureRange;
    for (const l of lures) {
      const d = Math.hypot(l.pos.x - this.pos.x, l.pos.z - this.pos.z);
      if (d >= bestD) continue;
      const smellable = d < CELL * 1.5
        || this.maze.lineOfSight(this.pos.x, this.pos.z, l.pos.x, l.pos.z);
      if (!smellable) continue;
      bestD = d;
      best = l;
    }
    return best;
  }

  /** Patrol point away from the player when hiding ends a chase. */
  _awayPoint(player, dist = 5.5) {
    const dx = this.pos.x - player.pos.x;
    const dz = this.pos.z - player.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      x: this.pos.x + (dx / len) * dist,
      z: this.pos.z + (dz / len) * dist,
    };
  }

  /** Distance-and-sight test plus hearing plus the flashlight lure. */
  _senses(player, diff, alertActive = false) {
    if (!player.alive || player.introCalm) return false;
    if (alertActive && !player.hidden) return true;
    if (diff.hiddenEvade && player.hidden) return false;

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    const hearRange = player.noise * (player.hidden ? 0.35 : 1);
    if (dist < hearRange) return true;

    // The beam gives you away well beyond normal sight
    if (player.isLightingUp(this.pos, MOUSE.lightLureRange)) return true;

    if (dist > MOUSE.sightRange * diff.sightScale) return false;
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;
    if (dot < Math.cos(MOUSE.sightAngle)) return false;
    return this.maze.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
  }

  update(dt, player, flow, others, diff, lures = null, alertActive = false) {
    if (this.dead) return null;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // ------------------------------------------------- snacks beat everything
    // A landed bag outranks the hunt, and running away outranks the bag. Both
    // are checked before the senses so a distracted mouse genuinely stops
    // caring where the player is.
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) {
        this.state = STATE.PATROL;
        this.patrolTarget = null;
        this.fleeFrom = null;
      }
    }
    this.lure = this.state === STATE.FLEE || !lures || !lures.length
      ? null
      : this._findLure(lures);
    if (this.lure) this.state = STATE.FEED;
    else if (this.state === STATE.FEED) {
      // The bag emptied or was picked up elsewhere
      this.state = STATE.PATROL;
      this.patrolTarget = null;
    }
    this.feeding = false;

    const distracted = this.state === STATE.FEED || this.state === STATE.FLEE;

    if (diff.hiddenEvade && player.hidden && !distracted) {
      if (this.state === STATE.HUNT || this.state === STATE.SEARCH) {
        this.state = STATE.PATROL;
        this.patrolTarget = this._awayPoint(player, 5.5);
        this.searchTimer = 0;
        this.wasHunting = false;
      }
    }

    if (this.calm > 0) {
      this.calm -= dt;
      if (this.state === STATE.HUNT || this.state === STATE.SEARCH) {
        this.state = STATE.PATROL;
        this.wasHunting = false;
      }
    }

    const detected = this.calm > 0 ? false : (!distracted && this._senses(player, diff, alertActive));

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

    if (this.state === STATE.FEED && this.lure) {
      const d = Math.hypot(this.lure.pos.x - this.pos.x, this.lure.pos.z - this.pos.z);
      if (d <= THROWN.bagFeedRange) {
        // Arrived. Stop dead and eat, which is the whole point of the throw.
        this.feeding = true;
        aimX = null;
        aimZ = null;
        this._munchTimer -= dt;
        if (this._munchTimer <= 0) {
          this._munchTimer = 0.22 + Math.random() * 0.2;
          audio.munch(clamp(1 - this.pos.distanceTo(player.pos) / 18, 0, 1));
        }
      } else {
        aimX = this.lure.pos.x;
        aimZ = this.lure.pos.z;
      }
    } else if (this.state === STATE.FLEE && this.fleeFrom) {
      // Straight away from the blast, which is exactly as smart as a mouse is
      aimX = this.pos.x + (this.pos.x - this.fleeFrom.x);
      aimZ = this.pos.z + (this.pos.z - this.fleeFrom.z);
    } else if (this.state === STATE.HUNT && flow) {
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

    // Fleeing is the fastest a mouse ever moves; hurrying to a bag is close
    let baseSpeed = MOUSE.patrolSpeed;
    if (this.state === STATE.HUNT) baseSpeed = MOUSE.chaseSpeed;
    else if (this.state === STATE.FLEE) baseSpeed = MOUSE.chaseSpeed * 1.1;
    else if (this.state === STATE.FEED) baseSpeed = MOUSE.chaseSpeed * 0.92;
    const speed = baseSpeed * diff.enemySpeedScale * easeFactor(diff, this) * this.speedScale * restFactor;

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
    if (this.state === STATE.HUNT && player.alive && !player.hidden && !player.introCalm) {
      if (separateFrom(this.pos, player.pos, PLAYER.radius + MOUSE.radius + 0.14)) {
        this.maze.collide(this.pos, MOUSE.radius);
      }
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
    this.mesh.position.set(this.pos.x, 0.28, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const hot = this.state === STATE.HUNT;
    const t = performance.now() * 0.001;
    const rate = this.feeding ? 18 : hot ? 14 : this.resting ? 2.2 : 7;
    if (this._legs) {
      for (const pivot of this._legs) {
        pivot.rotation.x = Math.sin(t * rate + pivot.userData.phase) * (hot ? 0.75 : 0.34);
      }
    }
    if (this._cables) {
      this._cables.forEach((seg, i) => {
        seg.rotation.z = Math.sin(t * 3.4 + i) * 0.45;
        seg.rotation.x = 1.15 + Math.sin(t * 2.1 + i * 0.8) * 0.22;
      });
    }
    if (this._sensorMat) this._sensorMat.color.setHex(hot ? 0xfff2f4 : 0xff1a33);
    if (this._bodyMat) this._bodyMat.color.setHex(hot ? 0x9a3040 : 0x6a2832);
    this.glow.pos.copy(this.pos);
    this.glow.intensity = hot ? 2.6 : 1.3;

    // Keep the identity glyph facing the player and dim it while the mouse is
    // busy eating, so a distracted enemy looks distracted
    if (this._glyph) {
      this._glyph.rotation.y = -this.heading + Math.atan2(
        player.pos.x - this.pos.x, player.pos.z - this.pos.z,
      ) + Math.PI;
      this._glyph.material.opacity = distracted ? 0.45 : 1;
    }

    // ------------------------------------------------------------- audio
    this._skitterTimer -= dt;
    if (this._skitterTimer <= 0 && !this.resting) {
      const d = this.pos.distanceTo(player.pos);
      if (d < 20) {
        const vol = clamp(1 - d / 20, 0, 1) ** 1.6;
        if (vol > 0.05) {
          const pan = clamp(
            ((player.pos.x - this.pos.x) * Math.cos(player.yaw)
              + (player.pos.z - this.pos.z) * (-Math.sin(player.yaw)))
            / Math.max(d, 0.1),
            -1, 1,
          );
          audio.mouseScroll(vol, pan);
        }
      }
      this._skitterTimer = this.state === STATE.HUNT ? 0.35 : 0.9 + Math.random() * 0.5;
    }

    // ------------------------------------------------------------- attack
    const distToPlayer = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
    if (
      distToPlayer < MOUSE.attackRange
      && this.attackCooldown <= 0
      && player.alive
      && !player.hidden
      // A mouse eating cheetos, or running from an explosion, is not biting you
      && !distracted
    ) {
      this.attackCooldown = MOUSE.attackCooldown * (diff.attackCooldownScale || 1);
      return {
        hit: MOUSE.damage,
        from: { x: this.pos.x, z: this.pos.z, y: 0.25 },
      };
    }
    return null;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    for (const m of this._mats || []) m.dispose();
    this.glow.active = false;
  }
}

export function disposeMouseGeometry() {
  if (!sharedGeo) return;
  for (const k in sharedGeo) sharedGeo[k].dispose();
  sharedGeo = null;
}
