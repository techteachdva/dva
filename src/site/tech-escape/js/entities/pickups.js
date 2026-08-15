/**
 * Floor loot: bags of hot cheetos (health) and AA batteries (flashlight fuel).
 * Both bob and spin so they catch the eye in a dark room.
 */

import * as THREE from '../../vendor/three.module.js';
import { PICKUP, PLAYER, COLORS } from '../config.js';
import { audio } from '../audio.js';

let geo = null;

function getGeometry() {
  if (geo) return geo;
  geo = {
    bag: new THREE.BoxGeometry(0.3, 0.4, 0.13),
    bagFold: new THREE.BoxGeometry(0.32, 0.06, 0.15),
    battery: new THREE.CylinderGeometry(0.075, 0.075, 0.3, 8),
    batteryCap: new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8),
  };
  return geo;
}

export class PickupField {
  constructor(scene, maze, rng) {
    this.scene = scene;
    this.maze = maze;
    this.rng = rng;
    this.items = [];
    this._mats = [];
    this._t = 0;
  }

  _makeCheetos() {
    const g = getGeometry();
    const group = new THREE.Group();
    const bagMat = new THREE.MeshBasicMaterial({ color: COLORS.cheeto });
    const bag = new THREE.Mesh(g.bag, bagMat);
    group.add(bag);
    const foldMat = new THREE.MeshBasicMaterial({ color: 0xb32c00 });
    const top = new THREE.Mesh(g.bagFold, foldMat);
    top.position.y = 0.21;
    group.add(top);
    const bottom = new THREE.Mesh(g.bagFold, foldMat);
    bottom.position.y = -0.21;
    group.add(bottom);
    this._mats.push(bagMat, foldMat);
    return group;
  }

  _makeBattery() {
    const g = getGeometry();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: COLORS.battery });
    const body = new THREE.Mesh(g.battery, bodyMat);
    group.add(body);
    const capMat = new THREE.MeshBasicMaterial({ color: 0xc9c9d2 });
    const cap = new THREE.Mesh(g.batteryCap, capMat);
    cap.position.y = 0.17;
    group.add(cap);
    this._mats.push(bodyMat, capMat);
    return group;
  }

  /**
   * @param {'cheetos'|'battery'} kind
   * @param {[number,number]} cell
   */
  spawn(kind, cell) {
    const c = this.maze.cellCenter(cell[0], cell[1]);
    // Nudge off-centre so items are not all in a perfect grid
    const ox = this.rng.range(-1.1, 1.1);
    const oz = this.rng.range(-1.1, 1.1);
    const mesh = kind === 'cheetos' ? this._makeCheetos() : this._makeBattery();
    const baseY = kind === 'cheetos' ? 0.34 : 0.28;
    mesh.position.set(c.x + ox, baseY, c.z + oz);
    mesh.rotation.y = this.rng.range(0, Math.PI * 2);
    if (kind === 'battery') mesh.rotation.z = Math.PI / 2.4;
    this.scene.add(mesh);

    const item = {
      kind,
      mesh,
      baseY,
      phase: this.rng.range(0, Math.PI * 2),
      taken: false,
      pos: new THREE.Vector3(c.x + ox, baseY, c.z + oz),
      glow: {
        pos: new THREE.Vector3(c.x + ox, baseY + 0.1, c.z + oz),
        color: kind === 'cheetos' ? COLORS.cheeto : COLORS.battery,
        intensity: kind === 'cheetos' ? 1.5 : 1.7,
        distance: 4.2,
        active: true,
      },
    };
    this.items.push(item);
    return item;
  }

  get glowSources() {
    return this.items.filter((i) => !i.taken).map((i) => i.glow);
  }

  /**
   * Animates and collects. Returns what the player picked up this frame.
   * @returns {{cheetos:number, batteries:number, wasted:number}}
   */
  update(dt, player) {
    this._t += dt;
    let cheetos = 0;
    let batteries = 0;
    let wasted = 0;

    for (const item of this.items) {
      if (item.taken) continue;
      const bob = Math.sin(this._t * PICKUP.bobSpeed + item.phase) * 0.07;
      item.mesh.position.y = item.baseY + bob;
      item.mesh.rotation.y += dt * PICKUP.spinSpeed;

      const dx = player.pos.x - item.pos.x;
      const dz = player.pos.z - item.pos.z;
      if (dx * dx + dz * dz > PICKUP.radius * PICKUP.radius) continue;

      if (item.kind === 'cheetos') {
        // Do not waste a full-health player's snack
        if (player.health >= player.maxHealth) {
          wasted++;
          continue;
        }
        player.heal(PICKUP.cheetosHeal);
        audio.pickupCheeto();
        cheetos++;
      } else {
        if (player.battery >= 99.5) {
          wasted++;
          continue;
        }
        player.addBattery(PLAYER.batteryPickup);
        audio.pickupBattery();
        batteries++;
      }

      item.taken = true;
      item.glow.active = false;
      this.scene.remove(item.mesh);
    }

    return { cheetos, batteries, wasted };
  }

  get remaining() {
    return this.items.filter((i) => !i.taken).length;
  }

  dispose() {
    for (const item of this.items) {
      if (!item.taken) this.scene.remove(item.mesh);
    }
    this.items.length = 0;
    for (const m of this._mats) m.dispose();
    this._mats.length = 0;
    if (geo) {
      for (const k in geo) geo[k].dispose();
      geo = null;
    }
  }
}
