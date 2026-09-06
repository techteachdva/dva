import { createQuestTracker, canMarkQuest } from "./quests.js";
import { buildHexBoard } from "./hex.js";
import {
  createSubconscious,
  repressCard,
  repressCards,
  subconsciousCount,
  normalizeSubconscious,
  repressFromMindstreamSetup,
} from "./subconscious.js";
import {
  handLimitForPlayer,
  extraPsycheDrawAtRoundStart,
  drawObjects,
} from "./objects.js";
import {
  LENGTHS,
  PHASES,
  shuffle,
  buildPsycheDeck,
  buildDreamDeck,
  insertBossDreams,
  buildMindstreamDecks,
  buildObjectDeck,
  uid,
} from "./data.js";
export function createInitialState(data, options) {
  const length = LENGTHS[options.lengthKey];
  const landscapes = data.landscapes.filter((l) => !l.hidden);

  const usedDreamerIds = new Set(options.selectedDreamers.map((d) => d.id));
  const availableDreamers = data.dreamers.filter((d) => !usedDreamerIds.has(d.id));

  const board = buildHexBoard(landscapes);

  const psycheDeck = buildPsycheDeck(data.psyche);
  const dreamDeck = insertBossDreams(buildDreamDeck(data.dreams, length.dreams), data.dreambeasts);
  const archetypeDeck = shuffle(data.archetypes.map((a) => ({ ...a, instanceId: uid("arch") })));
  const mindstreamDecks = buildMindstreamDecks(data.mindstream, 2);
  const objectDeck = buildObjectDeck(data.objects, 1);
  const dreambeastDeck = shuffle(
    data.dreambeasts
      .filter((b) => !b.boss)
      .map((b) => ({ ...b, type: "dreambeast", instanceId: uid("beast") }))
  );
  const mindstreamDiscard = { lucidity: [], elasticity: [], willpower: [] };
  const objectDiscard = [];
  const subconscious = createSubconscious();

  const players = options.selectedDreamers.map((dreamer, index) => ({
    id: uid("player"),
    name: dreamer.name,
    dreamer,
    landscapeId: "bed",
    powerTokens: 2,
    hand: psycheDeck.splice(0, 5),
    objects: [],
    persistent: [],
    acquiredArchetypes: [],
    isHead: index === 0,
    alive: true,
    pendingRespawn: false,
  }));

  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    repressFromMindstreamSetup({ mindstreamDecks, subconscious }, suit, players.length);
  });

  const activeArchetype = archetypeDeck.shift();
  activeArchetype.questProgress = [false, false];

  const state = {
    phaseIndex: 0,
    round: 1,
    goalPoints: length.points,
    dreamDeck,
    psycheDeck,
    psycheDiscard: [],
    archetypeDeck,
    dreambeastDeck,
    mindstreamDecks,
    mindstreamDiscard,
    objectDeck,
    objectDiscard,
    subconscious,
    board,
    players,
    activePlayerIndex: 0,
    activeArchetype,
    activeEncounter: null,
    activeEncounterLandscapeId: null,
    activeDream: null,
    acquiredPoints: 0,
    selectedHand: [],
    selectedLandscapeId: "bed",
    log: ["The Dreamscape forms around The Bed..."],
    status: "playing",
    finalRecurrence: false,
    dreamDrawn: false,
    dreamDiscard: [],
    revealLandscapeUsed: false,
    exploreMovesLeft: 0,
    exploreActivated: false,
    meetActionBudget: 0,
    meetActionsUsed: 0,
    lastMeetAction: null,
    pendingPowerBonus: 0,
    tradeMode: false,
    viewingDeck: null,
    availableDreamers,
    allDreamers: data.dreamers,
    questTracker: createQuestTracker(),
    questRoundFlags: { discardedOnBed: false },
    finalArchetypes: [],
    freeExploreNextRound: false,
    pendingRespawn: null,
    trade: null,
    pendingReturn: null,
    pendingRepress: null,
    resolutionQueue: [],
    landscapePick: null,
    narrator: null,
    exploreFreeMove: false,
    pendingHeatingUp: false,
    persistentArchetypes: [],
    skeletonKeyPending: false,
  };

  beginRoundReveal(state);
  return state;
}

export function getPhase(state) {
  return PHASES[state.phaseIndex];
}

export function activePlayer(state) {
  return state.players[state.activePlayerIndex];
}

export function headPlayer(state) {
  return state.players.find((p) => p.isHead) || state.players[0];
}

export function landscapeById(state, id) {
  return state.board.find((l) => l.id === id);
}

export function playersOnLandscape(state, id) {
  return state.players.filter((p) => p.landscapeId === id && p.alive);
}

export function addLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 40);
}

export function drawPsycheForPlayer(state, player, count = 1) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!state.psycheDeck.length && state.psycheDiscard.length) {
      state.psycheDeck = shuffle(state.psycheDiscard);
      state.psycheDiscard = [];
    }
    if (!state.psycheDeck.length) break;
    const card = state.psycheDeck.shift();
    const limit = handLimitForPlayer(state, player);
    if (player.hand.length < limit) {
      player.hand.push(card);
      drawn.push(card);
    } else {
      state.psycheDiscard.push(card);
    }
  }
  return drawn;
}

export function drawPsyche(state, count = 1) {
  return drawPsycheForPlayer(state, activePlayer(state), count);
}

export function drawMindstream(state, suit, count = 1) {
  const deck = state.mindstreamDecks[suit];
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!deck.length) break;
    drawn.push(deck.shift());
  }
  return drawn;
}

export function repressPsycheToSubconscious(state, cards) {
  repressCards(state, cards);
}

export function drawObject(state, player, count = 1, helpers = null) {
  if (helpers) return drawObjects(state, player, count, helpers);
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!state.objectDeck.length && state.objectDiscard.length) {
      state.objectDeck = shuffle(state.objectDiscard);
      state.objectDiscard = [];
    }
    if (!state.objectDeck.length) break;
    const card = state.objectDeck.shift();
    player.objects.push(card);
    drawn.push(card);
  }
  return drawn;
}

export function encounterOnLandscape(state, landscapeId) {
  const tile = landscapeById(state, landscapeId);
  return tile?.encounter || null;
}

export function setEncounterOnLandscape(state, landscapeId, encounter) {
  const tile = landscapeById(state, landscapeId);
  if (!tile) return;
  tile.encounter = encounter;
  if (encounter) {
    state.activeEncounter = encounter;
    state.activeEncounterLandscapeId = landscapeId;
  } else if (state.activeEncounterLandscapeId === landscapeId) {
    state.activeEncounter = null;
    state.activeEncounterLandscapeId = null;
  }
}

export function resetPhaseFlags(state) {
  state.dreamDrawn = false;
  state.revealLandscapeUsed = false;
  state.exploreMovesLeft = 0;
  state.exploreActivated = false;
  state.meetActionBudget = 0;
  state.meetActionsUsed = 0;
  state.lastMeetAction = null;
  state.pendingPowerBonus = 0;
  state.selectedHand = [];
  state.tradeMode = false;
  state.trade = null;
  state.questRoundFlags = { discardedOnBed: false };
}

export function beginRoundReveal(state) {
  resetPhaseFlags(state);
  state.phaseIndex = 0;

  state.players.forEach((player) => {
    if (!player.alive) return;
    if (player.hand.length === 0) {
      handleDreamerDeath(state, player);
      return;
    }
    drawPsycheForPlayer(state, player, 2);
    const extra = extraPsycheDrawAtRoundStart(state, player);
    if (extra) drawPsycheForPlayer(state, player, extra);
  });

  addLog(state, `Round ${state.round}: Reveal — each Dreamer draws 2 Psyche.`);
}

export function handleDreamerDeath(state, player) {
  addLog(state, `${player.name} had no Psyche and is lost to the Dreamscape!`);
  const beast = state.dreambeastDeck.shift();
  if (beast) {
    setEncounterOnLandscape(state, player.landscapeId, { ...beast, instanceId: uid("beast") });
    addLog(state, `${beast.name} spawns where ${player.name} fell.`);
  }
  player.alive = false;
  player.hand = [];
  player.objects = [];
  player.persistent = [];
  player.pendingRespawn = true;
  if (state.availableDreamers.length) {
    state.pendingRespawn = player.id;
    addLog(state, "Choose a new Dreamer to continue on The Bed.");
  } else {
    addLog(state, "No Dreamers remain. The Dreamscape claims another soul.");
  }
}

export function respawnDreamer(state, playerId, dreamerId) {
  const player = state.players.find((p) => p.id === playerId);
  const dreamer = state.availableDreamers.find((d) => d.id === dreamerId);
  if (!player || !dreamer) return false;

  state.availableDreamers = state.availableDreamers.filter((d) => d.id !== dreamerId);
  player.dreamer = dreamer;
  player.name = dreamer.name;
  player.alive = true;
  player.landscapeId = "bed";
  player.powerTokens = 2;
  player.hand = [];
  drawPsycheForPlayer(state, player, 5);
  player.pendingRespawn = false;
  state.pendingRespawn = null;
  addLog(state, `${dreamer.name} enters the Dreamscape on The Bed with 5 Psyche and 2 Power.`);
  return true;
}

export function beginFinalRecurrence(state) {
  state.finalRecurrence = true;
  state.goalPoints = 0;
  const remaining = [...state.archetypeDeck];
  if (state.activeArchetype) remaining.unshift(state.activeArchetype);
  state.archetypeDeck = [];
  state.activeArchetype = null;

  state.finalArchetypes = remaining.map((arch) => {
    const tile = state.board.find((l) => l.revealed && l.suit === arch.suit && !l.center);
    if (tile) {
      tile.finalArchetype = { ...arch, defeated: false };
      addLog(state, `${arch.name} appears on ${tile.name}.`);
    }
    return { ...arch, defeated: false, landscapeId: tile?.id };
  });

  addLog(state, "Defeat each Remaining Archetype with a 12 Psyche Play using opposing suits.");
}

export function advancePhase(state) {
  const phase = getPhase(state);

  if (phase === "Meet") {
    resolveEncounterFails(state);
    passHeadDreamer(state);
    state.round += 1;
    beginRoundReveal(state);
    return;
  }

  state.phaseIndex += 1;
  state.selectedHand = [];
  state.pendingPowerBonus = 0;

  if (getPhase(state) === "Explore") {
    addLog(state, "Explore Phase — play Elasticity Psyche to move Dreamers.");
  } else if (getPhase(state) === "Meet") {
    addLog(state, "Meet Phase — one Dreamer pays Willpower for shared Actions; all Dreamers pool Psyche.");
  }
}

function passHeadDreamer(state) {
  const currentHeadIndex = state.players.findIndex((p) => p.isHead);
  const headIndex = currentHeadIndex >= 0 ? currentHeadIndex : state.activePlayerIndex;
  const nextHead = (headIndex + 1) % state.players.length;
  state.players.forEach((p) => {
    p.isHead = false;
  });
  state.players[nextHead].isHead = true;
  state.activePlayerIndex = nextHead;
}

function resolveEncounterFails(state) {
  state.players.forEach((player) => {
    if (!player.alive) return;
    const enc = encounterOnLandscape(state, player.landscapeId);
    if (!enc) return;
    addLog(state, `${player.name} failed to Meet ${enc.name} on ${landscapeById(state, player.landscapeId)?.name}.`);
    applyEncounterFail(state, player, enc);
    const tile = landscapeById(state, player.landscapeId);
    if (tile) tile.encounter = null;
    if (state.activeEncounterLandscapeId === player.landscapeId) {
      state.activeEncounter = null;
      state.activeEncounterLandscapeId = null;
    }
  });
}

function applyEncounterFail(state, player, encounter) {
  const failCount = parseInt(encounter.fail?.match(/\d+/)?.[0] || "1", 10);
  for (let i = 0; i < failCount && player.hand.length; i += 1) {
    repressCard(state, player.hand.pop());
  }
  addLog(state, encounter.fail || "Encounter Fail resolved.");
}

export function checkVictory(state) {
  if (state.finalRecurrence) {
    const left = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
    if (left === 0) {
      state.status = "won";
      addLog(state, "All Remaining Archetypes defeated. You wake up!");
    }
    return;
  }
  if (state.acquiredPoints >= state.goalPoints) {
    state.status = "won";
    addLog(state, "The Dreamers wake up! You escaped the Dreamscape.");
  }
}

export function checkDefeat(state) {
  if (state.finalRecurrence) {
    const left = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
    if (state.dreamDeck.length === 0 && left > 0) {
      state.status = "lost";
      addLog(state, "The Dream Deck is exhausted. You never wake up.");
    }
    return;
  }
  if (state.dreamDeck.length === 0 && state.acquiredPoints < state.goalPoints) {
    state.status = "lost";
    addLog(state, "The Dream Deck is exhausted. You never wake up.");
  }
}

export function acquireArchetype(state, player, onAcquireFn) {
  const archetype = state.activeArchetype;
  if (!archetype || !archetype.questProgress.every(Boolean)) return false;

  player.acquiredArchetypes.push(archetype);
  state.acquiredPoints += archetype.points;
  addLog(state, `${player.name} acquired ${archetype.name} (${archetype.points} pts).`);

  if (onAcquireFn) onAcquireFn(state, archetype, player);

  if (archetype.onAcquire === "Bottom of pile") {
    state.archetypeDeck.push(archetype);
  }

  state.activeArchetype = state.archetypeDeck.shift() || null;
  if (state.activeArchetype) {
    state.activeArchetype.questProgress = [false, false];
  }

  checkVictory(state);
  return true;
}

export function completeQuest(state, questIndex, player) {
  const archetype = state.activeArchetype;
  if (!archetype || archetype.questProgress[questIndex]) return false;
  if (player.powerTokens < 1) return false;

  const check = canMarkQuest(state, questIndex);
  if (!check.ok) {
    addLog(state, check.reason);
    return false;
  }

  player.powerTokens -= 1;
  archetype.questProgress[questIndex] = true;
  addLog(state, `${player.name} completed quest: ${archetype.quests[questIndex]}.`);

  if (archetype.questProgress.every(Boolean)) {
    addLog(state, `${archetype.name} is ready to acquire!`);
  }
  return true;
}

export { forgetLandscapes } from "./landscapes.js";

export function revealLandscapeTile(state, tile) {
  if (!tile.revealed) {
    tile.revealed = true;
    tile.wasteland = false;
    addLog(state, `Revealed ${tile.name}.`);
  } else if (tile.wasteland) {
    tile.wasteland = false;
    addLog(state, `Restored ${tile.name} from Wasteland.`);
  }
}
