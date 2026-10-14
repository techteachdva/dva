/**
 * Clearing the Subconscious lets the table search the Dream discard and replay one Dream.
 * The card stays in the discard, and the round's Dream draw is left alone.
 */

import { addLog, headPlayer } from "../core/state.js";
import { beginDreamCardChoice } from "./mindstream-choices.js";
import { isBossDreamCard, spawnBossEncounterOnBed } from "./dream-deck.js";
import { resolveCardEffect } from "../effects/effects.js";

export function dreamReplayOptions(state) {
  return (state?.dreamDiscard || []).filter((card) => (
    card && (
      card.type === "dream"
      || card.type === "final"
      || card.type === "boss-dream"
      || isBossDreamCard(card)
    )
  ));
}

export function replayChosenDream(state, card, helpers = {}) {
  const player = headPlayer(state) || state.players?.find((p) => p.alive);
  if (!card || !player) return false;
  if (isBossDreamCard(card)) {
    spawnBossEncounterOnBed(state, card);
    addLog(state, `${card.name} is replayed from the Dream discard and awakens on The Bed.`);
    return true;
  }
  if (beginDreamCardChoice(state, card, player, helpers)) {
    addLog(state, `${player.name} replays ${card.name} from the Dream discard.`);
    return true;
  }
  resolveCardEffect(state, card, player, helpers);
  addLog(state, `${player.name} replays ${card.name} from the Dream discard.`);
  return true;
}
