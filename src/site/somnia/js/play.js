import { loadGameData } from "./data.js";
import { createInitialState, addLog, respawnDreamer, getPhase } from "./state.js";
import {
  getPhaseActions,
  drawDreamCard,
  revealLandscape,
  activateExplore,
  moveDreamer,
  gainMeetActions,
  meetEncounter,
  landscapeAction,
  tradeAction,
  selectTradePartner,
  confirmTrade,
  cancelTrade,
  drawMindstreamCard,
  playObject,
  activateObject,
  powerBonus,
  useDreamerPower,
  toggleHandCard,
  handleQuestComplete,
  handleAcquire,
  handleDefeatFinalArchetype,
  handleSacrificeForFinal,
  endPhase,
  getDeckTop,
  getPhaseHint,
  getLegalExploreTargets,
} from "./game.js";
import { pickReturnCard, cancelPendingReturn, subconsciousCount } from "./subconscious.js";
import {
  TUTORIAL_STEPS,
  hasSeenTutorial,
  markTutorialSeen,
} from "./guide.js";
import {
  renderBoard,
  renderPlayers,
  renderHand,
  renderCoopMeetHands,
  renderObjects,
  renderDecks,
  renderActiveSlots,
  renderHud,
  renderLog,
  renderPhaseActions,
  renderPhaseStepper,
  renderGuidePanel,
  showScreen,
  showEndScreen,
  showModal,
  hideModal,
  showMindstreamPicker,
  showTradeControls,
  showRespawnPicker,
  hideUtilityModal,
  showSubconsciousPicker,
  showSubconsciousBrowse,
  showRulesModal,
  showOverviewModal,
  showTutorialStep,
  hideTutorial,
} from "./ui.js";

const LAUNCH_KEY = "somnia.launch";

let gameData = null;
let state = null;
let tutorialIndex = -1;
let fullscreenReady = false;
const lastCardClick = { id: null, time: 0 };
let boardResizeTimer = null;

async function init() {
  gameData = await loadGameData();
  bindModal();
  bindHelp();
  bindBoardResize();
  bindFullscreenPrompt();
  bindRestart();

  const config = readLaunchConfig();
  if (!config) {
    window.location.replace("index.html");
    return;
  }

  startGame(config);
}

function readLaunchConfig() {
  try {
    const raw = sessionStorage.getItem(LAUNCH_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw);
    if (!config?.lengthKey || !Array.isArray(config.selectedDreamerIds)) return null;
    if (!config.selectedDreamerIds.length) return null;
    return config;
  } catch {
    return null;
  }
}

function bindFullscreenPrompt() {
  const prompt = document.getElementById("fullscreen-prompt");
  if (!prompt) return;

  const enter = async () => {
    if (fullscreenReady) return;
    fullscreenReady = true;
    prompt.classList.add("hidden");
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* fullscreen denied or unsupported — game still runs */
    }
    prompt.remove();
  };

  prompt.addEventListener("click", enter);
  prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enter();
    }
  });
}

function bindRestart() {
  document.getElementById("btn-restart").addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      window.close();
      return;
    }
    window.location.href = "index.html";
  });

  document.getElementById("btn-replay-tutorial")?.addEventListener("click", () => {
    tutorialIndex = 0;
    showTutorialAt(tutorialIndex);
  });
}

function bindHelp() {
  document.getElementById("btn-overview")?.addEventListener("click", showOverviewModal);
  document.getElementById("btn-help")?.addEventListener("click", showRulesModal);
  document.getElementById("btn-tutorial")?.addEventListener("click", () => {
    tutorialIndex = 0;
    showTutorialAt(tutorialIndex);
  });
  document.getElementById("btn-end-overview")?.addEventListener("click", showOverviewModal);

  document.getElementById("btn-toggle-decks")?.addEventListener("click", () => {
    const tray = document.getElementById("deck-tray");
    const btn = document.getElementById("btn-toggle-decks");
    const hidden = tray.classList.toggle("collapsed");
    btn.textContent = hidden ? "Show decks" : "Hide decks";
    btn.setAttribute("aria-expanded", String(!hidden));
  });
}

function bindModal() {
  document.querySelector("#card-modal .modal-backdrop").addEventListener("click", hideModal);
  document.querySelector("#card-modal .modal-close").addEventListener("click", hideModal);
  document.querySelector("#utility-modal .utility-backdrop")?.addEventListener("click", hideUtilityModal);
  document.querySelector("#utility-modal .utility-close")?.addEventListener("click", hideUtilityModal);
}

function bindBoardResize() {
  const vp = document.getElementById("board-viewport");
  if (!vp || vp.dataset.resizeBound) return;
  vp.dataset.resizeBound = "1";
  const observer = new ResizeObserver(() => {
    if (!state) return;
    clearTimeout(boardResizeTimer);
    boardResizeTimer = setTimeout(() => renderAll(), 80);
  });
  observer.observe(vp);
}

function startGame(config) {
  const selectedDreamers = config.selectedDreamerIds
    .map((id) => gameData.dreamers.find((d) => d.id === id))
    .filter(Boolean);

  if (!selectedDreamers.length) {
    window.location.replace("index.html");
    return;
  }

  state = createInitialState(gameData, {
    lengthKey: config.lengthKey,
    selectedDreamers,
  });
  addLog(state, "Somnia — Escape before the Dream Deck runs out. Follow the Guide panel for your next step.");
  showScreen("screen-game");
  renderAll();
  if (!hasSeenTutorial()) startTutorial();
}

function startTutorial() {
  tutorialIndex = 0;
  showTutorialAt(tutorialIndex);
}

function showTutorialAt(index) {
  const step = TUTORIAL_STEPS[index];
  if (!step) {
    finishTutorial();
    return;
  }
  showTutorialStep(step, index, TUTORIAL_STEPS.length, {
    onNext: () => {
      tutorialIndex += 1;
      if (tutorialIndex >= TUTORIAL_STEPS.length) finishTutorial();
      else showTutorialAt(tutorialIndex);
    },
    onSkip: finishTutorial,
  });
}

function finishTutorial() {
  hideTutorial();
  tutorialIndex = -1;
  markTutorialSeen();
  renderAll();
}

function onHandCardClick(card, owner) {
  const now = Date.now();
  const id = card.instanceId || card.id;
  if (lastCardClick.id === id && now - lastCardClick.time < 400) {
    showModal(card);
    lastCardClick.id = null;
    return;
  }
  lastCardClick.id = id;
  lastCardClick.time = now;

  toggleHandCard(state, card, owner);
  if (state.tradeMode && state.trade?.step === "select-offer") {
    renderAll();
    maybeShowTradePanel();
    return;
  }
  renderAll();
}

function maybeShowRespawn() {
  if (!state?.pendingRespawn || !state.availableDreamers.length) return;
  showRespawnPicker(state.availableDreamers, (dreamerId) => {
    respawnDreamer(state, state.pendingRespawn, dreamerId);
    renderAll();
  });
}

function maybeShowTradePanel() {
  if (!state?.tradeMode || !state.trade) return;
  if (state.trade.step === "select-offer") {
    showTradeControls(
      state,
      () => {
        confirmTrade(state);
        renderAll();
      },
      () => {
        cancelTrade(state);
        renderAll();
      }
    );
  }
}

function maybeShowReturnPicker() {
  if (!state?.pendingReturn) return;
  showSubconsciousPicker(
    state,
    (instanceId) => {
      pickReturnCard(state, instanceId);
      if (!state.pendingReturn) hideUtilityModal();
      renderAll();
    },
    () => {
      cancelPendingReturn(state);
      renderAll();
    }
  );
}

function renderAll() {
  if (!state) return;

  if (state.status === "won") {
    const msg = state.finalRecurrence
      ? "All Remaining Archetypes defeated in the Final Recurrence!"
      : `You collected ${state.acquiredPoints} Archetype points and escaped!`;
    showEndScreen(true, msg);
    return;
  }
  if (state.status === "lost") {
    showEndScreen(false, state.log[0] || "The Dreamscape collapses.");
    return;
  }

  renderHud(state, getPhaseHint(state));
  renderPhaseStepper(state);
  renderGuidePanel(state);

  const legalMoves = getLegalExploreTargets(state).map((t) => t.id);
  renderBoard(state, (id) => {
    moveDreamer(state, id);
    renderAll();
  }, legalMoves);
  renderPlayers(state, (index) => {
    if (state.tradeMode && state.trade?.step === "pick-partner") {
      if (selectTradePartner(state, index)) {
        state.trade.step = "select-offer";
        renderAll();
        maybeShowTradePanel();
      }
      return;
    }
    state.activePlayerIndex = index;
    renderAll();
  });

  if (getPhase(state) === "Meet" && state.meetActionBudget > 0) {
    renderCoopMeetHands(state, onHandCardClick);
  } else {
    renderHand(state, onHandCardClick);
  }

  renderObjects(state, (card, zone) => {
    if (getPhase(state) === "Meet") {
      if (zone === "persistent") {
        playObject(state, card.instanceId || card.id, { usePower: true });
      } else if (state.meetActionBudget > 0 && state.meetActionsUsed < state.meetActionBudget) {
        playObject(state, card.instanceId || card.id);
      } else {
        showModal(card);
        return;
      }
      renderAll();
      return;
    }
    showModal(card);
  });
  renderDecks(state, (deckId) => {
    if (deckId.startsWith("mindstream-") && state.tradeMode) return;
    if (deckId === "subconscious") {
      showSubconsciousBrowse(state, (card) => showModal(card));
      return;
    }
    const top = getDeckTop(state, deckId);
    if (top) showModal(top);
    else addDeckMessage(deckId);
  });
  renderActiveSlots(state, (card) => showModal(card));
  renderLog(state);

  const handlers = {
    drawDream: () => { drawDreamCard(state, showModal); renderAll(); },
    revealLandscape: () => { revealLandscape(state); renderAll(); },
    activateExplore: () => { activateExplore(state); renderAll(); },
    gainMeetActions: () => { gainMeetActions(state); renderAll(); },
    meetEncounter: (mode) => { meetEncounter(state, mode); renderAll(); },
    landscapeAction: () => { landscapeAction(state); renderAll(); },
    drawMindstream: () => {
      showMindstreamPicker((suit) => {
        const card = drawMindstreamCard(state, suit);
        if (card) showModal(card);
        renderAll();
      });
    },
    playObject: () => {
      const card = playObject(state);
      if (card) showModal(card);
      renderAll();
    },
    activateObject: () => {
      activateObject(state);
      renderAll();
    },
    tradeAction: () => {
      tradeAction(state);
      renderAll();
    },
    powerBonus: () => { powerBonus(state); renderAll(); },
    completeQuest: (i) => { handleQuestComplete(state, i); renderAll(); },
    acquireArchetype: () => { handleAcquire(state); renderAll(); },
    useDreamerPower: () => { useDreamerPower(state); renderAll(); },
    defeatFinalArchetype: () => { handleDefeatFinalArchetype(state); renderAll(); },
    sacrificeForFinal: () => { handleSacrificeForFinal(state); renderAll(); },
    nextPhase: () => { endPhase(state); renderAll(); },
  };

  renderPhaseActions(getPhaseActions(state, handlers));
  maybeShowRespawn();
  maybeShowReturnPicker();
}

function addDeckMessage(deckId) {
  const counts = {
    dream: state.dreamDeck.length,
    psyche: state.psycheDeck.length,
    archetype: state.archetypeDeck.length,
    object: state.objectDeck.length,
    dreambeast: state.dreambeastDeck.length,
    subconscious: subconsciousCount(state.subconscious),
    "mindstream-lucidity": state.mindstreamDecks.lucidity.length,
    "mindstream-elasticity": state.mindstreamDecks.elasticity.length,
    "mindstream-willpower": state.mindstreamDecks.willpower.length,
  };
  addLog(state, `${deckId}: ${counts[deckId] ?? 0} cards.`);
  renderLog(state);
}

init();
