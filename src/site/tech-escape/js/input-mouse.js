/**
 * Mouse-only play layer for Tech Escape.
 *
 * Pointer look stays the same. Movement and actions map to three buttons plus
 * the scroll wheel so the whole game is playable without touching the keyboard:
 *
 *   Right hold  → walk forward
 *   Left hold   → walk backward
 *   Both holds  → sprint forward
 *   Middle hold + move mouse sideways → strafe
 *   Left click  → use terminal OR throw (same as keyboard E / Enter split:
 *                   interact when a prompt is up, throw otherwise)
 *   Right click → eat hot cheetos / drink selected soda
 *   Right hold 400ms+ → toggle flashlight (short click stays "eat")
 *   Middle click  → toggle crouch
 *   Scroll        → cycle inventory
 */

import { clamp } from './util.js';

const LONG_PRESS_MS = 420;

export const mousePlay = {
  btn: { left: false, right: false, middle: false },
  edge: { left: false, right: false, middle: false, wheel: 0 },
  strafe: 0,
  _rightDownAt: 0,
  _rightLongFired: false,
  _canvas: null,

  init(canvas) {
    this._canvas = canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => this._down(e), true);
    window.addEventListener('mouseup', (e) => this._up(e), true);
    canvas.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
  },

  _down(e) {
    if (e.button === 0) { this.btn.left = true; this.edge.left = true; }
    if (e.button === 1) { e.preventDefault(); this.btn.middle = true; this.edge.middle = true; }
    if (e.button === 2) {
      e.preventDefault();
      this.btn.right = true;
      this.edge.right = true;
      this._rightDownAt = performance.now();
      this._rightLongFired = false;
    }
  },

  _up(e) {
    if (e.button === 0) this.btn.left = false;
    if (e.button === 1) this.btn.middle = false;
    if (e.button === 2) {
      this.btn.right = false;
      this._rightDownAt = 0;
    }
  },

  _wheel(e) {
    e.preventDefault();
    this.edge.wheel += e.deltaY > 0 ? 1 : -1;
  },

  releaseAll() {
    this.btn.left = this.btn.right = this.btn.middle = false;
    this._rightDownAt = 0;
    this.strafe = 0;
  },

  /** Call each frame while controls are active. */
  tick(enabled, locked) {
    if (!enabled || !locked) {
      this.releaseAll();
      return;
    }
    if (this.btn.right && this._rightDownAt && !this._rightLongFired) {
      if (performance.now() - this._rightDownAt >= LONG_PRESS_MS) {
        this._rightLongFired = true;
        this.edge.rightLong = true;
      }
    }
  },

  /** Steer strafe from mouse X while middle button held. */
  absorbLookDelta(dx) {
    if (this.btn.middle && !this.btn.left && !this.btn.right) {
      this.strafe = clamp(this.strafe + dx * 0.0045, -1, 1);
      return 0;
    }
    return dx;
  },

  /** Merge into keyboard move axes. */
  augmentMoveAxes(axes) {
    let { x, y } = axes;
    if (this.btn.right) y -= 1;
    if (this.btn.left) y += 1;
    if (this.btn.right && this.btn.left) {
      y = -1;
    }
    if (Math.abs(this.strafe) > 0.02) {
      x += this.strafe;
      this.strafe *= 0.82;
    } else {
      this.strafe = 0;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, sprint: !!(this.btn.right && this.btn.left) };
  },

  consumeEdges() {
    const out = {
      primary: this.edge.left,
      eat: this.edge.right && !this._rightLongFired,
      light: !!this.edge.rightLong,
      crouch: this.edge.middle,
      wheel: this.edge.wheel,
    };
    this.edge.left = false;
    this.edge.middle = false;
    if (!this.btn.right) {
      this.edge.right = false;
      this.edge.rightLong = false;
    } else if (this._rightLongFired) {
      this.edge.right = false;
    }
    this.edge.wheel = 0;
    return out;
  },

  clearEdges() {
    this.edge.left = this.edge.right = this.edge.middle = false;
    this.edge.rightLong = false;
    this.edge.wheel = 0;
  },
};
