/**
 * Lighting.
 *
 * Three.js bakes the light count into every material's shader, so adding or
 * removing lights mid-game causes a recompile and a visible hitch. Instead we
 * allocate a fixed pool of point lights once and reassign them each frame to
 * whichever glowing objects are nearest the player, dropping intensity to zero
 * for unused slots.
 */

import * as THREE from '../../vendor/three.module.js';
import { FLASHLIGHT, COLORS } from '../config.js';
import { clamp, lerp } from '../util.js';

export class Lighting {
  constructor(scene, camera, quality) {
    this.scene = scene;
    this.camera = camera;
    this.brightness = 1;

    // Just enough ambient light to make out shapes; the lab is meant to be dark
    this.ambient = new THREE.AmbientLight(0x2a3f5c, 0.5);
    scene.add(this.ambient);

    // Faint top-down fill separates floor from ceiling
    this.hemi = new THREE.HemisphereLight(0x18283c, 0x05070b, 0.35);
    scene.add(this.hemi);

    this.flashlight = new THREE.SpotLight(
      FLASHLIGHT.color,
      0,
      FLASHLIGHT.distance,
      FLASHLIGHT.angle,
      FLASHLIGHT.penumbra,
      1.2,
    );
    this.flashlight.position.set(0.16, -0.12, 0);
    this.flashTarget = new THREE.Object3D();
    this.flashTarget.position.set(0, 0, -1);
    camera.add(this.flashlight);
    camera.add(this.flashTarget);
    this.flashlight.target = this.flashTarget;

    // Small always-on glow at the player so you can see your own feet
    this.playerGlow = new THREE.PointLight(0x9fc4e8, 0.9, 5.5, 2);
    camera.add(this.playerGlow);

    this.pool = [];
    const count = quality.extraLights;
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(COLORS.screenGlow, 0, 10, 2);
      l.visible = true;
      scene.add(l);
      this.pool.push(l);
    }

    this._flashOn = false;
    this._flashLevel = 0;
    this._flickerPhase = 0;
    this.reduceFlashing = false;
    this._sorted = [];
  }

  setBrightness(mult) {
    this.brightness = mult;
    this.ambient.intensity = 0.5 * mult;
    this.hemi.intensity = 0.35 * mult;
    this.playerGlow.intensity = 0.9 * mult;
  }

  setFlashlight(on) {
    if (on && !this._flashOn) {
      this._flashLevel = FLASHLIGHT.intensity * this.brightness;
      this.flashlight.intensity = this._flashLevel;
    }
    this._flashOn = on;
  }

  /**
   * @param {number} dt seconds
   * @param {THREE.Vector3} playerPos
   * @param {Array} sources glow sources from the lab and enemies
   * @param {number} batteryPct 0..1, drives the dying-battery flicker
   * @param {{ crouching?: boolean, onTable?: boolean }} [playerState]
   */
  update(dt, playerPos, sources, batteryPct, playerState = {}) {
    const crouching = Boolean(playerState.crouching);
    const onTable = Boolean(playerState.onTable);
    // Keep the beam out of the floor mesh when crawling; raise slightly on desks.
    if (crouching) {
      this.flashlight.position.set(0.14, 0.04, 0.04);
    } else if (onTable) {
      this.flashlight.position.set(0.16, -0.08, 0);
    } else {
      this.flashlight.position.set(0.16, -0.12, 0);
    }
    // Flashlight intensity, with a dying-battery waver
    let target = 0;
    if (this._flashOn && batteryPct > 0) {
      target = FLASHLIGHT.intensity * this.brightness;
      if (batteryPct < 0.12 && !this.reduceFlashing) {
        /*
         * This used to cut the beam to 15-40% brightness at random intervals as
         * short as 50ms - a full-screen luminance swing of 60% or more, up to 20
         * times a second. That is a WCAG 2.3.1 failure and a real seizure risk on
         * a laptop a metre from a student's face, and non-interference means it
         * counts against the whole page no matter what else the game gets right.
         *
         * The replacement is an amplitude ripple that never drops below 92%.
         * Under a 10% luminance delta nothing counts as a flash at any rate, so
         * this is safe by construction rather than by tuning. Two slow sines beat
         * against each other to keep it feeling unstable instead of mechanical -
         * and a beam that breathes turns out to read as more ominous than one
         * that strobes, because the player never gets the reset of full darkness.
         */
        this._flickerPhase += dt * FLASHLIGHT.flickerHz * Math.PI * 2;
        const urgency = clamp(1 - batteryPct / 0.12, 0, 1);
        const ripple = (
          Math.sin(this._flickerPhase) + Math.sin(this._flickerPhase * 0.37)
        ) * 0.5;
        target *= 1 - FLASHLIGHT.flickerDepth * urgency * (0.5 + ripple * 0.5);
      }
    }
    // Snap on quickly so the beam is usable the moment a run starts; fade off gently.
    if (target > 0 && this._flashLevel < target * 0.2) {
      this._flashLevel = target;
    } else if (target === 0) {
      this._flashLevel = lerp(this._flashLevel, target, 1 - Math.pow(0.0001, dt));
    } else {
      this._flashLevel = lerp(this._flashLevel, target, 1 - Math.pow(0.004, dt));
    }
    this.flashlight.intensity = this._flashLevel;

    // Assign the light pool to the closest active sources
    this._sorted.length = 0;
    for (const s of sources) {
      if (!s.active) continue;
      const d2 = s.pos.distanceToSquared(playerPos);
      // Ignore anything well beyond its own falloff radius
      const reach = (s.distance + 4) * (s.distance + 4);
      if (d2 > reach) continue;
      this._sorted.push({ s, d2 });
    }
    this._sorted.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < this.pool.length; i++) {
      const light = this.pool[i];
      const entry = this._sorted[i];
      if (!entry) {
        light.intensity = 0;
        continue;
      }
      const s = entry.s;
      light.position.copy(s.pos);
      light.color.setHex(s.color);
      light.distance = s.distance;
      // Fade out at the edge of range so lights do not pop in
      const d = Math.sqrt(entry.d2);
      const fade = clamp(1 - (d - s.distance) / 4, 0, 1);
      light.intensity = s.intensity * fade * this.brightness;
    }
  }

  dispose() {
    this.scene.remove(this.ambient);
    this.scene.remove(this.hemi);
    this.camera.remove(this.flashlight);
    this.camera.remove(this.flashTarget);
    this.camera.remove(this.playerGlow);
    for (const l of this.pool) this.scene.remove(l);
    this.pool.length = 0;
  }
}
