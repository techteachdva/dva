/**
 * Three-page controls guide — full detail lives here, not on the title screen or
 * over gameplay. Open from Settings or "How to Play" on the lobby.
 */

import { settings } from '../meta/settings.js?v=3.21';
import { audio } from '../audio.js';
import { ui } from '../ui.js?v=3.26';
import { renderControlsKeyboard } from './keyboard-card.js?v=3.25';

const $ = (id) => document.getElementById(id);

function buildPages() {
  return [
    {
      title: '',
      lead: '',
      body: renderControlsKeyboard(settings.get('binds')),
    },
  ];
}

export const tutorial = {
  page: 0,
  _return: 'screen-title',

  init() {
    $('btn-tutorial-prev')?.addEventListener('click', () => this.prev());
    $('btn-tutorial-next')?.addEventListener('click', () => this.next());
    $('btn-tutorial-done')?.addEventListener('click', () => this.close());
    $('btn-how-to-play')?.addEventListener('click', () => {
      audio.uiClick();
      this.open('screen-title');
    });
    $('btn-open-tutorial')?.addEventListener('click', () => {
      audio.uiClick();
      this.open('screen-pause');
    });
  },

  open(fromScreen) {
    this._return = fromScreen || 'screen-title';
    this.page = 0;
    this.render();
    ui.showScreen('screen-tutorial');
  },

  close() {
    audio.uiClick();
    settings.set('seenTutorial', true);
    ui.showScreen(this._return);
  },

  prev() {
    if (this.page <= 0) return;
    audio.uiClick();
    this.page -= 1;
    this.render();
  },

  next() {
    if (this.page >= buildPages().length - 1) return;
    audio.uiClick();
    this.page += 1;
    this.render();
  },

  render() {
    const pages = buildPages();
    const p = pages[this.page];
    const title = $('tutorial-title');
    const lead = $('tutorial-lead');
    const body = $('tutorial-body');
    const dots = $('tutorial-dots');
    const prev = $('btn-tutorial-prev');
    const next = $('btn-tutorial-next');
    const done = $('btn-tutorial-done');

    if (title) title.textContent = p.title;
    if (lead) lead.textContent = p.lead;
    if (body) body.innerHTML = p.body;

    if (dots) {
      dots.innerHTML = pages.map((_, i) =>
        `<span class="tutorial-dot${i === this.page ? ' is-active' : ''}" aria-hidden="true"></span>`,
      ).join('');
      dots.setAttribute('aria-label', `Page ${this.page + 1} of ${pages.length}`);
    }

    const last = this.page >= pages.length - 1;
    if (prev) prev.disabled = this.page === 0;
    if (next) next.classList.toggle('hidden', last);
    if (done) done.classList.toggle('hidden', !last);
  },

  maybeShowOnLobby() {
    // The lesson plays inside the lab. Popping this manual over the lobby
    // was the screen people closed without reading, then walked in lost.
  },
};
