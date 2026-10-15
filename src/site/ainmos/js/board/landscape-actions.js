import { landscapeActionBlockedByBoss } from "../encounters/boss-twists.js";
import {
  addLog,
  drawPsycheForPlayer,
  drawMindstream,
  landscapeById,
  setEncounterOnLandscape,
  moveEncounterBetweenLandscapes,
  encounterOnLandscape,
  encounterKey,
  addEncounterOnLandscape,
  removeEncounterFromLandscape,
  tileEncounters,
  tileHasEncounters,
  allEncountersOnBoard,
  countEncountersOnBoard,
  revealedLandscapeTiles,
  rememberRevealedTops,
} from "../core/state.js";
import { requestChooseTile, beginFreeRevealPicking, beginBedTileFlip, revealableTiles } from "./landscapes.js";
import { isFreeformBoard, tileDeckCount } from "./dreamscape-vault.js";
import { SUIT_LABELS, totalStat } from "../core/rules.js";
import { queueMindstreamDrawFx, queueMindstreamDiscardFx, cancelQueuedMindstreamDrawFx } from "./board-fx.js";
import { adjacentTiles, hexDistance } from "../core/hex.js";
import {
  listSubconsciousCards,
  returnableCards,
  requestReturnCards,
  finalizeReturn,
} from "../dreamers/subconscious.js";
import {
  encounterFromDreambeastCard,
  reshuffleMindstreamDiscardIfNeeded,
  reorderMindstreamTop,
  pullDreambeastFromMindstream,
  stampBeastMillDiscard,
} from "../cards/mindstream-supply.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { shuffle } from "../core/data.js";
import { offerEffectChoice, registerEffectResolver } from "../effects/effect-choices.js";
import { beginRemember } from "../effects/remember.js";
import { recordCancellableMove } from "../dreamers/dreamer-powers.js";
import { discardDreamCard, isBossDreamCard, spawnBossEncounterOnBed } from "../cards/dream-deck.js";
import { boardArchetypes, lureArchetype } from "../dreamers/archetype-board.js";
import { bankGlimmer } from "../shop/lost-found.js";

export const LANDSCAPE_ACTION_DEFS = {
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
  "lure-archetype": {
    label: "Call an Archetype",
    description: "The nearest Archetype steps 2 Landscapes toward you.",
  },
  "bank-glimmer": {
    label: "Gather Glimmer",
    description: "Bank 2 Glimmer for the next Lost & Found.",
  },
  "take-power": {
    label: "Return 2 Psyche",
    description: "Return 2 Psyche of your choice from the Subconscious.",
  },
  "swap-dreambeasts": {
    label: "Swap Dreambeasts",
    description: "Swap 2 active Dreambeasts between Landscapes.",
  },
  "remember-2": {
    label: "Remember 2",
    description: "Memory tile. Discard up to 2 Psyche from your hand, then Return that many +1 from the Subconscious. Every Psyche you Return is +1 Waking Mind.",
  },
  "return-2": {
    label: "Return 2 Psyche",
    description: "Return 2 Psyche of your choice from the Subconscious.",
  },
  "cycle-psyche": {
    label: "Cycle Psyche",
    description: "Discard a Psyche card, then draw Psyche equal to its value.",
  },
  "return-psyche": {
    label: "Return Psyche",
    description: "Return 1 Psyche card from the Subconscious.",
  },
  "replay-dream": {
    label: "Replay Dream",
    description: "Take the last discarded Dream and resolve it again.",
  },
  "return-1": {
    label: "Return 1 Psyche",
    description: "Return 1 Psyche of your choice from the Subconscious.",
  },
  "return-object": {
    label: "Return 1 Psyche",
    description: "Return 1 Psyche of your choice from the Subconscious.",
  },
  "draw-3-psyche": {
    label: "Draw 3 Psyche",
    description: "Draw 3 Psyche cards from the Psyche deck.",
  },
  "dream-onward": {
    label: "Dream Onward",
    description: "Flip the top tile of the Landscape deck, then place it free or put it on the bottom.",
  },
  "peek-then-move-1": {
    label: "Peek, then Move 1",
    description: "Look at the top tile of the Landscape deck, then move 1 step.",
  },
  "draw-psyche-equal-to-elasticity": {
    label: "Draw your Elasticity",
    description: "Draw Psyche equal to your Elasticity.",
  },
  "move-1-dreamer-1": {
    label: "Move 1 Step",
    description: "Move 1 Dreamer 1 Landscape.",
  },
  "draw-1-psyche": {
    label: "Draw 1 Psyche",
    description: "Draw 1 Psyche card.",
  },
};

function actionCadence(_actionId) {
  return "Once this Meet for the whole table.";
}

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

function beginPeekThenMove(state, player, tile) {
  const forgotten = adjacentTiles(state, tile.id).filter((t) => !t.center && (!t.revealed || t.wasteland));
  const startMove = () => {
    moveDreamerSteps(state, player, 1);
    return { ok: true };
  };
  if (!forgotten.length) return startMove();
  if (forgotten.length === 1 || state.tutorialMode) {
    const glimpsed = forgotten[0];
    addLog(state, `${tile.name}: glimpses ${glimpsed.name}${glimpsed.suit ? ` (${SUIT_LABELS[glimpsed.suit] || glimpsed.suit})` : ""}.`);
    return startMove();
  }
  const picked = requestChooseTile(state, {
    allowedIds: forgotten.map((t) => t.id),
    action: "record",
    remaining: 1,
    title: "Glimpse a forgotten Landscape",
    detail: "Peek one adjacent forgotten tile, then move 1 step.",
    followup: { landscapeAction: "peek-then-move-1", playerId: player.id },
  });
  if (picked !== "pending" && state.pendingObjectFollowup?.landscapeAction === "peek-then-move-1") {
    resumeLandscapeAction(state);
  }
  return { ok: true };
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

function moveEncounterOneStep(state, tile, encounter = null) {
  const enc = encounter || encounterOnLandscape(state, tile?.id);
  if (!tile || !enc) return false;
  const adj = adjacentTiles(state, tile.id).filter((t) => t.revealed && !t.wasteland);
  if (!adj.length) return false;
  if (state.tutorialMode) {
    const dest = adj[Math.floor(Math.random() * adj.length)];
    moveEncounterBetweenLandscapes(state, tile.id, dest.id, enc);
    addLog(state, `${enc.name} moves to ${dest.name}.`);
    return true;
  }
  return requestChooseTile(state, {
    allowedIds: adj.map((t) => t.id),
    action: "moveEncounter",
    fromTileId: tile.id,
    encounter: enc,
    title: `Move ${enc.name}`,
    detail: `Choose an adjacent Landscape for ${enc.name}.`,
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
  const pool = returnableCards(state);
  if (!pool.length) {
    addLog(state, "No Psyche waits in the Subconscious.");
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

function beastMoveChoices(state, movedKeys = []) {
  return allEncountersOnBoard(state)
    .filter(({ encounter }) => !movedKeys.includes(encounterKey(encounter)))
    .map(({ tile, encounter }) => ({
      id: `${tile.id}:${encounterKey(encounter)}`,
      label: `${encounter.name} on ${tile.name}`,
    }));
}

function beginMoveTwoDreambeasts(state) {
  if (!countEncountersOnBoard(state)) {
    addLog(state, "No Dreambeasts to move.");
    return { ok: false };
  }
  if (state.tutorialMode) {
    allEncountersOnBoard(state).slice(0, 2).forEach(({ tile, encounter }) => {
      moveEncounterOneStep(state, tile, encounter);
    });
    return { ok: true };
  }
  offerBeastMove(state, 2, []);
  return { ok: true, pending: true };
}

function offerBeastMove(state, remaining, movedKeys) {
  const actor = alivePlayers(state)[0];
  const choices = beastMoveChoices(state, movedKeys);
  if (!choices.length || remaining <= 0) return;
  offerEffectChoice(state, actor, {
    cardId: "landscape-action",
    title: "Move Dreambeasts",
    message: "Choose a Dreambeast to move 1 Landscape.",
    choices,
    payload: { actionId: "move-2-dreambeasts-1", remaining, movedKeys },
  });
}

function swapEncounterChoices(state, excludeKey = null) {
  return allEncountersOnBoard(state)
    .filter(({ tile, encounter }) => {
      const key = `${tile.id}:${encounterKey(encounter)}`;
      return key !== excludeKey;
    })
    .map(({ tile, encounter }) => ({
      id: `${tile.id}:${encounterKey(encounter)}`,
      label: `${encounter.name} on ${tile.name}`,
    }));
}

function swapEncountersByKeys(state, keyA, keyB) {
  const sepA = String(keyA).indexOf(":");
  const sepB = String(keyB).indexOf(":");
  const tileAId = String(keyA).slice(0, sepA);
  const encKeyA = String(keyA).slice(sepA + 1);
  const tileBId = String(keyB).slice(0, sepB);
  const encKeyB = String(keyB).slice(sepB + 1);
  const encA = tileEncounters(landscapeById(state, tileAId)).find((e) => encounterKey(e) === encKeyA);
  const encB = tileEncounters(landscapeById(state, tileBId)).find((e) => encounterKey(e) === encKeyB);
  if (!encA || !encB) return false;
  removeEncounterFromLandscape(state, tileAId, encA);
  removeEncounterFromLandscape(state, tileBId, encB);
  state._movingEncounter = true;
  addEncounterOnLandscape(state, tileAId, encB);
  addEncounterOnLandscape(state, tileBId, encA);
  state._movingEncounter = false;
  addLog(state, `Swapped ${encA.name} and ${encB.name}.`);
  return true;
}

function beginSwapDreambeasts(state) {
  if (countEncountersOnBoard(state) < 2) {
    addLog(state, "Need 2 active Dreambeasts to swap.");
    return { ok: false };
  }
  const encounters = allEncountersOnBoard(state);
  const tileCount = state.board.filter((t) => tileHasEncounters(t)).length;
  const needsEncounterPick = encounters.length > tileCount;

  if (state.tutorialMode) {
    const [a, b] = encounters.slice(0, 2);
    if (a && b) {
      swapEncountersByKeys(state, `${a.tile.id}:${encounterKey(a.encounter)}`, `${b.tile.id}:${encounterKey(b.encounter)}`);
    }
    return { ok: true };
  }

  if (needsEncounterPick) {
    const actor = alivePlayers(state)[0];
    const choices = swapEncounterChoices(state);
    offerEffectChoice(state, actor, {
      cardId: "landscape-action",
      title: "Swap Dreambeasts",
      message: "Choose the first Dreambeast to swap.",
      choices,
      payload: { actionId: "swap-dreambeasts", step: "pick-first" },
    });
    return { ok: true, pending: true };
  }

  const withEnc = state.board.filter((t) => tileHasEncounters(t));
  requestChooseTile(state, {
    allowedIds: withEnc.map((t) => t.id),
    action: "record",
    remaining: 2,
    title: "Swap Dreambeasts",
    detail: "Choose 2 Landscapes with Dreambeasts to swap.",
    followup: { landscapeAction: "swap-dreambeasts" },
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
    discardDreamCard(state, discard);
    addLog(state, `Resolving ${keep.name}; discarded ${discard.name}.`);
    if (isBossDreamCard(keep)) {
      spawnBossEncounterOnBed(state, keep);
      if (!state.dreamDiscard) state.dreamDiscard = [];
      state.dreamDiscard.push(keep);
    } else {
      helpers?.resolveCardEffect?.(state, keep, player, helpers);
    }
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

  if (actionId === "swap-dreambeasts" && pending.payload?.step === "pick-first") {
    state.pendingEffectChoice = null;
    const second = swapEncounterChoices(state, choiceId);
    if (!second.length) return true;
    offerEffectChoice(state, player, {
      cardId: "landscape-action",
      title: "Swap Dreambeasts",
      message: "Choose the second Dreambeast to swap.",
      choices: second,
      payload: { actionId: "swap-dreambeasts", step: "pick-second", firstKey: choiceId },
    });
    return true;
  }

  if (actionId === "swap-dreambeasts" && pending.payload?.step === "pick-second") {
    state.pendingEffectChoice = null;
    swapEncountersByKeys(state, pending.payload.firstKey, choiceId);
    return true;
  }

  if (actionId === "move-2-dreambeasts-1") {
    const [tileId, encKey] = String(choiceId).split(":");
    const tile = landscapeById(state, tileId);
    const encounter = tileEncounters(tile).find((enc) => encounterKey(enc) === encKey);
    const remaining = pending.payload.remaining ?? 2;
    const movedKeys = pending.payload.movedKeys || [];
    state.pendingEffectChoice = null;
    if (tile && encounter) {
      moveEncounterOneStep(state, tile, encounter);
      const nextMoved = [...movedKeys, encounterKey(encounter)];
      if (state.landscapePick) {
        state.landscapePick.followup = {
          landscapeAction: "move-2-dreambeasts-1",
          remaining: remaining - 1,
          movedKeys: nextMoved,
        };
      } else {
        offerBeastMove(state, remaining - 1, nextMoved);
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
    const encA = encounterOnLandscape(state, a.id);
    const encB = encounterOnLandscape(state, b.id);
    if (encA && encB) {
      removeEncounterFromLandscape(state, a.id, encA);
      removeEncounterFromLandscape(state, b.id, encB);
      state._movingEncounter = true;
      addEncounterOnLandscape(state, a.id, encB);
      addEncounterOnLandscape(state, b.id, encA);
      state._movingEncounter = false;
      addLog(state, `Swapped ${encA.name} and ${encB.name}.`);
    }
    return true;
  }

  if (action === "move-2-dreamers-1") {
    presentNextDreamerMove(state, follow.remaining ?? 1, follow.moved || []);
    return true;
  }

  if (action === "peek-then-move-1") {
    const id = (follow.pickedIds || [])[0];
    const glimpsed = landscapeById(state, id);
    if (glimpsed) {
      addLog(state, `Glimpses ${glimpsed.name}${glimpsed.suit ? ` (${SUIT_LABELS[glimpsed.suit] || glimpsed.suit})` : ""}.`);
    }
    const mover = alivePlayers(state).find((p) => p.id === follow.playerId) || alivePlayers(state)[0];
    if (mover) moveDreamerSteps(state, mover, 1);
    return true;
  }

  if (action === "move-2-dreambeasts-1") {
    offerBeastMove(state, follow.remaining ?? 0, follow.movedKeys || []);
    return true;
  }

  return true;
}

export function getUniqueLandscapeActionChoices(tile) {
  if (!tile?.revealed || tile.hidden || tile.wasteland) return [];

  if (tile.landscapeActions?.length) {
    return tile.landscapeActions.map((id) => {
      const def = LANDSCAPE_ACTION_DEFS[id] || { label: id, description: "" };
      return {
        id,
        ...def,
        description: `${def.description || ""} ${actionCadence(id)}`.trim(),
      };
    });
  }

  if (!tile.uniqueAction) return [];

  const def = LANDSCAPE_ACTION_DEFS[tile.uniqueAction];
  if (!def) return [];

  return [{
    id: tile.uniqueAction,
    ...def,
    description: `${def.description} ${actionCadence(tile.uniqueAction)}`,
  }];
}

/** Ainmos: Landscapes no longer draw Mindstream. Events open Archetype Meets instead. */
export function canDrawMindstreamOnLandscape(_tile) {
  return false;
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
  const shut = landscapeActionBlockedByBoss(state, tile, actionId);
  if (shut) {
    addLog(state, shut);
    return { ok: false, refund: true, reason: shut };
  }
  const landscapeName = tile.name;

  switch (actionId) {
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

    case "move-1-dreamer-1": {
      moveDreamerSteps(state, player, 1);
      return { ok: true };
    }

    case "peek-then-move-1":
      return beginPeekThenMove(state, player, tile);

    case "draw-psyche-equal-to-elasticity": {
      const count = Math.max(0, totalStat(player, "elasticity", state));
      if (count <= 0) {
        addLog(state, `${player.name} has no Elasticity to draw from.`);
        return { ok: false, refund: true };
      }
      const drawn = drawPsycheForPlayer(state, player, count);
      addLog(state, `${landscapeName}: ${player.name} draws ${drawn.length} Psyche (Elasticity ${count}).`);
      return { ok: true };
    }

    case "draw-1-psyche": {
      const drawn = drawPsycheForPlayer(state, player, 1);
      if (!drawn.length) {
        addLog(state, "The Psyche deck is empty.");
        return { ok: false, refund: true };
      }
      addLog(state, `${landscapeName}: ${player.name} draws 1 Psyche.`);
      return { ok: true };
    }

    case "move-2-dreambeasts-1":
      return beginMoveTwoDreambeasts(state);

    case "all-toward-bed": {
      alivePlayers(state).forEach((p) => stepTowardBed(state, p));
      return { ok: true };
    }

    case "lure-archetype": {
      const here = state.board.find((t) => t.id === player.landscapeId) || tile;
      const nearest = boardArchetypes(state)
        .filter(({ tile: at }) => at.id !== here.id)
        .sort((x, y) => hexDistance(x.tile, here) - hexDistance(y.tile, here))[0];
      if (!nearest) {
        addLog(state, `${landscapeName}: no Archetype stands elsewhere to call.`);
        return { ok: false, refund: true };
      }
      const first = lureArchetype(state, nearest.arch.id, here.id);
      if (first) lureArchetype(state, nearest.arch.id, here.id);
      if (!first) {
        addLog(state, `${landscapeName}: ${nearest.arch.name} has no open path toward you.`);
        return { ok: false, refund: true };
      }
      addLog(state, `${landscapeName}: ${player.name} calls ${nearest.arch.name} closer.`);
      return { ok: true };
    }

    case "bank-glimmer": {
      const got = bankGlimmer(state, 2);
      addLog(state, `${landscapeName}: ${got} Glimmer gathered for the Lost & Found.`);
      return got ? { ok: true } : { ok: false, refund: true, reason: "Glimmer is full." };
    }

    // 0.23: Power Tokens only come from Dreambeasts and Archetypes; old Take Power tiles Return 2 Psyche.
    case "take-power":

    case "swap-dreambeasts":
      return beginSwapDreambeasts(state);

    case "remember-2":
      return beginRemember(state, player, 2, { source: landscapeName })
        ? { ok: true }
        : { ok: false, refund: true };

    case "return-2":
      return { ok: true, ...returnTypedCard(state, null, 2) };

    case "return-1":
    case "return-psyche":
    case "return-object":
      return { ok: true, ...returnTypedCard(state, null, 1) };

    case "cycle-psyche":
      return beginCyclePsyche(state, player, tile);

    case "dream-onward": {
      // 42.0: The Bed builds the dream instead of refilling a hand.
      if (isFreeformBoard(state)) {
        if (!tileDeckCount(state)) {
          addLog(state, "The Bed has nothing left to dream: the tile deck is empty.");
          return { ok: false, refund: true };
        }
        beginBedTileFlip(state);
        return { ok: true, pending: true };
      }
      if (!revealableTiles(state).length) {
        addLog(state, "The Bed has nothing left to dream: every Landscape is awake.");
        return { ok: false, refund: true };
      }
      beginFreeRevealPicking(state, 1);
      return { ok: true, pending: true };
    }

    case "draw-3-psyche": {
      const drawn = drawPsycheForPlayer(state, player, 3);
      addLog(state, `${landscapeName}: ${player.name} draws ${drawn.length} Psyche.`);
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

