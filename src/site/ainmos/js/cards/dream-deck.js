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

/** Bosses land on a random placed Landscape (never Wasteland); The Bed only when it stands alone. */
function bossLandingTile(state) {
  const open = (state.board || []).filter((tile) => tile.revealed && !tile.wasteland && !tile.center && tile.id !== "bed");
  if (!open.length) return (state.board || []).find((tile) => tile.center || tile.id === "bed") || null;
  return open[Math.floor(random() * open.length)];
}

/**
 * The Ante's second Dream brings its Mini-Boss to The Bed, once, whether the
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
  // The round a Boss arrives closes its Ante; dawn follows next round.
  state.bossArrivedThisRound = true;
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
  const tile = bossLandingTile(state);
  if (!tile) return false;
  setEncounterOnLandscape(state, tile.id, encounter);
  logMoment(state, `Boss: ${card.name} awakens on ${tile.name}!${card.twistText ? ` ${card.twist}: ${card.twistText}` : ""}`, { boss: true });
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
  if (fromTop) {
    const index = deck.findIndex((card) => !isBossDreamCard(card));
    return index >= 0 ? deck.splice(index, 1)[0] : null;
  }
  for (let i = deck.length - 1; i >= 0; i -= 1) {
    if (!isBossDreamCard(deck[i])) return deck.splice(i, 1)[0];
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
