/**
 * The player: first-person movement, stamina, health, hiding under tables, and
 * the flashlight battery.
 */

import * as THREE from '../../vendor/three.module.js';
import { PLAYER, FLASHLIGHT, TABLE } from '../config.js';
import { clamp, damp } from '../util.js';
import { audio } from '../audio.js';
import { input } from '../input.js';

const PITCH_LIMIT = Math.PI / 2 - 0.06;
// Crawling restricts how far you can crane your neck, which is claustrophobic
const PITCH_LIMIT_CROUCH = 0.78;
const TABLE_SURFACE_Y = TABLE.topY + TABLE.topThickness / 2;

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
    this.onTable = false;
    this._tableRef = null;
    this._vaulting = false;
    this._vaultT = 0;
    this._vaultFrom = new THREE.Vector3();
    this._vaultTo = new THREE.Vector3();
    this._falling = false;
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
    this._underTableTimer = 0;
    this.reduceFx = false;

    // Stats for the end-of-run report
    this.stats = {
      damageTaken: 0,
      cheetosEaten: 0,
      batteriesFound: 0,
      distance: 0,
      sodasDrunk: 0,
      flashlightSec: 0,
      itemsThrown: 0,
      micePopped: 0,
      virusesKilled: 0,
    };
  }

  get alive() { return this.health > 0; }
  get batteryPct() { return this.battery / PLAYER.batteryMax; }
  get staminaPct() { return this.stamina / PLAYER.staminaMax; }

  /** Standing on a desk top — exposed, but you can see farther. */
  get exposed() {
    return !this.hidden || this.onTable;
  }

  /** World position of the eyes, used for line-of-sight checks. */
  get eyePos() { return this.pos; }

  /** Height of the collision body: shorter while crouched, which is the point. */
  get bodyTop() {
    return this.crouching ? PLAYER.crouchHeight : PLAYER.standHeight;
  }

  /** Standing right now would clip into something overhead. */
  hasHeadroom(opts = null) {
    const y0 = this.onTable ? TABLE_SURFACE_Y : 0;
    return !this.obstacles.overlaps(
      this.pos.x, this.pos.z, PLAYER.radius, y0, y0 + PLAYER.standHeight, opts,
    );
  }

  /** Brief window after entering a desk footprint before auto-crawl begins. */
  get inTableCrawlGrace() {
    return this._underTableTimer > 0
      && this._underTableTimer < PLAYER.tableCrawlGrace
      && !this.wantCrouch
      && !this.crouching
      && !this.onTable;
  }

  /** Crouched in the crawl volume under a hide-under desk (not on top). */
  _crawlUnderTable() {
    if (this.onTable || !this.crouching) return false;
    return !!this.lab.tableAt(this.pos.x, this.pos.z, 0.14);
  }

  /** Crouching and close enough to slide under a desk instead of hitting legs. */
  _crawlApproachingTable() {
    if (this.onTable || (!this.crouching && !this.wantCrouch)) return false;
    return !!this.lab.tableNear(this.pos.x, this.pos.z, PLAYER.vaultReach);
  }

  /** Directly underneath a table, so crouching here hides you. */
  underTable() {
    if (this.onTable) return false;
    return !!this.lab.tableAt(this.pos.x, this.pos.z);
  }

  _floorEyeY() {
    return this.crouching ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;
  }

  _tableEyeY() {
    return TABLE_SURFACE_Y + (this.crouching ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight);
  }

  /**
   * Table collision modes:
   * 1) Standing walk → tabletop + legs block (solid desk).
   * 2) Crawl under → skip top + legs inside crawl footprint.
   * 3) On top → skip own tabletop slab.
   */
  _obstacleOpts(bodyY0, bodyTop) {
    const skip = [];
    if (this.onTable) skip.push('table-top');
    if (this._crawlUnderTable() || this._crawlApproachingTable()) {
      skip.push('table-top', 'table-leg');
    }
    if (skip.length) return { skipTags: skip };
    return null;
  }

  /** Desk edge within vault reach, or null. Prefers the table in front of the player. */
  _vaultTarget() {
    const x = this.pos.x;
    const z = this.pos.z;
    const fwd = this.forward();
    let best = null;
    let bestScore = -1e9;

    for (const t of this.lab.tables) {
      const half = TABLE.topW / 2;
      const dx = x - t.x;
      const dz = z - t.z;
      const insideX = Math.abs(dx) < half - 0.12;
      const insideZ = Math.abs(dz) < half - 0.12;
      if (insideX && insideZ) continue;

      const penX = Math.max(0, Math.abs(dx) - half);
      const penZ = Math.max(0, Math.abs(dz) - half);
      const edgeDist = Math.hypot(penX, penZ);
      if (edgeDist > PLAYER.vaultReach) continue;

      const toX = t.x - x;
      const toZ = t.z - z;
      const toLen = Math.hypot(toX, toZ) || 1;
      const facing = (fwd.x * toX + fwd.z * toZ) / toLen;
      const score = facing * 2 - edgeDist;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return bestScore > -1.2 ? best : null;
  }

  _startVault(table) {
    const half = TABLE.topW / 2 - PLAYER.radius - 0.1;
    const dx = this.pos.x - table.x;
    const dz = this.pos.z - table.z;

    let nx;
    let nz;
    if (Math.abs(dx) > Math.abs(dz)) {
      nx = Math.sign(dx || 1) * half * 0.82;
      nz = clamp(dz, -half * 0.72, half * 0.72);
    } else {
      nz = Math.sign(dz || 1) * half * 0.82;
      nx = clamp(dx, -half * 0.72, half * 0.72);
    }

    this._vaulting = true;
    this._vaultT = 0;
    this._tableRef = table;
    this.onTable = false;
    this._vaultFrom.set(this.pos.x, this._eyeY, this.pos.z);
    this._vaultTo.set(table.x + nx, this._tableEyeY(), table.z + nz);
    this.wantCrouch = false;
    this.crouching = false;
    audio.vault();
  }

  _updateVault(dt) {
    this._vaultT += dt;
    const u = clamp(this._vaultT / PLAYER.vaultDuration, 0, 1);
    const ease = u * u * (3 - 2 * u);
    const arc = Math.sin(u * Math.PI) * 0.42;

    this.pos.x = this._vaultFrom.x + (this._vaultTo.x - this._vaultFrom.x) * ease;
    this.pos.z = this._vaultFrom.z + (this._vaultTo.z - this._vaultFrom.z) * ease;
    this._eyeY = this._vaultFrom.y + (this._vaultTo.y - this._vaultFrom.y) * ease + arc;
    this.maze.collide(this.pos, PLAYER.radius);
    const vaultY0 = Math.min(this._vaultFrom.y, this._eyeY) - 0.15;
    const vaultY1 = Math.max(this._vaultFrom.y, this._eyeY) + 0.35;
    this.obstacles.collide(
      this.pos, PLAYER.radius, vaultY0, vaultY1,
      { skipTags: ['table-top', 'table-leg'] },
    );

    if (u >= 1) {
      this._vaulting = false;
      this.onTable = true;
      this._eyeY = this._tableEyeY();
      this.pos.x = this._vaultTo.x;
      this.pos.z = this._vaultTo.z;
    }
  }

  _updateTableStand(dt) {
    if (!this.onTable || !this._tableRef || this._vaulting) return;

    const t = this._tableRef;
    const half = TABLE.topW / 2 - PLAYER.radius - 0.06;
    const dx = this.pos.x - t.x;
    const dz = this.pos.z - t.z;

    if (Math.abs(dx) > half || Math.abs(dz) > half) {
      this.onTable = false;
      this._tableRef = null;
      this._falling = true;
      return;
    }

    const targetEye = this._tableEyeY();
    this._eyeY = damp(this._eyeY, targetEye, 0.0006, dt);
  }

  _updateFall(dt) {
    if (!this._falling) return;

    const target = this._floorEyeY();
    this._eyeY = damp(this._eyeY, target, 0.0012, dt);
    if (Math.abs(this._eyeY - target) < 0.04) {
      this._eyeY = target;
      this._falling = false;
    }
  }

  /** Standing bodies cannot occupy the crawl footprint under a tabletop. */
  _ejectFromTableInterior() {
    if (this.crouching || this.inTableCrawlGrace || this.wantCrouch) return;
    const t = this.lab.tableAt(this.pos.x, this.pos.z, -0.04);
    if (!t) return;
    const half = TABLE.topW / 2 - PLAYER.radius - 0.08;
    const dx = this.pos.x - t.x;
    const dz = this.pos.z - t.z;
    if (Math.abs(dx) >= half || Math.abs(dz) >= half) return;
    if (Math.abs(dx) > Math.abs(dz)) {
      this.pos.x = t.x + Math.sign(dx || 1) * half;
    } else {
      this.pos.z = t.z + Math.sign(dz || 1) * half;
    }
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
    if (this.debugGod || this.invuln > 0 || !this.alive) return false;
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    this.invuln = PLAYER.hurtInvuln;
    this.stats.damageTaken += amount;
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

    if (this._vaulting) {
      this._updateVault(dt);
      this.pos.y = this._eyeY;
      this.hidden = false;
      return;
    }

    this._updateFall(dt);
    this._updateTableStand(dt);

    const axes = controlsActive ? input.moveAxes() : { x: 0, y: 0 };
    const wantsMove = axes.x !== 0 || axes.y !== 0;

    // ------------------------------------------------------------- vaulting
    if (controlsActive && input.pressed('jump') && !this.onTable && !this._falling) {
      const canVault = !this.crouching || !this.underTable();
      if (canVault) {
        const target = this._vaultTarget();
        if (target) {
          if (this.crouching) {
            this.wantCrouch = false;
            this.crouching = false;
          }
          this._startVault(target);
        }
      }
    }

    // ------------------------------------------------------------- crouching
    const inTableZone = this.underTable();
    if (inTableZone && !this.wantCrouch && !this.crouching && !this.onTable) {
      this._underTableTimer += dt;
    } else {
      this._underTableTimer = 0;
    }

    const crawlGraceOpts = this.inTableCrawlGrace
      ? { skipTags: ['table-top', 'table-leg'] }
      : null;

    // Crouch is a toggle, not a hold, so it never fights the sprint key and
    // never asks a Chromebook user to keep a finger on Ctrl while steering.
    if (controlsActive && input.pressed('crouch') && !this.onTable) {
      this.wantCrouch = !this.wantCrouch;
      audio.crouch(this.wantCrouch);
    }
    // Standing up under a desk would shove you through the tabletop, so the
    // stand is simply refused until there is headroom. Grace period lets you
    // walk up to a desk without instantly ducking to grab loot on a chair.
    const blockedFromStanding = !this.hasHeadroom(crawlGraceOpts);
    const forceCrawl = blockedFromStanding
      && (this.wantCrouch || !this.inTableCrawlGrace);
    this.stuckUnder = !this.wantCrouch && forceCrawl;
    this.crouching = this.wantCrouch || forceCrawl;

    // Hiding is not a button: crouch under a desk, not on top of one
    this.hidden = !this.onTable && this.crouching && this.underTable();

    // ------------------------------------------------------------- stamina
    if (this.sodaBoost > 0) this.sodaBoost -= dt;

    // Sprint is a TOGGLE, not a hold. Holding Shift while steering with WASD and
    // looking with a trackpad is three simultaneous motor tasks, and on a
    // Chromebook that is the single most common reason a student simply stops
    // running. Tapping it once is the same decision with none of the strain.
    if (controlsActive && input.pressed('sprint')) {
      const was = this.wantSprint;
      this.wantSprint = !this.wantSprint;
      if (!was && this.wantSprint) audio.sprintBurst();
    }
    // Letting go of the stick, crouching, or running dry all cancel the intent,
    // so the toggle can never leave the player sprinting into a wall
    if (!wantsMove || this.crouching) this.wantSprint = false;
    if (this.exhausted > 0) this.exhausted -= dt;

    this.sprinting = (this.wantSprint || input.held.mouseSprint) && wantsMove && !this.crouching
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
    else if (this.onTable) speed *= 0.88;
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
    const bodyY0 = this.onTable ? TABLE_SURFACE_Y : 0;
    const bodyTop = bodyY0 + (this.crouching ? PLAYER.crouchHeight : PLAYER.standHeight);
    let collideOpts = this._obstacleOpts(bodyY0, bodyTop);
    if (this._vaulting) {
      collideOpts = { skipTags: ['table-top', 'table-leg'] };
    }
    this.obstacles.collide(this.pos, PLAYER.radius, bodyY0, bodyTop, collideOpts);
    if (!this.onTable && !this.crouching && !this._vaulting) {
      this._ejectFromTableInterior();
    }

    const moved = Math.hypot(this.pos.x - beforeX, this.pos.z - beforeZ);
    this.stats.distance += moved;
    const movingFast = moved / Math.max(dt, 1e-5);

    // ------------------------------------------------------- camera height
    if (!this.onTable && !this._falling) {
      const targetEye = this._floorEyeY();
      this._eyeY = damp(this._eyeY, targetEye, 0.0006, dt);
    }

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
    if (this.onTable) this.noise *= 1.45;
    if (this.flashlightOn) this.noise *= 1.12;

    // ------------------------------------------------------------- battery
    if (this.flashlightOn) {
      this.stats.flashlightSec += dt;
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
