/**
 * One ease number for a run.
 *
 * Questions and mice do not move together. A miss makes the next question in
 * that strand easier and does not speed the mice. A clean answer that was
 * actually read makes the next question harder and leaves the mice alone.
 * Rushing, damage, a long hide, or the floor arrows ease the mice off only
 * once the player is not in the middle of a chase.
 */

const BASE = {
  beginner: 1,
  chill: 1,
  normal: 2,
  questions: 1,
  nightmare: 3,
};

export function startingEase(difficulty) {
  if (difficulty === 'beginner' || difficulty === 'chill') return -1;
  if (difficulty === 'nightmare') return 1;
  return 0;
}

export function clampEase(n) {
  return Math.max(-2, Math.min(2, Math.round(n)));
}

export function questionTarget(difficulty, ease) {
  const base = BASE[difficulty] ?? 2;
  return Math.max(1, Math.min(3, base + clampEase(ease)));
}

/** About ten percent per step. 1 is the preset. */
export function enemyScale(ease) {
  return 1 + clampEase(ease) * 0.1;
}

export function strandOf(q) {
  const std = String(q?.std || q?.standard || '');
  const item = std.match(/ITEM\s+[\d.]+/);
  if (item) return item[0];
  const id = String(q?.id || '');
  const prefix = id.split('-')[0];
  return prefix || 'general';
}

/**
 * Hunters keep the speed they had when they spotted you. Wanderers pick up
 * the new scale, so a notch lands on the next approach, not mid-bite.
 */
export function easeFactor(diff, enemy) {
  const next = diff?.easeScale ?? 1;
  if (!enemy) return next;
  const chasing = enemy.hunting || enemy.state === 1;
  if (chasing) {
    if (enemy._easeHold == null) enemy._easeHold = next;
    return enemy._easeHold;
  }
  enemy._easeHold = next;
  return next;
}
