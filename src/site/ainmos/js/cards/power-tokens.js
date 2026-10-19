import { recordQuestEvent } from "../dreamers/quests.js";
import { playSfx } from "../audio/audio.js";
import { queuePowerTokensFx, queuePowerTokenSpendFx } from "../board/board-fx.js";
import { PSYCHE_POWER_GRANT } from "../core/data.js";

/**
 * Ainmos 0.23: Power Tokens come from exactly three places: the 2 every Dreamer
 * starts with, beating a Dreambeast (Power Token or Object, your pick), and
 * Acquiring an Archetype. A token spent and taken back (undoing a spread bonus,
 * a power that did nothing) is a refund, not a new token. There is no pool: each
 * Dreamer simply holds up to six.
 */
export const MAX_POWER_TOKENS = 6;
export const STARTING_POWER_TOKENS = 2;
const TOKEN_SOURCES = new Set(["start", "beast", "archetype", "refund", "dreamscape"]);

function log(state, message) {
  if (!state?.log) return;
  state.log.unshift(message);
  state.log = state.log.slice(0, globalThis.__AINMOS_LOG_CAP || 40);
}

/** Taps and sinks for the night: tokens gained by source, spent, and lost to the cap. */
export function noteTokenFlow(state, kind, key, n) {
  if (!state || !n) return;
  if (!state.economy) state.economy = { tokensIn: {}, tokensSpent: 0, tokensCapped: 0 };
  const eco = state.economy;
  if (kind === "in") eco.tokensIn[key] = (eco.tokensIn[key] || 0) + n;
  else if (kind === "spent") eco.tokensSpent += n;
  else if (kind === "capped") eco.tokensCapped += n;
}

export function powerTokensHeld(state) {
  return state.players.reduce((sum, player) => sum + (player.powerTokens || 0), 0);
}

/** Room left in one Dreamer's hand of tokens (max six). */
export function powerTokenRoom(player) {
  return Math.max(0, MAX_POWER_TOKENS - (player?.powerTokens || 0));
}

export function grantPowerTokens(state, player, requested, { reason = "", logQuest = true, animate = true, source = "other" } = {}) {
  const amount = Math.max(0, Math.floor(requested || 0));
  if (!player || amount <= 0) return 0;
  if (!TOKEN_SOURCES.has(source)) return 0;

  const granted = Math.min(amount, powerTokenRoom(player));
  if (source === "refund") noteTokenFlow(state, "spent", "", -granted);
  else {
    noteTokenFlow(state, "in", source, granted);
    noteTokenFlow(state, "capped", source, amount - granted);
  }
  if (granted <= 0) {
    log(state, `${player.name} already holds ${MAX_POWER_TOKENS} Power Tokens, the most anyone can hold.`);
    return 0;
  }

  player.powerTokens = (player.powerTokens || 0) + granted;
  if (logQuest) recordQuestEvent(state, "power_token", { count: granted });
  if (reason) log(state, reason);
  if (animate) queuePowerTokensFx(player.id, granted);
  playSfx("sparkle");
  return granted;
}

export function spendPowerTokens(state, player, requested, { reason = "", animate = true } = {}) {
  const amount = Math.max(0, Math.floor(requested || 0));
  if (!player || amount <= 0) return 0;

  const held = player.powerTokens || 0;
  const spent = Math.min(amount, held);
  if (spent <= 0) return 0;

  player.powerTokens = held - spent;
  noteTokenFlow(state, "spent", "", spent);
  if (reason) log(state, reason);
  if (animate) queuePowerTokenSpendFx(player.id, spent);
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
  const spentBy = [];
  for (const player of players) {
    let playerSpent = 0;
    while (left > 0 && (player.powerTokens || 0) > 0) {
      player.powerTokens -= 1;
      noteTokenFlow(state, "spent", "", 1);
      left -= 1;
      spent += 1;
      playerSpent += 1;
    }
    if (playerSpent) spentBy.push({ playerId: player.id, count: playerSpent });
  }

  spentBy.forEach(({ playerId, count }) => queuePowerTokenSpendFx(playerId, count));
  if (spent > 0 && reason) log(state, reason);
  return spent;
}

export function resolvePsychePowerCard(state, player, card) {
  if (!card || card.type !== "psyche-power") return 0;
  const tokens = card.powerTokens ?? PSYCHE_POWER_GRANT;
  const granted = grantPowerTokens(state, player, tokens, {
    reason: `${player.name} plays ${card.name}: +${tokens} Power Token${tokens === 1 ? "" : "s"}.`,
    logQuest: true,
  });
  if (!state.psycheDiscard) state.psycheDiscard = [];
  state.psycheDiscard.push(card);
  playSfx("draw");
  return granted;
}

/** Play a Power Surge from hand (any phase) for its Power Token(s). */
export function playPsychePowerFromHand(state, player, card) {
  if (!player || !card || card.type !== "psyche-power") return 0;
  const idx = player.hand.findIndex((c) => c.instanceId === card.instanceId);
  if (idx < 0) return 0;
  player.hand.splice(idx, 1);
  if (state.selectedHand) {
    state.selectedHand = state.selectedHand.filter((id) => id !== card.instanceId);
  }
  return resolvePsychePowerCard(state, player, card);
}

/** Resolve every Power Surge still in hand (tutorial / bot convenience). */
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
