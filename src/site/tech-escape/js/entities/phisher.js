/**
 * Phishers — cloaked figures that cast fishing lines to steal items or yank you from hiding.
 */

import * as THREE from '../../vendor/three.module.js';
import { PHISHER, CELL } from '../config.js';
import { clamp } from '../util.js';
import { audio } from '../audio.js';

let sharedGeo = null;

function getGeometry() {
  if (!sharedGeo) {
    sharedGeo = {
      cloak: new THREE.ConeGeometry(0.38, 1.1, 8),
      mask: new THREE.SphereGeometry(0.22, 8, 6),
    };
  }
  return sharedGeo;
}

export class Phisher {
  constructor(maze, cell, rng, index) {
    this.maze = maze;
    this.rng = rng;
    this.index = index;
    const c = maze.cellCenter(cell[0], cell[1]);
    this.pos = new THREE.Vector3(c.x, 0.9, c.z);
    this.heading = rng.range(0, Math.PI * 2);
    this.hunting = false;
    this.dead = false;
    this.castTimer = rng.range(1, PHISHER.castCooldown);
    this.speedScale = 1;
    this.mesh = this._buildMesh();
    this.glow = {
      pos: new THREE.Vector3().copy(this.pos),
      color: 0xaa66ff,
      intensity: 2.2,
      distance: 6,
      active: true,
    };
  }

  _buildMesh() {
    const g = getGeometry();
    const group = new THREE.Group();
    const cloak = new THREE.Mesh(g.cloak, new THREE.MeshLambertMaterial({ color: 0x2a2040 }));
    cloak.position.y = 0.55;
    group.add(cloak);
    const mask = new THREE.Mesh(g.mask, new THREE.MeshLambertMaterial({ color: 0xeeddcc }));
    mask.position.set(0, 1.05, 0.12);
    group.add(mask);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x444444 }),
    );
    pole.rotation.z = 0.4;
    pole.position.set(0.35, 0.9, 0);
    group.add(pole);
    group.position.copy(this.pos);
    return group;
  }

  _sees(player, diff) {
    if (!player.alive || (player.hidden && diff.hiddenEvade)) return false;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > PHISHER.sightRange * diff.sightScale) return false;
    return this.maze.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
  }

  update(dt, player, flow, diff, inventory = null) {
    if (this.dead) return null;
    const seen = this._sees(player, diff);
    this.hunting = seen;

    if (seen) {
      const dx = player.pos.x - this.pos.x;
      const dz = player.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetAng = Math.atan2(dx, dz);
      this.heading += clamp(targetAng - this.heading, -5 * dt, 5 * dt);
      if (dist > 3) {
        const sp = PHISHER.chaseSpeed * this.speedScale * diff.speedScale;
        this.pos.x += (-Math.sin(this.heading)) * sp * dt;
        this.pos.z += (-Math.cos(this.heading)) * sp * dt;
        this.maze.collide(this.pos, PHISHER.radius);
      }
    }

    this.castTimer -= dt;
    if (seen && this.castTimer <= 0) {
      this.castTimer = PHISHER.castCooldown;
      const dx = player.pos.x - this.pos.x;
      const dz = player.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= PHISHER.castRange) {
        audio.nearMiss();
        if (player.hidden && player.crouching && player.underTable()) {
          return { pullFromHide: true, from: this.pos.clone() };
        }
        if (inventory && dist < PHISHER.stealRange + 2) {
          const kinds = ['cheetos', 'soda', 'antivirus'].filter((k) => inventory.has(k));
          if (kinds.length) {
            const k = this.rng.pick(kinds);
            inventory.remove(k);
            return { stole: k, from: this.pos.clone() };
          }
        }
      }
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.glow.pos.copy(this.pos);
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

export function disposePhisherGeometry() {
  if (!sharedGeo) return;
  for (const g of Object.values(sharedGeo)) g.dispose?.();
  sharedGeo = null;
}
