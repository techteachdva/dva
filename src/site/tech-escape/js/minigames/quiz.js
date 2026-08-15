/**
 * The Chromebook quiz.
 *
 * Questions arrive already shuffled. Single and multi-answer questions use the
 * same select-then-submit flow so the interaction never changes under the
 * player, and every answer is explained whether you got it right or not - the
 * explanation is the actual teaching moment.
 */

import { QUIZ } from '../config.js';
import { audio } from '../audio.js';
import { TERMINALS } from '../data/questions.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const PASS_THRESHOLD = 2;   // correct answers needed out of QUIZ.questionsPerLaptop

const $ = (id) => document.getElementById(id);

export class Quiz {
  constructor() {
    this.open = false;
    this.el = {
      screen: $('screen-quiz'),
      name: $('quiz-terminal-name'),
      progress: $('quiz-progress'),
      standard: $('quiz-standard'),
      question: $('quiz-question'),
      multiNote: $('quiz-multi-note'),
      answers: $('quiz-answers'),
      submit: $('quiz-submit'),
      next: $('quiz-next'),
      bail: $('quiz-bail'),
      feedback: $('quiz-feedback'),
      verdict: $('quiz-verdict'),
      explain: $('quiz-explain'),
      warn: $('quiz-warn'),
    };

    this.el.submit.addEventListener('click', () => this._submit());
    this.el.next.addEventListener('click', () => this._next());
    this.el.bail.addEventListener('click', () => this._bail());

    this._onKey = this._onKey.bind(this);
  }

  /**
   * @param {number} terminalIndex
   * @param {Array} questions from drawQuestions()
   * @param {{onAnswer:Function, onComplete:Function, onBail:Function}} hooks
   */
  start(terminalIndex, questions, hooks) {
    this.terminalIndex = terminalIndex;
    this.questions = questions;
    this.hooks = hooks;
    this.index = 0;
    this.correctCount = 0;
    this.open = true;
    this.revealed = false;
    this.picked = new Set();

    this.el.name.textContent = TERMINALS[terminalIndex].name;
    this._render();
    window.addEventListener('keydown', this._onKey, true);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    window.removeEventListener('keydown', this._onKey, true);
  }

  /** Called from the game loop so the footer can warn about approaching enemies. */
  setThreat(near) {
    this.el.warn.classList.toggle('is-danger', near);
    this.el.warn.textContent = near
      ? 'SOMETHING IS RIGHT NEXT TO YOU - PRESS ESC'
      : 'The lab is still moving. Do not stay too long.';
  }

  // ------------------------------------------------------------------ rendering

  _current() { return this.questions[this.index]; }

  _render() {
    const q = this._current();
    this.revealed = false;
    this.picked.clear();

    this.el.progress.textContent = `${this.index + 1} / ${this.questions.length}`;
    this.el.standard.textContent = q.std;
    this.el.question.textContent = q.text;
    this.el.multiNote.classList.toggle('hidden', !q.multi);
    if (q.multi) {
      this.el.multiNote.textContent = `Select ALL correct answers (${q.correctCount} of ${q.options.length}).`;
    }

    this.el.answers.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer';
      btn.type = 'button';
      btn.innerHTML = `<span class="answer-letter">${LETTERS[i]}</span><span class="answer-text"></span>`;
      btn.querySelector('.answer-text').textContent = opt.text;
      btn.addEventListener('click', () => this._pick(i, btn));
      this.el.answers.appendChild(btn);
    });

    this.el.feedback.classList.add('hidden');
    this.el.feedback.classList.remove('is-right', 'is-wrong');
    this.el.submit.classList.remove('hidden');
    this.el.submit.disabled = true;
    this.el.next.classList.add('hidden');
  }

  _pick(i, btn) {
    if (this.revealed) return;
    const q = this._current();
    audio.uiClick();

    if (q.multi) {
      if (this.picked.has(i)) {
        this.picked.delete(i);
        btn.classList.remove('is-picked');
      } else {
        this.picked.add(i);
        btn.classList.add('is-picked');
      }
    } else {
      this.picked.clear();
      for (const b of this.el.answers.children) b.classList.remove('is-picked');
      this.picked.add(i);
      btn.classList.add('is-picked');
    }
    this.el.submit.disabled = this.picked.size === 0;
  }

  _submit() {
    if (this.revealed || !this.picked.size) return;
    const q = this._current();
    this.revealed = true;

    const chosen = [...this.picked];
    const correctIdx = q.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    // Right means every correct option picked and nothing extra
    const isRight = chosen.length === correctIdx.length
      && chosen.every((i) => q.options[i].correct);

    const buttons = [...this.el.answers.children];
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      btn.classList.remove('is-picked');
      const wasPicked = this.picked.has(i);
      if (q.options[i].correct && wasPicked) btn.classList.add('is-right');
      else if (q.options[i].correct && !wasPicked) btn.classList.add('is-missed');
      else if (wasPicked) btn.classList.add('is-wrong');
    });

    if (isRight) {
      this.correctCount++;
      audio.correct();
      this.el.verdict.textContent = 'CORRECT';
      this.el.feedback.classList.add('is-right');
    } else {
      audio.wrong();
      this.el.verdict.textContent = q.multi && chosen.some((i) => q.options[i].correct)
        ? 'INCOMPLETE - you missed one'
        : 'INCORRECT';
      this.el.feedback.classList.add('is-wrong');
    }

    this.el.explain.textContent = q.why;
    this.el.feedback.classList.remove('hidden');
    this.el.submit.classList.add('hidden');
    this.el.next.classList.remove('hidden');
    this.el.next.textContent = this.index >= this.questions.length - 1 ? 'FINISH' : 'CONTINUE';

    this.hooks.onAnswer?.(isRight);
  }

  _next() {
    if (!this.revealed) return;
    audio.uiClick();
    this.index++;
    if (this.index >= this.questions.length) {
      const passed = this.correctCount >= Math.min(PASS_THRESHOLD, this.questions.length);
      this.close();
      this.hooks.onComplete?.(passed, this.correctCount, this.questions.length);
      return;
    }
    this._render();
  }

  _bail() {
    audio.uiClick();
    this.close();
    this.hooks.onBail?.(this.correctCount, this.index);
  }

  _onKey(e) {
    if (!this.open) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this._bail();
      return;
    }
    // Number keys select, Enter submits or continues
    const digit = e.code.match(/^Digit([1-5])$/);
    if (digit) {
      const i = Number(digit[1]) - 1;
      const btn = this.el.answers.children[i];
      if (btn && !this.revealed) {
        e.preventDefault();
        this._pick(i, btn);
      }
      return;
    }
    const letter = e.code.match(/^Key([A-E])$/);
    if (letter && !this.revealed) {
      const i = LETTERS.indexOf(letter[1]);
      const btn = this.el.answers.children[i];
      if (btn) {
        e.preventDefault();
        this._pick(i, btn);
      }
      return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      e.stopPropagation();
      if (this.revealed) this._next();
      else if (this.picked.size) this._submit();
    }
  }
}

export { PASS_THRESHOLD, QUIZ };
