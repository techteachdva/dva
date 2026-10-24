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
import { clamp, separateFrom } from '../util.js';
import { audio } from '../audio.js';
import { easeFactor } from '../meta/ease.js';

let dodecaGeo = null;
function getDodecaGeometry() {
  if (!dodecaGeo) dodecaGeo = new THREE.DodecahedronGeometry(0.22, 0);
  return dodecaGeo;
}

const SWARM_COUNT = 84;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

let moteMap = null;
function getMoteMap() {
  if (moteMap) return moteMap;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  moteMap = new THREE.CanvasTexture(c);
  moteMap.colorSpace = THREE.SRGBColorSpace;
  return moteMap;
}

/**
 * A virus is a particle globe, not a solid mesh. Each mote sits on a sphere
 * and is pushed around by a slow sine, the same idea as a TSL turbulence
 * field, done here on the CPU so a Chromebook never compiles a custom shader
 * the first time a virus appears.
 */
function makeSwarm() {
  const base = new Float32Array(SWARM_COUNT * 3);
  const positions = new Float32Array(SWARM_COUNT * 3);
  const colors = new Float32Array(SWARM_COUNT * 3);
  const phase = new Float32Array(SWARM_COUNT);
  const speed = new Float32Array(SWARM_COUNT);
  const color = new THREE.Color();

  for (let i = 0; i < SWARM_COUNT; i++) {
    const y = 1 - (i / (SWARM_COUNT - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = GOLDEN * i;
    const shell = i < 10 ? 0.18 : 0.55;
    base[i * 3] = Math.cos(angle) * ring * shell;
    base[i * 3 + 1] = y * shell;
    base[i * 3 + 2] = Math.sin(angle) * ring * shell;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.65 + (i % 7) * 0.06;
    if (i < 10) color.setHex(0xe7d4ff);
    else if (i % 5 === 0) color.setHex(0x6fd4ff);
    else color.setHex(0xb07cff);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return { geo, base, positions, phase, speed, posAttr };
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
    const group = new THREE.Group();
    const swarm = makeSwarm();
    this._swarm = swarm;
    this._swarmTime = this.rng.range(0, Math.PI * 2);
    this._pointMat = new THREE.PointsMaterial({
      size: 0.22,
      map: getMoteMap(),
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this._points = new THREE.Points(swarm.geo, this._pointMat);
    this._points.frustumCulled = false;
    this._points.renderOrder = 0;
    group.add(this._points);

    // Dodecahedron sits at the swarm origin. The old flat hex was parked
    // above the globe, so the marker and the particles did not share a center.
    const geo = getDodecaGeometry();
    this._coreMat = new THREE.MeshBasicMaterial({
      color: 0x1a1030,
      transparent: true,
      opacity: 0.82,
    });
    this._edgeMat = new THREE.MeshBasicMaterial({
      color: 0xf7f1ff,
      wireframe: true,
    });
    this._core = new THREE.Mesh(geo, this._coreMat);
    this._edges = new THREE.Mesh(geo, this._edgeMat);
    this._core.renderOrder = 2;
    this._edges.renderOrder = 3;
    group.add(this._core);
    group.add(this._edges);

    group.position.copy(this.pos);
    this._stepSwarm(0, 0, false, false);
    return group;
  }

  /**
   * Reform the globe. `spread` 1 is the held sphere; burning and the glitch
   * stutter push the motes outward the way the sample's globe uniform does.
   */
  _stepSwarm(spread, turb, hot) {
    const swarm = this._swarm;
    if (!swarm) return;
    const t = this._swarmTime;
    const { base, positions, phase, speed } = swarm;
    for (let i = 0; i < SWARM_COUNT; i++) {
      const ph = phase[i];
      const sp = speed[i];
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      const breathe = 1 + Math.sin(t * sp + ph) * 0.06;
      positions[i * 3] = bx * spread * breathe
        + Math.sin(t * (sp + 0.6) + ph) * turb;
      positions[i * 3 + 1] = by * spread * breathe
        + Math.cos(t * (sp + 0.37) + ph * 1.7) * turb * 0.8;
      positions[i * 3 + 2] = bz * spread * breathe
        + Math.sin(t * (sp + 0.22) + ph * 2.1) * turb;
    }
    swarm.posAttr.needsUpdate = true;
    if (hot) this._pointMat.color.setHex(0xffe8ff);
    else this._pointMat.color.setHex(0xffffff);
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
      this._swarmTime += dt * 8;
      this._stepSwarm(1.6 + Math.random() * 0.8, 0.35, true);
      this._pointMat.opacity = 0.4 + Math.random() * 0.6;
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
    if (player.introCalm) {
      detected = false;
    } else if (diff.hiddenEvade && player.hidden && !diff.virusIgnoresHide) {
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
    const speed = base * diff.enemySpeedScale * easeFactor(diff, this) * this.speedScale * wallScale;

    // Ease toward the desired velocity so the float stays dreamy
    const targetVX = dirX * speed + repelX;
    const targetVZ = dirZ * speed + repelZ;
    const k = 1 - Math.pow(0.02, dt);
    this.vel.x += (targetVX - this.vel.x) * k;
    this.vel.z += (targetVZ - this.vel.z) * k;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (detected && !player.introCalm) separateFrom(this.pos, player.pos, 1.05);

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

    this._swarmTime += dt * (this.burning ? 4.5 : detected ? 1.6 : 0.8);
    const spread = this.burning
      ? 1 + charge * 0.45
      : this.dazedTimer > 0 ? 0.72 : detected ? 1.04 : 0.96;
    const turb = this.burning ? 0.04 + charge * 0.1 : this.dazedTimer > 0 ? 0.1 : 0.035;
    this._stepSwarm(spread, turb, this.burning && charge > 0.45);
    this._pointMat.size = this.burning ? 0.26 : detected ? 0.2 : 0.16;
    this._pointMat.opacity = (this.burning ? 0.95 : detected ? 0.9 : 0.72) * (inWall ? 0.4 : 1);

    if (this._core) {
      this._core.rotation.y += dt * 0.55;
      this._core.rotation.x += dt * 0.22;
      this._edges.rotation.copy(this._core.rotation);
    }

    const pulse = 0.8 + Math.sin(this._bobPhase * 3) * 0.2;
    if (this.burning) {
      this.mesh.scale.setScalar(1 + charge * 0.12);
    } else if (this.dazedTimer > 0) {
      this.mesh.scale.setScalar(0.82);
      this._pointMat.opacity *= 0.55;
    } else {
      this.mesh.scale.setScalar(detected ? 1.06 : 1);
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
      && !player.introCalm
      && (!player.hidden || diff.virusIgnoresHide)
    ) {
      this.attackCooldown = VIRUS.attackCooldown * (diff.attackCooldownScale || 1);
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
    this._pointMat?.dispose();
    this._coreMat?.dispose();
    this._edgeMat?.dispose();
    this._swarm?.geo.dispose();
    this.glow.active = false;
  }
}

export function disposeVirusGeometry() {
  dodecaGeo?.dispose();
  dodecaGeo = null;
}
