/**
 * Tracks game events for Archetype quest validation.
 * Events accumulate each round; some persist for the whole game.
 */
export function createQuestTracker() {
  return {
    meetBoss: { cerberus: false, double: false, leviathan: false },
    meetOnLandscape: {},
    mindstreamOnLandscape: {},
    psycheCycleOnBed: false,
    landscapesRevealed: 0,
    landscapeActions: {},
    returnsFromSubconscious: 0,
    psycheDiscardedTotal: 0,
    psycheDrawnTotal: 0,
    objectsDrawn: 0,
    powerTokensTaken: 0,
    dreambeastsMoved: 0,
    playersMoved: 0,
  };
}

export function recordQuestEvent(state, event, data = {}) {
  if (!state.questTracker) state.questTracker = createQuestTracker();
  const t = state.questTracker;

  switch (event) {
    case "meet_boss":
      if (data.bossId) t.meetBoss[data.bossId] = true;
      break;
    case "meet_on_landscape":
      t.meetOnLandscape[data.landscapeId] = (t.meetOnLandscape[data.landscapeId] || 0) + 1;
      break;
    case "mindstream_on_landscape":
      t.mindstreamOnLandscape[data.landscapeId] = true;
      break;
    case "psyche_cycle_bed":
      t.psycheCycleOnBed = true;
      break;
    case "reveal_landscape":
      t.landscapesRevealed += data.count || 1;
      break;
    case "landscape_action":
      t.landscapeActions[data.landscapeId] = true;
      break;
    case "return_cards":
      t.returnsFromSubconscious += data.count || 1;
      break;
    case "discard_psyche":
      t.psycheDiscardedTotal += data.count || 1;
      if (data.landscapeId === "bed") {
        t.psycheDiscardedOnBed = (t.psycheDiscardedOnBed || 0) + (data.count || 1);
      }
      break;
    case "draw_psyche":
      t.psycheDrawnTotal += data.count || 1;
      break;
    case "draw_object":
      t.objectsDrawn += data.count || 1;
      break;
    case "power_token":
      t.powerTokensTaken += data.count || 1;
      break;
    case "move_dreambeast":
      t.dreambeastsMoved += data.count || 1;
      break;
    case "move_player":
      t.playersMoved += data.count || 1;
      break;
    default:
      break;
  }
}

const QUEST_CHECKS = {
  "psyche cycle on bed": (t) => t.psycheCycleOnBed,
  "meet cerberus": (t) => t.meetBoss.cerberus,
  "meet double": (t) => t.meetBoss.double,
  "meet leviathan": (t) => t.meetBoss.leviathan,
  "draw mindstream on the attic": (t) => t.mindstreamOnLandscape["the-attic"],
  "draw mindstream on the basement": (t) => t.mindstreamOnLandscape["the-basement"],
  "draw mindstream on awards or the party": (t) =>
    t.mindstreamOnLandscape.awards || t.mindstreamOnLandscape["the-party"],
  "meet a dreambeast on awards or the party": (t) =>
    (t.meetOnLandscape.awards || 0) > 0 || (t.meetOnLandscape["the-party"] || 0) > 0,
  "complete a landscape action on house": (t) => t.landscapeActions.house,
  "return 2 cards from subconscious": (t) => t.returnsFromSubconscious >= 2,
  "reveal 2 landscapes": (t) => t.landscapesRevealed >= 2,
  "move 2 dreamers 1 landscape each": (t) => t.playersMoved >= 2,
  "draw 3 psyche": (t) => t.psycheDrawnTotal >= 3,
  "return 1 card from subconscious": (t) => t.returnsFromSubconscious >= 1,
  "discard 2 psyche then draw equal": (t) => t.psycheDiscardedTotal >= 2,
  "take 1 power token": (t) => t.powerTokensTaken >= 1,
  "take 2 power tokens": (t) => t.powerTokensTaken >= 2,
  "draw 1 object": (t) => t.objectsDrawn >= 1,
  "reveal 1 landscape": (t) => t.landscapesRevealed >= 1,
  "meet a dreambeast on city": (t) => (t.meetOnLandscape.city || 0) > 0,
  "discard 12 psyche on bed": (t, state) => {
    return (state.questTracker?.psycheDiscardedOnBed || 0) >= 12;
  },
  "draw 2 psyche from any discard": (t) => t.psycheDrawnTotal >= 2,
  "move 1 dreambeast 2 landscapes": (t) => t.dreambeastsMoved >= 1,
};

function normalizeQuest(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isQuestComplete(state, questText) {
  if (!state.questTracker) return false;
  const key = normalizeQuest(questText);
  const checker = QUEST_CHECKS[key];
  if (!checker) return false;
  return checker(state.questTracker, state);
}

export function getQuestStatus(state, archetype) {
  if (!archetype?.quests) return [];
  return archetype.quests.map((q, i) => ({
    text: q,
    done: archetype.questProgress?.[i] || isQuestComplete(state, q),
    index: i,
  }));
}

export function canMarkQuest(state, questIndex) {
  const arch = state.activeArchetype;
  if (!arch || arch.questProgress[questIndex]) return { ok: false, reason: "Already complete." };
  const quest = arch.quests[questIndex];
  if (!isQuestComplete(state, quest)) {
    return { ok: false, reason: `Quest not met: ${quest}` };
  }
  return { ok: true };
}
