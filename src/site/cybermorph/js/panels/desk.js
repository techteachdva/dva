/**
 * The Secret Secretary Desk. Three combination letter locks, one per keyword:
 * prefix (Anglo-Saxon Room clue), base (Latin), suffix (Greek).
 * The keywords are drawn per save, so every browser run has its own key word.
 * When all three are right, the morphemes slide together and the key word is built.
 */

import { el, wait } from '../core/util.js';
import { openPanel, closeButton } from './host.js';
import { KEY_POOL, SLOT_NAMES, DISTRICTS, MAIN_ORDER } from '../data/world.js';
import { morph } from '../data/morphemes.js';
import { playJoint } from '../compiler/joint.js';
import { build } from '../compiler/wordsum.js';
import { sfx, speak } from '../core/audio.js';
import { clueText } from '../ui/hud.js';

const ABC = 'abcdefghijklmnopqrstuvwxyz';

export function openDesk({ profile }) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.72 });
    const key = KEY_POOL[profile.keyIndex];
    const wheelsState = key.p.map((id) => [...morph(id).text].map(() => 0));
    const opened = key.p.map(() => false);
    const lockEls = [];
    let unlocked = profile.deskOpen;

    const result = el('div', { style: { marginTop: '0.6rem', minHeight: '3.2rem' } });
    const locksEl = el('div', { class: 'locks' });
    const desk = el('section', { class: 'desk glass' },
      el('div', { class: 'plaque' }, 'SECRET SECRETARY DESK'),
      el('div', { style: { marginTop: '0.6rem', color: '#f3e2b5' } }, 'Three locks. Three keywords. One word. Each room\'s mentor gives you one keyword when you clear the room.'),
      locksEl, result);
    panel.root.append(desk, closeButton(() => finish()));

    key.p.forEach((id, slot) => {
      const m = morph(id);
      const lock = el('div', { class: 'lock' });
      const wheels = el('div', { class: 'wheels' });
      const letters = [];
      [...m.text].forEach((_, wi) => {
        const letter = el('div', { class: 'letter', tabindex: '0', role: 'spinbutton', 'aria-label': `Lock ${slot + 1}, letter ${wi + 1}` }, 'a');
        const up = el('button', { type: 'button', 'aria-label': 'Next letter' }, '▲');
        const down = el('button', { type: 'button', 'aria-label': 'Previous letter' }, '▼');
        const set = (v) => {
          if (opened[slot] || unlocked) return;
          wheelsState[slot][wi] = (v + 26) % 26;
          letter.textContent = ABC[wheelsState[slot][wi]];
          sfx.tick();
          check(slot);
        };
        up.addEventListener('click', () => set(wheelsState[slot][wi] + 1));
        down.addEventListener('click', () => set(wheelsState[slot][wi] - 1));
        letter.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); set(wheelsState[slot][wi] + 1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); set(wheelsState[slot][wi] - 1); }
          else if (/^[a-z]$/i.test(e.key)) {
            e.preventDefault();
            set(ABC.indexOf(e.key.toLowerCase()));
            const nextEl = letters[wi + 1] || (lockEls[slot + 1] && lockEls[slot + 1].letters[0]);
            if (nextEl) nextEl.focus();
          }
        });
        letter.addEventListener('wheel', (e) => { e.preventDefault(); set(wheelsState[slot][wi] + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
        letters.push(letter);
        wheels.append(el('div', { class: 'wheel' }, up, letter, down));
      });
      let clue;
      if (profile.clues[slot]) {
        const c = clueText(profile, slot);
        clue = el('div', { class: 'clue' }, `Keyword ${slot + 1} is a ${c.slotName} (${c.length} letters). It is the ${c.slotName} shared by: `, el('b', {}, c.words.join(', ')), '.');
      } else {
        clue = el('div', { class: 'clue sealed' }, `Sealed. Clear ${DISTRICTS[MAIN_ORDER[slot]].name} to earn this clue.`);
      }
      lock.append(el('div', { class: 'lk' }, `LOCK ${slot + 1} · ${SLOT_NAMES[slot].toUpperCase()}`), wheels, clue);
      locksEl.append(lock);
      lockEls.push({ lock, letters });
    });

    function check(slot) {
      const m = morph(key.p[slot]);
      const word = wheelsState[slot].map((i) => ABC[i]).join('');
      if (word === m.text && !opened[slot]) {
        opened[slot] = true;
        lockEls[slot].lock.classList.add('open');
        sfx.unlock();
        speak(m.say || m.text);
        if (opened.every(Boolean)) openAll();
      }
    }

    async function openAll() {
      unlocked = true;
      await wait(500);
      result.innerHTML = '';
      const j = el('div', {});
      result.append(el('div', { class: 'kicker', style: { color: '#f6d27a' } }, 'THE KEY WORD'), j);
      await playJoint(j, key.p);
      const w = build(key.p).word;
      speak(w);
      sfx.unlock();
      result.append(el('div', { style: { marginTop: '0.4rem', color: '#f3e2b5' } }, `${key.p.map((id) => morph(id).text).join(' + ')} → ${w}. The drawer slides open…`));
      const enter = el('button', { class: 'btn btn-primary', type: 'button', style: { marginTop: '0.6rem' } }, 'ENTER THE DRAWER ▸');
      enter.addEventListener('click', () => finish('enter'));
      result.append(enter);
      enter.focus();
    }

    function finish(action = null) {
      if (panel.closed) return;
      panel.close();
      resolve({ opened: unlocked, action });
    }
    panel.onKey((e) => { if (e.key === 'Escape') finish(); });

    if (unlocked) {
      key.p.forEach((id, slot) => {
        [...morph(id).text].forEach((ch, wi) => { wheelsState[slot][wi] = ABC.indexOf(ch); lockEls[slot].letters[wi].textContent = ch; });
        opened[slot] = true;
        lockEls[slot].lock.classList.add('open');
      });
      const enter = el('button', { class: 'btn btn-primary', type: 'button' }, `ENTER THE DRAWER: ${build(key.p).word.toUpperCase()} ▸`);
      enter.addEventListener('click', () => finish('enter'));
      result.append(enter);
    } else if (lockEls[0]) setTimeout(() => lockEls[0].letters[0].focus(), 60);
  });
}
