import { isDreambeastPsycheCard } from "./subconscious.js";

export const MAX_PSYCHE_IN_HAND = 10;
export const MAX_ALLIES_IN_HAND = 10;

export function isWildPsyche(card) {
  return !!(card?.wild || card?.id?.startsWith("wild-"));
}

/** Regular Psyche cards in hand (excludes accepted Dreambeast allies). */
export function psycheCardsInHand(player) {
  return (player?.hand || []).filter((c) => !isDreambeastPsycheCard(c));
}

/** Accepted Dreambeast allies in hand. */
export function alliesInHand(player) {
  return (player?.hand || []).filter((c) => isDreambeastPsycheCard(c));
}

export function psycheHandCount(player) {
  return psycheCardsInHand(player).length;
}

export function allyHandCount(player) {
  return alliesInHand(player).length;
}

/** Max accepted Dreambeast allies a Dreamer may hold (separate from Psyche card limit). */
export function allyHandLimitForPlayer(_state, _player) {
  return MAX_ALLIES_IN_HAND;
}

export function allyRoomInHand(state, player) {
  return Math.max(0, allyHandLimitForPlayer(state, player) - allyHandCount(player));
}

export function canAddAllyToHand(state, player) {
  return allyRoomInHand(state, player) > 0;
}

/** Effective Psyche health — each ally counts as 1 Psyche, same as a hand card. */
export function effectivePsycheHealth(player) {
  return psycheHandCount(player) + alliesInHand(player).length;
}

export function hasPsycheHealth(player) {
  return effectivePsycheHealth(player) > 0;
}

/** @deprecated Use effectivePsycheHealth */
export function handHealthCount(player) {
  return effectivePsycheHealth(player);
}

export function psycheCardValue(card) {
  if (!card) return 0;
  if (isDreambeastPsycheCard(card)) return card.psycheValue || card.value || 3;
  if (isWildPsyche(card)) return 5;
  return card.value || 0;
}
