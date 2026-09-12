import {
  createInitialState,
  getPhase,
  addLog,
  setEncounterOnLandscape,
  landscapeById,
  checkDreamerPsycheDeath,
} from "./state.js";
import { meetPsycheActor } from "./rules.js";
import { uid } from "./data.js";
import { encounterFromDreambeastCard } from "./mindstream-supply.js";
import { hexNeighbors, getLegalMoveTargets } from "./hex.js";

export const TUTORIAL_DREAMER_IDS = ["the-visionary", "the-runner"];
export const TUTORIAL_MAX_ROUND = 5;
const TUTORIAL_STARTER_IDS = ["city", "sky", "forest", "road", "house", "suburbia"];

function makePsyche(suit, value, tag) {
  const label = suit.charAt(0).toUpperCase() + suit.slice(1);
  return {
    id: `${suit}-${value}-${tag}`,
    type: "psyche",
    suit,
    value,
    name: `${label} ${value}`,
    instanceId: uid(`tut-${tag}`),
  };
}

function mkDream(template, extra = {}) {
  return { ...template, ...extra, instanceId: uid("tut-dream") };
}

export function createTutorialState(data) {
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
      instanceId: uid("tut-arch"),
      questProgress: [false, false],
      powerTokensOnArchetype: 0,
    };
    state.archetypeDeck = state.archetypeDeck.filter((a) => a.id !== "innocent");
  }

  state.players.forEach((p) => {
    p.powerTokens = 4;
  });

  state.players[0].hand = [
    makePsyche("lucidity", 3, "v-l3"),
    makePsyche("lucidity", 2, "v-l2"),
    makePsyche("elasticity", 2, "v-e2"),
    makePsyche("willpower", 2, "v-w2"),
    makePsyche("lucidity", 1, "v-l1"),
  ];
  state.players[1].hand = [
    makePsyche("elasticity", 3, "r-e3"),
    makePsyche("elasticity", 2, "r-e2"),
    makePsyche("lucidity", 2, "r-l2"),
    makePsyche("willpower", 3, "r-w3"),
    makePsyche("elasticity", 1, "r-e1"),
  ];

  const quiet = data.dreams.find((d) => d.id === "quiet");
  const heroism = data.dreams.find((d) => d.id === "heroism");
  const cerberus = data.dreambeasts.find((b) => b.id === "cerberus");

  state.dreamDeck = [
    mkDream(quiet),
    mkDream(quiet),
    mkDream(cerberus, { type: "boss-dream", boss: true }),
    mkDream(heroism),
    mkDream(quiet),
    ...state.dreamDeck.slice(5),
  ];

  setupTutorialQuestLandscapes(state);

  const mandrake = data.dreambeasts.find((b) => b.id === "mandrake");
  if (mandrake) {
    setEncounterOnLandscape(state, "house", encounterFromDreambeastCard(mandrake));
  }

  const placementNote = (state.tutorialFlags.questPlacements || [])
    .map((p) => `${p.questId === "the-attic" ? "The Attic" : "The Basement"} beside ${p.starterName}`)
    .join("; ");

  state.log = [
    "Tutorial Mode: five rounds teach the full game. Drag the guide window out of the way when you need the map.",
    "Round 1 begins in the Reveal Phase. Your Active Archetype is The Innocent.",
    placementNote ? `Quest Landscapes revealed: ${placementNote}.` : "Quest Landscapes The Attic and The Basement are revealed near the center.",
  ];
  initTutorialSnapshots(state);
  return state;
}

// ── Step snapshots (Back / jump restores game state) ─────────────────

function reattachStateRuntime(state) {
  state.checkPsycheDeath = (player) => checkDreamerPsycheDeath(state, player);
  delete state.onResolutionIdle;
}

function snapshotGameData(state) {
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

function saveTutorialSnapshot(state, stepIndex) {
  if (!state.tutorialSnapshots) state.tutorialSnapshots = [];
  state.tutorialSnapshots[stepIndex] = snapshotGameData(state);
}

function restoreTutorialSnapshot(state, stepIndex) {
  let idx = stepIndex;
  while (idx >= 0 && !state.tutorialSnapshots?.[idx]) idx -= 1;
  const snap = idx >= 0 ? state.tutorialSnapshots[idx] : null;
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
  return true;
}

export function initTutorialSnapshots(state) {
  state.tutorialSnapshots = [];
  saveTutorialSnapshot(state, 0);
}

// ── Hard action locks per tutorial step ──────────────────────────────

const TUTORIAL_INFO_STEPS = new Set([
  "welcome",
  "win-goal",
  "rem-intro",
  "subconscious",
  "archetype-innocent",
  "r2-intro",
  "r2-map",
  "r3-boss",
  "r4-death",
  "graduate",
]);

const TUTORIAL_FREE_PLAY_STEPS = new Set([
  "end-r3",
  "end-r4",
  "r5-practice",
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

function exploreMoveAllowed(state, tileId, allowedTiles = null) {
  const player = state.players[state.activePlayerIndex];
  if (!player?.alive || getPhase(state) !== "Explore" || !state.exploreActivated) return false;
  const legal = getLegalMoveTargets(state, player).map((t) => t.id);
  if (!legal.includes(tileId)) return false;
  if (allowedTiles && !allowedTiles.includes(tileId)) return false;
  return true;
}

function boardSelectAllowed(state, tileId, allowedTiles) {
  if (state.landscapePick) return false;
  if (getPhase(state) === "Explore" && state.exploreActivated) {
    return exploreMoveAllowed(state, tileId, allowedTiles);
  }
  return allowedTiles.includes(tileId);
}

export function classifyPhaseAction(action) {
  const label = action?.label || "";
  if (label.startsWith("Draw & Resolve")) return "drawDream";
  if (label.startsWith("Reveal Landscapes")) return "revealLandscape";
  if (label.startsWith("Spend Elasticity")) return "spendElasticity";
  if (label.startsWith("Gain Actions")) return "gainMeetActions";
  if (label.startsWith("Accept")) return "meetAccept";
  if (label.startsWith("Reject")) return "meetReject";
  if (label === "Quest 1") return "completeQuest0";
  if (label === "Quest 2") return "completeQuest1";
  if (label.includes("Next:") || label.startsWith("End Round")) return "advancePhase";
  if (/Action A/i.test(label)) return "landscapeActionA";
  if (label === "Dreamer Power") return "dreamerPower";
  if (label === "Trade" || label === "Play Object" || label === "Activate Persistent") return "blockedExtra";
  return "other";
}

function stepAllowsAction(state, stepId, kind, detail = {}) {
  if (TUTORIAL_FREE_PLAY_STEPS.has(stepId)) return true;

  if (TUTORIAL_INFO_STEPS.has(stepId)) {
    if (stepId === "subconscious" && kind === "headerSubconscious") return true;
    return false;
  }

  switch (stepId) {
    case "draw-dream-r1":
    case "r2-dream":
    case "r3-draw":
      return kind === "drawDream";

    case "spend-lucidity-r1":
    case "r2-lucidity":
      if (kind === "handToggle") return allowsSuitHand(state, detail, "lucidity");
      if (kind === "revealLandscape") return state.dreamDrawn;
      if (kind === "boardClick") return state.landscapePick?.mode === "reveal";
      return false;

    case "reveal-pick-r1":
      if (kind === "boardClick") return state.landscapePick?.mode === "reveal";
      return false;

    case "to-explore-r1":
    case "r2-to-explore":
    case "to-meet-r1":
    case "r2-to-meet":
    case "end-r1":
    case "end-r2":
      return kind === "advancePhase";

    case "spend-elasticity-r1":
    case "r2-elasticity":
      if (kind === "handToggle") return allowsSuitHand(state, detail, "elasticity");
      return kind === "spendElasticity";

    case "explore-move-r1":
      if (kind === "dreamerSelect") return true;
      if (kind === "exploreMove" || kind === "boardClick") {
        return exploreMoveAllowed(state, detail.tileId, ["house"]);
      }
      return false;

    case "r2-move-quests":
      if (kind === "dreamerSelect") return true;
      if (kind === "exploreMove" || kind === "boardClick") {
        return exploreMoveAllowed(state, detail.tileId, ["the-attic", "the-basement"]);
      }
      return false;

    case "spend-willpower-r1":
    case "r2-willpower":
      if (kind === "handToggle") return allowsSuitHand(state, detail, "willpower");
      return kind === "gainMeetActions";

    case "accept-reject":
      if (kind === "dreamerSelect") return true;
      if (kind === "handToggle") return getPhase(state) === "Meet" && state.meetActionBudget > 0;
      if (kind === "meetAccept" || kind === "meetReject") {
        return houseMeetReady(state) && !houseEncounterCleared(state);
      }
      if (kind === "boardClick") {
        return boardSelectAllowed(state, detail.tileId, ["house"]);
      }
      return false;

    case "r2-attic":
      if (kind === "dreamerSelect") return true;
      if (kind === "landscapeActionA") {
        return dreamerOnLandscape(state, "the-attic") && state.selectedLandscapeId === "the-attic";
      }
      if (kind === "boardClick") {
        if (getPhase(state) === "Explore" && state.exploreActivated) {
          return exploreMoveAllowed(state, detail.tileId, ["the-attic"]);
        }
        return detail.tileId === "the-attic";
      }
      return false;

    case "r2-basement":
      if (kind === "dreamerSelect") return true;
      if (kind === "landscapeActionA") {
        return dreamerOnLandscape(state, "the-basement") && state.selectedLandscapeId === "the-basement";
      }
      if (kind === "boardClick") {
        if (getPhase(state) === "Explore" && state.exploreActivated) {
          return exploreMoveAllowed(state, detail.tileId, ["the-basement"]);
        }
        return detail.tileId === "the-basement";
      }
      return false;

    case "r2-mark":
      if (kind === "completeQuest0") return !state.activeArchetype?.questProgress?.[0];
      if (kind === "completeQuest1") {
        return innocentAtticDone(state) && !state.activeArchetype?.questProgress?.[1];
      }
      return false;

    case "r2-acquire":
      if (innocentAcquired(state)) return false;
      if (kind === "completeQuest1") {
        return innocentQuestsMarked(state) || innocentAtticDone(state);
      }
      return kind === "completeQuest0" && innocentQuestsMarked(state);

    default:
      return false;
  }
}

export function isTutorialActionAllowed(state, kind, detail = {}) {
  if (!isInteractiveTutorialActive(state)) return true;
  if (kind === "tutorialNav") return true;

  const step = getTutorialStep(state);
  if (!step) return true;

  if (kind === "phaseAction") {
    kind = classifyPhaseAction(detail.action);
  }

  if (kind === "headerOverview" || kind === "headerDreamFeed" || kind === "headerPause") {
    return TUTORIAL_INFO_STEPS.has(step.id);
  }

  if (kind === "headerSubconscious") {
    return step.id === "subconscious" || step.id === "r4-death" || TUTORIAL_FREE_PLAY_STEPS.has(step.id);
  }

  if (kind === "headerDecks" || kind === "headerDreamers") {
    return false;
  }

  if (kind === "boardClick" && state.landscapePick?.mode === "reveal") {
    return ["spend-lucidity-r1", "r2-lucidity", "reveal-pick-r1"].includes(step.id);
  }

  return stepAllowsAction(state, step.id, kind, detail);
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

// ── Progress helpers (robust gates for tutorial steps) ──

function bossOnBed(state) {
  return landscapeById(state, "bed")?.encounter?.id === "cerberus"
    || state.activeDream?.id === "cerberus";
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
  return !landscapeById(state, "house")?.encounter;
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

function shuffleIds(ids) {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  const questIds = ["the-attic", "the-basement"];
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

  questIds.forEach((questId) => {
    const questTile = landscapeById(state, questId);
    if (!questTile) return;

    let placed = false;
    for (const starterId of shuffleIds(TUTORIAL_STARTER_IDS)) {
      const slots = ring2SlotsBesideStarter(state, starterId).filter((slot) => {
        const key = `${slot.q},${slot.r}`;
        if (usedCoords.has(key)) return false;
        if (questIds.includes(slot.id)) return false;
        return true;
      });
      if (!slots.length) continue;

      const targetSlot = slots[Math.floor(Math.random() * slots.length)];
      swapBoardTilePositions(questTile, targetSlot);
      usedCoords.add(`${questTile.q},${questTile.r}`);
      questTile.revealed = true;
      questTile.wasteland = false;

      const starter = landscapeById(state, starterId);
      placements.push({
        questId,
        starterId,
        starterName: starter?.name || starterId,
      });
      placed = true;
      break;
    }

    if (!placed) {
      questTile.revealed = true;
      questTile.wasteland = false;
    }
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
  { id: "overview", label: "How You Win", stepIndex: 1 },
  { id: "rem", label: "R.E.M. Phases", stepIndex: 2 },
  { id: "subconscious", label: "Subconscious", stepIndex: 3 },
  { id: "archetype", label: "The Innocent", stepIndex: 4 },
  { id: "encounter", label: "Accept & Reject", stepIndex: 13 },
  { id: "acquire", label: "Earn Innocent", stepIndex: 15 },
  { id: "boss", label: "Boss Dreams", stepIndex: 29 },
  { id: "death", label: "Death & Respawn", stepIndex: 32 },
  { id: "graduate", label: "Finish", stepIndex: 35 },
];

/** Linear guided script — five rounds, ~36 steps. */
export const TUTORIAL_SCRIPT = [
  {
    id: "welcome",
    round: 1,
    title: "Welcome to Somnia",
    body: "Drag the guide window by its top bar to move it out of the way. Use minus to collapse it to a slim bar, or the corner grip to resize. Work together — there is no turn order inside a phase.",
    target: null,
  },
  {
    id: "win-goal",
    round: 1,
    title: "How You Win",
    body: "Complete both quests on the Active Archetype, spend 1 Power Token to mark each quest, then Acquire it for points. Reach 12 points before the Dream Deck runs out. Every living Dreamer must stand on The Bed to escape.",
    targets: ["#active-archetype", "#power-tokens"],
  },
  {
    id: "rem-intro",
    round: 1,
    title: "R.E.M. Every Round",
    body: "Each round has three phases in order: Reveal (Lucidity), Explore (Elasticity), Meet (Willpower). One Dreamer spends 1 to 2 suited Psyche cards per phase to set the team budget. Higher matching Dreamer stats add bonus value.",
    target: "#phase-stepper",
  },
  {
    id: "subconscious",
    round: 1,
    title: "The Subconscious",
    body: "Repressed cards sit face-up in The Subconscious. Open it from the top bar. Return effects pull cards back to discard piles. Repress and Return keep your decks cycling.",
    target: "#btn-header-subconscious",
  },
  {
    id: "archetype-innocent",
    round: 1,
    title: "The Innocent Archetype",
    body: "Your Active Archetype is The Innocent (1 point). Quest 1: Draw Mindstream on The Attic. Quest 2: Draw Mindstream on The Basement. Both quest Landscapes are already revealed on the map beside starting tiles. Glowing hexes mark quest locations.",
    targets: ["#active-archetype", "#board-viewport"],
  },
  {
    id: "draw-dream-r1",
    round: 1,
    title: "Reveal: Draw the Dream",
    body: "The Head Dreamer (★) draws one Dream each round. Click Draw & Resolve Dream. Round 1 uses Quiet (no effect).",
    target: "#phase-actions",
    until: (s) => s.dreamDrawn,
    objective: (s) => (s.dreamDrawn
      ? "Dream drawn. Press Continue."
      : "Click Draw & Resolve Dream."),
  },
  {
    id: "spend-lucidity-r1",
    round: 1,
    title: "Reveal: Spend Lucidity",
    body: "Select 1 to 2 Lucidity cards, then click Reveal Landscapes.",
    targets: ["#hand-bar", "#phase-actions"],
    spotlight: "#phase-actions",
    until: (s) => s.revealLandscapeUsed || s.landscapePick?.mode === "reveal",
    objective: (s) => {
      if (s.revealLandscapeUsed || s.landscapePick?.mode === "reveal") return "Lucidity spent. Press Continue.";
      if (hasLuciditySelected(s)) return "Click Reveal Landscapes.";
      return "Select 1 to 2 Lucidity cards.";
    },
  },
  {
    id: "reveal-pick-r1",
    round: 1,
    title: "Reveal: Flip a Landscape",
    body: "Click a hidden hex on the map to flip it face-up.",
    target: "#board-viewport",
    until: (s) => s.revealLandscapeUsed,
    objective: (s) => (s.revealLandscapeUsed
      ? "Landscape revealed. Press Continue."
      : "Click a hidden hex on the map."),
  },
  {
    id: "to-explore-r1",
    round: 1,
    title: "Enter Explore",
    body: "Click Next Phase at the top when Reveal is done.",
    target: "#btn-advance-phase",
    until: (s) => getPhase(s) === "Explore",
    objective: (s) => (getPhase(s) === "Explore"
      ? "Explore started. Press Continue."
      : "Click Next Phase."),
  },
  {
    id: "spend-elasticity-r1",
    round: 1,
    title: "Explore: Spend Elasticity",
    body: "Select 1 to 2 Elasticity cards, then click Spend Elasticity to unlock team moves.",
    targets: ["#hand-bar", "#phase-actions"],
    spotlight: "#phase-actions",
    until: (s) => s.exploreActivated,
    objective: (s) => {
      if (s.exploreActivated) return "Elasticity spent. Press Continue.";
      if (hasElasticitySelected(s)) return "Click Spend Elasticity.";
      return "Select 1 to 2 Elasticity cards.";
    },
  },
  {
    id: "explore-move-r1",
    round: 1,
    title: "Explore: Move to House",
    body: "Click a Dreamer chip, then move onto House. A Mandrake Encounter waits there.",
    targets: ["#dreamer-dock", "#board-viewport"],
    spotlight: "#board-viewport",
    until: (s) => dreamerOnHouse(s),
    objective: (s) => (dreamerOnHouse(s)
      ? "Dreamer on House. Press Continue."
      : "Move a Dreamer onto House."),
  },
  {
    id: "to-meet-r1",
    round: 1,
    title: "Enter Meet",
    body: "Click Next Phase at the top to enter Meet.",
    target: "#btn-advance-phase",
    until: (s) => getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet started. Press Continue."
      : "Click Next Phase."),
  },
  {
    id: "spend-willpower-r1",
    round: 1,
    title: "Meet: Spend Willpower",
    body: "Select 1 to 2 Willpower cards, then click Gain Actions.",
    targets: ["#hand-bar", "#phase-actions"],
    spotlight: "#phase-actions",
    until: (s) => s.meetActionBudget > 0,
    objective: (s) => {
      if (s.meetActionBudget > 0) return "Meet actions unlocked. Press Continue.";
      if (hasWillpowerSelected(s)) return "Click Gain Actions.";
      return "Select 1 to 2 Willpower cards.";
    },
  },
  {
    id: "accept-reject",
    round: 1,
    title: "Accept and Reject",
    body: "Select House on the map. Pool up to 3 Psyche from the Dreamer standing there. Dreambeast costs read A# for Accept and R# for Reject, each with a suit symbol. Accept adds the beast to your hand as 3 Psyche. Reject sends it to the Subconscious and grants the Reject reward.",
    targets: ["#board-viewport", "#active-encounter", "#hand-bar", "#phase-actions"],
    spotlight: "#active-encounter",
    until: (s) => houseEncounterCleared(s) || s.tutorialFlags?.encounterResolved,
    objective: (s) => {
      if (houseEncounterCleared(s)) return "Encounter resolved. Press Continue.";
      if (hasMeetPool(s)) return "Click Accept or Reject.";
      if (!houseMeetReady(s)) return "Select House on the map.";
      return "Pool up to 3 Psyche from the Dreamer on House.";
    },
  },
  {
    id: "end-r1",
    round: 1,
    title: "End Round 1",
    body: "Click Next Phase to end Meet and start Round 2. From Round 2 on, each Dreamer draws 2 Psyche at round start.",
    target: "#btn-advance-phase",
    until: (s) => s.round >= 2,
    objective: (s) => (s.round >= 2
      ? "Round 2 started. Press Continue."
      : "Click Next Phase to end Round 1."),
  },
  {
    id: "r2-intro",
    round: 2,
    title: "Round 2: Earn The Innocent",
    body: "Round 2 completes both Innocent quests. You will run Reveal, Explore, and Meet again, then visit The Attic and The Basement to draw Mindstream. Each quest earns a checkbox on the Active Archetype.",
    target: "#active-archetype",
  },
  {
    id: "r2-map",
    round: 2,
    title: "Find Your Quest Landscapes",
    body: "Look at the map. The Attic and The Basement are revealed beside starting Landscapes near the center. Glowing hexes mark open Innocent quests. You must stand on a quest tile during Meet to use its Action A.",
    targets: ["#board-viewport", "#active-archetype"],
    spotlight: "#board-viewport",
  },
  {
    id: "r2-dream",
    round: 2,
    title: "Round 2 — Reveal: Draw the Dream",
    body: "Round 2 starts the same way as Round 1. The Head Dreamer draws one Dream card to open Reveal.",
    target: "#phase-actions",
    until: (s) => atRound(s, 2) && s.dreamDrawn,
    objective: (s) => {
      if (!atRound(s, 2)) return "End Round 1 first.";
      return s.dreamDrawn
        ? "Dream drawn. Press Continue."
        : "Click Draw & Resolve Dream.";
    },
  },
  {
    id: "r2-lucidity",
    round: 2,
    title: "Round 2 — Reveal: Spend Lucidity",
    body: "Select 1 to 2 Lucidity cards, then click Reveal Landscapes. You do not need to reveal new tiles this round, but you must spend Lucidity to finish Reveal.",
    targets: ["#hand-bar", "#phase-actions"],
    spotlight: "#phase-actions",
    until: (s) => atRound(s, 2) && (s.revealLandscapeUsed || s.landscapePick?.mode === "reveal"),
    objective: (s) => {
      if (s.revealLandscapeUsed || s.landscapePick?.mode === "reveal") return "Reveal budget spent. Press Continue.";
      if (hasLuciditySelected(s)) return "Click Reveal Landscapes.";
      return "Select 1 to 2 Lucidity cards.";
    },
  },
  {
    id: "r2-to-explore",
    round: 2,
    title: "Round 2 — Enter Explore",
    body: "Click Next Phase at the top. Explore is when Dreamers move across the map toward quest Landscapes.",
    target: "#btn-advance-phase",
    until: (s) => atRound(s, 2) && getPhase(s) === "Explore",
    objective: (s) => (getPhase(s) === "Explore"
      ? "Explore started. Press Continue."
      : "Click Next Phase to enter Explore."),
  },
  {
    id: "r2-elasticity",
    round: 2,
    title: "Round 2 — Explore: Spend Elasticity",
    body: "Select 1 to 2 Elasticity cards, then click Spend Elasticity. This unlocks team moves so you can reach The Attic and The Basement.",
    targets: ["#hand-bar", "#phase-actions", "#dreamer-dock"],
    spotlight: "#phase-actions",
    until: (s) => atRound(s, 2) && s.exploreActivated,
    objective: (s) => {
      if (s.exploreActivated) return "Elasticity spent. Press Continue.";
      if (hasElasticitySelected(s)) return "Click Spend Elasticity.";
      return "Select 1 to 2 Elasticity cards.";
    },
  },
  {
    id: "r2-move-quests",
    round: 2,
    title: "Round 2 — Explore: Move Toward Quests",
    body: "Click a Dreamer chip, then click a green hex to move. Head toward the glowing Attic and Basement tiles so a Dreamer can stand on each one during Meet.",
    targets: ["#dreamer-dock", "#board-viewport"],
    spotlight: "#board-viewport",
    objective: "Move Dreamers toward the quest Landscapes, then press Continue.",
  },
  {
    id: "r2-to-meet",
    round: 2,
    title: "Round 2 — Enter Meet",
    body: "Click Next Phase at the top. Meet is when you spend actions on Landscapes, Encounters, and quests.",
    target: "#btn-advance-phase",
    until: (s) => atRound(s, 2) && getPhase(s) === "Meet",
    objective: (s) => (getPhase(s) === "Meet"
      ? "Meet started. Press Continue."
      : "Click Next Phase to enter Meet."),
  },
  {
    id: "r2-willpower",
    round: 2,
    title: "Round 2 — Meet: Spend Willpower",
    body: "Select 1 to 2 Willpower cards, then click Gain Actions. Meet actions pay for Landscape Action A on The Attic and The Basement.",
    targets: ["#hand-bar", "#phase-actions"],
    spotlight: "#phase-actions",
    until: (s) => atRound(s, 2) && s.meetActionBudget > 0,
    objective: (s) => {
      if (s.meetActionBudget > 0) return "Meet actions unlocked. Press Continue.";
      if (hasWillpowerSelected(s)) return "Click Gain Actions.";
      return "Select 1 to 2 Willpower cards.";
    },
  },
  {
    id: "r2-attic",
    round: 2,
    title: "Quest 1: The Attic",
    body: "Why: Innocent Quest 1 needs Lucidity Mindstream from The Attic. How: 1) Move a Dreamer onto The Attic. 2) Click the Attic hex. 3) Spend a Meet action. 4) Choose Action A to draw Lucidity Mindstream.",
    targets: ["#board-viewport", "#phase-actions", "#dreamer-dock"],
    spotlight: "#board-viewport",
    until: (s) => atRound(s, 2) && innocentAtticDone(s),
    objective: (s) => {
      if (!atRound(s, 2)) return "End Round 1 first.";
      if (innocentAtticDone(s)) return "Attic quest complete. Press Continue.";
      if (getPhase(s) !== "Meet") return "You must be in Meet to use Landscape actions.";
      if (!dreamerOnLandscape(s, "the-attic")) {
        return `Move a Dreamer onto The Attic (${questPlacementLabel(s, "the-attic")}).`;
      }
      if (s.selectedLandscapeId !== "the-attic") return "Click The Attic hex on the map.";
      if (s.meetActionBudget <= 0) return "Spend Willpower first to gain Meet actions.";
      return "Spend a Meet action and choose Action A on The Attic.";
    },
  },
  {
    id: "r2-basement",
    round: 2,
    title: "Quest 2: The Basement",
    body: "Why: Innocent Quest 2 needs Willpower Mindstream from The Basement. How: 1) Move a Dreamer onto The Basement. 2) Click the Basement hex. 3) Spend a Meet action. 4) Choose Action A to draw Willpower Mindstream.",
    targets: ["#board-viewport", "#phase-actions", "#dreamer-dock"],
    spotlight: "#board-viewport",
    until: (s) => atRound(s, 2) && innocentBasementDone(s),
    objective: (s) => {
      if (innocentBasementDone(s)) return "Basement quest complete. Press Continue.";
      if (getPhase(s) !== "Meet") return "You must be in Meet to use Landscape actions.";
      if (!dreamerOnLandscape(s, "the-basement")) {
        return `Move a Dreamer onto The Basement (${questPlacementLabel(s, "the-basement")}).`;
      }
      if (s.selectedLandscapeId !== "the-basement") return "Click The Basement hex on the map.";
      if (s.meetActionBudget <= 0) return "Spend Willpower first to gain Meet actions.";
      return "Spend a Meet action and choose Action A on The Basement.";
    },
  },
  {
    id: "r2-mark",
    round: 2,
    title: "Mark Both Quests",
    body: "Why: You proved both quest conditions. How: In the Active Archetype panel, click each quest checkbox and spend 1 Power Token to mark it complete.",
    target: "#active-archetype",
    until: (s) => innocentQuestsMarked(s),
    objective: (s) => (innocentQuestsMarked(s)
      ? "Quests marked. Press Continue."
      : "Click each quest checkbox and spend 1 Power Token."),
  },
  {
    id: "r2-acquire",
    round: 2,
    title: "Acquire The Innocent",
    body: "Why: Both quests are marked, so you can claim the Archetype. How: Click Acquire on the Active Archetype. You gain 1 point toward your goal of 12.",
    target: "#active-archetype",
    until: (s) => innocentAcquired(s),
    objective: (s) => (innocentAcquired(s)
      ? "Innocent acquired. Press Continue."
      : "Click Acquire on the Active Archetype."),
  },
  {
    id: "end-r2",
    round: 2,
    title: "End Round 2",
    body: "Click Next Phase when ready. Round 3 introduces a Boss Dream.",
    target: "#btn-advance-phase",
    until: (s) => s.round >= 3,
    objective: (s) => (s.round >= 3
      ? "Round 3 started. Press Continue."
      : "Click Next Phase to end Round 2."),
  },
  {
    id: "r3-boss",
    round: 3,
    title: "Round 3: Boss Dreams",
    body: "The third Dream awakens Cerberus on The Bed. Bosses have strict Accept costs and harsh Fail effects if left unresolved at end of Meet. Only the Dreamer on The Bed may pool Psyche to face a boss.",
    targets: ["#phase-actions", "#active-encounter"],
  },
  {
    id: "r3-draw",
    round: 3,
    title: "Awaken Cerberus",
    body: "Click Draw & Resolve Dream. Cerberus spawns on The Bed.",
    targets: ["#phase-actions", "#board-viewport"],
    spotlight: "#phase-actions",
    until: (s) => atRound(s, 3) && s.dreamDrawn && bossOnBed(s),
    objective: (s) => {
      if (bossOnBed(s) && s.dreamDrawn) return "Cerberus awakened. Press Continue.";
      if (!atRound(s, 3)) return "End Round 2 first.";
      if (!s.dreamDrawn) return "Click Draw & Resolve Dream.";
      return "Resolve the Dream to spawn Cerberus.";
    },
  },
  {
    id: "end-r3",
    round: 3,
    title: "End Round 3",
    body: "You may face Cerberus during Meet or end the round. Unresolved bosses fail at end of Meet. Click Next Phase when ready.",
    target: "#btn-advance-phase",
    until: (s) => s.round >= 4,
    objective: (s) => (s.round >= 4
      ? "Round 4 started. Press Continue."
      : "Click Next Phase to end Round 3."),
  },
  {
    id: "r4-death",
    round: 4,
    title: "Death and Respawn",
    body: "Round 4 Dream is Heroism: each Dreamer draws Psyche equal to their Willpower. At 0 Psyche, spend Power Tokens to survive or accept death. Death respawns you on The Bed with 4, 3, 2, or 1 Psyche by death count, plus 2 Power. Fifth death removes that Dreamer. Death Represses the top of each Mindstream deck into The Subconscious.",
    target: "#btn-header-subconscious",
  },
  {
    id: "end-r4",
    round: 4,
    title: "End Round 4",
    body: "Run Reveal, Explore, and Meet on your own this round. Click Next Phase when ready.",
    target: "#btn-advance-phase",
    until: (s) => s.round >= 5,
    objective: (s) => (s.round >= 5
      ? "Round 5 started. Press Continue."
      : "Click Next Phase to end Round 4."),
  },
  {
    id: "r5-practice",
    round: 5,
    title: "Round 5: Final Practice",
    body: "One last round with less guidance. Run the full R.E.M. loop, use Landscape actions, and manage Power Tokens. Click Next Phase after Meet to finish.",
    target: "#phase-stepper",
    until: (s) => s.round > 5 || s.tutorialComplete,
    objective: "Finish Meet and click Next Phase to complete the tutorial.",
  },
  {
    id: "graduate",
    round: 5,
    title: "Tutorial Complete",
    body: "You learned the goal, R.E.M. phases, Accept and Reject, Archetype quests, Boss Dreams, death, and the Subconscious. Use Guide and Help for the full rules. Press Finish to return to setup.",
    target: "#phase-stepper",
  },
];

export function getTutorialObjective(state, step) {
  if (!step) return "";

  if (!step.until) {
    if (typeof step.objective === "function") return step.objective(state);
    if (typeof step.objective === "string") return step.objective;
    return "Read the step, then press Continue.";
  }

  if (step.until(state)) return "Objective complete — press Continue.";

  if (typeof step.objective === "function") return step.objective(state);
  if (typeof step.objective === "string") return step.objective;

  return "Complete the highlighted action to unlock Continue.";
}

export function getTutorialStep(state) {
  if (!state?.tutorialMode) return null;
  return TUTORIAL_SCRIPT[state.tutorialStepIndex] || null;
}

/** Skip past steps whose gates are already satisfied (e.g. after reload or fast play). */
function catchUpTutorialIndex(state) {
  if (state.tutorialSuppressCatchUp) return;
  let guard = 0;
  while (guard++ < TUTORIAL_SCRIPT.length) {
    const step = TUTORIAL_SCRIPT[state.tutorialStepIndex];
    if (!step) break;
    if (!step.until || !step.until(state)) break;
    if (state.tutorialStepIndex >= TUTORIAL_SCRIPT.length - 1) break;
    state.tutorialStepIndex += 1;
  }
}

export function syncTutorial(state) {
  if (!state?.tutorialMode || state.tutorialComplete) return null;

  catchUpTutorialIndex(state);

  const step = getTutorialStep(state);
  if (!step) {
    return { complete: true };
  }

  if (step.until) {
    state.tutorialCanAdvance = step.until(state);
  } else {
    state.tutorialCanAdvance = true;
  }

  const objective = getTutorialObjective(state, step);

  return {
    step,
    stepIndex: state.tutorialStepIndex,
    total: TUTORIAL_SCRIPT.length,
    canAdvance: state.tutorialCanAdvance,
    round: step.round || state.round,
    objective,
  };
}

export function advanceTutorialStep(state) {
  if (!state?.tutorialMode) return;
  state.tutorialStepIndex += 1;
  saveTutorialSnapshot(state, state.tutorialStepIndex);
  state.tutorialCanAdvance = false;
  state.tutorialSuppressCatchUp = false;
  if (state.tutorialStepIndex >= TUTORIAL_SCRIPT.length) {
    state.tutorialComplete = true;
  }
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
  addLog(state, "Tutorial complete — you're ready for the full Dreamscape.");
}

export function isInteractiveTutorialActive(state) {
  return !!(state?.tutorialMode && !state.tutorialComplete);
}
