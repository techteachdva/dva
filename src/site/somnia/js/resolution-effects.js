/**
 * Shared Good/Bad resolution opcodes for Events and Dreams (Somnia 36.0).
 */

import {
  addLog,
  drawPsycheForPlayer,
  revealLandscapeTile,
  allEncountersOnBoard,
} from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { grantPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards, enqueueRepressFromHand } from "./subconscious.js";
import { discardToMindstream } from "./mindstream-supply.js";
import { discardDreamCard } from "./dream-deck.js";
import { flipLeviathan } from "./dreambeasts.js";
import { requestChooseTile, forgetRandomLandscapes } from "./landscapes.js";

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function discardPsycheCount(state, player, count) {
  let n = 0;
  for (let i = 0; i < count; i += 1) {
    if (!player.hand?.length) break;
    const card = player.hand.shift();
    state.psycheDiscard.push(card);
    n += 1;
  }
  if (n) {
    recordQuestEvent(state, "discard_psyche", { count: n, landscapeId: player.landscapeId });
    addLog(state, `${player.name} discards ${n} Psyche.`);
  }
  return n;
}

function discardHighest(state, player) {
  if (!player.hand?.length) return;
  const card = player.hand.reduce((best, c) =>
    ((c.value || 0) > (best.value || 0) ? c : best));
  player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
  state.psycheDiscard.push(card);
  recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
  addLog(state, `${player.name} discards ${card.name}.`);
}

function discardSuit(state, player, suit, count) {
  let n = 0;
  for (let i = 0; i < count; i += 1) {
    const idx = (player.hand || []).findIndex((c) => c.suit === suit || c.wild);
    if (idx < 0) break;
    state.psycheDiscard.push(player.hand.splice(idx, 1)[0]);
    n += 1;
  }
  if (n) {
    recordQuestEvent(state, "discard_psyche", { count: n, landscapeId: player.landscapeId });
    addLog(state, `${player.name} discards ${n} ${suit} Psyche.`);
  }
  return n;
}

function repressObjectsCount(state, player, count) {
  const pool = [...(player.objects || []), ...(player.persistent || [])];
  let n = 0;
  for (let i = 0; i < count && pool.length; i += 1) {
    const card = pool.shift();
    player.objects = (player.objects || []).filter((c) => c.instanceId !== card.instanceId);
    player.persistent = (player.persistent || []).filter((c) => c.instanceId !== card.instanceId);
    repressCard(state, card);
    n += 1;
  }
  if (n) addLog(state, `${player.name} represses ${n} Object(s).`);
  return n;
}

function repressTopMindstream(state, suit, count = 1) {
  const deck = state.mindstreamDecks?.[suit];
  if (!deck?.length) return;
  for (let i = 0; i < count && deck.length; i += 1) {
    repressCard(state, deck.shift());
  }
  addLog(state, `Repress ${count} from top of ${suit} Mindstream.`);
}

function repressTopPsyche(state, count = 1) {
  let n = 0;
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
    n += 1;
  }
  if (n) addLog(state, `Repress ${n} from top of Psyche deck.`);
}

/**
 * @param {"good"|"bad"} _side
 */
export function applyResolutionEffect(state, player, sideSpec, helpers = {}, _side = "good") {
  if (!sideSpec?.effect) return;
  const effect = sideSpec.effect;
  const p = sideSpec.params || {};

  switch (effect) {
    case "drawPsyche": {
      const drawn = drawPsycheForPlayer(state, player, p.count || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      break;
    }
    case "drawPsycheAll": {
      alive(state).forEach((pl) => {
        const drawn = drawPsycheForPlayer(state, pl, p.count || 1);
        if (drawn.length) addLog(state, `${pl.name} draws ${drawn.length} Psyche.`);
      });
      break;
    }
    case "drawPsycheAndReturn": {
      const drawn = drawPsycheForPlayer(state, player, p.draw || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      if (p.ret > 0) requestReturnCards(state, p.ret, player);
      break;
    }
    case "drawPsycheAndPT": {
      const drawn = drawPsycheForPlayer(state, player, p.draw || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      if (p.pt > 0) {
        grantPowerTokens(state, player, p.pt, {
          reason: `${player.name} gains ${p.pt} Power Token${p.pt === 1 ? "" : "s"}.`,
          logQuest: false,
        });
      }
      break;
    }
    case "returnCards": {
      if (p.count > 0) requestReturnCards(state, p.count, player);
      break;
    }
    case "returnCardsAll": {
      alive(state).forEach((pl) => {
        if (p.count > 0) requestReturnCards(state, p.count, pl);
      });
      break;
    }
    case "returnAndPT": {
      if (p.ret > 0) requestReturnCards(state, p.ret, player);
      if (p.pt > 0) {
        grantPowerTokens(state, player, p.pt, {
          reason: `${player.name} gains ${p.pt} Power Token${p.pt === 1 ? "" : "s"}.`,
          logQuest: false,
        });
      }
      break;
    }
    case "grantPT": {
      grantPowerTokens(state, player, p.count || 1, {
        reason: `${player.name} gains ${p.count || 1} Power Token${(p.count || 1) === 1 ? "" : "s"}.`,
        logQuest: false,
      });
      break;
    }
    case "revealLandscapes": {
      const hidden = state.board.filter((l) => !l.revealed && !l.center);
      const n = Math.min(p.count || 1, hidden.length);
      hidden.slice(0, n).forEach((t) => revealLandscapeTile(state, t));
      if (n) {
        recordQuestEvent(state, "reveal_landscape", { count: n });
        addLog(state, `Reveal ${n} Landscape${n === 1 ? "" : "s"}.`);
      }
      break;
    }
    case "forgetLandscapes": {
      const forgotten = forgetRandomLandscapes(state, p.count || 1, { skipOccupied: true });
      if (forgotten.length) {
        addLog(state, `Forget ${forgotten.length} Landscape${forgotten.length === 1 ? "" : "s"}: ${forgotten.map((t) => t.name).join(", ")}.`);
      }
      break;
    }
    case "drawObject": {
      if (helpers?.drawObjects) {
        const objs = helpers.drawObjects(state, player, p.count || 1, helpers);
        if (objs.length) addLog(state, `${player.name} draws ${objs.length} Object(s).`);
      }
      break;
    }
    case "moveToNamed": {
      const ids = (p.ids || []).filter((id) => {
        const tile = state.board.find((t) => t.id === id);
        return tile?.revealed && !tile.wasteland;
      });
      if (ids.length) {
        requestChooseTile(state, {
          allowedIds: ids,
          action: "movePlayer",
          playerId: player.id,
          title: `Move ${player.name}`,
          detail: "Choose a named Landscape.",
        });
      }
      break;
    }
    case "freeMeetAction": {
      state.meetActionBudget = (state.meetActionBudget || 0) + (p.count || 1);
      addLog(state, `Gain ${p.count || 1} free Meet Action${(p.count || 1) === 1 ? "" : "s"}.`);
      break;
    }
    case "discardPsyche":
      discardPsycheCount(state, player, p.count || 1);
      break;
    case "discardPsycheAll":
      alive(state).forEach((pl) => discardPsycheCount(state, pl, p.count || 1));
      break;
    case "discardHighestPsyche":
      discardHighest(state, player);
      break;
    case "discardSuitPsyche":
      discardSuit(state, player, p.suit || "lucidity", p.count || 1);
      break;
    case "repressPsyche":
      enqueueRepressFromHand(state, player, p.count || 1, {
        reason: `${player.name}: Repress ${p.count || 1} Psyche.`,
      });
      break;
    case "repressPsycheAll":
      alive(state).forEach((pl) => {
        enqueueRepressFromHand(state, pl, p.count || 1, {
          reason: `${pl.name}: Repress ${p.count || 1} Psyche.`,
        });
      });
      break;
    case "repressObjects":
      repressObjectsCount(state, player, p.count || 1);
      break;
    case "discardDream": {
      for (let i = 0; i < (p.count || 1); i += 1) {
        const dream = state.dreamDeck?.shift();
        if (!dream) break;
        discardDreamCard(state, dream);
        addLog(state, `Discard Dream: ${dream.name}.`);
      }
      break;
    }
    case "repressTopMindstream":
      repressTopMindstream(state, p.suit || "lucidity", p.count || 1);
      break;
    case "repressTopPsycheDeck":
      repressTopPsyche(state, p.count || 1);
      break;
    case "spawnEncounter": {
      if (helpers?.spawnEncounter) {
        helpers.spawnEncounter(state, player.landscapeId);
        addLog(state, `An Encounter emerges on ${player.name}'s Landscape.`);
      }
      break;
    }
    case "spawnEncountersOnDreamers": {
      alive(state).forEach((pl) => {
        if (helpers?.spawnEncounter) helpers.spawnEncounter(state, pl.landscapeId);
      });
      addLog(state, "Encounters spawn on every Dreamer.");
      break;
    }
    case "flipLeviathan":
      flipLeviathan(state);
      break;
    case "skipNextExplore":
      state.skipNextExplore = true;
      addLog(state, "Skip the next Explore Phase.");
      break;
    case "meetOnlyThisRound":
      state.meetOnlyThisRound = true;
      addLog(state, "Dreamers may only Meet this round.");
      break;
    case "clearEncounters": {
      allEncountersOnBoard(state).forEach(({ tile, encounter }) => {
        repressCard(state, encounter);
        const list = tile.encounters || [];
        tile.encounters = list.filter((e) => e.instanceId !== encounter.instanceId);
        if (tile.encounter?.instanceId === encounter.instanceId) tile.encounter = null;
      });
      addLog(state, "All Encounters are Repressed.");
      break;
    }
    default:
      addLog(state, `Unresolved effect: ${effect}`);
  }
}

export function discardMindstreamCard(state, card) {
  if (!card) return;
  const suit = card.mindstreamSuit || card.suit;
  if (!suit) {
    discardToMindstream(state, card);
    return;
  }
  if (!state.mindstreamDiscard[suit]) state.mindstreamDiscard[suit] = [];
  if (!state.mindstreamDiscard[suit].some((c) => c.instanceId === card.instanceId)) {
    state.mindstreamDiscard[suit].push(card);
  }
}
