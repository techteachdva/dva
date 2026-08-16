/**
 * Keyboard / mouse / touch input.
 *
 * Desktop: pointer lock + keyboard + optional three-button mouse layer.
 * Phones: virtual stick, look zone, and action buttons (no pointer lock).
 *
 * Gameplay binds are loaded from settings and can be remapped in the pause menu.
 */

import { clamp } from './util.js';
import { MOBILE } from './config.js';
import { normalizeBinds } from './meta/binds.js';
import { mousePlay } from './input-mouse.js';
import { touchUi, preferTouchControls } from './input-touch.js';

/** Movement and sprint — not remapped. */
const FIXED_BINDS = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export const input = {
  held: Object.create(null),
  _edge: Object.create(null),
  _codeToAction: { ...FIXED_BINDS },
  mouseDX: 0,
  mouseDY: 0,
  locked: false,
  sensitivity: 100,
  touchMode: false,
  touchAvailable: false,
  _canvas: null,
  _enabled: false,
  onPointerLockChange: null,

  /** Rebuild code → action map from saved settings. */
  applyBinds(binds) {
    const map = { ...FIXED_BINDS };
    const b = normalizeBinds(binds);
    for (const [action, code] of Object.entries(b)) {
      if (code) map[code] = action;
    }
    if (b.interact === 'Enter') map.NumpadEnter = 'interact';
    this._codeToAction = map;
  },

  init(canvas) {
    this._canvas = canvas;
    this.touchMode = preferTouchControls();
    document.body.classList.toggle('touch-mode', this.touchMode);

    window.addEventListener('keydown', (e) => {
      const a = this._codeToAction[e.code];
      if (a) {
        if (!this.held[a]) this._edge[a] = true;
        this.held[a] = true;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const a = this._codeToAction[e.code];
      if (a) this.held[a] = false;
    });

    window.addEventListener('blur', () => this.releaseAll());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && !this.touchMode) this.releaseAll();
      if (this.onPointerLockChange) this.onPointerLockChange(this.locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this._enabled || this.touchMode) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    touchUi.init(this);
    this.touchAvailable = touchUi.available;
    mousePlay.init(canvas);
  },

  setEnabled(on) {
    this._enabled = on;
    if (!on) this.releaseAll();
  },

  releaseAll() {
    for (const k in this.held) this.held[k] = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    mousePlay.releaseAll();
    touchUi.releaseAll();
  },

  pressed(action) {
    if (this._edge[action]) {
      this._edge[action] = false;
      return true;
    }
    return false;
  },

  clearEdges() {
    for (const k in this._edge) this._edge[k] = false;
    mousePlay.clearEdges();
  },

  mouseActions() {
    if (this.touchMode) {
      return { primary: false, eat: false, light: false, crouch: false, wheel: 0 };
    }
    return mousePlay.consumeEdges();
  },

  tickMouse(enabled, locked) {
    if (this.touchMode) return;
    mousePlay.tick(enabled, locked);
  },

  requestLock() {
    if (this.touchMode || !this._canvas || this.locked) return;
    const p = this._canvas.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  },

  releaseLock() {
    if (this.touchMode) return;
    if (document.pointerLockElement) document.exitPointerLock();
  },

  takeLook() {
    const touchScale = this.touchMode ? MOBILE.lookScale : 1;
    const scale = (this.sensitivity / 100) * 0.0022 * touchScale;
    this.mouseDX = mousePlay.absorbLookDelta(this.mouseDX);
    const out = { x: this.mouseDX * scale, y: this.mouseDY * scale };
    this.mouseDX = 0;
    this.mouseDY = 0;

    if (this.touchMode && touchUi.active) {
      const tl = touchUi.consumeLook();
      out.x += tl.x * scale;
      out.y += tl.y * scale;
    }
    return out;
  },

  showTouchUi(show) {
    touchUi.setActive(show && this.touchMode);
  },

  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.held.forward) y -= 1;
    if (this.held.back) y += 1;
    if (this.held.left) x -= 1;
    if (this.held.right) x += 1;

    if (this.touchMode && touchUi.active) {
      x += touchUi.move.x;
      y += touchUi.move.y;
    }

    if (!this.touchMode) {
      const aug = mousePlay.augmentMoveAxes({ x, y });
      this.held.mouseSprint = aug.sprint;
      return { x: aug.x, y: aug.y };
    }

    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  },
};

export { touchUi, preferTouchControls };
