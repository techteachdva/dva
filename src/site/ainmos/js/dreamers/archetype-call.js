/**
 * Ainmos 0.25: Calling an Archetype needs one of its two home Landscapes
 * revealed on the Dreamscape. An Archetype with neither home placed cannot be
 * called.
 *
 * If none of the offered Archetypes can be called, you must Repress 1 Psyche
 * from your hand to search the Landscape deck for the first missing home (in
 * the order the Archetypes are offered). That Landscape is placed on a random
 * open hex, and its Archetype can then be called.
 */

import { addLog, landscapeById } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { random } from "../core/rng.js";
import { archetypeChoiceOptions, archetypeHomeTiles, archetypeHomeNames } from "./archetype-board.js";
import { placementSlots, takeUnplacedLandscape, makeBoardTile, isFreeformBoard } from "../board/dreamscape-vault.js";
import { revealLandscapeTile } from "../core/state.js";
import { repressCard, isDreambeastPsycheCard } from "./subconscious.js";

/** Can this Archetype be called right now (one of its homes is revealed)? */
export function archetypeCallable(state, arch) {
  return archetypeHomeTiles(state, arch).length > 0;
}

/** Why an Archetype cannot be called, or "". */
export function archetypeCallBlock(state, arch) {
  if (archetypeCallable(state, arch)) return "";
  const names = archetypeHomeNames(state, arch);
  return `Reveal ${names.join(" or ")} first.`;
}

/** True when an Archetype Dream is waiting and none of its options can be called. */
export function archetypeSearchNeeded(state) {
  if (!state?.pendingArchetypeChoice) return false;
  const options = archetypeChoiceOptions(state);
  return options.length > 0 && !options.some((arch) => archetypeCallable(state, arch));
}

function inLandscapeDeck(state, id) {
  return (state.landscapeVault || []).some((c) => c.id === id)
    || (state.landscapeTileDeck || []).some((c) => c.id === id);
}

/** The first missing home Landscape among the offered Archetypes, with its Archetype. */
export function firstMissingHome(state, options = archetypeChoiceOptions(state)) {
  for (const arch of options) {
    for (const id of arch.landscapes || []) {
      const tile = landscapeById(state, id);
      const placed = tile && tile.revealed && !tile.wasteland && !tile.forgotten;
      if (!placed && inLandscapeDeck(state, id)) return { arch, landscapeId: id };
    }
  }
  return null;
}

function lowestPsyche(player) {
  const psyche = (player?.hand || []).filter((c) => c
    && c.type !== "object"
    && c.type !== "psyche-power"
    && !isDreambeastPsycheCard(c));
  if (!psyche.length) return null;
  return psyche.reduce((low, c) => ((Number(c.value) || 0) < (Number(low.value) || 0) ? c : low));
}

/** Place a Landscape from the deck on a random open hex, face up. */
export function placeLandscapeRandomly(state, landscapeId) {
  if (!isFreeformBoard(state)) return null;
  const slots = placementSlots(state);
  if (!slots.length) return null;
  const card = takeUnplacedLandscape(state, landscapeId);
  if (!card) return null;
  const slot = slots[Math.floor(random() * slots.length)];
  const tile = makeBoardTile(card, slot.q, slot.r);
  state.board.push(tile);
  revealLandscapeTile(state, tile);
  state.runStats = state.runStats || {};
  state.runStats.landscapesPlaced = (state.runStats.landscapesPlaced || 0) + 1;
  return tile;
}

/**
 * Repress 1 Psyche from hand (your lowest) and search the Landscape deck for the
 * first missing home. Returns { arch, tile, card } or null when nothing could be found.
 * `payFromDeck` Represses from the Waking Mind instead (used when the Dream is eaten).
 */
export function searchForArchetypeHome(state, player, { payFromDeck = false } = {}) {
  const found = firstMissingHome(state, state.pendingArchetypeChoice ? archetypeChoiceOptions(state) : (state.archetypeDeck || []));
  if (!found) {
    logMoment(state, "No missing home Landscape is left in the deck.");
    return null;
  }
  let paid = null;
  const card = payFromDeck ? null : lowestPsyche(player);
  if (card) {
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    repressCard(state, card);
    paid = card;
  } else if (state.psycheDeck?.length) {
    paid = state.psycheDeck.shift();
    repressCard(state, paid);
  }
  const tile = placeLandscapeRandomly(state, found.landscapeId);
  if (!tile) {
    logMoment(state, "There is no open hex to place a Landscape.");
    return null;
  }
  const what = paid ? `${paid.name || "a Psyche"} is Repressed` : "Nothing is left to Repress";
  logMoment(state, `${what}. The search turns up ${tile.name}: ${found.arch.name} can now be called.`);
  addLog(state, `Searched the Landscape deck for ${tile.name} (home of ${found.arch.name}).`);
  return { arch: found.arch, tile, card: paid };
}
