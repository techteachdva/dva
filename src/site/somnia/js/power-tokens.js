import { recordQuestEvent } from "./quests.js";
import { playSfx } from "./audio.js";
import { queuePowerTokensFx } from "./board-fx.js";
import { PSYCHE_POWER_GRANT } from "./data.js";

export const MAX_POWER_TOKEN_POOL = 24;

function log(state, message) {
  if (!state?.log) return;
  state.log.unshift(message);
  state.log = state.log.slice(0, 40);
}

export function powerTokensHeld(state) {
  return state.players.reduce((sum, player) => sum + (player.powerTokens || 0), 0);
}

export function powerTokensInPool(state) {
  return Math.max(0, MAX_POWER_TOKEN_POOL - powerTokensHeld(state));
}

export function grantPowerTokens(state, player, requested, { reason = "", logQuest = true, animate = true } = {}) {
  const amount = Math.max(0, Math.floor(requested || 0));
  if (!player || amount <= 0) return 0;

  const available = powerTokensInPool(state);
  const granted = Math.min(amount, available);
  if (granted <= 0) {
    if (amount > 0) {
      log(state, `No Power Tokens left in the pool (${MAX_POWER_TOKEN_POOL} max across all Dreamers).`);
    }
    return 0;
  }

  player.powerTokens = (player.powerTokens || 0) + granted;
  if (logQuest) recordQuestEvent(state, "power_token", { count: granted });
  if (reason) log(state, reason);
  if (animate) queuePowerTokensFx(player.id, granted);
  playSfx("sparkle");
  return granted;
}

export function spendPowerTokens(state, player, requested, { reason = "" } = {}) {
  const amount = Math.max(0, Math.floor(requested || 0));
  if (!player || amount <= 0) return 0;

  const held = player.powerTokens || 0;
  const spent = Math.min(amount, held);
  if (spent <= 0) return 0;

  player.powerTokens = held - spent;
  if (reason) log(state, reason);
  return spent;
}

/** Spend from any living Dreamers (richest first) until the amount is paid or tokens run out. */
export function spendPowerTokensCollectively(state, requested, { reason = "" } = {}) {
  let left = Math.max(0, Math.floor(requested || 0));
  if (left <= 0) return 0;

  const players = state.players
    .filter((p) => p.alive)
    .sort((a, b) => (b.powerTokens || 0) - (a.powerTokens || 0));

  let spent = 0;
  for (const player of players) {
    while (left > 0 && (player.powerTokens || 0) > 0) {
      player.powerTokens -= 1;
      left -= 1;
      spent += 1;
    }
  }

  if (spent > 0 && reason) log(state, reason);
  return spent;
}

export function resolvePsychePowerCard(state, player, card) {
  if (!card || card.type !== "psyche-power") return 0;
  const tokens = card.powerTokens ?? PSYCHE_POWER_GRANT;
  const granted = grantPowerTokens(state, player, tokens, {
    reason: `${player.name} draws ${card.name}: +${tokens} Power Token${tokens === 1 ? "" : "s"}, then discards.`,
    logQuest: true,
  });
  if (!state.psycheDiscard) state.psycheDiscard = [];
  state.psycheDiscard.push(card);
  playSfx("draw");
  return granted;
}

/** Power Psyche cards never stay in hand — resolve any that slipped in (e.g. starting deal). */
export function resolvePowerCardsInHand(state, player) {
  const powerCards = player.hand.filter((card) => card.type === "psyche-power");
  if (!powerCards.length) return 0;

  player.hand = player.hand.filter((card) => card.type !== "psyche-power");
  let total = 0;
  powerCards.forEach((card) => {
    total += resolvePsychePowerCard(state, player, card);
  });
  return total;
}

export function resolveAllPowerCardsInHands(state) {
  let total = 0;
  state.players.forEach((player) => {
    total += resolvePowerCardsInHand(state, player);
  });
  return total;
}
