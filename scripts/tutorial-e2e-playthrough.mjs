#!/usr/bin/env node
/**
 * Manual end-to-end tutorial playthrough: each current rail beat via allowed actions only.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA = path.join(REPO, "src/site/somnia/data");
const JS = path.join(REPO, "src/site/somnia/js");

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));
}

// tutorial-mode.js railHighlight() probes document.querySelector unguarded to pick a spotlight.
// Expose an empty DOM to that function only; elsewhere `typeof document` stays "undefined" so the
// engine keeps its headless paths (moment overlays, fx, etc.).
const HEADLESS_DOCUMENT = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
Object.defineProperty(globalThis, "document", {
  configurable: true,
  get: () => (new Error().stack?.includes("railHighlight") ? HEADLESS_DOCUMENT : undefined),
});

globalThis.fetch = async (url) => {
  const name = String(url).replace(/^data\//, "").replace(/\.json$/, "");
  return { json: async () => loadJson(name) };
};

const { loadGameData } = await import(pathToFileURL(path.join(JS, "core/data.js")).href);
const tm = await import(pathToFileURL(path.join(JS, "tutorial/tutorial-mode.js")).href);
const gm = await import(pathToFileURL(path.join(JS, "core/game.js")).href);
const { resolveMindstreamChoice } = await import(pathToFileURL(path.join(JS, "cards/mindstream-choices.js")).href);
const { confirmRepressStep } = await import(pathToFileURL(path.join(JS, "dreamers/subconscious.js")).href);

const data = await loadGameData();
const script = tm.TUTORIAL_SCRIPT;
const failures = [];

function fail(msg) {
  failures.push(msg);
}

/** Dim is the free Dream path: resolve the Dream choice as "bad", then confirm any empty Repress. */
function takeDim() {
  if (state.pendingMindstreamChoice?.kind === "dream") resolveMindstreamChoice(state, "bad");
  let guard = 6;
  while (state.pendingRepress?.confirmEmpty && guard-- > 0) confirmRepressStep(state);
}

function performBeat(step, beat) {
  switch (beat.kind) {
    case "dreamerSelect":
      if (!tm.isTutorialActionAllowed(state, "dreamerSelect", { playerIndex: beat.playerIndex })) {
        fail(`${step.id}: dreamerSelect ${beat.playerIndex} blocked`);
        return;
      }
      state.activePlayerIndex = beat.playerIndex;
      if (state.players[beat.playerIndex]?.landscapeId) {
        state.selectedLandscapeId = state.players[beat.playerIndex].landscapeId;
      }
      break;
    case "handToggle": {
      const player = state.players[beat.playerIndex ?? 0];
      const ids = beat.cardIds || [beat.cardId];
      for (const cardId of ids) {
        const card = player?.hand.find((c) => c.id === cardId);
        if (!card) {
          fail(`${step.id}: missing card ${cardId}`);
          return;
        }
        if (!tm.isTutorialActionAllowed(state, "handToggle", { card, owner: player })) {
          fail(`${step.id}: handToggle ${cardId} blocked`);
          return;
        }
        gm.toggleHandCard(state, card, player);
      }
      break;
    }
    case "drawDream":
      if (!tm.isTutorialActionAllowed(state, "drawDream")) fail(`${step.id}: draw blocked`);
      else gm.drawDreamCard(state);
      tm.notifyTutorialDreamDrawn(state);
      break;
    case "revealLandscape":
      if (!tm.isTutorialActionAllowed(state, "revealLandscape")) fail(`${step.id}: reveal blocked`);
      else gm.revealLandscape(state);
      break;
    case "boardClick":
      if (!tm.isTutorialActionAllowed(state, "boardClick", { tileId: beat.tileId })) {
        fail(`${step.id}: board ${beat.tileId} blocked`);
      } else gm.handleBoardTileClick(state, beat.tileId);
      break;
    case "spendElasticity":
      if (!tm.isTutorialActionAllowed(state, "spendElasticity")) fail(`${step.id}: spend elasticity blocked`);
      else gm.activateExplore(state);
      break;
    case "exploreMove":
      if (!tm.isTutorialActionAllowed(state, "exploreMove", { tileId: beat.tileId })) {
        fail(`${step.id}: explore ${beat.tileId} blocked`);
      } else {
        state.activePlayerIndex = beat.playerIndex;
        gm.moveDreamer(state, beat.tileId);
      }
      break;
    case "gainMeetActions":
      if (!tm.isTutorialActionAllowed(state, "gainMeetActions")) fail(`${step.id}: gain actions blocked`);
      else gm.gainMeetActions(state);
      break;
    case "meetAccept":
      if (!tm.isTutorialActionAllowed(state, "meetAccept")) fail(`${step.id}: meet accept blocked`);
      else {
        if (beat.tileId) {
          state.selectedLandscapeId = beat.tileId;
          const occupantIndex = state.players.findIndex((p) => p.alive && p.landscapeId === beat.tileId);
          if (occupantIndex >= 0) state.activePlayerIndex = occupantIndex;
        }
        if (beat.scripted) state.tutorialFlags.nextBattleWinner = beat.scripted === "lose" ? "beast" : "dreamer";
        gm.meetEncounter(state, "accept");
        if (beat.scripted !== "lose") tm.notifyTutorialEncounterResolved(state, beat.tileId || "the-attic");
      }
      break;
    case "meetReject":
      if (!tm.isTutorialActionAllowed(state, "meetReject")) fail(`${step.id}: meet reject blocked`);
      else {
        if (beat.tileId) {
          state.selectedLandscapeId = beat.tileId;
          const occupantIndex = state.players.findIndex((p) => p.alive && p.landscapeId === beat.tileId);
          if (occupantIndex >= 0) state.activePlayerIndex = occupantIndex;
        }
        if (beat.scripted) state.tutorialFlags.nextBattleWinner = beat.scripted === "lose" ? "beast" : "dreamer";
        gm.meetEncounter(state, "reject");
        if (beat.scripted !== "lose") tm.notifyTutorialEncounterResolved(state, beat.tileId || "the-attic");
      }
      break;
    case "powerBonus":
      if (!tm.isTutorialActionAllowed(state, "powerBonus")) fail(`${step.id}: power bonus blocked`);
      else gm.powerBonus(state);
      break;
    case "dreamerPower":
      if (!tm.isTutorialActionAllowed(state, "dreamerPower")) fail(`${step.id}: dreamer power blocked`);
      else {
        state.activePlayerIndex = beat.playerIndex ?? 1;
        gm.useDreamerPower(state);
      }
      break;
    case "archetypePower":
      tm.syncTutorial(state);
      if (!tm.isTutorialActionAllowed(state, "archetypePower")) fail(`${step.id}: archetype power blocked`);
      else {
        state.activePlayerIndex = beat.playerIndex ?? 0;
        const ok = gm.handleUseArchetypePower(state, "innocent");
        if (!ok) fail(`${step.id}: Innocent Power could not fire (Meet budget or token)`);
        state.tutorialFlags.archetypePowerUsed = true;
      }
      break;
    case "advancePhase":
      if (!tm.isTutorialActionAllowed(state, "advancePhase")) fail(`${step.id}: advance blocked`);
      else gm.endPhase(state);
      break;
    case "landscapeActionA":
      if (!tm.isTutorialActionAllowed(state, "landscapeActionA")) fail(`${step.id}: landscape action blocked`);
      else {
        state.activePlayerIndex = beat.playerIndex ?? state.activePlayerIndex;
        state.selectedLandscapeId = beat.landscapeId;
        gm.performLandscapeAction(state, "draw-mindstream");
      }
      break;
    case "completeQuest0":
    case "completeQuest1":
      if (!tm.isTutorialActionAllowed(state, beat.kind)) fail(`${step.id}: ${beat.kind} blocked`);
      else gm.handleQuestComplete(state, beat.kind === "completeQuest0" ? 0 : 1);
      break;
    case "dreamDim":
      if (!tm.isTutorialActionAllowed(state, "dreamDim")) fail(`${step.id}: dim blocked`);
      else takeDim();
      break;
    case "excessPsyche":
      if (!tm.isTutorialActionAllowed(state, "excessPsyche")) fail(`${step.id}: excess psyche blocked`);
      else {
        state.activePlayerIndex = beat.playerIndex ?? 0;
        if (!gm.spendExcessPsycheDraw(state)) fail(`${step.id}: excess Psyche draw refused`);
      }
      break;
    case "meetPass":
      if (!tm.isTutorialActionAllowed(state, "meetPass")) fail(`${step.id}: meet pass blocked`);
      else {
        state.activePlayerIndex = beat.playerIndex ?? 0;
        if (!gm.passMeetToken(state)) fail(`${step.id}: Pass Turn refused`);
      }
      break;
    default:
      fail(`${step.id}: unknown beat ${beat.kind}`);
  }
}

const state = tm.createTutorialState(data);

for (let si = 0; si < script.length; si += 1) {
  state.tutorialStepIndex = si;
  tm.syncTutorial(state);
  const step = script[si];
  if (!step.rail?.length) continue;

  let guard = step.rail.length + 6;
  while (guard-- > 0) {
    tm.syncTutorial(state);
    const beat = tm.currentRailBeat(state);
    if (!beat) break;
    performBeat(step, beat);
  }

  tm.syncTutorial(state);
  if (tm.currentRailBeat(state)) {
    fail(`${step.id}: stuck on "${tm.currentRailBeat(state).prompt}"`);
  }
  if (step.until && !step.until(state)) {
    fail(`${step.id}: until() false after rail`);
  }
}

console.log(JSON.stringify({
  pass: failures.length === 0,
  failureCount: failures.length,
  failures,
  finalRound: state.round,
  positions: state.players.map((p) => p.landscapeId),
  innocent: state.players.some((p) => (p.acquiredArchetypes || []).some((a) => a.id === "innocent")),
}, null, 2));

process.exit(failures.length ? 1 : 0);
