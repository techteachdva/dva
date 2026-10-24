/**
 * Soft floor-arrow hint.
 *
 * The arrows are not a GPS. They stay dark while the player is still searching,
 * and they wake only after the player has stayed in the same pocket of the maze
 * long enough that "where is a Chromebook?" has become the problem. Following
 * them toward the nearest locked terminal puts them back to sleep.
 */

export const ARROW_HINT = {
  lingerSeconds: 20,
  /** One terminal left: the player has already learned the maze, so help sooner. */
  lingerLast: 11,
  /** Cells of travel from the anchor that still count as "the same area". */
  areaCells: 3.25,
  /** How far from the player a woken arrow is allowed to show. */
  showRadiusCells: 2.4,
  fadeSeconds: 1.2,
  /** Getting this many cells closer means the hint did its job. */
  progressCells: 4,
  /** A hint that is ignored fades so the floor does not become a permanent guide. */
  guideSeconds: 36,
};

export function initialArrowHint(x, z) {
  return {
    anchorX: x,
    anchorZ: z,
    time: 0,
    active: false,
    fade: 0,
    shownDist: Infinity,
    guideTime: 0,
    justRevealed: false,
  };
}

/**
 * @param {ReturnType<typeof initialArrowHint>} s
 * @param {number} dt
 * @param {number} px
 * @param {number} pz
 * @param {number} cellDist cells from the linger anchor
 * @param {number} flowDist maze steps to the nearest locked terminal, or -1
 * @param {number} unsolved how many terminals are still locked
 */
export function stepArrowHint(s, dt, px, pz, cellDist, flowDist, unsolved) {
  const cfg = ARROW_HINT;
  if (unsolved <= 0) {
    return {
      ...s,
      anchorX: px,
      anchorZ: pz,
      time: 0,
      active: false,
      fade: 0,
      shownDist: Infinity,
      guideTime: 0,
      justRevealed: false,
    };
  }

  if (!s.active) {
    if (cellDist > cfg.areaCells) {
      return {
        ...s,
        anchorX: px,
        anchorZ: pz,
        time: 0,
        fade: 0,
        justRevealed: false,
      };
    }
    const time = s.time + dt;
    const need = unsolved === 1 ? cfg.lingerLast : cfg.lingerSeconds;
    if (time >= need && flowDist >= 0) {
      return {
        ...s,
        time,
        active: true,
        fade: 0,
        shownDist: flowDist,
        guideTime: 0,
        justRevealed: true,
      };
    }
    return { ...s, time, justRevealed: false };
  }

  const fade = Math.min(1, s.fade + dt / cfg.fadeSeconds);
  const guideTime = s.guideTime + dt;
  const progressed = flowDist >= 0 && s.shownDist - flowDist >= cfg.progressCells;
  const expired = guideTime >= cfg.guideSeconds;
  if (progressed || expired) {
    return {
      anchorX: px,
      anchorZ: pz,
      time: 0,
      active: false,
      fade: 0,
      shownDist: Infinity,
      guideTime: 0,
      justRevealed: false,
    };
  }
  return { ...s, fade, guideTime, justRevealed: false };
}
