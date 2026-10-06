/**
 * Tracks game events for Archetype quest validation.
 * Quest conditions persist once met so players can spend Power Tokens later.
 */
import { psycheHandCount } from "./psyche.js";
import { discardToMindstream } from "./mindstream-supply.js";

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
    sacrificedObject: false,
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
    case "sacrifice_object":
      t.sacrificedObject = true;
      break;
    case "move_player":
      t.playersMoved += data.count || 1;
      break;
    default:
      break;
  }

  syncQuestConditions(state);
}

function anyDreamerPsycheHand(state, minCards) {
  return state.players
    .filter((p) => p.alive)
    .some((p) => psycheHandCount(p) >= minCards);
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
  "defeat cerberus": (t) => t.meetBoss.cerberus,
  "defeat double": (t) => t.meetBoss.double,
  "defeat leviathan": (t) => t.meetBoss.leviathan,
  "1 dreamer sacrifices 1 object": (t) => t.sacrificedObject,
  "have 10 psyche": (_t, state) => anyDreamerPsycheHand(state, 10),
  "1 dreamer holds 10 psyche cards": (_t, state) => anyDreamerPsycheHand(state, 10),
  "draw mindstream on the attic": (t) => t.mindstreamOnLandscape["the-attic"],
  "draw mindstream on the attic or the basement": (t) =>
    mindstreamOnAny(t, ["the-attic", "the-basement"]),
  "draw mindstream on scary classroom or candy mountain": (t) =>
    mindstreamOnAny(t, ["scary-classroom", "candy-mountain"]),
  "draw mindstream on desert or silver mist": (t) =>
    mindstreamOnAny(t, ["desert", "silver-mist"]),
  "draw mindstream on the basement": (t) => t.mindstreamOnLandscape["the-basement"],
  "meet a dreambeast on the attic or the basement": (t) =>
    meetOnAny(t, ["the-attic", "the-basement"]),
  "meet a dreambeast on scary classroom or candy mountain": (t) =>
    meetOnAny(t, ["scary-classroom", "candy-mountain"]),
  "meet a dreambeast on desert or silver mist": (t) =>
    meetOnAny(t, ["desert", "silver-mist"]),
  "draw mindstream on awards or the party": (t) =>
    mindstreamOnAny(t, ["awards", "the-party"]),
  "meet a dreambeast on awards or the party": (t) =>
    meetOnAny(t, ["awards", "the-party"]),
  "draw mindstream on sea of teeth or field of broken glass": (t) =>
    mindstreamOnAny(t, ["sea-of-teeth", "field-of-broken-glass"]),
  "meet a dreambeast on sea of teeth or field of broken glass": (t) =>
    meetOnAny(t, ["sea-of-teeth", "field-of-broken-glass"]),
  "draw mindstream on scary classroom": (t) => t.mindstreamOnLandscape["scary-classroom"],
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

const QUEST_LANDSCAPE_HINTS = {
  "draw mindstream on the attic": ["the-attic"],
  "draw mindstream on the attic or the basement": ["the-attic", "the-basement"],
  "draw mindstream on scary classroom or candy mountain": ["scary-classroom", "candy-mountain"],
  "draw mindstream on desert or silver mist": ["desert", "silver-mist"],
  "draw mindstream on the basement": ["the-basement"],
  "meet a dreambeast on the attic or the basement": ["the-attic", "the-basement"],
  "meet a dreambeast on scary classroom or candy mountain": ["scary-classroom", "candy-mountain"],
  "meet a dreambeast on desert or silver mist": ["desert", "silver-mist"],
  "draw mindstream on awards or the party": ["awards", "the-party"],
  "meet a dreambeast on awards or the party": ["awards", "the-party"],
  "draw mindstream on sea of teeth or field of broken glass": ["sea-of-teeth", "field-of-broken-glass"],
  "meet a dreambeast on sea of teeth or field of broken glass": ["sea-of-teeth", "field-of-broken-glass"],
  "draw mindstream on scary classroom": ["scary-classroom"],
  "draw mindstream on candy mountain": ["candy-mountain"],
  "draw mindstream on endless ocean or lava": ["endless-ocean", "lava"],
  "meet a dreambeast on endless ocean or lava": ["endless-ocean", "lava"],
  "draw mindstream on insanity or black void": ["insanity", "black-void"],
  "meet a dreambeast on insanity or black void": ["insanity", "black-void"],
  "draw mindstream on desert": ["desert"],
  "draw mindstream on silver mist": ["silver-mist"],
  "draw mindstream on tranquil grove or endless hallway": ["tranquil-grove", "endless-hallway"],
  "meet a dreambeast on tranquil grove or endless hallway": ["tranquil-grove", "endless-hallway"],
  "draw mindstream on day in the life or inner sanctum": ["day-in-the-life", "inner-sanctum"],
  "meet a dreambeast on day in the life or inner sanctum": ["day-in-the-life", "inner-sanctum"],
};

export function meetQuestLandscapeIds(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return [];
  const ids = new Set();
  arch.quests.forEach((quest, index) => {
    if (arch.questProgress?.[index]) return;
    const key = normalizeQuest(quest);
    if (!key.startsWith("meet a dreambeast")) return;
    (QUEST_LANDSCAPE_HINTS[key] || []).forEach((id) => ids.add(id));
  });
  return [...ids];
}

export function activeQuestLandscapeIds(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return [];
  const ids = new Set();
  arch.quests.forEach((q, i) => {
    if (arch.questProgress?.[i]) return;
    if (isQuestConditionMet(state, arch.id, q)) return;
    const hinted = QUEST_LANDSCAPE_HINTS[normalizeQuest(q)];
    if (hinted) hinted.forEach((id) => ids.add(id));
  });
  return [...ids];
}

const BOSS_QUEST_IDS = ["cerberus", "double", "leviathan"];

function bossIdFromQuest(text) {
  const n = normalizeQuest(text);
  if (!n.includes("defeat") && !n.includes("meet")) return null;
  return BOSS_QUEST_IDS.find((id) => n.includes(id)) || null;
}

function listedEncounters(tile) {
  if (Array.isArray(tile?.encounters) && tile.encounters.length) return tile.encounters;
  if (tile?.encounter) return [tile.encounter];
  return [];
}

function bossOnBoard(state, bossId) {
  for (const tile of state.board || []) {
    const hit = listedEncounters(tile).some((enc) => enc?.id === bossId || enc?.refId === bossId);
    if (hit) return tile;
  }
  return null;
}

function bossAlreadyMet(state, bossId) {
  const sub = state?.subconscious;
  if (!sub) return false;
  const piles = [
    ...(sub.dreambeasts || []),
    ...(sub.other || []),
    ...(sub.psyche || []),
    ...(sub.objects || []),
  ];
  if (piles.some((card) => card?.id === bossId || card?.refId === bossId)) return true;
  return (state.players || []).some((player) => (player.hand || []).some(
    (card) => (card?.id === bossId || card?.refId === bossId) && (card.isDreambeastPsyche || card.type === "psyche-dreambeast"),
  ));
}

/** Where a boss quest's Dreambeast is, or how many turns until its dream is drawn. */
export function bossQuestHint(state, questText) {
  const bossId = bossIdFromQuest(questText);
  if (!bossId || !state) return "";
  const tile = bossOnBoard(state, bossId);
  if (tile?.name) return `On ${tile.name}`;
  if (bossAlreadyMet(state, bossId)) return "";
  const index = (state.dreamDeck || []).findIndex((card) => card?.id === bossId);
  if (index < 0) return "";
  const turns = state.dreamDrawn ? index + 1 : index;
  if (turns <= 0) return "Spawns this turn";
  return turns === 1 ? "Spawns in 1 turn" : `Spawns in ${turns} turns`;
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
      hint: conditionMet ? "" : bossQuestHint(state, q),
      index: i,
    };
  });
}

export function sacrificeQuestOpen(state) {
  const arch = state.activeArchetype;
  if (!arch?.quests) return false;
  return arch.quests.some((quest, index) => {
    if (arch.questProgress?.[index]) return false;
    if (!normalizeQuest(quest).includes("sacrific")) return false;
    return !isQuestConditionMet(state, arch.id, quest);
  });
}

export function listSacrificableObjects(state) {
  const rows = [];
  for (const player of state.players || []) {
    if (!player.alive) continue;
    for (const card of player.objects || []) {
      rows.push({
        playerId: player.id,
        playerName: player.name,
        instanceId: card.instanceId,
        name: card.name,
        persistent: false,
      });
    }
    for (const card of player.persistent || []) {
      rows.push({
        playerId: player.id,
        playerName: player.name,
        instanceId: card.instanceId,
        name: card.name,
        persistent: true,
      });
    }
  }
  return rows;
}

export function sacrificeHeldObject(state, playerId, instanceId) {
  if (!sacrificeQuestOpen(state)) return { ok: false, reason: "That quest is not open." };
  const player = (state.players || []).find((p) => p.id === playerId && p.alive);
  if (!player) return { ok: false, reason: "That Dreamer cannot sacrifice." };
  const fromObjects = (player.objects || []).find((c) => c.instanceId === instanceId);
  const fromPersistent = (player.persistent || []).find((c) => c.instanceId === instanceId);
  const card = fromObjects || fromPersistent;
  if (!card) return { ok: false, reason: "That Object is no longer held." };
  if (fromObjects) player.objects = player.objects.filter((c) => c.instanceId !== instanceId);
  else player.persistent = (player.persistent || []).filter((c) => c.instanceId !== instanceId);
  discardToMindstream(state, card);
  recordQuestEvent(state, "sacrifice_object");
  const who = player.name || "A Dreamer";
  return { ok: true, log: `${who} sacrificed ${card.name}.` };
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
