import {
  addLog,
  drawPsycheForPlayer,
  landscapeById,
} from "./state.js";
import { handRoomForPsycheDraw } from "./objects.js";
import { recordQuestEvent } from "./quests.js";
import { requestReturnCards } from "./subconscious.js";
import { pullObjectsFromMindstreamDiscards } from "./mindstream-supply.js";
import { spendPowerTokens, grantPowerTokens } from "./power-tokens.js";
import { isQuintessentialArchetype } from "./archetype-stats.js";
import { requestChooseTile } from "./landscapes.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import { recordCancellableDiscard } from "./dreamer-powers.js";

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

function explorerDestinations(state, mover) {
  return state.board.filter((t) => {
    if (!t.revealed || t.wasteland) return false;
    const hasDreamer = state.players.some((p) => p.alive && p.id !== mover.id && p.landscapeId === t.id);
    return hasDreamer || Boolean(t.encounter);
  }).map((t) => t.id);
}

function occupiedDreamerTiles(state) {
  return state.board.filter((t) =>
    t.revealed && !t.wasteland && state.players.some((p) => p.alive && p.landscapeId === t.id));
}

function beginExplorerPower(state, player) {
  const dests = explorerDestinations(state, player);
  if (!dests.length) {
    grantPowerTokens(state, player, 1);
    addLog(state, "Explorer Power: no Landscape with another Dreamer or Dreambeast. Token refunded.");
    return;
  }
  requestChooseTile(state, {
    allowedIds: dests,
    action: "movePlayer",
    playerId: player.id,
    title: "Explorer Power",
    detail: "Choose a Landscape with another Dreamer or a Dreambeast.",
  });
}

function resolveOutlawCard(state, player, keep, other, suit) {
  const helpers = rememberArchetypeHelpers();
  if (helpers?.resolveCardEffect) {
    helpers.resolveCardEffect(state, keep, player, helpers);
  }
  if (keep && keep.type !== "dreambeast") {
    state.mindstreamDiscard[suit]?.push(keep);
  }
  if (other) state.mindstreamDiscard[suit]?.push(other);
  addLog(state, `${player.name} keeps ${keep?.name || "a Mindstream card"} (Outlaw).`);
}

export function continueArchetypeQueues(state) {
  if (state.pendingEffectChoice || state.landscapePick || state.pendingDreamChoice) return;
  const q = state._outlawQueue;
  if (q?.resolved?.length && !q.playerIds?.length) {
    const next = q.resolved.shift();
    const player = playerById(state, next.playerId);
    if (player && next.keep) resolveOutlawCard(state, player, next.keep, next.other, next.suit);
    if (!q.resolved.length && !q.playerIds?.length) state._outlawQueue = null;
    if (state.pendingEffectChoice || state.landscapePick) return;
    continueArchetypeQueues(state);
  }
}

function presentOutlawPick(state) {
  const q = state._outlawQueue;
  if (!q) return;
  q.resolved = q.resolved || [];
  if (!q.playerIds?.length) {
    continueArchetypeQueues(state);
    return;
  }
  const player = playerById(state, q.playerIds[0]);
  const suit = q.suit;
  if (!player) {
    q.playerIds.shift();
    presentOutlawPick(state);
    return;
  }
  const options = [];
  if (state.mindstreamDecks[suit]?.length) {
    options.push(state.mindstreamDecks[suit].shift());
  }
  if (state.mindstreamDiscard[suit]?.length) {
    options.push(state.mindstreamDiscard[suit].pop());
  }
  if (!options.length) {
    addLog(state, `${player.name} has no ${suit} Mindstream cards to draw.`);
    q.playerIds.shift();
    presentOutlawPick(state);
    return;
  }
  if (options.length === 1) {
    q.resolved.push({ playerId: player.id, keep: options[0], other: null, suit });
    q.playerIds.shift();
    presentOutlawPick(state);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "outlaw-power",
    ui: "cards",
    title: "Outlaw Power",
    message: `${player.name}: keep 1 ${suit} Mindstream card. The other is discarded.`,
    cards: options,
    payload: { suit, options },
  });
}

registerEffectResolver("outlaw-power", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const suit = pending?.payload?.suit;
  const options = pending?.payload?.options || [];
  const keep = options.find((c) => (c.instanceId || c.id) === choiceId) || options[0];
  const other = options.find((c) => c !== keep);
  state.pendingEffectChoice = null;
  const q = state._outlawQueue;
  if (q && player && keep) {
    q.resolved = q.resolved || [];
    q.resolved.push({ playerId: player.id, keep, other, suit });
    q.playerIds.shift();
  }
  presentOutlawPick(state);
  return true;
});

function presentRulerPick(state) {
  const q = state._rulerQueue;
  const beasts = state.subconscious?.dreambeasts || [];
  const occupied = occupiedDreamerTiles(state);
  if (!q?.length || !beasts.length || !occupied.length) {
    state._rulerQueue = null;
    if (q?.length && !beasts.length) addLog(state, "No Dreambeasts left in the Unconscious.");
    return;
  }
  const player = playerById(state, q[0]);
  if (!player) {
    q.shift();
    presentRulerPick(state);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "ruler-power",
    title: "Ruler Power",
    message: `${player.name}: return 1 Dreambeast from the Unconscious onto a Dreamer's Landscape, or skip.`,
    choices: [
      ...beasts.map((b) => ({ id: b.instanceId || b.id, label: b.name })),
      { id: "skip", label: "Skip" },
    ],
    payload: { beasts },
  });
}

registerEffectResolver("ruler-power", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "skip" || !player) {
    if (state._rulerQueue?.length) state._rulerQueue.shift();
    presentRulerPick(state);
    return true;
  }
  const pile = state.subconscious?.dreambeasts || [];
  const idx = pile.findIndex((b) => (b.instanceId || b.id) === choiceId);
  if (idx < 0) {
    if (state._rulerQueue?.length) state._rulerQueue.shift();
    presentRulerPick(state);
    return true;
  }
  const [beast] = pile.splice(idx, 1);
  const occupied = occupiedDreamerTiles(state);
  requestChooseTile(state, {
    allowedIds: occupied.map((t) => t.id),
    action: "spawnEncounter",
    encounter: beast,
    title: "Ruler Power",
    detail: `Place ${beast.name} on a Landscape occupied by a Dreamer.`,
    followup: { archetypeFollowup: "ruler" },
  });
  if (state.pendingObjectFollowup?.archetypeFollowup === "ruler" && !state.landscapePick) {
    resumeArchetypeFollowup(state);
  }
  return true;
});

export function resumeArchetypeFollowup(state) {
  const follow = state.pendingObjectFollowup;
  if (follow?.archetypeFollowup !== "ruler") return false;
  state.pendingObjectFollowup = null;
  if (state._rulerQueue?.length) state._rulerQueue.shift();
  presentRulerPick(state);
  return true;
}

/** Quintessential passives log on acquire; activatable powers use Meet phase + token. */
export function resolveOnAcquire(state, archetype, player) {
  if (!archetype) return;
  if (isQuintessentialArchetype(archetype)) {
    addLog(state, `${archetype.name} acquired: ${archetype.passive} (passive, while acquired).`);
    return;
  }
  addLog(state, `${archetype.name} acquired. Spend 1 Power Token during Meet to use: ${archetype.power}`);
}

export function useArchetypePower(state, archetype, player, helpers = {}) {
  if (!archetype?.power) return false;
  if (player.powerTokens < 1) {
    addLog(state, "Archetype Power costs 1 Power Token.");
    return false;
  }

  const acquired = state.players.some((p) =>
    (p.acquiredArchetypes || []).some((a) => a.id === archetype.id));
  if (!acquired) {
    addLog(state, "That Archetype has not been acquired.");
    return false;
  }

  spendPowerTokens(state, player, 1);
  addLog(state, `${player.name} activates ${archetype.name}: ${archetype.power}`);

  switch (archetype.id) {
    case "innocent":
      requestReturnCards(state, 4, player);
      break;

    case "caregiver": {
      const need = handRoomForPsycheDraw(state, player);
      const drawCount = Math.min(5, need);
      if (drawCount) {
        const drawn = drawPsycheForPlayer(state, player, drawCount);
        recordQuestEvent(state, "draw_psyche", { count: drawn.length });
      }
      break;
    }

    case "lover": {
      const suit = archetype.suit || "elasticity";
      const deck = state.mindstreamDecks[suit];
      const drawn = [];
      let guard = 30;
      while (guard-- > 0 && deck.length) {
        const card = deck.shift();
        drawn.push(card);
        if (card?.type === "object" || card?.subtype === "object") break;
      }
      const object = drawn.find((c) => c?.type === "object" || c?.subtype === "object");
      drawn.forEach((card) => {
        if (card === object) {
          player.objects.push(card);
          recordQuestEvent(state, "draw_object", { count: 1 });
        } else {
          state.mindstreamDiscard[suit].push(card);
        }
      });
      state.players.filter((p) => p.alive && p.id !== player.id).forEach((p) => {
        const others = [];
        let g = 30;
        while (g-- > 0 && state.mindstreamDecks[suit].length) {
          const card = state.mindstreamDecks[suit].shift();
          others.push(card);
          if (card?.type === "object" || card?.subtype === "object") break;
        }
        const obj = others.find((c) => c?.type === "object" || c?.subtype === "object");
        others.forEach((card) => {
          if (card === obj) {
            p.objects.push(card);
            recordQuestEvent(state, "draw_object", { count: 1 });
          } else {
            state.mindstreamDiscard[suit].push(card);
          }
        });
      });
      break;
    }

    case "orphan":
      state.players.filter((p) => p.alive).forEach((p) => {
        const drawn = drawPsycheForPlayer(state, p, 3);
        recordQuestEvent(state, "draw_psyche", { count: drawn.length });
        if (p.hand.length) {
          const discarded = p.hand.pop();
          state.psycheDiscard.push(discarded);
          recordCancellableDiscard(state, p, discarded, "orphan");
          recordQuestEvent(state, "discard_psyche", { count: 1 });
        }
      });
      break;

    case "explorer":
      beginExplorerPower(state, player);
      break;

    case "fool":
      requestReturnCards(state, state.players.filter((p) => p.alive).length + 3, player);
      break;

    case "outlaw": {
      rememberArchetypeHelpers(helpers);
      state._outlawQueue = {
        playerIds: alivePlayers(state).map((p) => p.id),
        suit: archetype.suit || "elasticity",
      };
      presentOutlawPick(state);
      break;
    }

    case "ruler": {
      const beasts = state.subconscious?.dreambeasts || [];
      if (!beasts.length) {
        addLog(state, "No Dreambeasts in the Unconscious to return.");
        break;
      }
      state._rulerQueue = alivePlayers(state).map((p) => p.id);
      presentRulerPick(state);
      break;
    }

    case "creator":
      state.players.filter((p) => p.alive).forEach((p) => {
        const fromDiscard = pullObjectsFromMindstreamDiscards(state, 2);
        fromDiscard.forEach((obj) => {
          const suit = obj.suit || "lucidity";
          state.mindstreamDecks[suit]?.unshift(obj);
        });
        if (fromDiscard.length) {
          addLog(state, `${p.name} returns ${fromDiscard.length} Object(s) to Mindstream tops.`);
        }
      });
      break;

    default:
      break;
  }
  return true;
}

export function handleArchetypePowerTilePick(state, tileId) {
  const pending = state.pendingArchetypePower;
  if (!pending || pending.step !== "pick-destination") return false;

  const mover = state.players.find((p) => p.id === pending.moverId);
  const tile = landscapeById(state, tileId);
  if (!mover || !tile?.revealed) return false;

  const hasTarget = state.players.some((p) => p.alive && p.id !== mover.id && p.landscapeId === tileId)
    || Boolean(tile.encounter);
  if (!hasTarget) {
    addLog(state, "Choose a Landscape occupied by another Dreamer or a Dreambeast.");
    return false;
  }

  mover.landscapeId = tileId;
  state.selectedLandscapeId = tileId;
  addLog(state, `${mover.name} moves to ${tile.name} (Explorer Power).`);
  recordQuestEvent(state, "move_player", { count: 1 });
  state.pendingArchetypePower = null;
  return true;
}
