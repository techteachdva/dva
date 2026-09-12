import { createQuestTracker, canMarkQuest, recordQuestEvent } from "./quests.js";
import { buildHexBoard } from "./hex.js";
import { playSfx } from "./audio.js";
import { markTileRevealed, markTileForgotten, markDreamFeedNudge } from "./fx.js";
import { queueTileRevealFx, queueEncounterSpawnFx } from "./board-fx.js";
import { queueCardDraw, queueHandDelta } from "./card-fx.js";
import {
  createSubconscious,
  repressCard,
  repressCards,
  subconsciousCount,
  normalizeSubconscious,
  repressFromMindstreamSetup,
  isDreambeastPsycheCard,
  repressTopMindstreamFromEachDeck,
} from "./subconscious.js";
import {
  handLimitForPlayer,
  handRoomForPsycheDraw,
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
  uid,
  PSYCHE_STARTING_HAND,
} from "./data.js";
import { discardToMindstream, pullObjectFromMindstream, objectForPlayer, reshuffleMindstreamDiscardIfNeeded } from "./mindstream-supply.js";
import { psycheHandCount, hasPsycheHealth } from "./psyche.js";
import {
  grantPowerTokens,
  spendPowerTokens,
  resolvePsychePowerCard,
  resolvePowerCardsInHand,
  resolveAllPowerCardsInHands,
} from "./power-tokens.js";

export function createInitialState(data, options) {
  const length = LENGTHS[options.lengthKey];
  const landscapes = data.landscapes.filter((l) => !l.hidden);

  const usedDreamerIds = new Set(options.selectedDreamers.map((d) => d.id));
  const availableDreamers = data.dreamers.filter((d) => !usedDreamerIds.has(d.id));

  const board = buildHexBoard(landscapes);

  const psycheDeck = buildPsycheDeck(data.psyche);
  const dreamDeck = insertBossDreams(buildDreamDeck(data.dreams, length.dreams), data.dreambeasts);
  const archetypeDeck = shuffle(data.archetypes.map((a) => ({ ...a, instanceId: uid("arch") })));
  const mindstreamDecks = buildMindstreamDecks(data.mindstream, data.dreambeasts, data.objects);
  const mindstreamDiscard = { lucidity: [], elasticity: [], willpower: [] };
  const subconscious = createSubconscious();

  function dealStartingPsyche(count) {
    const hand = [];
    const deferred = [];
    let guard = psycheDeck.length + deferred.length + 1;
    while (hand.length < count && guard-- > 0) {
      if (!psycheDeck.length && deferred.length) {
        psycheDeck.push(...deferred.splice(0));
      }
      if (!psycheDeck.length) break;
      const card = psycheDeck.shift();
      if (card.type === "psyche-power") deferred.push(card);
      else hand.push(card);
    }
    if (deferred.length) psycheDeck.unshift(...deferred);
    return hand;
  }

  const players = options.selectedDreamers.map((dreamer, index) => ({
    id: uid("player"),
    name: dreamer.name,
    dreamer,
    landscapeId: "bed",
    powerTokens: 0,
    hand: dealStartingPsyche(PSYCHE_STARTING_HAND),
    objects: [],
    persistent: [],
    acquiredArchetypes: [],
    isHead: index === 0,
    alive: true,
    pendingRespawn: false,
    deathCount: 0,
  }));

  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    repressFromMindstreamSetup({ mindstreamDecks, subconscious }, suit, players.length);
  });

  const activeArchetype = archetypeDeck.shift();
  activeArchetype.questProgress = [false, false];
  activeArchetype.powerTokensOnArchetype = 0;

  const state = {
    phaseIndex: 0,
    round: 1,
    lengthKey: options.lengthKey,
    goalPoints: length.points,
    dreamDeck,
    psycheDeck,
    psycheDiscard: [],
    archetypeDeck,
    mindstreamDecks,
    mindstreamDiscard,
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
    lastMeetActionByPlayer: {},
    pendingPowerBonus: 0,
    tradeMode: false,
    viewingDeck: null,
    availableDreamers,
    allDreamers: data.dreamers,
    questTracker: createQuestTracker(),
    questConditionsMet: {},
    gameStartedAt: Date.now(),
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
    abductionCarried: [],
    meetOnlyRound: false,
    bargainingDream: false,
    temptationDream: false,
    wanderlustTarget: 0,
    wanderlustMoves: 0,
    pickEncounterOnSpawn: false,
    skipExploreNextRound: false,
    rivalryEncountersOnBed: 0,
    rivalryLeftover: 0,
    paradoxMeet: false,
    chaseDream: false,
    chaseTrapped: [],
    skipLandscapeActionsNextMeet: false,
    pendingDreamerPower: null,
    cancellableDiscard: null,
    cancellableMove: null,
    pendingDeathChoice: null,
    pendingNothingChoice: null,
  };

  resetPhaseFlags(state);
  state.phaseIndex = 0;
  addLog(state, `Round ${state.round}: Reveal Phase — each Dreamer begins with ${PSYCHE_STARTING_HAND} Psyche.`);
  players.forEach((player) => {
    grantPowerTokens(state, player, 1, {
      reason: `${player.name} begins with 1 Power Token.`,
      logQuest: false,
      animate: false,
    });
  });
  resolveAllPowerCardsInHands(state);
  state.checkPsycheDeath = (player) => checkDreamerPsycheDeath(state, player);
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
      addLog(state, "Psyche discard pile shuffled into a new deck.");
    }
    if (!state.psycheDeck.length) break;
    const card = state.psycheDeck.shift();

    if (card.type === "psyche-power") {
      resolvePsychePowerCard(state, player, card);
      continue;
    }

    const limit = handLimitForPlayer(state, player);
    if (psycheHandCount(player) < limit) {
      player.hand.push(card);
      drawn.push(card);
    } else {
      state.psycheDiscard.push(card);
    }
  }
  if (drawn.length) {
    queueCardDraw(player.id, drawn, "psyche");
    queueHandDelta(player.id, drawn.length);
    playSfx("draw", { count: drawn.length });
  }
  return drawn;
}

export function drawPsyche(state, count = 1) {
  return drawPsycheForPlayer(state, activePlayer(state), count);
}

export function drawMindstream(state, suit, count = 1) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    reshuffleMindstreamDiscardIfNeeded(state, suit);
    const deck = state.mindstreamDecks[suit];
    if (!deck.length) break;
    drawn.push(deck.shift());
  }
  if (drawn.length) playSfx("draw", { count: drawn.length });
  return drawn;
}

export function repressPsycheToSubconscious(state, cards) {
  repressCards(state, cards);
}

export function drawObject(state, player, count = 1, helpers = null) {
  if (helpers) return drawObjects(state, player, count, helpers);
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const pulled = pullObjectFromMindstream(state);
    if (!pulled) break;
    const card = objectForPlayer(pulled.card);
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
    queueEncounterSpawnFx(landscapeId, encounter, tile.suit || encounter.suit);
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
  state.lastMeetActionByPlayer = {};
  state.pendingPowerBonus = 0;
  state.selectedHand = [];
  state.tradeMode = false;
  state.trade = null;
  state.questRoundFlags = { discardedOnBed: false };
  state.abductionCarried = [];
  state.meetOnlyRound = false;
  state.bargainingDream = false;
  state.temptationDream = false;
  state.wanderlustTarget = 0;
  state.wanderlustMoves = 0;
  state.pickEncounterOnSpawn = false;
  state.skipExploreNextRound = false;
  state.rivalryEncountersOnBed = 0;
  state.rivalryLeftover = 0;
  state.paradoxMeet = false;
  state.chaseDream = false;
  state.chaseTrapped = [];
  state.skipLandscapeActionsNextMeet = false;
}

export function beginRoundReveal(state) {
  resetPhaseFlags(state);
  state.phaseIndex = 0;

  state.players.forEach((player) => {
    if (!player.alive) return;
    if (!hasPsycheHealth(player)) {
      handleDreamerDeath(state, player);
      return;
    }
    drawPsycheForPlayer(state, player, 2);
    const extra = extraPsycheDrawAtRoundStart(state, player);
    if (extra) drawPsycheForPlayer(state, player, extra);
  });

  addLog(state, `Round ${state.round}: Reveal — each Dreamer draws 2 Psyche.`);
}

const MAX_DREAMER_DEATHS = 5;
const RESPAWN_PSYCHE_BY_DEATH = [4, 3, 2, 1];

export function deathAvoidTokenCost(state) {
  const alive = state.players.filter((p) => p.alive).length;
  return Math.max(1, Math.floor(alive / 2));
}

function respawnPsycheTarget(deathCount) {
  return RESPAWN_PSYCHE_BY_DEATH[deathCount - 1] ?? 0;
}

function clearPlayerHandOnDeath(state, player) {
  while (player.hand.length) {
    const card = player.hand.pop();
    if (isDreambeastPsycheCard(card)) {
      repressCard(state, card);
    } else {
      if (!state.psycheDiscard) state.psycheDiscard = [];
      state.psycheDiscard.push(card);
    }
  }
}

function discardPlayerObjects(state, player) {
  const objects = [...(player.objects || []), ...(player.persistent || [])];
  objects.forEach((obj) => discardToMindstream(state, obj));
  player.objects = [];
  player.persistent = [];
}

export function applyDreamerDeath(state, player) {
  state.pendingDeathChoice = null;

  const deaths = (player.deathCount || 0) + 1;
  player.deathCount = deaths;

  repressTopMindstreamFromEachDeck(state);
  discardPlayerObjects(state, player);
  player.powerTokens = 0;
  clearPlayerHandOnDeath(state, player);
  player.landscapeId = "bed";

  if (deaths >= MAX_DREAMER_DEATHS) {
    player.alive = false;
    addLog(state, `${player.name} is lost to the Dreamscape forever (${MAX_DREAMER_DEATHS} deaths).`);
    if (state.availableDreamers?.length) {
      state.pendingRespawn = player.id;
      addLog(state, "Choose a new Dreamer to continue.");
    }
    return;
  }

  const target = respawnPsycheTarget(deaths);
  drawPsycheForPlayer(state, player, target);
  resolvePowerCardsInHand(state, player);
  grantPowerTokens(state, player, 2, {
    reason: `${player.name} returns with 2 Power Tokens.`,
    logQuest: false,
    animate: false,
  });

  state.pendingDeathAdditionalDream = true;
  addLog(
    state,
    `${player.name} dies (${deaths}/${MAX_DREAMER_DEATHS}) — Repressed top of each Mindstream deck; objects and Power lost. Returns to The Bed with ${target} Psyche and 2 Power. An Additional Dream resolves.`,
  );
}

export function offerDreamerDeathChoice(state, player) {
  if (!player?.alive || hasPsycheHealth(player)) return false;
  if (state.pendingDeathChoice?.playerId === player.id) return true;

  const cost = deathAvoidTokenCost(state);
  if ((player.powerTokens || 0) >= cost) {
    state.pendingDeathChoice = { playerId: player.id, cost };
    addLog(
      state,
      `${player.name} has no Psyche! Spend ${cost} Power Token${cost === 1 ? "" : "s"} to draw 1 Psyche and survive, or accept death.`,
    );
    return true;
  }

  applyDreamerDeath(state, player);
  return true;
}

export function avoidDreamerDeath(state) {
  const pending = state.pendingDeathChoice;
  if (!pending) return false;

  const player = state.players.find((p) => p.id === pending.playerId);
  if (!player?.alive) {
    state.pendingDeathChoice = null;
    return false;
  }

  const spent = spendPowerTokens(state, player, pending.cost, {
    reason: `${player.name} spends ${pending.cost} Power Token${pending.cost === 1 ? "" : "s"} to cling to the Dream.`,
  });
  if (!spent) return false;

  state.pendingDeathChoice = null;
  drawPsycheForPlayer(state, player, 1);

  if (!hasPsycheHealth(player)) {
    applyDreamerDeath(state, player);
  } else {
    addLog(state, `${player.name} draws 1 Psyche and stays in the Dream.`);
  }
  return true;
}

export function acceptDreamerDeath(state) {
  const pending = state.pendingDeathChoice;
  if (!pending) return false;

  const player = state.players.find((p) => p.id === pending.playerId);
  state.pendingDeathChoice = null;
  if (!player) return false;

  applyDreamerDeath(state, player);
  return true;
}

export function checkDreamerPsycheDeath(state, player) {
  if (!player?.alive || hasPsycheHealth(player)) return false;
  return offerDreamerDeathChoice(state, player);
}

export function handleDreamerDeath(state, player) {
  offerDreamerDeathChoice(state, player);
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
  player.deathCount = 0;
  player.powerTokens = 0;
  player.hand = [];
  grantPowerTokens(state, player, 2, { reason: `${dreamer.name} returns with 2 Power Tokens.`, logQuest: false, animate: false });
  drawPsycheForPlayer(state, player, PSYCHE_STARTING_HAND);
  resolvePowerCardsInHand(state, player);
  player.pendingRespawn = false;
  state.pendingRespawn = null;
  addLog(state, `${dreamer.name} enters the Dreamscape on The Bed with ${PSYCHE_STARTING_HAND} Psyche and 2 Power.`);
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
  markDreamFeedNudge();
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
    addLog(state, "Explore Phase — one Dreamer spends Elasticity to unlock shared moves.");
  } else if (getPhase(state) === "Meet") {
    const meetHere = state.board?.find((t) =>
      t.revealed && t.encounter && state.players.some((p) => p.alive && p.landscapeId === t.id),
    );
    if (meetHere) state.selectedLandscapeId = meetHere.id;
    addLog(state, "Meet Phase — one Dreamer spends Willpower for shared Actions; Encounters are Met by the Dreamer on that Landscape.");
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

export function allDreamersOnBed(state) {
  const alive = state.players.filter((p) => p.alive);
  return alive.length > 0 && alive.every((p) => p.landscapeId === "bed");
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
    if (allDreamersOnBed(state)) {
      state.status = "won";
      addLog(state, "The Dreamers wake up! You escaped the Dreamscape.");
    } else if (!state.victoryPendingLogged) {
      state.victoryPendingLogged = true;
      addLog(state, "Archetype goal reached! All Dreamers must return to the Bed to wake up.");
    }
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
  addLog(state, `${player.name} acquired ${archetype.name} (+${archetype.points} Archetype pts).`);

  if (onAcquireFn) onAcquireFn(state, archetype, player);

  state.activeArchetype = state.archetypeDeck.shift() || null;
  if (state.activeArchetype) {
    state.activeArchetype.questProgress = [false, false];
    state.activeArchetype.powerTokensOnArchetype = 0;
  }

  checkVictory(state);
  return true;
}

export function completeQuest(state, questIndex, player, onAcquireFn) {
  const archetype = state.activeArchetype;
  if (!archetype || archetype.questProgress[questIndex]) return false;
  if (player.powerTokens < 1) {
    addLog(state, "Spend 1 Power Token to complete this Quest.");
    return false;
  }

  const check = canMarkQuest(state, questIndex);
  if (!check.ok) {
    addLog(state, check.reason);
    return false;
  }

  spendPowerTokens(state, player, 1);
  archetype.questProgress[questIndex] = true;
  archetype.powerTokensOnArchetype = (archetype.powerTokensOnArchetype || 0) + 1;
  addLog(state, `${player.name} placed a Power Token on ${archetype.name}: ${archetype.quests[questIndex]}.`);

  if (archetype.questProgress.every(Boolean)) {
    acquireArchetype(state, player, onAcquireFn);
    return "acquired";
  }
  return "quest";
}

export { forgetLandscapes } from "./landscapes.js";

export function revealLandscapeTile(state, tile) {
  if (!tile.revealed) {
    tile.revealed = true;
    tile.wasteland = false;
    addLog(state, `Revealed ${tile.name}.`);
    markTileRevealed(tile.id);
    queueTileRevealFx(tile.id);
    playSfx("reveal");
  } else if (tile.wasteland) {
    tile.wasteland = false;
    addLog(state, `Restored ${tile.name} from Wasteland.`);
    markTileRevealed(tile.id);
    queueTileRevealFx(tile.id);
    playSfx("reveal");
  }
}
