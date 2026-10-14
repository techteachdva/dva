import { alliesInHand } from "../cards/psyche.js";
import { goalPointsForTable } from "./data.js";
import { ladderEntry } from "../encounters/boss-ladder.js";

/** Fewer Dreamers at the table, awarded only for a win. 6 is 0, each Dreamer fewer is +5. */
export function dreamerCountBonus(playerCount, won) {
  if (!won) return 0;
  const count = Math.max(1, Math.min(6, Number(playerCount) || 6));
  return (6 - count) * 5;
}

function difficultyPoints(state) {
  if (state.scoringGoalPoints != null) return state.scoringGoalPoints;
  if ((state.goalPoints || 0) > 0) return state.goalPoints;
  return goalPointsForTable(state.lengthKey, state.players?.length || 1);
}

/** Each defeated ladder Boss scores its climb: the Turtle 1, Leviathan 10. */
export function bossClimbPoints(state) {
  return (state.bossesDefeated || []).reduce((sum, id) => {
    const entry = ladderEntry(id);
    return sum + (entry ? 11 - entry.rung : 0);
  }, 0);
}

/**
 * Ainmos score:
 *   Archetype points acquired x2 (not capped at the goal)
 * + every defeated Boss's climb (11 minus its rung)
 * + the best spread's Power
 * + 20 for waking
 * + 1 per Object, Power Token, and ally still held by living Dreamers
 * + the small-table bonus on a win.
 * Psyche left in hand no longer scores: spend it.
 */
export function calculateFinalScore(state) {
  let objects = 0;
  let tokens = 0;
  let allies = 0;
  state.players.filter((p) => p.alive).forEach((p) => {
    objects += (p.objects?.length || 0) + (p.persistent?.length || 0);
    tokens += p.powerTokens || 0;
    allies += alliesInHand(p).length;
  });

  const won = state.status === "won";
  const difficulty = difficultyPoints(state);
  const acquired = state.acquiredPoints || 0;
  const goalReached = acquired >= difficulty;
  const archetypePoints = acquired * 2;
  const bossPoints = bossClimbPoints(state);
  const bestSpread = state.runStats?.bestSpread?.power || 0;
  const escapeBonus = won ? 20 : 0;
  const dreamerBonus = dreamerCountBonus(state.players?.length || 0, won);
  const total = archetypePoints + bossPoints + bestSpread + escapeBonus + objects + tokens + allies + dreamerBonus;

  return {
    archetypePoints,
    acquired,
    goalReached,
    difficulty,
    bossPoints,
    bestSpread,
    psyche: 0,
    objects,
    tokens,
    allies,
    dreams: 0,
    escapeBonus,
    dreamerBonus,
    total,
  };
}

export function formatScoreBreakdown(breakdown) {
  return [
    `Archetype points ×2: ${breakdown.archetypePoints}`,
    `Bosses climbed: ${breakdown.bossPoints}`,
    `Best spread: ${breakdown.bestSpread}`,
    `Wake: ${breakdown.escapeBonus || 0}`,
    `Objects, tokens, allies: ${breakdown.objects + breakdown.tokens + breakdown.allies}`,
    `Dreamer table: ${breakdown.dreamerBonus || 0}`,
    `Total score: ${breakdown.total}`,
  ];
}
