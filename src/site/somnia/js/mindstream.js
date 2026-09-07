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
import { grantPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards, enqueueRepressFromHand } from "./subconscious.js";
import { adjacentTiles, edgeLandscapes } from "./hex.js";
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

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function stat(player, key) {
  return player.dreamer[key] ?? 0;
}

function personaCount(state) {
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
  const id = ids.find((i) => landscapeById(state, i)?.revealed);
  if (!id) return false;
  player.landscapeId = id;
  addLog(state, `${player.name} moves to ${landscapeById(state, id).name}.`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

function moveAdjacent(state, player) {
  const adj = adjacentTiles(state, player.landscapeId).filter((t) => t.revealed);
  if (!adj.length) return;
  player.landscapeId = adj[0].id;
  addLog(state, `${player.name} moves to ${adj[0].name}.`);
  recordQuestEvent(state, "move_player", { count: 1 });
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
  let kept = 0;
  state.board.forEach((t) => {
    if (!t.encounter) return;
    if (keepOne && kept === 0) {
      kept = 1;
      return;
    }
    repressCard(state, t.encounter);
    t.encounter = null;
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
  const onBoard = state.board.find((t) => t.encounter?.id === "leviathan");
  if (onBoard) {
    addLog(state, "Leviathan flips — encounter intensifies!");
    return true;
  }
  const inDream = state.dreamDeck.findIndex((c) => c.id === "leviathan" || c.boss);
  if (inDream >= 0) {
    const boss = state.dreamDeck.splice(inDream, 1)[0];
    helpers.spawnEncounter(state, "bed");
    addLog(state, "Leviathan emerges from the Dream Deck!");
    return true;
  }
  return false;
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
    returnN(state, 1 + personaCount(state), player);
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
    const luc = stat(player, "lucidity");
    if (luc <= 1) {
      const n = drawPsycheForPlayer(state, player, 1);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    } else if (luc >= 3) {
      returnN(state, 2, player);
      const n = drawPsycheForPlayer(state, player, 1);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
      returnN(state, 2, player);
    } else {
      const n = drawPsycheForPlayer(state, player, 1);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    }
  },

  denial: (state, player) => {
    const extra = stat(player, "lucidity") >= 3 ? personaCount(state) : 0;
    returnN(state, 4 + extra, player);
  },

  "forgot-clothes": (state, player) => {
    repressFromHand(state, player, 1);
    const luc = stat(player, "lucidity");
    if (luc >= 3) moveToAnyRevealed(state, player);
    else moveAdjacent(state, player);
  },

  "pop-quiz": (state, player) => {
    const n = drawPsycheForPlayer(state, player, 1);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    const guess = Math.random() < 0.5 ? "higher" : "lower";
    const next = state.psycheDeck[0]?.value ?? 3;
    const drawn = n[0]?.value ?? 0;
    const correct = (guess === "higher" && next > drawn) || (guess === "lower" && next < drawn);
    if (correct) {
      returnN(state, personaCount(state) + 3, player);
      addLog(state, `Pop Quiz: guessed ${guess} — correct!`);
    } else {
      addLog(state, `Pop Quiz: guessed ${guess} — wrong.`);
    }
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
    moveToAnyRevealed(state, player);
    grantPowerTokens(state, player, 1);
    recordQuestEvent(state, "power_token", { count: 1 });
    addLog(state, "Place this Power on an Archetype quest when its condition is met.");
  },

  "freezing-night": (state, player, helpers, event) => {
    const ela = stat(player, "elasticity");
    const wp = stat(player, "willpower");
    if (ela <= 2) {
      const drawn = [];
      for (let i = 0; i < 2; i += 1) {
        const n = drawPsycheForPlayer(state, player, 1);
        drawn.push(...n);
      }
      if (drawn.length > 1) {
        const keep = drawn[Math.floor(Math.random() * drawn.length)];
        drawn.filter((c) => c.instanceId !== keep.instanceId).forEach((c) => {
          player.hand = player.hand.filter((x) => x.instanceId !== c.instanceId);
          state.psycheDiscard.push(c);
        });
      }
      recordQuestEvent(state, "draw_psyche", { count: 1 });
    }
    logAffectedStatus(state, event, "Freezing Night");
    if (wp >= 3 && hasAffectedLandscapes(state, event) && helpers?.drawObjects) {
      const objs = helpers.drawObjects(state, player, 2, helpers);
      if (objs.length > 1) {
        player.objects = player.objects.filter((o) => o.instanceId === objs[0].instanceId);
      }
    }
  },

  friendship: (state, player, helpers, event) => {
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    const revealed = hidden.slice(0, 2).map((t) => {
      revealLandscapeTile(state, t);
      return t;
    });
    recordQuestEvent(state, "reveal_landscape", { count: revealed.length });
    const dest = revealed.find((t) => t.id === state.selectedLandscapeId) || revealed[0];
    if (dest) {
      player.landscapeId = dest.id;
      addLog(state, `${player.name} moves to ${dest.name}.`);
      recordQuestEvent(state, "move_player", { count: 1 });
    }
    logAffectedStatus(state, event, "Friendship");
    if (hasAffectedLandscapes(state, event) && stat(player, "elasticity") >= 3) {
      grantFreeMeetAction(state);
    }
  },

  "get-up": (state, player, helpers, event) => {
    drawFromPsycheDiscard(state, player);
    logAffectedStatus(state, event, "Get Up");
    if (hasAffectedLandscapes(state, event)) {
      if (landscapeById(state, "forest")?.revealed) {
        moveToIfRevealed(state, player, ["forest"]);
      }
      moveToIfRevealed(state, player, ["the-attic"]);
      grantFreeMeetAction(state);
    }
  },

  "get-down": (state, player, helpers, event) => {
    drawFromPsycheDiscard(state, player);
    logAffectedStatus(state, event, "Get Down");
    if (hasAffectedLandscapes(state, event)) {
      if (landscapeById(state, "city")?.revealed) {
        moveToIfRevealed(state, player, ["city"]);
      }
      moveToIfRevealed(state, player, ["the-basement"]);
      grantFreeMeetAction(state);
    }
  },

  revolving: (state, player) => {
    const n = drawPsycheForPlayer(state, player, 3);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    repressFromHand(state, player, 1, `${player.name}: Revolving — Repress 1 Psyche from hand.`);
    const others = alive(state).filter((p) => p.id !== player.id);
    if (others.length) swapDreamers(state, player, others[0]);
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
    let left = personaCount(state) + 2;
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

  "no-time": (state) => {
    alive(state).forEach((p) => {
      if (p.objects.length) {
        const obj = p.objects.pop();
        discardToMindstream(state, obj);
      }
    });
    addLog(state, "No Time: each Dreamer discards 1 Object.");
  },

  "no-where": (state) => {
    forgetLandscapes(state, 4);
    repressTopPsycheDeck(state, 1);
    alive(state).forEach((p) => {
      const n = drawPsycheForPlayer(state, p, 2);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    });
    state.freeExploreNextRound = true;
    addLog(state, "No Where: next Explore allows free grid movement.");
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
    const choice = pullTwoDreambeastsForChoice(state);
    if (!choice) return;
    const encounter = encounterFromDreambeastCard(choice.pick);
    setEncounterOnLandscape(state, player.landscapeId, encounter);
    repressTopMindstreamSuit(state, "willpower");
    addLog(
      state,
      `Who's There?: ${choice.pick.name} appears${choice.alt ? ` (over ${choice.alt.name})` : ""}. Meet now if you can.`,
    );
  },

  "no-one": (state, player) => {
    if (stat(player, "willpower") >= 3) {
      const tile = state.board.find((t) => t.encounter);
      if (tile) {
        repressCard(state, tile.encounter);
        tile.encounter = null;
        addLog(state, "No One: discarded 1 Encounter.");
      }
    } else {
      clearEncounters(state);
      addLog(state, "No One: all active Encounters discarded.");
    }
  },

  metamorphosis: (state, player, helpers, event) => {
    const encCount = state.board.filter((t) => t.encounter).length;
    clearEncounters(state);
    repressFromHand(state, player, encCount + 2);
    logAffectedStatus(state, event, "Metamorphosis");
    const affected = countAffectedLandscapes(state, event);
    if (affected > 0) {
      forgetLandscapes(state, 2 * affected);
      addLog(state, `Metamorphosis — Forgot ${2 * affected} Landscapes (${affected} Affected).`);
    }
  },

  contagion: (state, player, helpers, event) => {
    repressFromHand(state, player, 2);
    logAffectedStatus(state, event, "Contagion");
    if (stat(player, "lucidity") <= 2 && hasAffectedLandscapes(state, event)) {
      const affected = countAffectedLandscapes(state, event);
      repressFromHand(state, player, affected);
    }
  },
};
