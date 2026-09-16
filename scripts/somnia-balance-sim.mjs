/**
 * Monte Carlo playthrough simulator for Somnia economy (Power Tokens, rounds, etc.)
 * Run: node scripts/somnia-balance-sim.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_ROOT = join(__dirname, "../src/site/somnia");
const DATA_DIR = join(SOMNIA_ROOT, "data");
const JS_DIR = join(SOMNIA_ROOT, "js");

// --- Minimal browser mocks so game modules load in Node ---
function stubEl() {
  const children = [];
  const el = {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {},
    setAttribute() {},
    appendChild(node) {
      children.push(node);
      return node;
    },
    insertBefore(node, before) {
      if (!before) {
        children.unshift(node);
      } else {
        const idx = children.indexOf(before);
        if (idx >= 0) children.splice(idx, 0, node);
        else children.push(node);
      }
      return node;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    replaceWith() {},
    cloneNode: () => stubEl(),
    textContent: "",
    innerHTML: "",
    disabled: false,
    get firstChild() {
      return children[0] || null;
    },
  };
  return el;
}

globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  getElementById: (id) => {
    if (id === "moment-overlay-stack" || id === "table-surface") return stubEl();
    return null;
  },
  createElement: () => stubEl(),
  body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
  documentElement: { style: { setProperty() {} } },
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.window.matchMedia = () => ({ matches: false, addEventListener: () => {} });
globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
globalThis.Audio = function Audio() {
  this.play = () => Promise.resolve();
  this.pause = () => {};
};

function loadGameDataSync() {
  const names = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const data = {};
  for (const file of names) {
    const key = file.replace(".json", "");
    data[key] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  }
  return data;
}

const dataModule = await import(pathToFileURL(join(JS_DIR, "data.js")).href);
const gameData = loadGameDataSync();
gameData.mindstream = dataModule.enrichMindstreamEvents?.(
  gameData.mindstream,
  gameData["event-landscapes"] || {},
) ?? gameData.mindstream;

const { createInitialState, getPhase } = await import(pathToFileURL(join(JS_DIR, "state.js")).href);
const { powerTokensHeld, powerTokensInPool, MAX_POWER_TOKEN_POOL, grantPowerTokens } = await import(
  pathToFileURL(join(JS_DIR, "power-tokens.js")).href
);
const {
  drawDreamCard,
  revealLandscape,
  activateExplore,
  gainMeetActions,
  endPhase,
  drawMindstreamCard,
} = await import(pathToFileURL(join(JS_DIR, "game.js")).href);
const { handleLandscapeTilePick, revealableTiles } = await import(
  pathToFileURL(join(JS_DIR, "landscapes.js")).href
);
const { spendPowerTokens } = await import(pathToFileURL(join(JS_DIR, "power-tokens.js")).href);
const { markQuestComplete } = await import(pathToFileURL(join(JS_DIR, "game.js")).href).catch(() => ({}));

function pickDreamers(count = 2) {
  return gameData.dreamers.slice(0, count);
}

function totalPower(state) {
  return powerTokensHeld(state);
}

function powerSnapshot(state) {
  return {
    total: totalPower(state),
    pool: powerTokensInPool(state),
    perPlayer: state.players.map((p) => p.powerTokens || 0),
  };
}

function setActivePlayer(state, index) {
  state.activePlayerIndex = index;
}

function selectSuitCards(state, playerIndex, suit, max = 2) {
  const player = state.players[playerIndex];
  setActivePlayer(state, playerIndex);
  state.selectedHand = [];
  const cards = player.hand.filter((c) => c.type === "psyche" && (c.suit === suit || c.wild));
  const chosen = cards.slice(0, max);
  state.selectedHand = chosen.map((c) => c.instanceId);
  return chosen.length;
}

function autoRevealPick(state) {
  let guard = 40;
  while (state.landscapePick?.mode === "reveal" && state.landscapePick.remaining > 0 && guard-- > 0) {
    const tile = revealableTiles(state)[0];
    if (!tile) break;
    handleLandscapeTilePick(state, tile.id);
  }
}

function bestContributorIndex(state, suit) {
  let best = 0;
  let bestVal = -1;
  state.players.forEach((p, i) => {
    if (!p.alive) return;
    const cards = p.hand.filter((c) => c.suit === suit || c.wild);
    if (!cards.length) return;
    const stat = p.dreamer[suit] || 0;
    const val = stat + cards.reduce((s, c) => s + (c.value || 0), 0);
    if (val > bestVal) {
      bestVal = val;
      best = i;
    }
  });
  return best;
}

function runRevealPhase(state, { revealTiles = 1 } = {}) {
  drawDreamCard(state);
  const pi = bestContributorIndex(state, "lucidity");
  if (selectSuitCards(state, pi, "lucidity", 2) >= 1) {
    revealLandscape(state);
    autoRevealPick(state);
    if (state.landscapePick) {
      cancelLandscapePick(state);
      state.revealLandscapeUsed = true;
    }
  }
  endPhase(state);
}

async function cancelLandscapePick(state) {
  const { cancelLandscapePick: cancel } = await import(pathToFileURL(join(JS_DIR, "landscapes.js")).href);
  cancel(state);
}

function runExplorePhase(state) {
  const pi = bestContributorIndex(state, "elasticity");
  if (selectSuitCards(state, pi, "elasticity", 2) >= 1) {
    activateExplore(state);
  }
  endPhase(state);
}

function runMeetPhase(state, { mindstreamDraws = 0, spendQuestPower = 0 } = {}) {
  const pi = bestContributorIndex(state, "willpower");
  if (selectSuitCards(state, pi, "willpower", 2) >= 1) {
    gainMeetActions(state);
  }

  const suits = ["lucidity", "elasticity", "willpower"];
  for (let i = 0; i < mindstreamDraws && state.meetActionsUsed < state.meetActionBudget; i += 1) {
    drawMindstreamCard(state, suits[i % 3]);
    state.meetActionsUsed += 1;
  }

  if (spendQuestPower > 0 && state.activeArchetype) {
    const player = state.players[0];
    for (let i = 0; i < spendQuestPower; i += 1) {
      if ((player.powerTokens || 0) < 1) break;
      spendPowerTokens(state, player, 1);
      state.activeArchetype.powerTokensOnArchetype = (state.activeArchetype.powerTokensOnArchetype || 0) + 1;
      state.activeArchetype.questProgress[i] = true;
    }
  }

  endPhase(state);
}

function runRound(state, opts) {
  const before = totalPower(state);
  runRevealPhase(state, opts);
  runExplorePhase(state);
  runMeetPhase(state, opts);
  return {
    round: state.round - 1,
    powerBefore: before,
    powerAfter: totalPower(state),
    gained: totalPower(state) - before,
    dreamsLeft: state.dreamDeck.length,
    points: state.acquiredPoints,
  };
}

function simulateGame(strategy, rounds, playerCount = 2) {
  const dreamers = pickDreamers(playerCount);
  const state = createInitialState(gameData, {
    lengthKey: "nap",
    selectedDreamers: dreamers,
  });

  const timeline = [{ round: 1, ...powerSnapshot(state), phase: "start" }];
  const roundLogs = [];

  for (let r = 1; r <= rounds && state.status === "playing"; r += 1) {
    const log = runRound(state, strategy);
    roundLogs.push(log);
    timeline.push({ round: state.round, ...powerSnapshot(state), phase: "after-round" });
    if (state.status !== "playing") break;
  }

  return { state, timeline, roundLogs, strategy: strategy.name };
}

function stats(nums) {
  if (!nums.length) return { min: 0, max: 0, avg: 0, p50: 0, p90: 0 };
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: p(0.5),
    p90: p(0.9),
  };
}

const STRATEGIES = [
  { name: "passive", revealTiles: 1, mindstreamDraws: 0, spendQuestPower: 0 },
  { name: "light-meet", revealTiles: 1, mindstreamDraws: 1, spendQuestPower: 0 },
  { name: "active-meet", revealTiles: 1, mindstreamDraws: 3, spendQuestPower: 0 },
  { name: "quest-spender", revealTiles: 1, mindstreamDraws: 1, spendQuestPower: 2 },
];

const RUNS = 400;
const ROUNDS = 6;
const PLAYER_COUNT = 2;

console.log("Somnia balance simulation");
console.log(`Runs: ${RUNS} × ${ROUNDS} rounds · ${PLAYER_COUNT} dreamers · nap length (18pt goal)`);
console.log(`Power pool cap: ${MAX_POWER_TOKEN_POOL} team-wide\n`);

for (const strategy of STRATEGIES) {
  const endPowers = [];
  const round2Powers = [];
  const gainsByRound = Array.from({ length: ROUNDS }, () => []);

  for (let i = 0; i < RUNS; i += 1) {
    const { timeline, roundLogs } = simulateGame(strategy, ROUNDS, PLAYER_COUNT);
    endPowers.push(timeline[timeline.length - 1].total);
    const r2 = timeline.find((t) => t.round === 3);
    if (r2) round2Powers.push(r2.total);
    roundLogs.forEach((log, idx) => {
      if (gainsByRound[idx]) gainsByRound[idx].push(log.gained);
    });
  }

  console.log(`── Strategy: ${strategy.name} ──`);
  console.log(`  Power after round 2 (start of R3): ${JSON.stringify(stats(round2Powers))}`);
  console.log(`  Power after ${ROUNDS} rounds:         ${JSON.stringify(stats(endPowers))}`);
  console.log("  Avg gain per round:", gainsByRound.map((arr, i) => `R${i + 1}:${stats(arr).avg.toFixed(2)}`).join(" · "));
  console.log("");
}

// Psyche power card rate analysis (no full game)
{
  const { buildPsycheDeck, PSYCHE_POWER_TOKEN_COUNT, PSYCHE_DISTRIBUTION } = dataModule;
  const deck = buildPsycheDeck(gameData.psyche);
  const powerInDeck = deck.filter((c) => c.type === "psyche-power").length;
  console.log("── Deck composition ──");
  console.log(`  Psyche deck: ${deck.length} cards · ${powerInDeck} Power Surge (+${dataModule.PSYCHE_POWER_GRANT || 1} each)`);
  console.log(`  Config: ${PSYCHE_POWER_TOKEN_COUNT} power cards · distribution ${JSON.stringify(PSYCHE_DISTRIBUTION)}`);

  const drawsPerRound = 2 * PLAYER_COUNT;
  let powerCardsSeen = 0;
  let tokensFromPowerCards = 0;
  const SIM = 2000;
  for (let s = 0; s < SIM; s += 1) {
    const d = buildPsycheDeck(gameData.psyche);
    for (let i = 0; i < drawsPerRound; i += 1) {
      if (!d.length) break;
      const card = d.shift();
      if (card.type === "psyche-power") {
        powerCardsSeen += 1;
        tokensFromPowerCards += card.powerTokens || 2;
      }
    }
  }
  console.log(`  Expected per round (${drawsPerRound} draws, ${SIM} samples):`);
  console.log(`    Power Surge hits: ${(powerCardsSeen / SIM).toFixed(2)} → ~${(tokensFromPowerCards / SIM).toFixed(2)} tokens`);
}

// Mindstream power-token card rate
{
  const { MINDSTREAM_COMPOSITION } = dataModule;
  const perSuit = MINDSTREAM_COMPOSITION.powerToken;
  const totalMsPower = perSuit * 3;
  console.log("\n── Mindstream power sources ──");
  console.log(`  ${perSuit} power-token cards per suit × 3 suits = ${totalMsPower} (+1 each when drawn)`);
  console.log(`  Active-meet strategy draws ~3 mindstream/round → variable token influx`);
}

console.log("\n── Interpretation ──");
console.log("  Start: 0 held tokens (gain via quests, Power Surge, and Mindstream).");
console.log("  Mindstream power cards now grant +1 each to slow mid-game token flood.");
console.log("  Pool caps at 24 held — excess grants are lost.");
