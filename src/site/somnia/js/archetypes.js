import {
  addLog,
  drawPsycheForPlayer,
} from "./state.js";
import { drawObjects } from "./objects.js";
import { recordQuestEvent } from "./quests.js";
import { requestReturnCards } from "./subconscious.js";

export function resolveOnAcquire(state, archetype, player, helpers) {
  if (!archetype) return;

  addLog(state, `${archetype.name}: ${archetype.ability}`);

  switch (archetype.id) {
    case "sage":
    case "magician":
    case "warrior":
      if (!state.persistentArchetypes) state.persistentArchetypes = [];
      state.persistentArchetypes.push({ ...archetype, instanceId: archetype.instanceId });
      addLog(state, "All Dreamers gain Persistent +1 while this Archetype remains in play.");
      break;

    case "innocent":
      requestReturnCards(state, 4, player);
      break;

    case "caregiver":
      state.players.filter((p) => p.alive).forEach((p) => {
        const need = Math.max(0, 10 - p.hand.length);
        if (need) {
          const n = drawPsycheForPlayer(state, p, need);
          recordQuestEvent(state, "draw_psyche", { count: n.length });
        }
      });
      break;

    case "lover":
      drawObjects(state, player, 3, helpers);
      break;

    case "explorer": {
      const movers = state.players.filter((p) => p.alive);
      if (movers.length >= 2) {
        const a = movers[0];
        const b = movers[1];
        const temp = a.landscapeId;
        a.landscapeId = b.landscapeId;
        b.landscapeId = temp;
        addLog(state, `${a.name} and ${b.name} swap positions.`);
        recordQuestEvent(state, "move_player", { count: 2 });
      }
      break;
    }

    case "orphan": {
      drawPsycheForPlayer(state, player, 2);
      drawObjects(state, player, 2, helpers);
      recordQuestEvent(state, "draw_psyche", { count: 2 });
      break;
    }

    case "fool":
      requestReturnCards(state, state.players.filter((p) => p.alive).length + 3, player);
      break;

    case "creator":
      state.players.filter((p) => p.alive).forEach((p) => {
        const fromDiscard = state.objectDiscard.splice(-2);
        fromDiscard.forEach((obj) => p.objects.push(obj));
        if (fromDiscard.length) {
          addLog(state, `${p.name} returns ${fromDiscard.length} Object(s) from discard.`);
        }
      });
      break;

    case "ruler":
      requestReturnCards(state, state.players.filter((p) => p.alive).length, player);
      if (helpers?.spawnEncounter) {
        const tile = state.board.find((l) => l.revealed && !l.encounter);
        helpers.spawnEncounter(state, tile?.id || "bed");
      }
      break;

    case "outlaw": {
      state.players.filter((p) => p.alive).forEach((p) => {
        for (let i = 0; i < 4 && state.psycheDiscard.length; i += 1) {
          p.hand.push(state.psycheDiscard.pop());
        }
        if (state.objectDiscard.length) {
          p.objects.push(state.objectDiscard.pop());
        }
        recordQuestEvent(state, "draw_psyche", { count: 4 });
        recordQuestEvent(state, "draw_object", { count: 1 });
      });
      break;
    }

    default:
      break;
  }
}
