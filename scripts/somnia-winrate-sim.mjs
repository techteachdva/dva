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

const { createInitialState, getPhase, landscapeById, avoidDreamerDeath, acceptDreamerDeath } =
  await import(pathToFileURL(join(JS_DIR, "state.js")).href);
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
  powerBonus,
  togglePhasePowerToken,
  getEffectHelpers,
  playObject,
  useDreamerPower,
} = await import(pathToFileURL(join(JS_DIR, "game.js")).href);
const { resolveObjectChoice, resumeObjectEffect } = await import(pathToFileURL(join(JS_DIR, "object-effects.js")).href);
const { playPsychePowerFromHand } = await import(pathToFileURL(join(JS_DIR, "power-tokens.js")).href);
const { handleLandscapeTilePick, revealableTiles, forgettableTiles, cancelLandscapePick } =
  await import(pathToFileURL(join(JS_DIR, "landscapes.js")).href);
const { getQuestStatus, activeQuestLandscapeIds, isQuestConditionMet } =
  await import(pathToFileURL(join(JS_DIR, "quests.js")).href);
const { getLegalMoveTargets, hexDistance, adjacentTiles } =
  await import(pathToFileURL(join(JS_DIR, "hex.js")).href);
const { encounterRejectCost } = await import(pathToFileURL(join(JS_DIR, "dreambeasts.js")).href);
const {
  meetPsychePlayTotal,
  selectedCards,
  meetBonusBreakdown,
} = await import(pathToFileURL(join(JS_DIR, "rules.js")).href);
const { pickReturnCard, pickRepressCard, confirmRepressStep, listSubconsciousCards } =
  await import(pathToFileURL(join(JS_DIR, "subconscious.js")).href);
const { resolveNothingChoice, handLimitForPlayer } = await import(pathToFileURL(join(JS_DIR, "objects.js")).href);
const {
  cancelDreamerPower,
  resolveDreamerPowerChoice,
  resolveDreamerPowerDeckPick,
  handleDreamerPowerTilePick,
} = await import(pathToFileURL(join(JS_DIR, "dreamer-powers.js")).href);
const { psycheHandCount, psycheCardValue } = await import(pathToFileURL(join(JS_DIR, "psyche.js")).href);

const POOL_LEAVE = 6;
const POOL_RETREAT = 3;

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

function tokensReserved(state, skill) {
  if (skill === "sloppy" || state.finalRecurrence) return 0;
  const ready = readyQuestCount(state);
  if (ready > 0) return ready;
  return 2;
}

function canSpendToken(state, player, skill) {
  if ((player.powerTokens || 0) < 1) return false;
  return teamTokens(state) > tokensReserved(state, skill);
}

function canSpendTokenOnPhase(state, player, skill) {
  if (!canSpendToken(state, player, skill)) return false;
  if (skill === "sloppy") return true;
  const ready = readyQuestCount(state);
  if (ready > 0 && teamTokens(state) <= ready) return false;
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
  if (VALUE_INSTANTS.has(card.id)) return true;
  if (card.id === "candle") return revealableTiles(state).length > 0;
  if (MOVE_INSTANTS.has(card.id)) {
    return alivePlayers(state).some((p) => p.landscapeId === "bed") || state.finalRecurrence;
  }
  if (card.id === "tooth-saber") return false;
  if (SPAWN_INSTANTS.has(card.id) || card.id === "the-all") return false;
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

function dreamerPowerWorthIt(state, player, skill) {
  const id = player.dreamer?.id;
  const hidden = revealableTiles(state);
  const questsHidden = activeQuestLandscapeIds(state).some((lid) => {
    const tile = landscapeById(state, lid);
    return tile && (!tile.revealed || tile.wasteland);
  });
  if (id === "the-visionary") {
    if (state.botVisionaryRound === state.round) return false;
    return questsHidden || (hidden.length >= 4 && state.round <= 4);
  }
  if (id === "the-rested") return (state.psycheDiscard?.length || 0) >= 2;
  if (id === "the-runner") {
    if (state.finalRecurrence) return true;
    const phase = getPhase(state);
    if (phase !== "Explore") return false;
    return alivePlayers(state).some((p) => destForPlayer(state, p, skill) !== p.landscapeId);
  }
  if (id === "the-hunter") return needsMeetQuest(state) || needsBossQuest(state);
  if (id === "the-immovable") return !!(state.cancellableDiscard || state.cancellableMove);
  if (id === "the-weaver") return false;
  return false;
}

function chooseDreamerPowerOption(state, skill, pending, choices) {
  const ids = (choices || []).map((c) => c.id);
  const pickId = (wanted) => ids.find((id) => id === wanted) || ids[0];
  if (skill === "sloppy") return pick(ids) || ids[0];
  if (pending.dreamerId === "the-visionary") {
    return revealableTiles(state).length ? pickId("reveal-landscapes") : pickId("flip-decks");
  }
  if (pending.dreamerId === "the-rested") {
    return (state.psycheDiscard?.length || 0) > 0 ? pickId("discard-draw") : pickId("swap-archetype");
  }
  if (pending.dreamerId === "the-runner") {
    const camping = !readyToExpedition(state, skill) || state.finalRecurrence || state.acquiredPoints >= state.goalPoints;
    return camping ? pickId("toward-bed") : pickId("away-bed");
  }
  if (pending.dreamerId === "the-weaver") {
    const player = state.players.find((p) => p.id === (pending.weaverQueue || [])[pending.weaverIndex || 0]);
    return (player?.hand?.length || 0) >= 8 ? pickId("weaver-deck") : pickId("weaver-skip");
  }
  if (pending.dreamerId === "the-immovable") return pickId("cancel-discard") || pickId("cancel-move");
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
    resolveDreamerPowerDeckPick(state, "psyche");
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
    if (!useDreamerPower(state)) continue;
    if (player.dreamer?.id === "the-visionary") state.botVisionaryRound = state.round;
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
  tryPlayObjects(state, skill);
  tryDreamerPowers(state, skill);
  tryMarkQuests(state, skill);
}

function selectBestSuit(state, playerIndex, suit, max = 2) {
  const player = state.players[playerIndex];
  setActive(state, playerIndex);
  const cards = player.hand
    .filter((c) => c.type !== "psyche-power" && (c.suit === suit || c.isWild || c.suit === "wild"))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  state.selectedHand = cards.slice(0, max).map((c) => c.instanceId);
  return state.selectedHand.length;
}

function openPhaseWithCardsOrToken(state, skill, suit) {
  playPowerCards(state);
  tryMarkQuests(state, skill);
  let pi = bestContributor(state, suit);
  let n = selectBestSuit(state, pi, suit, skill === "skilled" ? 2 : 1);
  if (n < 1) {
    const withTok = alivePlayers(state).find((p) => (p.powerTokens || 0) > 0);
    if (withTok) {
      pi = playerIndex(state, withTok);
      n = selectBestSuit(state, pi, suit, skill === "skilled" ? 2 : 1);
    }
  }
  const player = state.players[pi];
  if (player && n < (skill === "skilled" ? 2 : 1) && canSpendTokenOnPhase(state, player, skill)) {
    setActive(state, pi);
    togglePhasePowerToken(state);
  }
  return n >= 1 || !!state.phaseTokenAsPsyche;
}

function bestContributor(state, suit) {
  let best = 0;
  let bestVal = -1;
  state.players.forEach((p, i) => {
    if (!p.alive) return;
    const cards = p.hand.filter((c) => c.suit === suit || c.isWild || c.suit === "wild");
    if (!cards.length) return;
    const val = (p.dreamer?.[suit] || 0) + cards.reduce((s, c) => s + (c.value || 0), 0);
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
  let guard = 40;
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
      const quests = new Set(activeQuestLandscapeIds(state));
      const ordered = [...tiles].sort((a, b) => Number(quests.has(b.id)) - Number(quests.has(a.id)));
      const tile = skill === "skilled" ? ordered[0] : pick(tiles);
      if (!tile) {
        cancelLandscapePick(state);
        break;
      }
      handleLandscapeTilePick(state, tile.id);
      continue;
    }
    if (state.landscapePick?.mode === "forget") {
      const tiles = forgettableTiles(state);
      const tile = pick(tiles);
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
      const canPay = (player?.powerTokens || 0) >= state.pendingDeathChoice.cost;
      if (skill === "skilled" && canPay) avoidDreamerDeath(state);
      else if (skill === "sloppy" && canPay && chance(0.45)) avoidDreamerDeath(state);
      else acceptDreamerDeath(state);
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
      const card = pool.find((c) => !pending.picked.some((p) => p.instanceId === c.instanceId));
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
    if (state.pendingDreamerPower) {
      resolveDreamerPowerPending(state, skill);
      continue;
    }
    break;
  }
}

function nextStepToward(state, player, destId, skill = "skilled") {
  const dest = landscapeById(state, destId);
  const safeEnough = (t) => {
    if (!t) return false;
    if (t.wasteland && t.id !== destId) return false;
    return true;
  };
  const legal = getLegalMoveTargets(state, player).filter(safeEnough);
  if (!legal.length) return null;
  if (legal.some((t) => t.id === destId)) return destId;

  const start = landscapeById(state, player.landscapeId);
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
    return /meet (cerberus|double|leviathan)/i.test(q) && !isQuestConditionMet(state, arch.id, q);
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

/** Camp The Bed until hands are thick enough, then leave together for quests. */
function readyToExpedition(state, skill) {
  if (state.finalRecurrence) return true;
  if (state.acquiredPoints >= state.goalPoints) return true;
  if (needsTenPsycheQuest(state)) {
    return alivePlayers(state).some((p) => psycheHandCount(p) >= 10);
  }
  if (needsBossQuest(state) && state.round <= 9) {
    return teamAvgHand(state) >= POOL_LEAVE;
  }
  if (needsMeetQuest(state) && questTilesRevealed(state).length) {
    return teamAvgHand(state) >= POOL_RETREAT;
  }
  if (skill === "sloppy") return teamAvgHand(state) >= 5 || state.round >= 2;
  const revealed = questTilesRevealed(state);
  const avg = teamAvgHand(state);
  if (alivePlayers(state).some((p) => psycheHandCount(p) < POOL_RETREAT)) return false;
  if (revealed.length && avg >= 5) return true;
  if (avg >= POOL_LEAVE) return true;
  return state.round >= 2 && avg >= 5;
}

function destForPlayer(state, player, skill) {
  if (state.finalRecurrence) {
    const tiles = state.board
      .filter((t) => t.finalArchetype && !t.finalArchetype.defeated)
      .map((t) => t.id);
    const idx = Math.max(0, alivePlayers(state).findIndex((p) => p.id === player.id));
    return tiles[idx % Math.max(1, tiles.length)] || "bed";
  }
  if (state.acquiredPoints >= state.goalPoints) return "bed";
  if (skill === "sloppy") {
    return pick(activeQuestLandscapeIds(state).concat(["bed", "city", "house"])) || "bed";
  }
  if (!readyToExpedition(state, skill) || psycheHandCount(player) < POOL_RETREAT) {
    return "bed";
  }
  const teamTokens = alivePlayers(state).reduce((s, p) => s + (p.powerTokens || 0), 0);
  if (teamTokens < 2) {
    const powerHex = ["awards", "candy-mountain"]
      .map((id) => landscapeById(state, id))
      .find((t) => t?.revealed && !t.wasteland);
    if (powerHex) return powerHex.id;
  }
  const quests = questTilesRevealed(state);
  if (quests.length) {
    const idx = Math.max(0, alivePlayers(state).findIndex((p) => p.id === player.id));
    const ranked = rankDestinations(state, player, quests, skill);
    return ranked[idx % ranked.length];
  }
  if (needsMeetQuest(state) || needsBossQuest(state)) {
    const beastTiles = state.board
      .filter((t) => t.revealed && !t.wasteland && tileHasEncounter(t))
      .map((t) => t.id);
    if (beastTiles.length) {
      const idx = Math.max(0, alivePlayers(state).findIndex((p) => p.id === player.id));
      const ranked = rankDestinations(state, player, beastTiles, skill);
      return ranked[idx % ranked.length];
    }
  }
  const empties = state.board.filter((t) => t.revealed && !t.wasteland && !t.center).map((t) => t.id);
  if (empties.length) {
    const idx = Math.max(0, alivePlayers(state).findIndex((p) => p.id === player.id));
    const ranked = rankDestinations(state, player, empties, skill);
    return ranked[idx % ranked.length] || "bed";
  }
  return "bed";
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
    if (needsBossQuest(state)) {
      const aBoss = a.enc.boss ? 1 : 0;
      const bBoss = b.enc.boss ? 1 : 0;
      if (bBoss !== aBoss) return bBoss - aBoss;
    }
    const aQuest = meetQuestTiles.has(a.tile.id) ? 1 : 0;
    const bQuest = meetQuestTiles.has(b.tile.id) ? 1 : 0;
    return bQuest - aQuest;
  });

  for (const { tile, enc, actor } of meets) {
    setActive(state, playerIndex(state, actor));
    state.selectedLandscapeId = tile.id;
    state.activeEncounter = enc;
    state.activeEncounterLandscapeId = tile.id;

    const cards = actor.hand
      .filter((c) => c.type !== "psyche-power")
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    let take = 0;
    let sum = 0;
    const target = enc.accept || encounterRejectCost(enc) || 8;
    for (const card of cards) {
      take += 1;
      sum += card.value || 0;
      if (sum >= target) break;
    }
    state.selectedHand = cards.slice(0, Math.max(take, Math.min(3, cards.length))).map((c) => c.instanceId);
    const played = meetPsychePlayTotal(state);
    const bonus = meetBonusBreakdown(state).total || 0;
    const total = played + bonus;
    const accept = enc.accept || 99;
    const reject = encounterRejectCost(enc);

    let mode = null;
    if (total >= accept) mode = "accept";
    else if (total >= reject) mode = skill === "skilled" ? "reject" : (chance(0.5) ? "reject" : null);
    else if (skill === "sloppy" && chance(0.25)) mode = "accept";

    if (!mode) continue;
    const need = mode === "accept" ? accept : reject;
    stackSpreadTokens(state, need, total);
    meetEncounter(state, mode);
    resolvePendings(state, skill);
    return true;
  }
  return false;
}

function tryMindstream(state, skill) {
  const quests = new Set(activeQuestLandscapeIds(state));
  const candidates = state.players
    .filter((p) => p.alive)
    .map((p) => ({ player: p, tile: landscapeById(state, p.landscapeId) }))
    .filter((x) => x.tile?.revealed && !x.tile.wasteland && x.tile.suit);

  if (!candidates.length) return false;
  const ordered = skill === "sloppy"
    ? candidates
    : [...candidates].sort((a, b) => Number(quests.has(b.tile.id)) - Number(quests.has(a.tile.id)));

  for (const { player, tile } of ordered) {
    const meetQuest = meetQuestLandscapeIds(state);
    const onMeetQuest = meetQuest.includes(tile.id);
    if (skill === "skilled" && quests.size && !quests.has(tile.id) && !onMeetQuest && !state.finalRecurrence && chance(0.35)) {
      continue;
    }
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

function tryFinalRecurrence(state, skill) {
  if (!state.finalRecurrence) return false;
  const remaining = (state.finalArchetypes || []).filter((a) => !a.defeated);
  if (!remaining.length) return false;
  if (skill !== "sloppy") handleSacrificeForFinal(state);

  for (const arch of remaining) {
    const tileId = state.board.find((t) => t.finalArchetype?.id === arch.id && !t.finalArchetype.defeated)?.id
      || arch.landscapeId;
    if (!tileId) continue;
    const actor = occupantOn(state, tileId);
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
      if (total >= 12 && picked.length >= 2) break;
      picked.push(item.card);
      total += item.card.value || 0;
    }
    state.selectedHand = picked.map((c) => c.instanceId);
    stackSpreadTokens(state, 12, total);
    const before = state.status;
    handleDefeatFinalArchetype(state);
    resolvePendings(state, skill);
    if (state.status !== before) return true;
  }
  return false;
}

function tryTakePower(state, skill) {
  const tiles = ["awards", "candy-mountain"]
    .map((id) => landscapeById(state, id))
    .filter((t) => t?.revealed && !t.wasteland);
  for (const tile of tiles) {
    const player = occupantOn(state, tile.id);
    if (!player) continue;
    if (skill !== "sloppy" && teamTokens(state) >= 4 && (player.powerTokens || 0) >= 2) continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = tile.id;
    const before = state.meetActionsUsed;
    performLandscapeAction(state, "take-power");
    resolvePendings(state, skill);
    if (state.meetActionsUsed > before) return true;
  }
  return false;
}

function tryBedPool(state, skill) {
  const campers = alivePlayers(state).filter((p) => p.landscapeId === "bed");
  if (!campers.length) return false;

  const ordered = [...campers].sort((a, b) => psycheHandCount(a) - psycheHandCount(b));
  for (const player of ordered) {
    const room = handLimitForPlayer(state, player) - psycheHandCount(player);
    if (room < 1 && skill !== "sloppy") continue;
    setActive(state, playerIndex(state, player));
    state.selectedLandscapeId = "bed";
    const before = state.meetActionsUsed;
    performLandscapeAction(state, "draw-3-psyche");
    resolvePendings(state, skill);
    if (state.meetActionsUsed > before) return true;
  }
  return false;
}

function tryMarkQuests(state, skill) {
  const arch = state.activeArchetype;
  if (!arch) return false;
  const ready = getQuestStatus(state, arch).filter((q) => q.ready);
  if (!ready.length) return false;
  let acted = false;
  for (const q of ready) {
    if (skill === "sloppy" && chance(0.35)) continue;
    const holder = [...alivePlayers(state)]
      .filter((p) => (p.powerTokens || 0) >= 1)
      .sort((a, b) => (b.powerTokens || 0) - (a.powerTokens || 0))[0];
    if (!holder) break;
    setActive(state, playerIndex(state, holder));
    if (handleQuestComplete(state, q.index)) {
      resolvePendings(state, skill);
      acted = true;
    }
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
  useTools(state, skill);
  if (skill !== "sloppy" || chance(0.8)) {
    if (openPhaseWithCardsOrToken(state, skill, "willpower")) {
      gainMeetActions(state);
    }
  }
  resolvePendings(state, skill);

  let actions = 0;
  while (state.meetActionBudget > 0 && state.meetActionsUsed < state.meetActionBudget && actions++ < 12) {
    const used = state.meetActionsUsed;
    useTools(state, skill);
    if (tryFinalRecurrence(state, skill)) continue;
    if (tryMeet(state, skill) && state.meetActionsUsed > used) continue;
    if ((skill !== "sloppy" || chance(0.55)) && (readyToExpedition(state, skill) || standingOnQuestWork(state)) && tryMindstream(state, skill)) continue;
    if (tryTakePower(state, skill)) continue;
    const pooling = !readyToExpedition(state, skill)
      || needsTenPsycheQuest(state)
      || alivePlayers(state).some((p) => p.landscapeId === "bed" && psycheHandCount(p) < POOL_LEAVE);
    if (pooling && !standingOnQuestWork(state) && tryBedPool(state, skill)) continue;
    if (tryBedPool(state, skill) && !standingOnQuestWork(state)) continue;
    break;
  }
  tryMeet(state, skill);
  useTools(state, skill);
  resolvePendings(state, skill);
  if (state.landscapePick) cancelLandscapePick(state);
  endPhase(state);
}

function lossReason(state) {
  if (state.status === "won") return "won";
  if (state.finalRecurrence) {
    const left = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
    if (state.dreamDeck.length === 0 && left > 0) return "final-recurrence-deck";
    return "final-recurrence-stalled";
  }
  if (state.dreamDeck.length === 0) return "dream-deck-empty";
  if (!alivePlayers(state).length) return "all-dead";
  if (state.status === "lost") return "lost";
  return "stalled";
}

function simulateGame({ lengthKey, skill, playerCount }) {
  const dreamers = [...gameData.dreamers].sort(() => rng() - 0.5).slice(0, playerCount);
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
      log: (state.log || []).slice(-40),
    });
  }

  return {
    status: state.status === "won" ? "won" : "lost",
    reason: lossReason(state),
    points: state.acquiredPoints || 0,
    goal: originalGoal,
    rounds: state.round,
    dreamsLeft: state.dreamDeck.length,
    deaths: state.players.reduce((s, p) => s + (p.deathCount || 0), 0),
    archetypes: state.players.reduce((s, p) => s + (p.acquiredArchetypes?.length || 0), 0),
    onBed: state.players.filter((p) => p.alive && p.landscapeId === "bed").length,
    alive: alivePlayers(state).length,
    finalRecurrence: !!state.finalRecurrence,
    lengthKey,
    skill,
  };
}

function summarize(rows) {
  const n = rows.length;
  const wins = rows.filter((r) => r.status === "won").length;
  const winRate = n ? wins / n : 0;
  const se = n ? Math.sqrt(winRate * (1 - winRate) / n) : 0;
  const reasons = {};
  rows.forEach((r) => { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
  const avg = (key) => rows.reduce((s, r) => s + r[key], 0) / n;
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
    avgDreamsLeft: +avg("dreamsLeft").toFixed(2),
    goalReachedButLost: rows.filter((r) => r.status === "lost" && r.points >= r.goal && r.goal > 0).length,
    finalRecurrenceGames: rows.filter((r) => r.finalRecurrence).length,
  };
}

const TARGET_GAMES = Number(process.env.SOMNIA_SIM_GAMES || 2000);
const SCALE = Number(process.env.SOMNIA_SIM_SCALE || 1);
const BASE_CELLS = [
  { lengthKey: "daydream", skill: "skilled", playerCount: 2, weight: 400 },
  { lengthKey: "nap", skill: "skilled", playerCount: 2, weight: 400 },
  { lengthKey: "deep", skill: "skilled", playerCount: 2, weight: 300 },
  { lengthKey: "daydream", skill: "sloppy", playerCount: 2, weight: 300 },
  { lengthKey: "nap", skill: "sloppy", playerCount: 2, weight: 300 },
  { lengthKey: "daydream", skill: "skilled", playerCount: 3, weight: 200 },
];
const weightTotal = BASE_CELLS.reduce((sum, cell) => sum + cell.weight, 0);
const CELLS = BASE_CELLS.map((cell) => ({
  ...cell,
  runs: Math.max(1, Math.round((cell.weight / weightTotal) * TARGET_GAMES * SCALE)),
}));

const started = Date.now();
const all = [];
const byCell = [];

for (const cell of CELLS) {
  const rows = [];
  for (let i = 0; i < cell.runs; i += 1) {
    try {
      rows.push(simulateGame(cell));
    } catch (err) {
      if (!globalThis.__somniaCrashLogged) {
        globalThis.__somniaCrashLogged = true;
        console.error("SIM CRASH:", err?.stack || err);
      }
      rows.push({
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
        finalRecurrence: false,
        lengthKey: cell.lengthKey,
        skill: cell.skill,
      });
    }
  }
  const summary = { ...cell, ...summarize(rows) };
  byCell.push(summary);
  all.push(...rows);
  console.log(
    `${cell.skill} ${cell.lengthKey} p${cell.playerCount}: ${summary.winPct}% (${summary.wins}/${summary.n}) 95% CI ${summary.ci95[0]}–${summary.ci95[1]} reasons=${JSON.stringify(summary.reasons)}`,
  );
}

const skilled = all.filter((r) => r.skill === "skilled");
const sloppy = all.filter((r) => r.skill === "sloppy");
const report = {
  generatedAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  totalGames: all.length,
  overall: summarize(all),
  skilled: summarize(skilled),
  sloppy: summarize(sloppy),
  cells: byCell,
};

const out = join(__dirname, "somnia-winrate-report.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nWrote ${out}`);
console.log(`Total ${report.totalGames} games in ${(report.elapsedMs / 1000).toFixed(1)}s`);
console.log(`Skilled win rate: ${report.skilled.winPct}%`);
console.log(`Sloppy win rate: ${report.sloppy.winPct}%`);
