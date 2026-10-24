/**
 * All DOM touching lives here: the HUD, toasts, and screen switching.
 * Keeping it in one place means the game loop never queries the document.
 */

import { clamp } from './util.js';
import { bindDisplay, normalizeBinds } from './meta/binds.js?v=3.25';
import { settings } from './meta/settings.js?v=3.21';
import { typeInto, printTree, printTogether } from './ui/typegate.js?v=3.21';
import { inventoryIcons } from './ui/inventory-icons.js?v=3.26';
import { audio } from './audio.js';

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
      'inventory-bar', 'caption-stack', 'interact-key',
      'screen-title', 'screen-firstrun', 'screen-profile', 'screen-guide',
      'screen-tutorial', 'screen-pause', 'screen-standards', 'screen-quiz',
      'screen-decrypt', 'screen-printer', 'screen-over', 'screen-win',
      'screen-highscores', 'screen-load', 'screen-error', 'boot-log', 'load-fill', 'error-text',
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
      'screen-title', 'screen-firstrun', 'screen-profile', 'screen-guide',
      'screen-tutorial', 'screen-pause', 'screen-standards', 'screen-quiz',
      'screen-decrypt', 'screen-printer', 'screen-over', 'screen-win',
      'screen-highscores', 'screen-load', 'screen-error',
    ];
    for (const s of screens) {
      const el = this.el[s];
      if (el) {
        el.classList.toggle('hidden', s !== name);
        if (s === name) el.scrollTop = 0;
      }
    }
    // Let Safari scroll menus; gameplay keeps touch-action: none on the canvas.
    document.body.classList.toggle('is-ui-screen', Boolean(name));
    this._printScreen(name);
  },

  _printScreen(name) {
    this._stopScreen?.();
    this._stopScreen = null;
    const menus = [
      'screen-title', 'screen-firstrun', 'screen-profile', 'screen-guide',
      'screen-tutorial', 'screen-pause', 'screen-standards', 'screen-highscores',
    ];
    if (!name || !menus.includes(name) || settings.get('reduceMotion')) return;
    const screen = document.getElementById(name);
    if (!screen) return;
    const rows = screen.querySelectorAll('[data-term-row]');
    const targets = rows.length
      ? rows
      : screen.querySelectorAll('h1, h2, h3, .resume-note, .story, .setting-note, .pause-lead, .std-p, .std-intro');
    if (targets.length) this._stopScreen = printTogether(targets, { cps: 64 });
  },

  hideAllScreens() {
    this.showScreen(null);
  },

  setHudVisible(on) {
    this.el.hud.classList.toggle('hidden', !on);
    const phone = document.getElementById('pocket-phone');
    if (phone && !phone.classList.contains('is-raised')) {
      phone.classList.toggle('hidden', !on);
    }
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
    if (!el || this._objective === text) return;
    this._objective = text;
    this._stopObjective?.();
    el.classList.remove('objective-pulse');
    void el.offsetWidth;
    el.classList.add('objective-pulse');
    audio.objectivePing();
    this._stopObjective = typeInto(el, text, { cps: 22 });
  },

  buildHealth(max) {
    this._healthMax = max || 1;
    this.setHealth(max);
  },

  setHealth(current) {
    const max = this._healthMax || 1;
    const el = document.getElementById('health-fill');
    if (!el) return;
    el.style.width = `${clamp((current / max) * 100, 0, 100)}%`;
    el.classList.toggle('is-low', current <= 1);
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
    if (this._batPct != null && pct > this._batPct + 0.03) {
      document.getElementById('battery-meter')?.classList.remove('is-gained');
      void document.getElementById('battery-meter')?.offsetWidth;
      document.getElementById('battery-meter')?.classList.add('is-gained');
    }
    this._batPct = pct;
    if (label) {
      const want = burning && on ? 'BURNING' : 'BEAM';
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
    const keyEl = this.el['interact-key'];
    if (keyEl) {
      const binds = normalizeBinds(settings.get('binds'));
      keyEl.textContent = bindDisplay(binds.interact);
    }
    if (!text) {
      if (this._lastInteract !== null) {
        el.classList.add('hidden');
        this._lastInteract = null;
      }
      return;
    }
    if (text !== this._lastInteract) {
      this._stopInteract?.();
      this._stopInteract = typeInto(this.el['interact-text'], text, { cps: 24 });
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

  /** Three spinning models per item. Empty sockets stay dark. */
  updateInventoryBar(inventory) {
    const host = this.el['inventory-bar'];
    if (!host || !inventory) return;
    const grid = ['cheetos', 'soda', 'battery', 'antivirus'];
    if (host.dataset.built !== 'cvbn') {
      host.innerHTML = this._invMarkup(inventory, grid);
      host.dataset.built = 'cvbn';
    }
    this._paintInv(host, inventory);
  },

  _invMarkup(inventory, kinds) {
    const keyOf = { cheetos: 'C', soda: 'V', battery: 'B', antivirus: 'N' };
    return kinds.map((kind) => {
      const info = inventory.info(kind);
      const sockets = [0, 1, 2].map((i) => `
        <div class="inv-socket" data-slot="${i}">
          <canvas class="inv-canvas" data-kind="${kind}" data-slot="${i}" width="64" height="64"></canvas>
        </div>`).join('');
      const key = keyOf[kind] ? `<span class="inv-key">${keyOf[kind]}</span>` : '';
      return `<div class="inv-group" data-kind="${kind}" aria-label="${info?.label || kind}">${key}${sockets}</div>`;
    }).join('');
  },

  _paintInv(host, inventory) {
    if (!host) return;
    for (const group of host.querySelectorAll('.inv-group')) {
      const kind = group.dataset.kind;
      const count = inventory.count(kind);
      group.classList.toggle('is-selected', inventory.selected === kind);
      group.querySelectorAll('.inv-socket').forEach((socket, i) => {
        const filled = i < count;
        socket.classList.toggle('is-filled', filled);
        const canvas = socket.querySelector('canvas');
        if (canvas) canvas.dataset.filled = filled ? '1' : '0';
      });
    }
  },

  setUsePrompt(text) {
    const el = document.getElementById('reload-prompt');
    if (!el) return;
    if (!text) {
      el.classList.add('hidden');
      el.dataset.msg = '';
      return;
    }
    if (el.dataset.msg !== text) {
      el.dataset.msg = text;
      el.textContent = text;
    }
    el.classList.remove('hidden');
    el.classList.toggle('is-flashing', !settings.get('reduceFlashing'));
  },

  playItemUse(kind, reduce, onDone) {
    const el = document.getElementById('item-use');
    if (!el || reduce) {
      onDone?.();
      return;
    }
    el.classList.remove('hidden', 'is-cheetos', 'is-soda');
    el.classList.add(kind === 'soda' ? 'is-soda' : 'is-cheetos');
    clearTimeout(this._useTimer);
    this._useTimer = setTimeout(() => {
      el.classList.add('hidden');
      onDone?.();
    }, 760);
  },

  playBatteryReload(reduce, onDone) {
    const el = document.getElementById('flash-hand');
    if (!el || reduce) {
      onDone?.();
      return;
    }
    el.classList.remove('hidden', 'is-intro', 'is-on');
    el.classList.add('is-reload');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('is-reload');
      onDone?.();
    }, 980);
  },

  tickInventory(dt) {
    const hud = this.el.hud;
    if (!hud || hud.classList.contains('hidden')) return;
    inventoryIcons.tick(dt);
  },

  setCaptionsVisible(on) {
    const el = this.el['caption-stack'];
    if (el) el.classList.toggle('hidden', !on);
  },

  playFlashDraw(kind, onClick) {
    const el = document.getElementById('flash-hand');
    if (!el) { onClick?.(); return; }
    el.classList.remove('is-intro', 'is-on', 'hidden');
    if (kind === 'off') {
      el.classList.add('hidden');
      return;
    }
    const cls = kind === 'intro' ? 'is-intro' : 'is-on';
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(this._flashTimer);
    const ms = kind === 'intro' ? 980 : 420;
    this._flashTimer = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove(cls);
      onClick?.();
    }, ms);
  },
  fxBloom(kind = 'good') {
    const el = document.getElementById('fx-bloom');
    if (!el) return;
    el.className = `is-firing is-${kind}`;
    clearTimeout(this._bloomTimer);
    this._bloomTimer = setTimeout(() => {
      el.className = '';
    }, kind === 'win' ? 900 : 520);
  },

  flashDamage() {
    const el = this.el['damage-flash'];
    el.classList.add('is-hit');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.remove('is-hit'));
    });
  },

  /** AAA-style directional damage wedge around the crosshair. */
  flashDirectionalDamage(sector) {
    const root = document.getElementById('damage-indicator');
    if (root) {
      const wedge = root.querySelector(`[data-sector="${sector}"]`);
      if (wedge) {
        wedge.classList.remove('is-hit');
        void wedge.offsetWidth;
        wedge.classList.add('is-hit');
        setTimeout(() => wedge.classList.remove('is-hit'), 460);
      }
    }
    const el = this.el['damage-flash'];
    if (el) {
      el.classList.add('is-hit');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.remove('is-hit'));
      });
    }
  },

  // ------------------------------------------------------------------ toasts

  toast(message, kind = '', duration = 2600) {
    const el = document.createElement('div');
    el.className = `toast${kind ? ` ${kind}` : ''}`;
    el.textContent = '';
    this.el['toast-stack'].appendChild(el);
    typeInto(el, message, { cps: 28 });
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

  showGameOver({ title, flavor, stats, tip, readout }) {
    this.el['over-title'].textContent = title;
    this.el['over-flavor'].textContent = flavor;
    this.el['over-stats'].innerHTML = this._statsHtml(stats);
    this.el['over-tip'].textContent = tip || '';
    const screen = document.getElementById('screen-over');
    screen?.classList.remove('is-live');
    this.showScreen('screen-over');
    const pre = document.getElementById('over-readout');
    const lines = readout || [];
    if (!pre) return;
    if (settings.get('reduceMotion')) {
      pre.textContent = lines.join('\n');
      screen?.classList.add('is-live');
      return;
    }
    this._typeOver(pre, lines, () => {
      screen?.classList.add('is-live');
      this._printLivePanel(screen);
    });
  },

  finishOverReadout() {
    if (!this._overToken) return;
    this._overToken.skip = true;
  },

  _typeOver(el, lines, done) {
    const token = { skip: false };
    this._overToken = token;
    el.textContent = '';
    const step = () => {
      if (token.skip) {
        el.textContent = lines.join('\n');
        this._overToken = null;
        done?.();
        return;
      }
    };
    (async () => {
      let text = '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let c = 0; c < line.length; c++) {
          if (token.skip) { step(); return; }
          text += line[c];
          el.textContent = text;
          await new Promise((r) => setTimeout(r, 16));
        }
        text += '\n';
        el.textContent = text;
        if (token.skip) { step(); return; }
        await new Promise((r) => setTimeout(r, line.trim() ? 40 : 20));
      }
      if (this._overToken === token) {
        this._overToken = null;
        done?.();
      }
    })();
  },

  _printLivePanel(screen) {
    const panel = screen?.querySelector('.hs-panel:not(.hidden)');
    if (!panel) return;
    this._stopScore?.();
    this._stopScore = printTree(panel, { cps: 18 });
  },

  showVictory({ flavor, stats, report }) {
    if (flavor) this.el['win-flavor'].textContent = flavor;
    this.el['win-stats'].innerHTML = this._statsHtml(stats);
    this.el['win-report'].innerHTML = `
      <h4>MISSION DEBRIEF</h4>
      <ul>${report.map((r) => `<li>${r}</li>`).join('')}</ul>`;
    this.showScreen('screen-win');
    this._stopWin?.();
    this._stopWin = printTree(document.querySelector('#screen-win .screen-inner'), { cps: 18 });
  },
};
