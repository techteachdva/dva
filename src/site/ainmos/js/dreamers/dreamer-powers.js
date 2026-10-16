/**
 * Ainmos 0.26.1: Dreamer Powers.
 *
 * A Dreamer is its three stats plus one Power. No passives. Each Power costs
 * 1 Power Token and works in the phase of the Dreamer's best stat:
 *
 *   Reveal (Lucidity)
 *     The Visionary  Second Sight  place 2 Landscapes from the Vault, free
 *     The Rested     Lucid Rest    this Reveal, each Landscape you place draws you 1 Psyche (up to 3)
 *   Explore (Elasticity)
 *     The Runner     Dash          +3 steps this Explore
 *     The Hunter     Lure          every Dreambeast moves up to 2 Landscapes toward you, or away from you
 *   Meet (Willpower)
 *     The Immovable  Hold the Line every fight this Meet rolls 2 more dice
 *     The Weaver     Reweave       discard up to 3 Psyche, then draw that many plus 1
 */

import {
  addLog,
  landscapeById,
  moveEncounterBetweenLandscapes,
  encounterOnLandscape,
  allEncountersOnBoard,
  drawPsycheForPlayer,
  getPhase,
  lucidRestKey,
} from "../core/state.js";
import { adjacentTiles, hexDistance } from "../core/hex.js";
import { revealCapacity, revealOrPlaceLandscapes } from "../board/landscapes.js";
import { isDreambeastPsycheCard } from "./subconscious.js";

/** Each Dreamer's Power works in this phase. */
export const DREAMER_POWER_PHASE = Object.freeze({
  "the-visionary": "Reveal",
  "the-rested": "Reveal",
  "the-runner": "Explore",
  "the-hunter": "Explore",
  "the-immovable": "Meet",
  "the-weaver": "Meet",
});

/** Lucid Rest draws at most this many. */
const LUCID_REST_DRAWS = 3;
const SECOND_SIGHT_PLACES = 2;
const DASH_STEPS = 3;
const LURE_STEPS = 2;
const HOLD_THE_LINE_DICE = 2;
const REWEAVE_MAX = 3;

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function powerActor(state) {
  const pending = state.pendingDreamerPower;
  return state.players.find((p) => p.id === pending?.actorId) || alivePlayers(state)[0] || null;
}

function cyclablePsycheCards(player) {
  return (player?.hand || []).filter(
    (c) => (c.type === "psyche" || c.type === "psyche-power") && !isDreambeastPsycheCard(c),
  );
}

function moveEncounterOneStep(state, tile, encounter, { toward = null, awayFrom = null } = {}) {
  const enc = encounter || encounterOnLandscape(state, tile?.id);
  if (!tile || !enc) return null;
  const adj = adjacentTiles(state, tile.id).filter((t) => t.revealed && !t.wasteland);
  if (!adj.length) return null;
  let dest = null;
  if (toward) {
    dest = adj
      .filter((t) => hexDistance(t, toward) < hexDistance(tile, toward))
      .sort((a, b) => hexDistance(a, toward) - hexDistance(b, toward))[0];
  } else if (awayFrom) {
    dest = adj
      .filter((t) => hexDistance(t, awayFrom) > hexDistance(tile, awayFrom))
      .sort((a, b) => hexDistance(b, awayFrom) - hexDistance(a, awayFrom))[0];
  }
  if (!dest) return null;
  moveEncounterBetweenLandscapes(state, tile.id, dest.id, enc);
  return dest;
}

function clearDreamerPower(state) {
  state.pendingDreamerPower = null;
}

export function cancelDreamerPower(state) {
  clearDreamerPower(state);
}

export function hasPendingDreamerPower(state) {
  return !!state.pendingDreamerPower;
}

export function getDreamerPowerUI(state) {
  return state.pendingDreamerPower?.ui || null;
}

function setChoiceUI(state, title, message, choices) {
  state.pendingDreamerPower.ui = { type: "choice", title, message, choices };
  return { ui: state.pendingDreamerPower.ui };
}

/** Why this Dreamer's Power can't be used right now, or "" when it can. */
export function dreamerPowerBlockReason(state, player) {
  const id = player?.dreamer?.id;
  const phase = DREAMER_POWER_PHASE[id];
  if (!phase) return "This Dreamer has no Power.";
  if (getPhase(state) !== phase) return `${player.dreamer.name}'s Power works in ${phase}.`;
  switch (id) {
    case "the-visionary":
      return revealCapacity(state) ? "" : "Nothing is left in the Vault to place.";
    case "the-rested":
      return state.lucidRest?.key === lucidRestKey(state) ? "Lucid Rest is already working this Reveal." : "";
    case "the-runner":
      return state.exploreActivated ? "" : "Open Explore first (take your free steps), then Dash.";
    case "the-hunter":
      return allEncountersOnBoard(state).length ? "" : "No Dreambeast stands on the Dreamscape.";
    case "the-immovable":
      return "";
    case "the-weaver":
      return cyclablePsycheCards(player).length ? "" : "No Psyche in hand to reweave.";
    default:
      return "";
  }
}

export function canActivateDreamerPower(state, player) {
  return !dreamerPowerBlockReason(state, player);
}

// ---- The Rested: Lucid Rest is armed here; state.js draws as Landscapes are placed. ----

// ---- Begin ------------------------------------------------------------------------

export function beginDreamerPower(state) {
  const pending = state.pendingDreamerPower;
  if (!pending) return null;
  const player = powerActor(state);

  switch (pending.dreamerId) {
    case "the-visionary": {
      clearDreamerPower(state);
      const placed = revealOrPlaceLandscapes(state, SECOND_SIGHT_PLACES, { source: "Second Sight" });
      addLog(state, placed
        ? `Second Sight: place ${placed} Landscape${placed === 1 ? "" : "s"} from the Vault, free.`
        : "Second Sight finds nothing left to place.");
      return { done: true };
    }
    case "the-rested":
      state.lucidRest = { key: lucidRestKey(state), left: LUCID_REST_DRAWS, playerId: player?.id };
      addLog(state, `Lucid Rest: this Reveal, each Landscape you place draws you 1 Psyche (up to ${LUCID_REST_DRAWS}).`);
      clearDreamerPower(state);
      return { done: true };
    case "the-runner":
      state.exploreMovesLeft = (state.exploreMovesLeft || 0) + DASH_STEPS;
      addLog(state, `Dash: +${DASH_STEPS} steps this Explore (${state.exploreMovesLeft} left).`);
      clearDreamerPower(state);
      return { done: true };
    case "the-hunter":
      return setChoiceUI(state, "The Hunter · Lure", `Every Dreambeast moves up to ${LURE_STEPS} Landscapes:`, [
        { id: "lure-toward", label: "Toward you", hint: "Bring them to you for Meet." },
        { id: "lure-away", label: "Away from you", hint: "Push them back." },
      ]);
    case "the-immovable":
      state.anchorMeetSpreadBonus = (state.anchorMeetSpreadBonus || 0) + HOLD_THE_LINE_DICE;
      addLog(state, `Hold the Line: every fight this Meet rolls ${HOLD_THE_LINE_DICE} more dice.`);
      clearDreamerPower(state);
      return { done: true };
    case "the-weaver":
      pending.discarded = 0;
      return offerReweave(state);
    default:
      clearDreamerPower(state);
      return { done: true };
  }
}

// ---- The Weaver: Reweave ------------------------------------------------------------

function offerReweave(state) {
  const pending = state.pendingDreamerPower;
  const player = powerActor(state);
  const cards = cyclablePsycheCards(player);
  if (pending.discarded >= REWEAVE_MAX || !cards.length) return finishReweave(state);
  pending.step = "reweave-pick";
  pending.ui = {
    type: "hand",
    title: `The Weaver · Reweave (${pending.discarded}/${REWEAVE_MAX})`,
    message: `Discard a Psyche. When you stop, draw that many plus 1.`,
    cards,
  };
  return { ui: pending.ui };
}

function finishReweave(state) {
  const pending = state.pendingDreamerPower;
  const player = powerActor(state);
  const n = (pending?.discarded || 0) + 1;
  const drawn = player ? drawPsycheForPlayer(state, player, n) : [];
  addLog(state, `Reweave: ${player?.name || "The Weaver"} discards ${pending?.discarded || 0} and draws ${drawn.length}.`);
  clearDreamerPower(state);
  return { done: true };
}

// ---- Resolve ------------------------------------------------------------------------

export function resolveDreamerPowerChoice(state, choiceId) {
  const pending = state.pendingDreamerPower;
  if (!pending) return { done: true };
  delete pending.ui;

  if (pending.dreamerId === "the-weaver") {
    if (choiceId === "reweave-more") return offerReweave(state);
    return finishReweave(state);
  }

  if (pending.dreamerId === "the-hunter") {
    const player = powerActor(state);
    const here = landscapeById(state, player?.landscapeId);
    let moved = 0;
    allEncountersOnBoard(state).forEach(({ tile, encounter }) => {
      let at = tile;
      for (let i = 0; i < LURE_STEPS && at && here; i += 1) {
        const next = moveEncounterOneStep(state, at, encounter, choiceId === "lure-toward" ? { toward: here } : { awayFrom: here });
        if (!next) break;
        at = next;
        moved += 1;
      }
      if (at && at.id !== tile.id) addLog(state, `Lure: ${encounter.name} moves to ${at.name}.`);
    });
    if (!moved) addLog(state, "Lure: no Dreambeast can move that way.");
    if (state.tutorialFlags) state.tutorialFlags.hunterPowerUsed = true;
    clearDreamerPower(state);
    return { done: true };
  }

  clearDreamerPower(state);
  return { done: true };
}

export function resolveDreamerPowerHandPick(state, cardKey) {
  const pending = state.pendingDreamerPower;
  if (!pending || pending.step !== "reweave-pick") return { done: true };
  const player = powerActor(state);
  const card = cyclablePsycheCards(player).find((c) => c.instanceId === cardKey || c.id === cardKey);
  if (!card) return offerReweave(state);
  player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
  state.psycheDiscard.push(card);
  pending.discarded = (pending.discarded || 0) + 1;
  addLog(state, `Reweave: ${player.name} discards ${card.name || "Psyche"}.`);
  if (pending.discarded >= REWEAVE_MAX || !cyclablePsycheCards(player).length) return finishReweave(state);
  return setChoiceUI(state, "The Weaver · Reweave", `${pending.discarded} discarded. Discard another, or draw ${pending.discarded + 1} now?`, [
    { id: "reweave-more", label: "Discard another", hint: `Up to ${REWEAVE_MAX}.` },
    { id: "reweave-draw", label: `Draw ${pending.discarded + 1}`, hint: "Finish the Reweave." },
  ]);
}

/** No Dreamer Power picks a deck or a tile any more; kept so callers stay simple. */
export function resolveDreamerPowerDeckPick(state) {
  clearDreamerPower(state);
  return { done: true };
}

export function handleDreamerPowerTilePick() {
  return false;
}

export function recordCancellableDiscard(state, player, card, source = "discard") {
  if (!card || isDreambeastPsycheCard(card)) return;
  state.cancellableDiscard = {
    playerId: player.id,
    playerName: player.name,
    card,
    source,
  };
}

export function recordCancellableMove(state, player, fromId, toId) {
  const from = landscapeById(state, fromId);
  const to = landscapeById(state, toId);
  if (!from || !to || fromId === toId) return;
  state.cancellableMove = {
    playerId: player.id,
    playerName: player.name,
    fromId,
    fromName: from.name,
    toId,
    toName: to.name,
  };
}
