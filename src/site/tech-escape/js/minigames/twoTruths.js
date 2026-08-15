/**
 * Two Truths & a Lie — delivered as a smartphone notification overlay.
 *
 * Same earned-reveal Study Guide rules as the Chromebook terminals: miss it and
 * the card shows what you picked; the explanation unlocks only after you get it
 * right on a later run.
 */

import { audio } from '../audio.js';
import { settings } from '../meta/settings.js';

const $ = (id) => document.getElementById(id);

export class TwoTruths {
  constructor() {
    this.open = false;
    this.el = {
      screen: $('screen-notify'),
      phone: $('notify-phone'),
      sender: $('notify-sender'),
      time: $('notify-time'),
      preview: $('notify-preview'),
      choices: $('notify-choices'),
      feedback: $('notify-feedback'),
      explain: $('notify-explain'),
      dismiss: $('notify-dismiss'),
      live: $('notify-live'),
    };
    this.hooks = null;
    this.item = null;
    this.picked = -1;
    this.locked = false;
  }

  /**
   * @param {object} item from twoTruths.js
   * @param {{onAnswer:Function, onComplete:Function}} hooks
   */
  start(item, hooks) {
    this.item = item;
    this.hooks = hooks;
    this.open = true;
    this.picked = -1;
    this.locked = false;
    this.el.screen?.classList.remove('hidden');
    this._render();
    audio.uiClick();
    window.addEventListener('keydown', this._onKey, true);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.screen?.classList.add('hidden');
    window.removeEventListener('keydown', this._onKey, true);
  }

  _onKey = (e) => {
    if (!this.open || this.locked) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 3) {
      e.preventDefault();
      this._pick(n - 1);
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      this._finish(false);
    }
  };

  _render() {
    const it = this.item;
    const now = new Date();
    const hh = now.getHours();
    const mm = String(now.getMinutes()).padStart(2, '0');
    const am = hh >= 12 ? 'PM' : 'AM';
    const h12 = ((hh + 11) % 12) + 1;

    if (this.el.sender) this.el.sender.textContent = it.sender;
    if (this.el.time) this.el.time.textContent = `${h12}:${mm} ${am}`;
    if (this.el.preview) {
      this.el.preview.textContent = `${it.preview} Which one is the LIE? Tap it.`;
    }
    if (this.el.feedback) {
      this.el.feedback.textContent = '';
      this.el.feedback.className = 'notify-feedback';
    }
    if (this.el.explain) this.el.explain.textContent = '';
    if (this.el.dismiss) this.el.dismiss.classList.add('hidden');

    const host = this.el.choices;
    if (!host) return;
    host.innerHTML = '';
    it.statements.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'notify-choice';
      btn.dataset.index = String(i);
      btn.innerHTML = `<span class="notify-bubble">${text}</span>`;
      btn.addEventListener('click', () => this._pick(i));
      host.appendChild(btn);
    });

    if (this.el.live) {
      this.el.live.textContent = settings.get('difficulty') === 'nightmare'
        ? 'The lab is still moving while you read this.'
        : 'The lab is holding still while you answer.';
    }
  }

  _pick(index) {
    if (this.locked || !this.item) return;
    this.picked = index;
    this.locked = true;
    const it = this.item;
    const right = index === it.lieIndex;
    const chosen = it.statements[index];

    [...this.el.choices.children].forEach((btn, i) => {
      btn.disabled = true;
      btn.classList.toggle('is-lie', i === it.lieIndex);
      btn.classList.toggle('is-pick', i === index);
      btn.classList.toggle('is-wrong', i === index && !right);
    });

    if (this.el.feedback) {
      this.el.feedback.textContent = right
        ? 'You spotted the lie.'
        : 'That one sounded believable — but it is the lie.';
      this.el.feedback.className = `notify-feedback ${right ? 'is-good' : 'is-bad'}`;
    }
    if (this.el.explain) this.el.explain.textContent = it.why;

    audio.uiClick();
    this.hooks?.onAnswer?.(right, it, [chosen]);

    if (right) {
      this.el.dismiss?.classList.remove('hidden');
      this.el.dismiss?.focus();
    } else {
      setTimeout(() => {
        this.locked = false;
        this.picked = -1;
        this._render();
      }, settings.get('reduceMotion') ? 800 : 1400);
    }
  }

  _finish(passed) {
    this.hooks?.onComplete?.(passed);
    this.close();
  }

  bindDismiss() {
    this.el.dismiss?.addEventListener('click', () => {
      audio.uiClick();
      this._finish(true);
    });
  }
}
