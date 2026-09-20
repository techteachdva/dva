import { getPhase, addLog, countEncountersOnBoard } from "./state.js";
import { logMoment } from "./narrator.js";
import { endPhase } from "./game.js";
import { meetEndPreview } from "./meet-phase.js";

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

function forfeitRemainingExploreMoves(state) {
  const left = state.exploreMovesLeft || 0;
  if (left <= 0) return;
  state.exploreMovesLeft = 0;
  logMoment(
    state,
    `Explore ends early — ${left} unused team move${left === 1 ? "" : "s"} forfeited.`,
  );
}

function forfeitRemainingMeetActions(state) {
  const budget = state.meetActionBudget || 0;
  const used = state.meetActionsUsed || 0;
  const left = Math.max(0, budget - used);
  if (left <= 0) return;
  state.meetActionsUsed = budget;
  logMoment(
    state,
    `Meet ends early — ${left} unused team action${left === 1 ? "" : "s"} forfeited.`,
  );
}

/**
 * Advance immediately. Players may skip a phase without spending Psyche.
 * Leftover Explore moves / Meet actions are forfeited with a log line.
 */
export function requestEndPhase(state, onComplete = () => {}) {
  const phase = getPhase(state);
  if (phase === "Explore") forfeitRemainingExploreMoves(state);
  if (phase === "Meet") forfeitRemainingMeetActions(state);
  finishPhaseAdvance(state, onComplete);
  return true;
}
