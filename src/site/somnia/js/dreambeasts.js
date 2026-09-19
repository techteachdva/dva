/** Dreambeast type affinities, Meet bonuses, accept/fail/reject effects. */

import {
  addLog,
  drawPsycheForPlayer,
  revealLandscapeTile,
  landscapeById,
  setEncounterOnLandscape,
  findEncounterOnBoard,
  moveEncounterBetweenLandscapes,
  tileEncounters,
  encountersOnLandscape,
  allEncountersOnBoard,
  encounterKey,
  encounterOnLandscape,
} from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { logMoment } from "./narrator.js";
import { grantPowerTokens, spendPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards, enqueueRepressFromHand, isDreambeastPsycheCard } from "./subconscious.js";
import { applyBossAcceptEffect } from "./bosses.js";
import { adjacentTiles, hexDistance } from "./hex.js";
import { requestChooseTile, requestForgetLandscapes, forgetNamedLandscapes } from "./landscapes.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import { discardToMindstream } from "./mindstream-supply.js";
import { scaleFailCount } from "./psyche-pressure.js";

const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

/** Dreamer id → beast kind they gain +1 Psyche against during Meet. */
export const DREAMER_KIND_AFFINITY = {
  "the-rested": "fantasy",
  "the-visionary": "fantasy",
  "the-weaver": "fantasy",
  "the-runner": "nightmare",
  "the-hunter": "nightmare",
  "the-immovable": "nightmare",
};

const SUIT_PRIORITY = { lucidity: 0, elasticity: 1, willpower: 2 };

export function dreamerPrimarySuit(dreamer) {
  const stats = [
    { suit: "lucidity", value: dreamer.lucidity ?? 0 },
    { suit: "elasticity", value: dreamer.elasticity ?? 0 },
    { suit: "willpower", value: dreamer.willpower ?? 0 },
  ];
  stats.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit];
  });
  return stats[0].suit;
}

export function encounterRejectCost(encounter) {
  return encounter.reject ?? encounter.repress ?? 0;
}

export function encounterAcceptSummary(encounter) {
  const suit = SUIT_LABELS[encounter?.suit] || encounter?.suit || "matching";
  return `Gain 3 ${suit} Psyche ally in hand`;
}

export function encounterRejectSummary(encounter) {
  return encounter?.rejectReward || "Exile Dreambeast to the Subconscious";
}

export function dreamerMeetBonuses(dreamer, encounter) {
  const parts = [];
  let total = 0;

  const affinity = DREAMER_KIND_AFFINITY[dreamer?.id];
  const kind = encounter?.beastKind;
  if (affinity && kind && affinity === kind) {
    total += 1;
    parts.push(`+1 ${kind === "fantasy" ? "Fantasy" : "Nightmare"} affinity`);
  }

  const primary = dreamerPrimarySuit(dreamer);
  if (encounter?.suit && primary === encounter.suit) {
    total += 1;
    parts.push(`+1 ${SUIT_LABELS[encounter.suit] || encounter.suit} suit`);
  }

  return { total, parts };
}

export function beastKindLabel(kind) {
  if (kind === "fantasy") return "Fantasy";
  if (kind === "nightmare") return "Nightmare";
  return "";
}

function psycheInHand(player) {
  return (player.hand || []).filter((c) => c.type !== "object" && c.type !== "psyche-power" && !isDreambeastPsycheCard(c));
}

function discardPsycheCards(state, player, count) {
  const cards = psycheInHand(player);
  let n = 0;
  for (let i = 0; i < count && cards.length; i += 1) {
    const card = cards.pop();
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    state.psycheDiscard.push(card);
    n += 1;
  }
  if (n) recordQuestEvent(state, "discard_psyche", { count: n, landscapeId: player.landscapeId });
  return n;
}

function discardHighestPsyche(state, player) {
  const cards = psycheInHand(player);
  if (!cards.length) return null;
  const card = cards.reduce((best, c) => ((c.value || 0) > (best.value || 0) ? c : best));
  player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
  state.psycheDiscard.push(card);
  recordQuestEvent(state, "discard_psyche", { count: 1, landscapeId: player.landscapeId });
  return card;
}

function repressTopPsycheDeck(state, count) {
  let n = 0;
  for (let i = 0; i < count && state.psycheDeck.length; i += 1) {
    repressCard(state, state.psycheDeck.shift());
    n += 1;
  }
  if (n) addLog(state, `Repress ${n} Psyche from top of the Psyche deck.`);
  return n;
}

function repressTopMindstream(state, suit, count = 1) {
  const deck = state.mindstreamDecks?.[suit];
  let n = 0;
  for (let i = 0; i < count && deck?.length; i += 1) {
    repressCard(state, deck.shift());
    n += 1;
  }
  if (n) addLog(state, `Repress top ${n} ${SUIT_LABELS[suit] || suit} Mindstream card(s).`);
  return n;
}

function discardOneObject(state, player) {
  const obj = player.objects?.pop();
  if (!obj) return false;
  discardToMindstream(state, obj);
  addLog(state, `${player.name} discards ${obj.name}.`);
  return true;
}

function wastelandCount(state) {
  return state.board.filter((t) => t.wasteland || t.forgotten).length;
}

function moveEncounter(state, encounter, toId) {
  const dest = landscapeById(state, toId);
  if (!dest?.revealed) return false;
  const located = findEncounterOnBoard(state, encounter);
  if (!located) return false;
  moveEncounterBetweenLandscapes(state, located.tile.id, toId, located.encounter);
  addLog(state, `${located.encounter.name} moves to ${dest.name}.`);
  return true;
}

export function flipLeviathan(state, helpers = {}) {
  const located = state.board
    .map((tile) => {
      const enc = tileEncounters(tile).find((e) => e.id === "leviathan" || e.refId === "leviathan");
      return enc ? { tile, encounter: enc } : null;
    })
    .find(Boolean);
  if (located?.encounter) {
    located.encounter.awake = true;
    addLog(state, "Leviathan flips — it is Awake.");
    return located.encounter;
  }

  const pullFrom = (list) => {
    const idx = list.findIndex((c) => c.id === "leviathan" || c.refId === "leviathan");
    if (idx < 0) return null;
    return list.splice(idx, 1)[0];
  };

  const fromDream = pullFrom(state.dreamDeck || []);
  const fromMind = ["lucidity", "elasticity", "willpower"]
    .map((suit) => pullFrom(state.mindstreamDecks?.[suit] || []))
    .find(Boolean);
  const card = fromDream || fromMind;
  if (!card) {
    addLog(state, "Leviathan is not in play to flip.");
    return null;
  }

  const encounter = { ...card, type: "dreambeast", boss: true, awake: true, id: card.refId || card.id || "leviathan" };
  const dest = landscapeById(state, "endless-ocean")?.revealed ? "endless-ocean" : "bed";
  if (helpers.spawnEncounter) helpers.spawnEncounter(state, dest);
  else setEncounterOnLandscape(state, dest, encounter);
  const spawned = encountersOnLandscape(state, dest).find((e) => e.id === "leviathan" || e.refId === "leviathan") || encounter;
  spawned.awake = true;
  const tile = landscapeById(state, dest);
  addLog(state, `Leviathan emerges Awake on ${tile?.name || dest}!`);
  return spawned;
}

function moveLeviathanToOcean(state) {
  const located = state.board
    .map((tile) => {
      const enc = tileEncounters(tile).find((e) => e.id === "leviathan" || e.refId === "leviathan");
      return enc ? { tile, encounter: enc } : null;
    })
    .find(Boolean);
  if (!located) return;
  moveEncounter(state, located.encounter, "endless-ocean");
}

const ACCEPT_EFFECTS = {
  cerberus: { type: "boss" },
  double: { type: "boss" },
  leviathan: { type: "boss" },
  werewolf: { type: "forget", ids: ["house", "suburbia"] },
  bogey: { type: "repress-top-psyche-and-mindstream", psyche: 1, suit: "elasticity", mind: 1 },
  mindless: { type: "all-repress-hand", count: 1 },
  automaton: { type: "move-one-space" },
  guardian: { type: "move-from-bed", distance: 2 },
  merperson: { type: "flip-leviathan-ocean" },
  "trash-gremlin": { type: "repress-object" },
  nixie: { type: "forget", ids: ["endless-ocean", "sea-of-teeth"] },
  jackalope: { type: "repress-mindstream", suit: "elasticity", count: 3 },
  unicorn: { type: "move-beast-and-dreamer" },
  "black-dog": { type: "if-stat", stat: "lucidity", op: ">=", value: 2, then: { type: "draw-psyche", count: 1 } },
  basilisk: { type: "if-stat", stat: "lucidity", op: "<=", value: 1, then: { type: "discard-hand", count: 2 } },
  baku: { type: "forget", ids: ["tranquil-grove", "awards"] },
  chimera: { type: "none" },
  gorgon: { type: "discard-highest" },
  sandman: { type: "forget", ids: ["house", "road"] },
  sincubus: { type: "if-stat", stat: "willpower", op: "<=", value: 2, then: { type: "discard-hand", count: 2 } },
  mandrake: { type: "mandrake" },
  "goofus-bird": { type: "repress-mindstream-and-object", suit: "lucidity", count: 1 },
  watcher: { type: "discard-per-wastelands" },
  oni: { type: "repress-top-psyche-and-mindstream", psyche: 2, suit: "willpower", mind: 1 },
  wendigo: { type: "wendigo-accept" },
  minotaur: { type: "forget", ids: ["endless-hallway", "silver-mist"] },
  "ghost-light": { type: "repress-mindstream", suit: "willpower", count: 1 },
  vampyre: { type: "discard-half-dreamers" },
  pooka: { type: "repress-mindstream", suit: "willpower", count: 1 },
  shadows: { type: "forget", ids: ["city", "forest"] },
  "cheshire-cat": { type: "repress-top-psyche", count: 2 },
  "masked-figure": { type: "forget", ids: ["inner-sanctum", "the-party"] },
  "winged-turtle": { type: "repress-minus-willpower" },
};

const FAIL_EFFECTS = {
  cerberus: { type: "repress-top-psyche", count: 5 },
  double: { type: "repress-top-psyche", count: 5 },
  leviathan: { type: "repress-top-psyche", count: 5 },
  werewolf: { type: "repress-hand", count: 4 },
  bogey: { type: "discard-and-repress", discard: 1, repress: 1 },
  mindless: { type: "forget-and-repress-per-dreamer" },
  automaton: { type: "discard-power", count: 1 },
  guardian: { type: "repress-hand", count: 2 },
  merperson: { type: "discard-hand", count: 3 },
  "trash-gremlin": { type: "discard-hand", count: 2 },
  nixie: { type: "discard-hand", count: 2 },
  jackalope: { type: "discard-hand", count: 1 },
  unicorn: { type: "discard-hand", count: 3 },
  "black-dog": { type: "repress-hand", count: 3 },
  basilisk: { type: "repress-hand", count: 3 },
  baku: { type: "repress-hand", count: 2 },
  chimera: { type: "repress-mindstream", suit: "lucidity", count: 3 },
  gorgon: { type: "discard-hand", count: 1 },
  sandman: { type: "all-discard", count: 2 },
  sincubus: { type: "discard-hand", count: 4 },
  mandrake: { type: "discard-hand", count: 1 },
  "goofus-bird": { type: "discard-hand", count: 2 },
  watcher: { type: "discard-hand", count: 2 },
  oni: { type: "repress-hand", count: 2 },
  wendigo: { type: "repress-hand", count: 2 },
  minotaur: { type: "repress-hand", count: 3 },
  "ghost-light": { type: "repress-hand", count: 3 },
  vampyre: { type: "discard-hand", count: 3 },
  pooka: { type: "discard-hand", count: 2 },
  shadows: { type: "discard-hand", count: 1 },
  "cheshire-cat": { type: "discard-hand", count: 2 },
  "masked-figure": { type: "discard-hand", count: 3 },
  "winged-turtle": { type: "discard-hand", count: 2 },
};

function runSimpleEffect(state, actor, effect, helpers) {
  if (!effect) return;
  switch (effect.type) {
    case "boss":
      applyBossAcceptEffect(state, { ...actor._encounter, boss: true }, actor);
      break;
    case "forget":
      forgetNamedLandscapes(state, effect.ids);
      addLog(state, `${actor._encounter?.name || "Encounter"}: Forgot ${effect.ids.join(" & ")}.`);
      break;
    case "repress-top-psyche":
      repressTopPsycheDeck(state, effect.count || 1);
      break;
    case "repress-mindstream":
      repressTopMindstream(state, effect.suit, effect.count || 1);
      break;
    case "repress-top-psyche-and-mindstream":
      repressTopPsycheDeck(state, effect.psyche || 1);
      repressTopMindstream(state, effect.suit, effect.mind || 1);
      break;
    case "repress-mindstream-and-object":
      repressTopMindstream(state, effect.suit, effect.count || 1);
      discardOneObject(state, actor);
      break;
    case "repress-object": {
      const obj = actor.objects?.pop();
      if (obj) {
        repressCard(state, obj);
        addLog(state, `${actor.name} Represses ${obj.name}.`);
      }
      break;
    }
    case "all-repress-hand":
      state.players.filter((p) => p.alive).forEach((p) => {
        enqueueRepressFromHand(state, p, effect.count || 1, {
          reason: `${p.name}: Repress ${effect.count || 1} Psyche from hand.`,
        });
      });
      break;
    case "discard-hand":
      discardPsycheCards(state, actor, effect.count || 1);
      addLog(state, `${actor.name} discards ${effect.count || 1} Psyche.`);
      break;
    case "discard-highest": {
      const card = discardHighestPsyche(state, actor);
      if (card) addLog(state, `${actor.name} discards highest Psyche (${card.name}).`);
      break;
    }
    case "draw-psyche": {
      const drawn = drawPsycheForPlayer(state, actor, effect.count || 1);
      if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
      break;
    }
    case "if-stat": {
      const val = actor.dreamer?.[effect.stat] ?? 0;
      const pass = effect.op === "<=" ? val <= effect.value : val >= effect.value;
      if (pass) runSimpleEffect(state, actor, effect.then, helpers);
      break;
    }
    case "mandrake":
      if (psycheInHand(actor).length <= 4) {
        enqueueRepressFromHand(state, actor, 1, { reason: "Mandrake: Repress 1 Psyche." });
        const obj = actor.objects?.pop();
        if (obj) {
          repressCard(state, obj);
          addLog(state, `${actor.name} Represses ${obj.name}.`);
        }
      }
      break;
    case "discard-per-wastelands": {
      const n = Math.floor(wastelandCount(state) / 2);
      if (n) {
        discardPsycheCards(state, actor, n);
        addLog(state, `The Watcher: discard ${n} Psyche (1 per 2 Wastelands).`);
      }
      break;
    }
    case "discard-half-dreamers": {
      const n = Math.max(1, Math.floor(state.players.filter((p) => p.alive).length / 2));
      discardPsycheCards(state, actor, n);
      addLog(state, `Vampyre: discard ${n} Psyche (half Dreamers).`);
      break;
    }
    case "repress-minus-willpower": {
      const n = Math.max(0, 3 - (actor.dreamer?.willpower ?? 0));
      if (n) enqueueRepressFromHand(state, actor, n, { reason: `Winged Turtle: Repress ${n} Psyche.` });
      break;
    }
    case "flip-leviathan-ocean": {
      const lev = flipLeviathan(state, helpers);
      if (lev?.awake) moveLeviathanToOcean(state);
      break;
    }
    case "move-one-space":
      beginAutomatonMove(state, actor);
      break;
    case "move-from-bed":
      beginGuardianMove(state, actor, effect.distance || 2);
      break;
    case "move-beast-and-dreamer":
      beginUnicornMove(state, actor);
      break;
    case "wendigo-accept":
      beginWendigoAccept(state, actor);
      break;
    default:
      break;
  }
}

function beginAutomatonMove(state, actor) {
  const beasts = allEncountersOnBoard(state);
  offerEffectChoice(state, actor, {
    source: "beast",
    cardId: "automaton",
    title: "Automaton",
    message: "Move a Dreamer or a Dreambeast 1 space.",
    choices: [
      ...state.players.filter((p) => p.alive).map((p) => ({
        id: `dreamer:${p.id}`,
        label: p.name,
        hint: "Move 1 adjacent Landscape",
      })),
      ...beasts.map(({ tile, encounter }) => ({
        id: `beast:${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
        hint: "Move 1 adjacent Landscape",
      })),
    ],
  });
}

function beginGuardianMove(state, _actor, distance) {
  const dests = state.board.filter((t) => t.revealed && !t.wasteland && hexDistance(t, { q: 0, r: 0 }) >= distance);
  if (!dests.length) {
    addLog(state, "Guardian: no Landscape far enough from The Bed.");
    return;
  }
  state.players.filter((p) => p.alive).forEach((p, i) => {
    const tile = dests[i % dests.length];
    p.landscapeId = tile.id;
    addLog(state, `${p.name} is pushed to ${tile.name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
  });
}

function beginUnicornMove(state, actor) {
  const dests = state.board.filter((t) => t.revealed && !t.wasteland);
  const unicornEntry = allEncountersOnBoard(state).find(
    ({ encounter }) => encounter.id === "unicorn" || encounter.refId === "unicorn",
  );
  const from = unicornEntry?.tile;
  if (!dests.length) return;
  requestChooseTile(state, {
    allowedIds: dests.map((t) => t.id),
    action: "movePlayerAndEncounter",
    playerId: actor.id,
    fromTileId: from?.id,
    title: "Unicorn",
    detail: "Move the Unicorn and this Dreamer to any Landscape.",
  });
}

function beginWendigoAccept(state, actor) {
  const high = psycheInHand(actor).filter((c) => (c.value || 0) >= 3);
  if (high.length) {
    offerEffectChoice(state, actor, {
      source: "beast",
      cardId: "wendigo",
      title: "Wendigo",
      message: "Repress a Psyche of value 3 or more, or Repress 3 Psyche.",
      choices: [
        ...high.map((c) => ({ id: c.instanceId, label: `Repress ${c.name} (${c.value})` })),
        { id: "repress-3", label: "Repress 3 Psyche instead" },
      ],
    });
    return;
  }
  enqueueRepressFromHand(state, actor, 3, { reason: "Wendigo: Repress 3 Psyche." });
}

registerEffectResolver("automaton", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player || !choiceId) return true;
  const colon = choiceId.indexOf(":");
  const kind = choiceId.slice(0, colon);
  const id = choiceId.slice(colon + 1);
  if (kind === "dreamer") {
    const adj = adjacentTiles(state, state.players.find((p) => p.id === id)?.landscapeId).filter((t) => t.revealed);
    if (adj.length) {
      requestChooseTile(state, {
        allowedIds: adj.map((t) => t.id),
        action: "movePlayer",
        playerId: id,
        title: "Automaton",
        detail: "Move 1 space.",
      });
    }
    return true;
  }
  if (kind === "beast") {
    const sep = id.indexOf(":");
    const tileId = id.slice(0, sep);
    const encKey = id.slice(sep + 1);
    const src = landscapeById(state, tileId);
    const encounter = tileEncounters(src).find((enc) => encounterKey(enc) === encKey)
      || encounterOnLandscape(state, tileId);
    const adj = adjacentTiles(state, tileId).filter((t) => t.revealed && !t.wasteland);
    if (encounter && adj.length) {
      requestChooseTile(state, {
        allowedIds: adj.map((t) => t.id),
        action: "moveEncounter",
        fromTileId: tileId,
        encounter,
        title: "Automaton",
        detail: `Move ${encounter.name} 1 space.`,
      });
    }
  }
  return true;
});

registerEffectResolver("wendigo", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return false;
  if (choiceId === "repress-3") {
    enqueueRepressFromHand(state, player, 3, { reason: "Wendigo: Repress 3 Psyche." });
    return true;
  }
  const card = (player.hand || []).find((c) => c.instanceId === choiceId);
  if (card) {
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    repressCard(state, card);
    addLog(state, `${player.name} Represses ${card.name} (value ${card.value}).`);
  }
  return true;
});

registerEffectResolver("minotaur", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  state.pendingEffectChoice = null;
  if (player && choiceId) {
    player.setWildcards = [...(player.setWildcards || []), choiceId];
    addLog(state, `Minotaur counts as 1 ${choiceId} Object toward a set.`);
  }
  return true;
});

export function applyAcceptEffect(state, encounter, actor, helpers = {}) {
  const id = encounter.refId || encounter.id;
  const spec = ACCEPT_EFFECTS[id];
  actor._encounter = encounter;
  if (!spec) {
    addLog(state, encounter.effect || `${encounter.name} Accept resolved.`);
    return;
  }
  if (spec.type === "none") {
    addLog(state, encounter.effect || "Accept effect noted.");
    return;
  }
  runSimpleEffect(state, actor, spec, helpers);
  delete actor._encounter;
}

export function applyFailEffect(state, player, encounter) {
  const id = encounter.refId || encounter.id;
  const spec = FAIL_EFFECTS[id] || { type: "repress-hand", count: 2 };
  let count = encounter.failDoubled && spec.count ? spec.count * 2 : spec.count;
  if (count) count = scaleFailCount(count);
  const effect = { ...spec, count };

  switch (effect.type) {
    case "repress-top-psyche":
      repressTopPsycheDeck(state, effect.count || 1);
      break;
    case "repress-hand":
      enqueueRepressFromHand(state, player, effect.count || 1, {
        reason: `${player.name}: Fail — ${encounter.fail}`,
      });
      break;
    case "discard-hand":
      discardPsycheCards(state, player, effect.count || 1);
      break;
    case "discard-and-repress":
      discardPsycheCards(state, player, effect.discard || 1);
      enqueueRepressFromHand(state, player, effect.repress || 1, { reason: `${player.name}: Fail — Repress 1.` });
      break;
    case "forget-and-repress-per-dreamer": {
      const n = state.players.filter((p) => p.alive).length;
      requestForgetLandscapes(state, n);
      state.players.filter((p) => p.alive).forEach((p) => {
        enqueueRepressFromHand(state, p, 1, { reason: `${p.name}: Mindless Fail — Repress 1.` });
      });
      break;
    }
    case "discard-power":
      if ((player.powerTokens || 0) > 0) {
        spendPowerTokens(state, player, 1);
        addLog(state, `${player.name} discards a Power Token.`);
      } else {
        addLog(state, `${player.name} has no Power Token to discard.`);
      }
      break;
    case "repress-mindstream":
      repressTopMindstream(state, effect.suit, effect.count || 1);
      break;
    case "all-discard":
      state.players.filter((p) => p.alive).forEach((p) => {
        discardPsycheCards(state, p, effect.count || 1);
      });
      break;
    default:
      enqueueRepressFromHand(state, player, 1, { reason: encounter.fail || "Encounter Fail." });
  }
  addLog(state, encounter.fail || "Encounter Fail resolved.");
}

export function acceptedAllies(state) {
  const out = [];
  state.players.forEach((player) => {
    (player.hand || []).forEach((card) => {
      if (isDreambeastPsycheCard(card)) out.push({ player, card });
    });
  });
  return out;
}

export function removeAcceptedAlly(state, instanceId) {
  for (const player of state.players) {
    const idx = (player.hand || []).findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) {
      const [card] = player.hand.splice(idx, 1);
      return { player, card };
    }
  }
  return null;
}

export function applyRejectReward(state, encounter, actor, helpers = {}) {
  const effect = encounter.rejectEffect;
  const { drawObjects = () => [] } = helpers;

  if (!effect) {
    const drawn = drawPsycheForPlayer(state, actor, 1);
    if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
    return;
  }

  switch (effect.type) {
    case "draw-psyche": {
      const drawn = drawPsycheForPlayer(state, actor, effect.count || 1);
      if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
      if (effect.alsoReturn) requestReturnCards(state, effect.alsoReturn, actor);
      break;
    }
    case "all-draw-psyche": {
      state.players.filter((p) => p.alive).forEach((p) => {
        const drawn = drawPsycheForPlayer(state, p, effect.count || 1);
        if (drawn.length) addLog(state, `${p.name} draws ${drawn.length} Psyche.`);
      });
      break;
    }
    case "gain-power": {
      grantPowerTokens(state, actor, effect.count || 1, {
        reason: `Reject reward: ${effect.count || 1} Power Token.`,
        logQuest: false,
      });
      break;
    }
    case "draw-object": {
      if (helpers.drawObjects) {
        const objs = helpers.drawObjects(state, actor, effect.count || 1, helpers);
        if (objs.length) addLog(state, `${actor.name} draws ${objs.length} Object(s).`);
      }
      if (effect.alsoPsyche) {
        const drawn = drawPsycheForPlayer(state, actor, effect.alsoPsyche);
        if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
      }
      break;
    }
    case "draw-psyche-or-objects": {
      offerEffectChoice(state, actor, {
        source: "beast",
        cardId: "wendigo-reject",
        title: "Wendigo",
        message: "Draw 2 Psyche or 2 Objects.",
        choices: [
          { id: "psyche", label: "Draw 2 Psyche" },
          { id: "objects", label: "Draw 2 Objects" },
        ],
      });
      break;
    }
    case "return-subconscious": {
      requestReturnCards(state, effect.count || 1, actor);
      break;
    }
    case "reveal-landscapes": {
      const hidden = state.board.filter((l) => !l.revealed && !l.center);
      const n = Math.min(effect.count || 1, hidden.length);
      hidden.slice(0, n).forEach((t) => revealLandscapeTile(state, t));
      if (n) {
        recordQuestEvent(state, "reveal_landscape", { count: n });
        addLog(state, `Reject reward: Reveal ${n} Landscape${n === 1 ? "" : "s"}.`);
      }
      break;
    }
    case "repress-hand": {
      if (actor.hand.length) {
        const card = actor.hand.pop();
        repressCard(state, card);
        addLog(state, `${actor.name} Represses 1 Psyche to the Subconscious.`);
        if (state.checkPsycheDeath) state.checkPsycheDeath(actor);
      }
      const drawn = drawPsycheForPlayer(state, actor, effect.draw || 1);
      if (drawn.length) addLog(state, `${actor.name} draws ${drawn.length} Psyche.`);
      break;
    }
    case "cancel-dream-draw": {
      state.skipNextDreamDraw = true;
      logMoment(state, "Sandman — the next Dream draw is cancelled.");
      break;
    }
    case "set-wildcard": {
      offerEffectChoice(state, actor, {
        source: "beast",
        cardId: "minotaur",
        title: "Minotaur",
        message: "Count as 1 Object toward which set?",
        choices: [
          { id: "chess", label: "Chess" },
          { id: "stick", label: "Stick" },
          { id: "body", label: "Body" },
          { id: "element", label: "Element" },
          { id: "jewelry", label: "Jewelry" },
        ],
      });
      break;
    }
    default:
      addLog(state, encounter.rejectReward || "Reject reward resolved.");
  }
}

registerEffectResolver("wendigo-reject", (state, choiceId, helpers) => {
  const pending = state.pendingEffectChoice;
  const player = state.players.find((p) => p.id === pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return false;
  if (choiceId === "objects") {
    const objs = helpers?.drawObjects?.(state, player, 2, helpers) || [];
    if (objs.length) addLog(state, `${player.name} draws ${objs.length} Object(s).`);
    return true;
  }
  const drawn = drawPsycheForPlayer(state, player, 2);
  if (drawn.length) addLog(state, `${player.name} draws ${drawn.length} Psyche.`);
  return true;
});
