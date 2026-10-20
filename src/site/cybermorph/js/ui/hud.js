import { $, el } from '../core/util.js';
import { morph, ORIGIN_LABEL, TYPE_LABEL } from '../data/morphemes.js';
import { glow } from '../core/mastery.js';
import { sayMorph, sfx } from '../core/audio.js';
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

// ── Drawers (morphemes on the left, word log on the right) ────────
function drawer(tabId, panelId, closeId) {
  const tab = $(tabId);
  const panel = $(panelId);
  const set = (open) => { panel.hidden = !open; tab.setAttribute('aria-expanded', String(open)); tab.classList.toggle('open', open); };
  tab.addEventListener('click', (e) => { e.stopPropagation(); set(panel.hidden); });
  $(closeId).addEventListener('click', (e) => { e.stopPropagation(); set(false); });
  return set;
}
export const setInventoryOpen = drawer('tab-inventory', 'inventory', 'inv-collapse');
export const setLogOpen = drawer('tab-log', 'log', 'log-close');

// ── Camera buttons ────────────────────────────────────────────────
let camHandler = null;
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation();
  if (camHandler) camHandler(b.dataset.cam);
  flashCamera(b.dataset.cam);
}));
export function onCamera(fn) { camHandler = fn; }
export function flashCamera(action) {
  const b = document.querySelector(`[data-cam="${action}"]`);
  if (!b) return;
  b.classList.remove('pressed');
  void b.offsetWidth;
  b.classList.add('pressed');
}

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
    body.append(el('div', { class: 'clue-card sealed' }, 'The three keywords open the Secret Secretary Desk in the Hub.'));
    return;
  }
  $('tab-inventory').textContent = `MORPHEMES · ${profile.learned.length}`;
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

/**
 * A natural 20 on Mr. Phil's d20: CRITICAL HIT slams onto the screen, splits into its
 * morphemes (crit · ic · al  hit) with their meanings, then fades away.
 */
export function criticalHit() {
  const pieces = [
    { t: 'CRIT', type: 'base', m: 'to judge (Greek)' },
    { t: 'IC', type: 'sfx', m: 'relating to' },
    { t: 'AL', type: 'sfx', m: 'relating to' },
    { t: 'HIT', type: 'base', m: 'to strike (Old Norse)', gap: true },
  ];
  document.querySelectorAll('.crit').forEach((n) => n.remove());
  const word = el('div', { class: 'crit-word' }, pieces.map((p) => el('span', { class: `cp${p.gap ? ' gap' : ''}`, 'data-type': p.type }, el('span', { class: 'cp-t' }, p.t), el('span', { class: 'cp-m' }, p.m))));
  const root = el('div', { class: 'crit', role: 'status', 'aria-label': 'Critical hit! crit, ic, al, hit' }, el('div', { class: 'crit-kick' }, 'NATURAL 20'), word,
    el('div', { class: 'crit-sum' }, 'crit + ic + al → critical  ·  hit'));
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('in'));
  setTimeout(() => root.classList.add('in'), 30);
  setTimeout(() => root.classList.add('split'), 1300);
  setTimeout(() => root.classList.add('out'), 4600);
  setTimeout(() => root.remove(), 5500);
}

// ── Achievement fanfare ───────────────────────────────────────────
/**
 * CONGRATULATIONS! slams on, the achievement name and how it was earned sit below it.
 * The word breaks into its morphemes (con · grat · ul · ation · s), they swirl around the
 * middle like water circling a drain, shrink into the centre and vanish with a bubble pop.
 * Achievements earned together play one after another.
 */
const fanfareQueue = [];
let fanfareBusy = false;
const CONGRATS = [
  { t: 'CON', type: 'pfx', m: 'together' },
  { t: 'GRAT', type: 'base', m: 'thanks; pleasing' },
  { t: 'UL', type: 'sfx', m: 'little; doing' },
  { t: 'ATION', type: 'sfx', m: 'the act of' },
  { t: 'S', type: 'sfx', m: 'more than one' },
];

export function fanfare(item) {
  fanfareQueue.push(item);
  if (!fanfareBusy) nextFanfare();
}

function nextFanfare() {
  const item = fanfareQueue.shift();
  if (!item) { fanfareBusy = false; return; }
  fanfareBusy = true;
  const reduced = document.documentElement.classList.contains('reduced-motion');
  const pieces = CONGRATS.map((p) => el('span', { class: 'ff-piece', 'data-type': p.type }, el('span', { class: 'ff-t' }, p.t), el('span', { class: 'ff-m' }, p.m)));
  const bang = el('span', { class: 'ff-bang' }, '!');
  const word = el('div', { class: 'ff-word' }, ...pieces, bang);
  const swirl = el('div', { class: 'ff-swirl' });
  const pop = el('div', { class: 'ff-pop' });
  const info = el('div', { class: 'ff-info' },
    el('div', { class: 'ff-kick' }, '🏆 ACHIEVEMENT'),
    el('div', { class: 'ff-name' }, item.name),
    el('div', { class: 'ff-how' }, item.how),
    item.rewards && item.rewards.length ? el('div', { class: 'ff-rew' }, `Unlocked: ${item.rewards.join(', ')}`) : null);
  const root = el('div', { class: 'fanfare', role: 'status', 'aria-label': `Congratulations! ${item.name}. ${item.how}` }, word, swirl, pop, info);
  document.body.append(root);
  const at = (ms, fn) => setTimeout(fn, reduced ? Math.min(ms, 400) : ms);
  at(30, () => root.classList.add('in'));
  at(1100, () => root.classList.add('split'));
  // Hand each piece to the swirl at its current spot, as an angle and a distance from the centre.
  at(2700, () => {
    const box = swirl.getBoundingClientRect();
    const arms = pieces.map((p, i) => {
      const r = p.querySelector('.ff-t').getBoundingClientRect();
      const dx = r.left + r.width / 2 - box.left;
      const dy = r.top + r.height / 2 - box.top;
      const ang = Math.atan2(dy, dx) * (180 / Math.PI);
      const dist = Math.hypot(dx, dy);
      const arm = el('div', { class: 'ff-arm' }, el('span', { class: 'ff-orb', 'data-type': CONGRATS[i].type }, CONGRATS[i].t));
      arm.style.transform = `rotate(${ang}deg) translateX(${dist}px) rotate(${-ang}deg)`;
      swirl.append(arm);
      p.style.visibility = 'hidden';
      return { arm, ang };
    });
    bang.classList.add('gone');
    // Circle the drain: two more turns while the distance shrinks to nothing, so the path is a spiral.
    setTimeout(() => arms.forEach(({ arm, ang }) => {
      arm.style.transform = `rotate(${ang + 720}deg) translateX(0px) rotate(${-ang - 720}deg) scale(0.12)`;
    }), 40);
  });
  at(4450, () => { swirl.innerHTML = ''; pop.classList.add('go'); sfx.pop(); });
  at(5700, () => root.classList.add('out'));
  at(6400, () => { root.remove(); nextFanfare(); });
}

/** A small, quick celebration that doesn't stop play (every few morphemes, a new word discovered). */
export function miniCelebrate(text) {
  const colors = ['var(--pfx)', 'var(--base)', 'var(--sfx)', 'var(--cyan)', 'var(--green)'];
  const burst = el('div', { class: 'mini-cel' }, el('div', { class: 'mc-text' }, text));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const d = 70 + (i % 3) * 30;
    burst.append(el('span', { class: 'mc-chip', style: { background: colors[i % colors.length], '--dx': `${Math.round(Math.cos(a) * d)}px`, '--dy': `${Math.round(Math.sin(a) * d * 0.6)}px` } }));
  }
  document.body.append(burst);
  sfx.pickup();
  setTimeout(() => burst.remove(), 2300);
}
