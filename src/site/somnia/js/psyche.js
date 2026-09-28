import { isDreambeastPsycheCard } from "./subconscious.js";

export const MAX_PSYCHE_IN_HAND = 10;
/** @deprecated Allies share the Psyche hand limit. Kept so older UI imports resolve. */
export const MAX_ALLIES_IN_HAND = MAX_PSYCHE_IN_HAND;

export function isWildPsyche(card) {
  return !!(card?.wild || card?.id?.startsWith("wild-"));
}

/** Each Dreamer may offer this many Psyche in one trade. */
export const TRADE_OFFER_LIMIT = 3;

/** Psyche that can move in a trade. Power Surge and accepted allies stay put. */
export function isTradablePsyche(card) {
  if (!card || card.type === "psyche-power" || isDreambeastPsycheCard(card)) return false;
  return card.type === "psyche" || isWildPsyche(card);
}

export function tradablePsycheInHand(player) {
  return (player?.hand || []).filter(isTradablePsyche);
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

/** Allies count toward the same 10-card hand as Psyche. */
export function allyHandLimitForPlayer(_state, _player) {
  return MAX_PSYCHE_IN_HAND;
}

export function allyRoomInHand(state, player) {
  return Math.max(0, MAX_PSYCHE_IN_HAND - (player?.hand?.length || 0));
}

export function canAddAllyToHand(state, player) {
  return (player?.hand?.length || 0) < MAX_PSYCHE_IN_HAND;
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
