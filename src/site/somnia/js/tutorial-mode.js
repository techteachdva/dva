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
const TUTORIAL_SNAPSHOT_VERSION = 23;
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
  state.tutorialFlags = {
    dreamsDrawn: 0,
    encounterResolved: false,
    archetypeAcquired: false,
    acquirePowerPrimed: false,
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
    setEncounterOnLandscape(state, "the-basement", {
      ...mandrake,
      name: "Mandrake",
      type: "dreambeast",
      instanceId: tutorialUid("enc-mandrake-basement"),
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
      if (ids.includes("psyche-power-r2")) {
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
    case "meetAccept": {
      const tileId = beat.tileId || "house";
      const tile = landscapeById(state, tileId);
      if (tile && tileEncounters(tile).length === 0) return true;
      if (tileId === "house" && state.tutorialFlags?.encounterResolved) return true;
      return false;
    }
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
      return kind === "drawDream" || kind === "dreamerSelect";
    case "revealLandscape":
      return kind === "revealLandscape" || kind === "dreamerSelect";
    case "boardClick":
      return (kind === "boardClick" || kind === "exploreMove") && detail.tileId === beat.tileId;
    case "spendElasticity":
      return kind === "spendElasticity" || kind === "dreamerSelect";
    case "exploreMove":
      if (kind !== "exploreMove" && kind !== "boardClick") return false;
      return exploreMoveAllowed(state, detail.tileId, [beat.tileId], beat.playerIndex);
    case "gainMeetActions":
      return kind === "gainMeetActions" || kind === "dreamerSelect";
    case "meetAccept":
      if (kind === "meetAccept" || kind === "beastRadial" || kind === "dreamerSelect") return true;
      return kind === "boardClick" && detail.tileId === "house";
    case "advancePhase":
      return kind === "advancePhase" || kind === "dreamerSelect";
    case "landscapeActionA":
      if (kind === "landscapeActionA" || kind === "dreamerSelect") return true;
      return kind === "boardClick" && detail.tileId === beat.landscapeId;
    case "completeQuest0":
    case "completeQuest1":
      return (kind === beat.kind || kind === "dreamerSelect")
        && (kind === "dreamerSelect" || state.activePlayerIndex === (beat.playerIndex ?? 0));
    default:
      return false;
  }
}

function settleTutorialRail(state) {
  const step = getTutorialStep(state);
  if (!step) return;

  if (step.id === "r2-acquire" && !innocentAcquired(state)) {
    if (!state.tutorialFlags.acquirePowerPrimed) {
      primeTutorialAcquirePower(state);
      state.tutorialFlags.acquirePowerPrimed = true;
    }
  } else if (state.tutorialFlags) {
    state.tutorialFlags.acquirePowerPrimed = false;
  }

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
  if (step.id === "r2-intro") {
    return { tileId: "the-attic", key: "r2-intro:the-attic", zoom: 1.5 };
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
      const focusCard = nextCard || (player && ids.length
        ? player.hand.find((c) => ids.includes(c.id))
        : null);
      if (focusCard) {
        const cardSel = `.game-card[data-instance-id="${focusCard.instanceId}"]`;
        return {
          targets: ["#hand-bar", cardSel],
          spotlight: cardSel,
        };
      }
      return {
        targets: ["#hand-bar"],
        spotlight: "#hand-bar",
      };
    }
    case "drawDream":
    case "revealLandscape":
    case "spendElasticity":
    case "gainMeetActions":
      return radialOrDreamerHighlight(state, beat, beat.kind);
    case "meetAccept": {
      const highlight = radialOrDreamerHighlight(state, beat, "meetAccept");
      const tileId = beat.tileId || player?.landscapeId || "house";
      highlight.targets.push(`.hex-tile[data-tile-id="${tileId}"] .hex-occupant-beast`);
      return highlight;
    }
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
    case "landscapeActionA": {
      const hexSel = `.hex-tile[data-tile-id="${beat.landscapeId}"]`;
      const highlight = radialOrDreamerHighlight(state, beat, "landscapeActionA");
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
      const highlight = radialOrDreamerHighlight(state, beat, beat.kind);
      highlight.targets.push("#active-archetype");
      return highlight;
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
  if (kind === "handToggle" && detail.card?.type === "psyche-power") {
    const step = getTutorialStep(state);
    if (step?.id !== "r2-acquire") return false;
    const beat = currentRailBeat(state);
    return beat?.kind === "handToggle" && requiredCardIds(beat).includes(detail.card?.id);
  }
  if (kind === "phasePowerToken" || kind === "dreamerPower" || kind === "powerBonus" || kind === "refundPowerBonus") {
    return false;
  }
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
    why: "You are Dreamers trapped in a collapsing Dreamscape. Cooperate to earn Archetype points and wake up before the Dream Deck runs out.",
    objective: "Click Continue. Rules live in ? and Pause → Help.",
    targets: ["#active-archetype", "#phase-stepper"],
    spotlight: "#active-archetype",
  },
  {
    id: "draw-dream-r1",
    round: 1,
    title: "Reveal: Draw the Dream",
    why: "Every round the Head Dreamer draws one Dream that twists the table. Resolve it first so you know what the map is doing this round.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "drawDream", prompt: "Click The Visionary on the board, then Draw & Resolve Dream." },
    ],
    until: (s) => s.dreamDrawn,
  },
  {
    id: "reveal-r1",
    round: 1,
    title: "Reveal: Flip the Map",
    why: "Forgotten hexes are Wasteland. Spending 1 Lucidity sets a shared reveal budget so the team can flip tiles face-up and walk them later.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "handToggle", playerIndex: 0, cardId: "lucidity-1-v-l1", prompt: "Select Lucidity 1 in The Visionary's hand." },
      { kind: "revealLandscape", prompt: "Click The Visionary on the board, then Reveal Landscapes." },
      { kind: "boardClick", tileId: "candy-mountain", reveal: true, prompt: "Click the glowing wasteland hex — that is Candy Mountain's hidden side." },
      { kind: "advancePhase", toPhase: "Explore", prompt: "Click Next: Explore in the top-right of the map." },
    ],
    until: (s) => getPhase(s) === "Explore",
  },
  {
    id: "explore-r1",
    round: 1,
    title: "Explore: Walk the Map",
    why: "One Elasticity card unlocks shared team moves. You need to stand on a Landscape to Meet what lives there, so move The Visionary onto House.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "handToggle", playerIndex: 0, cardId: "elasticity-2-v-e2", prompt: "Select Elasticity 2." },
      { kind: "spendElasticity", prompt: "Click The Visionary on the board, then Spend Elasticity." },
      { kind: "exploreMove", playerIndex: 0, tileId: "house", prompt: "Click House to move The Visionary there." },
      { kind: "advancePhase", toPhase: "Meet", prompt: "Click Next: Meet in the top-right of the map." },
    ],
    until: (s) => getPhase(s) === "Meet",
  },
  {
    id: "meet-r1",
    round: 1,
    title: "Meet: Dreambeasts and Luck",
    why: "Willpower opens a shared action budget. Accepting a Dreambeast spends Psyche and keeps it as a 3-value ally. Only the Dreamer on that hex can Meet it.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "handToggle", playerIndex: 0, cardId: "willpower-2-v-w2", prompt: "Select Willpower 2." },
      { kind: "gainMeetActions", prompt: "Click The Visionary on the board, then Gain Actions." },
      {
        kind: "handToggle",
        playerIndex: 0,
        cardIds: ["lucidity-3-v-l3", "lucidity-2-v-l2"],
        prompt: "Select Lucidity 3 and Lucidity 2.",
      },
      { kind: "meetAccept", tileId: "house", prompt: "Click The Visionary or Mandrake, then Accept." },
      { kind: "advancePhase", toRound: 2, prompt: "Click End Round in the top-right of the map to start Round 2." },
    ],
    until: (s) => s.round >= 2,
  },
  {
    id: "r2-intro",
    round: 2,
    title: "Now Chase the Archetype",
    why: "Points come from completing both quests on the Active Archetype, then Acquiring it. The Innocent needs a Mindstream draw on The Attic and a Meet on The Attic or The Basement.",
    objective: "The Innocent wants Mindstream on The Attic and a Dreambeast Met on The Attic or The Basement.",
    targets: ["#active-archetype", "#board-viewport"],
    spotlight: "#board-viewport",
  },
  {
    id: "r2-reveal",
    round: 2,
    title: "Round 2 - Reveal",
    why: "Round 2 repeats Reveal: draw the Dream, then spend one Lucidity to keep opening the map. Unused leftover reveals can be skipped with Next Phase.",
    closeRevealPick: true,
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "drawDream", prompt: "Click The Visionary on the board, then Draw & Resolve Dream." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "handToggle", playerIndex: 0, cardId: "lucidity-2-r2-a", prompt: "Select Lucidity 2." },
      { kind: "revealLandscape", prompt: "Click The Visionary on the board, then Reveal Landscapes." },
      { kind: "advancePhase", toPhase: "Explore", prompt: "Click Next: Explore in the top-right of the map." },
    ],
    until: (s) => atRound(s, 2) && getPhase(s) === "Explore",
  },
  {
    id: "r2-explore",
    round: 2,
    title: "Round 2 - Explore to Quests",
    why: "Quest Landscapes only count if a Dreamer is standing on them. Move The Visionary to The Attic and The Immovable to The Basement before Meet.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on the board." },
      { kind: "handToggle", playerIndex: 1, cardId: "elasticity-3-i-e3", prompt: "Select Elasticity 3." },
      { kind: "spendElasticity", prompt: "Click The Immovable on the board, then Spend Elasticity." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board." },
      { kind: "exploreMove", playerIndex: 0, tileId: "the-attic", prompt: "Click The Attic to move The Visionary there." },
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on the board." },
      { kind: "exploreMove", playerIndex: 1, tileId: "city", prompt: "Click City to move The Immovable there." },
      { kind: "exploreMove", playerIndex: 1, tileId: "the-basement", prompt: "Click The Basement to move The Immovable there." },
      { kind: "advancePhase", toPhase: "Meet", prompt: "Click Next: Meet in the top-right of the map." },
    ],
    until: (s) => atRound(s, 2) && getPhase(s) === "Meet",
  },
  {
    id: "r2-meet",
    round: 2,
    title: "Round 2 - Quest Landscapes",
    why: "Open a shared Meet budget first. Draw Mindstream on The Attic for Innocent quest 1 — it is repeatable. Accepting the beast on The Basement marks quest 2. Unique Landscape actions are once per Dreamer.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on The Basement." },
      { kind: "handToggle", playerIndex: 1, cardId: "willpower-3-i-w3", prompt: "Select Willpower 3." },
      { kind: "gainMeetActions", prompt: "Click The Immovable on The Basement, then Gain Actions." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on The Attic." },
      {
        kind: "landscapeActionA",
        playerIndex: 0,
        landscapeId: "the-attic",
        done: (s) => innocentAtticDone(s),
        prompt: "Click The Visionary on The Attic, then Action A (Draw Lucidity Mindstream).",
      },
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Immovable on The Basement." },
      {
        kind: "handToggle",
        playerIndex: 1,
        cardIds: ["elasticity-2-i-e2", "lucidity-2-i-l2", "willpower-1-i-w1"],
        prompt: "Select Elasticity 2, Lucidity 2, and Willpower 1 for Accept.",
      },
      {
        kind: "meetAccept",
        tileId: "the-basement",
        done: (s) => innocentMeetQuestDone(s),
        prompt: "Click The Immovable or the Dreambeast on The Basement, then Accept.",
      },
    ],
    until: (s) => atRound(s, 2) && innocentAtticDone(s) && innocentMeetQuestDone(s),
  },
  {
    id: "r2-acquire",
    round: 2,
    title: "Mark Quests and Acquire",
    why: "Each completed quest costs 1 Power Token. Power Surge is yellowish-purple and can be clicked any phase for a token. Mark both quests to Acquire The Innocent.",
    target: "#active-archetype",
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board — they hold Power Surge." },
      { kind: "handToggle", playerIndex: 0, cardId: "psyche-power-r2", prompt: "Click Power Surge to gain 1 Power Token (2 total on The Visionary)." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board to mark Quest 1." },
      { kind: "completeQuest0", playerIndex: 0, prompt: "Click The Visionary on the board, then Quest 1, and spend 1 Power Token." },
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Visionary on the board to mark Quest 2." },
      { kind: "completeQuest1", playerIndex: 0, prompt: "Click The Visionary on the board, then Quest 2, and spend 1 Power Token to acquire The Innocent." },
    ],
    until: (s) => innocentAcquired(s),
  },
  {
    id: "graduate",
    round: 2,
    title: "Go Play",
    why: "You now know the R.E.M. loop: Reveal, Explore, Meet, then Next Phase on the map. A real Daydream uses shuffled Landscapes and the full Meet tax.",
    objective: "Click Finish, then play a Daydream. Rules stay in ? and !.",
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
  if (landscapeId === "house" || landscapeId === "the-basement") {
    if (landscapeId === "house") state.tutorialFlags.encounterResolved = true;
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
