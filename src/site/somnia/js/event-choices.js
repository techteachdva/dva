/** Player choices and corrected resolutions for Mindstream Events. */

import {
  addLog,
  drawPsycheForPlayer,
  landscapeById,
  setEncounterOnLandscape,
  revealLandscapeTile,
  removeEncounterFromLandscape,
  encounterOnLandscape,
  encounterKey,
  findEncounterOnBoard,
  allEncountersOnBoard,
  clearEncountersOnLandscape,
  tileEncounters,
  revealedLandscapeTiles,
} from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { grantPowerTokens } from "./power-tokens.js";
import { repressCard, requestReturnCards, enqueueRepressFromHand, listSubconsciousCards, isDreambeastPsycheCard, dreambeastToHandCard, removeFromSubconscious } from "./subconscious.js";
import { adjacentTiles } from "./hex.js";
import { requestChooseTile, beginFreeRevealPicking } from "./landscapes.js";
import {
  pullDreambeastFromMindstream,
  pullTwoDreambeastsForChoice,
  encounterFromDreambeastCard,
  discardToMindstream,
  returnDreambeastToMindstreamDeck,
} from "./mindstream-supply.js";
import { shuffle, uid } from "./data.js";
import { offerEffectChoice, registerEffectResolver } from "./effect-choices.js";
import {
  acceptedAllies,
  removeAcceptedAlly,
  applyFailEffect,
  applyAcceptEffect,
  flipLeviathan,
} from "./dreambeasts.js";
import { countAffectedLandscapes } from "./event-landscapes.js";
import { recordCancellableDiscard } from "./dreamer-powers.js";
import { discardDreamCard, isBossDreamCard, isDreambeastLike } from "./dream-deck.js";

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function psycheCards(player) {
  return (player.hand || []).filter((c) => c.type !== "psyche-power" && c.type !== "object" && !isDreambeastPsycheCard(c));
}

function discardPsyche(state, player, cards) {
  cards.forEach((card) => {
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    state.psycheDiscard.push(card);
  });
  if (cards.length) {
    recordQuestEvent(state, "discard_psyche", { count: cards.length, landscapeId: player.landscapeId });
    recordCancellableDiscard(state, player, cards[cards.length - 1], "event");
  }
}

function discardObjects(state, player, cards) {
  cards.forEach((card) => {
    player.objects = (player.objects || []).filter((c) => c.instanceId !== card.instanceId);
    player.persistent = (player.persistent || []).filter((c) => c.instanceId !== card.instanceId);
    discardToMindstream(state, card);
  });
}

function returnN(state, count, player = null) {
  if (count <= 0) return;
  requestReturnCards(state, count, player);
}

function toggleSpend(pending, choiceId) {
  if (choiceId === "confirm") return false;
  pending.order = pending.order || [];
  const idx = pending.order.indexOf(choiceId);
  if (idx >= 0) pending.order.splice(idx, 1);
  else pending.order.push(choiceId);
  return true;
}

function selectedFromSpend(player, pending) {
  const ids = pending.order || [];
  return psycheCards(player).filter((c) => ids.includes(c.instanceId));
}

function grantFreeMeet(state, n = 1) {
  state.meetActionBudget = (state.meetActionBudget || 0) + n;
  addLog(state, `Gain ${n} free Meet Action${n === 1 ? "" : "s"} this phase.`);
}

let lastEventHelpers = null;

export function rememberEventHelpers(helpers) {
  if (helpers) lastEventHelpers = helpers;
  return lastEventHelpers;
}

function applyMindstreamDraw(state, player, suit) {
  const deck = state.mindstreamDecks[suit];
  if (!deck?.length) {
    addLog(state, `No cards left in the ${suit} Mindstream.`);
    return;
  }
  const card = deck.shift();
  addLog(state, `${player.name} draws ${card.name} from ${suit} Mindstream.`);
  const helpers = rememberEventHelpers();
  if (helpers?.resolveCardEffect) {
    helpers.resolveCardEffect(state, card, player, helpers);
    if (card.type !== "dreambeast" && card.type !== "object") {
      discardToMindstream(state, card);
      if (card.type === "event" && card.eventWasted) {
        addLog(state, `${card.name} is discarded unused.`);
      }
    }
    return;
  }
  if (card.type === "object") player.objects.push({ ...card, instanceId: uid("obj") });
  else if (card.type === "dreambeast") spawnPulled(state, player.landscapeId, card);
  else discardToMindstream(state, card);
}

export function continueDeferredEventQueues(state) {
  if (state.pendingEffectChoice || state.landscapePick || state.pendingDreamChoice) return;
  if (state._mindstreamDrawQueue) {
    presentAnyMindstreamDraw(state);
    return;
  }
  if (state._noWhyQueue?.length) presentNoWhyOther(state);
}

function presentAnyMindstreamDraw(state) {
  if (state.pendingEffectChoice || state.landscapePick) return;
  const q = state._mindstreamDrawQueue;
  if (!q?.playerIds?.length) {
    const after = q?.after;
    state._mindstreamDrawQueue = null;
    after?.(state);
    return;
  }
  const player = playerById(state, q.playerIds[0]);
  const choices = ["lucidity", "elasticity", "willpower"].map((suit) => ({
    id: suit,
    label: `${suit[0].toUpperCase()}${suit.slice(1)} Mindstream`,
    disabled: !state.mindstreamDecks[suit]?.length,
  }));
  if (!player || choices.every((c) => c.disabled)) {
    q.playerIds.shift();
    presentAnyMindstreamDraw(state);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "any-mindstream-draw",
    title: q.title || "Draw from a Mindstream",
    message: `${player.name}: choose a Mindstream deck.`,
    choices,
  });
}

export function beginAnyMindstreamDraw(state, players, { after = null, title = "Draw from a Mindstream" } = {}) {
  state._mindstreamDrawQueue = {
    playerIds: players.map((p) => p.id),
    after,
    title,
  };
  presentAnyMindstreamDraw(state);
}

registerEffectResolver("any-mindstream-draw", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (player) applyMindstreamDraw(state, player, choiceId);
  if (state._mindstreamDrawQueue?.playerIds?.length) state._mindstreamDrawQueue.playerIds.shift();
  if (state.pendingEffectChoice || state.landscapePick) return true;
  presentAnyMindstreamDraw(state);
  return true;
});

function flipDeckByKey(state, key) {
  const map = {
    psyche: state.psycheDeck,
    dream: state.dreamDeck,
    lucidity: state.mindstreamDecks.lucidity,
    elasticity: state.mindstreamDecks.elasticity,
    willpower: state.mindstreamDecks.willpower,
  };
  const deck = map[key];
  if (deck?.length >= 2) {
    const a = deck.shift();
    const b = deck.shift();
    deck.unshift(a, b);
    addLog(state, `Flipped the top of the ${key} deck.`);
    return true;
  }
  addLog(state, `Could not flip the ${key} deck.`);
  return false;
}

function deckFlipChoices() {
  return [
    { id: "psyche", label: "Psyche deck" },
    { id: "dream", label: "Dream deck" },
    { id: "lucidity", label: "Lucidity Mindstream" },
    { id: "elasticity", label: "Elasticity Mindstream" },
    { id: "willpower", label: "Willpower Mindstream" },
  ];
}

function spawnPulled(state, tileId, card) {
  const encounter = encounterFromDreambeastCard(card);
  setEncounterOnLandscape(state, tileId, encounter);
  addLog(state, `${encounter.name} appears on ${landscapeById(state, tileId)?.name || tileId}.`);
  return encounter;
}

function offerBeastPick(state, player, cardId, pair, message, payload = {}) {
  const cards = [pair.first?.card, pair.second?.card].filter(Boolean);
  if (cards.length === 1) {
    spawnPulled(state, player.landscapeId, cards[0]);
    return;
  }
  offerEffectChoice(state, player, {
    cardId,
    ui: "cards",
    title: payload.title || "Choose an Encounter",
    message,
    cards,
    payload: { ...payload, first: pair.first, second: pair.second },
  });
}

function returnUnusedBeast(state, pending, chosen) {
  const extras = [pending.payload?.first, pending.payload?.second].filter(Boolean);
  extras.forEach((entry) => {
    if (entry.card && entry.card !== chosen && (entry.card.instanceId || entry.card.id) !== (chosen.instanceId || chosen.id)) {
      if (entry.suit && state.mindstreamDecks[entry.suit]) state.mindstreamDecks[entry.suit].push(entry.card);
    }
  });
}

export function beginPopQuiz(state, player) {
  const n = drawPsycheForPlayer(state, player, 1);
  if (n.length) recordQuestEvent(state, "draw_psyche", { count: n.length });
  const drawn = n[0]?.value ?? 0;
  const next = state.psycheDeck[0]?.value;
  offerEffectChoice(state, player, {
    cardId: "pop-quiz",
    title: "Pop Quiz",
    message: `You drew ${drawn}. Is the next Psyche higher or lower?`,
    choices: [
      { id: "higher", label: "Higher" },
      { id: "lower", label: "Lower" },
    ],
    payload: { drawn, next },
  });
}

registerEffectResolver("pop-quiz", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return false;
  const next = pending.payload?.next ?? state.psycheDeck[0]?.value ?? 3;
  const drawn = pending.payload?.drawn ?? 0;
  const correct = (choiceId === "higher" && next > drawn) || (choiceId === "lower" && next < drawn);
  if (correct) {
    returnN(state, alive(state).length + 3, player);
    addLog(state, `Pop Quiz: guessed ${choiceId} — correct! Next was ${next}.`);
  } else {
    addLog(state, `Pop Quiz: guessed ${choiceId} — wrong. Next was ${next}.`);
  }
  return true;
});

export function beginEveningPlans(state, player) {
  offerEffectChoice(state, player, {
    cardId: "evening-plans",
    title: "Evening Plans",
    message: "Draw 1 Psyche, or flip the top of a deck?",
    choices: [
      { id: "draw", label: "Draw 1 Psyche" },
      { id: "psyche", label: "Flip Psyche deck" },
      { id: "dream", label: "Flip Dream deck" },
      { id: "lucidity", label: "Flip Lucidity Mindstream" },
      { id: "elasticity", label: "Flip Elasticity Mindstream" },
      { id: "willpower", label: "Flip Willpower Mindstream" },
    ],
  });
}

function placeLucidityBeastsNearDay(state) {
  const day = landscapeById(state, "day-in-the-life");
  const adj = (day ? adjacentTiles(state, "day-in-the-life") : []).filter((t) => t.revealed && !t.wasteland);
  for (let i = 0; i < 2; i += 1) {
    const pulled = pullDreambeastFromMindstream(state, { suit: "lucidity" });
    if (!pulled) break;
    const dest = adj[i] || adj[0] || day;
    if (dest) spawnPulled(state, dest.id, pulled.card);
  }
}

registerEffectResolver("evening-plans", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "draw" && player) {
    const n = drawPsycheForPlayer(state, player, 1);
    recordQuestEvent(state, "draw_psyche", { count: n.length });
  } else if (choiceId) {
    flipDeckByKey(state, choiceId);
  }
  placeLucidityBeastsNearDay(state);
  return true;
});

export function beginSomethingOverThere(state, player) {
  const hasPsyche = psycheCards(player).length > 0;
  offerEffectChoice(state, player, {
    cardId: "somethings-over-there",
    title: "Something's Over There",
    message: "Discard 1 Psyche to place a Dreambeast on any Landscape, or draw 2 Encounters and choose 1.",
    choices: [
      { id: "discard-place", label: "Discard 1 Psyche, place a Dreambeast", disabled: !hasPsyche },
      { id: "pick-two", label: "Draw 2 Encounters, choose 1" },
    ],
  });
}

registerEffectResolver("somethings-over-there", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (pending.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    if (card) {
      returnUnusedBeast(state, pending, card);
      const dests = revealedLandscapeTiles(state);
      if (dests.length > 1) {
        requestChooseTile(state, {
          allowedIds: dests.map((t) => t.id),
          action: "spawnEncounter",
          encounter: encounterFromDreambeastCard(card),
          title: "Something's Over There",
          detail: "Place the Dreambeast on any Landscape.",
        });
      } else if (dests[0]) spawnPulled(state, dests[0].id, card);
    }
    return true;
  }
  state.pendingEffectChoice = null;
  if (choiceId === "discard-place") {
    const card = psycheCards(player)[0];
    if (card) discardPsyche(state, player, [card]);
    const pulled = pullDreambeastFromMindstream(state);
    if (pulled) {
      const dests = revealedLandscapeTiles(state);
      requestChooseTile(state, {
        allowedIds: dests.map((t) => t.id),
        action: "spawnEncounter",
        encounter: encounterFromDreambeastCard(pulled.card),
        title: "Something's Over There",
        detail: "Place the Dreambeast on any Landscape.",
      });
    }
    return true;
  }
  const pair = pullTwoDreambeastsForChoice(state, { autoPick: false });
  if (pair?.first) offerBeastPick(state, player, "somethings-over-there", pair, "Choose 1 Encounter to spawn.");
  return true;
});

export function beginCouncil(state, player) {
  offerEffectChoice(state, player, {
    cardId: "the-council-of-the-years",
    title: "The Council of The Years",
    message: "Draw 4 Psyche and keep 1, or draw 4 Dreambeasts and Meet 1.",
    choices: [
      { id: "psyche", label: "Draw 4 Psyche, Repress 3, keep 1" },
      { id: "beasts", label: "Draw 4 Dreambeasts, Repress 3, Meet 1" },
    ],
  });
}

registerEffectResolver("the-council-of-the-years", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (pending.ui === "cards" && pending.step === "keep-psyche") {
    const keep = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    (pending.cards || []).forEach((c) => {
      if (c !== keep) repressCard(state, c);
    });
    if (keep) player.hand.push(keep);
    addLog(state, `${player.name} keeps ${keep?.name || "1 Psyche"} and Represses the rest.`);
    return true;
  }
  if (pending.ui === "cards" && pending.step === "meet-beast") {
    const keep = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    (pending.cards || []).forEach((c) => {
      if (c !== keep) repressCard(state, c);
    });
    if (keep) {
      spawnPulled(state, player.landscapeId, keep);
      grantFreeMeet(state, 1);
    }
    return true;
  }
  state.pendingEffectChoice = null;
  if (choiceId === "psyche") {
    const drawn = [];
    for (let i = 0; i < 4; i += 1) drawn.push(...drawPsycheForPlayer(state, player, 1));
    drawn.forEach((c) => {
      player.hand = player.hand.filter((x) => x.instanceId !== c.instanceId);
    });
    if (drawn.length <= 1) {
      drawn.forEach((c) => player.hand.push(c));
      return true;
    }
    offerEffectChoice(state, player, {
      cardId: "the-council-of-the-years",
      ui: "cards",
      step: "keep-psyche",
      title: "Council — keep 1 Psyche",
      message: "Choose 1 to keep. The others are Repressed.",
      cards: drawn,
    });
    return true;
  }
  const beasts = [];
  for (let i = 0; i < 4; i += 1) {
    const pulled = pullDreambeastFromMindstream(state);
    if (pulled) beasts.push(pulled.card);
  }
  if (!beasts.length) return true;
  if (beasts.length === 1) {
    spawnPulled(state, player.landscapeId, beasts[0]);
    grantFreeMeet(state, 1);
    return true;
  }
  offerEffectChoice(state, player, {
    cardId: "the-council-of-the-years",
    ui: "cards",
    step: "meet-beast",
    title: "Council — Meet 1",
    message: "Choose 1 Dreambeast to Meet now. The others are Repressed.",
    cards: beasts,
  });
  return true;
});

export function beginHarmonicResonance(state, player) {
  const luc = player.dreamer?.lucidity ?? 0;
  if (luc <= 1) drawPsycheForPlayer(state, player, 1);
  else if (luc >= 3) returnN(state, 2, player);
  offerEffectChoice(state, player, {
    cardId: "harmonic-resonance",
    title: "Harmonic Resonance",
    message: "Draw +1 Psyche or Return +2.",
    choices: [
      { id: "draw", label: "Draw 1 Psyche" },
      { id: "return", label: "Return 2 cards" },
    ],
  });
}

registerEffectResolver("harmonic-resonance", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return false;
  if (choiceId === "return") returnN(state, 2, player);
  else drawPsycheForPlayer(state, player, 1);
  return true;
});

export function beginKeepItTogether(state, player) {
  const objs = [...(player.objects || []), ...(player.persistent || [])];
  if (!objs.length) return;
  const psyche = psycheCards(player);
  offerEffectChoice(state, player, {
    cardId: "keep-it-together",
    title: "Keep it Together",
    message: "Discard Psyche equal to the Objects you want to spare. The rest are Repressed.",
    ui: "spend",
    cards: psyche,
    maxCount: Math.min(psyche.length, objs.length),
    payload: { objectIds: objs.map((o) => o.instanceId) },
  });
}

registerEffectResolver("keep-it-together", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (toggleSpend(pending, choiceId)) return true;
  const cards = selectedFromSpend(player, pending);
  discardPsyche(state, player, cards);
  const spare = cards.length;
  const objs = [...(player.objects || []), ...(player.persistent || [])];
  objs.slice(spare).forEach((obj) => {
    player.objects = (player.objects || []).filter((o) => o.instanceId !== obj.instanceId);
    player.persistent = (player.persistent || []).filter((o) => o.instanceId !== obj.instanceId);
    repressCard(state, obj);
  });
  state.pendingEffectChoice = null;
  addLog(state, `Keep it Together: spared ${spare} Object(s); Repressed the rest.`);
  return true;
});

export function beginEveryonesLaughing(state, player) {
  const luc = player.dreamer?.lucidity ?? 0;
  const encCount = Math.max(1, Math.floor(allEncountersOnBoard(state).length / 2));
  if (luc >= 3) {
    offerEffectChoice(state, player, {
      cardId: "everyones-laughing",
      title: "Everyone's Laughing",
      message: "Lucidity 3+: discard 1 Psyche instead of 2 Objects, then discard Psyche equal to half Encounters.",
      ui: "cards",
      cards: psycheCards(player),
      payload: { extra: encCount },
    });
    return;
  }
  const objs = player.objects || [];
  if (objs.length >= 2) {
    offerEffectChoice(state, player, {
      cardId: "everyones-laughing",
      title: "Everyone's Laughing",
      message: "Choose 2 Objects to discard, then discard Psyche equal to half Encounters.",
      ui: "cards",
      cards: objs,
      needCount: 2,
      payload: { extra: encCount, objects: true },
    });
    return;
  }
  enqueueRepressFromHand(state, player, encCount, { reason: "Everyone's Laughing: discard Psyche equal to half Encounters." });
}

registerEffectResolver("everyones-laughing", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (pending.payload?.objects) {
    const picked = (pending.order || []).length ? pending.order : [(pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId)].filter(Boolean);
    if (picked.length < 2 && choiceId) {
      const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
      if (card && !pending.order.some((c) => c.instanceId === card.instanceId)) pending.order.push(card);
      if (pending.order.length < 2) return true;
    }
    discardObjects(state, player, pending.order.length ? pending.order : picked);
  } else {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    if (card) discardPsyche(state, player, [card]);
  }
  const extra = pending.payload?.extra || 1;
  state.pendingEffectChoice = null;
  enqueueRepressFromHand(state, player, extra, { reason: "Everyone's Laughing: discard Psyche equal to half Encounters." });
  return true;
});

export function beginRevolving(state, player) {
  drawPsycheForPlayer(state, player, 3);
  enqueueRepressFromHand(state, player, 1, { reason: `${player.name}: Revolving — Repress 1 Psyche.` });
  const others = alive(state).filter((p) => p.id !== player.id);
  if (!others.length) return;
  if (others.length === 1) {
    const temp = player.landscapeId;
    player.landscapeId = others[0].landscapeId;
    others[0].landscapeId = temp;
    addLog(state, `${player.name} and ${others[0].name} swap positions.`);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "revolving",
    title: "Revolving",
    message: "Swap positions with which Dreamer?",
    choices: others.map((p) => ({ id: p.id, label: p.name })),
  });
}

registerEffectResolver("revolving", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const other = playerById(state, choiceId);
  state.pendingEffectChoice = null;
  if (!player || !other) return false;
  const temp = player.landscapeId;
  player.landscapeId = other.landscapeId;
  other.landscapeId = temp;
  addLog(state, `${player.name} and ${other.name} swap positions.`);
  recordQuestEvent(state, "move_player", { count: 2 });
  return true;
});

export function beginFriendship(state, player) {
  const hidden = state.board.filter((l) => !l.revealed && !l.center).slice(0, 2);
  hidden.forEach((t) => revealLandscapeTile(state, t));
  if (hidden.length) recordQuestEvent(state, "reveal_landscape", { count: hidden.length });
  if (!hidden.length) return;
  if (hidden.length === 1) {
    player.landscapeId = hidden[0].id;
    addLog(state, `${player.name} moves to ${hidden[0].name}.`);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "friendship",
    title: "Friendship",
    message: "Move to which revealed Landscape?",
    choices: hidden.map((t) => ({ id: t.id, label: t.name })),
  });
}

registerEffectResolver("friendship", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  const tile = landscapeById(state, choiceId);
  if (player && tile) {
    player.landscapeId = tile.id;
    addLog(state, `${player.name} moves to ${tile.name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
  }
  return true;
});

export function beginFreezingNight(state, player, helpers) {
  const ela = player.dreamer?.elasticity ?? 0;
  const wp = player.dreamer?.willpower ?? 0;
  if (ela <= 2) {
    const drawn = [];
    for (let i = 0; i < 2; i += 1) drawn.push(...drawPsycheForPlayer(state, player, 1));
    drawn.forEach((c) => {
      player.hand = player.hand.filter((x) => x.instanceId !== c.instanceId);
    });
    if (drawn.length > 1) {
      offerEffectChoice(state, player, {
        cardId: "freezing-night",
        ui: "cards",
        step: "keep-psyche",
        title: "Freezing Night",
        message: "Keep 1 Psyche. The other is discarded.",
        cards: drawn,
        payload: { wp, helpersReady: true },
      });
      return;
    }
    drawn.forEach((c) => player.hand.push(c));
  }
  if (wp >= 3 && helpers?.drawObjects) beginFreezingObjects(state, player, helpers);
}

function beginFreezingObjects(state, player, helpers) {
  const objs = helpers.drawObjects(state, player, 2, helpers);
  if (objs.length > 1) {
    offerEffectChoice(state, player, {
      cardId: "freezing-night",
      ui: "cards",
      step: "keep-object",
      title: "Freezing Night",
      message: "Keep 1 Object. The other is discarded.",
      cards: objs,
    });
  }
}

registerEffectResolver("freezing-night", (state, choiceId, helpers) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const keep = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  if (pending.step === "keep-psyche") {
    (pending.cards || []).forEach((c) => {
      if (c === keep) player.hand.push(c);
      else state.psycheDiscard.push(c);
    });
    state.pendingEffectChoice = null;
    if ((pending.payload?.wp ?? 0) >= 3) beginFreezingObjects(state, player, helpers);
    return true;
  }
  if (pending.step === "keep-object") {
    (pending.cards || []).forEach((c) => {
      if (c !== keep) {
        player.objects = (player.objects || []).filter((o) => o.instanceId !== c.instanceId);
        discardToMindstream(state, c);
      }
    });
    state.pendingEffectChoice = null;
    return true;
  }
  state.pendingEffectChoice = null;
  return true;
});

export function beginLightness(state, player) {
  drawPsycheForPlayer(state, player, 2);
  const cards = psycheCards(player);
  if (!cards.length) return;
  offerEffectChoice(state, player, {
    cardId: "lightness",
    ui: "cards",
    title: "Lightness",
    message: "Discard 1 Psyche. All Dreamers may draw up to its value.",
    cards,
  });
}

registerEffectResolver("lightness", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  state.pendingEffectChoice = null;
  if (player && card) {
    discardPsyche(state, player, [card]);
    alive(state).forEach((p) => drawPsycheForPlayer(state, p, card.value || 1));
    addLog(state, `Lightness: discarded ${card.name}; each Dreamer draws ${card.value || 1}.`);
  }
  return true;
});

export function beginNeedWater(state, player) {
  const card = psycheCards(player)[0];
  if (card) discardPsyche(state, player, [card]);
  const wp = psycheCards(player).filter((c) => c.suit === "willpower");
  const objs = player.objects || [];
  offerEffectChoice(state, player, {
    cardId: "need-water",
    title: "Need Water!",
    message: "Discard a Willpower Psyche, or discard all Objects.",
    choices: [
      { id: "willpower", label: "Discard 1 Willpower Psyche", disabled: !wp.length },
      { id: "objects", label: "Discard all Objects", disabled: !objs.length },
    ],
  });
}

registerEffectResolver("need-water", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return false;
  if (choiceId === "willpower") {
    const wp = psycheCards(player).find((c) => c.suit === "willpower");
    if (wp) discardPsyche(state, player, [wp]);
  } else {
    discardObjects(state, player, [...(player.objects || [])]);
  }
  return true;
});

export function beginRhythm(state, player) {
  offerEffectChoice(state, player, {
    cardId: "rhythm-of-the-night",
    title: "Rhythm of the Night",
    message: "Discard 1 Object so all Dreamers draw 2 Psyche?",
    choices: [
      { id: "yes", label: "Discard 1 Object — everyone draws 2", disabled: !(player.objects || []).length },
      { id: "no", label: "Decline" },
    ],
  });
}

registerEffectResolver("rhythm-of-the-night", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "yes" && player?.objects?.length) {
    discardObjects(state, player, [player.objects[player.objects.length - 1]]);
    alive(state).forEach((p) => drawPsycheForPlayer(state, p, 2));
  }
  return true;
});

function grantMarshmallowTokens(state) {
  alive(state).forEach((p) => grantPowerTokens(state, p, 1));
}

export function beginMarshmallow(state, player, helpers) {
  rememberEventHelpers(helpers);
  grantPowerTokens(state, player, 2);
  offerEffectChoice(state, player, {
    cardId: "marshmallow-clouds",
    title: "Marshmallow Clouds",
    message: "Draw 1 card from any Mindstream?",
    choices: [
      { id: "yes", label: "Draw from a Mindstream" },
      { id: "no", label: "Skip the draw" },
    ],
  });
}

registerEffectResolver("marshmallow-clouds", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "yes" && player) {
    beginAnyMindstreamDraw(state, [player], { after: () => grantMarshmallowTokens(state) });
    return true;
  }
  grantMarshmallowTokens(state);
  return true;
});

function presentNoWhyOther(state) {
  const q = state._noWhyQueue;
  if (!q?.length) {
    state._noWhyQueue = null;
    return;
  }
  const player = playerById(state, q[0]);
  if (!player) {
    q.shift();
    presentNoWhyOther(state);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "no-why-other",
    title: "No Why",
    message: `${player.name}: draw from any Mindstream?`,
    choices: [
      { id: "yes", label: "Draw from a Mindstream" },
      { id: "no", label: "Skip" },
    ],
  });
}

export function beginNoWhy(state, player, helpers) {
  rememberEventHelpers(helpers);
  beginAnyMindstreamDraw(state, [player], {
    after: () => {
      state._noWhyQueue = alive(state).filter((p) => p.id !== player.id).map((p) => p.id);
      presentNoWhyOther(state);
    },
  });
}

registerEffectResolver("no-why-other", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "yes" && player) {
    beginAnyMindstreamDraw(state, [player], {
      after: () => {
        if (state._noWhyQueue?.length) state._noWhyQueue.shift();
        presentNoWhyOther(state);
      },
    });
    return true;
  }
  if (state._noWhyQueue?.length) state._noWhyQueue.shift();
  presentNoWhyOther(state);
  return true;
});

export function beginNoTime(state, player) {
  offerEffectChoice(state, player, {
    cardId: "no-time",
    title: "No Time",
    message: "Collectively discard 1 Object per Dreamer, or Repress 4 Mindstream cards to ignore this.",
    choices: [
      { id: "discard", label: "Each Dreamer discards 1 Object" },
      { id: "ignore", label: "Repress top of 4 Mindstream cards to ignore" },
    ],
  });
}

registerEffectResolver("no-time", (state, choiceId) => {
  state.pendingEffectChoice = null;
  if (choiceId === "ignore") {
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      const deck = state.mindstreamDecks[suit];
      if (deck?.length) repressCard(state, deck.shift());
    });
    const extra = ["lucidity", "elasticity", "willpower"].find((suit) => state.mindstreamDecks[suit]?.length);
    if (extra) repressCard(state, state.mindstreamDecks[extra].shift());
    addLog(state, "No Time is ignored — 4 Mindstream cards Repressed.");
    return true;
  }
  alive(state).forEach((p) => {
    if (p.objects?.length) discardObjects(state, p, [p.objects[p.objects.length - 1]]);
  });
  return true;
});

export function beginBigWave(state, player) {
  const drawn = drawPsycheForPlayer(state, player, 1)[0];
  const higher = psycheCards(player).filter((c) => c !== drawn && (c.value || 0) > (drawn?.value || 0));
  offerEffectChoice(state, player, {
    cardId: "big-wave",
    title: "Big Wave",
    message: drawn ? `You drew ${drawn.name} (${drawn.value}). Discard a higher Psyche to Return 3?` : "No higher Psyche to discard.",
    choices: [
      { id: "discard", label: "Discard a higher Psyche — Return 3", disabled: !higher.length },
      { id: "skip", label: "Keep your hand" },
    ],
    payload: { higherIds: higher.map((c) => c.instanceId) },
  });
}

registerEffectResolver("big-wave", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "discard" && player) {
    const card = psycheCards(player).find((c) => pending.payload?.higherIds?.includes(c.instanceId));
    if (card) {
      discardPsyche(state, player, [card]);
      returnN(state, 3, player);
    }
  }
  return true;
});

export function beginChewedToDust(state, player) {
  ["lucidity", "elasticity", "willpower"].forEach((s) => {
    const deck = state.mindstreamDecks[s];
    if (deck?.length) repressCard(state, deck.shift());
  });
  const psyche = psycheCards(player);
  offerEffectChoice(state, player, {
    cardId: "chewed-to-dust",
    title: "Chewed to Dust",
    message: "Discard 3 Psyche, or discard 1 Dream.",
    choices: [
      { id: "psyche", label: "Discard 3 Psyche", disabled: psyche.length < 3 },
      { id: "dream", label: "Discard 1 Dream", disabled: !state.dreamDeck?.length },
    ],
  });
}

registerEffectResolver("chewed-to-dust", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "psyche" && player) discardPsyche(state, player, psycheCards(player).slice(0, 3));
  else if (state.dreamDeck?.length) {
    discardDreamCard(state, state.dreamDeck.pop());
    addLog(state, "Chewed to Dust: discarded 1 Dream.");
  }
  return true;
});

export function beginCaramelForest(state, player) {
  const pair = pullTwoDreambeastsForChoice(state, { autoPick: false });
  if (!pair?.first) return;
  offerBeastPick(state, player, "caramel-forest", pair, "Choose 1 Encounter to spawn on an adjacent Landscape.");
}

registerEffectResolver("caramel-forest", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  state.pendingEffectChoice = null;
  if (card) returnUnusedBeast(state, pending, card);
  const adj = adjacentTiles(state, player?.landscapeId).filter((t) => t.revealed && !t.wasteland);
  if (card && adj.length) {
    requestChooseTile(state, {
      allowedIds: adj.map((t) => t.id),
      action: "spawnEncounter",
      encounter: encounterFromDreambeastCard(card),
      title: "Caramel Forest",
      detail: "Spawn on an adjacent Landscape.",
    });
  } else if (card && adj[0]) spawnPulled(state, adj[0].id, card);
  return true;
});

export function beginRoilingDoom(state, player) {
  enqueueRepressFromHand(state, player, 2, { reason: "Roiling Doom: Discard 2 Psyche." });
  const pair = pullTwoDreambeastsForChoice(state, { autoPick: false });
  if (!pair?.first) return;
  offerBeastPick(state, player, "roiling-doom", pair, "Choose 1 Encounter to Meet now. The other is discarded.");
}

registerEffectResolver("roiling-doom", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  state.pendingEffectChoice = null;
  if (card) {
    returnUnusedBeast(state, pending, card);
    spawnPulled(state, player.landscapeId, card);
    grantFreeMeet(state, 1);
  }
  return true;
});

export function beginWhoIsThere(state, player) {
  offerEffectChoice(state, player, {
    cardId: "who-is-there",
    title: "Who's There?",
    message: "Spawn an Encounter and Meet now, or draw 2 and pick 1.",
    choices: [
      { id: "meet-now", label: "Spawn 1 and Meet now" },
      { id: "pick-two", label: "Draw 2 Encounters, pick 1" },
    ],
  });
}

registerEffectResolver("who-is-there", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (pending.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    if (card) {
      returnUnusedBeast(state, pending, card);
      spawnPulled(state, player.landscapeId, card);
    }
    const deck = state.mindstreamDecks.willpower;
    if (deck?.length) repressCard(state, deck.shift());
    return true;
  }
  state.pendingEffectChoice = null;
  const deck = state.mindstreamDecks.willpower;
  if (deck?.length) repressCard(state, deck.shift());
  if (choiceId === "meet-now") {
    const pulled = pullDreambeastFromMindstream(state);
    if (pulled) {
      spawnPulled(state, player.landscapeId, pulled.card);
      state.selectedLandscapeId = player.landscapeId;
      state.skipLandscapeActionsNextMeet = true;
      grantFreeMeet(state, 1);
    }
    return true;
  }
  const pair = pullTwoDreambeastsForChoice(state, { autoPick: false });
  if (pair?.first) offerBeastPick(state, player, "who-is-there", pair, "Choose 1 Encounter.");
  return true;
});

export function beginGetUpDown(state, player, { optionalId, forcedId, label }) {
  if (state.psycheDiscard?.length) {
    player.hand.push(state.psycheDiscard.pop());
    recordQuestEvent(state, "draw_psyche", { count: 1 });
  }
  const optional = landscapeById(state, optionalId);
  const forced = landscapeById(state, forcedId);
  const choices = [];
  if (optional?.revealed) choices.push({ id: optionalId, label: `First move to ${optional.name}` });
  choices.push({ id: "skip-optional", label: `Skip ${optional?.name || optionalId}` });
  offerEffectChoice(state, player, {
    cardId: "get-up-down",
    title: label,
    message: `${label}: optional first move, then move to ${forced?.name || forcedId} and take a free Meet.`,
    choices,
    payload: { forcedId },
  });
}

registerEffectResolver("get-up-down", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const forcedId = pending.payload?.forcedId;
  state.pendingEffectChoice = null;
  if (player && choiceId !== "skip-optional" && landscapeById(state, choiceId)?.revealed) {
    player.landscapeId = choiceId;
    addLog(state, `${player.name} moves to ${landscapeById(state, choiceId).name}.`);
  }
  if (player && landscapeById(state, forcedId)?.revealed) {
    player.landscapeId = forcedId;
    addLog(state, `${player.name} moves to ${landscapeById(state, forcedId).name}.`);
    grantFreeMeet(state, 1);
  }
  return true;
});

export function beginASacrifice(state, player, event) {
  offerEffectChoice(state, player, {
    cardId: "a-sacrifice",
    title: "A Sacrifice!",
    message: "Discard 1 Object to Return Dreamers+1?",
    choices: [
      { id: "yes", label: "Discard 1 Object", disabled: !(player.objects || []).length },
      { id: "no", label: "Skip the discard" },
    ],
    payload: { landscapes: event?.landscapes || [] },
  });
}

registerEffectResolver("a-sacrifice", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "yes" && player?.objects?.length) {
    discardObjects(state, player, [player.objects[player.objects.length - 1]]);
    returnN(state, alive(state).length + 1, player);
  }
  const ids = pending.payload?.landscapes || [];
  allEncountersOnBoard(state)
    .filter(({ tile }) => ids.includes(tile.id))
    .forEach(({ tile, encounter }) => {
      repressCard(state, encounter);
      removeEncounterFromLandscape(state, tile.id, encounter);
    });
  addLog(state, "A Sacrifice: Encounters on Affected Landscapes are Repressed.");
  return true;
});

export function beginWrongDoor(state, player) {
  const allies = acceptedAllies(state);
  if (allies.length < 2) {
    discardPsyche(state, player, psycheCards(player).slice(0, 4));
    addLog(state, "Wrong Door: not enough accepted Dreambeasts — discard 4 Psyche.");
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "wrong-door",
    ui: "cards",
    title: "Wrong Door",
    message: "Return 2 accepted Dreambeasts and spawn them on adjacent Landscapes.",
    cards: allies.map((a) => a.card),
    needCount: 2,
  });
}

registerEffectResolver("wrong-door", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!pending.order) pending.order = [];
  const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  if (card && !pending.order.some((c) => c.instanceId === card.instanceId)) pending.order.push(card);
  if (pending.order.length < 2) return true;
  const picked = pending.order.slice(0, 2);
  state.pendingEffectChoice = null;
  const adj = adjacentTiles(state, player?.landscapeId).filter((t) => t.revealed && !t.wasteland);
  picked.forEach((ally, i) => {
    removeAcceptedAlly(state, ally.instanceId);
    const dest = adj[i] || adj[0];
    if (dest) spawnPulled(state, dest.id, ally);
    else returnDreambeastToMindstreamDeck(state, ally);
  });
  return true;
});

export function beginBronze(state, player, event) {
  const allies = acceptedAllies(state);
  if (allies.length >= 2) {
    offerEffectChoice(state, player, {
      cardId: "bronze",
      ui: "cards",
      title: "Bronze",
      message: "Return 2 accepted Dreambeasts to their Mindstreams, then spawn on an Affected Landscape.",
      cards: allies.map((a) => a.card),
      needCount: 2,
      payload: { landscapes: event?.landscapes || [] },
    });
    return;
  }
  spawnBronzeOrSilver(state, player, event, "Bronze");
}

function spawnBronzeOrSilver(state, player, event, title) {
  const pulled = pullDreambeastFromMindstream(state);
  if (!pulled) return;
  const tiles = revealedLandscapeTiles(state, { landscapeIds: event?.landscapes || [] });
  if (tiles.length) {
    requestChooseTile(state, {
      allowedIds: tiles.map((t) => t.id),
      action: "spawnEncounter",
      encounter: encounterFromDreambeastCard(pulled.card),
      title: `${title} — spawn a Dreambeast`,
      detail: "Choose an Affected Landscape.",
    });
  } else {
    spawnPulled(state, player.landscapeId, pulled.card);
  }
}

registerEffectResolver("bronze", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!pending.order) pending.order = [];
  const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  if (card && !pending.order.some((c) => c.instanceId === card.instanceId)) pending.order.push(card);
  if (pending.order.length < 2) return true;
  pending.order.slice(0, 2).forEach((ally) => {
    removeAcceptedAlly(state, ally.instanceId);
    returnDreambeastToMindstreamDeck(state, ally);
  });
  const landscapes = pending.payload?.landscapes || [];
  state.pendingEffectChoice = null;
  spawnBronzeOrSilver(state, player, { landscapes }, "Bronze");
  return true;
});

function listSilverSpawnCandidates(state) {
  const out = [];
  const seen = new Set();
  const add = (card, source) => {
    if (!isDreambeastLike(card)) return;
    const key = card.instanceId || `${source}:${card.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...card, _silverSource: source });
  };
  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    (state.mindstreamDiscard?.[suit] || []).forEach((card) => add(card, "mindstream"));
  });
  (state.dreamDiscard || []).forEach((card) => add(card, "dream"));
  listSubconsciousCards(state).forEach((card) => add(card, "subconscious"));
  return out;
}

function takeSilverCandidate(state, card) {
  const source = card._silverSource;
  if (source === "subconscious" && card.instanceId) {
    return removeFromSubconscious(state, card.instanceId) || card;
  }
  const piles = source === "dream"
    ? [state.dreamDiscard || []]
    : ["lucidity", "elasticity", "willpower"].map((suit) => state.mindstreamDiscard?.[suit] || []);
  for (const pile of piles) {
    const idx = pile.findIndex((c) => (
      (card.instanceId && c.instanceId === card.instanceId) || c.id === card.id
    ));
    if (idx >= 0) return pile.splice(idx, 1)[0];
  }
  return card;
}

function occupiedLandscapeIds(state) {
  return [...new Set(
    state.players
      .filter((p) => p.alive)
      .map((p) => p.landscapeId)
      .filter((id) => {
        const tile = landscapeById(state, id);
        return tile?.revealed && !tile.wasteland;
      }),
  )];
}

export function startSilverForcedAccept(state, player, tileId, enc) {
  if (!player || !enc) return;
  const tile = landscapeById(state, tileId);
  state.selectedLandscapeId = tileId;
  state.activeEncounter = enc;
  state.activeEncounterLandscapeId = tileId;
  state.forcedAccept = {
    playerId: player.id,
    tileId,
    encounterId: enc.instanceId || enc.id,
  };
  addLog(
    state,
    `Silver: ${enc.name} appears on ${tile?.name || tileId}. ${player.name} must Accept it — Reject is not allowed.`,
  );
}

function startSilverSpawn(state, player, card) {
  const beast = takeSilverCandidate(state, card);
  const encounter = encounterFromDreambeastCard({
    ...beast,
    type: "dreambeast",
    boss: !!(beast.boss || beast.type === "boss-dream" || isBossDreamCard(beast)),
  });
  const dests = occupiedLandscapeIds(state);
  const fallback = dests.length ? dests : [player.landscapeId].filter(Boolean);
  if (fallback.length === 1) {
    spawnPulled(state, fallback[0], encounter);
    const enc = encounterOnLandscape(state, fallback[0]);
    const actor = state.players.find((p) => p.alive && p.landscapeId === fallback[0]) || player;
    startSilverForcedAccept(state, actor, fallback[0], enc || encounter);
    return;
  }
  requestChooseTile(state, {
    allowedIds: fallback,
    action: "spawnEncounter",
    encounter,
    title: "Silver — spawn on a Dreamer",
    detail: "Click a Landscape that has a Dreamer. That Dreamer must then Accept this Dreambeast (no Reject).",
    followup: { cardId: "silver-accept", playerId: player.id },
  });
}

export function recoverLegacySilver(state) {
  const pick = state.landscapePick;
  const stuck = pick && (
    pick.followup?.cardId === "silver-accept"
    || /^Silver/i.test(pick.title || "")
  );
  if (!stuck) return false;
  if (pick.encounter && !isBossDreamCard(pick.encounter) && pick.encounter.suit) {
    discardToMindstream(state, pick.encounter);
  }
  const player = state.players.find((p) => p.id === pick.followup?.playerId)
    || state.players.find((p) => p.isHead)
    || state.players[0];
  state.landscapePick = null;
  state.pendingObjectFollowup = null;
  if (player) beginSilver(state, player, {});
  return true;
}

export function beginSilver(state, player) {
  const cards = listSilverSpawnCandidates(state);
  if (!cards.length) {
    addLog(state, "Silver: no Dreambeasts in Discard or Subconscious.");
    return;
  }
  if (cards.length === 1) {
    startSilverSpawn(state, player, cards[0]);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "silver",
    ui: "cards",
    title: "Silver — choose a Dreambeast",
    message: "Pick any Dreambeast from Discard or Subconscious. It spawns on a Dreamer's Landscape and must be Accepted (no Reject).",
    cards,
  });
}

registerEffectResolver("silver", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const card = (pending?.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
  state.pendingEffectChoice = null;
  if (!player || !card) return false;
  startSilverSpawn(state, player, card);
  return true;
});

export function finishSilverAccept(state, tileId, player) {
  const enc = state.activeEncounter || encounterOnLandscape(state, tileId);
  if (enc) startSilverForcedAccept(state, player, tileId, enc);
}

export function beginMillionReflections(state, player) {
  const cards = ["lucidity", "elasticity", "willpower"].flatMap((suit) => state.mindstreamDiscard[suit] || []);
  if (!cards.length) {
    returnN(state, 4, player);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "a-million-reflections",
    ui: "spend",
    title: "A Million Reflections",
    message: "Choose up to 4 discarded Mindstream cards to Repress, then Return 4.",
    cards,
    maxCount: 4,
  });
}

registerEffectResolver("a-million-reflections", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (toggleSpend(pending, choiceId)) return true;
  (pending.order || []).forEach((id) => {
    const card = (pending.cards || []).find((c) => c.instanceId === id);
    if (!card) return;
    ["lucidity", "elasticity", "willpower"].forEach((suit) => {
      const pile = state.mindstreamDiscard[suit];
      const idx = pile?.findIndex((c) => c.instanceId === card.instanceId) ?? -1;
      if (idx >= 0) pile.splice(idx, 1);
    });
    repressCard(state, card);
  });
  state.pendingEffectChoice = null;
  returnN(state, 4, player);
  return true;
});

export function beginHiddenInTheWalls(state, player, helpers) {
  drawPsycheForPlayer(state, player, 1);
  drawPsycheForPlayer(state, player, 5);
  const pulled = pullDreambeastFromMindstream(state, { suit: "elasticity" });
  if (pulled) {
    const enc = encounterFromDreambeastCard(pulled.card);
    enc.failDoubled = true;
    setEncounterOnLandscape(state, player.landscapeId, enc);
    addLog(state, `${enc.name} is hidden in the walls — Meet now; Fail cost is doubled.`);
    grantFreeMeet(state, 1);
  } else {
    helpers.spawnEncounter(state, player.landscapeId);
    grantFreeMeet(state, 1);
  }
}

export function beginAMirage(state, player, helpers) {
  const pulled = pullDreambeastFromMindstream(state, { suit: "elasticity" });
  const enc = pulled
    ? encounterFromDreambeastCard(pulled.card)
    : null;
  if (enc) {
    addLog(state, `A Mirage?: pay ${enc.name}'s Fail cost first.`);
    applyFailEffect(state, player, enc);
    setEncounterOnLandscape(state, player.landscapeId, enc);
  } else {
    helpers.spawnEncounter(state, player.landscapeId);
    const enc = encounterOnLandscape(state, player.landscapeId);
    if (enc) applyFailEffect(state, player, enc);
  }
}

export function beginGiantPile(state, player, helpers) {
  const pulled = pullDreambeastFromMindstream(state);
  if (pulled) {
    const enc = encounterFromDreambeastCard(pulled.card);
    enc.accept = Math.ceil((enc.accept || 8) / 2);
    enc.reject = Math.ceil((enc.reject || 6) / 2);
    setEncounterOnLandscape(state, player.landscapeId, enc);
    addLog(state, `${enc.name} emerges at half Meet cost. Meet now.`);
    grantFreeMeet(state, 1);
  } else {
    helpers.spawnEncounter(state, player.landscapeId);
    grantFreeMeet(state, 1);
  }
}

export function beginPerilousPinnacle(state, player) {
  const objs = (player.objects || []).slice(0, 2);
  discardObjects(state, player, objs);
  const encounters = allEncountersOnBoard(state);
  grantFreeMeet(state, Math.max(encounters.length, 2));
  if (encounters.length <= 1) {
    const first = encounters[0];
    if (first) {
      state.selectedLandscapeId = first.tile.id;
      state.activeEncounter = first.encounter;
      state.activeEncounterLandscapeId = first.tile.id;
    }
    addLog(state, "Perilous Pinnacle: Meet the remaining Encounter.");
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "perilous-pinnacle",
    title: "Perilous Pinnacle",
    message: "Choose which Encounter to Meet first.",
    choices: encounters.map(({ tile, encounter }) => ({
      id: `${tile.id}:${encounterKey(encounter)}`,
      label: `${encounter.name} on ${tile.name}`,
    })),
  });
}

registerEffectResolver("perilous-pinnacle", (state, choiceId) => {
  state.pendingEffectChoice = null;
  const [tileId, encKey] = String(choiceId).split(":");
  const tile = landscapeById(tileId);
  const encounter = tileEncounters(tile).find((enc) => encounterKey(enc) === encKey);
  if (tile && encounter) {
    state.selectedLandscapeId = tile.id;
    state.activeEncounter = encounter;
    state.activeEncounterLandscapeId = tile.id;
    addLog(state, `Perilous Pinnacle: Meet ${encounter.name} first.`);
  }
  return true;
});

export function beginFromTheFire(state, player) {
  const repressed = listSubconsciousCards(state).filter((c) => c.type === "dreambeast" || c.boss);
  repressed.slice(0, 2).forEach((card) => {
    ["dreambeasts"].forEach(() => {
      const pile = state.subconscious?.dreambeasts;
      const idx = pile?.findIndex((c) => c.instanceId === card.instanceId) ?? -1;
      if (idx >= 0) pile.splice(idx, 1);
    });
    returnDreambeastToMindstreamDeck(state, card);
    addLog(state, `From the Fire: returned ${card.name} from the Subconscious.`);
  });
  returnN(state, 2, player);
}

export function beginMouthRises(state, player, helpers) {
  const lev = flipLeviathan(state, helpers);
  if (lev?.awake) {
    const dest = landscapeById(state, "endless-ocean");
    const leviathanEntry = allEncountersOnBoard(state).find(
      ({ encounter }) => encounter.id === "leviathan" || encounter.refId === "leviathan",
    );
    const from = leviathanEntry?.tile;
    if (dest?.revealed && from && dest.id !== from.id) {
      if (leviathanEntry) removeEncounterFromLandscape(state, from.id, leviathanEntry.encounter);
      setEncounterOnLandscape(state, dest.id, lev);
      addLog(state, "Leviathan moves to Endless Ocean.");
    }
  }
  requestChooseTile(state, {
    allowedIds: ["endless-ocean"].filter((id) => landscapeById(state, id)?.revealed),
    action: "movePlayer",
    playerId: player.id,
    title: "A Mouth Rises",
    detail: "Move to Endless Ocean if revealed.",
  });
}

export function beginUndulatingFloor(state, player) {
  const dests = state.board.filter((t) => t.revealed && !t.wasteland);
  requestChooseTile(state, {
    allowedIds: dests.map((t) => t.id),
    action: "movePlayer",
    playerId: player.id,
    title: "Undulating Floor",
    detail: "Move to any Landscape.",
  });
  const arch = state.activeArchetype;
  if (arch) {
    arch.powerTokensOnArchetype = (arch.powerTokensOnArchetype || 0) + 1;
    addLog(state, `Placed 1 Power Token on ${arch.name}.`);
  } else {
    grantPowerTokens(state, player, 1);
  }
}

export function beginAfternoonNap(state, player) {
  drawPsycheForPlayer(state, player, 1);
  const luc = player.dreamer?.lucidity ?? 0;
  if (psycheCards(player).length < luc && luc > 0) {
    offerEffectChoice(state, player, {
      cardId: "afternoon-nap",
      title: "Afternoon Nap",
      message: `Return up to ${luc} cards?`,
      choices: [
        { id: "return", label: `Return ${luc} cards` },
        { id: "skip", label: "Keep your Subconscious as-is" },
      ],
      payload: { luc },
    });
  }
}

registerEffectResolver("afternoon-nap", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (choiceId === "return" && player) returnN(state, pending.payload?.luc || 1, player);
  return true;
});

export function beginSublimation(state, player) {
  const cards = psycheCards(player);
  offerEffectChoice(state, player, {
    cardId: "sublimation",
    title: "Sublimation",
    message: "Discard 1–4 Psyche. Return that many cards and take 1 Power Token if you discard at least 1.",
    ui: "spend",
    cards,
    maxCount: Math.min(4, cards.length),
  });
}

registerEffectResolver("sublimation", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (toggleSpend(pending, choiceId)) return true;
  const selected = selectedFromSpend(player, pending);
  state.pendingEffectChoice = null;
  if (!selected.length) return true;
  discardPsyche(state, player, selected);
  returnN(state, selected.length, player);
  grantPowerTokens(state, player, 1);
  return true;
});

export function beginCottonCandy(state, player) {
  const cards = psycheCards(player);
  if (!cards.length) {
    requestChooseTile(state, {
      allowedIds: ["candy-mountain"].filter((id) => landscapeById(state, id)?.revealed),
      action: "movePlayer",
      playerId: player.id,
      title: "Cotton Candy",
      detail: "Move to Candy Mountain.",
    });
    drawPsycheForPlayer(state, player, 3);
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "cotton-candy",
    title: "Cotton Candy",
    message: "Discard 1 Psyche to draw up to its value?",
    choices: [
      ...cards.map((c) => ({ id: c.instanceId, label: `Discard ${c.name} (${c.value || 0})` })),
      { id: "skip", label: "Don't discard" },
    ],
    payload: { cardIds: cards.map((c) => c.instanceId) },
  });
}

registerEffectResolver("cotton-candy", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  state.pendingEffectChoice = null;
  if (!player) return false;
  if (choiceId !== "skip") {
    const card = psycheCards(player).find((c) => c.instanceId === choiceId);
    if (player && card) {
      discardPsyche(state, player, [card]);
      drawPsycheForPlayer(state, player, card.value || 1);
    }
  }
  if (player) {
    requestChooseTile(state, {
      allowedIds: ["candy-mountain"].filter((id) => landscapeById(state, id)?.revealed),
      action: "movePlayer",
      playerId: player.id,
      title: "Cotton Candy",
      detail: "Move to Candy Mountain.",
    });
    drawPsycheForPlayer(state, player, 3);
  }
  return true;
});

export function beginImStillDreaming(state, player) {
  discardPsyche(state, player, psycheCards(player).slice(0, 2));
  requestChooseTile(state, {
    allowedIds: ["insanity", "day-in-the-life"].filter((id) => landscapeById(state, id)?.revealed),
    action: "movePlayer",
    playerId: player.id,
    title: "I'm Still Dreaming",
    detail: "Move to Insanity or Day in the Life.",
  });
}

function offerWayOutDeck(state, player) {
  const left = state._wayOutFlips || 0;
  if (left <= 0 || !player) return;
  offerEffectChoice(state, player, {
    cardId: "a-way-out-forms",
    title: "A Way Out Forms",
    message: `Choose a deck to flip (${left} left).`,
    choices: deckFlipChoices(),
    payload: { step: "flip" },
  });
}

export function beginWayOut(state, player, event) {
  const extra = countAffectedLandscapes(state, event);
  const hand = psycheCards(player);
  if (!hand.length) {
    addLog(state, "A Way Out Forms: no Psyche to discard.");
    return;
  }
  offerEffectChoice(state, player, {
    cardId: "a-way-out-forms",
    title: "A Way Out Forms",
    message: `Discard 1 Psyche. You may discard up to ${extra} more to flip that many deck tops.`,
    ui: "spend",
    cards: hand,
    needCount: 1,
    maxCount: 1 + extra,
  });
}

registerEffectResolver("a-way-out-forms", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (!player) {
    state.pendingEffectChoice = null;
    return false;
  }
  if (pending.payload?.step === "flip") {
    state.pendingEffectChoice = null;
    flipDeckByKey(state, choiceId);
    state._wayOutFlips = Math.max(0, (state._wayOutFlips || 1) - 1);
    if (state._wayOutFlips > 0) offerWayOutDeck(state, player);
    return true;
  }
  if (toggleSpend(pending, choiceId)) return true;
  const selected = selectedFromSpend(player, pending);
  state.pendingEffectChoice = null;
  if (selected.length) discardPsyche(state, player, selected);
  const flips = Math.max(0, selected.length - 1);
  if (flips) {
    state._wayOutFlips = flips;
    offerWayOutDeck(state, player);
  }
  return true;
});

export function beginMistSwirls(state, player) {
  if (state.dreamDeck.length) discardDreamCard(state, state.dreamDeck.pop());
  addLog(state, "Mist Swirls: discarded 1 Dream.");
  const luc = player.dreamer?.lucidity ?? 0;
  if (luc < 3 || !psycheCards(player).length) return;
  offerEffectChoice(state, player, {
    cardId: "mist-swirls",
    title: "Mist Swirls",
    message: "Lucidity 3+: discard 1 Psyche to Reveal Persona+1 Landscapes?",
    choices: [
      { id: "yes", label: "Discard 1 Psyche and reveal" },
      { id: "no", label: "Keep your Psyche" },
    ],
  });
}

registerEffectResolver("mist-swirls", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (pending?.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    if (player && card) discardPsyche(state, player, [card]);
    beginFreeRevealPicking(state, alive(state).length + 1);
    return true;
  }
  state.pendingEffectChoice = null;
  if (choiceId === "yes" && player) {
    const hand = psycheCards(player);
    if (hand.length === 1) {
      discardPsyche(state, player, hand);
      beginFreeRevealPicking(state, alive(state).length + 1);
      return true;
    }
    offerEffectChoice(state, player, {
      cardId: "mist-swirls",
      ui: "cards",
      title: "Mist Swirls",
      message: "Discard 1 Psyche.",
      cards: hand,
    });
    return true;
  }
  return true;
});

export function beginThisWillHaveToDo(state, player) {
  const ela = player.dreamer?.elasticity ?? 0;
  const legal = psycheCards(player).filter((c) => (c.value || 0) <= ela);
  offerEffectChoice(state, player, {
    cardId: "this-will-have-to-do",
    title: "This Will Have to Do",
    message: `May discard 1 Psyche (value ≤ Elasticity ${ela}) to Draw 2 Psyche.`,
    choices: [
      { id: "discard", label: "Discard 1 Psyche and Draw 2", disabled: !legal.length },
      { id: "skip", label: "Skip" },
    ],
  });
}

registerEffectResolver("this-will-have-to-do", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  if (pending?.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    if (player && card) {
      discardPsyche(state, player, [card]);
      const n = drawPsycheForPlayer(state, player, 2);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
    }
    return true;
  }
  state.pendingEffectChoice = null;
  if (choiceId === "discard" && player) {
    const ela = player.dreamer?.elasticity ?? 0;
    const legal = psycheCards(player).filter((c) => (c.value || 0) <= ela);
    if (legal.length === 1) {
      discardPsyche(state, player, legal);
      const n = drawPsycheForPlayer(state, player, 2);
      recordQuestEvent(state, "draw_psyche", { count: n.length });
      return true;
    }
    offerEffectChoice(state, player, {
      cardId: "this-will-have-to-do",
      ui: "cards",
      title: "This Will Have to Do",
      message: "Discard 1 Psyche with value up to your Elasticity.",
      cards: legal,
    });
  }
  return true;
});

export function beginIRemember(state, player) {
  const wp = player.dreamer?.willpower ?? 0;
  const legal = psycheCards(player).filter((c) => (c.value || 0) <= wp);
  offerEffectChoice(state, player, {
    cardId: "i-remember",
    title: "I Remember!",
    message: `Return ${wp} cards. You may discard 1 Psyche (value ≤ Willpower) to Return 1 more.`,
    choices: [
      { id: "discard", label: `Discard 1 Psyche and Return ${wp + 1}`, disabled: !legal.length },
      { id: "skip", label: `Skip discard (Return ${wp})` },
    ],
    payload: { wp },
  });
}

registerEffectResolver("i-remember", (state, choiceId) => {
  const pending = state.pendingEffectChoice;
  const player = playerById(state, pending?.playerId);
  const wp = pending?.payload?.wp ?? player?.dreamer?.willpower ?? 0;
  if (pending?.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    state.pendingEffectChoice = null;
    if (player && card) discardPsyche(state, player, [card]);
    returnN(state, wp + 1, player);
    return true;
  }
  state.pendingEffectChoice = null;
  if (choiceId === "discard" && player) {
    const legal = psycheCards(player).filter((c) => (c.value || 0) <= wp);
    if (legal.length === 1) {
      discardPsyche(state, player, legal);
      returnN(state, wp + 1, player);
      return true;
    }
    offerEffectChoice(state, player, {
      cardId: "i-remember",
      ui: "cards",
      title: "I Remember!",
      message: "Discard 1 Psyche with value up to your Willpower.",
      cards: legal,
      payload: { wp },
    });
    return true;
  }
  returnN(state, wp, player);
  return true;
});

export function beginNoOne(state, player) {
  const wp = player.dreamer?.willpower ?? 0;
  const encounters = allEncountersOnBoard(state);
  if (wp >= 3 && encounters.length) {
    offerEffectChoice(state, player, {
      cardId: "no-one",
      title: "No One",
      message: "Willpower 3+: discard 1 Encounter instead of all.",
      choices: encounters.map(({ tile, encounter }) => ({
        id: `${tile.id}:${encounterKey(encounter)}`,
        label: `${encounter.name} on ${tile.name}`,
      })),
    });
    return;
  }
  encounters.forEach(({ tile, encounter }) => {
    repressCard(state, encounter);
    removeEncounterFromLandscape(state, tile.id, encounter);
  });
  addLog(state, "No One: all active Encounters discarded.");
}

registerEffectResolver("no-one", (state, choiceId) => {
  state.pendingEffectChoice = null;
  const [tileId, encKey] = String(choiceId).split(":");
  const tile = landscapeById(tileId);
  const encounter = tileEncounters(tile).find((enc) => encounterKey(enc) === encKey);
  if (encounter) {
    addLog(state, `No One: discarded ${encounter.name}.`);
    repressCard(state, encounter);
    removeEncounterFromLandscape(state, tileId, encounter);
  }
  return true;
});

void uid;
void shuffle;
