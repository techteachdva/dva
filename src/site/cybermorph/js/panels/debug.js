/**
 * DEBUG: cut a Rotling's word at every seam, then judge it: real word, or Rot?
 * The number of seams is always shown, so the task tests morphology, not guessing how many.
 * A wrong cut costs nothing but a shove back; the explanation always appears.
 */

import { el } from '../core/util.js';
import { openPanel, closeButton } from './host.js';
import { build, cutsMatch, glossLine } from '../compiler/wordsum.js';
import { loopJoint } from '../compiler/joint.js';
import { morph } from '../data/morphemes.js';
import { sfx, speak, sayMorph } from '../core/audio.js';
import { touch } from '../core/mastery.js';
import { logAttempt, logError, jointIds } from '../core/session.js';
import { save } from '../core/save.js';

/** The four calls a player can make on a Rotling, keyed 1-4. */
export const VERDICTS = [
  { id: 'real', label: 'REAL WORD' },
  { id: 'misspelled', label: 'MISSPELLED' },
  { id: 'nonword', label: 'NOT A WORD' },
  { id: 'reversed', label: 'REVERSED' },
];
/** What a Rotling really is: a skipped spelling rule or a dropped linking o is a misspelling. */
export function verdictOf(item) {
  if (!item.fake) return 'real';
  if (item.fake === 'order') return 'reversed';
  if (item.fake === 'nonword') return 'nonword';
  return 'misspelled';
}

export function openDebug({ item, profile, mode = 'rotling', title = null, realNote = null }) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.55, className: 'debug-panel' });
    const res = build(item.p);
    const shown = item.show || res.word;
    const expected = item.cuts || res.cuts;
    const doubled = item.fake ? [] : res.altCuts;
    const seamsNeeded = expected.length;
    const cuts = new Set();
    let cursor = 0;
    let attempts = 0;
    let mistakes = 0;
    let phase = 'split';

    const top = el('section', { class: 'glass panel-top' },
      el('div', { class: 'kicker' }, title || (mode === 'finale' ? 'BOSS DEBUG · split the Rot\'s word at every seam' : 'DEBUG · split the word at every seam')),
      el('div', { class: 'prompt' }, `Find ${seamsNeeded} seam${seamsNeeded === 1 ? '' : 's'}.`),
      el('div', { style: { fontSize: '1rem', color: 'var(--ink-dim)', marginTop: '0.4rem' } }, 'Click between letters to cut · ←→ move · Space cut · Enter split'));
    const keys = el('div', { class: 'keys', role: 'group', 'aria-label': `Letters of ${shown}` });
    const segs = el('div', { class: 'seg-gloss' });
    const msg = el('div', { style: { width: 'min(760px, 80vw)' } });
    const actions = el('div', { class: 'verdict' });
    const stage = el('div', { class: 'split-stage glass', style: { padding: '1.2rem 1.4rem' } }, keys, segs, msg, actions);
    panel.root.append(top, stage, closeButton(() => finish(false)));

    const seamEls = [];
    [...shown].forEach((ch, i) => {
      if (i > 0) {
        const pos = i;
        const s = el('button', { class: 'seam', type: 'button', 'aria-label': `Seam after letter ${i}`, 'aria-pressed': 'false' });
        s.addEventListener('click', () => toggle(pos));
        seamEls[pos] = s;
        keys.append(s);
      }
      keys.append(el('span', { class: 'key' }, ch));
    });
    speak(shown);

    function toggle(pos) {
      if (phase !== 'split') return;
      cursor = pos;
      if (cuts.has(pos)) cuts.delete(pos); else cuts.add(pos);
      sfx.cut();
      paint();
    }
    function paint() {
      seamEls.forEach((s, i) => {
        if (!s) return;
        s.classList.toggle('cut', cuts.has(i));
        s.classList.toggle('cursor', i === cursor);
        s.setAttribute('aria-pressed', String(cuts.has(i)));
      });
    }

    const fb = (cls, t, ...rows) => {
      msg.innerHTML = '';
      msg.append(el('div', { class: `feedback ${cls}` }, el('span', { class: 'title' }, t), ...rows.filter(Boolean).map((r) => el('span', { class: 'row' }, r))));
    };

    const splitBtn = el('button', { class: 'btn btn-primary compile-btn', type: 'button' }, 'SPLIT ✂');
    splitBtn.addEventListener('click', trySplit);
    actions.append(splitBtn);

    function trySplit() {
      if (phase !== 'split') return;
      attempts++;
      const player = [...cuts];
      if (cutsMatch(player, expected, doubled)) { splitDone(); return; }
      mistakes++;
      logError(item.p, 'seam');
      sfx.bad();
      keys.classList.remove('shake');
      void keys.offsetWidth;
      keys.classList.add('shake');
      const rows = [];
      if (player.length !== seamsNeeded) rows.push(`This word has ${seamsNeeded} seam${seamsNeeded === 1 ? '' : 's'}. You cut ${player.length}.`);
      else rows.push('At least one cut is off. Look for pieces you already know.');
      if (attempts >= 2) {
        const miss = expected.find((c) => !cuts.has(c) && !(doubled.includes(c) && cuts.has(c - 1)));
        if (miss !== undefined && seamEls[miss]) { seamEls[miss].classList.add('hint'); rows.push('A glowing seam shows one of the cuts.'); }
      }
      fb('bad', mode === 'finale' ? 'The Rot shrugs off the cut.' : 'The Rotling shoves you back.', ...rows);
    }

    function splitDone() {
      phase = item.fake || mode !== 'finale' ? 'verdict' : 'done';
      sfx.split();
      keys.classList.add('split');
      // Pieces under the letters, each with its meaning.
      const pieces = [];
      let last = 0;
      [...expected, shown.length].forEach((c) => { pieces.push(shown.slice(last, c)); last = c; });
      segs.innerHTML = '';
      pieces.forEach((piece, i) => {
        // Match each cut piece to the morpheme it is (fakes can shuffle the order), then fall back to position.
        const byText = item.p.find((x) => morph(x).text === piece);
        const id = byText || item.p[i];
        const m = id ? morph(id) : null;
        const known = m && (piece === m.text || res.segments[i] === piece || (piece.length > 2 && piece.startsWith(m.text.slice(0, -1))));
        const b = el('button', { class: 'mtile', type: 'button', 'data-type': m ? m.type : 'base', 'data-origin': m ? m.origin : 'lingo' }, piece);
        b.addEventListener('click', () => (m ? sayMorph(id) : speak(piece)));
        segs.append(el('div', { style: { textAlign: 'center' } }, b, el('div', { style: { fontSize: '1rem', color: 'var(--ink-dim)', marginTop: '0.3rem', maxWidth: '14rem' } }, known ? m.meaning : '? not a morpheme')));
      });
      actions.innerHTML = '';
      if (phase === 'done') {
        fb('good', 'CLEAN SPLIT ✔', glossLine(item.p));
        touch(profile, item.p, mistakes === 0);
        logAttempt(item.p, mistakes === 0);
        finishButton('CONTINUE ▸');
        return;
      }
      fb('info', 'Clean cuts. Now judge it:', 'Is it a real word? Or did the Rot misspell it, flip its pieces, or make up a word nobody uses?');
      VERDICTS.forEach((v, i) => {
        const b = el('button', { class: `btn ${v.id === 'real' ? 'btn-good' : 'btn-pink'}`, type: 'button' }, `${v.label} (${i + 1})`);
        b.addEventListener('click', () => verdict(v.id));
        actions.append(b);
        if (i === 0) b.focus();
      });
    }

    async function verdict(said) {
      if (phase !== 'verdict') return;
      const want = verdictOf(item);
      if (said !== want) {
        mistakes++;
        logVerdictError();
        sfx.bad();
        const hint = mistakes >= 2 || want === 'real' ? null : {
          misspelled: 'Say it slowly. The pieces make a real word, but the spelling where they join is off.',
          reversed: 'Read the pieces in order. Is one of them on the wrong side of its base?',
          nonword: 'Every piece is real and spelled right. But is the whole thing a word anyone uses?',
        }[want];
        fb('bad', 'The Rotling shoves you back.', want === 'real' ? `It's real. ${item.p.map((id) => morph(id).text).join(' + ')} → ${res.word}. ${realNote || ''}` : hint || `Look closer. ${item.why}`);
        return;
      }
      phase = 'done';
      actions.innerHTML = '';
      touch(profile, item.p, mistakes === 0);
      logAttempt(item.p, mistakes === 0, { rotling: true });
      profile.stats.splits += 1;
      save();
      if (item.fake) {
        sfx.good();
        const clean = item.real || item.p;
        const word = item.real ? build(item.real).word : res.word;
        const title = { misspelled: 'MISSPELLING CAUGHT ✔', reversed: 'FLIPPED PIECES CAUGHT ✔', nonword: 'NOT A WORD ✔' }[verdictOf(item)];
        fb('good', title, item.why, `Clean version: ${word}`);
        const j = el('div', { style: { marginTop: '0.5rem', textAlign: 'center' } });
        msg.append(j);
        speak(word);
        loopJoint(j, clean, { solved: true });
      } else {
        sfx.good();
        speak(res.word);
        fb('good', 'REAL WORD ✔ Clean split!', glossLine(item.p), realNote);
      }
      finishButton('COLLECT ▸');
    }

    /** A wrong REAL / ROT call, logged against the morphemes it is about. */
    function logVerdictError() {
      const types = item.p.map((id) => morph(id).type);
      if (item.fake === 'joint') logError(jointIds(item.p), 'joint');
      else if (item.fake === 'order') logError(item.p.filter((_, i) => types[i] === 'pfx' || types[i] === 'sfx'), 'order');
      else if (item.fake === 'link') logError(item.p.filter((_, i) => types[i] === 'base'), 'link');
      else if (item.fake === 'nonword') logError(item.real || item.p, 'meaning');
      else if (item.fake) logError(item.p, 'joint');
      else logError(res.steps.length ? jointIds(item.p) : item.p, 'real');
    }

    function finishButton(label) {
      const b = el('button', { class: 'btn btn-primary compile-btn', type: 'button' }, label);
      b.addEventListener('click', () => finish(true));
      actions.innerHTML = '';
      actions.append(b);
      b.focus();
    }

    function finish(solved) {
      if (panel.closed) return;
      panel.close();
      resolve({ solved: solved && phase === 'done', firstTry: mistakes === 0, mistakes });
    }

    panel.onKey((e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(phase === 'done'); return; }
      if (phase === 'split') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); cursor = Math.max(1, cursor - 1); paint(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); cursor = Math.min(shown.length - 1, cursor + 1); paint(); }
        else if (e.key === ' ') { e.preventDefault(); if (cursor > 0) toggle(cursor); }
        else if (e.key === 'Enter') { e.preventDefault(); trySplit(); }
      } else if (phase === 'verdict') {
        const v = VERDICTS[Number(e.key) - 1];
        if (v) verdict(v.id);
      }
    });
    cursor = 1;
    paint();
    window.__cmPanel = { kind: 'debug', expected, item, seamEls, get phase() { return phase; } };
  });
}
