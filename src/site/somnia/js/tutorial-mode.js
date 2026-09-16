import {
  createInitialState,
  getPhase,
  addLog,
  setEncounterOnLandscape,
  landscapeById,
  encounterOnLandscape,
  tileEncounters,
  checkDreamerPsycheDeath,
} from "./state.js";
import { meetPsycheActor } from "./rules.js";
import { hexNeighbors, getLegalMoveTargets } from "./hex.js";
import { precomputeTutorialSnapshots } from "./tutorial-canonical.js";
import { resetBoardMotion } from "./board-fx.js";

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
const TUTORIAL_SNAPSHOT_VERSION = 15;
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
  });

  state.tutorialMode = true;
  state.tutorialStepIndex = 0;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.tutorialFlags = {
    dreamsDrawn: 0,
    encounterResolved: false,
    archetypeAcquired: false,
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
  });

  state.players[0].hand = [
    makePsyche("lucidity", 3, "v-l3"),
    makePsyche("lucidity", 2, "v-l2"),
    makePsyche("elasticity", 2, "v-e2"),
    makePsyche("willpower", 2, "v-w2"),
    makePsyche("lucidity", 1, "v-l1"),
    makePsyche("elasticity", 1, "v-e1"),
    makePsyche("willpower", 1, "v-w1"),
  ];
  state.players[1].hand = [
    makePsyche("willpower", 3, "i-w3"),
    makePsyche("elasticity", 3, "i-e3"),
    makePsyche("elasticity", 2, "i-e2"),
    makePsyche("lucidity", 2, "i-l2"),
    makePsyche("willpower", 1, "i-w1"),
  ];

  const quiet = data.dreams.find((d) => d.id === "quiet");
  const extraQuiets = [];
  for (let i = 0; i < 8; i += 1) {
    extraQuiets.push(mkDream(quiet));
  }
  state.dreamDeck = [
    mkDream(quiet),
    mkDream(quiet),
    ...extraQuiets,
  ];
  state.dreamDiscard = [];

  setupTutorialQuestLandscapes(state);

  const mandrake = data.dreambeasts.find((b) => b.id === "mandrake");
  if (mandrake) {
    setEncounterOnLandscape(state, "house", {
      ...mandrake,
      type: "dreambeast",
      instanceId: tutorialUid("enc-mandrake"),
    });
  }

  stabilizeTutorialDecks(state);
  state.psycheDeck = [
    makePowerSurge("r2"),
    makePsyche("lucidity", 2, "r2-a"),
    makePsyche("lucidity", 1, "r2-b"),
    ...state.psycheDeck.filter((card) => card.type !== "psyche-power"),
  ];
  reseedTutorialInstanceIds(state);

  const placementNote = (state.tutorialFlags.questPlacements || [])
    .map((p) => `${p.questId === "the-attic" ? "The Attic" : "The Basement"} beside ${p.starterName}`)
    .join("; ");

  state.log = [
    "Tutorial Mode: on-rails - click only the highlighted Dreamer, cards, and hexes.",
    "Round 1 begins in the Reveal Phase. Your Active Archetype is The Innocent.",
    placementNote ? `Quest Landscapes revealed: ${placementNote}.` : "Quest Landscapes The Attic and The Basement are revealed beside House and City.",
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
  "r2-intro",
  "graduate",
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

function railBeatStickyComplete(state, beat, directComplete) {
  if (directComplete()) return true;
  const step = getTutorialStep(state);
  const beatIndex = step?.rail?.indexOf(beat) ?? -1;
  if (beatIndex < 0 || !step?.rail) return false;
  for (let i = beatIndex + 1; i < step.rail.length; i += 1) {
    if (isRailBeatComplete(state, step.rail[i])) return true;
  }
  return false;
}

function dreamerSelectBeatComplete(state, beat) {
  return railBeatStickyComplete(state, beat, () => state.activePlayerIndex === beat.playerIndex);
}

function exploreMoveBeatComplete(state, beat) {
  return railBeatStickyComplete(
    state,
    beat,
    () => state.players[beat.playerIndex]?.landscapeId === beat.tileId,
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
      return houseEncounterCleared(state) || !!state.tutorialFlags?.encounterResolved;
    case "advancePhase":
      if (beat.toRound) return state.round >= beat.toRound;
      return getPhase(state) === beat.toPhase;
    case "landscapeActionA":
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
  return step.rail.find((beat) => !isRailBeatComplete(state, beat)) || null;
}

function railComplete(state, step) {
  if (!step?.rail?.length) return true;
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
      if (kind === "meetAccept" || kind === "beastRadial") return true;
      return kind === "boardClick" && detail.tileId === "house";
    case "advancePhase":
      return kind === "advancePhase";
    case "landscapeActionA":
      if (kind === "landscapeActionA") return true;
      return kind === "boardClick" && detail.tileId === beat.landscapeId;
    case "completeQuest0":
      return kind === "completeQuest0";
    case "completeQuest1":
      return kind === "completeQuest1";
    default:
      return false;
  }
}

function settleTutorialRail(state) {
  const step = getTutorialStep(state);
  if (!step) return;

  const revealBeat = step.rail?.find((beat) => beat.kind === "boardClick" && beat.reveal);
  if (revealBeat && landscapeById(state, revealBeat.tileId)?.revealed && state.landscapePick?.mode === "reveal") {
    state.revealLandscapeUsed = true;
    state.landscapePick = null;
  }

  if (step.closeRevealPick && state.landscapePick?.mode === "reveal") {
    state.revealLandscapeUsed = true;
    state.landscapePick = null;
  }

  const beat = currentRailBeat(state);
  if (beat?.kind === "advancePhase" && state.landscapePick) {
    if (state.landscapePick.mode === "reveal" && !state.landscapePick.freeReveal) {
      state.revealLandscapeUsed = true;
    }
    state.landscapePick = null;
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

  if (step.id === "reveal-r1") {
    return { tileId: "candy-mountain", key: "reveal-r1:candy-mountain", zoom: 1.7 };
  }
  if (step.id === "r2-intro") {
    return { tileId: "the-attic", key: "r2-intro:the-attic", zoom: 1.5 };
  }

  const tileId = beat?.tileId || beat?.landscapeId || (beat?.kind === "meetAccept" ? "house" : null);
  if (!tileId) return null;
  return {
    tileId,
    key: `${state.tutorialStepIndex}:${beat.kind}:${tileId}`,
    zoom: 1.55,
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
  const cardIds = requiredCardIds(beat);
  const firstCard = player && cardIds.length === 1
    ? player.hand.find((c) => c.id === cardIds[0])
    : null;

  switch (beat.kind) {
    case "dreamerSelect":
      return {
        targets: [
          playerId ? `.player-chip[data-player-id="${playerId}"]` : "#dreamer-dock",
          "#dreamer-dock",
        ],
        spotlight: playerId ? `.player-chip[data-player-id="${playerId}"]` : "#dreamer-dock",
      };
    case "handToggle":
      return {
        targets: firstCard
          ? [`#hand-bar`, `.game-card[data-instance-id="${firstCard.instanceId}"]`]
          : ["#hand-bar"],
        spotlight: firstCard
          ? `.game-card[data-instance-id="${firstCard.instanceId}"]`
          : "#hand-bar",
      };
    case "drawDream":
    case "revealLandscape":
    case "spendElasticity":
    case "gainMeetActions":
      return { targets: ["#phase-actions"], spotlight: "#phase-actions" };
    case "meetAccept":
      return {
        targets: ["#phase-actions", `.hex-tile[data-tile-id="house"]`],
        spotlight: "#phase-actions",
      };
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
      return { targets: ["#btn-advance-phase"], spotlight: "#btn-advance-phase" };
    case "landscapeActionA":
      return {
        targets: [
          `.hex-tile[data-tile-id="${beat.landscapeId}"]`,
          "#phase-actions",
          "#board-viewport",
        ],
        spotlight: `.hex-tile[data-tile-id="${beat.landscapeId}"]`,
      };
    case "completeQuest0":
    case "completeQuest1":
      return { targets: ["#active-archetype", "#phase-actions"], spotlight: "#active-archetype" };
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
    objectiveText: objective,
  };
}

export function classifyPhaseAction(action) {
  const label = action?.label || "";
  if (label.startsWith("Draw & Resolve")) return "drawDream";
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
  if (/Action A/i.test(label) || label.startsWith("Draw [")) return "landscapeActionA";
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
  if (kind === "handToggle" && detail.card?.type === "psyche-power") return true;
  if (kind === "tutorialNav") return true;
  if (kind === "powerTokenMenu") {
    const current = getTutorialStep(state);
    return current?.id === "r2-acquire" || TUTORIAL_INFO_STEPS.has(current?.id);
  }

  const step = getTutorialStep(state);
  if (!step) return true;

  if (kind === "phaseAction") {
    kind = classifyPhaseAction(detail.action);
  }

  if (kind === "headerOverview" || kind === "headerDreamFeed" || kind === "headerMomentHistory" || kind === "headerPause") {
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

function innocentBasementDone(state) {
  return !!state.questTracker?.mindstreamOnLandscape?.["the-basement"];
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

/** Jump menu sections map to step indices in TUTORIAL_SCRIPT. */
export const TUTORIAL_SECTIONS = [
  { id: "welcome", label: "Welcome", stepIndex: 0 },
  { id: "reveal", label: "Reveal", stepIndex: 1 },
  { id: "explore", label: "Explore", stepIndex: 3 },
  { id: "meet", label: "Meet", stepIndex: 4 },
  { id: "round2", label: "Round 2", stepIndex: 5 },
  { id: "quests", label: "Quests", stepIndex: 7 },
  { id: "graduate", label: "Finish", stepIndex: 10 },
];

/** Linear on-rails script — two rounds, exact clicks. */
export const TUTORIAL_SCRIPT = [
  {
    id: "welcome",
    round: 1,
    title: "Welcome to Somnia",
    body: "Every round is Reveal, Explore, Meet. Flip wasteland into Landscapes, walk onto them, then Meet: draw Mindstream (luck, good and bad) or deal with Dreambeasts. Once the map is open, chase the Active Archetype's quests. Click only the highlights. Overview and Tips hold the rest of the rules - you will learn the cards by playing.",
    targets: ["#active-archetype", "#phase-stepper"],
    spotlight: "#active-archetype",
  },
  {
    id: "draw-dream-r1",
    round: 1,
    title: "Reveal: Draw the Dream",
    body: "Reveal starts with a Dream. The Head (*) draws one each round. Quiet does nothing - many Dreams do. Click Draw & Resolve Dream.",
    target: "#phase-actions",
    rail: [
      { kind: "drawDream", prompt: "Click Draw & Resolve Dream." },
    ],
    until: (s) => s.dreamDrawn,
  },
  {
    id: "reveal-r1",
    round: 1,
    title: "Reveal: Flip the Map",
    body: "Early game, spend Lucidity to flip wasteland hexes into Landscapes. More map means more places to Explore and Meet. Click The Visionary, Lucidity 1, Reveal Landscapes, then the glowing wasteland (Candy Mountain). Extra flips are skipped here. Then Next: Explore.",
    targets: ["#hand-bar", "#phase-actions", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary (dock chip or map token)." },
      { kind: "handToggle", playerIndex: 0, cardId: "lucidity-1-v-l1", prompt: "Select Lucidity 1 in The Visionary's hand." },
      { kind: "revealLandscape", prompt: "Click Reveal Landscapes." },
      { kind: "boardClick", tileId: "candy-mountain", reveal: true, prompt: "Click the glowing wasteland hex - that is Candy Mountain's hidden side." },
      { kind: "advancePhase", toPhase: "Explore", prompt: "Click Next: Explore." },
    ],
    until: (s) => getPhase(s) === "Explore",
  },
  {
    id: "explore-r1",
    round: 1,
    title: "Explore: Walk the Map",
    body: "Explore is movement. Spend Elasticity for a shared move budget, then walk onto Landscapes you want to Meet on - you cannot move during Meet. Click The Visionary, Elasticity 2, Spend Elasticity, then House (Mandrake is there). Then Next: Meet.",
    targets: ["#hand-bar", "#phase-actions", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary." },
      { kind: "handToggle", playerIndex: 0, cardId: "elasticity-2-v-e2", prompt: "Select Elasticity 2." },
      { kind: "spendElasticity", prompt: "Click Spend Elasticity." },
      { kind: "exploreMove", playerIndex: 0, tileId: "house", prompt: "Click House to move The Visionary there." },
      { kind: "advancePhase", toPhase: "Meet", prompt: "Click Next: Meet." },
    ],
    until: (s) => getPhase(s) === "Meet",
  },
  {
    id: "meet-r1",
    round: 1,
    title: "Meet: Dreambeasts and Luck",
    body: "Meet is where the table comes alive, with Dreambeasts, Events, Objects, and Actions. Spend Willpower for shared actions, then Accept or Reject Dreambeasts. The Accept icon's color is the Psyche you must play: Mandrake's Accept 6 blue eye means at least 1 Lucidity, and The Visionary's Lucidity is added to the total. Click The Visionary, Willpower 2, Gain Actions, Lucidity 3 and 2, then Accept Mandrake. Then Next Phase.",
    targets: ["#hand-bar", "#phase-actions", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary." },
      { kind: "handToggle", playerIndex: 0, cardId: "willpower-2-v-w2", prompt: "Select Willpower 2." },
      { kind: "gainMeetActions", prompt: "Click Gain Actions." },
      {
        kind: "handToggle",
        playerIndex: 0,
        cardIds: ["lucidity-3-v-l3", "lucidity-2-v-l2"],
        prompt: "Select Lucidity 3 and Lucidity 2.",
      },
      { kind: "meetAccept", prompt: "Click Accept on Mandrake. The blue eye means play at least 1 Lucidity; The Visionary's Lucidity adds to the total." },
      { kind: "advancePhase", toRound: 2, prompt: "Click Next Phase to end Round 1." },
    ],
    until: (s) => s.round >= 2,
  },
  {
    id: "r2-intro",
    round: 2,
    title: "Now Chase the Archetype",
    body: "Priority shifts to the Active Archetype. You just drew Power Surge from the Psyche deck - click it anytime, any phase, for 1 Power Token. The Innocent wants Mindstream on The Attic and The Basement (glowing). Same R.E.M. loop - reveal and explore only as needed, then Meet on those tiles.",
    targets: ["#active-archetype", "#board-viewport"],
    spotlight: "#board-viewport",
  },
  {
    id: "r2-reveal",
    round: 2,
    title: "Round 2 - Reveal",
    body: "Same Reveal: draw the Dream, spend Lucidity. In a real game you would keep flipping map. Here we skip extra hexes so you can hunt quests. Then Next: Explore.",
    closeRevealPick: true,
    targets: ["#phase-actions", "#hand-bar"],
    rail: [
      { kind: "drawDream", prompt: "Click Draw & Resolve Dream." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary." },
      { kind: "handToggle", playerIndex: 0, cardId: "lucidity-2-r2-a", prompt: "Select Lucidity 2." },
      { kind: "revealLandscape", prompt: "Click Reveal Landscapes." },
      { kind: "advancePhase", toPhase: "Explore", prompt: "Click Next: Explore." },
    ],
    until: (s) => atRound(s, 2) && getPhase(s) === "Explore",
  },
  {
    id: "r2-explore",
    round: 2,
    title: "Round 2 - Explore to Quests",
    body: "Walk Dreamers onto the quest Landscapes before Meet. Click The Immovable, Elasticity 3, Spend Elasticity. Move The Visionary to The Attic, then The Immovable via City onto The Basement. Then Next: Meet.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable." },
      { kind: "handToggle", playerIndex: 1, cardId: "elasticity-3-i-e3", prompt: "Select Elasticity 3." },
      { kind: "spendElasticity", prompt: "Click Spend Elasticity." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary." },
      { kind: "exploreMove", playerIndex: 0, tileId: "the-attic", prompt: "Click The Attic to move The Visionary there." },
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable." },
      { kind: "exploreMove", playerIndex: 1, tileId: "city", prompt: "Click City to move The Immovable there." },
      { kind: "exploreMove", playerIndex: 1, tileId: "the-basement", prompt: "Click The Basement to move The Immovable there." },
      { kind: "advancePhase", toPhase: "Meet", prompt: "Click Next: Meet." },
    ],
    until: (s) => atRound(s, 2) && getPhase(s) === "Meet",
  },
  {
    id: "r2-meet",
    round: 2,
    title: "Round 2 - Draw Mindstream",
    body: "Landscape Action A draws that tile's Mindstream suit: luck, plus quest progress. That is the usual Meet beat once the map is open. Spend Willpower 3, then Action A on The Attic and The Basement.",
    targets: ["#phase-actions", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable." },
      { kind: "handToggle", playerIndex: 1, cardId: "willpower-3-i-w3", prompt: "Select Willpower 3." },
      { kind: "gainMeetActions", prompt: "Click Gain Actions." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on The Attic." },
      {
        kind: "landscapeActionA",
        playerIndex: 0,
        landscapeId: "the-attic",
        done: (s) => innocentAtticDone(s),
        prompt: "Click The Attic, then Action A (Draw Lucidity Mindstream).",
      },
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on The Basement." },
      {
        kind: "landscapeActionA",
        playerIndex: 1,
        landscapeId: "the-basement",
        done: (s) => innocentBasementDone(s),
        prompt: "Click The Basement, then Action A (Draw Willpower Mindstream).",
      },
    ],
    until: (s) => atRound(s, 2) && innocentAtticDone(s) && innocentBasementDone(s),
  },
  {
    id: "r2-acquire",
    round: 2,
    title: "Mark Quests and Acquire",
    body: "Each quest costs 1 Power Token to mark. You started with 1, so click Power Surge for a second token, then Quest 1 and Quest 2. Marking the last one acquires the Archetype.",
    target: "#active-archetype",
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary — they hold Power Surge." },
      { kind: "handToggle", playerIndex: 0, cardId: "psyche-power-r2", prompt: "Click Power Surge for 1 Power Token." },
      { kind: "completeQuest0", prompt: "Click Quest 1 and spend 1 Power Token." },
      { kind: "completeQuest1", prompt: "Click Quest 2 and spend 1 Power Token to acquire The Innocent." },
    ],
    until: (s) => innocentAcquired(s),
  },
  {
    id: "graduate",
    round: 2,
    title: "Go Play",
    body: "You know the loop: Reveal the map, Explore onto it, Meet to draw Mindstream and finish quests. The rest is the cards. Press Finish for a gentle Daydream. Overview and Tips are there if you want them.",
    target: "#phase-stepper",
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

export function notifyTutorialEncounterResolved(state, landscapeId) {
  if (!state?.tutorialMode) return;
  if (landscapeId === "house") {
    state.tutorialFlags.encounterResolved = true;
  }
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
  state.tutorialComplete = true;
  state.status = "won";
  state.tutorialVictory = true;
  addLog(state, "Tutorial complete — start a Daydream when you are ready.");
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
  if (selectors.includes("#btn-advance-phase")) return "#btn-advance-phase";
  if (selectors.includes("#phase-advance-bar") && !selectors.includes("#board-viewport")) {
    return "#btn-advance-phase";
  }
  if (selectors.includes("#active-encounter")) return "#active-encounter";
  if (selectors.includes("#phase-actions") && !selectors.includes("#board-viewport")) {
    return "#phase-actions";
  }
  if (selectors.length > 1) {
    const primary = selectors.find((s) => !TUTORIAL_BOARD_SELECTORS.has(s));
    if (primary) return primary;
  }
  if (selectors.includes("#board-viewport")) return "#board-viewport";
  if (selectors.includes("#dreamer-dock")) return "#dreamer-dock";
  if (selectors.includes("#player-list")) return "#player-list";
  return selectors[0];
}
