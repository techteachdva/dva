#!/usr/bin/env node
/**
 * Full-game Somnia Monte Carlo — real engine, win/loss, skilled vs sloppy tables.
 * Run: node scripts/somnia-winrate-sim.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_ROOT = join(__dirname, "../src/site/somnia");
const DATA_DIR = join(SOMNIA_ROOT, "data");
const JS_DIR = join(SOMNIA_ROOT, "js");

function stubStyle() {
  return {
    setProperty() {},
    getPropertyValue: () => "",
    removeProperty() {},
  };
}

function stubEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: stubStyle(),
    setAttribute() {},
    appendChild(child) { return child; },
    insertBefore(child) { return child; },
    remove() {},
    parentNode: { removeChild() {} },
    firstChild: null,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    replaceWith() {},
    cloneNode: () => stubEl(),
    textContent: "",
    innerHTML: "",
    disabled: false,
    offsetWidth: 1,
    offsetHeight: 1,
  };
}

const stubDomNodes = new Map();
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  getElementById(id) {
    return stubDomNodes.get(id) || null;
  },
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
  documentElement: { style: stubStyle() },
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.window.matchMedia = () => ({ matches: false, addEventListener() {} });
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
globalThis.window.setTimeout = (fn, ms = 0) => nativeSetTimeout(fn, ms);
globalThis.window.clearTimeout = (id) => nativeClearTimeout(id);
globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
globalThis.Audio = function Audio() {
  this.play = () => Promise.resolve();
  this.pause = () => {};
};

function loadGameDataSync() {
  const data = {};
  for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
    data[file.replace(".json", "")] = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  }
  return data;
}

const dataModule = await import(pathToFileURL(join(JS_DIR, "data.js")).href);
const gameData = loadGameDataSync();
gameData.mindstream = dataModule.enrichMindstreamEvents?.(
  gameData.mindstream,
  gameData["event-landscapes"] || {},
) ?? gameData.mindstream;

const {
  createInitialState,
  getPhase,
  landscapeById,
  avoidDreamerDeath,
  acceptDreamerDeath,
  allEncountersOnBoard,
  checkVictory,
  respawnDreamer,
} = await import(pathToFileURL(join(JS_DIR, "state.js")).href);
const {
  drawDreamCard,
  revealLandscape,
  activateExplore,
  gainMeetActions,
  endPhase,
  drawMindstreamOnLandscape,
  meetEncounter,
  moveDreamer,
  handleQuestComplete,
  handleBoardTileClick,
  handleDefeatFinalArchetype,
  handleSacrificeForFinal,
  performLandscapeAction,
  finishLandscapeMindstreamPick,
  powerBonus,
  togglePhasePowerToken,
  getEffectHelpers,
  playObject,
  useDreamerPower,
  startWeaverSwap,
} = await import(pathToFileURL(join(JS_DIR, "game.js")).href);
const { resolveObjectChoice, resumeObjectEffect } = await import(pathToFileURL(join(JS_DIR, "object-effects.js")).href);
const { playPsychePowerFromHand } = await import(pathToFileURL(join(JS_DIR, "power-tokens.js")).href);
const { handleLandscapeTilePick, revealableTiles, forgettableTiles, cancelLandscapePick } =
  await import(pathToFileURL(join(JS_DIR, "landscapes.js")).href);
const { getLandscapeActionChoices } = await import(pathToFileURL(join(JS_DIR, "landscape-actions.js")).href);
const { getQuestStatus, activeQuestLandscapeIds, isQuestConditionMet, listSacrificableObjects, sacrificeHeldObject } =
  await import(pathToFileURL(join(JS_DIR, "quests.js")).href);
const { getLegalMoveTargets, hexDistance, adjacentTiles } =
  await import(pathToFileURL(join(JS_DIR, "hex.js")).href);
const { isLeviathanCard } = await import(pathToFileURL(join(JS_DIR, "dreambeasts.js")).href);
const { pickReturnCard, pickRepressCard, confirmRepressStep, listSubconsciousCards } =
  await import(pathToFileURL(join(JS_DIR, "subconscious.js")).href);
const { resolveNothingChoice, handLimitForPlayer } = await import(pathToFileURL(join(JS_DIR, "objects.js")).href);
const { resolveDreamChoice, advanceDreamQueue } = await import(
  pathToFileURL(join(JS_DIR, "dream-choices.js")).href,
);
const { resolveEffectChoice } = await import(pathToFileURL(join(JS_DIR, "effect-choices.js")).href);
const {
  cancelDreamerPower,
  resolveDreamerPowerChoice,
  resolveDreamerPowerDeckPick,
  resolveDreamerPowerHandPick,
  handleDreamerPowerTilePick,
} = await import(pathToFileURL(join(JS_DIR, "dreamer-powers.js")).href);
const { psycheHandCount, psycheCardValue, isWildPsyche } = await import(pathToFileURL(join(JS_DIR, "psyche.js")).href);
const { FINAL_RECURRENCE_PSYCHE_REQUIRED } = await import(
  pathToFileURL(join(JS_DIR, "final-recurrence-rules.js")).href,
);
const { countBoardDreambeasts } = await import(pathToFileURL(join(JS_DIR, "phase-skip.js")).href);

const POOL_LEAVE = 5;
const POOL_RETREAT = 3;
const PSYCHE_RESERVE = 8;
const FINAL_PSYCHE = FINAL_RECURRENCE_PSYCHE_REQUIRED || 15;

function deckCanDraw(state, count = 1) {
  return (state.psycheDeck?.length || 0) - count >= PSYCHE_RESERVE;
}

function rng() {
  return Math.random();
}

function chance(p) {
  return rng() < p;
}

function pick(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function setActive(state, index) {
  state.activePlayerIndex = index;
}

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function playerIndex(state, player) {
  return state.players.findIndex((p) => p.id === player.id);
}

function playPowerCards(state) {
  alivePlayers(state).forEach((player) => {
    [...player.hand.filter((c) => c.type === "psyche-power")].forEach((card) => {
      playPsychePowerFromHand(state, player, card);
    });
  });
}

function teamTokens(state) {
  return alivePlayers(state).reduce((sum, p) => sum + (p.powerTokens || 0), 0);
}

function readyQuestCount(state) {
  const arch = state.activeArchetype;
  if (!arch) return 0;
  return getQuestStatus(state, arch).filter((q) => q.ready).length;
}

function unmarkedQuestCount(state) {
  const arch = state.activeArchetype;
  if (!arch?.questProgress) return 0;
  return arch.questProgress.filter((done) => !done).length;
}

function commitReady(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests?.length || state.finalRecurrence) return false;
  if (arch.questProgress?.every(Boolean)) return false;
  return arch.quests.every((quest) => isQuestConditionMet(state, arch.id, quest));
}

function tokensReserved(state, skill) {
  if (skill === "sloppy" || state.finalRecurrence || !state.activeArchetype) return 0;
  return 1;
}

function canSpendToken(state, player, skill) {
  if ((player.powerTokens || 0) < 1) return false;
  return teamTokens(state) > tokensReserved(state, skill);
}

function canSpendTokenOnPhase(state, player, skill) {
  if (skill === "skilled" && commitReady(state)) return false;
  if (!canSpendToken(state, player, skill)) return false;
  return true;
}

const VALUE_INSTANTS = new Set([
  "rabbits-foot", "coins", "tear-of-moon", "spark-of-sun", "egg",
  "knife", "red-apple", "crystal-bell", "the-one",
]);
const MOVE_INSTANTS = new Set(["mirror", "flower", "hammer", "raven-claw", "bag-of-teeth", "psychic-owl"]);
const SPAWN_INSTANTS = new Set(["possibility-polyhedral", "ivory-pawn", "ebony-pawn", "marble-grid"]);

function encounterCount(state) {
  return state.board.reduce((sum, tile) => {
    const list = tile.encounters || (tile.encounter ? [tile.encounter] : []);
    return sum + list.length;
  }, 0);
}

function emptyRevealed(state) {
  return state.board.filter((t) => t.revealed && !t.wasteland);
}

function shouldPlayInstant(state, card, skill) {
  if (skill === "sloppy") return chance(0.25);
  if (VALUE_INSTANTS.has(card.id)) {
    if (card.id === "egg") return deckCanDraw(state, 8) && teamHasHandRoom(state);
    return true;
  }
  if (card.id === "candle") return revealableTiles(state).length > 0;
  if (MOVE_INSTANTS.has(card.id)) {
    return alivePlayers(state).some((p) => p.landscapeId === "bed") || state.finalRecurrence;
  }
  if (card.id === "tooth-saber") return false;
  if (SPAWN_INSTANTS.has(card.id) || card.id === "the-all") {
    return needsMeetQuest(state) || needsBossQuest(state);
  }
  return false;
}

function shouldActivatePersistent(state, player, card, skill) {
  if (skill === "sloppy") return chance(0.15);
  if (card.id === "skeleton-key") return !state.skeletonKeyPending && teamTokens(state) >= 3;
  if (card.id === "monkey-paw") return (player.powerTokens || 0) >= 3;
  if (["row-boat", "hourglass", "conch-shell", "rope"].includes(card.id)) {
    return state.board.some((t) => (t.encounters?.length || t.encounter) && occupantOn(state, t.id));
  }
  return false;
}

function questTilesStillHidden(state) {
  return activeQuestLandscapeIds(state).some((lid) => {
    const tile = landscapeById(state, lid);
    return tile && (!tile.revealed || tile.wasteland);
  });
}

function teamHasHandRoom(state) {
  return alivePlayers(state).some((p) => handLimitForPlayer(state, p) - psycheHandCount(p) > 0);
}

function lowestPsyche(player) {
  return (player.hand || [])
    .filter((c) => c.type === "psyche" || c.type === "psyche-power")
    .sort((a, b) => (a.value || 0) - (b.value || 0))[0] || null;
}

function bestPeekDeck(state) {
  if (needsBossQuest(state) && !bossAlreadySpawned(state) && (state.dreamDeck?.length || 0) > 0) return "dream";
  if (teamAvgHand(state) < 5 && (state.psycheDeck?.length || 0) > 0) return "psyche";
  for (const id of activeQuestLandscapeIds(state)) {
    const suit = landscapeById(state, id)?.suit;
    if (suit && state.mindstreamDecks?.[suit]?.length) return `mindstream-${suit}`;
  }
  if ((state.psycheDeck?.length || 0) > 0) return "psyche";
  return "dream";
}

function shouldBuryPeek(state, pending) {
  const top = state.revealedDeckTops?.[pending.peekDeckKey]?.[0];
  if (!top) return false;
  const key = pending.peekDeckKey;
  if (key === "dream") {
    if (top.id === "final-recurrence" || top.id === "you-never-wake") return (state.acquiredPoints || 0) < (state.goalPoints || 0);
    if (["cerberus", "double", "leviathan"].includes(top.id)) return !needsBossQuest(state) || teamAvgHand(state) < 5;
    return false;
  }
  if (key === "psyche") return (top.value || 0) <= 1 && teamAvgHand(state) >= 4;
  if (key?.startsWith("mindstream-")) {
    if (needsSacrificeQuest(state) && top.type === "object") return false;
    if ((needsMeetQuest(state) || needsBossQuest(state)) && (top.type === "dreambeast" || top.isDreambeast)) return false;
    return top.type === "event";
  }
  return false;
}

function bossAlreadySpawned(state) {
  return allEncountersOnBoard(state).some(({ encounter }) => encounter?.boss);
}

function cheapestPayCard(player, encounter, accept) {
  const suit = accept ? (encounter?.suit || null) : (encounter?.rejectSuit || encounter?.suit || null);
  const hand = player?.hand || [];
  const normals = hand.filter((c) => (
    c.type !== "psyche-power"
    && c.type !== "psyche-dreambeast"
    && !isWildPsyche(c)
    && (!suit || c.suit === suit)
  ));
  const allies = hand.filter((c) => c.type === "psyche-dreambeast" && (!suit || c.suit === suit));
  const wilds = hand.filter((c) => isWildPsyche(c));
  const pool = normals.length ? normals : (allies.length ? allies : wilds);
  if (!pool.length) return null;
  return [...pool].sort((a, b) => (a.value || 0) - (b.value || 0))[0];
}

function canFightBeastTile(player, tile) {
  const list = tile?.encounters || (tile?.encounter ? [tile.encounter] : []);
  if (!list.length) return false;
  return list.some((enc) => {
    if (isLeviathanCard(enc)) return Boolean(cheapestPayCard(player, enc, false));
    return Boolean(cheapestPayCard(player, enc, true) || cheapestPayCard(player, enc, false));
  });
}

function meetQuestNeedsPull(state) {
  if (!needsMeetQuest(state)) return false;
  const ids = new Set(meetQuestLandscapeIds(state));
  return !allEncountersOnBoard(state).some(({ tile }) => ids.has(tile.id));
}

function hunterPullHelpsQuest(state) {
  if (!meetQuestNeedsPull(state)) return false;
  const ids = new Set(meetQuestLandscapeIds(state));
  return allEncountersOnBoard(state).some(({ tile }) => {
    let best = null;
    let bestD = 99;
    alivePlayers(state).forEach((p) => {
      const at = landscapeById(state, p.landscapeId);
      if (!at) return;
      const dist = hexDistance(tile, at);
      if (dist < bestD) {
        bestD = dist;
        best = p;
      }
    });
    return best && ids.has(best.landscapeId);
  });
}

function beastNeedsAFighter(state) {
  return allEncountersOnBoard(state).some(({ tile }) => (
    !alivePlayers(state).some((p) => canFightBeastTile(p, tile))
  ));
}

function dreamerPowerWorthIt(state, player, skill) {
  const id = player.dreamer?.id;
  if (skill === "skilled" && ["the-rested", "the-immovable", "the-weaver"].includes(id)) {
    if (teamTokens(state) <= tokensReserved(state, skill)) return false;
  }
  if (id === "the-visionary") {
    if (state.botVisionaryRound === state.round) return false;
    return questTilesStillHidden(state);
  }
  if (id === "the-rested") {
    if (state.botRestedRound === state.round) return false;
    const fishing = beastNeedsAFighter(state) && (state.psycheDiscard?.length || 0) > 0 && teamHasHandRoom(state);
    if (fishing) return true;
    if (!deckCanDraw(state, alivePlayers(state).length)) return false;
    if ((state.psycheDiscard?.length || 0) > 0 && teamHasHandRoom(state)) return true;
    return teamAvgHand(state) < 3 && deckCanDraw(state, alivePlayers(state).length + 2);
  }
  if (id === "the-runner") {
    if (state.botRunnerRound === state.round) return false;
    if (getPhase(state) !== "Explore" || !state.exploreActivated) return false;
    const goingHome = state.acquiredPoints >= state.goalPoints && !state.finalRecurrence;
    return alivePlayers(state).some((p) => {
      const dest = goingHome ? "bed" : destForPlayer(state, p, skill);
      if (!dest || dest === p.landscapeId) return false;
      const homeOrBeast = goingHome || tileHasEncounter(landscapeById(state, dest));
      if (!homeOrBeast) return false;
      const from = landscapeById(state, p.landscapeId);
      const to = landscapeById(state, dest);
      return from && to && hexDistance(from, to) >= 2;
    });
  }
  if (id === "the-hunter") {
    if (state.botHunterRound === state.round) return false;
    if (meetQuestNeedsPull(state)) return hunterPullHelpsQuest(state);
    const beasts = allEncountersOnBoard(state);
    if (!beasts.length) return false;
    return beasts.some(({ tile }) => {
      const occ = occupantOn(state, tile.id);
      if (occ && canFightBeastTile(occ, tile)) return false;
      const nearest = [...alivePlayers(state)].sort((a, b) => {
        const da = hexDistance(landscapeById(state, a.landscapeId), tile);
        const db = hexDistance(landscapeById(state, b.landscapeId), tile);
        return da - db;
      })[0];
      if (!nearest || !canFightBeastTile(nearest, tile)) return false;
      return hexDistance(landscapeById(state, nearest.landscapeId), tile) === 1;
    });
  }
  if (id === "the-immovable") {
    if (state.anchorMeetSpreadBonus || state.anchorMeetSpreadPending) return false;
    if (getPhase(state) === "Meet") return false;
    return allEncountersOnBoard(state).length > 0
      && (needsMeetQuest(state) || needsBossQuest(state) || state.finalRecurrence);
  }
  if (id === "the-weaver") {
    if (state.botWeaverRound === state.round) return false;
    if (!deckCanDraw(state, 1)) return false;
    if (beastNeedsAFighter(state)) return true;
    return alivePlayers(state).some((p) => {
      const low = lowestPsyche(p);
      return low && (low.value || 0) <= 2;
    });
  }
  return false;
}

function chooseDreamerPowerOption(state, skill, pending, choices) {
  const ids = (choices || []).map((c) => c.id);
  const pickId = (wanted) => ids.find((id) => id === wanted) || ids[0];
  if (skill === "sloppy") return pick(ids) || ids[0];
  if (pending.dreamerId === "the-visionary") {
    if (pending.step === "peek-resolve") return shouldBuryPeek(state, pending) ? pickId("peek-bottom") : pickId("peek-keep");
    return questTilesStillHidden(state) && revealableTiles(state).length
      ? pickId("reveal-landscapes")
      : pickId("peek-decks");
  }
  if (pending.dreamerId === "the-rested") {
    return (state.psycheDiscard?.length || 0) > 0 && teamHasHandRoom(state)
      ? pickId("discard-draw")
      : pickId("refresh-hand");
  }
  if (pending.dreamerId === "the-runner") {
    const camping = !readyToExpedition(state, skill) || state.finalRecurrence || state.acquiredPoints >= state.goalPoints;
    return camping ? pickId("toward-bed") : pickId("away-bed");
  }
  if (pending.dreamerId === "the-hunter") {
    return pickId("toward-dreamers");
  }
  return ids[0];
}

function resolveDreamerPowerPending(state, skill) {
  const pending = state.pendingDreamerPower;
  if (!pending) return false;
  if (pending.step === "reveal-landscape") {
    const tiles = revealableTiles(state);
    const quests = new Set(activeQuestLandscapeIds(state));
    const tile = skill === "skilled"
      ? [...tiles].sort((a, b) => Number(quests.has(b.id)) - Number(quests.has(a.id)))[0]
      : pick(tiles);
    if (!tile) {
      cancelDreamerPower(state);
      return true;
    }
    handleDreamerPowerTilePick(state, tile.id);
    return true;
  }
  const ui = pending.ui;
  if (!ui) {
    cancelDreamerPower(state);
    return true;
  }
  if (ui.type === "deck") {
    resolveDreamerPowerDeckPick(state, bestPeekDeck(state));
    return true;
  }
  if (ui.type === "hand") {
    const cards = ui.cards || [];
    const card = skill === "skilled"
      ? [...cards].sort((a, b) => (a.value || 0) - (b.value || 0))[0]
      : cards[0];
    if (card) resolveDreamerPowerHandPick(state, card.instanceId || card.id);
    else cancelDreamerPower(state);
    return true;
  }
  if (ui.type === "choice") {
    const choiceId = chooseDreamerPowerOption(state, skill, pending, ui.choices);
    if (choiceId) resolveDreamerPowerChoice(state, choiceId);
    else cancelDreamerPower(state);
    return true;
  }
  cancelDreamerPower(state);
  return true;
}

function tryDreamerPowers(state, skill) {
  if (state.pendingDreamerPower) return false;
  if (skill === "sloppy" && !chance(0.25)) return false;
  let acted = false;
  for (const player of alivePlayers(state)) {
    if (state.pendingDreamerPower) break;
    if (!canSpendToken(state, player, skill)) continue;
    if (!dreamerPowerWorthIt(state, player, skill)) continue;
    setActive(state, playerIndex(state, player));
    const started = useDreamerPower(state);
    if (!started && !state.pendingDreamerPower) continue;
    const dreamerId = player.dreamer?.id;
    if (dreamerId === "the-visionary") state.botVisionaryRound = state.round;
    if (dreamerId === "the-rested") state.botRestedRound = state.round;
    if (dreamerId === "the-runner") state.botRunnerRound = state.round;
    if (dreamerId === "the-hunter") state.botHunterRound = state.round;
    if (dreamerId === "the-weaver") state.botWeaverRound = state.round;
    state.botPowerUses = state.botPowerUses || {};
    state.botPowerUses[dreamerId] = (state.botPowerUses[dreamerId] || 0) + 1;
    resolvePendings(state, skill);
    acted = true;
  }
  return acted;
}

function tryPlayObjects(state, skill) {
  if (skill === "sloppy" && !chance(0.35)) return false;
  let acted = false;
  for (const player of alivePlayers(state)) {
    setActive(state, playerIndex(state, player));
    for (const card of [...(player.objects || [])]) {
      if (card.subtype === "persistent") {
        playObject(state, card.instanceId);
        resolvePendings(state, skill);
        acted = true;
      }
    }
    for (const card of [...(player.objects || [])]) {
      if (card.subtype !== "instant") continue;
      if (!shouldPlayInstant(state, card, skill)) continue;
      playObject(state, card.instanceId);
      resolvePendings(state, skill);
      acted = true;
    }
    for (const card of [...(player.persistent || [])]) {
      if (!canSpendToken(state, player, skill)) break;
      if (!shouldActivatePersistent(state, player, card, skill)) continue;
      playObject(state, card.instanceId, { usePower: true });
      resolvePendings(state, skill);
      acted = true;
    }
  }
  return acted;
}

function useTools(state, skill) {
  playPowerCards(state);
  tryMarkQuests(state, skill);
  tryPlayObjects(state, skill);
  trySacrificeObject(state, skill);
  tryDreamerPowers(state, skill);
  tryWeaverSwap(state, skill);
  tryMarkQuests(state, skill);
}

function trySacrificeObject(state, skill) {
  if (skill === "sloppy" && !chance(0.4)) return false;
  if (!needsSacrificeQuest(state)) return false;
  const rows = listSacrificableObjects(state);
  if (!rows.length) return false;
  const ranked = [...rows].sort((a, b) => Number(a.persistent) - Number(b.persistent));
  const chosen = ranked[0];
  const result = sacrificeHeldObject(state, chosen.playerId, chosen.instanceId);
  if (!result?.ok) return false;
  state.botSacrifices = (state.botSacrifices || 0) + 1;
  return true;
}

function tryWeaverSwap(state, skill) {
  if (skill === "sloppy" && !chance(0.2)) return false;
  if (state.weaverSwapUsed || getPhase(state) !== "Meet") return false;
  const weaver = alivePlayers(state).find((p) => p.dreamer?.id === "the-weaver");
  if (!weaver) return false;
  const mine = lowestPsyche(weaver);
  if (!mine || (skill === "skilled" && (mine.value || 0) > 2)) return false;
  setActive(state, playerIndex(state, weaver));
  state.selectedHand = [mine.instanceId];
  if (!startWeaverSwap(state)) return false;
  state.botPassiveUses = state.botPassiveUses || {};
  state.botPassiveUses.weaverSwap = (state.botPassiveUses.weaverSwap || 0) + 1;
  resolvePendings(state, skill);
  return true;
}

/** After point goal, every living Dreamer must stand on The Bed to win. */
function rallyOnBedIfGoalMet(state, skill) {
  if (state.finalRecurrence || state.acquiredPoints < state.goalPoints) return false;
  let moved = false;
  for (const player of alivePlayers(state)) {
    if (player.landscapeId === "bed") continue;
    setActive(state, playerIndex(state, player));
    const step = nextStepToward(state, player, "bed", skill);
    if (!step || step === player.landscapeId) continue;
    moveDreamer(state, step);
    resolvePendings(state, skill);
    moved = true;
    break;
  }
  checkVictory(state);
  return moved;
}

function paySuits(state) {
  const suits = new Set();
  meetQuestLandscapeIds(state).forEach((id) => {
    const tile = landscapeById(state, id);
    if (tile?.suit) suits.add(tile.suit);
  });
  return suits;
}

function selectBestSuit(state, playerIndex, suit, max = 1, minValue = 1) {
  const player = state.players[playerIndex];
  setActive(state, playerIndex);
  const cards = player.hand
    .filter((c) => c.type !== "psyche-power" && (c.suit === suit || isWildPsyche(c) || c.suit === "wild"));
  const normals = cards.filter((c) => !isWildPsyche(c));
  const wilds = cards.filter((c) => isWildPsyche(c));
  const enough = normals.filter((c) => (c.value || 0) >= minValue);
  let ordered = enough.length
    ? [...enough].sort((a, b) => (a.value || 0) - (b.value || 0))
    : (normals.length
      ? [...normals].sort((a, b) => (b.value || 0) - (a.value || 0))
      : wilds);
  if (paySuits(state).has(suit)) {
    const ofSuit = ordered.filter((card) => card.suit === suit && !isWildPsyche(card));
    if (ofSuit.length <= 1) {
      ordered = ordered.filter((card) => card.suit !== suit);
    }
  }
  state.selectedHand = ordered.slice(0, max).map((c) => c.instanceId);
  return state.selectedHand.length;
}

function phaseMinCardValue(state, skill, suit, player) {
  if (skill !== "skilled") return 1;
  const stat = Number(player?.dreamer?.[suit] || 0);
  if (suit === "elasticity") {
    const dests = assignDestinations(state, skill);
    let dist = 1;
    alivePlayers(state).forEach((p) => {
      const from = landscapeById(state, p.landscapeId);
      const to = landscapeById(state, dests[p.id]);
      if (from && to) dist = Math.max(dist, hexDistance(from, to));
    });
    return Math.max(1, Math.min(5, dist - stat));
  }
  if (suit === "willpower") {
    const onBeast = alivePlayers(state).some((p) => tileHasEncounter(landscapeById(state, p.landscapeId)));
    const fishing = needsMeetQuest(state) && standingOnQuestWork(state) && !onBeast ? 5 : 0;
    const fights = allEncountersOnBoard(state).filter(({ tile }) => occupantOn(state, tile.id)).length;
    const intoFight = onBeast ? 2 : 0;
    const draw = standingOnQuestWork(state) ? 1 : 0;
    return Math.max(1, Math.min(5, Math.max(fishing, intoFight, fights + draw) - stat));
  }
  if (suit === "lucidity") {
    const hidden = activeQuestLandscapeIds(state).filter((id) => {
      const tile = landscapeById(state, id);
      return !tile?.revealed || tile.wasteland;
    }).length;
    return Math.max(1, Math.min(3, Math.ceil(hidden / 2) - stat));
  }
  return 1;
}

function openPhaseWithCardsOrToken(state, skill, suit) {
  playPowerCards(state);
  tryMarkQuests(state, skill);
  const maxCards = 1;
  let pi = bestContributor(state, suit, 1);
  const minValue = phaseMinCardValue(state, skill, suit, state.players[pi]);
  pi = bestContributor(state, suit, minValue);
  let n = selectBestSuit(state, pi, suit, maxCards, minValue);
  if (n < 1) {
    const withTok = alivePlayers(state).find((p) => (p.powerTokens || 0) > 0);
    if (withTok) {
      pi = playerIndex(state, withTok);
      n = selectBestSuit(state, pi, suit, maxCards);
    }
  }
  const player = state.players[pi];
  const goalSprint = skill === "skilled"
    && suit === "elasticity"
    && !state.finalRecurrence
    && state.acquiredPoints >= state.goalPoints
    && alivePlayers(state).some((p) => p.landscapeId !== "bed")
    && (player?.powerTokens || 0) > 0;
  if (player && n < 1 && (canSpendTokenOnPhase(state, player, skill) || goalSprint)) {
    setActive(state, pi);
    togglePhasePowerToken(state);
  }
  return n >= 1 || !!state.phaseTokenAsPsyche;
}

function bestContributor(state, suit, minValue = 1) {
  let best = 0;
  let bestVal = -1;
  state.players.forEach((p, i) => {
    if (!p.alive) return;
    const normals = p.hand.filter((c) => c.type !== "psyche-power" && c.suit === suit && !isWildPsyche(c));
    const wilds = p.hand.filter((c) => isWildPsyche(c));
    const cards = normals.length ? normals : wilds;
    if (!cards.length) return;
    const hasEnough = normals.some((c) => (c.value || 0) >= minValue);
    const handBias = (p.hand?.length || 0) >= 3 ? 15 : ((p.hand?.length || 0) <= 1 ? -30 : 0);
    const val = (p.dreamer?.[suit] || 0) + (normals.length ? 20 : 0) + (hasEnough ? 40 : 0) + handBias + cards.reduce((s, c) => s + (c.value || 0), 0);
    if (val > bestVal) {
      bestVal = val;
      best = i;
    }
  });
  return best;
}

function resolveObjectPending(state, skill) {
  const pending = state.pendingObjectChoice;
  if (!pending) return false;
  const helpers = getEffectHelpers();
  if (pending.ui === "spend") {
    let total = 0;
    for (const card of pending.cards || []) {
      if (total >= (pending.need || 0)) break;
      resolveObjectChoice(state, card.instanceId, helpers);
      total += psycheCardValue(card);
    }
    resolveObjectChoice(state, "confirm", helpers);
    return true;
  }
  if (pending.ui === "reorder") {
    for (const card of pending.top || []) {
      resolveObjectChoice(state, card.instanceId || card.id, helpers);
    }
    return true;
  }
  if (pending.ui === "cards") {
    const cards = pending.cards || [];
    const cheapest = pending.step === "repress-psyche" || pending.step === "discard-psyche";
    const card = skill === "skilled" && cheapest
      ? [...cards].sort((a, b) => (a.value || 0) - (b.value || 0))[0]
      : cards[0];
    if (card) resolveObjectChoice(state, card.instanceId || card.id, helpers);
    else state.pendingObjectChoice = null;
    return true;
  }
  const enabled = (pending.choices || []).filter((choice) => !choice.disabled);
  if (!enabled.length) {
    state.pendingObjectChoice = null;
    return true;
  }
  if (skill === "sloppy") {
    resolveObjectChoice(state, pick(enabled).id, helpers);
    return true;
  }
  const quests = new Set(activeQuestLandscapeIds(state));
  const preferred = enabled.find((choice) => quests.has(choice.id))
    || enabled.find((choice) => /return|reveal|psyche/i.test(`${choice.id} ${choice.label}`))
    || enabled[0];
  resolveObjectChoice(state, preferred.id, helpers);
  return true;
}

function resolvePendings(state, skill) {
  let guard = 80;
  while (guard-- > 0) {
    if (state.pendingObjectChoice) {
      resolveObjectPending(state, skill);
      continue;
    }
    if (state.pendingObjectFollowup && !state.landscapePick) {
      resumeObjectEffect(state, getEffectHelpers());
      continue;
    }
    if (state.landscapePick?.mode === "reveal") {
      const tiles = revealableTiles(state);
      const tile = skill === "skilled" ? pickRevealTile(state, tiles) : pick(tiles);
      if (!tile) {
        cancelLandscapePick(state);
        break;
      }
      handleLandscapeTilePick(state, tile.id);
      continue;
    }
    if (state.landscapePick?.mode === "forget") {
      const tiles = forgettableTiles(state);
      const quests = new Set(activeQuestLandscapeIds(state));
      const occupied = new Set(alivePlayers(state).map((p) => p.landscapeId));
      const ranked = [...tiles].sort((a, b) => {
        const score = (t) => {
          let s = 0;
          if (quests.has(t.id)) s -= 20;
          if (occupied.has(t.id)) s -= 12;
          if (tileHasEncounter(t)) s -= 6;
          if (t.finalArchetype && !t.finalArchetype.defeated) s -= 30;
          return s;
        };
        return score(b) - score(a);
      });
      const tile = skill === "skilled" ? ranked[0] : pick(tiles);
      if (!tile) {
        cancelLandscapePick(state);
        break;
      }
      handleLandscapeTilePick(state, tile.id);
      continue;
    }
    if (state.landscapePick?.mode === "choose") {
      const allowed = state.landscapePick.allowed || [];
      const quests = new Set(activeQuestLandscapeIds(state));
      const id = skill === "skilled"
        ? (allowed.find((tid) => quests.has(tid)) || allowed[0])
        : pick(allowed);
      if (!id) {
        cancelLandscapePick(state);
        break;
      }
      handleBoardTileClick(state, id);
      continue;
    }
    if (state.pendingDeathChoice) {
      const player = state.players.find((p) => p.id === state.pendingDeathChoice.playerId);
      const cost = state.pendingDeathChoice.cost || 1;
      const canPay = (player?.powerTokens || 0) >= cost;
      const keepsQuestToken = teamTokens(state) - cost >= unmarkedQuestCount(state);
      if (skill === "skilled" && canPay && keepsQuestToken) avoidDreamerDeath(state);
      else if (skill === "sloppy" && canPay && chance(0.45)) avoidDreamerDeath(state);
      else acceptDreamerDeath(state);
      continue;
    }
    if (state.pendingRespawn) {
      const next = (state.availableDreamers || [])[0];
      if (next) respawnDreamer(state, state.pendingRespawn, next.id);
      else state.pendingRespawn = null;
      continue;
    }
    if (state.pendingReturn) {
      const cards = listSubconsciousCards(state);
      const card = cards.find((c) => !state.pendingReturn.picked.some((p) => p.instanceId === c.instanceId));
      if (!card) {
        state.pendingReturn = null;
        break;
      }
      pickReturnCard(state, card.instanceId);
      continue;
    }
    if (state.pendingRepress) {
      const pending = state.pendingRepress;
      if (pending.confirmEmpty) {
        confirmRepressStep(state);
        continue;
      }
      const player = pending.collective
        ? alivePlayers(state).find((p) => p.hand.length)
        : state.players.find((p) => p.id === pending.playerId);
      const pool = pending.source === "objects" ? (player?.objects || []) : (player?.hand || []);
      const sorted = skill === "skilled"
        ? [...pool].sort((a, b) => discardPriority(state, player, a) - discardPriority(state, player, b))
        : pool;
      const card = sorted.find((c) => !pending.picked.some((p) => p.instanceId === c.instanceId));
      if (!card) {
        confirmRepressStep(state);
        continue;
      }
      pickRepressCard(state, card.instanceId);
      continue;
    }
    if (state.pendingNothingChoice) {
      resolveNothingChoice(state, skill === "skilled" ? "token" : (chance(0.5) ? "token" : "repress"));
      continue;
    }
    if (state.pendingDreamChoice) {
      resolveModalChoice(state, skill, state.pendingDreamChoice, resolveDreamChoice);
      advanceDreamQueue?.(state);
      continue;
    }
    if (state.pendingEffectChoice) {
      resolveModalChoice(state, skill, state.pendingEffectChoice, resolveEffectChoice);
      continue;
    }
    if (state.pendingDreamerPower) {
      resolveDreamerPowerPending(state, skill);
      continue;
    }
    break;
  }
}

function resolveModalChoice(state, skill, pending, resolver) {
  const helpers = getEffectHelpers();
  try {
    if (pending.ui === "spend") {
      const cards = pending.cards || [];
      const need = pending.needCount || (pending.need ? cards.length : 1);
      const sorted = skill === "skilled"
        ? [...cards].sort((a, b) => (a.value || 0) - (b.value || 0))
        : cards;
      for (const card of sorted.slice(0, Math.max(1, need))) {
        resolver(state, card.instanceId || card.id, helpers);
      }
      resolver(state, "confirm", helpers);
      return;
    }
    if (pending.ui === "cards") {
      const card = (pending.cards || [])[0];
      if (card) resolver(state, card.instanceId || card.id, helpers);
      else if (pending === state.pendingDreamChoice) state.pendingDreamChoice = null;
      else state.pendingEffectChoice = null;
      return;
    }
    const choices = (pending.choices || []).filter((c) => !c.disabled);
    if (!choices.length) {
      if (pending === state.pendingDreamChoice) state.pendingDreamChoice = null;
      else state.pendingEffectChoice = null;
      return;
    }
    const preferred = skill === "skilled"
      ? choices.find((c) => {
        const tileId = String(c.id).split(":")[0];
        return meetQuestLandscapeIds(state).includes(tileId)
          || adjacentTiles(state, tileId).some((t) => meetQuestLandscapeIds(state).includes(t.id));
      })
      || choices.find((c) => /leviathan|sea-of-teeth|accept|stay|reveal|return|draw/i.test(`${c.id} ${c.label}`))
      : null;
    if (skill === "skilled" && pending.cardId === "hunter-shove") {
      const tile = landscapeById(state, pending.payload?.tileId);
      const onQuest = tile && meetQuestLandscapeIds(state).includes(tile.id);
      const bossHere = (tile?.encounters || []).some((e) => e.boss) || tile?.encounter?.boss;
      const fightingHere = bossHere && needsBossQuest(state) && occupantOn(state, tile.id);
      resolver(state, (onQuest || fightingHere) ? "leave" : "shove", helpers);
      if (!(onQuest || fightingHere)) {
        state.botPassiveUses = state.botPassiveUses || {};
        state.botPassiveUses.hunterShove = (state.botPassiveUses.hunterShove || 0) + 1;
      }
      return;
    }
    if (skill === "skilled" && pending.cardId === "weaver-swap") {
      const payload = pending.payload || {};
      if (payload.step === "neighbor") {
        const neighbor = [...choices].sort((a, b) => {
          const pa = state.players.find((p) => p.id === a.id);
          const pb = state.players.find((p) => p.id === b.id);
          const best = (p) => Math.max(0, ...(p?.hand || []).map((c) => c.value || 0));
          return best(pb) - best(pa);
        })[0];
        resolver(state, (neighbor || choices[0]).id, helpers);
        return;
      }
      const ranked = [...choices].sort((a, b) => {
        const valueOf = (choice) => {
          const owner = state.players.find((p) => (p.hand || []).some((c) => c.instanceId === choice.id));
          const card = owner?.hand?.find((c) => c.instanceId === choice.id);
          return card?.value || 0;
        };
        return valueOf(b) - valueOf(a);
      });
      resolver(state, (ranked[0] || choices[0]).id, helpers);
      return;
    }
    resolver(state, (preferred || pick(choices) || choices[0]).id, helpers);
  } catch (err) {
    if (pending === state.pendingDreamChoice) state.pendingDreamChoice = null;
    else state.pendingEffectChoice = null;
    if (!globalThis.__somniaChoiceErr) {
      globalThis.__somniaChoiceErr = true;
      console.error("CHOICE RESOLVE:", err?.stack || err);
    }
  }
}

function discardPriority(state, player, card) {
  if (!player || !card) return card?.value || 0;
  const here = landscapeById(state, player.landscapeId);
  const nearby = allEncountersOnBoard(state).filter(({ tile }) => (
    tile && here && (tile.id === here.id || hexDistance(here, tile) === 1)
  ));
  const keepsTheFight = nearby.some(({ encounter }) => {
    const accept = isLeviathanCard(encounter) ? null : cheapestPayCard(player, encounter, true);
    const reject = cheapestPayCard(player, encounter, false);
    return accept?.instanceId === card.instanceId || reject?.instanceId === card.instanceId;
  });
  return (keepsTheFight ? 100 : 0) + (card.value || 0);
}

function survivesBeastTile(state, player, tileId) {
  const tax = meetTaxAt(state, player, tileId);
  const hand = psycheHandCount(player);
  if (hand <= tax) return false;
  const cap = (state.players?.length || 0) === 1 ? 8 : 5;
  const left = cap - (player.deathCount || 0);
  if (left <= 1 && hand <= tax + 2) return false;
  return true;
}

function meetTaxAt(state, player, tileId) {
  const here = landscapeById(state, tileId);
  if (!here) return 0;
  let count = allEncountersOnBoard(state).filter(({ tile }) => (
    tile && (tile.id === here.id || hexDistance(here, tile) === 1)
  )).length;
  if ((state.players?.length || 0) === 1 && count > 0) count -= 1;
  if (count > 0 && player?.dreamer?.id === "the-immovable") count -= 1;
  return Math.max(0, count);
}

function nextStepToward(state, player, destId, skill = "skilled") {
  const dest = landscapeById(state, destId);
  const start = landscapeById(state, player.landscapeId);
  const safeEnough = (t) => {
    if (!t) return false;
    if (t.wasteland && t.id !== destId) return false;
    if (skill === "skilled" && psycheHandCount(player) <= meetTaxAt(state, player, t.id) + 1) {
      const hunting = dest && tileHasEncounter(dest);
      const closer = hunting && start && hexDistance(t, dest) < hexDistance(start, dest);
      const survives = psycheHandCount(player) > meetTaxAt(state, player, t.id);
      if (!(hunting && closer && survives)) return false;
    }
    return true;
  };
  const legal = getLegalMoveTargets(state, player).filter(safeEnough);
  if (!legal.length) return null;
  if (legal.some((t) => t.id === destId)) return destId;

  if (!start || !dest) {
    return pick(legal)?.id || null;
  }

  const queue = [start.id];
  const prev = new Map([[start.id, null]]);
  while (queue.length) {
    const id = queue.shift();
    for (const n of adjacentTiles(state, id).filter((t) => t.revealed && safeEnough(t))) {
      if (prev.has(n.id)) continue;
      prev.set(n.id, id);
      if (n.id === destId) {
        let cur = n.id;
        let parent = prev.get(cur);
        while (parent && parent !== start.id) {
          cur = parent;
          parent = prev.get(cur);
        }
        return cur;
      }
      queue.push(n.id);
    }
  }

  return [...legal].sort((a, b) => hexDistance(a, dest) - hexDistance(b, dest))[0]?.id || null;
}

function teamAvgHand(state) {
  const alive = alivePlayers(state);
  if (!alive.length) return 0;
  return alive.reduce((s, p) => s + psycheHandCount(p), 0) / alive.length;
}

function questTilesRevealed(state) {
  return activeQuestLandscapeIds(state).filter((id) => {
    const tile = landscapeById(state, id);
    return tile?.revealed && !tile.wasteland;
  });
}

function needsTenPsycheQuest(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return false;
  return arch.quests.some((q, i) => {
    if (arch.questProgress?.[i]) return false;
    return /10 psyche/i.test(q) && !isQuestConditionMet(state, arch.id, q);
  });
}

function needsBossQuest(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return false;
  return arch.quests.some((q, i) => {
    if (arch.questProgress?.[i]) return false;
    return /(?:meet|defeat) (cerberus|double|leviathan)/i.test(q) && !isQuestConditionMet(state, arch.id, q);
  });
}

function needsSacrificeQuest(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return false;
  return arch.quests.some((q, i) => {
    if (arch.questProgress?.[i]) return false;
    return /sacrific/i.test(q) && !isQuestConditionMet(state, arch.id, q);
  });
}

function needsMeetQuest(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return false;
  return arch.quests.some((q, i) => {
    if (arch.questProgress?.[i]) return false;
    if (!/meet/i.test(q)) return false;
    return !isQuestConditionMet(state, arch.id, q);
  });
}

function needsDrawQuest(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return false;
  return arch.quests.some((q, i) => {
    if (arch.questProgress?.[i]) return false;
    if (!/draw mindstream/i.test(q)) return false;
    return !isQuestConditionMet(state, arch.id, q);
  });
}

function touchesRevealed(state, tile) {
  return adjacentTiles(state, tile.id).some((n) => n.revealed && !n.wasteland);
}

function pickRevealTile(state, tiles) {
  if (!tiles?.length) return null;
  if (state.acquiredPoints >= state.goalPoints && !state.finalRecurrence) {
    const bed = landscapeById(state, "bed");
    const home = tiles
      .filter((t) => t.wasteland && bed && hexDistance(t, bed) <= 2)
      .sort((a, b) => hexDistance(a, bed) - hexDistance(b, bed));
    if (home.length) return home[0];
  }
  const targets = [];
  activeQuestLandscapeIds(state).forEach((id) => {
    const tile = landscapeById(state, id);
    if (tile && (!tile.revealed || tile.wasteland)) targets.push(tile);
  });
  if (needsMeetQuest(state) && meetQuestNeedsPull(state) && questTilesRevealed(state).length) {
    const lava = landscapeById(state, "lava");
    if (lava && (!lava.revealed || lava.wasteland)) targets.push(lava);
  }
  if (teamTokens(state) < unmarkedQuestCount(state)) {
    ["awards", "candy-mountain"].forEach((id) => {
      const tile = landscapeById(state, id);
      if (tile && (!tile.revealed || tile.wasteland)) targets.push(tile);
    });
  }
  const target = targets[0];
  if (!target) return tiles[0];
  const ready = tiles.find((t) => t.id === target.id && touchesRevealed(state, t));
  if (ready) return ready;
  const frontier = tiles.filter((t) => touchesRevealed(state, t));
  if (frontier.length) {
    frontier.sort((a, b) => hexDistance(a, target) - hexDistance(b, target));
    return frontier[0];
  }
  return tiles.find((t) => t.id === target.id) || tiles[0];
}

function meetQuestLandscapeIds(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return [];
  const ids = new Set();
  arch.quests.forEach((q, i) => {
    if (arch.questProgress?.[i]) return;
    if (!/meet/i.test(q)) return;
    if (isQuestConditionMet(state, arch.id, q)) return;
    activeQuestLandscapeIds(state).forEach((id) => ids.add(id));
  });
  return [...ids];
}

function tileHasEncounter(tile) {
  return Boolean(tile?.encounters?.length || tile?.encounter);
}

function rankDestinations(state, player, ids, skill) {
  const meetQuests = new Set(meetQuestLandscapeIds(state));
  const mindQuests = new Set(activeQuestLandscapeIds(state));
  const from = landscapeById(state, player.landscapeId);
  return [...ids].sort((a, b) => {
    const ta = landscapeById(state, a);
    const tb = landscapeById(state, b);
    let scoreA = 0;
    let scoreB = 0;
    if (meetQuests.has(a)) scoreA += needsMeetQuest(state) ? 12 : 4;
    if (meetQuests.has(b)) scoreB += needsMeetQuest(state) ? 12 : 4;
    if (mindQuests.has(a)) scoreA += 6;
    if (mindQuests.has(b)) scoreB += 6;
    if (needsMeetQuest(state) && tileHasEncounter(ta)) scoreA += 8;
    if (needsMeetQuest(state) && tileHasEncounter(tb)) scoreB += 8;
    if (needsBossQuest(state) && ta?.encounters?.some((e) => e.boss)) scoreA += 15;
    if (needsBossQuest(state) && tb?.encounters?.some((e) => e.boss)) scoreB += 15;
    if (from && ta && tb) {
      scoreA -= hexDistance(from, ta);
      scoreB -= hexDistance(from, tb);
    }
    if (skill === "skilled") {
      const ua = adjacentTiles(state, a).filter((n) => !n.revealed || n.wasteland).length;
      const ub = adjacentTiles(state, b).filter((n) => !n.revealed || n.wasteland).length;
      scoreA += ua;
      scoreB += ub;
    }
    return scoreB - scoreA;
  });
}

/** Camp until hands can survive a Meet tax, then leave for a revealed quest. */
function readyToExpedition(state, skill) {
  if (state.finalRecurrence) return true;
  if (state.acquiredPoints >= state.goalPoints) return true;
  const n = alivePlayers(state).length;
  const avg = teamAvgHand(state);
  const revealed = questTilesRevealed(state);
  if (needsTenPsycheQuest(state)) {
    return alivePlayers(state).some((p) => psycheHandCount(p) >= 10);
  }
  if (skill === "sloppy") return avg >= 4 || state.round >= 2;
  if (allEncountersOnBoard(state).length) return true;
  if (alivePlayers(state).some((p) => psycheHandCount(p) < 2)) return false;
  if (revealed.length) return avg >= 3 || (n === 1 && state.round >= 2);
  return avg >= 4 || state.round >= 3;
}

function psycheDrawTileId(state, player) {
  const from = landscapeById(state, player.landscapeId);
  const tiles = ["bed", "city", "candy-mountain"]
    .map((id) => landscapeById(state, id))
    .filter((t) => t?.revealed && !t.wasteland);
  if (!tiles.length) return "bed";
  tiles.sort((a, b) => {
    const tax = meetTaxAt(state, player, a.id) - meetTaxAt(state, player, b.id);
    if (tax) return tax;
    return hexDistance(from, a) - hexDistance(from, b);
  });
  return tiles[0].id;
}

function safeCampId(state, player) {
  const here = landscapeById(state, player.landscapeId);
  const calm = state.board.filter((t) => (
    t.revealed && !t.wasteland && meetTaxAt(state, player, t.id) === 0
  ));
  if (!calm.length) return "bed";
  calm.sort((a, b) => {
    const bias = (t) => (t.id === "bed" ? 4 : 0) + (t.id === "city" ? 2 : 0) + (t.id === player.landscapeId ? 1 : 0);
    const gap = bias(b) - bias(a);
    if (gap) return gap;
    return hexDistance(here, a) - hexDistance(here, b);
  });
  return calm[0].id;
}

function powerHexId(state) {
  const tile = ["awards", "candy-mountain"]
    .map((id) => landscapeById(state, id))
    .find((t) => t?.revealed && !t.wasteland);
  return tile?.id || null;
}

function assignDestinations(state, skill) {
  const alive = alivePlayers(state);
  const dests = {};
  if (!alive.length) return dests;

  if (skill === "sloppy") {
    alive.forEach((p) => { dests[p.id] = destForPlayer(state, p, skill); });
    return dests;
  }

  if (state.acquiredPoints >= state.goalPoints && !state.finalRecurrence) {
    alive.forEach((p) => { dests[p.id] = "bed"; });
    return dests;
  }

  if (state.finalRecurrence) {
    const tiles = state.board
      .filter((t) => t.finalArchetype && !t.finalArchetype.defeated)
      .map((t) => t.id);
    const taken = new Set();
    for (const tid of tiles) {
      const destTile = landscapeById(state, tid);
      const remaining = alive.filter((p) => !taken.has(p.id));
      if (!remaining.length) break;
      remaining.sort((a, b) => {
        const da = hexDistance(landscapeById(state, a.landscapeId), destTile);
        const db = hexDistance(landscapeById(state, b.landscapeId), destTile);
        return da - db;
      });
      dests[remaining[0].id] = tid;
      taken.add(remaining[0].id);
    }
    alive.forEach((p) => { if (!dests[p.id]) dests[p.id] = "bed"; });
    return dests;
  }

  const taken = new Set();
  const questHere = new Set([...meetQuestLandscapeIds(state), ...questTilesRevealed(state)]);
  const beastTiles = [];
  const seenBeasts = new Set();
  allEncountersOnBoard(state).forEach(({ tile }) => {
    if (!tile?.revealed || tile.wasteland || seenBeasts.has(tile.id)) return;
    seenBeasts.add(tile.id);
    beastTiles.push(tile);
  });
  beastTiles.sort((a, b) => {
    const score = (tile) => {
      const nearest = Math.min(...alive.map((p) => hexDistance(landscapeById(state, p.landscapeId), tile)));
      const fighter = alive.some((p) => canFightBeastTile(p, tile)) ? 15 : 0;
      return (questHere.has(tile.id) ? 80 : 0)
        + (tile.encounters?.some((enc) => enc.boss) ? 25 : 0)
        + fighter
        - nearest;
    };
    return score(b) - score(a);
  });

  for (const tile of beastTiles) {
    const remaining = alive.filter((p) => !taken.has(p.id));
    if (!remaining.length) break;
    const fighters = remaining.filter((p) => canFightBeastTile(p, tile) && survivesBeastTile(state, p, tile.id));
    const pool = fighters.length ? fighters : remaining;
    pool.sort((a, b) => {
      const fishing = (p) => questHere.has(p.landscapeId) && !tileHasEncounter(landscapeById(state, p.landscapeId));
      const fishBias = Number(fishing(a)) - Number(fishing(b));
      if (fishBias) return fishBias;
      const payBias = Number(canFightBeastTile(b, tile)) - Number(canFightBeastTile(a, tile));
      if (payBias) return payBias;
      const da = hexDistance(landscapeById(state, a.landscapeId), tile);
      const db = hexDistance(landscapeById(state, b.landscapeId), tile);
      if (da !== db) return da - db;
      return psycheHandCount(b) - psycheHandCount(a);
    });
    const chosen = pool[0];
    const canClear = canFightBeastTile(chosen, tile) && survivesBeastTile(state, chosen, tile.id);
    if (!canClear && tile.id !== "bed") continue;
    dests[chosen.id] = tile.id;
    taken.add(chosen.id);
  }

  const unassigned = () => alive.filter((p) => !taken.has(p.id));
  const boardClear = !allEncountersOnBoard(state).length;
  if (alive.length >= 2 && boardClear && needsMeetQuest(state) && meetQuestNeedsPull(state)) {
    const suit = spawnSuitForQuest(state);
    const home = meetQuestLandscapeIds(state)
      .map((id) => landscapeById(state, id))
      .find((t) => t?.revealed && !t.wasteland && t.suit === suit);
    const lava = landscapeById(state, "lava");
    if (home && suit && lava?.revealed && !lava.wasteland) {
      const waiters = unassigned()
        .filter((p) => (p.hand || []).some((c) => c.suit === suit || isWildPsyche(c)))
        .sort((a, b) => psycheHandCount(b) - psycheHandCount(a));
      if (waiters.length) {
        dests[waiters[0].id] = home.id;
        taken.add(waiters[0].id);
        const runners = unassigned();
        if (runners.length) {
          runners.sort((a, b) => (
            hexDistance(landscapeById(state, a.landscapeId), lava)
            - hexDistance(landscapeById(state, b.landscapeId), lava)
          ));
          dests[runners[0].id] = "lava";
          taken.add(runners[0].id);
        }
      }
    }
  }

  if (boardClear && (needsMeetQuest(state) || needsDrawQuest(state))) {
    const locked = state.botLock?.archId === state.activeArchetype?.id
      ? landscapeById(state, state.botLock.tileId)
      : null;
    const fishTiles = (locked?.revealed && !locked.wasteland ? [locked] : questTilesRevealed(state)
      .map((id) => landscapeById(state, id))
      .filter((t) => t && !tileHasEncounter(t)));
    fishTiles.sort((a, b) => {
      const occ = (t) => alive.some((p) => p.landscapeId === t.id) ? 1 : 0;
      return occ(b) - occ(a);
    });
    const fish = fishTiles[0];
    const remaining = unassigned().filter((p) => psycheHandCount(p) >= 2);
    if (fish && remaining.length) {
      remaining.sort((a, b) => {
        const stick = Number(b.id === state.botLock?.camperId) - Number(a.id === state.botLock?.camperId);
        if (stick) return stick;
        return hexDistance(landscapeById(state, a.landscapeId), fish)
          - hexDistance(landscapeById(state, b.landscapeId), fish);
      });
      dests[remaining[0].id] = fish.id;
      taken.add(remaining[0].id);
      state.botLock = { archId: state.activeArchetype?.id, tileId: fish.id, camperId: remaining[0].id };
    }
  }

  if (!boardClear) {
    unassigned().forEach((p) => {
      dests[p.id] = psycheDrawTileId(state, p);
      taken.add(p.id);
    });
  }

  if (boardClear && teamTokens(state) < 1) {
    const power = powerHexId(state);
    const remaining = unassigned();
    if (power && remaining.length) {
      remaining.sort((a, b) => (a.powerTokens || 0) - (b.powerTokens || 0));
      dests[remaining[0].id] = power;
      taken.add(remaining[0].id);
    }
  }

  if (boardClear && needsSacrificeQuest(state) && !listSacrificableObjects(state).length) {
    const remaining = unassigned();
    const suited = state.board.filter((t) => t.revealed && !t.wasteland && t.suit && !tileHasEncounter(t));
    if (remaining.length && suited.length) {
      remaining.sort((a, b) => psycheHandCount(b) - psycheHandCount(a));
      const from = landscapeById(state, remaining[0].landscapeId);
      suited.sort((a, b) => hexDistance(from, a) - hexDistance(from, b));
      dests[remaining[0].id] = suited[0].id;
      taken.add(remaining[0].id);
    }
  }

  alive.forEach((p) => {
    if (dests[p.id]) return;
    dests[p.id] = safeCampId(state, p);
  });
  return dests;
}

function destForPlayer(state, player, skill) {
  if (skill !== "sloppy") {
    return assignDestinations(state, skill)[player.id] || "bed";
  }
  if (state.finalRecurrence) {
    const tiles = state.board
      .filter((t) => t.finalArchetype && !t.finalArchetype.defeated)
      .map((t) => t.id);
    const idx = Math.max(0, alivePlayers(state).findIndex((p) => p.id === player.id));
    return tiles[idx % Math.max(1, tiles.length)] || "bed";
  }
  if (state.acquiredPoints >= state.goalPoints) return "bed";
  return pick(activeQuestLandscapeIds(state).concat(["bed", "city", "house"])) || "bed";
}

function standingOnQuestWork(state) {
  const quests = new Set(activeQuestLandscapeIds(state));
  return alivePlayers(state).some((p) => quests.has(p.landscapeId));
}

function occupantOn(state, tileId) {
  return state.players.find((p) => p.alive && p.landscapeId === tileId) || null;
}

function tryMeet(state, skill) {
  const meets = state.board.flatMap((tile) => {
    const list = tile.encounters || (tile.encounter ? [tile.encounter] : []);
    const actor = occupantOn(state, tile.id);
    if (!tile.revealed || !list.length || !actor) return [];
    return list.map((enc) => ({ tile, enc, actor }));
  });
  if (!meets.length) return false;

  const meetQuestTiles = new Set(meetQuestLandscapeIds(state));
  meets.sort((a, b) => {
    const aQuest = meetQuestTiles.has(a.tile.id) ? 1 : 0;
    const bQuest = meetQuestTiles.has(b.tile.id) ? 1 : 0;
    if (bQuest !== aQuest) return bQuest - aQuest;
    return (b.enc.boss ? 1 : 0) - (a.enc.boss ? 1 : 0);
  });

  for (const { tile, enc, actor } of meets) {
    setActive(state, playerIndex(state, actor));
    state.selectedLandscapeId = tile.id;
    state.activeEncounter = enc;
    state.activeEncounterLandscapeId = tile.id;

    const leviathan = isLeviathanCard(enc);
    const acceptCard = leviathan ? null : cheapestPayCard(actor, enc, true);
    const rejectCard = cheapestPayCard(actor, enc, false);
    const room = handLimitForPlayer(state, actor) - actor.hand.length;
    let mode = null;
    let card = null;
    if (skill === "skilled") {
      if (!leviathan && acceptCard && room > 0) {
        mode = "accept";
        card = acceptCard;
      } else if (rejectCard) {
        mode = "reject";
        card = rejectCard;
      } else if (acceptCard) {
        mode = "accept";
        card = acceptCard;
      }
    } else {
      const cards = [acceptCard, rejectCard].filter(Boolean);
      card = pick(cards);
      mode = card && card === rejectCard && card !== acceptCard ? "reject" : (card ? "accept" : null);
      if (leviathan && rejectCard) {
        mode = "reject";
        card = rejectCard;
      }
    }
    if (!mode || !card) continue;
    state.selectedHand = [card.instanceId];
    meetEncounter(state, mode, { instant: true });
    resolvePendings(state, skill);
    return true;
  }
  return false;
}

function tryMindstream(state, skill) {
  const quests = new Set(activeQuestLandscapeIds(state));
  const meetQuest = new Set(meetQuestLandscapeIds(state));
  const huntingObject = needsSacrificeQuest(state) && !listSacrificableObjects(state).length;
  if (skill === "skilled" && !quests.size && !huntingObject && !state.finalRecurrence) return false;
  const candidates = state.players
    .filter((p) => p.alive)
    .map((p) => ({ player: p, tile: landscapeById(state, p.landscapeId) }))
    .filter((x) => x.tile?.revealed && !x.tile.wasteland && x.tile.suit);

  if (!candidates.length) return false;
  const ordered = skill === "sloppy"
    ? candidates
    : [...candidates].sort((a, b) => {
      const score = (x) => (meetQuest.has(x.tile.id) ? 4 : 0) + (quests.has(x.tile.id) ? 2 : 0);
      return score(b) - score(a);
    });

  for (const { player, tile } of ordered) {
    const onQuest = quests.has(tile.id) || meetQuest.has(tile.id);
    if (skill === "skilled" && quests.size && !onQuest && !state.finalRecurrence && !huntingObject) {
      continue;
    }
    if (skill === "skilled" && meetQuest.has(tile.id) && beastOdds(state, tile.suit) <= 0) continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = tile.id;
    const before = state.meetActionsUsed;
    drawMindstreamOnLandscape(state);
    resolvePendings(state, skill);
    if (state.meetActionsUsed > before || state.landscapePick) {
      tryMeet(state, skill);
      return true;
    }
  }
  return false;
}

function spawnSuitForQuest(state) {
  return meetQuestLandscapeIds(state)
    .map((id) => landscapeById(state, id))
    .find((t) => t?.revealed && !t.wasteland && t.suit)?.suit || null;
}

function finishSpawnPending(state, result) {
  if (result?.pending !== "spawn-dreambeast-pick-suit" && result?.pending !== "pick-mindstream-suit") {
    return;
  }
  const tile = result.tile;
  const suit = (result.pending === "spawn-dreambeast-pick-suit" && spawnSuitForQuest(state))
    || tile?.suit
    || "lucidity";
  finishLandscapeMindstreamPick(state, tile, result.player, result.actionId, suit);
}

function trySpawnBeast(state, skill) {
  if (skill === "sloppy") return false;
  if (!needsMeetQuest(state) && !needsBossQuest(state)) return false;
  const suit = spawnSuitForQuest(state);
  const home = meetQuestLandscapeIds(state)
    .map((id) => landscapeById(state, id))
    .find((t) => t?.revealed && !t.wasteland && t.suit === suit);
  const waiter = home && alivePlayers(state).find((p) => (
    p.landscapeId === home.id && (p.hand || []).some((c) => c.suit === suit || isWildPsyche(c))
  ));
  if (!waiter) return false;
  const meetIds = new Set(meetQuestLandscapeIds(state));
  for (const player of alivePlayers(state)) {
    const tile = landscapeById(state, player.landscapeId);
    if (!tile?.revealed || tile.wasteland) continue;
    if (tile.id !== "lava" && meetIds.size && !meetIds.has(tile.id) && !activeQuestLandscapeIds(state).includes(tile.id)) continue;
    if (tileHasEncounter(tile)) continue;
    if (psycheHandCount(player) < 2) continue;
    if (psycheHandCount(player) <= meetTaxAt(state, player, tile.id)) continue;
    const choices = getLandscapeActionChoices(tile);
    if (!choices.some((c) => c.id === "spawn-dreambeast")) continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = tile.id;
    const before = state.meetActionsUsed;
    const result = performLandscapeAction(state, "spawn-dreambeast");
    finishSpawnPending(state, result);
    resolvePendings(state, skill);
    tryMeet(state, skill);
    if (state.meetActionsUsed > before) return true;
  }
  return false;
}

function tryFinalRecurrence(state, skill) {
  if (!state.finalRecurrence) return false;
  const remaining = (state.finalArchetypes || []).filter((a) => !a.defeated);
  if (!remaining.length) return false;

  const acquired = state.players.reduce((n, p) => n + (p.acquiredArchetypes?.length || 0), 0);
  const dreamsLeft = state.dreamDeck.length;
  if (skill === "skilled" && acquired > 0 && dreamsLeft <= remaining.length + 1) {
    handleSacrificeForFinal(state);
  } else if (skill === "skilled" && acquired >= remaining.length && dreamsLeft < remaining.length * 3) {
    handleSacrificeForFinal(state);
  }

  for (const arch of remaining) {
    const tileId = state.board.find((t) => t.finalArchetype?.id === arch.id && !t.finalArchetype.defeated)?.id
      || arch.landscapeId;
    if (!tileId) continue;
    let actor = occupantOn(state, tileId);
    if (!actor) {
      const mover = alivePlayers(state).find((p) => p.landscapeId !== tileId);
      if (mover && skill === "skilled") {
        setActive(state, playerIndex(state, mover));
        const step = nextStepToward(state, mover, tileId, skill);
        if (step && step !== mover.landscapeId) {
          moveDreamer(state, step);
          resolvePendings(state, skill);
          actor = occupantOn(state, tileId);
        }
      }
    }
    if (!actor) continue;
    setActive(state, playerIndex(state, actor));
    state.selectedLandscapeId = tileId;
    const opposing = { lucidity: "willpower", willpower: "elasticity", elasticity: "lucidity" }[arch.suit] || "lucidity";
    const pool = alivePlayers(state).flatMap((p) =>
      p.hand
        .filter((c) => c.type !== "psyche-power")
        .map((c) => ({ card: c, opposing: c.suit === opposing || c.isWild || c.suit === "wild" })),
    );
    pool.sort((a, b) => Number(b.opposing) - Number(a.opposing) || (b.card.value || 0) - (a.card.value || 0));
    const picked = [];
    let total = 0;
    const firstOpp = pool.find((x) => x.opposing);
    if (firstOpp) {
      picked.push(firstOpp.card);
      total += firstOpp.card.value || 0;
    }
    for (const item of pool) {
      if (picked.includes(item.card)) continue;
      if (total >= FINAL_PSYCHE && picked.length >= 2) break;
      picked.push(item.card);
      total += item.card.value || 0;
    }
    state.selectedHand = picked.map((c) => c.instanceId);
    stackSpreadTokens(state, FINAL_PSYCHE, total);
    const before = state.status;
    handleDefeatFinalArchetype(state);
    resolvePendings(state, skill);
    if (state.status !== before) return true;
  }
  return false;
}

function tryTakePower(state, skill) {
  const want = Math.max(2, unmarkedQuestCount(state));
  if (skill !== "sloppy" && teamTokens(state) >= want + 1) return false;
  const tiles = ["awards", "candy-mountain"]
    .map((id) => landscapeById(state, id))
    .filter((t) => t?.revealed && !t.wasteland);
  for (const tile of tiles) {
    const player = occupantOn(state, tile.id);
    if (!player) continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = tile.id;
    const before = state.meetActionsUsed;
    performLandscapeAction(state, "take-power");
    resolvePendings(state, skill);
    if (state.meetActionsUsed > before) return true;
  }
  return false;
}

function tryRestockPsyche(state, skill) {
  if (skill === "sloppy") return false;
  const actions = ["draw-3-psyche", "draw-psyche-equal-to-elasticity", "draw-1-psyche"];
  const ordered = [...alivePlayers(state)].sort((a, b) => psycheHandCount(a) - psycheHandCount(b));
  for (const player of ordered) {
    if (psycheHandCount(player) >= POOL_LEAVE && !tileHasEncounter(landscapeById(state, player.landscapeId))) continue;
    const tile = landscapeById(state, player.landscapeId);
    if (!tile?.revealed || tile.wasteland) continue;
    const choices = getLandscapeActionChoices(tile);
    const action = actions.find((id) => choices.some((c) => c.id === id));
    if (!action) continue;
    if (psycheHandCount(player) >= handLimitForPlayer(state, player)) continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = tile.id;
    const before = state.meetActionsUsed;
    performLandscapeAction(state, action);
    resolvePendings(state, skill);
    if (state.meetActionsUsed > before) return true;
  }
  return false;
}

function tryBedPool(state, skill) {
  const campers = alivePlayers(state).filter((p) => p.landscapeId === "bed");
  if (!campers.length) return false;
  if (skill === "skilled" && !deckCanDraw(state, 3)) return false;

  const ordered = [...campers].sort((a, b) => psycheHandCount(a) - psycheHandCount(b));
  for (const player of ordered) {
    const room = handLimitForPlayer(state, player) - psycheHandCount(player);
    if (room < 1 && skill !== "sloppy") continue;
    if (skill === "skilled" && psycheHandCount(player) >= POOL_LEAVE) continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = "bed";
    const before = state.meetActionsUsed;
    performLandscapeAction(state, "draw-3-psyche");
    resolvePendings(state, skill);
    if (state.meetActionsUsed > before) return true;
  }
  return false;
}

function beastOdds(state, suit) {
  const deck = state.mindstreamDecks?.[suit] || [];
  const discard = state.mindstreamDiscard?.[suit] || [];
  const pile = deck.concat(discard);
  if (!pile.length) return 0;
  const beasts = pile.filter((card) => card.type === "dreambeast").length;
  return beasts / pile.length;
}

function tryMarkQuests(state, skill) {
  const arch = state.activeArchetype;
  if (!arch || !commitReady(state)) return false;
  if (skill === "sloppy" && chance(0.35)) return false;
  const holder = [...alivePlayers(state)]
    .filter((p) => (p.powerTokens || 0) >= 1)
    .sort((a, b) => (b.powerTokens || 0) - (a.powerTokens || 0))[0];
  if (!holder) return false;
  setActive(state, playerIndex(state, holder));
  const acted = !!handleQuestComplete(state, 0);
  if (acted) {
    state.botLock = null;
    resolvePendings(state, skill);
  }
  return acted;
}

function stackSpreadTokens(state, need, current) {
  let gap = Math.max(0, need - current);
  let guard = 8;
  const reserve = tokensReserved(state, "skilled");
  while (gap > 0 && guard-- > 0) {
    const rich = [...alivePlayers(state)]
      .filter((p) => (p.powerTokens || 0) >= 1)
      .sort((a, b) => (b.powerTokens || 0) - (a.powerTokens || 0))[0];
    if (!rich) break;
    if (teamTokens(state) <= reserve && readyQuestCount(state) > 0) break;
    setActive(state, playerIndex(state, rich));
    const before = state.pendingPowerBonus || 0;
    powerBonus(state);
    if ((state.pendingPowerBonus || 0) <= before) break;
    gap -= 1;
  }
}

function runReveal(state, skill) {
  useTools(state, skill);
  drawDreamCard(state);
  resolvePendings(state, skill);
  useTools(state, skill);
  if (skill !== "sloppy" || chance(0.85)) {
    if (openPhaseWithCardsOrToken(state, skill, "lucidity")) {
      revealLandscape(state);
      resolvePendings(state, skill);
    }
  }
  resolvePendings(state, skill);
  if (state.landscapePick?.mode === "reveal" && !revealableTiles(state).length) {
    cancelLandscapePick(state);
  }
  endPhase(state);
}

function runExplore(state, skill) {
  useTools(state, skill);
  if (rallyOnBedIfGoalMet(state, skill)) {
    endPhase(state);
    return;
  }
  if (skill !== "sloppy" || chance(0.85)) {
    if (openPhaseWithCardsOrToken(state, skill, "elasticity")) {
      activateExplore(state);
    }
  }
  resolvePendings(state, skill);

  let moves = 0;
  while (state.exploreActivated && state.exploreMovesLeft > 0 && moves++ < 24) {
    const movers = [...alivePlayers(state)].sort((a, b) => {
      const destA = destForPlayer(state, a, skill);
      const destB = destForPlayer(state, b, skill);
      const pa = landscapeById(state, a.landscapeId);
      const pb = landscapeById(state, b.landscapeId);
      const ta = landscapeById(state, destA);
      const tb = landscapeById(state, destB);
      if (!pa || !pb || !ta || !tb) return 0;
      return hexDistance(pa, ta) - hexDistance(pb, tb);
    });

    let stepped = false;
    for (const player of movers) {
      const dest = destForPlayer(state, player, skill);
      if (dest === player.landscapeId) continue;
      setActive(state, playerIndex(state, player));
      const step = nextStepToward(state, player, dest, skill);
      if (!step || step === player.landscapeId) continue;
      moveDreamer(state, step);
      resolvePendings(state, skill);
      stepped = true;
      break;
    }
    if (!stepped) break;
  }
  useTools(state, skill);
  resolvePendings(state, skill);
  endPhase(state);
}

function runMeet(state, skill) {
  resolvePendings(state, skill);
  useTools(state, skill);
  if (rallyOnBedIfGoalMet(state, skill)) {
    resolvePendings(state, skill);
    endPhase(state);
    return;
  }
  if (skill !== "sloppy" || chance(0.8)) {
    if (openPhaseWithCardsOrToken(state, skill, "willpower")) {
      gainMeetActions(state);
    }
  }
  resolvePendings(state, skill);

  let actions = 0;
  const actionCap = 8 + alivePlayers(state).length * 3;
  while (state.meetActionBudget > 0 && state.meetActionsUsed < state.meetActionBudget && actions++ < actionCap) {
    if (skill === "skilled" && !state.finalRecurrence && state.acquiredPoints >= state.goalPoints) break;
    const used = state.meetActionsUsed;
    useTools(state, skill);
    if (tryFinalRecurrence(state, skill)) continue;
    if (tryMeet(state, skill) && state.meetActionsUsed > used) {
      tryMarkQuests(state, skill);
      continue;
    }
    const onBeast = alivePlayers(state).some((p) => tileHasEncounter(landscapeById(state, p.landscapeId)));
    if (onBeast && tryRestockPsyche(state, skill) && state.meetActionsUsed > used) continue;
    if (skill === "skilled" && teamTokens(state) < 1 && tryTakePower(state, skill)) continue;
    const roaming = allEncountersOnBoard(state).length > 0;
    const fishingMeet = !roaming && skill === "skilled" && needsMeetQuest(state) && standingOnQuestWork(state) && meetQuestNeedsPull(state);
    if (fishingMeet && tryMindstream(state, skill)) {
      tryMarkQuests(state, skill);
      continue;
    }
    const drawFirst = !roaming && skill === "skilled" && needsDrawQuest(state) && standingOnQuestWork(state);
    if (drawFirst && tryMindstream(state, skill)) {
      tryMarkQuests(state, skill);
      continue;
    }
    if (trySpawnBeast(state, skill) && state.meetActionsUsed > used) {
      tryMarkQuests(state, skill);
      continue;
    }
    const huntingObject = needsSacrificeQuest(state) && !listSacrificableObjects(state).length;
    if (!allEncountersOnBoard(state).length && (skill !== "sloppy" || chance(0.55)) && (readyToExpedition(state, skill) || standingOnQuestWork(state) || needsMeetQuest(state) || needsBossQuest(state) || huntingObject) && tryMindstream(state, skill)) continue;
    if (tryTakePower(state, skill)) continue;
    const pooling = !readyToExpedition(state, skill)
      || needsTenPsycheQuest(state)
      || alivePlayers(state).some((p) => p.landscapeId === "bed" && psycheHandCount(p) < POOL_LEAVE);
    if (pooling && !standingOnQuestWork(state) && (tryRestockPsyche(state, skill) || tryBedPool(state, skill))) continue;
    if ((tryRestockPsyche(state, skill) || tryBedPool(state, skill)) && !standingOnQuestWork(state)) continue;
    break;
  }
  tryMeet(state, skill);
  tryMarkQuests(state, skill);
  resolvePendings(state, skill);
  endPhase(state);
}

function lossReason(state) {
  if (state.status === "won") return "won";
  const log = (state.log || []).join("\n");
  if ((state.deathClock || 0) >= 6 || /Death Clock strikes/i.test(log)) return "death-clock";
  if (/Psyche Deck is exhausted/i.test(log)) return "psyche-empty";
  if (/Mindstream is gone/i.test(log)) return "mindstream-gone";
  if (/You Never Wake/i.test(log)) return "you-never-wake";
  if (/No Dreamers remain/i.test(log) || !alivePlayers(state).length) return "all-dead";
  if (state.finalRecurrence) {
    const left = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
    if (state.dreamDeck.length === 0 && left > 0) return "final-recurrence-deck";
    return "final-recurrence-stalled";
  }
  if (state.dreamDeck.length === 0) return "dream-deck-empty";
  if (state.status === "lost") return "other-loss";
  return "stalled";
}

function simulateGame({ lengthKey, skill, selectedDreamers }) {
  const dreamers = selectedDreamers;
  const playerCount = dreamers.length;
  const comboKey = dreamers.map((d) => d.id).sort().join("+");
  const state = createInitialState(gameData, {
    lengthKey,
    selectedDreamers: dreamers,
  });

  const maxRounds = 40;
  const originalGoal = state.goalPoints;
  let rounds = 0;
  while (state.status === "playing" && rounds < maxRounds) {
    rounds += 1;
    const startRound = state.round;
    if (getPhase(state) === "Reveal") runReveal(state, skill);
    if (state.status !== "playing") break;
    if (getPhase(state) === "Explore") runExplore(state, skill);
    if (state.status !== "playing") break;
    if (getPhase(state) === "Meet") runMeet(state, skill);
    if (state.round === startRound && state.status === "playing") {
      resolvePendings(state, skill);
      if (state.landscapePick) cancelLandscapePick(state);
      try { endPhase(state); } catch { break; }
      if (state.round === startRound) break;
    }
  }

  if (process.env.SOMNIA_SIM_DEBUG && !globalThis.__somniaDbg) {
    globalThis.__somniaDbg = true;
    const arch = state.activeArchetype || state.players.flatMap((p) => p.acquiredArchetypes || [])[0];
    console.log("--- DEBUG GAME ---");
    console.log({
      status: state.status,
      reason: lossReason(state),
      points: state.acquiredPoints,
      goal: originalGoal,
      rounds: state.round,
      arch: arch?.name,
      quests: arch?.quests,
      progress: arch?.questProgress,
      hands: state.players.map((p) => ({
        name: p.name,
        at: p.landscapeId,
        n: psycheHandCount(p),
        tokens: p.powerTokens,
        alive: p.alive,
      })),
      revealed: state.board.filter((t) => t.revealed && !t.wasteland).map((t) => t.id),
      phase: getPhase(state),
      pending: {
        dream: state.pendingDreamChoice?.dreamId || state.pendingDreamChoice?.title || null,
        dreamUi: state.pendingDreamChoice?.ui || null,
        queue: state.pendingDreamQueue?.length || 0,
        effect: state.pendingEffectChoice?.title || null,
        repress: !!state.pendingRepress,
        ret: !!state.pendingReturn,
        object: state.pendingObjectChoice?.id || state.pendingObjectChoice?.cardId || null,
        landscape: state.landscapePick?.mode || null,
        block: state.log?.[0] || null,
      },
      log: (state.log || []).slice(0, 12),
    });
  }

  const points = state.acquiredPoints || 0;
  const onBed = state.players.filter((p) => p.alive && p.landscapeId === "bed").length;
  const alive = alivePlayers(state).length;
  return {
    status: state.status === "won" ? "won" : "lost",
    reason: lossReason(state),
    points,
    goal: originalGoal,
    rounds: state.round,
    dreamsLeft: state.dreamDeck.length,
    deaths: state.players.reduce((s, p) => s + (p.deathCount || 0), 0),
    archetypes: state.players.reduce((s, p) => s + (p.acquiredArchetypes?.length || 0), 0),
    milestone: milestoneScore(state, originalGoal),
    onBed,
    alive,
    goalMet: points >= originalGoal && originalGoal > 0,
    goalMetNotOnBed: points >= originalGoal && originalGoal > 0 && onBed < alive,
    roamingBeastsEnd: countBoardDreambeasts(state),
    questSnap: process.env.SOMNIA_SIM_QUEST ? {
      name: state.activeArchetype?.name || null,
      quests: state.activeArchetype?.quests || [],
      progress: state.activeArchetype?.questProgress || [],
      met: (state.activeArchetype?.quests || []).map((q) => isQuestConditionMet(state, state.activeArchetype.id, q)),
      mind: Object.keys(state.questTracker?.mindstreamOnLandscape || {}),
      meet: Object.keys(state.questTracker?.meetOnLandscape || {}),
      boss: state.questTracker?.meetBoss || null,
      sac: !!state.questTracker?.sacrificedObject,
      tokens: teamTokens(state),
      lengthKey,
      playerCount,
    } : null,
    finalRecurrence: !!state.finalRecurrence,
    lengthKey,
    skill,
    comboKey,
    playerCount,
    dreamerIds: dreamers.map((d) => d.id),
    powerUses: { ...(state.botPowerUses || {}) },
    passiveUses: { ...(state.botPassiveUses || {}) },
    sacrifices: state.botSacrifices || 0,
  };
}

function milestoneScore(state, goal) {
  const points = state.acquiredPoints || 0;
  const target = goal || 1;
  const acquired = (state.players || []).reduce((sum, player) => sum + (player.acquiredArchetypes?.length || 0), 0);
  const met = (state.activeArchetype?.quests || []).filter((quest) => (
    isQuestConditionMet(state, state.activeArchetype.id, quest)
  )).length;
  const home = state.status === "won" ? 4 : (points >= target && target > 0 ? 2 : 0);
  return acquired * 3 + met + Math.min(4, (points / target) * 4) + home - Math.min(6, state.deathClock || 0) * 0.4;
}

function summarize(rows) {
  const n = rows.length;
  const wins = rows.filter((r) => r.status === "won").length;
  const winRate = n ? wins / n : 0;
  const se = n ? Math.sqrt(winRate * (1 - winRate) / n) : 0;
  const reasons = {};
  rows.forEach((r) => { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
  const avg = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n;
  return {
    n,
    wins,
    losses: n - wins,
    winRate,
    winPct: +(winRate * 100).toFixed(1),
    ci95: [Math.max(0, winRate - 1.96 * se), Math.min(1, winRate + 1.96 * se)].map((x) => +(x * 100).toFixed(1)),
    reasons,
    avgPoints: +avg("points").toFixed(2),
    avgRounds: +avg("rounds").toFixed(2),
    avgDeaths: +avg("deaths").toFixed(2),
    avgArchetypes: +avg("archetypes").toFixed(2),
    avgMilestone: +avg("milestone").toFixed(2),
    avgDreamsLeft: +avg("dreamsLeft").toFixed(2),
    goalReachedButLost: rows.filter((r) => r.status === "lost" && r.goalMet).length,
    goalMetNotOnBed: rows.filter((r) => r.goalMetNotOnBed).length,
    finalRecurrenceGames: rows.filter((r) => r.finalRecurrence).length,
    avgRoamingBeasts: +avg("roamingBeastsEnd").toFixed(2),
  };
}

function combinations(items, k) {
  const out = [];
  const rec = (start, chosen) => {
    if (chosen.length === k) {
      out.push(chosen.slice());
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      chosen.push(items[i]);
      rec(i + 1, chosen);
      chosen.pop();
    }
  };
  rec(0, []);
  return out;
}

function lengthForRun(i) {
  return ["daydream", "nap", "deep"][i % 3];
}

function crashRow(cell, err) {
  if (!globalThis.__somniaCrashLogged) {
    globalThis.__somniaCrashLogged = true;
    console.error("SIM CRASH:", err?.stack || err);
  }
  globalThis.__somniaCrashCount = (globalThis.__somniaCrashCount || 0) + 1;
  if (err?.message && !globalThis.__somniaCrashKinds) globalThis.__somniaCrashKinds = {};
  if (err?.message) {
    const kinds = globalThis.__somniaCrashKinds;
    kinds[err.message] = (kinds[err.message] || 0) + 1;
  }
  return {
    status: "lost",
    reason: "crash",
    points: 0,
    goal: dataModule.LENGTHS[cell.lengthKey].points,
    rounds: 0,
    dreamsLeft: 0,
    deaths: 0,
    archetypes: 0,
    onBed: 0,
    alive: 0,
    goalMet: false,
    goalMetNotOnBed: false,
    roamingBeastsEnd: 0,
    finalRecurrence: false,
    lengthKey: cell.lengthKey,
    skill: cell.skill,
    comboKey: cell.comboKey,
    playerCount: cell.playerCount,
    dreamerIds: cell.selectedDreamers.map((d) => d.id),
    powerUses: {},
    passiveUses: {},
    sacrifices: 0,
  };
}

function groupSummaries(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  const out = {};
  for (const [key, group] of map) out[key] = summarize(group);
  return out;
}

function tallyNamedCounts(rows, field) {
  const uses = {};
  const games = {};
  rows.forEach((row) => {
    (row.dreamerIds || []).forEach((id) => { games[id] = (games[id] || 0) + 1; });
    Object.entries(row[field] || {}).forEach(([id, n]) => { uses[id] = (uses[id] || 0) + n; });
  });
  const out = {};
  const ids = new Set([...Object.keys(games), ...Object.keys(uses)]);
  for (const id of ids) {
    const present = games[id] || rows.length;
    out[id] = {
      games: games[id] || 0,
      uses: uses[id] || 0,
      perGame: +((uses[id] || 0) / Math.max(1, present)).toFixed(2),
    };
  }
  return out;
}

const DREAMER_ROSTER = [...gameData.dreamers].sort((a, b) => a.id.localeCompare(b.id));
const RUNS_PER_COMBO = Number(process.env.SOMNIA_SIM_COMBO_RUNS || 100);
const SLOPPY_PER_COUNT = Number(process.env.SOMNIA_SIM_SLOPPY_PER_COUNT || 10);

const JOBS = [];
for (let k = 1; k <= 6; k += 1) {
  for (const combo of combinations(DREAMER_ROSTER, k)) {
    const comboKey = combo.map((d) => d.id).sort().join("+");
    for (let i = 0; i < RUNS_PER_COMBO; i += 1) {
      JOBS.push({
        skill: "skilled",
        lengthKey: lengthForRun(i),
        selectedDreamers: combo,
        playerCount: k,
        comboKey,
      });
    }
  }
}

for (let k = 1; k <= 6; k += 1) {
  const combos = combinations(DREAMER_ROSTER, k);
  const sample = combos[0];
  const comboKey = sample.map((d) => d.id).sort().join("+");
  for (let i = 0; i < SLOPPY_PER_COUNT; i += 1) {
    JOBS.push({
      skill: "sloppy",
      lengthKey: lengthForRun(i),
      selectedDreamers: sample,
      playerCount: k,
      comboKey,
    });
  }
}

const started = Date.now();
const all = [];
globalThis.__somniaCrashCount = 0;
globalThis.__somniaCrashKinds = {};

console.log(
  `Somnia 35.0 combo matrix: ${DREAMER_ROSTER.length} Dreamers, 63 combinations × ${RUNS_PER_COMBO} skilled + ${6 * SLOPPY_PER_COUNT} sloppy = ${JOBS.length} games`,
);

let done = 0;
let lastLog = Date.now();
for (const cell of JOBS) {
  try {
    all.push(simulateGame(cell));
  } catch (err) {
    all.push(crashRow(cell, err));
  }
  done += 1;
  if (done % 200 === 0 || Date.now() - lastLog > 15000) {
    const elapsed = ((Date.now() - started) / 1000).toFixed(0);
    const wins = all.filter((r) => r.status === "won").length;
    console.log(`… ${done}/${JOBS.length} (${elapsed}s) wins=${wins} crashes=${globalThis.__somniaCrashCount}`);
    lastLog = Date.now();
  }
}

const skilled = all.filter((r) => r.skill === "skilled");
const sloppy = all.filter((r) => r.skill === "sloppy");
const byLength = groupSummaries(all, (r) => r.lengthKey);
const byPlayerCount = groupSummaries(skilled, (r) => String(r.playerCount));
const byCombo = groupSummaries(skilled, (r) => r.comboKey);
const comboRanks = Object.entries(byCombo)
  .map(([comboKey, s]) => ({ comboKey, playerCount: comboKey.split("+").length, ...s }))
  .sort((a, b) => b.winRate - a.winRate);

const report = {
  version: "35.0",
  engineNote: "Real Somnia JS engine, rules 35.0. One Power Token commits an Archetype once both quests are true. Death Clock of 6. Quest Landscapes are forgotten last. Skilled bots lock a camper on the quest hex, protect the pay card, and Meet a beast drawn there in the same phase.",
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  totalGames: all.length,
  comboRuns: RUNS_PER_COMBO,
  combinationCount: 63,
  crashCount: globalThis.__somniaCrashCount,
  crashKinds: globalThis.__somniaCrashKinds,
  overall: summarize(all),
  skilled: summarize(skilled),
  sloppy: summarize(sloppy),
  byLength,
  byPlayerCount,
  dreamerPowers: tallyNamedCounts(skilled, "powerUses"),
  dreamerPassives: tallyNamedCounts(skilled, "passiveUses"),
  sacrifices: skilled.reduce((sum, row) => sum + (row.sacrifices || 0), 0),
  comboBest: comboRanks.slice(0, 8),
  comboWorst: comboRanks.filter((c) => c.n >= Math.min(50, RUNS_PER_COMBO)).slice(-8).reverse(),
  cells: comboRanks,
};

const out = join(__dirname, "somnia-winrate-report.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nWrote ${out}`);
console.log(`Total ${report.totalGames} games in ${(report.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Skilled win rate: ${report.skilled.winPct}%  (${report.skilled.wins}/${report.skilled.n})`);
console.log(`Sloppy win rate: ${report.sloppy.winPct}%`);
console.log(`Crashes: ${report.crashCount}`);
console.log("By player count:", Object.fromEntries(
  Object.entries(byPlayerCount).map(([k, s]) => [k, `${s.winPct}% (${s.wins}/${s.n})`]),
));
console.log("Dreamer powers per game (skilled):", Object.fromEntries(
  Object.entries(report.dreamerPowers).map(([id, s]) => [id, `${s.uses} uses / ${s.games} games (${s.perGame}/game)`]),
));
console.log("Passives:", report.dreamerPassives);
console.log(`Object sacrifices: ${report.sacrifices}`);
if (process.env.SOMNIA_SIM_QUEST) {
  const snaps = all.map((r) => r.questSnap).filter(Boolean);
  const drawMet = snaps.filter((s) => s.quests.some((q, i) => /draw mindstream/i.test(q) && s.met[i])).length;
  const meetMet = snaps.filter((s) => s.quests.some((q, i) => /meet a dreambeast/i.test(q) && s.met[i])).length;
  const bossMet = snaps.filter((s) => s.quests.some((q, i) => /defeat/i.test(q) && s.met[i])).length;
  const sacMet = snaps.filter((s) => s.quests.some((q, i) => /sacrific/i.test(q) && s.met[i])).length;
  const bothMarked = snaps.filter((s) => s.progress?.every(Boolean)).length;
  console.log("QUEST SNAP", {
    n: snaps.length,
    drawMet,
    meetMet,
    bossMet,
    sacMet,
    bothMarked,
    anyMind: snaps.filter((s) => s.mind.length).length,
    anyMeet: snaps.filter((s) => s.meet.length).length,
    avgTokens: (snaps.reduce((s, x) => s + x.tokens, 0) / snaps.length).toFixed(2),
  });
  console.log("sample", JSON.stringify(snaps.slice(0, 4), null, 0));
}
