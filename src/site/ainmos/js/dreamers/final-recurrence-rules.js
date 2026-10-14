/** Final Recurrence: Remaining Archetypes are Power 12 Dreambeast fights. */
export const FINAL_ARCHETYPE_POWER = 12;

const PHASES = ["Reveal", "Explore", "Meet"];

export function undefeatedFinalArchetypes(tile) {
  if (!tile) return [];
  const list = tile.finalArchetypes?.length
    ? tile.finalArchetypes
    : (tile.finalArchetype ? [tile.finalArchetype] : []);
  return list.filter((arch) => arch && !arch.defeated);
}

/** The selected Landscape is a Remaining Archetype fight. Switching Dreamers must not leave it. */
export function archetypeMeetLocked(state) {
  if (!state?.finalRecurrence) return false;
  if (PHASES[state.phaseIndex] !== "Meet") return false;
  const tile = state.board?.find((entry) => entry.id === state.selectedLandscapeId);
  return undefeatedFinalArchetypes(tile).length > 0;
}

/** Meet is open and the selected Landscape still holds a Remaining Archetype. */
export function archetypeSpreadOpen(state) {
  if (!state?.finalRecurrence) return false;
  if (PHASES[state.phaseIndex] !== "Meet") return false;
  if (!(state.meetActionBudget > 0)) return false;
  const tile = state.board?.find((entry) => entry.id === state.selectedLandscapeId);
  return undefeatedFinalArchetypes(tile).length > 0;
}
