/**
 * High score entry after win/loss and title-screen leaderboard.
 */

import { audio } from '../audio.js';
import { ui } from '../ui.js';
import { formatTime } from '../util.js';
import { saveStore } from './save.js';
import {
  fetchHighScores,
  submitHighScore,
  validateScoreName,
  splitNameHint,
} from './highscores.js';

const $ = (id) => document.getElementById(id);

function endSuffix() {
  const win = document.getElementById('screen-win');
  return win && !win.classList.contains('hidden') ? '-win' : '';
}

function endEl(base) {
  return $(`${base}${endSuffix()}`);
}

export const highscoresUi = {
  _bound: false,
  _pending: null,
  _submitted: false,

  init() {
    if (this._bound) return;
    this._bound = true;

    $('btn-high-scores')?.addEventListener('click', () => {
      audio.uiClick();
      this.openTitleScreen();
    });
    $('btn-hs-back')?.addEventListener('click', () => {
      audio.uiClick();
      ui.showScreen('screen-title');
    });

    const bindEnd = (suffix) => {
      $(`hs-submit${suffix}`)?.addEventListener('click', () => this._submitPending());
      $(`hs-skip${suffix}`)?.addEventListener('click', () => {
        audio.uiClick();
        this._hideEndPanel();
      });
    };
    bindEnd('');
    bindEnd('-win');
  },

  /** Show score breakdown + name form on win/over screens. */
  presentEndScreen(scoreResult) {
    this._pending = scoreResult;
    this._submitted = false;

    const suffix = endSuffix();
    const panel = endEl('hs-end-panel');
    if (!panel) return;

    const hint = splitNameHint(saveStore.active?.name);
    const firstEl = endEl('hs-first');
    const lastEl = endEl('hs-last');
    if (firstEl) firstEl.value = hint.first;
    if (lastEl) lastEl.value = hint.last;

    const scoreEl = endEl('hs-score-value');
    if (scoreEl) scoreEl.textContent = String(scoreResult.score);

    const breakdownEl = endEl('hs-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = scoreResult.lines
        .map((line) => `<li>${line}</li>`)
        .join('');
    }

    const statusEl = endEl('hs-status');
    if (statusEl) statusEl.textContent = '';
    const submitBtn = endEl('hs-submit');
    if (submitBtn) submitBtn.disabled = false;

    document.getElementById('hs-end-panel')?.classList.add('hidden');
    document.getElementById('hs-end-panel-win')?.classList.add('hidden');
    panel.classList.remove('hidden');
  },

  resetEndScreen() {
    this._pending = null;
    this._submitted = false;
    this._hideEndPanel();
  },

  _hideEndPanel() {
    document.getElementById('hs-end-panel')?.classList.add('hidden');
    document.getElementById('hs-end-panel-win')?.classList.add('hidden');
    const statusEl = endEl('hs-status');
    if (statusEl) statusEl.textContent = '';
  },

  async _submitPending() {
    if (!this._pending || this._submitted) return;

    const first = endEl('hs-first')?.value ?? '';
    const last = endEl('hs-last')?.value ?? '';
    const valid = validateScoreName(first, last);
    if (!valid.ok) {
      audio.deny();
      const statusEl = endEl('hs-status');
      if (statusEl) statusEl.textContent = valid.message;
      return;
    }

    const submitBtn = endEl('hs-submit');
    if (submitBtn) submitBtn.disabled = true;
    const statusEl = endEl('hs-status');
    if (statusEl) statusEl.textContent = 'Posting score…';

    try {
      const data = await submitHighScore({
        name: valid.name,
        score: this._pending.score,
        escaped: this._pending.escaped,
        seconds: this._pending.seconds,
        floor: this._pending.floor,
        difficulty: this._pending.difficulty,
        breakdown: this._pending.breakdown,
      });
      this._submitted = true;
      audio.correct();

      if (data.inTop && data.rank) {
        statusEl.textContent = `Posted! You rank #${data.rank} on the board.`;
      } else {
        statusEl.textContent = 'Score posted. Keep practicing to climb the top 100!';
      }
    } catch (err) {
      audio.deny();
      if (submitBtn) submitBtn.disabled = false;
      statusEl.textContent = err.message || 'Could not post score. Try again later.';
    }
  },

  async openTitleScreen() {
    ui.showScreen('screen-highscores');
    const listEl = $('hs-list');
    const noteEl = $('hs-board-note');
    if (!listEl) return;

    listEl.innerHTML = '<li class="hs-loading">Loading scores…</li>';
    if (noteEl) noteEl.textContent = '';

    try {
      const { scores, setupRequired, error } = await fetchHighScores();
      if (setupRequired) {
        listEl.innerHTML = '';
        if (noteEl) {
          noteEl.textContent = 'Leaderboard not configured yet. See google-apps-script/tech-escape-highscores-backend.gs';
        }
        return;
      }
      if (error && !scores.length) {
        listEl.innerHTML = '';
        if (noteEl) noteEl.textContent = error;
        return;
      }
      if (!scores.length) {
        listEl.innerHTML = '<li class="hs-empty">No scores yet — be the first!</li>';
        return;
      }
      listEl.innerHTML = scores.map((s) => `
        <li class="hs-row">
          <span class="hs-rank">#${s.rank}</span>
          <span class="hs-name">${escapeHtml(s.name)}</span>
          <span class="hs-meta">${escapeHtml(s.floor)} · ${escapeHtml(s.difficulty)} · ${formatTime(s.seconds)}</span>
          <span class="hs-pts">${s.score}</span>
          ${s.escaped ? '<span class="hs-badge">ESC</span>' : ''}
        </li>`).join('');
    } catch (err) {
      listEl.innerHTML = '';
      if (noteEl) noteEl.textContent = err.message || 'Could not load scores.';
    }
  },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
