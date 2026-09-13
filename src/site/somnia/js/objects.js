import { addLog } from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { repressCard } from "./subconscious.js";
import {
  checkObjectTagSet,
  activatePersistentObjectEffect,
  finishMonkeyPaw,
  applySkeletonKeyAfterDream as applySkeletonKeyChoice,
  revealWithAllSeeingEye,
} from "./object-effects.js";
import { psycheHandCount, psycheCardValue } from "./psyche.js";
import { pullObjectFromMindstream, objectForPlayer, discardToMindstream } from "./mindstream-supply.js";
import { spendPowerTokens, grantPowerTokens } from "./power-tokens.js";
import { queueObjectDrawFx } from "./board-fx.js";

export function isNothingCard(card) {
  return card?.id?.startsWith("the-nothing");
}

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function repressPsycheFromDeck(state, count) {
  let repressed = 0;
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
    repressed += 1;
  }
  return repressed;
}

function finishNothingDiscard(state, card) {
  discardToMindstream(state, card);
  const suit = card.mindstreamSuit || card.suit || "Mindstream";
  addLog(state, `${card.name} discarded to ${suit} Mindstream discard.`);
}

export function beginNothingResolution(state, player, card) {
  const anyoneHasToken = state.players.some((p) => p.alive && (p.powerTokens || 0) > 0);
  if (!anyoneHasToken) {
    const count = alivePlayers(state).length + 6;
    const repressed = repressPsycheFromDeck(state, count);
    addLog(state, `The Nothing: Repress ${repressed} Psyche from top of Psyche deck (no Power Tokens available).`);
    finishNothingDiscard(state, card);
    return;
  }
  state.pendingNothingChoice = { card, playerId: player.id };
  addLog(state, "The Nothing: lose 1 Power Token or Repress Dreamers+6 Psyche from the Psyche deck.");
}

export function resolveNothingChoice(state, choice) {
  const pending = state.pendingNothingChoice;
  if (!pending) return false;

  const { card } = pending;
  if (choice === "token") {
    const spender = state.players.find((p) => p.alive && (p.powerTokens || 0) > 0);
    if (!spender) {
      const count = alivePlayers(state).length + 6;
      repressPsycheFromDeck(state, count);
      addLog(state, `The Nothing: Repress ${count} Psyche from top of Psyche deck.`);
    } else {
      spendPowerTokens(state, spender, 1, { reason: `${spender.name} loses 1 Power Token to The Nothing.` });
    }
  } else {
    const count = alivePlayers(state).length + 6;
    const repressed = repressPsycheFromDeck(state, count);
    addLog(state, `The Nothing: Repress ${repressed} Psyche from top of Psyche deck.`);
  }

  state.pendingNothingChoice = null;
  finishNothingDiscard(state, card);
  return true;
}

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

export function handRoomForPsycheDraw(state, player) {
  return Math.max(0, handLimitForPlayer(state, player) - psycheHandCount(player));
}

export function persistentMeetBonus(state, player) {
  ensureObjectZones(player);
  let bonus = 0;
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
  if (isNothingCard(card)) {
    beginNothingResolution(state, player, card);
    return;
  }
  if (card.id === "the-all-seeing-eye") {
    revealWithAllSeeingEye(state);
    repressCard(state, card);
    addLog(state, "The All Seeing Eye: choose Landscapes to reveal, then it is Repressed.");
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
      discardToMindstream(state, card);
    }
    return card;
  }

  if (inPlay) {
    if (options.usePower && !spendPowerTokens(state, player, 1)) {
      addLog(state, "Need 1 Power Token to activate an Object.");
      return null;
    }
    addLog(state, `${player.name} activates ${card.name}.`);
    const result = activatePersistentObjectEffect(state, player, card);
    if (result === false) {
      if (options.usePower) {
        grantPowerTokens(state, player, 1, { reason: `${card.name} did nothing.`, logQuest: false, animate: false });
      }
      return null;
    }
    if (result?.monkeyPaw) finishMonkeyPaw(state, player, card);
    return card;
  }

  addLog(state, "Object not found.");
  return null;
}

export function drawObjects(state, player, count, helpers) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const pulled = pullObjectFromMindstream(state);
    if (!pulled) break;
    const card = objectForPlayer(pulled.card);
    onObjectDrawn(state, player, card, helpers);
    queueObjectDrawFx(player.id, card, pulled.suit);
    drawn.push(card);
    recordQuestEvent(state, "draw_object", { count: 1 });
  }
  return drawn;
}

export function applySkeletonKeyAfterDream(state, player) {
  applySkeletonKeyChoice(state, player);
}
