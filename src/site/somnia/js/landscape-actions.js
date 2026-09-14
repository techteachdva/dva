import {
  addLog,
  drawPsycheForPlayer,
  drawMindstream,
  landscapeById,
  setEncounterOnLandscape,
  rememberRevealedTops,
} from "./state.js";
import { requestChooseTile } from "./landscapes.js";
import { SUIT_LABELS } from "./rules.js";
import { grantPowerTokens, spendPowerTokens } from "./power-tokens.js";
import { queueMindstreamDrawFx, queueMindstreamDiscardFx } from "./board-fx.js";
import { adjacentTiles, hexDistance } from "./hex.js";
import {
  listSubconsciousCards,
  requestReturnCards,
  finalizeReturn,
} from "./subconscious.js";
import {
  encounterFromDreambeastCard,
  reshuffleMindstreamDiscardIfNeeded,
  reorderMindstreamTop,
} from "./mindstream-supply.js";
import { recordQuestEvent } from "./quests.js";
import { shuffle } from "./data.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import { recordCancellableMove } from "./dreamer-powers.js";

export const LANDSCAPE_ACTION_DEFS = {
  "draw-mindstream": {
    label: "Draw Mindstream",
    description: "Draw 1 card from this Landscape's matching Mindstream deck.",
  },
  "spawn-dreambeast": {
    label: "Spawn Dreambeast",
    description: "Choose a Mindstream deck; draw until you find a Dreambeast and place it on a matching-suit Landscape.",
  },
  "swap-psyche": {
    label: "Swap 2 Psyche",
    description: "Swap Psyche cards between two Dreamers.",
  },
  "move-2-dreamers-1": {
    label: "Move 2 Dreamers",
    description: "Move 2 Dreamers 1 Landscape in any direction.",
  },
  "swap-landscapes": {
    label: "Swap Landscapes",
    description: "Swap the positions of 2 Landscapes on the Dreamscape.",
  },
  "move-1-dreamer-2": {
    label: "Move 1 Dreamer",
    description: "Move 1 Dreamer 2 Landscapes in any direction.",
  },
  "move-2-dreambeasts-1": {
    label: "Move 2 Dreambeasts",
    description: "Move 2 Dreambeasts 1 Landscape in any direction.",
  },
  "all-toward-bed": {
    label: "Toward Bed",
    description: "All Dreamers move 1 Landscape toward The Bed.",
  },
  "swap-archetypes": {
    label: "Swap Archetypes",
    description: "Swap the Active Archetype with the next Archetype in the deck.",
  },
  "take-power": {
    label: "Take Power",
    description: "Take 1 Power Token from the pool.",
  },
  "swap-dreambeasts": {
    label: "Swap Dreambeasts",
    description: "Swap 2 active Dreambeasts between Landscapes.",
  },
  "draw-2-keep-1": {
    label: "Draw 2, Keep 1",
    description: "Draw 2 cards from any deck; keep 1 and discard the other.",
  },
  "draw-any-mindstream": {
    label: "Draw Any Mindstream",
    description: "Draw 1 card from any Mindstream deck of your choice.",
  },
  "return-2": {
    label: "Return 2 Cards",
    description: "Return 2 cards of your choice from the Subconscious.",
  },
  "flip-top-3": {
    label: "Flip Top 3",
    description: "Flip the top 3 cards of any deck (view before drawing).",
  },
  "cycle-psyche": {
    label: "Cycle Psyche",
    description: "Discard a Psyche card, then draw Psyche equal to its value.",
  },
  "return-psyche": {
    label: "Return Psyche",
    description: "Return 1 Psyche card from the Subconscious.",
  },
  "power-draw-psyche": {
    label: "Power for Psyche",
    description: "Discard 1 Power Token, then Draw 3 Psyche.",
  },
  "replay-dream": {
    label: "Replay Dream",
    description: "Take the last discarded Dream and resolve it again.",
  },
  "return-1": {
    label: "Return 1 Card",
    description: "Return 1 card of your choice from the Subconscious.",
  },
  "return-event": {
    label: "Return Event",
    description: "Return 1 Event from the Subconscious.",
  },
  "return-object": {
    label: "Return Object",
    description: "Return 1 Object from the Subconscious.",
  },
  "draw-3-psyche": {
    label: "Draw 3 Psyche",
    description: "Draw 3 Psyche cards from the Psyche deck.",
  },
  "bed-spend-10-draw-3": {
    label: "Spend 10 Psyche → Draw 3",
    description: "Spend Psyche cards totaling 10 from hand, then Draw 3 Psyche.",
  },
};

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function stepTowardBed(state, player) {
  const bed = landscapeById(state, "bed");
  const current = landscapeById(state, player.landscapeId);
  if (!bed || !current || current.id === "bed") return false;

  const adj = adjacentTiles(state, current.id).filter((t) => t.revealed);
  if (!adj.length) return false;

  adj.sort((a, b) => hexDistance(a, bed) - hexDistance(b, bed));
  const dest = adj[0];
  if (hexDistance(dest, bed) >= hexDistance(current, bed)) return false;

  const fromId = player.landscapeId;
  player.landscapeId = dest.id;
  recordCancellableMove(state, player, fromId, dest.id);
  addLog(state, `${player.name} moves toward The Bed (${dest.name}).`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

function destinationsAtSteps(state, startId, steps) {
  let frontier = [startId];
  const seen = new Set([startId]);
  for (let i = 0; i < steps; i += 1) {
    const next = [];
    frontier.forEach((id) => {
      adjacentTiles(state, id).forEach((t) => {
        if (!t.revealed || seen.has(t.id)) return;
        seen.add(t.id);
        next.push(t.id);
      });
    });
    frontier = next;
    if (!frontier.length) break;
  }
  return frontier.filter((id) => id !== startId);
}

function moveDreamerSteps(state, player, steps) {
  const destIds = destinationsAtSteps(state, player.landscapeId, steps);
  if (!destIds.length) return false;
  if (state.tutorialMode) {
    const dest = landscapeById(state, destIds[Math.floor(Math.random() * destIds.length)]);
    if (!dest) return false;
    player.landscapeId = dest.id;
    addLog(state, `${player.name} moves ${steps} Landscape(s) to ${dest.name}.`);
    recordQuestEvent(state, "move_player", { count: steps });
    return true;
  }
  return requestChooseTile(state, {
    allowedIds: destIds,
    action: "movePlayer",
    playerId: player.id,
    title: `Move ${player.name} ${steps} step${steps === 1 ? "" : "s"}`,
    detail: `Choose a Landscape ${steps} step${steps === 1 ? "" : "s"} away.`,
  });
}

function moveEncounterOneStep(state, tile) {
  if (!tile?.encounter) return false;
  const adj = adjacentTiles(state, tile.id).filter((t) => t.revealed && !t.encounter);
  if (!adj.length) return false;
  if (state.tutorialMode) {
    const dest = adj[Math.floor(Math.random() * adj.length)];
    const enc = tile.encounter;
    tile.encounter = null;
    setEncounterOnLandscape(state, dest.id, enc);
    addLog(state, `${enc.name} moves to ${dest.name}.`);
    return true;
  }
  return requestChooseTile(state, {
    allowedIds: adj.map((t) => t.id),
    action: "moveEncounter",
    fromTileId: tile.id,
    title: `Move ${tile.encounter.name}`,
    detail: `Choose an adjacent empty Landscape for ${tile.encounter.name}.`,
  });
}

function swapTilePositions(tileA, tileB) {
  const q = tileA.q;
  const r = tileA.r;
  tileA.q = tileB.q;
  tileA.r = tileB.r;
  tileB.q = q;
  tileB.r = r;
}

function subconsciousOfType(state, type) {
  state.subconscious = state.subconscious || { psyche: [], objects: [], dreambeasts: [], other: [], mindstream: { lucidity: [], elasticity: [], willpower: [] } };
  const sub = state.subconscious;
  if (type === "psyche") return sub.psyche || [];
  if (type === "object") return sub.objects || [];
  if (type === "event") {
    return [
      ...(sub.mindstream?.lucidity || []),
      ...(sub.mindstream?.elasticity || []),
      ...(sub.mindstream?.willpower || []),
    ].filter((c) => c.type === "event");
  }
  return listSubconsciousCards(state);
}

function returnTypedCard(state, type, count = 1) {
  const pool = type ? subconsciousOfType(state, type) : listSubconsciousCards(state);
  if (!pool.length) {
    addLog(state, type ? `No ${type} cards in the Subconscious.` : "The Subconscious is empty.");
    return { ok: false };
  }
  if (pool.length <= count) {
    finalizeReturn(state, pool.slice(0, count));
    return { ok: true };
  }
  const result = requestReturnCards(state, count);
  if (result?.pending) return { pending: true };
  return { ok: true };
}

function spawnDreambeastFromMindstream(state, suit) {
  reshuffleMindstreamDiscardIfNeeded(state, suit);
  const deck = state.mindstreamDecks[suit];
  const drawn = [];
  let beast = null;

  while (deck.length) {
    const card = deck.shift();
    drawn.push(card);
    if (card.type === "dreambeast" && !card.boss) {
      beast = card;
      break;
    }
  }

  drawn.filter((c) => c !== beast).forEach((c) => state.mindstreamDiscard[suit].push(c));
  if (!beast) {
    addLog(state, `No Dreambeast found in ${SUIT_LABELS[suit]} Mindstream.`);
    return null;
  }

  const targets = state.board.filter((t) => t.revealed && t.suit === suit && !t.encounter);
  if (!targets.length) {
    state.mindstreamDiscard[suit].push(beast);
    addLog(state, `No open ${SUIT_LABELS[suit]} Landscape for ${beast.name}.`);
    return null;
  }

  const encounter = encounterFromDreambeastCard(beast);
  if (state.tutorialMode || targets.length === 1) {
    const tile = targets[Math.floor(Math.random() * targets.length)];
    setEncounterOnLandscape(state, tile.id, encounter);
    addLog(state, `${beast.name} spawns on ${tile.name} from the ${SUIT_LABELS[suit]} Mindstream.`);
    return encounter;
  }
  requestChooseTile(state, {
    allowedIds: targets.map((t) => t.id),
    action: "spawnEncounter",
    encounter,
    title: `${beast.name} emerges`,
    detail: `Choose a ${SUIT_LABELS[suit]} Landscape for ${beast.name}.`,
  });
  return encounter;
}

function drawTwoKeepOne(state, player, helpers) {
  const options = [];
  if (state.psycheDeck.length >= 2) {
    options.push({ deck: "psyche", cards: state.psycheDeck.slice(0, 2) });
  }
  for (const suit of ["lucidity", "elasticity", "willpower"]) {
    reshuffleMindstreamDiscardIfNeeded(state, suit);
    if (state.mindstreamDecks[suit].length >= 2) {
      options.push({ deck: `mindstream-${suit}`, suit, cards: state.mindstreamDecks[suit].slice(0, 2) });
    }
  }
  if (state.dreamDeck.length >= 2) {
    options.push({ deck: "dream", cards: state.dreamDeck.slice(0, 2) });
  }

  if (!options.length) {
    addLog(state, "No deck has 2 cards to draw from.");
    return null;
  }

  const pick = options[Math.floor(Math.random() * options.length)];
  const [a, b] = pick.cards;
  let keep = a;
  let discard = b;

  if (pick.deck === "psyche") {
    state.psycheDeck.shift();
    state.psycheDeck.shift();
    player.hand.push(keep);
    state.psycheDiscard.push(discard);
    addLog(state, `Drew 2 Psyche on ${landscapeById(state, player.landscapeId)?.name}: kept ${keep.value}, discarded ${discard.value}.`);
    recordQuestEvent(state, "draw_psyche", { count: 1 });
    return keep;
  }

  if (pick.deck.startsWith("mindstream-")) {
    const suit = pick.suit;
    const deck = state.mindstreamDecks[suit];
    deck.shift();
    deck.shift();
    addLog(state, `Drew 2 ${SUIT_LABELS[suit]} Mindstream: kept ${keep.name}, discarded ${discard.name}.`);
    if (keep.type === "dreambeast") {
      helpers.spawnEncounter(state, player.landscapeId, keep);
    } else if (helpers.resolveCardEffect) {
      helpers.resolveCardEffect(state, keep, player, helpers);
      if (keep.type !== "object" && keep.type !== "dreambeast") {
        state.mindstreamDiscard[suit].push(keep);
      }
    }
    state.mindstreamDiscard[suit].push(discard);
    return keep;
  }

  state.dreamDeck.shift();
  state.dreamDeck.shift();
  addLog(state, `Drew 2 Dreams: resolving ${keep.name}, discarding ${discard.name}.`);
  state.dreamDiscard.push(discard);
  if (helpers.resolveCardEffect) {
    helpers.resolveCardEffect(state, keep, player, helpers);
  }
  return keep;
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function rememberLandscapeHelpers(helpers) {
  if (helpers) stateLandscapeHelpers = helpers;
  return stateLandscapeHelpers;
}

let stateLandscapeHelpers = null;

function beginSwapPsyche(state, player) {
  const players = alivePlayers(state).filter((p) => p.hand.length >= 1);
  if (players.length < 2) {
    addLog(state, "Need 2 Dreamers with Psyche to swap.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    const [a, b] = shuffle(players).slice(0, 2);
    const cardA = a.hand.pop();
    const cardB = b.hand.pop();
    a.hand.push(cardB);
    b.hand.push(cardA);
    addLog(state, `Swapped Psyche between ${a.name} and ${b.name}.`);
    return { ok: true };
  }
  offerEffectChoice(state, player, {
    cardId: "landscape-action",
    title: "Swap 2 Psyche",
    message: "Choose the first Dreamer.",
    choices: players.map((p) => ({ id: p.id, label: p.name })),
    payload: { actionId: "swap-psyche", step: "pick-a" },
  });
  return { ok: true, pending: true };
}

function beginMoveTwoDreamers(state, player) {
  const movers = alivePlayers(state);
  if (!movers.length) return { ok: false };
  if (state.tutorialMode) {
    shuffle(movers).slice(0, 2).forEach((p) => {
      const current = landscapeById(state, p.landscapeId);
      const adj = adjacentTiles(state, current.id).filter((t) => t.revealed);
      if (!adj.length) return;
      const dest = adj[Math.floor(Math.random() * adj.length)];
      const fromId = p.landscapeId;
      p.landscapeId = dest.id;
      recordCancellableMove(state, p, fromId, dest.id);
      addLog(state, `${p.name} moves to ${dest.name}.`);
      recordQuestEvent(state, "move_player", { count: 1 });
    });
    return { ok: true };
  }
  offerEffectChoice(state, player, {
    cardId: "landscape-action",
    title: "Move 2 Dreamers",
    message: "Choose the first Dreamer to move.",
    choices: movers.map((p) => ({ id: p.id, label: `${p.name} (${landscapeById(state, p.landscapeId)?.name || "map"})` })),
    payload: { actionId: "move-2-dreamers-1", remaining: 2, moved: [] },
  });
  return { ok: true, pending: true };
}

function continueMoveDreamer(state, playerId, remaining, moved) {
  const mover = playerById(state, playerId);
  const current = landscapeById(state, mover?.landscapeId);
  const adj = current ? adjacentTiles(state, current.id).filter((t) => t.revealed) : [];
  if (!mover || !adj.length) {
    addLog(state, `${mover?.name || "That Dreamer"} has no adjacent Landscape.`);
    presentNextDreamerMove(state, remaining, moved);
    return;
  }
  requestChooseTile(state, {
    allowedIds: adj.map((t) => t.id),
    action: "movePlayer",
    playerId: mover.id,
    title: `Move ${mover.name}`,
    detail: "Choose an adjacent revealed Landscape.",
    followup: { landscapeAction: "move-2-dreamers-1", remaining, moved: [...moved, mover.id] },
  });
}

function presentNextDreamerMove(state, remaining, moved) {
  const left = Math.max(0, remaining - 1);
  if (left <= 0) return;
  const actor = alivePlayers(state)[0];
  const choices = alivePlayers(state)
    .filter((p) => !moved.includes(p.id))
    .map((p) => ({ id: p.id, label: `${p.name} (${landscapeById(state, p.landscapeId)?.name || "map"})` }));
  if (!choices.length || !actor) return;
  offerEffectChoice(state, actor, {
    cardId: "landscape-action",
    title: "Move 2 Dreamers",
    message: "Choose another Dreamer to move.",
    choices,
    payload: { actionId: "move-2-dreamers-1", remaining: left, moved },
  });
}

function beginSwapLandscapes(state, player) {
  const swapables = state.board.filter((t) => t.revealed && !t.center);
  if (swapables.length < 2) {
    addLog(state, "Not enough Landscapes to swap.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    const [a, b] = shuffle(swapables).slice(0, 2);
    swapTilePositions(a, b);
    addLog(state, `Swapped positions of ${a.name} and ${b.name}.`);
    return { ok: true };
  }
  requestChooseTile(state, {
    allowedIds: swapables.map((t) => t.id),
    action: "record",
    remaining: 2,
    title: "Swap Landscapes",
    detail: "Choose 2 Landscapes to swap.",
    followup: { landscapeAction: "swap-landscapes" },
  });
  return { ok: true, pending: true };
}

function beginMoveTwoDreambeasts(state) {
  const withEnc = state.board.filter((t) => t.encounter);
  if (!withEnc.length) {
    addLog(state, "No Dreambeasts to move.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    shuffle(withEnc).slice(0, 2).forEach((t) => moveEncounterOneStep(state, t));
    return { ok: true };
  }
  offerBeastMove(state, withEnc, 2, []);
  return { ok: true, pending: true };
}

function offerBeastMove(state, tiles, remaining, movedIds) {
  const actor = alivePlayers(state)[0];
  const choices = tiles
    .filter((t) => !movedIds.includes(t.id))
    .map((t) => ({ id: t.id, label: `${t.encounter.name} on ${t.name}` }));
  if (!choices.length || remaining <= 0) return;
  offerEffectChoice(state, actor, {
    cardId: "landscape-action",
    title: "Move Dreambeasts",
    message: "Choose a Dreambeast to move 1 Landscape.",
    choices,
    payload: { actionId: "move-2-dreambeasts-1", remaining, movedIds },
  });
}

function beginSwapDreambeasts(state) {
  const withEnc = state.board.filter((t) => t.encounter);
  if (withEnc.length < 2) {
    addLog(state, "Need 2 active Dreambeasts to swap.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    const [a, b] = shuffle(withEnc).slice(0, 2);
    const encA = a.encounter;
    const encB = b.encounter;
    a.encounter = encB;
    b.encounter = encA;
    addLog(state, `Swapped ${encA.name} and ${encB.name}.`);
    return { ok: true };
  }
  requestChooseTile(state, {
    allowedIds: withEnc.map((t) => t.id),
    action: "record",
    remaining: 2,
    title: "Swap Dreambeasts",
    detail: "Choose 2 Dreambeasts to swap.",
    followup: { landscapeAction: "swap-dreambeasts" },
  });
  return { ok: true, pending: true };
}

function beginDrawTwoKeepOne(state, player, helpers) {
  rememberLandscapeHelpers(helpers);
  const options = [];
  if (state.psycheDeck.length >= 2) options.push({ id: "psyche", label: "Psyche deck" });
  for (const suit of ["lucidity", "elasticity", "willpower"]) {
    reshuffleMindstreamDiscardIfNeeded(state, suit);
    if (state.mindstreamDecks[suit].length >= 2) {
      options.push({ id: `mindstream-${suit}`, label: `${SUIT_LABELS[suit]} Mindstream` });
    }
  }
  if (state.dreamDeck.length >= 2) options.push({ id: "dream", label: "Dream deck" });
  if (!options.length) {
    addLog(state, "No deck has 2 cards to draw from.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    drawTwoKeepOne(state, player, helpers);
    return { ok: true };
  }
  offerEffectChoice(state, player, {
    cardId: "landscape-action",
    title: "Draw 2, Keep 1",
    message: "Choose a deck.",
    choices: options,
    payload: { actionId: "draw-2-keep-1", step: "pick-deck" },
  });
  return { ok: true, pending: true };
}

function beginCyclePsyche(state, player, tile) {
  if (!player.hand.length) {
    addLog(state, "No Psyche to cycle.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    const card = player.hand.reduce((best, c) => ((c.value || 0) > (best.value || 0) ? c : best), player.hand[0]);
    const idx = player.hand.findIndex((c) => c.instanceId === card.instanceId);
    if (idx >= 0) player.hand.splice(idx, 1);
    state.psycheDiscard.push(card);
    const drawn = drawPsycheForPlayer(state, player, card.value || 1);
    addLog(state, `Cycled ${card.suit} ${card.value || 1} for ${drawn.length} Psyche.`);
    recordQuestEvent(state, "draw_psyche", { count: drawn.length });
    if (tile.id === "bed") recordQuestEvent(state, "psyche_cycle_bed");
    return { ok: true };
  }
  offerEffectChoice(state, player, {
    cardId: "landscape-action",
    ui: "spend",
    title: "Cycle Psyche",
    message: `${player.name}: discard 1 Psyche, then draw that many.`,
    cards: player.hand,
    needCount: 1,
    payload: { actionId: "cycle-psyche", tileId: tile.id },
  });
  return { ok: true, pending: true };
}

function applyKeptDraw(state, player, deckId, keep, discard) {
  const helpers = rememberLandscapeHelpers();
  if (deckId === "psyche") {
    player.hand.push(keep);
    state.psycheDiscard.push(discard);
    addLog(state, `Kept Psyche ${keep.value}, discarded ${discard.value}.`);
    recordQuestEvent(state, "draw_psyche", { count: 1 });
    return;
  }
  if (deckId === "dream") {
    state.dreamDiscard.push(discard);
    addLog(state, `Resolving ${keep.name}; discarded ${discard.name}.`);
    helpers?.resolveCardEffect?.(state, keep, player, helpers);
    return;
  }
  const suit = deckId.replace("mindstream-", "");
  state.mindstreamDiscard[suit]?.push(discard);
  addLog(state, `Kept ${keep.name}; discarded ${discard.name}.`);
  helpers?.resolveCardEffect?.(state, keep, player, helpers);
  if (keep.type !== "object" && keep.type !== "dreambeast") {
    state.mindstreamDiscard[suit]?.push(keep);
  }
}

registerEffectResolver("landscape-action", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const actionId = pending?.payload?.actionId;
  const player = playerById(state, pending?.playerId);

  if (actionId === "cycle-psyche") {
    if (choiceId !== "confirm") {
      const order = pending.order || [];
      const idx = order.indexOf(choiceId);
      if (idx >= 0) pending.order = order.filter((id) => id !== choiceId);
      else pending.order = [...order, choiceId].slice(-1);
      return true;
    }
    const card = (pending.cards || []).find((c) => pending.order?.includes(c.instanceId));
    state.pendingEffectChoice = null;
    if (player && card) {
      player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
      state.psycheDiscard.push(card);
      const drawn = drawPsycheForPlayer(state, player, card.value || 1);
      addLog(state, `${player.name} cycled ${card.suit} ${card.value || 1} for ${drawn.length} Psyche.`);
      recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      if (pending.payload?.tileId === "bed") recordQuestEvent(state, "psyche_cycle_bed");
    }
    return true;
  }

  if (actionId === "draw-2-keep-1" && pending.payload?.step === "pick-keep") {
    const cards = pending.cards || [];
    const keep = cards.find((c) => (c.instanceId || c.id) === choiceId) || cards[0];
    const discard = cards.find((c) => c !== keep);
    state.pendingEffectChoice = null;
    if (player && keep) applyKeptDraw(state, player, pending.payload.deckId, keep, discard);
    return true;
  }

  if (actionId === "draw-2-keep-1") {
    state.pendingEffectChoice = null;
    if (!player) return false;
    let drawn = [];
    if (choiceId === "psyche") drawn = [state.psycheDeck.shift(), state.psycheDeck.shift()];
    else if (choiceId === "dream") drawn = [state.dreamDeck.shift(), state.dreamDeck.shift()];
    else if (choiceId.startsWith("mindstream-")) {
      const suit = choiceId.replace("mindstream-", "");
      drawn = [state.mindstreamDecks[suit].shift(), state.mindstreamDecks[suit].shift()];
    }
    drawn = drawn.filter(Boolean);
    if (drawn.length < 2) {
      addLog(state, "Could not draw 2 cards from that deck.");
      return true;
    }
    offerEffectChoice(state, player, {
      cardId: "landscape-action",
      ui: "cards",
      title: "Draw 2, Keep 1",
      message: "Choose which card to keep.",
      cards: drawn,
      payload: { actionId: "draw-2-keep-1", step: "pick-keep", deckId: choiceId },
    });
    return true;
  }

  if (actionId === "swap-psyche") {
    if (pending.payload.step === "pick-a") {
      pending.payload.firstId = choiceId;
      pending.payload.step = "pick-b";
      pending.message = "Choose the second Dreamer.";
      pending.choices = alivePlayers(state)
        .filter((p) => p.id !== choiceId && p.hand.length)
        .map((p) => ({ id: p.id, label: p.name }));
      return true;
    }
    if (pending.payload.step === "pick-b") {
      pending.payload.secondId = choiceId;
      pending.payload.step = "card-a";
      const first = playerById(state, pending.payload.firstId);
      pending.ui = "cards";
      pending.title = "Swap 2 Psyche";
      pending.message = `${first?.name || "Dreamer"}: choose a Psyche to swap.`;
      pending.cards = first?.hand || [];
      pending.choices = [];
      return true;
    }
    if (pending.payload.step === "card-a") {
      pending.payload.cardA = choiceId;
      pending.payload.step = "card-b";
      const second = playerById(state, pending.payload.secondId);
      pending.message = `${second?.name || "Dreamer"}: choose a Psyche to swap.`;
      pending.cards = second?.hand || [];
      return true;
    }
    const first = playerById(state, pending.payload.firstId);
    const second = playerById(state, pending.payload.secondId);
    const cardA = first?.hand.find((c) => c.instanceId === pending.payload.cardA);
    const cardB = second?.hand.find((c) => c.instanceId === choiceId);
    state.pendingEffectChoice = null;
    if (first && second && cardA && cardB) {
      first.hand = first.hand.filter((c) => c.instanceId !== cardA.instanceId);
      second.hand = second.hand.filter((c) => c.instanceId !== cardB.instanceId);
      first.hand.push(cardB);
      second.hand.push(cardA);
      addLog(state, `Swapped Psyche between ${first.name} and ${second.name}.`);
    }
    return true;
  }

  if (actionId === "move-2-dreamers-1") {
    const remaining = pending.payload.remaining ?? 2;
    const moved = pending.payload.moved || [];
    state.pendingEffectChoice = null;
    continueMoveDreamer(state, choiceId, remaining, moved);
    return true;
  }

  if (actionId === "move-2-dreambeasts-1") {
    const tile = landscapeById(state, choiceId);
    const remaining = pending.payload.remaining ?? 2;
    const movedIds = pending.payload.movedIds || [];
    state.pendingEffectChoice = null;
    if (tile?.encounter) {
      moveEncounterOneStep(state, tile);
      const nextMoved = [...movedIds, tile.id];
      if (state.landscapePick) {
        state.landscapePick.followup = {
          landscapeAction: "move-2-dreambeasts-1",
          remaining: remaining - 1,
          movedIds: nextMoved,
        };
      } else {
        offerBeastMove(state, state.board.filter((t) => t.encounter), remaining - 1, nextMoved);
      }
    }
    return true;
  }

  state.pendingEffectChoice = null;
  return false;
});

export function resumeLandscapeAction(state) {
  const follow = state.pendingObjectFollowup;
  if (!follow?.landscapeAction) return false;
  const action = follow.landscapeAction;
  state.pendingObjectFollowup = null;

  if (action === "swap-landscapes") {
    const ids = follow.pickedIds || [];
    const a = landscapeById(state, ids[0]);
    const b = landscapeById(state, ids[1]);
    if (a && b) {
      swapTilePositions(a, b);
      addLog(state, `Swapped positions of ${a.name} and ${b.name}.`);
    }
    return true;
  }

  if (action === "swap-dreambeasts") {
    const ids = follow.pickedIds || [];
    const a = landscapeById(state, ids[0]);
    const b = landscapeById(state, ids[1]);
    if (a?.encounter && b?.encounter) {
      const encA = a.encounter;
      const encB = b.encounter;
      a.encounter = encB;
      b.encounter = encA;
      addLog(state, `Swapped ${encA.name} and ${encB.name}.`);
    }
    return true;
  }

  if (action === "move-2-dreamers-1") {
    presentNextDreamerMove(state, follow.remaining ?? 1, follow.moved || []);
    return true;
  }

  if (action === "move-2-dreambeasts-1") {
    offerBeastMove(state, state.board.filter((t) => t.encounter), follow.remaining ?? 0, follow.movedIds || []);
    return true;
  }

  return true;
}

export function getUniqueLandscapeActionChoices(tile) {
  if (!tile?.revealed || tile.hidden || tile.wasteland) return [];

  if (tile.landscapeActions?.length) {
    return tile.landscapeActions.map((id) => ({
      id,
      ...LANDSCAPE_ACTION_DEFS[id],
    }));
  }

  if (!tile.uniqueAction) return [];

  const def = LANDSCAPE_ACTION_DEFS[tile.uniqueAction];
  if (!def) return [];

  return [{ id: tile.uniqueAction, ...def }];
}

export function canDrawMindstreamOnLandscape(tile) {
  return !!(tile?.revealed && !tile.hidden && !tile.wasteland && tile.suit);
}

export function getLandscapeActionSummary(tile) {
  if (!tile?.revealed || tile.hidden || tile.wasteland) {
    return [];
  }

  const actions = [];

  if (canDrawMindstreamOnLandscape(tile)) {
    actions.push({
      letter: "A",
      label: `Draw [${SUIT_LABELS[tile.suit]}] Mindstream`,
      description: LANDSCAPE_ACTION_DEFS["draw-mindstream"].description,
    });
  }

  getUniqueLandscapeActionChoices(tile).forEach((choice) => {
    actions.push({
      label: choice.label,
      description: choice.description,
    });
  });

  return actions.slice(0, 2).map((action, index) => ({
    ...action,
    letter: index === 0 ? "A" : "B",
  }));
}

export function getLandscapeActionChoices(tile) {
  const choices = [];
  if (canDrawMindstreamOnLandscape(tile)) {
    choices.push({
      id: "draw-mindstream",
      label: `Draw [${SUIT_LABELS[tile.suit]}] Mindstream`,
      description: LANDSCAPE_ACTION_DEFS["draw-mindstream"].description,
      suit: tile.suit,
    });
  }
  choices.push(...getUniqueLandscapeActionChoices(tile));
  return choices;
}

export function executeLandscapeActionChoice(state, tile, player, actionId, helpers = {}) {
  const landscapeName = tile.name;

  switch (actionId) {
    case "draw-mindstream": {
      const suit = tile.suit;
      const cards = drawMindstream(state, suit, 1);
      if (!cards.length) {
        addLog(state, `No ${SUIT_LABELS[suit]} Mindstream cards left.`);
        return { ok: false, refund: true };
      }
      const card = cards[0];
      addLog(state, `${landscapeName}: draws ${card.name}.`);
      recordQuestEvent(state, "mindstream_on_landscape", { landscapeId: tile.id });
      queueMindstreamDrawFx(tile.id, suit, card);
      if (helpers.resolveCardEffect) {
        helpers.resolveCardEffect(state, card, player, helpers);
      }
      if (card.type !== "object" && card.type !== "dreambeast") {
        state.mindstreamDiscard[suit].push(card);
        if (card.type === "event") {
          if (card.eventWasted) {
            addLog(state, `${card.name} is discarded unused to the ${SUIT_LABELS[suit] || suit} Mindstream discard pile.`);
          } else {
            addLog(state, `${card.name} is discarded to the ${SUIT_LABELS[suit] || suit} Mindstream discard pile.`);
          }
          queueMindstreamDiscardFx(tile.id, suit, card, { wasted: !!card.eventWasted });
        }
      }
      return { ok: true, card };
    }

    case "draw-any-mindstream": {
      if (helpers.pickMindstreamSuit) {
        return { ok: true, pending: "pick-mindstream-suit" };
      }
      return { ok: false, refund: true };
    }

    case "spawn-dreambeast": {
      if (helpers.pickMindstreamSuit) {
        return { ok: true, pending: "spawn-dreambeast-pick-suit" };
      }
      return { ok: false, refund: true };
    }

    case "swap-psyche":
      return beginSwapPsyche(state, player);

    case "move-2-dreamers-1":
      return beginMoveTwoDreamers(state, player);

    case "swap-landscapes":
      return beginSwapLandscapes(state, player);

    case "move-1-dreamer-2": {
      moveDreamerSteps(state, player, 2);
      return { ok: true };
    }

    case "move-2-dreambeasts-1":
      return beginMoveTwoDreambeasts(state);

    case "all-toward-bed": {
      alivePlayers(state).forEach((p) => stepTowardBed(state, p));
      return { ok: true };
    }

    case "swap-archetypes": {
      if (!state.activeArchetype || !state.archetypeDeck.length) {
        addLog(state, "No Archetypes available to swap.");
        return { ok: false };
      }
      const next = state.archetypeDeck.shift();
      const prev = state.activeArchetype;
      prev.questProgress = prev.questProgress || [false, false];
      state.activeArchetype = next;
      next.questProgress = [false, false];
      next.powerTokensOnArchetype = 0;
      state.archetypeDeck.unshift(prev);
      addLog(state, `${landscapeName}: swapped Active Archetype to ${next.name}.`);
      return { ok: true };
    }

    case "take-power": {
      grantPowerTokens(state, player, 1);
      recordQuestEvent(state, "power_token", { count: 1 });
      addLog(state, `${landscapeName}: ${player.name} takes 1 Power Token.`);
      return { ok: true };
    }

    case "swap-dreambeasts":
      return beginSwapDreambeasts(state);

    case "draw-2-keep-1":
      return beginDrawTwoKeepOne(state, player, helpers);

    case "return-2":
      return { ok: true, ...returnTypedCard(state, null, 2) };

    case "return-1":
      return { ok: true, ...returnTypedCard(state, null, 1) };

    case "return-psyche":
      return { ok: true, ...returnTypedCard(state, "psyche", 1) };

    case "return-event":
      return { ok: true, ...returnTypedCard(state, "event", 1) };

    case "return-object":
      return { ok: true, ...returnTypedCard(state, "object", 1) };

    case "flip-top-3": {
      if (helpers.pickDeck) {
        return { ok: true, pending: "flip-top-3-pick-deck" };
      }
      return { ok: false, refund: true };
    }

    case "cycle-psyche":
      return beginCyclePsyche(state, player, tile);

    case "draw-3-psyche": {
      const drawn = drawPsycheForPlayer(state, player, 3);
      addLog(state, `${landscapeName}: ${player.name} draws ${drawn.length} Psyche.`);
      recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      return { ok: true };
    }

    case "bed-spend-10-draw-3": {
      if (!helpers?.psychePoolTotal) {
        addLog(state, "Select Psyche cards totaling 10 from hand.");
        return { ok: false, refund: true, needsPsychePool: 10 };
      }
      const pool = helpers.psychePoolTotal(state);
      if (pool < 10) {
        addLog(state, `Need 10 Psyche in the pool (currently ${pool}).`);
        return { ok: false, refund: true };
      }
      if (helpers.discardPsychePool) {
        helpers.discardPsychePool(state);
      }
      const drawn = drawPsycheForPlayer(state, player, 3);
      addLog(state, `The Bed: spent 10 Psyche — ${player.name} draws ${drawn.length} Psyche.`);
      recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      recordQuestEvent(state, "discard_psyche", { count: 10, landscapeId: "bed" });
      return { ok: true };
    }

    case "power-draw-psyche": {
      if (!spendPowerTokens(state, player, 1)) {
        addLog(state, "Need 1 Power Token.");
        return { ok: false };
      }
      const drawn = drawPsycheForPlayer(state, player, 3);
      addLog(state, `${landscapeName}: discarded 1 Power, drew ${drawn.length} Psyche.`);
      recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      return { ok: true };
    }

    case "replay-dream": {
      const pile = state.dreamDiscard || [];
      if (!pile.length) {
        addLog(state, "No Dreams in the discard pile.");
        return { ok: false };
      }
      const card = pile[pile.length - 1];
      addLog(state, `${landscapeName}: replaying Dream — ${card.name}.`);
      if (helpers.resolveCardEffect) {
        helpers.resolveCardEffect(state, card, player, helpers);
      }
      return { ok: true, card };
    }

    default:
      addLog(state, `Unknown landscape action: ${actionId}`);
      return { ok: false, refund: true };
  }
}

export function resolveLandscapeMindstreamPick(state, tile, player, suit, actionId, helpers) {
  if (actionId === "spawn-dreambeast") {
    spawnDreambeastFromMindstream(state, suit);
    return { ok: true };
  }
  if (actionId === "draw-any-mindstream") {
    const cards = drawMindstream(state, suit, 1);
    if (!cards.length) {
      addLog(state, `No ${SUIT_LABELS[suit]} Mindstream cards left.`);
      return { ok: false, refund: true };
    }
    const card = cards[0];
    addLog(state, `${tile.name}: draws ${card.name}.`);
    recordQuestEvent(state, "mindstream_on_landscape", { landscapeId: tile.id });
    if (helpers.resolveCardEffect) {
      helpers.resolveCardEffect(state, card, player, helpers);
    }
    if (card.type !== "object" && card.type !== "dreambeast") {
      state.mindstreamDiscard[suit].push(card);
      if (card.type === "event") {
        if (card.eventWasted) {
          addLog(state, `${card.name} is discarded unused to the ${SUIT_LABELS[suit] || suit} Mindstream discard pile.`);
        } else {
          addLog(state, `${card.name} is discarded to the ${SUIT_LABELS[suit] || suit} Mindstream discard pile.`);
        }
        queueMindstreamDiscardFx(tile.id, suit, card, { wasted: !!card.eventWasted });
      }
    }
    return { ok: true, card };
  }
  return { ok: false };
}

export function flipTopThreeOfDeck(state, deckKey) {
  if (deckKey.startsWith("mindstream-")) {
    const suit = deckKey.replace("mindstream-", "");
    if (reorderMindstreamTop(state, suit, 3)) {
      rememberRevealedTops(state, deckKey, state.mindstreamDecks[suit].slice(0, 3));
      addLog(state, `Flipped top 3 of ${SUIT_LABELS[suit]} Mindstream.`);
      return true;
    }
    return false;
  }

  const map = { psyche: "psycheDeck", dream: "dreamDeck", archetype: "archetypeDeck" };
  const key = map[deckKey] || deckKey;
  const deck = state[key];
  if (!deck?.length) {
    addLog(state, "Deck is empty.");
    return false;
  }
  const top = deck.splice(0, Math.min(3, deck.length));
  top.reverse();
  deck.unshift(...top);
  const peekKey = deckKey === "psycheDeck" ? "psyche" : deckKey === "dreamDeck" ? "dream" : deckKey;
  rememberRevealedTops(state, peekKey, top);
  addLog(state, `Flipped top ${top.length} of ${deckKey} deck.`);
  return true;
}
