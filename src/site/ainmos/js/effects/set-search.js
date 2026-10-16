/**
 * Ainmos 0.26: searching for Set pieces.
 *
 * Sets were hard to finish because every Object came from a blind draw. Three
 * ways now reach for a missing piece of a Set you have started:
 *   - an Accepted Dreambeast can pay "a missing Set piece" instead of a random Object,
 *   - the Lost & Found always shows one missing piece when one is in the deck,
 *   - The One Mimics a missing piece: it becomes a copy of it, ability and all,
 *     and turns back into The One when it is Discarded.
 *
 * A Set counts different pieces, so a Mimic and the real piece never double up.
 * No state.js import on purpose (it would cycle through object-effects).
 */

import { OBJECT_SETS } from "./object-sets.js";
import { uid } from "../core/data.js";
import { random } from "../core/rng.js";

const SUITS = ["lucidity", "elasticity", "willpower"];

/** Chess pieces call up Dreambeasts and are out of the Ainmos decks, so they are never searched for. */
export const SEARCHABLE_SETS = Object.freeze(["body", "element", "jewelry", "stick"]);

export function pieceSetTag(card) {
  const tag = (card?.tags || []).find((t) => t && !/^\d+\/\d+$/.test(t));
  return tag && OBJECT_SETS[tag] ? tag : null;
}

function heldObjects(player) {
  return [...(player?.persistent || []), ...(player?.objects || [])];
}

/** Distinct piece ids of this Set the Dreamer holds (a Mimic counts as the piece it copies). */
export function heldPieceIds(player, tag) {
  return [...new Set(heldObjects(player).filter((o) => pieceSetTag(o) === tag).map((o) => o.id))];
}

/** Every Object card the table can still see: deck, discard, and the Lost & Found. */
function supplyCards(state) {
  const out = [];
  SUITS.forEach((suit) => {
    (state.objectDecks?.[suit] || []).forEach((card, index) => out.push({ card, pile: "deck", suit, index }));
    (state.objectDiscard?.[suit] || []).forEach((card, index) => out.push({ card, pile: "discard", suit, index }));
  });
  (state.lostFound?.objects || []).forEach((card, index) => card && out.push({ card, pile: "shop", index }));
  return out;
}

/** Sets this Dreamer has started (at least 1 piece held) and not finished, closest to done first. */
export function startedSets(player) {
  return SEARCHABLE_SETS
    .map((tag) => ({ tag, held: heldPieceIds(player, tag).length, need: OBJECT_SETS[tag] }))
    .filter((s) => s.held > 0 && s.held < s.need)
    .sort((a, b) => (a.need - a.held) - (b.need - b.held));
}

/**
 * Missing pieces of started Sets, one entry per piece id, as cards to copy or take.
 * `onlyDeck` limits it to the Object deck and its discard (what can be taken).
 */
export function missingPieces(state, player, { onlyDeck = false, anySet = false } = {}) {
  const tags = anySet && !startedSets(player).length ? SEARCHABLE_SETS : startedSets(player).map((s) => s.tag);
  const seen = new Set();
  const out = [];
  supplyCards(state).forEach((entry) => {
    if (onlyDeck && entry.pile === "shop") return;
    const tag = pieceSetTag(entry.card);
    if (!tag || !tags.includes(tag) || seen.has(entry.card.id)) return;
    if (heldPieceIds(player, tag).includes(entry.card.id)) return;
    seen.add(entry.card.id);
    out.push({ ...entry, tag });
  });
  return out;
}

/** Take one missing piece of a started Set out of the Object deck or discard. */
export function takeMissingPiece(state, player) {
  const options = missingPieces(state, player, { onlyDeck: true });
  if (!options.length) return null;
  const order = startedSets(player).map((s) => s.tag);
  options.sort((a, b) => order.indexOf(a.tag) - order.indexOf(b.tag));
  const best = options.filter((o) => o.tag === options[0].tag);
  const pick = best[Math.floor(random() * best.length)];
  const pile = pick.pile === "deck" ? state.objectDecks[pick.suit] : state.objectDiscard[pick.suit];
  const index = pile.findIndex((c) => c.instanceId === pick.card.instanceId);
  if (index < 0) return null;
  return pile.splice(index, 1)[0];
}

/** The Lost & Found's Set slot: pull a missing piece of a started Set out of the deck. */
export function shopSetPiece(state, player) {
  return player ? takeMissingPiece(state, player) : null;
}

/** The One becomes a copy of a missing piece. The original rides along to come back on Discard. */
export function mimicCard(theOne, target) {
  const { mimicOriginal, ...original } = theOne || {};
  return {
    ...target,
    instanceId: uid("obj"),
    name: `${target.name} (The One)`,
    mimic: true,
    mimicOriginal: original.id === "the-one" ? original : mimicOriginal || original,
  };
}

/** A Discarded Mimic goes back to the Object discard as The One. */
export function unmimic(card) {
  return card?.mimicOriginal ? { ...card.mimicOriginal } : card;
}
