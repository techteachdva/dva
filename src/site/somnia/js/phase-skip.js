import { getPhase, addLog, checkDefeat } from "./state.js";
import { SUIT_LABELS, phaseSuitForOpening } from "./rules.js";
import { endPhase } from "./game.js";
import { enqueueCollectiveRepressFromHand } from "./subconscious.js";
import { showPhaseSkipConfirm, showMeetDreambeastSkipConfirm } from "./ui.js";

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

function discardDreamCardsFromDeck(state, count) {
  let discarded = 0;
  for (let i = 0; i < count; i += 1) {
    const card = state.dreamDeck.shift();
    if (!card) break;
    if (!state.dreamDiscard) state.dreamDiscard = [];
    state.dreamDiscard.push(card);
    discarded += 1;
  }
  if (discarded > 0) {
    addLog(
      state,
      `The Timeline frays — ${discarded} Dream card${discarded === 1 ? "" : "s"} discarded from the deck.`,
    );
  }
  checkDefeat(state);
  return discarded;
}

function finishPhaseAdvance(state, onComplete) {
  endPhase(state);
  onComplete?.();
}

function applyMeetDreambeastPenalty(state, count, method, onComplete) {
  if (method === "discard") {
    discardDreamCardsFromDeck(state, count);
    finishPhaseAdvance(state, onComplete);
    return;
  }

  state.onResolutionIdle = () => finishPhaseAdvance(state, onComplete);
  enqueueCollectiveRepressFromHand(state, count, {
    reason: `${count} Dreambeast${count === 1 ? "" : "s"} remain — collectively Repress ${count} Psyche card${count === 1 ? "" : "s"} (consume your souls).`,
  });
  onComplete();
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

function showMeetDreambeastWarning(state, beastCount, onComplete, onCancel) {
  const names = state.board
    .filter((t) => t.encounter && (t.encounter.type === "dreambeast" || t.encounter.boss))
    .map((t) => t.encounter.name)
    .slice(0, 4);
  const roster = names.length ? ` (${names.join(", ")}${beastCount > names.length ? ", …" : ""})` : "";

  showMeetDreambeastSkipConfirm({
    beastCount,
    roster,
    onRepressSouls: () => applyMeetDreambeastPenalty(state, beastCount, "repress", onComplete),
    onConsumeTimeline: () => applyMeetDreambeastPenalty(state, beastCount, "discard", onComplete),
    onCancel,
  });
}

/**
 * Gate phase advance with skip warnings. Returns true if the phase advanced immediately.
 */
export function requestEndPhase(state, onComplete = () => {}) {
  const phase = getPhase(state);
  const psycheSpent = phasePsycheSpent(state);
  const beastCount = countBoardDreambeasts(state);

  if (phase === "Meet" && !psycheSpent && beastCount > 0) {
    showMeetDreambeastWarning(
      state,
      beastCount,
      onComplete,
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
