/**
 * Mentor speech. Lines type out quickly; a click, Space or Enter finishes the line,
 * and a second press goes on once Next unlocks (a short read-lock, longer for longer lines).
 * Captions are always on; reading aloud is a setting.
 *
 * A line is a string, or [mood, text] where mood is one of MOODS. The mood is set on the
 * dialogue box as data-mood, and the portrait (portraits.js) draws the speaker in that mood.
 */

export const MOODS = ['neutral', 'pleased', 'worried', 'special', 'rot'];
const lineOf = (l) => (Array.isArray(l) ? { mood: l[0], text: l[1] } : { mood: 'neutral', text: l });

import { $, clamp, readLock, readLocked } from '../core/util.js';
import { speakDialogue } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { setPortrait, setTalking } from './portraits.js';

export const SPEAKERS = {
  wynn: { name: 'OLD WYNN', initial: 'ƿ', color: '#ffb000' },
  aurelia: { name: 'AURELIA CACHE', initial: 'A', color: '#cfd6e2' },
  theo: { name: 'THEO PARSEC', initial: 'Θ', color: '#38b6ff' },
  phil: { name: 'MR. PHIL', initial: 'P', color: '#2f6fde' },
  noam: { name: 'NOAM CHOMSKY', initial: 'N', color: '#ff6b6b' },
  system: { name: 'LEXINET', initial: '◆', color: '#00e5ff' },
  rot: { name: 'THE ROT', initial: '☣', color: '#7dff3a' },
};

let active = null;

/** How long Next stays shut on a line: about 30 ms a letter, at least 1 s and at most 3 s. */
const readMs = (s) => clamp(s.length * 30, 1000, 3000);

export const dialogueOpen = () => !!active;

export function say(speakerId, lines) {
  const sp = SPEAKERS[speakerId] || SPEAKERS.system;
  const box = $('dialogue');
  const text = $('dlg-text');
  const port = $('dlg-portrait');
  $('dlg-name').textContent = sp.name;
  $('dlg-name').style.color = sp.color;
  const who = SPEAKERS[speakerId] ? speakerId : 'system';
  box.hidden = false;
  document.body.classList.add('dlg-open');
  return new Promise((resolve) => {
    let i = 0;
    let typing = 0;
    let full = '';
    const show = () => {
      const line = lineOf(lines[i]);
      full = line.text;
      box.dataset.mood = line.mood;
      box.dataset.speaker = speakerId;
      setPortrait(port, who, line.mood);
      setTalking(port, true);
      text.textContent = '';
      speakDialogue(full);
      const rate = settings.reducedMotion ? 1e9 : 70;
      const start = performance.now();
      clearInterval(typing);
      typing = setInterval(() => {
        const n = Math.floor(((performance.now() - start) / 1000) * rate);
        text.textContent = full.slice(0, n);
        if (n >= full.length) { clearInterval(typing); setTalking(port, false); }
      }, 16);
      $('dlg-next').textContent = i === lines.length - 1 ? 'OK ▸' : 'Next ▸';
      readLock($('dlg-next'), readMs(full));
    };
    const next = () => {
      if (text.textContent.length < full.length) { clearInterval(typing); setTalking(port, false); text.textContent = full; return; }
      if (readLocked($('dlg-next'))) return;
      i++;
      if (i >= lines.length) { finish(); return; }
      show();
    };
    const onKey = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return; // typing in the dev console
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); next(); }
    };
    const onClick = (e) => { e.stopPropagation(); next(); };
    const finish = () => {
      clearInterval(typing);
      setTalking(port, false);
      box.hidden = true;
      document.body.classList.remove('dlg-open');
      window.removeEventListener('keydown', onKey, true);
      $('dlg-next').removeEventListener('click', onClick);
      box.removeEventListener('click', onClick);
      active = null;
      resolve();
    };
    active = { finish };
    window.addEventListener('keydown', onKey, true);
    $('dlg-next').addEventListener('click', onClick);
    box.addEventListener('click', onClick);
    show();
  });
}
