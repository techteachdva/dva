/**
 * Teacher / developer playtest cheats. Unlocked with code PLAYTEST in pause menu.
 */

const STORAGE_KEY = 'techescape.debug.v1';
const FLAGS_KEY = 'techescape.debug.flags.v1';
export const DEBUG_CODE = 'PLAYTEST';
export const FULL_BRIGHT_MULT = 2.65;

export const debug = {
  enabled: false,
  fullBright: true,
  invincible: true,
  skipMinigames: true,

  init() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) === '1';
      const flags = JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}');
      this.fullBright = flags.fullBright ?? true;
      this.invincible = flags.invincible ?? true;
      this.skipMinigames = flags.skipMinigames ?? true;
    } catch (e) {
      this.enabled = false;
    }
  },

  _saveFlags() {
    try {
      localStorage.setItem(FLAGS_KEY, JSON.stringify({
        fullBright: this.fullBright,
        invincible: this.invincible,
        skipMinigames: this.skipMinigames,
      }));
    } catch (e) { /* ignore */ }
  },

  tryUnlock(raw) {
    const ok = String(raw ?? '').trim().toUpperCase() === DEBUG_CODE;
    if (!ok) return false;
    this.enabled = true;
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
    this._saveFlags();
    return true;
  },

  disable() {
    this.enabled = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  },

  syncPanel() {
    const panel = document.getElementById('debug-panel');
    const unlock = document.getElementById('debug-unlock');
    const status = document.getElementById('debug-status');
    if (panel) panel.classList.toggle('hidden', !this.enabled);
    if (unlock) unlock.classList.toggle('hidden', this.enabled);

    const setChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };
    setChk('debug-flag-bright', this.fullBright);
    setChk('debug-flag-invuln', this.invincible);
    setChk('debug-flag-skip', this.skipMinigames);

    if (status) {
      status.textContent = this.enabled
        ? 'Cheats on — full bright, invincible, click-through minigames. Keys 1–6 in play.'
        : '';
    }
    this.syncMinigameButtons();
  },

  syncMinigameButtons() {
    const show = this.enabled && this.skipMinigames;
    for (const id of ['debug-skip-quiz', 'debug-skip-decrypt', 'debug-skip-notify']) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    }
  },

  brightnessMultiplier() {
    return (this.enabled && this.fullBright) ? FULL_BRIGHT_MULT : 1;
  },
};
