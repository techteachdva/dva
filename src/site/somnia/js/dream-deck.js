/** Dream deck draw/discard — boss Dreambeasts always spawn instead of vanishing. */

import { uid } from "./data.js";
import {
  addLog,
  allEncountersOnBoard,
  checkDefeat,
  consumeRevealedTop,
  setEncounterOnLandscape,
} from "./state.js";
import { logMoment } from "./narrator.js";
import { markDreamFeedNudge } from "./fx.js";
import { queueBossStingerFx } from "./board-fx.js";
import { repressCard, normalizeSubconscious } from "./subconscious.js";

const BOSS_IDS = new Set(["cerberus", "double", "leviathan"]);

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

export function spawnBossEncounterOnBed(state, card) {
  if (!isBossDreamCard(card)) return false;
  if (bossAlreadyOnBoard(state, card)) {
    addLog(state, `${card.name} is already in the Dreamscape.`);
    return true;
  }
  const encounter = {
    ...card,
    type: "dreambeast",
    boss: true,
    instanceId: uid("enc"),
  };
  setEncounterOnLandscape(state, "bed", encounter);
  logMoment(state, `${card.name} awakens on The Bed!`, { boss: true });
  markDreamFeedNudge();
  queueBossStingerFx(card.id, "bed");
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
  pushDreamDiscard(state, card);
}

export function takeDreamFromDeck(state) {
  const card = state.dreamDeck?.shift();
  if (!card) return null;
  consumeRevealedTop(state, "dream");
  return card;
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
  const pile = state.dreamDiscard || [];
  const kept = [];
  const moved = [];
  pile.forEach((card) => {
    if (!isBossDreamCard(card) || bossAlreadyOnBoard(state, card)) {
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
