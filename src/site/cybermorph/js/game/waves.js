/**
 * Rotling waves. Every room's Rotling hall gets a fresh, random wave drawn from the
 * word bank, so no two runs see the same five Rotlings.
 *
 *   real words   only words whose morphemes the student has been taught
 *   Rot fakes    made from real words by breaking one thing. MISSPELLED:
 *                  joint     a spelling rule skipped        (hopeing, stoped, inmobile, antionym)
 *                  link      a linking o dropped            (thermmeter)
 *                  twin      a look-alike affix             (carefull, visable, perscribe)
 *                  overrule  a rule used where it doesn't belong     (hopful, speakker, plaier)
 *                  greek     a Greek piece spelled the everyday way  (fotograph, sinonym)
 *                  seam      a doubled letter lost or added at a prefix (interupt, missunderstand)
 *                  vowel     a hard-to-hear vowel written wrong      (posetion, geolagy)
 *                REVERSED:   order    a suffix moved to the front (fulhope) or a prefix to the back
 *                NOT A WORD: nonword  real pieces, put together into a word English doesn't use
 *   golden       a rare long word worth bonus bits
 *
 * Each Rotling's call (real, misspelled, not a word, reversed) is drawn from MIX first, then a word
 * that can make it is found, so no one call is right most of the time. The audit
 * (scripts/audit-cybermorph-rotlings.mjs) checks the mix every room and level really gets.
 *
 * Pure data in, data out (no DOM), so the audit can run it in Node.
 */

import { MORPHEMES, morph } from '../data/morphemes.js';
import { build } from '../compiler/wordsum.js';
import { NONWORDS } from '../data/nonwords.js';
import { MISSPELLINGS } from '../data/misspellings.js';
import { DISTRICTS, MAIN_ORDER, DICTIONARY, collectPartWords } from '../data/world.js';

let ALL = null;
/** Every real word the game knows with its parts: the bank plus every authored task. */
export function allWords() {
  if (!ALL) ALL = collectPartWords();
  return ALL;
}

const freeAnglo = (m) => m.type === 'base' && m.origin === 'anglo';

/** A word is fair game when every part was taught (Anglo-Saxon free bases are everyday words). */
export function isKnown(ids, learned) {
  return ids.every((id) => learned.has(id) || (MORPHEMES[id] && freeAnglo(MORPHEMES[id])));
}

/** What a student has been taught by the time they reach a room's Rotling hall. */
export function taughtBy(roomId) {
  const set = new Set();
  for (const id of MAIN_ORDER) {
    const d = DISTRICTS[id];
    d.mentorFlow.batches.forEach((b) => (b.teach || []).forEach((x) => set.add(x)));
    if (id === roomId) break;
    d.rooms.forEach((r) => {
      [r.terminal, r.core].forEach((s) => s && (s.teach || []).forEach((x) => set.add(x)));
      if (r.newword) (r.newword.teachFirst || []).forEach((x) => set.add(x));
    });
  }
  return set;
}

const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const plain = (ids) => ids.map((id) => morph(id).text).join(' + ');
const cutsOf = (texts) => { const out = []; let p = 0; texts.slice(0, -1).forEach((t) => { p += t.length; out.push(p); }); return out; };
const baseOf = (ids) => ids.find((id) => morph(id).type === 'base') || ids[0];

/**
 * A "not a word" fake: the same pieces with one swapped, so every piece is real and correctly
 * joined but English has no such word (hopeful -> loudful). The list is pre-built and checked
 * against a full English word list by scripts/build-cybermorph-nonwords.mjs (data/nonwords.js).
 * `p` is the fake's pieces (what the player splits), `real` the word it came from.
 */
function nonWord(ids, realWord, learned = null) {
  // Only made-up words whose pieces the student has met: you can't judge a piece you don't know.
  const list = (NONWORDS[realWord] || []).filter((nw) => !learned || isKnown(nw.p, learned));
  if (!list.length) return null;
  const nw = list[rand(list.length)];
  return { p: nw.p, real: ids, show: nw.show, fake: 'nonword', cuts: cutsOf(nw.p.map((id) => morph(id).text)),
    why: `Every piece is real, but English doesn't use "${nw.show}". The real word has ${morph(ids[nw.swap]).text} there: ${plain(ids)} → ${realWord}.` };
}

/** The share of each call across Rotlings, so "real" is never the answer most of the time. */
export const MIX = { real: 0.4, misspelled: 0.3, nonword: 0.2, reversed: 0.1 };
/** The fake kinds behind each call. */
const KINDS = { misspelled: ['joint', 'link', 'twin', 'overrule', 'greek', 'seam', 'vowel'], nonword: ['nonword'], reversed: ['order'] };
const LISTED = KINDS.misspelled.slice(2); // built offline into data/misspellings.js
const FAKE_CALLS = ['misspelled', 'nonword', 'reversed'];
const callOfKind = (kind) => FAKE_CALLS.find((c) => KINDS[c].includes(kind));

function weighted(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}
const FAKE_MIX = Object.fromEntries(FAKE_CALLS.map((c) => [c, MIX[c]]));

/**
 * n calls drawn one at a time from MIX (with its real share overridable), so a wave can't be
 * beaten by counting. With 2 or more there is always at least one real word and one fake.
 */
export function rollCalls(n, realShare = MIX.real) {
  const fakeTotal = FAKE_CALLS.reduce((a, c) => a + FAKE_MIX[c], 0);
  // The guarantee adds real words to all-fake rolls (and takes them from all-real ones), so draw with
  // the share that lands on realShare after it: n·p + (1−p)^n − p^n = n·realShare.
  let p = realShare;
  if (n >= 2) {
    let lo = 0; let hi = 1;
    for (let k = 0; k < 30; k++) { p = (lo + hi) / 2; if (n * p + (1 - p) ** n - p ** n > n * realShare) hi = p; else lo = p; }
  }
  const w = { real: p, ...Object.fromEntries(FAKE_CALLS.map((c) => [c, (FAKE_MIX[c] / fakeTotal) * (1 - p)])) };
  const out = Array.from({ length: n }, () => weighted(w));
  if (n >= 2 && !out.includes('real')) out[rand(n)] = 'real';
  if (n >= 2 && out.every((c) => c === 'real')) out[rand(n)] = weighted(FAKE_MIX);
  return out;
}

/** One kind of fake from a real word, or null when this word can't make it fairly. */
function fakeOfKind(ids, res, kind, learned) {
  // Real pieces, built right, into a word English doesn't use: one piece swapped for another of its type.
  if (kind === 'nonword') return nonWord(ids, res.word, learned);
  if (LISTED.includes(kind)) {
    const list = (MISSPELLINGS[res.word] || []).filter((m) => m.kind === kind);
    if (!list.length) return null;
    const m = list[rand(list.length)];
    return { p: ids, show: m.show, fake: kind, cuts: m.cuts, at: m.at, why: `The Rot misspelled it. ${m.why}` };
  }
  const types = ids.map((id) => morph(id).type);
  const texts = ids.map((id) => morph(id).text);
  const linkAt = ids.findIndex((id) => id === 'o');
  let show; let cuts; let why;
  if (kind === 'joint') {
    if (!res.steps.length) return null;
    show = texts.join('');
    cuts = cutsOf(texts);
    why = `The Rot skipped a spelling rule: ${res.steps[0].note}. ${plain(ids)} → ${res.word}.`;
  } else if (kind === 'link') {
    if (linkAt <= 0 || res.steps.length) return null;
    const r2 = build(ids.filter((_, i) => i !== linkAt));
    show = r2.word;
    cuts = r2.cuts;
    why = `${morph(ids[linkAt - 1]).text} ends in a consonant, so it needs the linking o before the next Greek part. ${plain(ids)} → ${res.word}.`;
  } else if (kind === 'order') {
    if (types.includes('link') || ids.length < 2 || !(types[types.length - 1] === 'sfx' || types[0] === 'pfx')) return null;
    // A swapped order can land on a real English word (e + mit → "mite"), so keep those long and chunky.
    if (texts.some((t) => t.length < 2)) return null;
    let moved;
    if (types[types.length - 1] === 'sfx') {
      moved = [texts[texts.length - 1], ...texts.slice(0, -1)];
      why = `A suffix comes AFTER its base. -${texts[texts.length - 1]} belongs at the end: ${plain(ids)} → ${res.word}.`;
    } else {
      moved = [...texts.slice(1), texts[0]];
      why = `A prefix comes BEFORE its base. ${texts[0]}- belongs at the front: ${plain(ids)} → ${res.word}.`;
    }
    show = moved.join('');
    cuts = cutsOf(moved);
    if (show.length < 6) return null;
  } else return null;
  if (!show || show === res.word || DICTIONARY.has(show) || cuts.some((c) => c <= 0 || c >= show.length)) return null;
  return { p: ids, show, fake: kind, cuts, why };
}

/** A fake with this call (misspelled, nonword or reversed), trying its kinds in random order; prefer goes first. */
export function fakeFor(entry, call, learned = null, prefer = null) {
  const { ids } = entry;
  if (ids.some((id) => !MORPHEMES[id] || morph(id).type === 'word')) return null;
  const res = build(ids);
  const kinds = shuffle(KINDS[call]);
  const order = prefer && kinds.includes(prefer) ? [prefer, ...kinds.filter((k) => k !== prefer)] : kinds;
  for (const kind of order) {
    const f = fakeOfKind(ids, res, kind, learned);
    if (f) return f;
  }
  return null;
}

/**
 * Try to turn a real word into a Rot fake, its call drawn from MIX. prefer: a kind to try first
 * (joint, order, nonword…). Returns null when no fair fake can be made.
 */
export function makeFake(entry, prefer = null, learned = null) {
  const first = (prefer && callOfKind(prefer)) || weighted(FAKE_MIX);
  for (const call of [first, ...shuffle(FAKE_CALLS.filter((c) => c !== first))]) {
    const f = fakeFor(entry, call, learned, prefer);
    if (f) return f;
  }
  return null;
}

/**
 * Deal calls onto words: each fake call goes to a word that can make it. A call no word can make
 * becomes some other fake, so the real share holds. Returns one item per word, in order.
 */
export function dealCalls(words, calls, learned = null) {
  const items = new Array(words.length);
  const open = shuffle(words.map((_, i) => i));
  let missed = 0;
  // Scarcest first: few words can be misspelled, almost any can be made into a non-word.
  const scarce = ['misspelled', 'reversed', 'nonword'];
  for (const call of calls.filter((c) => c !== 'real').sort((a, b) => scarce.indexOf(a) - scarce.indexOf(b))) {
    if (!open.some((k) => !items[k] && (items[k] = fakeFor(words[k], call, learned)))) missed++;
  }
  for (const k of open) {
    if (!missed) break;
    if (!items[k] && (items[k] = makeFake(words[k], null, learned))) missed--;
  }
  return words.map((w, i) => items[i] || { p: w.ids });
}

/**
 * Build a wave of Rotlings.
 *   learned  Set of taught morpheme ids
 *   origin   the room's origin (its words come first), or null for any
 *   size     how many Rotlings
 *   fakes    share of Rot fakes (0..1); left out, MIX decides
 *   minParts only words with at least this many morphemes
 *   golden   chance of one golden Rotling
 */
export function makeWave({ learned, origin = null, size = 6, fakes = 1 - MIX.real, minParts = 2, golden = 0.4, avoid = [] }) {
  const pool = allWords().filter((w) => w.ids.length >= minParts && isKnown(w.ids, learned) && !avoid.includes(w.word));
  const home = shuffle(pool.filter((w) => !origin || w.origin === origin));
  const away = shuffle(pool.filter((w) => origin && w.origin !== origin));
  // Mostly this room's words, with about one in five from the rooms before it.
  const picked = [];
  const bases = new Set();
  const take = (list) => {
    while (list.length) {
      const w = list.shift();
      const b = baseOf(w.ids);
      if (bases.has(b)) continue;
      bases.add(b);
      picked.push(w);
      return true;
    }
    return false;
  };
  while (picked.length < size) {
    const fromAway = away.length && Math.random() < 0.2;
    if (!take(fromAway ? away : home) && !take(fromAway ? home : away)) break;
  }
  const items = dealCalls(picked, rollCalls(picked.length, 1 - fakes), learned);
  if (Math.random() < golden) {
    const long = pool.filter((w) => w.ids.length >= 3 && !picked.includes(w));
    const homeLong = long.filter((w) => !origin || w.origin === origin);
    const longest = (homeLong.length >= 4 ? homeLong : long).sort((a, b) => b.word.length - a.word.length).slice(0, 30);
    if (longest.length) items.push({ p: longest[rand(longest.length)].ids, golden: true });
  }
  return shuffle(items);
}

/** One random real word (for the Rot meter's extra Rotling). */
export function randomWord(learned, origin = null) {
  const pool = allWords().filter((w) => isKnown(w.ids, learned) && (!origin || w.origin === origin));
  return pool.length ? pool[rand(pool.length)] : null;
}
