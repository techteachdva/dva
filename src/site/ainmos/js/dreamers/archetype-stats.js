/** Quintessential Archetype passive stat bonuses while acquired. */

const QUINTESSENTIAL = {
  sage: "lucidity",
  magician: "elasticity",
  warrior: "willpower",
};

export function teamAcquiredArchetypes(state) {
  const seen = new Set();
  const list = [];
  state.players.forEach((p) => {
    (p.acquiredArchetypes || []).forEach((arch) => {
      if (seen.has(arch.id)) return;
      seen.add(arch.id);
      list.push(arch);
    });
  });
  return list;
}

export function archetypeStatBonus(state, stat) {
  const acquired = teamAcquiredArchetypes(state);
  return acquired.filter((a) => QUINTESSENTIAL[a.id] === stat).length;
}

export function effectiveDreamerStat(state, dreamer, stat) {
  const base = dreamer?.[stat] ?? 0;
  const bonus = state ? archetypeStatBonus(state, stat) : 0;
  return base + bonus;
}

export function isQuintessentialArchetype(archetype) {
  return Boolean(archetype && QUINTESSENTIAL[archetype.id]);
}

export function getActivatableArchetypePowers(state) {
  return teamAcquiredArchetypes(state).filter((a) => !isQuintessentialArchetype(a) && a.power);
}
