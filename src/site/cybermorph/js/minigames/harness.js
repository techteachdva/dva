/**
 * The minigame harness: every morpheme is EARNED by a short game where you do what it means
 * (levels plan, Fix 3). The harness owns everything shared: the intro card, the stage, the
 * timer, win / miss, the easier retry after two misses, and the end card with the gloss.
 *
 * A family's game lives in js/minigames/<family id>.js and default-exports a template:
 *
 *   export default {
 *     seconds: 30,                       // time limit (the harness caps it at 45)
 *     howTo(m, sub) { return '…' },      // one line on the intro card: what to DO
 *     verb(m, sub) { return '…' },       // the end card's line: "You carried it across."
 *     start(ctx) { return { update(dt) {}, draw(g) {}, destroy() {} } },
 *   };
 *
 * ctx (one per attempt):
 *   id, m (the morpheme: text, meaning, type, origin), sub, family, tier (0 easy · 1 · 2 hard)
 *   W, H            the stage size in stage pixels (960 × 540); draw in these units
 *   input           { x, y, down, taps: [{x, y}], keys: Set, pressed: Set }  (taps and pressed empty each frame)
 *   tile            an Image of the morpheme's tile (ctx.tile.ready once loaded); tileOf(id) for any other
 *   palette         { ink, glow, bg, accent } for the morpheme's origin
 *   rnd()           seeded random for this attempt
 *   win()  lose(why)  end the attempt;  t  seconds since start;  sfx  the game's sounds
 *
 * A family with no file yet falls back to generic.js, so a level always works.
 */

import { el } from '../core/util.js';
import { openPanel, closeButton } from '../panels/host.js';
import { morph, TYPE_LABEL, ORIGIN_LABEL } from '../data/morphemes.js';
import { FAMILIES, FAMILY_OF, SUB_OF } from '../data/families.js';
import { morphemeDataUrl } from '../engine/textures.js';
import { onUpdate } from '../engine/renderer.js';
import { sfx, sayMorph } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { mtile } from '../ui/hud.js';

export const STAGE_W = 960;
export const STAGE_H = 540;
const MAX_SECONDS = 45;

const PALETTE = {
  anglo: { ink: '#ffd36b', glow: '#ffb000', bg: '#1a0d02', accent: '#ff7a1a' },
  latin: { ink: '#f2f4f8', glow: '#cfd6e2', bg: '#14161d', accent: '#9fc6ff' },
  greek: { ink: '#e8fbff', glow: '#38b6ff', bg: '#04122a', accent: '#7fe0ff' },
  lingo: { ink: '#20242c', glow: '#2f6fde', bg: '#f4f2ea', accent: '#2f6fde' },
};

const templates = new Map();
async function loadTemplate(family) {
  if (templates.has(family)) return templates.get(family);
  let t;
  try { t = (await import(`./${family}.js`)).default; } catch { t = null; }
  if (!t) t = (await import('./generic.js')).default;
  templates.set(family, t);
  return t;
}

const tileCache = new Map();
export function tileOf(id) {
  if (tileCache.has(id)) return tileCache.get(id);
  const img = new Image();
  img.onload = () => { img.ready = true; };
  img.src = morphemeDataUrl(id);
  tileCache.set(id, img);
  return img;
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Play the minigame that earns morpheme `id`.
 * @returns Promise<{ won: boolean, misses: number }>  (won is false only if the player closed it)
 */
export function playMinigame(id, { tier = 1, intro = true } = {}) {
  return new Promise(async (resolve) => {
    const m = morph(id);
    const family = FAMILY_OF[id] || 'generic';
    const sub = SUB_OF[id] || null;
    const fam = FAMILIES[family] || { name: 'Morpheme' };
    const tpl = await loadTemplate(family);
    const panel = openPanel({ dim: 0.72, className: 'minigame-panel' });
    const palette = PALETTE[m.origin] || PALETTE.latin;
    let misses = 0;
    let curTier = tier;
    let run = null;
    let unhook = null;

    const canvas = el('canvas', { class: 'mg-stage', width: STAGE_W, height: STAGE_H });
    const g = canvas.getContext('2d');
    const timeBar = el('div', { class: 'mg-time' }, el('i'));
    const head = el('section', { class: 'glass mg-head' },
      el('div', { class: 'kicker' }, `EARN IT · ${fam.name.toUpperCase()}`),
      el('div', { class: 'mg-title' }, mtile(id), el('span', { class: 'mg-mean' }, `“${m.meaning}”`)));
    const card = el('section', { class: 'glass mg-card' });
    const stageWrap = el('div', { class: 'mg-wrap' }, canvas, timeBar, card);
    panel.root.append(head, stageWrap, closeButton(() => finish(false)));

    // Input in stage pixels.
    const input = { x: STAGE_W / 2, y: STAGE_H / 2, down: false, taps: [], keys: new Set(), pressed: new Set() };
    const toStage = (e) => {
      const r = canvas.getBoundingClientRect();
      input.x = ((e.clientX - r.left) / r.width) * STAGE_W;
      input.y = ((e.clientY - r.top) / r.height) * STAGE_H;
    };
    canvas.addEventListener('pointerdown', (e) => { toStage(e); input.down = true; input.taps.push({ x: input.x, y: input.y }); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', toStage);
    canvas.addEventListener('pointerup', (e) => { toStage(e); input.down = false; });
    const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd'];
    panel.onKey((e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
      if (card.dataset.state && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        const b = card.querySelector('button.btn-primary, button.btn-good');
        if (b) b.click();
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (GAME_KEYS.includes(k)) { e.preventDefault(); if (!input.keys.has(k)) input.pressed.add(k); input.keys.add(k); }
    });
    const onUp = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; input.keys.delete(k); };
    window.addEventListener('keyup', onUp);

    function showCard(state, ...rows) {
      card.dataset.state = state;
      card.innerHTML = '';
      card.hidden = false;
      card.append(...rows.filter(Boolean));
      const b = card.querySelector('button.btn-primary, button.btn-good');
      if (b) setTimeout(() => b.focus(), 30);
    }

    function introCard() {
      const go = el('button', { class: 'btn btn-primary', type: 'button' }, 'GO ▸');
      const hear = el('button', { class: 'btn', type: 'button' }, '🔊 Hear it');
      hear.addEventListener('click', () => sayMorph(id));
      go.addEventListener('click', start);
      showCard('intro',
        el('div', { class: 'mg-big' }, mtile(id, { big: true })),
        el('div', { class: 'mg-line' }, `${ORIGIN_LABEL[m.origin]} ${TYPE_LABEL[m.type]} · means “${m.meaning}”`),
        el('div', { class: 'mg-how' }, tpl.howTo ? tpl.howTo(m, sub) : 'Win the game to earn it.'),
        el('div', { class: 'row-btns' }, hear, go));
      sayMorph(id);
    }

    function start() {
      card.hidden = true;
      card.dataset.state = '';
      const seconds = Math.min(MAX_SECONDS, tpl.seconds || 30) * (curTier === 0 ? 1.25 : 1);
      let ended = false;
      const ctx = {
        id, m, sub, family, tier: curTier, W: STAGE_W, H: STAGE_H, input, palette, sfx,
        tile: tileOf(id), tileOf, rnd: seeded(Date.now()), t: 0, seconds,
        win() { if (ended) return; ended = true; won(); },
        lose(why) { if (ended) return; ended = true; lost(why); },
      };
      run = { ctx, game: tpl.start(ctx) };
      if (unhook) unhook();
      unhook = onUpdate({
        update: (dt) => {
          if (!run || panel.closed) return;
          ctx.t += dt;
          if (!ended) run.game.update && run.game.update(dt);
          g.save();
          g.fillStyle = palette.bg;
          g.fillRect(0, 0, STAGE_W, STAGE_H);
          run.game.draw && run.game.draw(g);
          g.restore();
          input.taps.length = 0;
          input.pressed.clear();
          const left = Math.max(0, 1 - ctx.t / seconds);
          timeBar.firstChild.style.width = `${left * 100}%`;
          timeBar.classList.toggle('low', left < 0.25);
          if (!ended && left <= 0) ctx.lose('time');
        },
      });
    }

    function stopRun() {
      if (run && run.game.destroy) run.game.destroy();
      run = null;
      if (unhook) { unhook(); unhook = null; }
    }

    function won() {
      sfx.unlock();
      const verb = tpl.verb ? tpl.verb(m, sub) : 'Done.';
      const collect = el('button', { class: 'btn btn-good', type: 'button' }, 'COLLECT ▸');
      collect.addEventListener('click', () => finish(true));
      setTimeout(() => {
        stopRun();
        showCard('won',
          el('div', { class: 'kicker' }, 'EARNED ✔'),
          el('div', { class: 'mg-big' }, mtile(id, { big: true })),
          el('div', { class: 'mg-verb' }, verb),
          el('div', { class: 'mg-line' }, `${m.text} = ${m.meaning}`),
          el('div', { class: 'row-btns' }, collect));
        sayMorph(id);
      }, settings.reducedMotion ? 0 : 450);
    }

    function lost(why) {
      sfx.bad();
      misses += 1;
      // Feed, then poke, but not too much: two misses in a row make the next try easier.
      if (misses >= 2 && curTier > 0) curTier -= 1;
      const again = el('button', { class: 'btn btn-primary', type: 'button' }, 'AGAIN ▸');
      again.addEventListener('click', start);
      setTimeout(() => {
        stopRun();
        showCard('lost',
          el('div', { class: 'kicker' }, why === 'time' ? 'OUT OF TIME' : 'THE ROT GOT THERE FIRST'),
          el('div', { class: 'mg-how' }, tpl.howTo ? tpl.howTo(m, sub) : ''),
          misses >= 2 ? el('div', { class: 'mg-line' }, 'This one\'s a little easier.') : null,
          el('div', { class: 'row-btns' }, again));
      }, settings.reducedMotion ? 0 : 350);
    }

    function finish(ok) {
      if (panel.closed) return;
      stopRun();
      window.removeEventListener('keyup', onUp);
      panel.close();
      resolve({ won: ok, misses });
    }

    if (intro) introCard(); else start();
    // Playtest hook: the bot wins minigames through this (dev only; students never see it).
    window.__cmPanel = { kind: 'minigame', id, family, get state() { return card.dataset.state || 'play'; }, autoWin: () => run && run.ctx.win() };
  });
}
