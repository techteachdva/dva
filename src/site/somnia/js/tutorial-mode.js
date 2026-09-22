import {
  createInitialState,
  getPhase,
  addLog,
  setEncounterOnLandscape,
  landscapeById,
  encounterOnLandscape,
  tileEncounters,
  checkDreamerPsycheDeath,
  headPlayer,
} from "./state.js";
import { meetPsycheActor } from "./rules.js";
import { hexNeighbors, getLegalMoveTargets } from "./hex.js";
import { precomputeTutorialSnapshots } from "./tutorial-canonical.js";
import { resetBoardMotion } from "./board-fx.js";
import { listSubconsciousCards, pickReturnCard } from "./subconscious.js";

export const TUTORIAL_DREAMER_IDS = ["the-visionary", "the-immovable"];
export const RECOMMENDED_STARTER_IDS = TUTORIAL_DREAMER_IDS;
export const TUTORIAL_MAX_ROUND = 2;
const TUTORIAL_STARTER_IDS = ["city", "sky", "forest", "road", "house", "suburbia"];

let tutorialUidSeq = 0;

function resetTutorialUidSeq() {
  tutorialUidSeq = 0;
}

function tutorialUid(prefix) {
  tutorialUidSeq += 1;
  return `${prefix}-tut-${String(tutorialUidSeq).padStart(4, "0")}`;
}

function stableCardSort(cards) {
  return [...cards].sort((a, b) => {
    const key = (c) => `${c.type || ""}|${c.suit || ""}|${c.value ?? ""}|${c.id || ""}|${c.name || ""}`;
    return key(a).localeCompare(key(b));
  });
}

function stabilizeTutorialDecks(state) {
  state.psycheDeck = stableCardSort(state.psycheDeck);
  state.psycheDiscard = stableCardSort(state.psycheDiscard);
  state.archetypeDeck = stableCardSort(state.archetypeDeck);
  Object.keys(state.mindstreamDecks).forEach((suit) => {
    state.mindstreamDecks[suit] = stableCardSort(state.mindstreamDecks[suit]);
  });
  Object.keys(state.mindstreamDiscard).forEach((suit) => {
    state.mindstreamDiscard[suit] = stableCardSort(state.mindstreamDiscard[suit]);
  });
}

function reseedTutorialInstanceIds(state) {
  resetTutorialUidSeq();
  const stamp = (card, prefix) => {
    if (!card || typeof card !== "object") return;
    card.instanceId = tutorialUid(prefix);
  };
  const stampList = (cards, prefix) => {
    cards?.forEach((card, index) => stamp(card, `${prefix}-${index}-${card.id || card.type}`));
  };

  state.players.forEach((player, playerIndex) => {
    stamp(player, `player-${playerIndex}`);
    stampList(player.hand, `p${playerIndex}-hand`);
    stampList(player.objects, `p${playerIndex}-obj`);
    stampList(player.persistent, `p${playerIndex}-per`);
    stampList(player.acquiredArchetypes, `p${playerIndex}-arch`);
  });

  stampList(state.psycheDeck, "psyche-deck");
  stampList(state.psycheDiscard, "psyche-discard");
  stampList(state.dreamDeck, "dream-deck");
  stampList(state.archetypeDeck, "archetype-deck");
  if (state.activeArchetype) stamp(state.activeArchetype, `arch-${state.activeArchetype.id}`);
  if (state.activeDream) stamp(state.activeDream, `dream-active`);

  Object.entries(state.mindstreamDecks).forEach(([suit, cards]) => {
    stampList(cards, `ms-deck-${suit}`);
  });
  Object.entries(state.mindstreamDiscard).forEach(([suit, cards]) => {
    stampList(cards, `ms-discard-${suit}`);
  });

  state.board?.forEach((tile) => {
    const encounters = tile.encounters || (tile.encounter ? [tile.encounter] : []);
    encounters.forEach((enc, i) => stamp(enc, `enc-${tile.id}-${enc.id}-${i}`));
  });
}

function makePowerSurge(tag) {
  return {
    id: `psyche-power-${tag}`,
    type: "psyche-power",
    suit: null,
    value: 0,
    powerTokens: 1,
    name: "Power Surge",
    text: "Play anytime, any phase: gain 1 Power Token, then discard.",
    instanceId: tutorialUid(`psyche-power-${tag}`),
  };
}

function makePsyche(suit, value, tag) {
  const label = suit.charAt(0).toUpperCase() + suit.slice(1);
  return {
    id: `${suit}-${value}-${tag}`,
    type: "psyche",
    suit,
    value,
    name: `${label} ${value}`,
    instanceId: tutorialUid(`psyche-${tag}`),
  };
}

function mkDream(template, extra = {}) {
  return { ...template, ...extra, instanceId: tutorialUid("dream") };
}

const TUTORIAL_QUEST_PLACEMENT = [
  { questId: "the-attic", beside: "house", besideName: "House" },
  { questId: "the-basement", beside: "city", besideName: "City" },
];

export const TUTORIAL_REVEAL_TILE = "candy-mountain";
const TUTORIAL_SNAPSHOT_VERSION = 27;
let tutorialSnapshotCache = null;
let tutorialSnapshotCacheVersion = 0;

export function createTutorialBaseState(data) {
  resetTutorialUidSeq();

  const dreamers = TUTORIAL_DREAMER_IDS
    .map((id) => data.dreamers.find((d) => d.id === id))
    .filter(Boolean);

  const state = createInitialState(data, {
    lengthKey: "daydream",
    selectedDreamers: dreamers,
    tutorialMode: true,
  });

  state.tutorialMode = true;
  state.tutorialStepIndex = 0;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.goalPoints = 1;
  state.tutorialFlags = {
    dreamsDrawn: 0,
    encounterResolved: false,
    firstBattleLost: false,
    meetPenaltyDone: false,
    archetypeAcquired: false,
    archetypePowerUsed: false,
    acquirePowerPrimed: false,
    nextBattleWinner: null,
  };

  const innocent = data.archetypes.find((a) => a.id === "innocent");
  if (innocent) {
    state.activeArchetype = {
      ...innocent,
      instanceId: tutorialUid("arch-innocent"),
      questProgress: [false, false],
      powerTokensOnArchetype: 0,
    };
    state.archetypeDeck = state.archetypeDeck.filter((a) => a.id !== "innocent");
  }

  state.players.forEach((p, index) => {
    p.id = tutorialUid(`player-${index}`);
    p.powerTokens = 1;
  });

  state.players[0].hand = [
    makePsyche("lucidity", 3, "v-l3"),
    makePsyche("lucidity", 2, "v-l2"),
    makePsyche("elasticity", 2, "v-e2"),
    makePsyche("willpower", 2, "v-w2"),
    makePsyche("lucidity", 1, "v-l1"),
    makePsyche("elasticity", 1, "v-e1"),
    makePsyche("willpower", 1, "v-w1"),
    makePowerSurge("heroism"),
  ];
  state.players[1].hand = [
    makePsyche("willpower", 3, "i-w3"),
    makePsyche("elasticity", 3, "i-e3"),
    makePsyche("elasticity", 2, "i-e2"),
    makePsyche("lucidity", 2, "i-l2"),
    makePsyche("willpower", 1, "i-w1"),
    makePowerSurge("heroism-i"),
  ];

  const heroism = data.dreams.find((d) => d.id === "heroism");
  const misunderstanding = data.dreams.find((d) => d.id === "misunderstanding");
  const quiet = data.dreams.find((d) => d.id === "quiet");
  const extraQuiets = [];
  for (let i = 0; i < 8; i += 1) {
    extraQuiets.push(mkDream(quiet));
  }
  state.dreamDeck = [
    mkDream(heroism || quiet),
    mkDream(misunderstanding || quiet),
    ...extraQuiets,
  ];
  state.dreamDiscard = [];

  setupTutorialQuestLandscapes(state);

  const mandrake = data.dreambeasts.find((b) => b.id === "mandrake");
  if (mandrake) {
    setEncounterOnLandscape(state, "the-attic", {
      ...mandrake,
      type: "dreambeast",
      instanceId: tutorialUid("enc-mandrake"),
    });
  }

  stabilizeTutorialDecks(state);
  state.psycheDeck = [
    makePowerSurge("heroism"),
    makePowerSurge("heroism-i"),
    makePsyche("lucidity", 2, "r2-a"),
    makePsyche("willpower", 1, "r2-b"),
    makePsyche("elasticity", 1, "r2-c"),
    ...state.psycheDeck.filter((card) => card.type !== "psyche-power"),
  ];
  reseedTutorialInstanceIds(state);
  pinTutorialMindstreamLesson(state);

  const placementNote = (state.tutorialFlags.questPlacements || [])
    .map((p) => `${p.questId === "the-attic" ? "The Attic" : "The Basement"} beside ${p.starterName}`)
    .join("; ");

  state.log = [
    "Tutorial Mode: on-rails - click only the highlighted Dreamer, cards, and hexes.",
    "Round 1 begins in the Reveal Phase. Your Active Archetype is The Innocent.",
    "Psyche is your health and your action points — empty hands are deadly, and 1 suited card opens a phase.",
    placementNote ? `Quest Landscapes revealed: ${placementNote}. Mandrake waits on The Attic.` : "Quest Landscapes The Attic and The Basement are revealed. Mandrake waits on The Attic.",
  ];
  return state;
}

export function createTutorialState(data) {
  if (!tutorialSnapshotCache || tutorialSnapshotCacheVersion !== TUTORIAL_SNAPSHOT_VERSION) {
    tutorialSnapshotCache = precomputeTutorialSnapshots(data, TUTORIAL_SCRIPT, createTutorialBaseState);
    tutorialSnapshotCacheVersion = TUTORIAL_SNAPSHOT_VERSION;
  }
  const snapshots = tutorialSnapshotCache;
  const state = JSON.parse(JSON.stringify(snapshots[0]));
  reattachStateRuntime(state);
  state.tutorialMode = true;
  state.tutorialSnapshots = snapshots;
  state.tutorialStepIndex = 0;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.tutorialSuppressCatchUp = true;
  return state;
}

// -- Step snapshots (Back / jump restores game state) -----------------

function reattachStateRuntime(state) {
  state.checkPsycheDeath = (player) => checkDreamerPsycheDeath(state, player);
  delete state.onResolutionIdle;
}

function restoreTutorialSnapshot(state, stepIndex) {
  const snap = state.tutorialSnapshots?.[stepIndex];
  if (!snap) return false;

  const preserved = {
    tutorialMode: true,
    tutorialSnapshots: state.tutorialSnapshots,
    tutorialStepIndex: stepIndex,
    tutorialCanAdvance: false,
    tutorialComplete: false,
    tutorialSuppressCatchUp: true,
  };
  Object.assign(state, JSON.parse(JSON.stringify(snap)), preserved);
  reattachStateRuntime(state);
  resetBoardMotion(state);
  return true;
}

// -- Hard action locks per tutorial step ------------------------------

const TUTORIAL_INFO_STEPS = new Set([
  "welcome",
  "meet-lesson",
  "r2-intro",
  "wake",
]);

function allowsSuitHand(state, detail, suit) {
  const card = detail?.card;
  const owner = detail?.owner;
  if (!card || !owner) return false;
  const id = card.instanceId;
  if (state.selectedHand.includes(id)) return true;
  if (card.suit !== suit) return false;
  return owner.hand.some((c) => c.instanceId === id);
}

function exploreMoveAllowed(state, tileId, allowedTiles = null, playerIndex = null) {
  const idx = playerIndex ?? state.activePlayerIndex;
  const player = state.players[idx];
  if (!player?.alive || getPhase(state) !== "Explore" || !state.exploreActivated) return false;
  const legal = getLegalMoveTargets(state, player).map((t) => t.id);
  if (!legal.includes(tileId)) return false;
  if (allowedTiles && !allowedTiles.includes(tileId)) return false;
  return true;
}

function railBeatStickyComplete(state, beat, directComplete, { skipKinds = [] } = {}) {
  if (directComplete()) return true;
  const step = getTutorialStep(state);
  const beatIndex = step?.rail?.indexOf(beat) ?? -1;
  if (beatIndex < 0 || !step?.rail) return false;
  for (let i = beatIndex + 1; i < step.rail.length; i += 1) {
    const later = step.rail[i];
    if (skipKinds.includes(later.kind)) continue;
    if (isRailBeatComplete(state, later)) return true;
  }
  return false;
}

function dreamerSelectBeatComplete(state, beat) {
  return railBeatStickyComplete(
    state,
    beat,
    () => state.activePlayerIndex === beat.playerIndex,
    { skipKinds: ["dreamerSelect"] },
  );
}

function exploreMoveBeatComplete(state, beat) {
  return railBeatStickyComplete(
    state,
    beat,
    () => state.players[beat.playerIndex]?.landscapeId === beat.tileId,
    { skipKinds: ["dreamerSelect"] },
  );
}

function powerSurgeHandToggleBeatComplete(state, beat) {
  const player = state.players[beat.playerIndex ?? 0];
  return railBeatStickyComplete(
    state,
    beat,
    () => (player?.powerTokens || 0) >= 2,
    { skipKinds: ["dreamerSelect"] },
  );
}

function requiredCardIds(beat) {
  if (!beat) return [];
  if (Array.isArray(beat.cardIds) && beat.cardIds.length) return beat.cardIds;
  if (beat.cardId) return [beat.cardId];
  return [];
}

function requiredCardsSelected(state, beat) {
  const player = state.players[beat.playerIndex ?? 0];
  if (!player) return false;
  const selected = new Set(state.selectedHand);
  return requiredCardIds(beat).every((cardId) => {
    const card = player.hand.find((c) => c.id === cardId);
    return card && selected.has(card.instanceId);
  });
}

function isRailBeatComplete(state, beat) {
  switch (beat.kind) {
    case "dreamerSelect":
      return dreamerSelectBeatComplete(state, beat);
    case "handToggle": {
      if (requiredCardsSelected(state, beat)) return true;
      const player = state.players[beat.playerIndex ?? 0];
      const ids = requiredCardIds(beat);
      if (!ids.length || !player) return false;
      if (ids.some((id) => String(id).startsWith("psyche-power"))) {
        return powerSurgeHandToggleBeatComplete(state, beat);
      }
      return ids.every((cardId) => !player.hand.some((c) => c.id === cardId));
    }
    case "drawDream":
      return !!state.dreamDrawn;
    case "revealLandscape":
      return !!state.landscapePick || !!state.revealLandscapeUsed;
    case "boardClick": {
      const tile = landscapeById(state, beat.tileId);
      if (beat.reveal) return !!(tile?.revealed && !tile.wasteland);
      return state.selectedLandscapeId === beat.tileId;
    }
    case "spendElasticity":
      return !!state.exploreActivated;
    case "exploreMove":
      return exploreMoveBeatComplete(state, beat);
    case "gainMeetActions":
      return state.meetActionBudget > 0;
    case "meetAccept":
    case "meetReject": {
      const tileId = beat.tileId || "the-attic";
      const tile = landscapeById(state, tileId);
      if (beat.scripted === "lose") return !!state.tutorialFlags?.firstBattleLost;
      if (tile && tileEncounters(tile).length === 0) return true;
      if (state.tutorialFlags?.encounterResolved) return true;
      return false;
    }
    case "powerBonus":
      return (state.pendingPowerBonus || 0) >= (beat.amount || 1);
    case "dreamerPower":
      return (state.anchorMeetSpreadPending || 0) >= 1 || (state.anchorMeetSpreadBonus || 0) >= 1;
    case "archetypePower":
      return !!state.tutorialFlags?.archetypePowerUsed;
    case "advancePhase":
      if (beat.toRound) return state.round >= beat.toRound;
      return getPhase(state) === beat.toPhase;
    case "landscapeActionA":
    case "landscapeActionB":
      return typeof beat.done === "function" ? !!beat.done(state) : false;
    case "completeQuest0":
      return !!state.activeArchetype?.questProgress?.[0] || innocentAcquired(state);
    case "completeQuest1":
      return !!state.activeArchetype?.questProgress?.[1] || innocentAcquired(state);
    default:
      return false;
  }
}

export function currentRailBeat(state) {
  const step = getTutorialStep(state);
  if (!step?.rail?.length) return null;
  if (step.until?.(state)) return null;
  return step.rail.find((beat) => !isRailBeatComplete(state, beat)) || null;
}

function railComplete(state, step) {
  if (!step?.rail?.length) return true;
  if (step.until?.(state)) return true;
  return step.rail.every((beat) => isRailBeatComplete(state, beat));
}

function railBeatAllows(state, beat, kind, detail = {}) {
  if (kind === "dreamerSelect" && beat.playerIndex != null) {
    if (detail.playerIndex == null || detail.playerIndex === beat.playerIndex) return true;
  }
  if (kind === "dreamerSelect" && beat.landscapeId) {
    const idx = state.players.findIndex((p) => p.alive && p.landscapeId === beat.landscapeId);
    return idx >= 0 && (detail.playerIndex == null || detail.playerIndex === idx);
  }

  switch (beat.kind) {
    case "dreamerSelect":
      return kind === "dreamerSelect"
        && (detail.playerIndex == null || detail.playerIndex === beat.playerIndex);
    case "handToggle": {
      if (kind !== "handToggle") return false;
      const card = detail.card;
      const owner = detail.owner;
      if (!card || !owner) return false;
      if (beat.playerIndex != null && state.players[beat.playerIndex]?.id !== owner.id) return false;
      return requiredCardIds(beat).includes(card.id);
    }
    case "drawDream":
      return kind === "drawDream";
    case "revealLandscape":
      return kind === "revealLandscape";
    case "boardClick":
      return (kind === "boardClick" || kind === "exploreMove") && detail.tileId === beat.tileId;
    case "spendElasticity":
      return kind === "spendElasticity";
    case "exploreMove":
      if (kind !== "exploreMove" && kind !== "boardClick") return false;
      return exploreMoveAllowed(state, detail.tileId, [beat.tileId], beat.playerIndex);
    case "gainMeetActions":
      return kind === "gainMeetActions";
    case "meetAccept":
      if (kind === "meetAccept" || kind === "beastRadial" || kind === "dreamerSelect") return true;
      return kind === "boardClick" && detail.tileId === (beat.tileId || "the-attic");
    case "meetReject":
      if (kind === "meetReject" || kind === "beastRadial" || kind === "dreamerSelect") return true;
      return kind === "boardClick" && detail.tileId === (beat.tileId || "the-attic");
    case "powerBonus":
      return kind === "powerBonus";
    case "dreamerPower":
      return kind === "dreamerPower" || kind === "dreamerSelect";
    case "archetypePower":
      return kind === "archetypePower" || kind === "dreamerSelect";
    case "advancePhase":
      return kind === "advancePhase" || kind === "dreamerSelect";
    case "landscapeActionA":
    case "landscapeActionB":
      if (kind === beat.kind || kind === "dreamerSelect") return true;
      return kind === "boardClick" && detail.tileId === beat.landscapeId;
    case "completeQuest0":
    case "completeQuest1":
      if (kind === "dreamerSelect") {
        return detail.playerIndex == null || detail.playerIndex === (beat.playerIndex ?? 0);
      }
      return kind === beat.kind;
    default:
      return false;
  }
}

function ensureTutorialBasementBeast(state) {
  if (state.round < 2) return;
  if (!state.tutorialFlags) state.tutorialFlags = {};
  if (state.tutorialFlags.basementBeastPlaced) return;
  const tile = landscapeById(state, "the-basement");
  const existing = tile ? tileEncounters(tile) : [];
  if (existing.length) {
    state.tutorialFlags.basementBeastPlaced = true;
    return;
  }
  const template = state.tutorialFlags?.basementBeast;
  if (!template || !tile) return;
  setEncounterOnLandscape(state, "the-basement", {
    ...template,
    instanceId: tutorialUid("enc-goofus-basement"),
  });
  state.tutorialFlags.basementBeastPlaced = true;
}

function settleTutorialRail(state) {
  const step = getTutorialStep(state);
  if (!step) return;

  let beat = currentRailBeat(state);
  if (beat?.scripted === "lose") state.tutorialFlags.nextBattleWinner = "beast";
  else if (beat?.scripted === "win") state.tutorialFlags.nextBattleWinner = "dreamer";
  else if (beat?.kind === "meetAccept" || beat?.kind === "meetReject") {
    state.tutorialFlags.nextBattleWinner = "dreamer";
  }

  if (step.id === "r2-acquire" && beat?.kind === "handToggle" && requiredCardIds(beat).includes("psyche-power-heroism")) {
    const visionary = state.players[0];
    if (visionary && !visionary.hand.some((c) => c.type === "psyche-power")) {
      visionary.hand.push(makePowerSurge("heroism"));
    }
  }

  const revealBeat = step.rail?.find((item) => item.kind === "boardClick" && item.reveal);
  if (revealBeat && landscapeById(state, revealBeat.tileId)?.revealed && state.landscapePick?.mode === "reveal") {
    state.revealLandscapeUsed = true;
    state.landscapePick = null;
  }

  if (step.closeRevealPick && state.landscapePick?.mode === "reveal") {
    state.revealLandscapeUsed = true;
    state.landscapePick = null;
  }

  beat = currentRailBeat(state);
  if (beat?.kind === "advancePhase" && state.landscapePick) {
    if (state.landscapePick.mode === "reveal" && !state.landscapePick.freeReveal) {
      state.revealLandscapeUsed = true;
    }
    state.landscapePick = null;
  }

  if (beat?.kind === "archetypePower" && state.pendingReturn) {
    autoCompleteTutorialReturn(state);
    state.tutorialFlags.archetypePowerUsed = true;
  }
}

/** Legal Explore hex ids for board highlighting during on-rails movement beats. */
export function getTutorialExploreLegalMoveIds(state, defaultLegalMoveIds = []) {
  if (!isInteractiveTutorialActive(state)) return defaultLegalMoveIds;
  const beat = currentRailBeat(state);
  if (beat?.kind !== "exploreMove" || beat.playerIndex == null) {
    return defaultLegalMoveIds.filter((id) =>
      isTutorialActionAllowed(state, "exploreMove", { tileId: id }));
  }
  const player = state.players[beat.playerIndex];
  if (!player) return [];
  return getLegalMoveTargets(state, player)
    .map((t) => t.id)
    .filter((id) => isTutorialActionAllowed(state, "exploreMove", { tileId: id }));
}

export function getTutorialPickHighlights(state, raw) {
  if (!isInteractiveTutorialActive(state) || !raw) return raw;
  const beat = currentRailBeat(state);
  if (beat?.kind === "boardClick" && beat.reveal && beat.tileId) {
    return {
      ...raw,
      reveal: (raw.reveal || []).filter((id) => id === beat.tileId),
    };
  }
  if (getTutorialStep(state)?.closeRevealPick) {
    return { ...raw, reveal: [] };
  }
  return raw;
}

/** Face-down hex the player must click this Reveal step (Candy Mountain). */
export function getTutorialRevealTargetId(state) {
  if (!isInteractiveTutorialActive(state)) return null;
  const step = getTutorialStep(state);
  const revealBeat = step?.rail?.find((beat) => beat.kind === "boardClick" && beat.reveal && beat.tileId);
  return revealBeat?.tileId || null;
}

/** Pan the board to the hex the current rail beat cares about. */
export function getTutorialCameraFocus(state) {
  if (!isInteractiveTutorialActive(state)) return null;
  const step = getTutorialStep(state);
  if (!step) return null;
  const beat = currentRailBeat(state);

  if (beat?.kind === "dreamerSelect" && beat.playerIndex != null) {
    const player = state.players[beat.playerIndex];
    if (player?.landscapeId) {
      return {
        tileId: player.landscapeId,
        key: `${state.tutorialStepIndex}:dreamerSelect:${beat.playerIndex}:${player.landscapeId}`,
        zoom: 1.55,
      };
    }
  }

  if (step.id === "reveal-r1") {
    return { tileId: "candy-mountain", key: "reveal-r1:candy-mountain", zoom: 1.7 };
  }
  if (step.id === "explore-r1") {
    const tileId = beat?.tileId || "house";
    return { tileId, key: `explore-r1:${tileId}`, zoom: 1.55 };
  }
  if (step.id === "r2-intro" || step.id === "meet-lesson") {
    return { tileId: "the-attic", key: `${step.id}:the-attic`, zoom: 1.5 };
  }

  const tileId = beat?.tileId || beat?.landscapeId || null;
  if (!tileId) return null;
  return {
    tileId,
    key: `${state.tutorialStepIndex}:${beat.kind}:${tileId}`,
    zoom: 1.55,
  };
}

export function tutorialPhaseActionSelector(kind) {
  return `.radial-menu-item[data-tutorial-action="${kind}"]`;
}

export function tutorialDreamerTokenSelector(playerId) {
  return playerId ? `.hex-occupant-dreamer[data-dreamer-id="${playerId}"]` : ".hex-occupant-dreamer";
}

export function tutorialActionDreamerId(state, beat) {
  if (beat?.playerIndex != null) return state.players[beat.playerIndex]?.id || null;
  if (beat?.playerId) return beat.playerId;
  if (beat?.landscapeId) {
    const occupant = state.players.find((p) => p.alive && p.landscapeId === beat.landscapeId);
    if (occupant) return occupant.id;
  }
  if (beat?.kind === "drawDream") return headPlayer(state)?.id || state.players[0]?.id || null;
  return state.players[state.activePlayerIndex]?.id || state.players[0]?.id || null;
}

function radialOrDreamerHighlight(state, beat, kind) {
  const playerId = tutorialActionDreamerId(state, beat);
  const radialSel = tutorialPhaseActionSelector(kind);
  const dreamerSel = tutorialDreamerTokenSelector(playerId);
  return {
    targets: [radialSel, dreamerSel, "#board-viewport"],
    spotlight: radialSel,
  };
}

function railHighlight(state, step, beat) {
  if (!beat) {
    return {
      targets: getTutorialStepTargetSelectors(step),
      spotlight: step.spotlight || null,
    };
  }

  const player = beat.playerIndex != null ? state.players[beat.playerIndex] : null;
  const playerId = player?.id;

  switch (beat.kind) {
    case "dreamerSelect":
      return {
        targets: [
          playerId ? `.player-chip[data-player-id="${playerId}"]` : "#dreamer-dock",
          playerId ? `.hex-occupant-dreamer[data-dreamer-id="${playerId}"]` : "#dreamer-dock",
          "#dreamer-dock",
        ],
        spotlight: playerId
          ? `.hex-occupant-dreamer[data-dreamer-id="${playerId}"]`
          : "#dreamer-dock",
      };
    case "handToggle": {
      const ids = requiredCardIds(beat);
      const selected = new Set(state.selectedHand);
      const nextCard = ids
        .map((cardId) => player?.hand.find((c) => c.id === cardId))
        .find((card) => card && !selected.has(card.instanceId));
      if (nextCard) {
        const cardSel = `.game-card[data-instance-id="${nextCard.instanceId}"]`;
        return {
          targets: ["#hand-bar", `#hand-bar ${cardSel}`],
          spotlight: `#hand-bar ${cardSel}`,
        };
      }
      return {
        targets: ["#hand-bar"],
        spotlight: "#hand-bar",
      };
    }
    case "drawDream":
      return {
        targets: ["#btn-draw-dream[data-tutorial-action=\"drawDream\"]", "#btn-draw-dream", "#board-viewport"],
        spotlight: "#btn-draw-dream[data-tutorial-action=\"drawDream\"]",
      };
    case "revealLandscape":
    case "spendElasticity":
    case "gainMeetActions":
      return {
        targets: [
          `#btn-spread-opener[data-tutorial-action="${beat.kind}"]`,
          "#btn-spread-opener",
          "#spread-tray",
          "#hand-bar",
        ],
        spotlight: `#btn-spread-opener[data-tutorial-action="${beat.kind}"]`,
      };
    case "meetAccept":
    case "meetReject": {
      const highlight = radialOrDreamerHighlight(state, beat, beat.kind);
      const tileId = beat.tileId || player?.landscapeId || "the-attic";
      highlight.targets.push(`.hex-tile[data-tile-id="${tileId}"] .hex-occupant-beast`);
      return highlight;
    }
    case "powerBonus":
      return {
        targets: ["#btn-power-bonus", "#power-tokens"],
        spotlight: "#btn-power-bonus",
      };
    case "dreamerPower":
      return radialOrDreamerHighlight(state, beat, "dreamerPower");
    case "archetypePower":
      return radialOrDreamerHighlight(state, beat, "archetypePower");
    case "boardClick":
    case "exploreMove":
      return {
        targets: [
          `.hex-tile[data-tile-id="${beat.tileId}"]`,
          "#board-viewport",
        ],
        spotlight: `.hex-tile[data-tile-id="${beat.tileId}"]`,
      };
    case "advancePhase":
      return {
        targets: ["#btn-next-phase", "#board-viewport"],
        spotlight: "#btn-next-phase",
      };
    case "landscapeActionA":
    case "landscapeActionB": {
      const hexSel = `.hex-tile[data-tile-id="${beat.landscapeId}"]`;
      const highlight = radialOrDreamerHighlight(state, beat, beat.kind);
      const onTile = state.players[beat.playerIndex]?.landscapeId === beat.landscapeId;
      if (onTile) {
        highlight.targets.push(hexSel);
        return highlight;
      }
      return {
        targets: [hexSel, "#board-viewport"],
        spotlight: hexSel,
      };
    }
    case "completeQuest0":
    case "completeQuest1": {
      const questSel = `#active-archetype [data-tutorial-action="${beat.kind}"]`;
      return {
        targets: [questSel, "#active-archetype"],
        spotlight: questSel,
      };
    }
    default:
      return {
        targets: getTutorialStepTargetSelectors(step),
        spotlight: step.spotlight || null,
      };
  }
}

function decorateTutorialStep(state, step, objective) {
  const beat = currentRailBeat(state);
  const { targets, spotlight } = railHighlight(state, step, beat);
  return {
    ...step,
    targets,
    spotlight: spotlight || step.spotlight || null,
    spotlightBeat: beat
      ? {
        ...beat,
        playerId: tutorialActionDreamerId(state, beat),
      }
      : null,
    objectiveText: objective,
  };
}

export function classifyPhaseAction(action) {
  if (action?.kind) return action.kind;
  const label = action?.label || "";
  if (label.startsWith("Draw Dream") || label.startsWith("Draw & Resolve")) return "drawDream";
  if (label.startsWith("Reveal Landscapes")) return "revealLandscape";
  if (label.startsWith("Spend Elasticity")) return "spendElasticity";
  if (label.startsWith("Power Token as 1")) return "phasePowerToken";
  if (label.startsWith("Gain Actions")) return "gainMeetActions";
  if (label.startsWith("Accept")) return "meetAccept";
  if (label.startsWith("Reject")) return "meetReject";
  if (label === "Quest 1") return "completeQuest0";
  if (label === "Quest 2") return "completeQuest1";
  if (label.startsWith("+1 Spread") || label === "+1 to Spread") return "powerBonus";
  if (label.startsWith("-1 Spread")) return "refundPowerBonus";
  if (label.includes("Next:") || label.startsWith("End Round")) return "advancePhase";
  if (/Action A/i.test(label) || label.startsWith("Draw [") || label === "Draw 3 Psyche") return "landscapeActionA";
  if (/Action B/i.test(label) || /Play 3 Psyche/i.test(label)) return "landscapeActionB";
  if (label === "Dreamer Power") return "dreamerPower";
  if (label === "Trade" || label === "Play Object" || label === "Activate Persistent") return "blockedExtra";
  return "other";
}

function stepAllowsAction(state, step, kind, detail = {}) {
  if (TUTORIAL_INFO_STEPS.has(step.id)) return false;
  if (!step.rail?.length) return false;
  const beat = currentRailBeat(state);
  if (!beat) return false;
  return railBeatAllows(state, beat, kind, detail);
}

export function isTutorialActionAllowed(state, kind, detail = {}) {
  if (!isInteractiveTutorialActive(state)) return true;
  if (kind === "handToggle" && detail.card?.type === "psyche-power") {
    const beat = currentRailBeat(state);
    return beat?.kind === "handToggle" && requiredCardIds(beat).includes(detail.card?.id);
  }
  if (kind === "phasePowerToken" || kind === "refundPowerBonus") {
    return false;
  }
  if (kind === "tutorialNav") return true;
  if (kind === "powerTokenMenu") {
    const current = getTutorialStep(state);
    return current?.id === "r2-acquire" || current?.id === "r2-rematch" || TUTORIAL_INFO_STEPS.has(current?.id);
  }

  const step = getTutorialStep(state);
  if (!step) return true;

  if (kind === "phaseAction") {
    kind = classifyPhaseAction(detail.action);
  }

  if (kind === "headerPause") return true;
  if (kind === "headerOverview" || kind === "headerDreamFeed" || kind === "headerMomentHistory") {
    return TUTORIAL_INFO_STEPS.has(step.id);
  }

  if (kind === "headerSubconscious" || kind === "headerDecks" || kind === "headerDreamers") {
    return (state.tutorialStepIndex ?? 0) >= 1;
  }

  if (kind === "boardClick" && state.landscapePick?.mode === "choose") {
    return (state.landscapePick.allowed || []).includes(detail?.tileId);
  }

  return stepAllowsAction(state, step, kind, detail);
}

export function tutorialActionBlocked(state) {
  const sync = syncTutorial(state);
  const msg = sync?.objective || "Follow the highlighted tutorial step.";
  addLog(state, `Tutorial — ${msg}`);
}

export function applyTutorialPhaseGates(state, actions) {
  if (!isInteractiveTutorialActive(state)) return actions;
  return actions.map((action) => {
    const kind = classifyPhaseAction(action);
    const allowed = isTutorialActionAllowed(state, kind, { action });
    const onClick = action.onClick;
    return {
      ...action,
      disabled: action.disabled || !allowed,
      onClick: () => {
        if (!isTutorialActionAllowed(state, kind, { action })) {
          tutorialActionBlocked(state);
          return;
        }
        onClick();
      },
    };
  });
}

// -- Progress helpers (robust gates for tutorial steps) --

function bossOnBed(state) {
  const bedBoss = encounterOnLandscape(state, "bed");
  return bedBoss?.id === "cerberus" || state.activeDream?.id === "cerberus";
}

function hasLuciditySelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "lucidity"));
}

function hasElasticitySelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "elasticity"));
}

function hasWillpowerSelected(state) {
  const ids = new Set(state.selectedHand);
  return state.players.some((p) => p.hand.some((c) => ids.has(c.instanceId) && c.suit === "willpower"));
}

function hasMeetPool(state) {
  const actor = meetPsycheActor(state);
  if (!actor || getPhase(state) !== "Meet" || state.meetActionBudget <= 0) return false;
  const ids = new Set(state.selectedHand);
  return actor.hand.some((c) => ids.has(c.instanceId));
}

function dreamerOnHouse(state) {
  return state.players.some((p) => p.alive && p.landscapeId === "house");
}

function houseSelected(state) {
  return state.selectedLandscapeId === "house";
}

function houseEncounterCleared(state) {
  return tileEncounters(landscapeById(state, "house")).length === 0;
}

function phaseAfter(state, phase) {
  const order = ["Reveal", "Explore", "Meet"];
  const idx = order.indexOf(getPhase(state));
  return idx > order.indexOf(phase);
}

function atRound(state, minRound) {
  return state.round >= minRound;
}

function revealDone(state, minRound = 1) {
  if (state.round < minRound) return false;
  if (!state.dreamDrawn) return false;
  return state.revealLandscapeUsed || phaseAfter(state, "Reveal");
}

function houseMeetReady(state) {
  return dreamerOnHouse(state) && houseSelected(state);
}

function swapBoardTilePositions(tileA, tileB) {
  const q = tileA.q;
  const r = tileA.r;
  tileA.q = tileB.q;
  tileA.r = tileB.r;
  tileB.q = q;
  tileB.r = r;
}

function ring2SlotsBesideStarter(state, starterId) {
  const starter = landscapeById(state, starterId);
  if (!starter) return [];
  return hexNeighbors(starter.q, starter.r)
    .map(({ q, r }) => state.board.find((t) => t.q === q && t.r === r))
    .filter((t) => t && !t.center && !t.starting);
}

function pinTutorialMindstreamLesson(state) {
  const deck = state.mindstreamDecks?.lucidity || [];
  const pick = (type) => deck.find((c) => c.type === type);
  const power = pick("power-token");
  const event = pick("event");
  const object = pick("object");
  const beast = pick("dreambeast");
  const chosen = [power, event, object, beast].filter(Boolean);
  const rest = deck.filter((c) => !chosen.includes(c));
  state.mindstreamDecks.lucidity = [...chosen, ...rest];

  const fillDiscard = (suit, count) => {
    const source = state.mindstreamDecks[suit] || [];
    while ((state.mindstreamDiscard[suit]?.length || 0) < count && source.length > 4) {
      const card = source.pop();
      if (!card) break;
      state.mindstreamDiscard[suit].push(card);
    }
  };
  fillDiscard("lucidity", 2);
  fillDiscard("elasticity", 2);
  fillDiscard("willpower", 2);
}

function setupTutorialQuestLandscapes(state) {
  const usedCoords = new Set();
  const placements = [];

  const bed = landscapeById(state, "bed");
  if (bed) {
    bed.revealed = true;
    bed.wasteland = false;
  }

  TUTORIAL_STARTER_IDS.forEach((id) => {
    const tile = landscapeById(state, id);
    if (tile) {
      tile.revealed = true;
      tile.wasteland = false;
    }
  });

  TUTORIAL_QUEST_PLACEMENT.forEach(({ questId, beside, besideName }) => {
    const questTile = landscapeById(state, questId);
    if (!questTile) return;

    const slots = ring2SlotsBesideStarter(state, beside)
      .filter((slot) => {
        const key = `${slot.q},${slot.r}`;
        if (usedCoords.has(key)) return false;
        return !TUTORIAL_QUEST_PLACEMENT.some((p) => p.questId === slot.id);
      })
      .sort((a, b) => a.q - b.q || a.r - b.r);

    if (slots.length) {
      const targetSlot = slots[0];
      swapBoardTilePositions(questTile, targetSlot);
      usedCoords.add(`${questTile.q},${questTile.r}`);
    }

    questTile.revealed = true;
    questTile.wasteland = false;
    placements.push({
      questId,
      starterId: beside,
      starterName: besideName,
    });
  });

  state.tutorialFlags.questPlacements = placements;
}

function dreamerOnLandscape(state, landscapeId) {
  return state.players.some((p) => p.alive && p.landscapeId === landscapeId);
}

function dreamerAdjacentToLandscape(state, landscapeId) {
  const tile = landscapeById(state, landscapeId);
  if (!tile) return false;
  const neighborIds = hexNeighbors(tile.q, tile.r)
    .map(({ q, r }) => state.board.find((t) => t.q === q && t.r === r)?.id)
    .filter(Boolean);
  return state.players.some((p) => p.alive && neighborIds.includes(p.landscapeId));
}

function questPlacementLabel(state, questId) {
  const placement = state.tutorialFlags?.questPlacements?.find((p) => p.questId === questId);
  if (placement?.starterName) return `beside ${placement.starterName}`;
  const tile = landscapeById(state, questId);
  return tile?.name || "the quest Landscape";
}

function innocentAtticDone(state) {
  return !!state.questTracker?.mindstreamOnLandscape?.["the-attic"];
}

function innocentMeetQuestDone(state) {
  const meets = state.questTracker?.meetOnLandscape || {};
  return (meets["the-attic"] || 0) > 0 || (meets["the-basement"] || 0) > 0;
}

function innocentQuestsMarked(state) {
  const q = state.activeArchetype?.questProgress;
  return !!(q?.[0] && q?.[1]);
}

function innocentAcquired(state) {
  if (state.tutorialFlags?.archetypeAcquired) return true;
  return state.players.some((p) =>
    (p.acquiredArchetypes || []).some((a) => a.id === "innocent"));
}

/** Reset power tokens and quests for the Mark Quests step so two tokens are available. */
function primeTutorialAcquirePower(state) {
  if (!state?.tutorialMode || innocentAcquired(state)) return;

  state.players.forEach((player) => {
    if (player.alive) player.powerTokens = 1;
  });

  const visionary = state.players[0];
  if (visionary && !visionary.hand.some((c) => c.id === "psyche-power-r2")) {
    visionary.hand.push(makePowerSurge("r2"));
  }

  if (state.activeArchetype) {
    state.activeArchetype.questProgress = [false, false];
    state.activeArchetype.powerTokensOnArchetype = 0;
  }

  state.activePlayerIndex = 0;
  addLog(
    state,
    "Tutorial — each Dreamer begins with 1 Power Token. Play Power Surge on The Visionary for a second, then mark both quests.",
  );
}

/** Jump menu sections map to step indices in TUTORIAL_SCRIPT. */
export const TUTORIAL_SECTIONS = [
  { id: "welcome", label: "Welcome", stepIndex: 0 },
  { id: "reveal", label: "Reveal", stepIndex: 1 },
  { id: "explore", label: "Explore", stepIndex: 3 },
  { id: "meet", label: "Meet", stepIndex: 4 },
  { id: "round2", label: "Round 2", stepIndex: 8 },
  { id: "quests", label: "Quests", stepIndex: 12 },
  { id: "wake", label: "Wake", stepIndex: 14 },
];

/** Linear on-rails story — two rounds, lose then win, then acquire and wake. */
export const TUTORIAL_SCRIPT = [
  {
    id: "welcome",
    round: 1,
    title: "Welcome to Somnia",
    why: "You are Dreamers trapped in a collapsing Dreamscape. Psyche cards are your health AND your action points — empty hands are deadly. Spend 1 suited Psyche to unlock a phase (Lucidity Reveal, Elasticity Explore, Willpower Meet). Skipping a phase is often the plan: save cards, hold a hex, or refuse a bad Meet tax.",
    objective: "Click Continue. The sparkles show the next legal click.",
    targets: ["#active-archetype", "#phase-stepper"],
    spotlight: "#active-archetype",
  },
  {
    id: "draw-dream-r1",
    round: 1,
    title: "Reveal: Draw the Dream",
    why: "Every round the Head Dreamer draws one Dream and resolves it before anyone spends Lucidity. This one is Heroism — not a Quiet night. Each Dreamer draws Psyche equal to Willpower. You already hold a yellowish-purple Power Surge for later.",
    targets: ["#btn-draw-dream", "#board-viewport"],
    rail: [
      { kind: "drawDream", prompt: "Click Draw Dream to the left of Next Phase." },
    ],
    until: (s) => s.dreamDrawn,
  },
  {
    id: "reveal-r1",
    round: 1,
    title: "Reveal: Flip the Map",
    why: "Forgotten hexes are Wasteland. One Lucidity card opens a shared reveal budget. Flip what you will walk. Later you may skip Reveal entirely if the map is already open and you need those cards for a fight.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "handToggle", playerIndex: 0, cardId: "lucidity-1-v-l1", prompt: "Select Lucidity 1 in The Visionary's hand." },
      { kind: "revealLandscape", prompt: "Click Reveal Landscapes to the right of the selected Psyche." },
      { kind: "boardClick", tileId: "candy-mountain", reveal: true, prompt: "Click the glowing wasteland hex — Candy Mountain's hidden side." },
      { kind: "advancePhase", toPhase: "Explore", prompt: "Click Next: Explore in the top-right of the map." },
    ],
    until: (s) => getPhase(s) === "Explore",
  },
  {
    id: "explore-r1",
    round: 1,
    title: "Explore: Walk to Mandrake",
    why: "One Elasticity card unlocks shared team moves. Mandrake (Fantasy, Lucidity) lurks on The Attic. The Visionary has high Lucidity and Fantasy affinity — the right Dreamer for this beast. The Immovable can stay on The Bed; not every Dreamer has to move.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "handToggle", playerIndex: 0, cardId: "elasticity-2-v-e2", prompt: "Select Elasticity 2." },
      { kind: "spendElasticity", prompt: "Click Spend Elasticity to the right of the selected Psyche." },
      { kind: "exploreMove", playerIndex: 0, tileId: "house", prompt: "Click House — first step toward The Attic." },
      { kind: "exploreMove", playerIndex: 0, tileId: "the-attic", prompt: "Click The Attic to stand on Mandrake." },
      { kind: "advancePhase", toPhase: "Meet", prompt: "Click Next: Meet in the top-right of the map." },
    ],
    until: (s) => getPhase(s) === "Meet",
  },
  {
    id: "meet-r1",
    round: 1,
    title: "Meet: Underpay and Lose",
    why: "Willpower opens a shared Meet budget. Accept uses the beast's suit; Reject uses its Reject suit (Willpower for Mandrake). Play 1 Psyche of value 1 — far under Mandrake's Power 6. You could high-roll 1 success to their 0, but the odds are cruel. Feel the stumble.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on The Bed." },
      { kind: "handToggle", playerIndex: 1, cardId: "willpower-3-i-w3", prompt: "Select Willpower 3 to open Meet." },
      { kind: "gainMeetActions", prompt: "Click Gain Actions to the right of the selected Psyche." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on The Attic." },
      { kind: "handToggle", playerIndex: 0, cardId: "willpower-1-v-w1", prompt: "Select Willpower 1 — a thin Reject." },
      { kind: "meetReject", tileId: "the-attic", scripted: "lose", prompt: "Click The Visionary or Mandrake, then Reject." },
    ],
    until: (s) => !!s.tutorialFlags?.firstBattleLost,
  },
  {
    id: "meet-lesson",
    round: 1,
    title: "Play the Odds",
    why: "The dice can always spike a miracle: 1 success to the beast's 0. Smart tables still stack Power. Next time you will play 3 Psyche, spend a Power Token, and use The Visionary's Lucidity + Fantasy match. Recommended Power is the beast's Power + 2.",
    objective: "Click Continue — Mandrake still owns The Attic.",
    targets: ["#board-viewport"],
    spotlight: "#board-viewport",
  },
  {
    id: "meet-hold",
    round: 1,
    title: "Dreamer Power: Hold the Line",
    why: "The Immovable's Power banks +1 Psyche on every Accept or Reject during the NEXT Meet. Spend it now so Round 2's rematch is stacked. Dreamer Powers cost 1 Power Token and 1 Meet action.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on The Bed." },
      { kind: "dreamerPower", playerIndex: 1, prompt: "Click The Immovable, then Dreamer Power (Hold the Line)." },
    ],
    until: (s) => (s.anchorMeetSpreadPending || 0) >= 1,
  },
  {
    id: "meet-penalty",
    round: 1,
    title: "End Meet: The Tax",
    why: "Roaming Dreambeasts stay. End of Meet Forgets 1 Landscape per leftover beast, then each beast Fails. Candy Mountain — the hex you just opened — is about to slam shut. That is why you clear the map or skip Meet when you cannot.",
    targets: ["#btn-next-phase"],
    rail: [
      { kind: "advancePhase", toRound: 2, prompt: "Click End Round. Watch the leftover Mandrake punish the table." },
    ],
    until: (s) => s.round >= 2,
  },
  {
    id: "r2-intro",
    round: 2,
    title: "Skip What You Don't Need",
    why: "You already stand on Mandrake. Spending Lucidity or Elasticity now would waste the rematch hand. Skipping Reveal keeps Psyche. Skipping Explore keeps your hex. Skipping Meet is correct when no beasts remain and you only need to walk home.",
    objective: "Click Continue, then draw the new Dream — do not spend a phase opener unless the sparkles ask.",
    targets: ["#active-archetype", "#phase-stepper"],
    spotlight: "#active-archetype",
  },
  {
    id: "r2-dream",
    round: 2,
    title: "Round 2 Dream: Misunderstanding",
    why: "Misunderstanding Represses Mindstream cards into the Subconscious. That sting fills the graveyard The Innocent can later Return. Draw it, resolve it, then skip the rest of Reveal.",
    targets: ["#btn-draw-dream"],
    rail: [
      { kind: "drawDream", prompt: "Click Draw Dream." },
    ],
    until: (s) => atRound(s, 2) && s.dreamDrawn,
  },
  {
    id: "r2-skip",
    round: 2,
    title: "Skip Reveal and Explore",
    why: "Do not spend Lucidity — you are not flipping anything this round. Do not spend Elasticity — leaving The Attic would abandon the rematch. Next Phase on the map is how you skip.",
    closeRevealPick: true,
    targets: ["#btn-next-phase"],
    rail: [
      { kind: "advancePhase", toPhase: "Explore", prompt: "Click Next: Explore — skip leftover Reveal with no extra Psyche." },
      { kind: "advancePhase", toPhase: "Meet", prompt: "Click Next: Meet — skip Explore so The Visionary stays on Mandrake." },
    ],
    until: (s) => atRound(s, 2) && getPhase(s) === "Meet",
  },
  {
    id: "r2-rematch",
    round: 2,
    title: "Rematch: Stack the Dice",
    why: "Same Mandrake. This time Accept with Lucidity (the beast's suit). The Visionary adds Lucidity stat, Fantasy affinity, and primary-suit bonus. Play 3 Psyche, spend The Immovable's Power Token for +1d6, and Hold the Line adds +1. It will look random. It is not close.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable." },
      { kind: "handToggle", playerIndex: 1, cardId: "psyche-power-heroism-i", prompt: "Click Power Surge to refill The Immovable's token after Hold the Line." },
      { kind: "handToggle", playerIndex: 1, cardId: "willpower-1-i-w1", prompt: "Select Willpower 1 to reopen Meet." },
      { kind: "gainMeetActions", prompt: "Click Gain Actions." },
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Keep The Immovable selected to spend their token." },
      { kind: "powerBonus", playerIndex: 1, prompt: "Click +1 to Spread to spend 1 Power Token." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on The Attic." },
      {
        kind: "handToggle",
        playerIndex: 0,
        cardIds: ["lucidity-3-v-l3", "lucidity-2-v-l2", "willpower-2-v-w2"],
        prompt: "Select Lucidity 3, Lucidity 2, and Willpower 2.",
      },
      { kind: "meetAccept", tileId: "the-attic", scripted: "win", prompt: "Click The Visionary or Mandrake, then Accept." },
    ],
    until: (s) => atRound(s, 2) && (s.tutorialFlags?.encounterResolved || !encounterOnLandscape(s, "the-attic")),
  },
  {
    id: "r2-mindstream",
    round: 2,
    title: "Mindstreams: Four Card Types",
    why: "The Attic draws Lucidity Mindstream. Those decks mix Dreambeasts, Objects, Events, and Power Token / Surge cards. Drawing here also completes Innocent quest 1. Meeting Mandrake on The Attic already completed quest 2.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on The Attic." },
      {
        kind: "landscapeActionA",
        playerIndex: 0,
        landscapeId: "the-attic",
        done: (s) => innocentAtticDone(s),
        prompt: "Click The Visionary or The Attic, then Action A (Draw Lucidity Mindstream).",
      },
    ],
    until: (s) => atRound(s, 2) && innocentAtticDone(s) && innocentMeetQuestDone(s),
  },
  {
    id: "r2-acquire",
    round: 2,
    title: "Mark Quests and Acquire",
    why: "Each quest mark spends 1 Power Token and is free (no Meet action). Play the yellowish-purple Power Surge Heroism gave you, then mark both Innocent quests. Acquire grants Archetype points — reach the goal and stand on The Bed to wake.",
    target: "#active-archetype",
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary — they should hold Power Surge." },
      { kind: "handToggle", playerIndex: 0, cardId: "psyche-power-heroism", prompt: "Click Power Surge to gain 1 Power Token." },
      { kind: "completeQuest0", playerIndex: 0, prompt: "Click Quest 1 on the Active Archetype." },
      { kind: "completeQuest1", playerIndex: 0, prompt: "Click Quest 2 to spend the last token and Acquire The Innocent." },
    ],
    until: (s) => innocentAcquired(s),
  },
  {
    id: "r2-arch-power",
    round: 2,
    title: "Archetype Power",
    why: "Acquired Archetypes spend 1 Meet action and 1 Power Token. Innocent Returns 4 Repressed cards from the Subconscious — the Misunderstanding mill you just suffered. Use it.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary." },
      { kind: "archetypePower", playerIndex: 0, prompt: "Click The Visionary, then Innocent Power." },
    ],
    until: (s) => !!s.tutorialFlags?.archetypePowerUsed,
  },
  {
    id: "wake",
    round: 2,
    title: "Wake Up",
    why: "Goal reached. In a real game every living Dreamer walks back to The Bed. The Bed pulls you home now — same fanfare as beating a Daydream. You learned the R.E.M. loop, dice math, Mindstreams, quests, and powers. Go play for real.",
    objective: "Click Finish to return to The Bed and wake.",
    targets: ["#active-archetype"],
    spotlight: "#active-archetype",
  },
];

export function getTutorialObjective(state, step) {
  if (!step) return "";

  const beat = currentRailBeat(state);
  if (beat?.prompt) return beat.prompt;

  if (!step.until) {
    if (typeof step.objective === "function") return step.objective(state);
    if (typeof step.objective === "string") return step.objective;
    return "Read the step, then press Continue.";
  }

  if (step.until(state)) return "Objective complete.";

  if (typeof step.objective === "function") return step.objective(state);
  if (typeof step.objective === "string") return step.objective;

  return "Complete the highlighted action to unlock Continue.";
}


export function getTutorialStep(state) {
  if (!state?.tutorialMode) return null;
  return TUTORIAL_SCRIPT[state.tutorialStepIndex] || null;
}

export function syncTutorial(state) {
  if (!state?.tutorialMode || state.tutorialComplete) return null;

  const step = getTutorialStep(state);
  if (!step) {
    return { complete: true };
  }

  settleTutorialRail(state);

  if (step.until) {
    state.tutorialCanAdvance = step.until(state);
  } else if (step.rail?.length) {
    state.tutorialCanAdvance = railComplete(state, step);
  } else {
    state.tutorialCanAdvance = true;
  }

  const objective = getTutorialObjective(state, step);
  const decorated = decorateTutorialStep(state, step, objective);

  return {
    step: decorated,
    stepIndex: state.tutorialStepIndex,
    total: TUTORIAL_SCRIPT.length,
    canAdvance: state.tutorialCanAdvance,
    round: step.round || state.round,
    objective,
  };
}

export function advanceTutorialStep(state) {
  if (!state?.tutorialMode) return;
  const next = state.tutorialStepIndex + 1;
  if (next >= TUTORIAL_SCRIPT.length) {
    state.tutorialComplete = true;
    return;
  }
  settleTutorialRail(state);
  state.tutorialStepIndex = next;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.tutorialSuppressCatchUp = true;
}

export function retreatTutorialStep(state) {
  if (!state?.tutorialMode || state.tutorialStepIndex <= 0) return false;
  const target = state.tutorialStepIndex - 1;
  restoreTutorialSnapshot(state, target);
  state.tutorialStepIndex = target;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.tutorialSuppressCatchUp = true;
  return true;
}

export function notifyTutorialDreamDrawn(state) {
  if (!state?.tutorialMode) return;
  state.tutorialFlags.dreamsDrawn = (state.tutorialFlags.dreamsDrawn || 0) + 1;
}

function autoCompleteTutorialReturn(state) {
  if (!state?.tutorialMode || !state.pendingReturn) return;
  const pending = state.pendingReturn;
  const unused = (card) => !pending.picked.some((picked) => picked.instanceId === card.instanceId);
  const all = listSubconsciousCards(state).filter(unused);
  const prefer = all.filter((card) => card.type !== "dreambeast" && card.id !== "goofus-bird");
  const pool = prefer.length ? prefer : all;
  for (const card of pool) {
    if (!state.pendingReturn) break;
    pickReturnCard(state, card.instanceId);
  }
  state.pendingReturn = null;
}

export function notifyTutorialEncounterResolved(state, landscapeId) {
  if (!state?.tutorialMode) return;
  if (landscapeId === "house") state.tutorialFlags.encounterResolved = true;
  autoCompleteTutorialReturn(state);
}

export function notifyTutorialArchetypeAcquired(state) {
  if (!state?.tutorialMode) return;
  state.tutorialFlags.archetypeAcquired = true;
}

export function jumpTutorialToStep(state, stepIndex) {
  if (!state?.tutorialMode) return false;
  const idx = Math.max(0, Math.min(stepIndex, TUTORIAL_SCRIPT.length - 1));
  restoreTutorialSnapshot(state, idx);
  state.tutorialStepIndex = idx;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.tutorialSuppressCatchUp = true;
  return true;
}

export function completeTutorialGame(state) {
  state.players.forEach((player) => {
    if (player.alive) player.landscapeId = "bed";
  });
  state.selectedLandscapeId = "bed";
  state.tutorialComplete = true;
  state.status = "won";
  state.tutorialVictory = true;
  state.goalPoints = Math.min(state.goalPoints || 1, Math.max(1, state.acquiredPoints || 1));
  if ((state.acquiredPoints || 0) < (state.goalPoints || 1)) {
    state.acquiredPoints = state.goalPoints;
  }
  addLog(state, "The Dreamers wake up! Tutorial complete — start a Daydream when you are ready.");
}

export function graduateTutorialToPlay(state) {
  if (!state?.tutorialMode) return;
  state.tutorialComplete = true;
  state.tutorialVictory = false;
  state.tutorialGraduated = true;
  state.status = "playing";
  addLog(state, "Tutorial complete — full rules unlocked. Open Pause to save this practice table.");
}

export function releaseTutorialToPractice(state) {
  if (!state?.tutorialMode) return;
  state.tutorialComplete = true;
  state.tutorialVictory = false;
  state.status = "playing";
  addLog(state, "Guided steps ended — practice freely on this table, or return to the menu for a Daydream.");
}

export function isInteractiveTutorialActive(state) {
  return !!(state?.tutorialMode && !state.tutorialComplete);
}

// -- Tutorial spotlight (pure — safe for Node audits) -----------------

const TUTORIAL_BOARD_SELECTORS = new Set([
  "#board-viewport", "#hex-board", "#player-list", "#dreamer-dock",
]);

export function getTutorialStepTargetSelectors(step) {
  if (!step) return [];
  if (Array.isArray(step.targets) && step.targets.length) return step.targets;
  if (step.target) return [step.target];
  return [];
}

export function getTutorialSpotlightSelector(step, { utilityModalOpen = false } = {}) {
  if (!step) return null;
  if (utilityModalOpen) return "#utility-modal .utility-content";
  if (step.spotlight) return step.spotlight;
  const selectors = getTutorialStepTargetSelectors(step);
  if (!selectors.length) return null;
  if (selectors.some((s) => s.includes("#btn-next-phase") || s.includes("data-tutorial-action=\"advancePhase\""))) {
    return "#btn-next-phase";
  }
  if (selectors.some((s) => s.includes("#btn-draw-dream") || s.includes("data-tutorial-action=\"drawDream\""))) {
    return "#btn-draw-dream";
  }
  if (selectors.some((s) => s.includes("#btn-spread-opener"))) {
    return "#btn-spread-opener";
  }
  if (selectors.includes("#active-encounter")) return "#active-encounter";
  const radialSel = selectors.find((s) => s.includes("radial-menu-item"));
  if (radialSel && !selectors.includes("#board-viewport")) return radialSel;
  const dreamerSel = selectors.find((s) => s.includes("hex-occupant-dreamer"));
  if (dreamerSel) return dreamerSel;
  if (selectors.length > 1) {
    const primary = selectors.find((s) => !TUTORIAL_BOARD_SELECTORS.has(s));
    if (primary) return primary;
  }
  if (selectors.includes("#board-viewport")) return "#board-viewport";
  if (selectors.includes("#dreamer-dock")) return "#dreamer-dock";
  if (selectors.includes("#player-list")) return "#player-list";
  return selectors[0];
}
