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
  landscapeById,
  setEncounterOnLandscape,
  encounterOnLandscape,
  revealLandscapeTile,
  drawPsycheForPlayer,
  drawMindstream,
} from "./state.js";
import {
  revealBudget,
  exploreBudget,
  meetActionBudgetFromWillpower,
  coopMeetPlayTotal,
  allSelectedCards,
  discardSelected,
  discardAllSelected,
  selectedBySuit,
  flipPowerBonus,
  MEET_ACTIONS,
  canTradeBetween,
  validateBossPlayShape,
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
} from "./rules.js";
import { getLegalMoveTargets, canMoveTo, adjacentTiles, hexDistance, areHexAdjacent } from "./hex.js";
import { repressCard, listSubconsciousCards, dreambeastToHandCard, isDreambeastPsycheCard } from "./subconscious.js";
import { playObjectCard, applySkeletonKeyAfterDream, drawObjects, handLimitForPlayer } from "./objects.js";
import { applyBossAcceptEffect } from "./bosses.js";
import { resolveOnAcquire } from "./archetypes.js";
import { shuffle, uid } from "./data.js";
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
  pullTwoDreambeastsForChoice,
  encounterFromDreambeastCard,
} from "./mindstream-supply.js";
import { beginRevealPicking, handleLandscapeTilePick, cancelLandscapePick } from "./landscapes.js";
import { narrate } from "./narrator.js";
import { playSfx } from "./audio.js";
import { markPhasePulse } from "./fx.js";
import { recordQuestEvent } from "./quests.js";
import { COOP_PLAY_TIP } from "./guide.js";
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

const effectHelpers = { spawnEncounter: null, beginFinalRecurrence: null };

function getEffectHelpers() {
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

function canUseMeetAction(state, action) {
  const player = activePlayer(state);
  if (!canSpendMeetAction(state, player, action, MEET_ACTIONS)) {
    return false;
  }
  if (state.lastMeetAction === action) return false;
  if (state.meetActionsUsed >= state.meetActionBudget) return false;
  return true;
}

function spendMeetAction(state, action) {
  if (!canUseMeetAction(state, action)) {
    addLog(state, "Cannot use this Meet action (restricted or no actions remain).");
    return false;
  }
  state.meetActionsUsed += 1;
  state.lastMeetAction = action;
  return true;
}

function actorOnLandscape(state, landscapeId) {
  if (!landscapeId) return activePlayer(state);
  const onTile = state.players.filter((p) => p.alive && p.landscapeId === landscapeId);
  return onTile[0] || activePlayer(state);
}

function meetLandscapeTile(state) {
  const tile = landscapeById(state, state.selectedLandscapeId);
  if (!tile?.revealed || tile.wasteland) return null;
  const actor = actorOnLandscape(state, tile.id);
  if (actor.landscapeId !== tile.id) return null;
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

  if (phase === "Reveal") {
    const head = headPlayer(state);
    actions.push({
      label: "Draw & Resolve Dream",
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
    actions.push({
      label: budget >= 1
        ? `Reveal Landscapes (${budget} for team)`
        : "Reveal Landscapes (select Lucidity)",
      hint: best
        ? `One Dreamer spends 1–2 Lucidity — ${best.name} adds +${totalStat(best, stat)} (best bonus).`
        : "One Dreamer spends Lucidity to set everyone's reveal budget.",
      section: "main",
      disabled: state.revealLandscapeUsed || budget < 1,
      onClick: handlers.revealLandscape,
    });
    actions.push({
      label: "Next: Explore →",
      section: "phase",
      advance: true,
      hidden: true,
      primary: true,
      onClick: handlers.nextPhase,
    });
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
        hint: best
          ? `One Dreamer spends 1–2 Elasticity — ${best.name} adds +${totalStat(best, stat)} (best bonus).`
          : "One Dreamer spends Elasticity to set everyone's move budget.",
        section: "main",
        primary: true,
        disabled: budget < 1,
        onClick: handlers.activateExplore,
      });
    } else {
      actions.push({
        label: `${state.exploreMovesLeft} move(s) — click green hexes`,
        section: "main",
        disabled: true,
        onClick: () => {},
      });
    }
    actions.push({
      label: "Next: Meet →",
      section: "phase",
      advance: true,
      hidden: true,
      primary: true,
      disabled: state.exploreActivated && state.exploreMovesLeft > 0,
      onClick: handlers.nextPhase,
    });
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
        hint: best
          ? `One Dreamer spends 1–2 Willpower — ${best.name} adds +${totalStat(best, stat)} (best bonus).`
          : "One Dreamer spends Willpower to set shared Meet actions.",
        section: "main",
        primary: true,
        disabled: budget < 1,
        onClick: handlers.gainMeetActions,
      });
    } else {
      actions.push({
        label: `Actions ${state.meetActionsUsed}/${state.meetActionBudget}${poolHint}`,
        section: "main",
        disabled: true,
        onClick: () => {},
      });
    }
    if (state.finalRecurrence) {
      const onTile = landscapeById(state, state.selectedLandscapeId);
      if (onTile?.finalArchetype && !onTile.finalArchetype.defeated) {
        actions.push({
          label: `Defeat ${onTile.finalArchetype.name} (${poolTotal} pool)`,
          section: "encounter",
          disabled: !canUseMeetAction(state, MEET_ACTIONS.MEET),
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
      actions.push({
        label: `Accept (${meetEnc.accept})${shapeHint}`,
        section: "encounter",
        hint: "Accept: Dreambeast joins hand as 3 Psyche of its suit",
        primary: true,
        disabled: !canUseMeetAction(state, MEET_ACTIONS.MEET),
        onClick: () => handlers.meetEncounter("accept"),
      });
      actions.push({
        label: `Repress (${meetEnc.repress})${shapeHint}`,
        section: "encounter",
        hint: "Repress the Dreambeast on your Landscape",
        disabled: !canUseMeetAction(state, MEET_ACTIONS.MEET),
        onClick: () => handlers.meetEncounter("repress"),
      });
    }
    if (meetTile && canDrawMindstreamOnLandscape(meetTile)) {
      actions.push({
        label: `Draw ${SUIT_LABELS[meetTile.suit]} Mindstream`,
        section: "actions",
        hint: "Draw 1 card from this Landscape's matching Mindstream deck",
        disabled: !canUseMeetAction(state, MEET_ACTIONS.LANDSCAPE),
        onClick: handlers.drawMindstream,
      });
    }
    const uniqueChoices = meetTile ? getUniqueLandscapeActionChoices(meetTile) : [];
    if (meetTile && uniqueChoices.length) {
      const uniqueLabel = meetTile.id === "bed"
        ? "Bed Action"
        : "Landscape Action";
      actions.push({
        label: uniqueLabel,
        section: "actions",
        hint: meetTile.id === "bed"
          ? "Spend 10 Psyche to Draw 3, or Draw 3 Psyche"
          : "This Landscape's unique action",
        disabled: !canUseMeetAction(state, MEET_ACTIONS.LANDSCAPE),
        onClick: handlers.uniqueLandscapeAction,
      });
    }
    actions.push({
      label: "Play Object",
      section: "actions",
      disabled: !canUseMeetAction(state, MEET_ACTIONS.LANDSCAPE) || !player.objects.length,
      onClick: handlers.playObject,
    });
    actions.push({
      label: "Activate Persistent",
      section: "actions",
      disabled: !player.persistent?.length || player.powerTokens < 1,
      onClick: handlers.activateObject,
    });
    actions.push({
      label: "Trade",
      section: "actions",
      disabled: !canUseMeetAction(state, MEET_ACTIONS.TRADE),
      onClick: handlers.tradeAction,
    });
    actions.push({
      label: "Power Bonus",
      section: "progress",
      disabled: player.powerTokens < 1,
      onClick: handlers.powerBonus,
    });
    actions.push({
      label: "Quest 1",
      section: "progress",
      disabled: !state.activeArchetype || state.activeArchetype.questProgress[0],
      onClick: () => handlers.completeQuest(0),
    });
    actions.push({
      label: "Quest 2",
      section: "progress",
      disabled: !state.activeArchetype || state.activeArchetype.questProgress[1],
      onClick: () => handlers.completeQuest(1),
    });
    actions.push({
      label: "Acquire Archetype",
      section: "progress",
      disabled: !state.activeArchetype?.questProgress?.every(Boolean),
      onClick: handlers.acquireArchetype,
    });
    actions.push({
      label: "Dreamer Power",
      section: "progress",
      onClick: handlers.useDreamerPower,
    });
    actions.push({
      label: "End Round",
      section: "round",
      advance: true,
      hidden: true,
      primary: true,
      onClick: handlers.nextPhase,
    });
  }

  return actions;
}

export function getPhaseAdvanceAction(state, handlers) {
  if (state.landscapePick || state.pendingRepress || state.pendingReturn) return null;
  const actions = getPhaseActions(state, handlers);
  return actions.find((a) => a.advance && !a.disabled) || null;
}

export function resolvePendingDeathDream(state, onShowModal) {
  if (!state.pendingDeathAdditionalDream) return null;
  state.pendingDeathAdditionalDream = false;
  addLog(state, "A new Dream begins for the fallen Dreamer…");
  return drawAdditionalDream(state, onShowModal);
}

export function drawAdditionalDream(state, onShowModal) {
  const head = headPlayer(state);
  const card = state.dreamDeck.shift();
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

  if (card.type === "boss-dream" || card.boss) {
    const encounter = { ...card, type: "dreambeast", instanceId: uid("enc") };
    setEncounterOnLandscape(state, "bed", encounter);
    addLog(state, `${card.name} awakens on The Bed!`);
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
  if (onShowModal) onShowModal(card);
  return card;
}

export function drawDreamCard(state, onShowModal) {
  if (state.dreamDrawn) return null;
  const head = headPlayer(state);

  const card = state.dreamDeck.shift();
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

  if (card.type === "boss-dream" || card.boss) {
    const encounter = { ...card, type: "dreambeast", instanceId: uid("enc") };
    setEncounterOnLandscape(state, "bed", encounter);
    addLog(state, `${card.name} awakens on The Bed!`);
    recordQuestEvent(state, "meet_boss", { bossId: card.id });
  } else {
    resolveCardEffect(state, card, head, getEffectHelpers());
  }

  checkDefeat(state);
  applySkeletonKeyAfterDream(state);
  playSfx("dream");
  if (onShowModal) onShowModal(card);
  return card;
}

export function revealLandscape(state) {
  const player = findPhaseContributor(state);
  if (!player) {
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Reveal", state);
    narrate(
      state,
      "Select Lucidity Psyche first",
      best
        ? `One Dreamer spends 1–2 blue ${SUIT_LABELS.lucidity} cards to set the team's reveal budget. ${best.name} has the highest Lucidity (+${totalStat(best, stat)}) — have them play the cards.`
        : `Choose 1–2 blue ${SUIT_LABELS.lucidity} cards from any Dreamer's hand, then click Reveal Landscapes.`,
    );
    return;
  }
  const budget = revealBudget(state, player);
  if (budget < 1) {
    narrate(
      state,
      "Select Lucidity Psyche first",
      `Choose 1–2 blue ${SUIT_LABELS.lucidity} cards from ${player.name}'s hand. Their Lucidity stat (+${totalStat(player, "lucidity")}) is added to the card values.`,
    );
    return;
  }
  if (state.revealLandscapeUsed) return;
  if (state.landscapePick?.mode === "reveal") return;

  const lucidityCards = selectedBySuit(state, player, "lucidity");
  if (lucidityCards.length < 1 || lucidityCards.length > 2) {
    narrate(state, "Select 1–2 Lucidity cards", `Click blue Psyche in ${player.name}'s row to select them for the Reveal action.`);
    return;
  }

  const lucidityDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, lucidityDiscarded);

  beginRevealPicking(state, budget);
  addLog(state, `${player.name} spends Lucidity — the team may reveal up to ${budget} Landscapes.`);
  recordQuestEvent(state, "reveal_landscape", { count: 0 });
}

export function activateExplore(state) {
  const player = findPhaseContributor(state);
  const freeRound = state.freeExploreNextRound;
  let budget = player ? exploreBudget(state, player) : 0;

  if (freeRound) {
    budget = Math.max(budget, state.players.filter((p) => p.alive).length);
    state.freeExploreNextRound = false;
    addLog(state, "Travel dream: free moves for all Dreamers this round.");
  }

  if (!player && !freeRound) {
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Explore", state);
    addLog(state, best
      ? `Select 1–2 Elasticity cards from a Dreamer's hand. ${best.name} has the best Elasticity bonus (+${totalStat(best, stat)}).`
      : `Select 1–2 ${SUIT_LABELS.elasticity} Psyche cards from any Dreamer to set team moves.`);
    return;
  }

  const elaCards = player ? selectedBySuit(state, player, "elasticity") : [];

  if (!freeRound && (elaCards.length < 1 || elaCards.length > 2)) {
    addLog(state, `Play 1 or 2 ${SUIT_LABELS.elasticity} Psyche cards to unlock team movement.`);
    return;
  }

  if (elaCards.length) {
    const discarded = discardSelected(state, player);
    trackPsycheDiscard(state, player, discarded);
  }
  state.exploreMovesLeft = budget;
  state.exploreActivated = true;
  addLog(state, `${player?.name || "The team"} unlocks ${budget} shared Explore moves. Click Dreamer chips to choose who moves.`);
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

    player.landscapeId = targetLandscapeId;
    state.selectedLandscapeId = targetLandscapeId;
    state.exploreMovesLeft -= 1;
    onExploreMove(state);
    recordQuestEvent(state, "move_player", { count: 1 });

    if (to.wasteland) {
      if (player.hand.length) {
        const discarded = player.hand.pop();
        state.psycheDiscard.push(discarded);
        recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: targetLandscapeId });
        addLog(state, `${player.name} discards 1 Psyche on Wasteland.`);
        if (state.checkPsycheDeath) state.checkPsycheDeath(player);
      }
    } else {
      addLog(state, `${player.name} moves to ${to.name}. (${state.exploreMovesLeft} moves left)`);
    }

    const enc = encounterOnLandscape(state, targetLandscapeId);
    if (enc) {
      state.activeEncounter = enc;
      state.activeEncounterLandscapeId = targetLandscapeId;
    }
    return;
  }

  state.selectedLandscapeId = targetLandscapeId;
}

export function gainMeetActions(state) {
  const player = findPhaseContributor(state);
  if (!player) {
    const best = bestPhaseContributor(state);
    const stat = statForPhaseBudget("Meet", state);
    addLog(state, best
      ? `Select 1–2 Willpower cards from a Dreamer's hand. ${best.name} has the best Willpower bonus (+${totalStat(best, stat)}).`
      : `Play 1 or 2 ${SUIT_LABELS.willpower} Psyche cards from any Dreamer for shared Meet Actions.`);
    return;
  }
  const budget = meetActionBudgetFromWillpower(state, player);
  const wilCards = selectedBySuit(state, player, "willpower");

  if (wilCards.length < 1 || wilCards.length > 2) {
    addLog(state, `Play 1 or 2 ${SUIT_LABELS.willpower} Psyche cards from ${player.name}'s hand for Meet Actions.`);
    return;
  }

  const wilDiscarded = discardSelected(state, player);
  trackPsycheDiscard(state, player, wilDiscarded);
  state.meetActionBudget = budget;
  state.meetActionsUsed = 0;
  state.lastMeetAction = null;
  addLog(state, `${player.name} spends Willpower — the team gains ${budget} shared Meet Actions.`);
}

export function powerBonus(state) {
  const player = activePlayer(state);
  if (player.powerTokens < 1) {
    addLog(state, "Need 1 Power Token.");
    return;
  }
  player.powerTokens -= 1;
  const bonus = flipPowerBonus();
  state.pendingPowerBonus = bonus;
  addLog(state, `Coin flip: +${bonus} to next Psyche Play.`);
}

export function meetEncounter(state, mode = "accept") {
  const tile = meetLandscapeTile(state);
  const encounter = encounterForMeet(state);
  if (!encounter || !tile) {
    addLog(state, "Meet a Dreambeast on a Landscape you occupy.");
    return;
  }
  if (!spendMeetAction(state, MEET_ACTIONS.MEET)) return;

  state.activeEncounter = encounter;
  state.activeEncounterLandscapeId = tile.id;
  const actor = actorOnLandscape(state, tile.id);
  const needed = mode === "accept" ? encounter.accept : encounter.repress;
  const selected = allSelectedCards(state);

  if (selected.length > 3) {
    addLog(state, "Play up to 3 Psyche cards for an Encounter.");
    state.meetActionsUsed -= 1;
    state.lastMeetAction = null;
    return;
  }

  const shapeCheck = validateBossPlayShape(encounter, selected);
  if (!shapeCheck.ok) {
    addLog(state, shapeCheck.message);
    state.meetActionsUsed -= 1;
    state.lastMeetAction = null;
    return;
  }

  const played = coopMeetPlayTotal(state);
  if (played < needed) {
    addLog(state, `Need ${needed} Psyche to ${mode} (pool total ${played}).`);
    state.meetActionsUsed -= 1;
    state.lastMeetAction = null;
    return;
  }

  const contributors = coopContributorLabel(state);
  const discardedBy = discardAllSelected(state);
  discardedBy.forEach(({ player: p, cards }) => trackPsycheDiscard(state, p, cards));

  if (mode === "accept") {
    addLog(state, `${actor.name} Accepts ${encounter.name}${contributors ? ` (${contributors})` : ""}. ${encounter.effect || ""}`);
    applyBossAcceptEffect(state, encounter, actor);

    const handCard = dreambeastToHandCard(encounter);
    actor.hand.push(handCard);
    addLog(state, `${encounter.name} joins ${actor.name}'s hand as 3 ${SUIT_LABELS[encounter.suit] || encounter.suit} Psyche.`);

    if (encounter.accept >= 10) {
      const objs = drawObjects(state, actor, 1, getEffectHelpers());
      recordQuestEvent(state, "draw_object", { count: objs.length });
      if (objs.length) addLog(state, `High-tier Accept: ${actor.name} draws an Object.`);
    }
  } else {
    addLog(state, `${actor.name} Represses ${encounter.name}${contributors ? ` (${contributors})` : ""}.`);
    if (actor.hand.length) {
      const repressed = actor.hand.pop();
      repressCard(state, repressed);
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: actor.landscapeId });
      addLog(state, `Repress cost: 1 Psyche sent to the Subconscious.`);
      if (state.checkPsycheDeath) state.checkPsycheDeath(actor);
    }
    const drawn = drawPsycheForPlayer(state, actor, 1);
    trackPsycheDraw(state, actor, drawn.length);
    addLog(state, `Repress reward: ${actor.name} draws ${drawn.length} Psyche.`);
  }

  const landscapeId = state.activeEncounterLandscapeId;
  if (landscapeId) {
    recordQuestEvent(state, "meet_on_landscape", { landscapeId });
    if (encounter.boss || encounter.id === "cerberus" || encounter.id === "double" || encounter.id === "leviathan") {
      recordQuestEvent(state, "meet_boss", { bossId: encounter.id });
    }
    const tile = landscapeById(state, landscapeId);
    if (tile) tile.encounter = null;
  }
  state.activeEncounter = null;
  state.activeEncounterLandscapeId = null;

  if (state.pendingHeatingUp) {
    if (mode === "accept") {
      spawnEncounterOnLandscape(state, actor.landscapeId);
      addLog(state, "Heating Up: Accept spawns another Encounter.");
    } else {
      const limit = handLimitForPlayer(state, actor);
      let drew = 0;
      while (actor.hand.length < limit) {
        const n = drawPsycheForPlayer(state, actor, 1);
        if (!n.length) break;
        drew += n.length;
      }
      if (drew) trackPsycheDraw(state, actor, drew);
      addLog(state, `Heating Up: drew Psyche up to hand limit (${actor.hand.length}/${limit}).`);
    }
    state.pendingHeatingUp = false;
  }
}

function refundLandscapeMeetAction(state) {
  state.meetActionsUsed -= 1;
  state.lastMeetAction = null;
}

function landscapeActionHelpers(state) {
  const helpers = getEffectHelpers();
  return {
    ...helpers,
    pickMindstreamSuit: true,
    pickDeck: true,
    psychePoolTotal: coopMeetPlayTotal,
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

export function drawMindstreamOnLandscape(state, { onResult } = {}) {
  if (!spendMeetAction(state, MEET_ACTIONS.LANDSCAPE)) return null;
  const ctx = validateMeetLandscape(state);
  if (!ctx) {
    refundLandscapeMeetAction(state);
    return null;
  }
  const { tile, player } = ctx;
  if (!canDrawMindstreamOnLandscape(tile)) {
    addLog(state, "This Landscape has no matching Mindstream deck.");
    refundLandscapeMeetAction(state);
    return null;
  }
  recordQuestEvent(state, "landscape_action", { landscapeId: tile.id });
  const result = executeLandscapeActionChoice(
    state,
    tile,
    player,
    "draw-mindstream",
    landscapeActionHelpers(state),
  );
  if (result?.refund) refundLandscapeMeetAction(state);
  if (result?.card && onResult) onResult(result.card);
  return result;
}

export function uniqueLandscapeAction(state, { onChoose, onResult } = {}) {
  if (!spendMeetAction(state, MEET_ACTIONS.LANDSCAPE)) return null;
  const ctx = validateMeetLandscape(state);
  if (!ctx) {
    refundLandscapeMeetAction(state);
    return null;
  }
  const { tile, player } = ctx;
  const choices = getUniqueLandscapeActionChoices(tile);
  if (!choices.length) {
    addLog(state, "No special Landscape Action here.");
    refundLandscapeMeetAction(state);
    return null;
  }

  if (choices.length === 1 && !onChoose) {
    return completeLandscapeAction(state, tile, player, choices[0].id, onResult);
  }

  if (onChoose) {
    onChoose(choices, tile, player);
    return { pending: true };
  }

  return completeLandscapeAction(state, tile, player, choices[0].id, onResult);
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

  if (result?.refund) refundLandscapeMeetAction(state);
  if (!result?.ok && !result?.pending) refundLandscapeMeetAction(state);

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
  if (result?.refund) refundLandscapeMeetAction(state);
  if (result?.card && onResult) onResult(result.card);
  return result;
}

export function finishLandscapeDeckFlip(state, deckKey) {
  return flipTopThreeOfDeck(state, deckKey);
}

export function drawMindstreamCard(state, suit) {
  if (getPhase(state) !== "Meet") {
    addLog(state, "Draw Mindstream during the Meet phase.");
    return null;
  }
  const tile = landscapeById(state, state.selectedLandscapeId);
  const player = landscapeActor(state);
  if (!tile?.revealed) {
    addLog(state, "Select a revealed Landscape.");
    return null;
  }
  if (!spendMeetAction(state, MEET_ACTIONS.LANDSCAPE)) return null;
  recordQuestEvent(state, "landscape_action", { landscapeId: tile.id });
  const result = executeLandscapeActionChoice(
    state,
    tile,
    player,
    "draw-mindstream",
    landscapeActionHelpers(state),
  );
  if (result?.refund) {
    refundLandscapeMeetAction(state);
    return null;
  }
  return result?.card || null;
}

export function playObject(state, objectId = null, { usePower = false } = {}) {
  if (getPhase(state) !== "Meet") {
    addLog(state, "Play Objects during the Meet phase.");
    return null;
  }

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
  if (!isPersistentActivate && !usePower) {
    if (!spendMeetAction(state, MEET_ACTIONS.LANDSCAPE)) return null;
  }

  const result = playObjectCard(state, player, card, getEffectHelpers(), { usePower: isPersistentActivate || usePower });
  if (!result && !isPersistentActivate) {
    state.meetActionsUsed -= 1;
    state.lastMeetAction = null;
  }
  return result;
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
    state.meetActionsUsed -= 1;
    state.lastMeetAction = null;
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
    state.meetActionsUsed -= 1;
    state.lastMeetAction = null;
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
  if (player.powerTokens < 1) {
    addLog(state, "Need 1 Power Token.");
    return;
  }
  player.powerTokens -= 1;
  const d = player.dreamer;
  addLog(state, `${player.name} uses ${d.name}: ${d.power}`);

  if (d.id === "the-rested") {
    drawPsycheForPlayer(state, player, 1);
  } else if (d.id === "the-visionary") {
    const hidden = state.board.find((l) => !l.revealed && !l.center);
    if (hidden) revealLandscapeTile(state, hidden);
  } else if (d.id === "the-runner") {
    const bed = landscapeById(state, "bed");
    const current = landscapeById(state, player.landscapeId);
    if (bed && current) {
      const neighbors = adjacentTiles(state, current.id);
      if (hexDistance(current, bed) > 0) {
        const toward = neighbors
          .filter((t) => t.revealed && hexDistance(t, bed) < hexDistance(current, bed))
          .sort((a, b) => hexDistance(a, bed) - hexDistance(b, bed))[0];
        const away = neighbors
          .filter((t) => t.revealed && hexDistance(t, bed) > hexDistance(current, bed))
          .sort((a, b) => hexDistance(b, bed) - hexDistance(a, bed))[0];
        const dest = toward || away;
        if (dest) {
          player.landscapeId = dest.id;
          addLog(state, `${player.name} moves toward Bed → ${dest.name}.`);
        }
      }
    }
  } else if (d.id === "the-hunter") {
    if (state.activeEncounter) {
      addLog(state, "Moved active Encounter 1 step (simplified).");
    }
  } else if (d.id === "the-immovable") {
    addLog(state, "Cancelled last discard or move (simplified).");
  } else if (d.id === "the-weaver") {
    drawPsycheForPlayer(state, player, 1);
  }
}

export function spawnEncounterOnLandscape(state, landscapeId, beastCard = null) {
  let beast;
  if (beastCard) {
    beast = encounterFromDreambeastCard(beastCard);
  } else if (state.pickEncounterOnSpawn) {
    const choice = pullTwoDreambeastsForChoice(state);
    if (!choice) return null;
    beast = encounterFromDreambeastCard(choice.pick);
    state.pickEncounterOnSpawn = false;
    if (choice.alt) {
      addLog(state, `Transformation: chose ${choice.pick.name} over ${choice.alt.name}.`);
    }
  } else {
    const pulled = pullDreambeastFromMindstream(state);
    if (!pulled) return null;
    beast = encounterFromDreambeastCard(pulled.card);
  }
  setEncounterOnLandscape(state, landscapeId, beast);
  const tile = landscapeById(state, landscapeId);
  addLog(state, `${beast.name} appears on ${tile?.name || "the Dreamscape"}!`);
  return beast;
}

export function spawnRandomEncounter(state) {
  const revealed = state.board.filter((l) => l.revealed && !l.encounter);
  if (!revealed.length) return;
  const tile = revealed[Math.floor(Math.random() * revealed.length)];
  return spawnEncounterOnLandscape(state, tile.id);
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

  if (isDreambeastPsycheCard(card)) {
    if (phase !== "Meet" || state.meetActionBudget === 0) return;
    if (!player.alive || !player.hand.some((c) => c.instanceId === id)) return;
    if (state.selectedHand.includes(id)) {
      state.selectedHand = state.selectedHand.filter((x) => x !== id);
      return;
    }
    if (state.selectedHand.length >= 3) return;
    state.selectedHand.push(id);
    return;
  }

  if (state.selectedHand.includes(id)) {
    state.selectedHand = state.selectedHand.filter((x) => x !== id);
    return;
  }

  const coopMeet = phase === "Meet" && state.meetActionBudget > 0;
  const maxCards = coopMeet ? 3 : (phase === "Meet" ? 2 : 2);
  if (state.selectedHand.length >= maxCards) return;

  if (phase === "Meet" && state.meetActionBudget > 0) {
    if (!player.alive || !player.hand.some((c) => c.instanceId === id)) return;
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
    if (suited.length >= 2) return;
    state.selectedHand.push(id);
    return;
  }
}

export function handleQuestComplete(state, questIndex = 0) {
  completeQuest(state, questIndex, activePlayer(state));
}

export function handleAcquire(state) {
  acquireArchetype(state, activePlayer(state), (s, arch, p) => {
    resolveOnAcquire(s, arch, p, getEffectHelpers());
  });
}

export function handleBoardTileClick(state, tileId) {
  if (state.landscapePick) {
    return handleLandscapeTilePick(state, tileId);
  }
  moveDreamer(state, tileId);
  return false;
}

export function endPhase(state) {
  cancelLandscapePick(state);
  const leaving = getPhase(state);
  if (leaving === "Explore") onExplorePhaseEnd(state);
  if (leaving === "Meet") onMeetPhaseEnd(state);
  advancePhase(state);
  if (leaving === "Reveal" && state.skipExploreNextRound) {
    state.skipExploreNextRound = false;
    addLog(state, "Trapped: skipping Explore Phase.");
    onExplorePhaseEnd(state);
    advancePhase(state);
  }
  checkDefeat(state);
  const phase = getPhase(state);
  markPhasePulse();
  playSfx("phase");
  narrate(
    state,
    `${phase} Phase begins`,
    phase === "Reveal"
      ? `${COOP_PLAY_TIP} Head Dreamer (★) draws the Dream once. One Dreamer spends Lucidity to set team reveals.`
      : phase === "Explore"
        ? `${COOP_PLAY_TIP} One Dreamer spends Elasticity to unlock shared moves — then move any Dreamer.`
        : `${COOP_PLAY_TIP} One Dreamer spends Willpower to unlock shared Meet actions.`,
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
  return getLegalMoveTargets(state, player);
}

export function getPhaseHint(state) {
  const phase = getPhase(state);
  const head = headPlayer(state);
  if (phase === "Reveal") {
    const parts = [COOP_PLAY_TIP];
    if (!state.dreamDrawn) parts.push(`${head.name} (★) Dream not drawn yet.`);
    if (!state.revealLandscapeUsed) parts.push("One Dreamer spends Lucidity for team reveals.");
    return parts.join(" ");
  }
  if (phase === "Explore") {
    const legal = getLegalExploreTargets(state).length;
    if (!state.exploreActivated) {
      return `${COOP_PLAY_TIP} One Dreamer spends Elasticity to unlock shared moves.`;
    }
    return `${COOP_PLAY_TIP} ${state.exploreMovesLeft} team move(s) · ${legal} hexes reachable for focused Dreamer.`;
  }
  if (phase === "Meet") {
    if (state.meetActionBudget === 0) {
      return `${COOP_PLAY_TIP} One Dreamer spends Willpower for shared Meet actions.`;
    }
    const pool = coopMeetPlayTotal(state);
    const count = allSelectedCards(state).length;
    return `${COOP_PLAY_TIP} ${state.meetActionsUsed}/${state.meetActionBudget} actions · pool ${count}/3 (${pool}).`;
  }
}
