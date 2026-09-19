import {
  addLog,
  drawPsycheForPlayer,
  landscapeById,
  acquireArchetype,
  setEncounterOnLandscape,
  removeEncounterFromLandscape,
  encounterOnLandscape,
  encounterKey,
  findEncounterOnBoard,
  tileEncounters,
  revealedLandscapeTiles,
  allEncountersOnBoard,
  moveEncounterBetweenLandscapes,
} from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { grantPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards, enqueueReturnCards, dreambeastToHandCard } from "./subconscious.js";
import { handRoomForPsycheDraw, beginNothingResolution } from "./objects.js";
import {
  pullDreambeastFromMindstream,
  pullFromMindstreamByType,
  encounterFromDreambeastCard,
} from "./mindstream-supply.js";
import { encounterRejectCost, applyRejectReward, applyAcceptEffect } from "./dreambeasts.js";
import { canAddAllyToHand, allyHandLimitForPlayer, psycheCardValue } from "./psyche.js";
import { requestChooseTile, beginFreeRevealPicking } from "./landscapes.js";
import { edgeLandscapes } from "./hex.js";
import { SUIT_LABELS } from "./rules.js";
import { resumeLandscapeAction } from "./landscape-actions.js";
import { resumeArchetypeFollowup, continueArchetypeQueues } from "./archetypes.js";
import { continueDeferredEventQueues, startSilverForcedAccept } from "./event-choices.js";

let lastHelpers = null;

export function rememberObjectHelpers(helpers) {
  if (helpers) lastHelpers = helpers;
  return lastHelpers;
}

function useHelpers(helpers) {
  return rememberObjectHelpers(helpers);
}

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function dreamerCount(state) {
  return alive(state).length;
}

function returnN(state, count, player = null) {
  if (count <= 0) return;
  const result = requestReturnCards(state, count, player);
  if (result?.pending) addLog(state, `Choose ${result.count} card(s) to Return.`);
}

function landscapeReady(state, id) {
  const tile = landscapeById(state, id);
  return !!(tile?.revealed && !tile.wasteland);
}

function revealedTiles(state) {
  return revealedLandscapeTiles(state);
}

function tileName(state, id) {
  return landscapeById(state, id)?.name || id;
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function movePlayerToId(state, player, landscapeId) {
  if (!player || !landscapeReady(state, landscapeId)) return false;
  player.landscapeId = landscapeId;
  addLog(state, `${player.name} moves to ${tileName(state, landscapeId)}.`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

function offerChoice(state, player, spec) {
  state.pendingObjectChoice = {
    ui: spec.ui || "choice",
    cardId: spec.cardId,
    playerId: player.id,
    step: spec.step || "choice",
    title: spec.title,
    message: spec.message,
    choices: spec.choices || [],
    cards: spec.cards || [],
    top: spec.top || [],
    order: spec.order || [],
    need: spec.need || 0,
    payload: spec.payload || {},
  };
  addLog(state, spec.log || `${spec.title}: choose.`);
}

function dreamerChoices(state, { disabledHint = "" } = {}) {
  return alive(state).map((p) => ({
    id: p.id,
    label: p.name,
    hint: disabledHint || `Move ${p.name}.`,
  }));
}

function destChoices(state, ids) {
  return ids.map((id) => {
    const ready = landscapeReady(state, id);
    return {
      id,
      label: tileName(state, id),
      hint: ready ? `Move there now.` : "Not revealed yet.",
      disabled: !ready,
    };
  });
}

function psycheSpendCards(player) {
  return (player.hand || []).filter((c) => c.type === "psyche" || c.type === "dreambeast");
}

function discardPsycheCard(state, player, card) {
  player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
  state.psycheDiscard.push(card);
  recordQuestEvent(state, "discard_psyche", { count: 1 });
}

function askDiscardPsyche(state, player, spec) {
  const cards = psycheSpendCards(player);
  if (!cards.length) return false;
  offerChoice(state, player, {
    cardId: spec.cardId,
    ui: "cards",
    step: "discard-psyche",
    title: spec.title,
    message: spec.message || "Discard 1 Psyche:",
    cards,
    payload: spec.payload || {},
  });
  return true;
}

const ELEMENT_MOVES = {
  water: ["endless-ocean", "sea-of-teeth"],
  air: ["sky", "silver-mist"],
  earth: ["forest", "candy-mountain"],
  fire: ["lava", "desert"],
};

function setRequiredForTag(tag) {
  if (tag === "body") return 5;
  if (tag === "element") return 4;
  return 3;
}

function spawnBeastOn(state, helpers, landscapeId, options = {}) {
  const pulled = pullDreambeastFromMindstream(state, options);
  if (!pulled) {
    helpers?.spawnEncounter?.(state, landscapeId);
    return;
  }
  const encounter = encounterFromDreambeastCard(pulled.card);
  const tile = landscapeById(state, landscapeId);
  if (tile) setEncounterOnLandscape(state, landscapeId, encounter);
  addLog(state, `${pulled.card.name} appears on ${tile?.name || "the Dreamscape"}!`);
}

function trackChessPlay(state, player) {
  player.chessPlayed = (player.chessPlayed || 0) + 1;
  if (player.chessPlayed >= 3) {
    player.chessPlayed = 0;
    returnN(state, dreamerCount(state) + 2, player);
    addLog(state, "Chess Set complete: Return Dreamers+2 Cards.");
  }
}

function askMoveDreamer(state, player, { cardId, title, destIds, thenReturn = 0, log }) {
  const dests = destIds.filter((id) => landscapeReady(state, id));
  if (!dests.length) {
    addLog(state, `${title}: destination is not revealed.`);
    if (thenReturn) returnN(state, thenReturn, player);
    return;
  }
  offerChoice(state, player, {
    cardId,
    step: dests.length > 1 || alive(state).length > 1 ? "pick-dreamer" : "pick-dest",
    title,
    message: alive(state).length > 1 ? "Choose a Dreamer to move:" : "Choose a destination:",
    log,
    choices: alive(state).length > 1 ? dreamerChoices(state) : destChoices(state, destIds),
    payload: { destIds, thenReturn, moverId: player.id },
  });
}

function askTile(state, player, {
  cardId,
  step,
  title,
  detail,
  allowedIds,
  action = "record",
  remaining = 1,
  payload = {},
}) {
  const result = requestChooseTile(state, {
    allowedIds,
    action,
    playerId: payload.moverId || player.id,
    title,
    detail,
    remaining,
    followup: { cardId, playerId: player.id, step, payload },
  });
  if (result === "pending") return;
  if (result && state.pendingObjectFollowup) resumeObjectEffect(state, lastHelpers);
}

function deckForKey(state, key) {
  if (key === "psyche") return state.psycheDeck;
  if (key === "dream") return state.dreamDeck;
  if (key === "archetype") return state.archetypeDeck;
  if (key?.startsWith("mindstream-")) return state.mindstreamDecks[key.replace("mindstream-", "")];
  return null;
}

function applyDeckOrder(state, key, ordered) {
  const deck = deckForKey(state, key);
  if (!deck || !ordered?.length) return;
  const ids = new Set(ordered.map((c) => c.instanceId || c.id));
  const leftover = [];
  for (let i = 0; i < deck.length; i += 1) {
    const card = deck[i];
    if (ids.has(card.instanceId || card.id)) leftover.push(i);
  }
  leftover.reverse().forEach((idx) => deck.splice(idx, 1));
  deck.unshift(...ordered);
  addLog(state, `Knife: top ${ordered.length} of ${key} reordered.`);
}

function finishToothSaber(state, player, helpers, { landscapeId, mode, cardIds, encounterId = null }) {
  const tile = landscapeById(state, landscapeId);
  const enc = (encounterId && tileEncounters(tile).find((e) => encounterKey(e) === encounterId))
    || state.activeEncounter
    || encounterOnLandscape(state, landscapeId);
  if (!enc) {
    addLog(state, "Tooth-Saber: that Encounter is gone.");
    return;
  }
  const selected = (cardIds || [])
    .map((id) => player.hand.find((c) => c.instanceId === id))
    .filter(Boolean);
  const total = selected.reduce((sum, c) => sum + psycheCardValue(c), 0);
  const need = mode === "accept" ? enc.accept : encounterRejectCost(enc);
  if (total < need) {
    addLog(state, `Tooth-Saber: need ${need} Psyche (have ${total}).`);
    return;
  }
  selected.forEach((card) => {
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    state.psycheDiscard.push(card);
  });
  recordQuestEvent(state, "discard_psyche", { count: selected.length });

  if (mode === "accept") {
    if (!canAddAllyToHand(state, player)) {
      addLog(state, `${player.name} already has ${allyHandLimitForPlayer(state, player)} allies.`);
      selected.forEach((card) => player.hand.push(card));
      state.psycheDiscard = state.psycheDiscard.filter((c) => !selected.includes(c));
      return;
    }
    addLog(state, `${player.name} Accepts ${enc.name}. ${enc.effect || ""}`);
    applyAcceptEffect(state, enc, player, helpers);
    player.hand.push(dreambeastToHandCard(enc));
    removeEncounterFromLandscape(state, landscapeId, enc);
    recordQuestEvent(state, "meet_on_landscape", { landscapeId });
    return;
  }

  repressCard(state, { ...enc, type: "dreambeast" });
  applyRejectReward(state, enc, player, helpers);
  removeEncounterFromLandscape(state, landscapeId, enc);
  addLog(state, `${player.name} Rejects ${enc.name}.`);
  recordQuestEvent(state, "meet_on_landscape", { landscapeId });
}

function continueFlow(state, follow, helpers) {
  const player = playerById(state, follow.playerId);
  if (!player) return;
  const step = follow.step;
  const payload = follow.payload || {};
  const cardId = follow.cardId;
  const lastTileId = follow.lastTileId;
  const pickedIds = follow.pickedIds || (lastTileId ? [lastTileId] : []);

  if (cardId === "psychic-owl" && step === "moved") {
    returnN(state, 2, player);
    return;
  }
  if ((cardId === "flower" || cardId === "hammer" || cardId === "bag-of-teeth" || cardId === "raven-claw") && step === "moved") {
    if (payload.thenReturn) returnN(state, payload.thenReturn, player);
    return;
  }
  if ((cardId === "ivory-pawn" || cardId === "ebony-pawn") && step === "spawned") {
    spawnBeastOn(state, helpers, lastTileId, {
      beastKind: cardId === "ivory-pawn" ? "fantasy" : "nightmare",
    });
    trackChessPlay(state, player);
    return;
  }
  if (cardId === "possibility-polyhedral" && step === "place") {
    const pulled = pullDreambeastFromMindstream(state, { suit: payload.suit });
    if (!pulled) {
      helpers?.spawnEncounter?.(state, lastTileId);
      return;
    }
    const encounter = encounterFromDreambeastCard(pulled.card);
    setEncounterOnLandscape(state, lastTileId, encounter);
    addLog(state, `${pulled.card.name} appears on ${tileName(state, lastTileId)}!`);
    return;
  }
  if (cardId === "marble-grid" && step === "spawned") {
    pickedIds.forEach((id) => spawnBeastOn(state, helpers, id));
    const psyche = psycheSpendCards(player);
    if (!psyche.length) {
      trackChessPlay(state, player);
      return;
    }
    offerChoice(state, player, {
      cardId: "marble-grid",
      step: "repress-psyche",
      ui: "cards",
      title: "Marble Grid",
      message: "Repress 1 Psyche:",
      cards: psyche,
      payload: {},
    });
    return;
  }
  if (step === "after-element-discard") {
    offerChoice(state, player, {
      cardId,
      step: "pick-element-dest",
      title: payload.title || cardId,
      message: "Move to:",
      choices: destChoices(state, payload.destIds || []),
      payload,
    });
    return;
  }
  if (cardId === "mobius-crystal" && step === "after-mobius-discard") {
    const edges = edgeLandscapes(state).filter((t) => t.revealed && !t.wasteland);
    const sources = allEncountersOnBoard(state).filter(({ tile }) => edges.some((e) => e.id === tile.id));
    if (!sources.length) {
      addLog(state, "Mobius Crystal: no edge Dreambeast.");
      return;
    }
    offerChoice(state, player, {
      cardId: "mobius-crystal",
      step: "pick-beast-source",
      title: "Mobius Crystal",
      message: "Move which edge Dreambeast?",
      choices: sources.map(({ tile, encounter }) => ({
        id: `${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
      })),
      payload: { destIds: edges.map((t) => t.id), title: "Mobius Crystal" },
    });
    return;
  }
  if ((cardId === "row-boat" || cardId === "hourglass" || cardId === "conch-shell" || cardId === "rope") && step === "dest") {
    const dests = (payload.destIds || []).filter((id) => landscapeReady(state, id));
    if (!dests.length) {
      addLog(state, `${payload.title || "Object"}: no open destination.`);
      return;
    }
    if (dests.length === 1) {
      continueFlow(state, {
        cardId,
        playerId: player.id,
        step: "moved-beast",
        lastTileId: dests[0],
        payload,
      }, helpers);
      return;
    }
    offerChoice(state, player, {
      cardId,
      step: "pick-beast-dest",
      title: payload.title,
      message: "Move the Dreambeast to:",
      choices: destChoices(state, dests),
      payload,
    });
    return;
  }
  if ((cardId === "row-boat" || cardId === "hourglass" || cardId === "conch-shell" || cardId === "rope") && step === "moved-beast") {
    const [fromTileId, encKey] = String(payload.fromId || "").split(":");
    const from = landscapeById(state, fromTileId);
    const dest = lastTileId;
    const enc = tileEncounters(from).find((e) => encounterKey(e) === encKey);
    if (!enc || !landscapeReady(state, dest)) return;
    moveEncounterBetweenLandscapes(state, fromTileId, dest, enc);
    addLog(state, `Moved ${enc.name} to ${tileName(state, dest)}.`);
    return;
  }
  if (cardId === "mobius-crystal" && step === "dest") {
    const fromTileId = String(payload.fromId || "").split(":")[0];
    const dests = (payload.destIds || []).filter((id) => id !== fromTileId && landscapeReady(state, id));
    if (!dests.length) {
      addLog(state, "Mobius Crystal: no open edge Landscape.");
      return;
    }
    offerChoice(state, player, {
      cardId: "mobius-crystal",
      step: "pick-mobius-dest",
      title: "Mobius Crystal",
      message: "Move that Dreambeast to:",
      choices: dests.map((id) => ({ id, label: tileName(state, id), hint: "Other edge Landscape." })),
      payload,
    });
    return;
  }
}

export function resumeObjectEffect(state, helpers = null) {
  const follow = state.pendingObjectFollowup;
  if (!follow) return false;
  if (follow.landscapeAction) {
    const ok = resumeLandscapeAction(state, helpers);
    continueDeferredEventQueues(state);
    continueArchetypeQueues(state);
    return ok;
  }
  if (follow.archetypeFollowup) {
    const ok = resumeArchetypeFollowup(state, helpers);
    continueDeferredEventQueues(state);
    continueArchetypeQueues(state);
    return ok;
  }
  if (follow.cardId === "silver-accept") {
    state.pendingObjectFollowup = null;
    const player = playerById(state, follow.playerId);
    const enc = state.activeEncounter || encounterOnLandscape(state, follow.lastTileId);
    if (player && enc) startSilverForcedAccept(state, player, follow.lastTileId, enc);
    return true;
  }
  const h = useHelpers(helpers);
  state.pendingObjectFollowup = null;
  continueFlow(state, follow, h);
  if (state.pendingObjectFollowup && !state.landscapePick && !state.pendingObjectChoice) {
    resumeObjectEffect(state, helpers);
  }
  return true;
}

export function resolveObjectChoice(state, choiceId, helpers = null) {
  const pending = state.pendingObjectChoice;
  if (!pending) return false;
  helpers = useHelpers(helpers);
  const player = playerById(state, pending.playerId);
  const step = pending.step;
  const payload = pending.payload || {};
  const cardId = pending.cardId;

  if (pending.ui === "spend") {
    if (choiceId === "confirm") {
      state.pendingObjectChoice = null;
      finishToothSaber(state, player, helpers, {
        landscapeId: payload.landscapeId,
        encounterId: payload.encounterId,
        mode: payload.mode,
        cardIds: pending.order || [],
      });
      return true;
    }
    const card = (pending.cards || []).find((c) => c.instanceId === choiceId);
    if (!card) return false;
    const order = pending.order || [];
    pending.order = order.includes(choiceId)
      ? order.filter((id) => id !== choiceId)
      : [...order, choiceId];
    return true;
  }

  if (pending.ui === "reorder") {
    if (choiceId === "done") {
      if ((pending.order || []).length !== (pending.top || []).length) return false;
      state.pendingObjectChoice = null;
      applyDeckOrder(state, payload.deckKey, pending.order);
      return true;
    }
    const card = (pending.top || []).find((c) => (c.instanceId || c.id) === choiceId);
    if (!card || (pending.order || []).some((c) => (c.instanceId || c.id) === choiceId)) return false;
    pending.order = [...(pending.order || []), card];
    if (pending.order.length >= pending.top.length) {
      state.pendingObjectChoice = null;
      applyDeckOrder(state, payload.deckKey, pending.order);
    }
    return true;
  }

  if (pending.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    if (!card) return false;
    state.pendingObjectChoice = null;
    if (cardId === "red-apple") {
      (pending.cards || []).filter((c) => c !== card).forEach((extra) => {
        const suit = extra.suit || extra.mindstreamSuit;
        if (suit && state.mindstreamDiscard[suit]) state.mindstreamDiscard[suit].push(extra);
      });
      addLog(state, `Red Apple resolves: ${card.name}.`);
      helpers?.resolveCardEffect?.(state, card, player, helpers);
      return true;
    }
    if (cardId === "crystal-bell" || cardId === "the-all") {
      addLog(state, `Replay Dream: ${card.name}.`);
      helpers?.resolveCardEffect?.(state, card, player, helpers);
      return true;
    }
    if (cardId === "marble-grid" && step === "repress-psyche") {
      player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
      repressCard(state, card);
      recordQuestEvent(state, "discard_psyche", { count: 1 });
      addLog(state, `${player.name} represses ${card.name || "Psyche"}.`);
      trackChessPlay(state, player);
      return true;
    }
    if (step === "discard-psyche") {
      discardPsycheCard(state, player, card);
      continueFlow(state, {
        cardId: payload.nextCardId || cardId,
        playerId: player.id,
        step: payload.nextStep,
        payload: { ...payload, discarded: true },
      }, helpers);
      if (state.pendingObjectFollowup) resumeObjectEffect(state, helpers);
      return true;
    }
    return true;
  }

  const choice = (pending.choices || []).find((entry) => entry.id === choiceId);
  if (!choice || choice.disabled) return false;
  state.pendingObjectChoice = null;

  if (cardId === "mirror") {
    if (choiceId === "move-field") movePlayerToId(state, player, "field-of-broken-glass");
    else returnN(state, 1, player);
    return true;
  }
  if (cardId === "candle") {
    if (choiceId === "return-2") {
      returnN(state, 2);
      return true;
    }
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    const count = Math.min(hidden.length, dreamerCount(state) + 1);
    if (count) beginFreeRevealPicking(state, count);
    return true;
  }
  if (cardId === "the-one") {
    if (choiceId === "chess") trackChessPlay(state, player);
    else checkObjectTagSet(state, player, choiceId, { extra: 1 });
    addLog(state, `The One counts toward the ${choiceId} set.`);
    return true;
  }

  if (step === "pick-dreamer") {
    const mover = playerById(state, choiceId) || player;
    const dests = (payload.destIds || []).filter((id) => landscapeReady(state, id));
    if (dests.length === 1) {
      movePlayerToId(state, mover, dests[0]);
      if (payload.thenReturn) returnN(state, payload.thenReturn, player);
      return true;
    }
    if (cardId === "psychic-owl") {
      askTile(state, player, {
        cardId,
        step: "moved",
        title: "Psychic Owl",
        detail: `Choose any revealed Landscape for ${mover.name}.`,
        allowedIds: revealedTiles(state).map((t) => t.id),
        action: "movePlayer",
        payload: { moverId: mover.id, thenReturn: 2 },
      });
      if (state.pendingObjectFollowup) resumeObjectEffect(state, helpers);
      return true;
    }
    offerChoice(state, player, {
      cardId,
      step: "pick-dest",
      title: pending.title,
      message: `Move ${mover.name} to:`,
      choices: destChoices(state, payload.destIds || []),
      payload: { ...payload, moverId: mover.id },
    });
    return true;
  }

  if (step === "pick-dest") {
    const mover = playerById(state, payload.moverId) || player;
    movePlayerToId(state, mover, choiceId);
    if (payload.thenReturn) returnN(state, payload.thenReturn, player);
    return true;
  }

  if (cardId === "possibility-polyhedral" && step === "pick-suit") {
    askTile(state, player, {
      cardId,
      step: "place",
      title: "Possibility Polyhedral",
      detail: "Choose a Landscape for the Dreambeast.",
      allowedIds: revealedTiles(state).map((t) => t.id),
      payload: { suit: choiceId },
    });
    if (state.pendingObjectFollowup) resumeObjectEffect(state, helpers);
    return true;
  }

  if (cardId === "knife" && step === "pick-deck") {
    const deck = deckForKey(state, choiceId);
    const top = (deck || []).slice(0, 3);
    if (top.length < 1) {
      addLog(state, "That deck is empty.");
      return true;
    }
    offerChoice(state, player, {
      cardId: "knife",
      ui: "reorder",
      step: "reorder",
      title: "Knife",
      message: "Click the cards in the order you want on top (first click becomes the new top).",
      top,
      order: [],
      payload: { deckKey: choiceId },
    });
    return true;
  }

  if (cardId === "skeleton-key" && step === "pick-suit") {
    const suit = choiceId.replace("mindstream-", "");
    const deck = state.mindstreamDecks[suit];
    if (deck?.length) {
      const top = deck.shift();
      deck.push(top);
      addLog(state, `Skeleton Key flips ${SUIT_LABELS[suit] || suit} Mindstream.`);
    }
    return true;
  }

  if (cardId === "tooth-saber" && step === "pick-encounter") {
    const [tileId, encKey] = String(choiceId).split(":");
    const tile = landscapeById(state, tileId);
    const enc = tileEncounters(tile).find((e) => encounterKey(e) === encKey);
    if (!enc) return true;
    offerChoice(state, player, {
      cardId: "tooth-saber",
      step: "pick-mode",
      title: "Tooth-Saber",
      message: `${enc.name}: Accept or Reject?`,
      choices: [
        { id: "accept", label: `Accept (${enc.accept})`, hint: "Joins hand as a Psyche ally." },
        { id: "reject", label: `Reject (${encounterRejectCost(enc)})`, hint: "Repress the Encounter." },
      ],
      payload: { landscapeId: tileId, encounterId: encKey },
    });
    return true;
  }

  if (cardId === "tooth-saber" && step === "pick-mode") {
    const enc = tileEncounters(landscapeById(state, payload.landscapeId))
      .find((e) => encounterKey(e) === payload.encounterId)
      || encounterOnLandscape(state, payload.landscapeId);
    const need = choiceId === "accept" ? enc?.accept : encounterRejectCost(enc);
    offerChoice(state, player, {
      cardId: "tooth-saber",
      ui: "spend",
      step: "spend",
      title: "Tooth-Saber",
      message: `Select Psyche totaling ${need} or more, then confirm.`,
      cards: player.hand.filter((c) => c.type === "psyche" || c.type === "dreambeast"),
      need,
      order: [],
      payload: { landscapeId: payload.landscapeId, encounterId: payload.encounterId, mode: choiceId },
    });
    return true;
  }

  if (cardId === "water" || cardId === "air" || cardId === "earth" || cardId === "fire") {
    if (step === "pick-element-dest") {
      movePlayerToId(state, player, choiceId);
      return true;
    }
  }

  if (step === "pick-beast-source") {
    continueFlow(state, {
      cardId,
      playerId: player.id,
      step: "dest",
      payload: { ...payload, fromId: choiceId },
    }, helpers);
    if (state.pendingObjectFollowup) resumeObjectEffect(state, helpers);
    return true;
  }

  if (step === "pick-beast-dest" || step === "pick-mobius-dest") {
    continueFlow(state, {
      cardId,
      playerId: player.id,
      step: cardId === "mobius-crystal" ? "moved-beast" : "moved-beast",
      lastTileId: choiceId,
      payload,
    }, helpers);
    if (cardId === "mobius-crystal") {
      const [fromTileId, encKey] = String(payload.fromId || "").split(":");
      const from = landscapeById(state, fromTileId);
      const enc = tileEncounters(from).find((e) => encounterKey(e) === encKey);
      if (enc && landscapeReady(state, choiceId)) {
        moveEncounterBetweenLandscapes(state, fromTileId, choiceId, enc);
        addLog(state, `Moved ${enc.name} to ${tileName(state, choiceId)}.`);
      }
    }
    return true;
  }

  return true;
}

export function checkObjectTagSet(state, player, tag, { extra = 0 } = {}) {
  if (!player.persistent) player.persistent = [];
  const tagged = player.persistent.filter((o) => o.tags?.some((t) => t.startsWith(tag)));
  const wild = (player.setWildcards || []).filter((t) => t === tag).length;
  if (tagged.length + extra + wild < setRequiredForTag(tag)) return;
  if (wild) {
    const idx = player.setWildcards.indexOf(tag);
    if (idx >= 0) player.setWildcards.splice(idx, 1);
  }

  if (tag === "chess") {
    returnN(state, dreamerCount(state) + 2, player);
    addLog(state, "Chess Set complete: Return Dreamers+2 Cards.");
  } else if (tag === "stick") {
    returnN(state, dreamerCount(state) + 3, player);
    addLog(state, "Stick Set complete: Return Dreamers+3 Cards.");
  } else if (tag === "body") {
    returnN(state, dreamerCount(state) + 5, player);
    addLog(state, "Body Set complete: Return Dreamers+5 Cards.");
  } else if (tag === "element") {
    returnN(state, dreamerCount(state) + 4, player);
    addLog(state, "Element Set complete: Return Dreamers+4 Cards.");
  } else if (tag === "jewelry") {
    returnN(state, dreamerCount(state) + 4, player);
    addLog(state, "Jewelry Set complete: Return Dreamers+4 Cards.");
    if (state.activeArchetype?.questProgress?.every(Boolean)) {
      acquireArchetype(state, player);
      addLog(state, "Jewelry Set: Acquired available Archetype.");
    }
  }
}

export const OBJECT_EFFECTS = {
  candle: (state, player) => {
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    const revealCount = Math.min(hidden.length, dreamerCount(state) + 1);
    offerChoice(state, player, {
      cardId: "candle",
      title: "Candle",
      message: "Choose one effect:",
      log: "Candle: choose Reveal Landscapes or Return 2 Repressed cards.",
      choices: [
        {
          id: "reveal",
          label: `Reveal Dreamers+1 Landscapes (${revealCount})`,
          hint: revealCount ? "Click that many hidden hexes." : "No hidden Landscapes left.",
          disabled: revealCount < 1,
        },
        { id: "return-2", label: "Return 2 Repressed Cards", hint: "Pick from the Subconscious." },
      ],
    });
  },

  mirror: (state, player) => {
    const fieldReady = landscapeReady(state, "field-of-broken-glass");
    offerChoice(state, player, {
      cardId: "mirror",
      title: "Mirror",
      message: "Choose one effect:",
      log: "Mirror: choose Move or Return.",
      choices: [
        {
          id: "move-field",
          label: "Move to Field of Broken Glass",
          hint: fieldReady ? "Move this Dreamer there now." : "Field of Broken Glass is not revealed yet.",
          disabled: !fieldReady,
        },
        { id: "return-1", label: "Return 1 Repressed Card", hint: "Pick 1 card from the Subconscious." },
      ],
    });
  },

  "rabbits-foot": (state) => {
    state.pendingPowerBonus = (state.pendingPowerBonus || 0) + 3;
    addLog(state, "Rabbit's Foot: +3 wild to next Psyche play.");
  },

  "possibility-polyhedral": (state, player) => {
    const suits = ["lucidity", "elasticity", "willpower"];
    offerChoice(state, player, {
      cardId: "possibility-polyhedral",
      step: "pick-suit",
      title: "Possibility Polyhedral",
      message: "Spawn a Dreambeast from which Mindstream?",
      log: "Possibility Polyhedral: choose a Mindstream, then a Landscape.",
      choices: suits.map((suit) => ({
        id: suit,
        label: `${SUIT_LABELS[suit]} Mindstream`,
        hint: state.mindstreamDecks[suit]?.some((c) => c.type === "dreambeast")
          ? "Has a Dreambeast."
          : "No Dreambeast left; will spawn a random Encounter.",
      })),
    });
  },

  "raven-claw": (state, player) => {
    askMoveDreamer(state, player, {
      cardId: "raven-claw",
      title: "Raven Claw",
      destIds: ["sky"],
      log: "Raven Claw: choose a Dreamer to move to Sky.",
    });
  },

  "bag-of-teeth": (state, player) => {
    askMoveDreamer(state, player, {
      cardId: "bag-of-teeth",
      title: "Bag of Teeth",
      destIds: ["sea-of-teeth", "house"],
      log: "Bag of Teeth: choose a Dreamer and a destination.",
    });
  },

  "marble-grid": (state, player) => {
    const empty = revealedTiles(state).map((t) => t.id);
    if (empty.length < 1) {
      addLog(state, "Marble Grid: no revealed Landscapes to spawn on.");
      const psyche = psycheSpendCards(player);
      if (psyche.length) {
        offerChoice(state, player, {
          cardId: "marble-grid",
          step: "repress-psyche",
          ui: "cards",
          title: "Marble Grid",
          message: "Repress 1 Psyche:",
          cards: psyche,
        });
      } else {
        trackChessPlay(state, player);
      }
      return;
    }
    askTile(state, player, {
      cardId: "marble-grid",
      step: "spawned",
      title: "Marble Grid",
      detail: `Choose ${Math.min(2, empty.length)} Landscape(s) to spawn Dreambeasts.`,
      allowedIds: empty,
      remaining: Math.min(2, empty.length),
    });
    if (state.pendingObjectFollowup) resumeObjectEffect(state);
  },

  "ivory-pawn": (state, player) => {
    const empty = revealedTiles(state).map((t) => t.id);
    if (!empty.length) {
      addLog(state, "Ivory Pawn: no revealed Landscapes to spawn on.");
      trackChessPlay(state, player);
      return;
    }
    askTile(state, player, {
      cardId: "ivory-pawn",
      step: "spawned",
      title: "Ivory Pawn",
      detail: "Choose a Landscape for the Fantasy Dreambeast.",
      allowedIds: empty,
    });
    if (state.pendingObjectFollowup) resumeObjectEffect(state);
  },

  "ebony-pawn": (state, player) => {
    const empty = revealedTiles(state).map((t) => t.id);
    if (!empty.length) {
      addLog(state, "Ebony Pawn: no revealed Landscapes to spawn on.");
      trackChessPlay(state, player);
      return;
    }
    askTile(state, player, {
      cardId: "ebony-pawn",
      step: "spawned",
      title: "Ebony Pawn",
      detail: "Choose a Landscape for the Nightmare Encounter.",
      allowedIds: empty,
    });
    if (state.pendingObjectFollowup) resumeObjectEffect(state);
  },

  flower: (state, player) => {
    askMoveDreamer(state, player, {
      cardId: "flower",
      title: "Flower",
      destIds: ["tranquil-grove"],
      thenReturn: 4,
      log: "Flower: choose a Dreamer to move to Tranquil Grove, then Return 4.",
    });
  },

  "psychic-owl": (state, player) => {
    if (alive(state).length <= 1) {
      askTile(state, player, {
        cardId: "psychic-owl",
        step: "moved",
        title: "Psychic Owl",
        detail: "Choose any revealed Landscape.",
        allowedIds: revealedTiles(state).map((t) => t.id),
        action: "movePlayer",
        payload: { moverId: player.id, thenReturn: 2 },
      });
      if (state.pendingObjectFollowup) resumeObjectEffect(state);
      return;
    }
    offerChoice(state, player, {
      cardId: "psychic-owl",
      step: "pick-dreamer",
      title: "Psychic Owl",
      message: "Choose a Dreamer to move:",
      log: "Psychic Owl: choose a Dreamer, then any Landscape, then Return 2.",
      choices: dreamerChoices(state),
      payload: { destIds: revealedTiles(state).map((t) => t.id), thenReturn: 2 },
    });
  },

  "red-apple": (state, player, helpers) => {
    const drawn = ["lucidity", "elasticity", "willpower"]
      .map((suit) => pullFromMindstreamByType(state, "event", { suit })?.card)
      .filter(Boolean);
    if (!drawn.length) {
      addLog(state, "Red Apple: no Events left in the Mindstreams.");
      return;
    }
    if (drawn.length === 1) {
      addLog(state, `Red Apple resolves: ${drawn[0].name}.`);
      helpers?.resolveCardEffect?.(state, drawn[0], player, helpers);
      return;
    }
    offerChoice(state, player, {
      cardId: "red-apple",
      ui: "cards",
      title: "Red Apple",
      message: "Choose 1 Event to resolve. The others are discarded.",
      cards: drawn,
    });
  },

  "tear-of-moon": (state) => {
    const players = alive(state);
    players.forEach((p) => {
      drawPsycheForPlayer(state, p, 2);
      enqueueReturnCards(state, 2, p, { reason: `${p.name}: Return 2 Repressed card(s).` });
    });
    if (players.length) addLog(state, "Tear of Moon: each Dreamer draws 2 Psyche and Returns 2 Repressed.");
  },

  "spark-of-sun": (state) => {
    const players = alive(state);
    players.forEach((p) => {
      drawPsycheForPlayer(state, p, 2);
      enqueueReturnCards(state, 2, p, { reason: `${p.name}: Return 2 Repressed card(s).` });
    });
    if (players.length) addLog(state, "Spark of Sun: each Dreamer draws 2 Psyche and Returns 2 Repressed.");
  },

  coins: (state) => {
    alive(state).forEach((p) => {
      grantPowerTokens(state, p, 1);
      recordQuestEvent(state, "power_token", { count: 1 });
    });
    addLog(state, "Coins: each Dreamer gains 1 Power Token.");
  },

  egg: (state, player) => {
    const room = Math.min(10, handRoomForPsycheDraw(state, player));
    if (room > 0) {
      const drawn = drawPsycheForPlayer(state, player, room);
      addLog(state, `Egg: ${player.name} draws ${drawn.length} Psyche.`);
    } else {
      addLog(state, "Egg: hand is already full.");
    }
  },

  "the-all": (state, player, helpers) => {
    returnN(state, dreamerCount(state) + 8, player);
    const pile = [...(state.dreamDiscard || [])];
    if (!pile.length) {
      addLog(state, "The All: Return Dreamers+8. No Dreams in the discard pile to replay.");
      return;
    }
    offerChoice(state, player, {
      cardId: "the-all",
      ui: "cards",
      title: "The All",
      message: "Choose 1 Dream from discard to resolve again:",
      cards: pile,
    });
  },

  knife: (state, player) => {
    offerChoice(state, player, {
      cardId: "knife",
      step: "pick-deck",
      title: "Knife",
      message: "Look at the top 3 of which deck?",
      log: "Knife: choose a deck, then reorder the top 3.",
      choices: [
        { id: "psyche", label: "Psyche Deck", disabled: !state.psycheDeck.length },
        { id: "dream", label: "Dream Deck", disabled: !state.dreamDeck.length },
        { id: "archetype", label: "Archetype Deck", disabled: !state.archetypeDeck.length },
        { id: "mindstream-lucidity", label: `${SUIT_LABELS.lucidity} Mindstream`, disabled: !state.mindstreamDecks.lucidity?.length },
        { id: "mindstream-elasticity", label: `${SUIT_LABELS.elasticity} Mindstream`, disabled: !state.mindstreamDecks.elasticity?.length },
        { id: "mindstream-willpower", label: `${SUIT_LABELS.willpower} Mindstream`, disabled: !state.mindstreamDecks.willpower?.length },
      ],
    });
  },

  "crystal-bell": (state, player) => {
    const pile = [...(state.dreamDiscard || [])];
    if (!pile.length) {
      addLog(state, "No Dreams in the discard pile.");
      return;
    }
    offerChoice(state, player, {
      cardId: "crystal-bell",
      ui: "cards",
      title: "Crystal Bell",
      message: "Choose 1 Dream from discard to resolve again:",
      cards: pile,
    });
  },

  "tooth-saber": (state, player) => {
    const encounters = allEncountersOnBoard(state);
    if (!encounters.length) {
      addLog(state, "Tooth-Saber: no Encounter on the map.");
      return;
    }
    offerChoice(state, player, {
      cardId: "tooth-saber",
      step: "pick-encounter",
      title: "Tooth-Saber",
      message: "Choose an Encounter:",
      log: "Tooth-Saber: choose an Encounter, then Accept or Reject.",
      choices: encounters.map(({ tile, encounter }) => ({
        id: `${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
        hint: `Accept ${encounter.accept} · Reject ${encounterRejectCost(encounter)}`,
      })),
    });
  },

  hammer: (state, player) => {
    askMoveDreamer(state, player, {
      cardId: "hammer",
      title: "Hammer",
      destIds: ["house"],
      thenReturn: 1,
      log: "Hammer: choose a Dreamer to move to House, then Return 1.",
    });
  },

  "the-one": (state, player) => {
    offerChoice(state, player, {
      cardId: "the-one",
      title: "The One",
      message: "Count as 1 Object toward which set?",
      choices: [
        { id: "chess", label: "Chess", hint: "Need 3 chess Objects." },
        { id: "stick", label: "Stick", hint: "Need 3 stick Objects." },
        { id: "body", label: "Body", hint: "Need 5 body Objects." },
        { id: "element", label: "Element", hint: "Need 4 element Objects." },
        { id: "jewelry", label: "Jewelry", hint: "Need 3 jewelry Objects." },
      ],
    });
  },
};

["the-nothing-elasticity", "the-nothing-lucidity", "the-nothing-willpower"].forEach((id) => {
  OBJECT_EFFECTS[id] = (state, player) => {
    beginNothingResolution(state, player, { id, name: "The Nothing" });
  };
});

const BEAST_MOVERS = {
  "row-boat": { title: "Row Boat", destIds: ["lava", "endless-ocean", "sea-of-teeth"] },
  rope: { title: "Rope", destIds: ["endless-hallway", "the-attic", "the-basement"] },
  hourglass: { title: "Hourglass", destIds: ["day-in-the-life", "insanity", "naked-classroom"] },
  "conch-shell": { title: "Conch Shell", destIds: ["field-of-broken-glass", "desert", "black-void"] },
};

export function activatePersistentObjectEffect(state, player, card) {
  const mover = BEAST_MOVERS[card.id];
  if (mover) {
    const sources = allEncountersOnBoard(state);
    if (!sources.length) {
      addLog(state, `${card.name}: no Dreambeast to move.`);
      return false;
    }
    offerChoice(state, player, {
      cardId: card.id,
      step: "pick-beast-source",
      title: mover.title,
      message: "Move which Dreambeast?",
      choices: sources.map(({ tile, encounter }) => ({
        id: `${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
      })),
      payload: { destIds: mover.destIds, title: mover.title },
    });
    return true;
  }

  const elementDests = ELEMENT_MOVES[card.id];
  if (elementDests) {
    const ready = elementDests.filter((id) => landscapeReady(state, id));
    if (!psycheSpendCards(player).length) {
      addLog(state, `Discard 1 Psyche to activate ${card.name}.`);
      return false;
    }
    if (!ready.length) {
      addLog(state, `${card.name}: destination is not revealed.`);
      return false;
    }
    return askDiscardPsyche(state, player, {
      cardId: card.id,
      title: card.name,
      payload: {
        destIds: elementDests,
        title: card.name,
        nextCardId: card.id,
        nextStep: "after-element-discard",
      },
    });
  }

  if (card.id === "mobius-crystal") {
    const edges = edgeLandscapes(state).filter((t) => t.revealed && !t.wasteland);
    const sources = edges.filter((t) => tileEncounters(t).length);
    const dests = edges;
    if (!psycheSpendCards(player).length) {
      addLog(state, "Discard 1 Psyche to activate Mobius Crystal.");
      return false;
    }
    if (!sources.length) {
      addLog(state, "Mobius Crystal: no edge Dreambeast.");
      return false;
    }
    if (!dests.length) {
      addLog(state, "Mobius Crystal: no open edge Landscape.");
      return false;
    }
    return askDiscardPsyche(state, player, {
      cardId: "mobius-crystal",
      title: "Mobius Crystal",
      payload: {
        destIds: edges.map((t) => t.id),
        title: "Mobius Crystal",
        nextCardId: "mobius-crystal",
        nextStep: "after-mobius-discard",
      },
    });
  }

  if (card.id === "skeleton-key") {
    state.skeletonKeyPending = true;
    addLog(state, "Skeleton Key armed: after the next Dream, choose a Mindstream to flip.");
    return true;
  }

  if (card.id === "monkey-paw") {
    if (!card.powerSlots) card.powerSlots = 0;
    if (card.powerSlots >= 3) {
      addLog(state, "Monkey Paw is already full.");
      return false;
    }
    return { spendExtra: false, monkeyPaw: true };
  }

  return false;
}

export function finishMonkeyPaw(state, player, card) {
  card.powerSlots = (card.powerSlots || 0) + 1;
  requestReturnCards(state, 3, player);
  addLog(state, `Monkey Paw: ${card.powerSlots}/3 Power placed. Return 3 cards.`);
  if (card.powerSlots >= 3) {
    const refund = card.powerSlots;
    card.powerSlots = 0;
    grantPowerTokens(state, player, refund, { reason: "Monkey Paw returns its Power Tokens.", logQuest: false });
    player.persistent = player.persistent.filter((o) => o.instanceId !== card.instanceId);
    repressCard(state, card);
    addLog(state, "Monkey Paw is full: it is Repressed and its Power Tokens return.");
  }
}

export function applySkeletonKeyAfterDream(state, player = null) {
  if (!state.skeletonKeyPending) return;
  state.skeletonKeyPending = false;
  const actor = player || state.players.find((p) => p.persistent?.some((o) => o.id === "skeleton-key")) || alive(state)[0];
  if (!actor) return;
  const suits = ["lucidity", "elasticity", "willpower"];
  offerChoice(state, actor, {
    cardId: "skeleton-key",
    step: "pick-suit",
    title: "Skeleton Key",
    message: "Flip the top card of which Mindstream?",
    choices: suits.map((suit) => ({
      id: suit,
      label: `${SUIT_LABELS[suit]} Mindstream`,
      disabled: !state.mindstreamDecks[suit]?.length,
    })),
  });
}

export function revealWithAllSeeingEye(state) {
  const hidden = state.board.filter((l) => !l.revealed && !l.center);
  const count = Math.min(hidden.length, dreamerCount(state) + 1);
  if (!count) {
    addLog(state, "The All Seeing Eye: no Landscapes left to reveal.");
    return;
  }
  beginFreeRevealPicking(state, count);
}
