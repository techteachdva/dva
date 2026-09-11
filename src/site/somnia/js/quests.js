/**
 * Tracks game events for Archetype quest validation.
 * Quest conditions persist once met so players can spend Power Tokens later.
 */
import { psycheHandCount } from "./psyche.js";

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

  syncQuestConditions(state);
}

function teamPsycheInHands(state) {
  return state.players
    .filter((p) => p.alive)
    .reduce((sum, p) => sum + psycheHandCount(p), 0);
}

function meetOnAny(t, ids) {
  return ids.some((id) => (t.meetOnLandscape[id] || 0) > 0);
}

function mindstreamOnAny(t, ids) {
  return ids.some((id) => t.mindstreamOnLandscape[id]);
}

const QUEST_CHECKS = {
  "meet cerberus": (t) => t.meetBoss.cerberus,
  "meet double": (t) => t.meetBoss.double,
  "meet leviathan": (t) => t.meetBoss.leviathan,
  "have 10 psyche": (_t, state) => teamPsycheInHands(state) >= 10,
  "draw mindstream on the attic": (t) => t.mindstreamOnLandscape["the-attic"],
  "draw mindstream on the basement": (t) => t.mindstreamOnLandscape["the-basement"],
  "draw mindstream on awards or the party": (t) =>
    mindstreamOnAny(t, ["awards", "the-party"]),
  "meet a dreambeast on awards or the party": (t) =>
    meetOnAny(t, ["awards", "the-party"]),
  "draw mindstream on sea of teeth or field of broken glass": (t) =>
    mindstreamOnAny(t, ["sea-of-teeth", "field-of-broken-glass"]),
  "meet a dreambeast on sea of teeth or field of broken glass": (t) =>
    meetOnAny(t, ["sea-of-teeth", "field-of-broken-glass"]),
  "draw mindstream on naked classroom": (t) => t.mindstreamOnLandscape["naked-classroom"],
  "draw mindstream on candy mountain": (t) => t.mindstreamOnLandscape["candy-mountain"],
  "draw mindstream on endless ocean or lava": (t) =>
    mindstreamOnAny(t, ["endless-ocean", "lava"]),
  "meet a dreambeast on endless ocean or lava": (t) =>
    meetOnAny(t, ["endless-ocean", "lava"]),
  "draw mindstream on insanity or black void": (t) =>
    mindstreamOnAny(t, ["insanity", "black-void"]),
  "meet a dreambeast on insanity or black void": (t) =>
    meetOnAny(t, ["insanity", "black-void"]),
  "draw mindstream on desert": (t) => t.mindstreamOnLandscape.desert,
  "draw mindstream on silver mist": (t) => t.mindstreamOnLandscape["silver-mist"],
  "draw mindstream on tranquil grove or endless hallway": (t) =>
    mindstreamOnAny(t, ["tranquil-grove", "endless-hallway"]),
  "meet a dreambeast on tranquil grove or endless hallway": (t) =>
    meetOnAny(t, ["tranquil-grove", "endless-hallway"]),
  "draw mindstream on day in the life or inner sanctum": (t) =>
    mindstreamOnAny(t, ["day-in-the-life", "inner-sanctum"]),
  "meet a dreambeast on day in the life or inner sanctum": (t) =>
    meetOnAny(t, ["day-in-the-life", "inner-sanctum"]),
};

function normalizeQuest(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function questConditionKey(archetypeId, questText) {
  return `${archetypeId}::${normalizeQuest(questText)}`;
}

function isQuestMetByTracker(state, questText) {
  if (!state.questTracker) return false;
  const key = normalizeQuest(questText);
  const checker = QUEST_CHECKS[key];
  if (!checker) return false;
  return checker(state.questTracker, state);
}

export function ensureQuestConditions(state) {
  if (!state.questConditionsMet) state.questConditionsMet = {};
  const archetypes = [
    ...(state.activeArchetype ? [state.activeArchetype] : []),
    ...state.archetypeDeck,
    ...state.players.flatMap((p) => p.acquiredArchetypes || []),
  ];
  archetypes.forEach((arch) => {
    (arch.quests || []).forEach((quest) => {
      const key = questConditionKey(arch.id, quest);
      if (!state.questConditionsMet[key] && isQuestMetByTracker(state, quest)) {
        state.questConditionsMet[key] = true;
      }
    });
  });
}

export function syncQuestConditions(state) {
  ensureQuestConditions(state);
}

export function isQuestConditionMet(state, archetypeId, questText) {
  if (!state.questConditionsMet) state.questConditionsMet = {};
  const key = questConditionKey(archetypeId, questText);
  if (state.questConditionsMet[key]) return true;
  if (isQuestMetByTracker(state, questText)) {
    state.questConditionsMet[key] = true;
    return true;
  }
  return false;
}

export function getQuestStatus(state, archetype) {
  if (!archetype?.quests) return [];
  return archetype.quests.map((q, i) => {
    const tokenSpent = Boolean(archetype.questProgress?.[i]);
    const conditionMet = isQuestConditionMet(state, archetype.id, q);
    return {
      text: q,
      conditionMet,
      tokenSpent,
      done: tokenSpent,
      ready: conditionMet && !tokenSpent,
      index: i,
    };
  });
}

export function canMarkQuest(state, questIndex) {
  const arch = state.activeArchetype;
  if (!arch) return { ok: false, reason: "No active Archetype." };
  if (arch.questProgress[questIndex]) return { ok: false, reason: "Quest already complete." };
  const quest = arch.quests[questIndex];
  if (!isQuestConditionMet(state, arch.id, quest)) {
    return { ok: false, reason: `Quest not met: ${quest}` };
  }
  return { ok: true };
}
