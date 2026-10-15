/**
 * Ainmos 36.0 — fullscreen Mindstream / Dream draw choices.
 * Events: Good (paid, landscape-gated) vs Bad (free).
 * Objects: Take vs Discard + Draw 3 Psyche.
 * Dreambeasts: Accept.
 * Dreams: Bright costs a Repress, a Psyche, or a Forgotten Landscape, and a gate.
 * Dim is free.
 */

import { addLog, drawPsycheForPlayer, setEncounterOnLandscape, landscapeById, tileHasEncounters, revealLandscapeTile } from "../core/state.js";
import { cyclePosition } from "../core/cycle.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { logMoment } from "../core/narrator.js";
import { totalStat } from "../core/rules.js";
import { isWildPsyche, psycheMatchesSuit } from "./psyche.js";
import {
  hasAffectedLandscapes,
  eventLandscapeNames,
  eventLandscapeIds,
  eventGateSentence,
  eventRewardSentence,
  scaleEventCount,
  landscapeImageForId,
  revealedLandscapeIds,
} from "../board/event-landscapes.js";
import { getEventResolution } from "../effects/event-resolutions.js";
import { getDreamResolution } from "./dream-resolutions.js";
import { applyResolutionEffect, discardMindstreamCard, resolutionRulesText } from "../effects/resolution-effects.js";
import { onObjectDrawn } from "../effects/objects.js";
import { discardToMindstream, encounterFromDreambeastCard } from "./mindstream-supply.js";
import { repressCard, requestReturnCards, subconsciousCount, enqueueDiscardFromHand } from "../dreamers/subconscious.js";
import { applyFailEffect } from "../encounters/dreambeasts.js";
import { playDiceBattle, rollD6, countSuccesses } from "../encounters/dice-battle.js";
import { grantPowerTokens } from "./power-tokens.js";
import { uid } from "../core/data.js";
import { isFreeformBoard, placementSlots, findUnplacedLandscape } from "../board/dreamscape-vault.js";
import { surfaceLandscapeNear } from "../board/landscapes.js";
import { archetypeEventSides, BRIGHT_RETURN } from "../dreamers/archetype-board.js";
import { autoReturnPsyche } from "../dreamers/subconscious.js";
import { paymentFor } from "../shop/lost-found.js";

const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

function psycheOfSuit(player, suit) {
  return (player.hand || []).filter(
    (c) => c.type !== "psyche-power" && c.type !== "object" && psycheMatchesSuit(c, suit),
  );
}

function awakeLandscapes(state) {
  return (state.board || []).filter((t) => !t.center && t.id !== "bed" && t.revealed && !t.wasteland);
}

function forgettableForToll(state) {
  return awakeLandscapes(state).filter((t) => !tileHasEncounters(t));
}

function heldObjects(player) {
  return (player?.objects?.length || 0) + (player?.persistent?.length || 0);
}

function dreamGateMet(state, player, gate) {
  if (!gate) return { ok: false, reason: "Bright has no condition." };
  const label = gate.label || "its condition";
  if (gate.kind === "suit") {
    const have = psycheOfSuit(player, gate.suit).length;
    if (have >= (gate.count || 1)) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "suits") {
    const missing = (gate.suits || []).some((suit) => psycheOfSuit(player, suit).length < 1);
    if (!missing) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "object") {
    if (heldObjects(player) >= 1) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "token") {
    if ((player?.powerTokens || 0) >= 1) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "encounter") {
    const found = (state.board || []).some((t) => tileHasEncounters(t));
    if (found) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "clear") {
    const tile = landscapeById(state, player?.landscapeId);
    if (tile && !tileHasEncounters(tile)) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "revealed") {
    if (awakeLandscapes(state).length >= (gate.count || 1)) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "subconscious") {
    if (subconsciousCount(state.subconscious) >= 1) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  if (gate.kind === "tableHand") {
    const short = (state.players || []).filter((p) => p.alive).some((p) => (p.hand?.length || 0) < (gate.count || 1));
    if (!short) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright needs ${label}.` };
  }
  return { ok: false, reason: "Bright has no condition." };
}

function dreamTollAffordable(state, player, toll) {
  if (!toll?.kind || !(toll.count > 0)) {
    return { ok: false, reason: "Bright has no cost." };
  }
  const hand = player?.hand?.length || 0;
  if (toll.kind === "psyche") {
    if (toll.suit) {
      const have = psycheOfSuit(player, toll.suit).length;
      if (have >= toll.count) return { ok: true, reason: "" };
      const suitName = SUIT_LABELS[toll.suit] || toll.suit;
      return { ok: false, reason: `Bright costs ${toll.count} ${suitName} Psyche, and the hand is short.` };
    }
    if (hand >= toll.count) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright costs ${toll.count} Psyche, and the hand is short.` };
  }
  if (toll.kind === "repressAll") {
    const short = (state.players || []).filter((p) => p.alive).some((p) => (p.hand?.length || 0) < toll.count);
    if (!short) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright costs each Dreamer Repress ${toll.count} Psyche, and a hand is short.` };
  }
  if (toll.kind === "repress") {
    if (hand >= toll.count) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright costs Repress ${toll.count}, and the hand is short.` };
  }
  if (toll.kind === "forget") {
    if (forgettableForToll(state).length >= toll.count) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright costs Forget ${toll.count} Landscape${toll.count === 1 ? "" : "s"}, and not enough are awake.` };
  }
  return { ok: false, reason: "Bright has no cost." };
}

/** Bright opens only when the gate is met and the toll can be paid. */
export function assessDreamGood(state, player, resolution) {
  const good = resolution?.good;
  if (!good?.toll || !good?.gate) {
    return { ok: false, reason: "This Dream has no Bright path." };
  }
  const gate = dreamGateMet(state, player, good.gate);
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const toll = dreamTollAffordable(state, player, good.toll);
  if (!toll.ok) return { ok: false, reason: toll.reason };
  return { ok: true, reason: "" };
}

function payDreamToll(state, player, toll, helpers) {
  if (toll.kind === "psyche") {
    const effect = toll.suit ? "discardSuitPsyche" : "discardPsyche";
    applyResolutionEffect(state, player, {
      effect,
      params: { count: toll.count, suit: toll.suit },
    }, helpers, "good");
    return;
  }
  if (toll.kind === "repressAll") {
    applyResolutionEffect(state, player, { effect: "repressPsycheAll", params: { count: toll.count } }, helpers, "good");
    return;
  }
  if (toll.kind === "repress") {
    applyResolutionEffect(state, player, {
      effect: "repressPsyche",
      params: { count: toll.count, strict: true },
    }, helpers, "good");
    return;
  }
  if (toll.kind === "forget") {
    applyResolutionEffect(state, player, { effect: "forgetLandscapes", params: { count: toll.count } }, helpers, "good");
  }
}

function finishMindstreamCard(state, card) {
  if (!card) return;
  if (card.type === "object" || card.type === "dreambeast") return;
  discardMindstreamCard(state, card);
}

const DIM_CHOICE_IDS = new Set(["bad", "discard", "repress", "return", "flee"]);

/** Remember which either/or path was taken so discard views can show Bright or Dim. */
function stampResolutionChoice(card, choiceId, pending) {
  if (!card || !choiceId) return;
  const picked = pending?.choices?.find((c) => c.id === choiceId);
  const dim = DIM_CHOICE_IDS.has(choiceId) || picked?.role === "bad";
  card.resolutionSide = dim ? "bad" : "good";
  card.resolutionLabel = picked?.label || (dim ? "Dim" : "Bright");
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

export function beginDreamCardChoice(state, card, player, helpers = {}) {
  if (!card || card.type === "boss-dream" || card.boss) return false;
  if (card.id === "you-never-wake" || card.id === "final-recurrence") return false;
  if (["theta", "alpha"].includes(card.id)) return false;

  const resolution = getDreamResolution(card.refId || card.id);
  if (!resolution) return false;

  // Ainmos: a Dream is a condition you survive. No Bright side, no choice:
  // one full-screen card, one button, and the Dream takes its toll.
  state.pendingMindstreamChoice = {
    kind: "dream",
    ui: "mindstream-fullscreen",
    single: true,
    cycleLabel: (() => {
      const pos = cyclePosition(state);
      const tag = pos.dream === 2 ? " · Dreambeast" : pos.dream === 3 ? " · Archetype" : "";
      return `Cycle ${pos.cycle} · Dream ${pos.dream} of 3${tag}`;
    })(),
    cardId: card.id,
    dreamId: card.id,
    playerId: player.id,
    card,
    title: card.name,
    message: resolution.bad.hint || card.text || "The Dream takes its toll.",
    suit: "lucidity",
    choices: [
      {
        id: "bad",
        role: "bad",
        shape: "willpower",
        label: resolution.bad.label,
        hint: "Endure it",
        disabled: false,
      },
    ],
    helpers,
  };
  logMoment(state, `${card.name}: ${resolution.bad.label}.`);
  return true;
}

/**
 * Resolve a pending Mindstream/Dream fullscreen choice.
 * @returns {boolean} true if handled
 */
/**
 * Ainmos: an Archetype Meet opens with one of its Events. Bright (while one of
 * the Event's Landscapes is placed) costs Psyche of its suit and helps the
 * coming fight. Dim is free and makes the fight harder.
 */
export function beginArchetypeEventChoice(state, event, player, arch, tileId) {
  if (!event || !player || !arch) return false;
  const resolution = getEventResolution(event.refId || event.id);
  const sides = archetypeEventSides(event, resolution);
  const suit = event.suit || resolution?.suit || "lucidity";
  const landscapesOk = hasAffectedLandscapes(state, event) || !(event.landscapes?.length);
  const pay = paymentFor(player, sides.bright.cost, { suit });
  const ids = eventLandscapeIds(event);
  const names = eventLandscapeNames(state, event);
  const revealed = revealedLandscapeIds(state.board);
  const gate = landscapesOk
    ? `Bright is open: ${names.filter((_, i) => revealed.has(ids[i])).join(" or ") || "its Landscape"} is placed.`
    : `Bright needs ${names.join(" or ")} placed on the Dreamscape.`;
  const payText = pay
    ? `Pay ${pay.cards.map((c) => `${SUIT_LABELS[c.suit] || "Wild"} ${c.value}`).join(" + ")}`
    : `Needs ${sides.bright.cost} ${SUIT_LABELS[suit]} Psyche`;
  state.pendingMindstreamChoice = {
    kind: "archetype-event",
    ui: "mindstream-fullscreen",
    cardId: event.id,
    playerId: player.id,
    card: { ...event, type: "event" },
    archId: arch.id,
    tileId,
    title: event.name,
    kicker: `${arch.name}'s Event`,
    message: `Before you face ${arch.name}, the dream turns.`,
    suit,
    landscapeHint: gate,
    landscapeStatus: gate,
    landscapeChips: ids.map((id, index) => ({
      id,
      name: names[index],
      image: landscapeImageForId(id, state.board),
      revealed: revealed.has(id),
    })),
    sides,
    choices: [
      {
        id: "good",
        role: "good",
        shape: suit,
        label: `Bright: ${sides.bright.label}`,
        hint: `${sides.bright.hint} · ${payText}`,
        disabled: !landscapesOk || !pay,
        disabledReason: !landscapesOk ? gate : `Bright costs ${sides.bright.cost} ${SUIT_LABELS[suit]} Psyche.`,
      },
      {
        id: "bad",
        role: "bad",
        shape: suit,
        label: `Dim: ${sides.dim.label}`,
        hint: `${sides.dim.hint} · Free`,
        disabled: false,
      },
    ],
  };
  state.pendingMindstreamChoice.needsDrawCinematic = true;
  logMoment(state, `${arch.name} sends ${event.name}. Bright or Dim?`);
  return true;
}

function resolveArchetypeEvent(state, pending, choiceId) {
  const player = playerById(state, pending.playerId);
  const sides = pending.sides;
  let side = choiceId === "good" ? "bright" : "dim";
  if (side === "bright") {
    const pay = player && paymentFor(player, sides.bright.cost, { suit: pending.suit });
    if (!pay) {
      addLog(state, "Bright's cost cannot be paid. The dream turns Dim.");
      side = "dim";
    } else {
      const ids = new Set(pay.cards.map((c) => c.instanceId));
      player.hand = player.hand.filter((c) => !ids.has(c.instanceId));
      state.psycheDiscard = [...(state.psycheDiscard || []), ...pay.cards];
      autoReturnPsyche(state, BRIGHT_RETURN, `${pending.title} (Bright)`);
    }
  }
  const chosen = sides[side];
  state.pendingMindstreamChoice = null;
  state.archetypeFight = {
    archId: pending.archId,
    tileId: pending.tileId,
    actorId: pending.playerId,
    eventName: pending.title,
    side,
    label: chosen.label,
    hint: chosen.hint,
    mods: { ...chosen.mods },
  };
  logMoment(state, `${pending.title}: ${side === "bright" ? "Bright" : "Dim"}, ${chosen.label}. ${chosen.hint}. Now pick your spread and fight.`);
  return true;
}

export function resolveMindstreamChoice(state, choiceId, helpers = {}) {
  const pending = state.pendingMindstreamChoice;
  if (!pending) return false;
  if (pending.kind === "archetype-event") return resolveArchetypeEvent(state, pending, choiceId);
  const player = playerById(state, pending.playerId);
  const card = pending.card;
  const h = { ...pending.helpers, ...helpers };

  if (pending.kind === "dream") {
    const resolution = getDreamResolution(card.refId || card.id);
    if (!resolution || !player) {
      state.pendingMindstreamChoice = null;
      return true;
    }
    const sideId = "bad"; // Ainmos: every Dream resolves its toll.
    if (state.tutorialFlags?.forceDreamDim && sideId === "good") {
      addLog(state, "Tutorial — take Dim. Bright spends cards this lesson still needs.");
      return false;
    }
    if (sideId === "good") {
      const bright = assessDreamGood(state, player, resolution);
      if (!bright.ok) {
        addLog(state, bright.reason || `${card.name}: Bright stays shut.`);
        return false;
      }
    }
    state.pendingMindstreamChoice = null;
    const side = sideId === "good" ? resolution.good : resolution.bad;
    stampResolutionChoice(card, sideId, pending);
    if (sideId === "good" && (resolution.good.toll?.kind === "repress" || resolution.good.toll?.kind === "psyche")) {
      const prevIdle = state.onResolutionIdle;
      state.onResolutionIdle = (s) => {
        applyResolutionEffect(s, player, side, h, "good");
        logMoment(s, `${card.name}: ${side.label}.`);
        if (typeof prevIdle === "function") prevIdle(s);
      };
      payDreamToll(state, player, resolution.good.toll, h);
      return true;
    }
    if (sideId === "good") payDreamToll(state, player, resolution.good.toll, h);
    applyResolutionEffect(state, player, side, h, sideId);
    logMoment(state, `${card.name}: ${side.label}.`);
    return true;
  }

  state.pendingMindstreamChoice = null;
  return false;
}

/** Kept so a stale cached bot-ai.js from 0.20 still loads; Events are now Archetype Events. */
export function canPayEventGood() {
  return false;
}
