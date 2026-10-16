import { boonArchetypes } from "./boons.js";
/** Quintessential Archetype passive stat bonuses while acquired. */

const QUINTESSENTIAL = {
  sage: "lucidity",
  magician: "elasticity",
  warrior: "willpower",
};

/**
 * Ainmos: Archetype powers and passives come from Boss Boons, not from
 * Acquiring the Archetype (which is points and quests only).
 */
export function teamAcquiredArchetypes(state) {
  return boonArchetypes(state);
}

export function archetypeStatBonus(state, stat) {
  const acquired = teamAcquiredArchetypes(state);
  return acquired.filter((a) => QUINTESSENTIAL[a.id] === stat).length;
}

export function effectiveDreamerStat(state, dreamer, stat) {
  const base = dreamer?.[stat] ?? 0;
  const bonus = state ? archetypeStatBonus(state, stat) : 0;
  // SOMNIAINMOS seed: every stat +1.
  const seeded = state?.seedFlags?.somniainmos ? 1 : 0;
  return base + bonus + seeded;
}

export function isQuintessentialArchetype(archetype) {
  return Boolean(archetype && QUINTESSENTIAL[archetype.id]);
}

export function getActivatableArchetypePowers(state) {
  return teamAcquiredArchetypes(state).filter((a) => !isQuintessentialArchetype(a) && a.power);
}
