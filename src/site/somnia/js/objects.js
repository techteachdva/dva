import { addLog } from "./state.js";
import { logMoment } from "./narrator.js";
import { recordQuestEvent } from "./quests.js";
import { repressCard } from "./subconscious.js";
import {
  checkObjectTagSet,
  activatePersistentObjectEffect,
  finishMonkeyPaw,
  applySkeletonKeyAfterDream as applySkeletonKeyChoice,
  revealWithAllSeeingEye,
  OBJECT_EFFECTS,
  rememberObjectHelpers,
} from "./object-effects.js";
import { psycheHandCount, psycheCardValue } from "./psyche.js";
import { pullObjectFromMindstream, objectForPlayer, discardToMindstream } from "./mindstream-supply.js";
import { spendPowerTokens, grantPowerTokens } from "./power-tokens.js";
import { queueObjectDrawFx, queueObjectPlayFx } from "./board-fx.js";
import { playSfx } from "./audio.js";

export function isNothingCard(card) {
  return card?.id?.startsWith("the-nothing");
}

export function objectUseFate(card) {
  if (card?.subtype === "persistent") return "play";
  return "repress";
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
  repressCard(state, card);
  addLog(state, `${card.name} is Repressed to the Subconscious.`);
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
  logMoment(state, "The Nothing — lose 1 Power Token or Repress Dreamers+6 Psyche.");
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

/** Set keyword from object tags (e.g. chess, body) — not the fraction like 3/3. */
export function objectSetTag(card) {
  if (!card?.tags?.length) return null;
  const tag = card.tags.find((t) => t && !/^\d+\/\d+$/.test(t));
  return tag || null;
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
  player.objects.push(card);
  addLog(state, `${player.name} draws ${card.name}.`);
}

function resolveObjectEffect(state, player, card, helpers) {
  const effectId = card.refId || card.id;
  if (!OBJECT_EFFECTS[effectId]) return;
  rememberObjectHelpers(helpers);
  OBJECT_EFFECTS[effectId](state, player, helpers);
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
  resolveObjectEffect(state, player, card, helpers);
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
    playSfx("acquire");
    queueObjectPlayFx(card, { to: "persistent" });
    const tag = objectSetTag(card);
    if (tag) checkObjectTagSet(state, player, tag);
    return card;
  }

  if (inHand?.subtype === "instant") {
    player.objects = player.objects.filter((o) => o.instanceId !== card.instanceId);
    addLog(state, `${player.name} plays ${card.name}.`);
    playSfx("acquire");
    resolveObjectEffect(state, player, card, helpers);
    const tag = objectSetTag(card);
    if (tag) checkObjectTagSet(state, player, tag);
    if (objectUseFate(card) === "repress") {
      queueObjectPlayFx(card, { to: "subconscious" });
      repressCard(state, card);
    } else {
      queueObjectPlayFx(card, { to: "mindstream", suit: card.mindstreamSuit || card.suit });
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
    playSfx("acquire");
    queueObjectPlayFx(card, { to: "activate" });
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
