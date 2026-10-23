/**
 * The nine beats of the Final Test, each an async runner: run(ctx, content) resolves when the beat
 * is cleared. Content comes from draw.js; ctx comes from fight.js:
 *
 *   ctx.stage            the beat's DOM area          ctx.miss()     costs a pip (false once the phase is lost)
 *   ctx.done(skill, ft)  scores one item             ctx.hit(big)   the Rot flinches
 *   ctx.key = fn         this beat's key handler      ctx.every(ms, fn) / ctx.after(ms, fn)   timers the fight clears
 *   ctx.compile(opts)    the Morph Compiler, with misses wired to pips; resolves when every task is solved
 *   ctx.mutation         this phase's Boss Rush mutation id, or null
 *
 * The rule that makes this a test: a wrong first answer costs a pip. The explanation always shows.
 */

import { el, shuffle } from '../../core/util.js';
import { morph } from '../../data/morphemes.js';
import { build, sumText, cutsMatch, glossLine } from '../../compiler/wordsum.js';
import { sfx, speak, sayMorph } from '../../core/audio.js';
import { settings } from '../../core/settings.js';
import { verdictOf } from '../../panels/debug.js';

const LETTER = ['1', '2', '3', '4'];

// ── Shared pieces ─────────────────────────────────────────────────

function tile(id, { bleached = false, big = false } = {}) {
  const m = morph(id);
  const b = el('button', { class: `mtile${big ? ' big' : ''}${bleached ? ' bleached' : ''}`, type: 'button', 'data-type': m.type, 'data-origin': bleached ? 'none' : m.origin }, m.text);
  b.addEventListener('click', () => sayMorph(id));
  return b;
}

function feedback(box, cls, title, ...rows) {
  box.innerHTML = '';
  box.append(el('div', { class: `feedback ${cls}` }, el('span', { class: 'title' }, title), ...rows.filter(Boolean).map((r) => el('span', { class: 'row' }, r))));
}

/** Three or four answer buttons; keys 1–4 pick too. onPick(index, button). */
function choices(ctx, options, onPick) {
  const row = el('div', { class: 'boss-choices' });
  const btns = options.map((o, i) => {
    const b = el('button', { class: 'btn boss-choice', type: 'button' }, el('kbd', { class: 'kc' }, LETTER[i]), ' ', o);
    b.addEventListener('click', () => { if (!b.disabled) onPick(i, b); });
    row.append(b);
    return b;
  });
  ctx.key = (e) => { const i = LETTER.indexOf(e.key); if (i >= 0 && btns[i] && !btns[i].disabled) { e.preventDefault(); btns[i].click(); } };
  return { row, btns };
}

/** Letters with clickable seams, like DEBUG. Returns { node, cuts, hint(expected) }. */
function seams(word) {
  const cuts = new Set();
  const node = el('div', { class: 'keys boss-keys' });
  const seamEls = [];
  [...word].forEach((ch, i) => {
    if (i > 0) {
      const s = el('button', { class: 'seam', type: 'button', 'aria-label': `Seam after letter ${i}` });
      s.addEventListener('click', () => { if (cuts.has(i)) cuts.delete(i); else cuts.add(i); s.classList.toggle('cut', cuts.has(i)); sfx.cut(); });
      seamEls[i] = s;
      node.append(s);
    }
    node.append(el('span', { class: 'key' }, ch));
  });
  return {
    node,
    cuts,
    hint(expected) { const miss = expected.find((c) => !cuts.has(c)); if (miss && seamEls[miss]) seamEls[miss].classList.add('hint'); },
    lock() { node.classList.add('split'); seamEls.forEach((s) => s && (s.disabled = true)); },
  };
}

const shake = (node) => { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); };
const counter = (have, need) => el('div', { class: 'boss-count' }, `${have} / ${need}`);

// ── 1 · Meaning Volley ────────────────────────────────────────────

/** Tiles fly at the Morpher one at a time. Pick the meaning before one lands. A miss is swapped for a spare. */
export async function volley(ctx, c) {
  const need = c.items.length;
  const queue = [...c.items];
  const spares = [...c.spares];
  let got = 0;
  const flight = ctx.mutation === 'haste' ? 6000 : 9000;
  const bleached = ctx.mutation === 'bleached';
  const lane = el('div', { class: 'volley-lane' });
  const fb = el('div', { class: 'boss-fb' });
  const count = counter(0, need);
  const slot = el('div');
  ctx.stage.append(count, lane, slot, fb);
  return new Promise((resolve) => {
    const next = () => {
      if (got >= need) { resolve(); return; }
      const it = queue.shift() || spares.shift() || c.items[Math.floor(ctx.rnd() * c.items.length)];
      lane.innerHTML = '';
      slot.innerHTML = '';
      const t = tile(it.id, { bleached, big: true });
      t.classList.add('volley-tile');
      t.style.setProperty('--flight', `${flight}ms`);
      const fuse = el('div', { class: 'boss-fuse' }, el('i', { style: { animationDuration: `${flight}ms` } }));
      lane.append(t, fuse);
      speak(morph(it.id).say || morph(it.id).text);
      let over = false;
      const settle = (ok, why) => {
        if (over) return;
        over = true;
        ctx.key = null;
        ctx.done('meaning', ok);
        if (ok) {
          got++;
          count.textContent = `${got} / ${need}`;
          sfx.good();
          t.classList.add('burst');
          ctx.hit();
          feedback(fb, 'good', `${morph(it.id).text} = ${morph(it.id).meaning} ✔`);
          ctx.after(700, next);
        } else {
          sfx.bad();
          t.classList.add('landed');
          feedback(fb, 'bad', why, `${morph(it.id).text} means "${morph(it.id).meaning}".`);
          if (!ctx.miss()) return;
          ctx.after(1900, next);
        }
      };
      const { row, btns } = choices(ctx, it.options, (i) => {
        btns.forEach((b, k) => { b.disabled = true; b.classList.toggle('btn-good', k === it.a); });
        settle(i === it.a, 'That tile landed a hit.');
      });
      slot.append(row);
      ctx.after(flight, () => settle(false, 'Too slow: the tile landed.'));
      fb.innerHTML = '';
    };
    next();
  });
}

// ── 2 · Twin Roots ────────────────────────────────────────────────

/** Wire each piece on the left to the piece on the right with the same meaning, from another language. */
export async function twins(ctx, c) {
  const bleached = ctx.mutation === 'bleached';
  const left = el('div', { class: 'twin-col' });
  const right = el('div', { class: 'twin-col' });
  const fb = el('div', { class: 'boss-fb' });
  ctx.stage.append(el('div', { class: 'twin-board' }, left, el('div', { class: 'twin-mid' }, '⇄'), right), fb);
  feedback(fb, 'info', 'Click a piece on the left, then its twin on the right.', 'Twins mean the same thing but come from different languages.');
  let sel = null;
  let linked = 0;
  const missed = new Set();
  const rights = shuffle([...c.pairs.map((p) => p.r), ...(c.decoy ? [c.decoy] : [])], ctx.rnd);
  return new Promise((resolve) => {
    const lefts = c.pairs.map((p) => {
      const b = tile(p.l, { bleached, big: true });
      b.addEventListener('click', () => {
        if (b.classList.contains('linked')) return;
        sel = p;
        [...left.children].forEach((x) => x.classList.toggle('sel', x === b));
      });
      left.append(b);
      return b;
    });
    rights.forEach((id) => {
      const b = tile(id, { bleached, big: true });
      b.addEventListener('click', () => {
        if (!sel || b.classList.contains('linked')) { if (!sel) feedback(fb, 'info', 'Pick a piece on the left first.'); return; }
        const p = sel;
        const lb = lefts[c.pairs.indexOf(p)];
        if (id === p.r) {
          sfx.good();
          ctx.hit();
          lb.classList.add('linked');
          b.classList.add('linked');
          lb.classList.remove('sel');
          lb.append(el('small', { class: 'twin-sense' }, p.sense));
          ctx.done('connect', !missed.has(p.l));
          linked++;
          feedback(fb, 'good', `Twins ✔  ${morph(p.l).text} = ${morph(p.r).text}`, `Both mean "${p.sense}". ${morph(p.l).text} is ${morph(p.l).origin === 'greek' ? 'Greek' : morph(p.l).origin === 'latin' ? 'Latin' : 'Anglo-Saxon'}; ${morph(p.r).text} is ${morph(p.r).origin === 'greek' ? 'Greek' : morph(p.r).origin === 'latin' ? 'Latin' : 'Anglo-Saxon'}.`);
          sel = null;
          if (linked === c.pairs.length) ctx.after(900, resolve);
        } else {
          sfx.bad();
          shake(b);
          missed.add(p.l);
          feedback(fb, 'bad', 'Not twins.', `${morph(p.l).text} means "${morph(p.l).meaning}". ${morph(id).text} means "${morph(id).meaning}".`);
          ctx.miss();
        }
      });
      right.append(b);
    });
  });
}

// ── 3 · Shape Shift, 7 · Meaning Forge (the Morph Compiler) ───────

export async function shape(ctx, c) {
  await ctx.compile({ mode: 'patch', tasks: c.tasks, skill: 'suffix', title: 'SHAPE SHIFT · turn the ending until the sentence works' });
}

export async function forge(ctx, c) {
  await ctx.compile({ mode: 'compile', tasks: c.tasks.map((t) => ({ m: t.m, p: t.p })), skill: 'compose', title: 'MEANING FORGE · build the word that means' });
}

// ── 4 · Swarm Debug ───────────────────────────────────────────────

const CALLS = [{ id: 'real', label: 'REAL' }, { id: 'misspelled', label: 'MISSPELLED' }, { id: 'nonword', label: 'NOT A WORD' }, { id: 'reversed', label: 'REVERSED' }];

/**
 * Six Rotlings crawl toward the Morpher. Clicking one freezes the swarm while you split it and call it.
 * One that reaches you bites (a pip) and crawls back. A wrong call costs a pip and a fresh Rotling takes its place.
 */
export async function swarm(ctx, c) {
  const need = c.items.length;
  const crawl = ctx.mutation === 'haste' ? 30000 : 45000;
  const spares = [...c.spares];
  let cleared = 0;
  let open = null;
  const field = el('div', { class: 'swarm-field' }, el('div', { class: 'swarm-morpher', 'aria-hidden': 'true' }, '🤖'));
  const desk = el('div', { class: 'swarm-desk' });
  const fb = el('div', { class: 'boss-fb' });
  const count = counter(0, need);
  ctx.stage.append(count, field, desk, fb);
  feedback(fb, 'info', 'Click a Rotling before it reaches you.', 'Split it at every seam, then call it: real, misspelled, not a word, or reversed.');
  const bugs = [];
  let openBug = null; // set once the beat's promise exists (it resolves the beat)
  const spawn = (item, lane, head = 0) => {
    const word = item.show || build(item.p).word;
    const b = { item, word, lane, x: head, node: el('button', { class: 'swarm-bug', type: 'button' }, '☣ ', word) };
    b.node.style.top = `${10 + lane * 14}%`;
    b.node.addEventListener('click', () => openBug && openBug(b));
    field.append(b.node);
    bugs.push(b);
    return b;
  };
  c.items.forEach((it, i) => spawn(it, i, -i * 0.07));
  window.__cmPanel = { kind: 'swarm', bugs, get open() { return open; } };
  return new Promise((resolve) => {
    ctx.every(100, () => {
      if (open) return;
      bugs.forEach((b) => {
        b.x += 100 / crawl;
        // Rotlings that haven't started yet wait in a line at the far edge.
        b.node.style.left = `${Math.min(92, Math.max(0, 92 - b.x * 86))}%`;
        b.node.classList.toggle('near', b.x > 0.75);
        if (b.x >= 1) {
          b.x = -0.05;
          sfx.rot();
          feedback(fb, 'bad', `${b.word} bit you!`, 'Debug them before they reach you.');
          ctx.miss();
        }
      });
    });
    openBug = (b) => {
      if (open) return;
      open = b;
      b.node.classList.add('open');
      desk.innerHTML = '';
      let erred = false;
      const res = build(b.item.p);
      const expected = b.item.cuts || res.cuts;
      const cutter = seams(b.word);
      const msg = el('div', { class: 'boss-fb' });
      const go = el('button', { class: 'btn btn-primary', type: 'button' }, `SPLIT ✂ (${expected.length} seam${expected.length === 1 ? '' : 's'})`);
      desk.append(cutter.node, go, msg);
      speak(b.word);
      ctx.key = (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } };
      go.addEventListener('click', () => {
        if (!cutsMatch([...cutter.cuts], expected, b.item.fake ? [] : res.altCuts)) {
          sfx.bad();
          shake(cutter.node);
          cutter.hint(expected);
          feedback(msg, 'bad', 'The Rotling shoves you back.', `${b.word} has ${expected.length} seam${expected.length === 1 ? '' : 's'}. A glowing seam shows one.`);
          if (!erred) { erred = true; ctx.miss(); }
          return;
        }
        sfx.split();
        cutter.lock();
        go.remove();
        feedback(msg, 'info', 'Clean cuts. Now call it.');
        const want = verdictOf(b.item);
        const { row, btns } = choices(ctx, CALLS.map((x) => x.label), (i) => {
          btns.forEach((x) => { x.disabled = true; });
          const ok = CALLS[i].id === want;
          const clean = b.item.fake === 'nonword' ? build(b.item.real).word : res.word;
          ctx.done('judge', ok && !erred);
          if (ok) {
            sfx.good();
            ctx.hit();
            cleared++;
            count.textContent = `${cleared} / ${need}`;
            feedback(fb, 'good', b.item.fake ? `${CALLS[i].label} ✔  ${b.word}` : `REAL ✔  ${b.word}`, b.item.why || glossLine(b.item.p));
          } else {
            sfx.bad();
            feedback(fb, 'bad', `It was ${CALLS.find((x) => x.id === want).label}.`, b.item.fake ? `${b.item.why} Clean word: ${clean}.` : `${b.item.p.map((id) => morph(id).text).join(' + ')} → ${res.word} is a real word.`);
            if (!erred && !ctx.miss()) return;
          }
          b.node.remove();
          bugs.splice(bugs.indexOf(b), 1);
          if (!ok) spawn(spares.shift() || c.items[Math.floor(ctx.rnd() * c.items.length)], b.lane, -0.15);
          desk.innerHTML = '';
          open = null;
          ctx.key = null;
          if (cleared >= need) ctx.after(800, resolve);
        });
        desk.append(row);
      });
    }
  });
}

// ── 5 · Spell Strike ──────────────────────────────────────────────

/** A word sum; type the word. No dials, no letters to pick from. */
export async function spell(ctx, c) {
  const need = c.items.length;
  const queue = [...c.items];
  const spares = [...c.spares];
  let got = 0;
  const count = counter(0, need);
  const sum = el('div', { class: 'spell-sum' });
  const input = el('input', { class: 'spell-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Type the word' });
  const go = el('button', { class: 'btn btn-primary', type: 'button' }, 'STRIKE ⏎');
  const fb = el('div', { class: 'boss-fb' });
  ctx.stage.append(count, sum, el('div', { class: 'spell-row' }, input, go), fb);
  feedback(fb, 'info', 'Type the whole word the pieces build.', 'Watch where the pieces join: some spellings change there, and some don\'t.');
  return new Promise((resolve) => {
    let it = null;
    let busy = false;
    const next = () => {
      if (got >= need) { resolve(); return; }
      it = queue.shift() || spares.shift() || c.items[Math.floor(ctx.rnd() * c.items.length)];
      sum.innerHTML = '';
      it.p.forEach((id, i) => { if (i) sum.append(el('span', { class: 'plus' }, '+')); sum.append(tile(id)); });
      sum.append(el('span', { class: 'plus' }, '='));
      input.value = '';
      input.disabled = false;
      busy = false;
      input.focus();
    };
    const strike = () => {
      if (busy || !it) return;
      const typed = input.value.trim().toLowerCase();
      if (!typed) return;
      busy = true;
      input.disabled = true;
      const ok = typed === it.word;
      ctx.done('spelling', ok);
      if (ok) {
        sfx.good();
        ctx.hit();
        got++;
        count.textContent = `${got} / ${need}`;
        speak(it.word);
        feedback(fb, 'good', `${it.word} ✔`, sumText(it.p));
        ctx.after(1100, next);
      } else {
        sfx.bad();
        feedback(fb, 'bad', `Not "${typed}".`, sumText(it.p));
        if (!ctx.miss()) return;
        ctx.after(2600, next);
      }
    };
    go.addEventListener('click', strike);
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); strike(); } });
    next();
  });
}

// ── 6 · Family Web ────────────────────────────────────────────────

/** Two bases, their families, and two look-alikes: a word is family only if it carries the base itself. */
export async function family(ctx, c) {
  const cards = shuffle([
    ...c.bases.flatMap((b, bi) => b.words.map((w) => ({ w, branch: bi }))),
    ...c.decoys.map((d) => ({ w: d.w, branch: -1, d })),
  ], ctx.rnd);
  const pool = el('div', { class: 'link-pool glass' });
  const branches = el('div', { class: 'branches' });
  const fb = el('div', { class: 'boss-fb' });
  ctx.stage.append(el('div', { class: 'link-board boss-link' }, pool, branches), fb);
  feedback(fb, 'info', 'Click a word, then the base it carries.', 'A word that only means something similar, or only looks similar, goes in NOT FAMILY.');
  let selected = null;
  let placed = 0;
  return new Promise((resolve) => {
    const lists = [];
    const branch = (head, meaning, bi) => {
      const list = el('div', { class: 'branch-list' });
      const node = el('div', { class: `branch${bi === -1 ? ' bin' : ''}`, role: 'button', tabindex: '0' }, head, el('div', { class: 'meaning' }, meaning), list);
      node.addEventListener('click', () => drop(bi));
      branches.append(node);
      lists[bi + 1] = list;
    };
    c.bases.forEach((b, bi) => branch(tile(b.id, { big: true }), morph(b.id).meaning, bi));
    branch(el('span', { class: 'mtile big', 'data-type': 'word', 'data-origin': 'lingo', style: { color: 'var(--red)' } }, 'NOT FAMILY'), 'only looks or means alike', -1);
    cards.forEach((card) => {
      card.el = el('button', { class: 'word-card', type: 'button' }, card.w);
      card.el.addEventListener('click', () => { selected = card; speak(card.w); cards.forEach((x) => x.el.classList.toggle('sel', x === card)); });
      pool.append(card.el);
    });
    function drop(bi) {
      if (!selected) { feedback(fb, 'info', 'Pick a word first.'); return; }
      const card = selected;
      selected = null;
      cards.forEach((x) => x.el.classList.remove('sel'));
      if (card.branch === bi) {
        sfx.good();
        ctx.hit();
        ctx.done('connect', !card.missed);
        card.el.remove();
        lists[bi + 1].append(el('span', { class: 'word-card placed' }, card.w));
        placed++;
        if (card.d) {
          const base = morph(card.d.base);
          const near = morph(card.d.near);
          feedback(fb, 'good', `Not family ✔  ${card.w}`, card.d.same
            ? `${card.w} carries ${base.text}, which means "${base.meaning}" like ${near.text}. Same meaning, different morpheme: not the same family.`
            : `${card.w} carries ${base.text} ("${base.meaning}"), not ${near.text}.`);
        } else feedback(fb, 'good', `Family ✔  ${card.w}`, `${card.w} carries ${morph(c.bases[bi].id).text}.`);
        if (placed === cards.length) ctx.after(900, resolve);
      } else {
        sfx.bad();
        shake(card.el);
        card.missed = true;
        feedback(fb, 'bad', bi === -1 ? `${card.w} IS family.` : card.d ? `${card.w} only looks or means alike.` : `${card.w} doesn't carry that base.`, 'Find the base hiding inside the word.');
        ctx.miss();
      }
    }
  });
}

// ── 8 · Word Detective ────────────────────────────────────────────

/** A word the player has never built: split it, read its pieces (no glosses given), choose its meaning. */
export async function detective(ctx, c) {
  const need = c.items.length;
  const queue = [...c.items];
  const spares = [...c.spares];
  let got = 0;
  const count = counter(0, need);
  const box = el('div', { class: 'detective-case' });
  const fb = el('div', { class: 'boss-fb' });
  ctx.stage.append(count, box, fb);
  return new Promise((resolve) => {
    const next = () => {
      if (got >= need) { resolve(); return; }
      const it = queue.shift() || spares.shift() || c.items[Math.floor(ctx.rnd() * c.items.length)];
      box.innerHTML = '';
      let erred = false;
      const cutter = seams(it.word);
      const go = el('button', { class: 'btn btn-primary', type: 'button' }, `SPLIT ✂ (${it.cuts.length} seams)`);
      box.append(el('div', { class: 'kicker' }, 'A WORD YOU HAVE NEVER BUILT'), cutter.node, go);
      speak(it.word);
      feedback(fb, 'info', 'Step 1: split it into morphemes.');
      ctx.key = (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } };
      go.addEventListener('click', () => {
        if (!cutsMatch([...cutter.cuts], it.cuts, it.alt)) {
          sfx.bad();
          shake(cutter.node);
          cutter.hint(it.cuts);
          feedback(fb, 'bad', 'Not quite.', `It has ${it.cuts.length} seams. A glowing seam shows one.`);
          if (!erred) { erred = true; ctx.miss(); }
          return;
        }
        sfx.split();
        cutter.lock();
        go.remove();
        box.append(el('div', { class: 'detective-pieces' }, it.p.filter((id) => morph(id).type !== 'link').map((id) => tile(id))));
        feedback(fb, 'info', 'Step 2: what does each piece mean? Then, what does the word mean?');
        const { row, btns } = choices(ctx, it.options, (i, b) => {
          const ok = i === it.a;
          if (ok) {
            btns.forEach((x) => { x.disabled = true; });
            b.classList.add('btn-good');
            sfx.good();
            ctx.hit();
            ctx.done('analysis', !erred);
            got++;
            count.textContent = `${got} / ${need}`;
            feedback(fb, 'good', `SOLVED ✔  ${it.word}`, `${it.options[it.a]}.`, glossLine(it.p));
            ctx.after(1500, next);
          } else {
            sfx.bad();
            b.disabled = true;
            ctx.done('analysis', false);
            feedback(fb, 'bad', 'Check it against the pieces.', glossLine(it.p), `So ${it.word}: "${it.options[it.a]}".`);
            btns.forEach((x) => { x.disabled = true; });
            if (!ctx.miss()) return;
            ctx.after(2800, next);
          }
        });
        box.append(row);
      });
    };
    next();
  });
}

// ── 9 · The Giant Word ────────────────────────────────────────────

/** The Rot's true name: cut it before the arena collapses, name every piece, say what it means, rebuild it. */
export async function giant(ctx, c) {
  const word = c.word;
  const head = el('div', { class: 'giant-word' }, word.toUpperCase());
  const area = el('div', { class: 'giant-area' });
  const fb = el('div', { class: 'boss-fb' });
  ctx.stage.append(head, area, fb);
  speak(word);

  // Strike 1: cut every seam before the floor gives way.
  await new Promise((resolve) => {
    const limit = ctx.mutation === 'haste' ? 45000 : 70000;
    let left = limit;
    let erred = false;
    const cutter = seams(word);
    const fuse = el('div', { class: 'boss-fuse long' }, el('i'));
    const go = el('button', { class: 'btn btn-primary', type: 'button' }, `SPLIT ✂ (${c.cuts.length} seams)`);
    area.append(el('div', { class: 'kicker' }, 'STRIKE 1 · CUT IT APART BEFORE THE FLOOR GIVES WAY'), fuse, cutter.node, go);
    feedback(fb, 'info', `${word} has ${c.cuts.length} seams.`);
    ctx.every(250, () => {
      left -= 250;
      fuse.firstChild.style.width = `${Math.max(0, (left / limit) * 100)}%`;
      if (left <= 0) {
        left = limit;
        sfx.crash();
        feedback(fb, 'bad', 'The floor cracks!', 'The arena gave way under you. Cut faster.');
        ctx.miss();
      }
    });
    ctx.key = (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } };
    go.addEventListener('click', () => {
      if (!cutsMatch([...cutter.cuts], c.cuts, c.alt)) {
        sfx.bad();
        shake(cutter.node);
        cutter.hint(c.cuts);
        feedback(fb, 'bad', 'The Rot shrugs off the cut.', 'A glowing seam shows one you missed.');
        erred = true;
        ctx.miss();
        return;
      }
      ctx.clearTimers();
      ctx.done('analysis', !erred);
      sfx.split();
      ctx.hit(true);
      cutter.lock();
      resolve();
    });
  });

  // Strike 2: name every piece.
  area.innerHTML = '';
  const pieces = el('div', { class: 'giant-pieces' });
  const ask = el('div');
  area.append(el('div', { class: 'kicker' }, 'STRIKE 2 · WHAT DOES EACH PIECE MEAN?'), pieces, ask);
  const tiles = c.tags.map((t) => { const b = tile(t.id, { big: true }); pieces.append(el('div', { class: 'giant-piece' }, b, el('small', {}, '?'))); return b; });
  for (let k = 0; k < c.tags.length; k++) {
    const t = c.tags[k];
    tiles.forEach((b, i) => b.classList.toggle('sel', i === k));
    let erred = false;
    await new Promise((resolve) => {
      ask.innerHTML = '';
      feedback(fb, 'info', `What does ${morph(t.id).text} mean?`);
      const { row, btns } = choices(ctx, t.options, (i, b) => {
        if (i === t.a) {
          btns.forEach((x) => { x.disabled = true; });
          sfx.good();
          ctx.done('meaning', !erred);
          tiles[k].parentNode.querySelector('small').textContent = morph(t.id).meaning;
          tiles[k].classList.add('linked');
          resolve();
        } else {
          sfx.bad();
          b.disabled = true;
          erred = true;
          feedback(fb, 'bad', `Not "${t.options[i]}".`, 'Think of another word with this piece in it.');
          ctx.miss();
        }
      });
      ask.append(row);
    });
  }
  ctx.hit(true);

  // Strike 3: the whole word.
  ask.innerHTML = '';
  area.querySelector('.kicker').textContent = 'STRIKE 3 · SO WHAT DOES IT MEAN?';
  await new Promise((resolve) => {
    let erred = false;
    feedback(fb, 'info', `Put the pieces together. What does ${word} mean?`);
    const { row, btns } = choices(ctx, c.options, (i, b) => {
      if (i === c.a) {
        btns.forEach((x) => { x.disabled = true; });
        b.classList.add('btn-good');
        sfx.good();
        ctx.done('analysis', !erred);
        feedback(fb, 'good', `${word} ✔`, c.meaning);
        resolve();
      } else {
        sfx.bad();
        b.disabled = true;
        erred = true;
        feedback(fb, 'bad', 'One piece doesn\'t fit that meaning.', 'Read each piece\'s meaning again, in order.');
        ctx.miss();
      }
    });
    ask.append(row);
  });
  ctx.hit(true);
  await new Promise((r) => ctx.after(1200, r));

  // Strike 4: rebuild it clean.
  await ctx.compile({ mode: 'finale', tasks: [{ m: `${word.toUpperCase()}: ${c.meaning}`, p: c.p }], skill: 'compose', title: 'FINAL STRIKE · rebuild its true name' });
}

export const RUN = { volley, twins, shape, swarm, spell, family, forge, detective, giant };
