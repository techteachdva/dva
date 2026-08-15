/**
 * Keyboard / mouse / touch input.
 *
 * Pointer lock is requested on click. Chromebooks in tablet mode and
 * touchscreen Chromebooks fall back to the on-screen stick plus drag-to-look.
 */

import { clamp } from './util.js';

const KEY_ALIASES = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'use', Enter: 'use',
  KeyF: 'light',
  // Crouch is a toggle. Both keys are comfortable on a Chromebook, and neither
  // collides with Shift (sprint), so you can hold a direction and crouch freely.
  KeyC: 'crouch', ControlLeft: 'crouch', ControlRight: 'crouch',
};

export const input = {
  held: Object.create(null),
  _edge: Object.create(null),
  mouseDX: 0,
  mouseDY: 0,
  locked: false,
  sensitivity: 100,
  touchActive: false,
  touchMove: { x: 0, y: 0 },
  _canvas: null,
  _enabled: false,
  onPointerLockChange: null,

  init(canvas) {
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      const a = KEY_ALIASES[e.code];
      if (a) {
        if (!this.held[a]) this._edge[a] = true;
        this.held[a] = true;
      }
      // Stop the page from scrolling behind the canvas
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const a = KEY_ALIASES[e.code];
      if (a) this.held[a] = false;
    });

    // Losing focus must not leave a key stuck down
    window.addEventListener('blur', () => this.releaseAll());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.releaseAll();
      if (this.onPointerLockChange) this.onPointerLockChange(this.locked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this._enabled) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    this._initTouch();
  },

  /** Enable/disable look input without dropping pointer lock. */
  setEnabled(on) {
    this._enabled = on;
    if (!on) this.releaseAll();
  },

  releaseAll() {
    for (const k in this.held) this.held[k] = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
  },

  /** True once per physical press. */
  pressed(action) {
    if (this._edge[action]) {
      this._edge[action] = false;
      return true;
    }
    return false;
  },

  clearEdges() {
    for (const k in this._edge) this._edge[k] = false;
  },

  requestLock() {
    if (!this._canvas || this.locked) return;
    const p = this._canvas.requestPointerLock?.();
    // Chrome returns a promise in newer versions; a rejection is not fatal
    if (p && typeof p.catch === 'function') p.catch(() => {});
  },

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  },

  /** Consumes accumulated look delta, scaled by sensitivity. */
  takeLook() {
    const scale = (this.sensitivity / 100) * 0.0022;
    const out = { x: this.mouseDX * scale, y: this.mouseDY * scale };
    this.mouseDX = 0;
    this.mouseDY = 0;
    if (this._touchLook.x || this._touchLook.y) {
      out.x += this._touchLook.x * scale * 1.5;
      out.y += this._touchLook.y * scale * 1.5;
      this._touchLook.x = 0;
      this._touchLook.y = 0;
    }
    return out;
  },

  _touchLook: { x: 0, y: 0 },

  _initTouch() {
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const ui = document.getElementById('touch-ui');
    const stick = document.getElementById('touch-stick');
    const knob = document.getElementById('touch-knob');
    if (!ui || !stick || !knob) return;

    this.touchAvailable = true;

    let stickId = null;
    let originX = 0;
    let originY = 0;
    const RADIUS = 46;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      originX = r.left + r.width / 2;
      originY = r.top + r.height / 2;
      this.touchActive = true;
      e.preventDefault();
    }, { passive: false });

    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - originX;
        let dy = t.clientY - originY;
        const len = Math.hypot(dx, dy) || 1;
        const cl = Math.min(len, RADIUS);
        dx = (dx / len) * cl;
        dy = (dy / len) * cl;
        setKnob(dx, dy);
        this.touchMove.x = clamp(dx / RADIUS, -1, 1);
        this.touchMove.y = clamp(dy / RADIUS, -1, 1);
        e.preventDefault();
      }
    };

    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        this.touchMove.x = 0;
        this.touchMove.y = 0;
        setKnob(0, 0);
      }
    };

    stick.addEventListener('touchmove', moveStick, { passive: false });
    stick.addEventListener('touchend', endStick);
    stick.addEventListener('touchcancel', endStick);

    // Drag anywhere else on the canvas to look around
    let lookId = null;
    let lastX = 0;
    let lastY = 0;

    this._canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    }, { passive: true });

    this._canvas.addEventListener('touchmove', (e) => {
      if (!this._enabled) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        this._touchLook.x += t.clientX - lastX;
        this._touchLook.y += t.clientY - lastY;
        lastX = t.clientX;
        lastY = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });

    this._canvas.addEventListener('touchend', () => { lookId = null; });

    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        this.held[action] = true;
        this._edge[action] = true;
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        this.held[action] = false;
        e.preventDefault();
      }, { passive: false });
    };

    bindBtn('tbtn-use', 'use');
    bindBtn('tbtn-light', 'light');
    bindBtn('tbtn-run', 'sprint');
    bindBtn('tbtn-crouch', 'crouch');
  },

  showTouchUi(show) {
    if (!this.touchAvailable) return;
    const ui = document.getElementById('touch-ui');
    if (ui) ui.classList.toggle('hidden', !show);
  },

  /** Combined keyboard + touch movement axes. */
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.held.forward) y -= 1;
    if (this.held.back) y += 1;
    if (this.held.left) x -= 1;
    if (this.held.right) x += 1;
    x += this.touchMove.x;
    y += this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  },
};
