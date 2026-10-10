/**
 * Canonical Meet Phase flow (Somnia 26+) — one source of truth.
 *
 * 1) Start of Meet — each Boss steps 1 hex toward the nearest Dreamer, unless
 *    a Dreamer already shares its hex. There is no hand tax.
 * 2) Middle of Meet — one Dreamer may spend 1 Willpower Psyche to unlock
 *    shared Meet Actions. Accept and Repress are the same Power. Accept pays
 *    the beast's suit. Repress pays the opposing suit.
 * 3) End of the round — Repress 1 card from the Psyche Deck per Dreambeast
 *    still on the board. During the Final Recurrence, count remaining
 *    Archetypes instead. Fail only when Accept or Repress loses.
 */
import {
  addLog,
  allEncountersOnBoard,
  countEncountersOnBoard,
  landscapeById,
  moveEncounterBetweenLandscapes,
  repressTopPsycheFromDeck,
} from "../core/state.js";
import { adjacentTiles, hexDistance } from "../core/hex.js";
import { logMoment } from "../core/narrator.js";

export const MEET_PHASE_FLOW = Object.freeze({
  start: "Bosses step toward the nearest Dreamer. No cards are taxed from hands.",
  middle: "Spend 1 Willpower Psyche for shared Meet Actions. Accept and Repress are one Power. Roaming beasts stay until won.",
  end: "Repress 1 Psyche from the Psyche Deck per Dreambeast still on the board. In the Final Recurrence, count remaining Archetypes.",
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

const BOSS_IDS = new Set(["cerberus", "double", "leviathan"]);

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

/** Bosses hunt at the opening of Meet. A boss already sharing a hex stays. */
function stepBossesTowardDreamers(state) {
  const bosses = allEncountersOnBoard(state).filter(({ encounter }) => (
    isBossEncounter(encounter) && encounter.awake !== false
  ));
  bosses.forEach(({ tile, encounter }) => {
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
  });
}

/** Step 1 — start of Meet. Bosses hunt. Hands are not taxed. */
export function applyMeetStartTax(state) {
  if (state.tutorialMode) return;
  stepBossesTowardDreamers(state);
}

/** @deprecated Use applyMeetStartTax. */
export function applyMeetPhaseDreambeastTax(state) {
  applyMeetStartTax(state);
}

/**
 * Step 3 — end of Meet. Forget random Landscapes.
 * Beasts are not removed. Fail already resolved on a lost Accept or Repress.
 */
function roundResourceTaxCount(state) {
  if (state.finalRecurrence) {
    return (state.finalArchetypes || []).filter((arch) => !arch.defeated).length;
  }
  return roamingDreambeastsInSpawnOrder(state).length;
}

function applyRoundResourceTax(state) {
  const count = roundResourceTaxCount(state);
  if (!count) return;
  const kind = state.finalRecurrence ? "Archetype" : "Dreambeast";
  const plural = count === 1 ? "" : "s";
  logMoment(
    state,
    `The round ends. ${count} ${kind}${plural} still stand. Repress ${count} from the Psyche Deck.`,
    { durationMs: 14000 },
  );
  repressTopPsycheFromDeck(state, count);
}

function applyTutorialMeetEnd(state) {
  if (state.tutorialFlags?.meetPenaltyDone) return;
  const beasts = roamingDreambeastsInSpawnOrder(state);
  if (!beasts.length) return;
  state.tutorialFlags.meetPenaltyDone = true;
  logMoment(
    state,
    "Meet ends: Mandrake still roams. One Psyche is Repressed from the deck. The beast stays until you win.",
    { durationMs: 14000 },
  );
  repressTopPsycheFromDeck(state, 1);
  addLog(state, "Tutorial — a leftover Dreambeast Represses 1 Psyche from the deck.");
}

export function applyMeetEndConsequences(state) {
  if (state.tutorialMode) {
    applyTutorialMeetEnd(state);
    return;
  }
  applyRoundResourceTax(state);
}

export function meetEndPreview(state) {
  const count = roundResourceTaxCount(state);
  if (count <= 0) return null;
  return { beastCount: count, repressCount: count, forgetCount: 0, relief: 0 };
}

export { isRoamingBeast };
