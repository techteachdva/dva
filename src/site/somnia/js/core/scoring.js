import { psycheHandCount, alliesInHand } from "../cards/psyche.js";
import { goalPointsForTable } from "./data.js";

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

function goalWasReached(state) {
  if (state.archetypeGoalReached || state.goalBedSprintUsed || state.victoryPendingLogged) return true;
  const goal = difficultyPoints(state);
  return goal > 0 && (state.acquiredPoints || 0) >= goal;
}

/**
 * Final score keeps the table's Psyche, Objects, tokens, allies, and Dreams,
 * then adds the Archetype goal, the escape, and a small-table win bonus.
 */
export function calculateFinalScore(state) {
  let psyche = 0;
  let objects = 0;
  let tokens = 0;
  let allies = 0;

  state.players.filter((p) => p.alive).forEach((p) => {
    psyche += psycheHandCount(p);
    objects += p.objects?.length || 0;
    tokens += p.powerTokens || 0;
    allies += alliesInHand(p).length;
  });

  const won = state.status === "won";
  const difficulty = difficultyPoints(state);
  const goalReached = goalWasReached(state);
  const archetypePoints = goalReached ? 12 + difficulty : (state.acquiredPoints || 0);
  const escapeBonus = won ? (state.finalRecurrence ? 10 : 15) : 0;
  const dreamerBonus = dreamerCountBonus(state.players?.length || 0, won);
  const dreams = state.dreamDeck?.length || 0;
  const total = archetypePoints + psyche + objects + tokens + allies + dreams + escapeBonus + dreamerBonus;

  return {
    archetypePoints,
    goalReached,
    difficulty,
    psyche,
    objects,
    tokens,
    allies,
    dreams,
    escapeBonus,
    dreamerBonus,
    total,
  };
}

export function formatScoreBreakdown(breakdown) {
  const goalLine = breakdown.goalReached
    ? `Archetype goal: ${breakdown.archetypePoints}`
    : `Archetype points: ${breakdown.archetypePoints}`;
  return [
    goalLine,
    `Psyche in hands: ${breakdown.psyche}`,
    `Objects: ${breakdown.objects}`,
    `Power Tokens: ${breakdown.tokens}`,
    `Accepted allies: ${breakdown.allies}`,
    `Dreams remaining: ${breakdown.dreams}`,
    `Escape: ${breakdown.escapeBonus || 0}`,
    `Dreamer table: ${breakdown.dreamerBonus || 0}`,
    `Total score: ${breakdown.total}`,
  ];
}
