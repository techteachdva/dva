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

/**
 * The teaching loop for the word sum under the compiler: it never stops explaining.
 *   1. the parts sit apart, each underlined in its type colour
 *   2. every spelling change is spotlighted, captioned, then applied:
 *      a dropped letter is struck through and falls away, an added letter pops in green,
 *      a changed letter flips gold
 *   3. the parts slide together into the word
 *   4. the word splits back apart, every change undone in reverse, and it repeats
 * Returns { stop }. It also stops by itself once the container leaves the page.
 * Reduced motion shows one still frame with every change marked.
 */
export function loopJoint(container, ids, { solved = false } = {}) {
  const res = build(ids);
  const root = el('span', { class: 'joint jloop', 'aria-hidden': 'true' });
  const pieces = res.parts.map((p, i) => {
    const piece = el('span', { class: 'piece', style: { '--tc': TYPE_VAR[p.type] } }, [...p.text].map((ch) => el('span', { class: 'ltr' }, ch)));
    if (i > 0) root.append(el('span', { class: 'plus' }, p.type === 'word' ? ' ' : '+'));
    root.append(piece);
    return piece;
  });
  const arrow = el('span', { class: 'jarrow' }, '→');
  const result = el('span', { class: 'jresult' }, res.word);
  const cap = el('div', { class: 'jcap', 'aria-live': 'off' });
  const sr = el('span', { class: 'sr-only' }, sumLabel(res));
  const wrap = el('div', { class: `jwrap${solved ? ' solved' : ''}` }, el('div', { class: 'jrow' }, root, arrow, result), cap, sr);
  container.innerHTML = '';
  container.append(wrap);

  const lettersOf = (i) => [...pieces[i].querySelectorAll('.ltr')];
  const lastLetter = (i) => { const l = lettersOf(i).filter((x) => !x.classList.contains('added')); return l[l.length - 1]; };
  const say = (html, cls = '') => { cap.className = `jcap ${cls}`; cap.innerHTML = html; };
  const steps = res.steps;
  const label = (s) => {
    const who = `<b>${res.parts[s.at].text}</b>`;
    if (s.kind === 'drop-e' || s.kind === 'merge-e') return `✂ ${who} drops a letter: ${s.note}.`;
    if (s.kind === 'elide') return `✂ ${who} drops a letter: ${s.note}.`;
    if (s.kind === 'y-i') return `↻ ${who} changes a letter: ${s.note}.`;
    if (s.kind === 'double') return `＋ ${who} adds a letter: ${s.note}.`;
    if (s.kind === 'assim') return `↻ ${who} changes shape: ${s.note}.`;
    return s.note;
  };
  const targets = (s) => {
    if (s.kind === 'assim') return lettersOf(s.at).filter((_, i) => i >= s.to.length || s.to[i] !== s.from[i]);
    return [lastLetter(s.at)];
  };
  const apply = (s) => {
    const piece = pieces[s.at];
    if (s.kind === 'drop-e' || s.kind === 'merge-e' || s.kind === 'elide') {
      const l = lastLetter(s.at);
      l.classList.add('strike');
      setTimeout(() => l.isConnected && l.classList.contains('strike') && l.classList.add('drop'), 650);
    } else if (s.kind === 'y-i') {
      const l = lastLetter(s.at);
      l.textContent = 'i';
      l.classList.add('flip');
    } else if (s.kind === 'double') {
      piece.append(el('span', { class: 'ltr pop added' }, s.letter));
    } else if (s.kind === 'assim') {
      piece.innerHTML = '';
      const n = Math.max(s.from.length, s.to.length);
      for (let i = 0; i < n; i++) {
        if (i < s.to.length) piece.append(el('span', { class: `ltr${s.to[i] !== s.from[i] ? ' flip' : ''}` }, s.to[i]));
        else piece.append(el('span', { class: 'ltr strike drop' }, s.from[i]));
      }
    }
  };
  const undo = (s) => {
    const piece = pieces[s.at];
    if (s.kind === 'drop-e' || s.kind === 'merge-e' || s.kind === 'elide') {
      const l = lettersOf(s.at).filter((x) => x.classList.contains('strike')).pop();
      if (l) l.classList.remove('drop', 'strike');
    } else if (s.kind === 'y-i') {
      const l = lastLetter(s.at);
      l.textContent = 'y';
      l.classList.remove('flip');
    } else if (s.kind === 'double') {
      piece.querySelectorAll('.added').forEach((x) => x.remove());
    } else if (s.kind === 'assim') {
      piece.innerHTML = '';
      [...s.from].forEach((ch) => piece.append(el('span', { class: 'ltr' }, ch)));
    }
  };

  if (settings.reducedMotion) {
    steps.forEach(apply);
    root.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
    wrap.classList.add('joined-still');
    say(steps.length ? steps.map(label).join('<br>') : 'No spelling change: the parts just join.');
    return { stop() {} };
  }

  let alive = true;
  const live = () => alive && wrap.isConnected;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const spot = async (els, ms) => { els.forEach((x) => x && x.classList.add('focus')); await pause(ms); els.forEach((x) => x && x.classList.remove('focus')); };
  (async () => {
    await pause(60);
    while (live()) {
      // 1. Apart.
      root.classList.remove('joined', 'done');
      wrap.classList.remove('show-result');
      say(steps.length ? `Watch the joint: ${steps.length} spelling change${steps.length > 1 ? 's' : ''}.` : 'No spelling change here: the parts just join.', 'intro');
      await pause(1300);
      // 2. Each change, spotlighted then applied.
      for (const s of steps) {
        if (!live()) return;
        say(label(s), `k-${s.kind}`);
        await spot(targets(s), 900);
        if (!live()) return;
        apply(s);
        await pause(1300);
      }
      if (!live()) return;
      // 3. Join.
      root.classList.add('joined');
      await pause(450);
      root.classList.add('done');
      wrap.classList.add('show-result');
      say(`<b>${sumLabel(res)}</b>`, 'sum');
      await pause(2200);
      if (!live()) return;
      // 4. Split back apart, undoing each change in reverse.
      root.classList.remove('done', 'joined');
      wrap.classList.remove('show-result');
      say(`And back again: <b>${res.word}</b> splits into ${res.parts.map((p) => `<b>${p.text}</b>`).join(' + ')}.`, 'back');
      await pause(700);
      for (const s of [...steps].reverse()) {
        if (!live()) return;
        await spot(targets(s), 450);
        undo(s);
        await pause(650);
      }
      await pause(900);
    }
  })();
  return { stop() { alive = false; } };
}

/** "hop(e) + ing → hoping" for captions and screen readers. */
function sumLabel(res) {
  const marked = res.parts.map((p, i) => {
    const s = res.steps.find((st) => st.at === i);
    if (!s) return p.text;
    if (s.kind === 'drop-e' || s.kind === 'merge-e' || s.kind === 'elide') return `${p.text.slice(0, -1)}(${p.text.slice(-1)})`;
    if (s.kind === 'y-i') return `${p.text.slice(0, -1)}(y→i)`;
    if (s.kind === 'double') return `${p.text} + ${s.letter}`;
    if (s.kind === 'assim') return `${p.text}(→${s.to})`;
    return p.text;
  });
  return `${marked.join(' + ')} → ${res.word}`;
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
    if (s.kind === 'drop-e' || s.kind === 'merge-e' || s.kind === 'elide') last.classList.add('drop');
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
