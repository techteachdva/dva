#!/usr/bin/env node
/**
 * Regular-game Final Recurrence invariants: deck order, Bed flip,
 * remaining-archetype win, and You Never Wake Up loss.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO, "src/site/somnia/data");
const JS_DIR = path.join(REPO, "src/site/somnia/js");

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf8"));
}

globalThis.fetch = async (url) => {
  const name = String(url).replace(/^data\//, "").replace(/\.json$/, "");
  return { json: async () => loadJson(name) };
};

const dataMod = await import(pathToFileURL(path.join(JS_DIR, "data.js")).href);
const stateMod = await import(pathToFileURL(path.join(JS_DIR, "state.js")).href);
const gameMod = await import(pathToFileURL(path.join(JS_DIR, "game.js")).href);
const landscapeMod = await import(pathToFileURL(path.join(JS_DIR, "landscapes.js")).href);
const tutorialMod = await import(pathToFileURL(path.join(JS_DIR, "tutorial-mode.js")).href);

const { buildDreamDeck, LENGTHS } = dataMod;
const { createInitialState, landscapeById, checkDefeat } = stateMod;
const { drawDreamCard, handleDefeatFinalArchetype } = gameMod;
const { triggerBedFinalRecurrence, allOuterTilesWasteland } = landscapeMod;

const failures = [];
function fail(id, detail) {
  failures.push({ id, ...detail });
}

const gameData = await dataMod.loadGameData();

function makeState() {
  return createInitialState(gameData, {
    lengthKey: "daydream",
    selectedDreamers: gameData.dreamers.slice(0, 2),
  });
}

function revealAllOuter(state) {
  state.board.forEach((tile) => {
    if (!tile.center) tile.revealed = true;
  });
}

{
  const deck = buildDreamDeck(gameData.dreams, LENGTHS.daydream.dreams);
  const finals = deck.filter((c) => c.type === "final");
  const regular = deck.filter((c) => c.type !== "final" && c.type !== "boss-dream");
  if (regular.length !== LENGTHS.daydream.dreams) {
    fail("regular-count", { got: regular.length, expected: LENGTHS.daydream.dreams });
  }
  if (finals.length !== 10) fail("final-count", { got: finals.length });
  const firstFinal = deck.find((c) => c.type === "final");
  if (firstFinal?.id !== "final-recurrence") {
    fail("final-starts-with-recurrence", { got: firstFinal?.id });
  }
  if (deck[deck.length - 1]?.id !== "you-never-wake") {
    fail("never-wake-pinned", { got: deck[deck.length - 1]?.id });
  }
  const mid = finals.slice(1, -1).map((c) => c.id);
  if (mid.includes("final-recurrence") || mid.includes("you-never-wake")) {
    fail("effect-block-contaminated", { mid });
  }
}

{
  const state = makeState();
  const skip = state.dreamDeck.filter((c) => c.type !== "final").length;
  for (let i = 0; i < skip; i += 1) {
    state.dreamDrawn = false;
    const card = state.dreamDeck.shift();
    state.dreamDiscard = state.dreamDiscard || [];
    if (card) state.dreamDiscard.push(card);
  }
  state.dreamDrawn = false;
  const drawn = drawDreamCard(state);
  if (drawn?.id !== "final-recurrence") fail("draw-fr-card", { got: drawn?.id });
  if (!state.finalRecurrence) fail("fr-flag-after-draw", {});
  if (!landscapeById(state, "bed")?.finalRecurrenceSide) fail("bed-not-flipped-on-draw", {});
  if (state.dreamDeck.some((c) => c.type !== "final")) {
    fail("regular-dreams-remain-after-fr", {
      leftover: state.dreamDeck.filter((c) => c.type !== "final").map((c) => c.id),
    });
  }
  if (state.dreamDeck[state.dreamDeck.length - 1]?.id !== "you-never-wake") {
    fail("never-wake-after-draw", { last: state.dreamDeck.at(-1)?.id });
  }
  if (state.dreamDeck.some((c) => c.id === "final-recurrence")) {
    fail("fr-card-replayed", {});
  }
  if (!state.finalArchetypes?.length) fail("no-remaining-archetypes", {});
  if (state.status === "lost") fail("lost-after-fr-start", {});
}

{
  const state = makeState();
  const revealedOuter = state.board.filter((t) => !t.center && t.revealed);
  revealedOuter.forEach((tile) => {
    tile.wasteland = true;
    tile.forgotten = true;
    tile.revealed = false;
  });
  if (!revealedOuter.length || !allOuterTilesWasteland(state)) {
    fail("hidden-pool-blocks-collapse", { forgotten: revealedOuter.length });
  }
}

{
  const state = makeState();
  revealAllOuter(state);
  state.board.forEach((tile) => {
    if (!tile.center) {
      tile.wasteland = true;
      tile.forgotten = true;
    }
  });
  triggerBedFinalRecurrence(state, "audit collapse");
  if (!state.finalRecurrence) fail("fr-flag-after-collapse", {});
  if (!landscapeById(state, "bed")?.finalRecurrenceSide) fail("bed-not-flipped-on-collapse", {});
  if (state.dreamDeck[state.dreamDeck.length - 1]?.id !== "you-never-wake") {
    fail("never-wake-after-collapse", { last: state.dreamDeck.at(-1)?.id });
  }
  if (state.dreamDeck.some((c) => c.id === "final-recurrence")) {
    fail("fr-card-in-collapse-deck", {});
  }
  if (allOuterTilesWasteland(state) !== true) fail("collapse-not-all-wasteland", {});
}

{
  const state = makeState();
  revealAllOuter(state);
  triggerBedFinalRecurrence(state, "audit fight");
  state.phaseIndex = 2;
  state.meetActionBudget = 20;
  const tile = state.board.find((t) => t.finalArchetype && !t.finalArchetype.defeated);
  if (!tile) {
    fail("no-final-arch-tile", {});
  } else {
    state.selectedLandscapeId = tile.id;
    const player = state.players[0];
    player.landscapeId = tile.id;
    const opposing = tile.finalArchetype.suit === "lucidity"
      ? "willpower"
      : tile.finalArchetype.suit === "willpower"
        ? "elasticity"
        : "lucidity";
    player.hand = Array.from({ length: 6 }, (_, i) => ({
      id: `audit-psyche-${i}`,
      instanceId: `audit-psyche-${i}`,
      type: "psyche",
      suit: i === 0 ? opposing : tile.finalArchetype.suit || "lucidity",
      value: 5,
      name: "Audit 5",
    }));
    state.selectedHand = player.hand.slice(0, 3).map((c) => c.instanceId);
    handleDefeatFinalArchetype(state);
    const entry = state.finalArchetypes.find((a) => a.id === tile.finalArchetype.id);
    if (!tile.finalArchetype.defeated || !entry?.defeated) {
      fail("defeat-did-not-stick", { tile: tile.finalArchetype.defeated, entry: entry?.defeated });
    }
  }
}

{
  const state = makeState();
  triggerBedFinalRecurrence(state, "audit lose");
  state.finalArchetypes.forEach((a) => { a.defeated = false; });
  state.dreamDeck = [{
    id: "you-never-wake",
    type: "final",
    name: "You Never Wake Up",
    text: "You Lose. Bottom of Final Recurrence Deck.",
  }];
  state.dreamDrawn = false;
  drawDreamCard(state);
  if (state.status !== "lost") fail("never-wake-should-lose", { status: state.status });
}

{
  const state = tutorialMod.createTutorialState(gameData);
  const idx = tutorialMod.TUTORIAL_SCRIPT.findIndex((s) => s.id === "r3-draw");
  tutorialMod.jumpTutorialToStep(state, idx);
  if (state.dreamDeck[0]?.id !== "cerberus") {
    fail("tutorial-cerberus-not-on-top", { top: state.dreamDeck[0]?.id });
  }
  const before = state.dreamDeck.length;
  const drawn = drawDreamCard(state);
  if (drawn?.id !== "cerberus") fail("tutorial-did-not-draw-cerberus", { got: drawn?.id });
  if (state.status === "lost") fail("tutorial-lost-on-cerberus", {});
  if (state.dreamDeck.length < 4) fail("tutorial-deck-too-thin", { left: state.dreamDeck.length, before });
  checkDefeat(state);
  if (state.status === "lost") fail("tutorial-checkdefeat-lost", {});
  landscapeById(state, "bed");
}

const report = { pass: failures.length === 0, failureCount: failures.length, failures };
console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("FAIL: final recurrence audit");
  process.exitCode = 1;
} else {
  console.log("PASS: Final Recurrence deck, collapse, fight, and tutorial Cerberus");
}
