/** SILLY WORM MIRROR pact — swap A/D and ArrowLeft/ArrowRight lane intent (5 columns). */

export const SILLY_NUM_LANES = 5;

export function sillyMirrorCol5(idx) {
  return SILLY_NUM_LANES - 1 - idx;
}

/**
 * @param {{ wasPressed: (...keys: string[]) => boolean }} inp
 * @param {number} lane
 * @param {number} lastLane inclusive max index (usually 4)
 * @param {boolean} revH
 * @returns {-1|0|1} lane delta
 */
export function sillySwappedHorizontalLaneDelta(inp, lane, lastLane, revH) {
  if (!revH) {
    if (inp.wasPressed("ArrowLeft", "a") && lane > 0) return -1;
    if (inp.wasPressed("ArrowRight", "d") && lane < lastLane) return 1;
    return 0;
  }
  if (inp.wasPressed("ArrowLeft", "a") && lane < lastLane) return 1;
  if (inp.wasPressed("ArrowRight", "d") && lane > 0) return -1;
  return 0;
}
