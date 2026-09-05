import {
  addLog,
  drawPsycheForPlayer,
  revealLandscapeTile,
  landscapeById,
  acquireArchetype,
  setEncounterOnLandscape,
} from "./state.js";
import { shuffle, uid } from "./data.js";
import { recordQuestEvent } from "./quests.js";
import { repressCard, requestReturnCards } from "./subconscious.js";

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function personaCount(state) {
  return alive(state).length;
}

function returnN(state, count, player = null) {
  if (count <= 0) return;
  const result = requestReturnCards(state, count, player);
  if (result?.pending) addLog(state, `Choose ${result.count} card(s) to Return.`);
}

function movePlayerTo(state, player, ids) {
  const id = ids.find((i) => landscapeById(state, i)?.revealed);
  if (!id) return false;
  player.landscapeId = id;
  addLog(state, `${player.name} moves to ${landscapeById(state, id).name}.`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

function spawnOnRandomTiles(state, helpers, count = 1, filterFn = null) {
  const tiles = state.board.filter((t) => t.revealed && !t.encounter && !t.center);
  const picks = shuffle(tiles).slice(0, count);
  picks.forEach((tile) => {
    if (filterFn && !filterFn()) return;
    helpers.spawnEncounter(state, tile.id);
  });
}

function spawnFilteredDreambeast(state, helpers, landscapeId, { maxAccept = null, minAccept = null } = {}) {
  const pool = state.dreambeastDeck.filter((b) => {
    if (maxAccept != null && b.accept > maxAccept) return false;
    if (minAccept != null && b.accept < minAccept) return false;
    return !b.boss;
  });
  if (!pool.length) {
    helpers.spawnEncounter(state, landscapeId);
    return;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const idx = state.dreambeastDeck.findIndex((b) => b.id === pick.id);
  const beast = state.dreambeastDeck.splice(idx, 1)[0];
  const encounter = { ...beast, instanceId: uid("enc") };
  const tile = landscapeById(state, landscapeId);
  if (tile) {
    setEncounterOnLandscape(state, landscapeId, encounter);
  }
  addLog(state, `${beast.name} appears on ${tile?.name || "the Dreamscape"}!`);
}

function drawMindstreamTop(state, suit) {
  const deck = state.mindstreamDecks[suit];
  if (!deck?.length) return null;
  const card = deck.shift();
  state.mindstreamDiscard[suit].push(card);
  return card;
}

function replayDreamFromDiscard(state, player, helpers) {
  const pile = state.dreamDiscard || [];
  if (!pile.length) {
    addLog(state, "No Dreams in the discard pile.");
    return;
  }
  const card = pile[pile.length - 1];
  addLog(state, `Replay Dream: ${card.name}.`);
  if (helpers?.resolveCardEffect) {
    helpers.resolveCardEffect(state, card, player, helpers);
  }
}

function reorderDeckTop(state, deckKey, count = 3) {
  const deck = state[deckKey];
  if (!deck?.length) {
    addLog(state, "Deck is empty.");
    return;
  }
  const top = deck.splice(0, Math.min(count, deck.length));
  top.reverse();
  deck.unshift(...top);
  addLog(state, `Knife: reordered top ${top.length} of ${deckKey}.`);
}

function trackChessPlay(state, player) {
  player.chessPlayed = (player.chessPlayed || 0) + 1;
  if (player.chessPlayed >= 3) {
    player.chessPlayed = 0;
    returnN(state, personaCount(state) + 2, player);
    addLog(state, "Chess Set complete: Return Dreamers+2 Cards.");
  }
}

export function checkObjectTagSet(state, player, tag) {
  if (!player.persistent) player.persistent = [];
  const tagged = player.persistent.filter((o) => o.tags?.some((t) => t.startsWith(tag)));
  if (tagged.length < 3) return;

  if (tag === "chess") {
    returnN(state, personaCount(state) + 2, player);
    addLog(state, "Chess Set complete: Return Dreamers+2 Cards.");
  } else if (tag === "stick") {
    returnN(state, personaCount(state) + 3, player);
    addLog(state, "Stick Set complete: Return Dreamers+3 Cards.");
  } else if (tag === "body") {
    returnN(state, personaCount(state) + 5, player);
    addLog(state, "Body Set complete: Return Dreamers+5 Cards.");
  } else if (tag === "jewelry") {
    if (state.activeArchetype?.questProgress?.every(Boolean)) {
      acquireArchetype(state, player);
      addLog(state, "Jewelry Set complete: Acquired available Archetype.");
    } else {
      addLog(state, "Jewelry Set complete, but Archetype quests are not finished.");
    }
  }
}

/** All instant Object play effects keyed by card id. */
export const OBJECT_EFFECTS = {
  candle: (state) => {
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    const count = Math.min(hidden.length, personaCount(state) + 1);
    hidden.slice(0, count).forEach((t) => revealLandscapeTile(state, t));
    if (count) {
      recordQuestEvent(state, "reveal_landscape", { count });
      addLog(state, `Candle reveals ${count} Landscape(s).`);
    } else {
      returnN(state, 2);
    }
  },

  mirror: (state, player) => {
    if (landscapeById(state, "field-of-broken-glass")?.revealed) {
      player.landscapeId = "field-of-broken-glass";
      addLog(state, `${player.name} moves to Field of Broken Glass.`);
    } else {
      returnN(state, 1, player);
    }
  },

  "rabbits-foot": (state) => {
    state.pendingPowerBonus = (state.pendingPowerBonus || 0) + 3;
    addLog(state, "Rabbit's Foot: +3 wild to next Psyche play.");
  },

  "possibility-polyhedral": (state, player, helpers) => {
    const suits = ["lucidity", "elasticity", "willpower"];
    const suit = suits.find((s) => state.mindstreamDecks[s]?.length);
    if (suit) {
      const echo = drawMindstreamTop(state, suit);
      addLog(state, `Possibility Polyhedral echoes ${echo?.name || "Mindstream"}.`);
    }
    const tile = state.board.find((t) => t.revealed && !t.encounter);
    helpers.spawnEncounter(state, tile?.id || player.landscapeId);
  },

  "raven-claw": (state, player) => {
    movePlayerTo(state, player, ["sky"]);
  },

  "bag-of-teeth": (state, player) => {
    movePlayerTo(state, player, ["sea-of-teeth", "house"]);
  },

  "marble-grid": (state, player, helpers) => {
    spawnOnRandomTiles(state, helpers, 2);
    returnN(state, personaCount(state) + 2, player);
    if (player.hand.length) {
      repressCard(state, player.hand.pop());
      recordQuestEvent(state, "discard_psyche", { count: 1 });
    }
    trackChessPlay(state, player);
  },

  "ivory-pawn": (state, player, helpers) => {
    const tile = state.board.find((t) => t.revealed && !t.encounter);
    spawnFilteredDreambeast(state, helpers, tile?.id || player.landscapeId, { maxAccept: 8 });
    trackChessPlay(state, player);
    returnN(state, personaCount(state) + 2, player);
  },

  "ebony-pawn": (state, player, helpers) => {
    const tile = state.board.find((t) => t.revealed && !t.encounter);
    spawnFilteredDreambeast(state, helpers, tile?.id || player.landscapeId, { minAccept: 9 });
    trackChessPlay(state, player);
    returnN(state, personaCount(state) + 2, player);
  },

  flower: (state, player) => {
    movePlayerTo(state, player, ["tranquil-grove"]);
    returnN(state, 4, player);
  },

  "psychic-owl": (state, player) => {
    const revealed = state.board.filter((t) => t.revealed);
    if (revealed.length) {
      player.landscapeId = revealed[0].id;
      addLog(state, `${player.name} moves to ${revealed[0].name}.`);
    }
    returnN(state, 2, player);
  },

  "red-apple": (state, player, helpers) => {
    const drawn = ["lucidity", "elasticity", "willpower"]
      .map((suit) => drawMindstreamTop(state, suit))
      .filter(Boolean);
    if (!drawn.length) {
      addLog(state, "No Mindstream cards to draw.");
      return;
    }
    const pick = drawn[Math.floor(Math.random() * drawn.length)];
    addLog(state, `Red Apple resolves: ${pick.name}.`);
    if (helpers?.resolveCardEffect) {
      helpers.resolveCardEffect(state, pick, player, helpers);
    }
  },

  "tear-of-moon": (state) => {
    alive(state).forEach((p) => {
      drawPsycheForPlayer(state, p, 2);
      returnN(state, 2, p);
    });
  },

  "spark-of-sun": (state) => {
    alive(state).forEach((p) => {
      drawPsycheForPlayer(state, p, 2);
      returnN(state, 2, p);
    });
  },

  coins: (state) => {
    alive(state).forEach((p) => {
      p.powerTokens += 1;
      recordQuestEvent(state, "power_token", { count: 1 });
    });
    addLog(state, "Coins: each Dreamer gains 1 Power Token.");
  },

  egg: (state, player) => {
    const room = 10 - player.hand.length;
    if (room > 0) drawPsycheForPlayer(state, player, Math.min(10, room));
  },

  "the-all": (state, player, helpers) => {
    returnN(state, personaCount(state) + 8);
    replayDreamFromDiscard(state, player, helpers);
  },

  knife: (state) => {
    const decks = ["psycheDeck", "dreamDeck", "objectDeck", "dreambeastDeck"];
    const key = decks.find((d) => state[d]?.length > 1) || "psycheDeck";
    reorderDeckTop(state, key, 3);
  },

  "crystal-bell": (state, player, helpers) => {
    replayDreamFromDiscard(state, player, helpers);
  },

  "tooth-saber": (state, player) => {
    if (!state.activeEncounter) {
      addLog(state, "Tooth-Saber: no active Encounter.");
      return;
    }
    if (!player.hand.length) {
      addLog(state, "Tooth-Saber: discard 1 Psyche to Meet an Encounter.");
      return;
    }
    const discarded = player.hand.pop();
    state.psycheDiscard.push(discarded);
    const enc = state.activeEncounter;
    const value = discarded.value || 0;
    const landscapeId = state.activeEncounterLandscapeId;
    addLog(state, `${player.name} discards ${value} Psyche for Tooth-Saber.`);
    if (value >= enc.repress) {
      const tile = landscapeById(state, landscapeId);
      if (tile) tile.encounter = null;
      state.activeEncounter = null;
      state.activeEncounterLandscapeId = null;
      addLog(state, `Meets ${enc.name} (${value} ≥ ${enc.repress}).`);
      recordQuestEvent(state, "meet_on_landscape", { landscapeId });
    } else {
      addLog(state, `Not enough Psyche (${value}) to Meet ${enc.name} (need ${enc.repress}).`);
    }
  },

  hammer: (state, player) => {
    movePlayerTo(state, player, ["house"]);
    returnN(state, 1, player);
  },

  "the-one": (state) => {
    addLog(state, "The One counts as 1 Object toward a Set (passive).");
  },

  "the-nothing": (state) => {
    let left = personaCount(state) + 6;
    alive(state).forEach((p) => {
      while (left > 0 && p.hand.length) {
        repressCard(state, p.hand.pop());
        left -= 1;
      }
    });
    addLog(state, "The Nothing represses Psyche across the Dreamers.");
  },
};
