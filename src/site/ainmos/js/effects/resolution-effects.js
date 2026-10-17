/**
 * Shared Good/Bad resolution opcodes for Events and Dreams (Ainmos 36.0).
 */

import {
  addLog,
  allEncountersOnBoard,
  drawPsycheForPlayer,
  fastForwardToPhase,
  removeEncounterFromLandscape,
  revealLandscapeTile,
} from "../core/state.js";
import { totalStat } from "../core/rules.js";
import { psycheCardValue } from "../cards/psyche.js";
import { formById } from "../cards/dream-forms.js";
import { scaleEventCount } from "../board/event-landscapes.js";
import { recordQuestEvent } from "../dreamers/quests.js";
import { grantPowerTokens } from "../cards/power-tokens.js";
import { beginRemember } from "./remember.js";
import {
  repressCard,
  requestReturnCards,
  enqueueRepressFromHand,
  enqueueDiscardFromHand,
  enqueueRepressObjects,
  isDreambeastPsycheCard,
} from "../dreamers/subconscious.js";
import { discardToMindstream } from "../cards/mindstream-supply.js";
import { discardDreamCard } from "../cards/dream-deck.js";
import { requestChooseTile, forgetRandomLandscapes, forgetNamedLandscapes, revealOrPlaceLandscapes } from "../board/landscapes.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";

function alive(state) {
  return state.players.filter((p) => p.alive);
}

const STAT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

function spendablePsyche(player) {
  return (player?.hand || []).filter((card) =>
    card
    && card.type !== "psyche-power"
    && card.type !== "object"
    && !isDreambeastPsycheCard(card)
  );
}

function heldObjects(player) {
  return [...(player?.objects || []), ...(player?.persistent || [])];
}

function chainAfterDiscards(state, after) {
  const prev = state.onResolutionIdle;
  state.onResolutionIdle = (s) => {
    after(s);
    if (typeof prev === "function") prev(s);
  };
}

function lockOnlyPhase(state, phase) {
  const name = phase === "Reveal" || phase === "Explore" || phase === "Meet" ? phase : "Meet";
  state.onlyPhaseThisRound = name;
  if (name === "Meet") state.meetOnlyRound = true;
  const skipped = fastForwardToPhase(state, name);
  if (!skipped.length) {
    addLog(state, `${name} is your only phase this round.`);
    return;
  }
  const verb = skipped.length === 1 ? "passes" : "pass";
  addLog(state, `${skipped.join(" and ")} ${verb} without you. ${name} is your only phase this round.`);
}

function discardHighest(state, player) {
  enqueueDiscardFromHand(state, player, 1, {
    reason: `${player.name}: choose your highest Psyche to discard.`,
    strict: true,
    cardFilter: { highest: true },
  });
}

function discardSuit(state, player, suit, count) {
  enqueueDiscardFromHand(state, player, count, {
    reason: `${player.name}: choose ${count} ${suit} Psyche to discard.`,
    strict: true,
    cardFilter: { suit },
  });
}

/** Ainmos: Mindstream Represses now come from the Waking Mind (the Psyche deck). */
function repressTopMindstream(state, _suit, count = 1) {
  const deck = state.psycheDeck;
  if (!deck?.length) return;
  let n = 0;
  for (let i = 0; i < count && deck.length; i += 1) {
    repressCard(state, deck.shift());
    n += 1;
  }
  addLog(state, `Repress the top ${n} of the Waking Mind.`);
}

function repressTopPsyche(state, count = 1) {
  let n = 0;
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
    n += 1;
  }
  if (n) addLog(state, `Repress ${n} from top of Psyche deck.`);
}

export function resolutionSideSteps(sideSpec) {
  if (!sideSpec) return [];
  if (Array.isArray(sideSpec.steps) && sideSpec.steps.length) return sideSpec.steps;
  if (sideSpec.effect) return [{ effect: sideSpec.effect, params: sideSpec.params || {} }];
  return [];
}

export function resolutionRulesText(resolution) {
  if (!resolution) return "";
  const lines = [];
  if (resolution.good?.hint) lines.push(`Bright: ${resolution.good.hint}.`);
  if (resolution.bad?.hint) lines.push(`Dim: ${resolution.bad.hint}.`);
  return lines.join(" ");
}

function discardObjectOrPsyche(state, player) {
  const hasObject = Boolean(player.objects?.length);
  const hasPsyche = Boolean(player.hand?.length);
  if (hasObject && hasPsyche) {
    offerEffectChoice(state, player, {
      cardId: "discard-object-or-psyche",
      title: "Discard 1 Object or Psyche",
      message: `${player.name}: discard an Object, or a Psyche.`,
      log: `${player.name} must discard 1 Object or 1 Psyche.`,
      choices: [
        { id: "object", label: "Discard an Object", hint: "Choose which Object" },
        { id: "psyche", label: "Discard a Psyche", hint: "Choose which Psyche" },
      ],
    });
    return;
  }
  if (hasObject) {
    enqueueRepressObjects(state, player, 1, {
      reason: `${player.name}: choose an Object to discard.`,
      strict: true,
      toMindstream: true,
    });
    return;
  }
  if (!hasPsyche) {
    addLog(state, `${player.name} has no Object and no Psyche to discard.`);
    return;
  }
  enqueueDiscardFromHand(state, player, 1, {
    reason: `${player.name}: choose a Psyche to discard.`,
    strict: true,
  });
}

registerEffectResolver("discard-object-or-psyche", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return true;
  if (choiceId === "object") {
    if (player.objects?.length) {
      enqueueRepressObjects(state, player, 1, {
        reason: `${player.name}: choose an Object to discard.`,
        strict: true,
        toMindstream: true,
      });
    } else {
      enqueueDiscardFromHand(state, player, 1, {
        reason: `${player.name}: choose a Psyche to discard.`,
        strict: true,
      });
    }
    return true;
  }
  if (player.hand?.length) {
    enqueueDiscardFromHand(state, player, 1, {
      reason: `${player.name}: choose a Psyche to discard.`,
      strict: true,
    });
    return true;
  }
  if (player.objects?.length) {
    enqueueRepressObjects(state, player, 1, {
      reason: `${player.name}: choose an Object to discard.`,
      strict: true,
      toMindstream: true,
    });
    return true;
  }
  addLog(state, `${player.name} has no Object and no Psyche to discard.`);
  return true;
});

/**
 * @param {"good"|"bad"} _side
 */
function scaleGoodStep(state, step) {
  if (!step?.params) return step;
  const params = { ...step.params };
  let changed = false;
  for (const key of ["count", "draw", "ret", "pt"]) {
    if (typeof params[key] === "number" && params[key] > 0) {
      const scaled = scaleEventCount(params[key], state);
      if (scaled !== params[key]) {
        params[key] = scaled;
        changed = true;
      }
    }
  }
  return changed ? { ...step, params } : step;
}

export function applyResolutionEffect(state, player, sideSpec, helpers = {}, _side = "good") {
  const steps = resolutionSideSteps(sideSpec);
  if (!steps.length) return;
  steps.forEach((step) => {
    const next = _side === "good" ? scaleGoodStep(state, step) : step;
    applyResolutionStep(state, player, next, helpers);
  });
}

function applyResolutionStep(state, player, step, helpers = {}) {
  const effect = step?.effect;
  if (!effect) return;
  const p = step.params || {};

  switch (effect) {
    case "drawPsyche": {
      const drawn = drawPsycheForPlayer(state, player, p.count || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      break;
    }
    case "drawPsycheAll": {
      alive(state).forEach((pl) => {
        const drawn = drawPsycheForPlayer(state, pl, p.count || 1);
        if (drawn.length) addLog(state, `${pl.name} draws ${drawn.length} Psyche.`);
      });
      break;
    }
    case "drawPsycheAndReturn": {
      const drawn = drawPsycheForPlayer(state, player, p.draw || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      if (p.ret > 0) requestReturnCards(state, p.ret, player);
      break;
    }
    case "drawPsycheAndPT": {
      const drawn = drawPsycheForPlayer(state, player, p.draw || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      if (p.pt > 0) {
        grantPowerTokens(state, player, p.pt, {
          reason: `${player.name} gains ${p.pt} Power Token${p.pt === 1 ? "" : "s"}.`,
          logQuest: false,
        });
      }
      break;
    }
    case "remember": {
      if (p.perDreamer) {
        alive(state).forEach((pl) => beginRemember(state, pl, p.count || 1, { source: p.source || "Bright" }));
      } else {
        beginRemember(state, player, p.count || 1, { source: p.source || "Bright", filter: p.filter || null });
      }
      break;
    }
    case "rememberAndPT": {
      if (p.pt > 0) {
        grantPowerTokens(state, player, p.pt, {
          reason: `${player.name} gains ${p.pt} Power Token${p.pt === 1 ? "" : "s"}.`,
          logQuest: false,
        });
      }
      beginRemember(state, player, p.count || 1, { source: "Bright" });
      break;
    }
    case "drawPsycheAndRemember": {
      const drawn = drawPsycheForPlayer(state, player, p.draw || 1);
      if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
      beginRemember(state, player, p.count || 1, { source: "Bright" });
      break;
    }
    case "returnCards": {
      if (p.count > 0) requestReturnCards(state, p.count, player, { filter: p.filter || null });
      break;
    }
    case "returnAllDreambeasts": {
      const returned = requestReturnCards(state, 99, player, { filter: "dreambeast" });
      const n = Array.isArray(returned) ? returned.length : (returned?.count || 0);
      if (!n) addLog(state, "No Dreambeasts are waiting in the Subconscious.");
      break;
    }
    case "returnCardsAll": {
      alive(state).forEach((pl) => {
        if (p.count > 0) requestReturnCards(state, p.count, pl);
      });
      break;
    }
    case "returnAndPT": {
      if (p.ret > 0) requestReturnCards(state, p.ret, player);
      if (p.pt > 0) {
        grantPowerTokens(state, player, p.pt, {
          reason: `${player.name} gains ${p.pt} Power Token${p.pt === 1 ? "" : "s"}.`,
          logQuest: false,
        });
      }
      break;
    }
    case "grantPT": {
      grantPowerTokens(state, player, p.count || 1, {
        reason: `${player.name} gains ${p.count || 1} Power Token${(p.count || 1) === 1 ? "" : "s"}.`,
        logQuest: false,
      });
      break;
    }
    case "revealLandscapes": {
      revealOrPlaceLandscapes(state, p.count || 1, { source: "Bright" });
      break;
    }
    case "forgetLandscapes": {
      const forgotten = forgetRandomLandscapes(state, p.count || 1, { skipOccupied: true });
      if (forgotten.length) {
        addLog(state, `Forget ${forgotten.length} Landscape${forgotten.length === 1 ? "" : "s"}: ${forgotten.map((t) => t.name).join(", ")}.`);
      }
      break;
    }
    case "forgetNamed": {
      const ids = p.ids || [];
      const n = forgetNamedLandscapes(state, ids);
      if (n > 0) {
        const names = ids
          .map((id) => state.board.find((tile) => tile.id === id)?.name || id)
          .join(" and ");
        addLog(state, `Forget ${names}.`);
      } else {
        const fallback = forgetRandomLandscapes(state, Math.max(2, ids.length), { skipOccupied: true });
        if (fallback.length) {
          addLog(state, `Those Landscapes are already gone. Forget ${fallback.map((t) => t.name).join(", ")} instead.`);
        } else {
          addLog(state, "No awake Landscape remains to Forget.");
        }
      }
      break;
    }
    case "drawObject": {
      if (helpers?.drawObjects) {
        const objs = helpers.drawObjects(state, player, p.count || 1, helpers);
        if (objs.length) addLog(state, `${player.name} draws ${objs.length} Object(s).`);
      }
      break;
    }
    case "moveToNamed": {
      const named = (p.ids || []).map((id) => state.board.find((t) => t.id === id)).filter(Boolean);
      const ids = named.filter((tile) => tile.revealed && !tile.wasteland).map((tile) => tile.id);
      if (ids.length) {
        requestChooseTile(state, {
          allowedIds: ids,
          action: "movePlayer",
          playerId: player.id,
          title: `Move ${player.name}`,
          detail: "Choose a named Landscape.",
        });
      } else {
        const names = named.map((tile) => tile.name).join(" or ") || "those Landscapes";
        addLog(state, `${names} ${named.length === 1 ? "is" : "are"} not placed yet. The road stays closed.`);
      }
      break;
    }
    case "freeMeetAction": {
      state.meetActionBudget = (state.meetActionBudget || 0) + (p.count || 1);
      addLog(state, `Gain ${p.count || 1} free Meet Action${(p.count || 1) === 1 ? "" : "s"}.`);
      break;
    }
    case "discardObjectOrPsyche":
      discardObjectOrPsyche(state, player);
      break;
    case "discardPsyche":
      enqueueDiscardFromHand(state, player, p.count || 1, {
        reason: `${player.name}: choose ${p.count || 1} Psyche to discard.`,
        strict: true,
      });
      break;
    case "discardPsycheAll":
      alive(state).forEach((pl) => {
        enqueueDiscardFromHand(state, pl, p.count || 1, {
          reason: `${pl.name}: choose ${p.count || 1} Psyche to discard.`,
          strict: true,
        });
      });
      break;
    case "discardHighestPsyche":
      discardHighest(state, player);
      break;
    case "discardSuitPsyche":
      discardSuit(state, player, p.suit || "lucidity", p.count || 1);
      break;
    case "repressPsyche": {
      const have = spendablePsyche(player).length;
      if (!have) {
        addLog(state, `${player.name} has no Psyche to Repress.`);
        break;
      }
      const n = Math.min(p.count || 1, have);
      enqueueRepressFromHand(state, player, n, {
        reason: `${player.name}: Repress ${n} Psyche.`,
        strict: true,
      });
      break;
    }
    case "repressPsycheAll": {
      const holders = alive(state).filter((pl) => spendablePsyche(pl).length);
      if (!holders.length) {
        addLog(state, "No Psyche in hand to Repress.");
        break;
      }
      holders.forEach((pl, index) => {
        const n = Math.min(p.count || 1, spendablePsyche(pl).length);
        enqueueRepressFromHand(state, pl, n, {
          reason: `${pl.name}: Repress ${n} Psyche.`,
          strict: true,
          hold: index < holders.length - 1,
        });
      });
      break;
    }
    case "repressObjects": {
      const have = heldObjects(player).length;
      if (!have) {
        addLog(state, `${player.name} has no Object to discard.`);
        break;
      }
      const n = Math.min(p.count || 1, have);
      enqueueRepressObjects(state, player, n, {
        reason: `${player.name}: choose ${n} Object${n === 1 ? "" : "s"} to Discard.`,
        strict: true,
      });
      break;
    }
    case "repressObjectsAll": {
      const holders = alive(state).filter((pl) => heldObjects(pl).length);
      if (!holders.length) {
        addLog(state, "No Objects to discard.");
        break;
      }
      holders.forEach((pl, index) => {
        const n = Math.min(p.count || 1, heldObjects(pl).length);
        enqueueRepressObjects(state, pl, n, {
          reason: `${pl.name}: Discard ${n} Object${n === 1 ? "" : "s"}.`,
          strict: true,
          hold: index < holders.length - 1,
        });
      });
      break;
    }
    case "repressBoardBeast": {
      const list = allEncountersOnBoard(state);
      const n = Math.min(p.count || 1, list.length);
      if (!n) {
        addLog(state, "No active Dreambeast to Repress.");
        break;
      }
      list.slice(0, n).forEach(({ tile, encounter }) => {
        repressCard(state, encounter);
        removeEncounterFromLandscape(state, tile.id, encounter);
        addLog(state, `${encounter.name} is Repressed from ${tile.name}. No reward.`);
      });
      break;
    }
    case "discardDream": {
      for (let i = 0; i < (p.count || 1); i += 1) {
        const dream = state.dreamDeck?.shift();
        if (!dream) break;
        discardDreamCard(state, dream);
        addLog(state, `Discard Dream: ${dream.name}.`);
      }
      break;
    }
    case "repressTopMindstream":
      repressTopMindstream(state, p.suit || "lucidity", p.count || 1);
      break;
    case "repressTopEachMindstream":
      ["lucidity", "elasticity", "willpower"].forEach((suit) => {
        repressTopMindstream(state, suit, p.count || 1);
      });
      break;
    case "repressTopPsycheDeck":
      repressTopPsyche(state, p.count || 1);
      break;
    case "spawnEncounter": {
      if (helpers?.spawnEncounter) {
        helpers.spawnEncounter(state, player.landscapeId);
        addLog(state, `An Encounter emerges on ${player.name}'s Landscape.`);
      }
      break;
    }
    case "spawnEncountersOnDreamers": {
      alive(state).forEach((pl) => {
        if (helpers?.spawnEncounter) helpers.spawnEncounter(state, pl.landscapeId);
      });
      addLog(state, "Encounters spawn on every Dreamer.");
      break;
    }
    case "meetOnlyThisRound":
      lockOnlyPhase(state, "Meet");
      break;
    case "onlyPhase":
      lockOnlyPhase(state, p.phase || "Meet");
      break;
    case "blockForms": {
      const forms = p.forms;
      if (!forms || forms === "all") {
        state.blockedForms = "all";
        addLog(state, "Dream Forms add no dice this round.");
        break;
      }
      const ids = (Array.isArray(forms) ? forms : [forms]).filter((id) => formById(id));
      state.blockedForms = ids;
      const names = ids.map((id) => formById(id).name);
      addLog(state, names.length
        ? `${names.join(" and ")} add no dice this round.`
        : "Dream Forms add no dice this round.");
      break;
    }
    case "discardPsycheDrawPsyche": {
      const discardN = p.discard || 2;
      const drawN = p.draw || 1;
      const paying = alive(state).filter((pl) => spendablePsyche(pl).length);
      if (!paying.length) {
        addLog(state, "No Psyche in hand to discard.");
        break;
      }
      chainAfterDiscards(state, (s) => {
        paying.forEach((pl) => {
          const fresh = s.players.find((entry) => entry.id === pl.id) || pl;
          const drawn = drawPsycheForPlayer(s, fresh, drawN);
          if (drawn.length) addLog(s, `${fresh.name} draws ${drawn.length} Psyche.`);
        });
      });
      paying.forEach((pl, index) => {
        const n = Math.min(discardN, spendablePsyche(pl).length);
        enqueueDiscardFromHand(state, pl, n, {
          reason: `${pl.name}: discard ${n} Psyche, then draw ${drawN}.`,
          strict: true,
          cardFilter: { payablePsyche: true },
          hold: index < paying.length - 1,
        });
      });
      break;
    }
    case "discardPsycheDrawObject": {
      const discardN = p.discard || 1;
      const drawN = p.draw || 1;
      const paying = alive(state).filter((pl) => spendablePsyche(pl).length);
      if (!paying.length) {
        addLog(state, "No Psyche in hand. No Object is drawn.");
        break;
      }
      chainAfterDiscards(state, (s) => {
        paying.forEach((pl) => {
          const fresh = s.players.find((entry) => entry.id === pl.id) || pl;
          if (helpers?.drawObjects) {
            const objs = helpers.drawObjects(s, fresh, drawN, helpers);
            if (objs?.length) addLog(s, `${fresh.name} draws ${objs.length} Object${objs.length === 1 ? "" : "s"}.`);
            else addLog(s, `${fresh.name} finds no Object to draw.`);
          }
        });
      });
      paying.forEach((pl, index) => {
        const n = Math.min(discardN, spendablePsyche(pl).length);
        enqueueDiscardFromHand(state, pl, n, {
          reason: `${pl.name}: discard ${n} Psyche, then draw ${drawN} Object${drawN === 1 ? "" : "s"}.`,
          strict: true,
          cardFilter: { payablePsyche: true },
          hold: index < paying.length - 1,
        });
      });
      break;
    }
    case "discardPsycheForBeasts": {
      const beasts = allEncountersOnBoard(state).filter(({ encounter }) => (
        encounter.type === "dreambeast" || encounter.boss || encounter.type === "boss-dream"
      )).length;
      if (beasts <= 0) {
        addLog(state, "No Dreambeasts are standing. The spread costs nothing.");
        break;
      }
      const payer = spendablePsyche(player).length
        ? player
        : alive(state).find((pl) => spendablePsyche(pl).length);
      if (!payer) {
        addLog(state, "No Psyche in hand to spend against the Dreambeasts.");
        break;
      }
      enqueueDiscardFromHand(state, payer, 0, {
        needValue: beasts,
        strict: true,
        cardFilter: { payablePsyche: true },
        reason: `${payer.name}: discard Psyche totaling ${beasts}, one for each Dreambeast on the board.`,
      });
      break;
    }
    case "discardPsycheAboveStat": {
      const stat = p.stat || "lucidity";
      const label = STAT_LABELS[stat] || stat;
      alive(state).forEach((pl) => {
        const cap = totalStat(pl, stat, state);
        const high = spendablePsyche(pl).filter((card) => psycheCardValue(card) > cap);
        if (!high.length) {
          addLog(state, `${pl.name} holds no Psyche above ${label} ${cap}.`);
          return;
        }
        const ids = new Set(high.map((card) => card.instanceId));
        pl.hand = (pl.hand || []).filter((card) => !ids.has(card.instanceId));
        if (!state.psycheDiscard) state.psycheDiscard = [];
        high.forEach((card) => state.psycheDiscard.push(card));
        recordQuestEvent(state, "discard_psyche", { count: high.length, landscapeId: pl.landscapeId });
        addLog(state, `${pl.name} discards ${high.map((card) => card.name).join(", ")} — valued above ${label} ${cap}.`);
        if (state.checkPsycheDeath) state.checkPsycheDeath(pl);
      });
      break;
    }
    case "freeExplore":
      state.freeExploreNextRound = true;
      addLog(state, "The next Explore is free. Dreamers may move to any revealed Landscape.");
      break;
    default:
      addLog(state, `Unresolved effect: ${effect}`);
  }
}

export function discardMindstreamCard(state, card) {
  if (!card) return;
  const suit = card.mindstreamSuit || card.suit;
  if (!suit) {
    discardToMindstream(state, card);
    return;
  }
  if (!state.mindstreamDiscard[suit]) state.mindstreamDiscard[suit] = [];
  if (!state.mindstreamDiscard[suit].some((c) => c.instanceId === card.instanceId)) {
    state.mindstreamDiscard[suit].push(card);
  }
}
