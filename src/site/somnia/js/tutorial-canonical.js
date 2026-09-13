/**
 * Precomputes a fixed game-state snapshot for every tutorial step so
 * Continue / Back / Jump always restore the same on-rails experience.
 */
import {
  getPhase,
  landscapeById,
  checkDreamerPsycheDeath,
  resetPhaseFlags,
  beginRoundReveal,
} from "./state.js";
import { hexDistance } from "./hex.js";
import {
  drawDreamCard,
  revealLandscape,
  activateExplore,
  gainMeetActions,
  meetEncounter,
  handleBoardTileClick,
  performLandscapeAction,
  endPhase,
  handleQuestComplete,
  getLegalExploreTargets,
} from "./game.js";

function reattachStateRuntime(state) {
  state.checkPsycheDeath = (player) => checkDreamerPsycheDeath(state, player);
  delete state.onResolutionIdle;
}

export function snapshotTutorialGame(state) {
  const {
    tutorialSnapshots,
    tutorialStepIndex,
    tutorialCanAdvance,
    tutorialComplete,
    tutorialSuppressCatchUp,
    checkPsycheDeath,
    onResolutionIdle,
    ...game
  } = state;
  return JSON.parse(JSON.stringify(game));
}

function pickPlayerWithSuit(state, suit, preferredIndex = null) {
  if (preferredIndex != null) {
    const preferred = state.players[preferredIndex];
    if (preferred?.hand?.some((c) => c.suit === suit && c.type === "psyche")) {
      return preferredIndex;
    }
  }
  for (let i = 0; i < state.players.length; i += 1) {
    if (state.players[i]?.hand?.some((c) => c.suit === suit && c.type === "psyche")) {
      return i;
    }
  }
  return preferredIndex ?? 0;
}

function selectSuitCards(state, playerIndex, suit, count = 1) {
  state.activePlayerIndex = playerIndex;
  state.selectedHand = [];
  const hand = state.players[playerIndex]?.hand || [];
  hand
    .filter((c) => c.suit === suit && c.type === "psyche")
    .sort((a, b) => a.value - b.value)
    .slice(0, count)
    .forEach((c) => {
      state.selectedHand.push(c.instanceId);
    });
}

function resetDreamersToBed(state) {
  state.players.forEach((player) => {
    if (player.alive) player.landscapeId = "bed";
  });
  state.selectedLandscapeId = "bed";
}

function spendElasticityPhase(state, preferredPlayer = null) {
  const playerIndex = pickPlayerWithSuit(state, "elasticity", preferredPlayer);
  selectSuitCards(state, playerIndex, "elasticity", 1);
  activateExplore(state);
  if (!state.exploreActivated) {
    state.exploreActivated = true;
    state.exploreMovesLeft = Math.max(3, state.exploreMovesLeft || 0);
  }
}

function spendWillpowerPhase(state, preferredPlayer = null) {
  const playerIndex = pickPlayerWithSuit(state, "willpower", preferredPlayer);
  selectSuitCards(state, playerIndex, "willpower", 1);
  gainMeetActions(state);
  if (state.meetActionBudget <= 0) {
    state.meetActionBudget = 3;
  }
}

function firstHiddenTileId(state) {
  return state.board
    .filter((t) => !t.center && !t.revealed)
    .map((t) => t.id)
    .sort()[0];
}

function advanceToPhase(state, phase) {
  let guard = 40;
  while (getPhase(state) !== phase && state.status === "playing" && guard-- > 0) {
    endPhase(state);
  }
}

function advanceToRound(state, minRound, { allowDreamDraw = false } = {}) {
  let guard = 80;
  while (state.round < minRound && state.status === "playing" && guard-- > 0) {
    closeRound(state, { allowDreamDraw });
  }
}

/** Finish the current round's R.E.M. loop and advance to the next round's Reveal. */
function closeRound(state, { allowDreamDraw = true } = {}) {
  if (allowDreamDraw && getPhase(state) === "Reveal" && !state.dreamDrawn) {
    drawDreamCard(state);
  }
  if (getPhase(state) === "Reveal" && !state.revealLandscapeUsed) {
    const lucidityPlayer = pickPlayerWithSuit(state, "lucidity", 0);
    selectSuitCards(state, lucidityPlayer, "lucidity", 1);
    revealLandscape(state);
    state.revealLandscapeUsed = true;
    state.landscapePick = null;
  }
  if (getPhase(state) === "Reveal") {
    endPhase(state);
  }
  if (getPhase(state) === "Explore" && !state.exploreActivated) {
    spendElasticityPhase(state);
  }
  if (getPhase(state) === "Explore") {
    endPhase(state);
  }
  if (getPhase(state) === "Meet" && state.meetActionBudget <= 0) {
    spendWillpowerPhase(state);
  }
  if (getPhase(state) === "Meet") {
    endPhase(state);
  }
}

function placePlayerOnLandscape(state, playerIndex, targetId) {
  state.activePlayerIndex = playerIndex;
  const player = state.players[playerIndex];
  if (!player) return false;

  let guard = 24;
  while (player.landscapeId !== targetId && guard-- > 0) {
    if (getPhase(state) !== "Explore" || !state.exploreActivated || state.exploreMovesLeft <= 0) {
      break;
    }
    const legal = getLegalExploreTargets(state).map((t) => t.id);
    if (legal.includes(targetId)) {
      handleBoardTileClick(state, targetId);
      break;
    }
    const target = landscapeById(state, targetId);
    if (!target) break;
    let bestId = null;
    let bestDist = Infinity;
    legal.forEach((id) => {
      const tile = landscapeById(state, id);
      if (!tile) return;
      const dist = hexDistance(tile.q, tile.r, target.q, target.r);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = id;
      }
    });
    if (!bestId) break;
    handleBoardTileClick(state, bestId);
  }

  if (player.landscapeId !== targetId) {
    player.landscapeId = targetId;
    if (state.selectedLandscapeId === player.landscapeId || !state.selectedLandscapeId) {
      state.selectedLandscapeId = targetId;
    }
  }
  return player.landscapeId === targetId;
}

function completeRevealPick(state) {
  const tileId = firstHiddenTileId(state);
  if (!tileId) {
    state.revealLandscapeUsed = true;
    state.landscapePick = null;
    return;
  }
  handleBoardTileClick(state, tileId);
  if (state.landscapePick?.mode === "reveal") {
    handleBoardTileClick(state, tileId);
  }
  if (!state.revealLandscapeUsed) state.revealLandscapeUsed = true;
}

function acceptHouseEncounter(state) {
  state.activePlayerIndex = 0;
  state.selectedLandscapeId = "house";
  state.selectedHand = [];
  const hand = state.players[0].hand.filter((c) => c.suit === "lucidity" && c.type === "psyche");
  hand.sort((a, b) => b.value - a.value);
  hand.slice(0, 3).forEach((c) => state.selectedHand.push(c.instanceId));
  meetEncounter(state, "accept");
  const house = landscapeById(state, "house");
  if (house?.encounter) {
    house.encounter = null;
    state.tutorialFlags.encounterResolved = true;
  }
}

function ensureMeetBudget(state, playerIndex) {
  if (state.meetActionBudget > 0) return;
  spendWillpowerPhase(state, playerIndex);
}

function drawMindstreamOn(state, playerIndex, landscapeId) {
  placePlayerOnLandscape(state, playerIndex, landscapeId);
  state.selectedLandscapeId = landscapeId;
  ensureMeetBudget(state, playerIndex);
  performLandscapeAction(state, "draw-mindstream");
  if (!state.questTracker) state.questTracker = { mindstreamOnLandscape: {}, landscapeActions: {} };
  if (!state.questTracker.mindstreamOnLandscape) state.questTracker.mindstreamOnLandscape = {};
  state.questTracker.mindstreamOnLandscape[landscapeId] = true;
}

function markInnocentQuests(state) {
  state.activePlayerIndex = 0;
  if (!state.activeArchetype?.questProgress?.[0]) handleQuestComplete(state, 0);
  state.activePlayerIndex = 0;
  if (state.activeArchetype && !state.activeArchetype.questProgress?.[1]) {
    handleQuestComplete(state, 1);
  }
  if (state.players.some((p) => (p.acquiredArchetypes || []).some((a) => a.id === "innocent"))) {
    state.tutorialFlags.archetypeAcquired = true;
  }
}

/** Apply the one canonical action that completes each tutorial step. */
export function applyCanonicalTutorialStep(state, step) {
  switch (step.id) {
    case "draw-dream-r1":
    case "r2-dream":
    case "r3-draw":
      drawDreamCard(state);
      return;

    case "spend-lucidity-r1":
    case "r2-lucidity":
      selectSuitCards(state, 0, "lucidity", 1);
      revealLandscape(state);
      if (step.id === "r2-lucidity") {
        state.revealLandscapeUsed = true;
        state.landscapePick = null;
      }
      return;

    case "reveal-pick-r1":
      completeRevealPick(state);
      return;

    case "to-explore-r1":
      advanceToPhase(state, "Explore");
      return;

    case "spend-elasticity-r1":
      spendElasticityPhase(state, 0);
      return;

    case "r2-elasticity":
      spendElasticityPhase(state, 1);
      state.players[0].landscapeId = "house";
      state.players[1].landscapeId = "city";
      state.selectedLandscapeId = "house";
      return;

    case "explore-move-r1":
      placePlayerOnLandscape(state, 0, "house");
      return;

    case "to-meet-r1":
    case "r2-to-meet":
      advanceToPhase(state, "Meet");
      return;

    case "spend-willpower-r1":
      spendWillpowerPhase(state, 0);
      return;

    case "r2-willpower":
      spendWillpowerPhase(state, 1);
      return;

    case "accept-reject":
      acceptHouseEncounter(state);
      return;

    case "end-r1":
      advanceToRound(state, 2);
      return;

    case "r2-to-explore":
      advanceToPhase(state, "Explore");
      resetDreamersToBed(state);
      return;

    case "r2-move-quests":
      placePlayerOnLandscape(state, 1, "the-basement");
      placePlayerOnLandscape(state, 0, "the-attic");
      return;

    case "r2-attic":
      drawMindstreamOn(state, 0, "the-attic");
      return;

    case "r2-basement":
      drawMindstreamOn(state, 1, "the-basement");
      return;

    case "r2-mark":
    case "r2-acquire":
      markInnocentQuests(state);
      return;

    case "end-r2":
      advanceToRound(state, 3);
      return;

    case "end-r3":
      state.round = 4;
      resetPhaseFlags(state);
      state.phaseIndex = 0;
      beginRoundReveal(state);
      return;

    case "end-r4":
      state.round = 5;
      resetPhaseFlags(state);
      state.phaseIndex = 0;
      beginRoundReveal(state);
      return;

    case "r5-practice":
      state.tutorialFlags.practiceRoundComplete = true;
      return;

    default:
      break;
  }
}

export function precomputeTutorialSnapshots(data, script, buildBaseState) {
  const snapshots = [];
  let state = buildBaseState(data);
  reattachStateRuntime(state);

  for (let i = 0; i < script.length; i += 1) {
    snapshots.push(snapshotTutorialGame(state));
    if (i < script.length - 1) {
      applyCanonicalTutorialStep(state, script[i]);
      reattachStateRuntime(state);
    }
  }

  return snapshots;
}
