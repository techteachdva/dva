/**
 * The player: first-person movement, stamina, health, hiding under tables, and
 * the flashlight battery.
 */

import * as THREE from '../../vendor/three.module.js';
import { PLAYER, FLASHLIGHT } from '../config.js';
import { clamp, damp } from '../util.js';
import { audio } from '../audio.js';
import { input } from '../input.js';

const PITCH_LIMIT = Math.PI / 2 - 0.06;
// Crawling restricts how far you can crane your neck, which is claustrophobic
const PITCH_LIMIT_CROUCH = 0.78;

export class Player {
  constructor(maze, lab, startCell, difficulty) {
    this.maze = maze;
    this.lab = lab;
    this.obstacles = lab.obstacles;
    this.diff = difficulty;

    const c = maze.cellCenter(startCell[0], startCell[1]);
    this.pos = new THREE.Vector3(c.x, PLAYER.eyeHeight, c.z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.maxHealth = difficulty.startHealth;
    this.health = difficulty.startHealth;
    this.stamina = PLAYER.staminaMax;
    this.battery = PLAYER.batteryMax;
    this.flashlightOn = true;

    this.hidden = false;
    this.crouching = false;
    this.wantCrouch = false;
    // True when the player asked to stand but something is directly overhead
    this.stuckUnder = false;
    this.sprinting = false;
    this.wantSprint = false;   // sprint is a toggle; this is the latched intent
    this.sodaBoost = 0;        // seconds of caffeinated legs remaining
    this.exhausted = 0;
    this.regenDelay = 0;
    this.invuln = 0;
    this.noise = 0;
    this.hasKey = false;
    this.burningVirus = false;

    this._eyeY = PLAYER.eyeHeight;
    this._bob = 0;
    this._bobAmount = 0;
    this._stepAccum = 0;
    this._lowBatteryBeep = 0;
    this._crawlAccum = 0;
    this._breathTimer = 0;
    this.reduceFx = false;

    // Stats for the end-of-run report
    this.stats = { damageTaken: 0, cheetosEaten: 0, batteriesFound: 0, distance: 0 };
  }

  get alive() { return this.health > 0; }
  get batteryPct() { return this.battery / PLAYER.batteryMax; }
  get staminaPct() { return this.stamina / PLAYER.staminaMax; }

  /** World position of the eyes, used for line-of-sight checks. */
  get eyePos() { return this.pos; }

  /** Height of the collision body: shorter while crouched, which is the point. */
  get bodyTop() {
    return this.crouching ? PLAYER.crouchHeight : PLAYER.standHeight;
  }

  /** Standing right now would clip into something overhead. */
  get hasHeadroom() {
    return !this.obstacles.overlaps(
      this.pos.x, this.pos.z, PLAYER.radius, PLAYER.crouchHeight, PLAYER.standHeight,
    );
  }

  /** Directly underneath a table, so crouching here hides you. */
  underTable() {
    return !!this.lab.tableAt(this.pos.x, this.pos.z);
  }

  /** A table close enough to be worth crawling toward. */
  tableNearby() {
    return this.lab.tableNear(this.pos.x, this.pos.z, 2.6);
  }

  toggleFlashlight() {
    if (this.battery <= 0 && !this.flashlightOn) {
      audio.deny();
      return false;
    }
    this.flashlightOn = !this.flashlightOn;
    audio.lightToggle(this.flashlightOn);
    return true;
  }

  addBattery(amount) {
    const before = this.battery;
    this.battery = clamp(this.battery + amount, 0, PLAYER.batteryMax);
    this.stats.batteriesFound++;
    return this.battery - before;
  }

  heal(amount) {
    if (this.health >= this.maxHealth) return false;
    this.health = clamp(this.health + amount, 0, this.maxHealth);
    this.stats.cheetosEaten++;
    return true;
  }

  /**
   * Drinking a soda. Stamina refills instantly and, for a while afterwards,
   * sprinting is faster and burns slower - the difference between "I can run" and
   * "I can outrun that", which is the fantasy the can is selling.
   */
  drinkSoda() {
    this.stamina = PLAYER.staminaMax;
    this.exhausted = 0;
    this.regenDelay = 0;
    this.sodaBoost = PLAYER.sodaBoostTime;
    this.stats.sodasDrunk = (this.stats.sodasDrunk || 0) + 1;
    return true;
  }

  get boosted() { return this.sodaBoost > 0; }

  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return false;
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    this.invuln = PLAYER.hurtInvuln;
    this.stats.damageTaken += amount;
    audio.hurt();
    return true;
  }

  /** Look input is applied separately so menus can freeze it. */
  applyLook() {
    const look = input.takeLook();
    this.yaw -= look.x;
    const limit = this.crouching ? PITCH_LIMIT_CROUCH : PITCH_LIMIT;
    this.pitch = clamp(this.pitch - look.y, -limit, limit);
  }

  /**
   * @param {number} dt real seconds (already scaled by the caller if needed)
   * @param {boolean} controlsActive false while a menu or quiz is up
   */
  update(dt, controlsActive) {
    if (this.invuln > 0) this.invuln -= dt;

    const axes = controlsActive ? input.moveAxes() : { x: 0, y: 0 };
    const wantsMove = axes.x !== 0 || axes.y !== 0;

    // ------------------------------------------------------------- crouching
    // Crouch is a toggle, not a hold, so it never fights the sprint key and
    // never asks a Chromebook user to keep a finger on Ctrl while steering.
    if (controlsActive && input.pressed('crouch')) {
      this.wantCrouch = !this.wantCrouch;
      audio.crouch(this.wantCrouch);
    }
    // Standing up under a desk would shove you through the tabletop, so the
    // stand is simply refused until there is headroom.
    const blockedFromStanding = !this.hasHeadroom;
    this.stuckUnder = !this.wantCrouch && blockedFromStanding;
    this.crouching = this.wantCrouch || blockedFromStanding;

    // Hiding is not a button: it is the consequence of crouching under a desk
    this.hidden = this.crouching && this.underTable();

    // ------------------------------------------------------------- stamina
    if (this.sodaBoost > 0) this.sodaBoost -= dt;

    // Sprint is a TOGGLE, not a hold. Holding Shift while steering with WASD and
    // looking with a trackpad is three simultaneous motor tasks, and on a
    // Chromebook that is the single most common reason a student simply stops
    // running. Tapping it once is the same decision with none of the strain.
    if (controlsActive && input.pressed('sprint')) this.wantSprint = !this.wantSprint;
    // Letting go of the stick, crouching, or running dry all cancel the intent,
    // so the toggle can never leave the player sprinting into a wall
    if (!wantsMove || this.crouching) this.wantSprint = false;
    if (this.exhausted > 0) this.exhausted -= dt;

    this.sprinting = this.wantSprint && wantsMove && !this.crouching
      && this.stamina > 0 && this.exhausted <= 0;

    if (this.sprinting) {
      this.stamina -= PLAYER.staminaDrain * (this.boosted ? PLAYER.sodaDrainScale : 1) * dt;
      this.regenDelay = PLAYER.staminaRegenDelay;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = PLAYER.staminaExhaustLock;
        this.sprinting = false;
        this.wantSprint = false;
      }
    } else {
      if (this.regenDelay > 0) this.regenDelay -= dt;
      else if (this.stamina < PLAYER.staminaMax) {
        // Recover faster when standing still, which rewards stopping to breathe
        const rate = PLAYER.staminaRegen * (wantsMove ? 0.62 : 1.35);
        this.stamina = clamp(this.stamina + rate * dt, 0, PLAYER.staminaMax);
      }
    }

    // ------------------------------------------------------------ movement
    let speed = PLAYER.walkSpeed;
    if (this.crouching) speed = PLAYER.crouchSpeed * (this.hidden ? 0.72 : 1);
    else if (this.sprinting) {
      speed = PLAYER.sprintSpeed * (this.boosted ? PLAYER.sodaSprintScale : 1);
    }
    // Wounded players move a little slower, which raises the stakes
    if (this.health === 1) speed *= 0.88;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    // Forward is -Z, so axes.y of -1 must move along the camera's facing vector
    const desiredX = (axes.x * cosY + axes.y * sinY) * speed;
    const desiredZ = (axes.y * cosY - axes.x * sinY) * speed;

    const accel = wantsMove ? PLAYER.accel : PLAYER.friction;
    this.vel.x = damp(this.vel.x, desiredX, Math.exp(-accel), dt);
    this.vel.z = damp(this.vel.z, desiredZ, Math.exp(-accel), dt);
    if (Math.abs(this.vel.x) < 0.004) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 0.004) this.vel.z = 0;

    const beforeX = this.pos.x;
    const beforeZ = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    // Walls first, then furniture. The body span is what lets a crouched player
    // slide under a tabletop that a standing player cannot pass.
    this.maze.collide(this.pos, PLAYER.radius);
    this.obstacles.collide(this.pos, PLAYER.radius, 0, this.bodyTop);

    const moved = Math.hypot(this.pos.x - beforeX, this.pos.z - beforeZ);
    this.stats.distance += moved;
    const movingFast = moved / Math.max(dt, 1e-5);

    // ------------------------------------------------------- camera height
    const targetEye = this.crouching ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;
    this._eyeY = damp(this._eyeY, targetEye, 0.0006, dt);

    // Head bob sells the running; it is the first thing to go in reduced-effects
    if (!this.reduceFx && movingFast > 0.4) {
      const rate = this.sprinting ? 13.5 : this.crouching ? 6 : 9;
      this._bob += dt * rate;
      this._bobAmount = damp(this._bobAmount, this.sprinting ? 0.075 : 0.042, 0.001, dt);
    } else {
      this._bobAmount = damp(this._bobAmount, 0, 0.001, dt);
    }
    this.pos.y = this._eyeY + Math.sin(this._bob) * this._bobAmount;

    // ----------------------------------------------------------- footsteps
    if (movingFast > 0.5) {
      const stride = this.sprinting ? 0.42 : this.crouching ? 0.8 : 0.62;
      this._stepAccum += moved;
      if (this._stepAccum >= stride) {
        this._stepAccum = 0;
        if (this.crouching) audio.crawl();
        else audio.step(this.sprinting, false);
      }
    } else {
      this._stepAccum = stride0(this._stepAccum);
    }

    // Tense breathing while tucked under a desk waiting for something to pass
    if (this.crouching) {
      this._breathTimer -= dt;
      if (this._breathTimer <= 0) {
        this._breathTimer = 3.1 + Math.random() * 1.4;
        audio.breath(this.hidden ? 1 : 0.6);
      }
    } else {
      this._breathTimer = 1.2;
    }

    // --------------------------------------------------------------- noise
    // How far away an enemy can hear the player this frame
    if (movingFast < 0.4) this.noise = this.hidden ? 0 : 1.5;
    else if (this.hidden) this.noise = PLAYER.noiseCrouch * 0.5;
    else if (this.crouching) this.noise = PLAYER.noiseCrouch;
    else if (this.sprinting) this.noise = PLAYER.noiseSprint;
    else this.noise = PLAYER.noiseWalk;
    if (this.flashlightOn) this.noise *= 1.12;

    // ------------------------------------------------------------- battery
    if (this.flashlightOn) {
      let drain = PLAYER.batteryDrain;
      // Burning a virus is the expensive use of the light, which is what forces
      // the choice between seeing and defending yourself
      if (this.burningVirus) drain += PLAYER.batteryBurnDrain;
      this.battery -= drain * this.diff.batteryDrainScale * dt;
      if (this.battery <= 0) {
        this.battery = 0;
        this.flashlightOn = false;
        audio.lightToggle(false);
      }
      // Warning beeps as the battery runs out
      if (this.batteryPct < 0.2) {
        this._lowBatteryBeep -= dt;
        if (this._lowBatteryBeep <= 0) {
          this._lowBatteryBeep = 1.4;
          audio.lowBattery();
        }
      }
    }
  }

  /** Applies yaw/pitch and position to the render camera. */
  syncCamera(camera) {
    camera.position.copy(this.pos);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Direction the player is facing, flattened, for cone checks. */
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /**
   * True when the flashlight beam is on a world position.
   * Mice are lured by this; viruses are burned and pushed back by it.
   *
   * The cone is checked generously on purpose - middle schoolers should not
   * need pixel-perfect aim to defend themselves. `coneScale` widens the test
   * beyond the visible cone, and `bodyRadius` adds angular slack for large
   * targets so clipping the edge of a virus still counts as a hit.
   */
  isLightingUp(point, range, coneScale = 1.35, bodyRadius = 0) {
    if (!this.flashlightOn || this.battery <= 0) return false;
    const dx = point.x - this.pos.x;
    const dz = point.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range) return false;

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;

    let halfAngle = FLASHLIGHT.angle * coneScale;
    if (bodyRadius > 0 && dist > 0.001) {
      halfAngle += Math.atan2(bodyRadius, dist);
    }
    if (dot < Math.cos(Math.min(halfAngle, Math.PI * 0.48))) return false;

    return this.maze.lineOfSight(this.pos.x, this.pos.z, point.x, point.z);
  }
}

// Keeps the step accumulator from drifting when the player stops mid-stride
function stride0(v) {
  return v > 0 ? Math.max(0, v - 0.02) : 0;
}
