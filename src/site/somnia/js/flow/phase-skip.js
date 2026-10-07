import { addLog, countEncountersOnBoard } from "../core/state.js";
import { endPhase } from "../core/game.js";
import { meetEndPreview } from "../encounters/meet-phase.js";

export function countBoardDreambeasts(state) {
  return countEncountersOnBoard(
    state,
    (enc) => enc.type === "dreambeast" || enc.boss || enc.type === "boss-dream",
  );
}

/** Read-only preview of Meet-end Forget + Fail (no state mutation). */
export function meetEndTollPreview(state) {
  return meetEndPreview(state);
}

/** @deprecated Timeline hunger was removed in 26.0. */
export function timelineTollPreview(state) {
  return meetEndPreview(state);
}

function finishPhaseAdvance(state, onComplete) {
  if (state.tradeMode) {
    state.tradeMode = false;
    state.trade = null;
    state.selectedHand = [];
    addLog(state, "Trade cancelled — the round is ending.");
  }
  endPhase(state);
  onComplete?.();
}

/**
 * Advance immediately. Players may skip a phase without spending the opener Psyche.
 * Unused Reveal, Explore, and Meet actions draw Psyche as the phase ends.
 */
export function requestEndPhase(state, onComplete = () => {}) {
  finishPhaseAdvance(state, onComplete);
  return true;
}
