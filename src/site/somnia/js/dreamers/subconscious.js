import { recordQuestEvent } from "./quests.js";
import { flashMoment } from "../ui/moment-overlay.js";
import { discardToMindstream, returnDreambeastToMindstreamDeck } from "../cards/mindstream-supply.js";
import { queueRepressFx, queueReturnFx } from "../board/board-fx.js";

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
  if (card.type === "dreambeast" || card.boss || card.type === "boss-dream") return sub.dreambeasts;
  return sub.other;
}

function markFreshlyRepressed(state, card) {
  if (!card?.instanceId) return;
  if (!Array.isArray(state.freshlyRepressedInstanceIds)) state.freshlyRepressedInstanceIds = [];
  if (!state.freshlyRepressedInstanceIds.includes(card.instanceId)) {
    state.freshlyRepressedInstanceIds.push(card.instanceId);
  }
}

/** Clears the same-resolution repress blocklist once return/repress chains finish. */
export function clearFreshlyRepressed(state) {
  if (state) state.freshlyRepressedInstanceIds = [];
}

export function maybeClearFreshlyRepressed(state) {
  if (!state) return;
  if (state.pendingRepress || state.pendingReturn) return;
  if (state.resolutionQueue?.length) return;
  clearFreshlyRepressed(state);
}

function inferRepressDeck(card) {
  if (!card) return null;
  if (card.type === "psyche" || card.type === "psyche-power" || card.type === "wild") return "psyche";
  if (card.type === "dream" || card.type === "boss-dream" || card.type === "final") return "dream";
  const suit = card.mindstreamSuit || card.suit;
  if (suit === "lucidity" || suit === "elasticity" || suit === "willpower") return `mindstream-${suit}`;
  return null;
}

function tileStillHolds(tile, card) {
  const list = Array.isArray(tile?.encounters)
    ? tile.encounters
    : (tile?.encounter ? [tile.encounter] : []);
  return list.some((enc) => enc === card || (card.instanceId && enc?.instanceId === card.instanceId));
}

function resolveRepressOrigin(state, card, origin = {}) {
  if (origin.tileId || origin.playerId || origin.fromDeck) return origin;
  for (const tile of state?.board || []) {
    if (tileStillHolds(tile, card)) return { tileId: tile.id };
  }
  for (const player of state?.players || []) {
    const held = [...(player.hand || []), ...(player.objects || []), ...(player.persistent || [])];
    if (held.includes(card)) return { playerId: player.id };
  }
  return { fromDeck: inferRepressDeck(card) };
}

/** Repress: card goes face-up into the Subconscious. Spent allies go here, not back to Mindstream. */
export function repressCard(state, card, origin = {}) {
  if (!card) return;
  const from = resolveRepressOrigin(state, card, origin);
  state.subconscious = normalizeSubconscious(state.subconscious);
  pileForCard(state.subconscious, card).push(card);
  markFreshlyRepressed(state, card);
  if (typeof document !== "undefined") queueRepressFx(card, from);
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

export function isSubconsciousDreambeast(card) {
  if (!card) return false;
  return card.type === "dreambeast"
    || card.type === "boss"
    || card.type === "boss-dream"
    || card.type === "psyche-dreambeast"
    || card.isDreambeastPsyche
    || !!card.boss;
}

function cardsForReturn(state, filter) {
  const blocked = new Set(state.freshlyRepressedInstanceIds || []);
  const cards = listSubconsciousCards(state).filter((c) => !blocked.has(c.instanceId));
  if (filter === "dreambeast") return cards.filter(isSubconsciousDreambeast);
  return cards;
}

function noteSubconsciousCleared(state, before) {
  if (before <= 0) return;
  if (subconsciousCount(state.subconscious) > 0) return;
  if (state.tutorialMode || state.status !== "playing" || state.pendingDreamReplay) return;
  state.pendingDreamReplay = {
    reason: "The Subconscious is clear. Search the Dream discard and replay one Dream.",
  };
}

export function removeFromSubconscious(state, instanceId) {
  state.subconscious = normalizeSubconscious(state.subconscious);
  const before = subconsciousCount(state.subconscious);
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
      const removed = pile.splice(idx, 1)[0];
      noteSubconsciousCleared(state, before);
      return removed;
    }
  }
  return null;
}

/** Return: remove from Subconscious and place on the matching discard pile. */
export function routeReturnedToDiscard(state, card) {
  if (!card) return;
  if (card.type === "psyche-dreambeast" || card.isDreambeastPsyche) {
    returnDreambeastToMindstreamDeck(state, card);
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
    if (typeof document !== "undefined") queueReturnFx(removed);
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
export function requestReturnCards(state, count, player = null, { filter = null } = {}) {
  if (count <= 0) return [];

  const available = cardsForReturn(state, filter);
  if (!available.length) return [];

  const toReturn = Math.min(count, available.length);

  if (state.openingFateAuto) {
    return finalizeReturn(state, available.slice(0, toReturn));
  }

  if (toReturn === 1 && available.length === 1) {
    return finalizeReturn(state, [available[0]]);
  }

  state.pendingReturn = {
    remaining: toReturn,
    picked: [],
    playerId: player?.id || null,
    filter: filter || null,
    reason: filter === "dreambeast"
      ? `Return ${toReturn} Dreambeast(s) from the Subconscious.`
      : `Return ${toReturn} card(s) from the Subconscious.`,
  };
  return { pending: true, count: toReturn };
}

/** Queue a Return step; processes sequentially when multiple effects fire in one resolution. */
export function enqueueReturnCards(state, count, player = null, { reason = "", filter = null } = {}) {
  if (count <= 0) return [];
  state.resolutionQueue = state.resolutionQueue || [];
  const label = player?.name || "Team";
  state.resolutionQueue.push({
    type: "return",
    count,
    playerId: player?.id || null,
    filter: filter || null,
    reason: reason || (filter === "dreambeast"
      ? `${label}: Return ${count} Dreambeast(s) from the Subconscious.`
      : `${label}: Return ${count} card(s) from the Subconscious.`),
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
  return { queued: true, count };
}

function beginReturnStep(state, step) {
  if (state.openingFateAuto) {
    const available = cardsForReturn(state, step.filter);
    const toReturn = Math.min(step.count || 0, available.length);
    if (toReturn > 0) finalizeReturn(state, available.slice(0, toReturn));
    advanceResolutionQueue(state);
    return;
  }
  const available = cardsForReturn(state, step.filter);
  if (!available.length || step.count <= 0) {
    advanceResolutionQueue(state);
    return;
  }
  const toReturn = Math.min(step.count, available.length);
  if (toReturn === 1 && available.length === 1) {
    finalizeReturn(state, [available[0]]);
    advanceResolutionQueue(state);
    return;
  }
  state.pendingReturn = {
    remaining: toReturn,
    picked: [],
    playerId: step.playerId || null,
    filter: step.filter || null,
    reason: step.reason,
  };
  if (step.reason) {
    try { flashMoment(step.reason); } catch { /* DOM optional in sim */ }
  }
}

export function pickReturnCard(state, instanceId) {
  const pending = state.pendingReturn;
  if (!pending) return false;

  const card = cardsForReturn(state, pending.filter).find((c) => c.instanceId === instanceId);
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

/** Confirm a multi-select Return picker (new card-choice UI). */
export function completeReturnSelection(state) {
  const pending = state.pendingReturn;
  if (!pending || !pending.picked.length) return false;
  finalizeReturn(state, pending.picked.slice(0, pending.remaining));
  state.pendingReturn = null;
  advanceResolutionQueue(state);
  return true;
}

export function toggleReturnPick(state, instanceId) {
  const pending = state.pendingReturn;
  if (!pending) return false;
  const card = cardsForReturn(state, pending.filter).find((c) => c.instanceId === instanceId);
  if (!card) return false;
  const idx = pending.picked.findIndex((c) => c.instanceId === instanceId);
  if (idx >= 0) {
    pending.picked.splice(idx, 1);
    return true;
  }
  if (pending.picked.length >= pending.remaining) return false;
  pending.picked.push(card);
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
  if (source === "objects") return [...(player.objects || []), ...(player.persistent || [])];
  if (source === "hand") return player.hand || [];
  return [];
}

function cardMatchesFilter(card, filter) {
  if (!filter || !card) return true;
  if (filter.payablePsyche && (card.type === "psyche-power" || card.type === "object")) return false;
  if (filter.suit && card.suit !== filter.suit && !(card.wild || card.id?.startsWith("wild-"))) return false;
  return true;
}

function applyCardFilter(cards, filter) {
  let pool = (cards || []).filter((card) => cardMatchesFilter(card, filter));
  if (filter?.highest && pool.length) {
    const max = pool.reduce((best, card) => Math.max(best, card.value || 0), 0);
    pool = pool.filter((card) => (card.value || 0) === max);
  }
  return pool;
}

function aliveHandOwners(state) {
  return state.players.filter((p) => p.alive);
}

function collectiveHandPool(state, filter = null) {
  const pool = [];
  aliveHandOwners(state).forEach((player) => {
    (player.hand || []).forEach((card) => {
      if (cardMatchesFilter(card, filter)) pool.push({ player, card });
    });
  });
  if (filter?.highest && pool.length) {
    const max = pool.reduce((best, entry) => Math.max(best, entry.card.value || 0), 0);
    return pool.filter((entry) => (entry.card.value || 0) === max);
  }
  return pool;
}

/** Cards still in hand that this repress/discard step is allowed to take. */
export function repressPickerCards(state) {
  const pending = state?.pendingRepress;
  if (!pending || pending.confirmEmpty) return [];
  if (pending.collective) {
    return collectiveHandPool(state, pending.cardFilter).map((entry) => entry.card);
  }
  const player = playerById(state, pending.playerId);
  if (!player) return [];
  return applyCardFilter(sourceCards(player, pending.source), pending.cardFilter);
}

function findCollectiveHandCard(state, instanceId) {
  for (const player of aliveHandOwners(state)) {
    const card = (player.hand || []).find((c) => c.instanceId === instanceId);
    if (card) return { player, card };
  }
  return null;
}

function commitHandLoss(state, player, card, toDiscard, toMindstream = false) {
  if (toMindstream) {
    discardToMindstream(state, card);
    return "discard";
  }
  if (toDiscard && !isDreambeastPsycheCard(card)) {
    if (!state.psycheDiscard) state.psycheDiscard = [];
    state.psycheDiscard.push(card);
    return "discard";
  }
  repressCard(state, card, { playerId: player.id });
  return "repress";
}

function psycheAvailable(player) {
  return (player?.hand || []).filter((card) => !isDreambeastPsycheCard(card)).length;
}

function dieIfUnpaidPsyche(state, player) {
  if (!player || psycheAvailable(player) > 0) return false;
  return !!(state.checkPsycheDeath && state.checkPsycheDeath(player, { unpaid: true }));
}

function autoCommitOpeningRepress(state, step) {
  const takeOne = (player, card) => {
    removeFromSource(player, step.source, card.instanceId);
    const kind = commitHandLoss(state, player, card, !!step.toDiscard, !!step.toMindstream);
    if (step.source === "hand") {
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
    }
    logRepress(state, kind === "discard"
      ? `${player.name} Discarded ${card.name}.`
      : `${player.name} Repressed ${card.name} → Subconscious.`);
    if (step.source === "hand" && state.checkPsycheDeath) state.checkPsycheDeath(player);
  };

  let left = step.count || 0;
  if (step.collective && step.source === "hand") {
    while (left > 0) {
      const available = collectiveHandPool(state, step.cardFilter);
      if (!available.length) break;
      takeOne(available[0].player, available[0].card);
      left -= 1;
    }
    return;
  }

  const player = playerById(state, step.playerId);
  if (!player) return;
  while (left > 0) {
    const available = applyCardFilter(sourceCards(player, step.source), step.cardFilter);
    if (!available.length) break;
    takeOne(player, available[0]);
    left -= 1;
  }
}

function beginRepressStep(state, step) {
  if (state.openingFateAuto) {
    autoCommitOpeningRepress(state, step);
    advanceResolutionQueue(state);
    return;
  }
  if (step.collective && step.source === "hand" && (step.count || 0) >= 1) {
    const owners = aliveHandOwners(state);
    if (!owners.some((player) => psycheAvailable(player) > 0)) {
      dieIfUnpaidPsyche(state, owners[0]);
      advanceResolutionQueue(state);
      return;
    }
  }
  if (step.collective && step.source === "hand") {
    const available = collectiveHandPool(state, step.cardFilter);
    const needed = step.count;

    if (needed <= 0 || available.length === 0) {
      state.pendingRepress = {
        source: step.source,
        collective: true,
        playerId: null,
        remaining: needed,
        picked: [],
        reason: step.reason,
        toDiscard: !!step.toDiscard,
        toMindstream: !!step.toMindstream,
        cardFilter: step.cardFilter || null,
        confirmEmpty: true,
      };
      return;
    }

    if (needed === 1 && available.length === 1) {
      const { player, card } = available[0];
      removeFromSource(player, step.source, card.instanceId);
      const kind = commitHandLoss(state, player, card, !!step.toDiscard, !!step.toMindstream);
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
      logRepress(state, kind === "discard"
        ? `Team Discarded ${card.name}.`
        : `Team Repressed ${card.name} → Subconscious.`);
      if (state.checkPsycheDeath) state.checkPsycheDeath(player);
      advanceResolutionQueue(state);
      return;
    }

    state.pendingRepress = {
      source: step.source,
      collective: true,
      playerId: null,
      remaining: needed,
      picked: [],
      reason: step.reason,
      toDiscard: !!step.toDiscard,
      toMindstream: !!step.toMindstream,
      cardFilter: step.cardFilter || null,
      confirmEmpty: false,
    };
    if (step.reason) {
      try { flashMoment(step.reason); } catch { /* DOM optional in sim */ }
    }
    return;
  }

  const player = playerById(state, step.playerId);
  if (!player) {
    advanceResolutionQueue(state);
    return;
  }
  if (step.source === "hand" && (step.count || 0) >= 1 && dieIfUnpaidPsyche(state, player)) {
    advanceResolutionQueue(state);
    return;
  }

  const available = applyCardFilter(sourceCards(player, step.source), step.cardFilter);
  const needed = step.count;

  if (needed <= 0 || available.length === 0) {
    state.pendingRepress = {
      source: step.source,
      playerId: step.playerId,
      remaining: needed,
      picked: [],
      reason: step.reason,
      toDiscard: !!step.toDiscard,
      toMindstream: !!step.toMindstream,
      cardFilter: step.cardFilter || null,
      confirmEmpty: true,
    };
    return;
  }

  if (state.tutorialMode && needed === 1 && available.length >= 1) {
    const card = available.find((c) => c.type === "psyche" && !isDreambeastPsycheCard(c)) || available[0];
    removeFromSource(player, step.source, card.instanceId);
    const kind = commitHandLoss(state, player, card, !!step.toDiscard, !!step.toMindstream);
    if (step.source === "hand") {
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
    }
    logRepress(state, kind === "discard"
      ? `${player.name} Discarded ${card.name}.`
      : `${player.name} Repressed ${card.name} → Subconscious.`);
    if (step.source === "hand" && state.checkPsycheDeath) {
      state.checkPsycheDeath(player);
    }
    advanceResolutionQueue(state);
    return;
  }

  if (needed === 1 && available.length === 1) {
    const card = available[0];
    removeFromSource(player, step.source, card.instanceId);
    const kind = commitHandLoss(state, player, card, !!step.toDiscard, !!step.toMindstream);
    if (step.source === "hand") {
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
    }
    logRepress(state, kind === "discard"
      ? `${player.name} Discarded ${card.name}.`
      : `${player.name} Repressed ${card.name} → Subconscious.`);
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
    toDiscard: !!step.toDiscard,
    toMindstream: !!step.toMindstream,
    cardFilter: step.cardFilter || null,
    confirmEmpty: false,
    strict: !!step.strict,
  };
  if (step.reason) {
    try { flashMoment(step.reason); } catch { /* DOM optional in sim */ }
  }
}

function removeFromSource(player, source, instanceId) {
  if (source === "objects") {
    player.objects = (player.objects || []).filter((c) => c.instanceId !== instanceId);
    player.persistent = (player.persistent || []).filter((c) => c.instanceId !== instanceId);
  } else if (source === "hand") {
    player.hand = player.hand.filter((c) => c.instanceId !== instanceId);
  }
}

export function enqueueRepressObjects(state, player, count, { reason = "", strict = false, toMindstream = false } = {}) {
  state.resolutionQueue = state.resolutionQueue || [];
  state.resolutionQueue.push({
    type: "repress",
    source: "objects",
    playerId: player.id,
    count,
    strict: !!strict,
    toMindstream: !!toMindstream,
    reason: reason || `${player.name}: Repress ${count} Object(s).`,
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
}

export function enqueueDiscardFromHand(state, player, count, { reason = "", strict = false, cardFilter = null } = {}) {
  state.resolutionQueue = state.resolutionQueue || [];
  state.resolutionQueue.push({
    type: "repress",
    source: "hand",
    playerId: player.id,
    count,
    toDiscard: true,
    strict: !!strict,
    cardFilter: cardFilter || null,
    reason: reason || `${player.name}: Discard ${count} Psyche card(s).`,
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
}

export function enqueueRepressFromHand(state, player, count, { reason = "", strict = false } = {}) {
  state.resolutionQueue = state.resolutionQueue || [];
  state.resolutionQueue.push({
    type: "repress",
    source: "hand",
    playerId: player.id,
    count,
    strict: !!strict,
    reason: reason || `${player.name}: Repress ${count} Psyche card(s).`,
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
}

export function enqueueCollectiveRepressFromHand(state, count, { reason = "", toDiscard = false } = {}) {
  state.resolutionQueue = state.resolutionQueue || [];
  state.resolutionQueue.push({
    type: "repress",
    source: "hand",
    collective: true,
    count,
    toDiscard: !!toDiscard,
    strict: true,
    reason: reason || `Team: Repress ${count} Psyche card(s).`,
  });
  if (!state.pendingRepress && !state.pendingReturn) {
    advanceResolutionQueue(state);
  }
}

function advanceResolutionQueue(state) {
  if (state.pendingRepress || state.pendingReturn) return;
  const next = state.resolutionQueue?.shift();
  if (!next) {
    maybeClearFreshlyRepressed(state);
    if (typeof state.onResolutionIdle === "function") {
      const fn = state.onResolutionIdle;
      state.onResolutionIdle = null;
      fn(state);
    }
    return;
  }
  if (next.type === "repress") beginRepressStep(state, next);
  else if (next.type === "return") beginReturnStep(state, next);
}

function unpaidRepressCards(state, pending) {
  const pickedIds = new Set((pending.picked || []).map((card) => card.instanceId));
  return repressPickerCards(state).filter((card) => !pickedIds.has(card.instanceId));
}

/** Stage or unstage a card. Nothing leaves the hand until the cost is confirmed. */
export function toggleRepressPick(state, instanceId) {
  const pending = state.pendingRepress;
  if (!pending || pending.confirmEmpty) return false;
  const pool = repressPickerCards(state);
  const card = pool.find((entry) => entry.instanceId === instanceId);
  if (!card) return false;
  const idx = pending.picked.findIndex((entry) => entry.instanceId === instanceId);
  if (idx >= 0) {
    pending.picked.splice(idx, 1);
    return true;
  }
  if (pending.picked.length >= pending.remaining) return false;
  pending.picked.push(card);
  return true;
}

function commitStagedRepress(state, pending) {
  const touched = [];
  pending.picked.forEach((card) => {
    let player = null;
    if (pending.collective) {
      player = findCollectiveHandCard(state, card.instanceId)?.player || null;
    } else {
      player = playerById(state, pending.playerId);
    }
    if (!player) return;
    removeFromSource(player, pending.source, card.instanceId);
    commitHandLoss(state, player, card, !!pending.toDiscard, !!pending.toMindstream);
    if (pending.source === "hand") {
      recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
    }
    touched.push(player);
  });
  if (pending.source === "hand" && state.checkPsycheDeath) {
    const seen = new Set();
    touched.forEach((player) => {
      if (seen.has(player.id)) return;
      seen.add(player.id);
      state.checkPsycheDeath(player);
    });
  }
}

/**
 * Bots pick one card at a time and expect a full set to resolve immediately.
 * The menu uses toggleRepressPick so the last card stays visible as pending.
 */
export function pickRepressCard(state, instanceId) {
  const pending = state.pendingRepress;
  if (!pending || pending.confirmEmpty) return false;
  if (!pending.picked.some((card) => card.instanceId === instanceId)) {
    if (!toggleRepressPick(state, instanceId)) return false;
  }
  if (pending.picked.length >= pending.remaining || unpaidRepressCards(state, pending).length < 1) {
    return confirmRepressStep(state);
  }
  return true;
}

export function confirmRepressStep(state) {
  const pending = state.pendingRepress;
  if (!pending) return false;

  const player = pending.collective ? null : playerById(state, pending.playerId);
  const subject = pending.collective ? "Team" : player?.name;
  const verb = pending.toMindstream || pending.toDiscard ? "Discard" : "Repress";
  const stillOwed = pending.picked.length < pending.remaining;
  const canStillPay = !pending.confirmEmpty && unpaidRepressCards(state, pending).length > 0;
  if (stillOwed && canStillPay) {
    return false;
  }

  if (!pending.confirmEmpty && pending.picked.length) {
    commitStagedRepress(state, pending);
    const names = pending.picked.map((card) => card.name).join(", ");
    const done = verb === "Discard" ? "Discarded" : "Repressed";
    const where = pending.toMindstream
      ? ""
      : (pending.toDiscard ? "" : " → Subconscious");
    if (subject) {
      const short = pending.picked.length < pending.remaining
        ? ` (${pending.picked.length}/${pending.remaining}, all available)`
        : "";
      logRepress(state, `${subject} ${done} ${names}${where}${short}.`);
    }
  } else if (pending.confirmEmpty && subject) {
    if (pending.remaining <= 0) {
      logRepress(state, `${subject}: nothing to ${verb.toLowerCase()} — continuing.`);
    } else {
      logRepress(state, `${subject}: no ${pending.source === "objects" ? "Objects" : "Psyche"} to ${verb.toLowerCase()} (${pending.picked.length}/${pending.remaining} chosen).`);
    }
  } else if (subject && stillOwed) {
    logRepress(state, `${subject} ${verb === "Discard" ? "Discarded" : "Repressed"} ${pending.picked.length}/${pending.remaining} (all available).`);
  }

  state.pendingRepress = null;
  advanceResolutionQueue(state);
  return true;
}

export function cancelPendingRepress(state) {
  if (!state?.pendingRepress) return false;
  return confirmRepressStep(state);
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

/** Wild Psyche used to mill Mindstream tops; 25.0 mills the Psyche Deck instead. */
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
    { label: "Mindstream Lucidity", cards: sub.mindstream.lucidity, icon: "◉" },
    { label: "Mindstream Elasticity", cards: sub.mindstream.elasticity, icon: "⇄" },
    { label: "Mindstream Willpower", cards: sub.mindstream.willpower, icon: "✊" },
    { label: "Objects", cards: sub.objects, icon: "✦" },
    { label: "Other", cards: sub.other, icon: "?" },
  ].filter((p) => p.cards.length);
}

/** Flat binder order: deck groups left-to-right, then cards within each pile. */
export function subconsciousBinderEntries(state) {
  const filter = state.pendingReturn?.filter;
  return subconsciousPilesForUI(state).flatMap((pile) =>
    pile.cards.map((card) => ({
      card,
      pileLabel: pile.label,
      pileIcon: pile.icon,
    })),
  ).filter((entry) => (filter === "dreambeast" ? isSubconsciousDreambeast(entry.card) : true));
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
