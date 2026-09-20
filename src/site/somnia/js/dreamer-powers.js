/** Dreamer Power flows (1 Power Token each). */

import {
  addLog,
  revealLandscapeTile,
  landscapeById,
  rememberRevealedTops,
  consumeRevealedTop,
  moveEncounterBetweenLandscapes,
  encounterOnLandscape,
  encounterKey,
  allEncountersOnBoard,
  tileEncounters,
  drawPsycheForPlayer,
  getPhase,
} from "./state.js";
import { SUIT_LABELS } from "./rules.js";
import { recordQuestEvent } from "./quests.js";
import { adjacentTiles, hexDistance } from "./hex.js";
import { revealableTiles } from "./landscapes.js";
import {
  reshuffleMindstreamDiscardIfNeeded,
  discardToMindstream,
} from "./mindstream-supply.js";
import { isDreambeastPsycheCard } from "./subconscious.js";
import { handRoomForPsycheDraw } from "./objects.js";

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function cyclablePsycheCards(player) {
  return (player.hand || []).filter(
    (c) => (c.type === "psyche" || c.type === "psyche-power") && !isDreambeastPsycheCard(c),
  );
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

function moveAllDreamers(state, mover, steps = 1) {
  alivePlayers(state).forEach((player) => {
    for (let i = 0; i < steps; i += 1) {
      if (!mover(state, player)) break;
    }
  });
}

function moveEncounterOneStep(state, tile, encounter = null, { toward = null, awayFrom = null } = {}) {
  const enc = encounter || encounterOnLandscape(state, tile?.id);
  if (!tile || !enc) return false;
  const adj = adjacentTiles(state, tile.id).filter((t) => t.revealed && !t.wasteland);
  if (!adj.length) return false;

  let dest;
  if (toward) {
    adj.sort((a, b) => hexDistance(a, toward) - hexDistance(b, toward));
    dest = adj.find((t) => hexDistance(t, toward) < hexDistance(tile, toward));
  } else if (awayFrom) {
    adj.sort((a, b) => hexDistance(b, awayFrom) - hexDistance(a, awayFrom));
    dest = adj.find((t) => hexDistance(t, awayFrom) > hexDistance(tile, awayFrom)) || adj[0];
  } else {
    dest = adj[Math.floor(Math.random() * adj.length)];
  }
  if (!dest) return false;

  moveEncounterBetweenLandscapes(state, tile.id, dest.id, enc);
  addLog(state, `${enc.name} moves to ${dest.name}.`);
  return dest.id;
}

function nearestDreamerTile(state, fromTile) {
  let nearest = null;
  let nearestDist = Infinity;
  alivePlayers(state).forEach((player) => {
    const tile = landscapeById(state, player.landscapeId);
    if (!tile) return;
    const dist = hexDistance(fromTile, tile);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = tile;
    }
  });
  return nearest;
}

function moveEncounterTowardNearestDreamer(state, tile, encounter = null) {
  const target = nearestDreamerTile(state, tile);
  if (!target) return false;
  return moveEncounterOneStep(state, tile, encounter, { toward: target });
}

function moveEncounterAwayFromBed(state, tile, encounter = null) {
  const bed = landscapeById(state, "bed");
  if (!bed) return false;
  return moveEncounterOneStep(state, tile, encounter, { awayFrom: bed });
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

function sendTopToBottom(state, deckKey) {
  if (deckKey.startsWith("mindstream-")) {
    const suit = deckKey.replace("mindstream-", "");
    reshuffleMindstreamDiscardIfNeeded(state, suit);
    const deck = state.mindstreamDecks[suit];
    if (!deck?.length) return null;
    const top = deck.shift();
    deck.push(top);
    consumeRevealedTop(state, deckKey);
    return top;
  }
  const map = { psyche: "psycheDeck", dream: "dreamDeck", archetype: "archetypeDeck" };
  const key = map[deckKey];
  if (!state[key]?.length) return null;
  const top = state[key].shift();
  state[key].push(top);
  consumeRevealedTop(state, deckKey);
  return top;
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
    {
      id: "discard-draw",
      label: "Draw from Psyche Discard",
      hint: "Each Dreamer draws the top Psyche card from the discard pile.",
    },
    {
      id: "refresh-hand",
      label: "Refresh Hands",
      hint: "Each Dreamer puts 1 Psyche on the bottom of the Psyche deck and draws 1.",
    },
  ]);
}

function visionaryPowerStart(state) {
  setChoiceUI(state, "The Visionary — Dreamer Power", "All Dreamers choose one:", [
    {
      id: "reveal-landscapes",
      label: "Reveal Landscapes",
      hint: "Reveal 1 Landscape per Dreamer, plus 1 more.",
    },
    {
      id: "peek-decks",
      label: "Peek at Deck Tops",
      hint: "Each Dreamer peeks at 1 deck top and may send it to the bottom.",
    },
  ]);
}

function runnerPowerStart(state) {
  setChoiceUI(state, "The Runner — Dreamer Power", "Move every Dreamer 2 spaces:", [
    {
      id: "toward-bed",
      label: "Toward The Bed / Final Recurrence",
      hint: "Step closer to The Bed.",
    },
    {
      id: "away-bed",
      label: "Away from The Bed",
      hint: "Step farther from The Bed.",
    },
  ]);
}

function hunterPowerStart(state) {
  const beasts = allEncountersOnBoard(state);
  if (!beasts.length) {
    addLog(state, "No active Dreambeasts to move.");
    clearDreamerPower(state);
    return { done: true };
  }
  setChoiceUI(state, "The Hunter — Dreamer Power", "Move each active Dreambeast 1 space:", [
    {
      id: "toward-dreamers",
      label: "Toward the nearest Dreamer",
      hint: "Each Dreambeast steps closer to the nearest Dreamer.",
    },
    {
      id: "away-bed",
      label: "Away from The Bed",
      hint: "Each Dreambeast steps farther from The Bed.",
    },
  ]);
}

function immovablePowerExecute(state) {
  if (getPhase(state) === "Meet") {
    state.anchorMeetSpreadPending = 1;
    addLog(state, "Hold the Line: during the next Meet Phase, all Dreamers may add +1 Psyche to any Accept or Reject spread.");
  } else {
    state.anchorMeetSpreadBonus = 1;
    addLog(state, "Hold the Line: this Meet Phase, all Dreamers may add +1 Psyche to any Accept or Reject spread.");
  }
  clearDreamerPower(state);
  return { done: true };
}

function advanceCycleStep(state, label) {
  const pending = state.pendingDreamerPower;
  const queue = pending.cycleQueue || [];
  let index = pending.cycleIndex ?? 0;

  while (index < queue.length) {
    const player = state.players.find((p) => p.id === queue[index]);
    index += 1;
    if (!player) continue;
    const cards = cyclablePsycheCards(player);
    if (!cards.length) {
      addLog(state, `${player.name} has no Psyche to cycle.`);
      continue;
    }
    pending.cycleIndex = index;
    pending.cyclePlayerId = player.id;
    pending.step = "cycle-hand";
    pending.ui = {
      type: "hand",
      title: `${label} — ${player.name}`,
      message: "Choose 1 Psyche to discard and draw a replacement:",
      cards,
    };
    return { ui: pending.ui };
  }

  addLog(state, `${label} complete.`);
  clearDreamerPower(state);
  return { done: true };
}

function weaverPowerStart(state) {
  state.pendingDreamerPower.cycleQueue = alivePlayers(state).map((p) => p.id);
  state.pendingDreamerPower.cycleIndex = 0;
  return advanceCycleStep(state, "Threads of Will");
}

function restedRefreshStart(state) {
  state.pendingDreamerPower.cycleQueue = alivePlayers(state).map((p) => p.id);
  state.pendingDreamerPower.cycleIndex = 0;
  state.pendingDreamerPower.cycleMode = "bottom";
  return advanceCycleStep(state, "The Rested");
}

function cycleHandCard(state, player, card, { toBottom = false } = {}) {
  const idx = player.hand.findIndex((c) => c.instanceId === card.instanceId);
  if (idx < 0) return false;

  player.hand.splice(idx, 1);
  if (toBottom) {
    state.psycheDeck.push(card);
    addLog(state, `${player.name} puts ${card.name || "Psyche"} on the bottom of the Psyche deck.`);
  } else {
    state.psycheDiscard.push(card);
    addLog(state, `${player.name} discards ${card.name || "Psyche"}.`);
  }

  const drawn = drawPsycheForPlayer(state, player, 1);
  if (!drawn.length) addLog(state, `${player.name} could not draw a replacement Psyche.`);
  if (state.checkPsycheDeath) state.checkPsycheDeath(player);
  return true;
}

function advanceVisionaryPeek(state) {
  const pending = state.pendingDreamerPower;
  const queue = pending.peekQueue || [];
  const index = pending.peekIndex ?? 0;
  if (index >= queue.length) {
    clearDreamerPower(state);
    return { done: true };
  }
  const player = state.players.find((p) => p.id === queue[index]);
  pending.step = "peek-deck";
  pending.peekPlayerId = player?.id;
  pending.ui = {
    type: "deck",
    title: `The Visionary — ${player?.name || "Dreamer"}`,
    message: "Peek at the top card of a deck:",
  };
  return { ui: pending.ui };
}

function showVisionaryPeekChoice(state, deckKey, card, dreamerName) {
  rememberRevealedTops(state, deckKey, card);
  setChoiceUI(
    state,
    `The Visionary — ${dreamerName}`,
    `Top of ${formatDeckLabel(deckKey)}: ${card.name}${card.text ? ` — ${card.text}` : ""}`,
    [
      { id: "peek-keep", label: "Leave on top", hint: "Keep this card on top of the deck." },
      { id: "peek-bottom", label: "Send to bottom", hint: "Move this card to the bottom of the deck." },
    ],
  );
  state.pendingDreamerPower.step = "peek-resolve";
  state.pendingDreamerPower.peekDeckKey = deckKey;
  return { ui: state.pendingDreamerPower.ui };
}

export function canActivateDreamerPower(state, player) {
  if (!player?.dreamer) return false;
  switch (player.dreamer.id) {
    case "the-hunter":
      return allEncountersOnBoard(state).length > 0;
    case "the-weaver":
      return alivePlayers(state).some((p) => cyclablePsycheCards(p).length > 0);
    default:
      return true;
  }
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
      return hunterPowerStart(state);
    case "the-immovable":
      return immovablePowerExecute(state);
    case "the-weaver":
      return weaverPowerStart(state);
    default:
      clearDreamerPower(state);
      return { done: true };
  }
}

export function resolveDreamerPowerChoice(state, choiceId) {
  const pending = state.pendingDreamerPower;
  if (!pending) return { done: true };

  delete pending.ui;

  if (pending.dreamerId === "the-rested") {
    if (choiceId === "discard-draw") drawPsycheFromDiscardForAll(state);
    else if (choiceId === "refresh-hand") return restedRefreshStart(state);
    clearDreamerPower(state);
    return { done: true };
  }

  if (pending.dreamerId === "the-visionary") {
    if (choiceId === "reveal-landscapes") {
      const available = revealableTiles(state).length;
      const count = Math.min(alivePlayers(state).length + 1, available);
      if (!count) {
        addLog(state, "No Landscapes available to reveal.");
        clearDreamerPower(state);
        return { done: true };
      }
      pending.step = "reveal-landscape";
      pending.revealRemaining = count;
      addLog(state, `Visionary Power: reveal ${count} Landscape(s) — click hidden tiles on the map.`);
      return { needsBoard: true };
    }
    if (choiceId === "peek-decks") {
      pending.peekQueue = alivePlayers(state).map((p) => p.id);
      pending.peekIndex = 0;
      return advanceVisionaryPeek(state);
    }
    if (pending.step === "peek-resolve") {
      const player = state.players.find((p) => p.id === pending.peekPlayerId);
      if (choiceId === "peek-bottom") {
        sendTopToBottom(state, pending.peekDeckKey);
        addLog(state, `${player?.name || "Dreamer"} sends the peeked card to the bottom.`);
      } else {
        addLog(state, `${player?.name || "Dreamer"} leaves the peeked card on top.`);
      }
      pending.peekIndex = (pending.peekIndex ?? 0) + 1;
      return advanceVisionaryPeek(state);
    }
  }

  if (pending.dreamerId === "the-runner") {
    const mover = choiceId === "toward-bed" ? stepTowardBed : stepAwayFromBed;
    moveAllDreamers(state, mover, 2);
    addLog(state, choiceId === "toward-bed"
      ? "Runner Power: all Dreamers step toward The Bed."
      : "Runner Power: all Dreamers step away from The Bed.");
    clearDreamerPower(state);
    return { done: true };
  }

  if (pending.dreamerId === "the-hunter") {
    const beasts = allEncountersOnBoard(state);
    const mover = choiceId === "toward-dreamers"
      ? moveEncounterTowardNearestDreamer
      : moveEncounterAwayFromBed;
    beasts.forEach(({ tile, encounter }) => mover(state, tile, encounter));
    addLog(state, choiceId === "toward-dreamers"
      ? "Hunter Power: each Dreambeast moves toward the nearest Dreamer."
      : "Hunter Power: each Dreambeast moves away from The Bed.");
    clearDreamerPower(state);
    return { done: true };
  }

  clearDreamerPower(state);
  return { done: true };
}

export function resolveDreamerPowerHandPick(state, cardKey) {
  const pending = state.pendingDreamerPower;
  if (!pending || pending.step !== "cycle-hand") return { done: true };

  const player = state.players.find((p) => p.id === pending.cyclePlayerId);
  const card = cyclablePsycheCards(player).find(
    (c) => c.instanceId === cardKey || c.id === cardKey,
  );
  if (!player || !card) {
    addLog(state, "Invalid card choice.");
    clearDreamerPower(state);
    return { done: true };
  }

  cycleHandCard(state, player, card, { toBottom: pending.cycleMode === "bottom" });
  pending.cycleIndex = pending.cycleIndex ?? 0;
  const label = pending.dreamerId === "the-weaver" ? "Threads of Will" : "The Rested";
  return advanceCycleStep(state, label);
}

export function resolveDreamerPowerDeckPick(state, deckKey) {
  const pending = state.pendingDreamerPower;
  if (!pending) return { done: true };

  if (pending.dreamerId === "the-visionary" && pending.step === "peek-deck") {
    const player = state.players.find((p) => p.id === pending.peekPlayerId);
    const card = peekTopDeckCard(state, deckKey);
    if (!card) {
      addLog(state, `${formatDeckLabel(deckKey)} is empty.`);
      pending.peekIndex = (pending.peekIndex ?? 0) + 1;
      return advanceVisionaryPeek(state);
    }
    pending.peekDeckKey = deckKey;
    return showVisionaryPeekChoice(state, deckKey, card, player?.name || "Dreamer");
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

  if (pending.revealRemaining <= 0 || !revealableTiles(state).length) clearDreamerPower(state);
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
