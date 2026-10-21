/**
 * UNKNOWN FILE: the Word Detective routine (Kieffer & Lesaux, 2007) on a word the
 * player has never seen, built only from pieces they know. This is the transfer
 * step that morphology programs often skip (Colenbrander et al., 2024).
 *   1. Click the glowing word.         2. Split it.
 *   3. Read what each piece means.     4. Check the meaning in the sentence.
 */

import { el, shuffle } from '../core/util.js';
import { openPanel, closeButton } from './host.js';
import { build, cutsMatch } from '../compiler/wordsum.js';
import { morph } from '../data/morphemes.js';
import { mtile } from '../ui/hud.js';
import { sfx, speak } from '../core/audio.js';
import { touch } from '../core/mastery.js';

export function openNewWord({ item, profile, title = 'UNKNOWN FILE' }) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.62 });
    let step = 0;
    let mistakes = 0;
    const res = build(item.p);
    const shown = item.w.replace('-', '');
    const expected = item.p.length > 1 ? (item.w === res.word ? res.cuts : (() => { let s = 0; return item.p.slice(0, -1).map((id) => { s += morph(id).text.length; return s; }); })()) : [];

    const stepsList = el('ol', {},
      el('li', {}, 'Click the glowing word.'),
      el('li', {}, 'Split it into morphemes.'),
      el('li', {}, 'Read what each piece means.'),
      el('li', {}, 'Pick the meaning that fits the sentence.'));
    const steps = el('aside', { class: 'steps glass' }, el('div', { class: 'kicker' }, 'WORD DETECTIVE'), stepsList);
    const caseBox = el('div', { class: 'case glass' });
    panel.root.append(
      el('section', { class: 'glass panel-top' }, el('div', { class: 'kicker' }, `${title} · a word you have never built`), el('div', { class: 'prompt', style: { fontSize: '1.1rem' } }, 'Every piece of it is a morpheme you already know.')),
      el('div', { class: 'detective' }, steps, caseBox),
      closeButton(() => finish(false)));

    const paintSteps = () => [...stepsList.children].forEach((li, i) => { li.className = i < step ? 'done' : i === step ? 'now' : ''; });
    const msg = el('div', { style: { width: '100%' } });
    const fb = (cls, t, ...rows) => {
      msg.innerHTML = '';
      msg.append(el('div', { class: `feedback ${cls}` }, el('span', { class: 'title' }, t), ...rows.map((r) => el('span', { class: 'row' }, r))));
    };

    // Step 1: the sentence with clickable words.
    const sentence = el('div', { class: 'sentence' });
    const tokens = item.s.split(/(\s+)/);
    const targetWord = item.w.toLowerCase();
    // Only the case word is clickable, and it glows: students may know the word but not its parts.
    tokens.forEach((tok) => {
      if (/^\s+$/.test(tok)) { sentence.append(tok); return; }
      const clean = tok.replace(/[^A-Za-z'-]/g, '').toLowerCase();
      if (clean !== targetWord) { sentence.append(el('span', { class: 'w' }, tok)); return; }
      // Punctuation stays outside the glow: only the word itself lights up.
      const [, lead, core, trail] = tok.match(/^([^A-Za-z'-]*)(.*?)([^A-Za-z'-]*)$/);
      if (lead) sentence.append(lead);
      const b = el('button', { class: 'w click glow', type: 'button' }, core);
      b.addEventListener('click', () => {
        if (step !== 0) return;
        b.classList.remove('glow');
        b.classList.add('target');
        sfx.good();
        speak(item.w);
        step = 1;
        paintSteps();
        showSplit();
      });
      sentence.append(b);
      if (trail) sentence.append(trail);
      setTimeout(() => b.focus(), 60);
    });
    caseBox.append(sentence, msg);
    fb('info', 'Step 1', 'Click the glowing word to open the case.');
    paintSteps();

    function showSplit() {
      const cuts = new Set();
      const keys = el('div', { class: 'keys' });
      const seamEls = [];
      [...shown].forEach((ch, i) => {
        if (i > 0) {
          const s = el('button', { class: 'seam', type: 'button', 'aria-label': `Seam after letter ${i}` });
          s.addEventListener('click', () => { if (cuts.has(i)) cuts.delete(i); else cuts.add(i); s.classList.toggle('cut', cuts.has(i)); sfx.cut(); });
          seamEls[i] = s;
          keys.append(s);
        }
        keys.append(el('span', { class: 'key' }, ch));
      });
      const go = el('button', { class: 'btn btn-primary', type: 'button' }, `SPLIT ✂ (${expected.length} seam${expected.length === 1 ? '' : 's'})`);
      go.addEventListener('click', () => {
        if (cutsMatch([...cuts], expected, res.altCuts)) {
          sfx.split();
          keys.classList.add('split');
          go.remove();
          step = 2;
          paintSteps();
          showPieces();
        } else {
          mistakes++;
          sfx.bad();
          fb('bad', 'Not quite.', `This word has ${expected.length} seams. Look for the parts you know.`);
          if (mistakes >= 2) { const miss = expected.find((c) => !cuts.has(c)); if (miss && seamEls[miss]) seamEls[miss].classList.add('hint'); }
        }
      });
      const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' } }, keys, go);
      caseBox.insertBefore(wrap, msg);
      fb('info', 'Step 2', 'Cut the word between its morphemes.');
    }

    function showPieces() {
      const row = el('div', { class: 'seg-gloss' }, item.p.map((id) => el('div', { style: { textAlign: 'center' } }, mtile(id, { profile }), el('div', { style: { fontSize: '0.9rem', color: 'var(--ink-dim)', marginTop: '0.25rem' } }, morph(id).meaning))));
      caseBox.insertBefore(row, msg);
      fb('info', 'Step 3', `Read each piece: ${item.p.map((id) => `${morph(id).text} = ${morph(id).meaning}`).join(' · ')}.`);
      setTimeout(() => { step = 3; paintSteps(); showOptions(); }, 600);
    }

    function showOptions() {
      const opts = el('div', { class: 'options' });
      const order = shuffle(item.opts.map((o, i) => ({ o, i })));
      order.forEach(({ o, i }) => {
        const b = el('button', { class: 'btn', type: 'button' }, o);
        b.addEventListener('click', () => {
          if (step !== 3) return;
          if (i === item.a) {
            sfx.good();
            step = 4;
            paintSteps();
            b.classList.add('btn-good');
            touch(profile, item.p, mistakes === 0);
            fb('good', `SOLVED ✔  ${item.w} = ${o}`, `${item.p.map((id) => morph(id).text).join(' + ')}: ${item.p.map((id) => morph(id).meaning).join(' + ')}.`, 'You read a brand-new word from its parts. That\'s the whole point.');
            const done = el('button', { class: 'btn btn-primary', type: 'button', style: { marginTop: '0.5rem' } }, 'CONTINUE ▸');
            done.addEventListener('click', () => finish(true));
            msg.append(done);
            done.focus();
          } else {
            mistakes++;
            sfx.bad();
            b.disabled = true;
            fb('bad', 'Check it against the pieces.', `"${o}" doesn't match ${item.p.map((id) => morph(id).meaning).join(' + ')}.`);
          }
        });
        opts.append(b);
      });
      caseBox.insertBefore(opts, msg);
      fb('info', 'Step 4', 'Which meaning fits the sentence?');
    }

    window.__cmPanel = { kind: 'newword', item, expected, get step() { return step; } };
    function finish(solved) {
      if (panel.closed) return;
      panel.close();
      resolve({ solved: solved && step === 4, firstTry: mistakes === 0 });
    }
    panel.onKey((e) => { if (e.key === 'Escape') finish(step === 4); });
  });
}
