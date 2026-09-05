import {
  getPhase,
  activePlayer,
  headPlayer,
  addLog,
  drawPsyche,
  drawObject,
  advancePhase,
  completeQuest,
  acquireArchetype,
  checkDefeat,
  landscapeById,
  setEncounterOnLandscape,
  encounterOnLandscape,
} from "./state.js";
import { shuffle, uid } from "./data.js";

export function getPhaseActions(state, handlers) {
  const phase = getPhase(state);
  const player = activePlayer(state);
  const actions = [];
  const encounter = state.activeEncounter;
  const meetDisabled = !encounter || state.meetActions >= state.meetActionLimit;

  if (phase === "Reveal") {
    if (headPlayer(state) === player) {
      actions.push({
        label: "Head: Draw Dream Card",
        primary: true,
        disabled: state.revealUsed,
        onClick: handlers.drawDream,
      });
    }
    actions.push({
      label: "Reveal Landscape (Lucidity)",
      disabled: state.revealUsed,
      onClick: handlers.revealLandscape,
    });
    actions.push({
      label: "Next: Explore",
      onClick: handlers.nextPhase,
    });
  }

  if (phase === "Explore") {
    actions.push({
      label: "Move Dreamer (Elasticity)",
      disabled: state.exploreUsed,
      onClick: handlers.moveDreamer,
    });
    actions.push({
      label: "Next: Meet",
      onClick: handlers.nextPhase,
    });
  }

  if (phase === "Meet") {
    actions.push({
      label: "Gain Actions (Willpower)",
      disabled: state.meetActionLimit > 0,
      onClick: handlers.gainMeetActions,
    });
    if (encounter) {
      actions.push({
        label: `Accept ${encounter.name} (${encounter.accept})`,
        disabled: meetDisabled,
        onClick: () => handlers.meetEncounter("accept"),
      });
      actions.push({
        label: `Repress ${encounter.name} (${encounter.repress})`,
        disabled: meetDisabled,
        onClick: () => handlers.meetEncounter("repress"),
      });
    }
    actions.push({
      label: "Landscape Action",
      disabled: state.meetActions >= state.meetActionLimit,
      onClick: handlers.landscapeAction,
    });
    actions.push({
      label: "Draw Object",
      disabled: state.meetActions >= state.meetActionLimit,
      onClick: handlers.drawObjectAction,
    });
    actions.push({
      label: "Draw Mindstream Event",
      disabled: state.meetActions >= state.meetActionLimit,
      onClick: handlers.drawMindstreamAction,
    });
    actions.push({
      label: "Complete Quest (1 Power)",
      disabled: !state.activeArchetype,
      onClick: handlers.completeQuest,
    });
    actions.push({
      label: "Acquire Archetype",
      disabled: !state.activeArchetype?.questProgress?.every(Boolean),
      onClick: handlers.acquireArchetype,
    });
    actions.push({
      label: "Use Dreamer Power (1 Power)",
      onClick: handlers.useDreamerPower,
    });
    actions.push({
      label: "End Round",
      primary: true,
      onClick: handlers.nextPhase,
    });
  }

  return actions;
}

export function drawDreamCard(state, data, onShowModal) {
  if (state.revealUsed) return null;
  const head = headPlayer(state);
  if (activePlayer(state) !== head) {
    addLog(state, "Only the Head Dreamer draws the Dream card.");
    return null;
  }

  const card = state.dreamDeck.shift();
  if (!card) {
    checkDefeat(state);
    return null;
  }

  state.activeDream = card;
  state.revealUsed = true;
  addLog(state, `Dream drawn: ${card.name}. ${card.text || card.flavor || ""}`);

  if (card.type === "boss-dream" || card.boss) {
    const encounter = { ...card, type: "dreambeast", instanceId: uid("enc") };
    setEncounterOnLandscape(state, "bed", encounter);
    addLog(state, `${card.name} awakens on The Bed!`);
  } else if (card.id === "chase") {
    state.players.forEach((p) => {
      if (p.alive) spawnEncounterOnLandscape(state, p.landscapeId);
    });
  } else if (card.text?.toLowerCase().includes("spawn")) {
    spawnEncounterOnLandscape(state, state.selectedLandscapeId);
  }

  if (card.id === "you-never-wake") {
    state.status = "lost";
    addLog(state, card.text);
  }

  checkDefeat(state);
  if (onShowModal) onShowModal(card);
  return card;
}

export function revealLandscape(state) {
  const hidden = state.board.filter((l) => !l.revealed && !l.center);
  if (!hidden.length) {
    addLog(state, "No hidden Landscapes to reveal.");
    return;
  }
  const tile = hidden[0];
  tile.revealed = true;
  tile.wasteland = false;
  state.revealUsed = true;
  addLog(state, `Revealed ${tile.name}.`);
  if (Math.random() < 0.4) {
    spawnEncounterOnLandscape(state, tile.id);
  }
}

export function moveDreamer(state, targetLandscapeId) {
  const player = activePlayer(state);
  const from = landscapeById(state, player.landscapeId);
  const to = landscapeById(state, targetLandscapeId);
  if (!to || !to.revealed) {
    addLog(state, "Choose a revealed Landscape.");
    return;
  }

  player.landscapeId = targetLandscapeId;
  state.selectedLandscapeId = targetLandscapeId;
  state.exploreUsed = true;

  const localEncounter = encounterOnLandscape(state, targetLandscapeId);
  if (localEncounter) {
    state.activeEncounter = localEncounter;
    state.activeEncounterLandscapeId = targetLandscapeId;
    addLog(state, `${player.name} arrives at ${to.name} — ${localEncounter.name} awaits!`);
  }

  if (to.wasteland) {
    if (player.hand.length) {
      const discarded = player.hand.pop();
      state.psycheDiscard.push(discarded);
      addLog(state, `${player.name} lands on Wasteland and discards 1 Psyche.`);
    }
  } else {
    addLog(state, `${player.name} moves to ${to.name}.`);
  }
}

export function gainMeetActions(state) {
  const player = activePlayer(state);
  const will = player.dreamer.willpower + 1;
  const selectedValue = sumSelectedPsyche(state, player);
  if (selectedValue < 1) {
    state.meetActionLimit = Math.max(1, will);
    addLog(state, `${player.name} gains ${state.meetActionLimit} shared Meet Actions (+Willpower).`);
    return;
  }
  state.meetActionLimit = Math.min(2, selectedValue) + will;
  discardSelected(state, player);
  addLog(state, `${player.name} plays Psyche for ${state.meetActionLimit} Meet Actions.`);
}

function sumSelectedPsyche(state, player) {
  return player.hand
    .filter((c) => state.selectedHand.includes(c.instanceId))
    .reduce((sum, c) => sum + (c.value || 0), 0);
}

function discardSelected(state, player) {
  const keep = player.hand.filter((c) => !state.selectedHand.includes(c.instanceId));
  const discarded = player.hand.filter((c) => state.selectedHand.includes(c.instanceId));
  player.hand = keep;
  state.psycheDiscard.push(...discarded);
  state.selectedHand = [];
}

export function meetEncounter(state, mode = "accept") {
  if (!state.activeEncounter) return;
  const player = activePlayer(state);
  const encounter = state.activeEncounter;
  const needed = mode === "accept" ? encounter.accept : encounter.repress;
  const played = sumSelectedPsyche(state, player);

  if (played < needed) {
    addLog(state, `Need ${needed} Psyche to ${mode}. Selected: ${played}.`);
    return;
  }

  discardSelected(state, player);
  state.meetActions += 1;
  state.lastAction = mode;

  if (mode === "accept") {
    addLog(state, `${player.name} accepts ${encounter.name}! ${encounter.effect || ""}`);
    drawPsyche(state, 2);
    drawObject(state, player, 1);
  } else {
    addLog(state, `${player.name} represses ${encounter.name}. ${encounter.fail || ""}`);
    if (player.hand.length) {
      const repressed = player.hand.pop();
      state.psycheDiscard.push(repressed);
    }
  }

  const landscapeId = state.activeEncounterLandscapeId;
  if (landscapeId) {
    const tile = landscapeById(state, landscapeId);
    if (tile) tile.encounter = null;
  }
  state.activeEncounter = null;
  state.activeEncounterLandscapeId = null;
}

const LANDSCAPE_ACTIONS = {
  lucidity: (state, tile, player) => {
    const hidden = state.board.filter((l) => !l.revealed && !l.center);
    if (hidden.length) {
      hidden[0].revealed = true;
      hidden[0].wasteland = false;
      addLog(state, `Lucidity action: Revealed ${hidden[0].name}.`);
    } else {
      drawPsyche(state, 1);
      addLog(state, `Lucidity action on ${tile.name}: Draw 1 Psyche.`);
    }
  },
  elasticity: (state, tile, player) => {
    const adjacent = state.board.filter((l) => l.revealed && l.id !== tile.id);
    if (adjacent.length) {
      const target = adjacent[0];
      player.landscapeId = target.id;
      state.selectedLandscapeId = target.id;
      addLog(state, `Elasticity action: ${player.name} moves to ${target.name}.`);
    } else {
      drawPsyche(state, 1);
      addLog(state, `Elasticity action: Draw 1 Psyche.`);
    }
  },
  willpower: (state, tile, player) => {
    player.powerTokens += 1;
    drawPsyche(state, 1);
    addLog(state, `Willpower action on ${tile.name}: +1 Power, Draw 1 Psyche.`);
  },
};

export function landscapeAction(state) {
  const tile = landscapeById(state, state.selectedLandscapeId);
  if (!tile?.revealed) return;
  const player = activePlayer(state);
  state.meetActions += 1;
  state.lastAction = "landscape";

  const suit = tile.suit;
  if (suit && LANDSCAPE_ACTIONS[suit]) {
    LANDSCAPE_ACTIONS[suit](state, tile, player);
  } else {
    drawPsyche(state, 1);
    addLog(state, `Landscape Action on ${tile.name}: draw 1 Psyche.`);
  }
}

export function drawObjectAction(state) {
  const player = activePlayer(state);
  if (state.meetActions >= state.meetActionLimit) return;
  const drawn = drawObject(state, player, 1);
  state.meetActions += 1;
  if (drawn.length) {
    addLog(state, `${player.name} draws Object: ${drawn[0].name}.`);
  } else {
    addLog(state, "Object deck is empty.");
  }
}

export function drawMindstreamAction(state, onShowModal) {
  const player = activePlayer(state);
  if (state.meetActions >= state.meetActionLimit) return;
  const tile = landscapeById(state, state.selectedLandscapeId);
  let suit = tile?.suit;
  if (!suit) {
    const { lucidity, elasticity, willpower } = player.dreamer;
    if (lucidity >= elasticity && lucidity >= willpower) suit = "lucidity";
    else if (elasticity >= willpower) suit = "elasticity";
    else suit = "willpower";
  }
  const deck = state.mindstreamDecks[suit];
  if (!deck.length) {
    addLog(state, `${suit} Mindstream is empty.`);
    return;
  }
  const card = deck.shift();
  state.meetActions += 1;
  addLog(state, `${player.name} draws Mindstream (${suit}): ${card.name}. ${card.text}`);
  if (card.text?.toLowerCase().includes("spawn")) {
    spawnEncounterOnLandscape(state, state.selectedLandscapeId);
  }
  if (onShowModal) onShowModal(card);
}

export function useDreamerPower(state) {
  const player = activePlayer(state);
  if (player.powerTokens < 1) {
    addLog(state, "Need 1 Power Token.");
    return;
  }
  player.powerTokens -= 1;
  addLog(state, `${player.name} uses ${player.dreamer.name} power: ${player.dreamer.power}`);
  drawPsyche(state, 1);
}

export function spawnEncounterOnLandscape(state, landscapeId) {
  if (!state.dreambeastDeck.length) return null;
  const beast = state.dreambeastDeck.shift();
  const encounter = { ...beast, instanceId: uid("enc") };
  setEncounterOnLandscape(state, landscapeId, encounter);
  const tile = landscapeById(state, landscapeId);
  addLog(state, `${beast.name} appears on ${tile?.name || "the Dreamscape"}!`);
  return encounter;
}

export function spawnRandomEncounter(state) {
  const revealed = state.board.filter((l) => l.revealed && !l.encounter);
  if (!revealed.length) return;
  const tile = revealed[Math.floor(Math.random() * revealed.length)];
  return spawnEncounterOnLandscape(state, tile.id);
}

export function toggleHandCard(state, card) {
  const id = card.instanceId;
  if (state.selectedHand.includes(id)) {
    state.selectedHand = state.selectedHand.filter((x) => x !== id);
  } else if (state.selectedHand.length < 3) {
    state.selectedHand.push(id);
  }
}

export function handleQuestComplete(state, questIndex = 0) {
  completeQuest(state, questIndex, activePlayer(state));
}

export function handleAcquire(state) {
  acquireArchetype(state, activePlayer(state));
}

export function endPhase(state) {
  advancePhase(state);
  if (getPhase(state) === "Reveal") {
    const head = headPlayer(state);
    addLog(state, `${head.name} may draw the Dream card.`);
  }
  checkDefeat(state);
}

export function getDeckTop(state, deckId) {
  switch (deckId) {
    case "dream":
      return state.dreamDeck[0] || null;
    case "psyche":
      return state.psycheDeck[0] || null;
    case "archetype":
      return state.archetypeDeck[0] || null;
    case "object":
      return state.objectDeck[0] || null;
    case "dreambeast":
      return state.dreambeastDeck[0] || null;
    case "subconscious":
      return state.subconscious[state.subconscious.length - 1] || null;
    case "mindstream-lucidity":
      return state.mindstreamDecks.lucidity[0] || null;
    case "mindstream-elasticity":
      return state.mindstreamDecks.elasticity[0] || null;
    case "mindstream-willpower":
      return state.mindstreamDecks.willpower[0] || null;
    default:
      return null;
  }
}
