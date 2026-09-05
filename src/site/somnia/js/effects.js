import {
  addLog,
  drawPsycheForPlayer,
  forgetLandscapes,
  revealLandscapeTile,
  beginFinalRecurrence,
} from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { opposingSuit } from "./rules.js";
import {
  repressCard,
  repressCards,
  requestReturnCards,
} from "./subconscious.js";
import { MINDSTREAM_EFFECTS } from "./mindstream.js";
import { OBJECT_EFFECTS } from "./object-effects.js";

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

export function repressFromHand(state, player, count) {
  for (let i = 0; i < count && player.hand.length; i += 1) {
    const card = player.hand.pop();
    repressCard(state, card);
    recordQuestEvent(state, "discard_psyche", { count: 1 });
  }
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
  chase: (state, h) => {
    alivePlayers(state).forEach((p) => h.spawnEncounter(state, p.landscapeId));
  },
  recovery: (state) => {
    alivePlayers(state).forEach(() => returnCards(state, 1));
  },
  "well-being": (state) => allDrawPsyche(state, 3),
  quiet: (state) => addLog(state, "Nothing happens."),
  betrayal: (state) => {
    alivePlayers(state).forEach((p) => {
      const n = Math.max(0, playerStat(p, "willpower") - playerStat(p, "lucidity"));
      for (let i = 0; i < n && p.objects.length; i += 1) {
        repressCard(state, p.objects.pop());
      }
    });
  },
  travel: (state) => {
    state.freeExploreNextRound = true;
    addLog(state, "Next Explore: each Dreamer may move anywhere for free.");
  },
  "final-recurrence": (state, _player, h) => h.beginFinalRecurrence(state),
  loss: (state) => forgetLandscapes(state, 4),
  abandonment: (state) => {
    state.board.forEach((t) => {
      if (t.encounter) {
        repressCard(state, t.encounter);
        t.encounter = null;
      }
    });
    addLog(state, "All Encounters abandoned to Subconscious.");
  },
  theta: (state) => {
    forgetLandscapes(state, 8);
    allDrawPsyche(state, 2);
  },
  alpha: (state, _player, helpers) => {
    forgetLandscapes(state, 4);
    alivePlayers(state).forEach((p) => {
      if (helpers?.drawObjects) helpers.drawObjects(state, p, 1, helpers);
    });
  },
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

  const id = card.id?.toLowerCase();
  if (card.type === "dream" && DREAM_EFFECTS[id]) {
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
