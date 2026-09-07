import {
  addLog,
  drawPsycheForPlayer,
  landscapeById,
  setEncounterOnLandscape,
} from "./state.js";
import { handRoomForPsycheDraw } from "./objects.js";
import { recordQuestEvent } from "./quests.js";
import { requestReturnCards } from "./subconscious.js";
import { pullObjectsFromMindstreamDiscards } from "./mindstream-supply.js";
import { spendPowerTokens } from "./power-tokens.js";
import { isQuintessentialArchetype } from "./archetype-stats.js";

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
          state.psycheDiscard.push(p.hand.pop());
          recordQuestEvent(state, "discard_psyche", { count: 1 });
        }
      });
      break;

    case "explorer":
      state.pendingArchetypePower = {
        archetypeId: archetype.id,
        step: "pick-destination",
        moverId: player.id,
      };
      addLog(state, "Explorer Power: choose a Landscape with another Dreamer or Dreambeast.");
      break;

    case "fool":
      requestReturnCards(state, state.players.filter((p) => p.alive).length + 3, player);
      break;

    case "outlaw": {
      state.players.filter((p) => p.alive).forEach((p) => {
        const suit = archetype.suit || "elasticity";
        const options = [];
        if (state.mindstreamDecks[suit]?.length) {
          options.push(state.mindstreamDecks[suit].shift());
        }
        if (state.mindstreamDiscard[suit]?.length) {
          options.push(state.mindstreamDiscard[suit].pop());
        }
        if (options.length === 1) {
          helpers.resolveMindstreamCard?.(state, p, options[0]);
        } else if (options.length === 2) {
          const keep = options[0];
          state.mindstreamDiscard[suit].push(options[1]);
          helpers.resolveMindstreamCard?.(state, p, keep);
        }
      });
      break;
    }

    case "ruler": {
      const beasts = state.subconscious?.dreambeasts || [];
      if (!beasts.length) {
        addLog(state, "No Dreambeasts in the Unconscious to return.");
        break;
      }
      const beast = beasts.pop();
      const occupied = state.board.filter((t) =>
        t.revealed && state.players.some((p) => p.alive && p.landscapeId === t.id));
      const tile = occupied[0];
      if (tile) {
        setEncounterOnLandscape(state, tile.id, beast);
        addLog(state, `${beast.name} returns to ${tile.name}.`);
      }
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
