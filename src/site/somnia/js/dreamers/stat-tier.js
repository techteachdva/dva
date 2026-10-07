/** Dreamer stat tiers for Event riders: 2+ good, 1 bad, 0 bad ×2. */

export function dreamerStat(player, suit) {
  if (!player) return 0;
  const raw = player.dreamer?.[suit] ?? player[suit];
  return Number.isFinite(raw) ? raw : 0;
}

/** @returns {"high"|"mid"|"low"} */
export function statTier(player, suit) {
  const value = dreamerStat(player, suit);
  if (value >= 2) return "high";
  if (value === 1) return "mid";
  return "low";
}

export function isHighStat(player, suit) {
  return statTier(player, suit) === "high";
}

export function isMidStat(player, suit) {
  return statTier(player, suit) === "mid";
}

export function isLowStat(player, suit) {
  return statTier(player, suit) === "low";
}

/** Scale harmful discard/repress counts by tier. */
export function harmCount(player, suit, base = 1) {
  const tier = statTier(player, suit);
  if (tier === "high") return 0;
  if (tier === "mid") return base;
  return base * 2;
}

export function statTierLabel(suit) {
  const name = suit.charAt(0).toUpperCase() + suit.slice(1);
  return `${name} 2+ (boon) · ${name} 1 (strain) · ${name} 0 (harsh ×2)`;
}
