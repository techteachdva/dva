#!/usr/bin/env node
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

const { loadGameData } = await import(pathToFileURL(path.join(JS_DIR, "data.js")).href);
const { createInitialState, repressTopPsycheFromDeck, checkDefeat } = await import(pathToFileURL(path.join(JS_DIR, "state.js")).href);
const { discardSelected, isWildPsyche } = await import(pathToFileURL(path.join(JS_DIR, "rules.js")).href);
const { getDreamerBoardRadialOptions } = await import(pathToFileURL(path.join(JS_DIR, "game.js")).href);
const { listSubconsciousCards } = await import(pathToFileURL(path.join(JS_DIR, "subconscious.js")).href);

const data = await loadGameData();
const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

const state = createInitialState(data, {
  lengthKey: "daydream",
  selectedDreamers: data.dreamers.slice(0, 2),
});
state.tutorialMode = false;

const player = state.players[0];
const wild = state.psycheDeck.find((c) => isWildPsyche(c)) || {
  id: "wild-test",
  type: "psyche",
  wild: true,
  value: 5,
  name: "Wild Psyche",
  instanceId: "wild-test-1",
};
if (!player.hand.some((c) => c.instanceId === wild.instanceId)) {
  player.hand.push(wild);
  state.psycheDeck = state.psycheDeck.filter((c) => c.instanceId !== wild.instanceId);
}
state.selectedHand = [wild.instanceId];
const deckBefore = state.psycheDeck.length;
const subBefore = listSubconsciousCards(state).length;
discardSelected(state, player);
const milled = deckBefore - state.psycheDeck.length;
assert(milled === 5, `Wild should repress 5 from the Psyche Deck, milled ${milled}`);
assert(listSubconsciousCards(state).length >= subBefore + 6, "Wild plus 5 deck cards should enter the Subconscious");
assert(state.status === "playing", "Table should still be playing after a normal Wild mill");

const empty = createInitialState(data, {
  lengthKey: "daydream",
  selectedDreamers: data.dreamers.slice(0, 2),
});
empty.tutorialMode = false;
empty.psycheDeck = empty.psycheDeck.slice(0, 3);
empty.psycheDiscard = [];
const taken = repressTopPsycheFromDeck(empty, 5);
assert(taken === 3, `Should mill remaining 3 when fewer than 5 remain, got ${taken}`);
assert(empty.status === "lost", "Empty Psyche draw+discard after mill should lose immediately");

const radial = getDreamerBoardRadialOptions(state, player, player.landscapeId, {
  drawDream: () => {},
  revealLandscape: () => {},
  activateExplore: () => {},
  gainMeetActions: () => {},
  togglePhasePowerToken: () => {},
  completeQuest: () => {},
  powerBonus: () => {},
  refundPowerBonus: () => {},
  useDreamerPower: () => {},
  landscapeAction: () => {},
  playObject: () => {},
  activateObject: () => {},
  tradeAction: () => {},
  meetEncounter: () => {},
  useArchetypePower: () => {},
});
const kinds = new Set(radial.map((opt) => opt.kind).filter(Boolean));
assert(!kinds.has("drawDream"), "Dreamer radial should not include Draw Dream");
assert(!kinds.has("revealLandscape"), "Dreamer radial should not include Reveal Landscapes");
assert(!kinds.has("completeQuest0"), "Dreamer radial should not include Quest buttons");
assert(!kinds.has("phasePowerToken"), "Dreamer radial should not include Token as Psyche");
assert(kinds.has("dreamerPower"), "Dreamer radial should include Dreamer Power");

if (failures.length) {
  console.error("FAIL somnia 25 rules");
  failures.forEach((msg) => console.error(` - ${msg}`));
  process.exit(1);
}
console.log("PASS somnia 25 wild mill, empty psyche defeat, slim radial");
