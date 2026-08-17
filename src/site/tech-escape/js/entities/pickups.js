/**
 * Floor loot: hot cheetos, AA batteries, soda, and the rare anti-virus disc.
 *
 * Pickups are grabbed with Use / left-click at arm's length — not by walking over
 * them. Batteries still apply instantly; snacks go into inventory.
 */

import * as THREE from '../../vendor/three.module.js';
import { PICKUP, PLAYER, COLORS, TABLE } from '../config.js';
import { audio } from '../audio.js';
import { makeModel, REST_Y } from './models.js';

/** Per-kind glow so loot reads at range without lighting the whole room. */
const GLOW = {
  cheetos: { color: 'cheeto', intensity: 1.5, distance: 4.2 },
  battery: { color: 'battery', intensity: 1.7, distance: 4.2 },
  soda: { color: 'soda', intensity: 1.6, distance: 4.4 },
  antivirus: { color: 'antivirus', intensity: 2.6, distance: 6.5 },
};

const LABELS = {
  cheetos: 'Pick up hot cheetos',
  battery: 'Pick up battery',
  soda: 'Pick up soda',
  antivirus: 'Pick up anti-virus disc',
};

const TABLE_SURFACE_Y = TABLE.topY + TABLE.topThickness / 2;

/** Rest height when a pickup sits on a hide-under desk tabletop. */
const ON_TABLE_Y = {
  cheetos: TABLE_SURFACE_Y + 0.065,
  battery: TABLE_SURFACE_Y + 0.035,
  soda: TABLE_SURFACE_Y + 0.09,
  antivirus: TABLE_SURFACE_Y + 0.018,
};

export class PickupField {
  constructor(scene, maze, rng) {
    this.scene = scene;
    this.maze = maze;
    this.rng = rng;
    this.items = [];
    this._t = 0;
  }

  /**
   * @param {'cheetos'|'battery'|'soda'|'antivirus'} kind
   * @param {[number,number]} cell
   * @param {{x:number,z:number}} [at] exact spot, for a disc dropped mid-run
   */
  spawn(kind, cell, at = null) {
    let x;
    let z;
    if (at) {
      x = at.x;
      z = at.z;
    } else {
      const c = this.maze.cellCenter(cell[0], cell[1]);
      x = c.x + this.rng.range(-1.1, 1.1);
      z = c.z + this.rng.range(-1.1, 1.1);
    }

    const mesh = makeModel(kind);
    let baseY = REST_Y[kind] ?? 0.3;
    if (at?.onChair) {
      baseY = TABLE.chairSeatY + (REST_Y[kind] ?? 0.28) * 0.55;
    } else if (at?.underTable) {
      baseY = REST_Y[kind] ?? 0.3;
    } else if (at?.onTable) {
      baseY = ON_TABLE_Y[kind] ?? TABLE_SURFACE_Y + 0.05;
    } else if (at?.y != null) {
      baseY = at.y;
    }
    mesh.position.set(x, baseY, z);
    mesh.rotation.y = this.rng.range(0, Math.PI * 2);
    if (kind === 'battery') mesh.rotation.z = Math.PI / 2.4;
    if (kind === 'antivirus') mesh.rotation.z = 0.12;
    this.scene.add(mesh);

    const g = GLOW[kind] || GLOW.battery;
    const item = {
      kind,
      mesh,
      baseY,
      phase: this.rng.range(0, Math.PI * 2),
      taken: false,
      pos: new THREE.Vector3(x, baseY, z),
      glow: {
        pos: new THREE.Vector3(x, baseY + 0.1, z),
        color: COLORS[g.color],
        intensity: g.intensity,
        distance: g.distance,
        active: true,
      },
    };
    this.items.push(item);
    return item;
  }

  get glowSources() {
    return this.items.filter((i) => !i.taken).map((i) => i.glow);
  }

  labelFor(kind) {
    return LABELS[kind] || 'Pick up item';
  }

  /** 3D distance from the player's eyes to a pickup. */
  grabDistance(player, item) {
    const dy = player.pos.y - item.pos.y;
    const dx = player.pos.x - item.pos.x;
    const dz = player.pos.z - item.pos.z;
    return Math.hypot(dx, dy, dz);
  }

  canGrab(player, item) {
    if (item.taken) return false;
    return this.grabDistance(player, item) <= PICKUP.grabRange;
  }

  /**
   * Collect one pickup the player is reaching for.
   * @returns {{taken:Array<string>, batteries:number, full:number}|null}
   */
  collectOne(item, player, inventory) {
    if (!this.canGrab(player, item)) return null;

    const taken = [];
    let batteries = 0;
    let full = 0;

    if (item.kind === 'battery') {
      if (player.battery >= 99.5) {
        return { taken, batteries: 0, full: 1 };
      }
      player.addBattery(PLAYER.batteryPickup);
      audio.pickupBattery();
      batteries = 1;
    } else {
      if (!inventory || !inventory.add(item.kind, 1)) {
        return { taken, batteries: 0, full: 1 };
      }
      if (item.kind === 'cheetos') audio.pickupCheeto();
      else if (item.kind === 'soda') audio.pickupSoda();
      else audio.pickupDisc();
      taken.push(item.kind);
    }

    item.taken = true;
    item.glow.active = false;
    this.scene.remove(item.mesh);
    return { taken, batteries, full };
  }

  /** Animates bobbing pickups. Collection is handled via collectOne(). */
  update(dt) {
    this._t += dt;

    for (const item of this.items) {
      if (item.taken) continue;
      const bob = Math.sin(this._t * PICKUP.bobSpeed + item.phase) * 0.07;
      item.mesh.position.y = item.baseY + bob;
      if (item.kind === 'antivirus') item.mesh.rotation.y += dt * PICKUP.spinSpeed * 1.6;
      else item.mesh.rotation.y += dt * PICKUP.spinSpeed;
      item.pos.y = item.baseY + bob;
      item.glow.pos.y = item.baseY + bob + 0.1;
    }
  }

  get remaining() {
    return this.items.filter((i) => !i.taken).length;
  }

  dispose() {
    for (const item of this.items) {
      if (!item.taken) this.scene.remove(item.mesh);
    }
    this.items.length = 0;
  }
}
