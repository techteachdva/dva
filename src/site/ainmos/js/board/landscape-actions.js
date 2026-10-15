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
import { requestChooseTile, beginFreeRevealPicking, beginBedTileFlip, revealableTiles, revealCapacity } from "./landscapes.js";
import { isFreeformBoard, tileDeckCount, refreshVault } from "./dreamscape-vault.js";
import { cyclePosition } from "../core/cycle.js";
import { DREAM_FORMS, formLevel, levelUpForm } from "../cards/dream-forms.js";
import { paymentFor } from "../shop/lost-found.js";
import { onObjectDrawn, handLimitForPlayer } from "../effects/objects.js";
import { logMoment } from "../core/narrator.js";
import { stepBeastsTowardDreamers } from "../encounters/meet-phase.js";
import { SUIT_LABELS, totalStat } from "../core/rules.js";
import { queueMindstreamDrawFx, queueMindstreamDiscardFx, cancelQueuedMindstreamDrawFx } from "./board-fx.js";
import { adjacentTiles, hexDistance } from "../core/hex.js";
import {
  listSubconsciousCards,
  returnableCards,
  requestReturnCards,
  finalizeReturn,
  enqueueDiscardFromHand,
  enqueueRepressFromHand,
  enqueueReturnCards,
} from "../dreamers/subconscious.js";
import {
  encounterFromDreambeastCard,
  reshuffleMindstreamDiscardIfNeeded,
  reorderMindstreamTop,
  pullDreambeastFromMindstream,
  stampBeastMillDiscard,
  objectForPlayer,
  discardToMindstream,
} from "../cards/mindstream-supply.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { shuffle } from "../core/data.js";
import { offerEffectChoice, registerEffectResolver } from "../effects/effect-choices.js";
import { beginRemember } from "../effects/remember.js";
import { recordCancellableMove } from "../dreamers/dreamer-powers.js";
import { discardDreamCard, isBossDreamCard, spawnBossEncounterOnBed } from "../cards/dream-deck.js";
import { boardArchetypes, lureArchetype, nextStepToward } from "../dreamers/archetype-board.js";
import { bankGlimmer } from "../shop/lost-found.js";

/**
 * Ainmos 0.24 Landscapes Re-Explored. Every Landscape offers two Meet actions:
 * Call a Dreambeast of its suit, and one action no other Landscape has.
 * Lucidity Landscapes see and remember, Elasticity Landscapes move you, and
 * Willpower Landscapes fight. Each action works once per Meet on its Landscape.
 */
export const CALL_DREAMBEAST = "call-dreambeast";

export const LANDSCAPE_ACTION_DEFS = {
  [CALL_DREAMBEAST]: {
    label: "Call a Dreambeast",
    description: "A Dreambeast of this Landscape's suit appears here (Power 3 + the Cycle). Beat it for a Power Token or a random Object. Left standing at dusk, it Represses 1 Psyche.",
  },
  // Lucidity: see and remember.
  "lure-archetype": { label: "Call an Archetype", description: "The nearest Archetype steps 2 Landscapes toward you." },
  "remember-2": { label: "Remember 2", description: "Discard up to 2 Psyche from your hand, then Return that many +1 from the Subconscious, your choice." },
  "swap-landscapes": { label: "Shatter and Swap", description: "Swap the places of 2 Landscapes on the Dreamscape. Everything on them moves too." },
  "grand-prize": { label: "Grand Prize", description: "Bank 6 Glimmer for the next Lost & Found." },
  "bank-glimmer": { label: "Gather Glimmer", description: "Bank 2 Glimmer for the next Lost & Found." },
  "dream-onward": { label: "Dream Onward", description: "Flip the top Landscape of the deck, then place it free or put it on the bottom." },
  "return-2": { label: "Return 2 Psyche", description: "Return 2 Psyche of your choice from the Subconscious." },
  "pop-quiz": { label: "Pop Quiz", description: "Draw 2 Psyche, then Discard 1 Psyche from your hand." },
  "rest": { label: "Rest", description: "Return 1 Psyche of your choice from the Subconscious, then draw 1 Psyche." },
  "routine": { label: "Daily Routine", description: "Name a suit. Draw the next Psyche of that suit from the Psyche deck." },
  "clear-mist": { label: "Clear the Mist", description: "Redeal the Dreamscape Vault for free." },
  "study": { label: "Study", description: "Discard 3 Psyche to raise one Dream Form 1 level for the rest of the night." },
  "collectors-fair": { label: "Collector's Fair", description: "A stall of up to 3 Objects that belong to sets. Buy one with Psyche of its suit." },
  "sink-surface": { label: "Sink and Surface", description: "Repress 1 to 3 Psyche from your hand, then Return that many of your choice from the Subconscious." },
  "mirage": { label: "Mirage", description: "Place 2 Landscapes from the Dreamscape Vault for free." },
  // Elasticity: move.
  "hide": { label: "Hide in the Trees", description: "At the next Explore, Dreambeasts do not chase you." },
  "move-1-dreamer-2": { label: "Move Your Dreamer 2 Spaces", description: "Move your Dreamer to a Landscape 2 steps away." },
  "endless-doors": { label: "Endless Doors", description: "Move your Dreamer to any placed Elasticity Landscape." },
  "move-2-dreambeasts-1": { label: "Dance with Dreambeasts", description: "Move up to 2 Dreambeasts 1 Landscape each." },
  "ride-tide": { label: "Ride the Tide", description: "Move your Dreamer to any Landscape next to an Archetype." },
  "sugar-rush": { label: "Sugar Rush", description: "Your next Explore gets +2 steps." },
  // Willpower: fight.
  "rally": { label: "Rally", description: "Your next fight rolls +2 dice." },
  "cycle-psyche": { label: "Cycle Psyche", description: "Discard 1 Psyche, then draw Psyche equal to its value." },
  "lock-doors": { label: "Lock the Doors", description: "At this dusk, Dreambeasts Repress nothing." },
  "scorch": { label: "Scorch", description: "The Dreambeast on your Landscape loses 2 Power for good (never below 1)." },
  "lure-beast": { label: "Lure a Dreambeast", description: "The nearest Dreambeast moves onto your Landscape." },
  "frenzy": { label: "Feeding Frenzy", description: "Every Dreambeast steps 1 Landscape toward you." },
  "madness": { label: "Madness", description: "Discard your whole hand, then draw that many Psyche." },
  "pawn-shop": { label: "Pawn Shop", description: "Discard 1 of your Objects, then draw Psyche up to your hand limit." },
  "sanctum": { label: "Inner Sanctum", description: "Return 1 Psyche of your choice from the Subconscious straight to your hand." },
  // Older actions that some effects still name.
  "swap-dreambeasts": { label: "Swap Dreambeasts", description: "Swap 2 Dreambeasts between their Landscapes." },
  "return-1": { label: "Return 1 Psyche", description: "Return 1 Psyche of your choice from the Subconscious." },
  "draw-1-psyche": { label: "Draw 1 Psyche", description: "Draw 1 Psyche." },
  "draw-3-psyche": { label: "Draw 3 Psyche", description: "Draw 3 Psyche." },
  "move-1-dreamer-1": { label: "Move Your Dreamer 1 Space", description: "Move your Dreamer 1 Landscape." },
};

function actionCadence(_actionId) {
  return "Once each Meet on this Landscape.";
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


  if (actionId === "study") {
    state.pendingEffectChoice = null;
    if (!player) return true;
    levelUpForm(state, choiceId, 1);
    const form = DREAM_FORMS.find((f) => f.id === choiceId);
    logMoment(state, `Study: ${form?.name || "a Dream Form"} rises to level ${formLevel(state, choiceId)}.`);
    enqueueDiscardFromHand(state, player, 3, { reason: "Study: Discard 3 Psyche.", strict: true });
    return true;
  }

  if (actionId === "collectors-fair") {
    state.pendingEffectChoice = null;
    if (!player || choiceId === "leave") return true;
    const card = takeObjectFromDecks(state, choiceId);
    if (!card) return true;
    const pay = paymentFor(player, card.price || 1, { suit: card.suit });
    if (!pay) {
      putObjectBack(state, card);
      return true;
    }
    const ids = new Set(pay.cards.map((c) => c.instanceId));
    player.hand = player.hand.filter((c) => !ids.has(c.instanceId));
    state.psycheDiscard.push(...pay.cards);
    onObjectDrawn(state, player, objectForPlayer(card), rememberLandscapeHelpers());
    logMoment(state, `Collector's Fair: ${player.name} buys ${card.name}.`);
    return true;
  }

  if (actionId === "sink-surface") {
    state.pendingEffectChoice = null;
    const n = Math.max(1, Number(choiceId) || 1);
    if (!player) return true;
    enqueueRepressFromHand(state, player, n, { reason: `Sink and Surface: Repress ${n} Psyche.`, strict: true });
    enqueueReturnCards(state, n, player, { reason: `Sink and Surface: Return ${n} Psyche of your choice.` });
    return true;
  }

  if (actionId === "pawn-shop") {
    state.pendingEffectChoice = null;
    if (!player) return true;
    const obj = [...(player.objects || []), ...(player.persistent || [])].find((o) => o.instanceId === choiceId);
    if (!obj) return true;
    player.objects = (player.objects || []).filter((o) => o.instanceId !== choiceId);
    player.persistent = (player.persistent || []).filter((o) => o.instanceId !== choiceId);
    discardToMindstream(state, obj);
    const room = Math.max(0, handLimitForPlayer(state, player) - player.hand.length);
    const drawn = room ? drawPsycheForPlayer(state, player, room) : [];
    logMoment(state, `Pawn Shop: ${player.name} pawns ${obj.name} and draws ${drawn.length} Psyche.`);
    return true;
  }

  if (actionId === "routine") {
    state.pendingEffectChoice = null;
    if (!player) return true;
    if (!state.psycheDeck.some((c) => c.suit === choiceId) && state.psycheDiscard?.length) {
      state.psycheDeck.push(...shuffle(state.psycheDiscard.splice(0)));
    }
    const idx = state.psycheDeck.findIndex((c) => c.suit === choiceId);
    if (idx < 0) {
      addLog(state, `No ${SUIT_LABELS[choiceId] || choiceId} Psyche is left to draw.`);
      return true;
    }
    const [card] = state.psycheDeck.splice(idx, 1);
    player.hand.push(card);
    logMoment(state, `Daily Routine: ${player.name} draws ${card.name}.`);
    return true;
  }

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
  const ids = tile.landscapeActions?.length
    ? [...tile.landscapeActions]
    : [tile.uniqueAction].filter(Boolean);
  if (tile.suit && !tile.center && !ids.includes(CALL_DREAMBEAST)) ids.push(CALL_DREAMBEAST);
  return ids
    .filter((id) => LANDSCAPE_ACTION_DEFS[id])
    .map((id) => {
      const def = LANDSCAPE_ACTION_DEFS[id];
      const suitName = SUIT_LABELS[tile.suit] || "";
      const label = def.label;
      const description = id === CALL_DREAMBEAST && suitName
        ? def.description.replace("this Landscape's suit", suitName)
        : def.description;
      return { id, ...def, label, description: `${description} ${actionCadence(id)}`.trim() };
    });
}

/**
 * Why this Landscape action can do nothing right now, or "" when it can.
 * The ring greys the button out and shows this as its hint.
 */
export function landscapeActionUnavailable(state, tile, player, actionId) {
  if (!tile || !player) return "";
  const here = landscapeById(state, player.landscapeId) || tile;
  const beasts = allEncountersOnBoard(state);
  const handSize = (player.hand || []).length;
  switch (actionId) {
    case CALL_DREAMBEAST:
      return encounterOnLandscape(state, tile.id) ? `A Dreambeast already stands on ${tile.name}.` : "";
    case "lure-archetype": {
      const all = boardArchetypes(state);
      if (!all.length) return "No Archetype stands on the Dreamscape yet. Dream 3 of each Cycle calls one.";
      return all.some(({ tile: at }) => at.id !== here.id) ? "" : "The Archetype already stands with you.";
    }
    case "ride-tide":
      return boardArchetypes(state).length ? "" : "No Archetype stands on the Dreamscape yet.";
    case "scorch":
      return encounterOnLandscape(state, here.id) ? "" : "No Dreambeast stands on your Landscape.";
    case "lure-beast":
      return beasts.some(({ tile: at }) => at.id !== here.id) ? "" : "No other Dreambeast stands on the Dreamscape.";
    case "frenzy":
    case "move-2-dreambeasts-1":
      return beasts.length ? "" : "No Dreambeast stands on the Dreamscape.";
    case "sanctum":
    case "return-2":
    case "rest":
      return returnableCards(state).length ? "" : "No Psyche waits in the Subconscious.";
    case "pawn-shop":
      return [...(player.objects || []), ...(player.persistent || [])].length ? "" : "You have no Object to pawn.";
    case "study":
      return handSize >= 3 ? "" : "Study costs 3 Psyche from your hand.";
    case "madness":
    case "sink-surface":
    case "cycle-psyche":
      return handSize ? "" : "Your hand is empty.";
    case "mirage":
      return revealCapacity(state) ? "" : "There is nothing left to place.";
    case "endless-doors":
      return state.board.some((t) => t.revealed && t.suit === "elasticity" && t.id !== player.landscapeId) ? "" : "No other Elasticity Landscape is placed.";
    default:
      return "";
  }
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
      const standing = boardArchetypes(state).filter(({ tile: at }) => at.id !== here.id);
      if (!standing.length) {
        return { ok: false, refund: true, reason: boardArchetypes(state).length ? "The Archetype already stands with you." : "No Archetype stands on the Dreamscape yet. Dream 3 of each Cycle calls one." };
      }
      const nearest = standing
        .map((entry) => ({ ...entry, step: nextStepToward(state, entry.tile.id, here.id) }))
        .filter((entry) => entry.step)
        .sort((x, y) => hexDistance(x.tile, here) - hexDistance(y.tile, here))[0];
      if (!nearest) return { ok: false, refund: true, reason: "No placed Landscapes connect the Archetype to you." };
      const from = nearest.tile.name;
      lureArchetype(state, nearest.arch.id, here.id);
      lureArchetype(state, nearest.arch.id, here.id);
      const now = boardArchetypes(state).find(({ arch: a }) => a.id === nearest.arch.id)?.tile;
      logMoment(state, `${landscapeName}: ${nearest.arch.name} is called from ${from} to ${now?.name || "you"}.`);
      return { ok: true };
    }

    case "bank-glimmer": {
      const got = bankGlimmer(state, 2);
      addLog(state, `${landscapeName}: ${got} Glimmer gathered for the Lost & Found.`);
      return got ? { ok: true } : { ok: false, refund: true, reason: "Glimmer is full." };
    }

    // 0.23: Power Tokens only come from Dreambeasts and Archetypes; old Take Power tiles Return 2 Psyche.
    case "take-power":
      return { ok: true, ...returnTypedCard(state, null, 2) };

    case CALL_DREAMBEAST:
      return callDreambeast(state, tile);

    case "pop-quiz": {
      const drawn = drawPsycheForPlayer(state, player, 2);
      if (!drawn.length) return { ok: false, refund: true, reason: "The Psyche deck is empty." };
      addLog(state, `${landscapeName}: ${player.name} draws ${drawn.length} Psyche, then Discards 1.`);
      enqueueDiscardFromHand(state, player, 1, { reason: `${landscapeName}: Discard 1 Psyche.`, strict: true });
      return { ok: true };
    }

    case "rest": {
      const back = returnTypedCard(state, null, 1);
      const drawn = drawPsycheForPlayer(state, player, 1);
      addLog(state, `${landscapeName}: ${player.name} rests and draws ${drawn.length} Psyche.`);
      if (back.ok === false && !drawn.length) return { ok: false, refund: true };
      return back.pending ? { ok: true, pending: true } : { ok: true };
    }

    case "routine":
      offerEffectChoice(state, player, {
        cardId: "landscape-action",
        title: "Daily Routine",
        message: "Name a suit. You draw the next Psyche of that suit.",
        choices: ["lucidity", "elasticity", "willpower"].map((suit) => ({ id: suit, label: SUIT_LABELS[suit] })),
        payload: { actionId: "routine" },
      });
      return { ok: true, pending: true };

    case "clear-mist": {
      if (!refreshVault(state)) return { ok: false, refund: true, reason: "The Vault has nothing to redeal." };
      state.vaultRefreshesThisRound = Math.max(0, (state.vaultRefreshesThisRound || 1) - 1);
      addLog(state, `${landscapeName}: the Vault is redealt.`);
      return { ok: true };
    }

    case "hide":
      state.hideFromBeasts = true;
      logMoment(state, `${landscapeName}: you hide. At the next Explore, Dreambeasts do not chase you.`);
      return { ok: true };

    case "endless-doors": {
      const doors = state.board.filter((t) => t.revealed && t.suit === "elasticity" && t.id !== player.landscapeId);
      if (!doors.length) return { ok: false, refund: true, reason: "No other Elasticity Landscape is placed." };
      requestChooseTile(state, { allowedIds: doors.map((t) => t.id), action: "movePlayer", playerId: player.id, title: "Endless Doors", detail: "Step through to any Elasticity Landscape." });
      return { ok: true };
    }

    case "ride-tide": {
      const near = new Set();
      boardArchetypes(state).forEach(({ tile: at }) => adjacentTiles(state, at.id).forEach((t) => {
        if (t.revealed && t.id !== player.landscapeId) near.add(t.id);
      }));
      if (!near.size) return { ok: false, refund: true, reason: "No Archetype stands on the Dreamscape." };
      requestChooseTile(state, { allowedIds: [...near], action: "movePlayer", playerId: player.id, title: "Ride the Tide", detail: "Wash up next to an Archetype." });
      return { ok: true };
    }

    case "sugar-rush":
      state.sugarRushSteps = (state.sugarRushSteps || 0) + 2;
      logMoment(state, `${landscapeName}: Sugar Rush! Your next Explore gets +2 steps.`);
      return { ok: true };

    case "rally":
      state.nextFightDice = (state.nextFightDice || 0) + 2;
      logMoment(state, `${landscapeName}: you rally. Your next fight rolls +2 dice.`);
      return { ok: true };

    case "lock-doors":
      state.duskSparedRound = state.round;
      logMoment(state, `${landscapeName}: the doors are locked. Dreambeasts Repress nothing at this dusk.`);
      return { ok: true };

    case "scorch": {
      const here = encounterOnLandscape(state, player.landscapeId);
      if (!here) return { ok: false, refund: true, reason: "No Dreambeast stands on your Landscape." };
      here.accept = Math.max(1, (Number(here.accept) || 1) - 2);
      logMoment(state, `${landscapeName}: ${here.name} is scorched to Power ${here.accept}.`);
      return { ok: true };
    }

    case "lure-beast": {
      const here = landscapeById(state, player.landscapeId) || tile;
      const nearest = allEncountersOnBoard(state)
        .filter(({ tile: at }) => at.id !== here.id)
        .sort((x, y) => hexDistance(x.tile, here) - hexDistance(y.tile, here))[0];
      if (!nearest) return { ok: false, refund: true, reason: "No other Dreambeast stands on the Dreamscape." };
      moveEncounterBetweenLandscapes(state, nearest.tile.id, here.id, nearest.encounter);
      logMoment(state, `${landscapeName}: ${nearest.encounter.name} is lured onto ${here.name}.`);
      return { ok: true };
    }

    case "frenzy": {
      const moved = stepBeastsTowardDreamers(state, { force: true });
      if (!moved) return { ok: false, refund: true, reason: "No Dreambeast can step toward you." };
      logMoment(state, `${landscapeName}: ${moved} Dreambeast${moved === 1 ? "" : "s"} step toward you.`);
      return { ok: true };
    }

    case "madness": {
      const n = player.hand.length;
      if (!n) return { ok: false, refund: true, reason: "Your hand is empty." };
      state.psycheDiscard.push(...player.hand.splice(0));
      state.selectedHand = [];
      const drawn = drawPsycheForPlayer(state, player, n);
      logMoment(state, `${landscapeName}: madness! ${player.name} throws away ${n} Psyche and draws ${drawn.length}.`);
      return { ok: true };
    }

    case "grand-prize": {
      const got = bankGlimmer(state, 6);
      logMoment(state, `${landscapeName}: Grand Prize! ${got} Glimmer banked for the Lost & Found.`);
      return got ? { ok: true } : { ok: false, refund: true, reason: "Glimmer is full." };
    }

    case "study": {
      if ((player.hand || []).length < 3) return { ok: false, refund: true, reason: "Study costs 3 Psyche from your hand." };
      offerEffectChoice(state, player, {
        cardId: "landscape-action",
        title: "Study",
        message: "Choose a Dream Form to raise 1 level. Then Discard 3 Psyche.",
        choices: DREAM_FORMS.map((form) => ({ id: form.id, label: `${form.name} (level ${formLevel(state, form.id)} to ${formLevel(state, form.id) + 1})` })),
        payload: { actionId: "study" },
      });
      return { ok: true, pending: true };
    }

    case "collectors-fair": {
      const stall = setObjectsForFair(state);
      if (!stall.length) return { ok: false, refund: true, reason: "No set Objects are left in the Object decks." };
      offerEffectChoice(state, player, {
        cardId: "landscape-action",
        title: "Collector's Fair",
        message: "Buy one set Object with Psyche of its suit, or walk away.",
        choices: [
          ...stall.map((card) => {
            const pay = paymentFor(player, card.price || 1, { suit: card.suit });
            return {
              id: card.instanceId,
              label: `${card.name} · ${card.price || 1} ${SUIT_LABELS[card.suit] || ""}`,
              hint: pay ? card.text : `Not enough ${SUIT_LABELS[card.suit] || ""} Psyche. ${card.text}`,
              disabled: !pay,
            };
          }),
          { id: "leave", label: "Walk away", hint: "Buy nothing." },
        ],
        payload: { actionId: "collectors-fair" },
      });
      return { ok: true, pending: true };
    }

    case "sink-surface": {
      const max = Math.min(3, (player.hand || []).length);
      if (!max) return { ok: false, refund: true, reason: "Your hand is empty." };
      offerEffectChoice(state, player, {
        cardId: "landscape-action",
        title: "Sink and Surface",
        message: "How many Psyche sink into the Subconscious? You Return that many of your choice.",
        choices: Array.from({ length: max }, (_, i) => ({ id: String(i + 1), label: `${i + 1} Psyche` })),
        payload: { actionId: "sink-surface" },
      });
      return { ok: true, pending: true };
    }

    case "mirage": {
      const n = Math.min(2, revealCapacity(state));
      if (n < 1) return { ok: false, refund: true, reason: "There is nothing left to place." };
      beginFreeRevealPicking(state, n);
      logMoment(state, `${landscapeName}: a mirage. Place ${n} Landscape${n === 1 ? "" : "s"} from the Vault for free.`);
      return { ok: true, pending: true };
    }

    case "pawn-shop": {
      const owned = [...(player.objects || []), ...(player.persistent || [])];
      if (!owned.length) return { ok: false, refund: true, reason: "You have no Object to pawn." };
      offerEffectChoice(state, player, {
        cardId: "landscape-action",
        title: "Pawn Shop",
        message: "Discard which Object? You draw Psyche up to your hand limit.",
        choices: owned.map((o) => ({ id: o.instanceId, label: o.name })),
        payload: { actionId: "pawn-shop" },
      });
      return { ok: true, pending: true };
    }

    case "sanctum": {
      if (!returnableCards(state).length) return { ok: false, refund: true, reason: "No Psyche waits in the Subconscious." };
      state.returnToHandPlayerId = player.id;
      return { ok: true, ...returnTypedCard(state, null, 1) };
    }

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

const SUITS = ["lucidity", "elasticity", "willpower"];

/** Up to 3 set Objects still in the Object decks, one per suit when it can. */
function setObjectsForFair(state) {
  const fits = (c) => (c.tags || []).length && c.subtype !== "must-play";
  const out = [];
  SUITS.forEach((suit) => {
    const card = (state.objectDecks?.[suit] || []).find(fits);
    if (card) out.push(card);
  });
  SUITS.forEach((suit) => (state.objectDecks?.[suit] || []).forEach((c) => {
    if (out.length < 3 && fits(c) && !out.includes(c)) out.push(c);
  }));
  return out;
}

function takeObjectFromDecks(state, instanceId) {
  for (const suit of SUITS) {
    const deck = state.objectDecks?.[suit] || [];
    const i = deck.findIndex((c) => c.instanceId === instanceId);
    if (i >= 0) return deck.splice(i, 1)[0];
  }
  return null;
}

function putObjectBack(state, card) {
  const deck = state.objectDecks?.[card.suit];
  if (deck) deck.push(card);
}

/** Call a Dreambeast of this Landscape's suit. Its Power is 3 + the Cycle, never above its printed Power. */
function callDreambeast(state, tile) {
  if (!tile?.suit) return { ok: false, refund: true, reason: "The Bed calls no Dreambeast." };
  if (encounterOnLandscape(state, tile.id)) {
    return { ok: false, refund: true, reason: `A Dreambeast already stands on ${tile.name}.` };
  }
  const pulled = pullDreambeastFromMindstream(state, { suit: tile.suit });
  if (!pulled) return { ok: false, refund: true, reason: "No Dreambeast answers the call." };
  const beast = encounterFromDreambeastCard(pulled.card);
  const printed = Number(beast.accept) || 5;
  beast.basePower = printed;
  beast.accept = Math.min(printed, 3 + (cyclePosition(state).cycle || 1));
  beast.called = true;
  addEncounterOnLandscape(state, tile.id, beast);
  logMoment(state, `${beast.name} answers the call on ${tile.name}: Power ${beast.accept}.`);
  return { ok: true };
}

