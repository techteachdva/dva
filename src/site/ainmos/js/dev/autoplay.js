/**
 * Ainmos autoplay: the smart bot's whole policy, shared by the Node bot sim
 * (scripts/ainmos-bot-sim.mjs) and the browser (gameplay recordings, dev).
 *
 * stepAutoplay(state) takes one bot step and returns what it did. In the
 * browser a dice battle animates, so callers wait while isDiceBattleOpen().
 * configureAutoplay({ dumb, endless }) sets the sim's knobs.
 */
import * as stateMod from "../core/state.js";
import * as gameMod from "../core/game.js";
import * as rulesMod from "../core/rules.js";
import * as botMod from "./bot-ai.js";
import * as mindstreamChoices from "../cards/mindstream-choices.js";
import * as mindstreamSupply from "../cards/mindstream-supply.js";
import * as dreambeasts from "../encounters/dreambeasts.js";
import * as psycheMod from "../cards/psyche.js";
import * as subconscious from "../dreamers/subconscious.js";
import * as landscapesMod from "../board/landscapes.js";
import * as hexMod from "../core/hex.js";
import * as questsMod from "../dreamers/quests.js";
import * as finalMod from "../dreamers/final-recurrence-rules.js";
import * as objectEffects from "../effects/object-effects.js";
import * as objectsMod from "../effects/objects.js";
import * as effectChoices from "../effects/effect-choices.js";
import * as dreamChoices from "../cards/dream-choices.js";
import * as dreamReplay from "../cards/dream-replay.js";
import * as dreamerPowers from "../dreamers/dreamer-powers.js";
import * as boardFx from "../board/board-fx.js";
import * as policy from "./bot-policy.js";
import * as meetPhase from "../encounters/meet-phase.js";
import * as vaultMod from "../board/dreamscape-vault.js";
import * as archBoard from "../dreamers/archetype-board.js";
import * as archCall from "../dreamers/archetype-call.js";
import * as endlessMod from "../encounters/endless.js";
import * as cycleMod from "../core/cycle.js";
import * as formsMod from "../cards/dream-forms.js";
import * as shopMod from "../shop/lost-found.js";
import * as boonMod from "../dreamers/boons.js";
import { random } from "../core/rng.js";

const { landscapeById, checkVictory } = stateMod;
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
const { isFreeformBoard, vaultCards, placementSlots } = vaultMod;

/** Sim knobs: AINMOS_BOT=dumb plays carelessly; AINMOS_ENDLESS keeps playing after a win. */
let DUMB = false;
let ENDLESS = false;
export function configureAutoplay({ dumb = false, endless = false } = {}) {
  DUMB = !!dumb;
  ENDLESS = !!endless;
}
// The careless bot's coin flips use the seeded RNG so a seed replays the same night.
const pickRandom = (list) => list[Math.floor(random() * list.length)];

function placeFromVault(state) {
  if (!pendingPlacementCard(state)) {
    const cards = vaultCards(state);
    if (!cards.length) return false;
    const homes = new Set([
      ...archBoard.boardArchetypes(state).flatMap(({ arch }) => arch.landscapes || []),
      ...(state.archetypeDeck || []).slice(0, 3).flatMap((arch) => arch.landscapes || []),
    ]);
    let index = cards.findIndex((c) => homes.has(c.id));
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


let helpers = null;
function effectHelpers() {
  if (!helpers) helpers = getEffectHelpers();
  return helpers;
}

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
/** Ainmos shopping: the richest hand buys Form Objects, Insights, and Remember taps, keeping a cushion. */
function shopTurn(state) {
  if (DUMB) return;
  const shop = state.lostFound;
  const buyer = [...alive(state)].sort((a, b) => handCount(b) - handCount(a))[0];
  if (!shop?.open || !buyer) return;
  shopMod.setLostFoundBuyer(state, buyer.id);
  const give = (s, p, card) => objectsMod.onObjectDrawn(s, p, card, getEffectHelpers());
  const stats = (state.botShop = state.botShop || { bought: 0, insights: 0 });
  for (let guard = 0; guard < 4; guard += 1) {
    // Glimmer that covers a whole price is free money: spend it even on a thin hand.
    const covered = shop.objects.findIndex((o) => (o.levelsForm || o.remember)
      && (state.glimmer || 0) >= shopMod.objectPrice(o) && !shopMod.objectBlockReason(state, buyer, o));
    if (covered >= 0) {
      const res = shopMod.buyLostFoundObject(state, covered, give);
      if (res.ok) { stats.bought += 1; stats.glimmerBuys = (stats.glimmerBuys || 0) + 1; if (res.card?.levelsForm) { focus(state, buyer); playObject(state, res.card.instanceId); } continue; }
    }
    if (handCount(buyer) < 7) break;
    const formIndex = shop.objects.findIndex((o) => o.levelsForm && !shopMod.objectBlockReason(state, buyer, o));
    const rememberIndex = handCount(buyer) >= 8
      ? shop.objects.findIndex((o) => o.remember && !shopMod.objectBlockReason(state, buyer, o))
      : -1;
    const index = formIndex >= 0 ? formIndex : rememberIndex;
    if (index < 0) break;
    const result = shopMod.buyLostFoundObject(state, index, give);
    if (!result.ok) break;
    stats.bought += 1;
    if (result.card?.levelsForm) {
      focus(state, buyer);
      playObject(state, result.card.instanceId);
    }
  }
  const insight = shop.insight;
  if (insight && handCount(buyer) >= 8) {
    if (insight.kind === "form") {
      if (shopMod.buyLostFoundInsight(state).ok) stats.insights += 1;
    } else {
      const target = shopMod.upgradeTargets(state, buyer).sort((a, b) => (b.value || 0) - (a.value || 0))[0];
      if (target && shopMod.buyLostFoundInsight(state, { targetId: target.instanceId }).ok) stats.insights += 1;
    }
  }
}

/** Boon taste: stat passives first, then card draw, then Form study. */
function pickBoon(options) {
  const rank = (boon) => {
    const id = boon.archetype?.id || boon.id;
    if (["sage", "magician", "warrior"].includes(id)) return 10;
    if (["orphan", "caregiver"].includes(id)) return 8;
    if (["innocent", "fool", "study"].includes(id)) return 7;
    if (id === "wider-vault") return 5;
    if (id === "deep-pockets") return 3;
    return 4;
  };
  return [...options].sort((a, b) => rank(b) - rank(a))[0].id;
}

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

/** Ainmos solo: a standing beast bleeds the Waking Mind every dusk, so hunt the nearest one first. */
function huntTarget(state, player) {
  const here = landscapeById(state, player.landscapeId);
  if (!here || psycheCards(player).length < 2) return null;
  const tiles = state.board.filter((tile) => tile.revealed && !tile.wasteland && beastsOn(tile).length);
  return tiles.length ? closest(here, tiles).id : null;
}

function archetypeTarget(state, player) {
  const here = landscapeById(state, player.landscapeId);
  if (!here || psycheCards(player).length < 3) return null;
  const list = archBoard.boardArchetypes(state);
  if (!list.length) return null;
  return list.map((e) => e.tile).sort((a, b) => hexDistance(a, here) - hexDistance(b, here))[0].id;
}

function destination(state, player) {
  const here = landscapeById(state, player.landscapeId);
  if (DUMB) {
    const open = state.board.filter((t) => t.revealed && !t.wasteland);
    return (pickRandom(open) || here)?.id || player.landscapeId;
  }
  const chase = archetypeTarget(state, player);
  if (chase) return chase;
  const hunt = huntTarget(state, player);
  if (hunt) return hunt;
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
  const ok = resolveMindstreamChoice(state, choiceId, effectHelpers());
  if (!ok && state.pendingMindstreamChoice) {
    const fallback = (state.pendingMindstreamChoice.choices || [])
      .map((c) => c.id)
      .find((id) => id === "bad" || id === "flee" || id === "discard" || id === "repress" || id === "take");
    if (fallback && fallback !== choiceId) resolveMindstreamChoice(state, fallback, effectHelpers());
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
      resolveDreamChoice(state, next.instanceId, effectHelpers());
      return;
    }
  }
  resolveDreamChoice(state, "confirm", effectHelpers());
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
      resolveObjectChoice(state, next.instanceId, effectHelpers());
      return;
    }
    resolveObjectChoice(state, "confirm", effectHelpers());
    return;
  }
  if (pending.ui === "reorder") {
    const next = (pending.top || []).find((c) => !(pending.order || []).some((picked) => (picked.instanceId || picked.id) === (c.instanceId || c.id)));
    if (next) resolveObjectChoice(state, next.instanceId || next.id, effectHelpers());
    else resolveObjectChoice(state, "done", effectHelpers());
    return;
  }
  const enabled = (pending.choices || []).filter((c) => !c.disabled);
  const id = enabled[0]?.id || (pending.cards || [])[0]?.instanceId || (pending.archetypes || [])[0]?.id;
  if (id) resolveObjectChoice(state, id, effectHelpers());
  else state.pendingObjectChoice = null;
}

/** Choose the offered Archetype whose placed home is nearest; otherwise the first. */
function pickArchetype(state) {
  const options = archBoard.archetypeChoiceOptions(state).filter((arch) => archBoard.archetypeHomeTiles(state, arch).length);
  if (!options.length) return null;
  if (DUMB) return pickRandom(options);
  const me = alive(state)[0];
  const here = me ? landscapeById(state, me.landscapeId) : null;
  const score = (arch) => {
    const homes = archBoard.archetypeHomeTiles(state, arch);
    if (!homes.length) return 50;
    return Math.min(...homes.map((t) => (here ? hexDistance(t, here) : 0)));
  };
  return [...options].sort((x, y) => score(x) - score(y))[0];
}

/** Best spread against an Archetype: within the cap, meeting the Form rule, most dice. */
function bestArchetypeSpread(state, player, arch) {
  const rules = archBoard.fightRules(state);
  let best = null;
  for (const combo of combinations(psycheCards(player), rules.cap)) {
    if (archBoard.formRuleProblem(combo, rules.formNeed)) continue;
    const dice = archetypeFightDice(state, player, combo, arch);
    if (DUMB) return { combo, dice, value: 0 };
    const value = combo.reduce((s, c) => s + (Number(c.value) || 0), 0);
    if (!best || dice > best.dice || (dice === best.dice && value < best.value)) best = { combo, dice, value };
  }
  return best;
}

function tryArchetype(state, player) {
  if (!player) return false;
  const tile = landscapeById(state, player.landscapeId);
  const here = archBoard.archetypesOnTile(state, tile?.id);
  if (!here.length) return false;
  const arch = here[0];
  focus(state, player);
  state.selectedLandscapeId = tile.id;
  if (state.archetypeFight?.archId === arch.id) {
    const spread = bestArchetypeSpread(state, player, arch);
    if (!spread) {
      state.archetypeFight = null;
      return false;
    }
    state.selectedHand = spread.combo.map((c) => c.instanceId);
    const gap = archBoard.fightRules(state).power - spread.dice;
    if (gap > 0) addTokenDice(state, player, Math.min(3, gap));
    const ok = fightArchetype(state, arch.id);
    if (!ok) state.archetypeFight = null;
    state.botArch = state.botArch || { fights: 0, wins: 0 };
    state.botArch.fights += 1;
    return true;
  }
  if (state.archetypeFight) return false;
  // Only open the Meet with a hand that can make a Form.
  if (!bestArchetypeSpread(state, player, arch)) return false;
  return faceArchetype(state, arch.id);
}

function resolveOnePending(state) {
  if (state.pendingArchetypeChoice) {
    const pick = pickArchetype(state);
    if (pick) archBoard.chooseArchetype(state, pick.id);
    else if (!archCall.searchForArchetypeHome(state, alive(state)[0])) state.pendingArchetypeChoice = null;
    return true;
  }
  if (state.pendingMindstreamChoice?.kind === "archetype-event") {
    const good = state.pendingMindstreamChoice.choices.find((c) => c.id === "good" && !c.disabled);
    const me = state.players.find((p) => p.id === state.pendingMindstreamChoice.playerId);
    const keep = me ? psycheCards(me).length : 0;
    resolveMindstreamChoice(state, !DUMB && good && keep >= 4 ? "good" : "bad", effectHelpers());
    return true;
  }
  if (state.beastsToReturn?.length && !state.landscapePick) {
    landscapesMod.placeReturnedBeasts(state);
    return true;
  }
  if (state.pendingMindstreamChoice) {
    resolveMindstream(state);
    return true;
  }
  if (state.pendingDreamReplay) {
    const card = dreamReplayOptions(state)[0];
    if (card) replayChosenDream(state, card, effectHelpers());
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
    resumeObjectEffect(state, effectHelpers());
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
      resolveDreamChoice(state, choices[0]?.id || "confirm", effectHelpers());
      advanceDreamQueue(state);
    }
    return true;
  }
  if (state.pendingEffectChoice) {
    const remember = pickRememberChoice(state, state.pendingEffectChoice);
    const choices = (state.pendingEffectChoice.choices || []).filter((c) => !c.disabled);
    resolveEffectChoice(state, remember || choices[0]?.id || "confirm", effectHelpers());
    return true;
  }
  if (state.pendingDreamerPower) {
    const ui = state.pendingDreamerPower.ui;
    if (ui?.type === "choice" && ui.choices?.length) {
      // Lure pulls beasts in to fight; Reweave stops after one low card.
      const pick = ui.choices.find((c) => c.id === "lure-toward" || c.id === "reweave-draw") || ui.choices[0];
      resolveDreamerPowerChoice(state, pick.id);
    } else if (ui?.type === "hand" && ui.cards?.length) {
      const low = [...ui.cards].sort((a, b) => (a.value || 0) - (b.value || 0))[0];
      resolveDreamerPowerHandPick(state, low.instanceId);
    } else state.pendingDreamerPower = null;
    return true;
  }
  return false;
}

function usefulLandscapeAction(state, player) {
  const tile = landscapeById(state, player.landscapeId);
  if (!tile || tile.wasteland || !tile.revealed) return null;
  const usedMine = new Set(state.usedMeetActionsByPlayer?.[player.id] || []);
  if (tile.uniqueAction === "lure-archetype" && !usedMine.has("landscape:lure-archetype")
    && archBoard.boardArchetypes(state).some(({ tile: at }) => at.id !== tile.id)) return "lure-archetype";
  // 42.0: The Bed no longer draws 3. It Dreams Onward: Reveal or place 1 Landscape.
  if (tile.id === "bed" && revealCapacity(state) > 0 && !usedMine.has("landscape:dream-onward")) {
    return "dream-onward";
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

/** 0.26: how many Actions this phase is worth to the bot. */
function wantedActions(state, me, phase) {
  if (phase === "Reveal") return Math.min(revealCapacity(state), 3);
  if (phase === "Explore") {
    const here = landscapeById(state, me.landscapeId);
    const goal = landscapeById(state, destination(state, me));
    return here && goal ? hexDistance(here, goal) : 0;
  }
  const tile = landscapeById(state, me.landscapeId);
  const busy = beastsOn(tile).length || archBoard.boardArchetypes(state).some((e) => e.tile.id === tile?.id);
  return busy ? 2 : 1;
}

/**
 * 0.26: your stat is free base Actions. The bot spends 1 suited Psyche on top only when the
 * free Actions fall short of what it wants and its hand can afford it; otherwise it opens free.
 * Returns false when there is nothing to open with (stat 0 and no spend): the phase is skipped.
 */
function openPhase(state, phase) {
  const me = alive(state)[0];
  if (!me) return false;
  const base = rulesMod.phaseBaseActions(state, me, phase);
  const want = wantedActions(state, me, phase);
  const hand = psycheCards(me).length;
  const spend = DUMB
    ? random() < 0.5
    : (base < want && hand >= 5) || (base < 1 && want > 0 && hand >= 3);
  if (spend) {
    const open = botSelectOpener(state, "skilled");
    if (open && (open.via !== "token" || base < 1)) return true;
  }
  state.selectedHand = [];
  state.phaseTokenAsPsyche = null;
  return base >= 1;
}

/**
 * 0.26.1 Dreamer Powers (1 Power Token, in the phase of the Dreamer's best stat).
 * The bot keeps a token or two for fight dice and spends the rest where it helps.
 */
function tryDreamerPower(state) {
  if (DUMB) return false;
  const me = alive(state)[0];
  if (!me || state.pendingDreamerPower || !dreamerPowers.canActivateDreamerPower(state, me)) return false;
  const tokens = me.powerTokens || 0;
  const id = me.dreamer?.id;
  const phase = getPhase(state);
  const here = landscapeById(state, me.landscapeId);
  let want = false;
  if (id === "the-visionary") want = tokens >= 3 && state.landscapePick?.mode === "reveal" && revealCapacity(state) > 0;
  else if (id === "the-rested") want = tokens >= 2 && psycheCards(me).length <= 5 && !!state.landscapePick && state.landscapePick.mode === "reveal" && (state.landscapePick.remaining || 0) >= 2;
  else if (id === "the-runner") {
    const goal = landscapeById(state, destination(state, me));
    want = tokens >= 2 && goal && here && hexDistance(here, goal) > (state.exploreMovesLeft || 0);
  } else if (id === "the-hunter") {
    want = tokens >= 3 && psycheCards(me).length >= 4 && phase === "Explore"
      && stateMod.allEncountersOnBoard(state).some(({ tile }) => tile.id !== here?.id && hexDistance(tile, here) <= 2);
  } else if (id === "the-immovable") {
    const fightHere = beastsOn(here).length || archBoard.archetypesOnTile(state, here?.id).length;
    want = tokens >= 2 && fightHere && !(state.anchorMeetSpreadBonus > 0) && (state.meetActionsUsed || 0) < (state.meetActionBudget || 0);
  } else if (id === "the-weaver") {
    const ones = psycheCards(me).filter((c) => (c.value || 0) <= 1).length;
    want = tokens >= 3 && ones >= 1 && psycheCards(me).length >= 3;
  }
  if (!want) return false;
  gameMod.useDreamerPower(state);
  return true;
}

function act(state) {
  // Ainmos: the bot leaves the Lost & Found without shopping (shopping policy comes later).
  if (state.lostFound?.open) {
    shopMod.closeLostFound(state);
    return true;
  }
  focusBestDream(state);
  if (placeRememberObjects(state)) return true;
  if (trySacrifice(state)) return true;
  const phase = getPhase(state);
  if (phase === "Reveal") {
    if (!state.dreamDrawn) {
      drawDreamCard(state);
      return true;
    }
    // As in the game: the Dream took the last Psyche, so the Dreamer dies and respawns now.
    if (stateMod.dieIfHandEmptyAfterDream(state)) return true;
    if (tryDreamerPower(state)) return true;
    if (state.landscapePick) return false;
    if (state.revealLandscapeUsed) return false;
    if (!openPhase(state, "Reveal")) return false;
    revealLandscape(state);
    // Reveal powers go right after opening, before any Landscape is placed.
    tryDreamerPower(state);
    return true;
  }
  if (phase === "Explore") {
    if (!state.exploreActivated) {
      if (!phaseOpeningActive(state)) return false;
      if (!openPhase(state, "Explore")) return false;
      activateExplore(state);
      return true;
    }
    if (tryDreamerPower(state)) return true;
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
      if (!openPhase(state, "Meet")) return false;
      gainMeetActions(state);
      return true;
    }
    if ((state.meetActionsUsed || 0) >= state.meetActionBudget) return false;
    if (tryDreamerPower(state)) return true;
    const who = holder(state);
    const tile = landscapeById(state, who?.landscapeId);
    if (tryArchetype(state, who)) return true;
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

const STUCK_LIMIT = 14;

/**
 * One step of the bot, exactly as the sim's game loop runs it: acquire when
 * ready, shop and leave the Lost & Found, draft a Boon, resolve one pending
 * choice, act, or end the phase. Returns a short label of what happened.
 * `memo` carries the stuck detector between calls.
 */
export function stepAutoplay(state, memo = {}) {
  if (state.status !== "playing") return "over";
  if (state.log?.length > 80) state.log.splice(0, state.log.length - 40);
  let did = "";
  if (tryAcquire(state)) did = "acquire";
  if (state.status !== "playing") return did || "over";
  if (state.lostFound?.open && !state.pendingEffectChoice) {
    shopTurn(state);
    shopMod.closeLostFound(state);
    did = did || "shop";
  }
  if (state.pendingBoonDraft) {
    boonMod.chooseBoon(state, pickBoon(state.pendingBoonDraft.options));
    did = did || "boon";
  }
  const phaseBefore = `${state.round}:${state.phaseIndex}`;
  const pending = resolveOnePending(state);
  if (state.status !== "playing") return did || "over";
  if (pending) did = did || "pending";
  else if (act(state)) did = did || "act";
  else if (state.status === "playing" && !state.landscapePick && !state.pendingMindstreamChoice && !state.pendingDreamChoice) {
    endPhase(state);
    did = did || "endPhase";
  }
  if (state.status !== "playing") return did || "over";
  checkVictory(state);
  const sig = signature(state);
  if (sig === memo.prev) memo.stuck = (memo.stuck || 0) + 1;
  else {
    memo.stuck = 0;
    memo.prev = sig;
  }
  if (memo.stuck >= STUCK_LIMIT) {
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
    memo.stuck = 0;
    memo.prev = "";
    did = "unstick";
  }
  if (`${state.round}:${state.phaseIndex}` !== phaseBefore && did === "act") did = "act";
  return did || "idle";
}

export {
  act,
  resolveOnePending,
  signature,
  tryAcquire,
  shopTurn,
  pickBoon,
  subPsyche,
  alive,
  beastsOn,
  placeFromVault,
  wantedActions,
  openPhase,
};
