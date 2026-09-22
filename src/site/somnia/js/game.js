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
  bossPlayShapeLabel,
  bossPlayShapeRequired,
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
  isWildPsyche,
  encounterPlayTotal,
  encounterPayHint,
  payWildSpreadCost,
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
} from "./dreambeasts.js";
import { getLegalMoveTargets, canMoveTo, adjacentTiles, hexDistance, areHexAdjacent } from "./hex.js";
import { repressCard, listSubconsciousCards, dreambeastToHandCard, isDreambeastPsycheCard } from "./subconscious.js";
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
import { psycheHandCount, hasPsycheHealth, canAddAllyToHand, allyHandLimitForPlayer, allyHandCount } from "./psyche.js";
import { queueDreamDrawFx, queueMeetFlashFx, queuePsycheSwirlFx } from "./board-fx.js";
import { resolveOnAcquire, useArchetypePower, handleArchetypePowerTilePick } from "./archetypes.js";
import { getActivatableArchetypePowers } from "./archetype-stats.js";
import { isQuestConditionMet } from "./quests.js";
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
    effectHelpers.drawAdditionalDream = (s) => drawAdditionalDream(s);
    effectHelpers.spawnEncounterWithCard = (s, landscapeId, card) =>
      spawnEncounterOnLandscape(s, landscapeId, card);
  }
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

function usedMeetActionList(state, player) {
  if (!player) return [];
  const used = state.usedMeetActionsByPlayer?.[player.id];
  if (Array.isArray(used) && used.length) return used;
  const last = state.lastMeetActionByPlayer?.[player.id];
  return last ? [last] : [];
}

function hasUsedMeetAction(state, player, key) {
  return usedMeetActionList(state, player).includes(key);
}

function markUsedMeetAction(state, player, key) {
  if (!player) return;
  if (!state.usedMeetActionsByPlayer) state.usedMeetActionsByPlayer = {};
  const list = usedMeetActionList(state, player).filter(Boolean);
  if (!list.includes(key)) list.push(key);
  state.usedMeetActionsByPlayer[player.id] = list;
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
}

function clearAllUsedMeetActions(state) {
  state.usedMeetActionsByPlayer = {};
  state.lastMeetActionByPlayer = {};
}

function meetActionActor(state, action) {
  if (action === MEET_ACTIONS.TRADE || action === MEET_ACTIONS.ARCHETYPE || action === MEET_ACTIONS.DREAMER) {
    return activePlayer(state);
  }
  const tile = meetLandscapeTile(state) || landscapeById(state, state.selectedLandscapeId);
  if (!tile?.revealed || tile.wasteland) return null;
  return actorOnLandscape(state, tile.id);
}

function canUseMeetActionForActor(state, actor, action, landscapeActionId = null) {
  if (!actor) return false;
  if (!canSpendMeetAction(state, actor, action, MEET_ACTIONS)) return false;
  if (landscapeActionId !== "draw-mindstream" && hasUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId))) return false;
  if (state.meetActionsUsed >= state.meetActionBudget) return false;
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
  if (!enc || getPhase(state) !== "Meet" || state.meetActionBudget < 1) return false;
  if (state.meetActionsUsed >= state.meetActionBudget) return false;
  if (hasUsedMeetAction(state, player, meetActionKey(MEET_ACTIONS.MEET))) return false;
  return canSpendMeetAction(state, player, MEET_ACTIONS.MEET, MEET_ACTIONS);
}

function meetActionHint(state, action, landscapeActionId, baseHint = "") {
  const actor = meetActionActor(state, action);
  if (!actor) return "A Dreamer must stand on this Landscape.";
  if (state.meetActionsUsed >= state.meetActionBudget) return "No Meet actions remaining.";
  if (hasUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId))) {
    return "This Dreamer already used that action this Meet.";
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
  state.meetActionsUsed += 1;
  if (landscapeActionId !== "draw-mindstream") {
    markUsedMeetAction(state, actor, meetActionKey(action, landscapeActionId));
  }
  return true;
}

function refundMeetAction(state, player, action = null, landscapeActionId = null) {
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

  const dreamerPowerAction = () => {
    const inMeet = phase === "Meet";
    const meetBlocked = inMeet && !canUseMeetAction(state, MEET_ACTIONS.DREAMER);
    return {
      label: "Dreamer Power",
      kind: "dreamerPower",
      section: "progress",
      hint: inMeet
        ? meetActionHint(state, MEET_ACTIONS.DREAMER, null, `${player.dreamer.power} Costs 1 Meet action and 1 Power Token.`)
        : `${player.dreamer.power} Costs 1 Power Token.`,
      disabled: player.powerTokens < 1 || hasPendingDreamerPower(state) || !canActivateDreamerPower(state, player) || meetBlocked,
      onClick: handlers.useDreamerPower,
    };
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
    actions.push({
      label: deckTopPick
        ? `Reveal Deck Tops (${state.landscapePick.remaining} left)`
        : mapOpen
          ? (budget >= 1 ? `Reveal Deck Tops (${budget})` : "Reveal Deck Tops (select Lucidity)")
          : (budget >= 1 ? `Reveal Landscapes (${budget} for team)` : "Reveal Landscapes (select Lucidity)"),
      kind: "revealLandscape",
      hint: !state.dreamDrawn
        ? "Draw & Resolve the Dream first, then spend Lucidity."
        : deckTopPick
          ? "Click a Mindstream card back to flip its next facedown card, or open Reveal Deck Top."
          : mapOpen
            ? "The map is fully Revealed. Lucidity now flips Mindstream tops — click a card back or this action."
            : best
              ? `One Dreamer spends 1 Lucidity — ${best.name} adds +${totalStat(best, stat, state)} (best bonus). Leftover Reveals flip Mindstream tops once the map is finished.`
              : "One Dreamer spends Lucidity to set everyone's reveal budget.",
      section: "main",
      disabled: !state.dreamDrawn || state.revealLandscapeUsed || (budget < 1 && !deckTopPick),
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
    actions.push(dreamerPowerAction());
    actions.push(...questActions());
  }

  if (phase === "Explore") {
    if (!state.exploreActivated) {
      const contributor = findPhaseContributor(state);
      const budget = contributor ? exploreBudget(state, contributor) : 0;
      const best = bestPhaseContributor(state);
      const stat = statForPhaseBudget("Explore", state);
      actions.push({
        label: budget >= 1
          ? `Spend Elasticity (${budget} team moves)`
          : "Spend Elasticity (select cards)",
        kind: "spendElasticity",
        hint: best
          ? `One Dreamer spends 1 Elasticity — ${best.name} adds +${totalStat(best, stat, state)} (best bonus).`
          : "One Dreamer spends Elasticity to set everyone's move budget.",
        section: "main",
        primary: true,
        disabled: budget < 1,
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
    }
    actions.push(dreamerPowerAction());
    actions.push(...questActions());
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
      actions.push({
        label: budget >= 1
          ? `Gain Actions (${budget} for team)`
          : "Gain Actions (select Willpower)",
        kind: "gainMeetActions",
        hint: best
          ? `One Dreamer spends 1 Willpower — ${best.name} adds +${totalStat(best, stat, state)} (best bonus).`
          : "One Dreamer spends Willpower to set shared Meet actions.",
        section: "main",
        primary: true,
        disabled: budget < 1,
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
      const shape = bossPlayShapeRequired(meetEnc);
      const shapeHint = shape ? ` · ${bossPlayShapeLabel(shape)}` : "";
      const payHint = encounterPayHint(meetEnc, true);
      actions.push({
        label: `${encounterPowerLabel(meetEnc, true)} — ${encounterAcceptSummary(meetEnc)}${shapeHint}`,
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
          label: `${encounterPowerLabel(meetEnc, false)} — ${encounterRejectSummary(meetEnc)}${shapeHint}`,
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
    actions.push({
      label: "Play Object",
      kind: "playObject",
      section: "actions",
      hint: "Free action — Instant Objects Repress when used. Does not cost a Meet action.",
      disabled: !player.objects?.length,
      onClick: handlers.playObject,
    });
    actions.push({
      label: "Activate Persistent",
      kind: "activateObject",
      section: "actions",
      hint: "Free action — spend 1 Power Token to activate. Does not cost a Meet action.",
      disabled: !player.persistent?.length || player.powerTokens < 1,
      onClick: handlers.activateObject,
    });
    actions.push({
      label: "Trade",
      kind: "trade",
      section: "actions",
      hint: meetActionHint(state, MEET_ACTIONS.TRADE, null, "Trade up to 3 Psyche with an adjacent Dreamer."),
      disabled: !canUseMeetAction(state, MEET_ACTIONS.TRADE),
      onClick: handlers.tradeAction,
    });
    actions.push(dreamerPowerAction());
    actions.push(...questActions());
    getActivatableArchetypePowers(state).forEach((acquired) => {
      actions.push({
        label: `${acquired.name} Power`,
        kind: "archetypePower",
        section: "progress",
        hint: meetActionHint(state, MEET_ACTIONS.ARCHETYPE, acquired.id, `${acquired.power} Costs 1 Meet action and 1 Power Token.`),
        disabled: activePlayer(state).powerTokens < 1 || !canUseMeetAction(state, MEET_ACTIONS.ARCHETYPE, acquired.id),
        onClick: () => handlers.useArchetypePower(acquired.id),
      });
    });
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
  if (state.forcedAccept) return "Silver: Accept the spawned Dreambeast (Reject is not allowed).";
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
    if (phase === "Explore") return Boolean(state.exploreActivated);
    if (phase === "Meet") return (state.meetActionBudget || 0) > 0;
    return false;
  }
  if (phase === "Reveal") {
    return Boolean(state.dreamDrawn && state.revealLandscapeUsed && !state.landscapePick);
  }
  if (phase === "Explore") {
    return Boolean(state.exploreActivated);
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
    hint: spent
      ? `${label} — or skip leftover work in this phase.`
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
    recordQuestEvent(state, "meet_boss", { bossId: card.id });
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
    narrate(state, "Select Lucidity or 1 Power Token", `Play 1 blue Psyche from ${player.name}, or spend 1 Power Token as 1 Lucidity.`);
    return;
  }

  const lucidityDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, lucidityDiscarded);
  if (consumePhasePowerToken(state, player)) {
    addLog(state, `${player.name} spends 1 Power Token as 1 Lucidity.`);
  }

  beginRevealPicking(state, budget);
  addLog(state, `${player.name} spends Lucidity — the team may reveal up to ${budget} Landscapes.`);
  recordQuestEvent(state, "reveal_landscape", { count: 0 });
  playPhaseSpendFlash("lucidity");
}

export function activateExplore(state) {
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
  state.exploreMovesLeft = budget;
  state.exploreActivated = true;
  const insulationBonus = consumeInsulationMoves(state);
  if (insulationBonus) {
    state.exploreMovesLeft += insulationBonus;
    addLog(state, `Insulation grants +${insulationBonus} Explore move${insulationBonus === 1 ? "" : "s"}, then is discarded.`);
  }
  addLog(state, `${player?.name || "The team"} unlocks ${state.exploreMovesLeft} shared Explore moves. Click Dreamer chips to choose who moves.`);
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
  const player = activePlayer(state);
  const to = landscapeById(state, targetLandscapeId);

  if (getPhase(state) === "Explore") {
    if (!state.exploreActivated || state.exploreMovesLeft < 1) {
      addLog(state, "Activate Explore with Elasticity Psyche first.");
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
    state.exploreMovesLeft -= 1;
    onExploreMove(state);
    recordQuestEvent(state, "move_player", { count: 1 });
    recordCancellableMove(state, player, fromId, targetLandscapeId);

    if (to.wasteland) {
      if (hasPsycheHealth(player)) {
        const discarded = player.hand.pop();
        state.psycheDiscard.push(discarded);
        recordCancellableDiscard(state, player, discarded, "wasteland");
        recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: targetLandscapeId });
        addLog(state, `${player.name} discards 1 Psyche on Wasteland.`);
        if (state.checkPsycheDeath) state.checkPsycheDeath(player);
      }
    } else {
      addLog(state, `${player.name} moves to ${to.name}. (${state.exploreMovesLeft} moves left)`);
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
      hint: "Silver: play the Accept spread. This Dreambeast cannot be Rejected.",
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
  const questHint = (index) => {
    if (!arch) return "No active Archetype.";
    if (arch.questProgress[index]) return "This quest is already marked.";
    if (held < 1) return "Need 1 Power Token.";
    if (!isQuestConditionMet(state, arch.id, arch.quests[index])) {
      return `Quest not met yet: ${arch.quests[index]}`;
    }
    return "Free action — spend 1 Power Token to mark this quest. Does not cost a Meet action.";
  };
  const options = [
    {
      id: "quest0",
      kind: "completeQuest0",
      label: "Quest 1",
      hint: questHint(0),
      disabled: !arch || arch.questProgress[0] || !isQuestConditionMet(state, arch.id, arch.quests[0]) || held < 1,
    },
    {
      id: "quest1",
      kind: "completeQuest1",
      label: "Quest 2",
      hint: questHint(1),
      disabled: !arch || arch.questProgress[1] || !isQuestConditionMet(state, arch.id, arch.quests[1]) || held < 1,
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

export function meetEncounter(state, mode = "accept", { instant = false, onDone } = {}) {
  if (isDiceBattleOpen() || state.diceBattle) {
    addLog(state, "Finish the dice battle first.");
    return;
  }
  if (state.forcedAccept) {
    state.selectedLandscapeId = state.forcedAccept.tileId;
    if (mode !== "accept") {
      addLog(state, "Silver: this Dreambeast must be Accepted. It cannot be Rejected.");
      return;
    }
  }
  const tile = meetLandscapeTile(state);
  const encounter = encounterForMeet(state);
  if (!encounter || !tile) {
    addLog(state, "Meet a Dreambeast on a Landscape you occupy.");
    return;
  }
  if (!state.forcedAccept && !spendMeetAction(state, MEET_ACTIONS.MEET)) return;

  state.activeEncounter = encounter;
  state.activeEncounterLandscapeId = tile.id;
  const actor = actorOnLandscape(state, tile.id);
  const abortMeet = (message) => {
    if (message) addLog(state, message);
    if (state.forcedAccept) return;
    refundMeetAction(state, actor || meetActionActor(state, MEET_ACTIONS.MEET), MEET_ACTIONS.MEET);
  };
  if (!actor) {
    abortMeet("A Dreamer must be on this Landscape to Meet the Encounter.");
    return;
  }
  const isReject = mode === "reject" || mode === "repress";
  const beastPower = encounterPower(encounter, !isReject);
  const recommended = recommendedEncounterPower(encounter, !isReject);
  const selected = selectedCards(state, actor);

  if (!isReject && !canAddAllyToHand(state, actor)) {
    abortMeet(`${actor.name} already has ${allyHandLimitForPlayer(state, actor)} allies (max). Repress this Encounter or spend allies first.`);
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
  if (!isReject && (encounter.refId || encounter.id) === "chimera") {
    const declared = selected.find((c) => !isDreambeastPsycheCard(c) && !isWildPsyche(c));
    if (declared) addLog(state, `Chimera Declared Card: ${declared.name || `${declared.suit} ${declared.value}`}.`);
  }

  const played = Math.max(1, encounterPlayTotal(state, { accept: !isReject }));
  const bonus = meetBonusBreakdown(state);
  const ctx = { mode, isReject, encounter, tile, actor, selected, played, needed: beastPower };

  payWildSpreadCost(state, selected);
  if (state.status === "lost") {
    discardSelected(state, actor);
    onDone?.();
    return;
  }

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

  if (instant || typeof document === "undefined") {
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
    instant: typeof document === "undefined",
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
      `${actor.name} loses the dice battle with ${encounter.name}. The play is spent. ${encounter.name} remains on ${tile.name} and will Fail at the end of Meet.`,
    );
    logMoment(state, `${encounter.name} wins the clash — it stays on ${tile.name}.`);
    return;
  }

  if (!isReject) {
    addLog(state, `${actor.name} Accepts ${encounter.name}. ${encounter.effect || ""}`);
    applyAcceptEffect(state, encounter, actor, getEffectHelpers());

    const handCard = dreambeastToHandCard(encounter);
    actor.hand.push(handCard);
    addLog(state, `${encounter.name} joins ${actor.name}'s hand as a 3 ${SUIT_LABELS[encounter.suit] || encounter.suit} Psyche ally.`);

    if (encounter.accept >= 10) {
      const objs = drawObjects(state, actor, 1, getEffectHelpers());
      recordQuestEvent(state, "draw_object", { count: objs.length });
      if (objs.length) addLog(state, `High-tier Accept: ${actor.name} draws an Object.`);
    }
  } else {
    addLog(state, `${actor.name} Rejects ${encounter.name}. ${encounter.rejectReward || ""}`);
    repressCard(state, { ...encounter, type: "dreambeast" });
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
      while (psycheHandCount(actor) < limit) {
        const n = drawPsycheForPlayer(state, actor, 1);
        if (!n.length) break;
        drew += n.length;
      }
      if (drew) trackPsycheDraw(state, actor, drew);
      const allyLimit = allyHandLimitForPlayer(state, actor);
      const allies = allyHandCount(actor);
      const allyNote = allies ? ` + ${allies}/${allyLimit} allies` : "";
      logMoment(state, `Heating Up — drew Psyche up to hand limit (${psycheHandCount(actor)}/${limit} Psyche${allyNote}).`);
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

function landscapeActionPreflight(state, actionId) {
  if (actionId !== "bed-play-3-draw-3") return true;
  const helpers = landscapeActionHelpers(state);
  const points = helpers.psychePointTotal(state);
  if (points < 3) {
    addLog(state, `Select Psyche totaling 3 points (currently ${points}).`);
    return false;
  }
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

  if (result?.card && onResult) onResult(result.card);
  return result;
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

export function tradeAction(state) {
  if (!spendMeetAction(state, MEET_ACTIONS.TRADE)) return;
  state.tradeMode = true;
  state.trade = {
    initiatorId: activePlayer(state).id,
    partnerId: null,
    offerPsycheIds: [],
    offerObjectIds: [],
    step: "pick-partner",
  };
  addLog(state, "Trade: click another Dreamer on the same or adjacent Landscape.");
}

export function selectTradePartner(state, playerIndex) {
  if (!state.tradeMode || !state.trade) return false;
  const initiator = activePlayer(state);
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

export function toggleTradeOffer(state, card) {
  if (!state.trade || state.trade.step !== "select-offer") return;
  const player = activePlayer(state);
  const id = card.instanceId;
  const list = state.trade.offerPsycheIds;
  if (list.includes(id)) {
    state.trade.offerPsycheIds = list.filter((x) => x !== id);
  } else if (list.length < 3 && player.hand.some((c) => c.instanceId === id)) {
    list.push(id);
  }
}

export function confirmTrade(state) {
  if (!state.trade?.partnerId) {
    addLog(state, "Select a trade partner first.");
    return false;
  }
  const initiator = state.players.find((p) => p.id === state.trade.initiatorId);
  const partner = state.players.find((p) => p.id === state.trade.partnerId);
  if (!initiator || !partner) return false;

  const offered = initiator.hand.filter((c) => state.trade.offerPsycheIds.includes(c.instanceId));
  initiator.hand = initiator.hand.filter((c) => !state.trade.offerPsycheIds.includes(c.instanceId));
  partner.hand.push(...offered);

  addLog(state, `${initiator.name} traded ${offered.length} Psyche to ${partner.name}.`);
  state.tradeMode = false;
  state.trade = null;
  state.selectedHand = [];
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
  const inMeet = getPhase(state) === "Meet";
  if (inMeet && !spendMeetAction(state, MEET_ACTIONS.DREAMER)) return null;
  if (!spendPowerTokens(state, player, 1)) {
    if (inMeet) refundMeetAction(state, player, MEET_ACTIONS.DREAMER);
    addLog(state, "Need 1 Power Token.");
    return null;
  }
  addLog(state, `${player.name} activates ${player.dreamer.name} Power (1 Power Token${inMeet ? " and 1 Meet action" : ""}).`);
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
    const tile = revealed[Math.floor(Math.random() * revealed.length)];
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
    if (player !== activePlayer(state)) return;
    toggleTradeOffer(state, card);
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
  if (getPhase(state) !== "Meet") {
    addLog(state, "Archetype Powers are Meet actions.");
    return false;
  }
  if (!spendMeetAction(state, MEET_ACTIONS.ARCHETYPE, archetype.id)) return false;
  const ok = useArchetypePower(state, archetype, activePlayer(state), getEffectHelpers());
  if (!ok) refundMeetAction(state, activePlayer(state), MEET_ACTIONS.ARCHETYPE, archetype.id);
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
    const ok = handleLandscapeTilePick(state, tileId);
    if (ok && state.pendingObjectFollowup) resumeObjectEffect(state, getEffectHelpers());
    return ok;
  }
  if (canAutoActivateExplore(state)) activateExplore(state);

  const phase = getPhase(state);
  if (phase === "Explore" && state.exploreActivated) {
    const player = activePlayer(state);
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
        : `${COOP_PLAY_TIP} One Dreamer spends Willpower to unlock shared Meet actions. Start: Repress 1 Psyche per roaming Dreambeast. End: Forget 1 random Landscape per remaining beast, then Fail costs in spawn order. Beasts stay until you win a dice battle.`,
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
  const player = activePlayer(state);
  if (getPhase(state) !== "Explore" || !state.exploreActivated) return [];
  if ((state.exploreMovesLeft || 0) < 1) return [];
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
    return `${COOP_PLAY_TIP} ${state.exploreMovesLeft} team move(s) · ${legal} hexes reachable. Tap Next Phase at the top-right of the map when you are done moving.`;
  }
  if (phase === "Meet") {
    if (state.meetActionBudget === 0) {
      return `${COOP_PLAY_TIP} Start of Meet: each Dreamer Represses 1 Psyche and the table Forgets 1 Landscape per active Dreambeast. One Dreamer spends Willpower for shared Meet actions.`;
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
