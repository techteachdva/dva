/**
 * Ainmos night structure, in the words the player sees.
 *
 *   Night  = 4 / 7 / 10 Cycles (Daydream / Nap / Deep Sleep)
 *   Cycle  = 3 Dreams; the third is the Boss Dream
 *   Dream  = one round: Reveal → Explore → Meet (the three REM phases)
 *   So a Cycle is 9 phases, and its 9th phase is the Meet where the Boss waits.
 *
 * (The engine's older name for a Cycle is "ante": ANTES_BY_LENGTH, plan.ante.)
 */

import { antesForLength } from "../encounters/boss-ladder.js";

export const DREAMS_PER_CYCLE = 3;
export const PHASES_PER_DREAM = 3;
export const PHASES_PER_CYCLE = DREAMS_PER_CYCLE * PHASES_PER_DREAM;
export const PHASE_NAMES = ["Reveal", "Explore", "Meet"];
export const PHASE_SUITS = ["lucidity", "elasticity", "willpower"];

export function cyclesForLength(lengthKey) {
  return antesForLength(lengthKey);
}

/** Where the night stands: Cycle, Dream within it, phase within that Dream, and phase within the Cycle. */
export function cyclePosition(state) {
  const plan = state?.nightPlan || [];
  const cycles = cyclesForLength(state?.lengthKey);
  const phase = Math.min(PHASES_PER_DREAM, Math.max(1, (state?.phaseIndex || 0) + 1));
  if (!plan.length) {
    return { cycle: 1, cycles, dream: 1, phase, step: phase, longNight: false, planIndex: 0 };
  }
  const drawn = plan.length - (state.dreamDeck?.length || 0);
  // This round's Dream is the last one drawn; before it is drawn, the next one in the deck.
  const planIndex = Math.min(plan.length - 1, Math.max(0, state.dreamDrawn ? drawn - 1 : drawn));
  const cycle = Math.floor(planIndex / DREAMS_PER_CYCLE) + 1;
  const dream = (planIndex % DREAMS_PER_CYCLE) + 1;
  return {
    cycle,
    cycles,
    dream,
    phase,
    step: (dream - 1) * PHASES_PER_DREAM + phase,
    longNight: !!state.longNight,
    planIndex,
  };
}

/** "Cycle 2 of 4 · Dream 3 of 3 (Boss) · Meet · phase 9 of 9" */
export function cyclePositionText(state) {
  const pos = cyclePosition(state);
  if (pos.longNight) return "The Long Night: every Cycle is spent. Each dusk takes more.";
  const boss = pos.dream === DREAMS_PER_CYCLE ? " (Boss)" : pos.dream === 2 ? " (Mini-Boss)" : "";
  return `Cycle ${pos.cycle} of ${pos.cycles} · Dream ${pos.dream} of ${DREAMS_PER_CYCLE}${boss} · ${PHASE_NAMES[pos.phase - 1]} · phase ${pos.step} of ${PHASES_PER_CYCLE}`;
}
