// Global visual modifiers (read each frame from main render; avoids threading `game` through every backdrop call).

export const visualMods = {
  pinkFloyd: false,
  /** Authoritative time for rainbow / warp effects (seconds). */
  t: 0,
};

export function syncVisualModsFromGame(game) {
  visualMods.pinkFloyd = !!game?.pinkFloydMode;
  visualMods.t = game?.t ?? 0;
}
