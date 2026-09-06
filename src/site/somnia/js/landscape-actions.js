import {
  addLog,
  drawPsycheForPlayer,
  drawMindstream,
  landscapeById,
  setEncounterOnLandscape,
} from "./state.js";
import { SUIT_LABELS } from "./rules.js";
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

  player.landscapeId = dest.id;
  addLog(state, `${player.name} moves toward The Bed (${dest.name}).`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

function moveDreamerSteps(state, player, steps) {
  let current = landscapeById(state, player.landscapeId);
  if (!current) return false;

  for (let i = 0; i < steps; i += 1) {
    const adj = adjacentTiles(state, current.id).filter((t) => t.revealed);
    if (!adj.length) return i > 0;
    const dest = adj[Math.floor(Math.random() * adj.length)];
    player.landscapeId = dest.id;
    current = dest;
  }

  addLog(state, `${player.name} moves ${steps} Landscape(s) to ${current.name}.`);
  recordQuestEvent(state, "move_player", { count: steps });
  return true;
}

function moveEncounterOneStep(state, tile) {
  if (!tile?.encounter) return false;
  const adj = adjacentTiles(state, tile.id).filter((t) => t.revealed && !t.encounter);
  if (!adj.length) return false;
  const dest = adj[Math.floor(Math.random() * adj.length)];
  const enc = tile.encounter;
  tile.encounter = null;
  setEncounterOnLandscape(state, dest.id, enc);
  addLog(state, `${enc.name} moves to ${dest.name}.`);
  return true;
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

  const tile = targets[Math.floor(Math.random() * targets.length)];
  const encounter = encounterFromDreambeastCard(beast);
  setEncounterOnLandscape(state, tile.id, encounter);
  addLog(state, `${beast.name} spawns on ${tile.name} from the ${SUIT_LABELS[suit]} Mindstream.`);
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
      state.mindstreamDiscard[suit].push(keep);
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

export function getLandscapeActionChoices(tile) {
  const choices = [];
  if (canDrawMindstreamOnLandscape(tile)) {
    choices.push({
      id: "draw-mindstream",
      label: `Draw ${SUIT_LABELS[tile.suit]} Mindstream`,
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
      addLog(state, `${landscapeName}: ${card.name} — ${card.text || ""}`);
      recordQuestEvent(state, "mindstream_on_landscape", { landscapeId: tile.id });
      if (helpers.resolveCardEffect) {
        helpers.resolveCardEffect(state, card, player, helpers);
      }
      state.mindstreamDiscard[suit].push(card);
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

    case "swap-psyche": {
      const players = alivePlayers(state).filter((p) => p.hand.length >= 1);
      if (players.length < 2) {
        addLog(state, "Need 2 Dreamers with Psyche to swap.");
        return { ok: false };
      }
      const [a, b] = shuffle(players).slice(0, 2);
      const cardA = a.hand.pop();
      const cardB = b.hand.pop();
      a.hand.push(cardB);
      b.hand.push(cardA);
      addLog(state, `${landscapeName}: swapped Psyche between ${a.name} and ${b.name}.`);
      return { ok: true };
    }

    case "move-2-dreamers-1": {
      const movers = shuffle(alivePlayers(state)).slice(0, 2);
      movers.forEach((p) => {
        const current = landscapeById(state, p.landscapeId);
        const adj = adjacentTiles(state, current.id).filter((t) => t.revealed);
        if (!adj.length) return;
        const dest = adj[Math.floor(Math.random() * adj.length)];
        p.landscapeId = dest.id;
        addLog(state, `${p.name} moves to ${dest.name}.`);
        recordQuestEvent(state, "move_player", { count: 1 });
      });
      return { ok: true };
    }

    case "swap-landscapes": {
      const swapables = state.board.filter((t) => t.revealed && !t.center);
      if (swapables.length < 2) {
        addLog(state, "Not enough Landscapes to swap.");
        return { ok: false };
      }
      const [a, b] = shuffle(swapables).slice(0, 2);
      swapTilePositions(a, b);
      addLog(state, `${landscapeName}: swapped positions of ${a.name} and ${b.name}.`);
      return { ok: true };
    }

    case "move-1-dreamer-2": {
      moveDreamerSteps(state, player, 2);
      return { ok: true };
    }

    case "move-2-dreambeasts-1": {
      const withEnc = state.board.filter((t) => t.encounter);
      shuffle(withEnc).slice(0, 2).forEach((t) => moveEncounterOneStep(state, t));
      return { ok: true };
    }

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
      state.archetypeDeck.unshift(prev);
      addLog(state, `${landscapeName}: swapped Active Archetype to ${next.name}.`);
      return { ok: true };
    }

    case "take-power": {
      player.powerTokens += 1;
      recordQuestEvent(state, "power_token", { count: 1 });
      addLog(state, `${landscapeName}: ${player.name} takes 1 Power Token.`);
      return { ok: true };
    }

    case "swap-dreambeasts": {
      const withEnc = state.board.filter((t) => t.encounter);
      if (withEnc.length < 2) {
        addLog(state, "Need 2 active Dreambeasts to swap.");
        return { ok: false };
      }
      const [a, b] = shuffle(withEnc).slice(0, 2);
      const encA = a.encounter;
      const encB = b.encounter;
      a.encounter = encB;
      b.encounter = encA;
      addLog(state, `${landscapeName}: swapped ${encA.name} and ${encB.name}.`);
      return { ok: true };
    }

    case "draw-2-keep-1": {
      drawTwoKeepOne(state, player, helpers);
      return { ok: true };
    }

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

    case "cycle-psyche": {
      if (!player.hand.length) {
        addLog(state, "No Psyche to cycle.");
        return { ok: false };
      }
      const card = player.hand.reduce((best, c) => ((c.value || 0) > (best.value || 0) ? c : best), player.hand[0]);
      const idx = player.hand.findIndex((c) => c.instanceId === card.instanceId);
      if (idx >= 0) player.hand.splice(idx, 1);
      state.psycheDiscard.push(card);
      const value = card.value || 1;
      const drawn = drawPsycheForPlayer(state, player, value);
      addLog(state, `${landscapeName}: cycled ${card.suit} ${value} for ${drawn.length} Psyche.`);
      recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      if (tile.id === "bed") recordQuestEvent(state, "psyche_cycle_bed");
      return { ok: true };
    }

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
      if (player.powerTokens < 1) {
        addLog(state, "Need 1 Power Token.");
        return { ok: false };
      }
      player.powerTokens -= 1;
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
    addLog(state, `${tile.name}: ${card.name} — ${card.text || ""}`);
    recordQuestEvent(state, "mindstream_on_landscape", { landscapeId: tile.id });
    if (helpers.resolveCardEffect) {
      helpers.resolveCardEffect(state, card, player, helpers);
    }
    state.mindstreamDiscard[suit].push(card);
    return { ok: true, card };
  }
  return { ok: false };
}

export function flipTopThreeOfDeck(state, deckKey) {
  if (deckKey.startsWith("mindstream-")) {
    const suit = deckKey.replace("mindstream-", "");
    if (reorderMindstreamTop(state, suit, 3)) {
      addLog(state, `Flipped top 3 of ${SUIT_LABELS[suit]} Mindstream.`);
      return true;
    }
    return false;
  }

  const deck = state[deckKey];
  if (!deck?.length) {
    addLog(state, "Deck is empty.");
    return false;
  }
  const top = deck.splice(0, Math.min(3, deck.length));
  top.reverse();
  deck.unshift(...top);
  addLog(state, `Flipped top ${top.length} of ${deckKey} deck.`);
  return true;
}
