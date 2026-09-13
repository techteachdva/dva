/** Dreamer Power flows (1 Power Token each). */

import {
  addLog,
  revealLandscapeTile,
  landscapeById,
  rememberRevealedTops,
  consumeRevealedTop,
} from "./state.js";
import { SUIT_LABELS } from "./rules.js";
import { recordQuestEvent } from "./quests.js";
import { adjacentTiles, hexDistance } from "./hex.js";
import { revealableTiles } from "./landscapes.js";
import {
  reshuffleMindstreamDiscardIfNeeded,
  discardToMindstream,
} from "./mindstream-supply.js";
import {
  repressCard,
  requestReturnCards,
  listSubconsciousCards,
  isDreambeastPsycheCard,
} from "./subconscious.js";
import { handRoomForPsycheDraw } from "./objects.js";

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

export function stepTowardBed(state, player) {
  const bed = landscapeById(state, "bed");
  const current = landscapeById(state, player.landscapeId);
  if (!bed || !current || current.id === "bed") return false;

  const adj = adjacentTiles(state, current.id).filter((t) => t.revealed);
  if (!adj.length) return false;

  adj.sort((a, b) => hexDistance(a, bed) - hexDistance(b, bed));
  const dest = adj.find((t) => hexDistance(t, bed) < hexDistance(current, bed));
  if (!dest) return false;

  player.landscapeId = dest.id;
  addLog(state, `${player.name} moves toward The Bed (${dest.name}).`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

export function stepAwayFromBed(state, player) {
  const bed = landscapeById(state, "bed");
  const current = landscapeById(state, player.landscapeId);
  if (!bed || !current) return false;

  const adj = adjacentTiles(state, current.id).filter((t) => t.revealed);
  if (!adj.length) return false;

  adj.sort((a, b) => hexDistance(b, bed) - hexDistance(a, bed));
  const dest = adj.find((t) => hexDistance(t, bed) > hexDistance(current, bed)) || adj[0];
  if (!dest) return false;

  player.landscapeId = dest.id;
  addLog(state, `${player.name} moves away from The Bed (${dest.name}).`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

export function moveEncounterOneStep(state, tile) {
  if (!tile?.encounter) return false;
  const adj = adjacentTiles(state, tile.id).filter((t) => t.revealed && !t.encounter);
  if (!adj.length) return false;
  const dest = adj[Math.floor(Math.random() * adj.length)];
  const enc = tile.encounter;
  tile.encounter = null;
  dest.encounter = enc;
  if (state.activeEncounterLandscapeId === tile.id) {
    state.activeEncounterLandscapeId = dest.id;
    state.activeEncounter = enc;
  }
  addLog(state, `${enc.name} moves to ${dest.name}.`);
  return true;
}

function moveEncounterSteps(state, startTileId, steps) {
  let tileId = startTileId;
  for (let i = 0; i < steps; i += 1) {
    const tile = landscapeById(state, tileId);
    if (!tile?.encounter) break;
    const encId = tile.encounter.instanceId;
    if (!moveEncounterOneStep(state, tile)) break;
    const next = state.board.find((t) => t.encounter?.instanceId === encId);
    if (!next) break;
    tileId = next.id;
  }
}

function swapActiveArchetype(state) {
  if (!state.activeArchetype || !state.archetypeDeck.length) {
    addLog(state, "No Archetypes available to swap.");
    return false;
  }
  const next = state.archetypeDeck.shift();
  const prev = state.activeArchetype;
  prev.questProgress = prev.questProgress || [false, false];
  state.activeArchetype = next;
  next.questProgress = [false, false];
  next.powerTokensOnArchetype = 0;
  state.archetypeDeck.unshift(prev);
  addLog(state, `Active Archetype changed to ${next.name}.`);
  return true;
}

function drawPsycheFromDiscardForAll(state) {
  let drew = 0;
  alivePlayers(state).forEach((player) => {
    if (!state.psycheDiscard.length) return;
    const card = state.psycheDiscard.pop();
    if (isDreambeastPsycheCard(card)) {
      state.psycheDiscard.push(card);
      return;
    }
    if (handRoomForPsycheDraw(state, player) <= 0) {
      state.psycheDiscard.push(card);
      addLog(state, `${player.name} is at the Psyche hand limit.`);
      return;
    }
    player.hand.push(card);
    drew += 1;
    addLog(state, `${player.name} draws ${card.name || "Psyche"} from the discard pile.`);
  });
  if (!drew) addLog(state, "Psyche discard pile is empty.");
  return drew > 0;
}

function peekTopDeckCard(state, deckKey) {
  if (deckKey.startsWith("mindstream-")) {
    const suit = deckKey.replace("mindstream-", "");
    reshuffleMindstreamDiscardIfNeeded(state, suit);
    return state.mindstreamDecks[suit]?.[0] || null;
  }
  const map = { psyche: "psycheDeck", dream: "dreamDeck", archetype: "archetypeDeck" };
  const key = map[deckKey] || deckKey;
  return state[key]?.[0] || null;
}

function flipShowTopCard(state, deckKey, dreamerName) {
  const card = peekTopDeckCard(state, deckKey);
  if (!card) {
    addLog(state, `${formatDeckLabel(deckKey)} is empty.`);
    return null;
  }
  rememberRevealedTops(state, deckKey, card);
  addLog(
    state,
    `${dreamerName} flips the top of ${formatDeckLabel(deckKey)}: ${card.name}${card.text ? ` — ${card.text}` : ""}`,
  );
  return card;
}

function formatDeckLabel(deckKey) {
  if (deckKey.startsWith("mindstream-")) {
    const suit = deckKey.replace("mindstream-", "");
    return `${SUIT_LABELS[suit] || suit} Mindstream`;
  }
  if (deckKey === "psyche") return "Psyche";
  if (deckKey === "dream") return "Dream";
  if (deckKey === "archetype") return "Archetype";
  return deckKey;
}

function clearDreamerPower(state) {
  state.pendingDreamerPower = null;
}

export function cancelDreamerPower(state) {
  clearDreamerPower(state);
}

export function hasPendingDreamerPower(state) {
  return !!state.pendingDreamerPower;
}

export function getDreamerPowerUI(state) {
  const pending = state.pendingDreamerPower;
  if (!pending?.ui) return null;
  return pending.ui;
}

function setChoiceUI(state, title, message, choices) {
  state.pendingDreamerPower.ui = { type: "choice", title, message, choices };
}

function restedPowerStart(state) {
  setChoiceUI(state, "The Rested — Dreamer Power", "All Dreamers choose one:", [
    { id: "discard-draw", label: "Draw from Psyche Discard", hint: "Each Dreamer draws the top Psyche card from the discard pile." },
    { id: "swap-archetype", label: "Change Active Archetype", hint: "Swap the Active Archetype with the next Archetype in the deck." },
  ]);
}

function visionaryPowerStart(state) {
  setChoiceUI(state, "The Visionary — Dreamer Power", "All Dreamers choose one:", [
    { id: "flip-decks", label: "Flip Top of a Deck", hint: "Each Dreamer flips and reveals the top card of one deck." },
    { id: "reveal-landscapes", label: "Reveal Landscapes", hint: "Each Dreamer reveals 1 hidden Landscape on the map." },
  ]);
}

function runnerPowerStart(state) {
  setChoiceUI(state, "The Runner — Dreamer Power", "Move every Dreamer 1 space:", [
    { id: "toward-bed", label: "Toward The Bed / Final Recurrence", hint: "Step closer to The Bed." },
    { id: "away-bed", label: "Away from The Bed", hint: "Step farther from The Bed." },
  ]);
}

function immovablePowerStart(state) {
  const choices = [];
  if (state.cancellableDiscard) {
    choices.push({
      id: "cancel-discard",
      label: "Cancel Last Discard",
      hint: `Return ${state.cancellableDiscard.card?.name || "Psyche"} to ${state.cancellableDiscard.playerName}.`,
    });
  }
  if (state.cancellableMove) {
    choices.push({
      id: "cancel-move",
      label: "Cancel Last Forced Move",
      hint: `Return ${state.cancellableMove.playerName} to ${state.cancellableMove.fromName}.`,
    });
  }
  if (!choices.length) {
    addLog(state, "Nothing to cancel — no recent discard or forced move.");
    clearDreamerPower(state);
    return { done: true };
  }
  setChoiceUI(state, "The Immovable — Dreamer Power", "Cancel one recent effect:", choices);
}

function advanceWeaverStep(state) {
  const pending = state.pendingDreamerPower;
  const queue = pending.weaverQueue || [];
  const index = pending.weaverIndex ?? 0;
  if (index >= queue.length) {
    addLog(state, "Weaver trades complete.");
    clearDreamerPower(state);
    return { done: true };
  }
  const player = state.players.find((p) => p.id === queue[index]);
  if (!player) {
    pending.weaverIndex = index + 1;
    return advanceWeaverStep(state);
  }
  setChoiceUI(state, `The Weaver — ${player.name}`, "Trade up to 1 card, or skip:", [
    { id: "weaver-deck", label: "Trade with a Deck", hint: "Swap 1 hand card for the top card of a deck." },
    { id: "weaver-subconscious", label: "Trade with the Subconscious", hint: "Repress 1 hand card and Return 1 from the Subconscious." },
    { id: "weaver-skip", label: "Skip", hint: "No trade for this Dreamer." },
  ]);
  return { ui: pending.ui };
}

function weaverPowerStart(state) {
  state.pendingDreamerPower.weaverQueue = alivePlayers(state).map((p) => p.id);
  state.pendingDreamerPower.weaverIndex = 0;
  return advanceWeaverStep(state);
}

function hunterPowerExecute(state) {
  const steps = alivePlayers(state).length;
  const tiles = state.board.filter((t) => t.encounter);
  if (!tiles.length) {
    addLog(state, "No active Dreambeasts to move.");
    clearDreamerPower(state);
    return { done: true };
  }
  tiles.forEach((tile) => moveEncounterSteps(state, tile.id, steps));
  addLog(state, `Hunter Power: each Dreambeast moves ${steps} space(s).`);
  clearDreamerPower(state);
  return { done: true };
}

export function beginDreamerPower(state) {
  const pending = state.pendingDreamerPower;
  if (!pending) return null;

  switch (pending.dreamerId) {
    case "the-rested":
      restedPowerStart(state);
      return { ui: state.pendingDreamerPower.ui };
    case "the-visionary":
      visionaryPowerStart(state);
      return { ui: state.pendingDreamerPower.ui };
    case "the-runner":
      runnerPowerStart(state);
      return { ui: state.pendingDreamerPower.ui };
    case "the-hunter":
      return hunterPowerExecute(state);
    case "the-immovable":
      return immovablePowerStart(state);
    case "the-weaver":
      return weaverPowerStart(state);
    default:
      clearDreamerPower(state);
      return { done: true };
  }
}

function advanceVisionaryFlip(state) {
  const pending = state.pendingDreamerPower;
  const queue = pending.flipQueue || [];
  const index = pending.flipIndex ?? 0;
  if (index >= queue.length) {
    clearDreamerPower(state);
    return { done: true };
  }
  const player = state.players.find((p) => p.id === queue[index]);
  pending.step = "flip-deck";
  pending.flipPlayerId = player?.id;
  pending.ui = {
    type: "deck",
    title: `The Visionary — ${player?.name || "Dreamer"}`,
    message: "Flip and show the top card of a deck:",
  };
  return { ui: pending.ui };
}

export function resolveDreamerPowerChoice(state, choiceId) {
  const pending = state.pendingDreamerPower;
  if (!pending) return { done: true };

  delete pending.ui;

  if (pending.dreamerId === "the-rested") {
    if (choiceId === "discard-draw") drawPsycheFromDiscardForAll(state);
    else if (choiceId === "swap-archetype") swapActiveArchetype(state);
    clearDreamerPower(state);
    return { done: true };
  }

  if (pending.dreamerId === "the-visionary") {
    if (choiceId === "flip-decks") {
      pending.flipQueue = alivePlayers(state).map((p) => p.id);
      pending.flipIndex = 0;
      pending.step = "flip-deck";
      return advanceVisionaryFlip(state);
    }
    if (choiceId === "reveal-landscapes") {
      const count = alivePlayers(state).length;
      if (!count || !revealableTiles(state).length) {
        addLog(state, "No Landscapes available to reveal.");
        clearDreamerPower(state);
        return { done: true };
      }
      pending.step = "reveal-landscape";
      pending.revealRemaining = count;
      addLog(state, `Visionary Power: reveal ${count} Landscape(s) — click hidden tiles on the map.`);
      return { needsBoard: true };
    }
  }

  if (pending.dreamerId === "the-runner") {
    const mover = choiceId === "toward-bed" ? stepTowardBed : stepAwayFromBed;
    alivePlayers(state).forEach((p) => mover(state, p));
    addLog(state, choiceId === "toward-bed"
      ? "Runner Power: all Dreamers step toward The Bed."
      : "Runner Power: all Dreamers step away from The Bed.");
    clearDreamerPower(state);
    return { done: true };
  }

  if (pending.dreamerId === "the-immovable") {
    if (choiceId === "cancel-discard" && state.cancellableDiscard) {
      const { playerId, card } = state.cancellableDiscard;
      const player = state.players.find((p) => p.id === playerId);
      if (player && card) {
        player.hand.push(card);
        addLog(state, `Immovable Power: returned ${card.name || "Psyche"} to ${player.name}.`);
      }
      state.cancellableDiscard = null;
    } else if (choiceId === "cancel-move" && state.cancellableMove) {
      const { playerId, fromId, fromName } = state.cancellableMove;
      const player = state.players.find((p) => p.id === playerId);
      if (player && fromId) {
        player.landscapeId = fromId;
        addLog(state, `Immovable Power: ${player.name} returns to ${fromName}.`);
      }
      state.cancellableMove = null;
    }
    clearDreamerPower(state);
    return { done: true };
  }

  if (pending.dreamerId === "the-weaver") {
    const queue = pending.weaverQueue || [];
    const index = pending.weaverIndex ?? 0;
    const player = state.players.find((p) => p.id === queue[index]);
    if (!player) {
      pending.weaverIndex = index + 1;
      return advanceWeaverStep(state);
    }

    if (choiceId === "weaver-skip") {
      pending.weaverIndex = index + 1;
      return advanceWeaverStep(state);
    }
    if (choiceId === "weaver-deck") {
      pending.step = "weaver-pick-deck";
      pending.weaverPlayerId = player.id;
      pending.ui = {
        type: "deck",
        title: `${player.name} — trade with a deck`,
        message: "Choose a deck to swap with the top card:",
      };
      return { ui: pending.ui };
    }
    if (choiceId === "weaver-subconscious") {
      if (!player.hand.length) {
        addLog(state, `${player.name} has no cards to trade.`);
        pending.weaverIndex = index + 1;
        return advanceWeaverStep(state);
      }
      if (!listSubconsciousCards(state).length) {
        addLog(state, "The Subconscious is empty.");
        pending.weaverIndex = index + 1;
        return advanceWeaverStep(state);
      }
      const card = player.hand.pop();
      repressCard(state, card);
      addLog(state, `${player.name} Represses 1 card to trade with the Subconscious.`);
      requestReturnCards(state, 1, player);
      if (state.checkPsycheDeath) state.checkPsycheDeath(player);
      pending.weaverIndex = index + 1;
      return advanceWeaverStep(state);
    }
  }

  clearDreamerPower(state);
  return { done: true };
}

export function resolveDreamerPowerDeckPick(state, deckKey) {
  const pending = state.pendingDreamerPower;
  if (!pending) return { done: true };

  if (pending.dreamerId === "the-visionary" && pending.step === "flip-deck") {
    const player = state.players.find((p) => p.id === pending.flipPlayerId);
    const card = flipShowTopCard(state, deckKey, player?.name || "Dreamer");
    pending.flipIndex = (pending.flipIndex ?? 0) + 1;
    const next = advanceVisionaryFlip(state);
    return { done: !!next.done, card, ui: next.ui };
  }

  if (pending.dreamerId === "the-weaver" && pending.step === "weaver-pick-deck") {
    const player = state.players.find((p) => p.id === pending.weaverPlayerId);
    if (!player?.hand.length) {
      addLog(state, `${player?.name || "Dreamer"} has no card to trade.`);
    } else {
      const handCard = player.hand.pop();
      const top = peekTopDeckCard(state, deckKey);
      if (!top) {
        player.hand.push(handCard);
        addLog(state, "Deck is empty — trade cancelled.");
      } else if (deckKey.startsWith("mindstream-")) {
        const suit = deckKey.replace("mindstream-", "");
        reshuffleMindstreamDiscardIfNeeded(state, suit);
        const deck = state.mindstreamDecks[suit];
        const drawn = deck.shift();
        consumeRevealedTop(state, deckKey);
        player.hand.push(drawn);
        discardToMindstream(state, handCard);
        addLog(state, `${player.name} trades with ${formatDeckLabel(deckKey)}.`);
      } else if (deckKey === "psyche") {
        const drawn = state.psycheDeck.shift();
        consumeRevealedTop(state, "psyche");
        if (drawn) {
          player.hand.push(drawn);
          state.psycheDiscard.push(handCard);
          addLog(state, `${player.name} trades with the Psyche deck.`);
        } else {
          player.hand.push(handCard);
        }
      } else if (deckKey === "dream") {
        const drawn = state.dreamDeck.shift();
        consumeRevealedTop(state, "dream");
        if (drawn) {
          player.hand.push(drawn);
          state.dreamDeck.unshift(handCard);
          addLog(state, `${player.name} trades with the Dream deck.`);
        } else {
          player.hand.push(handCard);
        }
      } else if (deckKey === "archetype") {
        const drawn = state.archetypeDeck.shift();
        consumeRevealedTop(state, "archetype");
        if (drawn) {
          player.hand.push(drawn);
          state.archetypeDeck.unshift(handCard);
          addLog(state, `${player.name} trades with the Archetype deck.`);
        } else {
          player.hand.push(handCard);
        }
      } else {
        player.hand.push(handCard);
        addLog(state, "That deck cannot be traded with.");
      }
      if (state.checkPsycheDeath) state.checkPsycheDeath(player);
    }
    pending.weaverIndex = (pending.weaverIndex ?? 0) + 1;
    return advanceWeaverStep(state);
  }

  clearDreamerPower(state);
  return { done: true };
}

export function handleDreamerPowerTilePick(state, tileId) {
  const pending = state.pendingDreamerPower;
  if (!pending || pending.step !== "reveal-landscape") return false;

  const tile = landscapeById(state, tileId);
  if (!tile || tile.center) return false;
  if (tile.revealed && !tile.wasteland) return false;
  if ((pending.revealRemaining ?? 0) <= 0) return false;

  revealLandscapeTile(state, tile);
  pending.revealRemaining -= 1;
  addLog(state, `Visionary Power reveals ${tile.name}.`);

  if (pending.revealRemaining <= 0) clearDreamerPower(state);
  return true;
}

export function recordCancellableDiscard(state, player, card, source = "discard") {
  if (!card || isDreambeastPsycheCard(card)) return;
  state.cancellableDiscard = {
    playerId: player.id,
    playerName: player.name,
    card,
    source,
  };
}

export function recordCancellableMove(state, player, fromId, toId) {
  const from = landscapeById(state, fromId);
  const to = landscapeById(state, toId);
  if (!from || !to || fromId === toId) return;
  state.cancellableMove = {
    playerId: player.id,
    playerName: player.name,
    fromId,
    fromName: from.name,
    toId,
    toName: to.name,
  };
}
