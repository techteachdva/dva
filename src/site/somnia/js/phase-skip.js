import { getPhase } from "./state.js";
import { SUIT_LABELS, phaseSuitForOpening } from "./rules.js";
import { endPhase } from "./game.js";
import { showPhaseSkipConfirm } from "./ui.js";

const PHASE_SKIP_COPY = {
  Reveal: {
    suit: "lucidity",
    action: "spend Lucidity to reveal Landscapes",
  },
  Explore: {
    suit: "elasticity",
    action: "spend Elasticity for shared moves",
  },
  Meet: {
    suit: "willpower",
    action: "spend Willpower for shared Meet actions",
  },
};

export function countBoardDreambeasts(state) {
  return state.board.filter(
    (t) => t.encounter && (t.encounter.type === "dreambeast" || t.encounter.boss),
  ).length;
}

export function phasePsycheSpent(state) {
  const phase = getPhase(state);
  if (phase === "Reveal") return state.revealLandscapeUsed;
  if (phase === "Explore") return state.exploreActivated;
  if (phase === "Meet") return state.meetActionBudget > 0;
  return true;
}

function finishPhaseAdvance(state, onComplete) {
  endPhase(state);
  onComplete?.();
}

function forfeitRemainingExploreMoves(state) {
  const left = state.exploreMovesLeft || 0;
  if (left <= 0) return;
  state.exploreMovesLeft = 0;
  addLog(
    state,
    `Explore ends early — ${left} unused team move${left === 1 ? "" : "s"} forfeited.`,
  );
}

function showExploreMovesLeftWarning(state, movesLeft, onConfirm, onCancel) {
  showPhaseSkipConfirm({
    title: "Moves remaining",
    message: `Your team still has <strong>${movesLeft}</strong> shared Explore move${movesLeft === 1 ? "" : "s"} left. Advance to <strong>Meet</strong> anyway? Unused moves are lost.`,
    confirmLabel: "Go to Meet",
    onConfirm: () => {
      forfeitRemainingExploreMoves(state);
      onConfirm();
    },
    onCancel,
  });
}

function showGenericPhaseSkipWarning(state, onConfirm, onCancel) {
  const phase = getPhase(state);
  const copy = PHASE_SKIP_COPY[phase];
  const suit = copy?.suit || phaseSuitForOpening(phase);
  const suitLabel = SUIT_LABELS[suit] || suit;

  showPhaseSkipConfirm({
    title: `Skip ${phase} actions?`,
    message: `You're advancing without spending any <strong>${suitLabel}</strong> Psyche to ${copy?.action || "open this phase"}.`,
    confirmLabel: `End ${phase}`,
    onConfirm,
    onCancel,
  });
}

/**
 * Gate phase advance with skip warnings. Returns true if the phase advanced immediately.
 */
export function requestEndPhase(state, onComplete = () => {}) {
  const phase = getPhase(state);
  const psycheSpent = phasePsycheSpent(state);

  if (phase === "Explore" && state.exploreActivated && (state.exploreMovesLeft || 0) > 0) {
    showExploreMovesLeftWarning(
      state,
      state.exploreMovesLeft,
      () => finishPhaseAdvance(state, onComplete),
      () => {},
    );
    return false;
  }

  if (!psycheSpent && PHASE_SKIP_COPY[phase]) {
    showGenericPhaseSkipWarning(
      state,
      () => finishPhaseAdvance(state, onComplete),
      () => {},
    );
    return false;
  }

  finishPhaseAdvance(state, onComplete);
  return true;
}
