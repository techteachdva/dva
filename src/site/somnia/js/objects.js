import {
  addLog,
  landscapeById,
  revealLandscapeTile,
  setEncounterOnLandscape,
} from "./state.js";
import { shuffle } from "./data.js";
import { recordQuestEvent } from "./quests.js";
import { repressCard, requestReturnCards } from "./subconscious.js";
import { edgeLandscapes } from "./hex.js";
import { checkObjectTagSet } from "./object-effects.js";
import { psycheCardValue } from "./psyche.js";

export function ensureObjectZones(player) {
  if (!player.persistent) player.persistent = [];
  if (!player.objects) player.objects = [];
}

export function handLimitForPlayer(state, player) {
  ensureObjectZones(player);
  let limit = 10;
  if (player.persistent.some((o) => o.id === "severed-torso")) limit = 12;
  return limit;
}

export function persistentMeetBonus(state, player) {
  ensureObjectZones(player);
  let bonus = (state.persistentArchetypes || []).length;
  player.persistent.forEach((obj) => {
    const tags = obj.tags || [];
    if (tags.some((t) => t.startsWith("jewelry") || t.startsWith("stick"))) bonus += 1;
  });
  return bonus;
}

export function sumEffectivePsycheValue(state, player, selectedCards) {
  if (!selectedCards.length) return 0;
  const hasBody = player.persistent?.some((o) => o.tags?.some((t) => t.startsWith("body")));
  const base = selectedCards.reduce((sum, c) => sum + psycheCardValue(c), 0);
  if (!hasBody) return base;
  const maxVal = Math.max(...selectedCards.map((c) => psycheCardValue(c)));
  return base + maxVal;
}

export function extraPsycheDrawAtRoundStart(state, player) {
  ensureObjectZones(player);
  return player.persistent.some((o) => o.id === "beating-heart") ? 1 : 0;
}

export function onObjectDrawn(state, player, card, helpers) {
  ensureObjectZones(player);
  if (card.subtype === "must-play") {
    addLog(state, `${player.name} must play ${card.name}.`);
    resolveMustPlayObject(state, player, card, helpers);
    return;
  }
  if (card.subtype === "persistent") {
    player.persistent.push(card);
    addLog(state, `${card.name} enters play (Persistent).`);
    return;
  }
  player.objects.push(card);
}

function resolveMustPlayObject(state, player, card, helpers) {
  if (card.id === "the-nothing") {
    const alive = state.players.filter((p) => p.alive);
    let left = alive.length + 6;
    alive.forEach((p) => {
      while (left > 0 && p.hand.length) {
        repressCard(state, p.hand.pop());
        left -= 1;
      }
    });
    addLog(state, `The Nothing represses ${alive.length + 6} Psyche across the Dreamers.`);
    repressCard(state, card);
    return;
  }
  if (card.id === "the-all-seeing-eye") {
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    const count = state.players.filter((p) => p.alive).length + 1;
    hidden.slice(0, count).forEach((t) => revealLandscapeTile(state, t));
    repressCard(state, card);
    addLog(state, "The All Seeing Eye reveals Landscapes, then is Repressed.");
    return;
  }
  if (helpers?.resolveCardEffect) {
    helpers.resolveCardEffect(state, card, player, helpers);
  }
  repressCard(state, card);
}

export function playObjectCard(state, player, card, helpers, options = {}) {
  ensureObjectZones(player);
  const inHand = player.objects.find((o) => o.instanceId === card.instanceId);
  const inPlay = player.persistent.find((o) => o.instanceId === card.instanceId);

  if (inHand?.subtype === "persistent") {
    player.objects = player.objects.filter((o) => o.instanceId !== card.instanceId);
    player.persistent.push(card);
    addLog(state, `${card.name} placed in play (Persistent).`);
    const tag = card.tags?.[0]?.split("/")?.[0];
    if (tag) checkObjectTagSet(state, player, tag);
    return card;
  }

  if (inHand?.subtype === "instant") {
    player.objects = player.objects.filter((o) => o.instanceId !== card.instanceId);
    addLog(state, `${player.name} plays ${card.name}.`);
    if (helpers?.resolveCardEffect) {
      helpers.resolveCardEffect(state, card, player, helpers);
    }
    const tag = card.tags?.[0]?.split("/")?.[0];
    if (tag) checkObjectTagSet(state, player, tag);
    if (card.text?.toLowerCase().includes("repress this")) {
      repressCard(state, card);
    } else {
      state.objectDiscard.push(card);
    }
    return card;
  }

  if (inPlay) {
    if (options.usePower && player.powerTokens < 1) {
      addLog(state, "Need 1 Power Token to activate an Object.");
      return null;
    }
    if (options.usePower) player.powerTokens -= 1;
    addLog(state, `${player.name} activates ${card.name}.`);
    activatePersistentObject(state, player, card);
    return card;
  }

  addLog(state, "Object not found.");
  return null;
}

function activatePersistentObject(state, player, card) {
  const dreambeastMovers = {
    "row-boat": ["lava", "endless-ocean", "sea-of-teeth"],
    rope: ["endless-hallway", "the-attic", "the-basement"],
    hourglass: ["day-in-the-life", "insanity", "naked-classroom"],
    "conch-shell": ["field-of-broken-glass", "desert", "black-void"],
  };

  if (dreambeastMovers[card.id]) {
    const source = state.board.find((t) => t.encounter);
    const dest = dreambeastMovers[card.id].find((id) => landscapeById(state, id)?.revealed);
    if (source && dest) {
      const enc = source.encounter;
      setEncounterOnLandscape(state, dest, enc);
      source.encounter = null;
      addLog(state, `Moved ${enc.name} to ${landscapeById(state, dest).name}.`);
    }
    return;
  }

  const elementMoves = {
    water: ["endless-ocean", "sea-of-teeth"],
    air: ["sky", "silver-mist"],
    earth: ["forest", "candy-mountain"],
    fire: ["lava", "desert"],
  };

  if (elementMoves[card.id]) {
    if (!player.hand.length) {
      addLog(state, `Discard 1 Psyche to activate ${card.name}.`);
      return;
    }
    state.psycheDiscard.push(player.hand.pop());
    recordQuestEvent(state, "discard_psyche", { count: 1 });
    const dest = elementMoves[card.id].find((id) => landscapeById(state, id)?.revealed);
    if (dest) {
      player.landscapeId = dest;
      addLog(state, `${player.name} moves to ${landscapeById(state, dest).name}.`);
    }
    return;
  }

  if (card.id === "mobius-crystal") {
    const edges = edgeLandscapes(state).filter((t) => t.encounter);
    if (edges.length >= 2 && player.hand.length) {
      player.hand.pop();
      const from = edges[0];
      const to = edges[1];
      const enc = from.encounter;
      if (enc) {
        setEncounterOnLandscape(state, to.id, enc);
        from.encounter = null;
        addLog(state, `Moved ${enc.name} to ${to.name}.`);
      }
    }
    return;
  }

  if (card.id === "skeleton-key") {
    state.skeletonKeyPending = true;
    addLog(state, "Skeleton Key armed: will flip a Mindstream deck after the next Dream.");
    return;
  }

  if (card.id === "monkey-paw") {
    if (!card.powerSlots) card.powerSlots = 0;
    if (player.powerTokens > 0 && card.powerSlots < 3) {
      player.powerTokens -= 1;
      card.powerSlots += 1;
      addLog(state, `Monkey Paw: ${card.powerSlots}/3 Power placed.`);
      if (card.powerSlots >= 3) {
        requestReturnCards(state, 3, player);
        card.powerSlots = 0;
        repressCard(state, card);
        player.persistent = player.persistent.filter((o) => o.instanceId !== card.instanceId);
      }
    }
    return;
  }

  const text = (card.text || "").toLowerCase();
  if (text.includes("return") && text.includes("card")) {
    const m = text.match(/return (\d+)/);
    requestReturnCards(state, m ? parseInt(m[1], 10) : 1, player);
  }
}

export function drawObjects(state, player, count, helpers) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!state.objectDeck.length && state.objectDiscard.length) {
      state.objectDeck = shuffle(state.objectDiscard);
      state.objectDiscard = [];
    }
    if (!state.objectDeck.length) break;
    const card = state.objectDeck.shift();
    onObjectDrawn(state, player, card, helpers);
    drawn.push(card);
    recordQuestEvent(state, "draw_object", { count: 1 });
  }
  return drawn;
}

export function applySkeletonKeyAfterDream(state) {
  if (!state.skeletonKeyPending) return;
  state.skeletonKeyPending = false;
  const suits = ["lucidity", "elasticity", "willpower"];
  const suit = suits.find((s) => state.mindstreamDecks[s]?.length > 1);
  if (suit) {
    const deck = state.mindstreamDecks[suit];
    const top = deck.shift();
    deck.push(top);
    addLog(state, `Skeleton Key flips ${suit} Mindstream.`);
  }
}
