/**
 * Profile picker, Study Guide, level select, and settings UI for Tech Escape 2.2.
 * Keeps DOM wiring out of main.js so the game loop stays readable.
 */

import { settings } from './settings.js';
import { saveStore } from './save.js';
import { LEVELS, LEVEL_COUNT } from './levels.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { ui } from '../ui.js';

const $ = (id) => document.getElementById(id);

/** Maps slider 25-300 to settings sensitivity multiplier. */
function sensFromSlider(v) {
  return Math.max(0.25, Math.min(3, Number(v) / 100));
}

function sliderFromSens(v) {
  return Math.round(Math.max(0.25, Math.min(3, v)) * 100);
}

export const sessionUi = {
  game: null,
  _returnFromGuide: 'screen-title',

  bind(game) {
    this.game = game;
    this._bindFirstRun();
    this._bindProfile();
    this._bindGuide();
    this._bindTitleExtras();
    this._bindSettingsPanel();
  },

  /** After boot sequence: first-run → profile → title. */
  async enterLobby() {
    if (!settings.get('seenFirstRun')) {
      this._syncFirstRunForm();
      ui.showScreen('screen-firstrun');
      return;
    }
    await this._enterProfileOrTitle();
  },

  async _enterProfileOrTitle() {
    const last = saveStore.lastPlayerId;
    if (last && last !== 'guest') {
      const p = saveStore.selectProfile(last);
      if (p) {
        this._showTitle();
        return;
      }
    }
    if (saveStore.listProfiles().length === 0) {
      ui.showScreen('screen-profile');
      this.renderProfileList();
      return;
    }
    ui.showScreen('screen-profile');
    this.renderProfileList();
  },

  _showTitle() {
    const g = this.game;
    g.mode = 'title';
    const p = saveStore.active;
    ui.showScreen('screen-title');
    ui.setPerfNote(
      `${p ? `${p.name} — ` : ''}${LEVEL_COUNT} floors — renderer: ${g._rendererName}`,
    );
    this.renderTitleGreeting();
    this.renderLevelSelect();
    this._syncSettingsForm();
    audio.init();
    audio.stopAmbience();
    audio.startTitleMusic();
    tutorial.maybeShowOnLobby();
  },

  renderTitleGreeting() {
    const el = $('title-player');
    const p = saveStore.active;
    if (el) {
      el.textContent = p ? (p.isGuest ? 'Playing as GUEST (no save)' : `Playing as ${p.name}`) : '';
    }
  },

  renderProfileList() {
    const host = $('profile-list');
    if (!host) return;
    const rows = saveStore.listProfiles();
    if (!rows.length) {
      host.innerHTML = '<p class="story dim">No saved names yet. Create one below.</p>';
      return;
    }
    host.innerHTML = rows.map((r) => `
      <button type="button" class="profile-row" data-id="${r.id}">
        <span class="profile-name">${r.name}</span>
        <span class="profile-meta">${r.collected} in guide · ${r.escapes} escapes · floor ${r.levelsUnlocked}</span>
      </button>`).join('');
    host.querySelectorAll('.profile-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.uiClick();
        saveStore.selectProfile(btn.dataset.id);
        this._showTitle();
      });
    });
  },

  renderLevelSelect() {
    const host = $('level-select');
    if (!host) return;
    const prog = saveStore.active;
    const selected = this.game?.levelIndex ?? 0;

    host.innerHTML = LEVELS.map((lv, i) => {
      const open = !prog || prog.levelUnlocked(i);
      const sel = i === selected;
      const best = prog?.data?.levelBest?.[lv.id];
      const bestTxt = best ? `Best ${Math.floor(best.time / 60)}:${String(best.time % 60).padStart(2, '0')}` : '';
      return `
        <button type="button" class="level-card${open ? '' : ' is-locked'}${sel ? ' is-selected' : ''}"
                data-level="${i}" ${open ? '' : 'disabled'} role="radio" aria-checked="${sel}">
          <span class="level-code">${lv.codename}</span>
          <span class="level-name">${lv.name}</span>
          <span class="level-blurb">${open ? lv.threat : 'Escape the previous floor to unlock'}</span>
          ${bestTxt ? `<span class="level-best">${bestTxt}</span>` : ''}
        </button>`;
    }).join('');

    host.querySelectorAll('.level-card:not(.is-locked)').forEach((btn) => {
      btn.addEventListener('click', () => {
        audio.uiClick();
        this.game.levelIndex = Number(btn.dataset.level);
        host.querySelectorAll('.level-card').forEach((b) => {
          b.classList.toggle('is-selected', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
      });
    });
  },

  renderStudyGuide() {
    const prog = saveStore.active;
    if (!prog) return;
    const sum = $('guide-summary');
    if (sum) {
      sum.innerHTML = `
        <div class="guide-stat"><span>Collected</span><strong>${prog.collected}</strong></div>
        <div class="guide-stat"><span>Mastered</span><strong>${prog.mastered}</strong></div>
        <div class="guide-stat"><span>Still locked</span><strong>${prog.locked}</strong></div>`;
    }
    const body = $('guide-body');
    if (!body) return;
    const groups = prog.guideByTopic();
    body.innerHTML = groups.filter((g) => g.items.length).map((g) => `
      <section class="guide-topic">
        <h3>${g.name} <span class="guide-topic-sub">${g.topic}</span></h3>
        ${g.items.map((it) => this._guideCard(it)).join('')}
      </section>`).join('')
      || '<p class="story dim">Answer Chromebook quizzes and clear SEL text notifications to fill your guide.</p>';
  },

  _guideCard(it) {
    const state = it.revealed ? 'is-mastered' : 'is-locked';
    const pickTag = it.twoTruths ? 'You called this the lie' : 'You picked';
    const opts = it.options
      ? it.options.map((o) => `
          <li class="${o.correct && it.revealed ? (it.twoTruths ? 'is-lie' : 'is-correct') : ''}${it.picked && it.picked.includes(o.text) ? ' is-picked' : ''}">
            ${o.text}${o.correct && it.revealed ? (it.twoTruths ? ' ← lie' : ' ✓') : ''}
          </li>`).join('')
      : '';
    return `
      <article class="guide-card ${state}">
        <div class="guide-card-head">
          <span class="gchip ${state}">${it.revealed ? 'MASTERED' : 'LOCKED'}</span>
          ${it.std ? `<span class="guide-std">${it.std}</span>` : ''}
        </div>
        <p class="guide-q">${it.text}</p>
        ${it.picked && !it.revealed ? `<p class="guide-picked">${pickTag}: <em>${it.picked}</em></p>` : ''}
        ${opts ? `<ul class="guide-opts${it.twoTruths ? ' is-twotruths' : ''}">${opts}</ul>` : ''}
        ${it.revealed && it.why ? `<p class="guide-why">${it.why}</p>` : ''}
        ${!it.revealed ? '<p class="guide-hint">Answer this prompt correctly on a later run to unlock the explanation.</p>' : ''}
      </article>`;
  },

  _syncFirstRunForm() {
    $('fr-motion').checked = settings.get('reduceMotion');
    $('fr-flash').checked = settings.get('reduceFlashing');
    $('fr-captions').checked = settings.get('soundCaptions');
    const s = sliderFromSens(settings.get('sensitivity'));
    $('fr-sens').value = s;
    $('fr-sens-out').textContent = `${(s / 100).toFixed(2)}x`;
  },

  _syncSettingsForm() {
    const v = settings.values;
    const set = (id, val) => { const el = $(id); if (el) el.value = val; };
    const chk = (id, val) => { const el = $(id); if (el) el.checked = !!val; };

    chk('set-motion', v.reduceMotion);
    chk('set-flash', v.reduceFlashing);
    chk('set-captions', v.soundCaptions);
    chk('set-mute', v.muted ?? false);
    chk('set-shake', v.reduceFx ?? false);

    const sens = sliderFromSens(v.sensitivity);
    set('set-sens', sens);
    const out = $('out-sens');
    if (out) out.textContent = `${(sens / 100).toFixed(2)}x`;

    set('set-quality', v.quality || 'medium');
    set('set-bright', v.brightness ?? 130);
    set('set-tension', v.tension || 'standard');

    for (const btn of document.querySelectorAll('.diff-btn')) {
      btn.classList.toggle('is-selected', btn.dataset.diff === (v.difficulty || 'normal'));
    }
    this.game.settings.difficulty = v.difficulty || 'normal';
  },

  _bindFirstRun() {
    $('fr-sens')?.addEventListener('input', (e) => {
      $('fr-sens-out').textContent = `${(Number(e.target.value) / 100).toFixed(2)}x`;
    });
    $('btn-firstrun-done')?.addEventListener('click', () => {
      audio.uiClick();
      settings.set('reduceMotion', $('fr-motion').checked);
      settings.set('reduceFlashing', $('fr-flash').checked);
      settings.set('soundCaptions', $('fr-captions').checked);
      settings.set('subtitles', $('fr-captions').checked);
      settings.set('sensitivity', sensFromSlider($('fr-sens').value));
      settings.set('sensitivityTrackpad', sensFromSlider($('fr-sens').value));
      settings.set('seenFirstRun', true);
      this.game._applySettings();
      this._enterProfileOrTitle();
    });
  },

  _bindProfile() {
    $('btn-profile-create')?.addEventListener('click', () => {
      audio.uiClick();
      const name = $('profile-name')?.value || '';
      const res = saveStore.createProfile(name);
      if (!res.ok) {
        ui.toast(res.message, 'warn', 3200);
        return;
      }
      $('profile-name').value = '';
      this._showTitle();
    });
    $('profile-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('btn-profile-create')?.click();
    });
    $('btn-profile-guest')?.addEventListener('click', () => {
      audio.uiClick();
      saveStore.useGuest();
      this._showTitle();
    });
    $('btn-switch-player')?.addEventListener('click', () => {
      audio.uiClick();
      ui.showScreen('screen-profile');
      this.renderProfileList();
    });
  },

  _bindGuide() {
    $('btn-guide')?.addEventListener('click', () => {
      audio.uiClick();
      this._returnFromGuide = 'screen-title';
      this.renderStudyGuide();
      ui.showScreen('screen-guide');
    });
    $('btn-guide-back')?.addEventListener('click', () => {
      audio.uiClick();
      ui.showScreen(this._returnFromGuide);
    });
    $('btn-guide-print')?.addEventListener('click', () => window.print());
  },

  _bindTitleExtras() {
    for (const btn of document.querySelectorAll('.diff-btn')) {
      btn.addEventListener('click', () => {
        settings.set('difficulty', btn.dataset.diff);
        this.game.settings.difficulty = btn.dataset.diff;
        for (const b of document.querySelectorAll('.diff-btn')) {
          b.classList.toggle('is-selected', b === btn);
        }
      });
    }
    $('set-tension')?.addEventListener('change', (e) => {
      settings.set('tension', e.target.value);
    });
  },

  _bindSettingsPanel() {
    $('set-motion')?.addEventListener('change', (e) => settings.set('reduceMotion', e.target.checked));
    $('set-flash')?.addEventListener('change', (e) => settings.set('reduceFlashing', e.target.checked));
    $('set-captions')?.addEventListener('change', (e) => {
      settings.set('soundCaptions', e.target.checked);
      settings.set('subtitles', e.target.checked);
    });

    $('set-sens')?.addEventListener('input', (e) => {
      const mult = sensFromSlider(e.target.value);
      settings.set('sensitivity', mult);
      settings.set('sensitivityTrackpad', mult);
      const out = $('out-sens');
      if (out) out.textContent = `${mult.toFixed(2)}x`;
      input.sensitivity = Math.round(mult * 100);
    });

    $('set-quality')?.addEventListener('change', (e) => {
      this.game.settings.quality = e.target.value;
      settings.set('quality', e.target.value);
      this.game._applySettings();
      ui.toast('Graphics quality changed. Restart a run for full effect.', 'warn');
    });

    $('set-bright')?.addEventListener('input', (e) => {
      this.game.settings.brightness = Number(e.target.value);
      settings.set('brightness', Number(e.target.value));
      if (this.game.world) this.game.world.lighting.setBrightness(this.game.settings.brightness / 100);
      $('out-bright').textContent = `${e.target.value}%`;
    });

    $('set-mute')?.addEventListener('change', (e) => {
      this.game.settings.muted = e.target.checked;
      settings.set('muted', e.target.checked);
      audio.setMuted(e.target.checked);
    });

    $('set-shake')?.addEventListener('change', (e) => {
      this.game.settings.reduceFx = e.target.checked;
      document.body.classList.toggle('reduce-fx', e.target.checked);
      if (this.game.world) this.game.world.player.reduceFx = e.target.checked;
    });
  },
};
