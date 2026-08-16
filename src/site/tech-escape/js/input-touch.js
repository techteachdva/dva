/**
 * Mobile / tablet touch controls for Chrome and other phone browsers.
 *
 * Pointer lock is unreliable or unavailable on phones, so movement uses a virtual
 * stick, looking uses a dedicated drag zone, and actions use large tap buttons.
 * Fullscreen is offered so gameplay can use the full display.
 */

import { clamp } from './util.js';
import { MOBILE } from './config.js';

const $ = (id) => document.getElementById(id);

/** Coarse pointer or narrow viewport with touch — phone/tablet play mode. */
export function preferTouchControls() {
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const narrow = window.innerWidth <= 920 || window.innerHeight <= 520;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarse || narrow || mobileUa;
}

export const touchUi = {
  available: false,
  active: false,
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  stickRadius: MOBILE.stickRadius,
  _stickId: null,
  _stickOrigin: { x: 0, y: 0 },
  _lookTouches: null,
  _onStickStart: null,
  _onStickMove: null,
  _onStickEnd: null,

  init(input) {
    const ui = $('touch-ui');
    const stick = $('touch-stick');
    const knob = $('touch-knob');
    const lookZone = $('touch-look');
    if (!ui || !stick || !knob || !lookZone) return;

    this.available = true;
    this._lookTouches = new Map();
    this._input = input;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    const resetStick = () => {
      this._stickId = null;
      this.move.x = 0;
      this.move.y = 0;
      setKnob(0, 0);
    };

    this._onStickStart = (e) => {
      if (!this.active) return;
      const t = e.changedTouches[0];
      if (!t) return;
      this._stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      this._stickOrigin.x = r.left + r.width / 2;
      this._stickOrigin.y = r.top + r.height / 2;
      e.preventDefault();
    };

    this._onStickMove = (e) => {
      if (!this.active || this._stickId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._stickId) continue;
        let dx = t.clientX - this._stickOrigin.x;
        let dy = t.clientY - this._stickOrigin.y;
        const len = Math.hypot(dx, dy) || 1;
        const cl = Math.min(len, this.stickRadius);
        dx = (dx / len) * cl;
        dy = (dy / len) * cl;
        setKnob(dx, dy);
        this.move.x = clamp(dx / this.stickRadius, -1, 1);
        this.move.y = clamp(dy / this.stickRadius, -1, 1);
        e.preventDefault();
      }
    };

    this._onStickEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._stickId) continue;
        resetStick();
      }
    };

    stick.addEventListener('touchstart', this._onStickStart, { passive: false });
    window.addEventListener('touchmove', this._onStickMove, { passive: false });
    window.addEventListener('touchend', this._onStickEnd);
    window.addEventListener('touchcancel', this._onStickEnd);

    lookZone.addEventListener('touchstart', (e) => {
      if (!this.active) return;
      for (const t of e.changedTouches) {
        this._lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      e.preventDefault();
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
      if (!this.active) return;
      for (const t of e.touches) {
        const rec = this._lookTouches.get(t.identifier);
        if (!rec) continue;
        this.look.x += t.clientX - rec.x;
        this.look.y += t.clientY - rec.y;
        rec.x = t.clientX;
        rec.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });

    const endLook = (e) => {
      for (const t of e.changedTouches) {
        this._lookTouches.delete(t.identifier);
      }
    };
    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);

    const bindBtn = (id, action, { toggle = false } = {}) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        if (!this.active) return;
        if (toggle) {
          input._edge[action] = true;
        } else {
          if (!input.held[action]) input._edge[action] = true;
          input.held[action] = true;
        }
        el.classList.add('is-pressed');
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        if (!toggle) input.held[action] = false;
        el.classList.remove('is-pressed');
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchcancel', () => {
        if (!toggle) input.held[action] = false;
        el.classList.remove('is-pressed');
      });
    };

    bindBtn('tbtn-use', 'interact');
    bindBtn('tbtn-throw', 'throw');
    bindBtn('tbtn-eat', 'eatCheetos');
    bindBtn('tbtn-light', 'light');
    bindBtn('tbtn-run', 'sprint', { toggle: true });
    bindBtn('tbtn-crouch', 'crouch', { toggle: true });
    bindBtn('tbtn-item', 'cycleItem');

    $('tbtn-fs')?.addEventListener('click', () => {
      this.toggleFullscreen();
    });
    $('tbtn-pause')?.addEventListener('click', () => {
      if (this._pauseHook) this._pauseHook();
    });

    document.addEventListener('fullscreenchange', () => this._syncFullscreenBtn());
    document.addEventListener('webkitfullscreenchange', () => this._syncFullscreenBtn());
  },

  setPauseHook(fn) {
    this._pauseHook = fn;
  },

  setActive(on) {
    this.active = on;
    const ui = $('touch-ui');
    if (ui) ui.classList.toggle('hidden', !on);
    if (!on) {
      this.move.x = 0;
      this.move.y = 0;
      this.look.x = 0;
      this.look.y = 0;
      this._lookTouches?.clear();
      this._stickId = null;
    }
  },

  consumeLook() {
    const out = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return out;
  },

  releaseAll() {
    this.move.x = 0;
    this.move.y = 0;
    this.look.x = 0;
    this.look.y = 0;
    this._lookTouches?.clear();
    this._stickId = null;
    const knob = $('touch-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    for (const btn of document.querySelectorAll('.tbtn.is-pressed')) {
      btn.classList.remove('is-pressed');
    }
  },

  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },

  async requestFullscreen() {
    const el = $('app') || document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) {
      /* User or browser denied — non-fatal */
    }
    this._syncFullscreenBtn();
  },

  async exitFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { /* ignore */ }
    this._syncFullscreenBtn();
  },

  toggleFullscreen() {
    if (this.isFullscreen()) this.exitFullscreen();
    else this.requestFullscreen();
  },

  _syncFullscreenBtn() {
    const btn = $('tbtn-fs');
    if (!btn) return;
    const on = this.isFullscreen();
    btn.textContent = on ? 'EXIT FS' : 'FULL';
    btn.classList.toggle('is-active', on);
  },
};
