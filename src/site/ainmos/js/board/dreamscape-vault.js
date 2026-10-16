/**
 * Freeform Board: the Dreamscape Vault.
 *
 * The board starts as The Bed alone. Every other Landscape waits in a shuffled
 * tile deck. Three lie face up in the Vault. Reveal spends 1 Lucidity to take a
 * Vault tile and place it on an empty hex that touches the board. Refreshing the
 * Vault costs 1 Lucidity, +1 for each refresh already made this round.
 *
 * Pure state helpers only: no DOM. The pick flow lives in landscapes.js.
 */

import { random } from "../core/rng.js";
import { hexDistance, hexNeighbors, hexKey } from "../core/hex.js";
import { shuffle } from "../core/data.js";

export const BOARD_MODES = Object.freeze({ FIXED: "fixed", FREEFORM: "freeform" });
export const VAULT_SIZE = 3;
/** Placed tiles stay within this many steps of The Bed so the table fits a screen. */
export const FREEFORM_MAX_RADIUS = 4;

export function isFreeformBoard(state) {
  return state?.boardMode === BOARD_MODES.FREEFORM;
}

export function normalizeBoardMode(mode) {
  return mode === BOARD_MODES.FREEFORM ? BOARD_MODES.FREEFORM : BOARD_MODES.FIXED;
}

/** Tile deck for a Freeform night: every Landscape except The Bed, shuffled. */
export function buildLandscapeTileDeck(landscapes) {
  return shuffle(
    landscapes
      .filter((l) => !l.hidden && !l.center)
      .map((l) => ({ ...l })),
  );
}

export function vaultSize(state) {
  return Math.max(1, state?.vaultSize || VAULT_SIZE);
}

export function vaultCards(state) {
  return Array.isArray(state?.landscapeVault) ? state.landscapeVault : [];
}

export function tileDeckCount(state) {
  return Array.isArray(state?.landscapeTileDeck) ? state.landscapeTileDeck.length : 0;
}

/** Fill empty Vault slots from the top of the tile deck. */
export function refillVault(state) {
  if (!isFreeformBoard(state)) return;
  if (!Array.isArray(state.landscapeVault)) state.landscapeVault = [];
  if (!Array.isArray(state.landscapeTileDeck)) state.landscapeTileDeck = [];
  while (state.landscapeVault.length < vaultSize(state) && state.landscapeTileDeck.length) {
    state.landscapeVault.push(state.landscapeTileDeck.shift());
  }
}

/** Nothing left to place: the Vault and the tile deck are both empty. */
export function vaultExhausted(state) {
  return isFreeformBoard(state) && !vaultCards(state).length && !tileDeckCount(state);
}

export function vaultRefreshCost(state) {
  return 1 + Math.max(0, state?.vaultRefreshesThisRound || 0);
}

/** Refresh: the face-up tiles go under the deck and three new ones are dealt. */
export function refreshVault(state) {
  if (!isFreeformBoard(state)) return false;
  const old = vaultCards(state).splice(0);
  if (!old.length && !tileDeckCount(state)) return false;
  state.landscapeTileDeck.push(...old);
  state.vaultRefreshesThisRound = (state.vaultRefreshesThisRound || 0) + 1;
  refillVault(state);
  return true;
}

export function resetVaultRoundCounters(state) {
  if (state) state.vaultRefreshesThisRound = 0;
}

/** Empty hexes touching any placed tile, within the radius cap. */
export function placementSlots(state) {
  if (!isFreeformBoard(state)) return [];
  const taken = new Set((state.board || []).map((t) => hexKey(t.q, t.r)));
  const origin = { q: 0, r: 0 };
  const seen = new Set();
  const slots = [];
  (state.board || []).forEach((tile) => {
    hexNeighbors(tile.q, tile.r).forEach((slot) => {
      const key = hexKey(slot.q, slot.r);
      if (taken.has(key) || seen.has(key)) return;
      if (hexDistance(slot, origin) > FREEFORM_MAX_RADIUS) return;
      seen.add(key);
      slots.push(slot);
    });
  });
  return slots;
}

export function isPlacementSlot(state, q, r) {
  return placementSlots(state).some((s) => s.q === q && s.r === r);
}

/** Turn a Landscape card into a board tile at (q, r). Starts face-down so the reveal FX can flip it. */
export function makeBoardTile(landscape, q, r) {
  return {
    ...landscape,
    q,
    r,
    revealed: false,
    wasteland: true,
    finalRecurrenceSide: false,
  };
}

const BOARD_ONLY_FIELDS = [
  "q", "r", "revealed", "wasteland", "forgotten", "finalRecurrenceSide", "encounters", "encounter",
  "finalArchetypes", "finalArchetype",
];

/** A Forgotten tile's card goes back into the Landscape deck at a random depth. */
export function shuffleLandscapeIntoDeck(state, tile) {
  if (!tile) return null;
  const card = { ...tile };
  BOARD_ONLY_FIELDS.forEach((key) => { delete card[key]; });
  if (!Array.isArray(state.landscapeTileDeck)) state.landscapeTileDeck = [];
  const at = Math.floor(random() * (state.landscapeTileDeck.length + 1));
  state.landscapeTileDeck.splice(at, 0, card);
  refillVault(state);
  return card;
}

/** Is this Landscape still waiting in the Vault or the tile deck? */
export function isUnplacedLandscape(state, landscapeId) {
  if (!isFreeformBoard(state)) return false;
  return vaultCards(state).some((c) => c.id === landscapeId)
    || (state.landscapeTileDeck || []).some((c) => c.id === landscapeId);
}

/**
 * Forget a Landscape that was never placed: it leaves the Vault or deck and is
 * set aside. Returns the card when found.
 */
export function setAsideUnplacedLandscape(state, landscapeId) {
  if (!isFreeformBoard(state)) return null;
  const pools = [state.landscapeVault, state.landscapeTileDeck];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    const index = pool.findIndex((c) => c.id === landscapeId);
    if (index < 0) continue;
    const [card] = pool.splice(index, 1);
    // Ainmos 0.23: a Forgotten Landscape is never lost, only shuffled back into the deck.
    shuffleLandscapeIntoDeck(state, card);
    return card;
  }
  return null;
}

/** Take the top tile of the deck (not the Vault). */
export function drawTopTile(state) {
  if (!isFreeformBoard(state) || !tileDeckCount(state)) return null;
  return state.landscapeTileDeck.shift();
}

export function putTileOnBottom(state, card) {
  if (!card || !isFreeformBoard(state)) return;
  if (!Array.isArray(state.landscapeTileDeck)) state.landscapeTileDeck = [];
  state.landscapeTileDeck.push(card);
}

/** The Vault or deck card for a Landscape that has not been placed yet. */
export function findUnplacedLandscape(state, landscapeId) {
  if (!isFreeformBoard(state)) return null;
  return vaultCards(state).find((c) => c.id === landscapeId)
    || (state.landscapeTileDeck || []).find((c) => c.id === landscapeId)
    || null;
}

/** Pull a named Landscape out of the Vault or deck so it can be placed. */
export function takeUnplacedLandscape(state, landscapeId) {
  const pools = [state.landscapeVault, state.landscapeTileDeck];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    const index = pool.findIndex((c) => c.id === landscapeId);
    if (index < 0) continue;
    const [card] = pool.splice(index, 1);
    refillVault(state);
    return card;
  }
  return null;
}

/** The open hex closest to a tile (ties go to the hex closest to The Bed). */
export function nearestPlacementSlot(state, nearTile) {
  const slots = placementSlots(state);
  if (!slots.length) return null;
  const origin = { q: 0, r: 0 };
  const anchor = nearTile || origin;
  return [...slots].sort((a, b) => (
    hexDistance(a, anchor) - hexDistance(b, anchor)
    || hexDistance(a, origin) - hexDistance(b, origin)
  ))[0];
}
