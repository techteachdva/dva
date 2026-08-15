/**
 * The decryption scramble: a Memory match.
 *
 * Six pairs of glyphs. Every mismatched pair costs a scan, and the code fragment
 * reveals itself one character at a time as pairs come together, so progress is
 * visible even before the puzzle is finished.
 */

import { DECRYPT } from '../config.js';
import { audio } from '../audio.js';
import { shuffle } from '../util.js';

const $ = (id) => document.getElementById(id);

export class Decrypt {
  constructor() {
    this.open = false;
    this.el = {
      screen: $('screen-decrypt'),
      grid: $('dc-grid'),
      pairs: $('dc-pairs'),
      scans: $('dc-scans'),
      fragment: $('dc-fragment'),
      bail: $('dc-bail'),
    };
    this.el.bail.addEventListener('click', () => this._bail());
    this._onKey = this._onKey.bind(this);
  }

  /**
   * @param {string} fragment the 3-character code piece being decrypted
   * @param {number} scans wrong-pair budget
   * @param {{onComplete:Function, onBail:Function, onMiss:Function}} hooks
   */
  start(fragment, scans, hooks) {
    this.fragment = fragment;
    this.scansLeft = scans;
    this.hooks = hooks;
    this.matched = 0;
    this.flipped = [];
    this.busy = false;
    this.open = true;
    this.attempts = 0;

    const glyphs = shuffle(DECRYPT.glyphs).slice(0, DECRYPT.pairs);
    const deck = shuffle([...glyphs, ...glyphs]);

    this.el.grid.innerHTML = '';
    this.cards = deck.map((glyph, i) => {
      const btn = document.createElement('button');
      btn.className = 'dc-card';
      btn.type = 'button';
      btn.innerHTML = `
        <span class="dc-inner">
          <span class="dc-face dc-back">?</span>
          <span class="dc-face dc-front"></span>
        </span>`;
      btn.querySelector('.dc-front').textContent = glyph;
      const card = { glyph, btn, index: i, matched: false, flipped: false };
      btn.addEventListener('click', () => this._flip(card));
      this.el.grid.appendChild(btn);
      return card;
    });

    // Fits 6 pairs as 4x3; keeps cards big enough to tap on a touchscreen
    this.el.grid.style.gridTemplateColumns = `repeat(4, 1fr)`;

    this._updateStats();
    window.addEventListener('keydown', this._onKey, true);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    window.removeEventListener('keydown', this._onKey, true);
  }

  _updateStats() {
    this.el.pairs.textContent = `${this.matched} / ${DECRYPT.pairs}`;
    this.el.scans.textContent = String(this.scansLeft);
    this.el.scans.classList.toggle('is-low', this.scansLeft <= 2);

    // Reveal one character per two pairs matched
    const revealCount = Math.min(
      this.fragment.length,
      Math.floor(this.matched / (DECRYPT.pairs / this.fragment.length)),
    );
    const shown = this.fragment
      .split('')
      .map((c, i) => (i < revealCount ? c : '-'))
      .join(' ');
    this.el.fragment.textContent = shown;
  }

  _flip(card) {
    if (!this.open || this.busy || card.matched || card.flipped) return;
    if (this.flipped.length >= 2) return;

    card.flipped = true;
    card.btn.classList.add('is-flipped');
    this.flipped.push(card);
    audio.cardFlip();

    if (this.flipped.length < 2) return;

    const [a, b] = this.flipped;
    this.attempts++;

    if (a.glyph === b.glyph) {
      a.matched = true;
      b.matched = true;
      a.btn.classList.add('is-matched');
      b.btn.classList.add('is-matched');
      a.btn.disabled = true;
      b.btn.disabled = true;
      this.flipped.length = 0;
      this.matched++;
      audio.cardMatch();
      this._updateStats();

      if (this.matched >= DECRYPT.pairs) {
        this.busy = true;
        setTimeout(() => {
          if (!this.open) return;
          this.close();
          this.hooks.onComplete?.(true, this.attempts);
        }, 520);
      }
      return;
    }

    // Mismatch: show both briefly, then flip back
    this.busy = true;
    this.scansLeft--;
    audio.cardMiss();
    a.btn.classList.add('is-wrong');
    b.btn.classList.add('is-wrong');
    this._updateStats();
    this.hooks.onMiss?.(this.scansLeft);

    setTimeout(() => {
      if (!this.open) return;
      for (const c of [a, b]) {
        c.flipped = false;
        c.btn.classList.remove('is-flipped', 'is-wrong');
      }
      this.flipped.length = 0;
      this.busy = false;

      if (this.scansLeft <= 0) {
        this.close();
        this.hooks.onComplete?.(false, this.attempts);
      }
    }, DECRYPT.peekTime * 1000);
  }

  _bail() {
    audio.uiClick();
    this.close();
    this.hooks.onBail?.();
  }

  _onKey(e) {
    if (!this.open) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this._bail();
    }
  }
}
