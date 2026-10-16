#!/usr/bin/env node
/**
 * Somnia 41.0 playtest. Real engine, real d6 (5–6 succeed, ties to the beast).
 * 2 / 3 / 4 Dreamers, Nap length, Bot 41 "Mind-keeper" (js/dev/bot-policy.js).
 *
 *   node scripts/somnia-41-bot-sim.mjs
 *   node scripts/ainmos-bot-sim.mjs --per 200   (Ainmos fork of the Somnia Bot 41 sim)
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_ROOT = join(__dirname, "../src/site/ainmos");
const DATA_DIR = join(SOMNIA_ROOT, "data");
const JS_DIR = join(SOMNIA_ROOT, "js");

function stubStyle() {
  return { setProperty() {}, getPropertyValue: () => "", removeProperty() {} };
}

function stubEl() {
  const el = {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: stubStyle(),
    dataset: {},
    setAttribute() {},
    getAttribute: () => null,
    appendChild(child) { return child; },
    insertBefore(child) { return child; },
    remove() {},
    parentNode: { removeChild() {} },
    firstChild: null,
    childNodes: [],
    children: [],
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    replaceWith() {},
    cloneNode() { return stubEl(); },
    getContext() {
      return {
        fillRect() {}, clearRect() {}, drawImage() {},
        measureText: () => ({ width: 0 }),
        beginPath() {}, arc() {}, fill() {}, stroke() {},
        save() {}, restore() {}, translate() {}, scale() {},
        setTransform() {}, moveTo() {}, lineTo() {},
      };
    },
    textContent: "",
    innerHTML: "",
    disabled: false,
    hidden: false,
    offsetWidth: 1,
    offsetHeight: 1,
    width: 1,
    height: 1,
  };
  return el;
}

const stubDomNodes = new Map();
globalThis.window = globalThis;
globalThis.__SOMNIA_REAL_DICE__ = true;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  getElementById(id) { return stubDomNodes.get(id) || null; },
  createElement(tag) {
    const el = stubEl();
    el.tagName = String(tag || "div").toUpperCase();
    return el;
  },
  body: {
    appendChild(el) {
      if (el?.id) stubDomNodes.set(el.id, el);
      return el;
    },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  },
  documentElement: { style: stubStyle(), classList: { add() {}, remove() {} } },
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  hidden: false,
};
globalThis.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
globalThis.window.innerWidth = 1280;
globalThis.window.innerHeight = 800;
globalThis.requestAnimationFrame = (fn) => { fn(0); return 0; };
globalThis.cancelAnimationFrame = () => {};
globalThis.Audio = class { play() { return Promise.resolve(); } pause() {} };
globalThis.Image = class { set src(_) {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };

const mod = (rel) => import(pathToFileURL(join(JS_DIR, rel)).href);

const [
  stateMod,
  gameMod,
  rulesMod,
  botMod,
  mindstreamChoices,
  mindstreamSupply,
  dreambeasts,
  psycheMod,
  subconscious,
  landscapesMod,
  hexMod,
  questsMod,
  finalMod,
  objectEffects,
  objectsMod,
  effectChoices,
  dreamChoices,
  dreamReplay,
  dreamerPowers,
  boardFx,
  policy,
  meetPhase,
] = await Promise.all([
  mod("core/state.js"),
  mod("core/game.js"),
  mod("core/rules.js"),
  mod("dev/bot-ai.js"),
  mod("cards/mindstream-choices.js"),
  mod("cards/mindstream-supply.js"),
  mod("encounters/dreambeasts.js"),
  mod("cards/psyche.js"),
  mod("dreamers/subconscious.js"),
  mod("board/landscapes.js"),
  mod("core/hex.js"),
  mod("dreamers/quests.js"),
  mod("dreamers/final-recurrence-rules.js"),
  mod("effects/object-effects.js"),
  mod("effects/objects.js"),
  mod("effects/effect-choices.js"),
  mod("cards/dream-choices.js"),
  mod("cards/dream-replay.js"),
  mod("dreamers/dreamer-powers.js"),
  mod("board/board-fx.js"),
  mod("dev/bot-policy.js"),
  mod("encounters/meet-phase.js"),
]);

const { createInitialState, landscapeById, checkVictory } = stateMod;
const {
  drawDreamCard, revealLandscape, activateExplore, gainMeetActions, endPhase,
  moveDreamer, meetEncounter, spendExcessPsycheDraw, passActionTurnTo,
  handleBoardTileClick, handleQuestComplete, handleAcquire, handleDefeatFinalArchetype,
  performLandscapeAction, getEffectHelpers, actionTurnHolder, powerBonus, playObject,
  handleBoardSlotClick, handleVaultTileSelect,
  faceArchetype, fightArchetype, archetypeFightDice,
} = gameMod;
const { focusRowArchetype } = stateMod;
const {
  mindRunway, wantsRemember, pickRememberChoice, pickReturnInstance, pickHandLoss,
  rememberObject, memoryTiles, memoryTileOpen, bestRowArchetype, readyArchetype, LOW_RUNWAY, handSurplus,
  rememberObjectReady, canRememberNow,
} = policy;
const { wakingMindCount } = meetPhase;
const {
  getPhase, phaseOpeningActive, encounterPaySuit, selectedHasPaySuit, totalStat,
  avoidDreamerDeath, acceptDreamerDeath, respawnDreamer,
} = { ...rulesMod, ...stateMod };
const { pickMindstreamChoice, botSelectOpener } = botMod;
const { resolveMindstreamChoice } = mindstreamChoices;
const { goneMindstreamSuit } = mindstreamSupply;
const { encounterPower, recommendedEncounterPower, dreamerMeetBonuses } = dreambeasts;
const { isWildPsyche } = psycheMod;
const {
  isDreambeastPsycheCard, listSubconsciousCards, pickReturnCard, pickRepressCard, confirmRepressStep,
} = subconscious;
const { revealableTiles, forgettableTiles, cancelLandscapePick, revealCapacity, pendingPlacementCard } = landscapesMod;
const vaultMod = await mod("board/dreamscape-vault.js");
const archBoard = await mod("dreamers/archetype-board.js");
const archCall = await mod("dreamers/archetype-call.js");
const endlessMod = await mod("encounters/endless.js");
const cycleMod = await mod("core/cycle.js");
/** AINMOS_ENDLESS=1: after a win, keep playing in Endless Mode and report how far the bot gets. */
const ENDLESS = !!process.env.AINMOS_ENDLESS;
/** AINMOS_BOT=dumb plays carelessly: random calls, always Dim, first legal spread, aimless walking, no shopping. */
const DUMB = process.env.AINMOS_BOT === "dumb";
const formsMod = await mod("cards/dream-forms.js");
const shopMod = await mod("shop/lost-found.js");
const boonMod = await mod("dreamers/boons.js");
const { isFreeformBoard, vaultCards, placementSlots } = vaultMod;
// Ainmos always builds a Freeform Board.
const BOARD_MODE = "freeform";

/** Freeform: take a quest tile from the Vault if one is there, and place it next to a Dreamer. */
const { getLegalMoveTargets, hexDistance } = hexMod;
const { activeQuestLandscapeIds, isQuestConditionMet, sacrificeHeldObject, listSacrificableObjects } = questsMod;
const { undefeatedFinalArchetypes } = finalMod;
const { resolveObjectChoice, resumeObjectEffect } = objectEffects;
const { resolveNothingChoice } = objectsMod;
const { resolveEffectChoice } = effectChoices;
const { resolveDreamChoice, advanceDreamQueue } = dreamChoices;
const { dreamReplayOptions, replayChosenDream } = dreamReplay;
const {
  resolveDreamerPowerChoice, resolveDreamerPowerDeckPick, resolveDreamerPowerHandPick, handleDreamerPowerTilePick,
} = dreamerPowers;
const { runPendingBoardFx } = boardFx;

const helpers = getEffectHelpers();
const STEP_CAP = 4000;
const STUCK_LIMIT = 14;

const ROSTERS = {
  2: ["the-visionary", "the-immovable"],
  3: ["the-visionary", "the-hunter", "the-weaver"],
  4: ["the-rested", "the-runner", "the-hunter", "the-weaver"],
};

const dataMod = await mod("core/data.js");

/** Same data the game plays with: raw JSON through the game's own prepareGameData. */
function loadData() {
  const names = ["dreamers", "archetypes", "landscapes", "dreambeasts", "dreams", "psyche", "mindstream", "event-landscapes", "objects"];
  const data = {};
  for (const name of names) data[name] = JSON.parse(readFileSync(join(DATA_DIR, `${name}.json`), "utf8"));
  return dataMod.prepareGameData(data);
}

const DATA = loadData();
const DREAMER_BY_ID = Object.fromEntries(DATA.dreamers.map((d) => [d.id, d]));

// The bot's whole policy lives in the game's own dev module, so the browser
// (gameplay recordings) plays exactly like the sim.
const autoplay = await mod("dev/autoplay.js");
autoplay.configureAutoplay({ dumb: DUMB, endless: ENDLESS });
const {
  act, resolveOnePending, signature, tryAcquire, shopTurn, pickBoon, subPsyche, alive, beastsOn, placeFromVault,
} = autoplay;

function lossReason(state, steps, error) {
  if (error) return "error";
  if (steps >= STEP_CAP) return "step-cap";
  const tail = (state.log || []).join(" \n ").toLowerCase();
  if ((state.deathClock || 0) >= 6 || tail.includes("death clock strikes")) return "death-clock";
  if (tail.includes("psyche deck is exhausted") || tail.includes("waking mind is empty")) return "mind-empty";
  if (tail.includes("final recurrence ends with")) return "final-recurrence-timeout";
  const mind = tail.match(/the (\w+) mindstream is gone/);
  if (mind) return `mindstream-${mind[1]}`;
  if (tail.includes("no dreamers remain")) return "no-dreamers";
  if (tail.includes("dream deck is exhausted")) {
    return state.finalRecurrence ? "final-recurrence-timeout" : "dream-deck";
  }
  if (tail.includes("you never wake")) return "you-never-wake-up";
  return "other";
}

/** Ainmos is solo: each game is one Dreamer, rotating through the roster. */
const SOLO_DREAMERS = DATA.dreamers.filter((d) => !d.hidden);

function playGame(lengthKey, index, setup = null) {
  const dreamer = SOLO_DREAMERS[index % SOLO_DREAMERS.length];
  const selectedDreamers = [dreamer];
  const state = createInitialState(DATA, {
    lengthKey,
    seed: `${lengthKey}-solo-${index}`,
    selectedDreamers,
    boardMode: BOARD_MODE,
  });
  // Ainmos experiment knob: a fixed Object limit (6 or 10).
  if (process.env.AINMOS_OBJECT_LIMIT) state.objectLimit = Number(process.env.AINMOS_OBJECT_LIMIT);
  if (setup) setup(state);
  let steps = 0;
  let stuck = 0;
  let prev = "";
  let error = null;
  let enteredFinal = false;
  let lastSub = subPsyche(state);
  let psycheReturned = 0;
  let psycheRepressed = 0;
  let firstAcquireRound = null;
  let wokeRound = null;
  try {
    for (;;) {
    while (state.status === "playing" && steps < STEP_CAP) {
      steps += 1;
      const nowSub = subPsyche(state);
      if (nowSub < lastSub) psycheReturned += lastSub - nowSub;
      if (nowSub > lastSub) psycheRepressed += nowSub - lastSub;
      lastSub = nowSub;
      if (firstAcquireRound == null && (state.acquiredPoints || 0) > 0) firstAcquireRound = state.round;
      if (state.finalRecurrence) enteredFinal = true;
      if (state.log?.length > 80) state.log.splice(0, state.log.length - 40);
      try { runPendingBoardFx(); } catch { /* fx is cosmetic */ }
      tryAcquire(state);
      if (state.status !== "playing") break;
      // Ainmos: shop, then leave; draft the best Boon.
      if (state.lostFound?.open && !state.pendingEffectChoice) {
        shopTurn(state);
        shopMod.closeLostFound(state);
      }
      if (state.pendingBoonDraft) boonMod.chooseBoon(state, pickBoon(state.pendingBoonDraft.options));
      const pending = resolveOnePending(state);
      if (state.status !== "playing") break;
      if (!pending && !act(state) && state.status === "playing" && !state.landscapePick && !state.pendingMindstreamChoice && !state.pendingDreamChoice) {
        endPhase(state);
      }
      if (state.status !== "playing") break;
      checkVictory(state);
      const sig = signature(state);
      if (sig === prev) stuck += 1;
      else {
        stuck = 0;
        prev = sig;
      }
      if (stuck >= STUCK_LIMIT) {
        if (state.landscapePick) {
          if (!spendExcessPsycheDraw(state)) cancelLandscapePick(state);
        } else if (state.pendingMindstreamChoice || state.pendingDreamChoice || state.pendingEffectChoice || state.pendingObjectChoice || state.pendingDreamerPower || state.pendingMindstreamMeet) {
          state.pendingMindstreamChoice = null;
          state.pendingDreamChoice = null;
          state.pendingEffectChoice = null;
          state.pendingObjectChoice = null;
          state.pendingDreamerPower = null;
          state.pendingMindstreamMeet = null;
        } else {
          endPhase(state);
        }
        stuck = 0;
        prev = "";
      }
    }
    if (ENDLESS && state.status === "won" && !state.endless) {
      wokeRound = state.round;
      endlessMod.startEndless(state, { beastCatalog: Object.fromEntries(DATA.dreambeasts.map((b) => [b.id, b])) });
      stuck = 0;
      prev = "";
      continue;
    }
    break;
    }
  } catch (err) {
    error = err?.message || String(err);
    state.status = "lost";
  }
  const won = state.status === "won" || !!state.endless;
  // AINMOS_TRACE=1 prints the whole log of game 1 at each length.
  if (process.env.AINMOS_TRACE && index === 1) {
    console.log(`
--- trace ${lengthKey} ${state.players[0]?.dreamer?.id} ${state.status} ---`);
    (state.log || []).forEach((line) => console.log(typeof line === "string" ? line : (line.text || JSON.stringify(line))));
  }
  return {
    won,
    reason: won ? "win" : lossReason(state, steps, error),
    error,
    rounds: state.round || 0,
    points: state.acquiredPoints || 0,
    goal: state.goalPoints || 0,
    deaths: state.deathClock || 0,
    archetypes: state.players.reduce((n, p) => n + (p.acquiredArchetypes?.length || 0), 0),
    finalRecurrence: enteredFinal || !!state.finalRecurrence,
    steps,
    tail: won ? "" : (state.log || []).slice(-6).join(" | "),
    phaseAtEnd: getPhase(state),
    pendingAtEnd: Object.keys(state).filter((k) => k.startsWith("pending") && state[k]).join(","),
    psycheReturned,
    psycheRepressed,
    subAtEnd: subPsyche(state),
    objectsBought: state.runStats?.objectsBought || 0,
    insights: state.botShop?.insights || 0,
    formLevels: Object.values(state.formLevels || {}).reduce((sum, level) => sum + (level - 1), 0),
    bossesDefeated: (state.bossesDefeated || []).length,
    dreamer: state.players[0]?.dreamer?.id || "",
    goalMet: !!state.archetypeGoalReached,
    finalDown: (state.bossesDefeated || []).includes(state.finalBossId),
    fightsWon: state.runStats?.fightsWon || 0,
    fightsLost: state.runStats?.fightsLost || 0,
    nightSpawns: Object.values(state.nightSpawns || {}).flat().filter((s) => !s.boss).length,
    boons: (state.boons || []).length,
    remember: { ...(state.rememberStats || {}) },
    mindAtEnd: wakingMindCount(state),
    handsAtEnd: alive(state).reduce((n, p) => n + (p.hand || []).length, 0),
    firstAcquireRound,
    archFights: state.botArch?.fights || 0,
    economy: state.economy || { tokensIn: {}, tokensSpent: 0, tokensCapped: 0 },
    endless: state.endless
      ? {
        wokeRound,
        cycles: cycleMod.cyclePosition(state).cycle - state.endless.startedCycle,
        felled: (state.endless.tiersFelled || []).length,
        planned: state.endless.tierPlanned || 0,
        triumph: !!state.endlessTriumph,
        archetypes: state.acquiredPoints || 0,
      }
      : null,
  };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function summarize(rows) {
  const wins = rows.filter((row) => row.won);
  const losses = rows.filter((row) => !row.won);
  const reasons = {};
  for (const row of losses) reasons[row.reason] = (reasons[row.reason] || 0) + 1;
  const fr = rows.filter((row) => row.finalRecurrence);
  return {
    games: rows.length,
    wins: wins.length,
    losses: losses.length,
    winRate: rows.length ? wins.length / rows.length : 0,
    lossReasons: reasons,
    avgRounds: Number(mean(rows.map((r) => r.rounds)).toFixed(2)),
    medianRounds: median(rows.map((r) => r.rounds)),
    avgPoints: Number(mean(rows.map((r) => r.points)).toFixed(2)),
    avgPointsOnLoss: Number(mean(losses.map((r) => r.points)).toFixed(2)),
    avgArchetypes: Number(mean(rows.map((r) => r.archetypes)).toFixed(2)),
    avgDeathClock: Number(mean(rows.map((r) => r.deaths)).toFixed(2)),
    finalRecurrenceGames: fr.length,
    finalRecurrenceWins: fr.filter((r) => r.won).length,
    winsBeforeFinalRecurrence: wins.filter((r) => !r.finalRecurrence).length,
    avgRoundsOnWin: Number(mean(wins.map((r) => r.rounds)).toFixed(2)),
    avgRoundsOnLoss: Number(mean(losses.map((r) => r.rounds)).toFixed(2)),
    stepCaps: losses.filter((r) => r.reason === "step-cap").length,
    errors: losses.filter((r) => r.reason === "error").length,
    zeroPointGames: rows.filter((r) => r.points <= 0).length,
    pointsBuckets: {
      "0": rows.filter((r) => r.points <= 0).length,
      "1-3": rows.filter((r) => r.points >= 1 && r.points <= 3).length,
      "4-7": rows.filter((r) => r.points >= 4 && r.points <= 7).length,
      "8-11": rows.filter((r) => r.points >= 8 && r.points <= 11).length,
      "12+": rows.filter((r) => r.points >= 12).length,
    },
    deathClockBuckets: [0, 1, 2, 3, 4, 5, 6].map((n) => rows.filter((r) => r.deaths === n).length),
    avgPsycheReturned: +mean(rows.map((r) => r.psycheReturned || 0)).toFixed(1),
    avgPsycheRepressed: +mean(rows.map((r) => r.psycheRepressed || 0)).toFixed(1),
    avgSubAtEnd: +mean(rows.map((r) => r.subAtEnd || 0)).toFixed(1),
    avgObjectsBought: +mean(rows.map((r) => r.objectsBought || 0)).toFixed(2),
    avgInsights: +mean(rows.map((r) => r.insights || 0)).toFixed(2),
    avgFormLevelsGained: +mean(rows.map((r) => r.formLevels || 0)).toFixed(2),
    avgBossesDefeated: +mean(rows.map((r) => r.bossesDefeated || 0)).toFixed(2),
    avgBeastSpawns: +mean(rows.map((r) => r.nightSpawns || 0)).toFixed(2),
    avgFightsWon: +mean(rows.map((r) => r.fightsWon || 0)).toFixed(2),
    avgFightsLost: +mean(rows.map((r) => r.fightsLost || 0)).toFixed(2),
    avgBoons: +mean(rows.map((r) => r.boons || 0)).toFixed(2),
    tokens: {
      // Sum first, round once: rounding each step drifted (2 tokens read as 3 over 300 games).
      inBySource: Object.fromEntries(Object.entries(rows.reduce((acc, r) => {
        for (const [k, v] of Object.entries(r.economy?.tokensIn || {})) acc[k] = (acc[k] || 0) + v;
        return acc;
      }, {})).map(([k, v]) => [k, +(v / rows.length).toFixed(2)])),
      spent: +mean(rows.map((r) => r.economy?.tokensSpent || 0)).toFixed(2),
      lostToCap: +mean(rows.map((r) => r.economy?.tokensCapped || 0)).toFixed(2),
    },
    endless: (() => {
      const e = rows.map((r) => r.endless).filter(Boolean);
      if (!e.length) return null;
      return {
        runs: e.length,
        avgExtraCycles: +mean(e.map((x) => x.cycles)).toFixed(2),
        avgLeviathansFelled: +mean(e.map((x) => x.felled)).toFixed(2),
        maxLeviathanFelled: Math.max(...e.map((x) => x.felled)),
        reachedMegas: e.filter((x) => x.planned > 0).length,
        triumphs: e.filter((x) => x.triumph).length,
        avgArchetypes: +mean(e.map((x) => x.archetypes)).toFixed(2),
      };
    })(),
    rememberBySource: rows.reduce((acc, r) => {
      for (const [k, v] of Object.entries(r.remember || {})) acc[k] = +(((acc[k] || 0) + v / rows.length)).toFixed(2);
      return acc;
    }, {}),
    avgMindAtEnd: +mean(rows.map((r) => r.mindAtEnd || 0)).toFixed(1),
    avgHandsAtEnd: +mean(rows.map((r) => r.handsAtEnd || 0)).toFixed(1),
    avgArchFights: +mean(rows.map((r) => r.archFights || 0)).toFixed(2),
  };
}

function argPer() {
  const idx = process.argv.indexOf("--per");
  if (idx >= 0) return Math.max(1, Number(process.argv[idx + 1]) || 1);
  return 1000;
}

/** Run as a script: play the sim. Imported (by the Object/Boon audit): only expose the machinery. */
const IS_MAIN = !!process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

export { DATA, helpers, playGame, resolveOnePending, stateMod, gameMod, objectEffects, objectsMod, shopMod, boonMod, vaultMod, landscapesMod, subconscious, dreambeasts, alive, beastsOn, placeFromVault };

/**
 * AINMOS_PSYCHE="1:5,2:4,3:3,4:2,5:1/w6" plays every length with that Psyche deck
 * (per suit value:copies, then /wN Wilds). AINMOS_LENGTHS="nap,deep" runs only those.
 */
function parsePsyche(text) {
  const [dist, wild] = String(text).split("/");
  const distribution = Object.fromEntries(dist.split(",").map((pair) => pair.split(":").map(Number)));
  return { distribution, wildCount: wild ? Number(wild.replace(/^w/i, "")) : 6 };
}
if (process.env.AINMOS_PSYCHE) globalThis.__ainmosPsycheOverride = { all: parsePsyche(process.env.AINMOS_PSYCHE) };

if (IS_MAIN) {
  const per = argPer();
  if (process.env.AINMOS_TRACE) globalThis.__AINMOS_LOG_CAP = 5000;
  const started = Date.now();
  const byPlayers = {};
  const samples = {};
  const lengths = (process.env.AINMOS_LENGTHS || "daydream,nap,deep").split(",").map((x) => x.trim()).filter(Boolean);
  for (const count of lengths) {
    const rows = [];
    const otherTails = [];
    const errorSamples = [];
    for (let i = 0; i < per; i += 1) {
      const row = playGame(count, i + 1);
      rows.push(row);
      if (!row.won && (row.reason === "other" || row.reason === "step-cap") && otherTails.length < 8) otherTails.push(`[${row.reason} r${row.rounds} ${row.phaseAtEnd} ${row.pendingAtEnd}] ${row.tail}`);
      if (row.error && errorSamples.length < 5) errorSamples.push(row.error);
      if ((i + 1) % 25 === 0 || i + 1 === per) {
        const wins = rows.filter((r) => r.won).length;
        process.stdout.write(`\r${count} ${i + 1}/${per}  wins ${wins}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
      }
    }
    process.stdout.write("\n");
    byPlayers[count] = summarize(rows);
    byPlayers[count].byDreamer = Object.fromEntries(SOLO_DREAMERS.map((d) => {
      const mine = rows.filter((r) => r.dreamer === d.id);
      return [d.id, mine.length ? +(mine.filter((r) => r.won).length / mine.length).toFixed(2) : null];
    }));
    const lost = rows.filter((r) => !r.won);
    byPlayers[count].lossSplit = {
      goalOnly: lost.filter((r) => !r.goalMet && r.finalDown).length,
      bossOnly: lost.filter((r) => r.goalMet && !r.finalDown).length,
      both: lost.filter((r) => !r.goalMet && !r.finalDown).length,
    };
    byPlayers[count].lossReasons = rows.filter((r) => !r.won).reduce((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] || 0) + 1 }), {});
    samples[count] = { otherTails, errorSamples };
  }

  const report = {
    version: "42.0",
    board: BOARD_MODE,
    length: "nap",
    lengthRules: "12 archetype points, 14 regular dreams, bosses at rounds 3/6/9",
    dice: "real d6, success on 5-6, strict more successes, ties to the beast",
    gamesPerTable: per,
    rosters: ROSTERS,
    bot: "Bot 41 Mind-keeper: focuses the row Archetype closest to true and Acquires the moment both quests are true; opens phases with the best stat; fights with a 1-3 card spread aimed at Power+2 and token dice for gaps of 1-2; places Persistent Remember Objects and taps them; walks to Memory tiles when the Waking Mind runway is 3 rounds or less or a hand has 2+ surplus; Remembers with cards above 6 in hand; Returns Psyche first, highest value; discards cheapest cards; in Final Recurrence fights the Archetypes on The Bed.",
    elapsedSec: Number(((Date.now() - started) / 1000).toFixed(1)),
    byPlayers,
    samples,
  };

  const outPath = process.env.AINMOS_SIM_OUT ? resolve(process.env.AINMOS_SIM_OUT) : join(__dirname, "ainmos-bot-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(byPlayers, null, 2));
  console.log(`wrote ${outPath}`);
}
