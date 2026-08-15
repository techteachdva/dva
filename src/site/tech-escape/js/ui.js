/**
 * All DOM touching lives here: the HUD, toasts, and screen switching.
 * Keeping it in one place means the game loop never queries the document.
 */

import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  el: {},
  _bags: [],
  _toasts: [],
  _lastInteract: null,
  _lastHint: null,
  _dangerOn: false,

  init() {
    const ids = [
      'hud', 'objective-text', 'code-pieces', 'interact-prompt', 'interact-text',
      'health-bags', 'stamina-fill', 'battery-fill', 'battery-label',
      'hide-indicator', 'hint-line', 'glitch-overlay', 'stance-value',
      'toast-stack', 'danger-warning', 'damage-flash', 'crosshair',
      'screen-title', 'screen-pause', 'screen-standards', 'screen-quiz',
      'screen-decrypt', 'screen-printer', 'screen-over', 'screen-win',
      'screen-load', 'screen-error', 'boot-log', 'load-fill', 'error-text',
      'over-title', 'over-flavor', 'over-stats', 'over-tip',
      'win-stats', 'win-report', 'win-flavor', 'perf-note',
    ];
    for (const id of ids) {
      this.el[id] = $(id);
    }
  },

  // ------------------------------------------------------------------ screens

  /** Hides every screen; pass a key to then show one. */
  showScreen(name) {
    const screens = [
      'screen-title', 'screen-pause', 'screen-standards', 'screen-quiz',
      'screen-decrypt', 'screen-printer', 'screen-over', 'screen-win',
      'screen-load', 'screen-error',
    ];
    for (const s of screens) {
      const el = this.el[s];
      if (el) el.classList.toggle('hidden', s !== name);
    }
  },

  hideAllScreens() {
    this.showScreen(null);
  },

  setHudVisible(on) {
    this.el.hud.classList.toggle('hidden', !on);
    // Stance styling lives on <body>, so it has to be cleared with the HUD or a
    // crouched vignette would bleed onto the title and results screens
    if (!on) {
      this.setCrouched(false, false);
      this.showHint(null);
      this.showInteract(null);
    }
  },

  // ------------------------------------------------------------------- boot

  bootLog(lines) {
    if (this.el['boot-log']) this.el['boot-log'].textContent = lines.join('\n');
  },

  setLoadProgress(pct) {
    if (this.el['load-fill']) this.el['load-fill'].style.width = `${clamp(pct * 100, 0, 100)}%`;
  },

  fatalError(message) {
    if (this.el['error-text']) this.el['error-text'].textContent = message;
    this.showScreen('screen-error');
  },

  setPerfNote(text) {
    if (this.el['perf-note']) this.el['perf-note'].textContent = text;
  },

  // --------------------------------------------------------------------- HUD

  setObjective(text) {
    const el = this.el['objective-text'];
    if (el && el.textContent !== text) el.textContent = text;
  },

  buildHealth(max) {
    const host = this.el['health-bags'];
    host.innerHTML = '';
    this._bags = [];
    for (let i = 0; i < max; i++) {
      const b = document.createElement('div');
      b.className = 'bag';
      host.appendChild(b);
      this._bags.push(b);
    }
  },

  setHealth(current) {
    this._bags.forEach((b, i) => {
      b.classList.toggle('is-empty', i >= current);
    });
  },

  setStamina(pct, exhausted) {
    const el = this.el['stamina-fill'];
    el.style.width = `${clamp(pct * 100, 0, 100)}%`;
    el.classList.toggle('is-low', pct < 0.35 && !exhausted);
    el.classList.toggle('is-spent', exhausted);
  },

  setBattery(pct, on, burning = false) {
    const el = this.el['battery-fill'];
    el.style.width = `${clamp(pct * 100, 0, 100)}%`;
    el.classList.toggle('is-low', pct < 0.25);
    el.classList.toggle('is-off', !on);
    // Burning a virus drains fast, so the meter says so out loud
    el.classList.toggle('is-burning', burning && on);
    const label = this.el['battery-label'];
    if (label) {
      const want = burning && on ? 'BURNING VIRUS' : 'FLASHLIGHT';
      if (label.dataset.state !== want) {
        label.dataset.state = want;
        label.textContent = want;
      }
    }
  },

  /** Lowers the HUD and darkens the edges while crouched, more so when hidden. */
  setCrouched(crouching, hidden) {
    const b = document.body;
    if (b.classList.contains('is-crouched') !== crouching) {
      b.classList.toggle('is-crouched', crouching);
    }
    if (b.classList.contains('is-hidden-safe') !== hidden) {
      b.classList.toggle('is-hidden-safe', hidden);
    }
    const el = this.el['stance-value'];
    if (el) {
      const want = hidden ? 'HIDDEN' : crouching ? 'CRAWLING' : 'STANDING';
      if (el.textContent !== want) {
        el.textContent = want;
        el.className = hidden ? 'is-hidden' : crouching ? 'is-crouch' : '';
      }
    }
  },

  /** Secondary prompt line used for crouch/hide coaching. */
  showHint(text) {
    const el = this.el['hint-line'];
    if (!el) return;
    if (!text) {
      if (this._lastHint !== null) {
        el.classList.add('hidden');
        this._lastHint = null;
      }
      return;
    }
    if (text !== this._lastHint) {
      el.textContent = text;
      el.classList.remove('hidden');
      this._lastHint = text;
    }
  },

  /**
   * RGB-split and static burst when a virus glitches. Screen-space CSS keeps it
   * dramatic without costing a render pass on integrated graphics.
   */
  glitchBurst(reduced) {
    const el = this.el['glitch-overlay'];
    if (!el) return;
    el.classList.remove('is-firing', 'is-firing-soft');
    // Force a reflow so the animation restarts on rapid repeat glitches
    void el.offsetWidth;
    el.classList.add(reduced ? 'is-firing-soft' : 'is-firing');
    clearTimeout(this._glitchTimer);
    this._glitchTimer = setTimeout(() => {
      el.classList.remove('is-firing', 'is-firing-soft');
    }, reduced ? 260 : 620);
  },

  /** @param {Array<string|null>} fragments four entries, null when unsolved */
  setPieces(fragments) {
    const nodes = this.el['code-pieces'].children;
    for (let i = 0; i < nodes.length; i++) {
      const found = !!fragments[i];
      const slot = nodes[i].querySelector('.piece-slot');
      slot.textContent = found ? fragments[i] : '? ? ?';
      if (found && !nodes[i].classList.contains('is-found')) {
        nodes[i].classList.add('is-found', 'just-found');
        setTimeout(() => nodes[i].classList.remove('just-found'), 700);
      } else if (!found) {
        nodes[i].classList.remove('is-found');
      }
    }
  },

  showInteract(text) {
    const el = this.el['interact-prompt'];
    if (!text) {
      if (this._lastInteract !== null) {
        el.classList.add('hidden');
        this._lastInteract = null;
      }
      return;
    }
    if (text !== this._lastInteract) {
      this.el['interact-text'].textContent = text;
      el.classList.remove('hidden');
      this._lastInteract = text;
    }
  },

  setHiddenIndicator(on) {
    this.el['hide-indicator'].classList.toggle('hidden', !on);
  },

  setDanger(on) {
    if (on === this._dangerOn) return;
    this._dangerOn = on;
    this.el['danger-warning'].classList.toggle('hidden', !on);
  },

  flashDamage() {
    const el = this.el['damage-flash'];
    el.classList.add('is-hit');
    // Next frame removal lets the CSS transition run the fade-out
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.remove('is-hit'));
    });
  },

  // ------------------------------------------------------------------ toasts

  toast(message, kind = '', duration = 2600) {
    const el = document.createElement('div');
    el.className = `toast${kind ? ` ${kind}` : ''}`;
    el.textContent = message;
    this.el['toast-stack'].appendChild(el);
    this._toasts.push(el);

    // Never let toasts stack up and cover the view
    while (this._toasts.length > 3) {
      const old = this._toasts.shift();
      old.remove();
    }

    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => {
        el.remove();
        const i = this._toasts.indexOf(el);
        if (i >= 0) this._toasts.splice(i, 1);
      }, 420);
    }, duration);
  },

  clearToasts() {
    for (const t of this._toasts) t.remove();
    this._toasts.length = 0;
  },

  // -------------------------------------------------------------- end screens

  _statsHtml(stats) {
    return stats.map((s) => `
      <div class="stat${s.tone ? ` ${s.tone}` : ''}">
        <span class="stat-label">${s.label}</span>
        <span class="stat-value">${s.value}</span>
      </div>`).join('');
  },

  showGameOver({ title, flavor, stats, tip }) {
    this.el['over-title'].textContent = title;
    this.el['over-flavor'].textContent = flavor;
    this.el['over-stats'].innerHTML = this._statsHtml(stats);
    this.el['over-tip'].textContent = tip || '';
    this.showScreen('screen-over');
  },

  showVictory({ flavor, stats, report }) {
    if (flavor) this.el['win-flavor'].textContent = flavor;
    this.el['win-stats'].innerHTML = this._statsHtml(stats);
    this.el['win-report'].innerHTML = `
      <h4>MISSION DEBRIEF</h4>
      <ul>${report.map((r) => `<li>${r}</li>`).join('')}</ul>`;
    this.showScreen('screen-win');
  },
};
