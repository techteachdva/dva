import { bindMusicToggle, initGameAudio, startGameRadio, bindButtonRipples, playSfx } from "./audio.js";
import { initPanelLayout } from "./panel-layout.js";
import { initPauseMenu, openPauseMenu } from "./pause-menu.js";
import { initFxLayer, burstSparklesAtElement } from "./fx.js";
import {
  runPendingCardFx,
  syncHandRemovals,
  updateHandSnapshots,
  resetHandSnapshots,
} from "./card-fx.js";
import { loadGameData } from "./data.js";
import { createInitialState, addLog, respawnDreamer, getPhase, activePlayer } from "./state.js";
import {
  getPhaseActions,
  getPhaseAdvanceAction,
  drawDreamCard,
  revealLandscape,
  activateExplore,
  handleBoardTileClick,
  gainMeetActions,
  meetEncounter,
  landscapeAction,
  drawMindstreamOnLandscape,
  uniqueLandscapeAction,
  completeLandscapeAction,
  finishLandscapeMindstreamPick,
  finishLandscapeDeckFlip,
  tradeAction,
  selectTradePartner,
  confirmTrade,
  cancelTrade,
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
  resolvePendingDeathDream,
} from "./game.js";
import { initDevConsole } from "./dev-console.js";
import { enableDevMode } from "./dev-commands.js";
import { narrate } from "./narrator.js";
import { pickReturnCard, cancelPendingReturn, pickRepressCard, confirmRepressStep, subconsciousCount } from "./subconscious.js";
import { getLandscapePickHighlights } from "./landscapes.js";
import { phaseOpeningActive } from "./rules.js";
import {
  TUTORIAL_STEPS,
  hasSeenTutorial,
  markTutorialSeen,
} from "./guide.js";
import {
  renderBoard,
  renderPlayers,
  renderHand,
  renderPhaseSpendHands,
  renderCoopMeetHands,
  renderObjects,
  renderDecks,
  renderActiveSlots,
  renderHud,
  renderLog,
  renderPhaseActions,
  renderPhaseStepper,
  renderGuidePanel,
  renderNarratorPanel,
  renderPhaseAdvanceBar,
  showScreen,
  showEndScreen,
  showModal,
  hideModal,
  showMindstreamPicker,
  showLandscapeActionPicker,
  showDeckFlipPicker,
  showTradeControls,
  showRespawnPicker,
  hideUtilityModal,
  showSubconsciousPicker,
  showSubconsciousBrowse,
  showRepressPicker,
  renderSubconsciousGraveyard,
  showRulesModal,
  showOverviewModal,
  showTutorialStep,
  hideTutorial,
} from "./ui.js";

const LAUNCH_KEY = "somnia.launch";

let gameData = null;
let state = null;
let devConsole = null;
let tutorialIndex = -1;
let fullscreenReady = false;
const lastCardClick = { id: null, time: 0 };
let boardResizeTimer = null;
let lastRepressPickerKey = null;
let lastReturnPickerKey = null;
let prevHandIds = new Set();

function getNewHandCardIds(state) {
  const player = activePlayer(state);
  const current = new Set(player.hand.map((c) => c.instanceId));
  const fresh = new Set();
  if (prevHandIds.size) {
    for (const id of current) {
      if (!prevHandIds.has(id)) fresh.add(id);
    }
  }
  prevHandIds = current;
  return fresh;
}

async function init() {
  initFxLayer();
  bindButtonRipples();
  initGameAudio();
  bindMusicToggle();
  initPanelLayout();
  initPauseMenu();
  gameData = await loadGameData();
  bindModal();
  bindHelp();
  bindBoardResize();
  bindFullscreenPrompt();
  bindRestart();

  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    enableDevMode();
  }

  const config = readLaunchConfig();
  if (!config) {
    window.location.replace("index.html");
    return;
  }

  startGame(config);
  devConsole = initDevConsole(() => ({
    state,
    gameData,
    renderAll,
    endPhase,
  }));
  devConsole?.refresh();
}

function readLaunchConfig() {
  try {
    const params = new URLSearchParams(window.location.search);
    const launchParam = params.get("launch");
    if (launchParam) {
      const config = JSON.parse(atob(decodeURIComponent(launchParam)));
      if (config?.lengthKey && Array.isArray(config.selectedDreamerIds) && config.selectedDreamerIds.length) {
        sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(config));
        const clean = new URL(window.location.href);
        clean.searchParams.delete("launch");
        history.replaceState(null, "", `${clean.pathname}${clean.search}${clean.hash}`);
        return config;
      }
    }

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
    startGameRadio();
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
  document.getElementById("btn-pause")?.addEventListener("click", openPauseMenu);

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
  narrate(
    state,
    "The Dreamscape forms",
    "Each Dreamer starts on The Bed with 5 Psyche and 2 Power. Round 1 begins in the Reveal Phase — discuss, plan, and act in any order. The Head Dreamer (★) should Draw the Dream when the group is ready.",
    ["Reveal Phase: spend Lucidity to flip Landscapes on the hex map"],
  );
  showScreen("screen-game");
  resetHandSnapshots(state);
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

  const wasSelected = state.selectedHand.includes(id);
  toggleHandCard(state, card, owner);
  const isSelected = state.selectedHand.includes(id);
  if (isSelected && !wasSelected) playSfx("select");
  else if (!isSelected && wasSelected) playSfx("deselect");
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

function maybeShowRepressPicker() {
  if (!state?.pendingRepress) {
    lastRepressPickerKey = null;
    return;
  }
  const pending = state.pendingRepress;
  const key = `${pending.playerId}:${pending.picked.length}:${pending.remaining}:${pending.confirmEmpty}`;
  if (key === lastRepressPickerKey) return;
  lastRepressPickerKey = key;

  showRepressPicker(
    state,
    (instanceId) => {
      pickRepressCard(state, instanceId);
      lastRepressPickerKey = null;
      if (state.pendingRepress) {
        maybeShowRepressPicker();
      }
      renderAll();
    },
    () => {
      confirmRepressStep(state);
      lastRepressPickerKey = null;
      renderAll();
    }
  );
}

function maybeShowReturnPicker() {
  if (!state?.pendingReturn) {
    lastReturnPickerKey = null;
    return;
  }
  const pending = state.pendingReturn;
  const key = `${pending.remaining}:${pending.picked.length}`;
  if (key === lastReturnPickerKey) return;
  lastReturnPickerKey = key;
  showSubconsciousPicker(
    state,
    (instanceId) => {
      pickReturnCard(state, instanceId);
      lastReturnPickerKey = null;
      if (state.pendingReturn) maybeShowReturnPicker();
      if (!state.pendingReturn) hideUtilityModal();
      renderAll();
    },
    () => {
      cancelPendingReturn(state);
      lastReturnPickerKey = null;
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

  syncHandRemovals(state);

  renderHud(state, getPhaseHint(state));
  renderPhaseStepper(state);

  const handlers = {
    drawDream: () => {
      const card = drawDreamCard(state, showModal);
      if (card) {
        requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("deck-tray"), 12));
      }
      renderAll();
    },
    revealLandscape: () => { revealLandscape(state); renderAll(); },
    activateExplore: () => { activateExplore(state); renderAll(); },
    gainMeetActions: () => { gainMeetActions(state); renderAll(); },
    meetEncounter: (mode) => { meetEncounter(state, mode); renderAll(); },
    drawMindstream: () => {
      drawMindstreamOnLandscape(state, {
        onResult: (card) => showModal(card),
      });
      renderAll();
    },
    uniqueLandscapeAction: () => {
      uniqueLandscapeAction(state, {
        onChoose: (choices, tile, player) => {
          showLandscapeActionPicker(tile, choices, (actionId) => {
            const result = completeLandscapeAction(state, tile, player, actionId, (card) => showModal(card));
            if (result?.pending === "pick-mindstream-suit" || result?.pending === "spawn-dreambeast-pick-suit") {
              showMindstreamPicker((suit) => {
                finishLandscapeMindstreamPick(state, tile, player, actionId, suit, (card) => showModal(card));
                renderAll();
              });
              return;
            }
            if (result?.pending === "flip-top-3-pick-deck") {
              showDeckFlipPicker((deckKey) => {
                finishLandscapeDeckFlip(state, deckKey);
                renderAll();
              });
              return;
            }
            renderAll();
          });
        },
        onResult: (card) => showModal(card),
      });
      renderAll();
    },
    landscapeAction: () => {
      uniqueLandscapeAction(state, {
        onChoose: (choices, tile, player) => {
          showLandscapeActionPicker(tile, choices, (actionId) => {
            const result = completeLandscapeAction(state, tile, player, actionId, (card) => showModal(card));
            if (result?.pending === "pick-mindstream-suit" || result?.pending === "spawn-dreambeast-pick-suit") {
              showMindstreamPicker((suit) => {
                finishLandscapeMindstreamPick(state, tile, player, actionId, suit, (card) => showModal(card));
                renderAll();
              });
              return;
            }
            if (result?.pending === "flip-top-3-pick-deck") {
              showDeckFlipPicker((deckKey) => {
                finishLandscapeDeckFlip(state, deckKey);
                renderAll();
              });
              return;
            }
            renderAll();
          });
        },
        onResult: (card) => showModal(card),
      });
      renderAll();
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
    acquireArchetype: () => {
      handleAcquire(state);
      playSfx("acquire");
      requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("active-archetype"), 16, "#f0c96a"));
      renderAll();
    },
    useDreamerPower: () => { useDreamerPower(state); renderAll(); },
    defeatFinalArchetype: () => { handleDefeatFinalArchetype(state); renderAll(); },
    sacrificeForFinal: () => { handleSacrificeForFinal(state); renderAll(); },
    nextPhase: () => { endPhase(state); renderAll(); },
  };

  const phaseActions = getPhaseActions(state, handlers);
  renderNarratorPanel(state);
  renderGuidePanel(state, phaseActions);
  renderPhaseAdvanceBar(getPhaseAdvanceAction(state, handlers));

  const pickHighlights = getLandscapePickHighlights(state);
  const legalMoves = getLegalExploreTargets(state).map((t) => t.id);
  renderBoard(state, (id) => {
    handleBoardTileClick(state, id);
    renderAll();
  }, legalMoves, pickHighlights);
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

  if (phaseOpeningActive(state)) {
    renderPhaseSpendHands(state, onHandCardClick);
  } else if (getPhase(state) === "Meet" && state.meetActionBudget > 0) {
    renderCoopMeetHands(state, onHandCardClick);
  } else {
    renderHand(state, onHandCardClick, getNewHandCardIds(state));
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
  renderSubconsciousGraveyard(state, () => {
    showSubconsciousBrowse(state, (card) => showModal(card));
  });
  renderLog(state);

  renderPhaseActions(phaseActions);
  resolvePendingDeathDream(state, showModal);
  maybeShowRespawn();
  maybeShowRepressPicker();
  maybeShowReturnPicker();

  updateHandSnapshots(state);
  requestAnimationFrame(() => runPendingCardFx(state));
}

function addDeckMessage(deckId) {
  const counts = {
    dream: state.dreamDeck.length,
    psyche: state.psycheDeck.length,
    archetype: state.archetypeDeck.length,
    subconscious: subconsciousCount(state.subconscious),
    "mindstream-lucidity": state.mindstreamDecks.lucidity.length,
    "mindstream-elasticity": state.mindstreamDecks.elasticity.length,
    "mindstream-willpower": state.mindstreamDecks.willpower.length,
  };
  addLog(state, `${deckId}: ${counts[deckId] ?? 0} cards.`);
  renderLog(state);
}

init();
