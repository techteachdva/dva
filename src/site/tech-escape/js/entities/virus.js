/**
 * Floating ghostly computer viruses.
 *
 * They ignore walls entirely, so you cannot out-corner them - but the
 * flashlight is a real weapon against them. Hold the beam on a virus and it
 * "burns": it recoils, flickers, and its whine climbs in pitch. Hold it long
 * enough and the virus GLITCHES - stutters violently, then teleports far across
 * the lab, dazed, before re-acquiring you and coming back.
 *
 * The flashlight is a reprieve, never a kill, and it costs battery. That is the
 * trade the player has to keep making: light to see, light to defend, but not
 * both for long. When the battery dies, crawling under a desk is still the way
 * out.
 *
 * There is exactly one permanent answer: a thrown anti-virus disc. It is the
 * rarest item in the building, and finding one turns a virus from a fact of life
 * into a problem the player gets to solve.
 */

import * as THREE from '../../vendor/three.module.js';
import { VIRUS, COLORS, CELL } from '../config.js';
import { clamp } from '../util.js';
import { audio } from '../audio.js';
import { makeEntityGlyph } from './models.js';

let sharedGeo = null;

function getGeometry() {
  if (sharedGeo) return sharedGeo;
  sharedGeo = {
    shell: new THREE.IcosahedronGeometry(0.55, 0),
    core: new THREE.OctahedronGeometry(0.24, 0),
    spike: new THREE.ConeGeometry(0.07, 0.26, 4),
  };
  return sharedGeo;
}

export class GhostVirus {
  constructor(maze, cell, rng, index) {
    this.maze = maze;
    this.rng = rng;
    this.index = index;

    const c = maze.cellCenter(cell[0], cell[1]);
    this.pos = new THREE.Vector3(c.x, VIRUS.hoverHeight, c.z);
    this.vel = new THREE.Vector3();
    this.wanderTarget = null;
    this.attackCooldown = 0;
    this.speedScale = 1;
    this.hunting = false;
    this.wasHunting = false;
    this._bobPhase = rng.range(0, Math.PI * 2);
    this._whineTimer = rng.range(0, 3);
    this._repelTimer = 0;

    // Burn / glitch state
    this.burn = 0;              // seconds of accumulated beam contact
    this.burning = false;       // beam is on it right now
    this.graceTimer = 0;        // beam may slip off briefly without resetting
    this.glitchCooldown = 0;    // cannot be glitched again until this expires
    this.stutterTimer = 0;      // violent jitter before it vanishes
    this.dazedTimer = 0;        // wandering, not yet hunting again
    this._burnAudioTimer = 0;
    this._computeTimer = 0.2;

    // Deleted by an anti-virus disc. Unlike a glitch, this one is permanent.
    this.dead = false;

    this.mesh = this._buildMesh();
    this.glow = {
      pos: new THREE.Vector3().copy(this.pos),
      color: COLORS.virus,
      intensity: 3.4,
      distance: 7.5,
      active: true,
    };
  }

  _buildMesh() {
    const g = getGeometry();
    const group = new THREE.Group();

    // Translucent shell so it reads as a ghost, not a solid enemy
    this._shellMat = new THREE.MeshBasicMaterial({
      color: COLORS.virus,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
    });
    const shell = new THREE.Mesh(g.shell, this._shellMat);
    group.add(shell);
    this._shell = shell;

    this._coreMat = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });
    const core = new THREE.Mesh(g.core, this._coreMat);
    group.add(core);
    this._core = core;

    // Spikes make the silhouette read as "virus" at a glance
    this._spikeMat = new THREE.MeshBasicMaterial({
      color: COLORS.virus,
      transparent: true,
      opacity: 0.55,
    });
    const dirs = [
      [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    ];
    for (const [x, y, z] of dirs) {
      const s = new THREE.Mesh(g.spike, this._spikeMat);
      s.position.set(x * 0.6, y * 0.6, z * 0.6);
      s.lookAt(x * 2, y * 2, z * 2);
      s.rotateX(Math.PI / 2);
      group.add(s);
    }

    // Hexagon marker: the virus half of the shape language. A player who cannot
    // tell purple from red still always knows which enemy they are looking at.
    this._glyph = makeEntityGlyph('hex', 0.7);
    this._glyph.position.y = 0.95;
    group.add(this._glyph);

    group.position.copy(this.pos);
    return group;
  }

  /** Struck by an anti-virus disc. Gone for the rest of the run. */
  destroy() {
    if (this.dead) return false;
    this.dead = true;
    this.hunting = false;
    this.glow.active = false;
    this.mesh.visible = false;
    return true;
  }

  /**
   * Teleports the virus to a distant cell that the player cannot see, then
   * leaves it dazed for a moment before it starts hunting again.
   */
  glitchAway(player) {
    const [pcx, pcy] = this.maze.worldToCell(player.pos.x, player.pos.z);
    const flow = this.maze.buildFlow(pcx, pcy);

    // Far by path distance is cheap to test, so filter on that first...
    const far = this.maze.openCells().filter(
      ([cx, cy]) => this.maze.flowDistance(flow, cx, cy) >= VIRUS.glitchTeleportMinCells,
    );
    this.maze.invalidateFlow();

    // ...then line-of-sight test only a handful of shuffled candidates. Testing
    // every cell would be a visible hitch on a Chromebook for no extra quality.
    let dest = null;
    const shuffled = this.rng.shuffle(far);
    for (let i = 0; i < Math.min(12, shuffled.length); i++) {
      const c = this.maze.cellCenter(shuffled[i][0], shuffled[i][1]);
      if (this.maze.lineOfSight(player.pos.x, player.pos.z, c.x, c.z)) continue;
      dest = c;
      break;
    }
    if (!dest && shuffled.length) {
      dest = this.maze.cellCenter(shuffled[0][0], shuffled[0][1]);
    }

    if (!dest) {
      // Tiny or wide-open layouts might have nowhere hidden; just go far
      const cell = this.maze.cellAwayFrom(pcx, pcy, VIRUS.glitchTeleportMinCells);
      dest = this.maze.cellCenter(cell[0], cell[1]);
    }

    this.pos.x = dest.x;
    this.pos.z = dest.z;
    this.vel.set(0, 0, 0);
    this.burn = 0;
    this.burning = false;
    this.graceTimer = 0;
    this.glitchCooldown = VIRUS.glitchCooldown;
    this.dazedTimer = VIRUS.glitchReacquire;
    this.hunting = false;
    this.wasHunting = false;
    this.wanderTarget = null;
    this.mesh.position.copy(this.pos);
  }

  update(dt, player, diff, alertActive = false) {
    if (this.dead) return null;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this._repelTimer > 0) this._repelTimer -= dt;
    if (this.glitchCooldown > 0) this.glitchCooldown -= dt;
    if (this.dazedTimer > 0) this.dazedTimer -= dt;

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // ------------------------------------------------------- beam contact
    // Forgiving cone test: widened angle plus angular slack for the virus body,
    // so brushing it with the edge of the beam counts.
    const lit = player.isLightingUp(this.pos, VIRUS.repelRange, 1.5, VIRUS.radius * 1.6);

    if (lit) {
      this.burn += dt;
      this.graceTimer = VIRUS.burnGrace;
      this.burning = true;
    } else if (this.graceTimer > 0) {
      // Brief loss of contact does not reset progress, so a shaky hand is fine
      this.graceTimer -= dt;
      this.burning = false;
    } else {
      this.burn = Math.max(0, this.burn - dt * 1.8);
      this.burning = false;
    }

    // ------------------------------------------------------- stutter/glitch
    if (this.stutterTimer > 0) {
      this.stutterTimer -= dt;
      // Violent jitter in place, then it is gone
      const j = 0.55;
      this.mesh.position.set(
        this.pos.x + (Math.random() - 0.5) * j,
        this.pos.y + (Math.random() - 0.5) * j * 0.8,
        this.pos.z + (Math.random() - 0.5) * j,
      );
      this.mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      this._shellMat.opacity = Math.random() * 0.9;
      this._coreMat.color.setHex(Math.random() < 0.5 ? 0xff4d5e : 0x35e0ff);
      this.glow.pos.copy(this.pos);
      this.glow.intensity = 4 + Math.random() * 9;
      if (this.stutterTimer <= 0) {
        this.glitchAway(player);
        this.mesh.scale.setScalar(1);
      }
      return null;
    }

    // Enough sustained contact and it panics
    if (this.burn >= VIRUS.burnCharge && this.glitchCooldown <= 0) {
      this.stutterTimer = VIRUS.glitchStutter;
      audio.virusGlitch();
      return { glitched: true };
    }

    // ---------------------------------------------------------- detection
    // Viruses sense through walls. On normal difficulties hiding ends the chase;
    // on nightmare they hunt through tabletops.
    let detected = false;
    if (diff.hiddenEvade && player.hidden && !diff.virusIgnoresHide) {
      this.hunting = false;
      this.wasHunting = false;
      if (!this.wanderTarget
        || Math.hypot(this.wanderTarget.x - this.pos.x, this.wanderTarget.z - this.pos.z) < 1.4) {
        const adx = this.pos.x - player.pos.x;
        const adz = this.pos.z - player.pos.z;
        const alen = Math.hypot(adx, adz) || 1;
        this.wanderTarget = {
          x: this.pos.x + (adx / alen) * 8,
          z: this.pos.z + (adz / alen) * 8,
        };
      }
    } else {
      let hiddenScale = 1;
      if (player.hidden) hiddenScale = diff.virusIgnoresHide ? 1 : 0;
      else if (player.onTable) hiddenScale = 1.2;
      const range = VIRUS.sightRange * diff.sightScale * hiddenScale;
      detected = player.alive && dist < range && this.dazedTimer <= 0;
      if (alertActive && player.alive && !player.hidden) detected = true;
    }

    if (detected && !this.wasHunting) audio.spotted();
    this.hunting = detected;
    this.wasHunting = detected;

    // ---------------------------------------------------------------- repel
    let repelX = 0;
    let repelZ = 0;
    if (lit) {
      const d = dist || 1;
      // Pushed straight away from the player, harder when close - but the push
      // fades as the burn charges, so the light effectively pins it in place
      // for the kill shot instead of shoving it out of the beam.
      const charged = clamp(this.burn / VIRUS.burnCharge, 0, 1);
      const strength = VIRUS.repelStrength
        * (1 - clamp(dist / VIRUS.repelRange, 0, 1) * 0.45)
        * (1 - charged * 0.7);
      repelX = (-dx / d) * strength;
      repelZ = (-dz / d) * strength;

      // Whine climbs in pitch as the burn charges, teaching the mechanic
      this._burnAudioTimer -= dt;
      if (this._burnAudioTimer <= 0) {
        this._burnAudioTimer = 0.15;
        audio.virusBurn(clamp(this.burn / VIRUS.burnCharge, 0, 1));
      }
    }

    // -------------------------------------------------------------- steering
    let aimX;
    let aimZ;
    if (detected) {
      aimX = player.pos.x;
      aimZ = player.pos.z;
    } else {
      if (!this.wanderTarget
        || Math.hypot(this.wanderTarget.x - this.pos.x, this.wanderTarget.z - this.pos.z) < 1.4) {
        const cell = this.rng.pick(this.maze.openCells());
        this.wanderTarget = this.maze.cellCenter(cell[0], cell[1]);
      }
      aimX = this.wanderTarget.x;
      aimZ = this.wanderTarget.z;
    }

    let dirX = aimX - this.pos.x;
    let dirZ = aimZ - this.pos.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;

    const base = detected ? VIRUS.chaseSpeed : VIRUS.floatSpeed;
    // Drifting through solid walls is much slower, so walls still matter
    const inWall = this.maze.isWorldSolid(this.pos.x, this.pos.z);
    const wallScale = inWall ? VIRUS.inWallSpeedScale : 1;
    const speed = base * diff.enemySpeedScale * this.speedScale * wallScale;

    // Ease toward the desired velocity so the float stays dreamy
    const targetVX = dirX * speed + repelX;
    const targetVZ = dirZ * speed + repelZ;
    const k = 1 - Math.pow(0.02, dt);
    this.vel.x += (targetVX - this.vel.x) * k;
    this.vel.z += (targetVZ - this.vel.z) * k;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // Stay inside the building even though interior walls mean nothing
    const limit = (this.maze.size / 2 - 0.6) * CELL;
    this.pos.x = clamp(this.pos.x, -limit, limit);
    this.pos.z = clamp(this.pos.z, -limit, limit);

    // ---------------------------------------------------------------- visuals
    this._bobPhase += dt * (this.burning ? 6.5 : 1.8);
    const bob = Math.sin(this._bobPhase) * VIRUS.bobAmount;
    this.pos.y = VIRUS.hoverHeight + bob;

    const charge = clamp(this.burn / VIRUS.burnCharge, 0, 1);
    if (this.burning) {
      // Recoiling in the beam: shivers harder the closer it is to glitching
      const j = 0.05 + charge * 0.16;
      this.mesh.position.set(
        this.pos.x + (Math.random() - 0.5) * j,
        this.pos.y + (Math.random() - 0.5) * j,
        this.pos.z + (Math.random() - 0.5) * j,
      );
    } else {
      this.mesh.position.copy(this.pos);
    }

    this.mesh.rotation.y += dt * (this.burning ? 7 : detected ? 2.2 : 0.9);
    this.mesh.rotation.x += dt * (this.burning ? 3 : 0.6);
    this._core.rotation.y -= dt * 3.4;
    this._core.rotation.z += dt * 1.7;

    // The marker is parented to a tumbling body, so undo that rotation and keep
    // it upright and square to the player
    if (this._glyph) {
      this._glyph.quaternion.copy(this.mesh.quaternion).invert();
      this._glyph.rotateY(Math.atan2(
        player.pos.x - this.pos.x, player.pos.z - this.pos.z,
      ));
      this._glyph.position.set(0, 0.95, 0).applyQuaternion(
        this.mesh.quaternion.clone().invert(),
      );
    }

    // Angrier and brighter when hunting; dimmed while inside a wall
    const pulse = 0.8 + Math.sin(this._bobPhase * 3) * 0.2;
    if (this.burning) {
      // Fast flicker plus a shift toward hot white as the charge builds
      const flick = 0.35 + Math.random() * 0.55;
      this._shellMat.opacity = flick;
      this._spikeMat.opacity = flick * 0.9;
      this._coreMat.color.setHex(charge > 0.66 ? 0xffffff : 0xffd0ff);
      this.mesh.scale.setScalar(1 - charge * 0.18);
    } else if (this.dazedTimer > 0) {
      // Dazed: dim and unstable, clearly still alive and re-forming
      const wob = 0.14 + Math.random() * 0.1;
      this._shellMat.opacity = wob;
      this._spikeMat.opacity = wob;
      this._coreMat.color.setHex(0x8f7bd6);
      this.mesh.scale.setScalar(0.85);
    } else {
      this._shellMat.opacity = (detected ? 0.42 : 0.26) * (inWall ? 0.45 : 1);
      this._spikeMat.opacity = (detected ? 0.7 : 0.5) * (inWall ? 0.4 : 1);
      this._coreMat.color.setHex(detected ? 0xffd0ff : 0xd9b3ff);
      this.mesh.scale.setScalar(detected ? 1.1 : 1);
    }

    this.glow.pos.copy(this.pos);
    if (this.burning) {
      this.glow.color = charge > 0.66 ? 0xffffff : 0xffb0ff;
      this.glow.intensity = 5 + charge * 6 + Math.random() * 2;
    } else {
      this.glow.color = COLORS.virus;
      this.glow.intensity = (detected ? 5.2 : 3.0) * pulse
        * (inWall ? 0.4 : 1) * (this.dazedTimer > 0 ? 0.45 : 1);
    }

    // ---------------------------------------------------------------- audio
    this._computeTimer -= dt;
    if (this._computeTimer <= 0 && !this.burning) {
      if (dist < 24) {
        const vol = clamp(1 - dist / 24, 0, 1) ** 1.5;
        if (vol > 0.04) {
          const pan = clamp(
            ((player.pos.x - this.pos.x) * Math.cos(player.yaw)
              + (player.pos.z - this.pos.z) * (-Math.sin(player.yaw)))
            / Math.max(dist, 0.1),
            -1, 1,
          );
          audio.virusCompute(vol * (detected ? 1.35 : 1), pan);
        }
      }
      this._computeTimer = detected ? 0.28 : 0.55 + Math.random() * 0.35;
    }

    this._whineTimer -= dt;
    if (this._whineTimer <= 0 && !this.burning && detected) {
      const vol = clamp(1 - dist / 24, 0, 1) ** 1.5;
      if (vol > 0.05) audio.virusWhine(vol * 1.2);
      this._whineTimer = 1.3;
    }

    // ---------------------------------------------------------------- attack
    if (
      dist < VIRUS.attackRange
      && this.attackCooldown <= 0
      && player.alive
      && (!player.hidden || diff.virusIgnoresHide)
    ) {
      this.attackCooldown = VIRUS.attackCooldown;
      return {
        hit: VIRUS.damage,
        batteryDrain: VIRUS.batteryDrainOnHit,
        from: { x: this.pos.x, z: this.pos.z, y: this.pos.y },
      };
    }
    return this.burning ? { burning: true, charge } : null;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this._shellMat.dispose();
    this._coreMat.dispose();
    this._spikeMat.dispose();
    this.glow.active = false;
  }
}

export function disposeVirusGeometry() {
  if (!sharedGeo) return;
  for (const k in sharedGeo) sharedGeo[k].dispose();
  sharedGeo = null;
}
