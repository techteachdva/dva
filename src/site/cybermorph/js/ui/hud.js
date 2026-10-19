import { $, el } from '../core/util.js';
import { morph, ORIGIN_LABEL, TYPE_LABEL } from '../data/morphemes.js';
import { glow } from '../core/mastery.js';
import { sayMorph } from '../core/audio.js';
import { KEY_POOL, SLOT_NAMES, DISTRICTS, MAIN_ORDER } from '../data/world.js';

/** A DOM morpheme tile: shape by type (data-type), look by origin (data-origin). */
export function mtile(id, { profile = null, big = false, button = true, onClick = null, text = null } = {}) {
  const m = morph(id);
  const g = profile ? glow(profile, id) : null;
  const cls = ['mtile', big ? 'big' : '', g ? g.tier : '', g && g.fading ? 'fading' : ''].filter(Boolean).join(' ');
  const t = el(button ? 'button' : 'span', {
    class: cls,
    'data-type': m.type,
    'data-origin': m.origin,
    title: `${m.text}: ${m.meaning} (${ORIGIN_LABEL[m.origin]} ${TYPE_LABEL[m.type]})`,
    'aria-label': `${m.text}, ${TYPE_LABEL[m.type]}, means ${m.meaning}`,
    type: button ? 'button' : undefined,
  }, text ?? m.text);
  if (button) t.addEventListener('click', (e) => { e.stopPropagation(); sayMorph(id); if (onClick) onClick(id); });
  return t;
}

export function showHud(on) { $('hud').hidden = !on; }

export function setObjective(text) { $('objective-text').textContent = text; }

export function setPlace(name, count = 0, current = 0, done = []) {
  $('place-name').textContent = name;
  const dots = $('place-dots');
  dots.innerHTML = '';
  for (let i = 0; i < count; i++) dots.append(el('i', { class: i === current || done[i] ? 'on' : '' }));
}

export function setRot(visible, pct = 0, carrying = 0) {
  const m = $('rot-meter');
  m.hidden = !visible;
  if (!visible) return;
  $('rot-fill').style.width = `${Math.round(pct)}%`;
  m.classList.toggle('danger', pct > 75);
  $('carry-count').textContent = carrying ? `${carrying} loose` : '';
}

export function toast(text, kind = '') {
  const t = el('div', { class: `toast ${kind}` }, text);
  $('toasts').append(t);
  setTimeout(() => t.remove(), 3400);
}

let ctxHandler = null;
$('ctx-btn').addEventListener('click', (e) => { e.stopPropagation(); if (ctxHandler) ctxHandler(); });
export function setContext(label, handler, sub = '') {
  const b = $('ctx-btn');
  if (!label) { b.hidden = true; ctxHandler = null; return; }
  b.hidden = false;
  b.innerHTML = '';
  b.append(label, sub ? el('small', {}, sub) : '');
  ctxHandler = handler;
}

$('log-toggle').addEventListener('click', () => {
  const log = $('log');
  log.classList.toggle('collapsed');
  $('log-toggle').setAttribute('aria-expanded', String(!log.classList.contains('collapsed')));
});

export function renderLog(profile) {
  const list = $('log-list');
  list.innerHTML = '';
  for (const entry of profile.log.slice(0, 20)) {
    list.append(el('li', {}, el('b', {}, entry.w), el('br'), entry.p.map((id) => morph(id).text).join(' + ')));
  }
}

// ── Inventory ─────────────────────────────────────────────────────
let invTab = 'morphemes';
let invFilter = null;
let invProfile = null;

document.querySelectorAll('.inv-tab').forEach((b) => b.addEventListener('click', () => {
  invTab = b.dataset.tab;
  document.querySelectorAll('.inv-tab').forEach((x) => x.classList.toggle('active', x === b));
  if (invProfile) renderInventory(invProfile);
}));
$('inv-collapse').addEventListener('click', () => {
  const inv = $('inventory');
  inv.classList.toggle('collapsed');
  $('inv-collapse').textContent = inv.classList.contains('collapsed') ? '▴' : '▾';
});

export function setInventoryFilter(origin) { invFilter = origin; }

export function clueText(profile, slot) {
  const k = KEY_POOL[profile.keyIndex];
  const id = k.p[slot];
  const m = morph(id);
  const words = k.clue[slot];
  return { m, words, slotName: SLOT_NAMES[slot], length: m.text.length };
}

export function renderInventory(profile) {
  invProfile = profile;
  const body = $('inv-body');
  body.innerHTML = '';
  if (invTab === 'clues') {
    const ids = MAIN_ORDER;
    ids.forEach((d, slot) => {
      if (profile.clues[slot]) {
        const c = clueText(profile, slot);
        body.append(el('div', { class: 'clue-card' },
          el('b', {}, `KEYWORD ${slot + 1} · ${c.slotName.toUpperCase()} · ${c.length} letters`), el('br'),
          `Find the ${c.slotName} that these words share: `, el('b', {}, c.words.join(', ')), '.'));
      } else {
        body.append(el('div', { class: 'clue-card sealed' }, `KEYWORD ${slot + 1} · sealed. Clear ${DISTRICTS[d].name} to reveal it.`));
      }
    });
    body.append(el('div', { class: 'clue-card sealed' }, 'The three keywords open the Secret Secretary Desk in the hub.'));
    return;
  }
  const learned = profile.learned.filter((id) => !invFilter || morph(id).origin === invFilter);
  const origins = [...new Set(profile.learned.map((id) => morph(id).origin))];
  if (origins.length > 1) {
    const f = el('div', { class: 'inv-filter' });
    const mk = (o, label) => {
      const b = el('button', { class: invFilter === o ? 'on' : '', type: 'button' }, label);
      b.addEventListener('click', () => { invFilter = o; renderInventory(profile); });
      return b;
    };
    f.append(mk(null, 'All'), ...origins.map((o) => mk(o, ORIGIN_LABEL[o])));
    body.append(f);
  }
  if (!learned.length) {
    body.append(el('div', { class: 'clue-card sealed' }, 'No morphemes yet. Mentors hand them to you.'));
    return;
  }
  const groups = [['pfx', 'PREFIX'], ['base', 'BASE'], ['sfx', 'SUFFIX'], ['link', 'LINK'], ['word', 'WORD']];
  for (const [type, label] of groups) {
    const ids = learned.filter((id) => morph(id).type === type);
    if (!ids.length) continue;
    body.append(el('div', { class: 'inv-row' }, el('span', {}, label), el('div', { class: 'inv-tiles' }, ids.map((id) => mtile(id, { profile })))));
  }
}
