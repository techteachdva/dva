import { isDreambeastPsycheCard } from "./subconscious.js";

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
