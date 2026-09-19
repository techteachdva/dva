import {
  addLog,
  drawPsycheForPlayer,
  landscapeById,
  acquireArchetype,
  setEncounterOnLandscape,
} from "./state.js";
import { recordQuestEvent } from "./quests.js";
import { logMoment } from "./narrator.js";
import { repressCard } from "./subconscious.js";
import { discardToMindstream, encounterFromDreambeastCard } from "./mindstream-supply.js";
import { adjacentTiles, hexDistance, edgeLandscapes } from "./hex.js";
import { uid } from "./data.js";
import { recordCancellableDiscard } from "./dreamer-powers.js";

let lastHelpers = null;

export function rememberDreamHelpers(helpers) {
  if (helpers) lastHelpers = helpers;
  return lastHelpers;
}

function helpers(h = null) {
  return rememberDreamHelpers(h);
}

function alive(state) {
  return state.players.filter((p) => p.alive);
}

function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

function tileName(state, id) {
  return landscapeById(state, id)?.name || id;
}

function psycheCards(player) {
  return (player.hand || []).filter((c) => c.type !== "psyche-power" && c.type !== "object");
}

function willpowerCards(player) {
  return psycheCards(player).filter((c) => c.suit === "willpower");
}

function discardPsyche(state, player, cards) {
  cards.forEach((card) => {
    player.hand = player.hand.filter((c) => c.instanceId !== card.instanceId);
    state.psycheDiscard.push(card);
  });
  if (cards.length) {
    recordQuestEvent(state, "discard_psyche", { count: cards.length, landscapeId: player.landscapeId });
    recordCancellableDiscard(state, player, cards[cards.length - 1], "dream");
  }
}

function discardObjects(state, player, cards) {
  cards.forEach((card) => {
    player.objects = (player.objects || []).filter((c) => c.instanceId !== card.instanceId);
    discardToMindstream(state, card);
  });
}

function repressObjects(state, player, cards) {
  cards.forEach((card) => {
    player.objects = (player.objects || []).filter((c) => c.instanceId !== card.instanceId);
    repressCard(state, card);
  });
}

function offer(state, player, spec) {
  state.pendingDreamChoice = {
    ui: spec.ui || "choice",
    dreamId: spec.dreamId,
    playerId: player.id,
    step: spec.step || "choice",
    title: spec.title,
    message: spec.message,
    choices: spec.choices || [],
    cards: spec.cards || [],
    need: spec.need || 0,
    needCount: spec.needCount,
    maxCount: spec.maxCount,
    order: spec.order || [],
    payload: spec.payload || {},
  };
  logMoment(state, spec.log || `${spec.title} — choose an option.`);
}

function queuePlayers(state, dreamId, players, extra = {}) {
  state.pendingDreamQueue = [
    ...(state.pendingDreamQueue || []),
    ...players.map((p) => ({ dreamId, playerId: p.id, ...extra })),
  ];
}

export function advanceDreamQueue(state) {
  if (state.pendingDreamChoice || state.landscapePick) return;
  const next = (state.pendingDreamQueue || []).shift();
  if (!next) return;
  presentQueued(state, next);
}

function presentQueued(state, item) {
  const player = playerById(state, item.playerId);
  if (!player?.alive) {
    advanceDreamQueue(state);
    return;
  }
  const presenters = {
    mortality: presentMortality,
    bargaining: presentBargaining,
    temptation: presentTemptation,
    responsibility: presentResponsibility,
    misplaced: presentMisplaced,
    circadia: presentCircadia,
    "pineal-purge": presentPinealPurge,
    somnambulance: presentSomnambulance,
    abandonment: presentAbandonment,
    chase: presentChase,
    powerlessness: presentPowerlessness,
  };
  const fn = presenters[item.dreamId];
  if (fn) fn(state, player, item);
  else advanceDreamQueue(state);
}

function destChoices(state, tiles) {
  return tiles.map((t) => ({
    id: t.id,
    label: t.name,
    hint: `Move to ${t.name}.`,
  }));
}

export function beginMortalityChoices(state) {
  queuePlayers(state, "mortality", alive(state));
  advanceDreamQueue(state);
}

function presentMortality(state, player) {
  const hand = psycheCards(player);
  const objs = player.objects || [];
  const canPsyche = hand.length >= 5;
  const canObjects = objs.length >= 3;
  if (!canPsyche && !canObjects) {
    if (hand.length) discardPsyche(state, player, hand);
    if (objs.length) discardObjects(state, player, objs);
    addLog(state, `${player.name} pays Mortality with what they have.`);
    advanceDreamQueue(state);
    return;
  }
  if (canPsyche && !canObjects) {
    offer(state, player, {
      dreamId: "mortality",
      ui: "spend",
      step: "pay-psyche",
      title: "Mortality",
      message: `${player.name}: discard 5 Psyche.`,
      cards: hand,
      needCount: 5,
      log: `${player.name} must discard 5 Psyche.`,
    });
    return;
  }
  if (!canPsyche && canObjects) {
    offer(state, player, {
      dreamId: "mortality",
      ui: "spend",
      step: "pay-objects",
      title: "Mortality",
      message: `${player.name}: discard 3 Objects.`,
      cards: objs,
      needCount: 3,
      log: `${player.name} must discard 3 Objects.`,
    });
    return;
  }
  offer(state, player, {
    dreamId: "mortality",
    title: "Mortality",
    message: `${player.name}: discard 5 Psyche or 3 Objects.`,
    choices: [
      { id: "psyche", label: "Discard 5 Psyche", hint: `${hand.length} Psyche in hand.` },
      { id: "objects", label: "Discard 3 Objects", hint: `${objs.length} Object(s) in hand.` },
    ],
  });
}

export function beginBargainingChoices(state) {
  queuePlayers(state, "bargaining", alive(state));
  advanceDreamQueue(state);
}

function presentBargaining(state, player) {
  const arch = state.activeArchetype;
  const hand = psycheCards(player);
  const stats = {
    lucidity: player.dreamer.lucidity ?? 0,
    elasticity: player.dreamer.elasticity ?? 0,
    willpower: player.dreamer.willpower ?? 0,
  };
  const suit = Object.entries(stats).sort((a, b) => b[1] - a[1])[0][0];
  if (!arch || hand.length < 6 || arch.suit !== suit) {
    addLog(state, `${player.name} cannot bargain (need 6 Psyche and a matching Archetype).`);
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "bargaining",
    title: "Bargaining",
    message: `${player.name} may discard 6 Psyche to Acquire ${arch.name} (matching suit — quests need not be complete).`,
    choices: [
      { id: "bargain", label: `Discard 6 Psyche`, hint: `Toward ${arch.name}.` },
      { id: "skip", label: "Decline", hint: "Keep your Psyche." },
    ],
  });
}

export function beginTemptationChoices(state) {
  queuePlayers(state, "temptation", alive(state));
  advanceDreamQueue(state);
}

function presentTemptation(state, player) {
  const objs = player.objects || [];
  const max = Math.min(3, objs.length);
  if (!max) {
    addLog(state, `${player.name} has no Objects to tempt.`);
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "temptation",
    title: "Temptation",
    message: `${player.name} may discard up to ${max} Object(s) to Draw that many Psyche.`,
    choices: [
      { id: "0", label: "Keep Objects", hint: "Draw nothing." },
      ...Array.from({ length: max }, (_, i) => ({
        id: String(i + 1),
        label: `Discard ${i + 1}`,
        hint: `Draw ${i + 1} Psyche.`,
      })),
    ],
  });
}

export function beginResponsibilityChoices(state) {
  queuePlayers(state, "responsibility", alive(state), { need: alive(state).length });
  advanceDreamQueue(state);
}

function presentResponsibility(state, player, item) {
  const n = item.need || alive(state).length;
  const hand = psycheCards(player);
  const wp = willpowerCards(player);
  const wpSum = wp.reduce((s, c) => s + (c.value || 0), 0);
  if (!hand.length) {
    addLog(state, `${player.name} has no Psyche for Responsibility.`);
    advanceDreamQueue(state);
    return;
  }
  const choices = [
    {
      id: "any",
      label: `Discard ${Math.min(n, hand.length)} Psyche`,
      hint: "Any Psyche cards.",
    },
  ];
  if (wpSum >= n) {
    choices.unshift({
      id: "willpower",
      label: `Pay Willpower totaling ${n}`,
      hint: "Keep the rest of your hand.",
    });
  }
  offer(state, player, {
    dreamId: "responsibility",
    title: "Responsibility",
    message: `${player.name}: discard ${n} Psyche, or Willpower Psyche totaling ${n}.`,
    choices,
    payload: { need: n },
  });
}

export function beginMisplacedChoices(state) {
  queuePlayers(state, "misplaced", alive(state).filter((p) => (p.objects || []).length));
  advanceDreamQueue(state);
}

function presentMisplaced(state, player) {
  const objs = player.objects || [];
  const wp = willpowerCards(player);
  if (!objs.length) {
    advanceDreamQueue(state);
    return;
  }
  if (!wp.length) {
    repressObjects(state, player, objs);
    addLog(state, `${player.name} Represses ${objs.length} Object(s) (no Willpower Psyche to save them).`);
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "misplaced",
    ui: "spend",
    step: "save-objects",
    title: "Misplaced",
    message: `${player.name}: discard 1 Willpower Psyche per Object you want to keep. Unsaved Objects are Repressed.`,
    cards: wp,
    needCount: 0,
    maxCount: Math.min(wp.length, objs.length),
    log: `${player.name} chooses how many Objects to save.`,
  });
}

export function beginCircadiaChoices(state) {
  queuePlayers(state, "circadia", alive(state));
  advanceDreamQueue(state);
}

function presentCircadia(state, player) {
  const pool = [...(state.psycheDiscard || [])];
  if (!pool.length) {
    addLog(state, `${player.name} finds no Psyche in Discard.`);
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "circadia",
    ui: "spend",
    step: "draw-discard",
    title: "Circadia",
    message: `${player.name}: take up to 4 Psyche from Discard.`,
    cards: [...pool].reverse(),
    needCount: 0,
    maxCount: Math.min(4, pool.length),
    log: `${player.name} may draw from Discard.`,
  });
}

export function beginPinealPurgeChoices(state) {
  queuePlayers(state, "pineal-purge", alive(state));
  advanceDreamQueue(state);
}

function presentPinealPurge(state, player) {
  const hand = psycheCards(player);
  if (!hand.length) {
    addLog(state, `${player.name} has no Psyche to purge.`);
    advanceDreamQueue(state);
    return;
  }
  const n = Math.min(3, hand.length);
  offer(state, player, {
    dreamId: "pineal-purge",
    ui: "spend",
    step: "discard-three",
    title: "Pineal Purge",
    message: `${player.name}: discard ${n} Psyche.`,
    cards: hand,
    needCount: n,
    log: `${player.name} chooses ${n} Psyche to discard.`,
  });
}

export function beginSomnambulanceChoices(state) {
  queuePlayers(state, "somnambulance", alive(state));
  advanceDreamQueue(state);
}

function presentSomnambulance(state, player) {
  const dests = adjacentTiles(state, player.landscapeId).filter((t) => t.revealed);
  if (!dests.length) {
    addLog(state, `${player.name} has no revealed Landscape to walk to.`);
    advanceDreamQueue(state);
    return;
  }
  if (dests.length === 1) {
    player.landscapeId = dests[0].id;
    addLog(state, `${player.name} moves to ${dests[0].name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "somnambulance",
    title: "Somnambulance",
    message: `${player.name}: move 1 Landscape.`,
    choices: destChoices(state, dests),
  });
}

export function beginAbandonmentMoves(state) {
  const grouped = {};
  alive(state).forEach((p) => {
    (grouped[p.landscapeId] ||= []).push(p);
  });
  const movers = [];
  Object.entries(grouped).forEach(([landId, players]) => {
    if (players.length < 2) return;
    players.forEach((p) => movers.push({ dreamId: "abandonment", playerId: p.id, fromId: landId }));
  });
  state.pendingDreamQueue = [...(state.pendingDreamQueue || []), ...movers];
  advanceDreamQueue(state);
}

function presentAbandonment(state, player, item) {
  const empty = adjacentTiles(state, item.fromId || player.landscapeId).filter(
    (t) => t.revealed && !alive(state).some((x) => x.landscapeId === t.id && x.id !== player.id),
  );
  if (!empty.length) {
    addLog(state, `${player.name} has no empty adjacent Landscape.`);
    advanceDreamQueue(state);
    return;
  }
  if (empty.length === 1) {
    player.landscapeId = empty[0].id;
    addLog(state, `${player.name} abandons to ${empty[0].name}.`);
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "abandonment",
    title: "Abandonment",
    message: `${player.name}: move to an adjacent empty Landscape.`,
    choices: destChoices(state, empty),
  });
}

export function beginChaseEscapeChoices(state, spawnHelpers) {
  rememberDreamHelpers(spawnHelpers);
  alive(state).forEach((p) => {
    spawnHelpers.spawnEncounter(state, p.landscapeId);
  });
  state.chaseDream = true;
  state.chaseTrapped = [];
  queuePlayers(state, "chase", alive(state).filter((p) => (p.dreamer.elasticity ?? 0) > (p.dreamer.willpower ?? 0)));
  alive(state).forEach((p) => {
    if ((p.dreamer.elasticity ?? 0) <= (p.dreamer.willpower ?? 0)) {
      state.chaseTrapped.push(p.id);
    }
  });
  if (state.pendingDreamQueue?.length) {
    addLog(state, "Chase: Dreamers who can outrun may escape or stay to Meet.");
  } else {
    addLog(state, "Chase: Dreamers who cannot outrun must Meet this round.");
  }
  advanceDreamQueue(state);
}

function presentChase(state, player) {
  offer(state, player, {
    dreamId: "chase",
    title: "Chase",
    message: `${player.name}: Elasticity exceeds Willpower. Escape this Encounter, or stay and Meet?`,
    choices: [
      { id: "escape", label: "Escape", hint: "You may act normally this round." },
      { id: "stay", label: "Stay and Meet", hint: "Meet is your only action this round." },
    ],
  });
}

export function beginJudgementChoice(state, spawnHelpers) {
  rememberDreamHelpers(spawnHelpers);
  const targets = ["sea-of-teeth", "endless-ocean"]
    .map((id) => landscapeById(state, id))
    .filter((t) => t?.revealed);
  const fallback = state.board.find((t) => t.revealed && !t.center);
  if (!targets.length && !fallback) {
    addLog(state, "Judgement finds no Landscape for Leviathan.");
    return;
  }
  if (targets.length <= 1) {
    awakenLeviathan(state, (targets[0] || fallback).id);
    return;
  }
  const head = alive(state)[0];
  offer(state, head, {
    dreamId: "judgement",
    title: "Judgement",
    message: "Awaken Leviathan on Sea of Teeth or Endless Ocean.",
    choices: destChoices(state, targets),
  });
}

function awakenLeviathan(state, tileId) {
  const spawnTile = landscapeById(state, tileId);
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
    .filter((t) => t.revealed && alive(state).some((p) => p.landscapeId === t.id))
    .sort((a, b) => hexDistance(a, spawnTile) - hexDistance(b, spawnTile))[0];
  if (occupied && occupied.id !== spawnTile.id) {
    spawnTile.encounter = null;
    setEncounterOnLandscape(state, occupied.id, leviathan);
    addLog(state, `Judgement awakens Leviathan on ${occupied.name}!`);
  } else {
    addLog(state, `Judgement awakens Leviathan on ${spawnTile.name}!`);
  }
}

export function beginPowerlessnessChoices(state, spawnHelpers) {
  rememberDreamHelpers(spawnHelpers);
  const edges = edgeLandscapes(state).filter(
    (t) => t.revealed && !t.wasteland,
  );
  const n = alive(state).length;
  if (!edges.length || !n) {
    addLog(state, "Powerlessness finds no revealed edge Landscapes.");
    return;
  }
  if (edges.length <= n) {
    edges.forEach((tile) => spawnHelpers.spawnEncounter(state, tile.id));
    addLog(state, "Powerlessness: Encounters spawn on edge Landscapes.");
    return;
  }
  state.pendingDreamQueue = [
    ...(state.pendingDreamQueue || []),
    ...Array.from({ length: n }, () => ({ dreamId: "powerlessness", playerId: alive(state)[0].id })),
  ];
  addLog(state, "Powerlessness: choose an edge Landscape for each Encounter.");
  advanceDreamQueue(state);
}

function presentPowerlessness(state, player) {
  const edges = edgeLandscapes(state).filter(
    (t) => t.revealed && !t.wasteland,
  );
  if (!edges.length) {
    advanceDreamQueue(state);
    return;
  }
  if (edges.length === 1) {
    helpers().spawnEncounter?.(state, edges[0].id);
    advanceDreamQueue(state);
    return;
  }
  offer(state, player, {
    dreamId: "powerlessness",
    title: "Powerlessness",
    message: "Choose an unoccupied edge Landscape for this Encounter.",
    choices: destChoices(state, edges),
  });
}

export function beginTransformationPick(state, landscapeId, first, second) {
  const head = alive(state)[0];
  if (!second) {
    const beast = encounterFromDreambeastCard(first.card);
    setEncounterOnLandscape(state, landscapeId, beast);
    addLog(state, `${beast.name} appears on ${tileName(state, landscapeId)}!`);
    return beast;
  }
  offer(state, head || { id: "p0" }, {
    dreamId: "transformation",
    ui: "cards",
    step: "pick-beast",
    title: "Transformation",
    message: "Draw the top 2 Encounters and pick 1.",
    cards: [first.card, second.card],
    payload: { landscapeId, first, second },
    log: "Transformation: pick 1 Encounter. The other returns to its Mindstream.",
  });
  return null;
}

function selectedCards(pending) {
  const ids = new Set(pending.order || []);
  return (pending.cards || []).filter((c) => ids.has(c.instanceId));
}

export function resolveDreamChoice(state, choiceId, h = null) {
  const pending = state.pendingDreamChoice;
  if (!pending) return false;
  rememberDreamHelpers(h);
  const player = playerById(state, pending.playerId);
  const dreamId = pending.dreamId;
  const step = pending.step;

  if (pending.ui === "spend") {
    if (choiceId !== "confirm") {
      const card = (pending.cards || []).find((c) => c.instanceId === choiceId);
      if (!card) return false;
      const order = pending.order || [];
      const max = pending.maxCount;
      if (order.includes(choiceId)) {
        pending.order = order.filter((id) => id !== choiceId);
      } else if (max == null || order.length < max) {
        pending.order = [...order, choiceId];
      }
      return true;
    }
    const picked = selectedCards(pending);
    const needCount = pending.needCount;
    if (needCount != null && picked.length < needCount) return false;
    if (pending.need && needCount == null) {
      const sum = picked.reduce((s, c) => s + (c.value || 0), 0);
      if (sum < pending.need) return false;
    }
    state.pendingDreamChoice = null;
    applySpend(state, player, dreamId, step, picked, pending);
    advanceDreamQueue(state);
    return true;
  }

  if (pending.ui === "cards") {
    const card = (pending.cards || []).find((c) => (c.instanceId || c.id) === choiceId);
    if (!card) return false;
    state.pendingDreamChoice = null;
    if (dreamId === "transformation") {
      finishTransformation(state, card, pending.payload);
    }
    advanceDreamQueue(state);
    return true;
  }

  const choice = (pending.choices || []).find((c) => c.id === choiceId);
  if (!choice || choice.disabled) return false;
  state.pendingDreamChoice = null;

  if (dreamId === "mortality") {
    if (choiceId === "psyche") {
      offer(state, player, {
        dreamId: "mortality",
        ui: "spend",
        step: "pay-psyche",
        title: "Mortality",
        message: `${player.name}: discard 5 Psyche.`,
        cards: psycheCards(player),
        needCount: 5,
      });
      return true;
    }
    if (choiceId === "objects") {
      offer(state, player, {
        dreamId: "mortality",
        ui: "spend",
        step: "pay-objects",
        title: "Mortality",
        message: `${player.name}: discard 3 Objects.`,
        cards: player.objects || [],
        needCount: 3,
      });
      return true;
    }
  }

  if (dreamId === "bargaining") {
    if (choiceId === "skip") {
      addLog(state, `${player.name} declines the bargain.`);
      advanceDreamQueue(state);
      return true;
    }
    offer(state, player, {
      dreamId: "bargaining",
      ui: "spend",
      step: "pay-six",
      title: "Bargaining",
      message: `${player.name}: discard 6 Psyche.`,
      cards: psycheCards(player),
      needCount: 6,
    });
    return true;
  }

  if (dreamId === "temptation") {
    const n = parseInt(choiceId, 10) || 0;
    if (!n) {
      addLog(state, `${player.name} keeps their Objects.`);
      advanceDreamQueue(state);
      return true;
    }
    offer(state, player, {
      dreamId: "temptation",
      ui: "spend",
      step: "discard-objects",
      title: "Temptation",
      message: `${player.name}: discard ${n} Object(s).`,
      cards: player.objects || [],
      needCount: n,
    });
    return true;
  }

  if (dreamId === "responsibility") {
    const n = pending.payload?.need || alive(state).length;
    if (choiceId === "willpower") {
      offer(state, player, {
        dreamId: "responsibility",
        ui: "spend",
        step: "pay-willpower",
        title: "Responsibility",
        message: `${player.name}: discard Willpower Psyche totaling ${n}.`,
        cards: willpowerCards(player),
        need: n,
      });
      return true;
    }
    offer(state, player, {
      dreamId: "responsibility",
      ui: "spend",
      step: "pay-any",
      title: "Responsibility",
      message: `${player.name}: discard ${n} Psyche.`,
      cards: psycheCards(player),
      needCount: Math.min(n, psycheCards(player).length),
    });
    return true;
  }

  if (dreamId === "somnambulance" || dreamId === "abandonment") {
    if (landscapeById(state, choiceId)) {
      player.landscapeId = choiceId;
      addLog(state, `${player.name} moves to ${tileName(state, choiceId)}.`);
      recordQuestEvent(state, "move_player", { count: 1 });
    }
    advanceDreamQueue(state);
    return true;
  }

  if (dreamId === "chase") {
    if (choiceId === "stay") {
      if (!state.chaseTrapped.includes(player.id)) state.chaseTrapped.push(player.id);
      addLog(state, `${player.name} stays to Meet.`);
    } else {
      state.chaseTrapped = (state.chaseTrapped || []).filter((id) => id !== player.id);
      addLog(state, `${player.name} escapes the Chase.`);
    }
    advanceDreamQueue(state);
    return true;
  }

  if (dreamId === "judgement") {
    awakenLeviathan(state, choiceId);
    advanceDreamQueue(state);
    return true;
  }

  if (dreamId === "powerlessness") {
    helpers().spawnEncounter?.(state, choiceId);
    advanceDreamQueue(state);
    return true;
  }

  advanceDreamQueue(state);
  return true;
}

function applySpend(state, player, dreamId, step, picked, pending) {
  if (dreamId === "mortality" && step === "pay-psyche") {
    discardPsyche(state, player, picked);
    addLog(state, `${player.name} discards ${picked.length} Psyche (Mortality).`);
    return;
  }
  if (dreamId === "mortality" && step === "pay-objects") {
    discardObjects(state, player, picked);
    addLog(state, `${player.name} discards ${picked.length} Object(s) (Mortality).`);
    return;
  }
  if (dreamId === "bargaining" && step === "pay-six") {
    discardPsyche(state, player, picked);
    const arch = state.activeArchetype;
    const stats = {
      lucidity: player.dreamer.lucidity ?? 0,
      elasticity: player.dreamer.elasticity ?? 0,
      willpower: player.dreamer.willpower ?? 0,
    };
    const suit = Object.entries(stats).sort((a, b) => b[1] - a[1])[0][0];
    if (arch && arch.suit === suit && acquireArchetype(state, player, undefined, { skipQuestCheck: true })) {
      addLog(state, `${player.name} bargains for ${arch.name}.`);
    } else if (arch && arch.suit === suit) {
      addLog(state, `${player.name} discards 6 Psyche but could not acquire ${arch.name}.`);
    } else {
      addLog(state, `${player.name} discards 6 Psyche (no matching Active Archetype).`);
    }
    return;
  }
  if (dreamId === "temptation" && step === "discard-objects") {
    discardObjects(state, player, picked);
    const drawn = drawPsycheForPlayer(state, player, picked.length);
    recordQuestEvent(state, "draw_psyche", { count: drawn.length });
    addLog(state, `${player.name} discards ${picked.length} Object(s) and Draws ${drawn.length} Psyche.`);
    return;
  }
  if (dreamId === "responsibility" && step === "pay-willpower") {
    const n = pending.payload?.need || pending.need || 0;
    const sum = picked.reduce((s, c) => s + (c.value || 0), 0);
    if (sum < n) {
      addLog(state, `${player.name} still needs Willpower totaling ${n}.`);
      return;
    }
    discardPsyche(state, player, picked);
    addLog(state, `${player.name} pays Willpower totaling ${n}.`);
    return;
  }
  if (dreamId === "responsibility" && step === "pay-any") {
    discardPsyche(state, player, picked);
    addLog(state, `${player.name} discards ${picked.length} Psyche (Responsibility).`);
    return;
  }
  if (dreamId === "misplaced" && step === "save-objects") {
    discardPsyche(state, player, picked);
    const saved = picked.length;
    const objs = player.objects || [];
    if (!saved) {
      repressObjects(state, player, objs);
      addLog(state, `${player.name} Represses ${objs.length} Object(s).`);
      return;
    }
    if (saved >= objs.length) {
      addLog(state, `${player.name} saves all Objects with Willpower Psyche.`);
      return;
    }
    offer(state, player, {
      dreamId: "misplaced",
      ui: "spend",
      step: "keep-objects",
      title: "Misplaced",
      message: `${player.name}: choose ${saved} Object(s) to keep. The rest are Repressed.`,
      cards: objs,
      needCount: saved,
    });
    return;
  }
  if (dreamId === "misplaced" && step === "keep-objects") {
    const keep = new Set(picked.map((c) => c.instanceId));
    const rest = (player.objects || []).filter((o) => !keep.has(o.instanceId));
    repressObjects(state, player, rest);
    addLog(state, `${player.name} saves ${picked.length} Object(s) and Represses ${rest.length}.`);
    return;
  }
  if (dreamId === "circadia" && step === "draw-discard") {
    picked.forEach((card) => {
      state.psycheDiscard = state.psycheDiscard.filter((c) => c.instanceId !== card.instanceId);
      player.hand.push(card);
    });
    if (picked.length) recordQuestEvent(state, "draw_psyche", { count: picked.length });
    addLog(state, `${player.name} draws ${picked.length} Psyche from Discard.`);
    return;
  }
  if (dreamId === "pineal-purge" && step === "discard-three") {
    discardPsyche(state, player, picked);
    addLog(state, `${player.name} discards ${picked.length} Psyche (Pineal Purge).`);
  }
}

function finishTransformation(state, picked, payload) {
  const { landscapeId, first, second } = payload || {};
  const pickKey = picked.instanceId || picked.id;
  const chosen = (first.card.instanceId || first.card.id) === pickKey ? first : second;
  const other = chosen === first ? second : first;
  const beast = encounterFromDreambeastCard(chosen.card);
  setEncounterOnLandscape(state, landscapeId, beast);
  if (other?.suit && other.card) {
    state.mindstreamDecks[other.suit].push(other.card);
  }
  addLog(state, `Transformation: ${beast.name} appears on ${tileName(state, landscapeId)}.`);
  state.pickEncounterOnSpawn = false;
}
