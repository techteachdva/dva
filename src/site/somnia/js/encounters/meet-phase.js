/**
 * Canonical Meet Phase flow (Somnia 26+) — one source of truth.
 *
 * 1) Start of Meet — each Dreamer discards 1 Psyche per Dreambeast on their
 *    tile or an adjacent hex. Those cards go to the Psyche discard, not the
 *    Subconscious. One Dreamer ignores the first tax card each Meet.
 *    Roaming beasts stay where they are.
 * 2) Middle of Meet — one Dreamer may spend 1 Willpower Psyche to unlock
 *    shared Meet Actions. Dreamers take Actions (Meet / Landscape / Trade /
 *    Powers) as they wish. Accept and Repress need 1 Psyche of the required
 *    suit (1–3 cards; allies extra). Beast Power is its dice; recommended
 *    Dreamer Power is beast Power + 2. Underpaying is legal. A win removes
 *    the beast, a loss spends the play and leaves the beast on the map.
 * 3) End of Meet — if any Dreambeasts remain, Forget 1 random Landscape per
 *    remaining beast (never the Bed, never a hex that still hosts a beast).
 *    Fail costs no longer resolve at Meet end (36.0) — Fail only when a
 *    Dreambeast is drawn and Accept/Repress fails, or Flee fails.
 */
import {
  addLog,
  allEncountersOnBoard,
  countEncountersOnBoard,
  landscapeById,
  headPlayer,
} from "../core/state.js";
import { areHexAdjacent } from "../core/hex.js";
import { logMoment } from "../core/narrator.js";
import { enqueueDiscardFromHand } from "../dreamers/subconscious.js";
import { forgetRandomLandscapes, forgetNamedLandscapes } from "../board/landscapes.js";

export const MEET_PHASE_FLOW = Object.freeze({
  start: "Each Dreamer on or adjacent to a roaming Dreambeast discards 1 Psyche per such beast. One Dreamer ignores the first card.",
  middle: "Spend 1 Willpower Psyche for shared Meet Actions. Accept and Repress are dice battles. Roaming beasts stay until won.",
  end: "Forget 1 random Landscape per remaining Dreambeast. Fail costs resolve only on draw (failed Accept/Repress or failed Flee).",
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

function beastsPressuringDreamer(state, player, beasts) {
  const here = landscapeById(state, player.landscapeId);
  if (!here) return 0;
  return beasts.filter(({ tile }) => tile?.id === here.id || areHexAdjacent(here, tile)).length;
}

/** Step 1 — start of Meet. Tutorial skips the tax. Only nearby beasts tax. */
export function applyMeetStartTax(state) {
  if (state.tutorialMode) return;
  const beasts = roamingDreambeastsInSpawnOrder(state);
  if (!beasts.length) return;

  const assessed = state.players
    .filter((player) => player.alive)
    .map((player) => {
      let count = beastsPressuringDreamer(state, player, beasts);
      const pressured = count > 0;
      if (state.players.length === 1 && count > 0) {
        count -= 1;
        addLog(state, `${player.name} ignores the first Meet tax this Meet.`);
      }
      if (
        count > 0
        && !state.tutorialMode
        && !state.immovableTaxUsed
        && player.dreamer?.id === "the-immovable"
      ) {
        state.immovableTaxUsed = true;
        count -= 1;
        addLog(state, `${player.name} ignores 1 Meet-tax Psyche.`);
      }
      return { player, count, pressured };
    });
  const charges = assessed.filter((entry) => entry.count > 0);

  if (!charges.length) {
    if (!assessed.some((entry) => entry.pressured)) {
      addLog(
        state,
        `Meet start: ${beasts.length} Dreambeast(s) roam out of reach. Nobody discards.`,
      );
    }
    return;
  }

  const summary = charges
    .map(({ player, count }) => `${player.name} discards ${count}`)
    .join("; ");
  logMoment(
    state,
    `Meet begins: Dreambeasts tax whoever shares their tile or stands next to it. ${summary}.`,
    { forget: true, durationMs: 16000 },
  );
  charges.forEach(({ player, count }) => {
    enqueueDiscardFromHand(state, player, count, {
      reason: `${player.name}: ${count} Dreambeast${count === 1 ? "" : "s"} on or beside you — discard ${count} Psyche from hand.`,
    });
  });
  addLog(state, `Meet start: ${summary}.`);
}

/** @deprecated Use applyMeetStartTax. */
export function applyMeetPhaseDreambeastTax(state) {
  applyMeetStartTax(state);
}

/**
 * Step 3 — end of Meet. Forget random Landscapes.
 * Beasts are not removed. Fail already resolved on a failed Accept, Repress, or Flee.
 */
function applyTutorialMeetEnd(state) {
  if (state.tutorialFlags?.meetPenaltyDone) return;
  const beasts = roamingDreambeastsInSpawnOrder(state);
  if (!beasts.length) return;
  state.tutorialFlags.meetPenaltyDone = true;

  const candy = landscapeById(state, "candy-mountain");
  if (candy?.revealed && !candy.wasteland) {
    forgetNamedLandscapes(state, ["candy-mountain"]);
  }

  logMoment(
    state,
    "Meet ends: Mandrake still roams. Candy Mountain is Forgotten. Beasts stay until you win.",
    { forget: true, durationMs: 14000 },
  );
  addLog(
    state,
    "Tutorial — leftover Dreambeasts Forget Landscapes. Mandrake stays on The Attic for next round.",
  );
}

export function applyMeetEndConsequences(state) {
  if (state.tutorialMode) {
    applyTutorialMeetEnd(state);
    return;
  }
  const beasts = roamingDreambeastsInSpawnOrder(state);
  if (!beasts.length) return;

  const forgotten = forgetRandomLandscapes(state, beasts.length, { skipOccupied: true });
  if (forgotten.length) {
    logMoment(
      state,
      `Meet ends: ${beasts.length} roaming Dreambeast${beasts.length === 1 ? "" : "s"} — Forgot ${forgotten.length} Landscape${forgotten.length === 1 ? "" : "s"} (${forgotten.map((t) => t.name).join(", ")}).`,
      { forget: true, durationMs: 16000 },
    );
  } else {
    logMoment(
      state,
      `Meet ends: ${beasts.length} roaming Dreambeast${beasts.length === 1 ? "" : "s"} remain. No Landscape left to Forget.`,
    );
  }

  beasts.forEach(({ tile, encounter }, index) => {
    addLog(
      state,
      `${encounter.name} (spawned ${index + 1}${beasts.length > 1 ? ` of ${beasts.length}` : ""}) remains on ${tile?.name || "the Dreamscape"} — no Fail (Fail only on draw Flee failure or failed Accept/Repress).`,
    );
  });
}

export function meetEndPreview(state) {
  const beastCount = countActiveDreambeasts(state);
  if (beastCount <= 0) return null;
  return { beastCount, forgetCount: beastCount, relief: 0 };
}

export { isRoamingBeast };
