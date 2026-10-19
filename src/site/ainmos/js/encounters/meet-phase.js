import { tellDusk } from "../meta/chronicle.js";
import { applyBossTwistsAtMeetStart, applyBossTwistsAtDusk, applyBeastTwistsAtDusk, bossSkipsStep } from "./boss-twists.js";
import { twistDuskMill } from "./beast-twists.js";
import { discardDreamCard, popDiscardableDream } from "../cards/dream-deck.js";
import { forgetTile } from "../board/landscapes.js";
import { BOSS_LADDER } from "./boss-ladder.js";
/**
 * Canonical Meet Phase flow (Ainmos 26+) — one source of truth.
 *
 * 1) Start of Meet — each Boss steps 1 hex toward the nearest Dreamer, unless
 *    a Dreamer already shares its hex. There is no hand tax.
 * 2) Middle of Meet — one Dreamer may spend 1 Willpower Psyche to unlock
 *    shared Meet Actions. Accept a Dreambeast with 1–3 Psyche of any suit by
 *    beating its Power (its Ward blunts one Dream Form).
 * 3) End of the round — Repress 1 card from the Psyche Deck per Dreambeast
 *    still on the board. During the Final Recurrence, count remaining
 *    Archetypes instead. Fail only when Accept loses.
 */
import {
  addLog,
  allEncountersOnBoard,
  countEncountersOnBoard,
  landscapeById,
  moveEncounterBetweenLandscapes,
  repressTopPsycheFromDeck,
  longNightToll,
} from "../core/state.js";
import { adjacentTiles, hexDistance } from "../core/hex.js";
import { logMoment } from "../core/narrator.js";

export const MEET_PHASE_FLOW = Object.freeze({
  start: "Bosses step toward the nearest Dreamer. No cards are taxed from hands.",
  middle: "Spend 1 Willpower Psyche for shared Meet Actions. Accept a Dreambeast by beating its Power. Roaming beasts stay until won.",
  end: "Dusk: Repress 2 Psyche from the Waking Mind per Dreambeast still on the board. In the Final Recurrence, count remaining Archetypes.",
});

export function countActiveDreambeasts(state) {
  return countEncountersOnBoard(
    state,
    (enc) => enc.type === "dreambeast" || enc.boss || enc.type === "boss-dream",
  );
}

export function roamingDreambeastsInSpawnOrder(state) {
  return allEncountersOnBoard(state)
    .filter(({ encounter }) => (
      encounter.type === "dreambeast" || encounter.boss || encounter.type === "boss-dream"
    ))
    .sort((a, b) => {
      const ao = a.encounter.spawnOrder ?? Number.MAX_SAFE_INTEGER;
      const bo = b.encounter.spawnOrder ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a.encounter.instanceId || a.encounter.id)
        .localeCompare(String(b.encounter.instanceId || b.encounter.id));
    });
}

function isRoamingBeast(enc) {
  return enc && (enc.type === "dreambeast" || enc.boss || enc.type === "boss-dream");
}

export function stampEncounterSpawnOrder(state, encounter) {
  if (!encounter || encounter.spawnOrder != null) return encounter;
  state.encounterSpawnSeq = (state.encounterSpawnSeq || 0) + 1;
  encounter.spawnOrder = state.encounterSpawnSeq;
  return encounter;
}

const BOSS_IDS = new Set(BOSS_LADDER.map((entry) => entry.id));

function isBossEncounter(encounter) {
  if (!encounter) return false;
  const id = encounter.refId || encounter.id;
  return !!(encounter.boss || encounter.type === "boss-dream" || BOSS_IDS.has(id));
}

function dreamerSharesTile(state, tileId) {
  return (state.players || []).some((player) => player.alive && player.landscapeId === tileId);
}

function nearestDreamerTile(state, fromTile) {
  let nearest = null;
  let nearestDist = Infinity;
  (state.players || []).forEach((player) => {
    if (!player.alive) return;
    const tile = landscapeById(state, player.landscapeId);
    if (!tile) return;
    const dist = hexDistance(fromTile, tile);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = tile;
    }
  });
  return nearest;
}

/**
 * Ainmos: every Dreambeast chases you at the start of Explore, one hex toward
 * the nearest Dreamer. A beast already on your hex stays; a sleeping Leviathan
 * and Bosses whose twist moves them their own way do not step.
 */
export function stepBeastsTowardDreamers(state, { force = false } = {}) {
  if (state.tutorialMode) return 0;
  if (!force && state.hideFromBeasts) {
    state.hideFromBeasts = false;
    addLog(state, "You stay hidden. The Dreambeasts lose your trail this Explore.");
    return 0;
  }
  let moved = 0;
  const beasts = allEncountersOnBoard(state).filter(({ encounter }) => (
    encounter.awake !== false && !(isBossEncounter(encounter) && bossSkipsStep(encounter))
  ));
  beasts.forEach(({ tile, encounter }) => {
    if (!tile || dreamerSharesTile(state, tile.id)) return;
    const target = nearestDreamerTile(state, tile);
    if (!target) return;
    const steps = adjacentTiles(state, tile.id).filter((next) => next.revealed && !next.wasteland);
    const closer = steps
      .filter((next) => hexDistance(next, target) < hexDistance(tile, target))
      .sort((a, b) => hexDistance(a, target) - hexDistance(b, target));
    const dest = closer[0];
    if (!dest) {
      addLog(state, `${encounter.name} holds. No open step toward the nearest Dreamer.`);
      return;
    }
    moveEncounterBetweenLandscapes(state, tile.id, dest.id, encounter);
    addLog(state, `${encounter.name} stalks toward the nearest Dreamer and steps onto ${dest.name}.`);
    moved += 1;
  });
  return moved;
}

/** Step 1 — start of Meet. Boss twists act; the beasts already chased you at Explore. */
export function applyMeetStartTax(state) {
  if (state.tutorialMode) return;
  applyBossTwistsAtMeetStart(state);
}

/** @deprecated Use applyMeetStartTax. */
export function applyMeetPhaseDreambeastTax(state) {
  applyMeetStartTax(state);
}

/**
 * Step 3 — end of Meet.
 * Repress 1 Psyche from the deck per leftover beast, and 1 Psyche from hand
 * for each Dreamer still standing on a Wasteland.
 */
function roundResourceTaxCount(state) {
  if (state.finalRecurrence) {
    return (state.finalArchetypes || []).filter((arch) => !arch.defeated).length;
  }
  const spared = state.duskSparedRound === state.round;
  return (spared ? 0 : roamingDreambeastsInSpawnOrder(state).length * DUSK_REPRESS_PER_BEAST + twistDuskMill(state))
    + longNightToll(state);
}

/** 0.30: each Dreambeast still standing at dusk Represses 2 from the Waking Mind. */
export const DUSK_REPRESS_PER_BEAST = 2;

/** Cards the dusk mill will take from the Waking Mind when this round ends. */
export function duskMillCount(state) {
  return roundResourceTaxCount(state);
}

/** The Waking Mind: Psyche cards still drawable (deck plus discard). */
export function wakingMindCount(state) {
  return (state.psycheDeck?.length || 0) + (state.psycheDiscard?.length || 0);
}

function applyRoundResourceTax(state) {
  const count = roundResourceTaxCount(state);
  if (!count) return;
  const spared = state.duskSparedRound === state.round;
  const standing = spared ? [] : roamingDreambeastsInSpawnOrder(state);
  const long = longNightToll(state);
  const omen = spared ? 0 : twistDuskMill(state);
  const n = standing.length;
  logMoment(
    state,
    n
      ? `Dusk. ${n} Dreambeast${n === 1 ? "" : "s"} still stand${n === 1 ? "s" : ""}: Repress ${count} from the Waking Mind.`
      : `Dusk in the Long Night. Repress ${count} from the Waking Mind.`,
    { durationMs: 14000 },
  );
  // The table plays this as its own beat (js/ui/dusk-toll.js); the cards fly there.
  if (typeof document !== "undefined") {
    state.pendingDuskToll = {
      round: state.round,
      beasts: standing.map(({ encounter }) => ({
        name: encounter.name,
        image: encounter.image,
        suit: encounter.suit,
        n: DUSK_REPRESS_PER_BEAST,
      })),
      omen,
      long,
      count,
    };
    state._quietRepressFx = true;
  }
  const taken = repressTopPsycheFromDeck(state, count);
  state._quietRepressFx = false;
  tellDusk(state, { count: taken, beasts: standing.map(({ encounter }) => encounter.name) });
  if (state.pendingDuskToll) state.pendingDuskToll.taken = taken;
}

function applyTutorialMeetEnd(state) {
  if (state.tutorialFlags?.meetPenaltyDone) return;
  const beasts = roamingDreambeastsInSpawnOrder(state);
  if (!beasts.length) return;
  state.tutorialFlags.meetPenaltyDone = true;
  logMoment(
    state,
    "Dusk: Mandrake still stands. One Psyche is Repressed from the Waking Mind. The beast stays until you win.",
    { durationMs: 14000 },
  );
  repressTopPsycheFromDeck(state, 1);
  addLog(state, "Tutorial — a leftover Dreambeast Represses 1 Psyche from the Waking Mind at dusk.");
}

export function applyMeetEndConsequences(state) {
  if (state.tutorialMode) {
    applyTutorialMeetEnd(state);
    return;
  }
  applyBossTwistsAtDusk(state, {
    discardDream: discardDreamCard,
    popDream: popDiscardableDream,
    forgetTile,
  });
  if (state.duskSparedRound !== state.round) applyBeastTwistsAtDusk(state, { forgetTile });
  applyRoundResourceTax(state);
}

export function meetEndPreview(state) {
  const count = roundResourceTaxCount(state);
  if (count <= 0) return null;
  return { beastCount: count, repressCount: count, forgetCount: 0, relief: 0 };
}

export { isRoamingBeast };
