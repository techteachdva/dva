import { shuffle, uid } from "./data.js";

const SUITS = ["lucidity", "elasticity", "willpower"];

function suitsToSearch(suit) {
  if (suit) return [suit];
  return shuffle([...SUITS]);
}

export function reshuffleMindstreamDiscardIfNeeded(state, suit) {
  const deck = state.mindstreamDecks[suit];
  const discard = state.mindstreamDiscard[suit];
  if (!deck.length && discard.length) {
    state.mindstreamDecks[suit] = shuffle(discard);
    state.mindstreamDiscard[suit] = [];
  }
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

export function pullDreambeastFromMindstream(state, options = {}) {
  return pullFromMindstreamByType(state, "dreambeast", {
    ...options,
    filter: (card) => !card.boss,
  });
}

export function pullObjectFromMindstream(state, options = {}) {
  return pullFromMindstreamByType(state, "object", options);
}

export function pullTwoDreambeastsForChoice(state, { suit = null } = {}) {
  const first = pullDreambeastFromMindstream(state, { suit });
  if (!first) return null;
  const second = pullDreambeastFromMindstream(state, { suit: first.suit });
  if (!second) {
    return { pick: first.card, alt: null, suit: first.suit };
  }
  const pick = (second.card.accept || 0) > (first.card.accept || 0) ? second : first;
  const alt = pick === second ? first : second;
  const returnCard = alt === first ? first : second;
  state.mindstreamDecks[returnCard.suit].push(returnCard.card);
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
  for (const suit of SUITS) {
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
  return SUITS.reduce((sum, suit) => {
    const inDeck = state.mindstreamDecks[suit].filter((c) => c.type === "dreambeast").length;
    const inDiscard = state.mindstreamDiscard[suit].filter((c) => c.type === "dreambeast").length;
    return sum + inDeck + inDiscard;
  }, 0);
}

export function countMindstreamObjects(state) {
  return SUITS.reduce((sum, suit) => {
    const inDeck = state.mindstreamDecks[suit].filter((c) => c.type === "object").length;
    const inDiscard = state.mindstreamDiscard[suit].filter((c) => c.type === "object").length;
    return sum + inDeck + inDiscard;
  }, 0);
}
