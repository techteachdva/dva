/**
 * Somnia 36.0 — fullscreen Mindstream / Dream draw choices.
 * Events: Good (paid, landscape-gated) vs Bad (free).
 * Objects: Take vs Discard + Draw 3 Psyche.
 * Dreambeasts: Accept / Flee / Repress.
 * Dreams: Bright costs a Repress, a Psyche, or a Forgotten Landscape, and a gate.
 * Dim is free.
 */

import { addLog, drawPsycheForPlayer, setEncounterOnLandscape, landscapeById, tileHasEncounters } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { totalStat } from "../core/rules.js";
import { isWildPsyche } from "./psyche.js";
import { hasAffectedLandscapes, eventLandscapeNames } from "../board/event-landscapes.js";
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

const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

function psycheOfSuit(player, suit) {
  return (player.hand || []).filter(
    (c) => c.type !== "psyche-power" && c.type !== "object" && (c.suit === suit || isWildPsyche(c)),
  );
}

/** Cards still owed after Dreamer base stat covers part of the cost. */
export function eventGoodCardsNeeded(state, player, resolution) {
  if (!resolution) return 0;
  const stat = totalStat(player, resolution.suit, state);
  return Math.max(0, (resolution.cost || 0) - stat);
}

export function canPayEventGood(state, player, resolution) {
  if (!resolution) return false;
  const need = eventGoodCardsNeeded(state, player, resolution);
  if (need <= 0) return true;
  return psycheOfSuit(player, resolution.suit).length >= need;
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
  return { ok: false, reason: "Bright has no condition." };
}

function dreamTollAffordable(state, player, toll) {
  if (!toll?.kind || !(toll.count > 0)) {
    return { ok: false, reason: "Bright has no cost." };
  }
  const hand = player?.hand?.length || 0;
  if (toll.kind === "psyche") {
    if (hand >= toll.count) return { ok: true, reason: "" };
    return { ok: false, reason: `Bright costs ${toll.count} Psyche, and the hand is short.` };
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
    applyResolutionEffect(state, player, { effect: "discardPsyche", params: { count: toll.count } }, helpers, "good");
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

export function payEventGoodCost(state, player, resolution) {
  const need = eventGoodCardsNeeded(state, player, resolution);
  if (need <= 0) {
    const stat = totalStat(player, resolution.suit, state);
    addLog(
      state,
      `${player.name} covers the ${resolution.cost} ${SUIT_LABELS[resolution.suit]} cost with base ${SUIT_LABELS[resolution.suit]} (${stat}).`,
    );
    return true;
  }
  if (psycheOfSuit(player, resolution.suit).length < need) return "short";
  const stat = totalStat(player, resolution.suit, state);
  const suitName = SUIT_LABELS[resolution.suit] || resolution.suit;
  enqueueDiscardFromHand(state, player, need, {
    reason: `${player.name}: choose ${need} ${suitName} Psyche to pay the Bright cost`
      + (stat ? ` (${stat} already covered by base ${suitName})` : "")
      + ".",
    strict: true,
    cardFilter: { suit: resolution.suit, payablePsyche: true },
  });
  return "queued";
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

/**
 * Intercept Mindstream draws (and Dreams) into a fullscreen choice.
 * Returns true when a choice was opened (caller should not auto-discard yet).
 */
export function beginMindstreamCardChoice(state, card, player, helpers = {}) {
  if (!card || !player) return false;

  if (card.type === "event") {
    const resolution = getEventResolution(card.refId || card.id);
    if (!resolution) return false;
    const landscapesOk = hasAffectedLandscapes(state, card)
      || !(card.landscapes?.length);
    const canGood = landscapesOk && canPayEventGood(state, player, resolution);
    const landscapeHint = eventLandscapeNames(state, card).join(", ") || "any revealed Landscape";
    const cardsNeeded = eventGoodCardsNeeded(state, player, resolution);
    const costHint = cardsNeeded <= 0
      ? `Free — base ${SUIT_LABELS[resolution.suit]} covers ${resolution.cost}`
      : `Spend ${cardsNeeded} ${SUIT_LABELS[resolution.suit]} (${resolution.cost} total; base covers ${resolution.cost - cardsNeeded})`;

    state.pendingMindstreamChoice = {
      kind: "event",
      ui: "mindstream-fullscreen",
      cardId: card.id,
      playerId: player.id,
      card,
      title: card.name,
      message: resolutionRulesText(resolution) || card.text || "",
      suit: resolution.suit,
      cost: resolution.cost,
      landscapeHint,
      choices: [
        {
          id: "good",
          role: "good",
          shape: resolution.suit,
          label: resolution.good.label,
          hint: `${resolution.good.hint} · ${costHint}`,
          disabled: !canGood,
          disabledReason: !landscapesOk
            ? `Needs a revealed Landscape: ${landscapeHint}`
            : `Need ${cardsNeeded} ${SUIT_LABELS[resolution.suit]} Psyche (or higher base ${SUIT_LABELS[resolution.suit]})`,
        },
        {
          id: "bad",
          role: "bad",
          shape: resolution.suit,
          label: resolution.bad.label,
          hint: `${resolution.bad.hint} · Free`,
          disabled: false,
        },
      ],
      helpers,
    };
    state.pendingMindstreamChoice.needsDrawCinematic = true;
    logMoment(state, `${card.name} — choose Good or Bad.`);
    return true;
  }

  if (card.type === "object") {
    if (card.subtype === "must-play") {
      onObjectDrawn(state, player, card, helpers);
      return false;
    }
    state.pendingMindstreamChoice = {
      kind: "object",
      ui: "mindstream-fullscreen",
      cardId: card.id,
      playerId: player.id,
      card,
      title: card.name,
      message: card.text || "An Object drifts into reach.",
      suit: card.mindstreamSuit || card.suit || "lucidity",
      choices: [
        {
          id: "take",
          role: "good",
          shape: card.mindstreamSuit || card.suit || "lucidity",
          label: "Take the Object",
          hint: "Add it to your Objects",
          disabled: false,
        },
        {
          id: "discard-draw",
          role: "bad",
          shape: card.mindstreamSuit || card.suit || "lucidity",
          label: "Discard & Draw 3 Psyche",
          hint: "Leave the Object; draw 3 Psyche instead",
          disabled: false,
        },
      ],
      helpers,
    };
    state.pendingMindstreamChoice.needsDrawCinematic = true;
    logMoment(state, `${card.name} — Take it, or discard for Psyche.`);
    return true;
  }

  if (card.type === "dreambeast" && card.accept) {
    const enc = encounterFromDreambeastCard(card);
    enc.instanceId = enc.instanceId || uid("enc");
    enc.drawnFromMindstream = true;
    enc.spawnSeq = (state.encounterSpawnSeq = (state.encounterSpawnSeq || 0) + 1);
    setEncounterOnLandscape(state, player.landscapeId, enc);
    addLog(state, `${card.name} emerges from the Mindstream on ${landscapeById(state, player.landscapeId)?.name || "the Landscape"}!`);

    state.pendingMindstreamChoice = {
      kind: "dreambeast",
      ui: "mindstream-fullscreen",
      cardId: card.id,
      playerId: player.id,
      card,
      encounterInstanceId: enc.instanceId,
      landscapeId: player.landscapeId,
      title: card.name,
      message: card.accept || card.text || "A Dreambeast blocks your path.",
      suit: card.mindstreamSuit || card.suit || "elasticity",
      choices: [
        {
          id: "accept",
          role: "good",
          shape: "willpower",
          label: "Accept the Dreambeast",
          hint: "Open your hand — pick Psyche, then Accept to fight for an ally",
          disabled: false,
        },
        {
          id: "flee",
          role: "flee",
          shape: "spiral",
          label: "Flee",
          hint: `Roll ${1 + totalStat(player, "elasticity", state)}d6 — need one 5+`,
          disabled: false,
        },
        {
          id: "repress",
          role: "bad",
          shape: "lucidity",
          label: "Repress the Dreambeast",
          hint: "Open your hand — pick Psyche, then Repress to fight",
          disabled: false,
        },
      ],
      helpers,
    };
    state.pendingMindstreamChoice.needsDrawCinematic = true;
    logMoment(state, `${card.name} — Accept, Flee, or Repress.`);
    return true;
  }

  if (card.type === "power-token") {
    const dreamers = Math.max(1, state.players?.length || 1);
    state.pendingMindstreamChoice = {
      kind: "power-token",
      ui: "mindstream-fullscreen",
      cardId: card.id,
      playerId: player.id,
      card,
      title: card.name || "Power Token",
      message: "Take 1 Power Token, or pull one buried card back for each Dreamer.",
      suit: card.mindstreamSuit || card.suit || "willpower",
      choices: [
        {
          id: "take",
          role: "good",
          shape: card.mindstreamSuit || "willpower",
          label: "Take 1 Power Token",
          hint: "Gain 1 Power Token",
          disabled: false,
        },
        {
          id: "return",
          role: "bad",
          shape: card.mindstreamSuit || "willpower",
          label: `Return ${dreamers} Card${dreamers === 1 ? "" : "s"}`,
          hint: `Return ${dreamers} from the Subconscious — one for each Dreamer`,
          disabled: false,
        },
      ],
      helpers,
    };
    state.pendingMindstreamChoice.needsDrawCinematic = true;
    return true;
  }

  if (card.type === "draw-dream") {
    finishMindstreamCard(state, card);
    if (helpers?.drawAdditionalDream) {
      helpers.drawAdditionalDream(state);
    }
    return true;
  }

  return false;
}

export function beginDreamCardChoice(state, card, player, helpers = {}) {
  if (!card || card.type === "boss-dream" || card.boss) return false;
  if (card.id === "you-never-wake" || card.id === "final-recurrence") return false;
  if (["delta", "theta", "alpha", "beta"].includes(card.id)) return false;

  const resolution = getDreamResolution(card.refId || card.id);
  if (!resolution) return false;
  const bright = assessDreamGood(state, player, resolution);

  state.pendingMindstreamChoice = {
    kind: "dream",
    ui: "mindstream-fullscreen",
    cardId: card.id,
    dreamId: card.id,
    playerId: player.id,
    card,
    title: card.name,
    message: resolutionRulesText(resolution) || card.text || "The Dream demands a choice.",
    suit: "lucidity",
    choices: [
      {
        id: "good",
        role: "good",
        shape: "lucidity",
        label: resolution.good.label,
        hint: resolution.good.hint,
        disabled: !bright.ok,
        disabledReason: bright.reason,
      },
      {
        id: "bad",
        role: "bad",
        shape: "willpower",
        label: resolution.bad.label,
        hint: `${resolution.bad.hint} · Free`,
        disabled: false,
      },
    ],
    helpers,
  };
  logMoment(state, `${card.name} — choose your path.`);
  return true;
}

function findDrawnEncounter(state, pending) {
  const tile = landscapeById(state, pending.landscapeId);
  const list = tile?.encounters || (tile?.encounter ? [tile.encounter] : []);
  return list.find((e) => e.instanceId === pending.encounterInstanceId) || list[0] || null;
}

function resolveFlee(state, pending, helpers) {
  const player = playerById(state, pending.playerId);
  const encounter = findDrawnEncounter(state, pending);
  if (!player || !encounter) {
    state.pendingMindstreamChoice = null;
    return true;
  }
  const dice = 1 + totalStat(player, "elasticity", state);
  const faces = rollD6(dice);
  const successes = countSuccesses(faces);
  const fled = successes >= 1;

  const finish = (ok) => {
    state.pendingMindstreamChoice = null;
    if (ok) {
      addLog(state, `${player.name} Flees ${encounter.name} (${successes} success on ${dice}d6). It remains, but Fail is avoided.`);
      logMoment(state, `Flee succeeds — ${encounter.name} stays without Fail.`);
    } else {
      addLog(state, `${player.name} fails to Flee ${encounter.name}. Fail resolves.`);
      applyFailEffect(state, player, encounter);
      logMoment(state, `Flee fails — ${encounter.name} exacts its Fail cost.`);
    }
  };

  if (typeof document === "undefined" || helpers?.syncDice || helpers?.bot) {
    finish(fled);
    return true;
  }

  state.diceBattle = { encounterId: encounter.id, tileId: pending.landscapeId, flee: true };
  playDiceBattle({
    dreamerName: player.name,
    beastName: `Flee · ${encounter.name}`,
    dreamerDice: dice,
    beastDice: 1,
    forceWinner: fled ? "dreamer" : "beast",
    onComplete: ({ dreamerWins }) => {
      state.diceBattle = null;
      finish(dreamerWins);
      helpers?.onChoiceResolved?.(state);
    },
  });
  return true;
}

/**
 * Resolve a pending Mindstream/Dream fullscreen choice.
 * @returns {boolean} true if handled
 */
export function resolveMindstreamChoice(state, choiceId, helpers = {}) {
  const pending = state.pendingMindstreamChoice;
  if (!pending) return false;
  const player = playerById(state, pending.playerId);
  const card = pending.card;
  const h = { ...pending.helpers, ...helpers };

  if (pending.kind === "event") {
    const resolution = getEventResolution(card.refId || card.id);
    state.pendingMindstreamChoice = null;
    if (!resolution || !player) {
      finishMindstreamCard(state, card);
      return true;
    }
    if (choiceId === "good") {
      if (!hasAffectedLandscapes(state, card) && card.landscapes?.length) {
        addLog(state, "Good path needs a revealed Landscape.");
        state.pendingMindstreamChoice = pending;
        return false;
      }
      const need = eventGoodCardsNeeded(state, player, resolution);
      if (need > 0 && psycheOfSuit(player, resolution.suit).length < need) {
        addLog(state, "Not enough Psyche for the Good path.");
        state.pendingMindstreamChoice = pending;
        return false;
      }
      if (need > 0) {
        const prevIdle = state.onResolutionIdle;
        state.onResolutionIdle = (s) => {
          applyResolutionEffect(s, player, resolution.good, h, "good");
          stampResolutionChoice(card, "good", pending);
          logMoment(s, `${card.name}: ${resolution.good.label}.`);
          finishMindstreamCard(s, card);
          if (typeof prevIdle === "function") prevIdle(s);
          h.onChoiceResolved?.(s);
        };
        payEventGoodCost(state, player, resolution);
        return true;
      }
      payEventGoodCost(state, player, resolution);
      applyResolutionEffect(state, player, resolution.good, h, "good");
      stampResolutionChoice(card, "good", pending);
      logMoment(state, `${card.name}: ${resolution.good.label}.`);
    } else {
      applyResolutionEffect(state, player, resolution.bad, h, "bad");
      stampResolutionChoice(card, "bad", pending);
      logMoment(state, `${card.name}: ${resolution.bad.label}.`);
    }
    finishMindstreamCard(state, card);
    return true;
  }

  if (pending.kind === "object") {
    state.pendingMindstreamChoice = null;
    if (choiceId === "take") {
      stampResolutionChoice(card, "take", pending);
      onObjectDrawn(state, player, card, h);
    } else {
      stampResolutionChoice(card, "discard", pending);
      discardToMindstream(state, card);
      const drawn = drawPsycheForPlayer(state, player, 3);
      addLog(state, `${player.name} discards ${card.name} and draws ${drawn.length} Psyche.`);
    }
    return true;
  }

  if (pending.kind === "dreambeast") {
    if (choiceId === "flee") {
      return resolveFlee(state, pending, h);
    }
    state.pendingMindstreamChoice = null;
    const encounter = findDrawnEncounter(state, pending);
    if (encounter) {
      state.activeEncounter = encounter;
      state.activeEncounterLandscapeId = pending.landscapeId;
      state.selectedLandscapeId = pending.landscapeId;
    }
    const mode = choiceId === "repress" ? "reject" : "accept";
    const instant = !!(h.bot || h.syncDice || h.instant);
    if (h.prepareMindstreamMeet) {
      h.prepareMindstreamMeet(state, {
        mode,
        landscapeId: pending.landscapeId,
        playerId: pending.playerId || player?.id,
        instant,
        meetEncounterFn: h.meetEncounter,
        onDone: () => h.onChoiceResolved?.(state),
      });
    } else if (h.meetEncounter) {
      // Fallback for older helpers — still try to meet immediately.
      h.meetEncounter(state, mode, {
        freeMeet: true,
        fromMindstreamDraw: true,
        instant,
        onDone: () => h.onChoiceResolved?.(state),
      });
    } else {
      addLog(state, `Meet ${card.name} now (${choiceId}).`);
    }
    return true;
  }

  if (pending.kind === "power-token") {
    state.pendingMindstreamChoice = null;
    stampResolutionChoice(card, choiceId, pending);
    if (choiceId === "take") {
      grantPowerTokens(state, player, 1, {
        reason: `${player.name} takes 1 Power Token.`,
        logQuest: false,
      });
    } else {
      const dreamers = Math.max(1, state.players?.length || 1);
      const result = requestReturnCards(state, dreamers, player);
      if (result?.pending) {
        addLog(state, `${player.name} forgoes the Power Token to Return ${dreamers} from the Subconscious.`);
      } else if (Array.isArray(result) && result.length) {
        addLog(state, `${player.name} forgoes the Power Token and Returns ${result.length} from the Subconscious.`);
      } else {
        addLog(state, `${player.name} forgoes the Power Token — nothing left to Return.`);
      }
    }
    finishMindstreamCard(state, card);
    return true;
  }

  if (pending.kind === "dream") {
    const resolution = getDreamResolution(card.refId || card.id);
    if (!resolution || !player) {
      state.pendingMindstreamChoice = null;
      return true;
    }
    const sideId = choiceId === "good" ? "good" : "bad";
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
