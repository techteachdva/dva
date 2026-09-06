import { isDreambeastPsycheCard } from "./subconscious.js";

export function isWildPsyche(card) {
  return !!(card?.wild || card?.id?.startsWith("wild-"));
}

export function psycheCardValue(card) {
  if (!card) return 0;
  if (isDreambeastPsycheCard(card)) return card.psycheValue || card.value || 3;
  if (isWildPsyche(card)) return 5;
  return card.value || 0;
}
