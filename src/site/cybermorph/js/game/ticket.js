/**
 * Exit Ticket practice: a short, focused session on only the morphemes the teacher ticked.
 * No story, no Hub: a look at today's morphemes, then COMPILE and DEBUG rounds until the
 * teacher's timer ends, then the exit ticket.
 *
 * buildDeck() picks the words. Strict words use only ticked morphemes (plus everyday
 * Anglo-Saxon free bases and linking vowels, which need no lesson). If there are too few,
 * it tops up with words that contain a ticked morpheme alongside others.
 *
 * Pure data (no DOM), so the audit can test it.
 */

import { MORPHEMES, morph } from '../data/morphemes.js';
import { BANK } from '../data/bank.js';
import { DISTRICTS, MAIN_ORDER } from '../data/world.js';
import { allWords, makeFake } from './waves.js';

const MIN_WORDS = 10;

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

let MEANINGS = null;
/** A plain meaning for every word we know one for: the bank, then every authored COMPILE task. */
function meanings() {
  if (MEANINGS) return MEANINGS;
  MEANINGS = new Map(BANK.map((b) => [b.word, b.meaning]));
  for (const id of MAIN_ORDER) {
    const d = DISTRICTS[id];
    const tasks = [...d.mentorFlow.batches.filter((b) => b.kind !== 'unpack').flatMap((b) => b.tasks)];
    d.rooms.forEach((r) => { if (r.terminal) tasks.push(...r.terminal.tasks); if (r.core && r.core.kind !== 'unpack') tasks.push(...r.core.tasks); });
    tasks.forEach((t) => { if (t.m && t.p) { try { const w = allWords().find((x) => x.ids.join() === t.p.join()); if (w && !MEANINGS.has(w.word)) MEANINGS.set(w.word, t.m); } catch { /* skip */ } } });
  }
  return MEANINGS;
}

const free = (id) => { const m = MORPHEMES[id]; return !!m && ((m.type === 'base' && m.origin === 'anglo') || m.type === 'link'); };

/**
 * The words for a session on these morpheme ids. Every word uses at least one ticked morpheme;
 * its other parts must be ticked, already learned by this student, or everyday free bases.
 * Too few? Top up with the words that need the fewest unfamiliar parts. Returns [] if nothing fits.
 */
export function buildDeck(focusIds, learned = []) {
  const focus = new Set(focusIds);
  if (!focus.size) return [];
  const known = new Set([...focus, ...learned]);
  const unknown = (w) => w.ids.filter((id) => !known.has(id) && !free(id)).length;
  const words = allWords().filter((w) => w.ids.some((id) => focus.has(id)));
  const strict = words.filter((w) => unknown(w) === 0);
  let deck = strict;
  if (deck.length < MIN_WORDS) {
    const extra = shuffle(words.filter((w) => !strict.includes(w))).sort((a, b) => unknown(a) - unknown(b));
    deck = [...strict, ...extra.slice(0, MIN_WORDS - strict.length)];
  }
  const mean = meanings();
  return shuffle(deck).map((w) => ({ ...w, meaning: mean.get(w.word) || null }));
}

/**
 * An endless, varied stream of rounds from a deck: COMPILE when the word has a meaning to ask
 * for, DEBUG otherwise, alternating, with about a third of DEBUG rounds a Rot fake.
 */
export function rounds(deck) {
  let queue = [];
  let n = 0;
  return () => {
    if (!queue.length) queue = shuffle(deck);
    const w = queue.shift();
    n += 1;
    const wantCompile = n % 2 === 1;
    if (wantCompile && w.meaning) return { kind: 'compile', task: { m: w.meaning, p: w.ids }, word: w.word };
    const fake = Math.random() < 0.35 ? makeFake(w) : null;
    return { kind: 'debug', item: fake || { p: w.ids }, word: w.word };
  };
}

/** Today's morphemes in book order, for the opening look and the HUD. */
export const describeFocus = (ids) => ids.map((id) => morph(id).text);
