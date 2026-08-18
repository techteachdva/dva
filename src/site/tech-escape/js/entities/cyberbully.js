/**
 * Cyberbullies — squat, buff torsos with huge heads and bats. Ground melee hunters.
 */

import * as THREE from '../../vendor/three.module.js';
import { CYBERBULLY } from '../config.js';
import { clamp } from '../util.js';
import { audio } from '../audio.js';

let sharedGeo = null;

function getGeometry() {
  if (!sharedGeo) {
    sharedGeo = {
      torso: new THREE.BoxGeometry(0.55, 0.45, 0.38),
      head: new THREE.SphereGeometry(0.38, 10, 8),
      bat: new THREE.BoxGeometry(0.08, 0.55, 0.08),
    };
  }
  return sharedGeo;
}

export class Cyberbully {
  constructor(maze, cell, rng, index, obstacles = null) {
    this.maze = maze;
    this.obstacles = obstacles;
    this.rng = rng;
    this.index = index;
    const c = maze.cellCenter(cell[0], cell[1]);
    this.pos = new THREE.Vector3(c.x, 0.35, c.z);
    this.heading = rng.range(0, Math.PI * 2);
    this.hunting = false;
    this.dead = false;
    this.attackCooldown = 0;
    this.speedScale = 1;
    this.patrolTarget = null;
    this.wasHunting = false;
    this.mesh = this._buildMesh();
    this.glow = {
      pos: new THREE.Vector3().copy(this.pos),
      color: 0xff4422,
      intensity: 2,
      distance: 5.5,
      active: true,
    };
  }

  _buildMesh() {
    const g = getGeometry();
    const group = new THREE.Group();
    const torso = new THREE.Mesh(g.torso, new THREE.MeshLambertMaterial({ color: 0x1a0808 }));
    torso.position.y = 0.28;
    group.add(torso);
    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.4, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x220808 }),
    );
    shirt.position.y = 0.3;
    group.add(shirt);
    const flames = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.15, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff3300 }),
    );
    flames.position.set(0, 0.35, 0.2);
    group.add(flames);
    const head = new THREE.Mesh(g.head, new THREE.MeshLambertMaterial({ color: 0xddb8a0 }));
    head.position.y = 0.72;
    head.scale.set(1.15, 1.1, 1);
    group.add(head);
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.1, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    shades.position.set(0, 0.78, 0.22);
    group.add(shades);
    const bat = new THREE.Mesh(g.bat, new THREE.MeshLambertMaterial({ color: 0x333333 }));
    bat.position.set(0.38, 0.45, 0);
    bat.rotation.z = -0.6;
    group.add(bat);
    group.position.copy(this.pos);
    return group;
  }

  _sees(player, diff, alertActive) {
    if (!player.alive) return false;
    if (alertActive && !player.hidden) return true;
    if (diff.hiddenEvade && player.hidden) return false;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < player.noise) return true;
    if (dist > CYBERBULLY.sightRange * diff.sightScale) return false;
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const dot = (dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz;
    if (dot < Math.cos(CYBERBULLY.sightAngle)) return false;
    return this.maze.lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
  }

  update(dt, player, flow, diff, alertActive = false) {
    if (this.dead) return null;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const seen = this._sees(player, diff, alertActive);
    this.hunting = seen;

    let tx = this.pos.x;
    let tz = this.pos.z;
    if (seen) {
      tx = player.pos.x;
      tz = player.pos.z;
      if (!this.wasHunting) audio.spotted();
    } else if (!this.patrolTarget) {
      const cell = this.rng.pick(this.maze.openCells());
      this.patrolTarget = this.maze.cellCenter(cell[0], cell[1]);
    }
    if (!seen && this.patrolTarget) {
      tx = this.patrolTarget.x;
      tz = this.patrolTarget.z;
    }

    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const speed = (seen ? CYBERBULLY.chaseSpeed : CYBERBULLY.patrolSpeed)
      * this.speedScale * diff.speedScale;
    this.heading += clamp(Math.atan2(dx, dz) - this.heading, -CYBERBULLY.turnRate * dt, CYBERBULLY.turnRate * dt);
    this.pos.x += (-Math.sin(this.heading)) * speed * dt;
    this.pos.z += (-Math.cos(this.heading)) * speed * dt;
    this.maze.collide(this.pos, CYBERBULLY.radius);
    if (this.obstacles) this.obstacles.collide(this.pos, CYBERBULLY.radius, 0, 1.2);

    if (this.patrolTarget && Math.hypot(this.pos.x - this.patrolTarget.x, this.pos.z - this.patrolTarget.z) < 0.6) {
      this.patrolTarget = null;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.glow.pos.copy(this.pos);
    this.wasHunting = seen;

    if (seen && dist < CYBERBULLY.attackRange && this.attackCooldown <= 0 && !player.hidden) {
      this.attackCooldown = CYBERBULLY.attackCooldown;
      audio.nearMiss();
      return { hit: CYBERBULLY.damage, from: this.pos.clone() };
    }
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

export function disposeCyberbullyGeometry() {
  if (!sharedGeo) return;
  for (const g of Object.values(sharedGeo)) g.dispose?.();
  sharedGeo = null;
}
