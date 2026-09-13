#!/usr/bin/env node
/**
 * Audit tutorial step gates and action locks — finds steps where required
 * actions are blocked or until conditions are impossible from the prior step.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO, "src/site/somnia/data");
const JS_DIR = path.join(REPO, "src/site/somnia/js");

const DATA_FILES = [
  "dreamers", "archetypes", "landscapes", "dreambeasts", "dreams",
  "psyche", "mindstream", "event-landscapes", "objects", "card-manifest",
];

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf8"));
}

globalThis.fetch = async (url) => {
  const name = String(url).replace(/^data\//, "").replace(/\.json$/, "");
  return { json: async () => loadJson(name) };
};

const dataMod = await import(pathToFileURL(path.join(JS_DIR, "data.js")).href);
const tutorialMod = await import(pathToFileURL(path.join(JS_DIR, "tutorial-mode.js")).href);
const gameMod = await import(pathToFileURL(path.join(JS_DIR, "game.js")).href);
const stateMod = await import(pathToFileURL(path.join(JS_DIR, "state.js")).href);
const canonicalMod = await import(pathToFileURL(path.join(JS_DIR, "tutorial-canonical.js")).href);

const {
  createTutorialState,
  TUTORIAL_SCRIPT,
  isTutorialActionAllowed,
  classifyPhaseAction,
  syncTutorial,
  advanceTutorialStep,
  jumpTutorialToStep,
  getTutorialSpotlightSelector,
} = tutorialMod;
const { applyCanonicalTutorialStep } = canonicalMod;
const { getPhase, landscapeById } = stateMod;
const {
  drawDreamCard,
  revealLandscape,
  activateExplore,
  gainMeetActions,
  meetEncounter,
  handleBoardTileClick,
  landscapeAction,
  endPhase,
  getPhaseActions,
} = gameMod;

const gameData = await dataMod.loadGameData();

const ACTION_KINDS = [
  "drawDream", "revealLandscape", "spendElasticity", "gainMeetActions",
  "meetAccept", "meetReject", "advancePhase", "landscapeActionA",
  "completeQuest0", "completeQuest1", "handToggle", "dreamerSelect",
  "exploreMove", "boardClick", "dreamerPower",
];

function phaseActionKinds(state) {
  const noop = () => {};
  const handlers = {
    drawDream: noop, revealLandscape: noop, activateExplore: noop,
    gainMeetActions: noop, meetEncounter: noop, landscapeAction: noop,
    playObject: noop, activateObject: noop, tradeAction: noop,
    completeQuest: noop, useArchetypePower: noop, useDreamerPower: noop,
    defeatFinalArchetype: noop, sacrificeForFinal: noop, nextPhase: noop,
  };
  return getPhaseActions(state, handlers).map((a) => classifyPhaseAction(a));
}

function auditStep(state, stepIndex) {
  const step = TUTORIAL_SCRIPT[stepIndex];
  const allowed = {};
  for (const kind of ACTION_KINDS) {
    allowed[kind] = isTutorialActionAllowed(state, kind, {
      tileId: "house",
      playerIndex: 0,
      card: state.players[0]?.hand[0],
      owner: state.players[0],
    });
  }
  const phaseKinds = phaseActionKinds(state);
  const sync = syncTutorial(state);
  return {
    stepIndex,
    id: step.id,
    round: state.round,
    phase: getPhase(state),
    until: step.until ? step.until(state) : null,
    canAdvance: sync?.canAdvance,
    allowed,
    phaseKinds,
  };
}

function setPlayerOn(state, playerIndex, tileId) {
  state.players[playerIndex].landscapeId = tileId;
  state.activePlayerIndex = playerIndex;
}

function selectLucidity(state, n = 1) {
  state.selectedHand = [];
  const p = state.players[state.activePlayerIndex];
  p.hand.filter((c) => c.suit === "lucidity").slice(0, n).forEach((c) => {
    state.selectedHand.push(c.instanceId);
  });
}

function selectElasticity(state, n = 1) {
  state.selectedHand = [];
  const p = state.players[state.activePlayerIndex];
  p.hand.filter((c) => c.suit === "elasticity").slice(0, n).forEach((c) => {
    state.selectedHand.push(c.instanceId);
  });
}

function selectWillpower(state, n = 1) {
  state.selectedHand = [];
  const p = state.players[state.activePlayerIndex];
  p.hand.filter((c) => c.suit === "willpower").slice(0, n).forEach((c) => {
    state.selectedHand.push(c.instanceId);
  });
}

function advancePhasesTo(state, targetPhase, maxRound = state.round) {
  let guard = 30;
  while (guard-- > 0) {
    if (getPhase(state) === targetPhase && state.round >= maxRound) return true;
    endPhase(state);
    if (state.round > maxRound + 1) return false;
  }
  return getPhase(state) === targetPhase;
}

function pickHiddenTile(state) {
  const hidden = state.board.find((t) => !t.revealed && !t.center);
  if (!hidden) return null;
  handleBoardTileClick(state, hidden.id);
  return hidden.id;
}

function moveActiveTo(state, tileId) {
  const player = state.players[state.activePlayerIndex];
  const legal = gameMod.getLegalExploreTargets(state);
  const target = legal.find((t) => t.id === tileId);
  if (!target) return false;
  handleBoardTileClick(state, tileId);
  return player.landscapeId === tileId;
}

/** Simulate minimal progression through tutorial; report stuck steps. */
function simulate() {
  const issues = [];
  const state = createTutorialState(gameData);
  state.tutorialStepIndex = 5; // start at draw-dream-r1

  const steps = [
    () => { drawDreamCard(state); },
    () => { selectLucidity(state, 1); revealLandscape(state); },
    () => { pickHiddenTile(state); },
    () => { advancePhasesTo(state, "Explore"); },
    () => { selectElasticity(state, 1); activateExplore(state); },
    () => { setPlayerOn(state, 0, "bed"); moveActiveTo(state, "house"); },
    () => { advancePhasesTo(state, "Meet"); },
    () => { selectWillpower(state, 1); gainMeetActions(state); },
    () => {
      state.selectedLandscapeId = "house";
      meetEncounter(state, "reject");
    },
    () => { while (state.round < 2) endPhase(state); },
    // Round 2
    () => { drawDreamCard(state); },
    () => { selectLucidity(state, 1); revealLandscape(state); },
    () => { advancePhasesTo(state, "Explore", 2); },
    () => { selectElasticity(state, 1); activateExplore(state); },
    () => {
      setPlayerOn(state, 0, "bed");
      moveActiveTo(state, "the-attic");
      setPlayerOn(state, 1, "bed");
      state.activePlayerIndex = 1;
      moveActiveTo(state, "the-basement");
    },
    () => { advancePhasesTo(state, "Meet", 2); },
    () => { selectWillpower(state, 1); gainMeetActions(state); },
    () => {
      state.activePlayerIndex = 0;
      setPlayerOn(state, 0, "the-attic");
      state.selectedLandscapeId = "the-attic";
      gameMod.performLandscapeAction(state, "draw-mindstream");
    },
    () => {
      state.activePlayerIndex = 1;
      setPlayerOn(state, 1, "the-basement");
      state.selectedLandscapeId = "the-basement";
      gameMod.performLandscapeAction(state, "draw-mindstream");
    },
  ];

  let scriptIdx = 5;
  for (const action of steps) {
    while (scriptIdx < TUTORIAL_SCRIPT.length) {
      const step = TUTORIAL_SCRIPT[scriptIdx];
      const before = auditStep(state, scriptIdx);
      if (step.until && !step.until(state)) {
        const needed = ACTION_KINDS.filter((k) => {
          if (k === "boardClick") return isTutorialActionAllowed(state, k, { tileId: "the-attic" });
          if (k === "exploreMove") return isTutorialActionAllowed(state, k, { tileId: "the-attic" });
          return isTutorialActionAllowed(state, k);
        });
        if (needed.length === 0 && !["welcome", "win-goal", "rem-intro", "subconscious", "archetype-innocent", "r2-intro", "r2-map", "r3-boss", "r4-death", "graduate"].includes(step.id)) {
          issues.push({
            step: step.id,
            index: scriptIdx,
            problem: "until not met and no action kinds allowed",
            phase: getPhase(state),
            round: state.round,
          });
        }
        break;
      }
      advanceTutorialStep(state);
      scriptIdx += 1;
    }
    try {
      action();
    } catch (e) {
      issues.push({ step: TUTORIAL_SCRIPT[scriptIdx]?.id, actionError: e.message });
    }
  }

  // Scan all steps for action-lock dead ends at representative game states
  const scanStates = [
    { label: "r2-move-quests explore, nobody on quests", fn: () => {
      const s = createTutorialState(gameData);
      s.tutorialStepIndex = 21;
      s.round = 2;
      s.phaseIndex = 1;
      s.exploreActivated = true;
      return s;
    }},
    { label: "r2-attic meet, nobody on attic", fn: () => {
      const s = createTutorialState(gameData);
      s.tutorialStepIndex = 24;
      s.round = 2;
      s.phaseIndex = 2;
      s.meetActionBudget = 2;
      s.players.forEach((p) => { p.landscapeId = "bed"; });
      return s;
    }},
    { label: "r2-acquire quests marked not acquired", fn: () => {
      const s = createTutorialState(gameData);
      s.tutorialStepIndex = 27;
      s.round = 2;
      s.phaseIndex = 2;
      s.activeArchetype.questProgress = [true, true];
      return s;
    }},
    { label: "r3-draw round 3 reveal", fn: () => {
      const s = createTutorialState(gameData);
      s.tutorialStepIndex = 30;
      s.round = 3;
      s.phaseIndex = 0;
      s.dreamDrawn = false;
      return s;
    }},
    { label: "r2-attic meet, on attic with budget", fn: () => {
      const s = createTutorialState(gameData);
      s.tutorialStepIndex = 24;
      s.round = 2;
      s.phaseIndex = 2;
      s.meetActionBudget = 2;
      setPlayerOn(s, 0, "the-attic");
      s.selectedLandscapeId = "the-attic";
      s.activePlayerIndex = 0;
      const actions = getPhaseActions(s, {
        drawDream: () => {}, revealLandscape: () => {}, activateExplore: () => {},
        gainMeetActions: () => {}, meetEncounter: () => {},
        landscapeAction: () => {}, playObject: () => {}, activateObject: () => {},
        tradeAction: () => {}, completeQuest: () => {}, useArchetypePower: () => {},
        useDreamerPower: () => {}, defeatFinalArchetype: () => {}, sacrificeForFinal: () => {},
        nextPhase: () => {},
      });
      const drawAction = actions.find((a) => a.label?.startsWith("Draw ["));
      return { s, drawAction };
    }},
    { label: "r5-practice round 5 meet", fn: () => {
      const s = createTutorialState(gameData);
      s.tutorialStepIndex = 34;
      s.round = 5;
      s.phaseIndex = 2;
      return s;
    }},
  ];

  for (const { label, fn } of scanStates) {
    const result = fn();
    const s = result.s || result;
    const drawAction = result.drawAction;
    const step = TUTORIAL_SCRIPT[s.tutorialStepIndex];
    const untilMet = step.until ? step.until(s) : true;
    const canDraw = isTutorialActionAllowed(s, "drawDream");
    const canAdvance = isTutorialActionAllowed(s, "advancePhase");
    const canExploreAttic = isTutorialActionAllowed(s, "exploreMove", { tileId: "the-attic" });
    const canSelectAttic = isTutorialActionAllowed(s, "boardClick", { tileId: "the-attic" });
    const canQuest0 = isTutorialActionAllowed(s, "completeQuest0");
    const canQuest1 = isTutorialActionAllowed(s, "completeQuest1");
    const drawKind = drawAction ? classifyPhaseAction(drawAction) : null;
    const canLandscapeA = drawAction
      ? isTutorialActionAllowed(s, drawKind, { action: drawAction })
      : isTutorialActionAllowed(s, "landscapeActionA");
    issues.push({
      scan: label,
      step: step?.id,
      untilMet,
      canDraw,
      canAdvance,
      canExploreAttic,
      canSelectAttic,
      canQuest0,
      canQuest1,
      canLandscapeA,
      drawKind,
      drawLabel: drawAction?.label,
    });
  }

  return issues;
}

/** Expected spotlight targets — display should match step text focus. */
const EXPECTED_SPOTLIGHT = {
  "win-goal": "#active-archetype",
  "archetype-innocent": "#active-archetype",
  "explore-move-r1": "#board-viewport",
  "accept-reject": "#active-encounter",
  "r2-map": "#board-viewport",
  "r2-move-quests": "#board-viewport",
  "r2-attic": "#board-viewport",
  "r2-basement": "#board-viewport",
  "r3-draw": "#phase-actions",
  "end-r3": "#phase-stepper",
};

function auditSpotlights() {
  const failures = [];
  TUTORIAL_SCRIPT.forEach((step, index) => {
    const spotlight = getTutorialSpotlightSelector(step);
    const expected = step.spotlight || EXPECTED_SPOTLIGHT[step.id] || null;
    if (expected && spotlight !== expected) {
      failures.push({
        step: step.id,
        index,
        expected,
        got: spotlight,
      });
    }
    if (step.id === "archetype-innocent" && spotlight === "#board-viewport") {
      failures.push({
        step: step.id,
        index,
        problem: "step 5 must spotlight Active Archetype, not board",
        got: spotlight,
      });
    }
  });
  return failures;
}

function auditPlaythrough() {
  const bugs = [];
  const state = createTutorialState(gameData);
  for (let i = 0; i < TUTORIAL_SCRIPT.length - 1; i += 1) {
    const step = TUTORIAL_SCRIPT[i];
    jumpTutorialToStep(state, i);
    if (step.until && !step.until(state)) {
      applyCanonicalTutorialStep(state, step);
      if (!step.until(state)) {
        bugs.push(`until still false after canonical apply at ${step.id}`);
      }
    }
    advanceTutorialStep(state);
  }
  if (state.tutorialStepIndex !== TUTORIAL_SCRIPT.length - 1) {
    bugs.push(`stopped at step ${state.tutorialStepIndex}, expected ${TUTORIAL_SCRIPT.length - 1}`);
  }
  return bugs;
}

// Label classification sanity check
const drawMindstreamKind = classifyPhaseAction({ label: "Draw [Lucidity] Mindstream" });
if (drawMindstreamKind !== "landscapeActionA") {
  console.error("FAIL: Draw Mindstream should classify as landscapeActionA, got", drawMindstreamKind);
  process.exitCode = 1;
}

const issues = simulate();
const spotlightFailures = auditSpotlights();
const playthroughBugs = auditPlaythrough();
const critical = issues.filter((i) => i.problem);

console.log(JSON.stringify({
  drawMindstreamKind,
  spotlightFailures,
  playthroughBugs,
  issueCount: issues.length,
  criticalCount: critical.length,
}, null, 2));

if (spotlightFailures.length) {
  console.error("FAIL: tutorial spotlight mismatches");
  process.exitCode = 1;
}
if (playthroughBugs.length) {
  console.error("FAIL: tutorial playthrough bugs:", playthroughBugs.join("; "));
  process.exitCode = 1;
}
if (critical.length) {
  console.error("FAIL: tutorial flow critical issues:", critical.length);
  process.exitCode = 1;
}
if (!process.exitCode) {
  console.log("PASS: spotlight audit and full playthrough");
}
