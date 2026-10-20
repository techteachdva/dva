/**
 * Rotling waves. Every room's Rotling hall gets a fresh, random wave drawn from the
 * word bank, so no two runs see the same five Rotlings.
 *
 *   real words   only words whose morphemes the student has been taught
 *   Rot fakes    made from real words by breaking one thing:
 *                  joint  a spelling rule skipped     (hopeing, stoped, inmobile, antionym)
 *                  order  a suffix moved to the front (fulhope) or a prefix to the back
 *                  link   a linking o dropped         (thermmeter)
 *   golden       a rare long word worth bonus bits
 *
 * Pure data in, data out (no DOM), so the audit can run it in Node.
 */

import { MORPHEMES, morph } from '../data/morphemes.js';
import { build } from '../compiler/wordsum.js';
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

/** Try to turn a real word into a Rot fake. Returns null when no fair fake can be made. */
export function makeFake(entry, prefer = null) {
  const { ids } = entry;
  const res = build(ids);
  const kinds = [];
  const linkAt = ids.findIndex((id) => id === 'o');
  if (res.steps.length) kinds.push('joint');
  if (linkAt > 0 && !res.steps.length) kinds.push('link');
  const types = ids.map((id) => morph(id).type);
  if (!types.includes('link') && !types.includes('word') && ids.length >= 2 && (types[types.length - 1] === 'sfx' || types[0] === 'pfx')) kinds.push('order');
  const order = prefer && kinds.includes(prefer) ? [prefer, ...shuffle(kinds.filter((k) => k !== prefer))] : shuffle(kinds);
  for (const kind of order) {
    let show; let cuts; let why;
    if (kind === 'joint') {
      const texts = ids.map((id) => morph(id).text);
      show = texts.join('');
      cuts = cutsOf(texts);
      const note = res.steps[0].note;
      why = `The Rot skipped a spelling rule: ${note}. ${plain(ids)} → ${res.word}.`;
    } else if (kind === 'link') {
      const without = ids.filter((_, i) => i !== linkAt);
      const r2 = build(without);
      show = r2.word;
      cuts = r2.cuts;
      why = `${morph(ids[linkAt - 1]).text} ends in a consonant, so it needs the linking o before the next Greek part. ${plain(ids)} → ${res.word}.`;
    } else {
      const texts = ids.map((id) => morph(id).text);
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
    }
    if (!show || show === res.word || DICTIONARY.has(show) || cuts.some((c) => c <= 0 || c >= show.length)) continue;
    // A swapped order can land on a real English word (e + mit → "mite"), so keep those long and chunky.
    if (kind === 'order' && (show.length < 6 || ids.some((id) => morph(id).text.length < 2))) continue;
    return { p: ids, show, fake: kind, cuts, why };
  }
  return null;
}

/**
 * Build a wave of Rotlings.
 *   learned  Set of taught morpheme ids
 *   origin   the room's origin (its words come first), or null for any
 *   size     how many Rotlings
 *   fakes    share of Rot fakes (0..1)
 *   minParts only words with at least this many morphemes
 *   golden   chance of one golden Rotling
 */
export function makeWave({ learned, origin = null, size = 6, fakes = 0.33, minParts = 2, golden = 0.4, avoid = [] }) {
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
  const nFake = Math.max(1, Math.round(picked.length * fakes));
  const items = [];
  // Spelling-rule fakes teach the most, so they go first; then a dropped link or a swapped order.
  const rank = (w) => (build(w.ids).steps.length ? 0 : w.ids.includes('o') ? 1 : 2);
  const fakeable = shuffle(picked.map((w, i) => i)).sort((a, b) => rank(picked[a]) - rank(picked[b]));
  const fakeAt = new Set();
  for (const i of fakeable) {
    if (fakeAt.size >= nFake) break;
    const f = makeFake(picked[i], ['joint', 'link', 'order'][rank(picked[i])]);
    if (f) { fakeAt.add(i); items[i] = f; }
  }
  picked.forEach((w, i) => { if (!items[i]) items[i] = { p: w.ids }; });
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
