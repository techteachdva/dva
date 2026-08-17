/**
 * Three-page controls guide — full detail lives here, not on the title screen or
 * over gameplay. Open from Settings or "How to Play" on the lobby.
 */

import { bindDisplay, normalizeBinds } from '../meta/binds.js';
import { settings } from '../meta/settings.js';
import { audio } from '../audio.js';
import { ui } from '../ui.js';

const $ = (id) => document.getElementById(id);

function row(key, text) {
  return `<li><span class="key">${key}</span> ${text}</li>`;
}

function buildPages() {
  const b = normalizeBinds(settings.get('binds'));
  const i = bindDisplay(b.interact);
  const t = bindDisplay(b.throw);
  const e = bindDisplay(b.eatCheetos);
  const l = bindDisplay(b.light);
  const c = bindDisplay(b.crouch);
  const q = bindDisplay(b.cycleItem);

  return [
    {
      title: 'Move & look',
      lead: 'You are in first-person. Get comfortable before the mice show up.',
      body: `
        <ul class="tutorial-list">
          ${row('W A S D', 'Walk forward, left, back, and right')}
          ${row('Mouse', 'Look around (pointer lock on desktop)')}
          ${row('Arrow keys', 'Turn and look up/down (keyboard-only mode)')}
          ${row('Shift', 'Sprint toggle — loud, drains stamina')}
          ${row('Space', 'Climb onto a nearby desk (exposed, better view)')}
          ${row(c, 'Crouch / crawl under desks')}
        </ul>
        <p class="tutorial-tip"><strong>Touch:</strong> drag the right side to look, virtual stick to move,
          on-screen buttons for use, throw, eat, light, run, and crouch.</p>`,
    },
    {
      title: 'Use & carry',
      lead: 'Loot stays in your bag until you choose to eat it or throw it.',
      body: `
        <ul class="tutorial-list">
          ${row(`${i} / L-Click`, 'Use Chromebooks, doors, printer, and pickups')}
          ${row(`${t} / L-Click`, 'Throw selected item (disc at viruses, cheetos at mice)')}
          ${row(`${e} / R-Click`, 'Eat hot cheetos or drink soda')}
          ${row(q, 'Cycle inventory')}
          ${row('Scroll', 'Cycle inventory (mouse)')}
          ${row(l, 'Flashlight on/off')}
          ${row('P / Esc', 'Pause and open Settings')}
        </ul>
        <p class="tutorial-tip"><strong>Mouse scheme:</strong> hold <span class="key">R</span> to walk forward,
          <span class="key">L</span> backward, <span class="key">L+R</span> sprint forward,
          middle-click + move to strafe.</p>`,
    },
    {
      title: 'Survive & escape',
      lead: 'Four glowing Chromebooks, four code pieces, one printed key, one exit.',
      body: `
        <ul class="tutorial-list">
          <li><strong>Loot:</strong> snacks and batteries hide under desks or on nearby chairs — crawl in, grab, sneak out.</li>
          <li><strong>Hide:</strong> crouch under a desk with glowing tape — hunters cannot reach you.</li>
          <li><strong>Climb:</strong> Space at a desk edge lifts you on top for a wider view — enemies can see you.</li>
          <li><strong>Flashlight:</strong> hold on a <em>virus</em> to glitch it away (drains battery, attracts mice).</li>
          <li><strong>Cheetos:</strong> eat for snack energy, or throw — mice munch and pop (3 per bag).</li>
          <li><strong>Disc:</strong> rare; aim at a virus to delete it permanently.</li>
          <li><strong>Flow:</strong> clear 4 terminals → decrypt fragments → print key → use key on EXIT door.</li>
        </ul>
        <p class="tutorial-tip">Wrong quiz answers and loud actions wake the lab. Crawl under desks for loot and cover.</p>`,
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
    if (settings.get('seenTutorial')) return;
    if (!settings.get('seenFirstRun')) return;
    setTimeout(() => this.open('screen-title'), 420);
  },
};
