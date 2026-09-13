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
  addLog(state, "Gain 1 free Meet Action this phase.");
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
  const onBoard = state.board.find((t) => t.encounter?.id === "leviathan");
  if (onBoard) {
    addLog(state, "Leviathan flips — encounter intensifies!");
    return true;
  }
  return false;
}

function drawFromAnyMindstream(state, player, count = 1) {
  const suits = shuffle(["lucidity", "elasticity", "willpower"]);
  for (let i = 0; i < count; i += 1) {
    for (const suit of suits) {
      const deck = state.mindstreamDecks[suit];
      if (deck?.length) {
        const card = deck.shift();
        if (card.type === "object") player.objects.push({ ...card, instanceId: uid("obj") });
        else if (card.type === "dreambeast") {
          setEncounterOnLandscape(state, player.landscapeId, encounterFromDreambeastCard(card));
        }
        addLog(state, `${player.name} draws ${card.name} from ${suit} Mindstream.`);
        break;
      }
    }
  }
}

export const EXTRA_MINDSTREAM_EFFECTS = {
  // —— Lucidity (new) ——
  "afternoon-nap": (state, player) => {
    const n = drawPsycheForPlayer(state, player, 1);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    const luc = stat(player, "lucidity");
    if (player.hand.length < luc) returnN(state, luc, player);
  },
  "evening-plans": (state, player, helpers) => {
    const n = drawPsycheForPlayer(state, player, 1);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    if (Math.random() < 0.5) {
      revealHidden(state, 1);
    } else {
      spawnMindstreamEncounter(state, player, "lucidity", helpers);
    }
  },
  "im-still-dreaming": (state, player) => {
    if (player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
      recordQuestEvent(state, "discard_psyche", { count: 1 });
    }
    moveToIfRevealed(state, player, ["insanity", "day-in-the-life"]);
  },
  "a-way-out-forms": (state, player, helpers, event) => {
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    logAffectedStatus(state, event, "A Way Out Forms");
    const affected = countAffectedLandscapes(state, event);
    revealHidden(state, Math.min(affected, 3));
  },
  "voice-in-the-distance": (state, player) => {
    grantPowerTokens(state, player, 1);
    moveToIfRevealed(state, player, ["road", "endless-hallway"]);
  },
  "somethings-over-there": (state, player, helpers) => {
    const choice = pullTwoDreambeastsForChoice(state);
    if (choice?.pick) {
      setEncounterOnLandscape(state, player.landscapeId, encounterFromDreambeastCard(choice.pick));
      addLog(state, `Something's Over There: ${choice.pick.name} appears.`);
    } else {
      spawnMindstreamEncounter(state, player, "lucidity", helpers);
    }
  },
  "mist-swirls": (state, player) => {
    if (state.dreamDeck.length) state.dreamDiscard.push(state.dreamDeck.pop());
    if (stat(player, "lucidity") >= 3 && player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
      revealHidden(state, dreamerCount(state) + 1);
    }
  },
  lightness: (state, player) => {
    const n = drawPsycheForPlayer(state, player, 2);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    if (player.hand.length) {
      const card = player.hand.pop();
      state.psycheDiscard.push(card);
      alive(state).forEach((p) => drawPsycheForPlayer(state, p, card.value || 1));
    }
  },
  "the-council-of-the-years": (state, player, helpers) => {
    const drawn = drawPsycheForPlayer(state, player, 4);
    drawn.slice(0, 3).forEach((c) => repressCard(state, c));
    if (drawn[3]) player.hand.push(drawn[3]);
  },
  sublimation: (state, player) => {
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    returnN(state, 1, player);
    grantPowerTokens(state, player, 1);
  },
  serenity: (state, player) => {
    const n = drawPsycheForPlayer(state, player, 3);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    grantPowerTokens(state, player, 1);
    moveToIfRevealed(state, player, ["the-party", "day-in-the-life"]);
  },
  "keep-it-together": (state, player) => {
    const objs = [...(player.objects || []), ...(player.persistent || [])];
    if (!objs.length) return;
    repressFromHand(state, player, objs.length, "Keep it Together: Repress or discard Psyche per Object.");
  },
  "wrong-classroom": (state, player) => {
    repressTopMindstreamSuit(state, "lucidity");
    const enc = state.board.find((t) => t.encounter);
    if (enc?.encounter && player.hand.length) {
      repressCard(state, player.hand.pop());
    }
  },
  "everyones-laughing": (state, player) => {
    if (player.objects?.length >= 2) {
      player.objects.splice(0, 2).forEach((o) => discardToMindstream(state, o));
    }
    const encCount = state.board.filter((t) => t.encounter).length;
    repressFromHand(state, player, Math.max(1, Math.floor(encCount / 2)));
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
    const piles = ["lucidity", "elasticity", "willpower"];
    let repressed = 0;
    piles.forEach((suit) => {
      const discard = state.mindstreamDiscard[suit];
      if (discard?.length && repressed < 4) {
        repressCard(state, discard.pop());
        repressed += 1;
      }
    });
    returnN(state, 4, player);
  },
  "this-will-have-to-do": (state, player) => {
    const ela = stat(player, "elasticity");
    if (player.hand.length) {
      const card = player.hand.find((c) => (c.value || 0) <= ela) || player.hand[0];
      player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
      state.psycheDiscard.push(card);
    }
    drawPsycheForPlayer(state, player, 2);
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
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    const val = player.hand.at(-1)?.value || 3;
    drawPsycheForPlayer(state, player, val);
    moveToIfRevealed(state, player, ["candy-mountain"]);
    drawPsycheForPlayer(state, player, 3);
  },
  insulation: (state, player) => {
    player.objects.push({
      id: "insulation",
      name: "Insulation",
      type: "object",
      subtype: "persistent",
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
    if (player.hand.length) state.psycheDiscard.push(player.hand.pop());
    const wp = player.hand.find((c) => c.suit === "willpower");
    if (wp) {
      player.hand = player.hand.filter((c) => c.instanceId !== wp.instanceId);
      state.psycheDiscard.push(wp);
    } else {
      player.objects.splice(0).forEach((o) => discardToMindstream(state, o));
    }
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
    const pulled = pullDreambeastFromMindstream(state);
    if (pulled) {
      const enc = encounterFromDreambeastCard(pulled.card);
      enc.accept = Math.ceil((enc.accept || 8) / 2);
      enc.reject = Math.ceil((enc.reject || 6) / 2);
      setEncounterOnLandscape(state, player.landscapeId, enc);
      addLog(state, `${enc.name} emerges (half Accept/Repress costs).`);
    } else {
      helpers.spawnEncounter(state, player.landscapeId);
    }
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
  "wrong-door": (state) => {
    addLog(state, "Wrong Door: Return 2 Dreambeasts from Accept Pile (if able).");
  },
  "hidden-in-the-walls": (state, player, helpers) => {
    drawPsycheForPlayer(state, player, 1);
    spawnMindstreamEncounter(state, player, "elasticity", helpers);
  },
  "deeper-darker": (state, player, helpers, event) => {
    if (stat(player, "elasticity") <= 2 && player.hand.length) {
      state.psycheDiscard.push(player.hand.pop());
    } else if (helpers?.drawObjects) {
      helpers.drawObjects(state, player, 1, helpers);
    }
    logAffectedStatus(state, event, "Deeper Darker");
    if (hasAffectedLandscapes(state, event)) {
      alive(state).forEach((p) => drawPsycheForPlayer(state, p, 2));
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
    spawnMindstreamEncounter(state, player, "elasticity", helpers);
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
  "rhythm-of-the-night": (state) => {
    alive(state).forEach((p) => {
      if (p.objects?.length) p.objects.pop();
      drawPsycheForPlayer(state, p, 2);
    });
  },
  "roiling-doom": (state, player, helpers) => {
    repressFromHand(state, player, 2);
    const choice = pullTwoDreambeastsForChoice(state);
    if (choice?.pick) {
      setEncounterOnLandscape(state, player.landscapeId, encounterFromDreambeastCard(choice.pick));
      addLog(state, `Roiling Doom: Meet ${choice.pick.name} now!`);
    }
  },
  "perilous-pinnacle": (state, player) => {
    player.objects.splice(0, 2).forEach((o) => discardToMindstream(state, o));
    addLog(state, "Perilous Pinnacle: Meet both active Encounters in order.");
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
    returnN(state, 2, player);
  },
  "a-sacrifice": (state, player) => {
    if (player.objects?.length) {
      const obj = player.objects.pop();
      discardToMindstream(state, obj);
      returnN(state, dreamerCount(state) + 1, player);
    }
    state.board.filter((t) => t.encounter).forEach((t) => {
      repressCard(state, t.encounter);
      t.encounter = null;
    });
  },
  "big-wave": (state, player) => {
    drawPsycheForPlayer(state, player, 1);
    const high = player.hand.reduce((best, c) => ((c.value || 0) > (best?.value || 0) ? c : best), null);
    if (high) {
      player.hand = player.hand.filter((c) => c.instanceId !== high.instanceId);
      state.psycheDiscard.push(high);
      returnN(state, 3, player);
    } else {
      repressFromHand(state, player, countAffectedLandscapes(state, { landscapes: [] }));
    }
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
    tryFlipLeviathan(state, helpers);
    moveToIfRevealed(state, player, ["endless-ocean"]);
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
    addLog(state, "Licorice Bridge: skip next Explore phase.");
  },
  "chocolate-mines": (state, player, helpers, event) => {
    drawPsycheForPlayer(state, player, 1);
    logAffectedStatus(state, event, "Chocolate Mines");
    drawPsycheForPlayer(state, player, 2 * countAffectedLandscapes(state, event));
  },
  "marshmallow-clouds": (state, player, helpers) => {
    grantPowerTokens(state, player, 2);
    drawFromAnyMindstream(state, player, 1);
    alive(state).forEach((p) => grantPowerTokens(state, p, 1));
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
  "caramel-forest": (state, player, helpers) => {
    const choice = pullTwoDreambeastsForChoice(state);
    if (choice?.pick) {
      const adj = adjacentTiles(state, player.landscapeId).find((t) => t.revealed);
      if (adj) setEncounterOnLandscape(state, adj.id, encounterFromDreambeastCard(choice.pick));
    }
  },
  "chewed-to-dust": (state, player) => {
    ["lucidity", "elasticity", "willpower"].forEach((s) => repressTopMindstreamSuit(state, s));
    if (player.hand.length >= 3) {
      repressFromHand(state, player, 3);
    } else if (state.dreamDeck.length) {
      state.dreamDeck.pop();
      addLog(state, "Chewed to Dust: discarded 1 Dream.");
    }
  },
  "gap-in-the-teeth": (state, player) => {
    drawPsycheForPlayer(state, player, 2);
    moveToIfRevealed(state, player, ["candy-mountain", "endless-ocean"]);
  },
  "no-why": (state) => {
    alive(state).forEach((p) => drawFromAnyMindstream(state, p, 1));
  },
  "i-remember": (state, player) => {
    const wp = stat(player, "willpower");
    const card = player.hand.find((c) => (c.value || 0) <= wp);
    if (card) {
      player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
      state.psycheDiscard.push(card);
    }
    returnN(state, 1 + wp, player);
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
    const beast = pullDreambeastFromMindstream(state);
    if (beast && hasAffectedLandscapes(state, event)) {
      const tiles = state.board.filter((t) => t.revealed && !t.encounter && event.landscapes?.includes(t.id));
      if (tiles.length) {
        requestChooseTile(state, {
          allowedIds: tiles.map((t) => t.id),
          action: "spawnEncounter",
          encounter: encounterFromDreambeastCard(beast),
          title: "Bronze — spawn a Dreambeast",
          detail: "Choose an affected Landscape for the Dreambeast.",
        });
      }
    }
    addLog(state, "Bronze: return 2 Dreambeasts from Accept pile (simplified).");
  },
  silver: (state, player, helpers, event) => {
    logAffectedStatus(state, event, "Silver");
    const beast = pullDreambeastFromMindstream(state);
    if (beast && hasAffectedLandscapes(state, event)) {
      const tiles = state.board.filter((t) => t.revealed && !t.encounter && event.landscapes?.includes(t.id));
      if (tiles.length) {
        requestChooseTile(state, {
          allowedIds: tiles.map((t) => t.id),
          action: "spawnEncounter",
          encounter: encounterFromDreambeastCard(beast),
          title: "Silver — spawn a Dreambeast",
          detail: "Choose an affected Landscape for the Dreambeast.",
        });
      }
    }
  },
};
