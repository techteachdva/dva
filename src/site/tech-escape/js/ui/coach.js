/**
 * First-night lesson. One line at a time, in the lab, cleared by doing the
 * verb. It is not a manual and it does not pause the maze. The pause menu
 * can skip it. Once finished it stays finished on this computer.
 */

import { settings } from '../meta/settings.js';
import { ui } from '../ui.js?v=3.8';

const STEPS = [
  {
    text: 'WASD walks. The mouse looks. Four glowing Chromebooks hold the code.',
    done: (_w, moved) => moved > 2.4,
    max: 14,
  },
  {
    text: 'Press C to crouch. Desks with glowing tape are hiding places. Hunters cannot crawl under them.',
    done: (w) => w.player.crouching || w.player.hidden,
    max: 16,
  },
  {
    text: 'Press F for the flashlight. The beam burns viruses. It also calls the mice. Right-click eats a snack.',
    done: (w) => w.player.flashlightOn || w.player.stats.flashlightSec > 0.15,
    max: 16,
  },
  {
    text: 'Press E on a Chromebook. Answer, then match the pairs. A wrong answer is loud.',
    done: (w) => w.questionsAsked > 0,
    max: 20,
  },
];

function card() { return document.getElementById('coach-card'); }
function label() { return document.getElementById('coach-text'); }

export const coach = {
  _i: 0,
  _t: 0,
  _moved: 0,
  _on: false,
  _arrowTold: false,

  init() {
    document.getElementById('btn-skip-coach')?.addEventListener('click', () => {
      this.skip();
    });
  },

  beginRun() {
    this._i = 0;
    this._t = 0;
    this._moved = 0;
    this._arrowTold = false;
    this._on = !settings.get('coachDone');
    this._render();
  },

  update(world, dt, moved) {
    if (!this._on) return;
    this._moved += moved || 0;
    const step = STEPS[this._i];
    if (!step) {
      this._finish();
      return;
    }
    this._t += dt;
    if (step.done(world, this._moved) || this._t >= step.max) {
      this._i += 1;
      this._t = 0;
      if (this._i >= STEPS.length) this._finish();
      else this._render();
    }
  },

  arrowsWoke() {
    if (this._arrowTold) return;
    this._arrowTold = true;
    ui.toast(
      'Floor arrows woke up. Follow them to the nearest Chromebook.',
      'good',
      4600,
    );
  },

  skip() {
    this._finish();
  },

  _render() {
    const el = card();
    const text = label();
    const step = STEPS[this._i];
    if (!el || !text || !step) return;
    text.textContent = step.text;
    el.classList.remove('hidden');
    const skip = document.getElementById('btn-skip-coach');
    if (skip) skip.classList.remove('hidden');
  },

  _finish() {
    this._on = false;
    settings.set('coachDone', true);
    card()?.classList.add('hidden');
    document.getElementById('btn-skip-coach')?.classList.add('hidden');
  },
};
