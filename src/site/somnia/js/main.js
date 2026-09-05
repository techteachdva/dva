import { loadGameData } from "./data.js";
import { createInitialState, drawPsyche, addLog } from "./state.js";
import {
  getPhaseActions,
  drawDreamCard,
  revealLandscape,
  moveDreamer,
  gainMeetActions,
  meetEncounter,
  landscapeAction,
  drawObjectAction,
  drawMindstreamAction,
  useDreamerPower,
  toggleHandCard,
  handleQuestComplete,
  handleAcquire,
  endPhase,
  spawnRandomEncounter,
  getDeckTop,
} from "./game.js";
import {
  renderDreamerPicker,
  renderBoard,
  renderPlayers,
  renderHand,
  renderObjects,
  renderDecks,
  renderActiveSlots,
  renderHud,
  renderLog,
  renderPhaseActions,
  showScreen,
  showEndScreen,
  showModal,
  hideModal,
} from "./ui.js";

let gameData = null;
let state = null;
let selectedDreamerIds = [];

async function init() {
  gameData = await loadGameData();
  bindSetup();
  bindModal();
  renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer);
  document.getElementById("btn-restart").addEventListener("click", () => {
    selectedDreamerIds = [];
    showScreen("screen-setup");
    renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer);
    document.getElementById("btn-start").disabled = true;
  });
}

function bindSetup() {
  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("setup-players").addEventListener("change", () => {
    selectedDreamerIds = [];
    renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer);
    document.getElementById("btn-start").disabled = true;
  });
}

function bindModal() {
  document.querySelector(".modal-backdrop").addEventListener("click", hideModal);
  document.querySelector(".modal-close").addEventListener("click", hideModal);
}

function toggleDreamer(id) {
  const playerCount = Number(document.getElementById("setup-players").value);
  if (selectedDreamerIds.includes(id)) {
    selectedDreamerIds = selectedDreamerIds.filter((x) => x !== id);
  } else if (selectedDreamerIds.length < playerCount) {
    selectedDreamerIds.push(id);
  }
  renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer);
  document.getElementById("btn-start").disabled = selectedDreamerIds.length !== playerCount;
}

function startGame() {
  const lengthKey = document.getElementById("setup-length").value;
  const selectedDreamers = selectedDreamerIds.map((id) => gameData.dreamers.find((d) => d.id === id));
  state = createInitialState(gameData, { lengthKey, selectedDreamers });
  state.players.forEach((_, i) => {
    state.activePlayerIndex = i;
    drawPsyche(state, 2);
  });
  state.activePlayerIndex = 0;
  spawnRandomEncounter(state);
  addLog(state, `Mindstream repressed. Object deck: ${state.objectDeck.length} cards.`);
  showScreen("screen-game");
  renderAll();
}

function renderAll() {
  if (!state) return;

  if (state.status === "won") {
    showEndScreen(true, `You collected ${state.acquiredPoints} Archetype points and escaped!`);
    return;
  }
  if (state.status === "lost") {
    showEndScreen(false, state.log[0] || "The Dreamscape collapses.");
    return;
  }

  renderHud(state);
  renderBoard(state, (id) => {
    state.selectedLandscapeId = id;
    const phase = getPhaseFromState();
    if (phase === "Explore" && !state.exploreUsed) {
      moveDreamer(state, id);
    }
    renderAll();
  });
  renderPlayers(state, (index) => {
    state.activePlayerIndex = index;
    renderAll();
  });
  renderHand(state, (card) => {
    toggleHandCard(state, card);
    showModal(card);
    renderAll();
  });
  renderObjects(state, (card) => showModal(card));
  renderDecks(state, (deckId) => {
    const top = getDeckTop(state, deckId);
    if (top) showModal(top);
    else addDeckMessage(deckId);
  });
  renderActiveSlots(state, (card) => showModal(card));
  renderLog(state);

  const handlers = {
    drawDream: () => {
      drawDreamCard(state, gameData, showModal);
      renderAll();
    },
    revealLandscape: () => { revealLandscape(state); renderAll(); },
    moveDreamer: () => {
      addMessage("Click a revealed Landscape on the board to move.");
      renderAll();
    },
    gainMeetActions: () => { gainMeetActions(state); renderAll(); },
    meetEncounter: (mode) => { meetEncounter(state, mode); renderAll(); },
    landscapeAction: () => { landscapeAction(state); renderAll(); },
    drawObjectAction: () => { drawObjectAction(state); renderAll(); },
    drawMindstreamAction: () => { drawMindstreamAction(state, showModal); renderAll(); },
    completeQuest: () => { handleQuestComplete(state, 0); renderAll(); },
    acquireArchetype: () => { handleAcquire(state); renderAll(); },
    useDreamerPower: () => { useDreamerPower(state); renderAll(); },
    nextPhase: () => { endPhase(state); renderAll(); },
  };

  renderPhaseActions(getPhaseActions(state, handlers));
}

function getPhaseFromState() {
  const phases = ["Reveal", "Explore", "Meet"];
  return phases[state.phaseIndex];
}

function addMessage(msg) {
  addLog(state, msg);
}

function addDeckMessage(deckId) {
  const counts = {
    dream: state.dreamDeck.length,
    psyche: state.psycheDeck.length,
    archetype: state.archetypeDeck.length,
    object: state.objectDeck.length,
    dreambeast: state.dreambeastDeck.length,
    subconscious: state.subconscious.length,
    "mindstream-lucidity": state.mindstreamDecks.lucidity.length,
    "mindstream-elasticity": state.mindstreamDecks.elasticity.length,
    "mindstream-willpower": state.mindstreamDecks.willpower.length,
  };
  addMessage(`${deckId}: ${counts[deckId] ?? 0} cards remaining.`);
  renderLog(state);
}

init();
