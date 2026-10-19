/**
 * The joint animation: pieces sit apart, each spelling rule acts on its letter
 * (an e falls off, a y flips to i, a consonant pops in, a prefix changes shape),
 * then the pieces slide together into the finished word.
 */

import { el, wait } from '../core/util.js';
import { build } from './wordsum.js';
import { settings } from '../core/settings.js';
import { sfx } from '../core/audio.js';

const TYPE_VAR = { pfx: 'var(--pfx)', base: 'var(--base)', sfx: 'var(--sfx)', link: 'var(--link)', word: 'var(--word)' };

export function jointElement(ids) {
  const res = build(ids);
  const root = el('span', { class: 'joint', 'aria-label': res.word });
  const pieces = res.parts.map((p, i) => {
    const piece = el('span', { class: 'piece', style: { '--tc': TYPE_VAR[p.type] } }, [...p.text].map((ch) => el('span', { class: 'ltr' }, ch)));
    if (i > 0) root.append(el('span', { class: 'plus' }, p.type === 'word' ? ' ' : '+'));
    root.append(piece);
    return piece;
  });
  return { root, res, pieces };
}

export async function playJoint(container, ids) {
  const { root, res, pieces } = jointElement(ids);
  container.innerHTML = '';
  container.append(root);
  const fast = settings.reducedMotion;
  const apply = (s) => {
    const piece = pieces[s.at];
    const letters = [...piece.querySelectorAll('.ltr')];
    const last = letters[letters.length - 1];
    if (s.kind === 'drop-e' || s.kind === 'merge-e') last.classList.add('drop');
    else if (s.kind === 'y-i') { last.textContent = 'i'; last.classList.add('flip'); }
    else if (s.kind === 'double') piece.append(el('span', { class: 'ltr pop' }, s.letter));
    else if (s.kind === 'assim') {
      piece.innerHTML = '';
      [...s.to].forEach((ch, i) => piece.append(el('span', { class: `ltr${ch !== s.from[i] ? ' flip' : ''}` }, ch)));
    }
  };
  if (fast) {
    res.steps.forEach(apply);
    root.classList.add('joined', 'done');
    return res;
  }
  await wait(280);
  for (const s of res.steps) {
    apply(s);
    sfx.drop();
    await wait(480);
  }
  root.classList.add('joined');
  await wait(320);
  root.classList.add('done');
  return res;
}
