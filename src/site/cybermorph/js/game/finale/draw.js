/**
 * What each beat of the Final Test asks, drawn fresh every run from what the player has earned.
 * Pure data in, data out (no DOM), and every draw takes a seeded rnd, so
 * scripts/audit-cybermorph-finale.mjs can draw a thousand fights in Node.
 *
 * Only Anglo-Saxon, Latin and Greek. Every item carries what the panel needs to explain a miss.
 */

import { MORPHEMES, morph } from '../../data/morphemes.js';
import { build } from '../../compiler/wordsum.js';
import { BANK } from '../../data/bank.js';
import { DISTRICTS, MAIN_ORDER } from '../../data/world.js';
import { allWords, isKnown, fakeFor, rollCalls } from '../waves.js';
import { shuffle, pick } from '../../core/util.js';
import { ACADEMIC, GIANTS, BEATS } from '../../data/finale.js';

const DAY = 24 * 60 * 60 * 1000;
const STUDY_DAYS = [1, 1, 3, 7, 14];
const academic = (m) => m && ACADEMIC.includes(m.origin);
const freeAnglo = (m) => m.type === 'base' && m.origin === 'anglo';
/** First sense of a gloss, for "same meaning" checks: "to carry; to bring" → "carry". */
const sense = (m) => m.meaning.split(/[;,(]/)[0].trim().toLowerCase().replace(/^(to|a|an|the) /, '');
const pieceIds = (ids) => ids.filter((id) => morph(id).type !== 'link');
const BANK_BY_WORD = new Map(BANK.map((b) => [b.word, b]));

/**
 * The player as the draws see them.
 *   learned   Set of earned morpheme ids
 *   lexicon   Set of words already built
 *   mastery   profile.mastery (weights the Volley toward weak and fading morphemes)
 *   firstRun  the Rot has never been beaten (the true form is Triskaidekaphobia)
 */
export function drawContext(profile) {
  return {
    learned: new Set(profile.learned.filter((id) => academic(MORPHEMES[id]))),
    lexicon: new Set((profile.lexicon || []).map((w) => w.w)),
    mastery: profile.mastery || {},
    firstRun: !(profile.finale && profile.finale.beaten),
  };
}

/** Words the player can read: academic, every piece earned (Anglo-Saxon free bases count). */
function readable(ctx, { min = 2, max = 9 } = {}) {
  return allWords().filter((w) => ACADEMIC.includes(w.origin) && w.ids.length >= min && w.ids.length <= max
    && w.ids.every((id) => academic(MORPHEMES[id])) && isKnown(w.ids, ctx.learned));
}

/** Weighted pick without replacement. */
function takeWeighted(list, weight, n, rnd) {
  const left = [...list];
  const out = [];
  while (out.length < n && left.length) {
    const total = left.reduce((a, x) => a + weight(x), 0);
    let r = rnd() * total;
    let i = 0;
    for (; i < left.length - 1; i++) { r -= weight(left[i]); if (r < 0) break; }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

const STOP = new Set(['the', 'of', 'a', 'an', 'to', 'or', 'and', 'in', 'on', 'is', 'it', 'be', 'being', 'one', 'who', 'that', 'with', 'state', 'act', 'something']);
/** The content words of a gloss, so "the act of; the result of" and "the act or result of" count as one meaning. */
const contentWords = (s) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOP.has(w)));
const overlaps = (a, b) => { const B = contentWords(b); return [...contentWords(a)].some((w) => B.has(w)) || a.toLowerCase() === b.toLowerCase(); };

/** n meanings that are not this morpheme's and share no content word with it or each other: same type first. */
function wrongMeanings(id, n, rnd) {
  const m = morph(id);
  const out = [];
  const pools = [
    Object.values(MORPHEMES).filter((x) => academic(x) && x.type === m.type && x.origin === m.origin),
    Object.values(MORPHEMES).filter((x) => academic(x) && x.type === m.type),
    Object.values(MORPHEMES).filter((x) => academic(x)),
  ];
  for (const pool of pools) {
    for (const x of shuffle(pool, rnd)) {
      if (out.length >= n) return out;
      if ([m.meaning, ...out].some((s) => overlaps(s, x.meaning))) continue;
      out.push(x.meaning);
    }
  }
  return out;
}

function choice(right, wrong, rnd) {
  const options = shuffle([right, ...wrong], rnd);
  return { options, a: options.indexOf(right) };
}

// ── Phase 1: THE SHELL ────────────────────────────────────────────

/** Meaning Volley: earned pieces, two per origin, weighted toward weak and fading ones. */
export function drawVolley(rnd, ctx, n = 6, spares = 6) {
  const now = Date.now();
  const weight = (id) => {
    const r = ctx.mastery[id];
    if (!r) return 4;
    const fading = now - r.t > STUDY_DAYS[r.l] * DAY;
    return 1 + (4 - r.l) + (fading ? 2 : 0);
  };
  const ids = [...ctx.learned].filter((id) => ['pfx', 'base', 'sfx'].includes(morph(id).type) && morph(id).text.length >= 2);
  const byText = new Set();
  const uniq = (list) => list.filter((id) => !byText.has(morph(id).text) && byText.add(morph(id).text));
  const picked = [];
  ACADEMIC.forEach((o) => picked.push(...uniq(takeWeighted(ids.filter((id) => morph(id).origin === o), weight, Math.ceil(n / 3), rnd))));
  const rest = uniq(takeWeighted(ids.filter((id) => !picked.includes(id)), weight, n + spares, rnd));
  const all = [...shuffle(picked, rnd), ...rest].slice(0, n + spares);
  const items = all.map((id) => ({ id, ...choice(morph(id).meaning, wrongMeanings(id, 2, rnd), rnd) }));
  return { items: items.slice(0, n), spares: items.slice(n) };
}

/** Twin Roots: n pieces, each wired to its twin from another language; one decoy twin means something else. */
export function drawTwins(rnd, ctx, n = 4) {
  const ok = (m) => academic(m) && ['pfx', 'base', 'sfx'].includes(m.type) && m.text.length >= 2 && (ctx.learned.has(m.id) || freeAnglo(m));
  const groups = {};
  Object.values(MORPHEMES).filter(ok).forEach((m) => { (groups[sense(m)] ||= []).push(m); });
  const usable = Object.entries(groups).filter(([, list]) => new Set(list.map((m) => m.origin)).size >= 2);
  const chosen = shuffle(usable, rnd).slice(0, n);
  const pairs = chosen.map(([s, list]) => {
    const left = pick(list.filter((m) => m.origin !== 'anglo').length ? list.filter((m) => m.origin !== 'anglo') : list, rnd);
    const right = pick(list.filter((m) => m.origin !== left.origin), rnd);
    return { l: left.id, r: right.id, sense: s };
  });
  const usedSenses = new Set(chosen.map(([s]) => s));
  const decoyPool = Object.values(MORPHEMES).filter((m) => ok(m) && !usedSenses.has(sense(m)) && pairs.some((p) => morph(p.l).type === m.type));
  const decoy = decoyPool.length ? pick(decoyPool, rnd).id : null;
  return { pairs, decoy };
}

/** Shape Shift: firewall sentences from all three rooms. */
export function drawShape(rnd, ctx, n = 3) {
  const tasks = MAIN_ORDER.flatMap((d) => DISTRICTS[d].rooms.flatMap((r) => (r.gate ? r.gate.tasks : [])))
    .filter((t) => t.fixed && t.ring && t.fixed.every((id) => academic(MORPHEMES[id])));
  return { tasks: shuffle(tasks, rnd).slice(0, n) };
}

// ── Phase 2: THE SWARM ────────────────────────────────────────────

/**
 * Swarm Debug: six Rotlings with every call at least once (real, misspelled, not a word, reversed).
 * mirror: the two extra are always fakes. Spares replace a Rotling called wrong.
 */
export function drawSwarm(rnd, ctx, { mirror = false, n = 6, spares = 8 } = {}) {
  const words = shuffle(readable(ctx, { min: 2, max: 4 }), rnd);
  const extra = (count) => (mirror ? Array.from({ length: count }, () => pick(['misspelled', 'nonword', 'reversed'], rnd)) : rollCalls(count));
  const calls = [...shuffle(['real', 'misspelled', 'nonword', 'reversed', ...extra(n - 4)], rnd), ...extra(spares)];
  const used = new Set();
  const bases = new Set();
  const items = [];
  for (const call of calls) {
    for (const w of words) {
      const base = w.ids.find((id) => morph(id).type === 'base') || w.ids[0];
      if (used.has(w.word) || bases.has(base)) continue;
      const item = call === 'real' ? { p: w.ids } : fakeFor(w, call, ctx.learned);
      if (!item) continue;
      used.add(w.word);
      bases.add(base);
      items.push({ ...item, word: w.word });
      break;
    }
  }
  return { items: items.slice(0, n), spares: items.slice(n) };
}

const RULE_GROUP = { 'drop-e': 'e', 'merge-e': 'e', double: 'double', 'y-i': 'y', assim: 'prefix', elide: 'prefix' };

/** Spell Strike: three different spelling rules and one sum where nothing changes (but looks like it might). */
export function drawSpell(rnd, ctx, n = 4, spares = 4) {
  const words = shuffle(readable(ctx, { min: 2, max: 3 }), rnd);
  const groups = {};
  const plain = [];
  words.forEach((w) => {
    const res = build(w.ids);
    if (res.word !== w.word) return;
    if (res.steps.length) (groups[RULE_GROUP[res.steps[0].kind]] ||= []).push(w);
    else {
      // A sum where a rule only looks like it should fire: hope + ful, play + ed, re + port.
      const parts = res.parts;
      const tempting = parts.some((p, i) => i < parts.length - 1 && /[ey]$/.test(p.text)) || parts.some((p, i) => i > 0 && p.type === 'sfx' && /^[aeiouy]/.test(p.text) && /[^aeiou][aeiou][^aeiouwxy]$/.test(parts[i - 1].text));
      if (tempting) plain.push(w);
    }
  });
  const kinds = shuffle(Object.keys(groups), rnd);
  const order = [];
  kinds.slice(0, n - 1).forEach((k) => order.push(groups[k].shift()));
  if (plain.length) order.push(plain.shift());
  const pool = shuffle([...Object.values(groups).flat(), ...plain], rnd);
  while (order.length < n + spares && pool.length) order.push(pool.shift());
  const items = order.filter(Boolean).map((w) => ({ p: w.ids, word: w.word }));
  return { items: shuffle(items.slice(0, n), rnd), spares: items.slice(n) };
}

/** Family Web: two bases, three of each family, and two look-alikes that share a meaning or a few letters but not the base. */
export function drawFamily(rnd, ctx) {
  const words = readable(ctx, { min: 2, max: 4 });
  const fam = {};
  words.forEach((w) => w.ids.filter((id) => morph(id).type === 'base' && !freeAnglo(morph(id))).forEach((b) => { (fam[b] ||= []).push(w.word); }));
  // scrib and script, duc and duct: one Latin root, two spellings. Those are family, never decoys.
  const allomorph = (x, y) => morph(x).origin === morph(y).origin && (sense(morph(x)) === sense(morph(y)) || morph(x).text.slice(0, 3) === morph(y).text.slice(0, 3));
  const big = shuffle(Object.keys(fam).filter((b) => fam[b].length >= 3), rnd);
  const A = big[0];
  const B = big.find((b) => b !== A && !allomorph(A, b) && sense(morph(b)) !== sense(morph(A)) && !fam[b].some((w) => fam[A].includes(w)));
  if (!A || !B) return null;
  const bases = [A, B].map((id) => ({ id, words: shuffle(fam[id], rnd).slice(0, 3) }));
  const taken = new Set(bases.flatMap((b) => b.words));
  const idsOf = (w) => (BANK_BY_WORD.get(w) || words.find((x) => x.word === w)).ids;
  const related = (w) => idsOf(w).some((id) => id === A || id === B || (morph(id).type === 'base' && (allomorph(id, A) || allomorph(id, B))));
  // Decoys: a twin root from another language (same meaning), else a base that starts with the same letters, else any.
  const decoys = [];
  for (const b of shuffle(bases, rnd)) {
    const m = morph(b.id);
    const tests = [
      (x) => sense(morph(x)) === sense(m) && morph(x).origin !== m.origin,
      (x) => morph(x).text.slice(0, 2) === m.text.slice(0, 2),
      () => true,
    ];
    let found = null;
    for (const t of tests) {
      const cand = shuffle(Object.keys(fam).filter((x) => x !== A && x !== B && !allomorph(x, A) && !allomorph(x, B) && t(x)), rnd);
      for (const x of cand) {
        const w = shuffle(fam[x], rnd).find((y) => !taken.has(y) && !related(y));
        if (w) { found = { w, base: x, near: b.id, same: sense(morph(x)) === sense(m) }; break; }
      }
      if (found) break;
    }
    if (found) { decoys.push(found); taken.add(found.w); }
  }
  return { bases, decoys };
}

// ── Phase 3: THE TRUE FORM ────────────────────────────────────────

const meaningOk = (b) => b && b.meaning && !b.meaning.toLowerCase().includes(b.word);
const stem = (w) => w.replace(/(ings?|ers?|ed|es|s)$/, '');
/**
 * A word whose meaning shows in its parts: some prefix or base's gloss (or a free base itself)
 * shares a word with the meaning. zoologist "one who studies animals" (zoo: animal) passes;
 * dedicate "to set apart for someone" (de + dic + ate) does not, so it never lands in a test of reading parts.
 */
function transparent(b) {
  const said = new Set([...contentWords(b.meaning)].map(stem));
  return b.ids.some((id) => {
    const m = morph(id);
    if (m.type === 'sfx' || m.type === 'link') return false;
    return [...contentWords(m.meaning)].some((w) => said.has(stem(w))) || said.has(stem(m.text));
  });
}

/** Meaning Forge: one word per origin, built from its meaning alone. New words first, longer words first. */
export function drawForge(rnd, ctx, n = 3) {
  const words = readable(ctx, { min: 2, max: 4 }).map((w) => BANK_BY_WORD.get(w.word)).filter((b) => meaningOk(b) && transparent(b));
  const score = (b) => (ctx.lexicon.has(b.word) ? 0 : 2) + (b.ids.length >= 3 ? 0.6 : 0) + rnd() * 1.5;
  const tasks = [];
  shuffle(ACADEMIC, rnd).forEach((o) => {
    const best = words.filter((b) => b.origin === o && !tasks.some((t) => t.word === b.word)).sort((a, b) => score(b) - score(a))[0];
    if (best) tasks.push({ m: best.meaning, p: best.ids, word: best.word });
  });
  for (const b of shuffle(words, rnd)) { if (tasks.length >= n) break; if (!tasks.some((t) => t.word === b.word)) tasks.push({ m: b.meaning, p: b.ids, word: b.word }); }
  return { tasks: tasks.slice(0, n) };
}

/** Word Detective: words the player has never built. The wrong meanings belong to words sharing a piece. */
export function drawDetective(rnd, ctx, n = 2, spares = 3) {
  const words = readable(ctx, { min: 3, max: 4 }).map((w) => BANK_BY_WORD.get(w.word)).filter((b) => meaningOk(b) && transparent(b));
  const fresh = shuffle(words.filter((b) => !ctx.lexicon.has(b.word)), rnd);
  const list = [...fresh, ...shuffle(words.filter((b) => ctx.lexicon.has(b.word)), rnd)];
  const items = [];
  for (const b of list) {
    if (items.length >= n + spares) break;
    const cousins = shuffle(BANK.filter((x) => x.word !== b.word && meaningOk(x) && x.meaning !== b.meaning && x.ids.some((id) => b.ids.includes(id) && morph(id).type !== 'link')), rnd);
    const wrong = [...new Set(cousins.map((x) => x.meaning))].slice(0, 2);
    if (wrong.length < 2) continue;
    const res = build(b.ids);
    items.push({ p: b.ids, word: b.word, cuts: res.cuts, alt: res.altCuts, ...choice(b.meaning, wrong, rnd) });
  }
  return { items: items.slice(0, n), spares: items.slice(n) };
}

/** The Giant Word: Triskaidekaphobia on a first run, then any giant whose pieces the player has earned. */
export function drawGiant(rnd, ctx) {
  const known = GIANTS.filter((g) => isKnown(g.p, ctx.learned));
  const first = known.find((g) => g.p.includes('tris'));
  const g = (ctx.firstRun && first) || pick(known.filter((x) => x !== first).length ? known.filter((x) => x !== first) : known, rnd) || GIANTS[0];
  const res = build(g.p);
  return {
    p: g.p,
    word: res.word,
    cuts: res.cuts,
    alt: res.altCuts,
    ...choice(g.m, g.wrong, rnd),
    meaning: g.m,
    tags: pieceIds(g.p).map((id) => ({ id, ...choice(morph(id).meaning, wrongMeanings(id, 2, rnd), rnd) })),
  };
}

const DRAW = { volley: drawVolley, twins: drawTwins, shape: drawShape, swarm: drawSwarm, spell: drawSpell, family: drawFamily, forge: drawForge, detective: drawDetective, giant: drawGiant };

/** One phase's three beats. mutation: the phase's Boss Rush mutation id, if any. */
export function drawPhase(phase, rnd, ctx, mutation = null) {
  return BEATS.filter((b) => b.phase === phase).map((b) => ({
    beat: b,
    content: b.id === 'swarm' ? drawSwarm(rnd, ctx, { mirror: mutation === 'mirror' }) : DRAW[b.id](rnd, ctx),
  }));
}
