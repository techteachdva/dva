/**
 * Things the player throws, and what happens where they land.
 *
 * A bag of hot cheetos is not a grenade. Thrown, it arcs, lands, and starts
 * LURING: every mouse in range abandons whatever it was doing, crowds the bag,
 * and eats. Each mouse that munches long enough pops in cheese dust. One bag
 * can pop up to three mice; it never blows up on its own.
 *
 * The anti-virus disc is the opposite: instant, precise, and the only permanent
 * answer to a virus in the whole game. Missing does not waste it - a disc that
 * hits a wall clatters to the floor and can be picked back up, because losing the
 * rarest item on the level to a bad throw would just teach players never to use
 * it.
 *
 * Nothing here is gory. Mice do not come apart; they puff into orange dust and
 * leave a USB plug spinning on the floor.
 */

import * as THREE from '../../vendor/three.module.js';
import { THROWN, INVENTORY, COLORS, VIRUS } from '../config.js';
import { audio } from '../audio.js';
import { getModelGeometry, makeCheetosBag, makeAntivirusDisc } from './models.js';

const PROJECTILE_RADIUS = 0.16;
const FLOOR_Y = 0.2;
const PUFF_LIFE = 0.95;
const MAX_PUFFS = 4;
const DUST_PER_PUFF = 9;

export class ThrowField {
  constructor(scene, maze, rng) {
    this.scene = scene;
    this.maze = maze;
    this.rng = rng;
    this.items = [];       // live projectiles and armed bags
    this.puffs = [];
    this._mats = [];
    this._t = 0;
  }

  /**
   * @param {'cheetos'|'antivirus'} kind
   * @param {THREE.Vector3} from eye position
   * @param {{x:number,z:number}} dir flattened facing vector
   * @returns {object|null} null when the throw was refused
   */
  throwItem(kind, from, dir) {
    if (this.items.length >= THROWN.maxLive) return null;

    const mesh = kind === 'antivirus' ? makeAntivirusDisc() : makeCheetosBag();
    // Spawned slightly ahead of the eye so it never clips the camera near plane
    const pos = new THREE.Vector3(
      from.x + dir.x * 0.55,
      from.y - 0.18,
      from.z + dir.z * 0.55,
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const item = {
      kind,
      mesh,
      pos,
      vel: new THREE.Vector3(),
      spin: this.rng.range(6, 10) * (this.rng.chance(0.5) ? 1 : -1),
      state: 'flying',
      killsRemaining: THROWN.bagMaxKills,
      munching: new Map(),
      life: THROWN.discLife,
      glow: {
        pos: new THREE.Vector3().copy(pos),
        color: kind === 'antivirus' ? COLORS.antivirus : COLORS.cheeto,
        intensity: kind === 'antivirus' ? 3.4 : 2.6,
        distance: 6,
        active: true,
      },
    };

    if (kind === 'antivirus') {
      // Flat and fast: a disc is aimed, not lobbed
      item.vel.set(dir.x * THROWN.discSpeed, 0, dir.z * THROWN.discSpeed);
      mesh.rotation.x = Math.PI / 2;
      audio.discThrow();
    } else {
      item.vel.set(
        dir.x * INVENTORY.throwSpeed,
        INVENTORY.throwLift,
        dir.z * INVENTORY.throwSpeed,
      );
      audio.bagThrow();
    }

    this.items.push(item);
    return item;
  }

  /** Landed bags currently pulling mice in. Read by the mouse AI each frame. */
  get lures() {
    const out = [];
    for (const it of this.items) {
      if (it.kind === 'cheetos' && it.state === 'armed') out.push(it);
    }
    return out;
  }

  get glowSources() {
    const out = [];
    for (const it of this.items) out.push(it.glow);
    for (const p of this.puffs) out.push(p.glow);
    return out;
  }

  /**
   * @param {number} dt
   * @param {object} player
   * @param {import('./enemies.js').EnemyManager} enemies
   * @returns {{popped:number, virusKilled:number, exploded:boolean, shake:number,
   *   dropped:Array<{kind:string,cell:[number,number],pos:THREE.Vector3}>}}
   */
  update(dt, player, enemies) {
    this._t += dt;
    const out = { popped: 0, virusKilled: 0, exploded: false, shake: 0, dropped: [] };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];

      if (it.kind === 'antivirus') this._updateDisc(it, dt, enemies, out);
      else this._updateBag(it, dt, player, enemies, out);

      if (it.state === 'done') {
        this.scene.remove(it.mesh);
        it.glow.active = false;
        this.items.splice(i, 1);
      }
    }

    this._updatePuffs(dt);
    return out;
  }

  // ------------------------------------------------------------------ cheetos

  _updateBag(it, dt, player, enemies, out) {
    if (it.state === 'flying') {
      it.vel.y -= INVENTORY.gravity * dt;
      this._step(it, dt);
      it.mesh.rotation.x += it.spin * dt;
      it.mesh.rotation.z += it.spin * 0.6 * dt;

      if (it.pos.y <= FLOOR_Y) {
        it.pos.y = FLOOR_Y;
        it.vel.set(0, 0, 0);
        it.state = 'armed';
        it.mesh.rotation.set(Math.PI / 2.6, this.rng.range(0, Math.PI * 2), 0);
        audio.bagLand();
      }
      it.mesh.position.copy(it.pos);
      it.glow.pos.copy(it.pos);
      return;
    }

    // Armed: lure mice until three have been popped from eating it
    let feeders = 0;
    for (const m of enemies.mice) {
      if (m.dead || !m.feeding || m.lure !== it) continue;
      feeders++;
      let progress = it.munching.get(m) ?? 0;
      progress += dt;
      it.munching.set(m, progress);
      if (progress >= THROWN.bagEatSeconds) {
        this._popMouseFromBag(it, m, enemies, out);
      }
    }
    for (const m of it.munching.keys()) {
      if (m.dead || !m.feeding || m.lure !== it) it.munching.delete(m);
    }

    for (const bug of enemies.bugs) {
      if (bug.dead || !bug.feeding || bug.lure !== it) continue;
      bug._munchTimer = (bug._munchTimer || 0) + dt;
      if (bug._munchTimer >= THROWN.bagEatSeconds * 1.2) {
        bug.pop();
        it.killsRemaining = 0;
        it.state = 'done';
        this._spawnPuff(bug.pos, 1);
        audio.bagPop(1);
      }
    }

    const shake = 0.015 + feeders * 0.012;
    it.mesh.position.set(
      it.pos.x + (Math.random() - 0.5) * shake,
      it.pos.y + Math.abs(Math.sin(this._t * 9)) * shake * 0.7,
      it.pos.z + (Math.random() - 0.5) * shake,
    );
    it.glow.intensity = 2.6 + feeders * 0.35;
    it.glow.pos.copy(it.pos);

    if (it.killsRemaining <= 0) {
      it.state = 'done';
    }
  }

  _popMouseFromBag(it, mouse, enemies, out) {
    if (mouse.dead || it.killsRemaining <= 0) return;
    mouse.pop();
    it.munching.delete(mouse);
    it.killsRemaining -= 1;
    out.popped++;

    this._spawnPuff(mouse.pos, 1);
    audio.bagPop(1);

    const px = mouse.pos.x;
    const pz = mouse.pos.z;
    for (const other of enemies.mice) {
      if (other.dead || other === mouse) continue;
      const d = Math.hypot(other.pos.x - px, other.pos.z - pz);
      if (d <= THROWN.bagScareRadius) {
        other.scare(px, pz, THROWN.bagScareTime);
      }
    }

    if (it.killsRemaining <= 0) {
      this._spawnPuff(it.pos, 0);
    }
  }

  // ----------------------------------------------------------------- disc

  _updateDisc(it, dt, enemies, out) {
    if (it.state !== 'flying') {
      // Landed disc: lie still until the game turns it back into a pickup
      it.state = 'done';
      return;
    }

    const fromX = it.pos.x;
    const fromZ = it.pos.z;
    it.life -= dt;
    const hitWall = this._step(it, dt);
    it.mesh.rotation.y += 22 * dt;
    it.mesh.position.copy(it.pos);
    it.glow.pos.copy(it.pos);

    // Swept test against the segment travelled this frame, so a fast disc cannot
    // tunnel straight through a virus between two frames
    for (const v of enemies.viruses) {
      if (v.dead) continue;
      const d = segmentDistance(fromX, fromZ, it.pos.x, it.pos.z, v.pos.x, v.pos.z);
      if (d > THROWN.discHitRadius + VIRUS.radius) continue;
      v.destroy();
      out.virusKilled++;
      this._spawnPuff(v.pos, 0, COLORS.antivirus);
      audio.virusDeleted();
      it.state = 'done';
      return;
    }

    if (hitWall || it.life <= 0 || it.pos.y <= FLOOR_Y) {
      if (THROWN.discRecoverable) {
        // Drop it where it stopped so a bad throw costs a walk, not the item
        const cell = this.maze.worldToCell(it.pos.x, it.pos.z);
        out.dropped.push({ kind: 'antivirus', cell, pos: it.pos.clone() });
        audio.discClatter();
      }
      it.state = 'done';
    }
  }

  /**
   * Advances one projectile and keeps it out of the walls.
   * @returns {boolean} true when it struck something solid this frame
   */
  _step(it, dt) {
    it.pos.x += it.vel.x * dt;
    it.pos.y += it.vel.y * dt;
    it.pos.z += it.vel.z * dt;

    const before = { x: it.pos.x, z: it.pos.z };
    const hit = this.maze.collide(it.pos, PROJECTILE_RADIUS);
    if (hit) {
      // Kill the horizontal push so a bag drops at the wall instead of grinding
      // along it, and mark the frame so the disc knows to give up
      it.vel.x = 0;
      it.vel.z = 0;
      it.pos.x = before.x;
      it.pos.z = before.z;
      this.maze.collide(it.pos, PROJECTILE_RADIUS);
    }
    if (it.pos.y < FLOOR_Y) it.pos.y = FLOOR_Y;
    return hit;
  }

  // ------------------------------------------------------------------- puffs

  /**
   * Cheese-dust cloud: an expanding translucent shell plus a handful of tumbling
   * crumbs. Pooled and capped, because four of these can go off at once during a
   * swarm and this has to stay free on integrated graphics.
   */
  _spawnPuff(at, popped, color = COLORS.cheeto) {
    if (this.puffs.length >= MAX_PUFFS) {
      const oldest = this.puffs.shift();
      this._killPuff(oldest);
    }
    const g = getModelGeometry();
    const group = new THREE.Group();
    group.position.copy(at);

    const shellMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });
    const shell = new THREE.Mesh(g.shockwave, shellMat);
    shell.scale.setScalar(0.3);
    group.add(shell);

    const dustMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const crumbs = [];
    for (let i = 0; i < DUST_PER_PUFF; i++) {
      const crumb = new THREE.Mesh(g.dust, dustMat);
      const a = (i / DUST_PER_PUFF) * Math.PI * 2 + Math.random();
      crumbs.push({
        mesh: crumb,
        vx: Math.cos(a) * (2 + Math.random() * 3),
        vy: 2.4 + Math.random() * 3.4,
        vz: Math.sin(a) * (2 + Math.random() * 3),
        spin: (Math.random() - 0.5) * 14,
      });
      group.add(crumb);
    }

    this.scene.add(group);
    this._mats.push(shellMat, dustMat);
    this.puffs.push({
      group, shell, shellMat, dustMat, crumbs,
      life: PUFF_LIFE,
      popped,
      glow: {
        pos: new THREE.Vector3().copy(at),
        color,
        intensity: 9,
        distance: 9,
        active: true,
      },
    });
  }

  _updatePuffs(dt) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      if (p.life <= 0) {
        this._killPuff(p);
        this.puffs.splice(i, 1);
        continue;
      }
      const t = 1 - p.life / PUFF_LIFE;
      p.shell.scale.setScalar(0.3 + t * 3.4);
      p.shellMat.opacity = 0.5 * (1 - t) ** 1.4;
      p.dustMat.opacity = 0.95 * (1 - t) ** 1.2;
      p.glow.intensity = 9 * (1 - t) ** 2;

      for (const c of p.crumbs) {
        c.vy -= 12 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z += c.vz * dt;
        c.mesh.rotation.x += c.spin * dt;
        c.mesh.rotation.y += c.spin * 0.7 * dt;
        // Crumbs settle on the floor rather than sinking through it
        if (c.mesh.position.y < 0.06) {
          c.mesh.position.y = 0.06;
          c.vy = 0;
          c.vx *= 0.86;
          c.vz *= 0.86;
        }
      }
    }
  }

  _killPuff(p) {
    this.scene.remove(p.group);
    p.glow.active = false;
  }

  dispose() {
    for (const it of this.items) {
      this.scene.remove(it.mesh);
      it.glow.active = false;
    }
    this.items.length = 0;
    for (const p of this.puffs) this._killPuff(p);
    this.puffs.length = 0;
    for (const m of this._mats) m.dispose();
    this._mats.length = 0;
  }
}

/** Shortest distance from point (px,pz) to the segment (ax,az)-(bx,bz). */
function segmentDistance(ax, az, bx, bz, px, pz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
