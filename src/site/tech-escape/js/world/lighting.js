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
import { makeFlashlightCookie } from './level-themes.js?v=3.10';

export class Lighting {
  constructor(scene, camera, quality) {
    this.scene = scene;
    this.camera = camera;
    this.brightness = 1;

    // Enough fill to read the floor and wall panels with the flashlight off.
    // The beam is still the bright thing. The old 0.5 ambient left the lab as
    // a black screen until the light came on, which is how a first night
    // feels broken rather than dark.
    this.ambient = new THREE.AmbientLight(0x6e7c92, 0.18);
    scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0x8aa0b8, 0x1a140e, 0.12);
    scene.add(this.hemi);

    this.fill = new THREE.DirectionalLight(0xc5d4e6, 0.05);
    this.fill.position.set(6, 12, 4);
    scene.add(this.fill);

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
    // The cookie is attached for the whole run, never toggled, so turning the
    // beam on does not change the shader and stall a Chromebook.
    this._cookie = null;
    if (quality.cookie !== false) {
      this._cookie = makeFlashlightCookie();
      this.flashlight.map = this._cookie;
    }
    if (quality.shadows) {
      const mapSize = quality.shadowMapSize || 1024;
      this.flashlight.castShadow = true;
      this.flashlight.shadow.mapSize.set(mapSize, mapSize);
      this.flashlight.shadow.camera.near = 0.4;
      this.flashlight.shadow.camera.far = 18;
      this.flashlight.shadow.bias = -0.0006;
      this.flashlight.shadow.normalBias = 0.045;
      this.flashlight.shadow.radius = 2;
    }

    // Small always-on glow at the player so you can see your own feet
    this.playerGlow = new THREE.PointLight(0x9fc4e8, 0.12, 3.2, 2);
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
    this.ambient.intensity = 0.18 * mult;
    this.hemi.intensity = 0.12 * mult;
    this.fill.intensity = 0.05 * mult;
    this.playerGlow.intensity = 0.12 * mult;
  }

  setFlashlight(on) {
    this._flashOn = on;
    if (on) {
      this._flashLevel = FLASHLIGHT.intensity * this.brightness;
      this.flashlight.intensity = this._flashLevel;
    }
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
    this.scene.remove(this.fill);
    this.camera.remove(this.flashlight);
    this.camera.remove(this.flashTarget);
    this.camera.remove(this.playerGlow);
    for (const l of this.pool) this.scene.remove(l);
    this.pool.length = 0;
    this._cookie?.dispose();
    this._cookie = null;
  }
}
