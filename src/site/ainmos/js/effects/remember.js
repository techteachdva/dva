/**
 * Ainmos 41.0 — Remember.
 *
 * Remember N: discard up to N Psyche from your hand, then Return that many cards
 * plus 1 from the Subconscious. A Returned Psyche goes to the Psyche discard,
 * so every one is +1 Waking Mind.
 */

import { addLog } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import {
  enqueueDiscardFromHand,
  enqueueReturnCards,
  isDreambeastPsycheCard,
  returnableCount,
} from "../dreamers/subconscious.js";

export const REMEMBER_CHOICE_ID = "remember";

/** Psyche a Dreamer may discard to Remember: no allies, no tokens, no Objects. */
export function rememberFuel(player) {
  return (player?.hand || []).filter(
    (card) => card
      && card.type !== "psyche-power"
      && card.type !== "object"
      && !isDreambeastPsycheCard(card),
  );
}

export function rememberLabel(count) {
  return `Remember ${count}`;
}

export function rememberHint(count) {
  return `Discard up to ${count} Psyche, Return that many +1`;
}

/**
 * Open the Remember choice. With nothing to discard (or nothing to Return beyond 1),
 * it resolves straight away.
 */
export function beginRemember(state, player, count, { source = "", filter = null } = {}) {
  const n = Math.max(0, Number(count) || 0);
  if (!player) return false;
  const waiting = returnableCount(state, filter);
  const where = source ? `${source}: ` : "";
  if (!waiting) {
    addLog(state, `${where}Remember — the Subconscious holds nothing to Return.`);
    return false;
  }
  const fuel = rememberFuel(player).length;
  const maxDiscard = Math.min(n, fuel, Math.max(0, waiting - 1));
  if (maxDiscard <= 0) {
    resolveRemember(state, player, 0, { source, filter });
    return true;
  }
  const choices = [];
  for (let k = maxDiscard; k >= 0; k -= 1) {
    choices.push({
      id: `discard-${k}`,
      label: k ? `Discard ${k} → Return ${k + 1}` : "Discard none → Return 1",
      hint: k ? `${k} Psyche from your hand go to the discard. ${k + 1} cards come back from the Subconscious.` : "Keep your hand. 1 card comes back.",
    });
  }
  offerEffectChoice(state, player, {
    cardId: REMEMBER_CHOICE_ID,
    source: "remember",
    title: `${where}${rememberLabel(n)}`,
    message: "Spend Psyche to win your mind back. Every Psyche you Return is +1 Waking Mind.",
    choices,
    payload: { source, filter, count: n },
    log: `${where}${rememberLabel(n)} — choose how much to spend.`,
  });
  return true;
}

export function resolveRemember(state, player, discard, { source = "", filter = null } = {}) {
  const k = Math.max(0, Number(discard) || 0);
  const where = source ? `${source}: ` : "";
  if (k > 0) {
    enqueueDiscardFromHand(state, player, k, {
      strict: true,
      cardFilter: { payablePsyche: true },
      reason: `${where}Remember — discard ${k} Psyche.`,
    });
  }
  enqueueReturnCards(state, k + 1, player, {
    filter,
    reason: `${where}Remember — Return ${k + 1} from the Subconscious.`,
  });
  logMoment(state, `${player.name} Remembers: ${k ? `discard ${k}, ` : ""}Return ${k + 1}.`);
  state.rememberStats = state.rememberStats || {};
  const key = source || "other";
  state.rememberStats[key] = (state.rememberStats[key] || 0) + k + 1;
  return true;
}

/** What helps the Waking Mind most: plain Psyche (highest first), then Wilds, then Objects, Events, beasts last. */
export function rememberPriority(card) {
  if (!card) return 99;
  if (card.type === "psyche" && !isDreambeastPsycheCard(card)) return 0 - (card.value || 0) / 10;
  if (card.type === "psyche-power") return 2;
  if (card.type === "object") return 3;
  if (card.type === "event") return 4;
  return 5;
}

registerEffectResolver(REMEMBER_CHOICE_ID, (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  const payload = pending?.payload || {};
  state.pendingEffectChoice = null;
  if (!player) return false;
  const k = Number(String(choiceId || "").replace("discard-", "")) || 0;
  return resolveRemember(state, player, k, { source: payload.source, filter: payload.filter });
});
