/** Dreambeast type affinities, Meet bonuses, and reject rewards. */

import { addLog, drawPsycheForPlayer } from "./state.js";
import { grantPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards } from "./subconscious.js";

const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

/** Dreamer id → beast kind they gain +1 Psyche against during Meet. */
export const DREAMER_KIND_AFFINITY = {
  "the-rested": "fantasy",
  "the-visionary": "fantasy",
  "the-weaver": "fantasy",
  "the-runner": "nightmare",
  "the-hunter": "nightmare",
  "the-immovable": "nightmare",
};

const SUIT_PRIORITY = { lucidity: 0, elasticity: 1, willpower: 2 };

export function dreamerPrimarySuit(dreamer) {
  const stats = [
    { suit: "lucidity", value: dreamer.lucidity ?? 0 },
    { suit: "elasticity", value: dreamer.elasticity ?? 0 },
    { suit: "willpower", value: dreamer.willpower ?? 0 },
  ];
  stats.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit];
  });
  return stats[0].suit;
}

export function encounterRejectCost(encounter) {
  return encounter.reject ?? encounter.repress ?? 0;
}

export function dreamerMeetBonuses(dreamer, encounter) {
  const parts = [];
  let total = 0;

  const affinity = DREAMER_KIND_AFFINITY[dreamer?.id];
  const kind = encounter?.beastKind;
  if (affinity && kind && affinity === kind) {
    total += 1;
    parts.push(`+1 ${kind === "fantasy" ? "Fantasy" : "Nightmare"} affinity`);
  }

  const primary = dreamerPrimarySuit(dreamer);
  if (encounter?.suit && primary === encounter.suit) {
    total += 1;
    parts.push(`+1 ${SUIT_LABELS[encounter.suit] || encounter.suit} suit`);
  }

  return { total, parts };
}

export function beastKindLabel(kind) {
  if (kind === "fantasy") return "Fantasy";
  if (kind === "nightmare") return "Nightmare";
  return "";
}

export function applyRejectReward(state, encounter, actor, helpers = {}) {
  const effect = encounter.rejectEffect;
  const { drawObjects = () => [] } = helpers;

  if (!effect) {
    const drawn = drawPsycheForPlayer(state, actor, 1);
    if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
    return;
  }

  switch (effect.type) {
    case "draw-psyche": {
      const drawn = drawPsycheForPlayer(state, actor, effect.count || 1);
      if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
      break;
    }
    case "all-draw-psyche": {
      state.players.filter((p) => p.alive).forEach((p) => {
        const drawn = drawPsycheForPlayer(state, p, effect.count || 1);
        if (drawn.length) addLog(state, `${p.name} draws ${drawn.length} Psyche.`);
      });
      break;
    }
    case "gain-power": {
      grantPowerTokens(state, actor, effect.count || 1, {
        reason: `Reject reward: ${effect.count || 1} Power Token.`,
        logQuest: false,
      });
      break;
    }
    case "draw-object": {
      if (helpers.drawObjects) {
        const objs = helpers.drawObjects(state, actor, effect.count || 1, helpers);
        if (objs.length) addLog(state, `${actor.name} draws ${objs.length} Object(s).`);
      }
      break;
    }
    case "return-subconscious": {
      requestReturnCards(state, effect.count || 1, actor);
      break;
    }
    case "repress-hand": {
      if (actor.hand.length) {
        const card = actor.hand.pop();
        repressCard(state, card);
        addLog(state, `${actor.name} Represses 1 Psyche to the Subconscious.`);
        if (state.checkPsycheDeath) state.checkPsycheDeath(actor);
      }
      const drawn = drawPsycheForPlayer(state, actor, effect.draw || 1);
      if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
      break;
    }
    default:
      addLog(state, encounter.rejectReward || "Reject reward resolved.");
  }
}
