import { addLog } from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { harmCount } from "./stat-tier.js";

export const ENCOUNTER_FAIL_MULTIPLIER = 1.5;

export function scaleFailCount(count) {
  if (!count) return count;
  return Math.max(1, Math.ceil(count * ENCOUNTER_FAIL_MULTIPLIER));
}

export function discardPsycheFromHand(state, player, count) {
  let discarded = 0;
  for (let i = 0; i < count && player.hand?.length; i += 1) {
    state.psycheDiscard.push(player.hand.pop());
    discarded += 1;
  }
  if (discarded) {
    recordQuestEvent(state, "discard_psyche", {
      count: discarded,
      landscapeId: player.landscapeId,
    });
    addLog(state, `${player.name} discards ${discarded} Psyche.`);
  }
  return discarded;
}

export function allDreamersDiscardPsyche(state, count) {
  state.players
    .filter((p) => p.alive)
    .forEach((p) => discardPsycheFromHand(state, p, count));
}

/** Stat-tier discard: mid = base, low = base×2, high = 0. */
export function discardByStatTier(state, player, suit, base = 1) {
  const n = harmCount(player, suit, base);
  if (n > 0) discardPsycheFromHand(state, player, n);
  return n;
}
