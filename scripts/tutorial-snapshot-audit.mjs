#!/usr/bin/env node
/**
 * Deep audit of tutorial deterministic snapshots, card effects, and navigation.
 * Writes scripts/tutorial-snapshot-report.json for per-step state confirmation.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO, "src/site/somnia/data");
const JS_DIR = path.join(REPO, "src/site/somnia/js");
const REPORT_PATH = path.join(REPO, "scripts/tutorial-snapshot-report.json");

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
  createTutorialBaseState,
  TUTORIAL_SCRIPT,
  isTutorialActionAllowed,
  classifyPhaseAction,
  advanceTutorialStep,
  retreatTutorialStep,
  jumpTutorialToStep,
  getTutorialSpotlightSelector,
  syncTutorial,
} = tutorialMod;
const {
  precomputeTutorialSnapshots,
  applyCanonicalTutorialStep,
  snapshotTutorialGame,
} = canonicalMod;
const { getPhase, landscapeById, encounterOnLandscape, tileEncounters } = stateMod;
const {
  getPhaseActions,
  meetEncounter,
  performLandscapeAction,
  gainMeetActions,
} = gameMod;
const { meetPsychePlayTotal } = await import(pathToFileURL(path.join(JS_DIR, "rules.js")).href);

const gameData = await dataMod.loadGameData();
const failures = [];
const stepReports = [];

function fail(code, detail) {
  failures.push({ code, ...detail });
}

function normalizeSnapshot(snap) {
  const strip = (value) => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (key === "instanceId" || key === "log") return;
      out[key] = strip(val);
    });
    return out;
  };
  return strip(snap);
}

function hashState(state, { semantic = false } = {}) {
  const snap = snapshotTutorialGame(state);
  const payload = semantic ? normalizeSnapshot(snap) : snap;
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function summarizeStep(state, stepIndex) {
  const step = TUTORIAL_SCRIPT[stepIndex];
  const sync = syncTutorial(state);
  const houseEnc = encounterOnLandscape(state, "house")?.name || null;
  const bedEnc = encounterOnLandscape(state, "bed")?.name || null;
  return {
    index: stepIndex,
    id: step.id,
    title: step.title,
    round: state.round,
    phase: getPhase(state),
    dreamDrawn: state.dreamDrawn,
    exploreActivated: state.exploreActivated,
    exploreMovesLeft: state.exploreMovesLeft,
    meetActionBudget: state.meetActionBudget,
    positions: state.players.map((p) => p.landscapeId),
    hands: state.players.map((p) => p.hand.map((c) => `${c.type || "psyche"}:${c.suit || "-"}:${c.value ?? 0}`)),
    powerTokens: state.players.map((p) => p.powerTokens || 0),
    houseEncounter: houseEnc,
    basementEncounter: encounterOnLandscape(state, "the-basement")?.name || null,
    bedEncounter: bedEnc,
    encounterResolved: state.tutorialFlags?.encounterResolved || false,
    atticMindstream: !!state.questTracker?.mindstreamOnLandscape?.["the-attic"],
    basementMindstream: !!state.questTracker?.mindstreamOnLandscape?.["the-basement"],
    innocentAcquired: state.players.some((p) =>
      (p.acquiredArchetypes || []).some((a) => a.id === "innocent")),
    archetypeAcquiredFlag: state.tutorialFlags?.archetypeAcquired || false,
    activeArchetype: state.activeArchetype?.id || null,
    acquiredPoints: state.acquiredPoints,
    until: step.until ? step.until(state) : null,
    canAdvance: sync?.canAdvance ?? null,
    spotlight: getTutorialSpotlightSelector(step),
  };
}

function noopHandlers() {
  const noop = () => {};
  return {
    drawDream: noop, revealLandscape: noop, activateExplore: noop,
    gainMeetActions: noop, meetEncounter: noop, landscapeAction: noop,
    playObject: noop, activateObject: noop, tradeAction: noop,
    completeQuest: noop, useArchetypePower: noop, useDreamerPower: noop,
    defeatFinalArchetype: noop, sacrificeForFinal: noop, nextPhase: noop,
  };
}

function hasPlayableAction(state, step) {
  if (!step.until || step.until(state)) return true;

  const probes = [
    ["drawDream", {}],
    ["revealLandscape", {}],
    ["spendElasticity", {}],
    ["phasePowerToken", {}],
    ["gainMeetActions", {}],
    ["advancePhase", {}],
    ["meetAccept", {}],
    ["meetReject", {}],
    ["landscapeActionA", {}],
    ["completeQuest0", {}],
    ["completeQuest1", {}],
    ["boardClick", { tileId: "candy-mountain" }],
    ["exploreMove", { tileId: "house" }],
    ["exploreMove", { tileId: "the-attic" }],
    ["exploreMove", { tileId: "the-basement" }],
    ["boardClick", { tileId: "house" }],
    ["boardClick", { tileId: "the-attic" }],
    ["boardClick", { tileId: "the-basement" }],
    ["boardClick", { tileId: "city" }],
    ["dreamerSelect", { playerIndex: 0 }],
    ["dreamerSelect", { playerIndex: 1 }],
    ["handToggle", { card: state.players[0]?.hand[0], owner: state.players[0] }],
    ["handToggle", { card: state.players[1]?.hand[0], owner: state.players[1] }],
    ...((state.players[0]?.hand || []).map((card) => ["handToggle", { card, owner: state.players[0] }])),
    ...((state.players[1]?.hand || []).map((card) => ["handToggle", { card, owner: state.players[1] }])),
  ];

  const actions = getPhaseActions(state, noopHandlers());
  for (const action of actions) {
    if (action.disabled) continue;
    const kind = classifyPhaseAction(action);
    if (isTutorialActionAllowed(state, kind, { action })) return true;
  }

  return probes.some(([kind, detail]) => isTutorialActionAllowed(state, kind, detail));
}

/** Per-step invariants at snapshot entry (before player acts). */
const STEP_ENTRY_CHECKS = {
  "welcome": (s) => s.players.every((p) => (p.powerTokens || 0) === 1) || "Dreamers should start with 1 Power Token",
  "draw-dream-r1": (s) => {
    if (!(s.round === 1 && getPhase(s) === "Reveal" && !s.dreamDrawn)) return "Expected Round 1 Reveal before the Dream";
    if (!s.players.every((p) => (p.powerTokens || 0) === 1)) return "Dreamers should start with 1 Power Token";
    return true;
  },
  "reveal-r1": (s) => s.dreamDrawn && getPhase(s) === "Reveal",
  "explore-r1": (s) => getPhase(s) === "Explore",
  "meet-r1": (s) => {
    const enc = encounterOnLandscape(s, "the-attic");
    if (getPhase(s) !== "Meet") return `Expected Meet, got ${getPhase(s)}`;
    if (!s.players.some((p) => p.landscapeId === "the-attic")) return "Visionary not on The Attic";
    if (!enc || enc.name !== "Mandrake") return "Mandrake missing on The Attic";
    return true;
  },
  "meet-lesson": (s) => !!s.tutorialFlags?.firstBattleLost || "First battle should be lost",
  "r2-dream": (s) => {
    if (s.round < 2) return "Round 2 not started";
    if (getPhase(s) !== "Reveal") return `Expected Reveal, got ${getPhase(s)}`;
    return true;
  },
  "r2-skip": (s) => s.round >= 2 && s.dreamDrawn,
  "r2-rematch": (s) => {
    if (getPhase(s) !== "Meet") return `Expected Meet, got ${getPhase(s)}`;
    if (s.players[0].landscapeId !== "the-attic") return `Expected Visionary on Attic, got ${s.players[0].landscapeId}`;
    const enc = encounterOnLandscape(s, "the-attic");
    if (!enc) return "Mandrake should still be on The Attic for the rematch";
    return true;
  },
  "r2-mindstream": (s) => !encounterOnLandscape(s, "the-attic") || "Mandrake should be gone after the rematch",
  "r2-acquire": (s) => {
    if (!s.questTracker?.mindstreamOnLandscape?.["the-attic"]) return "Attic quest not complete in snapshot";
    const meets = s.questTracker?.meetOnLandscape || {};
    if (!((meets["the-attic"] || 0) > 0 || (meets["the-basement"] || 0) > 0)) {
      return "Attic Meet quest not complete in snapshot";
    }
    return true;
  },
};

/** After canonical step completion — card/effect triggers. */
const STEP_EFFECT_CHECKS = {
  "draw-dream-r1": (s) => s.dreamDrawn,
  "reveal-r1": (s) => getPhase(s) === "Explore" && landscapeById(s, "candy-mountain")?.revealed,
  "explore-r1": (s) => getPhase(s) === "Meet" && s.players[0].landscapeId === "the-attic",
  "meet-r1": (s) => !!s.tutorialFlags?.firstBattleLost && encounterOnLandscape(s, "the-attic"),
  "meet-hold": (s) => (s.anchorMeetSpreadPending || 0) >= 1,
  "meet-penalty": (s) => s.round >= 2,
  "r2-dream": (s) => s.dreamDrawn,
  "r2-skip": (s) => getPhase(s) === "Meet",
  "r2-rematch": (s) => !encounterOnLandscape(s, "the-attic"),
  "r2-mindstream": (s) => !!s.questTracker?.mindstreamOnLandscape?.["the-attic"],
  "r2-acquire": (s) => s.tutorialFlags?.archetypeAcquired
    || s.players.some((p) => (p.acquiredArchetypes || []).some((a) => a.id === "innocent")),
  "r2-arch-power": (s) => !!s.tutorialFlags?.archetypePowerUsed,
};

function auditDeterminism() {
  const s1 = createTutorialState(gameData);
  const s2 = createTutorialState(gameData);
  for (let i = 0; i < TUTORIAL_SCRIPT.length; i += 1) {
    jumpTutorialToStep(s1, i);
    jumpTutorialToStep(s2, i);
    if (hashState(s1) !== hashState(s2)) {
      fail("cached-session-determinism", { step: TUTORIAL_SCRIPT[i].id, index: i });
    }
  }
}

function auditNavigation() {
  const state = createTutorialState(gameData);
  for (let i = 0; i < TUTORIAL_SCRIPT.length; i += 1) {
    jumpTutorialToStep(state, i);
    const atStep = hashState(state);

    if (i < TUTORIAL_SCRIPT.length - 1) {
      advanceTutorialStep(state);
      if (state.tutorialStepIndex !== i + 1) {
        fail("advance-index", { from: i, expected: i + 1, got: state.tutorialStepIndex });
      }
      retreatTutorialStep(state);
      if (state.tutorialStepIndex !== i) {
        fail("retreat-index", { expected: i, got: state.tutorialStepIndex });
      }
      if (hashState(state) !== atStep) {
        fail("retreat-state", { step: TUTORIAL_SCRIPT[i].id, index: i });
      }
    }

    const fresh = createTutorialState(gameData);
    jumpTutorialToStep(fresh, i);
    if (hashState(fresh) !== atStep) {
      fail("jump-vs-fresh", { step: TUTORIAL_SCRIPT[i].id, index: i });
    }
  }
}

function auditStepsAndEffects() {
  const state = createTutorialState(gameData);

  for (let i = 0; i < TUTORIAL_SCRIPT.length; i += 1) {
    const step = TUTORIAL_SCRIPT[i];
    jumpTutorialToStep(state, i);
    const entry = summarizeStep(state, i);
    stepReports.push({ phase: "entry", ...entry });

    const entryCheck = STEP_ENTRY_CHECKS[step.id];
    if (entryCheck) {
      const result = entryCheck(state);
      if (result !== true) {
        fail("step-entry", { step: step.id, index: i, reason: result });
      }
    }

    if (step.until && !step.until(state) && !hasPlayableAction(state, step)) {
      fail("no-playable-action", { step: step.id, index: i, phase: getPhase(state) });
    }

    if (step.until && !step.until(state)) {
      applyCanonicalTutorialStep(state, step);
      const after = summarizeStep(state, i);
      stepReports.push({ phase: "after-canonical", ...after });

      if (!step.until(state)) {
        fail("canonical-until", { step: step.id, index: i });
      }

      const effectCheck = STEP_EFFECT_CHECKS[step.id];
      if (effectCheck && !effectCheck(state)) {
        fail("card-effect", { step: step.id, index: i });
      }
    }

    advanceTutorialStep(state);
  }

  if (state.tutorialStepIndex !== TUTORIAL_SCRIPT.length - 1) {
    fail("playthrough-end", { got: state.tutorialStepIndex });
  }
}

function auditLiveCardEffects() {
  const state = createTutorialState(gameData);
  jumpTutorialToStep(state, TUTORIAL_SCRIPT.findIndex((s) => s.id === "r2-rematch"));
  state.activePlayerIndex = 1;
  state.selectedHand = state.players[1].hand
    .filter((c) => c.id === "willpower-1-i-w1")
    .map((c) => c.instanceId);
  gainMeetActions(state);
  state.tutorialFlags.nextBattleWinner = "dreamer";
  state.activePlayerIndex = 0;
  state.selectedLandscapeId = "the-attic";
  state.selectedHand = state.players[0].hand
    .filter((c) => c.id === "lucidity-3-v-l3" || c.id === "lucidity-2-v-l2" || c.id === "willpower-2-v-w2")
    .map((c) => c.instanceId);
  meetEncounter(state, "accept");
  const mandrakeInHand = state.players[0].hand.some(
    (c) => c.id === "mandrake" || c.name === "Mandrake",
  );
  if (encounterOnLandscape(state, "the-attic") && !state.tutorialFlags?.encounterResolved) {
    fail("live-accept-mandrake", { reason: "encounter still on attic" });
  }
  if (!mandrakeInHand && !state.tutorialFlags?.encounterResolved) {
    fail("live-accept-mandrake", { reason: "Mandrake not accepted into hand" });
  }

  jumpTutorialToStep(state, TUTORIAL_SCRIPT.findIndex((s) => s.id === "r2-mindstream"));
  state.activePlayerIndex = 0;
  state.selectedLandscapeId = "the-attic";
  performLandscapeAction(state, "draw-mindstream");
  if (!state.questTracker?.mindstreamOnLandscape?.["the-attic"]) {
    fail("live-attic-mindstream", { reason: "quest tracker not updated after draw" });
  }
}

auditDeterminism();
auditNavigation();
auditStepsAndEffects();
auditLiveCardEffects();

const report = {
  generatedAt: new Date().toISOString(),
  scriptSteps: TUTORIAL_SCRIPT.length,
  snapshotsPerRun: TUTORIAL_SCRIPT.length,
  failureCount: failures.length,
  failures,
  steps: stepReports,
  pass: failures.length === 0,
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  pass: report.pass,
  failureCount: failures.length,
  failures,
  reportPath: path.relative(REPO, REPORT_PATH),
  stepReportCount: stepReports.length,
}, null, 2));

if (!report.pass) {
  console.error("FAIL: tutorial snapshot audit");
  process.exitCode = 1;
} else {
  console.log("PASS: deterministic snapshots, navigation, card effects");
}
