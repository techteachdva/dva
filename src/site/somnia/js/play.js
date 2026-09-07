import { bindMusicToggle, initGameAudio, startGameRadio, bindButtonRipples, playSfx } from "./audio.js";
import { initDeviceMode } from "./device-mode.js";
import { initPanelLayout } from "./panel-layout.js";
import { initBoardZoom, syncBoardZoomAfterRender, resetBoardZoom } from "./board-zoom.js";
import { initPauseMenu, openPauseMenu } from "./pause-menu.js";
import { initFxLayer, burstSparklesAtElement } from "./fx.js";
import {
  runPendingCardFx,
  syncHandRemovals,
  updateHandSnapshots,
  resetHandSnapshots,
} from "./card-fx.js";
import { runPendingBoardFx } from "./board-fx.js";
import { calculateFinalScore } from "./scoring.js";
import { fetchHighScores, submitHighScore, validateScoreName } from "./highscores.js";
import { startVictoryCelebration, stopVictoryCelebration } from "./victory-celebration.js";
import { LENGTHS, loadGameData } from "./data.js";
import { createInitialState, addLog, respawnDreamer, getPhase, activePlayer, avoidDreamerDeath, acceptDreamerDeath } from "./state.js";
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
  performLandscapeAction,
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
  handleUseArchetypePower,
  handleDefeatFinalArchetype,
  handleSacrificeForFinal,
  endPhase,
  getDeckTop,
  getPhaseHint,
  getLegalExploreTargets,
  resolvePendingDeathDream,
} from "./game.js";
import { requestEndPhase } from "./phase-skip.js";
import { initDevConsole } from "./dev-console.js";
import { enableDevMode } from "./dev-commands.js";
import { narrate } from "./narrator.js";
import { pickReturnCard, cancelPendingReturn, pickRepressCard, confirmRepressStep, subconsciousCount } from "./subconscious.js";
import { getLandscapePickHighlights } from "./landscapes.js";
import {
  resolveDreamerPowerChoice,
  resolveDreamerPowerDeckPick,
} from "./dreamer-powers.js";
import { resolveNothingChoice } from "./objects.js";
import { phaseOpeningActive } from "./rules.js";
import {
  TUTORIAL_STEPS,
  hasSeenTutorial,
  markTutorialSeen,
} from "./guide.js";
import {
  createTutorialState,
  syncTutorial,
  advanceTutorialStep,
  completeTutorialGame,
  notifyTutorialDreamDrawn,
  notifyTutorialExploreMove,
  isInteractiveTutorialActive,
  getTutorialStep,
} from "./tutorial-mode.js";
import {
  renderBoard,
  renderPlayers,
  renderHand,
  playDreamerHandSparkle,
  renderPowerTokens,
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
  showLandscapeDetail,
  hideDreamerDetailTooltip,
  showDreamerPowerChoice,
  showDreamerPowerDeckPicker,
  showDeckFlipPicker,
  showTradeControls,
  showRespawnPicker,
  showDeathChoiceModal,
  showNothingChoiceModal,
  hideUtilityModal,
  showSubconsciousPicker,
  showSubconsciousBrowse,
  showRepressPicker,
  renderSubconsciousGraveyard,
  showRulesModal,
  showOverviewModal,
  showTutorialStep,
  updateTutorialStepUI,
  hideTutorial,
  getTutorialSpotlightRect,
  refreshTutorialSpotlight,
  bindUiRenderState,
  ensureTutorialStepTargetsVisible,
} from "./ui.js";

const LAUNCH_KEY = "somnia.launch";

let gameData = null;
let state = null;
let devConsole = null;
let tutorialIndex = -1;
let interactiveTutorialActive = false;
let lastTutorialSyncKey = null;
let lastTutorialStepId = null;
let fullscreenReady = false;
const lastCardClick = { id: null, time: 0 };
let boardResizeTimer = null;
let lastRepressPickerKey = null;
let lastReturnPickerKey = null;
let prevHandIds = new Set();
let pendingScoreResult = null;
let scoreSubmitted = false;
let victoryShown = false;

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
  initDeviceMode();
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
  initBoardZoom();
  bindFullscreenPrompt();
  bindRestart();
  bindEndLeaderboard();
  bindPowerBonus();

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

function bindPowerBonus() {
  document.getElementById("btn-power-bonus")?.addEventListener("click", () => {
    if (!state) return;
    powerBonus(state);
    playSfx("select");
    renderAll();
  });
}

function bindEndLeaderboard() {
  document.getElementById("end-score-submit")?.addEventListener("click", async () => {
    if (!pendingScoreResult || scoreSubmitted) return;
    const first = document.getElementById("end-score-first")?.value || "";
    const last = document.getElementById("end-score-last")?.value || "";
    const status = document.getElementById("end-score-status");
    const valid = validateScoreName(first, last);
    if (!valid.ok) {
      if (status) status.textContent = valid.message;
      return;
    }
    try {
      if (status) status.textContent = "Saving score…";
      const result = await submitHighScore({
        name: valid.name,
        score: pendingScoreResult.breakdown.total,
        won: true,
        seconds: pendingScoreResult.seconds,
        difficulty: pendingScoreResult.difficulty,
        breakdown: pendingScoreResult.breakdown,
      });
      scoreSubmitted = true;
      if (status) {
        status.textContent = result.inTop
          ? `Saved! Rank #${result.rank} on the leaderboard.`
          : "Score saved!";
      }
      renderLeaderboardList(result.scores || []);
    } catch (err) {
      if (status) status.textContent = err.message || "Could not save score.";
    }
  });
}

function renderLeaderboardList(scores) {
  const list = document.getElementById("end-score-list");
  if (!list) return;
  if (!scores.length) {
    list.innerHTML = "<li>No scores yet.</li>";
    return;
  }
  list.innerHTML = scores.slice(0, 20).map((entry) =>
    `<li><strong>${entry.rank}.</strong> ${entry.name} — ${entry.score} pts</li>`).join("");
}

async function loadLeaderboardPreview() {
  try {
    const { scores, setupRequired } = await fetchHighScores();
    const status = document.getElementById("end-score-status");
    if (setupRequired && status) {
      status.textContent = "Leaderboard not configured yet. See google-apps-script/somnia-highscores-backend.gs";
    }
    renderLeaderboardList(scores);
  } catch {
    /* optional */
  }
}

function bindRestart() {
  document.getElementById("btn-restart").addEventListener("click", () => {
    stopVictoryCelebration();
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
    boardResizeTimer = setTimeout(() => syncBoardZoomAfterRender(), 80);
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

  if (config.tutorialMode) {
    state = createTutorialState(gameData);
    interactiveTutorialActive = true;
    document.body.classList.add("tutorial-mode-active");
    narrate(
      state,
      "Tutorial Mode",
      "Five guided rounds with fixed Dreams and hands. Follow the highlighted steps — Cerberus awakens on Round 3.",
      ["Complete each highlighted action before pressing Continue."],
    );
  } else {
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
  }

  showScreen("screen-game");
  resetBoardZoom();
  resetHandSnapshots(state);
  renderAll();
  if (!config.tutorialMode && !hasSeenTutorial()) startTutorial();
  else if (config.tutorialMode) syncInteractiveTutorial();
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

function handleTutorialSkip() {
  if (confirm("Skip the interactive tutorial? You can replay it from the setup screen.")) {
    state.tutorialComplete = true;
    hideTutorial();
    document.body.classList.remove("tutorial-mode-active");
    showEndScreen(true, "Tutorial skipped. Try a full game when you're ready.");
  }
}

function handleTutorialNext() {
  const current = syncTutorial(state);
  if (current?.step?.until && !current.canAdvance) return;

  const fromRect = getTutorialSpotlightRect();
  advanceTutorialStep(state);
  if (state.tutorialComplete) {
    completeTutorialGame(state);
    hideTutorial();
    document.body.classList.remove("tutorial-mode-active");
    showEndScreen(
      true,
      "Tutorial complete! You learned R.E.M., Encounters, Landscape actions, Dreams, Bosses, Power Tokens, and the Subconscious. Start a real game from the setup screen.",
    );
    return;
  }
  lastTutorialSyncKey = null;
  lastTutorialStepId = null;
  renderAll();
  const nextSync = syncTutorial(state);
  if (!nextSync || nextSync.complete) return;
  showTutorialStep(nextSync.step, nextSync.stepIndex, nextSync.total, {
    canAdvance: nextSync.canAdvance,
    roundLabel: nextSync.round,
    objective: nextSync.objective,
    fromRect,
    onNext: handleTutorialNext,
    onSkip: handleTutorialSkip,
  });
  lastTutorialSyncKey = `${nextSync.stepIndex}:${nextSync.canAdvance}:${nextSync.step.id}`;
}

function syncInteractiveTutorial() {
  if (!isInteractiveTutorialActive(state)) {
    hideTutorial();
    document.body.classList.remove("tutorial-mode-active");
    return;
  }

  const sync = syncTutorial(state);
  if (!sync) return;

  if (sync.complete) {
    completeTutorialGame(state);
    hideTutorial();
    document.body.classList.remove("tutorial-mode-active");
    showEndScreen(
      true,
      "Tutorial complete! You learned R.E.M., Encounters, Landscape actions, Dreams, Bosses, Power Tokens, and the Subconscious. Start a real game from the setup screen.",
    );
    return;
  }

  const { step, stepIndex, total, canAdvance, round, objective } = sync;
  const syncKey = `${stepIndex}:${canAdvance}:${step.id}:${objective}`;
  const overlayOpen = !document.getElementById("tutorial-overlay")?.classList.contains("hidden");

  if (syncKey === lastTutorialSyncKey) {
    ensureTutorialStepTargetsVisible(step);
    refreshTutorialSpotlight();
    return;
  }

  if (overlayOpen && lastTutorialStepId === step.id) {
    updateTutorialStepUI({ step, stepIndex, total, canAdvance, roundLabel: round, objective });
    ensureTutorialStepTargetsVisible(step);
    refreshTutorialSpotlight();
    lastTutorialSyncKey = syncKey;
    return;
  }

  lastTutorialSyncKey = syncKey;
  lastTutorialStepId = step.id;

  showTutorialStep(step, stepIndex, total, {
    canAdvance,
    roundLabel: round,
    objective,
    onNext: handleTutorialNext,
    onSkip: handleTutorialSkip,
  });
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

let lastDeathChoiceKey = null;

function maybeShowNothingChoice() {
  if (!state?.pendingNothingChoice) {
    lastNothingChoiceKey = null;
    return;
  }
  const key = state.pendingNothingChoice.playerId;
  if (key === lastNothingChoiceKey) return;
  lastNothingChoiceKey = key;
  showNothingChoiceModal(
    state,
    () => {
      resolveNothingChoice(state, "token");
      lastNothingChoiceKey = null;
      renderAll();
    },
    () => {
      resolveNothingChoice(state, "repress");
      lastNothingChoiceKey = null;
      renderAll();
    },
  );
}

let lastNothingChoiceKey = null;

function maybeShowDeathChoice() {
  if (!state?.pendingDeathChoice) {
    lastDeathChoiceKey = null;
    return;
  }
  const key = state.pendingDeathChoice.playerId;
  if (key === lastDeathChoiceKey) return;
  lastDeathChoiceKey = key;
  showDeathChoiceModal(
    state,
    () => {
      avoidDreamerDeath(state);
      lastDeathChoiceKey = null;
      renderAll();
    },
    () => {
      acceptDreamerDeath(state);
      lastDeathChoiceKey = null;
      renderAll();
    },
  );
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

let dreamerPowerModalKey = null;

function presentDreamerPowerUI(ui) {
  if (ui.type === "choice") {
    showDreamerPowerChoice(ui, (choiceId) => {
      dreamerPowerModalKey = null;
      processDreamerPowerResult(resolveDreamerPowerChoice(state, choiceId));
    });
    return;
  }
  if (ui.type === "deck") {
    showDreamerPowerDeckPicker(ui, (deckKey) => {
      dreamerPowerModalKey = null;
      processDreamerPowerResult(resolveDreamerPowerDeckPick(state, deckKey));
    });
  }
}

function processDreamerPowerResult(result) {
  if (result?.card) showModal(result.card);
  if (result?.ui) {
    const pending = state.pendingDreamerPower;
    if (pending) pending.ui = result.ui;
    presentDreamerPowerUI(result.ui);
    return;
  }
  renderAll();
}

function maybeShowDreamerPowerUI() {
  const ui = state?.pendingDreamerPower?.ui;
  if (!ui) {
    dreamerPowerModalKey = null;
    return;
  }
  const key = JSON.stringify(ui);
  if (key === dreamerPowerModalKey) return;
  dreamerPowerModalKey = key;
  presentDreamerPowerUI(ui);
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
  bindUiRenderState(state);

  if (state.status === "won") {
    if (state.tutorialVictory) {
      showEndScreen(
        true,
        "Tutorial complete! You learned Reveal, Explore, Meet, Psyche, Power Tokens, Archetypes, Dreams, and Boss spawning.",
      );
      return;
    }
    if (!pendingScoreResult) {
      const breakdown = calculateFinalScore(state);
      const lengthLabel = state.lengthKey && LENGTHS[state.lengthKey]
        ? LENGTHS[state.lengthKey].label
        : `${state.goalPoints} pts`;
      const seconds = Math.max(0, Math.round((Date.now() - (state.gameStartedAt || Date.now())) / 1000));
      pendingScoreResult = { breakdown, seconds, difficulty: lengthLabel };
    }
    const msg = state.finalRecurrence
      ? "All Remaining Archetypes defeated in the Final Recurrence!"
      : `You collected ${state.acquiredPoints} Archetype points and all Dreamers returned to the Bed!`;
    showEndScreen(true, msg, pendingScoreResult);
    if (!victoryShown) {
      victoryShown = true;
      startVictoryCelebration();
      playSfx("victory");
      loadLeaderboardPreview();
    }
    return;
  }
  if (state.status === "lost") {
    stopVictoryCelebration();
    showEndScreen(false, state.log[0] || "The Dreamscape collapses.");
    return;
  }

  syncHandRemovals(state);

  renderHud(state, getPhaseHint(state));
  renderPhaseStepper(state);

  const handlers = {
    drawDream: () => {
      const card = drawDreamCard(state, showModal);
      if (card) notifyTutorialDreamDrawn(state);
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
    landscapeAction: (actionId) => {
      const result = performLandscapeAction(state, actionId, {
        onResult: (card) => showModal(card),
      });
      if (result?.pending === "pick-mindstream-suit" || result?.pending === "spawn-dreambeast-pick-suit") {
        const { tile, player, actionId: pendingActionId } = result;
        showMindstreamPicker((suit) => {
          finishLandscapeMindstreamPick(state, tile, player, pendingActionId, suit, (card) => showModal(card));
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
    completeQuest: (i) => {
      const result = handleQuestComplete(state, i);
      if (result === "acquired") {
        playSfx("acquire");
        requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("acquired-archetypes"), 16, "#f0c96a"));
      }
      renderAll();
    },
    useArchetypePower: (id) => {
      handleUseArchetypePower(state, id);
      renderAll();
    },
    useDreamerPower: () => {
      const result = useDreamerPower(state);
      if (result?.ui) processDreamerPowerResult(result);
      else renderAll();
    },
    defeatFinalArchetype: () => { handleDefeatFinalArchetype(state); renderAll(); },
    sacrificeForFinal: () => { handleSacrificeForFinal(state); renderAll(); },
    nextPhase: () => { requestEndPhase(state, () => renderAll()); },
  };

  const phaseActions = getPhaseActions(state, handlers);
  renderNarratorPanel(state);
  renderGuidePanel(state, phaseActions);
  renderPhaseAdvanceBar(getPhaseAdvanceAction(state, handlers));

  const pickHighlights = getLandscapePickHighlights(state);
  const legalMoves = getLegalExploreTargets(state).map((t) => t.id);
  renderBoard(state, (id) => {
    handleBoardTileClick(state, id);
    if (isInteractiveTutorialActive(state) && getPhase(state) === "Explore") {
      const offBed = state.players.some((p) => p.alive && p.landscapeId !== "bed");
      if (offBed) notifyTutorialExploreMove(state);
    }
    renderAll();
    if (!state.landscapePick) showLandscapeDetail(state, id);
  }, legalMoves, pickHighlights);
  syncBoardZoomAfterRender();
  renderPlayers(state, (index) => {
    if (state.tradeMode && state.trade?.step === "pick-partner") {
      if (selectTradePartner(state, index)) {
        state.trade.step = "select-offer";
        renderAll();
        maybeShowTradePanel();
      }
      return;
    }
    const prevId = state.players[state.activePlayerIndex]?.id;
    state.activePlayerIndex = index;
    const player = state.players[index];
    if (getPhase(state) === "Meet" && player?.landscapeId) {
      state.selectedLandscapeId = player.landscapeId;
    }
    const nextId = state.players[index]?.id;
    if (prevId && nextId && prevId !== nextId) {
      playDreamerHandSparkle(prevId, nextId);
    }
    renderAll();
  });

  if (phaseOpeningActive(state)) {
    renderPhaseSpendHands(state, onHandCardClick);
  } else if (getPhase(state) === "Meet" && state.meetActionBudget > 0) {
    renderCoopMeetHands(state, onHandCardClick);
  } else {
    renderHand(state, onHandCardClick, getNewHandCardIds(state));
  }
  renderPowerTokens(state);

  renderObjects(state, (card, zone) => {
    if (zone === "persistent") {
      playObject(state, card.instanceId || card.id, { usePower: true });
    } else {
      playObject(state, card.instanceId || card.id);
    }
    renderAll();
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
  maybeShowDeathChoice();
  maybeShowNothingChoice();
  maybeShowRespawn();
  maybeShowRepressPicker();
  maybeShowReturnPicker();
  maybeShowDreamerPowerUI();

  if (isInteractiveTutorialActive(state)) {
    const step = getTutorialStep(state);
    if (step) ensureTutorialStepTargetsVisible(step);
    syncInteractiveTutorial();
    refreshTutorialSpotlight();
  }

  updateHandSnapshots(state);
  requestAnimationFrame(() => {
    runPendingCardFx(state);
    runPendingBoardFx();
  });
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
