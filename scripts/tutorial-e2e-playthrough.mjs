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

globalThis.fetch = async (url) => {
  const name = String(url).replace(/^data\//, "").replace(/\.json$/, "");
  return { json: async () => loadJson(name) };
};

const { loadGameData } = await import(pathToFileURL(path.join(JS, "data.js")).href);
const tm = await import(pathToFileURL(path.join(JS, "tutorial-mode.js")).href);
const gm = await import(pathToFileURL(path.join(JS, "game.js")).href);

const data = await loadGameData();
const script = tm.TUTORIAL_SCRIPT;
const failures = [];

function fail(msg) {
  failures.push(msg);
}

function performBeat(step, beat) {
  switch (beat.kind) {
    case "dreamerSelect":
      if (!tm.isTutorialActionAllowed(state, "dreamerSelect", { playerIndex: beat.playerIndex })) {
        fail(`${step.id}: dreamerSelect ${beat.playerIndex} blocked`);
        return;
      }
      state.activePlayerIndex = beat.playerIndex;
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
        gm.meetEncounter(state, "accept");
        tm.notifyTutorialEncounterResolved(state, "house");
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
