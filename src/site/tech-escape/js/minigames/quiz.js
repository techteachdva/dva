/**
 * The terminal security check.
 *
 * This is the part of the game that has to teach, so it is built around one
 * finding: elaborated feedback that explains the error is worth roughly half a
 * standard deviation of learning gain, where showing the correct answer alone is
 * worth a third of one and a bare right/wrong marker is worth almost nothing
 * (van der Kleij et al., 2015). So the explanation is not a consolation prize for
 * getting it wrong - it appears on EVERY answer, immediately, including correct
 * ones, and it is the reason the panel exists.
 *
 * The rest follows from not wanting to measure the wrong thing:
 *
 *  - RETRY UNTIL CORRECT. Nobody is locked out of a door for not knowing
 *    something yet; they read why and try again. First-attempt correctness is
 *    recorded silently and is what feeds the Study Guide, so the record stays
 *    honest without the player being punished for learning during the attempt.
 *  - TWO-STEP COMMIT with a lockout when the panel opens. A trackpad click that
 *    began before the panel existed must not land on an answer, and it very much
 *    does otherwise.
 *  - THE COUNT IS ALWAYS SHOWN on multi-answer prompts. Hiding how many are
 *    correct measures whether a student has met that interface convention before,
 *    which is not the subject being assessed.
 *  - NO TIMER, no score, no accuracy counter, and none of the words quiz, test,
 *    score, grade or question anywhere a student can see. The fiction does the
 *    same job without the dread those words carry.
 *  - WRONG ANSWERS BLAME THE SYSTEM. "The terminal rejected that credential" is
 *    true in the fiction and leaves the student's competence out of it.
 */

import { QUIZ } from '../config.js';
import { audio } from '../audio.js';
import { TERMINALS } from '../data/questions.js';
import { settings } from '../meta/settings.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * A fixed shape per slot, in the same order on every prompt. This is the
 * non-colour channel for selection: slot B is a diamond whether it is selected,
 * accepted, or rejected, so "which one did I pick" never depends on hue.
 */
const SLOT_SHAPES = ['triangle', 'diamond', 'circle', 'square', 'pentagon'];

/**
 * Milliseconds the confirm button stays disabled after the panel appears.
 *
 * A pointerdown that started before the panel existed should not be able to
 * complete as a click on a button that has just appeared under the cursor. On a
 * trackpad, where the player has just tapped to interact with the terminal, this
 * double-submit is not an edge case - it is the common path.
 */
const OPEN_LOCKOUT_MS = 350;

/** Time the explanation is on screen before the options come back. */
const RETRY_DELAY_MS = 1200;

const $ = (id) => document.getElementById(id);

export class Quiz {
  constructor() {
    this.open = false;
    this.el = {
      screen: $('screen-quiz'),
      panel: $('quiz-panel'),
      name: $('quiz-terminal-name'),
      segments: $('quiz-segments'),
      fragment: $('quiz-fragment'),
      mode: $('quiz-mode-chip'),
      standard: $('quiz-standard'),
      question: $('quiz-question'),
      answers: $('quiz-answers'),
      submit: $('quiz-submit'),
      next: $('quiz-next'),
      bail: $('quiz-bail'),
      feedback: $('quiz-feedback'),
      verdict: $('quiz-verdict'),
      explain: $('quiz-explain'),
      warn: $('quiz-warn'),
      live: $('quiz-live'),
    };

    this.el.submit.addEventListener('click', () => this._confirm());
    this.el.next.addEventListener('click', () => this._next());
    this.el.bail.addEventListener('click', () => this._bail());

    this._onKey = this._onKey.bind(this);
    this._openedAt = 0;
    this._retryTimer = 0;
    this._returnFocus = null;
  }

  /**
   * @param {number} terminalIndex
   * @param {Array} questions from drawQuestions()
   * @param {{onAnswer:Function, onComplete:Function, onBail:Function,
   *   onWrong:Function}} hooks
   */
  start(terminalIndex, questions, hooks) {
    this.terminalIndex = terminalIndex;
    this.questions = questions;
    this.hooks = hooks;
    this.index = 0;
    this.firstTryCount = 0;
    this.attempts = 0;
    this.open = true;
    this.revealed = false;
    this.locked = false;
    this.picked = new Set();
    this.answeredFirstTry = null;
    this._returnFocus = document.activeElement;

    this.el.name.textContent = TERMINALS[terminalIndex].name;
    this._buildSegments();
    this._render();
    window.addEventListener('keydown', this._onKey, true);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    window.removeEventListener('keydown', this._onKey, true);
    clearTimeout(this._retryTimer);
    // Hand focus back where it came from, or ChromeVox users are stranded at the
    // top of the document every time a terminal closes
    if (this._returnFocus?.focus) {
      try { this._returnFocus.focus(); } catch { /* element may be gone */ }
    }
  }

  /**
   * Footer status. On the difficulties where the lab pauses during a terminal
   * this says so plainly, because a student who does not know they are safe reads
   * at the speed of someone who thinks they are being hunted.
   */
  setThreat(near, frozen = false) {
    const w = this.el.warn;
    if (frozen) {
      w.classList.remove('is-danger');
      w.textContent = 'The lab is holding still while this terminal is open.';
      return;
    }
    w.classList.toggle('is-danger', near);
    w.textContent = near
      ? 'Something is right next to you. Press Esc to step away.'
      : 'The lab is still moving. Do not stay too long.';
  }

  // ---------------------------------------------------------------- rendering

  _current() { return this.questions[this.index]; }

  /**
   * One segment per prompt, filled when ANSWERED - not when answered correctly.
   * Encoding correctness here would turn a progress bar into a public scoreboard
   * on a screen a neighbour can see, and it would undercut retry-until-correct by
   * marking a prompt as failed after the student has just learned it.
   */
  _buildSegments() {
    this.el.segments.innerHTML = '';
    for (let i = 0; i < this.questions.length; i++) {
      const seg = document.createElement('span');
      seg.className = 'seg';
      this.el.segments.appendChild(seg);
    }
  }

  _updateSegments() {
    [...this.el.segments.children].forEach((seg, i) => {
      seg.classList.toggle('is-done', i < this.index);
      seg.classList.toggle('is-current', i === this.index);
    });
    this.el.fragment.textContent =
      `FRAGMENT ${this.index + 1} OF ${this.questions.length}`;
  }

  _render() {
    const q = this._current();
    this.revealed = false;
    this.locked = false;
    this.attempts = 0;
    this.picked.clear();
    this._openedAt = performance.now();

    this._updateSegments();
    this.el.standard.textContent = q.std || q.standard || '';
    this.el.standard.classList.toggle('hidden', !(q.std || q.standard));
    this.el.question.textContent = q.text;

    // Telling them how many to pick is the difference between assessing tech
    // knowledge and assessing familiarity with checkbox conventions
    this.el.mode.textContent = q.multi
      ? `SELECT ALL THAT APPLY - ${q.correctCount} CORRECT`
      : 'SELECT ONE';
    this.el.mode.classList.toggle('is-multi', !!q.multi);

    this._renderOptions(q);
    this._resetFeedback();
    this._lockoutConfirm();
  }

  _renderOptions(q) {
    const list = this.el.answers;
    list.innerHTML = '';
    // Radio semantics for pick-one, checkbox semantics for pick-several, so the
    // screen reader announces the rule instead of the student inferring it
    list.setAttribute('role', q.multi ? 'group' : 'radiogroup');

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer';
      btn.type = 'button';
      btn.dataset.slot = SLOT_SHAPES[i] || 'square';
      btn.setAttribute('role', q.multi ? 'checkbox' : 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('aria-describedby', 'quiz-explain');

      const badge = document.createElement('span');
      badge.className = 'answer-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = `<span class="answer-shape"></span>`
        + `<span class="answer-letter">${LETTERS[i]}</span>`;

      const text = document.createElement('span');
      text.className = 'answer-text';
      text.textContent = opt.text;

      const mark = document.createElement('span');
      mark.className = 'answer-mark';
      mark.setAttribute('aria-hidden', 'true');

      btn.append(badge, text, mark);
      btn.addEventListener('click', (e) => {
        // Ignore a click whose press began before this panel existed
        if (e.timeStamp && e.timeStamp < this._openedAt) return;
        this._pick(i, btn);
      });
      list.appendChild(btn);
    });
  }

  _resetFeedback() {
    this.el.feedback.classList.add('hidden');
    this.el.feedback.classList.remove('is-right', 'is-wrong');
    this.el.explain.textContent = '';
    this.el.submit.classList.remove('hidden');
    this.el.next.classList.add('hidden');
    this.el.submit.textContent = this._current()?.multi ? 'SUBMIT' : 'CONFIRM';
  }

  _lockoutConfirm() {
    this.el.submit.disabled = true;
    clearTimeout(this._lockTimer);
    this._lockTimer = setTimeout(() => {
      // Still disabled if nothing is chosen; this only lifts the opening lockout
      this.el.submit.disabled = this.picked.size === 0;
    }, OPEN_LOCKOUT_MS);
  }

  _pick(i, btn) {
    if (this.revealed || this.locked) return;
    const q = this._current();
    audio.uiClick();

    if (q.multi) {
      if (this.picked.has(i)) this.picked.delete(i);
      else this.picked.add(i);
    } else {
      this.picked.clear();
      this.picked.add(i);
    }

    [...this.el.answers.children].forEach((b, j) => {
      const on = this.picked.has(j);
      b.classList.toggle('is-picked', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    const openFor = performance.now() - this._openedAt;
    this.el.submit.disabled = this.picked.size === 0 || openFor < OPEN_LOCKOUT_MS;
  }

  _confirm() {
    if (this.revealed || this.locked || !this.picked.size) return;
    if (performance.now() - this._openedAt < OPEN_LOCKOUT_MS) return;

    const q = this._current();
    const chosen = [...this.picked];
    const correctIdx = q.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    const isRight = chosen.length === correctIdx.length
      && chosen.every((i) => q.options[i].correct);
    const partial = q.multi && chosen.some((i) => q.options[i].correct);

    this.attempts++;
    // Only the first attempt is reported: that is what the Study Guide needs, and
    // recording later attempts would punish the student for reading the
    // explanation and trying again, which is the behaviour we want
    if (this.attempts === 1) {
      this.answeredFirstTry = isRight;
      if (isRight) this.firstTryCount++;
      this.hooks.onAnswer?.(isRight, q, chosen.map((i) => q.options[i].text));
    }

    if (isRight) this._acceptAnswer(q);
    else this._rejectAnswer(q, partial);
  }

  _acceptAnswer(q) {
    this.revealed = true;
    this.locked = true;
    audio.correct();

    [...this.el.answers.children].forEach((btn, i) => {
      btn.disabled = true;
      if (q.options[i].correct) btn.classList.add('is-right');
      btn.classList.remove('is-picked');
    });

    this.el.verdict.innerHTML = '<span class="verdict-icon" aria-hidden="true">&#10003;</span> ACCEPTED';
    this.el.feedback.classList.add('is-right');
    this._showExplanation(q, 'Credential accepted. ');

    this.el.submit.classList.add('hidden');
    this.el.next.classList.remove('hidden');
    // Never auto-advance: the explanation is the teaching, and it is gone the
    // moment the panel moves on by itself
    this.el.next.textContent = this.index >= this.questions.length - 1
      ? 'DISCONNECT' : 'CONTINUE';
    this.el.next.focus();
  }

  _rejectAnswer(q, partial) {
    this.locked = true;
    audio.wrong();

    // Show which of their choices the terminal refused, but never reveal the
    // right one - they are about to try again, and the answer would end that
    [...this.el.answers.children].forEach((btn, i) => {
      btn.disabled = true;
      if (this.picked.has(i)) btn.classList.add('is-wrong');
    });

    this.el.verdict.innerHTML = '<span class="verdict-icon" aria-hidden="true">&#10007;</span> DENIED';
    this.el.feedback.classList.add('is-wrong');
    this._showExplanation(q, partial
      ? 'The terminal accepted part of that credential and rejected the rest. '
      : 'The terminal rejected that credential. ');

    this.el.submit.disabled = true;
    // A wrong answer costs noise and a few seconds of lights, never health and
    // never progress
    this.hooks.onWrong?.(this.attempts);

    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(() => this._enableRetry(), RETRY_DELAY_MS);
  }

  /** Options come back after the explanation has had time to be read. */
  _enableRetry() {
    if (!this.open || this.revealed) return;
    this.locked = false;
    this.picked.clear();
    [...this.el.answers.children].forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('is-wrong', 'is-picked');
      btn.setAttribute('aria-checked', 'false');
    });
    this.el.submit.disabled = true;
    this.el.submit.textContent = 'TRY AGAIN';
    this._announce('Terminal ready for another credential.');
    this.el.answers.children[0]?.focus();
  }

  _showExplanation(q, prefix) {
    this.el.explain.textContent = `${prefix}${q.why || ''}`.trim();
    this.el.feedback.classList.remove('hidden');
    this._announce(`${this.el.verdict.textContent}. ${this.el.explain.textContent}`);
  }

  /** Politely, so it never interrupts what the student is already hearing. */
  _announce(text) {
    if (!this.el.live) return;
    this.el.live.textContent = text;
  }

  _next() {
    if (!this.revealed) return;
    audio.uiClick();
    this.index++;
    if (this.index >= this.questions.length) {
      this.close();
      // Retry-until-correct means every terminal is eventually cleared. What
      // varies is what it cost, so the report is first-attempt hits out of total.
      this.hooks.onComplete?.(true, this.firstTryCount, this.questions.length);
      return;
    }
    this._render();
    this.el.answers.children[0]?.focus();
  }

  _bail() {
    audio.uiClick();
    this.close();
    this.hooks.onBail?.(this.firstTryCount, this.index);
  }

  // ------------------------------------------------------------------ keyboard

  _onKey(e) {
    if (!this.open) return;

    if (e.code === 'Escape') {
      // Chrome releases Pointer Lock on Escape and that cannot be prevented, so
      // stepping away from the terminal is the only sane meaning for this key
      e.preventDefault();
      e.stopPropagation();
      this._bail();
      return;
    }

    // Focus trap: Tab must not walk out of the panel into the page behind it
    if (e.code === 'Tab') {
      const focusable = [...this.el.panel.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((n) => n.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    // 1-4 and A-D both select, because both are printed on the badge and a
    // student should not have to work out which one this game wanted
    const digit = e.code.match(/^(?:Digit|Numpad)([1-5])$/);
    const letter = e.code.match(/^Key([A-E])$/);
    const slot = digit ? Number(digit[1]) - 1 : letter ? LETTERS.indexOf(letter[1]) : -1;
    if (slot >= 0) {
      const btn = this.el.answers.children[slot];
      if (btn && !this.revealed && !this.locked) {
        e.preventDefault();
        this._pick(slot, btn);
      }
      return;
    }

    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      // Space on a focused button is the browser's own click; do not double it
      if (e.code === 'Space' && document.activeElement?.tagName === 'BUTTON') return;
      e.preventDefault();
      e.stopPropagation();
      if (this.revealed) this._next();
      else if (this.picked.size && !this.el.submit.disabled) this._confirm();
    }
  }
}

export { QUIZ, SLOT_SHAPES };
