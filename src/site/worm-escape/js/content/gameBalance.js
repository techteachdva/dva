/**
 * Per-run difficulty from title-screen picks / cheats (wyrm / dragon / greatwyrm).
 * Easy vs Hard vs Ultra are mutually exclusive (`main.js` + `intro.js` / keypad).
 */

export function runIncomingDamageMult(game) {
  if (game?.ultraHardMode) return 2;
  if (game?.hardMode) return 2;
  if (game?.easyMode) return 0.5;
  return 1;
}

/** Scale enemy HP / outgoing tooth damage in combat & Maw. */
export function runEnemyHpMult(game) {
  if (game?.ultraHardMode) return 2;
  if (game?.hardMode) return 2;
  if (game?.easyMode) return 0.5;
  return 1;
}

/** Bile rise rate in climb. */
export function runBileRiseMult(game) {
  return runIncomingDamageMult(game);
}

/** Shorter interval between debris cycles in climb (1 = default). Ultra = denser rain. */
export function runDebrisIntervalMult(game) {
  if (game?.ultraHardMode) return 0.5;
  return 1;
}

/** Climbing upward speed multiplier (progress/sec). */
export function runPlayerClimbMult(game) {
  if (game?.ultraHardMode) return 0.82;
  return 1;
}

/** Lane lerp / dodge responsiveness in combat. */
export function runPlayerMoveMult(game) {
  if (game?.ultraHardMode) return 0.85;
  return 1;
}
