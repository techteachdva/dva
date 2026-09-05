import {
  LENGTHS,
  PHASES,
  shuffle,
  buildPsycheDeck,
  buildDreamDeck,
  insertBossDreams,
  buildMindstreamDecks,
  buildObjectDeck,
  repressFromMindstream,
  uid,
} from "./data.js";

export function createInitialState(data, options) {
  const length = LENGTHS[options.lengthKey];
  const landscapes = data.landscapes.filter((l) => !l.hidden);
  const starting = landscapes.filter((l) => l.starting);
  const pool = shuffle(landscapes.filter((l) => !l.starting && !l.center));

  const board = [
    { ...landscapes.find((l) => l.center), revealed: true, wasteland: false },
    ...starting.map((l) => ({ ...l, revealed: true, wasteland: false })),
    ...pool.slice(0, 6).map((l) => ({ ...l, revealed: false, wasteland: true })),
  ];

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
  const subconscious = [];

  const players = options.selectedDreamers.map((dreamer, index) => {
    const hand = psycheDeck.splice(0, 5);
    return {
      id: uid("player"),
      name: dreamer.name,
      dreamer,
      landscapeId: "bed",
      powerTokens: 2,
      hand,
      objects: [],
      acquiredArchetypes: [],
      isHead: index === 0,
      alive: true,
    };
  });

  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    repressFromMindstream({ mindstreamDecks, subconscious }, suit, 3, players.length);
  });

  const activeArchetype = archetypeDeck.shift();
  activeArchetype.questProgress = [false, false];

  return {
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
    lastAction: null,
    revealUsed: false,
    exploreUsed: false,
    meetActions: 0,
    meetActionLimit: 0,
    viewingDeck: null,
  };
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
  state.log = state.log.slice(0, 30);
}

export function drawPsyche(state, count = 1) {
  const player = activePlayer(state);
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!state.psycheDeck.length && state.psycheDiscard.length) {
      state.psycheDeck = shuffle(state.psycheDiscard);
      state.psycheDiscard = [];
    }
    if (!state.psycheDeck.length) break;
    const card = state.psycheDeck.shift();
    if (player.hand.length < 10) {
      player.hand.push(card);
      drawn.push(card);
    } else {
      state.psycheDiscard.push(card);
    }
  }
  return drawn;
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

export function repressMindstream(state, suit, count = 1) {
  const deck = state.mindstreamDecks[suit];
  const repressed = [];
  for (let i = 0; i < count && deck.length; i += 1) {
    const card = deck.shift();
    state.subconscious.push(card);
    repressed.push(card);
  }
  return repressed;
}

export function drawObject(state, player, count = 1) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!state.objectDeck.length && state.objectDiscard.length) {
      state.objectDeck = shuffle(state.objectDiscard);
      state.objectDiscard = [];
    }
    if (!state.objectDeck.length) break;
    const card = state.objectDeck.shift();
    if (player.objects.length < 5) {
      player.objects.push(card);
      drawn.push(card);
      if (card.subtype === "must-play") {
        addLog(state, `${player.name} must play ${card.name} immediately.`);
      }
    } else {
      state.objectDiscard.push(card);
    }
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

export function advancePhase(state) {
  const phase = getPhase(state);
  if (phase === "Meet") {
    const currentHeadIndex = state.players.findIndex((p) => p.isHead);
    const headIndex = currentHeadIndex >= 0 ? currentHeadIndex : state.activePlayerIndex;
    const nextHead = (headIndex + 1) % state.players.length;
    state.players.forEach((p) => {
      p.isHead = false;
    });
    state.players[nextHead].isHead = true;
    state.activePlayerIndex = nextHead;
    state.round += 1;
    state.phaseIndex = 0;
    state.revealUsed = false;
    state.exploreUsed = false;
    state.meetActions = 0;
    state.meetActionLimit = 0;
    state.lastAction = null;
    state.players.forEach((_, i) => {
      state.activePlayerIndex = i;
      drawPsyche(state, 2);
    });
    state.activePlayerIndex = nextHead;
    addLog(state, `Round ${state.round} begins. All Dreamers draw 2 Psyche.`);
    return;
  }
  state.phaseIndex += 1;
}

export function checkVictory(state) {
  if (state.acquiredPoints >= state.goalPoints) {
    state.status = "won";
    addLog(state, "The Dreamers wake up! You escaped the Dreamscape.");
  }
}

export function checkDefeat(state) {
  if (state.dreamDeck.length === 0 && state.acquiredPoints < state.goalPoints) {
    state.status = "lost";
    addLog(state, "The Dream Deck is exhausted. You never wake up.");
  }
}

export function acquireArchetype(state, player) {
  const archetype = state.activeArchetype;
  if (!archetype || !archetype.questProgress.every(Boolean)) return false;

  player.acquiredArchetypes.push(archetype);
  state.acquiredPoints += archetype.points;
  addLog(state, `${player.name} acquired ${archetype.name} (${archetype.points} pts).`);

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

  player.powerTokens -= 1;
  archetype.questProgress[questIndex] = true;
  addLog(state, `${player.name} completed quest: ${archetype.quests[questIndex]}.`);

  if (archetype.questProgress.every(Boolean)) {
    addLog(state, `${archetype.name} is ready to acquire!`);
  }
  return true;
}
