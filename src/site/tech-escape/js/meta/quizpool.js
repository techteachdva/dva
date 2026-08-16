/**
 * The bridge between a player's history and the questions a terminal serves.
 *
 * Two jobs the question bank should not have to know about:
 *
 *   1. Freshness. Ids the player has already mastered, or seen in the last few
 *      runs, are handed to the bank as `excludeIds` so a replay is new material
 *      rather than the same three questions again.
 *   2. Difficulty. If the bank tags questions with `level: 1|2|3`, higher game
 *      difficulties are weighted toward the harder end. If it does not, nothing
 *      here changes behaviour at all.
 *
 * Everything is feature-detected. The bank is owned by another author and may be
 * mid-rewrite, so this module never assumes a signature or an export exists.
 */

import * as bank from '../data/questions.js';

/** Which authored difficulty each game difficulty aims at. */
const LEVEL_TARGET = {
  beginner: 1, chill: 1, normal: 2, questions: 1, nightmare: 3,
};

// Ask for more than we need so there is something to weight. Three times the
// ask is plenty and still cheap on a 30-question pool.
const OVERDRAW = 3;

/**
 * @param {number} terminalIndex
 * @param {number} count
 * @param {ReturnType<import('../util.js').makeRng>} rng
 * @param {{excludeIds?:Set|Array, difficulty?:string}} [opts]
 * @returns {Array} questions in the shape quiz.js expects
 */
export function drawForTerminal(terminalIndex, count, rng, opts = {}) {
  const draw = bank.drawQuestions;
  if (typeof draw !== 'function') return [];

  const exclude = opts.excludeIds || null;
  const wide = safeDraw(draw, terminalIndex, count * OVERDRAW, rng, exclude);

  // A pool smaller than the ask, or a bank that ignores excludeIds and came
  // back short: retry with nothing held back rather than serve fewer questions.
  let pool = dedupe(wide);
  if (pool.length < count) {
    pool = dedupe([...pool, ...safeDraw(draw, terminalIndex, count * OVERDRAW, rng, null)]);
  }
  if (pool.length <= count) return pool.slice(0, count);

  return weightByLevel(pool, opts.difficulty, rng).slice(0, count);
}

function safeDraw(draw, terminalIndex, count, rng, exclude) {
  try {
    const out = draw(terminalIndex, count, rng, exclude ? { excludeIds: exclude } : {});
    return Array.isArray(out) ? out : [];
  } catch (e) {
    // An older four-argument-free signature, or a bank mid-edit
    try {
      const out = draw(terminalIndex, count, rng);
      return Array.isArray(out) ? out : [];
    } catch (e2) {
      return [];
    }
  }
}

/** Keeps the first occurrence of each id; untagged questions all survive. */
function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const q of list) {
    if (!q || !Array.isArray(q.options)) continue;
    if (q.id) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
    }
    out.push(q);
  }
  return out;
}

/**
 * Sorts by distance from the target authored level, with enough random jitter
 * that two runs on the same difficulty are not the same three questions. When
 * no question carries a `level`, the incoming (already shuffled) order is kept.
 */
function weightByLevel(pool, difficulty, rng) {
  const target = LEVEL_TARGET[difficulty];
  const tagged = pool.some((q) => Number.isFinite(q.level));
  if (!target || !tagged) return pool;

  const jitter = () => (rng && typeof rng === 'function' ? rng() : Math.random());
  return pool
    .map((q) => {
      // Untagged questions sit at the midpoint so they stay eligible everywhere
      const lvl = Number.isFinite(q.level) ? q.level : 2;
      return { q, score: Math.abs(lvl - target) + jitter() * 0.85 };
    })
    .sort((a, b) => a.score - b.score)
    .map((e) => e.q);
}

/** Ids from a drawn set, for handing back to the progress store. */
export function idsOf(questions) {
  return questions.map((q) => q?.id).filter(Boolean);
}

/** @deprecated alias */
export { drawForTerminal as drawFor };
