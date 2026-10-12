#!/usr/bin/env node
/**
 * Validates every tutorial rail beat exposes a precise spotlight selector
 * (exact card, button, hex, or dreamer — never a vague dock/bar fallback).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA = path.join(REPO, "src/site/somnia/data");
const JS = path.join(REPO, "src/site/somnia/js");
const REPORT_PATH = path.join(REPO, "scripts/tutorial-spotlight-report.json");

/** Answer open choices the way the lesson asks: the named choice, cheapest discards, Psyche Returned first. */
function settleChoices(choiceId = null) {
  let guard = 40;
  while (guard-- > 0) {
    if (state.pendingEffectChoice) {
      const enabled = (state.pendingEffectChoice.choices || []).filter((c) => !c.disabled);
      const pick = enabled.find((c) => c.id === choiceId) || enabled[0];
      resolveEffectChoice(state, pick?.id || "confirm");
      continue;
    }
    if (state.pendingRepress) {
      const pending = state.pendingRepress;
      if (pending.confirmEmpty) { confirmRepressStep(state); continue; }
      const owner = state.players.find((p) => p.id === pending.playerId) || state.players[0];
      const picked = new Set((pending.picked || []).map((c) => c.instanceId));
      const card = [...(owner?.hand || [])]
        .filter((c) => !picked.has(c.instanceId) && c.type === "psyche")
        .sort((a, b) => (a.value || 0) - (b.value || 0))[0];
      if (!card) { confirmRepressStep(state); continue; }
      pickRepressCard(state, card.instanceId);
      continue;
    }
    if (state.pendingReturn) {
      const picked = new Set((state.pendingReturn.picked || []).map((c) => c.instanceId));
      const card = returnableCards(state, state.pendingReturn.filter)
        .filter((c) => !picked.has(c.instanceId))
        .sort((a, b) => (a.type === "psyche" ? 0 : 1) - (b.type === "psyche" ? 0 : 1))[0];
      if (!card) { state.pendingReturn = null; continue; }
      pickReturnCard(state, card.instanceId);
      continue;
    }
    if (state.pendingMindstreamChoice?.kind === "power-token") {
      resolveMindstreamChoice(state, "take");
      continue;
    }
    break;
  }
}

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
const { confirmRepressStep, pickRepressCard, pickReturnCard, returnableCards } = await import(pathToFileURL(path.join(JS, "dreamers/subconscious.js")).href);
const { resolveEffectChoice } = await import(pathToFileURL(path.join(JS, "effects/effect-choices.js")).href);

const data = await loadGameData();
const script = tm.TUTORIAL_SCRIPT;
const failures = [];
const beats = [];

const PHASE_ACTION_KINDS = new Set([
  "drawDream",
  "revealLandscape",
  "spendElasticity",
  "gainMeetActions",
  "completeQuest0",
  "completeQuest1",
]);

function fail(msg, detail = {}) {
  failures.push({ msg, ...detail });
}

function validateSpotlight(beat, spotlight, step, sync) {
  if (!beat) {
    if (step.until) return;
    if (spotlight && spotlight !== "#active-archetype" && spotlight !== "#board-viewport") {
      fail("info-step spotlight should target UI chrome", { step: step.id, spotlight });
    }
    return;
  }

  if (spotlight === "#phase-actions") {
    fail("spotlight must not target the whole action bar", {
      step: step.id,
      beat: beat.kind,
      prompt: beat.prompt,
    });
    return;
  }

  if (spotlight === "#hand-bar" && beat.kind === "handToggle") {
    fail("handToggle must spotlight a specific card, not the whole hand bar", {
      step: step.id,
      prompt: beat.prompt,
    });
    return;
  }

  switch (beat.kind) {
    case "dreamerSelect":
      // While the phase opener is open (40.4+), the Dreamer is picked from its menu entry.
      if (
        !spotlight?.includes("hex-occupant-dreamer")
        && !spotlight?.includes("player-chip")
        && !spotlight?.includes("dreamer-dock")
        && !spotlight?.startsWith("#phase-opener-menu [data-focus-id=")
      ) {
        fail("dreamerSelect needs a board Dreamer token or chip selector", { step: step.id, spotlight });
      }
      break;
    case "handToggle":
      if (
        !spotlight?.includes("game-card")
        && !spotlight?.includes("data-instance-id")
      ) {
        fail("handToggle needs a card selector", { step: step.id, spotlight });
      }
      if (spotlight?.includes("#spread-tray")) {
        fail("handToggle must not spotlight spread-tray cards", { step: step.id, spotlight });
      }
      break;
    case "drawDream":
    case "revealLandscape":
    case "spendElasticity":
    case "gainMeetActions":
    case "completeQuest0":
    case "completeQuest1":
      if (
        !spotlight?.includes(`data-tutorial-action="${beat.kind}"`)
        && !(beat.kind === "drawDream" && spotlight?.includes("btn-draw-dream"))
        && !((beat.kind === "revealLandscape" || beat.kind === "spendElasticity" || beat.kind === "gainMeetActions") && spotlight?.includes("btn-spread-opener"))
        && !(beat.kind === "powerBonus" && spotlight?.includes("btn-power-bonus"))
        && !(beat.kind === "dreamerPower" && (spotlight?.includes("dreamerPower") || spotlight?.includes("hex-occupant-dreamer")))
        && !(beat.kind === "archetypePower" && (spotlight?.includes("archetypePower") || spotlight?.includes("hex-occupant-dreamer")))
      ) {
        fail("phase beat needs exact action button selector", {
          step: step.id,
          beat: beat.kind,
          spotlight,
        });
      }
      break;
    case "meetAccept":
      if (!spotlight?.includes("meetAccept")) {
        fail("meetAccept needs Accept button selector", { step: step.id, spotlight });
      }
      break;
    case "meetReject":
      if (!spotlight?.includes("meetReject")) {
        fail("meetReject needs Reject button selector", { step: step.id, spotlight });
      }
      break;
    case "boardClick":
    case "exploreMove":
      if (!spotlight?.includes(`data-tile-id="${beat.tileId}"`)) {
        fail("board beat needs hex selector", { step: step.id, beat: beat.kind, tileId: beat.tileId, spotlight });
      }
      break;
    case "advancePhase":
      // With the phase opener open, the opener's Skip button advances the phase.
      if (
        !spotlight?.includes("btn-next-phase")
        && !spotlight?.includes('data-tutorial-action="advancePhase"')
        && spotlight !== "#btn-skip-phase"
      ) {
        fail("advancePhase needs the map Next Phase button", { step: step.id, spotlight });
      }
      break;
    case "landscapeActionA":
    case "landscapeActionB":
      if (!spotlight?.includes(beat.kind) && !spotlight?.includes(`data-tile-id="${beat.landscapeId}"`)) {
        fail(`${beat.kind} needs hex or its Action button`, {
          step: step.id,
          landscapeId: beat.landscapeId,
          spotlight,
        });
      }
      break;
    case "powerBonus":
      if (!spotlight?.includes("btn-power-bonus")) {
        fail("powerBonus needs the +1 Spread button", { step: step.id, spotlight });
      }
      break;
    case "dreamerPower":
      if (!spotlight?.includes("dreamerPower") && !spotlight?.includes("hex-occupant-dreamer")) {
        fail("dreamerPower needs radial or Dreamer token", { step: step.id, spotlight });
      }
      break;
    case "archetypePower":
      if (!spotlight?.includes("archetypePower") && !spotlight?.includes("hex-occupant-dreamer")) {
        fail("archetypePower needs radial or Dreamer token", { step: step.id, spotlight });
      }
      break;
    default:
      break;
  }

  if (PHASE_ACTION_KINDS.has(beat.kind) && !sync?.objective) {
    fail("missing objective text for actionable beat", { step: step.id, beat: beat.kind });
  }
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
      state.activePlayerIndex = beat.playerIndex;
      if (state.players[beat.playerIndex]?.landscapeId) {
        state.selectedLandscapeId = state.players[beat.playerIndex].landscapeId;
      }
      break;
    case "handToggle": {
      const player = state.players[beat.playerIndex ?? 0];
      if (player) {
        state.activePlayerIndex = beat.playerIndex ?? 0;
        if (player.landscapeId) state.selectedLandscapeId = player.landscapeId;
      }
      const ids = beat.cardIds || [beat.cardId];
      for (const cardId of ids) {
        const card = player?.hand.find((c) => c.id === cardId);
        if (card) gm.toggleHandCard(state, card, player);
      }
      break;
    }
    case "drawDream":
      gm.drawDreamCard(state);
      tm.notifyTutorialDreamDrawn(state);
      break;
    case "revealLandscape":
      gm.revealLandscape(state);
      break;
    case "boardClick":
      gm.handleBoardTileClick(state, beat.tileId);
      break;
    case "spendElasticity":
      gm.activateExplore(state);
      break;
    case "exploreMove":
      state.activePlayerIndex = beat.playerIndex;
      gm.moveDreamer(state, beat.tileId);
      break;
    case "gainMeetActions":
      gm.gainMeetActions(state);
      break;
    case "meetAccept":
      if (beat.tileId) {
        state.selectedLandscapeId = beat.tileId;
        const occupantIndex = state.players.findIndex((p) => p.alive && p.landscapeId === beat.tileId);
        if (occupantIndex >= 0) state.activePlayerIndex = occupantIndex;
      }
      if (beat.scripted) state.tutorialFlags.nextBattleWinner = beat.scripted === "lose" ? "beast" : "dreamer";
      gm.meetEncounter(state, "accept");
      if (beat.scripted !== "lose") tm.notifyTutorialEncounterResolved(state, beat.tileId || "the-attic");
      break;
    case "meetReject":
      if (beat.tileId) {
        state.selectedLandscapeId = beat.tileId;
        const occupantIndex = state.players.findIndex((p) => p.alive && p.landscapeId === beat.tileId);
        if (occupantIndex >= 0) state.activePlayerIndex = occupantIndex;
      }
      if (beat.scripted) state.tutorialFlags.nextBattleWinner = beat.scripted === "lose" ? "beast" : "dreamer";
      gm.meetEncounter(state, "reject");
      if (beat.scripted !== "lose") tm.notifyTutorialEncounterResolved(state, beat.tileId || "the-attic");
      break;
    case "powerBonus":
      gm.powerBonus(state);
      break;
    case "dreamerPower":
      state.activePlayerIndex = beat.playerIndex ?? 1;
      gm.useDreamerPower(state);
      break;
    case "archetypePower":
      state.activePlayerIndex = beat.playerIndex ?? 0;
      gm.handleUseArchetypePower(state, "innocent");
      settleChoices("discard-0");
      state.tutorialFlags.archetypePowerUsed = true;
      break;
    case "advancePhase":
      gm.endPhase(state);
      break;
    case "landscapeActionA":
      state.activePlayerIndex = beat.playerIndex ?? state.activePlayerIndex;
      state.selectedLandscapeId = beat.landscapeId;
      gm.performLandscapeAction(state, "draw-mindstream");
      settleChoices();
      break;
    case "landscapeActionB":
      state.activePlayerIndex = beat.playerIndex ?? state.activePlayerIndex;
      state.selectedLandscapeId = beat.landscapeId;
      gm.performLandscapeAction(state, beat.actionId);
      settleChoices(beat.choiceId);
      break;
    case "completeQuest0":
    case "completeQuest1":
      gm.handleQuestComplete(state, beat.kind === "completeQuest0" ? 0 : 1);
      break;
    case "dreamDim":
      takeDim();
      break;
    case "excessPsyche":
      state.activePlayerIndex = beat.playerIndex ?? 0;
      gm.spendExcessPsycheDraw(state);
      break;
    case "meetPass":
      state.activePlayerIndex = beat.playerIndex ?? 0;
      gm.passMeetToken(state);
      break;
    default:
      fail("unknown beat kind in playthrough", { step: step.id, kind: beat.kind });
  }
}

const state = tm.createTutorialState(data);

for (let si = 0; si < script.length; si += 1) {
  state.tutorialStepIndex = si;
  const step = script[si];

  if (!step.rail?.length) {
    const sync = tm.syncTutorial(state);
    validateSpotlight(null, sync?.step?.spotlight, step, sync);
    beats.push({
      step: step.id,
      beat: null,
      spotlight: sync?.step?.spotlight || null,
      objective: sync?.objective || null,
    });
    continue;
  }

  let guard = step.rail.length + 8;
  while (guard-- > 0) {
    const sync = tm.syncTutorial(state);
    const beat = tm.currentRailBeat(state);
    if (!beat) break;

    validateSpotlight(beat, sync?.step?.spotlight, step, sync);
    beats.push({
      step: step.id,
      beat: beat.kind,
      spotlight: sync?.step?.spotlight || null,
      objective: sync?.objective || beat.prompt,
      playerId: sync?.step?.spotlightBeat?.playerId || null,
    });

    performBeat(step, beat);
  }

  if (tm.currentRailBeat(state)) {
    fail("stuck after rail", { step: step.id, beat: tm.currentRailBeat(state)?.kind });
  }
}

const expectedClicks = script.reduce((sum, step) => sum + (step.rail?.length || 0), 0);
const actionableBeats = beats.filter((b) => b.beat);

const report = {
  generatedAt: new Date().toISOString(),
  expectedRailBeats: expectedClicks,
  capturedBeats: actionableBeats.length,
  failureCount: failures.length,
  failures,
  beats,
  pass: failures.length === 0,
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  pass: report.pass,
  expectedRailBeats: expectedClicks,
  capturedBeats: actionableBeats.length,
  failureCount: failures.length,
  failures,
  reportPath: path.relative(REPO, REPORT_PATH),
}, null, 2));

if (!report.pass) {
  console.error("FAIL: tutorial spotlight audit");
  process.exitCode = 1;
} else {
  console.log("PASS: every tutorial beat has a precise spotlight selector");
}
