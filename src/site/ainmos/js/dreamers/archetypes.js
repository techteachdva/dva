import { teamAcquiredArchetypes } from "./archetype-stats.js";
import { DREAM_FORMS, formLevel, levelUpForm } from "../cards/dream-forms.js";
import {
  addLog,
  allEncountersOnBoard,
  drawPsycheForPlayer,
  encounterKey,
  tileEncounters,
  landscapeById,
  removeEncounterFromLandscape,
} from "../core/state.js";
import { handRoomForPsycheDraw, onObjectDrawn } from "../effects/objects.js";
import { recordQuestEvent } from "./quests.js";
import { beginRemember } from "../effects/remember.js";
import { enqueueReturnCards, listSubconsciousCards, requestReturnCards } from "./subconscious.js";
import { spendPowerTokens, grantPowerTokens } from "../cards/power-tokens.js";
import { isQuintessentialArchetype } from "./archetype-stats.js";
import { requestChooseTile, revealCapacity, beginFreeRevealPicking } from "../board/landscapes.js";
import { logMoment } from "../core/narrator.js";
import { repressCard } from "./subconscious.js";
import { offerEffectChoice, registerEffectResolver } from "../effects/effect-choices.js";
import { dreamerPrimarySuit } from "../encounters/dreambeasts.js";
import { SUIT_LABELS } from "../core/rules.js";

let lastArchetypeHelpers = null;

function rememberArchetypeHelpers(helpers) {
  if (helpers) lastArchetypeHelpers = helpers;
  return lastArchetypeHelpers;
}

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function psycheInHand(player) {
  return (player.hand || []).filter((c) => c.type !== "psyche-dreambeast" && !c.isDreambeastPsyche).length;
}

function suitDestinations(state, suit, exceptId) {
  return (state.board || [])
    .filter((tile) => tile.suit === suit && tile.id !== exceptId && !tile.center)
    .map((tile) => tile.id);
}

function refundArchetypeToken(state, player, reason) {
  grantPowerTokens(state, player, 1, { reason, logQuest: false, animate: false });
}

function returnProduced(result) {
  if (Array.isArray(result)) return result.length > 0;
  return !!(result && (result.pending || result.queued));
}

function discardedObjects(state) {
  const piles = state.objectDiscard || {};
  return ["lucidity", "elasticity", "willpower"].flatMap((suit) => piles[suit] || []);
}

function takeDiscardedObject(state, card) {
  const suit = card?.suit || card?.mindstreamSuit;
  const pile = state.objectDiscard?.[suit];
  if (!pile) return null;
  const idx = pile.findIndex((entry) => entry === card || entry.instanceId === card.instanceId);
  if (idx < 0) return null;
  return pile.splice(idx, 1)[0];
}

function beginOutlawPower(state, player, helpers) {
  const cards = discardedObjects(state);
  if (!cards.length) {
    refundArchetypeToken(state, player, "Outlaw Power: the Object discard is empty. Token refunded.");
    return;
  }
  if (cards.length === 1) {
    const card = takeDiscardedObject(state, cards[0]);
    if (card) onObjectDrawn(state, player, card, helpers);
    return;
  }
  rememberArchetypeHelpers(helpers);
  offerEffectChoice(state, player, {
    cardId: "outlaw-power",
    ui: "cards",
    title: "Outlaw Power",
    message: `${player.name}: draw 1 Object from the discard.`,
    cards,
  });
}

registerEffectResolver("outlaw-power", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const card = discardedObjects(state).find((entry) => (entry.instanceId || entry.id) === choiceId);
  state.pendingEffectChoice = null;
  const taken = card ? takeDiscardedObject(state, card) : null;
  if (player && taken) onObjectDrawn(state, player, taken, rememberArchetypeHelpers());
  return true;
});

function explorerPieces(state) {
  const pieces = [];
  alivePlayers(state).forEach((dreamer) => {
    const suit = dreamerPrimarySuit(dreamer.dreamer || {});
    const dests = suitDestinations(state, suit, dreamer.landscapeId);
    if (!dests.length) return;
    pieces.push({
      id: `dreamer:${dreamer.id}`,
      label: `Move ${dreamer.name}`,
      hint: `Any ${SUIT_LABELS[suit] || suit} Landscape.`,
      kind: "dreamer",
      playerId: dreamer.id,
      dests,
    });
  });
  allEncountersOnBoard(state).forEach(({ tile, encounter }) => {
    const suit = encounter.suit;
    if (!suit) return;
    const dests = suitDestinations(state, suit, tile.id);
    if (!dests.length) return;
    const key = encounterKey(encounter);
    pieces.push({
      id: `beast:${tile.id}:${key}`,
      label: `Move ${encounter.name}`,
      hint: `Any ${SUIT_LABELS[suit] || suit} Landscape.`,
      kind: "beast",
      fromTileId: tile.id,
      encounterKey: key,
      encounter,
      dests,
    });
  });
  return pieces;
}

function beginExplorerPower(state, player) {
  const pieces = explorerPieces(state);
  if (!pieces.length) {
    refundArchetypeToken(state, player, "Explorer Power: nothing can move onto a Landscape of its suit. Token refunded.");
    return;
  }
  if (pieces.length === 1) {
    moveExplorerPiece(state, pieces[0]);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "explorer-power",
    title: "Explorer Power",
    message: "Move 1 Dreamer or 1 Dreambeast onto a Landscape of its suit.",
    choices: pieces.map((piece) => ({ id: piece.id, label: piece.label, hint: piece.hint })),
    payload: { pieces },
  });
}

function moveExplorerPiece(state, piece) {
  if (!piece) return;
  if (piece.kind === "dreamer") {
    requestChooseTile(state, {
      allowedIds: piece.dests,
      action: "movePlayer",
      playerId: piece.playerId,
      title: "Explorer Power",
      detail: piece.hint || "Choose a Landscape of that suit.",
    });
    return;
  }
  const found = allEncountersOnBoard(state).find(({ tile, encounter }) =>
    tile.id === piece.fromTileId && encounterKey(encounter) === piece.encounterKey);
  if (!found) return;
  requestChooseTile(state, {
    allowedIds: piece.dests,
    action: "moveEncounter",
    fromTileId: found.tile.id,
    encounter: found.encounter,
    title: "Explorer Power",
    detail: `Move ${found.encounter.name} onto a Landscape of its suit.`,
  });
}

registerEffectResolver("explorer-power", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const piece = (pending?.payload?.pieces || []).find((entry) => entry.id === choiceId);
  state.pendingEffectChoice = null;
  moveExplorerPiece(state, piece);
  return true;
});

function returnOneEach(state, filter, noun) {
  const available = listSubconsciousCards(state).filter((card) => (
    filter === "dreambeast"
      ? card.type === "dreambeast" || card.type === "boss" || card.type === "psyche-dreambeast" || card.isDreambeastPsyche || card.boss
      : card.type === filter
  ));
  if (!available.length) return false;
  alivePlayers(state).forEach((dreamer) => {
    enqueueReturnCards(state, 1, dreamer, {
      filter,
      reason: `${dreamer.name}: Return 1 ${noun} from the Subconscious.`,
    });
  });
  return true;
}

export function continueArchetypeQueues() {}

export function resumeArchetypeFollowup() {
  return false;
}

/** Quintessential passives log on acquire; activatable powers cost 1 Power Token. */
export function resolveOnAcquire(state, archetype, player) {
  if (!archetype) return;
  // Ainmos: the Acquire itself (count, tokens, Boon) is granted in state.js.
  addLog(state, `${archetype.name}'s ${archetype.passive ? "passive" : "power"} is yours.`);
}

export function useArchetypePower(state, archetype, player, helpers = {}) {
  if (!archetype?.power) return false;
  if (player.powerTokens < 1) {
    addLog(state, "Archetype Power costs 1 Power Token.");
    return false;
  }

  const held = teamAcquiredArchetypes(state).some((a) => a.id === archetype.id);
  if (!held) {
    addLog(state, "The table does not hold that Boon.");
    return false;
  }
  if (archetype.id === "study" && state.studyUsedRound === state.round) {
    addLog(state, "Study is once per round.");
    return false;
  }

  spendPowerTokens(state, player, 1);
  addLog(state, `${player.name} activates ${archetype.name}: ${archetype.power}`);

  switch (archetype.id) {
    case "innocent":
      if (!beginRemember(state, player, 3, { source: "Innocent" })) {
        refundArchetypeToken(state, player, "Innocent Power: the Subconscious is empty. Token refunded.");
      }
      break;

    case "caregiver": {
      const living = alivePlayers(state);
      if (!living.length) break;
      const thinnest = living.reduce((best, dreamer) => (
        psycheInHand(dreamer) < psycheInHand(best) ? dreamer : best
      ), living[0]);
      const need = handRoomForPsycheDraw(state, thinnest);
      // Ainmos: the Caregiver Boon draws 3.
      const drawCount = Math.min(3, need);
      if (!drawCount) {
        refundArchetypeToken(state, player, `${thinnest.name} is already at the hand limit. Token refunded.`);
        break;
      }
      const drawn = drawPsycheForPlayer(state, thinnest, drawCount);
      recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      addLog(state, `${thinnest.name} has the fewest Psyche and draws ${drawn.length}.`);
      break;
    }

    case "lover": {
      const drawn = helpers.drawObjects ? helpers.drawObjects(state, player, 1, helpers) : [];
      if (!drawn.length) refundArchetypeToken(state, player, "Lover: the Object deck is empty. Token refunded.");
      else logMoment(state, `Lover: ${player.name} draws ${drawn[0].name}.`);
      break;
    }

    case "orphan":
      state.nextFightDice = (state.nextFightDice || 0) + 3;
      logMoment(state, "Orphan: your next fight rolls +3 dice.");
      break;

    case "explorer": {
      const beasts = allEncountersOnBoard(state);
      const elsewhere = (state.board || []).some((t) => t.revealed && !t.wasteland && t.id !== player.landscapeId);
      if (!elsewhere) {
        refundArchetypeToken(state, player, "Explorer: there is nowhere else to go yet. Token refunded.");
        break;
      }
      offerEffectChoice(state, player, {
        cardId: "explorer-boon",
        title: "Explorer",
        message: "Move whom?",
        choices: [
          { id: "self", label: `${player.name} (you)` },
          ...beasts.map(({ tile, encounter }) => ({ id: `${tile.id}:${encounterKey(encounter)}`, label: `${encounter.name} on ${tile.name}` })),
        ],
      });
      break;
    }

    case "fool":
      if (revealCapacity(state) < 1) {
        refundArchetypeToken(state, player, "Fool: there is nothing left to place. Token refunded.");
      } else {
        beginFreeRevealPicking(state, Math.min(2, revealCapacity(state)));
        logMoment(state, "Fool: place 2 Landscapes from the Vault, free.");
      }
      break;

    case "outlaw": {
      const enc = tileEncounters(landscapeById(state, player.landscapeId)).find((e) => !e.boss);
      if (!enc) {
        refundArchetypeToken(state, player, "Outlaw: no ordinary Dreambeast on your Landscape. Token refunded.");
        break;
      }
      removeEncounterFromLandscape(state, player.landscapeId, enc);
      repressCard(state, { ...enc, type: "dreambeast" });
      logMoment(state, `Outlaw: ${enc.name} is banished without a fight.`);
      break;
    }

    case "ruler":
      state.freeInsights = (state.freeInsights || 0) + 1;
      logMoment(state, "Ruler: a free Insight waits at the next Lost & Found.");
      break;

    case "study":
      state.studyUsedRound = state.round;
      offerEffectChoice(state, player, {
        cardId: "study-boon",
        title: "Study",
        message: "Raise 1 Dream Form a level.",
        choices: DREAM_FORMS.map((form) => ({
          id: form.id,
          label: `${form.name} (level ${formLevel(state, form.id)} → ${formLevel(state, form.id) + 1})`,
        })),
      });
      break;

    case "creator":
      if (!returnOneEach(state, "dreambeast", "Dreambeast")) {
        refundArchetypeToken(state, player, "Creator Power: no Dreambeast in the Subconscious. Token refunded.");
      }
      break;

    default:
      break;
  }
  return true;
}

export function handleArchetypePowerTilePick() {
  return false;
}

// Explorer: pick whom to move, then where.
registerEffectResolver("explorer-boon", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId) || alivePlayers(state)[0];
  state.pendingEffectChoice = null;
  if (!player) return true;
  if (choiceId === "self") {
    const allowed = (state.board || []).filter((t) => t.revealed && !t.wasteland && t.id !== player.landscapeId).map((t) => t.id);
    requestChooseTile(state, { allowedIds: allowed, action: "movePlayer", playerId: player.id, title: "Explorer", detail: "Choose where to go." });
    return true;
  }
  const [tileId, encKey] = String(choiceId).split(":");
  const enc = tileEncounters(landscapeById(state, tileId)).find((e) => encounterKey(e) === encKey);
  if (!enc) return true;
  const allowed = (state.board || []).filter((t) => t.revealed && !t.wasteland && t.id !== tileId).map((t) => t.id);
  requestChooseTile(state, { allowedIds: allowed, action: "moveEncounter", fromTileId: tileId, encounter: enc, title: "Explorer", detail: `Choose where ${enc.name} goes.` });
  return true;
});

registerEffectResolver("study-boon", (state, choiceId) => {
  state.pendingEffectChoice = null;
  if (!DREAM_FORMS.some((form) => form.id === choiceId)) return true;
  const level = levelUpForm(state, choiceId);
  addLog(state, `Study: ${DREAM_FORMS.find((form) => form.id === choiceId).name} rises to level ${level}.`);
  return true;
});
