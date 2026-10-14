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
const { isFreeformBoard, vaultCards, placementSlots } = vaultMod;
// Ainmos always builds a Freeform Board.
const BOARD_MODE = "freeform";

/** Freeform: take a quest tile from the Vault if one is there, and place it next to a Dreamer. */
function placeFromVault(state) {
  if (!pendingPlacementCard(state)) {
    const cards = vaultCards(state);
    if (!cards.length) return false;
    const quests = new Set(activeQuestLandscapeIds(state));
    let index = cards.findIndex((c) => quests.has(c.id));
    if (index < 0) index = 0;
    handleVaultTileSelect(state, index);
  }
  const slots = placementSlots(state);
  if (!slots.length) return false;
  const dreamers = alive(state).map((p) => landscapeById(state, p.landscapeId)).filter(Boolean);
  const score = (slot) => Math.min(...dreamers.map((t) => hexDistance(t, slot)), 99);
  const best = [...slots].sort((a, b) => score(a) - score(b))[0];
  return handleBoardSlotClick(state, best.q, best.r);
}
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
const STEP_CAP = 2200;
const STUCK_LIMIT = 14;

const ROSTERS = {
  2: ["the-visionary", "the-immovable"],
  3: ["the-visionary", "the-hunter", "the-weaver"],
  4: ["the-rested", "the-runner", "the-hunter", "the-weaver"],
};

function loadData() {
  const names = ["dreamers", "archetypes", "landscapes", "dreambeasts", "dreams", "psyche", "mindstream", "event-landscapes", "objects"];
  const data = {};
  for (const name of names) data[name] = JSON.parse(readFileSync(join(DATA_DIR, `${name}.json`), "utf8"));
  const catalog = data["event-landscapes"] || {};
  const mind = { lucidity: [], elasticity: [], willpower: [] };
  for (const suit of ["lucidity", "elasticity", "willpower"]) {
    mind[suit] = (data.mindstream[suit] || []).map((evt) => {
      const extra = catalog[evt.id] || {};
      return {
        ...evt,
        landscapes: extra.landscapes ?? evt.landscapes ?? [],
        effectTop: extra.effectTop ?? evt.effectTop,
        effectBottom: extra.effectBottom ?? evt.effectBottom,
      };
    });
  }
  data.mindstream = mind;
  return data;
}

const DATA = loadData();
const DREAMER_BY_ID = Object.fromEntries(DATA.dreamers.map((d) => [d.id, d]));

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function holder(state) {
  return actionTurnHolder(state) || state.players[state.activePlayerIndex] || alive(state)[0];
}

function beastsOn(tile) {
  if (!tile) return [];
  if (Array.isArray(tile.encounters) && tile.encounters.length) return tile.encounters.filter(Boolean);
  return tile.encounter ? [tile.encounter] : [];
}

function psycheCards(player) {
  return (player?.hand || []).filter((c) => !isDreambeastPsycheCard(c) && c.type !== "psyche-power" && c.type !== "object");
}

function handCount(player) {
  return (player?.hand || []).length;
}

function focus(state, player) {
  if (!player) return;
  const idx = state.players.findIndex((p) => p.id === player.id);
  if (idx >= 0) state.activePlayerIndex = idx;
  if (player.landscapeId) state.selectedLandscapeId = player.landscapeId;
}

function giveTurn(state, player) {
  if (!player) return false;
  if (actionTurnHolder(state)?.id === player.id) {
    focus(state, player);
    return true;
  }
  const ok = passActionTurnTo(state, player.id);
  focus(state, player);
  return ok;
}

function estimateSpread(state, player, cards, encounter, accept) {
  const suit = encounterPaySuit(encounter, accept);
  let total = (state.pendingPowerBonus || 0) + (state.anchorMeetSpreadBonus || 0);
  total += cards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
  total += dreamerMeetBonuses(player.dreamer, encounter).total || 0;
  if (suit && selectedHasPaySuit(cards, suit)) total += totalStat(player, suit, state);
  return total;
}

function combinations(cards, max) {
  const out = [];
  const chosen = [];
  function walk(start) {
    if (chosen.length) out.push(chosen.slice());
    if (chosen.length >= max) return;
    for (let i = start; i < cards.length; i += 1) {
      chosen.push(cards[i]);
      walk(i + 1);
      chosen.pop();
    }
  }
  walk(0);
  return out;
}

function buildSpread(state, player, encounter, accept) {
  const suit = encounterPaySuit(encounter, accept);
  const cards = psycheCards(player);
  const pay = cards.filter((c) => isWildPsyche(c) || c.suit === suit);
  if (!pay.length) return null;
  const target = recommendedEncounterPower(encounter, accept);
  let best = null;
  for (const combo of combinations(cards, 3)) {
    if (!selectedHasPaySuit(combo, suit)) continue;
    const score = estimateSpread(state, player, combo, encounter, accept);
    const waste = combo.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
    if (!best) {
      best = { combo, score, waste };
      continue;
    }
    const bestHits = best.score >= target;
    const hits = score >= target;
    if (hits && !bestHits) best = { combo, score, waste };
    else if (hits === bestHits && hits && (waste < best.waste || (waste === best.waste && combo.length < best.combo.length))) {
      best = { combo, score, waste };
    } else if (!hits && !bestHits && score > best.score) {
      best = { combo, score, waste };
    }
  }
  return best;
}

function addTokenDice(state, player, gap) {
  const spare = Math.max(0, (player.powerTokens || 0) - 1);
  const add = Math.max(0, Math.min(3, gap, spare));
  for (let i = 0; i < add; i += 1) {
    if (!powerBonus(state)) break;
  }
}

function fightBeast(state, player, encounter, { freeMeet = false, fromMindstreamDraw = false } = {}) {
  focus(state, player);
  state.selectedHand = [];
  const room = handCount(player);
  const acceptSpread = buildSpread(state, player, encounter, true);
  const repressSpread = buildSpread(state, player, encounter, false);
  const preferRepress = room >= 8;
  const picked = preferRepress
    ? (repressSpread || acceptSpread)
    : (acceptSpread || repressSpread);
  if (!picked) return false;
  const accept = picked === acceptSpread && !(preferRepress && repressSpread);
  const mode = accept ? "accept" : "reject";
  state.selectedHand = picked.combo.map((c) => c.instanceId);
  const target = recommendedEncounterPower(encounter, accept);
  const gap = target - picked.score;
  if (gap > 0 && gap <= 2) addTokenDice(state, player, gap);
  const before = state.meetActionsUsed || 0;
  meetEncounter(state, mode, { freeMeet, fromMindstreamDraw });
  const fought = freeMeet || (state.meetActionsUsed || 0) > before || state.status !== "playing" || !state.selectedHand.length;
  if (!fought) state.selectedHand = [];
  return fought;
}

function buildFinalSpread(state, arch) {
  const suit = arch.suit;
  const cards = [];
  for (const player of alive(state)) {
    for (const card of psycheCards(player)) {
      if (isWildPsyche(card) || card.suit === suit) cards.push(card);
    }
  }
  if (!cards.length) return null;
  cards.sort((a, b) => (b.value || 0) - (a.value || 0));
  return cards.slice(0, 3);
}

function fightFinal(state, player) {
  const tile = landscapeById(state, player.landscapeId);
  const waiting = undefeatedFinalArchetypes(tile);
  if (!waiting.length) return false;
  const spread = buildFinalSpread(state, waiting[0]);
  if (!spread) return false;
  focus(state, player);
  state.selectedLandscapeId = player.landscapeId;
  state.selectedHand = spread.map((c) => c.instanceId);
  const before = state.meetActionsUsed || 0;
  handleDefeatFinalArchetype(state, waiting[0].id);
  return (state.meetActionsUsed || 0) > before || waiting[0].defeated || state.status !== "playing";
}

function tryAcquire(state) {
  if (state.finalRecurrence) return false;
  const ready = readyArchetype(state);
  if (!ready) return false;
  focusRowArchetype(state, ready.id);
  return !!handleQuestComplete(state, 0);
}

/** Point the bot's quest logic at the row Dream closest to true. */
function focusBestDream(state) {
  if (state.finalRecurrence) return;
  const best = bestRowArchetype(state);
  if (best && state.activeArchetype?.id !== best.id) focusRowArchetype(state, best.id);
}

function subPsyche(state) {
  return (state.subconscious?.psyche || []).length;
}

function nearestMemoryTile(state, player) {
  const here = landscapeById(state, player.landscapeId);
  const tiles = memoryTiles(state);
  return here ? closest(here, tiles) : tiles[0] || null;
}

/** Bot 41: Remember when the mind is low or the hand has surplus. Returns true if it acted. */
function tryRemember(state, who) {
  if (!who || !wantsRemember(state, who)) return false;
  const obj = rememberObjectReady(state, who);
  if (obj) {
    focus(state, who);
    const before = state.meetActionsUsed || 0;
    playObject(state, obj.instanceId);
    if ((state.meetActionsUsed || 0) > before || state.pendingEffectChoice || state.pendingReturn) return true;
  }
  const tile = landscapeById(state, who.landscapeId);
  if (memoryTileOpen(state, tile)) {
    focus(state, who);
    const before = state.meetActionsUsed || 0;
    performLandscapeAction(state, "remember-2");
    if ((state.meetActionsUsed || 0) > before || state.pendingEffectChoice || state.pendingReturn) return true;
  }
  return false;
}

/** Place Persistent Remember Objects from hand into play (free). */
function placeRememberObjects(state) {
  for (const player of alive(state)) {
    const obj = rememberObject(player, "objects");
    if (!obj) continue;
    focus(state, player);
    if (playObject(state, obj.instanceId)) return true;
  }
  return false;
}

function questKey(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function openQuests(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests || state.finalRecurrence) return [];
  return arch.quests
    .map((text, index) => ({ text, index, key: questKey(text) }))
    .filter((quest) => !arch.questProgress?.[quest.index] && !isQuestConditionMet(state, arch.id, quest.text));
}

function tilesNamedInQuest(state, key) {
  const named = (state.board || [])
    .filter((tile) => tile.name && tile.id !== "bed" && tile.id !== "wasteland")
    .sort((a, b) => b.name.length - a.name.length);
  const hits = [];
  let rest = key;
  for (const tile of named) {
    const name = tile.name.toLowerCase();
    if (name && rest.includes(name)) {
      hits.push(tile);
      rest = rest.replace(name, "");
    }
  }
  return hits;
}

function suitFromQuest(key) {
  if (key.includes("lucidity")) return "lucidity";
  if (key.includes("elasticity")) return "elasticity";
  if (key.includes("willpower")) return "willpower";
  return null;
}

function closest(from, tiles) {
  if (!tiles.length) return null;
  const origin = from || tiles[0];
  return [...tiles].sort((a, b) => hexDistance(origin, a) - hexDistance(origin, b))[0];
}

function questDrawHere(state, tile) {
  if (!tile || tile.wasteland || tile.center) return false;
  const drawn = !!state.questTracker?.mindstreamOnLandscape?.[tile.id];
  if (drawn) return false;
  return openQuests(state).some((quest) => {
    if (!quest.key.startsWith("draw mindstream")) return false;
    if (tilesNamedInQuest(state, quest.key).some((named) => named.id === tile.id)) return true;
    const suit = suitFromQuest(quest.key);
    return quest.key.includes("any") && suit && tile.suit === suit && tile.id !== "bed";
  });
}

function trySacrifice(state) {
  const needs = openQuests(state).some((quest) => quest.key.includes("sacrific"));
  if (!needs) return false;
  const row = listSacrificableObjects(state)[0];
  if (!row) return false;
  return !!sacrificeHeldObject(state, row.playerId, row.instanceId)?.ok;
}

function pickRevealTile(state) {
  const legal = revealableTiles(state);
  if (!legal.length) return null;
  const quests = new Set(activeQuestLandscapeIds(state));
  const questTile = legal.find((t) => quests.has(t.id));
  if (questTile) return questTile;
  const dreamers = alive(state).map((p) => landscapeById(state, p.landscapeId)).filter(Boolean);
  const adjacent = legal.find((tile) => dreamers.some((from) => hexDistance(from, tile) === 1));
  return adjacent || legal[0];
}

function pickForgetTile(state) {
  const legal = forgettableTiles(state);
  if (!legal.length) return null;
  const quests = new Set(activeQuestLandscapeIds(state));
  const occupied = new Set(alive(state).map((p) => p.landscapeId));
  const safe = legal.filter((t) => !quests.has(t.id) && !occupied.has(t.id) && t.id !== "bed");
  return safe[0] || legal.find((t) => !quests.has(t.id)) || legal[0];
}

function pickChooseTile(state) {
  const allowed = state.landscapePick?.allowed || [];
  const tiles = allowed.map((id) => landscapeById(state, id)).filter(Boolean);
  if (!tiles.length) return null;
  const quests = new Set(activeQuestLandscapeIds(state));
  const quest = tiles.find((t) => quests.has(t.id) && t.revealed && !t.wasteland);
  if (quest) return quest;
  if (state.acquiredPoints >= state.goalPoints) {
    const bed = tiles.find((t) => t.id === "bed");
    if (bed) return bed;
  }
  return tiles.find((t) => t.revealed && !t.wasteland) || tiles[0];
}

function stepToward(state, player, targetId) {
  const here = landscapeById(state, player.landscapeId);
  const goal = landscapeById(state, targetId);
  if (!here || !goal || here.id === goal.id) return null;
  const options = getLegalMoveTargets(state, player);
  if (!options.length) return null;
  const ranked = [...options].sort((a, b) => {
    const da = hexDistance(a, goal) + (a.wasteland ? 3 : 0);
    const db = hexDistance(b, goal) + (b.wasteland ? 3 : 0);
    return da - db;
  });
  const best = ranked[0];
  if (hexDistance(best, goal) >= hexDistance(here, goal)) return null;
  return best;
}

function destination(state, player) {
  const here = landscapeById(state, player.landscapeId);
  if (!state.finalRecurrence && state.acquiredPoints >= state.goalPoints) return "bed";
  if (!state.finalRecurrence && subPsyche(state) > 0 && !rememberObject(player, "persistent")
    && (mindRunway(state) <= LOW_RUNWAY || handSurplus(player) >= 2)) {
    const mem = nearestMemoryTile(state, player);
    if (mem) return mem.id;
  }
  if (state.finalRecurrence) {
    let best = null;
    for (const tile of state.board) {
      const waiting = undefeatedFinalArchetypes(tile);
      if (!waiting.length || !tile.revealed || tile.wasteland) continue;
      const suit = waiting[0].suit;
      const have = psycheCards(player).filter((c) => isWildPsyche(c) || c.suit === suit).length;
      const score = have * 5 - hexDistance(here || tile, tile);
      if (!best || score > best.score) best = { id: tile.id, score };
    }
    return best?.id || "bed";
  }

  for (const quest of openQuests(state)) {
    const bossId = ["cerberus", "double", "leviathan"].find((id) => quest.key.includes(id));
    if (bossId) {
      const tile = state.board.find((entry) => beastsOn(entry).some((beast) => beast.id === bossId || beast.refId === bossId));
      if (tile) return tile.id;
    }
    const named = tilesNamedInQuest(state, quest.key).filter((tile) => tile.revealed && !tile.wasteland);
    if (named.length) {
      if (named.some((tile) => tile.id === here?.id)) return here.id;
      if (quest.key.startsWith("meet")) {
        const withBeast = named.find((tile) => beastsOn(tile).length);
        if (withBeast) return withBeast.id;
      }
      return closest(here, named).id;
    }
    const suit = suitFromQuest(quest.key);
    if (suit && quest.key.includes("any")) {
      if (quest.key.startsWith("meet")) {
        const hunted = state.board.find((tile) => tile.revealed && !tile.wasteland && beastsOn(tile).some((beast) => beast.suit === suit));
        if (hunted) return hunted.id;
      }
      const suited = state.board.filter((tile) => tile.suit === suit && tile.revealed && !tile.wasteland && !tile.center && tile.id !== "bed");
      if (suited.some((tile) => tile.id === here?.id)) return here.id;
      if (suited.length) return closest(here, suited).id;
    }
    if (quest.key.includes("10 psyche")) return "bed";
  }

  const beastTile = state.board.find((tile) => tile.revealed && !tile.wasteland && beastsOn(tile).length);
  return beastTile?.id || player.landscapeId;
}

function resolveMindstream(state) {
  let choiceId = pickMindstreamChoice(state, "skilled");
  if (!choiceId) {
    state.pendingMindstreamChoice = null;
    return;
  }
  const ok = resolveMindstreamChoice(state, choiceId, helpers);
  if (!ok && state.pendingMindstreamChoice) {
    const fallback = (state.pendingMindstreamChoice.choices || [])
      .map((c) => c.id)
      .find((id) => id === "bad" || id === "flee" || id === "discard" || id === "repress" || id === "take");
    if (fallback && fallback !== choiceId) resolveMindstreamChoice(state, fallback, helpers);
    if (state.pendingMindstreamChoice) state.pendingMindstreamChoice = null;
  }
}

function resolveDreamSpend(state) {
  const pending = state.pendingDreamChoice;
  const cards = [...(pending.cards || [])].sort((a, b) => (a.value || 0) - (b.value || 0));
  const order = pending.order || [];
  const picked = cards.filter((c) => order.includes(c.instanceId));
  const sum = picked.reduce((total, card) => total + (card.value || 0), 0);
  const enough = pending.needCount != null
    ? picked.length >= pending.needCount
    : pending.need
      ? sum >= pending.need
      : picked.length > 0;
  if (!enough) {
    const next = cards.find((c) => !order.includes(c.instanceId));
    if (next) {
      resolveDreamChoice(state, next.instanceId, helpers);
      return;
    }
  }
  resolveDreamChoice(state, "confirm", helpers);
  if (state.pendingDreamChoice === pending) state.pendingDreamChoice = null;
  advanceDreamQueue(state);
}

function resolveObject(state) {
  const pending = state.pendingObjectChoice;
  if (pending.ui === "spend") {
    const cards = pending.cards || [];
    const order = pending.order || [];
    const next = cards.find((c) => !order.includes(c.instanceId));
    if (next && order.length < Math.min(cards.length, pending.maxCount || 3)) {
      resolveObjectChoice(state, next.instanceId, helpers);
      return;
    }
    resolveObjectChoice(state, "confirm", helpers);
    return;
  }
  if (pending.ui === "reorder") {
    const next = (pending.top || []).find((c) => !(pending.order || []).some((picked) => (picked.instanceId || picked.id) === (c.instanceId || c.id)));
    if (next) resolveObjectChoice(state, next.instanceId || next.id, helpers);
    else resolveObjectChoice(state, "done", helpers);
    return;
  }
  const enabled = (pending.choices || []).filter((c) => !c.disabled);
  const id = enabled[0]?.id || (pending.cards || [])[0]?.instanceId || (pending.archetypes || [])[0]?.id;
  if (id) resolveObjectChoice(state, id, helpers);
  else state.pendingObjectChoice = null;
}

function resolveOnePending(state) {
  if (state.pendingMindstreamChoice) {
    resolveMindstream(state);
    return true;
  }
  if (state.pendingDreamReplay) {
    const card = dreamReplayOptions(state)[0];
    if (card) replayChosenDream(state, card, helpers);
    state.pendingDreamReplay = null;
    return true;
  }
  if (state.pendingMindstreamMeet) {
    const pending = state.pendingMindstreamMeet;
    const player = state.players.find((p) => p.id === pending.playerId) || holder(state);
    const tile = landscapeById(state, pending.landscapeId);
    const encounter = beastsOn(tile)[0];
    giveTurn(state, player);
    const fought = encounter && player ? fightBeast(state, player, encounter, { freeMeet: true, fromMindstreamDraw: true }) : false;
    if (!fought) state.pendingMindstreamMeet = null;
    return true;
  }
  if (state.pendingObjectChoice) {
    resolveObject(state);
    return true;
  }
  if (state.pendingObjectFollowup && !state.landscapePick) {
    resumeObjectEffect(state, helpers);
    return true;
  }
  if (state.landscapePick?.mode === "forget") {
    const tile = pickForgetTile(state);
    if (!tile) cancelLandscapePick(state);
    else handleBoardTileClick(state, tile.id);
    return true;
  }
  if (state.landscapePick?.mode === "choose") {
    const tile = pickChooseTile(state);
    if (!tile) cancelLandscapePick(state);
    else handleBoardTileClick(state, tile.id);
    return true;
  }
  if (state.landscapePick?.mode === "reveal" || state.landscapePick?.mode === "reveal-deck-tops") {
    if (state.landscapePick.excessOnly || !revealCapacity(state)) {
      if (!spendExcessPsycheDraw(state)) cancelLandscapePick(state);
      return true;
    }
    const who = holder(state);
    giveTurn(state, who);
    if (isFreeformBoard(state) && (state.landscapePick.flipCard || !revealableTiles(state).length)) {
      if (!placeFromVault(state) && !spendExcessPsycheDraw(state)) cancelLandscapePick(state);
      return true;
    }
    const tile = pickRevealTile(state);
    if (!tile || !handleBoardTileClick(state, tile.id)) {
      if (!spendExcessPsycheDraw(state)) cancelLandscapePick(state);
    }
    return true;
  }
  if (state.pendingDeathChoice) {
    const player = state.players.find((p) => p.id === state.pendingDeathChoice.playerId);
    if ((player?.powerTokens || 0) >= (state.pendingDeathChoice.cost || 1)) avoidDreamerDeath(state);
    else acceptDreamerDeath(state);
    return true;
  }
  if (state.pendingRespawn) {
    const next = (state.availableDreamers || [])[0];
    if (next) respawnDreamer(state, state.pendingRespawn, next.id);
    else state.pendingRespawn = null;
    return true;
  }
  if (state.pendingReturn) {
    const id = pickReturnInstance(state, state.pendingReturn.picked || []);
    if (!id) state.pendingReturn = null;
    else pickReturnCard(state, id);
    return true;
  }
  if (state.pendingRepress) {
    const pending = state.pendingRepress;
    if (pending.confirmEmpty) {
      confirmRepressStep(state);
      return true;
    }
    const player = state.players.find((p) => p.id === pending.playerId) || alive(state)[0];
    const pool = pending.source === "objects" ? (player?.objects || []) : (player?.hand || []);
    const card = pending.source === "objects"
      ? pool.find((c) => !(pending.picked || []).some((p) => p.instanceId === c.instanceId))
      : pickHandLoss(player, pending);
    if (!card) confirmRepressStep(state);
    else pickRepressCard(state, card.instanceId);
    return true;
  }
  if (state.pendingNothingChoice) {
    resolveNothingChoice(state, "token");
    if (state.pendingNothingChoice) state.pendingNothingChoice = null;
    return true;
  }
  if (state.pendingDreamChoice) {
    if (state.pendingDreamChoice.ui === "spend") resolveDreamSpend(state);
    else {
      const choices = (state.pendingDreamChoice.choices || []).filter((c) => !c.disabled);
      resolveDreamChoice(state, choices[0]?.id || "confirm", helpers);
      advanceDreamQueue(state);
    }
    return true;
  }
  if (state.pendingEffectChoice) {
    const remember = pickRememberChoice(state, state.pendingEffectChoice);
    const choices = (state.pendingEffectChoice.choices || []).filter((c) => !c.disabled);
    resolveEffectChoice(state, remember || choices[0]?.id || "confirm", helpers);
    return true;
  }
  if (state.pendingDreamerPower) {
    const pending = state.pendingDreamerPower;
    if (pending.step === "choice" && pending.choices?.length) resolveDreamerPowerChoice(state, pending.choices[0].id);
    else if (pending.step === "deck") resolveDreamerPowerDeckPick(state, pending.deckIds?.[0] || "psyche");
    else if (pending.step === "hand") {
      const card = (pending.cards || [])[0];
      if (card) resolveDreamerPowerHandPick(state, card.instanceId);
      else state.pendingDreamerPower = null;
    } else if (pending.step === "tile" || pending.step === "reveal-landscape") {
      const tile = revealableTiles(state)[0] || state.board.find((t) => t.revealed);
      if (tile) handleDreamerPowerTilePick(state, tile.id);
      else state.pendingDreamerPower = null;
    } else state.pendingDreamerPower = null;
    return true;
  }
  return false;
}

function usefulLandscapeAction(state, player) {
  const tile = landscapeById(state, player.landscapeId);
  if (!tile || tile.wasteland || !tile.revealed) return null;
  const usedMine = new Set(state.usedMeetActionsByPlayer?.[player.id] || []);
  if (questDrawHere(state, tile) && handCount(player) < 10) return "draw-mindstream";
  // 42.0: The Bed no longer draws 3. It Dreams Onward: Reveal or place 1 Landscape.
  if (tile.id === "bed" && revealCapacity(state) > 0 && !usedMine.has("landscape:dream-onward")) {
    return "dream-onward";
  }
  const beasts = state.board.reduce((n, entry) => n + beastsOn(entry).length, 0);
  if (beasts < alive(state).length && tile.suit && !tile.center && tile.id !== "bed" && handCount(player) < 8) {
    return "draw-mindstream";
  }
  return null;
}

function someoneToFight(state) {
  return alive(state).find((player) => {
    const tile = landscapeById(state, player.landscapeId);
    if (beastsOn(tile).length && psycheCards(player).length) return true;
    if (state.finalRecurrence && undefeatedFinalArchetypes(tile).length && buildFinalSpread(state, undefeatedFinalArchetypes(tile)[0])) return true;
    return false;
  }) || null;
}

function act(state) {
  focusBestDream(state);
  if (placeRememberObjects(state)) return true;
  if (trySacrifice(state)) return true;
  const phase = getPhase(state);
  if (phase === "Reveal") {
    if (!state.dreamDrawn) {
      drawDreamCard(state);
      return true;
    }
    if (state.landscapePick) return false;
    if (state.revealLandscapeUsed) return false;
    const open = botSelectOpener(state, "skilled");
    if (!open) return false;
    revealLandscape(state);
    return true;
  }
  if (phase === "Explore") {
    if (!state.exploreActivated) {
      if (!phaseOpeningActive(state)) return false;
      const open = botSelectOpener(state, "skilled");
      if (!open) return false;
      activateExplore(state);
      return true;
    }
    if ((state.exploreMovesLeft || 0) < 1) return false;
    const who = holder(state);
    const dest = destination(state, who);
    const step = who && dest ? stepToward(state, who, dest) : null;
    if (step) {
      focus(state, who);
      moveDreamer(state, step.id);
      return true;
    }
    const other = alive(state).find((player) => player.id !== who?.id && stepToward(state, player, destination(state, player)));
    if (other && giveTurn(state, other)) return true;
    if (spendExcessPsycheDraw(state)) return true;
    return false;
  }
  if (phase === "Meet") {
    if (!(state.meetActionBudget > 0)) {
      if (!phaseOpeningActive(state)) return false;
      const open = botSelectOpener(state, "skilled");
      if (!open) return false;
      gainMeetActions(state);
      return true;
    }
    if ((state.meetActionsUsed || 0) >= state.meetActionBudget) return false;
    const who = holder(state);
    const tile = landscapeById(state, who?.landscapeId);
    const beast = beastsOn(tile)[0];
    if (beast && fightBeast(state, who, beast)) return true;
    if (state.finalRecurrence && fightFinal(state, who)) return true;
    const fighter = someoneToFight(state);
    if (fighter && fighter.id !== who?.id && giveTurn(state, fighter)) return true;
    if (tryRemember(state, who)) return true;
    const rememberer = alive(state).find((p) => p.id !== who?.id
      && canRememberNow(state, p, (id) => landscapeById(state, id)));
    if (rememberer && giveTurn(state, rememberer) && tryRemember(state, rememberer)) return true;
    const actionId = who ? usefulLandscapeAction(state, who) : null;
    if (actionId) {
      focus(state, who);
      const before = state.meetActionsUsed || 0;
      performLandscapeAction(state, actionId);
      if ((state.meetActionsUsed || 0) > before || state.pendingMindstreamChoice || state.landscapePick) return true;
    }
    if (spendExcessPsycheDraw(state)) return true;
    return false;
  }
  return false;
}

function signature(state) {
  const pick = state.landscapePick;
  return [
    state.status,
    getPhase(state),
    state.round,
    state.dreamDrawn ? 1 : 0,
    state.revealLandscapeUsed ? 1 : 0,
    state.exploreActivated ? 1 : 0,
    state.exploreMovesLeft || 0,
    state.meetActionBudget || 0,
    state.meetActionsUsed || 0,
    state.meetPassHolderId || "",
    pick?.mode || "",
    pick?.remaining || 0,
    state.pendingMindstreamChoice?.card?.id || "",
    state.pendingDreamChoice?.title || "",
    state.pendingEffectChoice?.title || "",
    state.pendingObjectChoice?.cardId || "",
    state.pendingDreamerPower?.step || "",
    state.pendingMindstreamMeet?.landscapeId || "",
    alive(state).map((p) => `${p.landscapeId}:${p.hand.length}:${p.powerTokens}`).join(","),
  ].join("|");
}

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

function playGame(playerCount, index) {
  const selectedDreamers = ROSTERS[playerCount].map((id) => DREAMER_BY_ID[id]);
  const state = createInitialState(DATA, {
    lengthKey: "nap",
    seed: `nap-${playerCount}p-${index}`,
    selectedDreamers,
    boardMode: BOARD_MODE,
  });
  let steps = 0;
  let stuck = 0;
  let prev = "";
  let error = null;
  let enteredFinal = false;
  let lastSub = subPsyche(state);
  let psycheReturned = 0;
  let firstAcquireRound = null;
  try {
    while (state.status === "playing" && steps < STEP_CAP) {
      steps += 1;
      const nowSub = subPsyche(state);
      if (nowSub < lastSub) psycheReturned += lastSub - nowSub;
      lastSub = nowSub;
      if (firstAcquireRound == null && (state.acquiredPoints || 0) > 0) firstAcquireRound = state.round;
      if (state.finalRecurrence) enteredFinal = true;
      if (state.log?.length > 80) state.log.splice(0, state.log.length - 40);
      try { runPendingBoardFx(); } catch { /* fx is cosmetic */ }
      tryAcquire(state);
      if (state.status !== "playing") break;
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
  } catch (err) {
    error = err?.message || String(err);
    state.status = "lost";
  }
  const won = state.status === "won";
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
    remember: { ...(state.rememberStats || {}) },
    mindAtEnd: wakingMindCount(state),
    handsAtEnd: alive(state).reduce((n, p) => n + (p.hand || []).length, 0),
    firstAcquireRound,
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
    rememberBySource: rows.reduce((acc, r) => {
      for (const [k, v] of Object.entries(r.remember || {})) acc[k] = +(((acc[k] || 0) + v / rows.length)).toFixed(2);
      return acc;
    }, {}),
    avgMindAtEnd: +mean(rows.map((r) => r.mindAtEnd || 0)).toFixed(1),
    avgHandsAtEnd: +mean(rows.map((r) => r.handsAtEnd || 0)).toFixed(1),
  };
}

function argPer() {
  const idx = process.argv.indexOf("--per");
  if (idx >= 0) return Math.max(1, Number(process.argv[idx + 1]) || 1);
  return 1000;
}

const per = argPer();
const started = Date.now();
const byPlayers = {};
const samples = {};
for (const count of [2, 3, 4]) {
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
      process.stdout.write(`\r${count}p ${i + 1}/${per}  wins ${wins}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  }
  process.stdout.write("\n");
  byPlayers[count] = summarize(rows);
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
