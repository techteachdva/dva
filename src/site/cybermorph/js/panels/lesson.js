/**
 * New morphemes, all on one card: spelling, sound, meaning, an example word sum,
 * and (when the setting is on) the Spanish cognate. Explicit and short, so the
 * practice that follows does the teaching.
 */

import { el } from '../core/util.js';
import { openPanel } from './host.js';
import { morph, ORIGIN_LABEL, TYPE_LABEL } from '../data/morphemes.js';
import { MORPHEME_CATALOG } from '../data/catalog.js';
import { mtile } from '../ui/hud.js';
import { settings } from '../core/settings.js';
import { sayMorph } from '../core/audio.js';
import { sumText } from '../compiler/wordsum.js';

const catalog = new Map(MORPHEME_CATALOG.map((r) => [r.key, r]));

function exampleFor(id, tasks) {
  const t = (tasks || []).find((x) => x.p && x.p.includes(id));
  if (t) { try { return sumText(t.p); } catch { /* fall through */ } }
  const row = catalog.get(morph(id).cat);
  if (row && row.wordSums && row.wordSums.length) return row.wordSums[0];
  return null;
}

export function showLesson({ ids, profile, tasks = [], title = 'NEW MORPHEMES', note = '' }) {
  return new Promise((resolve) => {
    const panel = openPanel({ dim: 0.7 });
    const grid = el('div', { class: 'lesson-grid' });
    ids.forEach((id) => {
      const m = morph(id);
      const ex = exampleFor(id, tasks);
      const row = catalog.get(m.cat);
      grid.append(el('div', { class: 'lesson-item' },
        mtile(id, { profile }),
        el('div', { class: 'meta' }, `${ORIGIN_LABEL[m.origin]} ${TYPE_LABEL[m.type]}`),
        el('div', { class: 'mean' }, m.meaning),
        ex ? el('div', { class: 'ex' }, ex) : null,
        row && row.decodingTip && ids.length <= 4 ? el('div', { class: 'ex' }, row.decodingTip) : null,
        settings.cognates && m.es ? el('div', { class: 'es' }, `Spanish cognate: ${m.es}`) : null));
    });
    const go = el('button', { class: 'btn btn-primary', type: 'button' }, 'GOT IT ▸');
    const hearAll = el('button', { class: 'btn', type: 'button' }, '🔊 Hear all');
    hearAll.addEventListener('click', () => {
      ids.forEach((id, i) => setTimeout(() => sayMorph(id), i * 900));
    });
    const card = el('section', { class: 'glass lesson' },
      el('div', { class: 'kicker' }, title),
      el('h2', {}, note || 'Click any piece to hear it.'),
      grid,
      el('div', { class: 'lesson-foot' },
        el('div', { class: 'legend' },
          el('span', { class: 'mtile', 'data-type': 'pfx', 'data-origin': 'latin' }, 'pre'), 'prefix: pin on the right',
          el('span', { class: 'mtile', 'data-type': 'base', 'data-origin': 'latin' }, 'port'), 'base: square',
          el('span', { class: 'mtile', 'data-type': 'sfx', 'data-origin': 'latin' }, 'able'), 'suffix: socket on the left'),
        el('div', { style: { display: 'flex', gap: '0.5rem' } }, hearAll, go)));
    panel.root.append(card);
    go.addEventListener('click', () => { panel.close(); resolve(); });
    panel.onKey((e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); panel.close(); resolve(); } });
    setTimeout(() => go.focus(), 50);
  });
}
