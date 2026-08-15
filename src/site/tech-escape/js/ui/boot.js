/**
 * The startup log.
 *
 * The first version printed six lines in about 1.4 seconds, which is not a
 * loading screen so much as a flicker. Nobody could read it, so all the effort
 * spent writing it was wasted, and the player learned that text in this game is
 * decoration they are allowed to ignore - a bad habit to teach ten seconds before
 * a game whose puzzles are made of text.
 *
 * The numbers here come from silent reading rates for grades 6-8: 150-204 words
 * per minute, which is about 15-20 characters per second. So:
 *
 *   - Type at 34 characters per second. Roughly double the fastest reader in the
 *     room, so the typing never feels slow, but the line is not gone before a
 *     slower reader has started it.
 *   - The real fix is DWELL, not type speed. A completed line has to stay put.
 *     Lines here accumulate rather than replace, so each one remains readable for
 *     the rest of the sequence, and the last line gets an explicit hold.
 *   - Total 6-9 seconds, hard capped at 10. The cap is enforced by measurement,
 *     not by hoping the arithmetic works out.
 *   - Skippable from 1.5s, and the choice is REMEMBERED. A student who has seen
 *     it does not need to see it again, and forcing them to is how you teach
 *     someone to alt-tab away during your loading screen.
 *   - The lines report real results, and the last one prints the code format the
 *     player is about to go hunting for. Reading it is worth something.
 *
 * Under reduced motion the typewriter is skipped entirely - all lines render at
 * once - but the total dwell is preserved, because the reason for the wait is
 * reading time and that has not changed.
 */

import { BOOT } from '../config.js';
import { settings } from '../meta/settings.js';

/** Blink at 1Hz. Anything faster is a flash source and a distraction. */
const CURSOR_HZ = 1;
const MAX_VISIBLE_LINES = 6;

export class BootSequence {
  constructor(els) {
    this.log = els.log;
    this.fill = els.fill;
    this.skipBtn = els.skip;
    this.lines = [];
    this.skipped = false;
    this._done = false;
    this._cursorOn = true;

    this._onKey = (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        this.skip();
      }
    };
    this.skipBtn?.addEventListener('click', () => this.skip());
  }

  /**
   * @param {Array<{text:string, run?:Function}>} stages each may return a string
   *   that is stamped onto the end of its line
   * @returns {Promise<void>}
   */
  async run(stages) {
    const fast = settings.get('skipBoot') || this._recentlyPlayed();
    const cps = fast ? BOOT.fastCharsPerSecond : BOOT.charsPerSecond;
    const minTotal = (fast ? BOOT.fastMinSeconds : BOOT.minSeconds) * 1000;
    const reduceMotion = settings.get('reduceMotion');
    const started = performance.now();

    window.addEventListener('keydown', this._onKey, true);
    // WCAG 2.2.2: under reduced motion the escape hatch is offered immediately,
    // because a player who asked for less movement should not have to wait
    // through it to find the way out
    this._skipTimer = setTimeout(
      () => this._showSkip(),
      reduceMotion ? 0 : BOOT.skipHintAfter * 1000,
    );
    this._startCursor(reduceMotion);

    for (let i = 0; i < stages.length; i++) {
      if (this.skipped) break;
      const stage = stages[i];

      // Run the real work FIRST so the line can report what actually happened.
      // A progress bar that moves on a timer while the work happens elsewhere is
      // a lie, and players can tell.
      let stamp = '';
      try {
        stamp = (await stage.run?.()) || 'OK';
      } catch (err) {
        stamp = 'FAIL';
        // Let the caller decide whether a failed stage is fatal
        this.error = err;
      }

      const text = this._compose(stage.text, stamp);
      if (reduceMotion) this._pushLine(text);
      else await this._typeLine(text, cps);

      this._setProgress((i + 1) / stages.length);

      if (this.skipped) break;
      // Elapsed budget check every line, so the hard cap holds even if a stage
      // took longer than expected
      const elapsed = performance.now() - started;
      const remaining = BOOT.maxSeconds * 1000 - elapsed;
      if (remaining <= 0) break;
      const beat = Math.min(this._dwellFor(text, fast), remaining);
      if (beat > 0) await this._wait(beat);
    }

    // Flush anything left if they skipped or the cap hit
    if (this.lines.length < stages.length) {
      for (let i = this.lines.length; i < stages.length; i++) {
        this._pushLine(this._compose(stages[i].text, 'OK'));
      }
      this._setProgress(1);
    }

    // Hold on the finished screen so the last line is actually readable, unless
    // they asked to skip - then get out of the way immediately
    if (!this.skipped) {
      const elapsed = performance.now() - started;
      const hold = Math.min(
        Math.max(minTotal - elapsed, BOOT.finalHold * 1000),
        Math.max(0, BOOT.maxSeconds * 1000 - elapsed),
      );
      if (hold > 0) await this._wait(hold);
    }

    this._finish();
  }

  /**
   * Dwell for a completed line: 1.2 seconds, or longer for a wordy one at
   * 2.5 words per second. Lines accumulate on screen rather than replacing each
   * other, so this is the beat before the NEXT line starts typing, not the only
   * time this line is visible.
   */
  _dwellFor(text, fast) {
    const words = text.trim().split(/\s+/).length;
    const dwell = Math.max(BOOT.linePause, (words / 2.5) * 1000);
    // Scaled down hard, because the accumulated log keeps every line readable and
    // the full per-line dwell would blow the 10 second ceiling
    return dwell * (fast ? 0.12 : 0.22);
  }

  /**
   * `> CHROMEBOOKS AWAKE ........... 4 OF 4`
   *
   * Padded to a fixed 44 characters rather than the 55 character maximum: five
   * lines at 55 characters would be 9.7 seconds of typing on its own, which
   * leaves nothing for the dwell and blows the ceiling.
   */
  _compose(label, stamp) {
    const head = `> ${label} `;
    const tail = ` ${stamp}`;
    const dots = Math.max(1, 44 - head.length - tail.length);
    return head + '.'.repeat(dots) + tail;
  }

  async _typeLine(text, cps) {
    const perChar = 1000 / cps;
    this.lines.push('');
    const idx = this.lines.length - 1;
    let shown = 0;
    let last = performance.now();

    while (shown < text.length && !this.skipped) {
      await this._frame();
      const now = performance.now();
      // Time-based rather than one character per frame, so the rate is the same
      // on a 60Hz Chromebook and a 144Hz monitor
      const chars = Math.floor((now - last) / perChar);
      if (chars <= 0) continue;
      last += chars * perChar;
      shown = Math.min(text.length, shown + chars);
      this.lines[idx] = text.slice(0, shown);
      this._paint();
    }
    this.lines[idx] = text;
    this._paint();
  }

  _pushLine(text) {
    this.lines.push(text);
    this._paint();
  }

  _paint() {
    if (!this.log) return;
    const visible = this.lines.slice(-MAX_VISIBLE_LINES);
    this.log.textContent = visible.join('\n') + (this._cursorOn && !this._done ? '\u2588' : ' ');
  }

  _setProgress(t) {
    if (this.fill) this.fill.style.width = `${Math.round(Math.min(1, t) * 100)}%`;
  }

  _startCursor(reduceMotion) {
    if (reduceMotion) {
      this._cursorOn = true;
      return;
    }
    this._cursorTimer = setInterval(() => {
      this._cursorOn = !this._cursorOn;
      this._paint();
    }, 1000 / (CURSOR_HZ * 2));
  }

  _showSkip() {
    this.skipBtn?.classList.remove('hidden');
  }

  skip() {
    if (this._done || this.skipped) return;
    this.skipped = true;
    // Remembered, so replays go straight to the title
    settings.set('skipBoot', true);
  }

  _finish() {
    this._done = true;
    clearInterval(this._cursorTimer);
    clearTimeout(this._skipTimer);
    window.removeEventListener('keydown', this._onKey, true);
    this.skipBtn?.classList.add('hidden');
    this._paint();
    try {
      localStorage.setItem('techEscape.lastPlayed', String(Date.now()));
    } catch { /* ignore */ }
  }

  /** Returning the same afternoon means the log has already been read once. */
  _recentlyPlayed() {
    try {
      const t = Number(localStorage.getItem('techEscape.lastPlayed') || 0);
      if (!t) return false;
      return (Date.now() - t) / 3600000 < BOOT.fastWindowHours;
    } catch {
      return false;
    }
  }

  _wait(ms) {
    return new Promise((r) => {
      const t = setTimeout(r, ms);
      // Skipping must not leave the caller waiting out a timer nobody wants
      const poll = setInterval(() => {
        if (this.skipped) {
          clearTimeout(t);
          clearInterval(poll);
          r();
        }
      }, 40);
      setTimeout(() => clearInterval(poll), ms + 50);
    });
  }

  _frame() {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }
}
