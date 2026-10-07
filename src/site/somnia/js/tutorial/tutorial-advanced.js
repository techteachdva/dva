/**
 * Advanced tutorial — the longer night.
 * Unlocks after the basic lesson is finished. Teaches the systems that
 * lesson leaves in the Dream Guide: passives, trade, objects, a paid power,
 * the death ladder, and a boss on The Bed.
 */
import {
  createInitialState,
  landscapeById,
  setEncounterOnLandscape,
} from "../core/state.js";
import { adjacentTiles } from "../core/hex.js";
import {
  drawDreamCard,
  playObject,
  activateObject,
  performLandscapeAction,
  handleBoardTileClick,
  moveDreamer,
} from "../core/game.js";

export const ADVANCED_DREAMER_IDS = ["the-weaver", "the-hunter"];

export const ADVANCED_TUTORIAL_SECTIONS = [
  { id: "welcome", label: "Welcome", stepIndex: 0 },
  { id: "passives", label: "Passives", stepIndex: 1 },
  { id: "swap", label: "Weaver Swap", stepIndex: 2 },
  { id: "trade", label: "Trade", stepIndex: 3 },
  { id: "objects", label: "Objects", stepIndex: 4 },
  { id: "must", label: "Must-play", stepIndex: 6 },
  { id: "power", label: "Paid Power", stepIndex: 7 },
  { id: "death", label: "Death", stepIndex: 8 },
  { id: "boss", label: "Boss", stepIndex: 9 },
  { id: "guide", label: "Dream Guide", stepIndex: 10 },
  { id: "wake", label: "Wake", stepIndex: 11 },
];

let uidSeq = 0;

function uid(prefix) {
  uidSeq += 1;
  return `${prefix}-adv-${String(uidSeq).padStart(4, "0")}`;
}

function psyche(suit, value, tag) {
  const label = suit.charAt(0).toUpperCase() + suit.slice(1);
  return {
    id: `${suit}-${value}-${tag}`,
    type: "psyche",
    suit,
    value,
    name: `${label} ${value}`,
    instanceId: uid(`psyche-${tag}`),
  };
}

function stamp(template, prefix) {
  return { ...template, instanceId: uid(prefix) };
}

export const ADVANCED_TUTORIAL_SCRIPT = [
  {
    id: "adv-welcome",
    round: 1,
    title: "The Longer Night",
    why: "You have woken once. This dream teaches what the first one left in the dark. The Weaver and The Hunter are beside you on Sky. Capture is no longer the lesson. The lesson is what a hand can still do: trade, an object, a power, a death, and the beast that waits on The Bed.",
    objective: "Click Continue. The longer night is open.",
    targets: ["#active-archetype", "#phase-stepper"],
    spotlight: "#active-archetype",
  },
  {
    id: "adv-passives",
    round: 1,
    title: "Six Quiet Gifts",
    why: "Once a round, and free. The Runner's first step is free. The Immovable ignores one discarded Meet card. The Hunter may shove a beast one hex after a fight. The Rested draws if they opened nothing. The Weaver swaps 1 Psyche with a neighbor. You will use that swap. The ? button keeps the list.",
    objective: "Click Continue. Then swap with The Hunter.",
    targets: ["#board-viewport"],
    spotlight: "#board-viewport",
  },
  {
    id: "adv-swap",
    round: 1,
    title: "Weaver Swap",
    why: "Select Elasticity 1. Weaver Swap is free during an open Meet. With one neighbor, you choose The Hunter, then one card from their hand. Take Lucidity 1. Yours becomes theirs.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Weaver on Sky." },
      { kind: "handToggle", playerIndex: 0, cardId: "elasticity-1-w-e1", prompt: "Select Elasticity 1 in The Weaver's hand." },
      { kind: "weaverSwap", playerIndex: 0, prompt: "Click The Weaver, then Weaver Swap. Choose The Hunter, then Lucidity 1." },
    ],
    until: (s) => !!s.weaverSwapUsed,
  },
  {
    id: "adv-trade",
    round: 1,
    title: "Trade",
    why: "Trade is free during Meet. It does not spend an action. The window shows both hands. Each Dreamer offers up to 3 Psyche. The partner stands on the same hex or next door. Offer Willpower 2 from The Weaver and Lucidity 2 from The Hunter, then confirm.",
    targets: ["#hand-bar", "#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Weaver." },
      { kind: "trade", playerIndex: 0, prompt: "Click Trade. Offer Willpower 2 and Lucidity 2, then Confirm Trade." },
    ],
    until: (s) => !!s.tutorialFlags?.tradeDone,
  },
  {
    id: "adv-instant",
    round: 1,
    title: "Instant Object",
    why: "Coins is an Instant. It is free, then it is Repressed. Each Dreamer gains 1 Power Token. A token commits an Archetype once both quests are true, leans on a die, or opens a phase when nobody holds the suit.",
    targets: ["#board-viewport", "#player-objects"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Weaver." },
      { kind: "playObject", playerIndex: 0, prompt: "Click The Weaver, then Play Object. Coins plays for the table." },
    ],
    until: (s) => !(s.players[0]?.objects || []).some((card) => card.id === "coins"),
  },
  {
    id: "adv-persistent",
    round: 1,
    title: "Persistent Object",
    why: "Skeleton Key stays in play. Waking it costs 1 Power Token and does not spend a Meet action. Click a Power Token, then Activate Object. It arms, and waits for the next Dream. That Dream is still ahead of you.",
    targets: ["#board-viewport", "#player-persistent"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Weaver." },
      { kind: "activateObject", playerIndex: 0, prompt: "Click a Power Token, then Activate Object." },
    ],
    until: (s) => !!s.skeletonKeyPending,
  },
  {
    id: "adv-must",
    round: 1,
    title: "Must-play",
    why: "Some Objects play themselves the moment they are drawn. The All Seeing Eye is on top of the Lucidity Mindstream. Draw it from Sky. It reveals Dreamers+1 Landscapes, then it is Repressed. Click the glowing Wasteland hexes until the Eye is done.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 0, prompt: "Click The Weaver on Sky." },
      {
        kind: "landscapeActionA",
        playerIndex: 0,
        landscapeId: "sky",
        done: (s) => !!s.tutorialFlags?.eyePlayed,
        prompt: "Click The Weaver or Sky, then Draw Lucidity Mindstream.",
      },
    ],
    until: (s) => !!s.tutorialFlags?.eyePlayed && !s.landscapePick,
    objective: "Click the glowing Wasteland hexes until the Eye closes.",
  },
  {
    id: "adv-power",
    round: 1,
    title: "A Paid Power",
    why: "Each Dreamer's paid power costs 1 Power Token. The Hunter moves every beast one hex, toward the nearest Dreamer or away from The Bed. The other five live in the Dream Guide: Rested draws, Visionary reveals, Runner steps the table, Immovable banks a card, Weaver makes everyone discard and draw. Choose away from The Bed.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Hunter." },
      { kind: "dreamerPower", playerIndex: 1, prompt: "Click The Hunter, then Dreamer Power. Choose away from The Bed." },
    ],
    until: (s) => !!s.tutorialFlags?.hunterPowerUsed,
  },
  {
    id: "adv-death",
    round: 1,
    title: "The Death Clock",
    why: "The Hunter is holding no Psyche. The dark hex beside them is Wasteland, and stepping in asks for 1 Psyche. With nothing to pay, they die. The Death Clock ticks. They return to The Bed and draw 3 Psyche. Power Tokens and Objects are lost. Six deaths, shared by the table, end the night.",
    targets: ["#board-viewport"],
    rail: [
      { kind: "dreamerSelect", playerIndex: 1, prompt: "Click The Hunter." },
      { kind: "exploreMove", playerIndex: 1, tileId: "adv-wasteland", prompt: "Click the glowing Wasteland hex beside The Hunter." },
    ],
    until: (s) => (s.players[1]?.deathCount || 0) >= 1 && s.players[1]?.landscapeId === "bed",
  },
  {
    id: "adv-boss",
    round: 1,
    title: "The Beast on The Bed",
    why: "Draw the Dream. Cerberus is Power 12, and it wakes on The Bed. In a real night the bosses come on rounds 3, 6, and 9: Cerberus, Double, Leviathan. A boss is a beast on the escape tile. You do not have to kill it to keep dreaming. You wake by standing here when the points are done. The Skeleton Key you armed asks which Mindstream to flip. Pick any.",
    targets: ["#btn-draw-dream", "#board-viewport"],
    rail: [
      { kind: "drawDream", prompt: "Click Draw Dream. Cerberus wakes on The Bed. Then answer the Skeleton Key." },
    ],
    until: (s) => !!s.dreamDrawn
      && !!s.tutorialFlags?.bossDrawn
      && !s.pendingObjectChoice
      && !s.skeletonKeyPending,
  },
  {
    id: "adv-guide",
    round: 1,
    title: "The Dream Guide",
    why: "The ? button is the codex. It stays on the table in a real dream: what just happened, and the rules you need to wake up. Open it. Passives, powers, bosses, death, and Final Recurrence are written there for the nights after this one.",
    targets: ["#btn-dream-feed"],
    spotlight: "#btn-dream-feed",
    rail: [
      { kind: "openGuide", prompt: "Click ? to open the Dream Guide." },
    ],
    until: (s) => !!s.tutorialFlags?.guideOpened,
  },
  {
    id: "adv-wake",
    round: 1,
    title: "Wake Again",
    why: "A real Daydream asks for 8 points across 11 Dreams. Nap asks for 12 across 14. Deep Sleep asks for 24 across 18. One Dreamer aims at 4, 6, or 12. The rules stay. The night runs longer. If the outer rooms go dark, the goal changes.",
    objective: "Click Finish. Then begin a real dream, or replay either lesson from the menu.",
    targets: ["#active-archetype"],
    spotlight: "#active-archetype",
  },
];

export function createAdvancedBaseState(data) {
  uidSeq = 0;
  const dreamers = ADVANCED_DREAMER_IDS
    .map((id) => data.dreamers.find((d) => d.id === id))
    .filter(Boolean);

  const state = createInitialState(data, {
    lengthKey: "daydream",
    selectedDreamers: dreamers,
    tutorialMode: true,
  });

  state.tutorialMode = true;
  state.tutorialTrack = "advanced";
  state.tutorialStepIndex = 0;
  state.tutorialCanAdvance = false;
  state.tutorialComplete = false;
  state.goalPoints = 8;
  state.tutorialFlags = {
    tradeDone: false,
    eyePlayed: false,
    hunterPowerUsed: false,
    guideOpened: false,
    bossDrawn: false,
    deathPrepared: false,
    deathTileId: null,
  };

  state.players.forEach((player, index) => {
    player.id = uid(`player-${index}`);
    player.powerTokens = 1;
    player.landscapeId = "sky";
    player.objects = player.objects || [];
    player.persistent = player.persistent || [];
  });

  state.players[0].hand = [
    psyche("elasticity", 1, "w-e1"),
    psyche("willpower", 2, "w-w2"),
    psyche("lucidity", 3, "w-l3"),
  ];
  state.players[1].hand = [
    psyche("lucidity", 1, "h-l1"),
    psyche("lucidity", 2, "h-l2"),
    psyche("willpower", 1, "h-w1"),
  ];

  const coins = data.objects.find((card) => card.id === "coins");
  const key = data.objects.find((card) => card.id === "skeleton-key");
  const eye = data.objects.find((card) => card.id === "the-all-seeing-eye");
  if (coins) state.players[0].objects = [stamp(coins, "coins")];
  if (key) state.players[0].persistent = [stamp(key, "key")];
  if (eye && state.mindstreamDecks?.lucidity) {
    state.mindstreamDecks.lucidity.unshift(stamp(eye, "eye"));
  }

  ["sky", "house"].forEach((id) => {
    const tile = landscapeById(state, id);
    if (!tile) return;
    tile.revealed = true;
    tile.wasteland = false;
  });

  const mandrake = data.dreambeasts.find((beast) => beast.id === "mandrake");
  if (mandrake) {
    setEncounterOnLandscape(state, "house", {
      ...mandrake,
      type: "dreambeast",
      instanceId: uid("enc-mandrake"),
    });
  }

  const quiet = data.dreams.find((card) => card.id === "quiet");
  const cerberus = data.dreambeasts.find((beast) => beast.id === "cerberus");
  state.dreamDeck = [
    cerberus ? stamp({ ...cerberus, type: "dreambeast", boss: true }, "cerberus") : stamp(quiet, "dream"),
    ...(quiet ? [stamp(quiet, "quiet")] : []),
  ];
  state.dreamDiscard = [];
  state.activeDream = quiet ? stamp(quiet, "active-quiet") : null;
  state.dreamDrawn = true;
  state.phaseIndex = 2;
  state.meetActionBudget = 4;
  state.meetActionsUsed = 0;
  state.selectedLandscapeId = "sky";
  state.activePlayerIndex = 0;
  state.log = [
    "Advanced Tutorial: the longer night. Click only the highlighted Dreamer, cards, and hexes.",
    "Meet is already open. The Weaver and The Hunter stand on Sky.",
  ];
  return state;
}

function cardByTag(player, tag) {
  return player?.hand?.find((card) => card.id.endsWith(tag));
}

function swapKnownCards(state) {
  const weaver = state.players[0];
  const hunter = state.players[1];
  const mine = cardByTag(weaver, "w-e1") || weaver.hand.find((card) => card.type === "psyche");
  const theirs = cardByTag(hunter, "h-l1") || hunter.hand.find((card) => card.type === "psyche");
  if (!mine || !theirs) {
    state.weaverSwapUsed = true;
    return;
  }
  weaver.hand = weaver.hand.filter((card) => card.instanceId !== mine.instanceId);
  hunter.hand = hunter.hand.filter((card) => card.instanceId !== theirs.instanceId);
  weaver.hand.push(theirs);
  hunter.hand.push(mine);
  state.selectedHand = [];
  state.weaverSwapUsed = true;
}

function tradeKnownCards(state) {
  const weaver = state.players[0];
  const hunter = state.players[1];
  const give = cardByTag(weaver, "w-w2") || weaver.hand.find((card) => card.id.includes("willpower"));
  const take = cardByTag(hunter, "h-l2") || hunter.hand.find((card) => card.id.includes("lucidity-2"));
  if (give && take) {
    weaver.hand = weaver.hand.filter((card) => card.instanceId !== give.instanceId);
    hunter.hand = hunter.hand.filter((card) => card.instanceId !== take.instanceId);
    weaver.hand.push(take);
    hunter.hand.push(give);
  }
  state.tutorialFlags.tradeDone = true;
  state.tradeMode = false;
  state.trade = null;
}

export function prepareAdvancedDeath(state) {
  if (!state.tutorialFlags) state.tutorialFlags = {};
  if (state.tutorialFlags.deathPrepared) return state.tutorialFlags.deathTileId;
  const hunter = state.players[1];
  if (!hunter) return null;
  state.phaseIndex = 1;
  state.exploreActivated = true;
  state.exploreMovesLeft = 2;
  state.activePlayerIndex = 1;
  state.selectedLandscapeId = hunter.landscapeId || "sky";
  hunter.hand = [];
  hunter.objects = [];
  const neighbors = adjacentTiles(state, hunter.landscapeId).filter((tile) => tile.id !== "bed");
  const tile = neighbors[0];
  if (tile) {
    tile.revealed = true;
    tile.wasteland = true;
    state.tutorialFlags.deathTileId = tile.id;
  }
  state.tutorialFlags.deathPrepared = true;
  return state.tutorialFlags.deathTileId;
}

export function prepareAdvancedBoss(state) {
  if (!state.tutorialFlags) state.tutorialFlags = {};
  if (state.tutorialFlags.bossPrepared) return;
  state.tutorialFlags.bossPrepared = true;
  state.dreamDrawn = false;
  state.phaseIndex = 0;
  state.activePlayerIndex = 0;
}

function finishEyePicks(state) {
  let guard = 0;
  while (state.landscapePick && guard < 8) {
    const next = (state.landscapePick.allowed || [])[0];
    if (!next) break;
    handleBoardTileClick(state, next);
    guard += 1;
  }
  state.tutorialFlags.eyePlayed = true;
  state.landscapePick = null;
}

function moveHunterPower(state) {
  state.tutorialFlags.hunterPowerUsed = true;
}

export function applyAdvancedCanonicalStep(state, step) {
  switch (step.id) {
    case "adv-swap":
      swapKnownCards(state);
      return;
    case "adv-trade":
      tradeKnownCards(state);
      return;
    case "adv-instant":
      state.activePlayerIndex = 0;
      playObject(state);
      return;
    case "adv-persistent":
      state.activePlayerIndex = 0;
      activateObject(state);
      return;
    case "adv-must":
      state.activePlayerIndex = 0;
      state.selectedLandscapeId = "sky";
      performLandscapeAction(state, "draw-mindstream");
      finishEyePicks(state);
      return;
    case "adv-power":
      state.activePlayerIndex = 1;
      moveHunterPower(state);
      return;
    case "adv-death": {
      prepareAdvancedDeath(state);
      const tileId = state.tutorialFlags.deathTileId;
      if (tileId) moveDreamer(state, tileId);
      return;
    }
    case "adv-boss":
      prepareAdvancedBoss(state);
      drawDreamCard(state);
      state.tutorialFlags.bossDrawn = true;
      state.pendingObjectChoice = null;
      state.skeletonKeyPending = false;
      return;
    case "adv-guide":
      state.tutorialFlags.guideOpened = true;
      return;
    default:
      break;
  }
}

/** Live-table setup that a Continue click cannot do by itself. */
export function prepareAdvancedLiveStep(state, step) {
  if (!state || state.tutorialTrack !== "advanced" || !step) return;
  if (step.id === "adv-death") {
    prepareAdvancedDeath(state);
    const beat = step.rail?.find((item) => item.kind === "exploreMove");
    if (beat && state.tutorialFlags.deathTileId) beat.tileId = state.tutorialFlags.deathTileId;
  }
  if (step.id === "adv-boss") prepareAdvancedBoss(state);
}
