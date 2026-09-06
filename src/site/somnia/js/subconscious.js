import { recordQuestEvent } from "./quests.js";
import { SUIT_LABELS } from "./rules.js";
import { discardToMindstream } from "./mindstream-supply.js";

/** Face-up repressed card piles (The Subconscious / graveyard). */
export function createSubconscious() {
  return {
    psyche: [],
    mindstream: { lucidity: [], elasticity: [], willpower: [] },
    objects: [],
    dreambeasts: [],
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
    + (sub.dreambeasts?.length || 0)
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
  if (!sub.dreambeasts) sub.dreambeasts = [];
  return sub;
}

function pileForCard(sub, card) {
  if (card.type === "psyche-dreambeast" || card.isDreambeastPsyche) return sub.dreambeasts;
  if (card.type === "psyche-power") return sub.other;
  if (card.type === "psyche") return sub.psyche;
  if (
    ["event", "power-token", "draw-dream"].includes(card.type)
    && card.suit
    && sub.mindstream[card.suit]
  ) {
    return sub.mindstream[card.suit];
  }
  if (card.type === "object") return sub.objects;
  if (card.type === "dreambeast" || card.boss) return sub.dreambeasts;
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
    ...(sub.dreambeasts || []),
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
    sub.dreambeasts || [],
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
  if (card.type === "psyche-dreambeast" || card.isDreambeastPsyche) {
    discardToMindstream(state, card);
    return;
  }
  if (card.type === "dreambeast" || card.boss) {
    discardToMindstream(state, card);
    return;
  }
  if (card.type === "event" && card.suit) {
    state.mindstreamDiscard[card.suit]?.push(card);
  } else if (card.type === "object") {
    discardToMindstream(state, card);
  } else if (card.type === "psyche") {
    state.psycheDiscard.push(card);
  } else {
    discardToMindstream(state, card);
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
    reason: `Return ${toReturn} card(s) from the Subconscious.`,
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
    advanceResolutionQueue(state);
    return true;
  }
  return true;
}

export function cancelPendingReturn(state) {
  if (!state.pendingReturn) return;
  const picked = state.pendingReturn.picked;
  if (picked.length) finalizeReturn(state, picked);
  state.pendingReturn = null;
  advanceResolutionQueue(state);
}

// ─── Interactive Repression ───────────────────────────────────────────────

export function hasPendingResolution(state) {
  return !!(
    state.pendingReturn
    || state.pendingRepress
    || (state.resolutionQueue && state.resolutionQueue.length > 0)
  );
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function logRepress(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 40);
}

function sourceCards(player, source) {
  if (source === "objects") return player.objects || [];
  if (source === "hand") return player.hand || [];
  return [];
}

function beginRepressStep(state, step) {
  const player = playerById(state, step.playerId);
  if (!player) {
    advanceResolutionQueue(state);
    return;
  }

  const available = sourceCards(player, step.source);
  const needed = step.count;

  if (needed <= 0 || available.length === 0) {
    state.pendingRepress = {
      source: step.source,
      playerId: step.playerId,
      remaining: needed,
      picked: [],
      reason: step.reason,
      confirmEmpty: true,
    };
    return;
  }

  if (needed === 1 && available.length === 1) {
    const card = available[0];
    removeFromSource(player, step.source, card.instanceId);
    repressCard(state, card);
    if (step.source === "hand") {
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
    }
    logRepress(state, `${player.name} Repressed ${card.name} → Subconscious.`);
    if (step.source === "hand" && state.checkPsycheDeath) {
      state.checkPsycheDeath(player);
    }
    advanceResolutionQueue(state);
    return;
  }

  state.pendingRepress = {
    source: step.source,
    playerId: step.playerId,
    remaining: needed,
    picked: [],
    reason: step.reason,
    confirmEmpty: false,
  };
}

function removeFromSource(player, source, instanceId) {
  if (source === "objects") {
    player.objects = player.objects.filter((c) => c.instanceId !== instanceId);
  } else if (source === "hand") {
    player.hand = player.hand.filter((c) => c.instanceId !== instanceId);
  }
}

export function enqueueRepressObjects(state, player, count, { reason = "" } = {}) {
  state.resolutionQueue = state.resolutionQueue || [];
  state.resolutionQueue.push({
    type: "repress",
    source: "objects",
    playerId: player.id,
    count,
    reason: reason || `${player.name}: Repress ${count} Object(s).`,
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
}

export function enqueueRepressFromHand(state, player, count, { reason = "" } = {}) {
  state.resolutionQueue = state.resolutionQueue || [];
  state.resolutionQueue.push({
    type: "repress",
    source: "hand",
    playerId: player.id,
    count,
    reason: reason || `${player.name}: Repress ${count} Psyche card(s).`,
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
}

function advanceResolutionQueue(state) {
  if (state.pendingRepress || state.pendingReturn) return;
  const next = state.resolutionQueue?.shift();
  if (!next) return;
  if (next.type === "repress") beginRepressStep(state, next);
}

export function pickRepressCard(state, instanceId) {
  const pending = state.pendingRepress;
  if (!pending || pending.confirmEmpty) return false;

  const player = playerById(state, pending.playerId);
  if (!player) return false;

  const pool = sourceCards(player, pending.source);
  const card = pool.find((c) => c.instanceId === instanceId);
  if (!card || pending.picked.some((c) => c.instanceId === instanceId)) return false;
  if (pending.picked.length >= pending.remaining) return false;

  removeFromSource(player, pending.source, instanceId);
  repressCard(state, card);
  pending.picked.push(card);
  if (pending.source === "hand") {
    recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
  }

  if (pending.picked.length >= pending.remaining) {
    const names = pending.picked.map((c) => c.name).join(", ");
    logRepress(state, `${player.name} Repressed ${pending.picked.length} card(s): ${names}.`);
    state.pendingRepress = null;
    if (pending.source === "hand" && state.checkPsycheDeath) {
      state.checkPsycheDeath(player);
    }
    advanceResolutionQueue(state);
  }
  return true;
}

export function confirmRepressStep(state) {
  const pending = state.pendingRepress;
  if (!pending) return;

  const player = playerById(state, pending.playerId);
  if (pending.confirmEmpty && player) {
    if (pending.remaining <= 0) {
      logRepress(state, `${player.name}: nothing to Repress — continuing.`);
    } else {
      logRepress(state, `${player.name}: no ${pending.source === "objects" ? "Objects" : "Psyche"} to Repress (${pending.picked.length}/${pending.remaining} chosen).`);
    }
  } else if (player && pending.picked.length < pending.remaining) {
    logRepress(state, `${player.name} Repressed ${pending.picked.length}/${pending.remaining} (all available).`);
  }

  state.pendingRepress = null;
  advanceResolutionQueue(state);
}

export function cancelPendingRepress(state) {
  state.pendingRepress = null;
  advanceResolutionQueue(state);
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

/** Wild Psyche cost: repress top card of each Mindstream deck. */
export function repressTopMindstreamFromEachDeck(state) {
  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    const deck = state.mindstreamDecks?.[suit];
    if (deck?.length) {
      repressCard(state, deck.shift());
    }
  });
}

export function subconsciousPilesForUI(state) {
  state.subconscious = normalizeSubconscious(state.subconscious);
  const sub = state.subconscious;
  return [
    { label: "Psyche", cards: sub.psyche, icon: "🃏" },
    { label: "Dreambeasts", cards: sub.dreambeasts || [], icon: "⚔" },
    { label: `Mindstream ${SUIT_LABELS.lucidity}`, cards: sub.mindstream.lucidity, icon: "◉" },
    { label: `Mindstream ${SUIT_LABELS.elasticity}`, cards: sub.mindstream.elasticity, icon: "⇄" },
    { label: `Mindstream ${SUIT_LABELS.willpower}`, cards: sub.mindstream.willpower, icon: "✊" },
    { label: "Objects", cards: sub.objects, icon: "✦" },
    { label: "Other", cards: sub.other, icon: "?" },
  ].filter((p) => p.cards.length);
}

/** Convert an accepted Encounter into a hand card worth 3 Psyche in its suit. */
export function dreambeastToHandCard(encounter) {
  const suit = encounter.suit || "willpower";
  return {
    ...encounter,
    type: "psyche-dreambeast",
    isDreambeastPsyche: true,
    value: 3,
    psycheValue: 3,
    suit,
    name: encounter.name,
  };
}

export function isDreambeastPsycheCard(card) {
  return card?.type === "psyche-dreambeast" || card?.isDreambeastPsyche;
}
