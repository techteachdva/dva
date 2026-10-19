/**
 * LINK: hang each word on its family branch. Look-alikes that are not family
 * (career is not care + er) go in the NOT FAMILY bin.
 */

import { el, shuffle } from '../core/util.js';
import { openPanel, closeButton } from './host.js';
import { morph } from '../data/morphemes.js';
import { mtile } from '../ui/hud.js';
import { sfx, speak } from '../core/audio.js';
import { touch } from '../core/mastery.js';

export function openLink({ link, profile, title = 'LINK NODE' }) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.6 });
    const cards = shuffle([
      ...link.bases.flatMap((b, bi) => b.words.map((w) => ({ w, branch: bi }))),
      ...link.ff.map((f) => ({ w: f.w, branch: -1, ff: f })),
    ]);
    let selected = null;
    let mistakes = 0;
    let placed = 0;

    const msg = el('div');
    const top = el('section', { class: 'glass panel-top' },
      el('div', { class: 'kicker' }, `${title} · hang each word on its family`),
      el('div', { class: 'prompt', style: { fontSize: '1.1rem' } }, 'Click a word, then click its branch. Words that only LOOK related go in NOT FAMILY.'),
      msg);
    const pool = el('div', { class: 'link-pool glass' });
    const branches = el('div', { class: 'branches' });
    const board = el('div', { class: 'link-board' }, pool, branches);
    panel.root.append(top, board, closeButton(() => finish()));

    const branchEls = link.bases.map((b, bi) => {
      const head = b.id ? mtile(b.id, { profile, big: true }) : el('span', { class: 'mtile big', 'data-type': 'word', 'data-origin': 'lingo' }, b.label);
      const meaning = b.id ? morph(b.id).meaning : 'slang';
      const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' } });
      const node = el('div', { class: 'branch', role: 'button', tabindex: '0', 'aria-label': `Branch ${b.id ? morph(b.id).text : b.label}` }, head, el('div', { class: 'meaning' }, meaning), list);
      node.addEventListener('click', () => drop(bi));
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(bi); } });
      branches.append(node);
      return { node, list };
    });
    const binList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' } });
    const bin = el('div', { class: 'branch bin', role: 'button', tabindex: '0', 'aria-label': 'Not family' }, el('span', { class: 'mtile big', 'data-type': 'word', 'data-origin': 'lingo', style: { color: 'var(--red)' } }, 'NOT FAMILY'), el('div', { class: 'meaning' }, 'only looks related'), binList);
    bin.addEventListener('click', () => drop(-1));
    bin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(-1); } });
    branches.append(bin);

    const cardEls = cards.map((c) => {
      const b = el('button', { class: 'word-card', type: 'button' }, c.w);
      b.addEventListener('click', () => {
        if (c.done) return;
        selected = c;
        speak(c.w);
        cardEls.forEach((x) => x.classList.toggle('sel', x === b));
        [...branchEls.map((x) => x.node), bin].forEach((n) => n.classList.add('target'));
      });
      c.el = b;
      pool.append(b);
      return b;
    });

    const fb = (cls, t, ...rows) => {
      msg.innerHTML = '';
      msg.append(el('div', { class: `feedback ${cls}` }, el('span', { class: 'title' }, t), ...rows.map((r) => el('span', { class: 'row' }, r))));
    };

    function drop(bi) {
      if (!selected) { fb('info', 'Pick a word first.', 'Click one of the words at the top.'); return; }
      const c = selected;
      if (c.branch === bi) {
        sfx.good();
        c.done = true;
        placed++;
        c.el.remove();
        const target = bi === -1 ? binList : branchEls[bi].list;
        target.append(el('span', { class: 'word-card placed' }, c.w));
        if (c.ff) fb('good', `Not family ✔  ${c.w}`, `Looks like ${c.ff.looks}, but: ${c.ff.why}`);
        else {
          const surprise = link.surprise && link.surprise[c.w];
          fb('good', `Family ✔  ${c.w}`, surprise || `${c.w} carries the ${link.bases[bi].id ? morph(link.bases[bi].id).text : link.bases[bi].label} family.`);
          if (link.bases[bi].id) touch(profile, [link.bases[bi].id], true);
        }
      } else {
        sfx.bad();
        mistakes++;
        c.el.classList.remove('shake');
        void c.el.offsetWidth;
        c.el.classList.add('shake');
        if (c.ff) fb('bad', `Careful: ${c.w} only LOOKS related.`, `It looks like ${c.ff.looks}. ${mistakes > 1 ? c.ff.why : 'Where does it really come from?'}`);
        else if (bi === -1) fb('bad', `${c.w} IS family.`, 'Look for a base you know inside it.');
        else fb('bad', `${c.w} doesn't carry that base.`, 'Find the base hiding inside the word.');
      }
      selected = null;
      cardEls.forEach((x) => x.classList.remove('sel'));
      [...branchEls.map((x) => x.node), bin].forEach((n) => n.classList.remove('target'));
      if (placed === cards.length) {
        const done = el('button', { class: 'btn btn-good', type: 'button', style: { marginTop: '0.5rem' } }, 'ALL LINKED ✔  CONTINUE');
        done.addEventListener('click', () => finish());
        msg.append(done);
        done.focus();
      }
    }

    window.__cmPanel = { kind: 'link', cards, branchEls, bin };
    function finish() {
      if (panel.closed) return;
      panel.close();
      resolve({ solved: placed === cards.length, firstTry: mistakes === 0 });
    }
    panel.onKey((e) => { if (e.key === 'Escape') finish(); });
  });
}
