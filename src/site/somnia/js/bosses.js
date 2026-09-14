import {
  addLog,
  drawPsycheForPlayer,
  forgetLandscapes,
  landscapeById,
} from "./state.js";
import { repressCard } from "./subconscious.js";
import { recordQuestEvent } from "./quests.js";

const BOSS_IDS = new Set(["cerberus", "double", "leviathan"]);

function repressTopPsyche(state, count) {
  let n = 0;
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
    n += 1;
  }
  if (n) recordQuestEvent(state, "discard_psyche", { count: n });
}

export function applyBossAcceptEffect(state, encounter, actor) {
  if (!encounter?.boss && !BOSS_IDS.has(encounter?.id)) return;

  switch (encounter.id) {
    case "cerberus":
      repressTopPsyche(state, 3);
      addLog(state, "Cerberus: Repress top 3 Psyche.");
      break;
    case "double":
      ["day-in-the-life", "naked-classroom"].forEach((id) => {
        const tile = landscapeById(state, id);
        if (tile?.revealed) {
          tile.revealed = false;
          tile.wasteland = true;
          if (tile.encounter) {
            repressCard(state, tile.encounter);
            tile.encounter = null;
          }
        }
      });
      addLog(state, "Double: Forgot Day in the Life and Naked Classroom.");
      break;
    case "leviathan":
      forgetLandscapes(state, 1);
      repressTopPsyche(state, 3);
      addLog(state, "Leviathan: Forgot 1 Landscape and Repressed top 3 Psyche.");
      break;
    default:
      break;
  }
}
