import {
  getPhase,
  activePlayer,
  headPlayer,
  addLog,
  drawPsyche,
  drawObject,
  advancePhase,
  completeQuest,
  acquireArchetype,
  checkDefeat,
  checkVictory,
  landscapeById,
  setEncounterOnLandscape,
  removeEncounterFromLandscape,
  encounterOnLandscape,
  revealedLandscapeTiles,
  revealLandscapeTile,
  drawPsycheForPlayer,
  drawMindstream,
  consumeRevealedTop,
  allLandscapesRevealed,
} from "./state.js";
import {
  revealBudget,
  exploreBudget,
  meetActionBudgetFromWillpower,
  coopMeetPlayTotal,
  meetPsycheActor,
  actorOnLandscape,
  selectedCards,
  allSelectedCards,
  spreadPsycheCount,
  allyPsycheCount,
  meetBonusBreakdown,
  discardSelected,
  discardAllSelected,
  selectedBySuit,
  consumePhasePowerToken,
  canUsePhasePowerToken,
  phaseTokenValue,
  MEET_ACTIONS,
  canTradeBetween,
  validateEncounterPlayShape,
  formatDreamerStatsText,
  SUIT_LABELS,
  findPhaseContributor,
  bestPhaseContributor,
  projectedPhaseBudget,
  phaseSuitForOpening,
  statForPhaseBudget,
  totalStat,
  phaseOpeningActive,
  cardCountsAsSuit,
  encounterPlayTotal,
  encounterPayHint,
  PHASE_OPENER_MAX_CARDS,
} from "./rules.js";
import {
  encounterPower,
  recommendedEncounterPower,
  encounterPowerLabel,
  encounterAcceptSummary,
  encounterRejectSummary,
  applyRejectReward,
  applyAcceptEffect,
  applyFailEffect,
  isLeviathanCard,
} from "./dreambeasts.js";
import { getLegalMoveTargets, canMoveTo, adjacentTiles, hexDistance, areHexAdjacent } from "./hex.js";
import { repressCard, listSubconsciousCards, dreambeastToHandCard, isDreambeastPsycheCard, isSubconsciousDreambeast, enqueueReturnCards } from "./subconscious.js";
import { queueCardTrade } from "./card-fx.js";
import { random } from "./rng.js";
import { spendPowerTokens, grantPowerTokens, playPsychePowerFromHand } from "./power-tokens.js";
import {
  beginDreamerPower,
  cancelDreamerPower,
  hasPendingDreamerPower,
  handleDreamerPowerTilePick,
  canActivateDreamerPower,
  recordCancellableDiscard,
  recordCancellableMove,
} from "./dreamer-powers.js";
import { playObjectCard, applySkeletonKeyAfterDream, drawObjects, handLimitForPlayer, handRoomForPsycheDraw } from "./objects.js";
import { spawnBossEncounterOnBed, isBossDreamCard } from "./dream-deck.js";
import { resumeObjectEffect } from "./object-effects.js";
import { hasPsycheHealth, allyHandCount, isWildPsyche, isTradablePsyche, TRADE_OFFER_LIMIT } from "./psyche.js";
import { queueDreamDrawFx, queueMeetFlashFx, queuePsycheSwirlFx, queueDreamerPowerFx, queueArchetypePowerFx } from "./board-fx.js";
import { resolveOnAcquire, useArchetypePower, handleArchetypePowerTilePick } from "./archetypes.js";
import { getActivatableArchetypePowers } from "./archetype-stats.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import { isQuestConditionMet, meetQuestLandscapeIds } from "./quests.js";
import {
  getLandscapeActionChoices,
  getUniqueLandscapeActionChoices,
  canDrawMindstreamOnLandscape,
  executeLandscapeActionChoice,
  resolveLandscapeMindstreamPick,
  flipTopThreeOfDeck,
} from "./landscape-actions.js";
import {
  pullDreambeastFromMindstream,
  drawTwoDreambeasts,
  encounterFromDreambeastCard,
  discardToMindstream,
} from "./mindstream-supply.js";
import { beginTransformationPick } from "./dream-choices.js";
import { beginRevealPicking, handleLandscapeTilePick, cancelLandscapePick, requestChooseTile, spendRevealOnMindstreamTop } from "./landscapes.js";
import { narrate, logMoment } from "./narrator.js";
import { flashPhaseEntryMoments } from "./moment-overlay.js";
import { playSfx } from "./audio.js";
import { markPhasePulse, markDreamFeedNudge, playPhaseSpendFlash } from "./fx.js";
import { recordQuestEvent } from "./quests.js";
import { COOP_PLAY_TIP } from "./guide.js";
import { notifyTutorialEncounterResolved, classifyPhaseAction } from "./tutorial-mode.js";
import {
  resolveCardEffect,
  createEffectHelpers,
  defeatFinalArchetype,
  sacrificeAcquiredForFinal,
  canSpendMeetAction,
  onExploreMove,
  onExplorePhaseEnd,
  onMeetPhaseEnd,
} from "./effects.js";
import { playDiceBattle, isDiceBattleOpen } from "./dice-battle.js";

const effectHelpers = { spawnEncounter: null, beginFinalRecurrence: null };

export function getEffectHelpers() {
  if (!effectHelpers.spawnEncounter) {
    Object.assign(effectHelpers, createEffectHelpers(spawnEncounterOnLandscape));
    effectHelpers.resolveCardEffect = resolveCardEffect;
    effectHelpers.drawObjects = drawObjects;
    effectHelpers.drawAdditionalDream = (s, onShowModal) => drawAdditionalDream(s, onShowModal);
    effectHelpers.spawnEncounterWithCard = (s, landscapeId, card) =>
      spawnEncounterOnLandscape(s, landscapeId, card);
    effectHelpers.meetEncounter = meetEncounter;
  }
  // Keep meetEncounter fresh even after first init.
  effectHelpers.meetEncounter = meetEncounter;
  return effectHelpers;
}

function trackPsycheDiscard(state, player, cards) {
  if (!cards.length) return;
  recordQuestEvent(state, "discard_psyche", { count: cards.length, landscapeId: player.landscapeId });
  if (player.landscapeId === "bed") {
    state.questRoundFlags.discardedOnBed = true;
  }
}

function trackPsycheDraw(state, player, count) {
  if (!count) return;
  recordQuestEvent(state, "draw_psyche", { count });
  if (state.questRoundFlags.discardedOnBed && player.landscapeId === "bed") {
    recordQuestEvent(state, "psyche_cycle_bed");
    state.questRoundFlags.discardedOnBed = false;
  }
}

function meetActionKey(action, landscapeActionId = null) {
  if (action === MEET_ACTIONS.LANDSCAPE && landscapeActionId) {
    return `landscape:${landscapeActionId}`;
  }
  return action;
}

const PER_DREAMER_LANDSCAPE_ACTIONS = new Set(["draw-3-psyche"]);

function usedMeetActionList(state, player) {
  if (!player) return [];
  const used = state.usedMeetActionsByPlayer?.[player.id];
  if (Array.isArray(used) && used.length) return used;
  const last = state.lastMeetActionByPlayer?.[player.id];
  return last ? [last] : [];
}

function landscapeActionIdFromKey(key) {
  return typeof key === "string" && key.startsWith("landscape:")
    ? key.slice("landscape:".length)
    : null;
}

function isTableUniqueLandscapeAction(actionId) {
  return !!actionId && actionId !== "draw-mindstream" && !PER_DREAMER_LANDSCAPE_ACTIONS.has(actionId);
}

function hasUsedMeetAction(state, player, key) {
  const actionId = landscapeActionIdFromKey(key);
  if (isTableUniqueLandscapeAction(actionId)) {
    return (state.usedUniqueActionsThisMeet || []).includes(actionId);
  }
  return usedMeetActionList(state, player).includes(key);
}

function markUsedMeetAction(state, player, key) {
  if (!player) return;
  if (!state.usedMeetActionsByPlayer) state.usedMeetActionsByPlayer = {};
  const list = usedMeetActionList(state, player).filter(Boolean);
  if (!list.includes(key)) list.push(key);
  state.usedMeetActionsByPlayer[player.id] = list;
  const actionId = landscapeActionIdFromKey(key);
  if (isTableUniqueLandscapeAction(actionId)) {
    if (!state.usedUniqueActionsThisMeet) state.usedUniqueActionsThisMeet = [];
    if (!state.usedUniqueActionsThisMeet.includes(actionId)) {
      state.usedUniqueActionsThisMeet.push(actionId);
    }
  }
}

function unmarkUsedMeetAction(state, player, key) {
  if (!player?.id) return;
  if (!state.usedMeetActionsByPlayer) state.usedMeetActionsByPlayer = {};
  const list = usedMeetActionList(state, player).filter((entry) => entry && entry !== key);
  if (list.length) state.usedMeetActionsByPlayer[player.id] = list;
  else delete state.usedMeetActionsByPlayer[player.id];
  if (state.lastMeetActionByPlayer?.[player.id] === key) {
    delete state.lastMeetActionByPlayer[player.id];
  }
  const actionId = landscapeActionIdFromKey(key);
  if (isTableUniqueLandscapeAction(actionId) && state.usedUniqueActionsThisMeet) {
    state.usedUniqueActionsThisMeet = state.usedUniqueActionsThisMeet.filter((id) => id !== actionId);
  }
}

function clearAllUsedMeetActions(state) {
  state.usedMeetActionsByPlayer = {};
  state.lastMeetActionByPlayer = {};
  state.usedUniqueActionsThisMeet = [];
}

function meetActionActor(state, action) {
  if (action === MEET_ACTIONS.TRADE || action === MEET_ACTIONS.ARCHETYPE || action === MEET_ACTIONS.DREAMER) {
    return activePlayer(state);
  }
  const tile = meetLandscapeTile(state) || landscapeById(state, state.selectedLandscapeId);
  if (!tile?.revealed || tile.wasteland) return null;
  return actorOnLandscape(state, tile.id);
}

function tutorialSuppressesMeetPass(state) {
  return !!(state.tutorialMode && !state.tutorialFlags?.meetPassLive);
}

function focusActionTurnHolder(state) {
  if (!state.meetPassHolderId) return;
  const idx = state.players.findIndex((p) => p.id === state.meetPassHolderId && p.alive);
  if (idx >= 0) state.activePlayerIndex = idx;
}

/** True while a phase budget is open and Dreamers take turns spending actions. */
export function actionTurnActive(state) {
  if (tutorialSuppressesMeetPass(state) || !state.meetPassHolderId) return false;
  const phase = getPhase(state);
  if (phase === "Meet") return (state.meetActionBudget || 0) > 0 && state.meetActionsUsed < state.meetActionBudget;
  if (phase === "Explore") return !!state.exploreActivated && (state.exploreMovesLeft || 0) > 0;
  if (phase === "Reveal") {
    const mode = state.landscapePick?.mode;
    return (mode === "reveal" || mode === "reveal-deck-tops") && (state.landscapePick?.remaining || 0) > 0;
  }
  return false;
}

export function actionTurnHolder(state) {
  if (!actionTurnActive(state)) return null;
  return state.players.find((p) => p.id === state.meetPassHolderId && p.alive) || null;
}

function meetPassBlocks(state, actor) {
  if (!actionTurnActive(state)) return false;
  const holder = state.players.find((p) => p.id === state.meetPassHolderId);
  if (!holder?.alive) {
    state.meetPassHolderId = null;
    return false;
  }
  return actor?.id !== holder.id;
}

function nextLivingClockwise(state, fromId) {
  const players = state.players || [];
  const start = Math.max(0, players.findIndex((p) => p.id === fromId));
  for (let step = 1; step <= players.length; step += 1) {
    const player = players[(start + step) % players.length];
    if (player?.alive) return player;
  }
  return null;
}

/** Seat the action turn on the Dreamer who opened the phase (they act first). */
function seatMeetPassToken(state, openerId) {
  if (tutorialSuppressesMeetPass(state)) {
    state.meetPassHolderId = null;
    return;
  }
  const alive = state.players.filter((p) => p.alive);
  if (!alive.length) {
    state.meetPassHolderId = null;
    return;
  }
  const opener = alive.find((p) => p.id === openerId);
  const holder = opener || alive.find((p) => p.isHead) || alive[0];
  state.meetPassHolderId = holder?.id || null;
  focusActionTurnHolder(state);
  if (holder) {
    const phase = getPhase(state);
    addLog(state, `${holder.name}'s turn (${phase}). Take one action, or pass.`);
  }
}

export function passMeetToken(state) {
  if (tutorialSuppressesMeetPass(state) || !state.meetPassHolderId) return false;
  const next = nextLivingClockwise(state, state.meetPassHolderId);
  if (!next || next.id === state.meetPassHolderId) return false;
  return passActionTurnTo(state, next.id);
}

/**
 * Hand the current Explore / Meet / Reveal action turn to a specific Dreamer.
 * Remaining moves/actions stay on the shared budget.
 */
export function passActionTurnTo(state, playerId) {
  if (tutorialSuppressesMeetPass(state) || !actionTurnActive(state)) return false;
  const target = state.players.find((p) => p.id === playerId && p.alive);
  if (!target) return false;
  if (state.meetPassHolderId === target.id) {
    focusActionTurnHolder(state);
    return true;
  }
  const from = state.players.find((p) => p.id === state.meetPassHolderId);
  state.meetPassHolderId = target.id;
  focusActionTurnHolder(state);
  const phase = getPhase(state);
  const left = phase === "Explore"
    ? `${state.exploreMovesLeft || 0} move(s) left`
    : phase === "Meet"
      ? `${Math.max(0, (state.meetActionBudget || 0) - (state.meetActionsUsed || 0))} action(s) left`
      : "your turn";
  addLog(
    state,
    from && from.id !== target.id
      ? `${from.name} passes — ${target.name}'s turn (${left}).`
      : `${target.name}'s turn (${left}).`,
  );
  return true;
}

/** Alias used by Explore / Reveal turn passing. */
export function passActionTurn(state) {
  return passMeetToken(state);
}

export function clearActionTurn(state) {
  state.meetPassHolderId = null;
}

function passTurnAction(state) {
  if (tutorialSuppressesMeetPass(state) || !actionTurnActive(state)) return null;
  const holder = actionTurnHolder(state);
  const player = activePlayer(state);
  if (!holder || !player || holder.id !== player.id) return null;
  const aliveOthers = state.players.filter((p) => p.alive && p.id !== holder.id);
  if (!aliveOthers.length) return null;
  const phase = getPhase(state);
  const noun = phase === "Explore" ? "moves" : phase === "Meet" ? "actions" : "reveals";
  return {
    label: "Pass Turn",
    kind: "meetPass",
    section: "actions",
    primary: true,
    hint: `Skip your turn. The next Dreamer clockwise may spend the remaining shared ${noun}.`,
    onClick: () => passMeetToken(state),
  };
}

function dreamerCanPayOpener(player, suit) {
  if ((player.powerTokens || 0) >= 1) return true;
  return (player.hand || []).some((card) => {
    if (isDreambeastPsycheCard(card) || card.type === "psyche-power") return false;
    return isWildPsyche(card) || card.suit === suit;
  });
}

function openerRotationBlocks(state, player) {
  if (!player || state.lastPhaseOpenerId !== player.id) return false;
  const alive = state.players.filter((p) => p.alive);
  if (alive.length <= 1) return false;
  const suit = phaseSuitForOpening(getPhase(state));
  return alive.some((other) => other.id !== player.id && dreamerCanPayOpener(other, suit));
}

function recordPhaseOpener(state, player) {
  if (!player) return;
  state.lastPhaseOpenerId = player.id;
  if (!state.phaseOpenersThisRound) state.phaseOpenersThisRound = [];
  if (!state.phaseOpenersThisRound.includes(player.id)) state.phaseOpenersThisRound.push(player.id);
}

function isSwappablePsyche(card) {
  if (!card || isDreambeastPsycheCard(card) || card.type === "psyche-power") return false;
  return card.type === "psyche" || isWildPsyche(card);
}

function isFreeQuestMeet(state, action) {
  if (action !== MEET_ACTIONS.MEET) return false;
  const free = state.freeQuestMeet;
  if (!free?.landscapeId) return false;
  if (state.selectedLandscapeId !== free.landscapeId) return false;
  const actor = meetActionActor(state, action);
  return !!actor && actor.landscapeId === free.landscapeId && !!encounterOnLandscape(state, free.landscapeId);
}

function canUseMeetActionForActor(state, actor, action, landscapeActionId = null) {
  if (!actor) return false;
  if (meetPassBlocks(state, actor)) return false;
  if (!canSpendMeetAction(state, actor, action, MEET_ACTIONS)) return false;
  if (landscapeActionId !== "draw-mindstream" && hasUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId))) return false;
  if (!isFreeQuestMeet(state, action) && state.meetActionsUsed >= state.meetActionBudget) return false;
  return true;
}

function canUseLandscapeAction(state, actionId) {
  return canUseMeetActionForActor(
    state,
    meetActionActor(state, MEET_ACTIONS.LANDSCAPE),
    MEET_ACTIONS.LANDSCAPE,
    actionId,
  );
}

function canUseMeetAction(state, action, landscapeActionId = null) {
  return canUseMeetActionForActor(
    state,
    meetActionActor(state, action),
    action,
    landscapeActionId,
  );
}

export function canDreamerMeetOnLandscape(state, player, tileId) {
  if (!player?.alive || player.landscapeId !== tileId) return false;
  const enc = encounterOnLandscape(state, tileId);
  if (state.forcedAccept && player.id === state.forcedAccept.playerId && tileId === state.forcedAccept.tileId) {
    return !!enc;
  }
  const freeMeet = state.freeQuestMeet?.landscapeId === tileId && player.landscapeId === tileId;
  if (!enc || getPhase(state) !== "Meet") return false;
  if (!freeMeet && (state.meetActionBudget < 1 || state.meetActionsUsed >= state.meetActionBudget)) return false;
  if (hasUsedMeetAction(state, player, meetActionKey(MEET_ACTIONS.MEET))) return false;
  return canSpendMeetAction(state, player, MEET_ACTIONS.MEET, MEET_ACTIONS);
}

function meetActionHint(state, action, landscapeActionId, baseHint = "") {
  const actor = meetActionActor(state, action);
  if (!actor) return "A Dreamer must stand on this Landscape.";
  if (meetPassBlocks(state, actor)) {
    const holder = state.players.find((p) => p.id === state.meetPassHolderId);
    return `It is ${holder?.name || "another Dreamer"}'s turn.`;
  }
  if (!isFreeQuestMeet(state, action) && state.meetActionsUsed >= state.meetActionBudget) return "No Meet actions remaining.";
  if (hasUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId))) {
    return isTableUniqueLandscapeAction(landscapeActionId)
      ? "Already used this Meet."
      : "This Dreamer already used that action this Meet.";
  }
  if (!canSpendMeetAction(state, actor, action, MEET_ACTIONS)) return baseHint || "This Meet action is restricted right now.";
  return baseHint;
}

function spendMeetAction(state, action, landscapeActionId = null) {
  const actor = meetActionActor(state, action);
  if (!canUseMeetActionForActor(state, actor, action, landscapeActionId)) {
    addLog(state, "Cannot use this Meet action (restricted or no actions remain).");
    return false;
  }
  if (isFreeQuestMeet(state, action)) {
    state.freeQuestMeet = null;
    state.pendingFreeMeetRefund = true;
    markUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId));
    if (state.meetActionsUsed >= state.meetActionBudget) clearActionTurn(state);
    else passMeetToken(state);
    return true;
  }
  state.pendingFreeMeetRefund = false;
  state.meetActionsUsed += 1;
  if (landscapeActionId !== "draw-mindstream") {
    markUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId));
  }
  if (state.meetActionsUsed >= state.meetActionBudget) clearActionTurn(state);
  else passMeetToken(state);
  return true;
}

function refundMeetAction(state, player, action = null, landscapeActionId = null) {
  if (state.pendingFreeMeetRefund) {
    state.pendingFreeMeetRefund = false;
    if (action) unmarkUsedMeetAction(state, player, meetActionKey(action, landscapeActionId));
    return;
  }
  state.meetActionsUsed = Math.max(0, state.meetActionsUsed - 1);
  if (action) unmarkUsedMeetAction(state, player, meetActionKey(action, landscapeActionId));
}

function meetLandscapeTile(state) {
  const tile = landscapeById(state, state.selectedLandscapeId);
  if (!tile?.revealed || tile.wasteland) return null;
  const actor = actorOnLandscape(state, tile.id);
  if (!actor) return null;
  return tile;
}

function encounterForMeet(state) {
  const tile = meetLandscapeTile(state);
  if (!tile) return null;
  return encounterOnLandscape(state, tile.id);
}

function landscapeActor(state) {
  const tile = landscapeById(state, state.selectedLandscapeId);
  return tile ? actorOnLandscape(state, tile.id) : activePlayer(state);
}

function coopContributorLabel(state) {
  const ids = new Set(state.selectedHand);
  const names = state.players
    .filter((p) => p.hand.some((c) => ids.has(c.instanceId)))
    .map((p) => p.name.split(" ").pop());
  return names.length ? names.join(" + ") : "";
}

export function getPhaseActions(state, handlers) {
  const phase = getPhase(state);
  const player = activePlayer(state);
  const actions = [];

  const dreamerPowerAction = () => ({
    label: "Dreamer Power",
    kind: "dreamerPower",
    section: "progress",
    hint: `${player.dreamer.power} Costs 1 Power Token.`,
    disabled: player.powerTokens < 1 || hasPendingDreamerPower(state) || !canActivateDreamerPower(state, player),
    onClick: handlers.useDreamerPower,
  });

  const archetypePowerActions = () => getActivatableArchetypePowers(state).map((acquired) => ({
    label: `${acquired.name} Power`,
    kind: "archetypePower",
    section: "progress",
    hint: `${acquired.power} Costs 1 Power Token.`,
    disabled: activePlayer(state).powerTokens < 1,
    onClick: () => handlers.useArchetypePower(acquired.id),
  }));

  const objectFreeActions = () => {
    const list = [];
    if (player.objects?.length) {
      list.push({
        label: "Play Object",
        kind: "playObject",
        section: "objects",
        hint: "Free in any phase — Instant Objects stay in hand until played, then Repress.",
        disabled: false,
        onClick: handlers.playObject,
      });
    }
    if (player.persistent?.length) {
      list.push({
        label: "Activate Persistent",
        kind: "activateObject",
        section: "objects",
        hint: "Free in any phase — spend 1 Power Token to activate a Persistent Object.",
        disabled: player.powerTokens < 1,
        onClick: handlers.activateObject,
      });
    }
    return list;
  };

  const questActions = () => {
    const arch = state.activeArchetype;
    return [
      {
        label: "Quest 1",
        kind: "completeQuest0",
        section: "progress",
        hint: "Free action — spend 1 Power Token to mark this quest once the condition is met. Does not cost a Meet action.",
        disabled: !arch || arch.questProgress[0] || !isQuestConditionMet(state, arch.id, arch.quests[0]) || player.powerTokens < 1,
        onClick: () => handlers.completeQuest(0),
      },
      {
        label: "Quest 2",
        kind: "completeQuest1",
        section: "progress",
        hint: "Free action — spend 1 Power Token to mark this quest once the condition is met. Does not cost a Meet action.",
        disabled: !arch || arch.questProgress[1] || !isQuestConditionMet(state, arch.id, arch.quests[1]) || player.powerTokens < 1,
        onClick: () => handlers.completeQuest(1),
      },
    ];
  };

  const phaseTokenAction = (suitLabel) => ({
    label: state.phaseTokenAsPsyche === player.id
      ? `Power Token as 1 ${suitLabel} (on)`
      : `Power Token as 1 ${suitLabel}`,
    kind: "phasePowerToken",
    section: "main",
    hint: "Spend 1 Power Token in place of 1 suited Psyche for this phase opener (max 1).",
    disabled: !canUsePhasePowerToken(state, player) && state.phaseTokenAsPsyche !== player.id,
    onClick: handlers.togglePhasePowerToken,
  });

  if (phase === "Reveal") {
    const head = headPlayer(state);
    actions.push({
      label: "Draw & Resolve Dream",
      kind: "drawDream",
      hint: `${head.name} is Head ★ — anyone may click after the group agrees`,
      primary: !state.dreamDrawn,
      section: "main",
      disabled: state.dreamDrawn,
      onClick: handlers.drawDream,
    });
    const contributor = findPhaseContributor(state);
    const budget = contributor ? revealBudget(state, contributor) : 0;
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Reveal", state);
    const mapOpen = allLandscapesRevealed(state);
    const deckTopPick = state.landscapePick?.mode === "reveal-deck-tops";
    const remFreeReveal = !!state.seedFlags?.rem && !state.remFree?.reveal && !state.revealLandscapeUsed && !deckTopPick;
    actions.push({
      label: deckTopPick
        ? `Reveal Deck Tops (${state.landscapePick.remaining} left)`
        : mapOpen
          ? (budget >= 1 ? `Reveal Deck Tops (${budget})` : "Reveal Deck Tops (select Lucidity)")
          : budget >= 1
            ? `Reveal Landscapes (${budget} for team)`
            : remFreeReveal
              ? "Reveal 1 Landscape (REM free)"
              : "Reveal Landscapes (select Lucidity)",
      kind: "revealLandscape",
      hint: !state.dreamDrawn
        ? "Draw & Resolve the Dream first, then spend Lucidity."
        : remFreeReveal && budget < 1
          ? "REM cycle: the first Reveal each round is free — no Lucidity needed."
          : deckTopPick
          ? "Click a Mindstream card back to flip its next facedown card, or open Reveal Deck Top."
          : mapOpen
            ? "The map is fully Revealed. Lucidity now flips Mindstream tops — click a card back or this action."
            : best
              ? `One Dreamer spends 1 Lucidity — ${best.name} adds +${totalStat(best, stat, state)} (best bonus). Leftover Reveals flip Mindstream tops once the map is finished.`
              : "One Dreamer spends Lucidity to set everyone's reveal budget.",
      section: "main",
      disabled: !state.dreamDrawn || state.revealLandscapeUsed || (budget < 1 && !deckTopPick && !remFreeReveal),
      onClick: handlers.revealLandscape,
    });
    if (deckTopPick) {
      actions.push({
        label: "Choose Mindstream to flip",
        kind: "revealDeckTop",
        section: "main",
        hint: "Open the three Mindstream backs and flip the next facedown card of one suit.",
        onClick: handlers.revealDeckTop,
      });
    }
    if (state.dreamDrawn && !state.revealLandscapeUsed) actions.push(phaseTokenAction("Lucidity"));
    actions.push(...objectFreeActions());
    actions.push(dreamerPowerAction());
    actions.push(...questActions());
    actions.push(...archetypePowerActions());
  }

  if (phase === "Explore") {
    if (!state.exploreActivated) {
      const contributor = findPhaseContributor(state);
      const budget = contributor ? exploreBudget(state, contributor) : 0;
      const best = bestPhaseContributor(state);
      const stat = statForPhaseBudget("Explore", state);
      const remFreeExplore = !!state.seedFlags?.rem && !state.remFree?.explore;
      actions.push({
        label: budget >= 1
          ? `Spend Elasticity (${budget} team moves)`
          : remFreeExplore
            ? "1 free move (REM)"
            : "Spend Elasticity (select cards)",
        kind: "spendElasticity",
        hint: remFreeExplore && budget < 1
          ? "REM cycle: the first Explore move each round is free — no Elasticity needed."
          : best
            ? `One Dreamer spends 1 Elasticity — ${best.name} adds +${totalStat(best, stat, state)} (best bonus).`
            : "One Dreamer spends Elasticity to set everyone's move budget.",
        section: "main",
        primary: true,
        disabled: budget < 1 && !remFreeExplore,
        onClick: handlers.activateExplore,
      });
      actions.push(phaseTokenAction("Elasticity"));
    } else {
      actions.push({
        label: `${state.exploreMovesLeft} move(s) — click highlighted hexes`,
        section: "main",
        disabled: true,
        onClick: () => {},
      });
      if (!state.tutorialMode && (state.exploreMovesLeft || 0) >= 2 && state.dreamDeck?.length) {
        actions.push({
          label: "Peek next Dream (2 moves)",
          kind: "clockPeek",
          section: "actions",
          hint: "Spend 2 unused moves to see the next Dream. Leave it on top, or bury it ahead of Final Recurrence.",
          onClick: () => cashExplorePeek(state),
        });
      }
      const explorePass = passTurnAction(state);
      if (explorePass) actions.push(explorePass);
    }
    actions.push(...objectFreeActions());
    actions.push(dreamerPowerAction());
    actions.push(...questActions());
    actions.push(...archetypePowerActions());
  }

  if (phase === "Meet") {
    const poolTotal = coopMeetPlayTotal(state);
    const poolCount = allSelectedCards(state).length;
    const poolHint = state.meetActionBudget > 0 ? ` · pool ${poolCount}/3 (${poolTotal})` : "";

    if (state.meetActionBudget === 0) {
      const contributor = findPhaseContributor(state);
      const budget = contributor ? meetActionBudgetFromWillpower(state, contributor) : 0;
      const best = bestPhaseContributor(state);
      const stat = statForPhaseBudget("Meet", state);
      const remFreeMeet = !!state.seedFlags?.rem && !state.remFree?.meet;
      actions.push({
        label: budget >= 1
          ? `Gain Actions (${budget} for team)`
          : remFreeMeet
            ? "Gain 1 free action (REM)"
            : "Gain Actions (select Willpower)",
        kind: "gainMeetActions",
        hint: remFreeMeet && budget < 1
          ? "REM cycle: the first Meet action each round is free — no Willpower needed."
          : best
            ? `One Dreamer spends 1 Willpower — ${best.name} adds +${totalStat(best, stat, state)} (best bonus).`
            : "One Dreamer spends Willpower to set shared Meet actions.",
        section: "main",
        primary: true,
        disabled: budget < 1 && !remFreeMeet,
        onClick: handlers.gainMeetActions,
      });
      actions.push(phaseTokenAction("Willpower"));
    } else {
      actions.push({
        label: `Actions ${state.meetActionsUsed}/${state.meetActionBudget}${poolHint}`,
        section: "main",
        disabled: true,
        onClick: () => {},
      });
      actions.push({
        label: state.pendingPowerBonus
          ? `+1d6 Spread (now +${state.pendingPowerBonus})`
          : "+1d6 to Spread",
        kind: "powerBonus",
        section: "main",
        hint: "Free action — spend up to 3 Power Tokens. Each adds +1d6 to this spread. Does not cost a Meet action.",
        disabled: player.powerTokens < 1 || (state.pendingPowerBonusTokens || 0) >= 3,
        onClick: handlers.powerBonus,
      });
      if ((state.pendingPowerBonusTokens || 0) > 0) {
        actions.push({
          label: `-1 Spread (now +${state.pendingPowerBonus})`,
          section: "main",
          hint: "Return 1 Power Token and remove +1 from the current Psyche spread.",
          onClick: handlers.refundPowerBonus,
        });
      }
    }
    if (state.finalRecurrence) {
      const onTile = landscapeById(state, state.selectedLandscapeId);
      if (onTile?.finalArchetype && !onTile.finalArchetype.defeated) {
        actions.push({
          label: `Defeat ${onTile.finalArchetype.name} (${poolTotal} pool)`,
          section: "encounter",
          disabled: !canUseMeetAction(state, MEET_ACTIONS.MEET),
          hint: meetActionHint(state, MEET_ACTIONS.MEET, null, "Pool 15+ Psyche from all Dreamers (opposing suit) to defeat this Remaining Archetype."),
          onClick: handlers.defeatFinalArchetype,
        });
        actions.push({
          label: "Sacrifice Archetypes to auto-defeat",
          section: "encounter",
          onClick: handlers.sacrificeForFinal,
        });
      }
    }
    const meetTile = meetLandscapeTile(state);
    const meetEnc = encounterForMeet(state);
    if (meetEnc && !state.finalRecurrence) {
      const payHint = encounterPayHint(meetEnc, true);
      const slumberOnly = isLeviathanCard(meetEnc);
      if (!slumberOnly) actions.push({
        label: `${encounterPowerLabel(meetEnc, true)} — ${encounterAcceptSummary(meetEnc)}`,
        kind: "meetAccept",
        section: "encounter",
        hint: meetActionHint(
          state,
          MEET_ACTIONS.MEET,
          null,
          [payHint, meetEnc.effect ? `Effect: ${meetEnc.effect}` : encounterAcceptSummary(meetEnc)].filter(Boolean).join(" "),
        ),
        primary: true,
        disabled: !state.forcedAccept && !canUseMeetAction(state, MEET_ACTIONS.MEET),
        onClick: () => handlers.meetEncounter("accept"),
      });
      if (!state.forcedAccept) {
        actions.push({
          label: `${encounterPowerLabel(meetEnc, false)} — ${encounterRejectSummary(meetEnc)}`,
          kind: "meetReject",
          section: "encounter",
          hint: meetActionHint(
            state,
            MEET_ACTIONS.MEET,
            null,
            [encounterPayHint(meetEnc, false), encounterRejectSummary(meetEnc)].filter(Boolean).join(" "),
          ),
          disabled: !canUseMeetAction(state, MEET_ACTIONS.MEET),
          onClick: () => handlers.meetEncounter("reject"),
        });
      }
    }
    const landscapeChoices = meetTile ? getLandscapeActionChoices(meetTile) : [];
    landscapeChoices.forEach((choice, index) => {
      actions.push({
        label: choice.label,
        kind: index === 0 ? "landscapeActionA" : "landscapeActionB",
        section: "actions",
        hint: meetActionHint(state, MEET_ACTIONS.LANDSCAPE, choice.id, choice.description),
        disabled: !canUseLandscapeAction(state, choice.id),
        onClick: () => handlers.landscapeAction(choice.id),
      });
    });
    actions.push(...objectFreeActions());
    if (!state.tutorialMode && meetActionsLeft(state) >= 2 && subconsciousDreambeastCount(state) > 0 && !meetPassBlocks(state, player)) {
      actions.push({
        label: "Return 1 Dreambeast (2 actions)",
        kind: "clockReturn",
        section: "actions",
        hint: "Spend 2 unused Meet actions to Return 1 Dreambeast from the Subconscious. Repeatable.",
        onClick: () => cashMeetReturn(state),
      });
    }
    actions.push({
      label: "Trade",
      kind: "trade",
      section: "actions",
      hint: canStartTrade(state)
        ? "Free. Each Dreamer offers up to 3 Psyche. Same hex or next door."
        : "Free during Meet. Partner must stand on the same or adjacent hex.",
      disabled: !canStartTrade(state),
      onClick: handlers.tradeAction,
    });
    actions.push(dreamerPowerAction());
    actions.push(...questActions());
    actions.push(...archetypePowerActions());
    const meetPass = passTurnAction(state);
    if (meetPass) actions.push(meetPass);
    if (
      (!state.tutorialMode || state.tutorialTrack === "advanced")
      && player.dreamer?.id === "the-weaver"
      && !state.weaverSwapUsed
      && (state.meetActionBudget || 0) > 0
    ) {
      actions.push({
        label: "Weaver Swap",
        kind: "weaverSwap",
        section: "actions",
        hint: "Once this Meet, free: swap 1 selected Psyche with an adjacent Dreamer.",
        onClick: () => startWeaverSwap(state),
      });
    }
  }

  return actions;
}

function phaseAdvanceBlockReason(state) {
  if (isDiceBattleOpen() || state.diceBattle) return "Finish the dice battle before advancing.";
  if (state.pendingRepress) return "Complete Repress selection before advancing.";
  if (state.pendingReturn) return "Complete Return selection before advancing.";
  if (state.pendingDeathChoice) return "Resolve the death choice before advancing.";
  if (state.pendingNothingChoice) return "Resolve the Nothing Object choice before advancing.";
  if (state.pendingObjectChoice) return "Choose an Object effect before advancing.";
  if (state.pendingDreamChoice || state.pendingDreamQueue?.length) return "Choose a Dream effect before advancing.";
  if (state.pendingEffectChoice) return "Choose an Event or Encounter effect before advancing.";
  if (state.pendingArchetypePower) return "Finish the Archetype Power before advancing.";
  if (state.pendingObjectFollowup) return "Finish the Object effect before advancing.";
  return null;
}

function phaseAdvanceLabel(state) {
  const phase = getPhase(state);
  if (phase === "Reveal") return "Next: Explore";
  if (phase === "Explore") return "Next: Meet";
  return "End Round";
}

/** Tint for the Next Phase button: the phase you are about to enter. */
export function upcomingPhaseTint(state) {
  const phase = getPhase(state);
  if (phase === "Reveal") return "explore";
  if (phase === "Explore") return "meet";
  return "reveal";
}

export function phaseBudgetExhausted(state) {
  const phase = getPhase(state);
  if (state.tutorialMode) {
    if (phase === "Reveal") return Boolean(state.revealLandscapeUsed);
    if (phase === "Explore") return Boolean(state.exploreActivated) && (state.exploreMovesLeft || 0) < 1;
    if (phase === "Meet") {
      const budget = state.meetActionBudget || 0;
      return budget > 0 && (state.meetActionsUsed || 0) >= budget;
    }
    return false;
  }
  if (phase === "Reveal") {
    return Boolean(state.dreamDrawn && state.revealLandscapeUsed && !state.landscapePick);
  }
  if (phase === "Explore") {
    return Boolean(state.exploreActivated) && (state.exploreMovesLeft || 0) < 1;
  }
  if (phase === "Meet") {
    const budget = state.meetActionBudget || 0;
    return budget > 0 && (state.meetActionsUsed || 0) >= budget;
  }
  return false;
}

export function getPhaseAdvanceAction(state, handlers) {
  if (!handlers?.nextPhase) return null;
  const label = phaseAdvanceLabel(state);
  const spent = phaseBudgetExhausted(state);
  const action = {
    label,
    section: "phase",
    advance: true,
    primary: true,
    tint: upcomingPhaseTint(state),
    budgetExhausted: spent,
    hint: spent
      ? `${label} — actions spent. Advance when ready.`
      : `${label} — skip this phase without spending Psyche.`,
    onClick: handlers.nextPhase,
  };
  const blockReason = phaseAdvanceBlockReason(state);
  if (blockReason) {
    return { ...action, disabled: true, hint: blockReason };
  }
  return action;
}

/** Spread-tray button: spend the selected Psyche to unlock this phase. */
export function getPhaseOpenerAction(state, handlers) {
  if (!handlers) return null;
  const phase = getPhase(state);
  if (phase === "Reveal") {
    if (!state.dreamDrawn || state.revealLandscapeUsed) return null;
  } else if (phase === "Explore") {
    if (state.exploreActivated) return null;
  } else if (phase === "Meet") {
    if ((state.meetActionBudget || 0) > 0) return null;
  } else {
    return null;
  }
  const kind = phase === "Reveal"
    ? "revealLandscape"
    : phase === "Explore"
      ? "spendElasticity"
      : "gainMeetActions";
  const action = getPhaseActions(state, handlers).find((item) => item.kind === kind);
  if (!action) return null;
  const shortLabel = phase === "Reveal"
    ? (/Deck Tops/i.test(action.label) ? "Reveal Deck Tops" : "Reveal Landscapes")
    : phase === "Explore"
      ? "Spend Elasticity"
      : "Gain Actions";
  return {
    ...action,
    label: shortLabel,
    tint: phase === "Reveal" ? "reveal" : phase === "Explore" ? "explore" : "meet",
  };
}

const DREAMER_RADIAL_KINDS = new Set([
  "dreamerPower",
  "landscapeActionA",
  "landscapeActionB",
  "meetAccept",
  "meetReject",
  "playObject",
  "trade",
  "archetypePower",
  "drawMindstream",
  "defeatFinalArchetype",
  "sacrificeForFinal",
  "clockPeek",
  "clockReturn",
  "meetPass",
  "weaverSwap",
]);

const DREAMER_RADIAL_ORDER = [
  "dreamerPower",
  "landscapeActionA",
  "landscapeActionB",
  "meetAccept",
  "meetReject",
  "playObject",
  "trade",
  "archetypePower",
  "drawMindstream",
  "clockPeek",
  "clockReturn",
  "meetPass",
  "weaverSwap",
  "defeatFinalArchetype",
  "sacrificeForFinal",
];

export function resolvePendingDeathDream(state, onShowModal) {
  if (!state.pendingDeathAdditionalDream) return null;
  if (state.status !== "playing") {
    state.pendingDeathAdditionalDream = false;
    return null;
  }
  state.pendingDeathAdditionalDream = false;
  addLog(state, "A new Dream begins for the fallen Dreamer…");
  return drawAdditionalDream(state, onShowModal);
}

export function drawAdditionalDream(state, onShowModal) {
  const head = headPlayer(state);
  const card = state.dreamDeck.shift();
  consumeRevealedTop(state, "dream");
  if (!card) {
    checkDefeat(state);
    return null;
  }

  state.activeDream = card;
  if (!state.dreamDiscard) state.dreamDiscard = [];
  state.dreamDiscard.push(card);

  narrate(
    state,
    `Additional Dream: ${card.name}`,
    card.text || "The Dreamscape shifts again.",
    ["Resolve this Dream effect before continuing"],
  );

  if (isBossDreamCard(card)) {
    spawnBossEncounterOnBed(state, card);
  } else if (card.type === "final" && card.id === "you-never-wake") {
    resolveCardEffect(state, card, head, getEffectHelpers());
  } else if (card.type === "final" && card.id === "final-recurrence") {
    resolveCardEffect(state, card, head, getEffectHelpers());
  } else {
    resolveCardEffect(state, card, head, getEffectHelpers());
  }

  checkDefeat(state);
  applySkeletonKeyAfterDream(state);
  playSfx("dream");
  queueDreamDrawFx(card);
  if (onShowModal) onShowModal(card);
  return card;
}

export function drawDreamCard(state, onShowModal) {
  if (state.dreamDrawn) return null;
  const head = headPlayer(state);

  if (state.skipNextDreamDraw) {
    state.skipNextDreamDraw = false;
    state.dreamDrawn = true;
    logMoment(state, "Sandman cancels this Dream draw.");
    return null;
  }

  const card = state.dreamDeck.shift();
  consumeRevealedTop(state, "dream");
  if (!card) {
    checkDefeat(state);
    return null;
  }

  state.activeDream = card;
  state.dreamDrawn = true;
  if (!state.dreamDiscard) state.dreamDiscard = [];
  state.dreamDiscard.push(card);
  addLog(state, `${head.name} (Head ★) draws the Dream: ${card.name}.`);
  narrate(
    state,
    `Dream: ${card.name}`,
    card.text || card.effect || "The Dreamscape shifts.",
    card.type === "boss-dream" || card.boss
      ? [`${card.name} awakens on The Bed`]
      : ["Resolve the Dream effect before continuing"],
  );

  if (isBossDreamCard(card)) {
    spawnBossEncounterOnBed(state, card);
    if (state.tutorialFlags) state.tutorialFlags.bossDrawn = true;
  } else {
    resolveCardEffect(state, card, head, getEffectHelpers());
  }

  checkDefeat(state);
  applySkeletonKeyAfterDream(state);
  playSfx("dream");
  queueDreamDrawFx(card);
  if (onShowModal) onShowModal(card);
  return card;
}

export function revealLandscape(state) {
  if (!state.dreamDrawn) {
    narrate(state, "Draw the Dream first", "Resolve the active Dream before spending Lucidity to reveal Landscapes.");
    return;
  }
  if (state.seedFlags?.rem && !state.remFree?.reveal && !state.revealLandscapeUsed && state.landscapePick?.mode !== "reveal") {
    state.remFree.reveal = true;
    beginRevealPicking(state, 1);
    seatMeetPassToken(state, activePlayer(state)?.id);
    addLog(state, "REM cycle: the team takes 1 free Reveal — no Lucidity spent.");
    recordQuestEvent(state, "reveal_landscape", { count: 0 });
    playPhaseSpendFlash("lucidity");
    return;
  }
  const player = findPhaseContributor(state);
  if (!player) {
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Reveal", state);
    narrate(
      state,
      "Select Lucidity Psyche first",
      best
        ? `One Dreamer spends 1 blue ${SUIT_LABELS.lucidity} card to set the team's reveal budget. ${best.name} has the highest Lucidity (+${totalStat(best, stat, state)}) — have them play the card.`
        : `Choose 1 blue ${SUIT_LABELS.lucidity} card from any Dreamer's hand, then click Reveal Landscapes.`,
    );
    return;
  }
  if (openerRotationBlocks(state, player)) {
    narrate(state, "Someone else opens this phase", `${player.name} opened the last phase. Another Dreamer who can pay Lucidity opens Reveal, unless nobody else can.`);
    return;
  }
  const budget = revealBudget(state, player);
  if (budget < 1) {
    narrate(
      state,
      "Select Lucidity Psyche first",
      `Choose 1 blue ${SUIT_LABELS.lucidity} card from ${player.name}'s hand. Their Lucidity stat (+${totalStat(player, "lucidity", state)}) is added to the card value.`,
    );
    return;
  }
  if (state.revealLandscapeUsed) return;
  if (state.landscapePick?.mode === "reveal") return;

  const lucidityCards = selectedBySuit(state, player, "lucidity");
  const tokenValue = phaseTokenValue(state, player);
  if (lucidityCards.length > PHASE_OPENER_MAX_CARDS || (lucidityCards.length < 1 && tokenValue < 1)) {
    narrate(state, "Select Lucidity or 1 Power Token", `Play 1 blue Psyche from ${player.name}, or spend 1 Power Token as 1 Lucidity.`);
    return;
  }

  const lucidityDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, lucidityDiscarded);
  if (consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 Lucidity.`);
  }

  beginRevealPicking(state, budget);
  recordPhaseOpener(state, player);
  seatMeetPassToken(state, player.id);
  addLog(state, `${player.name} spends Lucidity — the team may reveal up to ${budget} Landscapes.`);
  recordQuestEvent(state, "reveal_landscape", { count: 0 });
  playPhaseSpendFlash("lucidity");
}

export function activateExplore(state) {
  if (state.seedFlags?.rem && !state.remFree?.explore && !state.exploreActivated) {
    state.remFree.explore = true;
    state.exploreMovesLeft = 1;
    state.exploreActivated = true;
    seatMeetPassToken(state, activePlayer(state)?.id);
    addLog(state, "REM cycle: the team takes 1 free Explore move — no Elasticity spent. The opener moves first.");
    playPhaseSpendFlash("elasticity");
    return;
  }
  const player = findPhaseContributor(state);
  const freeRound = state.freeExploreNextRound;
  let budget = player ? exploreBudget(state, player) : 0;

  if (freeRound) {
    budget = Math.max(budget, state.players.filter((p) => p.alive).length);
    state.freeExploreNextRound = false;
    logMoment(state, "Travel Dream — free movement for every Dreamer this Explore Phase.");
  }

  if (!player && !freeRound) {
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Explore", state);
    addLog(state, best
      ? `Select 1 Elasticity card from a Dreamer's hand. ${best.name} has the best Elasticity bonus (+${totalStat(best, stat, state)}).`
      : `Select 1 ${SUIT_LABELS.elasticity} Psyche card from any Dreamer to set team moves.`);
    return;
  }

  if (player && openerRotationBlocks(state, player)) {
    addLog(state, `${player.name} opened the last phase. Another Dreamer who can pay Elasticity must open Explore.`);
    return;
  }

  const elaCards = player ? selectedBySuit(state, player, "elasticity") : [];

  const tokenValue = player ? phaseTokenValue(state, player) : 0;
  if (!freeRound && (elaCards.length > PHASE_OPENER_MAX_CARDS || (elaCards.length < 1 && tokenValue < 1))) {
    addLog(state, `Play 1 ${SUIT_LABELS.elasticity} Psyche card, or spend 1 Power Token as 1 Elasticity.`);
    return;
  }

  if (elaCards.length) {
    const discarded = discardSelected(state, player);
    trackPsycheDiscard(state, player, discarded);
  }
  if (player && consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 Elasticity.`);
  }
  if (player && (elaCards.length || tokenValue)) recordPhaseOpener(state, player);
  state.exploreMovesLeft = budget;
  state.exploreActivated = true;
  const insulationBonus = consumeInsulationMoves(state);
  if (insulationBonus) {
    state.exploreMovesLeft += insulationBonus;
    addLog(state, `Insulation grants +${insulationBonus} Explore move${insulationBonus === 1 ? "" : "s"}, then is discarded.`);
  }
  seatMeetPassToken(state, player?.id);
  addLog(state, `${player?.name || "The team"} unlocks ${state.exploreMovesLeft} Explore moves. Dreamers take turns moving.`);
  playPhaseSpendFlash("elasticity");
}

function consumeInsulationMoves(state) {
  let extra = 0;
  state.players.filter((p) => p.alive).forEach((p) => {
    [p.objects, p.persistent].forEach((bag) => {
      if (!Array.isArray(bag)) return;
      for (let i = bag.length - 1; i >= 0; i -= 1) {
        if (bag[i]?.id !== "insulation") continue;
        const [card] = bag.splice(i, 1);
        discardToMindstream(state, card);
        extra += 1;
      }
    });
  });
  return extra;
}

export function moveDreamer(state, targetLandscapeId) {
  if (getPhase(state) === "Explore" && actionTurnActive(state)) {
    focusActionTurnHolder(state);
  }
  const player = actionTurnHolder(state) || activePlayer(state);
  const to = landscapeById(state, targetLandscapeId);

  if (getPhase(state) === "Explore") {
    const runnerFree = !state.tutorialMode
      && player?.dreamer?.id === "the-runner"
      && !state.runnerFreeMoveUsed;
    if (!player) return;
    if (!state.exploreActivated || (state.exploreMovesLeft < 1 && !runnerFree)) {
      addLog(state, "Activate Explore with Elasticity Psyche first.");
      return;
    }
    if (meetPassBlocks(state, player)) {
      const holder = actionTurnHolder(state);
      addLog(state, `It is ${holder?.name || "another Dreamer"}'s turn to move. Pass Turn or tap their token.`);
      return;
    }
    if (!to || !to.revealed) {
      addLog(state, "Choose a revealed Landscape.");
      return;
    }
    if (!canMoveTo(state, player, targetLandscapeId)) {
      addLog(state, "Can only move to an adjacent revealed Landscape (unless Travel is active).");
      return;
    }

    const fromId = player.landscapeId;

    player.landscapeId = targetLandscapeId;
    state.selectedLandscapeId = targetLandscapeId;
    if (runnerFree) {
      state.runnerFreeMoveUsed = true;
      addLog(state, `${player.name} spends the first move on them for free.`);
    } else {
      state.exploreMovesLeft -= 1;
    }
    onExploreMove(state);
    recordQuestEvent(state, "move_player", { count: 1 });
    recordCancellableMove(state, player, fromId, targetLandscapeId);

    if (to.wasteland) {
      const payable = (player.hand || []).filter((card) => !isDreambeastPsycheCard(card));
      if (!payable.length) {
        addLog(state, `${player.name} steps into Wasteland with no Psyche to pay.`);
        if (state.checkPsycheDeath) state.checkPsycheDeath(player, { unpaid: true });
        return;
      }
      const discarded = payable[payable.length - 1];
      player.hand = player.hand.filter((card) => card.instanceId !== discarded.instanceId);
      state.psycheDiscard.push(discarded);
      recordCancellableDiscard(state, player, discarded, "wasteland");
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: targetLandscapeId });
      addLog(state, `${player.name} discards 1 Psyche on Wasteland.`);
    } else {
      addLog(state, `${player.name} moves to ${to.name}. (${state.exploreMovesLeft} moves left)`);
    }

    if (!runnerFree && (state.exploreMovesLeft || 0) > 0) {
      passMeetToken(state);
    } else if ((state.exploreMovesLeft || 0) < 1) {
      clearActionTurn(state);
    }

    if (targetLandscapeId === "bed") checkVictory(state);

    const enc = encounterOnLandscape(state, targetLandscapeId);
    if (enc) {
      state.activeEncounter = enc;
      state.activeEncounterLandscapeId = targetLandscapeId;
    }
    return;
  }

  state.selectedLandscapeId = targetLandscapeId;

  if (getPhase(state) === "Meet") {
    const occupant = actorOnLandscape(state, targetLandscapeId);
    if (occupant) {
      const occupantIdx = state.players.findIndex((p) => p.id === occupant.id);
      if (occupantIdx >= 0) state.activePlayerIndex = occupantIdx;
    }

    const enc = encounterOnLandscape(state, targetLandscapeId);
    if (enc) {
      state.activeEncounter = enc;
      state.activeEncounterLandscapeId = targetLandscapeId;
    } else if (state.activeEncounterLandscapeId === targetLandscapeId) {
      state.activeEncounter = null;
      state.activeEncounterLandscapeId = null;
    }
  }
}

export function gainMeetActions(state) {
  if (state.seedFlags?.rem && !state.remFree?.meet && (state.meetActionBudget || 0) < 1) {
    state.remFree.meet = true;
    state.meetActionBudget = 1;
    state.meetActionsUsed = 0;
    clearAllUsedMeetActions(state);
    seatMeetPassToken(state, null);
    addLog(state, "REM cycle: the team gains 1 free Meet action — no Willpower spent.");
    playPhaseSpendFlash("willpower");
    return;
  }
  const player = findPhaseContributor(state);
  if (!player) {
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Meet", state);
    addLog(state, best
      ? `Select 1 Willpower card from a Dreamer's hand. ${best.name} has the best Willpower bonus (+${totalStat(best, stat, state)}).`
      : `Play 1 ${SUIT_LABELS.willpower} Psyche card from any Dreamer for shared Meet Actions.`);
    return;
  }
  if (openerRotationBlocks(state, player)) {
    addLog(state, `${player.name} opened the last phase. Another Dreamer who can pay Willpower must open Meet.`);
    return;
  }
  const budget = meetActionBudgetFromWillpower(state, player);
  const wilCards = selectedBySuit(state, player, "willpower");

  const tokenValue = phaseTokenValue(state, player);
  if (wilCards.length > PHASE_OPENER_MAX_CARDS || (wilCards.length < 1 && tokenValue < 1)) {
    addLog(state, `Play 1 ${SUIT_LABELS.willpower} Psyche card from ${player.name}, or spend 1 Power Token as 1 Willpower.`);
    return;
  }

  const wilDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, wilDiscarded);
  if (consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 Willpower.`);
  }
  state.meetActionBudget = budget;
  state.meetActionsUsed = 0;
  clearAllUsedMeetActions(state);
  recordPhaseOpener(state, player);
  seatMeetPassToken(state, player.id);
  addLog(state, `${player.name} spends Willpower — the team gains ${budget} shared Meet Actions.`);
  playPhaseSpendFlash("willpower");
}

export function togglePhasePowerToken(state) {
  const player = activePlayer(state);
  if (state.phaseTokenAsPsyche === player.id) {
    state.phaseTokenAsPsyche = null;
    addLog(state, `${player.name} will not spend a Power Token as Psyche.`);
    return;
  }
  if (!canUsePhasePowerToken(state, player)) {
    addLog(state, "Spend 1 Power Token as 1 suited Psyche for this phase opener (instead of a Psyche card).");
    return;
  }
  state.phaseTokenAsPsyche = player.id;
  addLog(state, `${player.name} will spend 1 Power Token as 1 ${SUIT_LABELS[phaseSuitForOpening(getPhase(state))] || "Psyche"}.`);
}

export function powerBonus(state) {
  const player = activePlayer(state);
  if (getPhase(state) !== "Meet") {
    addLog(state, "Spend Power Tokens for +1 spread during Meet, when Psyche is played.");
    return false;
  }
  if (player.powerTokens < 1) {
    addLog(state, "Need 1 Power Token.");
    return false;
  }
  if ((state.pendingPowerBonusTokens || 0) >= 3) {
    addLog(state, "A spread can take at most 3 Power Tokens.");
    return false;
  }
  if (!spendPowerTokens(state, player, 1)) return false;
  state.pendingPowerBonus = (state.pendingPowerBonus || 0) + 1;
  state.pendingPowerBonusTokens = (state.pendingPowerBonusTokens || 0) + 1;
  addLog(state, `${player.name} spends 1 Power Token: +1d6 to the spread (now +${state.pendingPowerBonus}, max 3).`);
  playSfx("select");
  return true;
}

export function refundPowerBonus(state) {
  const player = activePlayer(state);
  if ((state.pendingPowerBonusTokens || 0) < 1) {
    addLog(state, "No Power Token spread bonus to undo.");
    return false;
  }
  state.pendingPowerBonusTokens -= 1;
  state.pendingPowerBonus = Math.max(0, (state.pendingPowerBonus || 0) - 1);
  grantPowerTokens(state, player, 1, { logQuest: false, animate: false });
  addLog(state, `${player.name} returns 1 Power Token from the Psyche spread (now +${state.pendingPowerBonus}).`);
  playSfx("select");
  return true;
}

export function failForcedAccept(state) {
  const fa = state.forcedAccept;
  if (!fa) return;
  const player = state.players.find((p) => p.id === fa.playerId);
  const enc = encounterOnLandscape(state, fa.tileId);
  if (player && enc) {
    applyFailEffect(state, player, enc);
    removeEncounterFromLandscape(state, fa.tileId, enc);
    addLog(state, `Silver: ${player.name} failed to Accept ${enc.name}.`);
  }
  state.forcedAccept = null;
  state.activeEncounter = null;
  state.activeEncounterLandscapeId = null;
}

export function getDreamerBoardRadialOptions(state, player, tileId, handlers) {
  const options = [];
  const forced = state.forcedAccept;
  if (forced && player?.id === forced.playerId && tileId === forced.tileId) {
    options.push({
      id: "silverAccept",
      label: "Accept",
      hint: "Silver: play the Accept spread. This Dreambeast cannot be Repressed.",
      primary: true,
      onPick: () => handlers.meetEncounter("accept"),
    });
    options.push({
      id: "silverFail",
      label: "Fail Accept",
      hint: "Cannot make the Accept cost — the Dreambeast fails.",
      onPick: () => failForcedAccept(state),
    });
  }
  for (const action of getPhaseActions(state, handlers)) {
    if (action.advance) continue;
    const kind = action.kind || classifyPhaseAction({ label: action.label });
    if (!DREAMER_RADIAL_KINDS.has(kind)) continue;
    const label = action.label || "";
    if (action.disabled && (/move\(s\)/.test(label) || /^Actions \d/.test(label))) continue;
    options.push({
      id: action.id || label,
      label,
      kind,
      hint: action.hint || label,
      disabled: !!action.disabled,
      primary: kind === "dreamerPower" || !!action.primary,
      onPick: action.onClick,
    });
  }

  const tile = landscapeById(state, tileId);
  if (getPhase(state) === "Meet" && tile && player?.landscapeId === tileId) {
    getLandscapeActionChoices(tile).forEach((choice, index) => {
      const label = choice.label || "";
      if (options.some((opt) => opt.label === label || opt.id === choice.id)) return;
      options.push({
        id: choice.id,
        kind: index === 0 ? "landscapeActionA" : "landscapeActionB",
        label,
        hint: choice.description,
        disabled: !canUseLandscapeAction(state, choice.id),
        onPick: () => handlers.landscapeAction(choice.id),
      });
    });
  }

  options.sort((a, b) => {
    const ia = DREAMER_RADIAL_ORDER.indexOf(a.kind);
    const ib = DREAMER_RADIAL_ORDER.indexOf(b.kind);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return options;
}

export function getPowerTokenRadialOptions(state) {
  const player = activePlayer(state);
  if (!player) return [];
  const phase = getPhase(state);
  const suit = phaseSuitForOpening(phase);
  const suitLabel = SUIT_LABELS[suit] || "Psyche";
  const pending = state.pendingPowerBonus || 0;
  const refundable = state.pendingPowerBonusTokens || 0;
  const arch = state.activeArchetype;
  const held = player.powerTokens || 0;
  const bothTrue = !!arch?.quests?.every((quest) => isQuestConditionMet(state, arch.id, quest));
  const already = !!arch?.questProgress?.every(Boolean);
  const commitHint = !arch
    ? "No active Archetype."
    : already
      ? "This Archetype is already committed."
      : held < 1
        ? "Need 1 Power Token."
        : bothTrue
          ? "Both quests are true. Spend 1 Power Token to commit. Does not cost a Meet action."
          : "Both quests must already be true.";
  const options = [
    {
      id: "quest0",
      kind: "completeQuest0",
      label: "Commit",
      hint: commitHint,
      disabled: !arch || already || !bothTrue || held < 1,
    },
    {
      id: "spreadPlus",
      kind: "powerBonus",
      label: pending > 0 ? `+1d6 Spread (now +${pending})` : "+1d6 Spread",
      hint: phase === "Meet"
        ? "Spend 1 Power Token for +1d6 on this spread (max 3 tokens)."
        : "Spread bonuses are spent during Meet, when Psyche is played.",
      disabled: phase !== "Meet" || held < 1 || refundable >= 3,
    },
  ];
  if (refundable > 0) {
    options.push({
      id: "spreadMinus",
      kind: "refundPowerBonus",
      label: `-1 Spread (now +${pending})`,
      hint: "Return 1 Power Token and remove +1 from the current Psyche spread.",
      disabled: false,
    });
  }
  const phaseOn = state.phaseTokenAsPsyche === player.id;
  options.push({
    id: "phasePsyche",
    kind: "phasePowerToken",
    label: phaseOn ? `Cancel ${suitLabel}` : `As 1 ${suitLabel}`,
    hint: phaseOn
      ? "Stop using a Power Token as 1 suited Psyche for this phase opener."
      : "Spend 1 Power Token in place of 1 suited Psyche for this phase opener (max 1).",
    disabled: !phaseOn && !canUsePhasePowerToken(state, player),
  });
  options.push({
    id: "activatePersistent",
    kind: "activateObject",
    label: "Activate Object",
    hint: "Free action — spend 1 Power Token to activate a Persistent Object. Does not cost a Meet action.",
    disabled: !(player.persistent?.length) || held < 1,
  });
  return options;
}

export function meetEncounter(state, mode = "accept", { instant = false, onDone, freeMeet = false, fromMindstreamDraw = false } = {}) {
  if (isDiceBattleOpen() || state.diceBattle) {
    addLog(state, "Finish the dice battle first.");
    return;
  }
  if (state.forcedAccept) {
    state.selectedLandscapeId = state.forcedAccept.tileId;
    if (mode !== "accept") {
      addLog(state, "Silver: this Dreambeast must be Accepted. It cannot be Repressed.");
      return;
    }
  }
  const tile = meetLandscapeTile(state);
  const encounter = encounterForMeet(state);
  if (!encounter || !tile) {
    addLog(state, "Meet a Dreambeast on a Landscape you occupy.");
    return;
  }
  if (!state.forcedAccept && !freeMeet && !spendMeetAction(state, MEET_ACTIONS.MEET)) return;

  state.activeEncounter = encounter;
  state.activeEncounterLandscapeId = tile.id;
  const actor = actorOnLandscape(state, tile.id);
  const abortMeet = (message) => {
    if (message) addLog(state, message);
    if (state.forcedAccept || freeMeet) return;
    refundMeetAction(state, actor || meetActionActor(state, MEET_ACTIONS.MEET), MEET_ACTIONS.MEET);
  };
  if (!actor) {
    abortMeet("A Dreamer must be on this Landscape to Meet the Encounter.");
    return;
  }
  const isReject = mode === "reject" || mode === "repress";
  if (!isReject && isLeviathanCard(encounter)) {
    abortMeet("Leviathan is Awake. The only Meet is Slumber: Repress it, and it flips Asleep into the Subconscious.");
    return;
  }
  const beastPower = encounterPower(encounter, !isReject);
  const recommended = recommendedEncounterPower(encounter, !isReject);
  const selected = selectedCards(state, actor);

  if (!isReject && actor.hand.length >= handLimitForPlayer(state, actor)) {
    abortMeet(`${actor.name}'s hand is full (${handLimitForPlayer(state, actor)} cards). Spend Psyche or allies first.`);
    return;
  }

  if (selected.filter((c) => !isDreambeastPsycheCard(c)).length > 3) {
    abortMeet("Play up to 3 Psyche cards for an Encounter (allies don't count).");
    return;
  }

  const shapeCheck = validateEncounterPlayShape(encounter, selected, { accept: !isReject });
  if (!shapeCheck.ok) {
    abortMeet(shapeCheck.message);
    return;
  }
  const played = Math.max(1, encounterPlayTotal(state, { accept: !isReject }));
  const bonus = meetBonusBreakdown(state);
  const ctx = {
    mode,
    isReject,
    encounter,
    tile,
    actor,
    selected,
    played,
    needed: beastPower,
    fromMindstreamDraw: !!fromMindstreamDraw || !!encounter.drawnFromMindstream,
  };

  const recNote = played < recommended
    ? ` Under recommended ${recommended} (beast Power ${beastPower}).`
    : "";
  addLog(
    state,
    `${actor.name} Power ${played}d6 vs ${encounter.name} Power ${beastPower}d6.${bonus.total ? ` Affinity +${bonus.total}.` : ""}${recNote}`,
  );

  const finish = (dreamerWins) => {
    state.diceBattle = null;
    resolveDiceMeet(state, ctx, dreamerWins);
    onDone?.();
  };

  const scriptedWinner = state.tutorialMode
    ? (state.tutorialFlags?.nextBattleWinner || "dreamer")
    : null;
  const teachStand = !!(state.tutorialMode && scriptedWinner === "beast" && (actor.powerTokens || 0) > 0);

  const forceInstant = instant
    || typeof document === "undefined"
    || !!globalThis.__SOMNIA_INSTANT_DICE__;
  if (forceInstant) {
    finish(scriptedWinner !== "beast");
    return;
  }

  state.diceBattle = { encounterId: encounter.id, tileId: tile.id };
  playDiceBattle({
    dreamerName: actor.name,
    beastName: encounter.name,
    dreamerDice: played,
    beastDice: beastPower,
    forceWinner: scriptedWinner,
    minBeastLead: teachStand ? 2 : 0,
    instant: false,
    allowPostRollToken: teachStand || (!scriptedWinner && (actor.powerTokens || 0) > 0),
    postRollLead: teachStand
      ? "Mandrake leads by more than 1 success. Subtract 1 cannot flip this fight. Click Stand. In a closer fight, that same token can take one success. A tie still favors the beast."
      : "",
    onPostRoll: () => {
      if (!spendPowerTokens(state, actor, 1, { animate: false })) return false;
      addLog(state, `${actor.name} spends 1 Power Token to subtract 1 beast success.`);
      return true;
    },
    onComplete: ({ dreamerWins }) => finish(dreamerWins),
  });
}

function resolveDiceMeet(state, ctx, dreamerWins) {
  const { isReject, encounter, tile, actor, selected } = ctx;

  queuePsycheSwirlFx(selected, tile.id);
  queueMeetFlashFx(isReject ? "reject" : "accept", tile.id, selected);
  const discarded = discardSelected(state, actor);
  trackPsycheDiscard(state, actor, discarded);

  if (!dreamerWins) {
    if (state.tutorialMode) state.tutorialFlags.firstBattleLost = true;
    addLog(
      state,
      `${actor.name} loses the dice battle with ${encounter.name}. The play is spent. ${encounter.name} remains on ${tile.name}.`,
    );
    logMoment(state, `${encounter.name} wins the clash — it stays on ${tile.name}.`);
    if (ctx.fromMindstreamDraw || encounter.drawnFromMindstream) {
      applyFailEffect(state, actor, encounter);
      logMoment(state, `${encounter.name} Fail resolves — failed Accept/Repress on draw.`);
    }
    offerHunterShove(state, actor, encounter, tile);
    return;
  }

  if (!isReject) {
    addLog(state, `${actor.name} Accepts ${encounter.name}. ${encounter.effect || ""}`);
    applyAcceptEffect(state, encounter, actor, getEffectHelpers());

    const handCard = dreambeastToHandCard(encounter);
    actor.hand.push(handCard);
    addLog(state, `${encounter.name} joins ${actor.name}'s hand as a 3 ${SUIT_LABELS[encounter.suit] || encounter.suit} Psyche ally.`);
  } else {
    if (isLeviathanCard(encounter)) {
      encounter.awake = false;
      addLog(state, `${actor.name} forces Leviathan into Slumber. It flips Asleep and is Repressed into the Subconscious.`);
    } else {
      addLog(state, `${actor.name} Represses ${encounter.name}. ${encounter.rejectReward || ""}`);
    }
    repressCard(state, { ...encounter, type: "dreambeast", awake: isLeviathanCard(encounter) ? false : encounter.awake });
    applyRejectReward(state, encounter, actor, getEffectHelpers());
  }

  const landscapeId = state.activeEncounterLandscapeId;
  if (landscapeId) {
    recordQuestEvent(state, "meet_on_landscape", { landscapeId });
    notifyTutorialEncounterResolved(state, landscapeId);
    if (encounter.boss || encounter.id === "cerberus" || encounter.id === "double" || encounter.id === "leviathan") {
      recordQuestEvent(state, "meet_boss", { bossId: encounter.id });
    }
    removeEncounterFromLandscape(state, landscapeId, encounter);
  }
  state.forcedAccept = null;

  if (state.pendingHeatingUp) {
    if (!isReject) {
      spawnEncounterOnLandscape(state, actor.landscapeId);
      logMoment(state, "Heating Up — Accept spawns another Encounter.");
    } else {
      const limit = handLimitForPlayer(state, actor);
      let drew = 0;
      while (actor.hand.length < limit) {
        const n = drawPsycheForPlayer(state, actor, 1);
        if (!n.length) break;
        drew += n.length;
      }
      if (drew) trackPsycheDraw(state, actor, drew);
      const allies = allyHandCount(actor);
      const allyNote = allies ? ` · ${allies} allies` : "";
      logMoment(state, `Heating Up — drew Psyche up to hand limit (${actor.hand.length}/${limit}${allyNote}).`);
    }
    state.pendingHeatingUp = false;
  }
}

function landscapeActionHelpers(state) {
  const helpers = getEffectHelpers();
  return {
    ...helpers,
    pickMindstreamSuit: true,
    pickDeck: true,
    psychePoolTotal: coopMeetPlayTotal,
    psychePointTotal: (s) => allSelectedCards(s).reduce((n, card) => n + (Number(card.value) || 0), 0),
    discardPsychePool: (s) => {
      const discardedBy = discardAllSelected(s);
      discardedBy.forEach(({ player: p, cards }) => trackPsycheDiscard(s, p, cards));
    },
  };
}

function validateMeetLandscape(state) {
  const tile = meetLandscapeTile(state);
  if (!tile) {
    addLog(state, "A Dreamer must be on a revealed Landscape.");
    return null;
  }
  const player = actorOnLandscape(state, tile.id);
  return { tile, player };
}

function landscapeActionPreflight(_state, _actionId) {
  return true;
}

export function performLandscapeAction(state, actionId, { onResult } = {}) {
  const actorBefore = meetActionActor(state, MEET_ACTIONS.LANDSCAPE);
  if (!canUseMeetActionForActor(state, actorBefore, MEET_ACTIONS.LANDSCAPE, actionId)) {
    addLog(state, "Cannot use this Meet action (restricted or no actions remain).");
    return null;
  }

  const ctx = validateMeetLandscape(state);
  if (!ctx) return null;

  const { tile, player } = ctx;
  const available = getLandscapeActionChoices(tile);
  if (!available.some((choice) => choice.id === actionId)) {
    addLog(state, "That action is not available on this Landscape.");
    return null;
  }

  if (actionId === "draw-mindstream" && !canDrawMindstreamOnLandscape(tile)) {
    addLog(state, "This Landscape has no matching Mindstream deck.");
    return null;
  }

  if (!landscapeActionPreflight(state, actionId)) return null;
  if (!spendMeetAction(state, MEET_ACTIONS.LANDSCAPE, actionId)) return null;

  const result = completeLandscapeAction(state, tile, player, actionId, onResult);
  return result;
}

export function drawMindstreamOnLandscape(state, options = {}) {
  return performLandscapeAction(state, "draw-mindstream", options);
}

export function uniqueLandscapeAction(state, { onChoose, onResult } = {}) {
  const ctx = validateMeetLandscape(state);
  if (!ctx) {
    addLog(state, "A Dreamer must be on a revealed Landscape.");
    return null;
  }
  const { tile, player } = ctx;
  const choices = getLandscapeActionChoices(tile);
  if (!choices.length) {
    addLog(state, "No Landscape Action here.");
    return null;
  }

  if (choices.length === 1 && !onChoose) {
    return performLandscapeAction(state, choices[0].id, { onResult });
  }

  if (onChoose) {
    onChoose(choices, tile, player);
    return { pending: true };
  }

  return performLandscapeAction(state, choices[0].id, { onResult });
}

export function landscapeAction(state, { onChoose, onResult } = {}) {
  return uniqueLandscapeAction(state, { onChoose, onResult });
}

export function completeLandscapeAction(state, tile, player, actionId, onResult) {
  recordQuestEvent(state, "landscape_action", { landscapeId: tile.id });
  const result = executeLandscapeActionChoice(
    state,
    tile,
    player,
    actionId,
    landscapeActionHelpers(state),
  );

  if (result?.pending === "pick-mindstream-suit" || result?.pending === "spawn-dreambeast-pick-suit") {
    return { pending: result.pending, tile, player, actionId, onResult };
  }

  if (result?.pending === "flip-top-3-pick-deck") {
    return { pending: result.pending, tile, player, actionId, onResult };
  }

  if (result?.refund || (!result?.ok && !result?.pending)) {
    refundMeetAction(state, player, MEET_ACTIONS.LANDSCAPE, actionId);
  }

  noteFreeQuestMeet(state, tile, result);
  if (result?.card && onResult) onResult(result.card);
  return result;
}

function noteFreeQuestMeet(state, tile, result) {
  if (result?.card?.type !== "dreambeast") return;
  if (!meetQuestLandscapeIds(state).includes(tile?.id)) return;
  state.freeQuestMeet = { landscapeId: tile.id };
  addLog(state, `${result.card.name} stands on the quest Landscape. Meeting it does not cost another action.`);
}

export function finishLandscapeMindstreamPick(state, tile, player, actionId, suit, onResult) {
  const result = resolveLandscapeMindstreamPick(
    state,
    tile,
    player,
    suit,
    actionId,
    landscapeActionHelpers(state),
  );
  if (result?.refund) refundMeetAction(state, player, MEET_ACTIONS.LANDSCAPE, actionId);
  noteFreeQuestMeet(state, tile, result);
  if (result?.card && onResult) onResult(result.card);
  return result;
}

export function finishLandscapeDeckFlip(state, deckKey) {
  return flipTopThreeOfDeck(state, deckKey);
}

export function spendLucidityRevealOnDeck(state, suit) {
  return spendRevealOnMindstreamTop(state, suit);
}

export function tryDrawMindstreamFromDeck(state, suit, helpers = {}) {
  if (getPhase(state) !== "Meet") return { ok: false, reason: "meet" };
  const player = activePlayer(state);
  if (!player?.alive) return { ok: false, reason: "dreamer" };
  const tile = landscapeById(state, player.landscapeId);
  if (!tile?.revealed || tile.wasteland) {
    return { ok: false, reason: "landscape" };
  }
  if (tile.suit === suit && canDrawMindstreamOnLandscape(tile)) {
    const result = performLandscapeAction(state, "draw-mindstream", helpers);
    return result || { ok: false, reason: "meet", tile, player };
  }
  const anyDraw = getLandscapeActionChoices(tile).some((choice) => choice.id === "draw-any-mindstream");
  if (anyDraw) {
    const started = performLandscapeAction(state, "draw-any-mindstream", helpers);
    if (started?.pending === "pick-mindstream-suit") {
      return finishLandscapeMindstreamPick(state, tile, player, "draw-any-mindstream", suit, helpers.onResult);
    }
    return started || { ok: false, reason: "suit", tile, player };
  }
  return { ok: false, reason: "suit", tile, player };
}

export function drawMindstreamCard(state, suit) {
  if (getPhase(state) !== "Meet") {
    addLog(state, "Draw Mindstream during the Meet phase.");
    return null;
  }
  const tile = landscapeById(state, state.selectedLandscapeId);
  if (!tile?.revealed) {
    addLog(state, "Select a revealed Landscape.");
    return null;
  }
  const result = performLandscapeAction(state, "draw-mindstream");
  return result?.card || null;
}

export function playObject(state, objectId = null, { usePower = false } = {}) {
  const player = activePlayer(state);
  const all = [...(player.objects || []), ...(player.persistent || [])];
  const card = objectId
    ? all.find((o) => o.instanceId === objectId || o.id === objectId)
    : player.objects[0] || player.persistent[0];

  if (!card) {
    addLog(state, "No Object to play.");
    return null;
  }

  const isPersistentActivate = player.persistent?.some((o) => o.instanceId === card.instanceId);
  return playObjectCard(state, player, card, getEffectHelpers(), { usePower: isPersistentActivate || usePower });
}

export function activateObject(state) {
  const player = activePlayer(state);
  if (!player.persistent?.length) {
    addLog(state, "No Persistent Objects in play.");
    return null;
  }
  const card = player.persistent[0];
  return playObject(state, card.instanceId, { usePower: true });
}

function meetActionsLeft(state) {
  return Math.max(0, (state.meetActionBudget || 0) - (state.meetActionsUsed || 0));
}

function spendLeftoverMeetActions(state, count) {
  if (meetActionsLeft(state) < count) return false;
  state.meetActionsUsed += count;
  return true;
}

/** Move the top Dream to just before Final Recurrence. You Never Wake Up stays last. */
function buryDreamTop(deck) {
  const card = deck.shift();
  if (!card) return null;
  if (card.id === "you-never-wake") {
    deck.unshift(card);
    return card;
  }
  const finaleAt = deck.findIndex((c) => c.type === "final" || c.id === "final-recurrence");
  if (finaleAt < 0) deck.push(card);
  else deck.splice(finaleAt, 0, card);
  return card;
}

export function cashExplorePeek(state) {
  if (state.tutorialMode || getPhase(state) !== "Explore") return false;
  if ((state.exploreMovesLeft || 0) < 2) {
    addLog(state, "Need 2 unused Explore moves to peek the Dream Deck.");
    return false;
  }
  const top = state.dreamDeck?.[0];
  if (!top) {
    addLog(state, "The Dream Deck is empty.");
    return false;
  }
  state.exploreMovesLeft -= 2;
  addLog(state, `Spent 2 moves to peek the next Dream: ${top.name}.`);
  offerEffectChoice(state, activePlayer(state), {
    cardId: "clock-peek",
    title: "Next Dream",
    message: `${top.name}. Leave it on top, or bury it ahead of Final Recurrence.`,
    choices: [
      { id: "keep", label: "Leave on top", hint: "It will be drawn next." },
      { id: "bury", label: "Bury it", hint: "Slide it down, just before the Final Recurrence." },
    ],
  });
  return true;
}

registerEffectResolver("clock-peek", (state, choiceId) => {
  const deck = state.dreamDeck || [];
  const card = deck[0];
  state.pendingEffectChoice = null;
  if (!card) return false;
  if (choiceId === "bury") {
    buryDreamTop(deck);
    addLog(state, `Buried ${card.name} ahead of Final Recurrence.`);
  } else {
    addLog(state, `${card.name} stays on top of the Dream Deck.`);
  }
  return true;
});

registerEffectResolver("weaver-swap", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const payload = pending?.payload || {};
  const weaver = state.players.find((p) => p.id === payload.weaverId) || activePlayer(state);
  if (payload.step === "neighbor") {
    const neighbor = state.players.find((p) => p.id === choiceId);
    const cards = psycheCardsForSwap(neighbor);
    if (!neighbor || !cards.length) {
      state.pendingEffectChoice = null;
      return false;
    }
    offerEffectChoice(state, weaver, {
      cardId: "weaver-swap",
      title: "Weaver Swap",
      message: `Choose 1 Psyche from ${neighbor.name}.`,
      choices: cards.map((card) => ({
        id: card.instanceId,
        label: card.name || `${card.suit} ${card.value}`,
      })),
      payload: { step: "card", cardId: payload.cardId, neighborId: neighbor.id, weaverId: payload.weaverId },
    });
    return true;
  }
  state.pendingEffectChoice = null;
  const neighbor = state.players.find((p) => p.id === payload.neighborId);
  const mine = weaver?.hand?.find((card) => card.instanceId === payload.cardId);
  const theirs = neighbor?.hand?.find((card) => card.instanceId === choiceId);
  if (!weaver || !neighbor || !mine || !theirs) return false;
  weaver.hand = weaver.hand.filter((card) => card.instanceId !== mine.instanceId);
  neighbor.hand = neighbor.hand.filter((card) => card.instanceId !== theirs.instanceId);
  weaver.hand.push(theirs);
  neighbor.hand.push(mine);
  state.selectedHand = (state.selectedHand || []).filter((id) => id !== mine.instanceId && id !== theirs.instanceId);
  state.weaverSwapUsed = true;
  addLog(state, `${weaver.name} swaps ${mine.name} with ${neighbor.name}'s ${theirs.name}.`);
  return true;
});

registerEffectResolver("hunter-shove", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const payload = pending?.payload || {};
  state.pendingEffectChoice = null;
  if (choiceId !== "shove") {
    addLog(state, "The Hunter leaves the Dreambeast where it stands.");
    return true;
  }
  const tile = landscapeById(state, payload.tileId);
  const encounter = encounterOnLandscape(state, payload.tileId);
  if (!tile || !encounter) return false;
  const adj = adjacentTiles(state, tile.id).filter((hex) => hex.revealed && !hex.wasteland);
  if (!adj.length) return false;
  requestChooseTile(state, {
    allowedIds: adj.map((hex) => hex.id),
    action: "moveEncounter",
    fromTileId: tile.id,
    encounter,
    title: "Hunter — shove the beast",
    detail: "Move that Dreambeast 1 hex. This is free.",
  });
  return true;
});

function subconsciousDreambeastCount(state) {
  return listSubconsciousCards(state).filter(isSubconsciousDreambeast).length;
}

export function cashMeetReturn(state) {
  if (state.tutorialMode) return false;
  if (meetPassBlocks(state, activePlayer(state))) {
    addLog(state, "The Meet Pass Token is with another Dreamer.");
    return false;
  }
  if (!subconsciousDreambeastCount(state)) {
    addLog(state, "No Dreambeast in the Subconscious to Return.");
    return false;
  }
  if (!spendLeftoverMeetActions(state, 2)) {
    addLog(state, "Need 2 unused Meet actions to Return a Dreambeast.");
    return false;
  }
  const player = activePlayer(state);
  enqueueReturnCards(state, 1, player, {
    filter: "dreambeast",
    reason: `${player.name} spends 2 Meet actions to Return 1 Dreambeast from the Subconscious.`,
  });
  addLog(state, `${player.name} cashes 2 Meet actions: Return 1 Dreambeast.`);
  passMeetToken(state);
  return true;
}

function psycheCardsForSwap(player) {
  return (player?.hand || []).filter(isSwappablePsyche);
}

export function startWeaverSwap(state) {
  if (state.tutorialMode && state.tutorialTrack !== "advanced") return false;
  if (state.weaverSwapUsed) return false;
  if (getPhase(state) !== "Meet" || (state.meetActionBudget || 0) < 1) {
    addLog(state, "The Weaver swaps during an open Meet.");
    return false;
  }
  const weaver = activePlayer(state);
  if (weaver?.dreamer?.id !== "the-weaver") return false;
  const mine = selectedCards(state, weaver).filter(isSwappablePsyche);
  if (mine.length !== 1) {
    addLog(state, `${weaver.name}: select exactly 1 Psyche to swap.`);
    return false;
  }
  const neighbors = state.players.filter((other) => (
    other.alive
    && other.id !== weaver.id
    && canTradeBetween(state, weaver.landscapeId, other.landscapeId)
    && psycheCardsForSwap(other).length
  ));
  if (!neighbors.length) {
    addLog(state, "No adjacent Dreamer has a Psyche to swap.");
    return false;
  }
  offerEffectChoice(state, weaver, {
    cardId: "weaver-swap",
    title: "Weaver Swap",
    message: "Choose an adjacent Dreamer.",
    choices: neighbors.map((other) => ({ id: other.id, label: other.name })),
    payload: { step: "neighbor", cardId: mine[0].instanceId, weaverId: weaver.id },
  });
  return true;
}

function offerHunterShove(state, actor, encounter, tile) {
  if (state.tutorialMode || state.hunterShoveUsed) return;
  if (actor?.dreamer?.id !== "the-hunter") return;
  if (state.pendingEffectChoice) return;
  const adj = adjacentTiles(state, tile.id).filter((hex) => hex.revealed && !hex.wasteland);
  state.hunterShoveUsed = true;
  if (!adj.length) {
    addLog(state, `${actor.name}'s hunt has nowhere to shove ${encounter.name}.`);
    return;
  }
  offerEffectChoice(state, actor, {
    cardId: "hunter-shove",
    title: "The Hunter",
    message: `Move ${encounter.name} 1 hex for free, or leave it.`,
    choices: [
      { id: "shove", label: "Shove 1 hex" },
      { id: "leave", label: "Leave it" },
    ],
    payload: { tileId: tile.id, encounterKey: encounter.instanceId || encounter.id },
  });
}

function canStartTrade(state) {
  return legalTradePartners(state).length > 0 && getPhase(state) === "Meet" && (state.meetActionBudget || 0) >= 1;
}

export function legalTradePartners(state) {
  if (getPhase(state) !== "Meet" || (state.meetActionBudget || 0) < 1) return [];
  const me = activePlayer(state);
  if (!me?.alive) return [];
  return state.players.filter((p) => (
    p.alive && p.id !== me.id && canTradeBetween(state, me.landscapeId, p.landscapeId)
  ));
}

export function tradeAction(state) {
  const partners = legalTradePartners(state);
  if (!partners.length) {
    addLog(state, "Trade needs an open Meet and a Dreamer on the same or adjacent hex.");
    return;
  }
  state.tradeMode = true;
  state.trade = {
    initiatorId: activePlayer(state).id,
    partnerId: null,
    offerPsycheIds: [],
    partnerOfferIds: [],
    offerObjectIds: [],
    step: "pick-partner",
  };
  if (partners.length === 1) {
    const index = state.players.findIndex((p) => p.id === partners[0].id);
    selectTradePartner(state, index);
    return;
  }
  addLog(state, "Trade: choose a Dreamer on the same or adjacent Landscape.");
}

export function selectTradePartner(state, playerIndex) {
  if (!state.tradeMode || !state.trade) return false;
  const initiator = state.players.find((p) => p.id === state.trade.initiatorId) || activePlayer(state);
  const partner = state.players[playerIndex];
  if (!partner?.alive || partner.id === initiator.id) return false;
  if (!canTradeBetween(state, initiator.landscapeId, partner.landscapeId)) {
    addLog(state, "Trade partner must be on the same or adjacent Landscape.");
    return false;
  }
  state.trade.partnerId = partner.id;
  state.trade.step = "select-offer";
  addLog(state, `Trading with ${partner.name}. Select Psyche cards to offer, then confirm.`);
  return true;
}

function tradeOfferKey(state, holder) {
  if (!state.trade || !holder) return null;
  if (holder.id === state.trade.initiatorId) return "offerPsycheIds";
  if (holder.id === state.trade.partnerId) return "partnerOfferIds";
  return null;
}

export function toggleTradeOffer(state, card, owner = null) {
  if (!state.trade || state.trade.step !== "select-offer" || !card) return false;
  const holder = owner || activePlayer(state);
  const key = tradeOfferKey(state, holder);
  if (!key || !isTradablePsyche(card)) return false;
  if (!holder.hand.some((c) => c.instanceId === card.instanceId)) return false;
  const id = card.instanceId;
  const list = state.trade[key] || [];
  state.trade[key] = list;
  if (list.includes(id)) {
    state.trade[key] = list.filter((x) => x !== id);
    return true;
  }
  if (list.length >= TRADE_OFFER_LIMIT) {
    addLog(state, `${holder.name} can offer up to ${TRADE_OFFER_LIMIT} Psyche.`);
    return false;
  }
  list.push(id);
  return true;
}

export function confirmTrade(state) {
  if (!state.trade?.partnerId) {
    addLog(state, "Select a trade partner first.");
    return false;
  }
  const initiator = state.players.find((p) => p.id === state.trade.initiatorId);
  const partner = state.players.find((p) => p.id === state.trade.partnerId);
  if (!initiator || !partner) return false;
  if (!canTradeBetween(state, initiator.landscapeId, partner.landscapeId)) {
    addLog(state, "Trade partner must be on the same or adjacent Landscape.");
    return false;
  }

  const giveIds = new Set(state.trade.offerPsycheIds || []);
  const takeIds = new Set(state.trade.partnerOfferIds || []);
  const given = initiator.hand.filter((c) => giveIds.has(c.instanceId) && isTradablePsyche(c));
  const taken = partner.hand.filter((c) => takeIds.has(c.instanceId) && isTradablePsyche(c));
  if (!given.length && !taken.length) {
    addLog(state, "Select at least 1 Psyche to trade.");
    return false;
  }

  const initiatorNext = initiator.hand.length - given.length + taken.length;
  const partnerNext = partner.hand.length - taken.length + given.length;
  const initiatorLimit = handLimitForPlayer(state, initiator);
  const partnerLimit = handLimitForPlayer(state, partner);
  if (initiatorNext > initiatorLimit || partnerNext > partnerLimit) {
    const who = initiatorNext > initiatorLimit ? initiator.name : partner.name;
    const limit = initiatorNext > initiatorLimit ? initiatorLimit : partnerLimit;
    addLog(state, `${who}'s hand would pass ${limit} cards. Offer fewer Psyche.`);
    return false;
  }

  const givenIds = new Set(given.map((c) => c.instanceId));
  const takenIds = new Set(taken.map((c) => c.instanceId));
  initiator.hand = initiator.hand.filter((c) => !givenIds.has(c.instanceId));
  partner.hand = partner.hand.filter((c) => !takenIds.has(c.instanceId));
  initiator.hand.push(...taken);
  partner.hand.push(...given);
  const moved = new Set([...givenIds, ...takenIds]);
  state.selectedHand = (state.selectedHand || []).filter((id) => !moved.has(id));

  if (given.length) queueCardTrade(initiator.id, partner.id, given);
  if (taken.length) queueCardTrade(partner.id, initiator.id, taken);
  if (given.length || taken.length) {
    playSfx("draw", { count: Math.min(given.length + taken.length, 3) });
  }
  addLog(state, `${initiator.name} gave ${given.length} Psyche to ${partner.name}. ${partner.name} gave ${taken.length} Psyche to ${initiator.name}.`);
  if (state.tutorialFlags) state.tutorialFlags.tradeDone = true;
  state.tradeMode = false;
  state.trade = null;
  return true;
}

export function cancelTrade(state) {
  state.tradeMode = false;
  state.trade = null;
  state.selectedHand = [];
  addLog(state, "Trade cancelled.");
}

export function handleDefeatFinalArchetype(state) {
  if (!spendMeetAction(state, MEET_ACTIONS.MEET)) return;
  const tile = landscapeById(state, state.selectedLandscapeId);
  const arch = tile?.finalArchetype;
  if (!arch || arch.defeated) {
    addLog(state, "Select a Landscape with an undefeated Remaining Archetype.");
    refundMeetAction(state, landscapeActor(state), MEET_ACTIONS.MEET);
    return;
  }

  const actor = landscapeActor(state);
  const selected = allSelectedCards(state);
  const ok = defeatFinalArchetype(state, arch, actor, selected, () => coopMeetPlayTotal(state));
  if (ok) {
    const discardedBy = discardAllSelected(state);
    discardedBy.forEach(({ player: p, cards }) => trackPsycheDiscard(state, p, cards));
    arch.defeated = true;
    const entry = state.finalArchetypes.find((a) => a.id === arch.id);
    if (entry) entry.defeated = true;
  } else {
    refundMeetAction(state, actor, MEET_ACTIONS.MEET);
  }
}

export function handleSacrificeForFinal(state) {
  const remaining = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
  const acquired = state.players.reduce((n, p) => n + p.acquiredArchetypes.length, 0);
  const count = Math.min(remaining, acquired);
  if (!count) {
    addLog(state, "No acquired Archetypes to sacrifice.");
    return;
  }
  sacrificeAcquiredForFinal(state, count);
  state.board.forEach((tile) => {
    if (tile.finalArchetype) {
      const entry = state.finalArchetypes.find((a) => a.id === tile.finalArchetype.id);
      if (entry?.defeated) tile.finalArchetype.defeated = true;
    }
  });
}

export function useDreamerPower(state) {
  const player = activePlayer(state);
  if (hasPendingDreamerPower(state)) {
    addLog(state, "Finish the current Dreamer Power first.");
    return null;
  }
  if (!canActivateDreamerPower(state, player)) {
    addLog(state, `${player.dreamer.name} Power cannot be used right now.`);
    return null;
  }
  if (!spendPowerTokens(state, player, 1, { animate: false })) {
    addLog(state, "Need 1 Power Token.");
    return null;
  }
  addLog(state, `${player.name} activates ${player.dreamer.name} Power (1 Power Token).`);
  queueDreamerPowerFx(player.id, player.dreamer, player.landscapeId);
  state.pendingDreamerPower = { dreamerId: player.dreamer.id, actorId: player.id };
  return beginDreamerPower(state);
}

export function spawnEncounterOnLandscape(state, landscapeId, beastCard = null) {
  let beast;
  if (beastCard) {
    beast = encounterFromDreambeastCard(beastCard);
  } else if (state.pickEncounterOnSpawn) {
    const pair = drawTwoDreambeasts(state);
    if (!pair) return null;
    state.pickEncounterOnSpawn = false;
    return beginTransformationPick(state, landscapeId, pair.first, pair.second);
  } else {
    const pulled = pullDreambeastFromMindstream(state);
    if (!pulled) return null;
    beast = encounterFromDreambeastCard(pulled.card);
  }
  setEncounterOnLandscape(state, landscapeId, beast);
  const tile = landscapeById(state, landscapeId);
  logMoment(state, `${beast.name} appears on ${tile?.name || "the Dreamscape"}!`);
  return beast;
}

export function spawnRandomEncounter(state) {
  const revealed = revealedLandscapeTiles(state);
  if (!revealed.length) return null;
  if (state.tutorialMode || revealed.length === 1) {
    const tile = revealed[Math.floor(random() * revealed.length)];
    return spawnEncounterOnLandscape(state, tile.id);
  }
  const pulled = pullDreambeastFromMindstream(state);
  if (!pulled) return null;
  const encounter = encounterFromDreambeastCard(pulled.card);
  requestChooseTile(state, {
    allowedIds: revealed.map((t) => t.id),
    action: "spawnEncounter",
    encounter,
    title: "A Dreambeast stirs",
    detail: "Choose a revealed Landscape for the Dreambeast to appear on.",
  });
  return encounter;
}

export function toggleHandCard(state, card, owner = null) {
  const phase = getPhase(state);
  const player = owner || activePlayer(state);
  const id = card.instanceId;

  if (state.tradeMode && state.trade?.step === "select-offer") {
    toggleTradeOffer(state, card, player);
    return;
  }

  if (card.type === "psyche-power") {
    playPsychePowerFromHand(state, player, card);
    return;
  }

  if (isDreambeastPsycheCard(card)) {
    if (phase !== "Meet" || state.meetActionBudget === 0) return;
    if (!player.alive || !player.hand.some((c) => c.instanceId === id)) return;
    const actor = meetPsycheActor(state);
    if (!actor || player.id !== actor.id) return;
    if (state.selectedHand.includes(id)) {
      state.selectedHand = state.selectedHand.filter((x) => x !== id);
      return;
    }
    state.selectedHand.push(id);
    return;
  }

  if (state.selectedHand.includes(id)) {
    state.selectedHand = state.selectedHand.filter((x) => x !== id);
    return;
  }

  const coopMeet = phase === "Meet" && state.meetActionBudget > 0;
  const maxCards = coopMeet ? 3 : PHASE_OPENER_MAX_CARDS;
  if (!isDreambeastPsycheCard(card) && coopMeet && spreadPsycheCount(state) >= 3) return;
  if (!coopMeet && state.selectedHand.length >= maxCards) return;

  if (phase === "Meet" && state.meetActionBudget > 0) {
    if (!player.alive || !player.hand.some((c) => c.instanceId === id)) return;
    const actor = meetPsycheActor(state);
    if (!actor || player.id !== actor.id) return;
    state.selectedHand = state.selectedHand.filter((selId) =>
      actor.hand.some((c) => c.instanceId === selId),
    );
    state.selectedHand.push(id);
    return;
  }

  if (phaseOpeningActive(state)) {
    if (!player.alive || !player.hand.some((c) => c.instanceId === id)) return;
    const suit = phaseSuitForOpening(phase);
    if (!cardCountsAsSuit(card, suit, state)) return;

    if (state.selectedHand.includes(id)) {
      state.selectedHand = state.selectedHand.filter((x) => x !== id);
      return;
    }

    const contributor = findPhaseContributor(state);
    if (contributor && contributor.id !== player.id) {
      state.selectedHand = state.selectedHand.filter((selId) =>
        player.hand.some((c) => c.instanceId === selId),
      );
    }

    const suited = selectedBySuit(state, player, suit);
    if (suited.length >= PHASE_OPENER_MAX_CARDS) return;
    state.selectedHand.push(id);
    return;
  }
}

export function handleQuestComplete(state, questIndex = 0) {
  return completeQuest(state, questIndex, activePlayer(state), (s, arch, p) => {
    resolveOnAcquire(s, arch, p);
  });
}

export function handleUseArchetypePower(state, archetypeId) {
  const powers = getActivatableArchetypePowers(state);
  const archetype = powers.find((a) => a.id === archetypeId);
  if (!archetype) return false;
  const ok = useArchetypePower(state, archetype, activePlayer(state), getEffectHelpers());
  if (ok) queueArchetypePowerFx(archetype);
  return ok;
}

export function handleAcquire(state) {
  acquireArchetype(state, activePlayer(state), (s, arch, p) => {
    resolveOnAcquire(s, arch, p);
  });
}

function canAutoActivateExplore(state) {
  if (getPhase(state) !== "Explore" || state.exploreActivated) return false;
  if (state.freeExploreNextRound) return true;
  const player = findPhaseContributor(state);
  if (!player) return false;
  const elaCards = selectedBySuit(state, player, "elasticity");
  if (elaCards.length > PHASE_OPENER_MAX_CARDS) return false;
  if (elaCards.length >= 1) return true;
  return phaseTokenValue(state, player) >= 1;
}

export function handleBoardTileClick(state, tileId) {
  if (handleArchetypePowerTilePick(state, tileId)) return true;
  if (handleDreamerPowerTilePick(state, tileId)) return true;
  if (state.pendingDreamerPower?.step === "reveal-landscape") {
    addLog(state, "Visionary Power: choose a hidden Landscape to reveal.");
    return false;
  }
  if (state.landscapePick) {
    const pickMode = state.landscapePick.mode;
    if ((pickMode === "reveal" || pickMode === "reveal-deck-tops") && actionTurnActive(state)) {
      const holder = actionTurnHolder(state);
      const actor = activePlayer(state);
      if (holder && actor && holder.id !== actor.id) {
        addLog(state, `It is ${holder.name}'s turn to reveal.`);
        return false;
      }
    }
    const beforeRemaining = state.landscapePick.remaining;
    const ok = handleLandscapeTilePick(state, tileId);
    if (ok && (pickMode === "reveal" || pickMode === "reveal-deck-tops")) {
      if (!state.landscapePick || (state.landscapePick.remaining || 0) < 1) {
        clearActionTurn(state);
      } else if ((state.landscapePick.remaining || 0) < beforeRemaining) {
        passMeetToken(state);
      }
    }
    if (ok && state.pendingObjectFollowup) resumeObjectEffect(state, getEffectHelpers());
    return ok;
  }
  if (canAutoActivateExplore(state)) activateExplore(state);

  const phase = getPhase(state);
  if (phase === "Explore" && state.exploreActivated) {
    if (actionTurnActive(state)) focusActionTurnHolder(state);
    const player = actionTurnHolder(state) || activePlayer(state);
    if (player && player.landscapeId !== tileId && canMoveTo(state, player, tileId)) {
      moveDreamer(state, tileId);
      return true;
    }
  }

  moveDreamer(state, tileId);
  const occupant = actorOnLandscape(state, tileId);
  if (occupant) {
    return { openRadial: true, playerId: occupant.id, tileId };
  }
  return false;
}

export function endPhase(state) {
  if (isDiceBattleOpen() || state.diceBattle) {
    addLog(state, "Finish the dice battle before ending the phase.");
    return;
  }
  cancelLandscapePick(state);
  cancelDreamerPower(state);
  const leaving = getPhase(state);
  if (leaving === "Reveal" && !state.dreamDrawn) {
    drawDreamCard(state);
    const block = phaseAdvanceBlockReason(state);
    if (block) {
      narrate(state, "Dream drawn", "Resolve this Dream, then Next Phase is ready.");
      return;
    }
  }
  if (leaving === "Explore") onExplorePhaseEnd(state);
  if (leaving === "Meet") onMeetPhaseEnd(state);
  advancePhase(state);
  if (leaving === "Reveal" && state.skipExploreNextRound) {
    const reason = state.skipExploreReason || "drawn Dream";
    state.skipExploreNextRound = false;
    state.skipExploreReason = null;
    logMoment(state, `Explore Phase skipped — ${reason}.`);
    onExplorePhaseEnd(state);
    advancePhase(state);
  }
  checkDefeat(state);
  const phase = getPhase(state);
  flashPhaseEntryMoments(state, phase);
  markPhasePulse();
  playSfx("phase");
  narrate(
    state,
    `${phase} Phase begins`,
    phase === "Reveal"
      ? `${COOP_PLAY_TIP} Head Dreamer (★) draws the Dream once. One Dreamer spends Lucidity to set team reveals.`
      : phase === "Explore"
        ? `${COOP_PLAY_TIP} One Dreamer spends Elasticity to unlock shared moves — then move any Dreamer.`
        : `${COOP_PLAY_TIP} One Dreamer spends Willpower to unlock shared Meet actions. Start: discard 1 Psyche per roaming Dreambeast on or beside you. End: Forget 1 random Landscape per remaining beast, then Fail costs in spawn order. Beasts stay until you win a dice battle.`,
    [],
    { moment: `${phase} Phase begins.` },
  );
}

export function getDeckTop(state, deckId) {
  switch (deckId) {
    case "dream": return state.dreamDeck[0] || null;
    case "psyche": return state.psycheDeck[0] || null;
    case "archetype": return state.archetypeDeck[0] || null;
    case "subconscious": {
      const cards = listSubconsciousCards(state);
      return cards[cards.length - 1] || null;
    }
    case "mindstream-lucidity": return state.mindstreamDecks.lucidity[0] || null;
    case "mindstream-elasticity": return state.mindstreamDecks.elasticity[0] || null;
    case "mindstream-willpower": return state.mindstreamDecks.willpower[0] || null;
    default: return null;
  }
}

export function getLegalExploreTargets(state) {
  if (getPhase(state) !== "Explore" || !state.exploreActivated) return [];
  if ((state.exploreMovesLeft || 0) < 1) return [];
  // Always highlight the Dreamer who holds the Explore turn.
  const player = actionTurnHolder(state) || activePlayer(state);
  if (player && actionTurnActive(state) && state.activePlayerIndex !== state.players.indexOf(player)) {
    focusActionTurnHolder(state);
  }
  return getLegalMoveTargets(state, player);
}

export function getPhaseHint(state) {
  const pendingPower = state.pendingDreamerPower;
  if (pendingPower?.step === "reveal-landscape" && (pendingPower.revealRemaining ?? 0) > 0) {
    return `Visionary Power: reveal ${pendingPower.revealRemaining} hidden Landscape(s) on the map.`;
  }

  const phase = getPhase(state);
  const head = headPlayer(state);
  if (phase === "Reveal") {
    const parts = [COOP_PLAY_TIP];
    if (!state.dreamDrawn) parts.push(`${head.name} (★) Draw & Resolve the Dream first.`);
    else if (!state.revealLandscapeUsed) parts.push("One Dreamer spends Lucidity for team reveals.");
    else parts.push("When reveals are spent, tap the circular Next Phase button at the top-right of the map.");
    return parts.join(" ");
  }
  if (phase === "Explore") {
    const legal = getLegalExploreTargets(state).length;
    if (!state.exploreActivated) {
      return `${COOP_PLAY_TIP} One Dreamer spends Elasticity to unlock shared moves.`;
    }
    const holder = actionTurnHolder(state);
    const turnNote = holder
      ? `${holder.name}'s turn to move — Pass or tap another Dreamer to hand them the remaining moves.`
      : "Tap a glowing hex to move.";
    return `${COOP_PLAY_TIP} ${state.exploreMovesLeft} team move(s) · ${legal} hexes reachable. ${turnNote}`;
  }
  if (phase === "Meet") {
    if (state.meetActionBudget === 0) {
      return `${COOP_PLAY_TIP} Dreamers on a beast or next door discard 1 Psyche. One Dreamer spends Willpower for shared Meet actions. Beasts still standing Forget a Landscape when Meet ends.`;
    }
    const pool = coopMeetPlayTotal(state);
    const count = allSelectedCards(state).length;
    const actionsLeft = Math.max(0, state.meetActionBudget - (state.meetActionsUsed || 0));
    const actionsTail = actionsLeft > 0
      ? ` · ${actionsLeft} action${actionsLeft === 1 ? "" : "s"} left`
      : " · Next Phase when actions are spent";
    return `${COOP_PLAY_TIP} ${state.meetActionsUsed}/${state.meetActionBudget} actions · pool ${count}/3 (${pool})${actionsTail}.`;
  }
}
