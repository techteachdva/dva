#!/usr/bin/env node
/**
 * Regression checks for Somnia 18.3:
 * - Bargaining acquires matching Active Archetype with incomplete quests
 * - isBlockingGameChoice covers required-choice pending flags
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

const { loadGameData } = await import(pathToFileURL(path.join(JS_DIR, "data.js")).href);
const stateMod = await import(pathToFileURL(path.join(JS_DIR, "state.js")).href);
const dreamMod = await import(pathToFileURL(path.join(JS_DIR, "dream-choices.js")).href);

const {
  createInitialState,
  acquireArchetype,
  isBlockingGameChoice,
  blockingChoiceLabel,
} = stateMod;
const { resolveDreamChoice } = dreamMod;

const data = await loadGameData();
const dreamers = data.dreamers.slice(0, 2);
const failures = [];

function assert(label, ok) {
  if (!ok) failures.push(label);
}

function makeState() {
  return createInitialState(data, {
    lengthKey: "daydream",
    selectedDreamers: dreamers,
  });
}

function psycheCard(suit, value, i) {
  return { instanceId: `psyche-${suit}-${value}-${i}`, type: "psyche", suit, value };
}

// ── acquireArchetype quest gate ──────────────────────────────────────────
{
  const state = makeState();
  const player = state.players[0];
  const archName = state.activeArchetype.name;
  state.activeArchetype.questProgress = [true, false];

  assert("skipQuestCheck acquires with 1/2 quests", acquireArchetype(state, player, undefined, { skipQuestCheck: true }));
  assert("archetype moved to player", player.acquiredArchetypes.some((a) => a.name === archName));
  assert("points increased", state.acquiredPoints > 0);
}

{
  const state = makeState();
  const player = state.players[0];
  state.activeArchetype.questProgress = [true, false];
  const before = state.acquiredPoints;

  assert("default acquire fails with incomplete quests", !acquireArchetype(state, player));
  assert("points unchanged on failed acquire", state.acquiredPoints === before);
  assert("active archetype still present", !!state.activeArchetype);
}

// ── Bargaining pay-six flow ──────────────────────────────────────────────
{
  const state = makeState();
  const player = state.players[0];
  const arch = state.activeArchetype;
  arch.questProgress = [true, false];

  const lucidityDreamer = data.dreamers.find((d) => (d.lucidity ?? 0) >= (d.elasticity ?? 0) && (d.lucidity ?? 0) >= (d.willpower ?? 0));
  if (lucidityDreamer) {
    player.dreamer = lucidityDreamer;
  }
  const suit = ["lucidity", "elasticity", "willpower"].sort(
    (a, b) => (player.dreamer[b] ?? 0) - (player.dreamer[a] ?? 0),
  )[0];
  arch.suit = suit;

  player.hand = Array.from({ length: 6 }, (_, i) => psycheCard(suit, 1, i));
  const archName = arch.name;
  const pointsBefore = state.acquiredPoints;

  state.pendingDreamChoice = {
    dreamId: "bargaining",
    ui: "spend",
    step: "pay-six",
    playerId: player.id,
    cards: [...player.hand],
    needCount: 6,
    order: player.hand.map((c) => c.instanceId),
  };

  assert("bargaining confirm resolves", resolveDreamChoice(state, "confirm"));
  assert("bargaining acquires archetype", player.acquiredArchetypes.some((a) => a.name === archName));
  assert("bargaining adds points", state.acquiredPoints > pointsBefore);
  assert("bargaining discards 6 psyche", player.hand.length === 0);
  assert("bargaining clears pending", !state.pendingDreamChoice);
}

// ── isBlockingGameChoice flags ───────────────────────────────────────────
{
  const state = makeState();
  const base = { ...state, pendingDreamChoice: null, pendingEffectChoice: null, pendingObjectChoice: null };

  assert("idle not blocking", !isBlockingGameChoice(base));

  const cases = [
    ["pendingDreamChoice", { pendingDreamChoice: { title: "Bargaining" } }],
    ["pendingEffectChoice", { pendingEffectChoice: { title: "Effect" } }],
    ["pendingObjectChoice", { pendingObjectChoice: { title: "Object" } }],
    ["pendingReturn", { pendingReturn: { playerId: "x" } }],
    ["pendingRepress", { pendingRepress: { playerId: "x" } }],
    ["pendingDeathChoice", { pendingDeathChoice: { playerId: "x" } }],
    ["pendingNothingChoice", { pendingNothingChoice: {} }],
    ["pendingRespawn", { pendingRespawn: {} }],
    ["landscapePick", { landscapePick: { title: "Move" } }],
    ["pendingDreamerPower", { pendingDreamerPower: { ui: { title: "Power" } } }],
  ];

  for (const [name, patch] of cases) {
    const s = { ...base, ...patch };
    assert(`${name} blocks`, isBlockingGameChoice(s));
    assert(`${name} has label`, blockingChoiceLabel(s).length > 0);
  }
}

// ── UI source checks (no DOM) ────────────────────────────────────────────
const uiSrc = fs.readFileSync(path.join(JS_DIR, "ui.js"), "utf8");
const playSrc = fs.readFileSync(path.join(JS_DIR, "play.js"), "utf8");

assert("ui exports minimizeUtilityModal", /export function minimizeUtilityModal/.test(uiSrc));
assert("ui exports setUtilityModalRequired", /export function setUtilityModalRequired/.test(uiSrc));
assert("hideUtilityModal supports force", /hideUtilityModal\(force/.test(uiSrc));
assert("play uses isBlockingGameChoice", playSrc.includes("isBlockingGameChoice"));
assert("play imports blocking helpers", playSrc.includes("setUtilityModalRequired"));

const report = { pass: failures.length === 0, failureCount: failures.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error("FAIL: Somnia 18.3 regression check");
  process.exit(1);
}
console.log("PASS: Somnia 18.3 regression check");
