/**
 * Precomputes a fixed game-state snapshot for every tutorial step so
 * Continue / Back / Jump always restore the same on-rails experience.
 */
import {
  getPhase,
  landscapeById,
  encounterOnLandscape,
  checkDreamerPsycheDeath,
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

function selectExactCards(state, playerIndex, cardIds) {
  state.activePlayerIndex = playerIndex;
  state.selectedHand = [];
  const hand = state.players[playerIndex]?.hand || [];
  cardIds.forEach((cardId) => {
    const card = hand.find((c) => c.id === cardId);
    if (card) state.selectedHand.push(card.instanceId);
  });
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

function closeRevealPick(state) {
  state.revealLandscapeUsed = true;
  state.landscapePick = null;
}

function revealNamedTile(state, tileId) {
  if (state.landscapePick?.mode === "reveal") {
    handleBoardTileClick(state, tileId);
  }
  closeRevealPick(state);
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
  let guard = 12;
  while (state.landscapePick?.mode === "reveal" && guard-- > 0) {
    const tileId = firstHiddenTileId(state);
    if (!tileId) break;
    handleBoardTileClick(state, tileId);
  }
  state.revealLandscapeUsed = true;
  state.landscapePick = null;
}

function acceptHouseEncounter(state) {
  state.activePlayerIndex = 0;
  state.selectedLandscapeId = "house";
  selectExactCards(state, 0, ["lucidity-3-v-l3", "lucidity-2-v-l2"]);
  meetEncounter(state, "accept");
  if (!encounterOnLandscape(state, "house")) {
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
      drawDreamCard(state);
      return;

    case "reveal-r1":
      selectExactCards(state, 0, ["lucidity-1-v-l1"]);
      revealLandscape(state);
      revealNamedTile(state, "candy-mountain");
      advanceToPhase(state, "Explore");
      return;

    case "explore-r1":
      selectExactCards(state, 0, ["elasticity-2-v-e2"]);
      activateExplore(state);
      if (!state.exploreActivated) {
        state.exploreActivated = true;
        state.exploreMovesLeft = Math.max(2, state.exploreMovesLeft || 0);
      }
      placePlayerOnLandscape(state, 0, "house");
      advanceToPhase(state, "Meet");
      return;

    case "meet-r1":
      selectExactCards(state, 0, ["willpower-2-v-w2"]);
      spendWillpowerPhase(state, 0);
      acceptHouseEncounter(state);
      advanceToRound(state, 2);
      return;

    case "r2-reveal":
      drawDreamCard(state);
      selectExactCards(state, 0, ["lucidity-2-r2-a"]);
      revealLandscape(state);
      closeRevealPick(state);
      advanceToPhase(state, "Explore");
      return;

    case "r2-explore":
      selectExactCards(state, 1, ["elasticity-3-i-e3"]);
      activateExplore(state);
      if (!state.exploreActivated) {
        state.exploreActivated = true;
        state.exploreMovesLeft = Math.max(3, state.exploreMovesLeft || 0);
      }
      placePlayerOnLandscape(state, 0, "the-attic");
      placePlayerOnLandscape(state, 1, "the-basement");
      advanceToPhase(state, "Meet");
      return;

    case "r2-meet":
      selectExactCards(state, 1, ["willpower-3-i-w3"]);
      gainMeetActions(state);
      if (state.meetActionBudget <= 0) state.meetActionBudget = 5;
      drawMindstreamOn(state, 0, "the-attic");
      drawMindstreamOn(state, 1, "the-basement");
      return;

    case "r2-acquire":
      markInnocentQuests(state);
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
