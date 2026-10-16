import { objectLimit, objectCount, letGoValue } from "../shop/lost-found.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import { addLog, drawPsycheForPlayer } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { repressCard, maybeClearFreshlyRepressed } from "../dreamers/subconscious.js";
import {
  checkObjectTagSet,
  activatePersistentObjectEffect,
  finishMonkeyPaw,
  applySkeletonKeyAfterDream as applySkeletonKeyChoice,
  revealWithAllSeeingEye,
  OBJECT_EFFECTS,
  rememberObjectHelpers,
  persistentObjectCanActivate,
  instantBlockReason,
} from "./object-effects.js";

export { persistentObjectCanActivate };
import { psycheHandCount, psycheCardValue, psycheMatchesSuit, isWildPsyche } from "../cards/psyche.js";
import { formById, levelUpForm } from "../cards/dream-forms.js";
import { pullObjectFromMindstream, objectForPlayer, discardToMindstream } from "../cards/mindstream-supply.js";
import { spendPowerTokens, grantPowerTokens } from "../cards/power-tokens.js";
import { queueObjectDrawFx, queueObjectPlayFx } from "../board/board-fx.js";
import { playSfx } from "../audio/audio.js";

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
  return Math.max(0, handLimitForPlayer(state, player) - (player?.hand?.length || 0));
}

/** Jewelry: +1 fight die for each piece whose suit is in the spread. */
export function persistentMeetBonus(state, player, selectedCards = []) {
  ensureObjectZones(player);
  const suits = new Set();
  (selectedCards || []).forEach((card) => {
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      if (psycheMatchesSuit(card, suit)) suits.add(suit);
    });
  });
  return player.persistent.filter((obj) => obj.spreadSuitDie && suits.has(obj.spreadSuitDie)).length;
}

export function sumEffectivePsycheValue(state, player, selectedCards) {
  if (!selectedCards.length) return 0;
  return selectedCards.reduce((sum, c) => sum + psycheCardValue(c), 0);
}

/** Passive Persistent Objects work on their own; there is nothing to activate. */
export function isPassiveObject(card) {
  return !!card?.passive;
}

export function extraPsycheDrawAtRoundStart(state, player) {
  ensureObjectZones(player);
  return player.persistent.some((o) => o.id === "beating-heart") ? 1 : 0;
}

export function onObjectDrawn(state, player, card, helpers) {
  ensureObjectZones(player);
  if (card.subtype === "must-play") {
    addLog(state, `${player.name} must play ${card.name}.`);
    if (state.tutorialFlags && card.id === "the-all-seeing-eye") state.tutorialFlags.eyePlayed = true;
    resolveMustPlayObject(state, player, card, helpers);
    return;
  }
  player.objects.push(card);
  addLog(state, `${player.name} draws ${card.name}.`);
  const tag = objectSetTag(card);
  if (tag) checkObjectTagSet(state, player, tag);
  enforceObjectLimit(state, player);
}

/** Ainmos: a Dreamer past the Object limit lets one Object go (to the Object discard). */
export function enforceObjectLimit(state, player) {
  const limit = objectLimit(state);
  if (objectCount(player) <= limit) return false;
  const held = [...(player.objects || []), ...(player.persistent || [])];
  offerEffectChoice(state, player, {
    cardId: "object-limit",
    title: "Too many Objects",
    message: `${player.name} can hold ${limit} Objects. Let one go: it draws Psyche equal to its price.`,
    choices: held.map((obj) => {
      const draw = letGoValue(state, obj);
      return {
        id: obj.instanceId,
        label: `Let go of ${obj.name}`,
        hint: draw ? `Draw ${draw} Psyche.` : "Found this round: draws nothing.",
      };
    }),
  });
  return true;
}

/**
 * Let an Object go: it returns to the Object discard and its holder draws
 * Psyche equal to its price (nothing for one found this round). This is how a
 * full row makes room for a new set.
 */
export function letGoObject(state, player, instanceId) {
  if (!player) return false;
  const card = [...(player.objects || []), ...(player.persistent || [])].find((o) => o.instanceId === instanceId);
  if (!card) return false;
  player.objects = (player.objects || []).filter((o) => o.instanceId !== instanceId);
  player.persistent = (player.persistent || []).filter((o) => o.instanceId !== instanceId);
  const draw = letGoValue(state, card);
  delete card.foundRound;
  discardToMindstream(state, card);
  const drawn = draw ? drawPsycheForPlayer(state, player, draw).length : 0;
  logMoment(state, drawn
    ? `${player.name} lets ${card.name} go and draws ${drawn} Psyche.`
    : `${player.name} lets ${card.name} go.`);
  return true;
}

registerEffectResolver("object-limit", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return true;
  if (!letGoObject(state, player, choiceId)) return true;
  enforceObjectLimit(state, player);
  return true;
});

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

function dreamFormFee(player, suit) {
  const candidates = (player.hand || []).filter((c) => (
    c.type === "psyche"
    && !c.isDreambeastPsyche
    && psycheMatchesSuit(c, suit)
  ));
  // Spend the plainest card: not Wild, not upgraded, lowest value.
  return candidates.sort((a, b) => (
    Number(isWildPsyche(a)) - Number(isWildPsyche(b))
    || Number(!!a.upgrade) - Number(!!b.upgrade)
    || (a.value || 0) - (b.value || 0)
  ))[0] || null;
}

function playDreamFormObject(state, player, card) {
  const form = formById(card.levelsForm);
  const suitName = card.suit ? card.suit.charAt(0).toUpperCase() + card.suit.slice(1) : "suited";
  const fee = dreamFormFee(player, card.suit);
  if (!form) return null;
  if (!fee) {
    addLog(state, `${card.name} asks for 1 ${suitName} Psyche to Repress. Draw or trade for one, then play it.`);
    return null;
  }
  player.hand = player.hand.filter((c) => c.instanceId !== fee.instanceId);
  repressCard(state, fee);
  player.objects = player.objects.filter((o) => o.instanceId !== card.instanceId);
  const level = levelUpForm(state, form.id);
  queueObjectPlayFx(card, { to: "subconscious" });
  repressCard(state, card);
  playSfx("acquire");
  addLog(state, `${player.name} Represses ${fee.name} and ${card.name}. ${form.name} rises to level ${level}: +${level} dice.`);
  maybeClearFreshlyRepressed(state);
  return card;
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

  // Ainmos Dream Form Objects: Repress 1 suited Psyche, raise the Form, Repress the Object.
  if (inHand?.subtype === "instant" && inHand.levelsForm) {
    return playDreamFormObject(state, player, inHand);
  }

  if (inHand?.subtype === "instant") {
    const blocked = instantBlockReason(state, player, inHand);
    if (blocked) {
      addLog(state, blocked);
      return null;
    }
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
    maybeClearFreshlyRepressed(state);
    return card;
  }

  if (inPlay) {
    if (isPassiveObject(inPlay)) {
      addLog(state, `${card.name} works on its own; there is nothing to activate.`);
      return null;
    }
    if (options.usePower) {
      addLog(state, "A Persistent Object costs 1 Meet action, not a Power Token.");
      return null;
    }
    addLog(state, `${player.name} activates ${card.name}.`);
    const result = activatePersistentObjectEffect(state, player, card);
    if (result === false) {
      if (options.usePower) {
        grantPowerTokens(state, player, 1, { reason: `${card.name} did nothing.`, logQuest: false, animate: false, source: "refund" });
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

/** Give the Dreamer one particular Object card (a searched-out Set piece). */
export function giveObjectCard(state, player, raw, helpers) {
  const card = objectForPlayer(raw);
  onObjectDrawn(state, player, card, helpers);
  queueObjectDrawFx(player.id, card, card.suit);
  recordQuestEvent(state, "draw_object", { count: 1 });
  return card;
}

export function drawObjects(state, player, count, helpers, suit = null) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const pulled = pullObjectFromMindstream(state, { suit });
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
