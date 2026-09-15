import {
  addLog,
  drawPsycheForPlayer,
  forgetLandscapes,
  revealLandscapeTile,
  landscapeById,
  setEncounterOnLandscape,
  tileEncounters,
  removeEncounterFromLandscape,
  allEncountersOnBoard,
  countEncountersOnBoard,
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
  hasAffectedLandscapes,
  dreamersOnAffectedLandscapes,
  logAffectedStatus,
} from "./event-landscapes.js";
import { EXTRA_MINDSTREAM_EFFECTS } from "./mindstream-extra.js";
import { flipLeviathan } from "./dreambeasts.js";
import {
  beginPopQuiz,
  beginHarmonicResonance,
  beginKeepItTogether,
  beginEveryonesLaughing,
  beginRevolving,
  beginFriendship,
  beginFreezingNight,
  beginNoTime,
  beginWhoIsThere,
  beginNoOne,
  beginUndulatingFloor,
  beginGetUpDown,
} from "./event-choices.js";

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
  const result = requestReturnCards(state, count, player);
  if (result?.pending) {
    addLog(state, `Choose ${result.count} card(s) to Return from the Subconscious.`);
  }
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

function moveToAnyRevealed(state, player) {
  const tile = state.board.find((t) => t.revealed && t.id !== player.landscapeId);
  if (tile) {
    player.landscapeId = tile.id;
    addLog(state, `${player.name} moves to ${tile.name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
  }
}

function moveToEdge(state, player) {
  const edges = edgeLandscapes(state).filter((t) => t.revealed);
  if (edges[0]) {
    player.landscapeId = edges[0].id;
    addLog(state, `${player.name} moves to edge Landscape ${edges[0].name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
  }
}

function moveNearBed(state, player) {
  const adj = adjacentTiles(state, "bed").filter((t) => t.revealed);
  if (adj[0]) {
    player.landscapeId = adj[0].id;
    addLog(state, `${player.name} moves near The Bed → ${adj[0].name}.`);
  }
}

function discardHighestPsyche(state, player) {
  if (!player.hand.length) return null;
  const card = player.hand.reduce((best, c) =>
    ((c.value || 0) > (best.value || 0) ? c : best));
  player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
  state.psycheDiscard.push(card);
  recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
  return card;
}

function discardSuitPsyche(state, player, suit, count) {
  let n = 0;
  for (let i = 0; i < count; i += 1) {
    const idx = player.hand.findIndex((c) => c.suit === suit);
    if (idx < 0) break;
    state.psycheDiscard.push(player.hand.splice(idx, 1)[0]);
    n += 1;
  }
  if (n) recordQuestEvent(state, "discard_psyche", { count: n, landscapeId: player.landscapeId });
  return n;
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
  let repressed = 0;
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
    repressed += 1;
  }
  if (repressed) addLog(state, `Repress ${repressed} Psyche from top of Psyche deck → Subconscious.`);
}

function drawFromPsycheDiscard(state, player) {
  if (!state.psycheDiscard.length) return;
  player.hand.push(state.psycheDiscard.pop());
  recordQuestEvent(state, "draw_psyche", { count: 1 });
}

function grantFreeMeetAction(state) {
  state.meetActionBudget = (state.meetActionBudget || 0) + 1;
  addLog(state, "Gain 1 free Meet Action this phase.");
}

function swapDreamers(state, player, other) {
  const temp = player.landscapeId;
  player.landscapeId = other.landscapeId;
  other.landscapeId = temp;
  addLog(state, `${player.name} and ${other.name} swap positions.`);
  recordQuestEvent(state, "move_player", { count: 2 });
}

function clearEncounters(state, keepOne = false) {
  const encounters = allEncountersOnBoard(state);
  const toClear = keepOne ? encounters.slice(1) : encounters;
  toClear.forEach(({ tile, encounter }) => {
    repressCard(state, encounter);
    removeEncounterFromLandscape(state, tile.id, encounter);
  });
  if (!keepOne) {
    state.activeEncounter = null;
    state.activeEncounterLandscapeId = null;
  }
}

function spawnMindstreamEncounter(state, player, suit, helpers) {
  const pulled = pullDreambeastFromMindstream(state, { suit });
  if (pulled) {
    const encounter = encounterFromDreambeastCard(pulled.card);
    setEncounterOnLandscape(state, player.landscapeId, encounter);
    addLog(state, `${encounter.name} emerges from the ${suit} Mindstream!`);
    return;
  }
  helpers.spawnEncounter(state, player.landscapeId);
}

function transportedMove(state, player) {
  const drawn = [];
  for (let i = 0; i < 2; i += 1) {
    const n = drawPsycheForPlayer(state, player, 1);
    drawn.push(...n);
  }
  if (drawn.length < 2) return;
  const revealed = state.board.filter((t) => t.revealed);
  if (!revealed.length) return;
  const col = (drawn[0].value || 1) - 1;
  const row = (drawn[1].value || 1) - 1;
  const target = revealed[(col + row) % revealed.length];
  player.landscapeId = target.id;
  addLog(state, `Transported to ${target.name} (grid ${col + 1},${row + 1}).`);
  recordQuestEvent(state, "move_player", { count: 1 });
}

function swapUnoccupiedTiles(state, count = 4) {
  const empty = state.board.filter(
    (t) => t.revealed && !alive(state).some((p) => p.landscapeId === t.id)
  );
  const picks = shuffle(empty).slice(0, count);
  if (picks.length < 2) return;
  for (let i = 0; i + 1 < picks.length; i += 2) {
    const a = picks[i];
    const b = picks[i + 1];
    const q = a.q;
    const r = a.r;
    a.q = b.q;
    a.r = b.r;
    b.q = q;
    b.r = r;
  }
  addLog(state, `Blooming swaps ${picks.length} unoccupied Landscape positions.`);
}

function tryFlipLeviathan(state, helpers) {
  return !!flipLeviathan(state, helpers);
}

/** All 41 Mindstream event handlers keyed by card id. */
export const MINDSTREAM_EFFECTS = {
  // —— Lucidity ——
  "fantastic-imagination": (state, player) => {
    revealHidden(state, 1);
    if (stat(player, "lucidity") >= 3) returnN(state, 3, player);
    else revealHidden(state, 1);
  },

  centering: (state, player) => {
    drawPsycheForPlayer(state, player, 2);
    alive(state).forEach((p) => {
      drawPsycheForPlayer(state, p, 1);
      grantPowerTokens(state, p, 1);
      recordQuestEvent(state, "power_token", { count: 1 });
    });
    moveAdjacent(state, player);
  },

  "the-ascent": (state, player, helpers, event) => {
    const run = (p) => {
      discardHighestPsyche(state, p);
      const n = drawPsycheForPlayer(state, p, 2);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    };
    run(player);
    logAffectedStatus(state, event, "The Ascent");
    dreamersOnAffectedLandscapes(state, event)
      .filter((p) => p.id !== player.id)
      .forEach(run);
  },

  "beyond-comprehension": (state, player, helpers) => {
    if (!tryFlipLeviathan(state, helpers)) {
      forgetLandscapes(state, 4);
      returnN(state, 4, player);
    }
  },

  "just-a-dream": (state, player, helpers, event) => {
    const n = drawPsycheForPlayer(state, player, 3);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    logAffectedStatus(state, event, "Just a Dream");
    const affected = countAffectedLandscapes(state, event);
    if (affected > 0) {
      returnN(state, affected, player);
      addLog(state, `Just a Dream — Return ${affected} (Affected Landscapes).`);
    }
  },

  "morning-routine": (state, player, helpers, event) => {
    const n = drawPsycheForPlayer(state, player, 1);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    repressTopMindstreamSuit(state, "lucidity");
    logAffectedStatus(state, event, "Morning Routine");
    const affected = countAffectedLandscapes(state, event);
    if (affected > 0) {
      const extra = drawPsycheForPlayer(state, player, affected);
      recordQuestEvent(state, "draw_psyche", { count: extra.length });
      addLog(state, `Morning Routine — drew ${extra.length} extra Psyche (${affected} Affected).`);
    }
  },

  "i-know-this-place": (state, player) => {
    returnN(state, 1 + dreamerCount(state), player);
  },

  "a-face-appears": (state, player, helpers, event) => {
    spawnMindstreamEncounter(state, player, "lucidity", helpers);
    logAffectedStatus(state, event, "A Face Appears");
    if (hasAffectedLandscapes(state, event) && stat(player, "lucidity") >= 3) {
      returnN(state, 3, player);
    }
  },

  transported: (state, player) => {
    transportedMove(state, player);
  },

  "harmonic-resonance": (state, player) => {
    beginHarmonicResonance(state, player);
  },

  denial: (state, player) => {
    const extra = stat(player, "lucidity") >= 3 ? dreamerCount(state) : 0;
    returnN(state, 4 + extra, player);
  },

  "forgot-clothes": (state, player) => {
    repressFromHand(state, player, 1);
    const luc = stat(player, "lucidity");
    if (luc >= 3) {
      const dests = state.board.filter((t) => t.revealed && !t.wasteland);
      requestChooseTile(state, {
        allowedIds: dests.map((t) => t.id),
        action: "movePlayer",
        playerId: player.id,
        title: "Forgot Clothes",
        detail: "Move to any Landscape.",
      });
    } else moveAdjacent(state, player);
  },

  "pop-quiz": (state, player) => {
    beginPopQuiz(state, player);
  },

  "sacred-geometry": (state, player, helpers, event) => {
    moveNearBed(state, player);
    logAffectedStatus(state, event, "Sacred Geometry");
    const affected = countAffectedLandscapes(state, event);
    if (affected > 0) {
      returnN(state, 2 * affected, player);
      addLog(state, `Sacred Geometry — Return ${2 * affected} (${affected} Affected).`);
    }
  },

  // —— Elasticity ——
  "a-shining-wind": (state, player, helpers, event) => {
    if (stat(player, "elasticity") >= 3) {
      grantPowerTokens(state, player, 2);
      recordQuestEvent(state, "power_token", { count: 2 });
    }
    logAffectedStatus(state, event, "A Shining Wind");
    if (hasAffectedLandscapes(state, event)) {
      moveToIfRevealed(state, player, ["silver-mist", "endless-ocean"]);
    }
  },

  "roof-dive": (state, player, helpers, event) => {
    if (stat(player, "elasticity") < 3) {
      addLog(state, "Need Elasticity 3+ for Roof Dive.");
      return;
    }
    logAffectedStatus(state, event, "Roof Dive");
    if (hasAffectedLandscapes(state, event)) {
      moveToIfRevealed(state, player, ["sky", "the-party", "candy-mountain"]);
    }
  },

  "into-the-next": (state, player) => {
    alive(state).forEach((p) => {
      const n = drawPsycheForPlayer(state, p, 1);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    });
    repressTopMindstreamSuit(state, "elasticity");
    moveAdjacent(state, player);
    grantFreeMeetAction(state);
  },

  "running-somewhere": (state, player, helpers, event) => {
    const n = drawPsycheForPlayer(state, player, 1);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    logAffectedStatus(state, event, "Running Somewhere?");
    if (
      hasAffectedLandscapes(state, event)
      && stat(player, "elasticity") >= 3
      && player.hand.length
    ) {
      const card = player.hand.pop();
      state.psycheDiscard.push(card);
      returnN(state, card.value || 1, player);
    }
  },

  "portal-another-world": (state, player) => {
    const ela = stat(player, "elasticity");
    const moves = ela >= 3 ? 3 : 1;
    state.exploreMovesLeft = (state.exploreMovesLeft || 0) + moves;
    moveToEdge(state, player);
    addLog(state, `Portal: ${moves} move(s) toward the Dreamscape edge.`);
  },

  "undulating-floor": (state, player) => {
    beginUndulatingFloor(state, player);
  },

  "freezing-night": (state, player, helpers, event) => {
    logAffectedStatus(state, event, "Freezing Night");
    beginFreezingNight(state, player, helpers);
    if (hasAffectedLandscapes(state, event) && stat(player, "elasticity") >= 3) {
      grantFreeMeetAction(state);
    }
  },

  friendship: (state, player, helpers, event) => {
    beginFriendship(state, player);
    logAffectedStatus(state, event, "Friendship");
    if (hasAffectedLandscapes(state, event) && stat(player, "elasticity") >= 3) {
      grantFreeMeetAction(state);
    }
  },

  "get-up": (state, player) => {
    beginGetUpDown(state, player, { optionalId: "forest", forcedId: "the-attic", label: "Get Up" });
  },

  "get-down": (state, player) => {
    beginGetUpDown(state, player, { optionalId: "city", forcedId: "the-basement", label: "Get Down" });
  },

  revolving: (state, player) => {
    beginRevolving(state, player);
  },

  blooming: (state, player) => {
    swapUnoccupiedTiles(state, 4);
    repressFromHand(state, player, 1, `${player.name}: Blooming — Repress 1 Psyche from hand.`);
  },

  "break-out": (state, player) => {
    if (player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
      recordQuestEvent(state, "discard_psyche", { count: 1 });
    }
    const n = drawPsycheForPlayer(state, player, 1);
    const drawn = n[0];
    if (drawn && player.hand.some((c) => c.value === drawn.value && c.instanceId !== drawn.instanceId)) {
      returnN(state, 4, player);
      addLog(state, "Break-out: matched drawn Psyche — Return 4!");
    }
    recordQuestEvent(state, "draw_psyche", { count: n.length });
  },

  // —— Willpower ——
  "a-thousand-daggers": (state) => {
    let left = dreamerCount(state) + 2;
    alive(state).forEach((p) => {
      while (left > 0 && p.hand.length) {
        repressCard(state, p.hand.pop());
        left -= 1;
      }
    });
    addLog(state, "A Thousand Daggers: team Represses Psyche → Subconscious.");
  },

  "flashing-lights": (state, player) => {
    const n = drawPsycheForPlayer(state, player, 2);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    grantPowerTokens(state, player, 2);
    recordQuestEvent(state, "power_token", { count: 2 });
  },

  "heating-up": (state, player, helpers) => {
    helpers.spawnEncounter(state, player.landscapeId);
    addLog(state, "Heating Up: Meet this Encounter. Accept spawns another; Repress draws to hand limit.");
    state.pendingHeatingUp = true;
    grantFreeMeetAction(state);
  },

  "no-thing": (state, player) => {
    const discard = Math.min(3, state.dreamDeck.length);
    state.dreamDeck.splice(-discard, discard);
    addLog(state, `Discarded ${discard} Dream card(s) from the deck.`);
    if (stat(player, "willpower") >= 3 && state.dreamDeck.length) {
      const card = state.dreamDeck.pop();
      state.dreamDeck = shuffle([...state.dreamDeck, card]);
      addLog(state, `Returned ${card.name} to the Dream Deck and shuffled.`);
    }
  },

  "no-time": (state, player) => {
    beginNoTime(state, player);
  },

  "no-where": (state) => {
    forgetLandscapes(state, 4);
    repressTopPsycheDeck(state, 1);
    alive(state).forEach((p) => {
      const n = drawPsycheForPlayer(state, p, 2);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    });
    state.freeExploreNextRound = true;
    logMoment(state, "No Where — free movement anywhere next Explore Phase.");
  },

  "choppy-water": (state, player) => {
    if (discardSuitPsyche(state, player, "willpower", 1)) {
      drawPsycheForPlayer(state, player, 1);
      returnN(state, 4, player);
    } else {
      addLog(state, "Choppy Water: need 1 Willpower Psyche to discard.");
    }
  },

  "clear-as-crystal": (state, player) => {
    const n = drawPsycheForPlayer(state, player, 3);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    if (stat(player, "willpower") >= 3) returnN(state, 2, player);
  },

  "jaw-shark": (state, player) => {
    const discarded = discardSuitPsyche(state, player, "willpower", 2);
    if (discarded >= 2) return;
    const remaining = 2 - discarded;
    if (player.hand.length) {
      repressFromHand(state, player, remaining, `${player.name}: Jaw Shark — Repress ${remaining} Psyche from hand.`);
      return;
    }
    const all = [...(player.objects || []), ...(player.persistent || [])];
    player.objects = [];
    player.persistent = [];
    all.forEach((o) => discardToMindstream(state, o));
    addLog(state, "Jaw Shark: unable to pay — discarded all Objects.");
  },

  "golden-tooth": (state, player, helpers) => {
    const wp = stat(player, "willpower");
    if (wp <= 2) {
      const n = drawPsycheForPlayer(state, player, 2);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    } else if (helpers?.drawObjects) {
      helpers.drawObjects(state, player, 1, helpers);
    } else {
      drawPsycheForPlayer(state, player, 1);
    }
  },

  "who-is-there": (state, player) => {
    beginWhoIsThere(state, player);
  },

  "no-one": (state, player) => {
    beginNoOne(state, player);
  },

  metamorphosis: (state, player, helpers, event) => {
    const encCount = countEncountersOnBoard(state);
    clearEncounters(state);
    repressTopPsycheDeck(state, encCount + 2);
    logAffectedStatus(state, event, "Metamorphosis");
    const affected = countAffectedLandscapes(state, event);
    if (affected > 0) {
      forgetLandscapes(state, 2 * affected);
      addLog(state, `Metamorphosis — Forgot ${2 * affected} Landscapes (${affected} Affected).`);
    }
  },

  contagion: (state, player, helpers, event) => {
    repressTopPsycheDeck(state, 2);
    logAffectedStatus(state, event, "Contagion");
    if (stat(player, "lucidity") <= 2 && hasAffectedLandscapes(state, event)) {
      const affected = countAffectedLandscapes(state, event);
      repressTopPsycheDeck(state, affected);
    }
  },

  ...EXTRA_MINDSTREAM_EFFECTS,
};
