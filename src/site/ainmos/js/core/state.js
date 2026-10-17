import { openLostFound } from "../shop/lost-found.js";
import { rollChaoticValue, PSYCHE_UPGRADES, applyPsycheUpgrade } from "../cards/dream-forms.js";
import { resetDreamscape } from "../board/landscapes.js";
import { finalBossForLength } from "../encounters/boss-ladder.js";
import { createQuestTracker, recordQuestEvent, isQuestConditionMet } from "../dreamers/quests.js";
import { FINAL_ARCHETYPE_POWER } from "../dreamers/final-recurrence-rules.js";
import { buildHexBoard, adjacentTiles, hexDistance } from "./hex.js";
import {
  BOARD_MODES,
  buildLandscapeTileDeck,
  refillVault,
  resetVaultRoundCounters,
  isFreeformBoard,
  vaultExhausted,
} from "../board/dreamscape-vault.js";
import { effectiveDreamerStat } from "../dreamers/archetype-stats.js";
import { playSfx } from "../audio/audio.js";
import { markTileRevealed, markTileForgotten, markDreamFeedNudge } from "../ui/fx.js";
import { queueTileRevealFx, queueEncounterSpawnFx, queueDreamerDeathFx, queueReshuffleFx } from "../board/board-fx.js";
import { queueCardDraw, queueHandDelta } from "../cards/card-fx.js";
import {
  createSubconscious,
  repressCard,
  repressCards,
  subconsciousCount,
  normalizeSubconscious,
  repressFromMindstreamSetup,
  isDreambeastPsycheCard,
} from "../dreamers/subconscious.js";
import {
  handLimitForPlayer,
  handRoomForPsycheDraw,
  extraPsycheDrawAtRoundStart,
  drawObjects,
} from "../effects/objects.js";
import {
  LENGTHS,
  PHASES,
  shuffle,
  buildPsycheDeck,
  psycheConfigFor,
  psycheDeckSizeFor,
  buildDreamDeck,
  insertBossDreams,
  buildMindstreamDecks,
  buildObjectDecks,
  makeExtraPsycheCards,
  goalPointsForTable,
  uid,
  PSYCHE_STARTING_HAND,
  DREAM_DRAW,
  SUBCONSCIOUS_START,
} from "./data.js";
import { discardToMindstream, pullObjectFromMindstream, objectForPlayer, reshuffleMindstreamDiscardIfNeeded, stampBeastMillTile } from "../cards/mindstream-supply.js";
import { psycheHandCount, hasPsycheHealth } from "../cards/psyche.js";
import {
  grantPowerTokens,
  spendPowerTokens,
  STARTING_POWER_TOKENS,
  resolvePowerCardsInHand,
  resolveAllPowerCardsInHands,
} from "../cards/power-tokens.js";
import { applyMeetStartTax, stepBeastsTowardDreamers } from "../encounters/meet-phase.js";
import { stepArchetypesAway, archetypeBoon, ARCHETYPE_TOKEN_REWARD, ARCHETYPE_RETURN } from "../dreamers/archetype-board.js";
import { autoReturnPsyche } from "../dreamers/subconscious.js";
import { seedRandomness, mintSeedSuffix, specialSeedFlag, buildGameId, normalizeSeedInput, random } from "./rng.js";
import { snapshotDeckCaps } from "../cards/deck-pressure.js";
import { stampBeastForCycle } from "../encounters/beast-wards.js";
import { cyclePosition } from "./cycle.js";
import { ensureEndlessDeck, startEndless } from "../encounters/endless.js";
import { offerEffectChoice, registerEffectResolver } from "../effects/effect-choices.js";
import { logMoment } from "./narrator.js";
import { buildArchetypeEventCatalog } from "../dreamers/archetype-events.js";

function pinFirstById(list, id) {
  const index = list.findIndex((item) => item.id === id);
  if (index <= 0) return;
  const [card] = list.splice(index, 1);
  list.unshift(card);
}

function pinOpeningDream(dreamDeck, dreams, id) {
  if (dreamDeck[0]?.id === id) return;
  const index = dreamDeck.findIndex((card) => card.id === id);
  if (index > 0) {
    const swap = dreamDeck[0];
    dreamDeck[0] = dreamDeck[index];
    dreamDeck[index] = swap;
    return;
  }
  const template = dreams?.find((dream) => dream.id === id);
  if (template) {
    dreamDeck[0] = { ...template, instanceId: uid("dream") };
  }
}

/** FANTASY / NIGHTMARE seeds: float that beast kind to the top of every Mindstream deck. */
function stackBeastKindToTop(mindstreamDecks, kind) {
  Object.keys(mindstreamDecks).forEach((suit) => {
    const deck = mindstreamDecks[suit];
    if (!Array.isArray(deck)) return;
    const favored = deck.filter((c) => c.type === "dreambeast" && c.beastKind === kind);
    if (!favored.length) return;
    const rest = deck.filter((c) => !favored.includes(c));
    mindstreamDecks[suit] = [...favored, ...rest];
  });
}

/**
 * Ainmos 0.27 scenario seeds that reshape the Psyche deck:
 * OOPS every suited card is a 1; JILLY every card (Wilds too) is a 4;
 * BUBBLEGUM every card carries a random upgrade (Wilds can't take one).
 */
function applyPsycheSeedCodes(deck, seedFlags) {
  if (seedFlags.oops) {
    deck.forEach((card) => {
      if (card.wild) return;
      card.value = 1;
      card.name = `${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)} 1`;
    });
  }
  if (seedFlags.jilly) {
    deck.forEach((card) => {
      card.value = 4;
      if (card.wild) card.text = "Counts as 4 of any suit.";
      else card.name = `${card.suit.charAt(0).toUpperCase()}${card.suit.slice(1)} 4`;
    });
  }
  if (seedFlags.bubblegum) {
    const upgrades = Object.keys(PSYCHE_UPGRADES);
    const suits = ["lucidity", "elasticity", "willpower"];
    deck.forEach((card) => {
      if (card.wild) return;
      const upgrade = upgrades[Math.floor(random() * upgrades.length)];
      const others = suits.filter((s) => s !== card.suit);
      applyPsycheUpgrade(card, upgrade, { vividSuit: others[Math.floor(random() * others.length)] });
    });
  }
}

export function createInitialState(data, options) {
  const length = LENGTHS[options.lengthKey];
  const landscapes = data.landscapes.filter((l) => !l.hidden);

  const seed = seedRandomness(normalizeSeedInput(options.seed) || mintSeedSuffix());
  const seedFlag = specialSeedFlag(seed);
  const seedFlags = {
    somnia: seedFlag === "somnia",
    dmzemo: seedFlag === "dmzemo",
    spark: seedFlag === "spark",
    fantasy: seedFlag === "fantasy",
    nightmare: seedFlag === "nightmare",
    rem: seedFlag === "rem",
    oops: seedFlag === "oops",
    jilly: seedFlag === "jilly",
    rowan: seedFlag === "rowan",
    lemon: seedFlag === "lemon",
    bubblegum: seedFlag === "bubblegum",
    somniainmos: seedFlag === "somniainmos",
    leviathan: seedFlag === "leviathan",
  };

  const usedDreamerIds = new Set(options.selectedDreamers.map((d) => d.id));
  const availableDreamers = data.dreamers.filter((d) => !usedDreamerIds.has(d.id));

  const tutorialLayout = Boolean(options.tutorialMode);
  // The tutorial teaches the Fixed Board.
  // Ainmos: every night is built on a Freeform Board.
  const boardMode = BOARD_MODES.FREEFORM;
  const freeform = boardMode === BOARD_MODES.FREEFORM;
  const board = buildHexBoard(landscapes, {
    tutorialLayout,
    revealRing1: seedFlags.somnia && !tutorialLayout && !freeform,
    freeform,
  });
  const openingNeighbor = tutorialLayout
    ? null
    : board.find((t) => !t.center && t.revealed && !t.wasteland);

  const psycheConfig = psycheConfigFor(data.psyche, options.lengthKey);
  const psycheDeck = buildPsycheDeck(psycheConfig);
  applyPsycheSeedCodes(psycheDeck, seedFlags);
  const dreamDeck = insertBossDreams(buildDreamDeck(data.dreams, length.dreams), data.dreambeasts, options.lengthKey);
  const nightmarePool = (dreamDeck.nightmarePool || []).map((beast) => ({ ...beast, instanceId: uid("beast") }));
  delete dreamDeck.nightmarePool;
  // The Night Bar reads this plan: every card of the night, in order, with its Cycle.
  const nightPlan = dreamDeck.map((card, index) => ({
    kind: card.type === "archetype-dream" ? "archetype" : card.boss ? "beast" : "dream",
    instanceId: card.instanceId,
    boss: !!card.boss,
    bossId: card.boss ? card.id : null,
    name: card.name,
    image: card.image,
    suit: card.boss ? card.suit : null,
    ante: Math.floor(index / 3) + 1,
    mini: card.miniBoss
      ? { id: card.miniBoss.id, name: card.miniBoss.name, image: card.miniBoss.image, suit: card.miniBoss.suit, power: card.miniBoss.accept }
      : null,
  }));
  const archetypeDeck = shuffle(data.archetypes.map((a) => ({ ...a, instanceId: uid("arch") })));
  const mindstreamDecks = buildMindstreamDecks(data.mindstream, data.dreambeasts);
  const mindstreamDiscard = { lucidity: [], elasticity: [], willpower: [] };
  const objectDecks = buildObjectDecks(data.objects);
  const objectDiscard = { lucidity: [], elasticity: [], willpower: [] };
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

  const extras = shuffle(makeExtraPsycheCards(options.selectedDreamers.length));
  if (extras.length) {
    psycheDeck.push(...extras);
    const mixed = shuffle(psycheDeck.splice(0));
    psycheDeck.push(...mixed);
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

  // Ainmos 0.23: the night opens with Psyche already Repressed. Twelve random
  // cards from the Waking Mind wait in the Subconscious to be Returned.
  for (let i = 0; i < SUBCONSCIOUS_START && psycheDeck.length; i += 1) {
    subconscious.psyche.push(psycheDeck.shift());
  }

  // FANTASY / NIGHTMARE seeds stack AFTER the opening repress so the
  // favored Dreambeasts genuinely sit on top of each Mindstream deck.
  if (seedFlags.fantasy || seedFlags.nightmare) {
    stackBeastKindToTop(mindstreamDecks, seedFlags.fantasy ? "fantasy" : "nightmare");
  }

  if (options.gentleStart) {
    pinFirstById(archetypeDeck, "innocent");
    pinOpeningDream(dreamDeck, data.dreams, "quiet");
  }

  // Ainmos: no Archetype row or quests. Archetypes come out one per Cycle, onto the board.
  const archetypeRow = [];
  const activeArchetype = null;
  // Every Archetype Event (2 per home Landscape). Each Archetype draws from the 4 tied to its homes.
  const eventCatalog = buildArchetypeEventCatalog(data);

  const state = {
    phaseIndex: 0,
    round: 1,
    lengthKey: options.lengthKey,
    guided: !!options.guided,
    coachSeen: [],
    boonCatalog: (data.archetypes || []).map((a) => ({ ...a })),
    boons: [],
    pendingBoonDraft: null,
    nightPlan,
    nightmarePool,
    finalBossId: finalBossForLength(options.lengthKey)?.id || null,
    bossesDefeated: [],
    longNight: false,
    boardMode,
    landscapeTileDeck: freeform ? buildLandscapeTileDeck(landscapes) : [],
    landscapeVault: [],
    landscapesSetAside: [],
    vaultRefreshesThisRound: 0,
    anteIntroSeen: 0,
    minisDefeated: 0,
    seed,
    seedFlags,
    gameId: buildGameId(openingNeighbor?.name, seed),
    remFree: { reveal: false, explore: false, meet: false },
    goalPoints: goalPointsForTable(options.lengthKey, players.length),
    scoringGoalPoints: goalPointsForTable(options.lengthKey, players.length),
    archetypeGoalReached: false,
    dreamDeck,
    psycheDeck,
    psycheDiscard: [],
    archetypeDeck,
    mindstreamDecks,
    mindstreamDiscard,
    objectDecks,
    objectDiscard,
    subconscious,
    board,
    players,
    activePlayerIndex: 0,
    activeArchetype,
    archetypeRow,
    activeEncounter: null,
    activeEncounterLandscapeId: null,
    activeDream: null,
    acquiredPoints: 0,
    deathClock: 0,
    psycheDeckSize: psycheDeckSizeFor(psycheConfig),
    goalBedSprintUsed: false,
    selectedHand: [],
    selectedLandscapeId: "bed",
    log: [
      seedFlags.somnia
        ? `Lucid start (${buildGameId(openingNeighbor?.name, seed)}): the whole inner ring begins Revealed around The Bed. Enter this Game ID as a seed to replay this dream.`
        : openingNeighbor
          ? `The Dreamscape is shuffled (${buildGameId(openingNeighbor.name, seed)}). Only ${openingNeighbor.name} is Revealed beside The Bed; every other Landscape starts forgotten.`
          : "The Dreamscape forms around The Bed...",
    ],
    status: "playing",
    finalRecurrence: false,
    dreamDrawn: false,
    dreamDiscard: [],
    revealLandscapeUsed: false,
    exploreMovesLeft: 0,
    exploreActivated: false,
    meetActionBudget: 0,
    meetActionsUsed: 0,
    usedMeetActionsByPlayer: {},
    usedUniqueActionsThisMeet: [],
    lastMeetActionByPlayer: {},
    lastPhaseOpenerId: null,
    phaseOpenersThisRound: [],
    meetPassHolderId: null,
    freshlyRepressedInstanceIds: [],
    visionaryPeekUsed: false,
    runnerFreeMoveUsed: false,
    immovableTaxUsed: false,
    hunterShoveUsed: false,
    weaverSwapUsed: false,
    pendingPowerBonus: 0,
    pendingPowerBonusTokens: 0,
    phaseTokenAsPsyche: null,
    tradeMode: false,
    viewingDeck: null,
    availableDreamers,
    allDreamers: data.dreamers,
    questTracker: createQuestTracker(),
    questConditionsMet: {},
    gameStartedAt: Date.now(),
    questRoundFlags: { discardedOnBed: false },
    finalArchetypes: [],
    eventCatalog,
    archetypeEventDecks: {},
    pendingArchetypeChoice: null,
    archetypeFight: null,
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
    onlyPhaseThisRound: null,
    blockedForms: null,
    bargainingDream: false,
    temptationDream: false,
    wanderlustTarget: 0,
    wanderlustMoves: 0,
    pickEncounterOnSpawn: false,
    skipExploreNextRound: false,
    skipExploreReason: null,
    rivalryEncountersOnBed: 0,
    rivalryLeftover: 0,
    chaseDream: false,
    chaseTrapped: [],
    skipLandscapeActionsNextMeet: false,
    pendingDreamerPower: null,
    cancellableDiscard: null,
    cancellableMove: null,
    anchorMeetSpreadBonus: 0,
    anchorMeetSpreadPending: 0,
    pendingDeathChoice: null,
    pendingNothingChoice: null,
    pendingObjectChoice: null,
    pendingObjectFollowup: null,
    forcedAccept: null,
    pendingDreamChoice: null,
    pendingDreamQueue: [],
    pendingEffectChoice: null,
    pendingMindstreamChoice: null,
    pendingMindstreamMeet: null,
    skipNextDreamDraw: false,
    revealedDeckTops: {},
    encounterSpawnSeq: 0,
  };

  snapshotDeckCaps(state);
  refillVault(state);
  resetPhaseFlags(state);
  state.phaseIndex = 0;
  addLog(state, `Round ${state.round}: Reveal Phase — each Dreamer begins with ${PSYCHE_STARTING_HAND} Psyche.`);
  players.forEach((player) => {
    const startingTokens = STARTING_POWER_TOKENS;
    grantPowerTokens(state, player, startingTokens, {
      source: "start",
      reason: `${player.name} begins with ${startingTokens} Power Token${startingTokens === 1 ? "" : "s"}.`,
      logQuest: false,
      animate: false,
    });
  });
  if (state.tutorialMode) resolveAllPowerCardsInHands(state);
  state.checkPsycheDeath = (player, opts) => checkDreamerPsycheDeath(state, player, opts);
  if (seedFlags.lemon && !state.tutorialMode) beginLemonNight(state, data);
  return state;
}

/**
 * LEMON seed: every Archetype is already yours (points, tokens, and powers), and
 * the night goes straight into Endless Mode, where each Cycle ends with the next
 * enhanced Leviathan, up to L3V1@+H@N D3$TR0Y3R 0F DR3@M$.
 */
function beginLemonNight(state, data) {
  const player = state.players.find((p) => p.alive);
  if (!player) return;
  [...(state.archetypeDeck || [])].forEach((arch) => acquireArchetypeFromDeck(state, player, arch.id));
  state.status = "playing";
  state.dreamDeck = [];
  state.nightPlan = [];
  startEndless(state, { beastCatalog: Object.fromEntries((data.dreambeasts || []).map((b) => [b.id, b])) });
  if (state.deckCaps) state.deckCaps.dream = state.dreamDeck.length;
  addLog(state, "Lemon: every Archetype is yours. The Leviathans are coming.");
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

/** 41.0: Final Recurrence lasts this many rounds once it begins. */
export const FINAL_RECURRENCE_ROUNDS = 3;
/** 41.0: Final Recurrence summons this many Archetypes (the cheapest left), whatever the table size. */
export const FINAL_RECURRENCE_ARCHETYPES = 2;

/** 41.0: three Archetypes are face up. Acquire whichever one's quests come true first. */
export const ARCHETYPE_ROW_SIZE = 3;

function freshRowArchetype(arch) {
  if (!arch) return arch;
  arch.questProgress = [false, false];
  arch.powerTokensOnArchetype = 0;
  return arch;
}

/** 2- and 3-point Archetypes open the night; the boss-gated 4-pointers sit in the bottom half. */
function orderArchetypeDeckForRow(deck) {
  const low = deck.filter((a) => (a.points || 0) < 4);
  const high = deck.filter((a) => (a.points || 0) >= 4);
  const opening = low.slice(0, ARCHETYPE_ROW_SIZE);
  const rest = shuffle([...low.slice(ARCHETYPE_ROW_SIZE), ...high]);
  const half = Math.ceil(rest.length / 2);
  // Keep 4-pointers out of the first half of what remains.
  const restLow = rest.filter((a) => (a.points || 0) < 4);
  const restHigh = rest.filter((a) => (a.points || 0) >= 4);
  const top = restLow.slice(0, Math.max(0, half));
  const bottom = shuffle([...restLow.slice(half), ...restHigh]);
  deck.splice(0, deck.length, ...opening, ...top, ...bottom);
}

/** The face-up Archetypes. Keeps activeArchetype pointing at a row card. */
export function archetypeRowOf(state) {
  if (!Array.isArray(state.archetypeRow)) {
    state.archetypeRow = state.activeArchetype ? [state.activeArchetype] : [];
  }
  state.archetypeRow = state.archetypeRow.filter(Boolean);
  if (!state.activeArchetype || !state.archetypeRow.includes(state.activeArchetype)) {
    state.activeArchetype = state.archetypeRow[0] || null;
  }
  return state.archetypeRow;
}

export function refillArchetypeRow(state) {
  const row = archetypeRowOf(state);
  while (row.length < ARCHETYPE_ROW_SIZE && state.archetypeDeck?.length) {
    row.push(freshRowArchetype(state.archetypeDeck.shift()));
  }
  if (!state.activeArchetype || !row.includes(state.activeArchetype)) state.activeArchetype = row[0] || null;
  return row;
}

export function focusRowArchetype(state, archetypeId) {
  const row = archetypeRowOf(state);
  const hit = row.find((a) => a.id === archetypeId);
  if (hit) state.activeArchetype = hit;
  return hit || null;
}

/** Row Archetype whose quests are both already true (focused one first). */
export function readyRowArchetype(state) {
  const row = archetypeRowOf(state);
  const ordered = [state.activeArchetype, ...row.filter((a) => a !== state.activeArchetype)].filter(Boolean);
  return ordered.find((arch) => (arch.quests || []).length
    && arch.quests.every((quest) => isQuestConditionMet(state, arch.id, quest))) || null;
}

export function addLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, globalThis.__AINMOS_LOG_CAP || 40);
}

function peekCardSummary(card) {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    suit: card.suit,
    value: card.value,
    image: card.image,
    text: card.text,
    isWild: card.isWild,
    isDreambeast: card.isDreambeast,
  };
}

export function pileForDeckKey(state, deckKey) {
  if (deckKey === "psyche") return state.psycheDeck || [];
  if (deckKey === "dream") return state.dreamDeck || [];
  if (deckKey === "archetype") return state.archetypeDeck || [];
  if (deckKey?.startsWith("mindstream-")) {
    const suit = deckKey.replace("mindstream-", "");
    return state.mindstreamDecks?.[suit] || [];
  }
  return [];
}

export function allLandscapesRevealed(state) {
  const outer = (state.board || []).filter((t) => !t.center && t.id !== "bed");
  if (isFreeformBoard(state)) {
    // Freeform: done only when nothing is left to place and nothing is Wasteland.
    return vaultExhausted(state) && outer.every((t) => t.revealed && !t.wasteland);
  }
  return outer.length > 0 && outer.every((t) => t.revealed && !t.wasteland);
}

export function syncRevealedTopsFromDeck(state, deckKey) {
  if (!state.revealedDeckTops) state.revealedDeckTops = {};
  const deck = pileForDeckKey(state, deckKey);
  const n = Math.min(state.revealedDeckTops[deckKey]?.length || 0, deck.length);
  if (!n) {
    delete state.revealedDeckTops[deckKey];
    return;
  }
  state.revealedDeckTops[deckKey] = deck.slice(0, n).map(peekCardSummary);
}

export function rememberRevealedTops(state, deckKey, cards) {
  if (!state.revealedDeckTops) state.revealedDeckTops = {};
  const incoming = (Array.isArray(cards) ? cards : [cards]).filter(Boolean);
  const deck = pileForDeckKey(state, deckKey);
  const want = Math.max(incoming.length, state.revealedDeckTops[deckKey]?.length || 0);
  const n = Math.min(want, deck.length);
  if (!n) {
    delete state.revealedDeckTops[deckKey];
    return;
  }
  state.revealedDeckTops[deckKey] = deck.slice(0, n).map(peekCardSummary);
}

/** Look at the next facedown card without turning it face-up on the pile. */
export function peekFacedownDeckCard(state, deckKey) {
  const deck = pileForDeckKey(state, deckKey);
  const shown = state.revealedDeckTops?.[deckKey]?.length || 0;
  if (shown >= deck.length) return null;
  return deck[shown] || null;
}

export function revealNextDeckCard(state, deckKey) {
  const deck = pileForDeckKey(state, deckKey);
  if (!deck.length) return null;
  if (!state.revealedDeckTops) state.revealedDeckTops = {};
  const current = state.revealedDeckTops[deckKey] || [];
  if (current.length >= deck.length) return null;
  const card = deck[current.length];
  state.revealedDeckTops[deckKey] = [...current, peekCardSummary(card)];
  return card;
}

export function consumeRevealedTop(state, deckKey, count = 1) {
  const list = state.revealedDeckTops?.[deckKey];
  if (!list?.length) return;
  list.splice(0, count);
  if (!list.length) delete state.revealedDeckTops[deckKey];
}

export function clearRevealedTops(state, deckKey) {
  if (state.revealedDeckTops) delete state.revealedDeckTops[deckKey];
}

export function refillPsycheDeckFromDiscard(state) {
  if (state.psycheDeck?.length) return false;
  if (!state.psycheDiscard?.length) return false;
  state.psycheDeck = shuffle(state.psycheDiscard);
  state.psycheDiscard = [];
  clearRevealedTops(state, "psyche");
  queueReshuffleFx("psyche");
  addLog(state, "Psyche discard pile shuffled into a new deck.");
  return true;
}

/** Repress the top of the Psyche Deck, reshuffling discard if needed. */
export function repressTopPsycheFromDeck(state, count = 5) {
  let taken = 0;
  for (let i = 0; i < count; i += 1) {
    refillPsycheDeckFromDiscard(state);
    if (!state.psycheDeck.length) break;
    const card = state.psycheDeck.shift();
    consumeRevealedTop(state, "psyche");
    repressCard(state, card, { fromDeck: "psyche" });
    taken += 1;
  }
  if (taken) {
    addLog(state, `Repressed the top ${taken} card${taken === 1 ? "" : "s"} of the Psyche Deck.`);
  }
  checkDefeat(state);
  return taken;
}

export function drawPsycheForPlayer(state, player, count = 1) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    refillPsycheDeckFromDiscard(state);
    if (!state.psycheDeck.length) break;
    const card = state.psycheDeck.shift();
    consumeRevealedTop(state, "psyche");

    if (card.type === "psyche-power") {
      const limit = handLimitForPlayer(state, player);
      if ((player.hand?.length || 0) < limit) {
        player.hand.push(card);
        drawn.push(card);
      } else {
        state.psycheDiscard.push(card);
      }
      continue;
    }

    const limit = handLimitForPlayer(state, player);
    if ((player.hand?.length || 0) < limit) {
      // Chaotic Psyche rolls its value each time it comes into a hand.
      if (card.upgrade === "chaotic") rollChaoticValue(card);
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
  checkDefeat(state);
  return drawn;
}

export function drawPsyche(state, count = 1) {
  return drawPsycheForPlayer(state, activePlayer(state), count);
}

export function drawMindstream(state, suit, count = 1) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const wasEmpty = !state.mindstreamDecks[suit]?.length;
    const reshuffled = reshuffleMindstreamDiscardIfNeeded(state, suit);
    if (wasEmpty && reshuffled) {
      addLog(state, `${suit[0].toUpperCase()}${suit.slice(1)} Mindstream discard shuffled into a new draw pile.`);
    }
    const deck = state.mindstreamDecks[suit];
    if (!deck.length) {
      checkDefeat(state);
      break;
    }
    drawn.push(deck.shift());
    consumeRevealedTop(state, `mindstream-${suit}`);
  }
  if (drawn.length) {
    const actor = activePlayer(state);
    if (actor) queueCardDraw(actor.id, drawn, `mindstream-${suit}`);
    playSfx("draw", { count: drawn.length });
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
    const pulled = pullObjectFromMindstream(state);
    if (!pulled) break;
    const card = objectForPlayer(pulled.card);
    player.objects.push(card);
    drawn.push(card);
  }
  return drawn;
}

export function encounterKey(encounter) {
  return encounter?.instanceId || encounter?.id || "";
}

/** All Dreambeasts/encounters on a landscape (no per-tile limit). */
export function tileEncounters(tile) {
  if (!tile) return [];
  if (!Array.isArray(tile.encounters)) {
    tile.encounters = tile.encounter ? [tile.encounter] : [];
    delete tile.encounter;
  }
  return tile.encounters;
}

export function tileHasEncounters(tile) {
  return tileEncounters(tile).length > 0;
}

export function encountersOnLandscape(state, landscapeId) {
  return tileEncounters(landscapeById(state, landscapeId));
}

export function findEncounterOnBoard(state, encounter) {
  const key = encounterKey(encounter);
  if (!key) return null;
  for (const tile of state.board || []) {
    const match = tileEncounters(tile).find((enc) => encounterKey(enc) === key);
    if (match) return { tile, encounter: match };
  }
  return null;
}

export function encounterOnLandscape(state, landscapeId) {
  const encounters = encountersOnLandscape(state, landscapeId);
  if (!encounters.length) return null;
  if (state.activeEncounterLandscapeId === landscapeId && state.activeEncounter) {
    const activeKey = encounterKey(state.activeEncounter);
    const match = encounters.find((enc) => encounterKey(enc) === activeKey);
    if (match) return match;
  }
  return encounters[0];
}

function isFightableBeast(card) {
  return !!card && (card.type === "dreambeast" || card.type === "boss-dream" || card.boss || card.miniBoss);
}

export function addEncounterOnLandscape(state, landscapeId, encounter) {
  const tile = landscapeById(state, landscapeId);
  if (!tile || !encounter) return null;
  const card = { ...encounter };
  if (!card.instanceId) card.instanceId = uid("enc");
  if (card.spawnOrder == null) {
    state.encounterSpawnSeq = (state.encounterSpawnSeq || 0) + 1;
    card.spawnOrder = state.encounterSpawnSeq;
  }
  // Ainmos 0.25: a fresh Dreambeast arrives warding one Form, at its Power + the Cycle.
  if (!state._movingEncounter && !state.tutorialMode && isFightableBeast(card)) {
    stampBeastForCycle(card, cyclePosition(state).cycle);
  }
  tileEncounters(tile).push(card);
  if (!state._movingEncounter) recordNightSpawn(state, card);
  state.activeEncounter = card;
  state.activeEncounterLandscapeId = landscapeId;
  stampBeastMillTile(state, landscapeId, card);
  queueEncounterSpawnFx(landscapeId, card, tile.suit || card.suit);
  return card;
}

/** Spawn an encounter on a landscape (stacks with existing occupants). */
export function setEncounterOnLandscape(state, landscapeId, encounter) {
  if (!encounter) {
    clearEncountersOnLandscape(state, landscapeId);
    return null;
  }
  return addEncounterOnLandscape(state, landscapeId, encounter);
}

export function removeEncounterFromLandscape(state, landscapeId, encounter) {
  const tile = landscapeById(state, landscapeId);
  if (!tile) return;
  const list = tileEncounters(tile);
  const key = encounterKey(encounter);
  const idx = list.findIndex((enc) => encounterKey(enc) === key);
  if (idx < 0) return;
  list.splice(idx, 1);
  if (state.activeEncounterLandscapeId === landscapeId && encounterKey(state.activeEncounter) === key) {
    state.activeEncounter = list[0] || null;
    if (!list.length) state.activeEncounterLandscapeId = null;
  }
}

export function clearEncountersOnLandscape(state, landscapeId) {
  const tile = landscapeById(state, landscapeId);
  if (!tile) return;
  tile.encounters = [];
  delete tile.encounter;
  if (state.activeEncounterLandscapeId === landscapeId) {
    state.activeEncounter = null;
    state.activeEncounterLandscapeId = null;
  }
}

export function moveEncounterBetweenLandscapes(state, fromId, toId, encounter) {
  const located = findEncounterOnBoard(state, encounter);
  const enc = located?.encounter || encounter;
  const from = located?.tile?.id || fromId;
  if (!enc || !from || !toId) return false;
  removeEncounterFromLandscape(state, from, enc);
  state._movingEncounter = true;
  try {
    addEncounterOnLandscape(state, toId, enc);
  } finally {
    state._movingEncounter = false;
  }
  return true;
}

/** Ainmos Night Strip: note a new Dreambeast against the Dream whose round it arrived in. */
function recordNightSpawn(state, card) {
  const plan = state.nightPlan;
  if (!plan?.length || !card) return;
  const drawn = plan.length - (state.dreamDeck?.length || 0);
  const entry = plan[Math.min(plan.length - 1, Math.max(0, drawn - 1))];
  if (!state.nightSpawns) state.nightSpawns = {};
  if (!state.nightSpawns[entry.instanceId]) state.nightSpawns[entry.instanceId] = [];
  state.nightSpawns[entry.instanceId].push({ suit: card.suit || null, boss: !!card.boss, name: card.name || "" });
}

export function countEncountersOnBoard(state, filterFn = () => true) {
  let count = 0;
  (state.board || []).forEach((tile) => {
    tileEncounters(tile).forEach((enc) => {
      if (filterFn(enc)) count += 1;
    });
  });
  return count;
}

/** Revealed, non-wasteland Landscapes (Dreambeasts may stack on any of these). */
export function revealedLandscapeTiles(state, { suit = null, landscapeIds = null } = {}) {
  let tiles = (state.board || []).filter((t) => t.revealed && !t.wasteland);
  if (suit) tiles = tiles.filter((t) => t.suit === suit);
  if (landscapeIds?.length) tiles = tiles.filter((t) => landscapeIds.includes(t.id));
  return tiles;
}

export function allEncountersOnBoard(state) {
  const out = [];
  (state.board || []).forEach((tile) => {
    tileEncounters(tile).forEach((encounter) => {
      out.push({ tile, encounter });
    });
  });
  return out;
}

export function resetPhaseFlags(state) {
  state.dreamDrawn = false;
  state.revealLandscapeUsed = false;
  state.exploreMovesLeft = 0;
  state.exploreActivated = false;
  state.meetActionBudget = 0;
  state.meetActionsUsed = 0;
  state.usedMeetActionsByPlayer = {};
  state.usedUniqueActionsThisMeet = [];
  state.lastMeetActionByPlayer = {};
  state.pendingPowerBonus = 0;
  state.pendingPowerBonusTokens = 0;
  state.phaseTokenAsPsyche = null;
  state.selectedHand = [];
  state.tradeMode = false;
  state.trade = null;
  state.questRoundFlags = { discardedOnBed: false };
  state.abductionCarried = [];
  state.meetOnlyRound = false;
  state.onlyPhaseThisRound = null;
  state.blockedForms = null;
  state.bargainingDream = false;
  state.temptationDream = false;
  state.wanderlustTarget = 0;
  state.wanderlustMoves = 0;
  state.pickEncounterOnSpawn = false;
  state.skipExploreNextRound = false;
  state.skipExploreReason = null;
  state.rivalryEncountersOnBed = 0;
  state.rivalryLeftover = 0;
  state.chaseDream = false;
  state.chaseTrapped = [];
  state.skipLandscapeActionsNextMeet = false;
  state.anchorMeetSpreadBonus = 0;
}

export function beginRoundReveal(state) {
  resetPhaseFlags(state);
  state.phaseIndex = 0;
  state.remFree = { reveal: false, explore: false, meet: false };
  state.lastPhaseOpenerId = null;
  state.phaseOpenersThisRound = [];
  state.meetPassHolderId = null;
  state.freshlyRepressedInstanceIds = [];
  state.visionaryPeekUsed = false;
  state.runnerFreeMoveUsed = false;
  state.immovableTaxUsed = false;
  state.hunterShoveUsed = false;
  state.weaverSwapUsed = false;
  resetVaultRoundCounters(state);
  // Ainmos: the Vault ran dry last round, so the Dreamscape resets now.
  if (isFreeformBoard(state) && vaultExhausted(state)) resetDreamscape(state);
  // Ainmos 0.25: Endless Mode keeps a full Cycle waiting in the Dream Deck.
  ensureEndlessDeck(state);
  // Ainmos: no Dream left to draw. The night does not end; the Long Night begins,
  // and the Waking Mind is the clock until you wake or forget yourself.
  if (!state.tutorialMode && !(state.dreamDeck || []).length) {
    if (!state.longNight) {
      state.longNight = true;
      addLog(state, `The Dream Deck is empty. The Long Night begins: each dusk Represses ${LONG_NIGHT_TAX} more from the Waking Mind until you wake.`);
    }
    state.longNightRounds = (state.longNightRounds || 0) + 1;
    state.dreamDrawn = true;
  }

  // Ainmos 0.26.2: the Lost & Found closes out the Dream just played, with the hand you
  // ended it on. The new round's draw (and dawn) comes once you leave it.
  state.roundDrawPending = true;
  if (!(state.status === "playing" && openLostFound(state))) finishRoundOpening(state);
}

/** The new round begins: dawn between Cycles, then every Dreamer draws DREAM_DRAW. */
export function finishRoundOpening(state) {
  if (!state?.roundDrawPending) return;
  state.roundDrawPending = false;
  // Ainmos dawn: the round after a Boss Dream, the Waking Mind reshuffles and you draw DAWN_DRAW.
  if (state.bossArrivedThisRound && !state.tutorialMode) {
    state.bossArrivedThisRound = false;
    anteDawn(state);
  }
  state.players.forEach((player) => {
    if (!player.alive) return;
    if (!hasPsycheHealth(player)) {
      handleDreamerDeath(state, player);
      return;
    }
    drawPsycheForPlayer(state, player, DREAM_DRAW);
    const extra = extraPsycheDrawAtRoundStart(state, player);
    if (extra) drawPsycheForPlayer(state, player, extra);
  });
  addLog(state, `Round ${state.round}: each Dreamer draws ${DREAM_DRAW} Psyche.`);
}

/** Between Cycles: the discard shuffles back into the Waking Mind, then you draw DAWN_DRAW. */
/**
 * Effects that wake with the dawn (Flower) register here, so state.js imports no effects.
 * The list lives on the hoisted function: modules caught in an import cycle can register early.
 */
export function onDawn(fn) {
  if (!onDawn.hooks) onDawn.hooks = [];
  if (typeof fn === "function") onDawn.hooks.push(fn);
}

/** Ainmos 0.26: 4 at dawn (was 5), paired with the free phase Actions. */
export const DAWN_DRAW = 4;

export function anteDawn(state) {
  if (state.psycheDiscard?.length) {
    state.psycheDeck = shuffle([...(state.psycheDeck || []), ...state.psycheDiscard]);
    state.psycheDiscard = [];
  }
  state.ante = (state.ante || 1) + 1;
  state.players.forEach((player) => {
    if (player.alive) drawPsycheForPlayer(state, player, DAWN_DRAW);
  });
  addLog(state, `Dawn between Cycles: the Waking Mind reshuffles, and you draw ${DAWN_DRAW} Psyche.`);
  autoReturnPsyche(state, DAWN_RETURN, "Dawn");
  (onDawn.hooks || []).forEach((fn) => fn(state));
}

/** Psyche the dawn between Cycles Returns from the Subconscious. */
export const DAWN_RETURN = 3;

export const DEATH_CLOCK_CAP = 6;
/** @deprecated Personal caps are gone. The table shares DEATH_CLOCK_CAP. */
export const MAX_DREAMER_DEATHS = DEATH_CLOCK_CAP;

export function deathAvoidTokenCost() {
  return 0;
}

export function deathCapFor() {
  return DEATH_CLOCK_CAP;
}

/** A Dreamer who dies redraws a full starting hand on The Bed. */
function respawnPsycheTarget() {
  return PSYCHE_STARTING_HAND;
}

function seatDreamerOnBed(state, player) {
  player.landscapeId = "bed";
  state.selectedLandscapeId = "bed";
  const idx = state.players.findIndex((p) => p.id === player.id);
  if (idx >= 0) state.activePlayerIndex = idx;
}

function loseOnFinalDeath(state, player) {
  if (state.tutorialMode) return;
  if (state.status !== "playing") return;
  state.status = "lost";
  addLog(
    state,
    `The Death Clock strikes ${DEATH_CLOCK_CAP}. ${player.name} does not return. You never wake up.`,
  );
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
  return objects;
}

/**
 * Ainmos 0.26: dying is never silent. A one-button notice says what was lost
 * (Objects and the hand) and what was kept (Power Tokens, Forms, Archetypes).
 */
function announceDeath(state, player, lost, target) {
  const names = lost.map((o) => o.name).filter(Boolean);
  const objectLine = names.length
    ? `Lost your Objects (${names.join(", ")}).`
    : "You had no Objects to lose.";
  const tokens = player.powerTokens || 0;
  const message = `${objectLine} Redrew a new hand of ${target} Psyche. You keep your ${tokens} Power Token${tokens === 1 ? "" : "s"}, your Forms, and your Archetypes. Deaths: ${state.deathClock}/${DEATH_CLOCK_CAP}.`;
  logMoment(state, `You die... and wake back up on The Bed. ${objectLine} Redrew a new hand.`);
  if (state.pendingEffectChoice || state.tutorialMode) return;
  offerEffectChoice(state, player, {
    cardId: "dreamer-death-notice",
    source: "death",
    title: "You die... and wake back up on The Bed",
    message,
    log: "You die... and wake back up on The Bed.",
    choices: [{ id: "ok", label: "Wake up" }],
  });
}

registerEffectResolver("dreamer-death-notice", (state) => {
  state.pendingEffectChoice = null;
  return true;
});

export function applyDreamerDeath(state, player, { cause = "" } = {}) {
  state.pendingDeathChoice = null;
  if (!player?.alive || state.status !== "playing") return;

  const deaths = (player.deathCount || 0) + 1;
  player.deathCount = deaths;
  state.deathClock = (state.deathClock || 0) + 1;
  const clock = state.deathClock;

  queueDreamerDeathFx(player.id, player.name, player.landscapeId);
  // Ainmos 0.26: death costs your Objects and your hand. Power Tokens stay.
  const lostObjects = discardPlayerObjects(state, player);
  clearPlayerHandOnDeath(state, player);
  seatDreamerOnBed(state, player);

  if (clock >= DEATH_CLOCK_CAP) {
    player.alive = false;
    addLog(state, `${player.name} dies. The Death Clock is ${clock}/${DEATH_CLOCK_CAP}.`);
    loseOnFinalDeath(state, player);
    return;
  }

  const target = respawnPsycheTarget();
  drawPsycheForPlayer(state, player, target);
  if (state.tutorialMode) resolvePowerCardsInHand(state, player);

  addLog(
    state,
    `${player.name} ${cause || "dies with nothing to pay"}. The Death Clock ticks to ${clock}/${DEATH_CLOCK_CAP}. Objects are lost (Power Tokens are kept), and they redraw ${target} Psyche on The Bed.`,
  );
  announceDeath(state, player, lostObjects, target);
}

export function offerDreamerDeathChoice(state, player) {
  if (!player?.alive || hasPsycheHealth(player)) return false;
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

export function checkDreamerPsycheDeath(state, player, opts = {}) {
  if (!player?.alive || state.status !== "playing") return false;
  if (!opts.unpaid) return false;
  if (psycheHandCount(player) > 0) return false;
  applyDreamerDeath(state, player);
  return true;
}

/**
 * An empty hand with nothing left to resolve is a dead end, not a round to sit
 * through: the Dreamer dies now and respawns on The Bed with a fresh hand.
 * Checked once the Dream has resolved and at the start of every phase.
 */
export function dieIfHandEmpty(state, { onlyIfStuck = false } = {}) {
  if (!state || state.status !== "playing" || state.tutorialMode) return false;
  if (isBlockingGameChoice(state) || (state.resolutionQueue || []).length) return false;
  let died = false;
  (state.players || []).forEach((player) => {
    // Mid-round, a Power Token can still open a phase; only a Dreamer with nothing at all is stuck.
    if (onlyIfStuck && (player.powerTokens || 0) > 0) return;
    if (handleDreamerDeath(state, player)) died = true;
  });
  return died;
}

/** Once this round's Dream has resolved: an empty hand dies here, not a round later. */
export function dieIfHandEmptyAfterDream(state) {
  if (!state?.dreamDrawn || state.revealLandscapeUsed || state.landscapePick) return false;
  if (state.phaseIndex !== 0) return false;
  return dieIfHandEmpty(state);
}

/** No Psyche when the Dream begins: the Dreamer dies and respawns on The Bed. */
export function handleDreamerDeath(state, player) {
  if (!player?.alive || state.status !== "playing" || hasPsycheHealth(player)) return false;
  applyDreamerDeath(state, player);
  return true;
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
  grantPowerTokens(state, player, STARTING_POWER_TOKENS, { reason: `${dreamer.name} begins with ${STARTING_POWER_TOKENS} Power Tokens.`, logQuest: false, animate: false, source: "start" });
  drawPsycheForPlayer(state, player, PSYCHE_STARTING_HAND);
  if (state.tutorialMode) resolvePowerCardsInHand(state, player);
  player.pendingRespawn = false;
  state.pendingRespawn = null;
  seatDreamerOnBed(state, player);
  addLog(state, `${dreamer.name} enters the Dreamscape on The Bed with ${PSYCHE_STARTING_HAND} Psyche and 1 Power.`);
  return true;
}

function tileCanHostArchetype(tile) {
  return !!(tile && tile.revealed && !tile.wasteland && !tile.center && tile.id !== "bed");
}

function questLandscapeIds(state, arch) {
  const text = (arch.quests || []).join(" · ");
  const named = (state.board || [])
    .filter((tile) => tile.name && tile.id !== "bed" && tile.id !== "wasteland")
    .sort((a, b) => b.name.length - a.name.length);
  const ids = [];
  named.forEach((tile) => {
    if (text.includes(tile.name) && !ids.includes(tile.id)) ids.push(tile.id);
  });
  return ids.slice(0, 2);
}

function placeFinalArchetype(state, arch) {
  const questTiles = questLandscapeIds(state, arch)
    .map((id) => landscapeById(state, id))
    .filter(tileCanHostArchetype);
  const emptyQuest = questTiles.find((tile) => !(tile.finalArchetypes || []).some((entry) => !entry.defeated));
  if (emptyQuest || questTiles[0]) return emptyQuest || questTiles[0];

  const suitTiles = (state.board || []).filter((tile) => tileCanHostArchetype(tile) && tile.suit === arch.suit);
  const emptySuit = suitTiles.find((tile) => !(tile.finalArchetypes || []).some((entry) => !entry.defeated));
  if (emptySuit || suitTiles[0]) return emptySuit || suitTiles[0];

  return landscapeById(state, "bed");
}

function hostFinalArchetype(tile, arch) {
  if (!tile) return null;
  if (!tile.finalArchetypes) tile.finalArchetypes = [];
  const placed = { ...arch, defeated: false, landscapeId: tile.id };
  tile.finalArchetypes.push(placed);
  tile.finalArchetype = tile.finalArchetypes.find((entry) => !entry.defeated) || null;
  return placed;
}

export function markFinalArchetypeDefeated(state, archetypeId) {
  (state.finalArchetypes || []).forEach((arch) => {
    if (arch.id === archetypeId) arch.defeated = true;
  });
  (state.board || []).forEach((tile) => {
    (tile.finalArchetypes || []).forEach((arch) => {
      if (arch.id === archetypeId) arch.defeated = true;
    });
    if (tile.finalArchetype?.id === archetypeId) tile.finalArchetype.defeated = true;
    if (tile.finalArchetypes) {
      tile.finalArchetype = tile.finalArchetypes.find((arch) => !arch.defeated) || null;
    }
  });
}

/**
 * Ainmos: Acquiring an Archetype is the whole goal. Each one counts 1 toward
 * waking, pays 1 Power Token, and hands over its power (or passive) as a Boon.
 */
function grantAcquiredArchetype(state, player, archetype) {
  state.acquiredPoints = (state.acquiredPoints || 0) + 1;
  const boon = archetypeBoon(archetype);
  if (!(state.boons || []).some((b) => b.id === boon.id)) state.boons = [...(state.boons || []), boon];
  const paid = grantPowerTokens(state, player, ARCHETYPE_TOKEN_REWARD, { logQuest: false, source: "archetype" });
  // Integration: an Acquired Archetype brings back what you had lost.
  autoReturnPsyche(state, ARCHETYPE_RETURN, archetype.name);
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  if (goal > 0 && state.acquiredPoints >= goal) state.archetypeGoalReached = true;
  addLog(state, `${player.name} Acquires ${archetype.name}: ${state.acquiredPoints}/${goal || "?"} Archetypes${paid ? `, +${paid} Power Tokens` : ""}. Its power is yours.`);
}

export function acquireFinalArchetype(state, player, archetype) {
  if (!player || !archetype) return null;
  const copy = {
    ...archetype,
    points: 1,
    defeated: true,
    questProgress: [true, true],
  };
  player.acquiredArchetypes.push(copy);
  grantAcquiredArchetype(state, player, copy);
  return copy;
}

/** Pull one Archetype out of the remaining deck and Acquire it immediately. */
export function acquireArchetypeFromDeck(state, player, archetypeId) {
  const idx = (state.archetypeDeck || []).findIndex((arch) => arch.id === archetypeId);
  if (idx < 0 || !player) return null;
  const [archetype] = state.archetypeDeck.splice(idx, 1);
  const copy = {
    ...archetype,
    questProgress: (archetype.quests || []).map(() => true),
  };
  player.acquiredArchetypes.push(copy);
  grantAcquiredArchetype(state, player, copy);
  checkVictory(state);
  return copy;
}

export function beginFinalRecurrence(state) {
  if (state.finalRecurrence) return;
  state.finalRecurrence = true;
  if (state.scoringGoalPoints == null) state.scoringGoalPoints = state.goalPoints || 0;
  if ((state.goalPoints || 0) > 0 && (state.acquiredPoints || 0) >= state.goalPoints) {
    state.archetypeGoalReached = true;
  }
  state.goalPoints = 0;
  const bed = landscapeById(state, "bed");
  if (bed) {
    bed.finalRecurrenceSide = true;
    bed.revealed = true;
    bed.wasteland = false;
  }
  // 41.0: the two cheapest Archetypes left, all standing on The Bed.
  const pool = [...archetypeRowOf(state), ...state.archetypeDeck];
  const summoned = pool
    .map((arch, index) => ({ arch, index }))
    .sort((a, b) => ((a.arch.points || 0) - (b.arch.points || 0)) || (a.index - b.index))
    .slice(0, FINAL_RECURRENCE_ARCHETYPES)
    .map((entry) => entry.arch);
  state.archetypeDeck = [];
  state.archetypeRow = [];
  state.activeArchetype = null;

  state.finalArchetypes = summoned.map((arch) => {
    const tile = bed || placeFinalArchetype(state, arch);
    const placed = hostFinalArchetype(tile, arch);
    if (tile && placed) addLog(state, `${arch.name} appears on ${tile.name}.`);
    return placed || { ...arch, defeated: false, landscapeId: tile?.id };
  });

  state.finalRecurrenceRoundsLeft = FINAL_RECURRENCE_ROUNDS;
  state.finalRecurrenceDreamsAtStart = Math.max(1, state.dreamDeck?.length || 1);
  addLog(state, `Final Recurrence: ${summoned.length} Archetype${summoned.length === 1 ? "" : "s"} stand on The Bed. Power ${FINAL_ARCHETYPE_POWER}. Pool up to 3 Psyche and win each dice battle within ${FINAL_RECURRENCE_ROUNDS} rounds to wake.`);
  markDreamFeedNudge();
  checkVictory(state);
}

export function advancePhase(state) {
  const phase = getPhase(state);

  if (phase === "Meet") {
    // Ainmos 0.24.1: Archetypes slip 1 Landscape away as Meet ends, so the next
    // Explore can always reach one you are chasing. Dreambeasts still close in
    // at the start of Explore.
    const fled = stepArchetypesAway(state);
    if (fled) addLog(state, `${fled} Archetype${fled === 1 ? " slips" : "s slip"} away from you as Meet ends.`);
    passHeadDreamer(state);
    if (state.finalRecurrence && state.finalRecurrenceRoundsLeft != null) {
      state.finalRecurrenceRoundsLeft = Math.max(0, state.finalRecurrenceRoundsLeft - 1);
      checkDefeat(state);
      if (state.status !== "playing") return;
    }
    state.anchorMeetSpreadBonus = 0;
    state.round += 1;
    beginRoundReveal(state);
    return;
  }

  state.phaseIndex += 1;
  state.selectedHand = [];
  state.pendingPowerBonus = 0;
  state.pendingPowerBonusTokens = 0;

  if (getPhase(state) === "Explore") {
    addLog(state, "Explore Phase: your Elasticity is your free steps. A card of Elasticity adds its value.");
    const chased = stepBeastsTowardDreamers(state);
    if (chased) addLog(state, `${chased} Dreambeast${chased === 1 ? " chases" : "s chase"} you.`);
  } else if (getPhase(state) === "Meet") {
    applyMeetStartTax(state);
    if (state.anchorMeetSpreadPending) {
      state.anchorMeetSpreadBonus = state.anchorMeetSpreadPending;
      state.anchorMeetSpreadPending = 0;
    }
    const meetHere = state.board?.find((t) =>
      t.revealed && tileHasEncounters(t) && state.players.some((p) => p.alive && p.landscapeId === t.id),
    );
    if (meetHere) state.selectedLandscapeId = meetHere.id;
    addLog(state, "Meet Phase: your Willpower is your free Meet Actions. Fight a Dreambeast on your Landscape, or Meet an Archetype there.");
  }
}

/**
 * Spend the phases before `targetPhase` without opening them.
 * Returns the names that were skipped. The target phase stays unopened.
 */
export function fastForwardToPhase(state, targetPhase) {
  const order = ["Reveal", "Explore", "Meet"];
  const target = order.indexOf(targetPhase);
  if (target < 0 || (state.phaseIndex || 0) >= target) return [];
  const skipped = [];
  let guard = 3;
  while (guard > 0 && state.status === "playing" && (state.phaseIndex || 0) < target) {
    guard -= 1;
    const leaving = getPhase(state);
    skipped.push(leaving);
    if (leaving === "Reveal") {
      state.revealLandscapeUsed = true;
      state.landscapePick = null;
    }
    if (leaving === "Explore") {
      state.exploreActivated = true;
      state.exploreMovesLeft = 0;
    }
    advancePhase(state);
  }
  return skipped;
}


function passHeadDreamer(state) {
  const players = state.players || [];
  const currentHeadIndex = players.findIndex((p) => p.isHead);
  const start = currentHeadIndex >= 0 ? currentHeadIndex : state.activePlayerIndex;
  let next = null;
  for (let step = 1; step <= players.length; step += 1) {
    const player = players[(start + step) % players.length];
    if (player?.alive) {
      next = player;
      break;
    }
  }
  if (!next) return;
  players.forEach((p) => {
    p.isHead = false;
  });
  next.isHead = true;
  const idx = players.findIndex((p) => p.id === next.id);
  if (idx >= 0) state.activePlayerIndex = idx;
}

export function allDreamersOnBed(state) {
  const alive = state.players.filter((p) => p.alive);
  return alive.length > 0 && alive.every((p) => p.landscapeId === "bed");
}

/** Ainmos: the night is won when the final Boss falls and the Archetype goal is met. */
export function finalBossDefeated(state) {
  return !!state.finalBossId && (state.bossesDefeated || []).includes(state.finalBossId);
}

/** Ainmos: one goal. Acquire the night's count of Archetypes and you wake. */
export function checkVictory(state) {
  if (state.status !== "playing") return;
  // Endless Mode ends only when the last Leviathan falls (see endless.js).
  if (state.endless) return;
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  if (goal > 0 && (state.acquiredPoints || 0) >= goal) {
    state.archetypeGoalReached = true;
    state.status = "won";
    addLog(state, `${goal} Archetypes Acquired. You wake!`);
  }
}

export function checkDefeat(state) {
  if (state.tutorialMode) return;
  if (state.status !== "playing") return;
  if ((state.deathClock || 0) >= DEATH_CLOCK_CAP) {
    const last = (state.players || []).find((p) => !p.alive) || state.players?.[0];
    loseOnFinalDeath(state, last);
    return;
  }
  if (!(state.players || []).some((p) => p.alive)) {
    state.status = "lost";
    addLog(state, "No Dreamers remain in the Dreamscape. You never wake up.");
    return;
  }
  if (!(state.psycheDeck?.length) && !(state.psycheDiscard?.length)) {
    state.status = "lost";
    addLog(state, "The Waking Mind is empty — nothing left to draw or shuffle. You forget yourself, and never wake up.");
    return;
  }
  if (state.finalRecurrence) {
    const left = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
    if (left > 0 && state.finalRecurrenceRoundsLeft != null && state.finalRecurrenceRoundsLeft <= 0) {
      state.status = "lost";
      addLog(state, "Final Recurrence ends with an Archetype still standing on The Bed. You never wake up.");
    } else if (left > 0 && state.finalRecurrenceRoundsLeft == null && state.dreamDeck.length === 0) {
      state.status = "lost";
      addLog(state, "The Dream Deck is exhausted. You never wake up.");
    }
    return;
  }
}

/** The Long Night's dusk toll grows by this much every round: 2, then 4, then 6. */
export const LONG_NIGHT_TAX = 1;

export function longNightToll(state) {
  return state?.longNight ? LONG_NIGHT_TAX * Math.max(1, state.longNightRounds || 1) : 0;
}

export function acquireArchetype(state, player, onAcquireFn, { skipQuestCheck = false, archetype: chosen = null } = {}) {
  const archetype = chosen || state.activeArchetype;
  if (!archetype) return false;
  if (!skipQuestCheck && !archetype.questProgress.every(Boolean)) return false;

  player.acquiredArchetypes.push(archetype);
  state.acquiredPoints += archetype.points;
  addLog(state, `${player.name} acquired ${archetype.name} (+${archetype.points} Archetype pts).`);

  if (onAcquireFn) onAcquireFn(state, archetype, player);

  const row = archetypeRowOf(state);
  state.archetypeRow = row.filter((a) => a !== archetype && a.id !== archetype.id);
  if (state.activeArchetype === archetype || state.activeArchetype?.id === archetype.id) state.activeArchetype = null;
  refillArchetypeRow(state);

  checkVictory(state);
  return true;
}

/** True while the player must resolve a modal/board choice before continuing. */
export function isBlockingGameChoice(state) {
  if (!state) return false;
  return !!(
    state.pendingDreamChoice
    || state.pendingBoonDraft
    || state.pendingEffectChoice
    || state.pendingObjectChoice
    || state.pendingMindstreamChoice
    || state.pendingReturn
    || state.pendingRepress
    || state.pendingDeathChoice
    || state.pendingNothingChoice
    || state.pendingRespawn
    || state.landscapePick
    || state.pendingDreamerPower?.ui
    || state.pendingDreamReplay
    || state.pendingArchetypeChoice
  );
}

export function blockingChoiceLabel(state) {
  if (!state) return "Required choice";
  const pending = state.pendingDreamChoice
    || state.pendingMindstreamChoice
    || state.pendingEffectChoice
    || state.pendingObjectChoice;
  if (pending?.title) return pending.title;
  if (state.pendingReturn) return "Return from Subconscious";
  if (state.pendingDreamReplay) return "Replay a Dream";
  if (state.pendingRepress) {
    return state.pendingRepress.toDiscard || state.pendingRepress.toMindstream
      ? "Discard for this effect"
      : "Repress to Subconscious";
  }
  if (state.pendingDeathChoice) return "Psyche death choice";
  if (state.pendingNothingChoice) return "The Nothing";
  if (state.pendingRespawn) return "Choose a new Dreamer";
  if (state.landscapePick?.title) return state.landscapePick.title;
  if (state.pendingDreamerPower?.ui?.title) return state.pendingDreamerPower.ui.title;
  return "Required choice";
}

export function completeQuest(state, _questIndex, player, onAcquireFn, { archetypeId = null } = {}) {
  if (archetypeId) focusRowArchetype(state, archetypeId);
  const archetype = (archetypeId ? state.activeArchetype : (readyRowArchetype(state) || state.activeArchetype));
  if (!archetype?.quests?.length) return false;
  if (archetype.questProgress?.every(Boolean)) return false;
  const unmet = archetype.quests.filter((quest) => !isQuestConditionMet(state, archetype.id, quest));
  if (unmet.length) {
    addLog(state, `Both quests must already be true. Still open: ${unmet.join(" · ")}`);
    return false;
  }
  archetype.questProgress = archetype.quests.map(() => true);
  archetype.powerTokensOnArchetype = 0;
  addLog(state, `${player.name} commits to ${archetype.name}. Both quests are true.`);
  acquireArchetype(state, player, onAcquireFn, { archetype });
  return "acquired";
}

export { forgetLandscapes, forgetNamedLandscapes } from "../board/landscapes.js";

/** Map thresholds removed — all-Forgotten still starts Final Recurrence elsewhere. */
export function maybeMapRevealForgetThresholds(_state) {}

/** The Rested's Lucid Rest lasts for the Reveal it was used in. */
export function lucidRestKey(state) {
  return `${state.round || 0}:${state.phaseIndex || 0}`;
}

/** Lucid Rest: each Landscape placed this Reveal draws 1 Psyche, while draws are left. */
function onLandscapePlacedForPowers(state) {
  const rest = state.lucidRest;
  if (!rest || rest.key !== lucidRestKey(state) || rest.left < 1) return;
  const player = state.players.find((p) => p.id === rest.playerId && p.alive);
  if (!player) return;
  const drawn = drawPsycheForPlayer(state, player, 1);
  if (!drawn.length) return;
  rest.left -= 1;
  addLog(state, `Lucid Rest: ${player.name} draws 1 Psyche (${rest.left} left this Reveal).`);
}

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
    addLog(state, `Restored ${tile.name}.`);
    markTileRevealed(tile.id);
    queueTileRevealFx(tile.id);
    playSfx("reveal");
  }
  onLandscapePlacedForPowers(state);
  maybeMapRevealForgetThresholds(state);
}
