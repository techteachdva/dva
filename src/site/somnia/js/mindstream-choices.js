/**
 * Somnia 36.0 — fullscreen Mindstream / Dream draw choices.
 * Events: Good (paid, landscape-gated) vs Bad (free).
 * Objects: Take vs Discard + Draw 3 Psyche.
 * Dreambeasts: Accept / Flee / Repress.
 * Dreams: Strive vs Suffer.
 */

import { addLog, drawPsycheForPlayer, setEncounterOnLandscape, landscapeById } from "./state.js";
import { logMoment } from "./narrator.js";
import { totalStat } from "./rules.js";
import { isWildPsyche } from "./psyche.js";
import { hasAffectedLandscapes, eventLandscapeNames } from "./event-landscapes.js";
import { getEventResolution } from "./event-resolutions.js";
import { getDreamResolution } from "./dream-resolutions.js";
import { applyResolutionEffect, discardMindstreamCard } from "./resolution-effects.js";
import { onObjectDrawn } from "./objects.js";
import { discardToMindstream, encounterFromDreambeastCard } from "./mindstream-supply.js";
import { repressCard, requestReturnCards } from "./subconscious.js";
import { applyFailEffect } from "./dreambeasts.js";
import { playDiceBattle, rollD6, countSuccesses } from "./dice-battle.js";
import { recordQuestEvent } from "./quests.js";
import { grantPowerTokens } from "./power-tokens.js";
import { uid } from "./data.js";

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
  const pool = psycheOfSuit(player, resolution.suit)
    .slice()
    .sort((a, b) => (a.value || 0) - (b.value || 0));
  if (pool.length < need) return false;
  const spent = pool.slice(0, need);
  spent.forEach((card) => {
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    state.psycheDiscard.push(card);
  });
  recordQuestEvent(state, "discard_psyche", { count: spent.length, landscapeId: player.landscapeId });
  const stat = totalStat(player, resolution.suit, state);
  addLog(
    state,
    `${player.name} pays ${need} ${SUIT_LABELS[resolution.suit]} Psyche`
      + (stat ? ` (${stat} covered by base ${SUIT_LABELS[resolution.suit]})` : "")
      + ` for the Good path.`,
  );
  return true;
}

function finishMindstreamCard(state, card) {
  if (!card) return;
  if (card.type === "object" || card.type === "dreambeast") return;
  discardMindstreamCard(state, card);
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
      message: card.text || "",
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
          hint: "Meet now — win to take it as an ally",
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
          hint: "Meet now — win to Repress it",
          disabled: false,
        },
      ],
      helpers,
    };
    logMoment(state, `${card.name} — Accept, Flee, or Repress.`);
    return true;
  }

  if (card.type === "power-token") {
    const tokens = card.powerTokens || 2;
    state.pendingMindstreamChoice = {
      kind: "power-token",
      ui: "mindstream-fullscreen",
      cardId: card.id,
      playerId: player.id,
      card,
      title: card.name || "Power Tokens",
      message: "Claim the tokens, or pull what was buried back into discard.",
      suit: card.mindstreamSuit || card.suit || "willpower",
      choices: [
        {
          id: "take",
          role: "good",
          shape: card.mindstreamSuit || "willpower",
          label: "Take the Power Token",
          hint: `Gain ${tokens} Power Token${tokens === 1 ? "" : "s"}`,
          disabled: false,
        },
        {
          id: "return",
          role: "bad",
          shape: card.mindstreamSuit || "willpower",
          label: "Return 2 Repressed Cards",
          hint: "Return 2 cards from the Subconscious to discard",
          disabled: false,
        },
      ],
      helpers,
    };
    return true;
  }

  if (card.type === "draw-dream") {
    // Draw-dream: immediately open the next Dream as a choice (fixes missing Dream UI).
    finishMindstreamCard(state, card);
    if (helpers?.drawAdditionalDream) {
      helpers.drawAdditionalDream(state, helpers.onShowDreamModal || null);
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

  state.pendingMindstreamChoice = {
    kind: "dream",
    ui: "mindstream-fullscreen",
    cardId: card.id,
    dreamId: card.id,
    playerId: player.id,
    card,
    title: card.name,
    message: card.text || "The Dream demands a choice.",
    suit: "lucidity",
    choices: [
      {
        id: "good",
        role: "good",
        shape: "lucidity",
        label: resolution.good.label,
        hint: resolution.good.hint,
        disabled: false,
      },
      {
        id: "bad",
        role: "bad",
        shape: "willpower",
        label: resolution.bad.label,
        hint: resolution.bad.hint,
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

  if (typeof document === "undefined") {
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
      if (!payEventGoodCost(state, player, resolution)) {
        addLog(state, "Not enough Psyche for the Good path.");
        state.pendingMindstreamChoice = pending;
        return false;
      }
      applyResolutionEffect(state, player, resolution.good, h, "good");
      logMoment(state, `${card.name}: ${resolution.good.label}.`);
    } else {
      applyResolutionEffect(state, player, resolution.bad, h, "bad");
      logMoment(state, `${card.name}: ${resolution.bad.label}.`);
    }
    finishMindstreamCard(state, card);
    return true;
  }

  if (pending.kind === "object") {
    state.pendingMindstreamChoice = null;
    if (choiceId === "take") {
      onObjectDrawn(state, player, card, h);
    } else {
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
    if (h.meetEncounter) {
      h.meetEncounter(state, choiceId === "repress" ? "reject" : "accept", {
        freeMeet: true,
        fromMindstreamDraw: true,
        onDone: () => h.onChoiceResolved?.(state),
      });
    } else {
      addLog(state, `Meet ${card.name} now (${choiceId}).`);
    }
    return true;
  }

  if (pending.kind === "power-token") {
    state.pendingMindstreamChoice = null;
    if (choiceId === "take") {
      const n = card.powerTokens || 2;
      grantPowerTokens(state, player, n, {
        reason: `${player.name} takes ${n} Power Token${n === 1 ? "" : "s"}.`,
        logQuest: false,
      });
    } else {
      const result = requestReturnCards(state, 2, player);
      if (result?.pending) {
        addLog(state, `${player.name} forgoes Power Tokens to Return 2 from the Subconscious.`);
      } else if (Array.isArray(result) && result.length) {
        addLog(state, `${player.name} forgoes Power Tokens and Returns ${result.length} from the Subconscious.`);
      } else {
        addLog(state, `${player.name} forgoes Power Tokens — nothing left to Return.`);
      }
    }
    finishMindstreamCard(state, card);
    return true;
  }

  if (pending.kind === "dream") {
    const resolution = getDreamResolution(card.refId || card.id);
    state.pendingMindstreamChoice = null;
    if (!resolution || !player) return true;
    const side = choiceId === "good" ? resolution.good : resolution.bad;
    applyResolutionEffect(state, player, side, h, choiceId);
    logMoment(state, `${card.name}: ${side.label}.`);
    return true;
  }

  state.pendingMindstreamChoice = null;
  return false;
}
