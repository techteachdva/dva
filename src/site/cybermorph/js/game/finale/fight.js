/**
 * The Final Test: three phases of three beats against the Rot (data/finale.js, draw.js, beats.js).
 *
 *   Integrity  PIPS per phase. A wrong first answer costs one; the explanation still shows.
 *   Rewrite    0 pips: the Rot rewrites the phase. It restarts with fresh draws. Beaten phases stay
 *              beaten (the story fight keeps them in profile.finale.checkpoint; there is no game over).
 *   Mutations  Rematches and Boss Rush roll one per phase, so a won fight can't be memorized.
 *   Results    Every item scores first-try or not, by skill, for the Test Results card.
 *
 * The arena reacts through hooks (game.js): onPhase, onHit, onMiss, onBeat.
 */

import { el, readLock, readLocked } from '../../core/util.js';
import { openPanel, closeButton } from '../../panels/host.js';
import { openCompile } from '../../panels/compile.js';
import { confirmBox } from '../../ui/screens.js';
import { sfx } from '../../core/audio.js';
import { seeded, newSeed } from '../../core/rng.js';
import { PHASES, BEATS, PIPS, MUTATIONS, ROT_LINES, ACADEMIC } from '../../data/finale.js';
import { morph } from '../../data/morphemes.js';
import { drawContext, drawPhase } from './draw.js';
import { RUN } from './beats.js';

const pickLine = (list, rnd) => list[Math.floor(rnd() * list.length)];

/**
 * Run the fight. rush: Boss Rush (scored, always mutated, no checkpoint). from: dev console's
 * { phase, beat } to start at. Resolves { won, retreat, results, seconds, rewrites, misses, score, seed }.
 */
export function runFight({ profile, rush = false, seed = newSeed(), from = null, hooks = {} }) {
  const rnd = seeded(seed);
  const story = !rush;
  const fin = profile.finale || (profile.finale = { beaten: false });
  const mutate = rush || fin.beaten;
  const mutations = PHASES.map(() => (mutate ? MUTATIONS[Math.floor(rnd() * MUTATIONS.length)].id : null));
  const startPhase = from ? from.phase : story ? Math.min(2, fin.checkpoint || 0) : 0;
  const results = {};
  const started = performance.now();
  let rewrites = 0;
  let misses = 0;

  const panel = openPanel({ dim: 0.4, className: 'boss-panel' });
  const phaseName = el('div', { class: 'boss-phase' });
  const beatName = el('div', { class: 'boss-beat' });
  const mutTag = el('div', { class: 'boss-mut', hidden: true });
  const rotBar = el('div', { class: 'boss-rotbar', 'aria-label': 'The Rot' }, BEATS.map((b, i) => el('i', { class: i % 3 === 2 ? 'end' : '' })));
  const pipRow = el('div', { class: 'boss-pips', 'aria-live': 'polite' });
  const rotSays = el('div', { class: 'boss-says', 'aria-live': 'polite' });
  const stage = el('section', { class: 'boss-stage glass' });
  panel.root.append(
    el('header', { class: 'boss-head glass' }, el('div', { class: 'boss-titles' }, phaseName, beatName, mutTag), el('div', { class: 'boss-bars' }, el('div', { class: 'boss-label' }, 'THE ROT'), rotBar, el('div', { class: 'boss-label' }, 'INTEGRITY'), pipRow)),
    rotSays, stage, closeButton(() => retreat()));

  let pips = 0;
  let maxPips = PIPS;
  let lose = null;
  let quit = null;
  let ctx = null;

  const paintPips = () => {
    pipRow.innerHTML = '';
    for (let i = 0; i < maxPips; i++) pipRow.append(el('i', { class: i < pips ? 'on' : '' }));
    pipRow.setAttribute('aria-label', `${pips} of ${maxPips} integrity left`);
  };
  const paintRot = (beatIndex) => [...rotBar.children].forEach((s, i) => { s.classList.toggle('gone', i < beatIndex); s.classList.toggle('now', i === beatIndex); });
  const say = (text) => {
    rotSays.textContent = text;
    rotSays.classList.remove('pop');
    void rotSays.offsetWidth;
    rotSays.classList.add('pop');
  };

  /** A full-stage card with a read-locked button (phase starts, rewrites, beat briefings). */
  const card = (kicker, title, rows, button, lockMs) => new Promise((resolve) => {
    stage.innerHTML = '';
    const go = el('button', { class: 'btn btn-primary boss-go', type: 'button' }, button);
    stage.append(el('div', { class: 'boss-card' }, el('div', { class: 'kicker' }, kicker), el('h2', {}, title), ...rows.map((r) => el('p', {}, r)), go));
    readLock(go, lockMs);
    const press = () => { if (readLocked(go)) return; keyFn = null; resolve(); };
    go.addEventListener('click', press);
    keyFn = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(); } };
    setTimeout(() => go.focus(), 50);
  });
  let keyFn = null;
  panel.onKey((e) => {
    // The compiler and confirm boxes handle their own keys (Escape closes them, not the fight).
    if (document.querySelector('.compile-panel, .screen')) return;
    if (e.key === 'Escape') { e.preventDefault(); retreat(); return; }
    if (ctx && ctx.key && !ctx.dead) ctx.key(e);
    else if (keyFn) keyFn(e);
  });

  async function retreat() {
    const yes = await confirmBox(rush ? 'Leave Boss Rush? This run won\'t be scored.' : 'Retreat from the Rot? Phases you beat stay beaten.', 'Retreat', 'Keep fighting');
    if (yes && quit) quit();
  }

  /** The beat's toolkit (see beats.js). */
  function makeCtx(beat, mutation) {
    const timers = [];
    const c = {
      stage, rnd, mutation, profile, dead: false, key: null, compileControl: null,
      miss() {
        if (c.dead) return false;
        misses++;
        pips--;
        paintPips();
        hooks.onMiss && hooks.onMiss();
        say(pickLine(ROT_LINES.miss, rnd));
        if (pips <= 0) { c.dead = true; lose(); return false; }
        return true;
      },
      done(skill, firstTry) {
        const r = results[skill] || (results[skill] = { n: 0, ft: 0 });
        r.n++;
        if (firstTry) r.ft++;
      },
      hit(big = false) {
        hooks.onHit && hooks.onHit(big);
        if (big || rnd() < 0.25) say(pickLine(ROT_LINES.hit, rnd));
      },
      after(ms, fn) { const t = setTimeout(() => { if (!c.dead) fn(); }, ms); timers.push(['t', t]); return t; },
      every(ms, fn) { const t = setInterval(() => { if (!c.dead && !document.querySelector('.compile-panel, .screen')) fn(); }, ms); timers.push(['i', t]); return t; },
      clearTimers() { timers.forEach(([k, t]) => (k === 't' ? clearTimeout(t) : clearInterval(t))); timers.length = 0; },
      /** The Morph Compiler for a beat: misses cost pips, firstTry scores, and closing it asks to retreat. */
      async compile({ mode, tasks, skill, title }) {
        let left = [...tasks];
        while (left.length && !c.dead) {
          const control = {};
          c.compileControl = control;
          const solved = [];
          await openCompile({ mode, tasks: left, profile, title, control,
            pool: profile.learned.filter((id) => ACADEMIC.includes(morph(id).origin)),
            onMiss: () => { c.miss(); },
            onSolved: (task, info) => { solved.push(task); c.done(skill, !!(info && info.firstTry)); c.hit(); } });
          c.compileControl = null;
          left = left.filter((t) => !solved.includes(t));
          if (left.length && !c.dead) {
            const yes = await confirmBox(rush ? 'Leave Boss Rush? This run won\'t be scored.' : 'Retreat from the Rot? Phases you beat stay beaten.', 'Retreat', 'Keep fighting');
            if (yes) { quit(); return new Promise(() => {}); }
          }
        }
        if (c.dead) return new Promise(() => {});
      },
      teardown() {
        c.dead = true;
        c.clearTimers();
        if (c.compileControl && c.compileControl.close) c.compileControl.close();
        c.key = null;
      },
    };
    return c;
  }

  return new Promise((resolve) => {
    const finish = (out) => {
      if (ctx) ctx.teardown();
      panel.close();
      const seconds = Math.round((performance.now() - started) / 1000);
      const all = Object.values(results).reduce((a, r) => ({ n: a.n + r.n, ft: a.ft + r.ft }), { n: 0, ft: 0 });
      const score = Math.max(0, all.ft * 100 + (all.n - all.ft) * 30 + Math.max(0, 900 - seconds) * 3 - rewrites * 400);
      resolve({ ...out, results, seconds, rewrites, misses, score, seed, mutations });
    };
    quit = () => finish({ won: false, retreat: true });

    (async () => {
      for (let p = startPhase; p < PHASES.length; p++) {
        const phase = PHASES[p];
        const mut = mutations[p] ? MUTATIONS.find((m) => m.id === mutations[p]) : null;
        let firstBeat = from && p === from.phase ? from.beat : 0;
        let rewritten = false;
        for (;;) {
          maxPips = PIPS - (mut && mut.id === 'lean' ? 1 : 0);
          pips = maxPips;
          paintPips();
          paintRot(p * 3 + firstBeat);
          phaseName.textContent = `PHASE ${p + 1} · ${phase.name}`;
          beatName.textContent = phase.goal;
          mutTag.hidden = !mut;
          if (mut) mutTag.textContent = `MUTATION: ${mut.name} · ${mut.note}`;
          hooks.onPhase && hooks.onPhase(p);
          const beats = drawPhase(p, rnd, drawContext(profile), mut && mut.id);
          say(rewritten ? pickLine(ROT_LINES.rewrite, rnd) : phase.intro[0]);
          await card(`PHASE ${p + 1} OF 3`, `${phase.name}: ${phase.goal.toUpperCase()}`,
            [rewritten ? 'The Rot rewrote this phase with new words. Your integrity is full again.' : `Three beats. You have ${maxPips} integrity. A wrong first answer costs one. Lose them all and the Rot rewrites this phase.`, mut ? `Mutation: ${mut.name}. ${mut.note}` : null].filter(Boolean),
            rewritten ? 'TRY AGAIN ▸' : 'FIGHT ▸', rewritten ? 1500 : 2500);
          let lost = false;
          for (let k = firstBeat; k < 3; k++) {
            const { beat, content } = beats[k];
            const index = BEATS.indexOf(beat);
            paintRot(index);
            beatName.textContent = `BEAT ${index + 1} OF 9 · ${beat.name.toUpperCase()}`;
            say(beat.taunt);
            await card(`BEAT ${index + 1} · ${phase.name}`, beat.name, [beat.how], 'GO ▸', 1200);
            stage.innerHTML = '';
            ctx = makeCtx(beat, mut && mut.id);
            // Playtest hook (read-only), like the panels' window.__cmPanel.
            window.__cmBoss = { beat: beat.id, content, phase: p, get pips() { return pips; } };
            const lostP = new Promise((r) => { lose = () => r('lost'); });
            const outcome = content ? await Promise.race([RUN[beat.id](ctx, content).then(() => 'cleared'), lostP]) : 'cleared';
            ctx.teardown();
            ctx = null;
            if (outcome === 'lost') { lost = true; break; }
            sfx.crash();
            hooks.onBeat && hooks.onBeat(index);
            paintRot(index + 1);
          }
          if (!lost) break;
          rewrites++;
          rewritten = true;
          firstBeat = 0;
          sfx.crash();
          hooks.onRewrite && hooks.onRewrite(p);
        }
        if (story) { fin.checkpoint = p + 1; hooks.onSave && hooks.onSave(); }
        if (p < PHASES.length - 1) {
          say(pickLine(ROT_LINES.phaseDown, rnd));
          await card('PHASE CLEARED', `${phase.name} is broken`, ['The Rot is changing shape.'], 'NEXT PHASE ▸', 1500);
        }
      }
      say(ROT_LINES.defeat[0]);
      if (story) { fin.checkpoint = 0; hooks.onSave && hooks.onSave(); }
      finish({ won: true, retreat: false });
    })();
  });
}

/** One number per skill, 0–100, for the results card and the report. */
export function skillPercents(results) {
  return Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.n ? Math.round((100 * r.ft) / r.n) : 0]));
}
export const overallPercent = (results) => {
  const all = Object.values(results).reduce((a, r) => ({ n: a.n + r.n, ft: a.ft + r.ft }), { n: 0, ft: 0 });
  return all.n ? Math.round((100 * all.ft) / all.n) : 0;
};
