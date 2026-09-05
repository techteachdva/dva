/** SOMNIA 12.0 rules helpers */

import { repressCards } from "./subconscious.js";
import { canTradeBetween as hexCanTradeBetween } from "./hex.js";
import { persistentMeetBonus, sumEffectivePsycheValue } from "./objects.js";
export const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

export const SUIT_SYMBOLS = {
  lucidity: "◆",
  elasticity: "◇",
  willpower: "▲",
};

export const MEET_ACTIONS = {
  MEET: "meet",
  LANDSCAPE: "landscape",
  TRADE: "trade",
};

export function dreamerStat(dreamer, stat) {
  return dreamer[stat] ?? 0;
}

export function totalStat(player, stat) {
  return dreamerStat(player.dreamer, stat);
}

export function selectedCards(state, player) {
  return player.hand.filter((c) => state.selectedHand.includes(c.instanceId));
}

/** All Psyche cards selected across every Dreamer (cooperative Meet pool). */
export function allSelectedCards(state) {
  const ids = new Set(state.selectedHand);
  const cards = [];
  state.players.forEach((player) => {
    player.hand.forEach((card) => {
      if (ids.has(card.instanceId)) cards.push(card);
    });
  });
  return cards;
}

export function cardOwner(state, card) {
  return state.players.find((p) => p.hand.some((c) => c.instanceId === card.instanceId)) || null;
}

export function selectedBySuit(state, player, suit) {
  return selectedCards(state, player).filter((c) => c.suit === suit);
}

export function sumSelectedValue(state, player, suit = null) {
  const cards = suit ? selectedBySuit(state, player, suit) : selectedCards(state, player);
  return cards.reduce((sum, c) => sum + (c.value || 0), 0);
}

export function canSelectCard(state, card, phase, player = null) {
  const active = player || state.players[state.activePlayerIndex];
  const selected = selectedCards(state, active);
  if (state.selectedHand.includes(card.instanceId)) return true;

  if (phase === "Meet" && state.meetActionBudget > 0) {
    if (!active.alive || !active.hand.some((c) => c.instanceId === card.instanceId)) return false;
    if (allSelectedCards(state).length >= 3) return false;
    return true;
  }

  if (phase === "Reveal") {
    if (selected.length >= 2) return false;
    return card.suit === "lucidity";
  }
  if (phase === "Explore") {
    if (selected.length >= 2) return false;
    return card.suit === "elasticity";
  }
  if (phase === "Meet") {
    if (state.meetActionBudget > 0 && state.meetActionsUsed < state.meetActionBudget) {
      if (selected.length >= 3) return false;
      return true;
    }
    if (state.meetActionBudget === 0) {
      if (selected.length >= 2) return false;
      return card.suit === "willpower";
    }
    return selected.length < 3;
  }
  return selected.length < 3;
}

export function revealBudget(state, player) {
  const played = sumSelectedValue(state, player, "lucidity");
  if (played < 1) return 0;
  return played + totalStat(player, "lucidity");
}

export function exploreBudget(state, player) {
  const played = sumSelectedValue(state, player, "elasticity");
  if (played < 1) return 0;
  return played + totalStat(player, "elasticity");
}

export function meetActionBudgetFromWillpower(state, player) {
  const played = sumSelectedValue(state, player, "willpower");
  if (played < 1) return 0;
  return played + totalStat(player, "willpower");
}

export function meetPlayTotal(state, player) {
  const selected = selectedCards(state, player);
  const base = sumEffectivePsycheValue(state, player, selected);
  return base + (state.pendingPowerBonus || 0) + persistentMeetBonus(state, player);
}

/** Cooperative Meet total — pool up to 3 Psyche from any Dreamers. */
export function coopMeetPlayTotal(state) {
  const selected = allSelectedCards(state);
  if (!selected.length) return state.pendingPowerBonus || 0;

  let total = state.pendingPowerBonus || 0;
  const owners = new Set();
  selected.forEach((card) => {
    const owner = cardOwner(state, card);
    if (owner) owners.add(owner.id);
  });
  owners.forEach((ownerId) => {
    const owner = state.players.find((p) => p.id === ownerId);
    if (!owner) return;
    const cards = selected.filter((c) => cardOwner(state, c)?.id === ownerId);
    total += sumEffectivePsycheValue(state, owner, cards);
    total += persistentMeetBonus(state, owner);
  });
  return total;
}

export function discardSelected(state, player, { toRepress = false } = {}) {
  const selected = selectedCards(state, player);
  player.hand = player.hand.filter((c) => !state.selectedHand.includes(c.instanceId));
  if (toRepress) {
    repressCards(state, selected);
  } else {
    state.psycheDiscard.push(...selected);
  }
  state.selectedHand = [];
  state.pendingPowerBonus = 0;
  return selected;
}

/** Discard the cooperative Meet pool from every contributing Dreamer. */
export function discardAllSelected(state, { toRepress = false } = {}) {
  const ids = new Set(state.selectedHand);
  const byPlayer = [];
  state.players.forEach((player) => {
    const selected = player.hand.filter((c) => ids.has(c.instanceId));
    if (!selected.length) return;
    player.hand = player.hand.filter((c) => !ids.has(c.instanceId));
    if (toRepress) repressCards(state, selected);
    else state.psycheDiscard.push(...selected);
    byPlayer.push({ player, cards: selected });
  });
  state.selectedHand = [];
  state.pendingPowerBonus = 0;
  return byPlayer;
}

export function flipPowerBonus() {
  return Math.random() < 0.5 ? 2 : 1;
}

export function canTradeBetween(state, landscapeA, landscapeB) {
  return hexCanTradeBetween(state, landscapeA, landscapeB);
}

export function opposingSuit(suit) {
  const cycle = { lucidity: "willpower", willpower: "elasticity", elasticity: "lucidity" };
  return cycle[suit] || null;
}

const BOSS_PLAY_SHAPES = {
  cerberus: "set",
  double: "pair",
  leviathan: "balance",
};

export function bossPlayShapeRequired(encounter) {
  if (!encounter) return null;
  return BOSS_PLAY_SHAPES[encounter.id] || (encounter.boss ? BOSS_PLAY_SHAPES[encounter.id] : null);
}

export function bossPlayShapeLabel(shape) {
  if (shape === "set") return "Set (3 same value or suit)";
  if (shape === "pair") return "Pair (2 matching values)";
  if (shape === "balance") return "Balance (one of each suit)";
  return shape;
}

export function validateBossPlayShape(encounter, cards) {
  const shape = bossPlayShapeRequired(encounter);
  if (!shape) return { ok: true };

  if (shape === "set") {
    if (cards.length !== 3) {
      return { ok: false, message: "Cerberus requires a Set: exactly 3 Psyche (same value or suit)." };
    }
    const sameValue = cards.every((c) => c.value === cards[0].value);
    const sameSuit = cards.every((c) => c.suit === cards[0].suit);
    if (!sameValue && !sameSuit) {
      return { ok: false, message: "Cerberus Set: all 3 Psyche must share the same value or suit." };
    }
    return { ok: true };
  }

  if (shape === "pair") {
    if (cards.length < 2) {
      return { ok: false, message: "Double requires a Pair: at least 2 Psyche with matching values." };
    }
    const values = cards.map((c) => c.value);
    const hasPair = values.some((v) => values.filter((x) => x === v).length >= 2);
    if (!hasPair) {
      return { ok: false, message: "Double Pair: at least 2 played Psyche must share the same value." };
    }
    return { ok: true };
  }

  if (shape === "balance") {
    if (cards.length !== 3) {
      return { ok: false, message: "Leviathan requires Balance: exactly 3 Psyche, one of each suit." };
    }
    const suits = new Set(cards.map((c) => c.suit));
    if (suits.size !== 3) {
      return { ok: false, message: "Leviathan Balance: play one Lucidity, Elasticity, and Willpower Psyche." };
    }
    return { ok: true };
  }

  return { ok: true };
}
