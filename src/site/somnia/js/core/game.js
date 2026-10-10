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
  markFinalArchetypeDefeated,
  acquireFinalArchetype,
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
  archetypeSpreadDice,
  meetPsycheActor,
  actorOnLandscape,
  selectedCards,
  allSelectedCards,
  selectedHasPaySuit,
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
  encounterPaySuit,
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
} from "../encounters/dreambeasts.js";
import { getLegalMoveTargets, canMoveTo, adjacentTiles, hexDistance, areHexAdjacent } from "./hex.js";
import { repressCard, listSubconsciousCards, dreambeastToHandCard, isDreambeastPsycheCard } from "../dreamers/subconscious.js";
import { queueCardTrade } from "../cards/card-fx.js";
import { random } from "./rng.js";
import { getDreamResolution } from "../cards/dream-resolutions.js";
import { applyResolutionEffect } from "../effects/resolution-effects.js";
import { spendPowerTokens, grantPowerTokens, playPsychePowerFromHand } from "../cards/power-tokens.js";
import {
  beginDreamerPower,
  cancelDreamerPower,
  hasPendingDreamerPower,
  handleDreamerPowerTilePick,
  canActivateDreamerPower,
  recordCancellableDiscard,
  recordCancellableMove,
} from "../dreamers/dreamer-powers.js";
import { playObjectCard, applySkeletonKeyAfterDream, drawObjects, handLimitForPlayer, handRoomForPsycheDraw } from "../effects/objects.js";
import { isBossDreamCard } from "../cards/dream-deck.js";
import { resumeObjectEffect } from "../effects/object-effects.js";
import { hasPsycheHealth, allyHandCount, isWildPsyche, isTradablePsyche, TRADE_OFFER_LIMIT } from "../cards/psyche.js";
import { queueDreamDrawFx, queueMeetFlashFx, queuePsycheSwirlFx, queueDreamerPowerFx, queueArchetypePowerFx, queueAcceptAllyFx } from "../board/board-fx.js";
import { resolveOnAcquire, useArchetypePower, handleArchetypePowerTilePick } from "../dreamers/archetypes.js";
import { getActivatableArchetypePowers } from "../dreamers/archetype-stats.js";
import { offerEffectChoice, registerEffectResolver } from "../effects/effect-choices.js";
import { isQuestConditionMet, meetQuestLandscapeIds } from "../dreamers/quests.js";
import {
  getLandscapeActionChoices,
  getUniqueLandscapeActionChoices,
  canDrawMindstreamOnLandscape,
  executeLandscapeActionChoice,
  resolveLandscapeMindstreamPick,
  flipTopThreeOfDeck,
} from "../board/landscape-actions.js";
import {
  pullDreambeastFromMindstream,
  drawTwoDreambeasts,
  encounterFromDreambeastCard,
  discardToMindstream,
} from "../cards/mindstream-supply.js";
import { beginTransformationPick } from "../cards/dream-choices.js";
import { beginRevealPicking, handleLandscapeTilePick, cancelLandscapePick, requestChooseTile, spendRevealOnMindstreamTop } from "../board/landscapes.js";
import { narrate, logMoment } from "./narrator.js";
import { flashPhaseEntryMoments } from "../ui/moment-overlay.js";
import { playSfx } from "../audio/audio.js";
import { markPhasePulse, markDreamFeedNudge, playPhaseSpendFlash } from "../ui/fx.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { COOP_PLAY_TIP } from "../meta/guide.js";
import { notifyTutorialEncounterResolved, classifyPhaseAction, exploreMoveLockActive } from "../tutorial/tutorial-mode.js";
import {
  resolveCardEffect,
  createEffectHelpers,
  sacrificeAcquiredForFinal,
  canSpendMeetAction,
  onExploreMove,
  onExplorePhaseEnd,
  onMeetPhaseEnd,
} from "../effects/effects.js";
import { playDiceBattle, isDiceBattleOpen } from "../encounters/dice-battle.js";
import {
  FINAL_ARCHETYPE_POWER,
  archetypeSpreadOpen,
  undefeatedFinalArchetypes,
} from "../dreamers/final-recurrence-rules.js";

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

/** Dreamer who may act. Their board portrait opens the action radial on every phase. */
export function actingDreamerId(state) {
  const holder = actionTurnHolder(state);
  if (holder) return holder.id;
  if (exploreMoveLockActive(state)) return activePlayer(state)?.id || null;
  return null;
}

/**
 * Click on a Dreamer portrait.
 * The acting Dreamer's own portrait always opens the radial, including while
 * Explore treats the rest of the board as move targets.
 */
export function dreamerPortraitClickIntent({
  moveLock = false,
  dreamerId = null,
  actingId = null,
  hexIsLegalMove = false,
} = {}) {
  if (dreamerId && actingId && dreamerId === actingId) return "radial";
  if (moveLock && hexIsLegalMove) return "move";
  if (moveLock && dreamerId) return "walker";
  if (dreamerId) return "radial";
  return "hex";
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
export function seatMeetPassToken(state, openerId) {
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

function excessBudgetLeft(state) {
  const phase = getPhase(state);
  if (phase === "Explore" && state.exploreActivated) return state.exploreMovesLeft || 0;
  if (phase === "Meet" && (state.meetActionBudget || 0) > 0) {
    return Math.max(0, (state.meetActionBudget || 0) - (state.meetActionsUsed || 0));
  }
  if (phase === "Reveal") {
    const pick = state.landscapePick;
    const revealBudgetOpen = pick
      && !pick.freeReveal
      && (pick.mode === "reveal" || pick.mode === "reveal-deck-tops")
      && (pick.remaining || 0) > 0;
    if (revealBudgetOpen) return pick.remaining;
  }
  return 0;
}

function excessNoun(phase) {
  if (phase === "Explore") return "move";
  if (phase === "Meet") return "Meet action";
  return "Reveal";
}

/** Spend 1 shared Reveal, move, or Meet action so the turn holder draws 1 Psyche. */
export function spendExcessPsycheDraw(state, { quiet = false } = {}) {
  const tutorialLesson = !!(state.tutorialMode && state.tutorialFlags?.excessPsycheLesson);
  if (state.tutorialMode && !tutorialLesson) return false;
  const phase = getPhase(state);
  if (excessBudgetLeft(state) < 1) return false;
  const holder = actionTurnHolder(state) || activePlayer(state);
  if (!holder) return false;
  if (!quiet && meetPassBlocks(state, activePlayer(state))) {
    addLog(state, `It is ${actionTurnHolder(state)?.name || "another Dreamer"}'s turn to draw.`);
    return false;
  }

  if (phase === "Explore") {
    state.exploreMovesLeft = Math.max(0, (state.exploreMovesLeft || 0) - 1);
  } else if (phase === "Meet") {
    state.meetActionsUsed = (state.meetActionsUsed || 0) + 1;
  } else if (phase === "Reveal") {
    const pick = state.landscapePick;
    pick.remaining -= 1;
    if (pick.remaining <= 0) {
      const revealedCount = (pick.picked || []).length;
      if (!pick.freeReveal) state.revealLandscapeUsed = true;
      state.landscapePick = null;
      if (revealedCount) recordQuestEvent(state, "reveal_landscape", { count: revealedCount });
    }
  } else {
    return false;
  }

  const before = (state.psycheDeck?.length || 0) + (state.psycheDiscard?.length || 0);
  const drawn = drawPsycheForPlayer(state, holder, 1);
  const card = drawn[0];
  const noun = excessNoun(phase);
  if (card) {
    addLog(state, `${holder.name} spends 1 unused ${noun} and draws ${card.name || "a Psyche card"}.`);
    if (tutorialLesson && state.tutorialFlags) state.tutorialFlags.excessPsycheDrawn = true;
  } else if (before < 1) {
    addLog(state, `${holder.name} spends 1 unused ${noun}, but the Psyche deck is empty.`);
  } else {
    addLog(state, `${holder.name} spends 1 unused ${noun}, but their hand is full.`);
  }

  if (!quiet) afterSharedBudgetSpend(state);
  else if (!actionTurnActive(state)) clearActionTurn(state);
  else {
    const next = nextLivingClockwise(state, state.meetPassHolderId);
    if (next && next.id !== state.meetPassHolderId) {
      state.meetPassHolderId = next.id;
      focusActionTurnHolder(state);
    }
  }
  return true;
}

/** Turn every unused phase action into a Psyche draw, one Dreamer at a time. */
export function convertExcessActionsToPsyche(state) {
  if (state.tutorialMode) return 0;
  const phase = getPhase(state);
  const start = excessBudgetLeft(state);
  if (start < 1) return 0;
  let drawn = 0;
  let guard = start + 2;
  while (guard-- > 0 && excessBudgetLeft(state) > 0) {
    if (!spendExcessPsycheDraw(state, { quiet: true })) break;
    drawn += 1;
  }
  if (drawn) {
    const noun = excessNoun(phase);
    logMoment(
      state,
      `${drawn} unused ${noun}${drawn === 1 ? "" : "s"} drew Psyche, one card at a time around the table.`,
    );
  }
  return drawn;
}

function excessPsycheAction(state) {
  const tutorialLesson = !!(state.tutorialMode && state.tutorialFlags?.excessPsycheLesson);
  if ((state.tutorialMode && !tutorialLesson) || excessBudgetLeft(state) < 1) return null;
  const holder = actionTurnHolder(state);
  const player = activePlayer(state);
  const blocked = !!(holder && player && holder.id !== player.id);
  const noun = excessNoun(getPhase(state));
  return {
    label: "Draw 1 Psyche",
    kind: "excessPsyche",
    section: "actions",
    primary: true,
    hint: blocked
      ? `It is ${holder.name}'s turn.`
      : `Spend 1 unused ${noun} to draw 1 Psyche. The next Dreamer clockwise takes the next action.`,
    disabled: blocked,
    onClick: () => spendExcessPsycheDraw(state),
  };
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
    hint: `Skip your turn. The next Dreamer clockwise may spend the remaining shared ${noun}. Or open another Dreamer's radial and choose Give Turn.`,
    onClick: () => passMeetToken(state),
  };
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

/** Free Accept/Repress after drawing a Dreambeast onto your own hex from the Mindstream. */
export function isMindstreamMeetPrep(state, actor = null) {
  const pending = state.pendingMindstreamMeet;
  if (!pending?.landscapeId) return false;
  const person = actor || meetActionActor(state, MEET_ACTIONS.MEET);
  return !!person
    && person.landscapeId === pending.landscapeId
    && (!pending.playerId || person.id === pending.playerId)
    && !!encounterOnLandscape(state, pending.landscapeId);
}

function isFreeMeet(state, action, actor = null) {
  if (action !== MEET_ACTIONS.MEET) return false;
  return isFreeQuestMeet(state, action) || isMindstreamMeetPrep(state, actor);
}

function canUseMeetActionForActor(state, actor, action, landscapeActionId = null) {
  if (!actor) return false;
  const freeMeet = isFreeMeet(state, action, actor);
  if (!freeMeet && meetPassBlocks(state, actor)) return false;
  if (!canSpendMeetAction(state, actor, action, MEET_ACTIONS)) return false;
  if (landscapeActionId !== "draw-mindstream" && hasUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId))) return false;
  if (!freeMeet && state.meetActionsUsed >= state.meetActionBudget) return false;
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

/** Why this Dreamer cannot Meet on this Landscape, or "" when they can. */
export function dreamerMeetBlockReason(state, player, tileId) {
  if (!player?.alive || player.landscapeId !== tileId) return "Stand on this Landscape to Meet.";
  const enc = encounterOnLandscape(state, tileId);
  if (!enc) return "No Dreambeast on this Landscape.";
  if (getPhase(state) !== "Meet") return "Meet happens in the Meet phase.";
  const freeMeet = (state.freeQuestMeet?.landscapeId === tileId && player.landscapeId === tileId)
    || (state.pendingMindstreamMeet?.landscapeId === tileId
      && player.landscapeId === tileId
      && (!state.pendingMindstreamMeet.playerId || state.pendingMindstreamMeet.playerId === player.id))
    || !!(state.forcedAccept && player.id === state.forcedAccept.playerId && tileId === state.forcedAccept.tileId);
  if (!freeMeet && (state.meetActionBudget < 1 || state.meetActionsUsed >= state.meetActionBudget)) {
    return "No Meet actions remaining.";
  }
  if (!freeMeet && meetPassBlocks(state, player)) {
    const holder = state.players.find((p) => p.id === state.meetPassHolderId);
    return `It is ${holder?.name || "another Dreamer"}'s turn.`;
  }
  if (hasUsedMeetAction(state, player, meetActionKey(MEET_ACTIONS.MEET))) {
    return `${player.name} already used Meet this round.`;
  }
  if (!canSpendMeetAction(state, player, MEET_ACTIONS.MEET, MEET_ACTIONS)) {
    return "This Meet action is restricted right now.";
  }
  return "";
}

export function canDreamerMeetOnLandscape(state, player, tileId) {
  if (!player?.alive || player.landscapeId !== tileId) return false;
  const enc = encounterOnLandscape(state, tileId);
  if (state.forcedAccept && player.id === state.forcedAccept.playerId && tileId === state.forcedAccept.tileId) {
    return !!enc;
  }
  const freeMeet = (state.freeQuestMeet?.landscapeId === tileId && player.landscapeId === tileId)
    || (state.pendingMindstreamMeet?.landscapeId === tileId
      && player.landscapeId === tileId
      && (!state.pendingMindstreamMeet.playerId || state.pendingMindstreamMeet.playerId === player.id));
  if (!enc || getPhase(state) !== "Meet") return false;
  if (!freeMeet && (state.meetActionBudget < 1 || state.meetActionsUsed >= state.meetActionBudget)) return false;
  if (!freeMeet && meetPassBlocks(state, player)) return false;
  if (hasUsedMeetAction(state, player, meetActionKey(MEET_ACTIONS.MEET))) return false;
  return canSpendMeetAction(state, player, MEET_ACTIONS.MEET, MEET_ACTIONS);
}

function meetActionHint(state, action, landscapeActionId, baseHint = "") {
  const actor = meetActionActor(state, action);
  if (!actor) return "A Dreamer must stand on this Landscape.";
  const freeMeet = isFreeMeet(state, action, actor);
  if (!freeMeet && meetPassBlocks(state, actor)) {
    const holder = state.players.find((p) => p.id === state.meetPassHolderId);
    return `It is ${holder?.name || "another Dreamer"}'s turn.`;
  }
  if (!freeMeet && state.meetActionsUsed >= state.meetActionBudget) return "No Meet actions remaining.";
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
    logMoment(state, meetActionHint(state, action, landscapeActionId, "Cannot use this Meet action (restricted or no actions remain)."));
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
    // Free meets still rotate the token on spend — put it back on the spender.
    restoreActionTurnTo(state, player);
    return;
  }
  state.meetActionsUsed = Math.max(0, state.meetActionsUsed - 1);
  if (action) unmarkUsedMeetAction(state, player, meetActionKey(action, landscapeActionId));
  // spendMeetAction already passed (or cleared) the token — restore the spender.
  restoreActionTurnTo(state, player);
}

/** Put the shared Meet turn back on the Dreamer who attempted a refunded spend. */
function restoreActionTurnTo(state, player) {
  if (!player?.alive || tutorialSuppressesMeetPass(state)) return;
  if (getPhase(state) !== "Meet") return;
  if ((state.meetActionBudget || 0) < 1) return;
  if (state.meetActionsUsed >= state.meetActionBudget) return;
  state.meetPassHolderId = player.id;
  focusActionTurnHolder(state);
}

/** After spending shared Explore/Meet budget outside spendMeetAction, pass or clear. */
function afterSharedBudgetSpend(state) {
  if (!state.meetPassHolderId || tutorialSuppressesMeetPass(state)) return;
  if (!actionTurnActive(state)) {
    clearActionTurn(state);
    return;
  }
  passMeetToken(state);
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
    const excessOpen = !!state.landscapePick?.excessOnly || state.landscapePick?.mode === "reveal-deck-tops";
    const remFreeReveal = !!state.seedFlags?.rem && !state.remFree?.reveal && !state.revealLandscapeUsed && !excessOpen;
    actions.push({
      label: excessOpen
        ? `Draw Psyche (${state.landscapePick.remaining} left)`
        : mapOpen
          ? (budget >= 1 ? `Spend Lucidity (${budget} Psyche draws)` : "Spend Lucidity (select cards)")
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
          : excessOpen
            ? "Each leftover Reveal draws 1 Psyche. The turn passes clockwise after every card."
            : mapOpen
              ? "The map is fully Revealed. Lucidity now draws Psyche, one card at a time around the table."
              : best
                ? `One Dreamer spends 1 Lucidity — ${best.name} adds +${totalStat(best, stat, state)} (best bonus). Unused Reveals draw 1 Psyche each.`
                : "One Dreamer spends Lucidity to set everyone's reveal budget.",
      section: "main",
      disabled: !state.dreamDrawn || state.revealLandscapeUsed || !!state.landscapePick || (budget < 1 && !remFreeReveal),
      onClick: handlers.revealLandscape,
    });
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
      undefeatedFinalArchetypes(onTile).forEach((arch) => {
        const dice = archetypeSpreadDice(state, arch.id);
        actions.push({
          label: `Defeat ${arch.name} (${dice}d6 vs ${FINAL_ARCHETYPE_POWER})`,
          kind: "defeatFinalArchetype",
          section: "encounter",
          disabled: !canUseMeetAction(state, MEET_ACTIONS.MEET),
          hint: meetActionHint(
            state,
            MEET_ACTIONS.MEET,
            null,
            `Pool up to 3 Psyche from any hand, including ${SUIT_LABELS[arch.suit] || arch.suit}. Win the dice against Power ${FINAL_ARCHETYPE_POWER} to Acquire ${arch.name}.`,
          ),
          onClick: () => handlers.defeatFinalArchetype?.(arch.id),
        });
      });
    }
    const meetTile = meetLandscapeTile(state);
    const meetEnc = encounterForMeet(state);
    if (meetEnc && !state.finalRecurrence) {
      const payHint = encounterPayHint(meetEnc, true);
      const slumberOnly = isLeviathanCard(meetEnc);
      const preferReject = state.pendingMindstreamMeet?.preferredMode === "reject";
      const prepHint = state.pendingMindstreamMeet
        ? " Select Psyche in your hand, then confirm."
        : "";
      if (!slumberOnly) actions.push({
        label: `${encounterPowerLabel(meetEnc, true)} — ${encounterAcceptSummary(meetEnc)}`,
        kind: "meetAccept",
        section: "encounter",
        hint: meetActionHint(
          state,
          MEET_ACTIONS.MEET,
          null,
          [payHint, meetEnc.effect ? `Effect: ${meetEnc.effect}` : encounterAcceptSummary(meetEnc)].filter(Boolean).join(" ") + prepHint,
        ),
        primary: !preferReject,
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
            [encounterPayHint(meetEnc, false), encounterRejectSummary(meetEnc)].filter(Boolean).join(" ") + prepHint,
          ),
          primary: preferReject,
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

  const excess = excessPsycheAction(state);
  if (excess) actions.push(excess);

  return actions;
}

function phaseAdvanceBlockReason(state) {
  if (isDiceBattleOpen() || state.diceBattle) return "Finish the dice battle before advancing.";
  if (state.pendingRepress) return "Complete Repress selection before advancing.";
  if (state.pendingReturn) return "Complete Return selection before advancing.";
  if (state.pendingDreamReplay) return "Replay a Dream from the discard before advancing.";
  if (state.pendingDeathChoice) return "Resolve the death choice before advancing.";
  if (state.pendingNothingChoice) return "Resolve the Nothing Object choice before advancing.";
  if (state.pendingObjectChoice) return "Choose an Object effect before advancing.";
  if (state.pendingDreamChoice || state.pendingDreamQueue?.length) return "Choose a Dream effect before advancing.";
  if (state.pendingMindstreamChoice) return "Choose Bright or Dim on the open card before advancing.";
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
  const leftover = excessBudgetLeft(state);
  const noun = excessNoun(getPhase(state));
  const action = {
    label,
    section: "phase",
    advance: true,
    primary: true,
    tint: upcomingPhaseTint(state),
    budgetExhausted: spent,
    hint: spent
      ? `${label} — actions spent. Advance when ready.`
      : leftover > 0
        ? `${label} — ${leftover} unused ${noun}${leftover === 1 ? "" : "s"} draw Psyche around the table.`
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
    ? (/Psyche draws/i.test(action.label) ? "Draw Psyche" : "Reveal Landscapes")
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
  "excessPsyche",
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
  "excessPsyche",
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

  const boss = isBossDreamCard(card);
  narrate(
    state,
    `Additional Dream: ${card.name}`,
    card.text || "The Dreamscape shifts again.",
    boss
      ? [`${card.name} awakens on The Bed`]
      : ["Resolve this Dream effect before continuing"],
  );

  resolveCardEffect(state, card, head, getEffectHelpers());

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

  resolveCardEffect(state, card, head, getEffectHelpers());
  if (isBossDreamCard(card) && state.tutorialFlags) state.tutorialFlags.bossDrawn = true;

  checkDefeat(state);
  applySkeletonKeyAfterDream(state);
  playSfx("dream");
  queueDreamDrawFx(card);
  if (onShowModal) onShowModal(card);
  return card;
}

/**
 * Round 1 draws its Dream before anyone acts. A seeded 1d6 picks the path:
 * even opens Bright, odd opens Dim. The die is the choice, so Bright's usual
 * toll is not charged and no one is asked. Later Dreams still offer the choice.
 */
export function resolveOpeningDream(state, helpers = {}) {
  if (!state || state.tutorialMode || state.openingOmen || state.dreamDrawn) return null;
  const head = headPlayer(state);
  if (!head) return null;

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

  if (isBossDreamCard(card)) {
    resolveCardEffect(state, card, head, getEffectHelpers());
    state.openingOmen = {
      name: card.name,
      roll: null,
      side: "boss",
      label: "awakens on The Bed",
      hint: "",
    };
    addLog(state, `${head.name} (Head ★) draws the opening Dream: ${card.name}. It awakens on The Bed.`);
    logMoment(state, `${card.name} awakens before the night begins.`);
    checkDefeat(state);
    return card;
  }

  const roll = 1 + Math.floor(random() * 6);
  const sideId = roll % 2 === 0 ? "good" : "bad";
  const resolution = getDreamResolution(card.refId || card.id);
  const side = resolution?.[sideId];
  const sideWord = sideId === "good" ? "Bright" : "Dim";

  state.openingOmen = {
    name: card.name,
    roll,
    side: sideId,
    label: side?.label || sideWord,
    hint: side?.hint || "",
  };
  card.resolutionSide = sideId;
  card.resolutionLabel = side?.label || sideWord;

  addLog(state, `${head.name} (Head ★) draws the opening Dream: ${card.name}.`);
  if (side) {
    state.openingFateAuto = true;
    try {
      applyResolutionEffect(state, head, side, helpers, sideId);
    } finally {
      state.openingFateAuto = false;
    }
    logMoment(state, `${card.name} opens ${sideWord}: ${side.label}. The die showed ${roll}.`);
    addLog(state, `Opening die ${roll} (${roll % 2 === 0 ? "even" : "odd"}) — ${card.name} resolves ${sideWord}. ${side.label}.`);
  } else {
    logMoment(state, `${card.name} opens ${sideWord}. The die showed ${roll}.`);
    addLog(state, `Opening die ${roll} (${roll % 2 === 0 ? "even" : "odd"}) — ${card.name} resolves ${sideWord}.`);
  }

  checkDefeat(state);
  applySkeletonKeyAfterDream(state);
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
    narrate(state, "Select Lucidity or 1 Power Token", `Play 1 blue Psyche from ${player.name}, or spend 1 Power Token as 1 + Lucidity ${totalStat(player, "lucidity", state)}.`);
    return;
  }

  const lucidityDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, lucidityDiscarded);
  if (consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 + Lucidity ${totalStat(player, "lucidity", state)}.`);
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

  const elaCards = player ? selectedBySuit(state, player, "elasticity") : [];

  const tokenValue = player ? phaseTokenValue(state, player) : 0;
  if (!freeRound && (elaCards.length > PHASE_OPENER_MAX_CARDS || (elaCards.length < 1 && tokenValue < 1))) {
    addLog(state, `Play 1 ${SUIT_LABELS.elasticity} Psyche card, or spend 1 Power Token as 1 + Elasticity ${totalStat(player, "elasticity", state)}.`);
    return;
  }

  if (elaCards.length) {
    const discarded = discardSelected(state, player);
    trackPsycheDiscard(state, player, discarded);
  }
  if (player && consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 + Elasticity ${totalStat(player, "elasticity", state)}.`);
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
  // Move the turn holder without snapping camera/focus away from a viewed Dreamer.
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
      addLog(state, `It is ${holder?.name || "another Dreamer"}'s turn to move. Pass Turn or Give Turn.`);
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
    seatMeetPassToken(state, activePlayer(state)?.id);
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
  const budget = meetActionBudgetFromWillpower(state, player);
  const wilCards = selectedBySuit(state, player, "willpower");

  const tokenValue = phaseTokenValue(state, player);
  if (wilCards.length > PHASE_OPENER_MAX_CARDS || (wilCards.length < 1 && tokenValue < 1)) {
    addLog(state, `Play 1 ${SUIT_LABELS.willpower} Psyche card from ${player.name}, or spend 1 Power Token as 1 + Willpower ${totalStat(player, "willpower", state)}.`);
    return;
  }

  const wilDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, wilDiscarded);
  if (consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 + Willpower ${totalStat(player, "willpower", state)}.`);
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
    addLog(state, "Spend 1 Power Token as 1 + this Dreamer's suited stat (instead of a Psyche card).");
    return;
  }
  state.phaseTokenAsPsyche = player.id;
  const suit = phaseSuitForOpening(getPhase(state));
  const bonus = suit ? totalStat(player, suit, state) : 0;
  addLog(state, `${player.name} will spend 1 Power Token as 1 + ${SUIT_LABELS[suit] || "Psyche"} ${bonus}.`);
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
  // Viewing another Dreamer: offer an explicit Give Turn (tapping alone no longer passes).
  if (
    player?.alive
    && actionTurnActive(state)
    && actionTurnHolder(state)
    && actionTurnHolder(state).id !== player.id
    && !tutorialSuppressesMeetPass(state)
  ) {
    const phase = getPhase(state);
    const noun = phase === "Explore" ? "moves" : phase === "Meet" ? "actions" : "reveals";
    options.push({
      id: "giveTurn",
      label: "Give Turn",
      kind: "meetPass",
      hint: `Hand the remaining shared ${noun} to ${player.name}.`,
      primary: true,
      onPick: () => passActionTurnTo(state, player.id),
    });
  }
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
    label: phaseOn ? `Cancel ${suitLabel}` : `1 + ${suitLabel}`,
    hint: phaseOn
      ? "Stop using a Power Token to open this phase."
      : "Spend 1 Power Token as 1 plus this Dreamer's suited stat (instead of a Psyche card).",
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

/** Auto-pick a legal Psyche spread for bots / instant Mindstream meets. */
function autoSelectMeetSpread(state, mode = "accept") {
  const actor = meetActionActor(state, MEET_ACTIONS.MEET) || activePlayer(state);
  const encounter = encounterForMeet(state) || encounterOnLandscape(state, actor?.landscapeId);
  if (!actor || !encounter) return false;
  const accept = mode !== "reject" && mode !== "repress";
  const paySuit = encounterPaySuit(encounter, accept);
  const candidates = (actor.hand || []).filter((card) => (
    card
    && card.type !== "psyche-power"
    && card.type !== "object"
    && !isDreambeastPsycheCard(card)
  ));
  if (!candidates.length) return false;
  const suited = paySuit
    ? candidates.filter((card) => isWildPsyche(card) || card.suit === paySuit)
    : candidates;
  const pick = [];
  if (suited[0]) pick.push(suited[0]);
  for (const card of candidates) {
    if (pick.length >= 3) break;
    if (!pick.some((c) => c.instanceId === card.instanceId)) pick.push(card);
  }
  state.selectedHand = pick.map((card) => card.instanceId);
  return pick.length > 0;
}

/**
 * After drawing a Dreambeast onto your hex: open the Meet hand to build a spread,
 * then Accept / Repress for free. Bots resolve instantly.
 */
export function prepareMindstreamMeet(state, {
  mode = "accept",
  landscapeId,
  playerId,
  instant = false,
  meetEncounterFn = null,
  onDone = null,
} = {}) {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex >= 0) state.activePlayerIndex = playerIndex;
  if (landscapeId) {
    state.selectedLandscapeId = landscapeId;
    state.activeEncounterLandscapeId = landscapeId;
    const enc = encounterOnLandscape(state, landscapeId);
    if (enc) state.activeEncounter = enc;
  }
  if (actionTurnActive(state) && playerId) {
    state.meetPassHolderId = playerId;
    focusActionTurnHolder(state);
  }

  if (instant && typeof meetEncounterFn === "function") {
    autoSelectMeetSpread(state, mode);
    meetEncounterFn(state, mode, {
      freeMeet: true,
      fromMindstreamDraw: true,
      instant: true,
      onDone,
    });
    return true;
  }

  state.pendingMindstreamMeet = {
    landscapeId,
    playerId,
    preferredMode: mode === "reject" || mode === "repress" ? "reject" : "accept",
  };
  state.selectedHand = [];
  const beastName = encounterOnLandscape(state, landscapeId)?.name || "the Dreambeast";
  const verb = mode === "reject" || mode === "repress" ? "Repress" : "Accept";
  addLog(state, `Choose Psyche for your spread, then ${verb} ${beastName}.`);
  logMoment(state, `${beastName} — select Psyche, then ${verb}.`);
  return true;
}

export function meetEncounter(state, mode = "accept", { instant = false, onDone, freeMeet = false, fromMindstreamDraw = false } = {}) {
  const say = (message) => {
    if (message) logMoment(state, message);
  };
  if (isDiceBattleOpen() || state.diceBattle) {
    say("Finish the dice battle first.");
    return;
  }
  if (state.forcedAccept) {
    state.selectedLandscapeId = state.forcedAccept.tileId;
    if (mode !== "accept") {
      say("Silver: this Dreambeast must be Accepted. It cannot be Repressed.");
      return;
    }
  }
  const tile = meetLandscapeTile(state);
  const encounter = encounterForMeet(state);
  if (!encounter || !tile) {
    say("Meet a Dreambeast on a Landscape you occupy.");
    return;
  }
  const actorEarly = actorOnLandscape(state, tile.id);
  // Mindstream-on-hex prep is free (no Meet action). Quest free-meets still go through spendMeetAction.
  const freeFromMindstreamPrep = isMindstreamMeetPrep(state, actorEarly);
  const treatAsFree = !!freeMeet || freeFromMindstreamPrep || !!state.forcedAccept;
  const fromMs = !!fromMindstreamDraw || !!state.pendingMindstreamMeet || !!encounter.drawnFromMindstream;

  state.activeEncounter = encounter;
  state.activeEncounterLandscapeId = tile.id;
  const actor = actorOnLandscape(state, tile.id);
  if (!actor) {
    say("A Dreamer must be on this Landscape to Meet the Encounter.");
    return;
  }
  const isReject = mode === "reject" || mode === "repress";
  const verb = isReject
    ? (isLeviathanCard(encounter) ? "Slumber" : "Repress")
    : "Accept";
  if (!isReject && isLeviathanCard(encounter)) {
    say("Leviathan is Awake. The only Meet is Slumber: play Willpower, win the dice, and it flips Asleep into the Subconscious.");
    return;
  }
  const beastPower = encounterPower(encounter, !isReject);
  const recommended = recommendedEncounterPower(encounter, !isReject);
  const selected = selectedCards(state, actor);
  const suitName = SUIT_LABELS[encounterPaySuit(encounter, !isReject)] || "Psyche";

  if (!isReject) {
    const limit = handLimitForPlayer(state, actor);
    const staying = actor.hand.filter((c) => !selected.some((s) => s.instanceId === c.instanceId)).length;
    if (staying >= limit) {
      say(`${actor.name}'s hand is full (${limit} cards). Spend Psyche or allies first.`);
      return;
    }
  }

  if (selected.filter((c) => !isDreambeastPsycheCard(c)).length > 3) {
    say("Play up to 3 Psyche cards for an Encounter (allies don't count).");
    return;
  }

  if (!selected.length) {
    const foreign = allSelectedCards(state);
    say(foreign.length
      ? `${verb} uses ${actor.name}'s Psyche. Select at least 1 ${suitName} from ${actor.name}'s hand.`
      : `${verb} ${encounter.name}: select 1–3 Psyche from ${actor.name}'s hand, including at least 1 ${suitName}.`);
    return;
  }

  const shapeCheck = validateEncounterPlayShape(encounter, selected, { accept: !isReject });
  if (!shapeCheck.ok) {
    say(shapeCheck.message);
    return;
  }

  // Spread is legal. Spend only now, so a bad Slumber does not pass the turn.
  if (!state.forcedAccept && !treatAsFree && !spendMeetAction(state, MEET_ACTIONS.MEET)) return;
  // Spread is locked in — clear Mindstream prep before dice.
  if (state.pendingMindstreamMeet?.landscapeId === tile.id) state.pendingMindstreamMeet = null;
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
    fromMindstreamDraw: fromMs,
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
    queueAcceptAllyFx(actor.id, tile.id, handCard);
    addLog(state, `${encounter.name} joins ${actor.name}'s hand as a 3 ${SUIT_LABELS[encounter.suit] || encounter.suit} Psyche ally.`);
    const suitLabel = SUIT_LABELS[encounter.suit] || encounter.suit || "suited";
    const reward = drawObjects(state, actor, 1, getEffectHelpers(), encounter.suit);
    if (reward.length) {
      logMoment(state, `${actor.name} draws ${reward[0].name} from the ${suitLabel} Object deck.`);
    } else {
      logMoment(state, `The ${suitLabel} Object deck is empty.`);
    }
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

export function handleDefeatFinalArchetype(state, archetypeId = null, onDone = null) {
  const say = (message) => logMoment(state, message);
  if (isDiceBattleOpen() || state.diceBattle) {
    say("Finish the dice battle first.");
    return;
  }
  if (getPhase(state) !== "Meet" || !(state.meetActionBudget > 0)) {
    say(`Open Meet, stand on the Archetype, and pool up to 3 Psyche. Then fight Power ${FINAL_ARCHETYPE_POWER}.`);
    return;
  }
  const tile = landscapeById(state, state.selectedLandscapeId);
  const waiting = undefeatedFinalArchetypes(tile);
  const arch = archetypeId
    ? waiting.find((entry) => entry.id === archetypeId) || null
    : waiting[0];
  if (!arch) {
    say("Select a Landscape with an undefeated Remaining Archetype.");
    return;
  }
  const actor = actorOnLandscape(state, tile.id);
  if (!actor) {
    say(`A Dreamer must stand on ${tile.name} to Meet ${arch.name}.`);
    return;
  }
  const selected = allSelectedCards(state);
  const psyche = selected.filter((card) => !isDreambeastPsycheCard(card) && card.type !== "psyche-power");
  const suitName = SUIT_LABELS[arch.suit] || arch.suit || "matching";
  if (!selected.length) {
    say(`Pool 1–3 Psyche from any hand, including ${suitName}, then Defeat ${arch.name} (Power ${FINAL_ARCHETYPE_POWER}).`);
    return;
  }
  if (psyche.length > 3) {
    say("Play up to 3 Psyche. Allies do not count toward that limit.");
    return;
  }
  if (!selectedHasPaySuit(selected, arch.suit)) {
    say(`The spread needs at least 1 ${suitName} Psyche to Meet ${arch.name}.`);
    return;
  }
  if (!spendMeetAction(state, MEET_ACTIONS.MEET)) return;

  const played = Math.max(1, archetypeSpreadDice(state));
  addLog(state, `${actor.name} Power ${played}d6 vs ${arch.name} Power ${FINAL_ARCHETYPE_POWER}d6.`);

  const finish = (dreamerWins) => {
    state.diceBattle = null;
    const spent = discardAllSelected(state);
    spent.forEach(({ player: owner, cards }) => trackPsycheDiscard(state, owner, cards));
    if (!dreamerWins) {
      addLog(state, `${actor.name} loses the dice battle with ${arch.name}. The spread is spent. ${arch.name} remains.`);
      logMoment(state, `${arch.name} holds the Landscape.`);
      onDone?.();
      return;
    }
    markFinalArchetypeDefeated(state, arch.id);
    const acquired = acquireFinalArchetype(state, actor, arch);
    if (acquired) resolveOnAcquire(state, acquired, actor);
    logMoment(state, `${arch.name} is Acquired. Its power is ready.`);
    checkVictory(state);
    onDone?.();
  };

  const forceInstant = typeof document === "undefined" || !!globalThis.__SOMNIA_INSTANT_DICE__;
  if (forceInstant) {
    finish(true);
    return;
  }

  state.diceBattle = { archetypeId: arch.id, tileId: tile.id };
  playDiceBattle({
    dreamerName: actor.name,
    beastName: arch.name,
    dreamerDice: played,
    beastDice: FINAL_ARCHETYPE_POWER,
    allowPostRollToken: (actor.powerTokens || 0) > 0,
    onPostRoll: () => {
      if (!spendPowerTokens(state, actor, 1, { animate: false })) return false;
      addLog(state, `${actor.name} spends 1 Power Token to subtract 1 Archetype success.`);
      return true;
    },
    onComplete: ({ dreamerWins }) => finish(dreamerWins),
  });
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
    const tableSpread = archetypeSpreadOpen(state);
    const actor = meetPsycheActor(state);
    if (!tableSpread && (!actor || player.id !== actor.id)) {
      if (actor) logMoment(state, `Meet uses ${actor.name}'s Psyche.`);
      return;
    }
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
    const tableSpread = archetypeSpreadOpen(state);
    const actor = meetPsycheActor(state);
    if (!tableSpread && (!actor || player.id !== actor.id)) {
      if (actor) logMoment(state, `Meet uses ${actor.name}'s Psyche.`);
      return;
    }
    if (!tableSpread) {
      state.selectedHand = state.selectedHand.filter((selId) =>
        actor.hand.some((c) => c.instanceId === selId),
      );
    }
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
  convertExcessActionsToPsyche(state);
  cancelLandscapePick(state);
  cancelDreamerPower(state);
  clearActionTurn(state);
  state.pendingMindstreamMeet = null;
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
        ? `${COOP_PLAY_TIP} One Dreamer spends Elasticity to unlock shared moves — then Dreamers take turns spending them (Pass Turn or Give Turn to hand off).`
        : `${COOP_PLAY_TIP} One Dreamer spends Willpower to unlock shared Meet actions. Start: discard 1 Psyche per roaming Dreambeast on or beside you. End: Forget 1 random Landscape per remaining beast. Fail hits when Accept, Repress, or Flee fails. Beasts stay until you win a dice battle.`,
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
  // Highlights for the turn holder — do not mutate focus (viewing another Dreamer is allowed).
  const player = actionTurnHolder(state) || activePlayer(state);
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
      ? `${holder.name}'s turn to move — Pass Turn, or Give Turn on another Dreamer's radial.`
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
    const holder = actionTurnHolder(state);
    const turnNote = holder && actionsLeft > 0
      ? ` · ${holder.name}'s turn`
      : "";
    const actionsTail = actionsLeft > 0
      ? ` · ${actionsLeft} action${actionsLeft === 1 ? "" : "s"} left`
      : " · Next Phase when actions are spent";
    return `${COOP_PLAY_TIP} ${state.meetActionsUsed}/${state.meetActionBudget} actions · pool ${count}/3 (${pool})${actionsTail}${turnNote}.`;
  }
}
