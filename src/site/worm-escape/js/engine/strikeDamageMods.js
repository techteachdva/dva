/** Shared outbound damage jitter (gambling pact, pact flats, maw/teeth swings). */

export function applyOutboundStrikeDice(baseInt, pm) {
  const pmSafe = pm || {};
  let b = baseInt;
  if (pmSafe.gamblerVariance && typeof b === "number") {
    b = Math.max(1, Math.round(b * (0.5 + Math.random() * 2.5)));
  }
  if (typeof pmSafe.outgoingFlat === "number" && pmSafe.outgoingFlat !== 0) {
    b = Math.max(1, Math.round(b + pmSafe.outgoingFlat));
  }
  if (pmSafe.flipDamage5050) {
    b = Math.max(1, Math.round(b + (Math.random() < 0.5 ? 15 : -15)));
  }
  return Math.max(1, b);
}
