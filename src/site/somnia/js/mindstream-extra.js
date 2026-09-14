/**
 * Somnia 12 Mindstream event handlers — cards added beyond the original 41-event set.
 */
import {
  addLog,
  drawPsycheForPlayer,
  forgetLandscapes,
  revealLandscapeTile,
  landscapeById,
  setEncounterOnLandscape,
} from "./state.js";
import { shuffle, uid } from "./data.js";
import { recordQuestEvent } from "./quests.js";
import { logMoment } from "./narrator.js";
import { grantPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards, enqueueRepressFromHand } from "./subconscious.js";
import { adjacentTiles, edgeLandscapes } from "./hex.js";
import { requestChooseTile } from "./landscapes.js";
import {
  pullDreambeastFromMindstream,
  pullTwoDreambeastsForChoice,
  encounterFromDreambeastCard,
  discardToMindstream,
} from "./mindstream-supply.js";
import {
  countAffectedLandscapes,
  allListedLandscapesRevealed,
  logAffectedStatus,
} from "./event-landscapes.js";
import {
  beginAfternoonNap,
  beginEveningPlans,
  beginImStillDreaming,
  beginWayOut,
  beginSomethingOverThere,
  beginLightness,
  beginCouncil,
  beginSublimation,
  beginKeepItTogether,
  beginEveryonesLaughing,
  beginMillionReflections,
  beginCottonCandy,
  beginNeedWater,
  beginGiantPile,
  beginWrongDoor,
  beginHiddenInTheWalls,
  beginAMirage,
  beginBronze,
  beginSilver,
  beginRhythm,
  beginRoilingDoom,
  beginPerilousPinnacle,
  beginASacrifice,
  beginBigWave,
  beginMouthRises,
  beginMarshmallow,
  beginCaramelForest,
  beginChewedToDust,
  beginNoWhy,
  beginFromTheFire,
  beginMistSwirls,
  beginThisWillHaveToDo,
  beginIRemember,
  rememberEventHelpers,
} from "./event-choices.js";
import { flipLeviathan } from "./dreambeasts.js";

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function stat(player, key) {
  return player.dreamer[key] ?? 0;
}

function dreamerCount(state) {
  return alive(state).length;
}

function returnN(state, count, player = null) {
  if (count <= 0) return;
  requestReturnCards(state, count, player);
}

function revealHidden(state, count) {
  const hidden = state.board.filter((l) => !l.revealed && !l.center);
  const n = Math.min(count, hidden.length);
  hidden.slice(0, n).forEach((t) => revealLandscapeTile(state, t));
  if (n) recordQuestEvent(state, "reveal_landscape", { count: n });
}

function moveToIfRevealed(state, player, ids) {
  const allowed = ids.filter((i) => landscapeById(state, i)?.revealed);
  if (!allowed.length) return false;
  return requestChooseTile(state, {
    allowedIds: allowed,
    action: "movePlayer",
    playerId: player.id,
    title: `Move ${player.name}`,
    detail: `Choose one of the named Landscapes for ${player.name}.`,
  });
}

function moveToAnyRevealed(state, player) {
  const tile = state.board.find((t) => t.revealed && t.id !== player.landscapeId);
  if (tile) {
    player.landscapeId = tile.id;
    addLog(state, `${player.name} moves to ${tile.name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
  }
}

function moveAdjacent(state, player) {
  const adj = adjacentTiles(state, player.landscapeId).filter((t) => t.revealed);
  if (!adj.length) return;
  requestChooseTile(state, {
    allowedIds: adj.map((t) => t.id),
    action: "movePlayer",
    playerId: player.id,
    title: `Move ${player.name}`,
    detail: `Choose an adjacent Landscape for ${player.name}.`,
  });
}

function repressFromHand(state, player, count, reason = "") {
  if (count <= 0) return;
  enqueueRepressFromHand(state, player, count, {
    reason: reason || `${player.name}: Repress ${count} Psyche from hand.`,
  });
}

function repressTopMindstreamSuit(state, suit) {
  const deck = state.mindstreamDecks?.[suit];
  if (!deck?.length) return;
  repressCard(state, deck.shift());
  addLog(state, `Repress top ${suit} Mindstream card → Subconscious.`);
}

function repressTopPsycheDeck(state, count = 1) {
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
  }
}

function grantFreeMeetAction(state) {
  state.meetActionBudget = (state.meetActionBudget || 0) + 1;
  logMoment(state, "Gain 1 free Meet Action this phase.");
}

function spawnMindstreamEncounter(state, player, suit, helpers) {
  const pulled = pullDreambeastFromMindstream(state, { suit });
  if (pulled) {
    const encounter = encounterFromDreambeastCard(pulled.card);
    setEncounterOnLandscape(state, player.landscapeId, encounter);
    addLog(state, `${encounter.name} emerges from the ${suit} Mindstream!`);
    return encounter;
  }
  helpers.spawnEncounter(state, player.landscapeId);
  return null;
}

function tryFlipLeviathan(state, helpers) {
  return !!flipLeviathan(state, helpers);
}

export const EXTRA_MINDSTREAM_EFFECTS = {
  // —— Lucidity (new) ——
  "afternoon-nap": (state, player) => {
    beginAfternoonNap(state, player);
  },
  "evening-plans": (state, player, helpers) => {
    rememberEventHelpers(helpers);
    beginEveningPlans(state, player);
  },
  "im-still-dreaming": (state, player) => {
    beginImStillDreaming(state, player);
  },
  "a-way-out-forms": (state, player, helpers, event) => {
    logAffectedStatus(state, event, "A Way Out Forms");
    beginWayOut(state, player, event);
  },
  "voice-in-the-distance": (state, player) => {
    grantPowerTokens(state, player, 1);
    moveToIfRevealed(state, player, ["road", "endless-hallway"]);
  },
  "somethings-over-there": (state, player) => {
    beginSomethingOverThere(state, player);
  },
  "mist-swirls": (state, player) => {
    beginMistSwirls(state, player);
  },
  lightness: (state, player) => {
    beginLightness(state, player);
  },
  "the-council-of-the-years": (state, player) => {
    beginCouncil(state, player);
  },
  sublimation: (state, player) => {
    beginSublimation(state, player);
  },
  serenity: (state, player) => {
    const n = drawPsycheForPlayer(state, player, 3);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    grantPowerTokens(state, player, 1);
    moveToIfRevealed(state, player, ["the-party", "day-in-the-life"]);
  },
  "keep-it-together": (state, player) => {
    beginKeepItTogether(state, player);
  },
  "wrong-classroom": (state, player) => {
    repressTopMindstreamSuit(state, "lucidity");
    const n = state.board.filter((t) => t.encounter).length + 1;
    enqueueRepressFromHand(state, player, n, {
      reason: `Wrong Classroom: discard ${n} Psyche (Encounters+1).`,
    });
  },
  "everyones-laughing": (state, player) => {
    beginEveryonesLaughing(state, player);
  },
  "caught-cheating": (state, player) => {
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    const n = drawPsycheForPlayer(state, player, 1);
    const drawn = n[0];
    if (drawn && player.hand.some((c) => c.value === drawn.value)) returnN(state, 4, player);
    else if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    recordQuestEvent(state, "draw_psyche", { count: n.length });
  },
  "feel-deal-heal": (state, player, helpers, event) => {
    tryFlipLeviathan(state, helpers);
    if (player.hand.length) {
      const lowest = player.hand.reduce((a, c) => ((c.value || 0) < (a.value || 0) ? c : a));
      player.hand = player.hand.filter((c) => c.instanceId !== lowest.instanceId);
      state.psycheDiscard.push(lowest);
    }
    state.psycheDeck = shuffle([...state.psycheDeck, ...state.psycheDiscard.splice(0)]);
    drawPsycheForPlayer(state, player, 1);
    logAffectedStatus(state, event, "Feel, Deal, Heal");
    drawPsycheForPlayer(state, player, countAffectedLandscapes(state, event));
  },

  // —— Elasticity (new) ——
  "a-million-reflections": (state, player) => {
    beginMillionReflections(state, player);
  },
  "this-will-have-to-do": (state, player) => {
    beginThisWillHaveToDo(state, player);
  },
  "is-that-music": (state, player) => {
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    drawPsycheForPlayer(state, player, 1);
    if (stat(player, "elasticity") >= 3) {
      grantPowerTokens(state, player, 1);
      moveToIfRevealed(state, player, ["awards", "the-party"]);
    }
  },
  "cotton-candy": (state, player) => {
    beginCottonCandy(state, player);
  },
  insulation: (state, player) => {
    player.objects.push({
      id: "insulation",
      name: "Insulation",
      type: "object",
      subtype: "persistent",
      suit: "elasticity",
      instanceId: uid("obj"),
      text: "Next Explore, Move+1. Then Discard.",
    });
    addLog(state, `${player.name} keeps Insulation — +1 Explore move next phase.`);
  },
  "shimmering-slivers": (state, player, helpers, event) => {
    if (helpers?.drawObjects) helpers.drawObjects(state, player, 1, helpers);
    logAffectedStatus(state, event, "Shimmering Slivers");
    drawPsycheForPlayer(state, player, countAffectedLandscapes(state, event));
  },
  diamonds: (state, player) => {
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    drawPsycheForPlayer(state, player, 1);
    returnN(state, 4, player);
    grantPowerTokens(state, player, 1);
  },
  "desert-oasis": (state, player) => {
    drawPsycheForPlayer(state, player, 3);
    grantPowerTokens(state, player, 1);
    moveToIfRevealed(state, player, ["house", "suburbia"]);
  },
  "need-water": (state, player) => {
    beginNeedWater(state, player);
  },
  "broken-toys": (state, player) => {
    repressFromHand(state, player, 2);
    drawPsycheForPlayer(state, player, 2);
  },
  flooded: (state, player) => {
    if (stat(player, "elasticity") <= 2) moveToIfRevealed(state, player, ["endless-ocean"]);
    else moveToIfRevealed(state, player, ["house", "suburbia"]);
  },
  "giant-animated-pile": (state, player, helpers) => {
    beginGiantPile(state, player, helpers);
  },
  "dust-bunnies": (state, player, helpers) => {
    const pulled = pullDreambeastFromMindstream(state);
    if (pulled) {
      repressCard(state, pulled.card);
      if (player.hand.length) repressCard(state, player.hand.pop());
    }
    if (helpers?.drawObjects) helpers.drawObjects(state, player, 1, helpers);
  },
  "lost-treasure": (state, player, helpers, event) => {
    if (stat(player, "elasticity") <= 2 && player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
    } else {
      drawPsycheForPlayer(state, player, 3);
    }
    logAffectedStatus(state, event, "Lost Treasure");
    returnN(state, countAffectedLandscapes(state, event), player);
  },
  "wrong-door": (state, player) => {
    beginWrongDoor(state, player);
  },
  "hidden-in-the-walls": (state, player, helpers) => {
    beginHiddenInTheWalls(state, player, helpers);
  },
  "deeper-darker": (state, player, helpers, event) => {
    if (stat(player, "elasticity") <= 2 && player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
    } else if (helpers?.drawObjects) {
      helpers.drawObjects(state, player, 1, helpers);
    }
    logAffectedStatus(state, event, "Deeper Darker");
    if (allListedLandscapesRevealed(state, event)) {
      alive(state).forEach((p) => drawPsycheForPlayer(state, p, 2));
      logMoment(state, "Deeper Darker — all listed Landscapes revealed; all Dreamers draw 2 Psyche.");
    }
  },
  "the-right-door": (state, player) => {
    if (stat(player, "elasticity") <= 2 && player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
    } else {
      drawPsycheForPlayer(state, player, 3);
    }
  },
  "just-out-of-reach": (state, player, helpers, event) => {
    if (stat(player, "elasticity") >= 3 && player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
      logAffectedStatus(state, event, "Just out of Reach");
      returnN(state, countAffectedLandscapes(state, event), player);
    }
  },
  splinters: (state, player, helpers) => {
    const a = pullDreambeastFromMindstream(state);
    const b = pullDreambeastFromMindstream(state);
    if (a && landscapeById(state, "endless-hallway")?.revealed) {
      setEncounterOnLandscape(state, "endless-hallway", encounterFromDreambeastCard(a.card));
    }
    if (b && landscapeById(state, "the-attic")?.revealed) {
      setEncounterOnLandscape(state, "the-attic", encounterFromDreambeastCard(b.card));
    }
    if (!a && !b) repressFromHand(state, player, 2);
  },
  "searing-day": (state, player) => {
    if (stat(player, "elasticity") <= 2) repressFromHand(state, player, 2);
    else drawPsycheForPlayer(state, player, 2);
  },
  "a-mirage": (state, player, helpers) => {
    beginAMirage(state, player, helpers);
  },
  sandstorm: (state, player) => {
    if (stat(player, "elasticity") <= 2) {
      if (player.objects?.length) player.objects.pop();
      else if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    } else {
      moveToIfRevealed(state, player, ["tranquil-grove", "inner-sanctum"]);
    }
  },

  // —— Willpower (new) ——
  "rhythm-of-the-night": (state, player) => {
    beginRhythm(state, player);
  },
  "roiling-doom": (state, player) => {
    beginRoilingDoom(state, player);
  },
  "perilous-pinnacle": (state, player) => {
    beginPerilousPinnacle(state, player);
  },
  "cooling-obsidian": (state, player) => {
    const tile = state.board.find((t) => t.encounter);
    if (tile) {
      repressCard(state, tile.encounter);
      tile.encounter = null;
    }
    moveToIfRevealed(state, player, ["endless-ocean", "field-of-broken-glass"]);
  },
  "from-the-fire": (state, player) => {
    beginFromTheFire(state, player);
  },
  "a-sacrifice": (state, player, helpers, event) => {
    beginASacrifice(state, player, event);
  },
  "big-wave": (state, player) => {
    beginBigWave(state, player);
  },
  fog: (state, player) => {
    const idx = player.hand.findIndex((c) => c.suit === "willpower");
    if (idx >= 0) {
      state.psycheDiscard.push(player.hand.splice(idx, 1)[0]);
      drawPsycheForPlayer(state, player, 2);
    }
    moveToIfRevealed(state, player, ["silver-mist"]);
  },
  "a-mouth-rises": (state, player, helpers) => {
    beginMouthRises(state, player, helpers);
  },
  whirlpool: (state, player, helpers) => {
    if (stat(player, "willpower") <= 2) tryFlipLeviathan(state, helpers);
    else moveToIfRevealed(state, player, ["endless-ocean", "sea-of-teeth"]);
  },
  "syrup-lake": (state, player) => {
    grantPowerTokens(state, player, 1);
    drawPsycheForPlayer(state, player, 1);
    moveToIfRevealed(state, player, ["candy-mountain"]);
  },
  "peppermint-peak": (state, player) => {
    const wp = stat(player, "willpower");
    const card = player.hand.find((c) => c.suit === "willpower" && (c.value || 0) <= wp);
    if (card) {
      player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
      state.psycheDiscard.push(card);
    }
    drawPsycheForPlayer(state, player, 3);
  },
  "licorice-bridge": (state, player) => {
    drawPsycheForPlayer(state, player, 1);
    state.skipExploreNextRound = true;
    state.skipExploreReason = "Licorice Bridge";
    logMoment(state, "Licorice Bridge — the next Explore Phase will be skipped.");
  },
  "chocolate-mines": (state, player, helpers, event) => {
    drawPsycheForPlayer(state, player, 1);
    logAffectedStatus(state, event, "Chocolate Mines");
    drawPsycheForPlayer(state, player, 2 * countAffectedLandscapes(state, event));
  },
  "marshmallow-clouds": (state, player, helpers) => {
    rememberEventHelpers(helpers);
    beginMarshmallow(state, player, helpers);
  },
  "ivory-calm": (state, player) => {
    if (stat(player, "willpower") <= 2) drawPsycheForPlayer(state, player, 1);
    else {
      drawPsycheForPlayer(state, player, 1);
      returnN(state, 3, player);
    }
  },
  "tartar-algae": (state, player, helpers, event) => {
    logAffectedStatus(state, event, "Tartar Algae");
    const n = countAffectedLandscapes(state, event);
    drawPsycheForPlayer(state, player, n);
    returnN(state, n, player);
  },
  "caramel-forest": (state, player) => {
    beginCaramelForest(state, player);
  },
  "chewed-to-dust": (state, player) => {
    beginChewedToDust(state, player);
  },
  "gap-in-the-teeth": (state, player) => {
    drawPsycheForPlayer(state, player, 2);
    moveToIfRevealed(state, player, ["candy-mountain", "endless-ocean"]);
  },
  "no-why": (state, player, helpers) => {
    rememberEventHelpers(helpers);
    beginNoWhy(state, player, helpers);
  },
  "i-remember": (state, player) => {
    beginIRemember(state, player);
  },
  "dream-for-landscapes": (state, player, helpers, event) => {
    logAffectedStatus(state, event, "Dream Toll");
    const n = countAffectedLandscapes(state, event);
    for (let i = 0; i < n && state.dreamDeck.length; i += 1) {
      state.dreamDiscard.push(state.dreamDeck.pop());
    }
  },
  bronze: (state, player, helpers, event) => {
    logAffectedStatus(state, event, "Bronze");
    beginBronze(state, player, event);
  },
  silver: (state, player, helpers, event) => {
    logAffectedStatus(state, event, "Silver");
    beginSilver(state, player, event);
  },
};
