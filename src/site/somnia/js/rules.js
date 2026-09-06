/** SOMNIA 12.0 rules helpers */

import {
  repressCard,
  isDreambeastPsycheCard,
  repressTopMindstreamFromEachDeck,
} from "./subconscious.js";
import { canTradeBetween as hexCanTradeBetween } from "./hex.js";
import { persistentMeetBonus, sumEffectivePsycheValue } from "./objects.js";
import { PHASES } from "./data.js";
import { isWildPsyche, psycheCardValue } from "./psyche.js";
import { playSfx } from "./audio.js";

export { isWildPsyche, psycheCardValue };

/** Wild Psyche counts as the active phase suit when played for phase actions. */
export function cardCountsAsSuit(card, suit, state) {
  if (!isWildPsyche(card)) return card.suit === suit;
  const phase = PHASES[state.phaseIndex];
  if (phase === "Reveal") return suit === "lucidity";
  if (phase === "Explore") return suit === "elasticity";
  if (phase === "Meet" && !state.meetActionBudget) return suit === "willpower";
  return true;
}
export const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

/** @deprecated Use suitIconHtml() in UI; kept for non-HTML fallbacks. */
export const SUIT_SYMBOLS = {
  lucidity: "◉",
  elasticity: "⇄",
  willpower: "✊",
};

export const SUIT_COLORS = {
  lucidity: "#4a9eff",
  elasticity: "#f0c830",
  willpower: "#e84848",
};

const SUIT_ICON_PATHS = {
  lucidity: '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>',
  elasticity: '<path d="M16 5l-1.42 1.42L18.17 10H7v2h11.17l-3.59 3.58L16 17l6-6-6-6zM8 19l1.42-1.42L5.83 14H17v-2H5.83l3.59-3.58L8 7l-6 6 6 6z"/>',
  willpower: '<path d="M17 8V6h-2V4h-2v2h-2V4H9v2H7v2H5v8c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4V8h-2zm-2 8H9v-6h6v6z"/>',
};

export function suitIconHtml(suit, { className = "suit-icon", size = 14 } = {}) {
  const label = SUIT_LABELS[suit] || suit;
  const path = SUIT_ICON_PATHS[suit];
  if (!path) return "";
  return `<span class="${className} suit-${suit}" role="img" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${path}</svg></span>`;
}

export function dreamerStatsHtml(dreamer) {
  return `
    <div class="dreamer-stats">
      <span class="stat suit-lucidity" title="Lucidity">${suitIconHtml("lucidity", { size: 12 })}${dreamer.lucidity}</span>
      <span class="stat suit-elasticity" title="Elasticity">${suitIconHtml("elasticity", { size: 12 })}${dreamer.elasticity}</span>
      <span class="stat suit-willpower" title="Willpower">${suitIconHtml("willpower", { size: 12 })}${dreamer.willpower}</span>
    </div>
  `;
}

export function formatDreamerStatsText(dreamer) {
  return `${SUIT_LABELS.lucidity} ${dreamer.lucidity} · ${SUIT_LABELS.elasticity} ${dreamer.elasticity} · ${SUIT_LABELS.willpower} ${dreamer.willpower}`;
}

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

export function phaseSuitForOpening(phase) {
  if (phase === "Reveal") return "lucidity";
  if (phase === "Explore") return "elasticity";
  if (phase === "Meet") return "willpower";
  return null;
}

/** True while the table is still waiting for one Dreamer to spend Psyche and set the phase budget. */
export function phaseOpeningActive(state) {
  const phase = PHASES[state.phaseIndex];
  if (phase === "Reveal") return !state.revealLandscapeUsed && !state.landscapePick;
  if (phase === "Explore") return !state.exploreActivated;
  if (phase === "Meet") return !state.meetActionBudget;
  return false;
}

export function statForPhaseBudget(phase, state) {
  if (phase === "Explore" && state.paradoxMeet) return "willpower";
  if (phase === "Meet" && state.paradoxMeet) return "elasticity";
  return phaseSuitForOpening(phase);
}

/** Dreamer whose selected Psyche will be spent to open the current phase (if any). */
export function findPhaseContributor(state) {
  if (!phaseOpeningActive(state)) return null;
  const ids = new Set(state.selectedHand);
  if (!ids.size) return null;

  const owners = [];
  state.players.forEach((player) => {
    if (!player.alive) return;
    const has = player.hand.some((c) => ids.has(c.instanceId));
    if (has) owners.push(player);
  });

  if (owners.length === 1) return owners[0];
  return null;
}

/** Alive Dreamer with the highest stat bonus for the current phase opening. */
export function bestPhaseContributor(state) {
  const phase = PHASES[state.phaseIndex];
  const stat = statForPhaseBudget(phase, state);
  let best = null;
  let bestValue = -1;
  state.players.forEach((player) => {
    if (!player.alive) return;
    const value = totalStat(player, stat);
    if (value > bestValue) {
      bestValue = value;
      best = player;
    }
  });
  return best;
}

export function projectedPhaseBudget(state, player) {
  const phase = PHASES[state.phaseIndex];
  if (phase === "Reveal") return revealBudget(state, player);
  if (phase === "Explore") return exploreBudget(state, player);
  if (phase === "Meet") return meetActionBudgetFromWillpower(state, player);
  return 0;
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
  return selectedCards(state, player).filter((c) => cardCountsAsSuit(c, suit, state));
}

export function sumSelectedValue(state, player, suit = null) {
  const cards = suit ? selectedBySuit(state, player, suit) : selectedCards(state, player);
  return cards.reduce((sum, c) => sum + psycheCardValue(c), 0);
}

export function canSelectCard(state, card, phase, player = null) {
  const active = player || state.players[state.activePlayerIndex];
  const selected = selectedCards(state, active);
  if (state.selectedHand.includes(card.instanceId)) return true;

  if (phaseOpeningActive(state)) {
    if (!active.alive || !active.hand.some((c) => c.instanceId === card.instanceId)) return false;
    const suit = phaseSuitForOpening(phase);
    if (!cardCountsAsSuit(card, suit, state)) return false;
    const suited = selectedBySuit(state, active, suit);
    if (suited.length >= 2) return false;
    return true;
  }

  if (phase === "Meet" && state.meetActionBudget > 0) {
    if (!active.alive || !active.hand.some((c) => c.instanceId === card.instanceId)) return false;
    if (allSelectedCards(state).length >= 3) return false;
    return true;
  }

  if (phase === "Reveal") {
    if (selected.length >= 2) return false;
    return card.suit === "lucidity" || isWildPsyche(card);
  }
  if (phase === "Explore") {
    if (selected.length >= 2) return false;
    return card.suit === "elasticity" || isWildPsyche(card);
  }
  if (phase === "Meet") {
    if (state.meetActionBudget > 0 && state.meetActionsUsed < state.meetActionBudget) {
      if (selected.length >= 3) return false;
      return true;
    }
    if (state.meetActionBudget === 0) {
      if (selected.length >= 2) return false;
      return card.suit === "willpower" || isWildPsyche(card);
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
  const stat = state.paradoxMeet ? "willpower" : "elasticity";
  return played + totalStat(player, stat);
}

export function meetActionBudgetFromWillpower(state, player) {
  const played = sumSelectedValue(state, player, "willpower");
  if (played < 1) return 0;
  const stat = state.paradoxMeet ? "elasticity" : "willpower";
  return played + totalStat(player, stat);
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

function routeSpentHandCard(state, card, { toRepress = false } = {}) {
  if (isWildPsyche(card)) {
    repressCard(state, card);
    repressTopMindstreamFromEachDeck(state);
    playSfx("repress");
    return;
  }
  if (toRepress || isDreambeastPsycheCard(card)) {
    repressCard(state, card);
    playSfx("repress");
  } else {
    state.psycheDiscard.push(card);
    playSfx("discard");
  }
}

export function discardSelected(state, player, { toRepress = false } = {}) {
  const selected = selectedCards(state, player);
  player.hand = player.hand.filter((c) => !state.selectedHand.includes(c.instanceId));
  selected.forEach((card) => routeSpentHandCard(state, card, { toRepress }));
  state.selectedHand = [];
  state.pendingPowerBonus = 0;
  if (state.checkPsycheDeath) state.checkPsycheDeath(player);
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
    selected.forEach((card) => routeSpentHandCard(state, card, { toRepress }));
    byPlayer.push({ player, cards: selected });
    if (state.checkPsycheDeath) state.checkPsycheDeath(player);
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
    const nonWild = cards.filter((c) => !isWildPsyche(c));
    if (nonWild.length <= 1) return { ok: true };
    const sameValue = nonWild.every((c) => psycheCardValue(c) === psycheCardValue(nonWild[0]));
    const sameSuit = nonWild.every((c) => c.suit === nonWild[0].suit);
    if (!sameValue && !sameSuit) {
      return { ok: false, message: "Cerberus Set: all 3 Psyche must share the same value or suit." };
    }
    return { ok: true };
  }

  if (shape === "pair") {
    if (cards.length < 2) {
      return { ok: false, message: "Double requires a Pair: at least 2 Psyche with matching values." };
    }
    const values = cards.map((c) => psycheCardValue(c));
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
    const suited = cards.filter((c) => !isWildPsyche(c));
    const wildCount = cards.length - suited.length;
    const suits = new Set(suited.map((c) => c.suit));
    if (suits.size + wildCount < 3) {
      return { ok: false, message: "Leviathan Balance: play one Lucidity, Elasticity, and Willpower Psyche." };
    }
    return { ok: true };
  }

  return { ok: true };
}
