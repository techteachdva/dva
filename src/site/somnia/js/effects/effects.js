import {
  addLog,
  drawPsycheForPlayer,
  beginFinalRecurrence,
} from "../core/state.js";
import { forgetEdgeLandscapes, triggerBedFinalRecurrence } from "../board/landscapes.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { grantPowerTokens } from "../cards/power-tokens.js";
import { applyMeetEndConsequences } from "../encounters/meet-phase.js";
import { opposingSuit } from "../core/rules.js";
import {
  requestReturnCards,
  enqueueRepressFromHand,
  enqueueDiscardFromHand,
  enqueueCollectiveRepressFromHand,
} from "../dreamers/subconscious.js";
import { FINAL_RECURRENCE_PSYCHE_REQUIRED } from "../dreamers/final-recurrence-rules.js";
import { logMoment } from "../core/narrator.js";
import { onObjectDrawn } from "./objects.js";
import { beginMindstreamCardChoice, beginDreamCardChoice } from "../cards/mindstream-choices.js";
import { beginEventOrWaste } from "../board/event-landscapes.js";
import { isBossDreamCard, spawnBossEncounterOnBed } from "../cards/dream-deck.js";

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function dreamerCount(state) {
  return alivePlayers(state).length;
}

export function returnCards(state, count, player = null) {
  const result = requestReturnCards(state, count, player);
  if (result?.pending) {
    addLog(state, `Choose ${result.count} card(s) to Return from the Subconscious.`);
    return [];
  }
  return result;
}

export function allDrawPsyche(state, count) {
  alivePlayers(state).forEach((p) => {
    const n = drawPsycheForPlayer(state, p, count);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
  });
}

export function repressFromHand(state, player, count, { reason = "" } = {}) {
  if (count <= 0) return;
  enqueueRepressFromHand(state, player, count, {
    reason: reason || `${player.name}: Repress ${count} Psyche card(s) from hand.`,
  });
}

/** Clear per-round dream flags at the start of a new round. */
export function clearDreamRoundFlags(state) {
  state.abductionCarried = [];
  state.meetOnlyRound = false;
  state.bargainingDream = false;
  state.temptationDream = false;
  state.wanderlustTarget = 0;
  state.wanderlustMoves = 0;
  state.pickEncounterOnSpawn = false;
  state.skipExploreNextRound = false;
  state.skipExploreReason = null;
  state.rivalryEncountersOnBed = 0;
  state.rivalryLeftover = 0;
  state.paradoxMeet = false;
  state.chaseDream = false;
  state.chaseTrapped = [];
  state.skipLandscapeActionsNextMeet = false;
}

export function canSpendMeetAction(state, player, action, MEET_ACTIONS) {
  if (state.skipLandscapeActionsNextMeet && action === MEET_ACTIONS.LANDSCAPE) {
    return false;
  }
  if (state.meetOnlyRound && action !== MEET_ACTIONS.MEET) {
    return false;
  }
  if (state.abductionCarried?.includes(player.id) && action !== MEET_ACTIONS.MEET) {
    return false;
  }
  if (state.chaseTrapped?.includes(player.id) && action !== MEET_ACTIONS.MEET) {
    return false;
  }
  return true;
}

export function onExploreMove(state) {
  if (!state.wanderlustTarget) return;
  state.wanderlustMoves = (state.wanderlustMoves || 0) + 1;
}

export function onExplorePhaseEnd(state) {
  if (!state.wanderlustTarget) return;
  if ((state.wanderlustMoves || 0) >= state.wanderlustTarget) {
    allDrawPsyche(state, 3);
    logMoment(state, "Wanderlust fulfilled — all Dreamers draw 3 Psyche.");
  }
  state.wanderlustTarget = 0;
  state.wanderlustMoves = 0;
}

export function onMeetPhaseEnd(state) {
  applyMeetEndConsequences(state);

  if (state.rivalryLeftover > 0) {
    const cost = state.rivalryLeftover;
    enqueueCollectiveRepressFromHand(state, cost, {
      toDiscard: true,
      reason: `Rivalry — the table chooses ${cost} Psyche to discard.`,
    });
    logMoment(state, `Rivalry — leftover Encounters cost ${cost} Psyche.`);
  }
  state.rivalryLeftover = 0;
  state.rivalryEncountersOnBed = 0;
  state.paradoxMeet = false;
  state.chaseDream = false;
  state.chaseTrapped = [];
  state.abductionCarried = [];
  state.meetOnlyRound = false;
  state.skipLandscapeActionsNextMeet = false;
  state.pickEncounterOnSpawn = false;
  state.freeQuestMeet = null;
  state.pendingMindstreamMeet = null;
}

const DREAM_EFFECTS = {
  delta: (state) => {
    forgetEdgeLandscapes(state, state.finalRecurrence ? 6 : 4);
    alivePlayers(state).forEach((p) => {
      const n = state.finalRecurrence ? 2 : 1;
      for (let i = 0; i < n && p.hand.length; i += 1) {
        state.psycheDiscard.push(p.hand.pop());
      }
    });
    recordQuestEvent(state, "discard_psyche", { count: dreamerCount(state) });
    logMoment(state, state.finalRecurrence ? "Delta — the map frays; Psyche slips away." : "Delta waves crash through the Dreamscape.");
  },
  theta: (state) => {
    forgetEdgeLandscapes(state, state.finalRecurrence ? 10 : 8);
    if (state.finalRecurrence) {
      alivePlayers(state).forEach((p) => {
        enqueueRepressFromHand(state, p, 1, { reason: "Theta — Repress 1 Psyche in the Final Recurrence." });
      });
      logMoment(state, "Theta — deep sleep pulls your hand into the Subconscious.");
    } else {
      allDrawPsyche(state, 2);
    }
  },
  alpha: (state, _player, helpers) => {
    forgetEdgeLandscapes(state, state.finalRecurrence ? 6 : 4);
    alivePlayers(state).forEach((p) => {
      if (state.finalRecurrence) {
        enqueueRepressFromHand(state, p, 2, { reason: "Alpha — Repress 2 Psyche." });
      } else if (helpers?.drawObjects) helpers.drawObjects(state, p, 1, helpers);
    });
  },
  beta: (state) => {
    forgetEdgeLandscapes(state, state.finalRecurrence ? 6 : 4);
    alivePlayers(state).forEach((p) => {
      if (state.finalRecurrence) {
        enqueueDiscardFromHand(state, p, 2, {
          reason: `${p.name}: Beta — choose 2 Psyche to discard.`,
          strict: true,
        });
      } else {
        drawPsycheForPlayer(state, p, 1);
      }
    });
    if (state.finalRecurrence) logMoment(state, "Beta — arousal without rest; Psyche burns off.");
  },
  "final-recurrence": (state) => {
    triggerBedFinalRecurrence(state, "The Final Recurrence is drawn — The Bed flips.");
  },
  "you-never-wake": (state) => {
    if (state.tutorialMode) return;
    state.status = "lost";
    logMoment(state, "You Never Wake — the Dream collapses.");
  },
};

export function resolveCardEffect(state, card, player, helpers) {
  if (!card) return;

  if (isBossDreamCard(card)) {
    spawnBossEncounterOnBed(state, card);
    return;
  }

  const id = (card.refId || card.id || "").toLowerCase();

  // Somnia 36.0 — Mindstream draws open a fullscreen choice before resolving.
  if (
    card.type === "event"
    || card.type === "object"
    || (card.type === "dreambeast" && card.accept)
    || card.type === "power-token"
    || card.type === "draw-dream"
  ) {
    if (beginMindstreamCardChoice(state, card, player, helpers)) return;
  }

  if (card.type === "power-token") {
    const n = 1;
    grantPowerTokens(state, player, n, {
      reason: `${player.name} takes ${n} Power Token${n === 1 ? "" : "s"}.`,
      logQuest: false,
    });
    return;
  }

  if (card.type === "draw-dream") {
    logMoment(state, "Draw 1 additional Dream card.");
    if (helpers?.drawAdditionalDream) {
      helpers.drawAdditionalDream(state);
    }
    return;
  }

  if (card.type === "dreambeast" && card.accept) {
    if (helpers?.spawnEncounterWithCard) {
      helpers.spawnEncounterWithCard(state, player.landscapeId, card);
    } else {
      helpers.spawnEncounter(state, player.landscapeId);
    }
    addLog(state, `${card.name} emerges from the Mindstream!`);
    return;
  }

  if (card.type === "object") {
    onObjectDrawn(state, player, card, helpers);
    return;
  }

  if (card.type === "dream" || card.type === "final") {
    if (beginDreamCardChoice(state, card, player, helpers)) return;
    if (DREAM_EFFECTS[id]) {
      DREAM_EFFECTS[id](state, player, helpers);
      return;
    }
  }
  if (card.type === "event") {
    if (!beginEventOrWaste(state, card)) return;
    addLog(state, `${card.name} has no wired choice.`);
  }
}

export function createEffectHelpers(spawnFn) {
  return {
    spawnEncounter: spawnFn,
    beginFinalRecurrence,
  };
}

export function defeatFinalArchetype(state, archetype, player, selectedCards, meetPlayTotalFn) {
  if (!state.finalRecurrence) return false;
  const played = meetPlayTotalFn(state);
  if (played < FINAL_RECURRENCE_PSYCHE_REQUIRED) {
    addLog(state, `Need ${FINAL_RECURRENCE_PSYCHE_REQUIRED} Psyche to defeat ${archetype.name} (have ${played}).`);
    return false;
  }
  const opposing = opposingSuit(archetype.suit);
  const hasOpposing = selectedCards.some((c) => c.suit === opposing);
  if (!hasOpposing) {
    addLog(state, `Must use ${opposing} Psyche (opposing suit) to defeat ${archetype.name}.`);
    return false;
  }
  archetype.defeated = true;
  logMoment(state, `${archetype.name} defeated in the Final Recurrence!`);
  checkFinalRecurrenceVictory(state);
  return true;
}

function checkFinalRecurrenceVictory(state) {
  const remaining = state.finalArchetypes?.filter((a) => !a.defeated) || [];
  if (remaining.length === 0) {
    state.status = "won";
    addLog(state, "All Remaining Archetypes defeated. You wake up!");
  }
}

export function sacrificeAcquiredForFinal(state, count) {
  let sacrificed = 0;
  for (const p of state.players) {
    while (sacrificed < count && p.acquiredArchetypes.length) {
      p.acquiredArchetypes.pop();
      sacrificed += 1;
      state.acquiredPoints = Math.max(0, state.acquiredPoints - 1);
    }
  }
  const targets = state.finalArchetypes?.filter((a) => !a.defeated) || [];
  targets.slice(0, sacrificed).forEach((a) => {
    a.defeated = true;
    addLog(state, `Sacrificed acquired Archetype to defeat ${a.name}.`);
  });
  checkFinalRecurrenceVictory(state);
}
