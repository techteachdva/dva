import { recordQuestEvent } from "./quests.js";

/** Face-up repressed card piles (The Subconscious / game box). */
export function createSubconscious() {
  return {
    psyche: [],
    mindstream: { lucidity: [], elasticity: [], willpower: [] },
    objects: [],
    other: [],
  };
}

export function subconsciousCount(sub) {
  if (!sub) return 0;
  if (Array.isArray(sub)) return sub.length;
  return (
    sub.psyche.length
    + sub.mindstream.lucidity.length
    + sub.mindstream.elasticity.length
    + sub.mindstream.willpower.length
    + sub.objects.length
    + sub.other.length
  );
}

export function normalizeSubconscious(sub) {
  if (!sub || Array.isArray(sub)) {
    const structured = createSubconscious();
    (sub || []).forEach((card) => repressCard({ subconscious: structured }, card));
    return structured;
  }
  if (!sub.mindstream) sub.mindstream = { lucidity: [], elasticity: [], willpower: [] };
  return sub;
}

function pileForCard(sub, card) {
  if (card.type === "psyche") return sub.psyche;
  if (card.type === "event" && card.suit && sub.mindstream[card.suit]) {
    return sub.mindstream[card.suit];
  }
  if (card.type === "object") return sub.objects;
  return sub.other;
}

/** Repress: card goes face-up into the Subconscious. */
export function repressCard(state, card) {
  if (!card) return;
  state.subconscious = normalizeSubconscious(state.subconscious);
  pileForCard(state.subconscious, card).push(card);
}

export function repressCards(state, cards) {
  cards.forEach((c) => repressCard(state, c));
}

export function listSubconsciousCards(state) {
  state.subconscious = normalizeSubconscious(state.subconscious);
  const sub = state.subconscious;
  return [
    ...sub.psyche,
    ...sub.mindstream.lucidity,
    ...sub.mindstream.elasticity,
    ...sub.mindstream.willpower,
    ...sub.objects,
    ...sub.other,
  ];
}

export function removeFromSubconscious(state, instanceId) {
  state.subconscious = normalizeSubconscious(state.subconscious);
  const sub = state.subconscious;
  const piles = [
    sub.psyche,
    sub.mindstream.lucidity,
    sub.mindstream.elasticity,
    sub.mindstream.willpower,
    sub.objects,
    sub.other,
  ];
  for (const pile of piles) {
    const idx = pile.findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) {
      return pile.splice(idx, 1)[0];
    }
  }
  return null;
}

/** Return: remove from Subconscious and place on the matching discard pile. */
export function routeReturnedToDiscard(state, card) {
  if (!card) return;
  if (card.type === "event" && card.suit) {
    state.mindstreamDiscard[card.suit]?.push(card);
  } else if (card.type === "object") {
    state.objectDiscard.push(card);
  } else if (card.type === "psyche") {
    state.psycheDiscard.push(card);
  } else {
    state.objectDiscard.push(card);
  }
}

export function finalizeReturn(state, cards, { log = true } = {}) {
  const returned = [];
  cards.forEach((card) => {
    const removed = removeFromSubconscious(state, card.instanceId) || card;
    routeReturnedToDiscard(state, removed);
    returned.push(removed);
  });
  if (returned.length) {
    recordQuestEvent(state, "return_cards", { count: returned.length });
    if (log) {
      const names = returned.map((c) => c.name || `${c.suit} ${c.value}`).join(", ");
      state.log.unshift(`Returned ${returned.length} from Subconscious: ${names}.`);
      state.log = state.log.slice(0, 40);
    }
  }
  return returned;
}

/**
 * Request Return of N cards. Opens picker when choice matters; auto-returns if only one option.
 * @returns {{ pending: true, count: number } | Card[]}
 */
export function requestReturnCards(state, count, player = null) {
  if (count <= 0) return [];

  const available = listSubconsciousCards(state);
  if (!available.length) return [];

  const toReturn = Math.min(count, available.length);

  if (toReturn === 1 && available.length === 1) {
    return finalizeReturn(state, [available[0]]);
  }

  state.pendingReturn = {
    remaining: toReturn,
    picked: [],
    playerId: player?.id || null,
  };
  return { pending: true, count: toReturn };
}

export function pickReturnCard(state, instanceId) {
  const pending = state.pendingReturn;
  if (!pending) return false;

  const card = listSubconsciousCards(state).find((c) => c.instanceId === instanceId);
  if (!card || pending.picked.some((c) => c.instanceId === instanceId)) return false;

  pending.picked.push(card);
  if (pending.picked.length >= pending.remaining) {
    finalizeReturn(state, pending.picked);
    state.pendingReturn = null;
    return true;
  }
  return true;
}

export function cancelPendingReturn(state) {
  if (!state.pendingReturn) return;
  const picked = state.pendingReturn.picked;
  if (picked.length) finalizeReturn(state, picked);
  state.pendingReturn = null;
}

export function repressFromMindstreamSetup(state, suit, playerCount) {
  const perPlayer = playerCount * 3;
  const deck = state.mindstreamDecks[suit];
  if (!deck) return;
  state.subconscious = normalizeSubconscious(state.subconscious);
  for (let i = 0; i < perPlayer && deck.length; i += 1) {
    repressCard(state, deck.shift());
  }
}

export function subconsciousPilesForUI(state) {
  state.subconscious = normalizeSubconscious(state.subconscious);
  const sub = state.subconscious;
  return [
    { label: "Psyche", cards: sub.psyche },
    { label: "Mindstream ◆", cards: sub.mindstream.lucidity },
    { label: "Mindstream ◇", cards: sub.mindstream.elasticity },
    { label: "Mindstream ▲", cards: sub.mindstream.willpower },
    { label: "Objects", cards: sub.objects },
    { label: "Other", cards: sub.other },
  ].filter((p) => p.cards.length);
}
