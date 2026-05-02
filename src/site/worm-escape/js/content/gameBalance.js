/**
 * Per-run difficulty bias from cheats (wyrm / dragon), applied to incoming pain.
 * Mutually exclusive: hard wins if both flags were ever set.
 */

export function runIncomingDamageMult(game) {
  if (game?.hardMode) return 2;
  if (game?.easyMode) return 0.5;
  return 1;
}

/** Scale enemy HP / outgoing tooth damage in combat & Maw. */
export function runEnemyHpMult(game) {
  if (game?.hardMode) return 2;
  if (game?.easyMode) return 0.5;
  return 1;
}

/** Bile rise rate in climb. */
export function runBileRiseMult(game) {
  return runIncomingDamageMult(game);
}
