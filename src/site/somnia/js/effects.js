import {
  addLog,
  drawPsycheForPlayer,
  forgetLandscapes,
  revealLandscapeTile,
  beginFinalRecurrence,
  landscapeById,
  setEncounterOnLandscape,
  acquireArchetype,
} from "./state.js";
import { forgetEdgeLandscapes } from "./landscapes.js";
import { recordQuestEvent } from "./quests.js";
import { opposingSuit } from "./rules.js";
import { adjacentTiles, hexDistance, edgeLandscapes } from "./hex.js";
import {
  repressCard,
  requestReturnCards,
  enqueueRepressObjects,
  enqueueRepressFromHand,
} from "./subconscious.js";
import { discardToMindstream } from "./mindstream-supply.js";
import { MINDSTREAM_EFFECTS } from "./mindstream.js";
import { OBJECT_EFFECTS } from "./object-effects.js";
import { uid } from "./data.js";

function alivePlayers(state) {
  return state.players.filter((p) => p.alive);
}

function playerStat(player, stat) {
  return player.dreamer[stat] ?? 0;
}

export function returnCards(state, count, player = null) {
  const result = requestReturnCards(state, count, player);
  if (result?.pending) {
    addLog(state, `Choose ${result.count} card(s) to Return from the Subconscious.`);
    return [];
  }
  return result;
}

export function allDrawPsyche(state, count) {
  alivePlayers(state).forEach((p) => {
    const n = drawPsycheForPlayer(state, p, count);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
  });
}

export function repressFromHand(state, player, count, { reason = "" } = {}) {
  if (count <= 0) return;
  enqueueRepressFromHand(state, player, count, {
    reason: reason || `${player.name}: Repress ${count} Psyche card(s) from hand.`,
  });
}

function personaCount(state) {
  return alivePlayers(state).length;
}

function dominantSuit(player) {
  const stats = {
    lucidity: playerStat(player, "lucidity"),
    elasticity: playerStat(player, "elasticity"),
    willpower: playerStat(player, "willpower"),
  };
  return Object.entries(stats).sort((a, b) => b[1] - a[1])[0][0];
}

function cornerTiles(state) {
  const bed = landscapeById(state, "bed");
  if (!bed) return [];
  const outer = state.board.filter((t) => t.revealed && !t.center);
  const maxDist = Math.max(0, ...outer.map((t) => hexDistance(t, bed)));
  return outer.filter((t) => hexDistance(t, bed) === maxDist);
}

function moveEncounterAwayFromBed(state, fromTileId, steps = 2) {
  const bed = landscapeById(state, "bed");
  const from = landscapeById(state, fromTileId);
  if (!from?.encounter || !bed) return [];

  const encounter = from.encounter;
  const carried = alivePlayers(state)
    .filter((p) => p.landscapeId === fromTileId)
    .map((p) => p.id);

  let currentId = fromTileId;
  for (let step = 0; step < steps; step += 1) {
    const neighbors = adjacentTiles(state, currentId).filter(
      (t) => t.revealed && !t.encounter && t.id !== "bed",
    );
    if (!neighbors.length) break;
    const next = neighbors.sort((a, b) => hexDistance(b, bed) - hexDistance(a, bed))[0];
    currentId = next.id;
  }

  if (currentId === fromTileId) return carried;

  const to = landscapeById(state, currentId);
  from.encounter = null;
  to.encounter = encounter;
  carried.forEach((pid) => {
    const player = state.players.find((p) => p.id === pid);
    if (player) player.landscapeId = currentId;
  });
  addLog(state, `${encounter.name} abducted to ${to.name}.`);
  return carried;
}

function drawPsycheFromDiscard(state, player, count) {
  let drawn = 0;
  for (let i = 0; i < count && state.psycheDiscard.length; i += 1) {
    player.hand.push(state.psycheDiscard.pop());
    drawn += 1;
  }
  if (drawn) recordQuestEvent(state, "draw_psyche", { count: drawn });
  return drawn;
}

function movePlayerOneLandscape(state, player) {
  const adj = adjacentTiles(state, player.landscapeId).filter((t) => t.revealed);
  if (!adj.length) return false;
  const dest = adj[0];
  player.landscapeId = dest.id;
  addLog(state, `${player.name} moves to ${dest.name}.`);
  recordQuestEvent(state, "move_player", { count: 1 });
  return true;
}

/** Clear per-round dream flags at the start of a new round. */
export function clearDreamRoundFlags(state) {
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

export function canSpendMeetAction(state, player, action, MEET_ACTIONS) {
  if (state.skipLandscapeActionsNextMeet && action === MEET_ACTIONS.LANDSCAPE) {
    return false;
  }
  if (state.abductionCarried?.includes(player.id) && action !== MEET_ACTIONS.MEET) {
    return false;
  }
  if (state.chaseTrapped?.includes(player.id) && action !== MEET_ACTIONS.MEET) {
    return false;
  }
  return true;
}

export function onExploreMove(state) {
  if (!state.wanderlustTarget) return;
  state.wanderlustMoves = (state.wanderlustMoves || 0) + 1;
}

export function onExplorePhaseEnd(state) {
  if (!state.wanderlustTarget) return;
  if ((state.wanderlustMoves || 0) >= state.wanderlustTarget) {
    allDrawPsyche(state, 3);
    addLog(state, "Wanderlust fulfilled — all Dreamers Draw 3 Psyche!");
  }
  state.wanderlustTarget = 0;
  state.wanderlustMoves = 0;
}

export function onMeetPhaseEnd(state) {
  if (state.rivalryLeftover > 0) {
    let cost = state.rivalryLeftover;
    alivePlayers(state).forEach((p) => {
      while (cost > 0 && p.hand.length) {
        state.psycheDiscard.push(p.hand.pop());
        cost -= 1;
      }
    });
    recordQuestEvent(state, "discard_psyche", { count: state.rivalryLeftover });
    addLog(state, `Rivalry: leftover Encounters cost ${state.rivalryLeftover} Psyche.`);
  }
  state.rivalryLeftover = 0;
  state.rivalryEncountersOnBed = 0;
  state.paradoxMeet = false;
  state.chaseDream = false;
  state.chaseTrapped = [];
  state.abductionCarried = [];
  state.meetOnlyRound = false;
  state.skipLandscapeActionsNextMeet = false;
  state.pickEncounterOnSpawn = false;
}

const DREAM_EFFECTS = {
  heroism: (state) => {
    alivePlayers(state).forEach((p) => {
      drawPsycheForPlayer(state, p, playerStat(p, "willpower"));
    });
  },
  injury: (state) => {
    alivePlayers(state).forEach((p) => {
      const wp = playerStat(p, "willpower");
      const kept = p.hand.filter((c) => (c.value || 0) <= wp);
      const removed = p.hand.length - kept.length;
      p.hand = kept;
      recordQuestEvent(state, "discard_psyche", { count: removed });
    });
  },
  chase: (state, _player, helpers) => {
    state.chaseTrapped = [];
    alivePlayers(state).forEach((p) => {
      helpers.spawnEncounter(state, p.landscapeId);
      if (playerStat(p, "elasticity") <= playerStat(p, "willpower")) {
        state.chaseTrapped.push(p.id);
      }
    });
    state.chaseDream = true;
    addLog(state, "Chase: Dreamers who cannot outrun must Meet this round.");
  },
  recovery: (state) => {
    alivePlayers(state).forEach(() => returnCards(state, 1));
  },
  "well-being": (state) => allDrawPsyche(state, 3),
  quiet: (state) => addLog(state, "Nothing happens."),
  betrayal: (state) => {
    alivePlayers(state).forEach((p) => {
      const n = Math.max(0, playerStat(p, "willpower") - playerStat(p, "lucidity"));
      enqueueRepressObjects(state, p, n, {
        reason: `Betrayal — ${p.name}: Repress ${n} Object(s) (Willpower ${playerStat(p, "willpower")} − Lucidity ${playerStat(p, "lucidity")}).`,
      });
    });
  },
  travel: (state) => {
    state.freeExploreNextRound = true;
    state.skipLandscapeActionsNextMeet = true;
    addLog(state, "Next Explore: each Dreamer may move anywhere for free.");
  },
  judgement: (state, _player, helpers) => {
    const targets = ["sea-of-teeth", "endless-ocean"];
    const spawnTile = targets
      .map((id) => landscapeById(state, id))
      .find((t) => t?.revealed)
      || state.board.find((t) => t.revealed && !t.center);
    if (!spawnTile) return;

    const leviathan = {
      id: "leviathan",
      name: "Leviathan",
      type: "dreambeast",
      boss: true,
      suit: "willpower",
      accept: 12,
      repress: 10,
      instanceId: uid("enc"),
    };
    setEncounterOnLandscape(state, spawnTile.id, leviathan);

    const occupied = state.board
      .filter((t) => t.revealed && alivePlayers(state).some((p) => p.landscapeId === t.id))
      .sort((a, b) => hexDistance(a, spawnTile) - hexDistance(b, spawnTile))[0];

    if (occupied && occupied.id !== spawnTile.id) {
      spawnTile.encounter = null;
      setEncounterOnLandscape(state, occupied.id, leviathan);
      addLog(state, `Judgement awakens Leviathan on ${occupied.name}!`);
    } else {
      addLog(state, `Judgement awakens Leviathan on ${spawnTile.name}!`);
    }
  },
  misunderstanding: (state) => {
    let left = personaCount(state) + 3;
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      const deck = state.mindstreamDiscard[suit];
      while (deck.length && left > 0) {
        repressCard(state, deck.pop());
        left -= 1;
      }
    });
    addLog(state, "Misunderstanding: Mindstream cards Repressed.");
  },
  mortality: (state) => {
    alivePlayers(state).forEach((p) => {
      if (p.hand.length >= 4) {
        for (let i = 0; i < 4 && p.hand.length; i += 1) {
          state.psycheDiscard.push(p.hand.pop());
        }
      } else {
        const objs = [...(p.objects || [])].slice(0, 2);
        p.objects = p.objects.filter((o) => !objs.includes(o));
        objs.forEach((o) => discardToMindstream(state, o));
      }
    });
    addLog(state, "Mortality: each Dreamer pays the cost.");
  },
  abduction: (state) => {
    state.abductionCarried = [];
    state.board
      .filter((t) => t.encounter)
      .forEach((t) => {
        const carried = moveEncounterAwayFromBed(state, t.id, 2);
        state.abductionCarried.push(...carried);
      });
    state.meetOnlyRound = true;
    addLog(state, "Abduction: carried Dreamers may only Meet this round.");
  },
  absurdity: (state, player) => {
    const drawCount = personaCount(state) + 1;
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      const deck = state.mindstreamDecks[suit];
      for (let i = 0; i < drawCount && deck.length; i += 1) {
        const card = deck.shift();
        if (card?.type === "event") forgetLandscapes(state, 1);
        state.mindstreamDiscard[suit].push(card);
      }
    });
    addLog(state, "Absurdity: Mindstream Events reshape the Dreamscape.");
  },
  bargaining: (state) => {
    const arch = state.activeArchetype;
    alivePlayers(state).forEach((p) => {
      if (p.hand.length < 6) return;
      const suit = dominantSuit(p);
      if (!arch || arch.suit !== suit) return;
      for (let i = 0; i < 6; i += 1) {
        if (p.hand.length) state.psycheDiscard.push(p.hand.pop());
      }
      recordQuestEvent(state, "discard_psyche", { count: 6, landscapeId: p.landscapeId });
      if (arch.questProgress?.every(Boolean)) {
        acquireArchetype(state, p);
        addLog(state, `${p.name} bargains for ${arch.name}.`);
      } else {
        addLog(state, `${p.name} discards 6 Psyche toward ${arch.name} (quests incomplete).`);
      }
    });
    state.bargainingDream = true;
  },
  responsibility: (state) => {
    const n = personaCount(state);
    alivePlayers(state).forEach((p) => {
      const wpCards = p.hand.filter((c) => c.suit === "willpower");
      const wpSum = wpCards.slice(0, n).reduce((s, c) => s + (c.value || 0), 0);
      if (wpSum >= n) {
        wpCards.slice(0, n).forEach((c) => {
          p.hand = p.hand.filter((x) => x.instanceId !== c.instanceId);
          state.psycheDiscard.push(c);
        });
      } else {
        for (let i = 0; i < n && p.hand.length; i += 1) {
          state.psycheDiscard.push(p.hand.pop());
        }
      }
    });
  },
  wanderlust: (state) => {
    state.wanderlustTarget = personaCount(state) * 3;
    state.wanderlustMoves = 0;
    addLog(state, `Wanderlust: Explore ${state.wanderlustTarget} Landscapes this round for a reward.`);
  },
  transformation: (state) => {
    state.pickEncounterOnSpawn = true;
    addLog(state, "Transformation: next Spawn lets you pick from 2 Encounters.");
  },
  trapped: (state) => {
    state.skipExploreNextRound = true;
    addLog(state, "Trapped: skip the next Explore Phase.");
  },
  lost: (state) => {
    const bed = landscapeById(state, "bed");
    const neighbors = adjacentTiles(state, "bed").filter((t) => t.revealed);
    neighbors.forEach((t) => {
      t.revealed = false;
      t.wasteland = true;
      if (t.encounter) {
        repressCard(state, t.encounter);
        t.encounter = null;
      }
    });
    neighbors.forEach((t) => {
      alivePlayers(state)
        .filter((p) => p.landscapeId === t.id)
        .forEach((p) => {
          if (p.hand.length) {
            repressCard(state, p.hand.pop());
            addLog(state, `${p.name} pays Wasteland cost on ${t.name}.`);
          }
        });
    });
    addLog(state, "Lost: Landscapes adjacent to The Bed become Wasteland.");
  },
  misplaced: (state, player) => {
    const count = player.objects.length;
    if (!count) return;
    const wpCards = player.hand.filter((c) => c.suit === "willpower");
    const toSave = Math.min(count, wpCards.length);
    for (let i = 0; i < toSave; i += 1) {
      const idx = player.hand.findIndex((c) => c.suit === "willpower");
      if (idx < 0) break;
      state.psycheDiscard.push(player.hand.splice(idx, 1)[0]);
    }
    const repressed = player.objects.splice(toSave);
    repressed.forEach((o) => discardToMindstream(state, o));
    if (repressed.length) {
      addLog(state, `${player.name} Represses ${repressed.length} Object(s) (saved ${toSave}).`);
    } else {
      addLog(state, `${player.name} saves all Objects with Willpower Psyche.`);
    }
  },
  rivalry: (state, _player, helpers) => {
    const count = Math.max(1, Math.floor(personaCount(state) / 2));
    helpers.spawnEncounter(state, "bed");
    state.rivalryLeftover = Math.max(0, count - 1);
    state.rivalryEncountersOnBed = count;
    addLog(state, `Rivalry: ${count} Encounter(s) on The Bed (${state.rivalryLeftover} leftover cost at end of Meet).`);
  },
  temptation: (state) => {
    alivePlayers(state).forEach((p) => {
      const n = Math.min(3, p.objects.length);
      for (let i = 0; i < n; i += 1) {
        const obj = p.objects.pop();
        if (obj) discardToMindstream(state, obj);
      }
      if (n) {
        const drawn = drawPsycheForPlayer(state, p, n);
        recordQuestEvent(state, "draw_psyche", { count: drawn.length });
        addLog(state, `${p.name} discards ${n} Object(s) and Draws ${drawn.length} Psyche.`);
      }
    });
    state.temptationDream = true;
  },
  paradox: (state) => {
    state.paradoxMeet = true;
    addLog(state, "Paradox: Willpower and Elasticity costs swap next Meet Phase.");
  },
  powerlessness: (state, _player, helpers) => {
    const edges = edgeLandscapes(state).filter(
      (t) => t.revealed && !t.encounter && !alivePlayers(state).some((p) => p.landscapeId === t.id),
    );
    alivePlayers(state).forEach((p, i) => {
      const tile = edges[i % edges.length];
      if (tile) helpers.spawnEncounter(state, tile.id);
    });
    addLog(state, "Powerlessness: Encounters spawn on unoccupied edge Landscapes.");
  },
  loss: (state) => {
    let corners = cornerTiles(state).filter((t) => !t.wasteland);
    if (!corners.length) {
      const bed = landscapeById(state, "bed");
      const adjacent = new Set();
      cornerTiles(state).forEach((t) => {
        adjacentTiles(state, t.id).forEach((n) => {
          if (n.revealed && !n.wasteland && hexDistance(n, bed) < hexDistance(t, bed)) {
            adjacent.add(n);
          }
        });
      });
      corners = [...adjacent];
    }
    corners.slice(0, 4).forEach((t) => {
      t.revealed = false;
      t.wasteland = true;
      if (t.encounter) {
        repressCard(state, t.encounter);
        t.encounter = null;
      }
      addLog(state, `Loss: Forgot ${t.name}.`);
    });
    if (!corners.length) forgetLandscapes(state, 4);
  },
  abandonment: (state) => {
    state.board.forEach((t) => {
      if (t.encounter) {
        repressCard(state, t.encounter);
        t.encounter = null;
      }
    });
    const grouped = {};
    alivePlayers(state).forEach((p) => {
      (grouped[p.landscapeId] ||= []).push(p);
    });
    Object.entries(grouped).forEach(([landId, players]) => {
      if (players.length < 2) return;
      players.forEach((p) => {
        const empty = adjacentTiles(state, landId).find(
          (t) => t.revealed && !alivePlayers(state).some((x) => x.landscapeId === t.id),
        );
        if (empty) {
          p.landscapeId = empty.id;
          addLog(state, `${p.name} abandons to ${empty.name}.`);
        }
      });
    });
    addLog(state, "All Encounters abandoned to Subconscious.");
  },
  delta: (state) => {
    forgetEdgeLandscapes(state, 4);
    alivePlayers(state).forEach((p) => {
      if (p.hand.length) state.psycheDiscard.push(p.hand.pop());
    });
    recordQuestEvent(state, "discard_psyche", { count: personaCount(state) });
  },
  theta: (state) => {
    forgetEdgeLandscapes(state, 8);
    allDrawPsyche(state, 2);
  },
  alpha: (state, _player, helpers) => {
    forgetEdgeLandscapes(state, 4);
    alivePlayers(state).forEach((p) => {
      if (helpers?.drawObjects) helpers.drawObjects(state, p, 1, helpers);
    });
  },
  beta: (state) => {
    forgetEdgeLandscapes(state, 4);
    alivePlayers(state).forEach((p) => drawPsycheForPlayer(state, p, 1));
  },
  circadia: (state) => {
    alivePlayers(state).forEach((p) => {
      const n = drawPsycheFromDiscard(state, p, 4);
      if (n) addLog(state, `${p.name} draws ${n} Psyche from Discard.`);
    });
  },
  somnambulance: (state) => {
    alivePlayers(state).forEach((p) => movePlayerOneLandscape(state, p));
    addLog(state, "Somnambulance: each Dreamer moves 1 Landscape.");
  },
  homeostasis: (state, player) => {
    const n = drawPsycheForPlayer(state, player, 5);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
    addLog(state, `${player.name} Draws 5 Psyche (Homeostasis).`);
  },
  "pineal-purge": (state, player) => {
    let n = 0;
    for (let i = 0; i < 3 && player.hand.length; i += 1) {
      state.psycheDiscard.push(player.hand.pop());
      n += 1;
    }
    recordQuestEvent(state, "discard_psyche", { count: n, landscapeId: player.landscapeId });
    addLog(state, `${player.name} discards ${n} Psyche (Pineal Purge).`);
  },
  "final-recurrence": (state, _player, h) => h.beginFinalRecurrence(state),
  "you-never-wake": (state) => {
    state.status = "lost";
  },
};

function matchTextEffect(card, state, player, helpers) {
  const text = (card.text || "").toLowerCase();
  if (text.includes("draw") && text.includes("psyche") && !text.includes("discard")) {
    const m = text.match(/draw (\d+)/);
    const n = m ? parseInt(m[1], 10) : 1;
    if (text.includes("all") || text.includes("each") || text.includes("dreamers")) allDrawPsyche(state, n);
    else drawPsycheForPlayer(state, player, n);
    return true;
  }
  if (text.includes("forget") && text.includes("landscape")) {
    const m = text.match(/forget (\d+)/);
    forgetLandscapes(state, m ? parseInt(m[1], 10) : 1);
    return true;
  }
  if (text.includes("return") && text.includes("card")) {
    const m = text.match(/return (\d+)/);
    returnCards(state, m ? parseInt(m[1], 10) : 1, player);
    return true;
  }
  if (text.includes("reveal") && text.includes("landscape")) {
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    if (hidden[0]) {
      revealLandscapeTile(state, hidden[0]);
      recordQuestEvent(state, "reveal_landscape", { count: 1 });
    }
    return true;
  }
  if (text.includes("spawn") && text.includes("encounter")) {
    helpers.spawnEncounter(state, player.landscapeId);
    return true;
  }
  if (text.includes("take") && text.includes("power")) {
    const m = text.match(/(\d+) power/);
    const n = m ? parseInt(m[1], 10) : 1;
    player.powerTokens += n;
    recordQuestEvent(state, "power_token", { count: n });
    return true;
  }
  if (text.includes("repress")) {
    const m = text.match(/repress (\d+)/);
    repressFromHand(state, player, m ? parseInt(m[1], 10) : 1);
    return true;
  }
  return false;
}

export function resolveCardEffect(state, card, player, helpers) {
  if (!card) return;

  const id = (card.refId || card.id || "").toLowerCase();

  if (card.type === "power-token") {
    const n = card.powerTokens || 2;
    player.powerTokens += n;
    recordQuestEvent(state, "power_token", { count: n });
    addLog(state, `${player.name} takes ${n} Power Token(s).`);
    return;
  }

  if (card.type === "draw-dream") {
    addLog(state, "Draw 1 Additional Dream Card!");
    if (helpers?.drawAdditionalDream) {
      helpers.drawAdditionalDream(state);
    }
    return;
  }

  if (card.type === "dreambeast" && card.accept) {
    if (helpers?.spawnEncounterWithCard) {
      helpers.spawnEncounterWithCard(state, player.landscapeId, card);
    } else {
      helpers.spawnEncounter(state, player.landscapeId);
    }
    addLog(state, `${card.name} emerges from the Mindstream!`);
    return;
  }

  if (card.type === "object") {
    const effectId = card.refId || card.id;
    if (OBJECT_EFFECTS[effectId]) {
      OBJECT_EFFECTS[effectId](state, player, helpers);
      return;
    }
    player.objects.push({ ...card, instanceId: uid("obj") });
    addLog(state, `${player.name} gains ${card.name}.`);
    return;
  }

  if (card.type === "dream" && DREAM_EFFECTS[id]) {
    DREAM_EFFECTS[id](state, player, helpers);
    return;
  }
  if (card.type === "final" && DREAM_EFFECTS[id]) {
    DREAM_EFFECTS[id](state, player, helpers);
    return;
  }
  if (card.type === "event" && MINDSTREAM_EFFECTS[id]) {
    MINDSTREAM_EFFECTS[id](state, player, helpers);
    return;
  }
  if (card.type === "object" && OBJECT_EFFECTS[id]) {
    OBJECT_EFFECTS[id](state, player, helpers);
    return;
  }
  matchTextEffect(card, state, player, helpers);
}

export function createEffectHelpers(spawnFn) {
  return {
    spawnEncounter: spawnFn,
    beginFinalRecurrence,
  };
}

export function defeatFinalArchetype(state, archetype, player, selectedCards, meetPlayTotalFn) {
  if (!state.finalRecurrence) return false;
  const played = meetPlayTotalFn(state);
  if (played < 12) {
    addLog(state, `Need 12 Psyche to defeat ${archetype.name} (have ${played}).`);
    return false;
  }
  const opposing = opposingSuit(archetype.suit);
  const hasOpposing = selectedCards.some((c) => c.suit === opposing);
  if (!hasOpposing) {
    addLog(state, `Must use ${opposing} Psyche (opposing suit) to defeat ${archetype.name}.`);
    return false;
  }
  archetype.defeated = true;
  addLog(state, `${archetype.name} defeated in the Final Recurrence!`);
  checkFinalRecurrenceVictory(state);
  return true;
}

function checkFinalRecurrenceVictory(state) {
  const remaining = state.finalArchetypes?.filter((a) => !a.defeated) || [];
  if (remaining.length === 0) {
    state.status = "won";
    addLog(state, "All Remaining Archetypes defeated. You wake up!");
  }
}

export function sacrificeAcquiredForFinal(state, count) {
  let sacrificed = 0;
  for (const p of state.players) {
    while (sacrificed < count && p.acquiredArchetypes.length) {
      p.acquiredArchetypes.pop();
      sacrificed += 1;
      state.acquiredPoints = Math.max(0, state.acquiredPoints - 1);
    }
  }
  const targets = state.finalArchetypes?.filter((a) => !a.defeated) || [];
  targets.slice(0, sacrificed).forEach((a) => {
    a.defeated = true;
    addLog(state, `Sacrificed acquired Archetype to defeat ${a.name}.`);
  });
  checkFinalRecurrenceVictory(state);
}
