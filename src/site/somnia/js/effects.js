import {
  addLog,
  checkDefeat,
  drawPsycheForPlayer,
  forgetLandscapes,
  revealLandscapeTile,
  beginFinalRecurrence,
  landscapeById,
  encounterOnLandscape,
  moveEncounterBetweenLandscapes,
  tileEncounters,
  clearEncountersOnLandscape,
  removeEncounterFromLandscape,
  allEncountersOnBoard,
} from "./state.js";
import { forgetEdgeLandscapes, triggerBedFinalRecurrence } from "./landscapes.js";
import { recordQuestEvent } from "./quests.js";
import { grantPowerTokens, spendPowerTokensCollectively } from "./power-tokens.js";
import { countBoardDreambeasts } from "./phase-skip.js";
import { opposingSuit } from "./rules.js";
import { adjacentTiles, hexDistance } from "./hex.js";
import {
  repressCard,
  requestReturnCards,
  enqueueReturnCards,
  enqueueRepressObjects,
  enqueueRepressFromHand,
} from "./subconscious.js";
import { MINDSTREAM_EFFECTS } from "./mindstream.js";
import { markDreamFeedNudge } from "./fx.js";
import { discardDreamsFromDeck } from "./dream-deck.js";
import { logMoment } from "./narrator.js";
import { onObjectDrawn } from "./objects.js";
import {
  rememberDreamHelpers,
  beginMortalityChoices,
  beginBargainingChoices,
  beginTemptationChoices,
  beginResponsibilityChoices,
  beginMisplacedChoices,
  beginCircadiaChoices,
  beginPinealPurgeChoices,
  beginSomnambulanceChoices,
  beginAbandonmentMoves,
  beginChaseEscapeChoices,
  beginJudgementChoice,
  beginPowerlessnessChoices,
} from "./dream-choices.js";
import { eventLandscapeIds, beginEventOrWaste } from "./event-landscapes.js";
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

function dreamerCount(state) {
  return alivePlayers(state).length;
}

function cornerTiles(state) {
  const bed = landscapeById(state, "bed");
  if (!bed) return [];
  const outer = state.board.filter((t) => t.revealed && !t.center);
  const maxDist = Math.max(0, ...outer.map((t) => hexDistance(t, bed)));
  return outer.filter((t) => hexDistance(t, bed) === maxDist);
}

function moveEncounterAwayFromBed(state, fromTileId, steps = 2, encounter = null) {
  const bed = landscapeById(state, "bed");
  const from = landscapeById(state, fromTileId);
  const enc = encounter || encounterOnLandscape(state, fromTileId);
  if (!enc || !from || !bed) return [];

  const carried = alivePlayers(state)
    .filter((p) => p.landscapeId === fromTileId)
    .map((p) => p.id);

  let currentId = fromTileId;
  for (let step = 0; step < steps; step += 1) {
    const neighbors = adjacentTiles(state, currentId).filter(
      (t) => t.revealed && !t.wasteland && t.id !== "bed",
    );
    if (!neighbors.length) break;
    const next = neighbors.sort((a, b) => hexDistance(b, bed) - hexDistance(a, bed))[0];
    currentId = next.id;
  }

  if (currentId === fromTileId) return carried;

  const to = landscapeById(state, currentId);
  moveEncounterBetweenLandscapes(state, fromTileId, currentId, enc);
  carried.forEach((pid) => {
    const player = state.players.find((p) => p.id === pid);
    if (player) player.landscapeId = currentId;
  });
  if (to) addLog(state, `${enc.name} abducted to ${to.name}.`);
  return carried;
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
  state.skipExploreReason = null;
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
    logMoment(state, "Wanderlust fulfilled — all Dreamers draw 3 Psyche.");
  }
  state.wanderlustTarget = 0;
  state.wanderlustMoves = 0;
}

function discardDreamCardsFromDeck(state, count) {
  return discardDreamsFromDeck(state, count);
}

function applyDreambeastTimelineHunger(state) {
  const beastCount = countBoardDreambeasts(state);
  if (beastCount <= 0) return;

  const paid = spendPowerTokensCollectively(state, beastCount);
  if (paid > 0) {
    logMoment(
      state,
      `${beastCount} roaming Dreambeast${beastCount === 1 ? "" : "s"} — the team spends ${paid} Power Token${paid === 1 ? "" : "s"} to steady the Timeline.`,
    );
  }
  const unpaid = beastCount - paid;
  if (unpaid <= 0) return;

  const discarded = discardDreamCardsFromDeck(state, unpaid);
  if (discarded > 0) {
    logMoment(
      state,
      `The Timeline frays — ${discarded} Dream card${discarded === 1 ? "" : "s"} discarded (${unpaid} Dreambeast${unpaid === 1 ? "" : "s"} still hunger; not enough Power).`,
    );
    markDreamFeedNudge();
    checkDefeat(state);
  }
}

export function onMeetPhaseEnd(state) {
  applyDreambeastTimelineHunger(state);

  if (state.rivalryLeftover > 0) {
    let cost = state.rivalryLeftover;
    alivePlayers(state).forEach((p) => {
      while (cost > 0 && p.hand.length) {
        state.psycheDiscard.push(p.hand.pop());
        cost -= 1;
      }
    });
    recordQuestEvent(state, "discard_psyche", { count: state.rivalryLeftover });
    logMoment(state, `Rivalry — leftover Encounters cost ${state.rivalryLeftover} Psyche.`);
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
      const kept = [];
      const discarded = [];
      (p.hand || []).forEach((c) => {
        if ((c.value || 0) <= wp) kept.push(c);
        else discarded.push(c);
      });
      p.hand = kept;
      discarded.forEach((c) => state.psycheDiscard.push(c));
      if (discarded.length) {
        recordQuestEvent(state, "discard_psyche", { count: discarded.length });
        addLog(state, `${p.name}: Injury discards ${discarded.length} Psyche above Willpower ${wp}.`);
      }
    });
  },
  chase: (state, _player, helpers) => {
    rememberDreamHelpers(helpers);
    beginChaseEscapeChoices(state, helpers);
  },
  recovery: (state) => {
    const players = alivePlayers(state);
    if (!players.length) return;
    logMoment(state, "Recovery — each Dreamer returns 1 card from the Subconscious.");
    players.forEach((p) => {
      enqueueReturnCards(state, 1, p, {
        reason: `${p.name}: Return 1 card from the Subconscious.`,
      });
    });
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
    logMoment(state, "Travel Dream — free Explore movement next round; Landscape Meet actions skipped next Meet.");
  },
  judgement: (state, _player, helpers) => {
    rememberDreamHelpers(helpers);
    beginJudgementChoice(state, helpers);
  },
  misunderstanding: (state) => {
    let left = dreamerCount(state) + 3;
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      const deck = state.mindstreamDiscard[suit];
      while (deck.length && left > 0) {
        repressCard(state, deck.pop());
        left -= 1;
      }
    });
    logMoment(state, "Misunderstanding — Mindstream cards repressed.");
  },
  mortality: (state) => {
    rememberDreamHelpers();
    beginMortalityChoices(state);
  },
  abduction: (state) => {
    state.abductionCarried = [];
    allEncountersOnBoard(state).forEach(({ tile, encounter }) => {
      const carried = moveEncounterAwayFromBed(state, tile.id, 2, encounter);
      state.abductionCarried.push(...carried);
    });
    state.meetOnlyRound = true;
    logMoment(state, "Abduction — carried Encounters may only be Met this round.");
  },
  absurdity: (state) => {
    const drawCount = dreamerCount(state) + 1;
    const events = [];
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      const deck = state.mindstreamDecks[suit];
      for (let i = 0; i < drawCount && deck.length; i += 1) {
        const card = deck.shift();
        if (card?.type === "event") events.push(card);
        state.mindstreamDiscard[suit].push(card);
      }
    });
    events.forEach((event) => {
      const ids = eventLandscapeIds(event);
      ids.forEach((id) => {
        const tile = landscapeById(state, id);
        if (!tile?.revealed || tile.wasteland || tile.center || tile.id === "bed") return;
        tile.revealed = false;
        tile.wasteland = true;
        tile.forgotten = true;
        tileEncounters(tile).forEach((enc) => repressCard(state, enc));
        clearEncountersOnLandscape(state, tile.id);
        addLog(state, `Absurdity: ${event.name} forgets ${tile.name}.`);
      });
    });
    logMoment(state, `Absurdity — ${events.length} Event${events.length === 1 ? "" : "s"} reshape the Dreamscape.`);
  },
  bargaining: (state) => {
    beginBargainingChoices(state);
  },
  responsibility: (state) => {
    beginResponsibilityChoices(state);
  },
  wanderlust: (state) => {
    state.wanderlustTarget = dreamerCount(state) * 3;
    state.wanderlustMoves = 0;
    logMoment(state, `Wanderlust — explore ${state.wanderlustTarget} Landscapes this round for a reward.`);
  },
  transformation: (state) => {
    state.pickEncounterOnSpawn = true;
    logMoment(state, "Transformation — next Spawn lets you pick from 2 Encounters.");
  },
  trapped: (state) => {
    state.skipExploreNextRound = true;
    state.skipExploreReason = state.activeDream?.name
      ? `${state.activeDream.name} Dream`
      : "drawn Dream";
    logMoment(state, "Trapped — the next Explore Phase will be skipped.");
  },
  lost: (state) => {
    const neighbors = adjacentTiles(state, "bed").filter((t) => t.revealed && !t.center && t.id !== "bed");
    neighbors.forEach((t) => {
      t.revealed = false;
      t.wasteland = true;
      t.forgotten = true;
      tileEncounters(t).forEach((enc) => repressCard(state, enc));
      clearEncountersOnLandscape(state, t.id);
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
    logMoment(state, "Lost — Landscapes adjacent to The Bed become Wasteland.");
  },
  misplaced: (state) => {
    beginMisplacedChoices(state);
  },
  rivalry: (state, _player, helpers) => {
    const count = Math.max(1, Math.floor(dreamerCount(state) / 2));
    helpers.spawnEncounter(state, "bed");
    const overflow = adjacentTiles(state, "bed").filter((t) => t.revealed && !t.wasteland);
    let placed = 1;
    for (let i = 1; i < count && overflow.length; i += 1) {
      const tile = overflow.shift();
      helpers.spawnEncounter(state, tile.id);
      placed += 1;
    }
    state.rivalryLeftover = Math.max(0, count - placed);
    state.rivalryEncountersOnBed = count;
    logMoment(
      state,
      state.rivalryLeftover
        ? `Rivalry — ${placed} Encounter(s) near The Bed; ${state.rivalryLeftover} leftover cost 1 Psyche each at end of Meet.`
        : `Rivalry — ${placed} Encounter(s) placed on and beside The Bed.`,
    );
  },
  temptation: (state) => {
    beginTemptationChoices(state);
  },
  paradox: (state) => {
    state.paradoxMeet = true;
    logMoment(state, "Paradox — Willpower and Elasticity costs swap next Meet Phase.");
  },
  powerlessness: (state, _player, helpers) => {
    rememberDreamHelpers(helpers);
    beginPowerlessnessChoices(state, helpers);
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
      tileEncounters(t).forEach((enc) => repressCard(state, enc));
      clearEncountersOnLandscape(state, t.id);
      addLog(state, `Loss: Forgot ${t.name}.`);
    });
    if (!corners.length) forgetLandscapes(state, 4);
    else logMoment(state, "Loss — distant Landscapes become Wasteland.");
  },
  abandonment: (state) => {
    allEncountersOnBoard(state).forEach(({ tile, encounter }) => {
      repressCard(state, encounter);
      removeEncounterFromLandscape(state, tile.id, encounter);
    });
    logMoment(state, "Abandonment — all Encounters sent to the Subconscious.");
    beginAbandonmentMoves(state);
  },
  delta: (state) => {
    forgetEdgeLandscapes(state, 4);
    alivePlayers(state).forEach((p) => {
      if (p.hand.length) state.psycheDiscard.push(p.hand.pop());
    });
    recordQuestEvent(state, "discard_psyche", { count: dreamerCount(state) });
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
    beginCircadiaChoices(state);
  },
  somnambulance: (state) => {
    beginSomnambulanceChoices(state);
  },
  homeostasis: (state) => {
    allDrawPsyche(state, 5);
    logMoment(state, "Homeostasis — all Dreamers draw 5 Psyche.");
  },
  "pineal-purge": (state) => {
    beginPinealPurgeChoices(state);
  },
  "final-recurrence": (state) => {
    triggerBedFinalRecurrence(state, "The Final Recurrence is drawn — The Bed flips.");
  },
  "you-never-wake": (state) => {
    if (state.tutorialMode) return;
    state.status = "lost";
    logMoment(state, "You Never Wake — the Dream collapses.");
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
    grantPowerTokens(state, player, n);
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
    grantPowerTokens(state, player, n, {
      reason: `${player.name} takes ${n} Power Token${n === 1 ? "" : "s"}.`,
      logQuest: false,
    });
    return;
  }

  if (card.type === "draw-dream") {
    logMoment(state, "Draw 1 additional Dream card.");
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
    onObjectDrawn(state, player, card, helpers);
    return;
  }

  if ((card.type === "dream" || card.type === "final") && DREAM_EFFECTS[id]) {
    rememberDreamHelpers(helpers);
    DREAM_EFFECTS[id](state, player, helpers);
    return;
  }
  if (card.type === "event") {
    if (!beginEventOrWaste(state, card)) return;
    if (MINDSTREAM_EFFECTS[id]) {
      MINDSTREAM_EFFECTS[id](state, player, helpers, card);
      return;
    }
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
  logMoment(state, `${archetype.name} defeated in the Final Recurrence!`);
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
