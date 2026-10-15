import {
  addLog,
  drawPsycheForPlayer,
  landscapeById,
  acquireArchetypeFromDeck,
  setEncounterOnLandscape,
  encounterOnLandscape,
  encounterKey,
  findEncounterOnBoard,
  tileEncounters,
  revealedLandscapeTiles,
  allEncountersOnBoard,
  moveEncounterBetweenLandscapes,
} from "../core/state.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { grantPowerTokens } from "../cards/power-tokens.js";
import { repressCard, requestReturnCards, enqueueReturnCards } from "../dreamers/subconscious.js";
import { handRoomForPsycheDraw, beginNothingResolution } from "./objects.js";
import {
  pullDreambeastFromMindstream,
  pullFromMindstreamByType,
  encounterFromDreambeastCard,
} from "../cards/mindstream-supply.js";
import { encounterRejectCost } from "../encounters/dreambeasts.js";
import { psycheCardValue } from "../cards/psyche.js";
import { requestChooseTile, beginFreeRevealPicking, revealCapacity } from "../board/landscapes.js";
import { edgeLandscapes, hexDistance } from "../core/hex.js";
import { OBJECT_SETS, setProgress } from "./object-sets.js";
export { OBJECT_SETS, setProgress };
import { onDawn } from "../core/state.js";
import { isFreeformBoard, vaultCards, tileDeckCount, refreshVault } from "../board/dreamscape-vault.js";
import { activeQuestLandscapeIds } from "../dreamers/quests.js";
import { psycheHandCount } from "../cards/psyche.js";
import { SUIT_LABELS } from "../core/rules.js";
import { logMoment } from "../core/narrator.js";
import { resumeLandscapeAction } from "../board/landscape-actions.js";
import { resumeArchetypeFollowup, continueArchetypeQueues } from "../dreamers/archetypes.js";
import { beginRemember } from "./remember.js";

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
  if (result?.pending) {
    addLog(state, `Choose ${result.count} Psyche to Return.`);
    logMoment(state, `Return ${result.count} Psyche(s) from the Subconscious — open the picker.`);
  }
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
  const momentLine = spec.message || spec.log || spec.title;
  if (momentLine) logMoment(state, `${spec.title}: ${momentLine}`);
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

function heldObjectSuit(player, cardId) {
  const card = [...(player?.persistent || []), ...(player?.objects || [])].find((o) => o.id === cardId);
  const suit = card?.mindstreamSuit || card?.suit;
  return suit === "lucidity" || suit === "elasticity" || suit === "willpower" ? suit : null;
}

function spawnBeastOn(state, helpers, landscapeId, options = {}) {
  const pulled = pullDreambeastFromMindstream(state, options);
  if (!pulled) {
    addLog(state, options.beastKind
      ? `No ${options.beastKind} Dreambeast remains in the Mindstream.`
      : "No Dreambeast remains in the Mindstream.");
    return;
  }
  const encounter = encounterFromDreambeastCard(pulled.card);
  const tile = landscapeById(state, landscapeId);
  if (tile) setEncounterOnLandscape(state, landscapeId, encounter);
  const kindNote = options.beastKind ? ` (${options.beastKind})` : "";
  addLog(state, `${pulled.card.name}${kindNote} appears on ${tile?.name || "the Dreamscape"} from the ${pulled.suit} Mindstream.`);
}

function offerSetAcquire(state, player, label, instanceIds = []) {
  const deck = state.archetypeDeck || [];
  if (!deck.length) {
    addLog(state, `${label} is complete, and the Archetype deck is empty. The set stays.`);
    return false;
  }
  if (state.pendingObjectChoice?.cardId === "object-set") return false;
  state.pendingObjectChoice = {
    cardId: "object-set",
    step: "pick-archetype",
    ui: "choice",
    playerId: player.id,
    title: `${label} set`,
    message: "Pick an Archetype from the deck. You Acquire it, then the set is Repressed.",
    choices: deck.map((arch) => ({ id: arch.id, label: `${arch.name} (${arch.points || 0} pts)` })),
    payload: { label, instanceIds },
  };
  addLog(state, `${label} set complete. Choose an Archetype to Acquire.`);
  return true;
}

function trackChessPlay(state, player) {
  player.chessPlayed = (player.chessPlayed || 0) + 1;
  if (player.chessPlayed < 3) return;
  if (offerSetAcquire(state, player, "Chess", [])) player.chessPlayed = 0;
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
  addLog(state, `Tooth-Saber cuts through ${enc.name}.`);

  // A win like any other: the Winged Turtle loses one shell; anything else is beaten outright,
  // with the same rewards, Boss clear, Boon, and Mini-Boss bounty as a won fight.
  if (enc.boss && helpers.advanceBossStack?.(state, enc, tile)) return;
  helpers.resolveBeastDefeat?.(state, { actor: player, encounter: enc, landscapeId, isReject: mode !== "accept" });
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
      suit: heldObjectSuit(player, cardId),
    });
    trackChessPlay(state, player);
    return;
  }
  if (cardId === "possibility-polyhedral" && step === "place") {
    const pulled = pullDreambeastFromMindstream(state, { suit: payload.suit });
    if (!pulled) {
      addLog(state, "No Dreambeast remains in that Mindstream.");
      return;
    }
    const encounter = encounterFromDreambeastCard(pulled.card);
    setEncounterOnLandscape(state, lastTileId, encounter);
    addLog(state, `${pulled.card.name} appears on ${tileName(state, lastTileId)} from the ${pulled.suit} Mindstream.`);
    return;
  }
  if (cardId === "marble-grid" && step === "spawned") {
    pickedIds.forEach((id) => spawnBeastOn(state, helpers, id, {
      suit: heldObjectSuit(player, "marble-grid"),
    }));
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
    continueArchetypeQueues(state);
    return ok;
  }
  if (follow.archetypeFollowup) {
    const ok = resumeArchetypeFollowup(state, helpers);
    continueArchetypeQueues(state);
    return ok;
  }
  const h = useHelpers(helpers);
  state.pendingObjectFollowup = null;
  continueFlow(state, follow, h);
  if (state.pendingObjectFollowup && !state.landscapePick && !state.pendingObjectChoice) {
    resumeObjectEffect(state, helpers);
  }
  return true;
}

function repressSetCards(state, player, instanceIds) {
  const ids = new Set(instanceIds || []);
  const pull = (list) => {
    const kept = [];
    for (const card of list || []) {
      if (ids.has(card.instanceId)) repressCard(state, card);
      else kept.push(card);
    }
    return kept;
  };
  player.objects = pull(player.objects);
  player.persistent = pull(player.persistent);
}

export function resolveObjectChoice(state, choiceId, helpers = null) {
  const pending = state.pendingObjectChoice;
  if (!pending) return false;
  helpers = useHelpers(helpers);
  const player = playerById(state, pending.playerId);
  if (pending.cardId === "object-set" && pending.step === "pick-archetype") {
    state.pendingObjectChoice = null;
    const acquired = acquireArchetypeFromDeck(state, player, choiceId);
    if (!acquired) {
      addLog(state, "That Archetype is no longer in the deck.");
      return false;
    }
    repressSetCards(state, player, pending.payload?.instanceIds);
    logMoment(state, `${pending.payload?.label || "The set"} set complete: ${acquired.name} Acquired (+${acquired.points || 0} points). The set is Repressed.`, { boss: true });
    return true;
  }
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
    const count = Math.min(revealCapacity(state), dreamerCount(state) + 1);
    if (count) beginFreeRevealPicking(state, count);
    return true;
  }
  if (cardId === "the-one") {
    if (choiceId === "chess") checkObjectTagSet(state, player, "chess", { extra: 1 });
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
      message: `${enc.name}: pay its Power in Psyche to Accept it without a fight.`,
      choices: [
        { id: "accept", label: `Accept · pay ${enc.accept}`, hint: "Take a Power Token or a random Object." },
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

  if (step === "pick-element-dest") {
    movePlayerToId(state, player, choiceId);
    return true;
  }

  if (step === "pick-summon") {
    const [fromTileId, encKey] = String(choiceId).split(":");
    const from = landscapeById(state, fromTileId);
    const enc = tileEncounters(from).find((e) => encounterKey(e) === encKey);
    if (enc && from && from.id !== player.landscapeId) {
      moveEncounterBetweenLandscapes(state, from.id, player.landscapeId, enc);
      logMoment(state, `${enc.name} is pulled to ${tileName(state, player.landscapeId)}.`);
    }
    return true;
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

const SET_LABELS = {
  chess: "Chess",
  stick: "Sticks",
  body: "Body",
  element: "Elements",
  jewelry: "Jewelry",
};

export function checkObjectTagSet(state, player, tag, { extra = 0 } = {}) {
  if (!OBJECT_SETS[tag]) return;
  if (!player.persistent) player.persistent = [];
  const inPlay = [...player.persistent, ...(player.objects || [])];
  const tagged = inPlay.filter((o) => o.tags?.some((t) => t.startsWith(tag)));
  const wild = (player.setWildcards || []).filter((t) => t === tag).length;
  if (tagged.length + extra + wild < setRequiredForTag(tag)) return;
  const label = SET_LABELS[tag] || tag;
  if (wild) {
    const idx = player.setWildcards.indexOf(tag);
    if (idx >= 0) player.setWildcards.splice(idx, 1);
  }
  if (!offerSetAcquire(state, player, label, tagged.map((card) => card.instanceId)) && wild) {
    player.setWildcards.push(tag);
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
      log: "Candle: choose Reveal Landscapes or Return 2 Psyche.",
      choices: [
        {
          id: "reveal",
          label: `Reveal Dreamers+1 Landscapes (${revealCount})`,
          hint: revealCount ? "Click that many hidden hexes." : "No hidden Landscapes left.",
          disabled: revealCount < 1,
        },
        { id: "return-2", label: "Return 2 Psyche", hint: "Pick from the Subconscious." },
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
        { id: "return-1", label: "Return 1 Psyche Card", hint: "Pick 1 card from the Subconscious." },
      ],
    });
  },

  "rabbits-foot": (state) => {
    state.nextFightDice = (state.nextFightDice || 0) + 3;
    logMoment(state, "Rabbit's Foot: your next fight rolls +3 dice.");
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
    offerMove(state, player, "raven-claw", "Raven Claw", openTilesExcept(state, player.landscapeId).map((t) => t.id));
  },

  "bag-of-teeth": (state, player) => {
    const lost = discardCheapestPsyche(state, player, { repress: true });
    const drawn = drawPsycheForPlayer(state, player, 3);
    logMoment(state, `Bag of Teeth: ${lost ? `${lost.name} is Repressed, ` : ""}${player.name} draws ${drawn.length}.`);
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
      detail: "Choose a Landscape for the Nightmare Dreambeast.",
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
      enqueueReturnCards(state, 2, p, { reason: `${p.name}: Return 2 Psyche.` });
    });
    if (players.length) addLog(state, "Tear of Moon: Draw 2 Psyche and Returns 2 Psyche.");
  },

  "spark-of-sun": (state) => {
    const players = alive(state);
    players.forEach((p) => {
      drawPsycheForPlayer(state, p, 2);
      enqueueReturnCards(state, 2, p, { reason: `${p.name}: Return 2 Psyche.` });
    });
    if (players.length) addLog(state, "Spark of Sun: Draw 2 Psyche and Returns 2 Psyche.");
  },

  coins: (state, player) => {
    requestReturnCards(state, 3, player);
    logMoment(state, `Coins: ${player.name} Returns 3 Psyche from the Subconscious.`);
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
    const enc = tileEncounters(landscapeById(state, player.landscapeId))[0];
    if (!enc) return;
    const before = enc.accept;
    weakenEncounter(enc, 2);
    logMoment(state, `Knife: ${enc.name} drops from Power ${before} to ${enc.accept}.`);
  },

  "crystal-bell": (state) => {
    state.hollowDreams = (state.hollowDreams || 0) + 1;
    logMoment(state, "Crystal Bell: the next Dream will pass and take nothing.");
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
      log: "Tooth-Saber: choose a Dreambeast to Accept without a fight.",
      choices: encounters.map(({ tile, encounter }) => ({
        id: `${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
        hint: `Power ${encounter.accept} · Rec ${encounter.accept + 2}`,
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
  hourglass: { title: "Hourglass", destIds: ["day-in-the-life", "insanity", "scary-classroom"] },
  "conch-shell": { title: "Conch Shell", destIds: ["field-of-broken-glass", "desert", "black-void"] },
};

export function persistentObjectCanActivate(card) {
  if (!card || card.passive) return false;
  return Boolean(
    (card.activate && ACTIVATIONS[card.activate])
    || BEAST_MOVERS[card.id]
    || ELEMENT_MOVES[card.id]
    || card.id === "mobius-crystal"
    || card.id === "monkey-paw"
    || (card.remember || 0) > 0,
  );
}

export function activatePersistentObjectEffect(state, player, card) {
  const activation = card.activate ? ACTIVATIONS[card.activate] : null;
  if (activation) return activation(state, player, card);
  if ((card.remember || 0) > 0) {
    return beginRemember(state, player, card.remember, { source: card.name }) ? true : false;
  }
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
  addLog(state, `Monkey Paw: ${card.powerSlots}/3 Power placed. Return 3 Psyche.`);
  logMoment(state, `Monkey Paw ${card.powerSlots}/3 — Return 3 Psyche from the Subconscious.`);
  if (card.powerSlots >= 3) {
    const refund = card.powerSlots;
    card.powerSlots = 0;
    grantPowerTokens(state, player, refund, { reason: "Monkey Paw returns its Power Tokens.", logQuest: false, source: "refund" });
    player.persistent = player.persistent.filter((o) => o.instanceId !== card.instanceId);
    repressCard(state, card);
    addLog(state, "Monkey Paw is full: it is Discarded and its Power Tokens return.");
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
  const count = Math.min(revealCapacity(state), dreamerCount(state) + 1);
  if (!count) {
    addLog(state, "The All Seeing Eye: no Landscapes left to reveal.");
    return;
  }
  beginFreeRevealPicking(state, count);
}


/* ---- Ainmos 0.15 Objects: one clear job each ------------------------------------------------- */

/** Placed, walkable Landscapes other than the one named. */
function openTilesExcept(state, tileId) {
  return (state.board || []).filter((t) => t.revealed && !t.wasteland && t.id !== tileId);
}

/** Pay a "discard 1 Psyche" cost without a menu: the plainest, lowest card goes. */
function discardCheapestPsyche(state, player, { repress = false } = {}) {
  const pool = (player.hand || []).filter((c) => c.type === "psyche" && !c.isDreambeastPsyche);
  if (!pool.length) return null;
  const card = [...pool].sort((x, y) => Number(!!x.upgrade) - Number(!!y.upgrade) || psycheCardValue(x) - psycheCardValue(y))[0];
  player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
  if (repress) repressCard(state, card);
  else state.psycheDiscard.push(card);
  recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
  return card;
}

/** Lower a beast's Power for good (never below 1). */
function weakenEncounter(enc, amount) {
  ["accept", "reject", "repress"].forEach((key) => {
    if (enc[key] != null) enc[key] = Math.max(1, Number(enc[key]) - amount);
  });
}

/** One destination moves you straight there; several open a pick. */
function offerMove(state, player, cardId, title, destIds) {
  const dests = destIds.filter((id) => landscapeReady(state, id) && id !== player.landscapeId);
  if (dests.length === 1) {
    movePlayerToId(state, player, dests[0]);
    return true;
  }
  offerChoice(state, player, {
    cardId,
    step: "pick-element-dest",
    title,
    message: "Move to:",
    choices: destChoices(state, dests),
  });
  return true;
}

function beastTileIds(state, filter = () => true) {
  return [...new Set(allEncountersOnBoard(state).filter(({ encounter }) => filter(encounter)).map(({ tile }) => tile.id))];
}

/** Element moves: discard 1 Psyche, then go somewhere specific. */
function elementMove(destFn, emptyWhy) {
  return (state, player, card) => {
    const dests = destFn(state, player).filter((id) => landscapeReady(state, id) && id !== player.landscapeId);
    if (!dests.length) {
      addLog(state, `${card.name}: ${emptyWhy}`);
      return false;
    }
    if (!discardCheapestPsyche(state, player)) {
      addLog(state, `${card.name} needs 1 Psyche to discard.`);
      return false;
    }
    return offerMove(state, player, card.id, card.name, dests);
  };
}

const ACTIVATIONS = {
  "vault-redeal": (state, player, card) => {
    if (!isFreeformBoard(state) || (!vaultCards(state).length && !tileDeckCount(state))) {
      addLog(state, `${card.name}: the Vault has nothing to redeal.`);
      return false;
    }
    const before = state.vaultRefreshesThisRound || 0;
    refreshVault(state);
    state.vaultRefreshesThisRound = before; // Free, so the next paid refresh does not cost more.
    logMoment(state, `${card.name}: the Dreamscape Vault redeals.`);
    return true;
  },
  "place-landscape": (state, player, card) => {
    if (revealCapacity(state) < 1) {
      addLog(state, `${card.name}: there is nothing left to place.`);
      return false;
    }
    beginFreeRevealPicking(state, 1);
    logMoment(state, `${card.name}: place 1 Landscape from the Vault, free.`);
    return true;
  },
  "fight-dice-2": (state, player, card) => {
    state.nextFightDice = (state.nextFightDice || 0) + 2;
    logMoment(state, `${card.name}: your next fight rolls +2 dice.`);
    return true;
  },
  "low-hand-draw": (state, player, card) => {
    if (psycheHandCount(player) > 3) {
      addLog(state, `${card.name} feeds only a hand of 3 or fewer Psyche.`);
      return false;
    }
    const drawn = drawPsycheForPlayer(state, player, 3);
    logMoment(state, `${card.name}: ${player.name} draws ${drawn.length}.`);
    return true;
  },
  forge: (state, player, card) => {
    const lost = discardCheapestPsyche(state, player);
    if (!lost) {
      addLog(state, `${card.name} needs 1 Psyche to discard.`);
      return false;
    }
    const drawn = drawPsycheForPlayer(state, player, 2);
    logMoment(state, `${card.name}: ${lost.name} for ${drawn.length} new Psyche.`);
    return true;
  },
  "steps-2": (state, player, card) => {
    const here = landscapeById(state, player.landscapeId);
    const near = openTilesExcept(state, player.landscapeId).filter((t) => here && hexDistance(here, t) <= 2);
    if (!near.length) {
      addLog(state, `${card.name}: nowhere within 2 steps.`);
      return false;
    }
    return offerMove(state, player, card.id, card.name, near.map((t) => t.id));
  },
  "spare-dusk": (state, player, card) => {
    if (state.duskSparedRound === state.round) {
      addLog(state, `${card.name} has already turned for this dusk.`);
      return false;
    }
    state.duskSparedRound = state.round;
    logMoment(state, `${card.name}: at this dusk, the Dreambeasts left standing take nothing.`);
    return true;
  },
  "summon-beast": (state, player, card) => {
    const sources = allEncountersOnBoard(state).filter(({ tile }) => tile.id !== player.landscapeId);
    if (!sources.length) {
      addLog(state, `${card.name}: no Dreambeast elsewhere to pull.`);
      return false;
    }
    if (!discardCheapestPsyche(state, player)) {
      addLog(state, `${card.name} needs 1 Psyche to discard.`);
      return false;
    }
    offerChoice(state, player, {
      cardId: card.id,
      step: "pick-summon",
      title: card.name,
      message: "Bring which Dreambeast to you?",
      choices: sources.map(({ tile, encounter }) => ({
        id: `${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
        hint: `Power ${encounter.accept}`,
      })),
    });
    return true;
  },
  "to-beast": elementMove((state) => beastTileIds(state), "no Dreambeast to move to."),
  "to-bed": elementMove(() => ["bed"], "you are already on The Bed."),
  "to-quest": elementMove((state) => activeQuestLandscapeIds(state), "no quest Landscape is placed."),
  "to-boss": elementMove((state) => beastTileIds(state, (e) => e.boss || e.miniBoss), "no Dreambeast stands."),
};

/** Why an Instant cannot be played right now (it stays in hand), or "" when it can. */
export function instantBlockReason(state, player, card) {
  const id = card?.refId || card?.id;
  if (id === "knife" && !tileEncounters(landscapeById(state, player.landscapeId)).length) {
    return "Knife needs a Dreambeast on your Landscape.";
  }
  if (id === "raven-claw" && !openTilesExcept(state, player.landscapeId).length) {
    return "Raven Claw has nowhere to fly.";
  }
  if (id === "bag-of-teeth" && !(player.hand || []).some((c) => c.type === "psyche" && !c.isDreambeastPsyche)) {
    return "Bag of Teeth needs 1 Psyche to Repress.";
  }
  if (id === "tooth-saber" && !allEncountersOnBoard(state).length) {
    return "Tooth-Saber needs a Dreambeast on the Dreamscape.";
  }
  return "";
}

// Flower: Remember 2 at every dawn, free.
onDawn((state) => {
  state.players.forEach((player) => {
    if (!player.alive) return;
    (player.persistent || []).filter((obj) => obj.dawnRemember).forEach((obj) => {
      if (beginRemember(state, player, obj.dawnRemember, { source: obj.name })) {
        logMoment(state, `Dawn opens the ${obj.name}: Remember ${obj.dawnRemember}.`);
      }
    });
  });
});
