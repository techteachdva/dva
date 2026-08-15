/**
 * Pause-menu control rebinding UI.
 */

import { BIND_DEFAULTS, BIND_LABELS, bindDisplay, normalizeBinds, validateBinds } from './binds.js';
import { settings } from './settings.js';
import { input } from '../input.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);

export const bindUi = {
  _listening: null,

  init() {
    $('btn-bind-reset')?.addEventListener('click', () => {
      audio.uiClick();
      settings.set('binds', { ...BIND_DEFAULTS });
      input.applyBinds(settings.get('binds'));
      this.render();
    });

    window.addEventListener('keydown', (e) => {
      if (!this._listening) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        this._listening = null;
        this.render();
        return;
      }
      if (['Tab'].includes(e.code)) return;

      const binds = normalizeBinds(settings.get('binds'));
      for (const [action, code] of Object.entries(binds)) {
        if (action !== this._listening && code === e.code) {
          delete binds[action];
        }
      }
      binds[this._listening] = e.code;
      const valid = validateBinds(binds);
      if (!valid) {
        audio.deny();
        return;
      }
      settings.set('binds', valid);
      input.applyBinds(valid);
      this._listening = null;
      audio.uiClick();
      this.render();
    }, true);

    settings.onChange((k) => {
      if (k === 'binds') this.render();
    });

    this.render();
  },

  render() {
    const host = $('bind-list');
    if (!host) return;
    const binds = normalizeBinds(settings.get('binds'));
    host.innerHTML = Object.keys(BIND_DEFAULTS).map((action) => {
      const listening = this._listening === action;
      return `
        <button type="button" class="bind-row${listening ? ' is-listening' : ''}"
                data-action="${action}">
          <span class="bind-name">${BIND_LABELS[action]}</span>
          <span class="bind-key">${listening ? 'Press a key…' : bindDisplay(binds[action])}</span>
        </button>`;
    }).join('');

    host.querySelectorAll('.bind-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.uiClick();
        this._listening = btn.dataset.action;
        this.render();
      });
    });
  },
};
