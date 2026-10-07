import { shuffle, uid } from "../core/data.js";
import { queueReshuffleFx } from "../board/board-fx.js";

export const MINDSTREAM_SUIT_IDS = ["lucidity", "elasticity", "willpower"];

function suitsToSearch(suit) {
  if (suit) return [suit];
  return shuffle([...MINDSTREAM_SUIT_IDS]);
}

export function reshuffleMindstreamDiscardIfNeeded(state, suit) {
  const deck = state.mindstreamDecks[suit];
  const discard = state.mindstreamDiscard[suit];
  if (!deck.length && discard.length) {
    state.mindstreamDecks[suit] = shuffle(discard);
    state.mindstreamDiscard[suit] = [];
    if (state.revealedDeckTops) delete state.revealedDeckTops[`mindstream-${suit}`];
    queueReshuffleFx(suit);
    return true;
  }
  return false;
}

const CIRCULATING_MINDSTREAM_TYPES = new Set([
  "dreambeast",
  "object",
  "event",
  "power-token",
  "draw-dream",
  "psyche-dreambeast",
]);

function cardIsMindstreamSuit(card, suit) {
  if (!card) return false;
  if (card.isDreambeastPsyche || CIRCULATING_MINDSTREAM_TYPES.has(card.type)) {
    return (card.mindstreamSuit || card.suit) === suit;
  }
  return false;
}

function tileEncounterList(tile) {
  if (!tile) return [];
  if (Array.isArray(tile.encounters)) return tile.encounters;
  return tile.encounter ? [tile.encounter] : [];
}

/** Cards of this suit still in decks, discard, or in play (not only Subconscious). */
export function countMindstreamCirculation(state, suit) {
  let n = (state.mindstreamDecks?.[suit]?.length || 0)
    + (state.mindstreamDiscard?.[suit]?.length || 0);
  if (cardIsMindstreamSuit(state.landscapePick?.encounter, suit)) n += 1;
  for (const tile of state.board || []) {
    n += tileEncounterList(tile).filter((enc) => cardIsMindstreamSuit(enc, suit)).length;
  }
  for (const player of state.players || []) {
    const piles = [
      ...(player.objects || []),
      ...(player.persistent || []),
      ...(player.hand || []),
    ];
    n += piles.filter((card) => cardIsMindstreamSuit(card, suit)).length;
  }
  return n;
}

/** True when this suit still has cards in decks, discard, or in play (not only Subconscious). */
export function mindstreamSuitHasCirculation(state, suit) {
  return countMindstreamCirculation(state, suit) > 0;
}

export function isMindstreamSuitGone(state, suit) {
  return !mindstreamSuitHasCirculation(state, suit);
}

export function goneMindstreamSuit(state) {
  return MINDSTREAM_SUIT_IDS.find((suit) => isMindstreamSuitGone(state, suit)) || null;
}

function matchesSpawnBeast(card, { beastKind = null, filter = null } = {}) {
  if (!card || card.type !== "dreambeast" || card.boss) return false;
  if (beastKind && card.beastKind !== beastKind) return false;
  if (filter && !filter(card)) return false;
  return true;
}

function discardRestOfMindstream(state, suit, extra = []) {
  const deck = state.mindstreamDecks[suit];
  const discard = state.mindstreamDiscard[suit];
  extra.forEach((card) => discard.push(card));
  while (deck.length) discard.push(deck.shift());
  reshuffleMindstreamDiscardIfNeeded(state, suit);
}

function noteBeastMill(state, found) {
  if (!state || typeof document === "undefined" || !found?.card) return;
  if (!state.pendingBeastMill || state.pendingBeastMill.playing) {
    state.pendingBeastMill = { steps: [] };
  }
  state.pendingBeastMill.steps.push({
    suit: found.suit,
    passed: found.passed || [],
    milledRest: found.milledRest || 0,
    beast: found.card,
    tileId: null,
    encounterId: null,
    discarded: false,
  });
}

/** The Dreambeast just placed on a landscape. The mill cinematic flies it there. */
export function stampBeastMillTile(state, tileId, encounter) {
  const steps = state?.pendingBeastMill?.steps;
  if (!steps?.length || !tileId) return;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step.tileId || step.discarded) continue;
    const beastId = step.beast?.id;
    const encId = encounter?.id || encounter?.refId;
    if (beastId && encId && beastId !== encId && step.beast?.instanceId !== encounter?.instanceId) continue;
    step.tileId = tileId;
    step.encounterId = encounter?.instanceId || null;
    return;
  }
}

/** The drawn Dreambeast could not stay on the map, so it joins the discard. */
export function stampBeastMillDiscard(state) {
  const steps = state?.pendingBeastMill?.steps;
  const last = steps?.[steps.length - 1];
  if (!last || last.tileId) return;
  last.discarded = true;
}

/**
 * Draw from the top until a matching Dreambeast.
 * Spawn (millRest) discards every other card in that suit, then reshuffles.
 * A two-beast draw discards only the cards turned over before the hit.
 * If this suit has no match, the cards go back and the pile is unchanged.
 */
function cycleSuitForDreambeast(state, suit, options, millRest) {
  reshuffleMindstreamDiscardIfNeeded(state, suit);
  const deck = state.mindstreamDecks[suit];
  const skipped = [];
  while (deck.length) {
    const card = deck.shift();
    if (matchesSpawnBeast(card, options)) {
      let milledRest = 0;
      if (millRest) {
        milledRest = deck.length;
        discardRestOfMindstream(state, suit, skipped);
      } else if (skipped.length && state.mindstreamDiscard[suit]) {
        skipped.forEach((passed) => state.mindstreamDiscard[suit].push(passed));
      }
      return { card, suit, passed: skipped.slice(), milledRest };
    }
    skipped.push(card);
  }
  skipped.forEach((card) => deck.push(card));
  return null;
}

/**
 * Remove the first matching card from a Mindstream deck (top-down).
 * Reshuffles that suit's discard pile when the deck is empty.
 */
export function pullFromMindstreamByType(state, type, { suit = null, filter = null } = {}) {
  for (const s of suitsToSearch(suit)) {
    reshuffleMindstreamDiscardIfNeeded(state, s);
    const deck = state.mindstreamDecks[s];
    const idx = deck.findIndex((card) => {
      if (card.type !== type) return false;
      return !filter || filter(card);
    });
    if (idx < 0) continue;
    const [card] = deck.splice(idx, 1);
    return { card, suit: s };
  }
  return null;
}

/**
 * Spawn-a-Dreambeast search: flip from the top of a Mindstream until a (non-boss) Dreambeast,
 * optionally matching beastKind (fantasy / nightmare). With millRest (the printed "Spawn a
 * Dreambeast" effect), cards passed and the rest of that draw pile go to discard, which then
 * reshuffles into a new draw pile. A two-beast draw passes millRest: false so only the cards
 * turned over before each Dreambeast are discarded — the rest of the suit stays.
 */
export function pullDreambeastFromMindstream(state, options = {}) {
  const { suit = null, beastKind = null, filter = null, millRest = true } = options;
  const opts = { beastKind, filter };
  for (const s of suitsToSearch(suit)) {
    const found = cycleSuitForDreambeast(state, s, opts, millRest);
    if (found) {
      noteBeastMill(state, found);
      return found;
    }
  }
  return null;
}

export function pullObjectFromMindstream(state, options = {}) {
  return pullFromMindstreamByType(state, "object", options);
}

export function drawTwoDreambeasts(state, { suit = null } = {}) {
  const first = pullDreambeastFromMindstream(state, { suit, millRest: false });
  if (!first) return null;
  const second = pullDreambeastFromMindstream(state, { suit: first.suit, millRest: false });
  return { first, second };
}

export function pullTwoDreambeastsForChoice(state, { suit = null, autoPick = true } = {}) {
  const pair = drawTwoDreambeasts(state, { suit });
  if (!pair) return null;
  if (!pair.second) {
    return { pick: pair.first.card, alt: null, suit: pair.first.suit };
  }
  if (!autoPick) {
    return { first: pair.first, second: pair.second, pick: pair.first.card, alt: pair.second.card, suit: pair.first.suit };
  }
  const pick = (pair.second.card.accept || 0) > (pair.first.card.accept || 0) ? pair.second : pair.first;
  const alt = pick === pair.second ? pair.first : pair.second;
  discardToMindstream(state, alt.card);
  return { pick: pick.card, alt: alt.card, suit: pick.suit };
}

export function discardToMindstream(state, card) {
  const suit = card.mindstreamSuit || card.suit;
  if (suit && state.mindstreamDiscard[suit]) {
    state.mindstreamDiscard[suit].push(card);
    return true;
  }
  return false;
}

/** Accepted Dreambeast allies return to the bottom of their Mindstream deck. */
export function returnDreambeastToMindstreamDeck(state, card) {
  const suit = card.mindstreamSuit || card.suit;
  if (!suit || !state.mindstreamDecks?.[suit]) return false;
  state.mindstreamDecks[suit].push(card);
  return true;
}

export function reorderMindstreamTop(state, suit, count = 3) {
  const deck = state.mindstreamDecks[suit];
  if (!deck?.length) return false;
  const top = deck.splice(0, Math.min(count, deck.length));
  top.reverse();
  deck.unshift(...top);
  return true;
}

export function encounterFromDreambeastCard(beast) {
  return { ...beast, type: "dreambeast", instanceId: uid("enc") };
}

export function objectForPlayer(card) {
  return { ...card, instanceId: uid("obj") };
}

export function pullObjectFromMindstreamDiscards(state) {
  for (const suit of MINDSTREAM_SUIT_IDS) {
    const discard = state.mindstreamDiscard[suit];
    for (let i = discard.length - 1; i >= 0; i -= 1) {
      if (discard[i].type === "object") {
        return discard.splice(i, 1)[0];
      }
    }
  }
  return null;
}

export function pullObjectsFromMindstreamDiscards(state, count = 1) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const card = pullObjectFromMindstreamDiscards(state);
    if (!card) break;
    out.push(card);
  }
  return out;
}

export function countMindstreamDreambeasts(state) {
  return MINDSTREAM_SUIT_IDS.reduce((sum, suit) => {
    const inDeck = state.mindstreamDecks[suit].filter((c) => c.type === "dreambeast").length;
    const inDiscard = state.mindstreamDiscard[suit].filter((c) => c.type === "dreambeast").length;
    return sum + inDeck + inDiscard;
  }, 0);
}

export function countMindstreamObjects(state) {
  return MINDSTREAM_SUIT_IDS.reduce((sum, suit) => {
    const inDeck = state.mindstreamDecks[suit].filter((c) => c.type === "object").length;
    const inDiscard = state.mindstreamDiscard[suit].filter((c) => c.type === "object").length;
    return sum + inDeck + inDiscard;
  }, 0);
}
