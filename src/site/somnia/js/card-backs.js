/** Official Somnia card backs and wordmark. */

export const SOMNIA_LOGO = "images/somnia-logo.png";

export const CARD_BACKS = {
  psyche: "images/backs/psyche.webp",
  archetype: "images/backs/archetype.webp",
  dream: "images/somnia-logo.png",
  lucidity: "images/backs/mindstream-lucidity.webp",
  elasticity: "images/backs/mindstream-elasticity.webp",
  willpower: "images/backs/mindstream-willpower.webp",
};

export function cardBackForDeckId(deckId) {
  if (!deckId) return CARD_BACKS.psyche;
  if (deckId === "psyche") return CARD_BACKS.psyche;
  if (deckId === "archetype") return CARD_BACKS.archetype;
  if (deckId === "dream") return CARD_BACKS.dream;
  if (deckId.startsWith("mindstream-")) {
    return CARD_BACKS[deckId.replace("mindstream-", "")] || CARD_BACKS.lucidity;
  }
  return CARD_BACKS.psyche;
}

export function cardBackForCard(card) {
  if (!card) return CARD_BACKS.psyche;
  const type = card.type || "";
  if (type === "psyche" || type === "psyche-power" || type === "wild") return CARD_BACKS.psyche;
  if (type === "archetype") return CARD_BACKS.archetype;
  if (type === "dream" || type === "final" || type === "boss-dream") return CARD_BACKS.dream;
  const suit = card.suit;
  if (suit && CARD_BACKS[suit]) return CARD_BACKS[suit];
  return CARD_BACKS.psyche;
}

export function mindstreamSuitFromDeckId(deckId) {
  if (!deckId?.startsWith("mindstream-")) return null;
  return deckId.replace("mindstream-", "");
}
