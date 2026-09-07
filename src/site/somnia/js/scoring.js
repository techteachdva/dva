import { psycheHandCount, alliesInHand } from "./psyche.js";

/** Final score = difficulty + psyche + objects + tokens + allies + dreams remaining. */
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

  const archetypePoints = state.goalPoints || 0;
  const dreams = state.dreamDeck?.length || 0;
  const total = archetypePoints + psyche + objects + tokens + allies + dreams;

  return {
    archetypePoints,
    psyche,
    objects,
    tokens,
    allies,
    dreams,
    total,
  };
}

export function formatScoreBreakdown(breakdown) {
  return [
    `Archetype goal: ${breakdown.archetypePoints}`,
    `Psyche in hands: ${breakdown.psyche}`,
    `Objects: ${breakdown.objects}`,
    `Power Tokens: ${breakdown.tokens}`,
    `Accepted allies: ${breakdown.allies}`,
    `Dreams remaining: ${breakdown.dreams}`,
    `Total score: ${breakdown.total}`,
  ];
}
