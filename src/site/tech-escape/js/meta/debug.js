/**
 * Teacher / developer playtest cheats. Unlocked with code PLAYTEST in pause menu.
 * Persists on device so you do not re-type every session.
 */

const STORAGE_KEY = 'techescape.debug.v1';
export const DEBUG_CODE = 'PLAYTEST';

export const debug = {
  enabled: false,

  init() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      this.enabled = false;
    }
  },

  tryUnlock(raw) {
    const ok = String(raw ?? '').trim().toUpperCase() === DEBUG_CODE;
    if (!ok) return false;
    this.enabled = true;
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
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
    if (status) {
      status.textContent = this.enabled
        ? 'Cheats on — also use keys 1–6 while playing.'
        : '';
    }
  },
};
