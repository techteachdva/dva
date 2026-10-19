import { tellArrival } from "../meta/chronicle.js";
import { BOSS_LADDER } from "../encounters/boss-ladder.js";
/** Dream deck draw/discard — boss Dreambeasts always spawn instead of vanishing. */

import { uid } from "../core/data.js";
import { random } from "../core/rng.js";
import {
  addLog,
  allEncountersOnBoard,
  checkDefeat,
  consumeRevealedTop,
  removeEncounterFromLandscape,
  setEncounterOnLandscape,
} from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { markDreamFeedNudge } from "../ui/fx.js";
import { queueBossStingerFx } from "../board/board-fx.js";
import { repressCard, normalizeSubconscious, listSubconsciousCards } from "../dreamers/subconscious.js";
import { spawnTopArchetype } from "../dreamers/archetype-board.js";

/** Ainmos: every rung of the Boss ladder is a Boss. */
const BOSS_IDS = new Set(BOSS_LADDER.map((entry) => entry.id));

export function isBossDreamCard(card) {
  if (!card) return false;
  return !!(card.boss || card.type === "boss-dream" || BOSS_IDS.has(card.id));
}

export function isDreambeastLike(card) {
  if (!card) return false;
  return (
    card.type === "dreambeast"
    || card.type === "boss-dream"
    || card.type === "psyche-dreambeast"
    || card.boss
    || card.isDreambeastPsyche
    || BOSS_IDS.has(card.id)
  );
}

export function bossAlreadyOnBoard(state, card) {
  if (!card) return false;
  return allEncountersOnBoard(state).some(({ encounter }) => (
    encounter.id === card.id
    || encounter.refId === card.id
  ));
}

/** Keep one token per boss id. Judgement used to stack extras onto Bed. */
export function collapseDuplicateBosses(state) {
  const seen = new Set();
  allEncountersOnBoard(state).forEach(({ tile, encounter }) => {
    const id = encounter?.refId || encounter?.id;
    if (!BOSS_IDS.has(id)) return;
    if (seen.has(id)) {
      removeEncounterFromLandscape(state, tile.id, encounter);
      return;
    }
    seen.add(id);
  });
}

/** A Cycle's Dreambeast lands on a random placed Landscape of its suit; The Bed when none is placed. */
function bossLandingTile(state, card = null) {
  const open = (state.board || []).filter((tile) => tile.revealed && !tile.wasteland && !tile.center && tile.id !== "bed");
  const suited = card?.suit ? open.filter((tile) => tile.suit === card.suit) : [];
  if (!suited.length) return (state.board || []).find((tile) => tile.center || tile.id === "bed") || null;
  return suited[Math.floor(random() * suited.length)];
}

/**
 * The Cycle's second Dream brings its Mini-Boss to The Bed, once, whether the
 * Dream is drawn or eaten.
 */
export function spawnMiniBoss(state, dream) {
  const mini = dream?.miniBoss;
  if (!mini || dream.miniSpawned) return false;
  dream.miniSpawned = true;
  setEncounterOnLandscape(state, "bed", { ...mini, instanceId: mini.instanceId || uid("mini") });
  logMoment(state, `Mini-Boss: ${mini.name} (Power ${mini.accept}) rises on The Bed.`, { boss: true });
  markDreamFeedNudge();
  queueBossStingerFx(mini.id, "bed");
  return true;
}

export function spawnBossEncounterOnBed(state, card) {
  if (!isBossDreamCard(card)) return false;
  const existing = allEncountersOnBoard(state).find(({ encounter }) => (
    encounter.id === card.id || encounter.refId === card.id
  ));
  if (existing?.encounter) {
    existing.encounter.awake = true;
    const where = existing.tile?.name || "the Dreamscape";
    addLog(state, `${card.name} is already on ${where}.`);
    return true;
  }
  const encounter = {
    ...card,
    type: "dreambeast",
    boss: true,
    awake: card.id === "leviathan" || card.refId === "leviathan" ? true : card.awake,
    instanceId: card.instanceId || uid("enc"),
  };
  const tile = bossLandingTile(state, card);
  if (!tile) return false;
  const placed = setEncounterOnLandscape(state, tile.id, encounter) || encounter;
  if (!state.tutorialMode) tellArrival(state, placed, tile);
  logMoment(state, `Dreambeast: ${card.name} (Power ${placed.accept}) lands on ${tile.name}!${card.twistText ? ` ${card.twist}: ${card.twistText}` : ""}`, { boss: true });
  markDreamFeedNudge();
  queueBossStingerFx(card.id, tile.id);
  return true;
}

function pushDreamDiscard(state, card) {
  if (!state.dreamDiscard) state.dreamDiscard = [];
  state.dreamDiscard.push(card);
}

/** Any time a Dream leaves the deck, bosses spawn on The Bed instead of dying in discard. */
export function discardDreamCard(state, card) {
  if (!card) return;
  // An Archetype Dream is never lost: if an effect eats it, the top Archetype appears anyway.
  if (card.type === "archetype-dream") {
    state.bossArrivedThisRound = true;
    spawnTopArchetype(state);
    pushDreamDiscard(state, card);
    return;
  }
  if (isBossDreamCard(card)) {
    spawnBossEncounterOnBed(state, card);
    pushDreamDiscard(state, card);
    return;
  }
  spawnMiniBoss(state, card);
  pushDreamDiscard(state, card);
}

export function takeDreamFromDeck(state) {
  const card = state.dreamDeck?.shift();
  if (!card) return null;
  consumeRevealedTop(state, "dream");
  return card;
}

/**
 * Effects that throw away "the bottom Dream" take the last ordinary Dream instead,
 * so they never drag the night's Boss forward early.
 */
export function popDiscardableDream(state, { fromTop = false } = {}) {
  const deck = state.dreamDeck || [];
  const ordinary = (card) => !isBossDreamCard(card) && card.type !== "archetype-dream";
  if (fromTop) {
    const index = deck.findIndex(ordinary);
    return index >= 0 ? deck.splice(index, 1)[0] : null;
  }
  for (let i = deck.length - 1; i >= 0; i -= 1) {
    if (ordinary(deck[i])) return deck.splice(i, 1)[0];
  }
  return null;
}

export function discardDreamsFromDeck(state, count) {
  let discarded = 0;
  for (let i = 0; i < count; i += 1) {
    const card = takeDreamFromDeck(state);
    if (!card) break;
    discardDreamCard(state, card);
    discarded += 1;
  }
  if (discarded > 0) checkDefeat(state);
  return discarded;
}

/**
 * Fix saves where a boss was dumped into Dream Discard without spawning.
 * Unspawned bosses move to Subconscious so Silver can pick them.
 */
export function repairMisplacedBossDreams(state) {
  if (!state) return [];
  state.subconscious = normalizeSubconscious(state.subconscious);
  collapseDuplicateBosses(state);
  const pile = (state.dreamDiscard || []).filter(Boolean);
  const kept = [];
  const moved = [];
  pile.forEach((card) => {
    const asleepLeviathan = (card.id === "leviathan" || card.refId === "leviathan")
      && listSubconsciousCards(state).some((c) => c.id === "leviathan" || c.refId === "leviathan");
    if (!isBossDreamCard(card) || bossAlreadyOnBoard(state, card) || asleepLeviathan) {
      kept.push(card);
      return;
    }
    repressCard(state, { ...card, type: "dreambeast", boss: true });
    moved.push(card.name || card.id);
  });
  state.dreamDiscard = kept;
  if (moved.length) {
    addLog(state, `Restored ${moved.join(", ")} to the Subconscious (bosses cannot die in the Dream Discard).`);
  }
  return moved;
}
