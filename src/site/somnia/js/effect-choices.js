/** Shared player-choice popup for Event and Dreambeast effects. */

import { logMoment } from "./narrator.js";

const resolvers = {};

export function registerEffectResolver(cardId, fn) {
  resolvers[cardId] = fn;
}

export function offerEffectChoice(state, player, spec) {
  state.pendingEffectChoice = {
    ui: spec.ui || "choice",
    source: spec.source || "event",
    cardId: spec.cardId,
    playerId: player.id,
    step: spec.step || "choice",
    title: spec.title,
    message: spec.message,
    choices: spec.choices || [],
    cards: spec.cards || [],
    need: spec.need || 0,
    needCount: spec.needCount,
    maxCount: spec.maxCount,
    order: spec.order || [],
    payload: spec.payload || {},
  };
  logMoment(state, spec.log || `${spec.title} — choose an option.`);
}

export function resolveEffectChoice(state, choiceId, helpers = null) {
  const pending = state.pendingEffectChoice;
  if (!pending) return false;
  const fn = resolvers[pending.cardId];
  if (!fn) {
    state.pendingEffectChoice = null;
    return false;
  }
  return fn(state, choiceId, helpers);
}
