import { bindMusicToggle, initGameAudio, startGameRadio, bindButtonRipples, playSfx, playLandscapeSfx } from "./audio.js";
import { initClickFeedback } from "./click-feedback.js";
import { syncGameCursor, flashRevealOpenCursor } from "./game-cursor.js";
import { initDeviceMode } from "./device-mode.js";
import { initInputQuarantine } from "./input-quarantine.js";
import { onViewportSettled, requestRender } from "./viewport-sync.js";
import { initCompactChrome } from "./compact-chrome.js";
import { initSomniaPwa } from "./pwa.js";
import { writeLaunchConfig, readStoredLaunchConfig } from "./launch-store.js";
import { initDialogAccessibility } from "./dialog-a11y.js";
import { initPanelLayout } from "./panel-layout.js";
import {
  initBoardZoom,
  syncBoardZoomAfterRender,
  fitBoardToViewport,
  setBoardZoomChangeHandler,
  setBoardCameraMoveHandler,
  focusOnLandscape,
  focusOnDreamer,
} from "./board-zoom.js";
import { initPauseMenu, openPauseMenu } from "./pause-menu.js";
import { initFxLayer, burstSparklesAtElement } from "./fx.js";
import { initMomentOverlay, resetMomentOverlay } from "./moment-overlay.js";
import {
  runPendingCardFx,
  syncHandRemovals,
  updateHandSnapshots,
  resetHandSnapshots,
} from "./card-fx.js";
import { runPendingBoardFx, syncBoardMotion, resetBoardMotion } from "./board-fx.js";
import { playOpeningCinematic } from "./opening-cinematic.js";
import { calculateFinalScore } from "./scoring.js";
import { seedRandomness } from "./rng.js";
import { fetchHighScores, submitHighScore, validateScoreName, isStandaloneMode } from "./highscores.js";
import {
  canSaveGame,
  buildSaveLabel,
  saveGameLocal,
  loadGameLocal,
  saveGameCloud,
  listCloudSaves,
  loadCloudSave,
  deleteCloudSave,
  deleteLocalSave,
  reattachGameRuntime,
  listLocalSaves,
} from "./game-save.js";
import {
  clearActionHistory,
  recordActionCheckpoint,
  canUndoAction,
  popActionCheckpoint,
  restorePlayState,
  undoStackSize,
} from "./action-history.js";
import { recoverLegacySilver } from "./event-choices.js";
import { updateFinalRecurrenceAtmosphere } from "./final-recurrence-atmosphere.js";
import { syncDeckPressure } from "./deck-pressure.js";
import { startVictoryCelebration, stopVictoryCelebration } from "./victory-celebration.js";
import { LENGTHS, loadGameData } from "./data.js";
import {
  createInitialState,
  addLog,
  respawnDreamer,
  getPhase,
  activePlayer,
  avoidDreamerDeath,
  acceptDreamerDeath,
  isBlockingGameChoice,
  blockingChoiceLabel,
  encounterKey,
  checkDefeat,
} from "./state.js";
import {
  getPhaseActions,
  getPhaseAdvanceAction,
  getPhaseOpenerAction,
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
  finishLandscapeMindstreamPick,
  finishLandscapeDeckFlip,
  spendLucidityRevealOnDeck,
  tryDrawMindstreamFromDeck,
  tradeAction,
  selectTradePartner,
  confirmTrade,
  cancelTrade,
  playObject,
  activateObject,
  powerBonus,
  refundPowerBonus,
  togglePhasePowerToken,
  getPowerTokenRadialOptions,
  getDreamerBoardRadialOptions,
  useDreamerPower,
  toggleHandCard,
  handleQuestComplete,
  handleUseArchetypePower,
  handleDefeatFinalArchetype,
  handleSacrificeForFinal,
  endPhase,
  getPhaseHint,
  getLegalExploreTargets,
  resolvePendingDeathDream,
  getEffectHelpers,
  canDreamerMeetOnLandscape,
} from "./game.js";
import { encounterAcceptSummary, encounterRejectSummary, encounterPowerLabel } from "./dreambeasts.js";
import { requestEndPhase } from "./phase-skip.js";
import { initDevConsole } from "./dev-console.js";
import { enableDevMode } from "./dev-commands.js";
import { narrate } from "./narrator.js";
import { cancelPendingReturn, pickRepressCard, confirmRepressStep } from "./subconscious.js";
import { getLandscapePickHighlights, resolveStaleLandscapePick } from "./landscapes.js";
import {
  resolveDreamerPowerChoice,
  resolveDreamerPowerDeckPick,
  resolveDreamerPowerHandPick,
} from "./dreamer-powers.js";
import { resolveNothingChoice } from "./objects.js";
import { resolveObjectChoice } from "./object-effects.js";
import { resolveDreamChoice } from "./dream-choices.js";
import { resolveEffectChoice } from "./effect-choices.js";
import { continueDeferredEventQueues } from "./event-choices.js";
import { continueArchetypeQueues } from "./archetypes.js";
import { phaseOpeningActive, encounterPayHint, actorOnLandscape } from "./rules.js";
import {
  TUTORIAL_STEPS,
  tutorialBriefHtml,
  markTutorialSeen,
  markGentleStartUsed,
} from "./guide.js";
import {
  createTutorialState,
  syncTutorial,
  advanceTutorialStep,
  retreatTutorialStep,
  jumpTutorialToStep,
  completeTutorialGame,
  releaseTutorialToPractice,
  graduateTutorialToPlay,
  notifyTutorialDreamDrawn,
  notifyTutorialArchetypeAcquired,
  isInteractiveTutorialActive,
  getTutorialStep,
  isTutorialActionAllowed,
  tutorialActionBlocked,
  applyTutorialPhaseGates,
  classifyPhaseAction,
  getTutorialPickHighlights,
  getTutorialExploreLegalMoveIds,
  getTutorialCameraFocus,
  currentRailBeat,
  RECOMMENDED_STARTER_IDS,
} from "./tutorial-mode.js";
import {
  renderBoard,
  renderPlayers,
  renderHand,
  renderSpreadTray,
  playDreamerHandSparkle,
  renderPowerTokens,
  showPowerTokenRadial,
  showRadialMenu,
  hideRadialMenu,
  repositionRadialMenu,
  renderMeetPoolGuide,
  renderPhaseSpendHands,
  renderCoopMeetHands,
  renderObjects,
  renderDecks,
  resetDeckColumnRender,
  syncDeckColumnFit,
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
  showDreamerDetailOverlay,
  showDreamerDetail,
  hideDreamerDetailTooltip,
  showDreamerPowerChoice,
  showObjectCardPicker,
  showObjectReorderPicker,
  showObjectSpendPicker,
  showDreamerPowerDeckPicker,
  showDeckFlipPicker,
  showTradeControls,
  showRespawnPicker,
  showDeathChoiceModal,
  showNothingChoiceModal,
  hideUtilityModal,
  handleUtilityModalDismiss,
  setUtilityModalRequired,
  restoreUtilityModal,
  showSubconsciousPicker,
  showSubconsciousBrowse,
  showDiscardPileModal,
  showRevealedTopsModal,
  showRevealDeckTopModal,
  showRepressPicker,
  renderSubconsciousButton,
  renderActionMomentBanner,
  showRulesModal,
  showDreamFeedModal,
  showMomentHistoryModal,
  showOverviewModal,
  resetQuestReadyFlashes,
  hideDreamerDetailOverlay,
  suppressDreamerOverlay,
  showTutorialStep,
  showTutorialBrief,
  hideTutorialBrief,
  updateTutorialStepUI,
  hideTutorial,
  getTutorialSpotlightRect,
  refreshTutorialSpotlight,
  trackTutorialSpotlightWithCamera,
  applyTutorialHighlight,
  bindUiRenderState,
  ensureTutorialStepTargetsVisible,
} from "./ui.js";

let gameData = null;
let state = null;
let launchConfig = null;
let autoSaveTimer = null;
let devConsole = null;
let tutorialIndex = -1;
let interactiveTutorialActive = false;
let tutorialBriefPending = false;
let lastTutorialSyncKey = null;
let lastTutorialStepId = null;
let lastTutorialCameraKey = null;
let pendingDreamerFocusId = null;
let pendingDreamerRadial = null;
let dockSelectTimer = null;
const DOCK_SELECT_DELAY_MS = 280;
let tutorialAutoAdvanceTimer = null;
let fullscreenReady = false;
const lastCardClick = { id: null, time: 0 };
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
  initDeviceMode(); // also starts viewport-sync (measure phase)
  initInputQuarantine(); // seal overlays + Safari gesture guard before any UI mounts
  initSomniaPwa();
  initCompactChrome();
  initDialogAccessibility();
  initFxLayer();
  initMomentOverlay();
  bindButtonRipples();
  initClickFeedback();
  initGameAudio();
  bindMusicToggle();
  initPanelLayout();
  initPauseMenu({ gameSaveHooks: buildPauseSaveHooks() });
  gameData = await loadGameData();
  bindModal();
  bindHelp();
  bindBoardResize();
  bindDeckColumnResize();
  initBoardZoom();
  setBoardZoomChangeHandler(() => {
    renderBoardArea();
    repositionRadialMenu();
    refreshTutorialSpotlight();
    trackTutorialSpotlightWithCamera(480);
  });
  // Called at most once per animation frame by board-zoom (see flushTransform).
  // Only an animated focus snap needs the 480 ms rAF tracker; a finger pan gets
  // one reposition per frame — the old code restarted the tracker on every
  // pointermove, spawning overlapping rAF loops that re-measured the spotlight.
  setBoardCameraMoveHandler((animated) => {
    repositionRadialMenu();
    refreshTutorialSpotlight();
    if (animated) trackTutorialSpotlightWithCamera(480);
  });
  bindFullscreenPrompt();
  bindImageDragGuard();
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

  await startGame(config);
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
      const validResume = Boolean(config?.resumeSaveId || config?.resumeCloudSaveId);
      const validNewGame = config?.lengthKey
        && Array.isArray(config.selectedDreamerIds)
        && config.selectedDreamerIds.length;
      if (validResume || validNewGame) {
        writeLaunchConfig(config);
        const clean = new URL(window.location.href);
        clean.searchParams.delete("launch");
        history.replaceState(null, "", `${clean.pathname}${clean.search}${clean.hash}`);
        return config;
      }
    }

    const stored = readStoredLaunchConfig();
    if (stored) return stored;
    const playing = listLocalSaves().filter((save) => save.status === "playing");
    const autosave = playing.find((save) => save.id === "autosave") || playing[0];
    if (!autosave) return null;
    const resume = { resumeSaveId: autosave.id, launchedAt: Date.now() };
    writeLaunchConfig(resume);
    return resume;
  } catch {
    return null;
  }
}

/* ---- Screen wake lock -------------------------------------------------------
   A co-op turn can take minutes; without this an iPad dims and locks
   mid-discussion. Safari 16.4+ supports screen wake locks (gesture required,
   auto-released when the page is hidden, so re-request on return). */
let wakeLock = null;
let wakeLockWanted = false;
let wakeLockPending = false;

async function requestWakeLock() {
  if (!wakeLockWanted || !("wakeLock" in navigator)) return;
  if (wakeLockPending || (wakeLock && !wakeLock.released)) return;
  if (document.visibilityState !== "visible") return;
  wakeLockPending = true;
  try {
    const sentinel = await navigator.wakeLock.request("screen");
    if (!wakeLockWanted) {
      sentinel.release().catch(() => {});
      return;
    }
    wakeLock = sentinel;
    sentinel.addEventListener("release", () => {
      if (wakeLock === sentinel) wakeLock = null;
    });
  } catch {
    wakeLock = null;
  } finally {
    wakeLockPending = false;
  }
}

function keepScreenAwake() {
  if (wakeLockWanted) return;
  wakeLockWanted = true;
  requestWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestWakeLock();
  });
}

function releaseWakeLock() {
  wakeLockWanted = false;
  wakeLock?.release?.().catch?.(() => {});
  wakeLock = null;
}

/** iPadOS starts a native image drag on long-press; that cancels our
 *  long-press-to-inspect pointer, so refuse drags from table art. */
function bindImageDragGuard() {
  document.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) event.preventDefault();
  });
}

function bindFullscreenPrompt() {
  const prompt = document.getElementById("fullscreen-prompt");
  if (!prompt) return;

  const enter = async () => {
    if (fullscreenReady) return;
    fullscreenReady = true;
    prompt.classList.add("hidden");
    startGameRadio();
    keepScreenAwake();
    const wantsCinematic = state && !launchConfig?.resumeSaveId && !state.tutorialMode;
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* fullscreen denied or unsupported — game still runs */
    }
    if (wantsCinematic) {
      // If fullscreen actually engaged, the viewport resize trails the
      // promise — wait until the size goes quiet before measuring tiles.
      if (document.fullscreenElement) {
        await new Promise((resolve) => {
          let lastW = window.innerWidth;
          let lastH = window.innerHeight;
          let lastChange = Date.now();
          const t0 = lastChange;
          const noteChange = () => { lastChange = Date.now(); };
          window.addEventListener("resize", noteChange);
          const tick = () => {
            if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
              lastW = window.innerWidth;
              lastH = window.innerHeight;
              noteChange();
            }
            const quietFor = Date.now() - lastChange;
            if (quietFor >= 300 || Date.now() - t0 >= 1500) {
              window.removeEventListener("resize", noteChange);
              resolve();
              return;
            }
            window.setTimeout(tick, 60);
          };
          tick();
        });
      }
      fitBoardToViewport();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (playOpeningCinematic(state) === 0) {
        document.body.classList.remove("opening-cinematic-pending");
      }
    } else {
      document.body.classList.remove("opening-cinematic-pending");
    }
    prompt.remove();
  };

  prompt.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    enter();
  });
  prompt.addEventListener("click", enter);
  prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enter();
    }
  });
}

function applyPowerTokenUse(id) {
  if (!state) return;
  if (id === "quest0") {
    const result = handleQuestComplete(state, 0);
    if (result === "acquired") {
      notifyTutorialArchetypeAcquired(state);
      playSfx("acquire");
      requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("acquired-archetypes"), 16, "#f0c96a"));
    }
    renderAll();
    return;
  }
  if (id === "quest1") {
    const result = handleQuestComplete(state, 1);
    if (result === "acquired") {
      notifyTutorialArchetypeAcquired(state);
      playSfx("acquire");
      requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("acquired-archetypes"), 16, "#f0c96a"));
    }
    renderAll();
    return;
  }
  if (id === "spreadPlus") {
    powerBonus(state);
    renderAll();
    return;
  }
  if (id === "spreadMinus") {
    refundPowerBonus(state);
    renderAll();
    return;
  }
  if (id === "phasePsyche") {
    togglePhasePowerToken(state);
    renderAll();
    return;
  }
  if (id === "activatePersistent") {
    activateObject(state);
    renderAll();
  }
}

function openPowerTokenRadial(anchorEl) {
  if (!state) return;
  const options = getPowerTokenRadialOptions(state).map((opt) => ({
    ...opt,
    disabled: opt.disabled || !isTutorialActionAllowed(state, opt.kind),
  }));
  showPowerTokenRadial(anchorEl, options, (opt) => {
    if (!isTutorialActionAllowed(state, opt.kind)) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    applyPowerTokenUse(opt.id);
  });
}

function bindPowerBonus() {
  document.getElementById("btn-power-bonus")?.addEventListener("click", () => {
    if (!state) return;
    if (!isTutorialActionAllowed(state, "powerBonus")) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    powerBonus(state);
    renderAll();
  });
  document.getElementById("btn-power-bonus-undo")?.addEventListener("click", () => {
    if (!state) return;
    if (!isTutorialActionAllowed(state, "refundPowerBonus")) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    refundPowerBonus(state);
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
        const boardLabel = isStandaloneMode() ? "local high scores" : "the leaderboard";
        status.textContent = result.inTop
          ? `Saved! Rank #${result.rank} on ${boardLabel}.`
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
    if (isStandaloneMode() && status) {
      status.textContent = scores.length
        ? "Scores saved on this device only."
        : "No scores yet — be the first on this device.";
    } else if (setupRequired && status) {
      status.textContent = "Leaderboard not configured yet. See google-apps-script/somnia-highscores-backend.gs";
    }
    renderLeaderboardList(scores);
  } catch {
    /* optional */
  }
}

function bindRestart() {
  document.getElementById("btn-restart").addEventListener("click", () => {
    returnToMainMenu();
  });

  document.getElementById("btn-replay-tutorial")?.addEventListener("click", () => {
    launchReplayTutorial();
  });
  document.getElementById("btn-start-daydream")?.addEventListener("click", () => {
    stopVictoryCelebration();
    launchGentleDaydream();
  });
}

function bindHeaderDropdowns() {
  /* Dreamers / Overview / Tips left the header in 21.3. */
}

function bindHelp() {
  document.getElementById("btn-moment-history")?.addEventListener("click", () => {
    if (!isTutorialActionAllowed(state, "headerMomentHistory")) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    showMomentHistoryModal();
  });
  document.getElementById("btn-dream-feed")?.addEventListener("click", () => {
    if (!isTutorialActionAllowed(state, "headerDreamFeed")) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    showDreamFeedModal(state);
  });
  document.getElementById("btn-header-subconscious")?.addEventListener("click", () => {
    if (!isTutorialActionAllowed(state, "headerSubconscious")) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    showSubconsciousBrowse(state, (card) => showModal(card));
  });
  document.getElementById("btn-end-overview")?.addEventListener("click", showOverviewModal);
  document.getElementById("btn-pause")?.addEventListener("click", () => {
    if (!isTutorialActionAllowed(state, "headerPause")) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    openPauseMenu();
  });
  bindHeaderDropdowns();
}

function bindModal() {
  document.querySelector("#card-modal .modal-backdrop").addEventListener("click", hideModal);
  document.querySelector("#card-modal .modal-close").addEventListener("click", hideModal);
  document.querySelector("#utility-modal .utility-backdrop")?.addEventListener("click", handleUtilityModalDismiss);
  document.querySelector("#utility-modal .utility-close")?.addEventListener("click", handleUtilityModalDismiss);
  document.getElementById("utility-choice-restore")?.addEventListener("click", restoreUtilityModal);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const utilityModal = document.getElementById("utility-modal");
    if (!utilityModal || utilityModal.classList.contains("hidden")) return;
    if (utilityModal.classList.contains("utility-modal-minimized")) {
      event.preventDefault();
      restoreUtilityModal();
      return;
    }
    if (isBlockingGameChoice(state)) {
      event.preventDefault();
      handleUtilityModalDismiss();
    }
  });
}

/**
 * VIEWPORT SYNC: the board re-renders exactly once per settle. The ResizeObserver
 * (which fires after panel-layout's CSS variables resize #board-viewport) and the
 * settle lane's render phase both funnel into requestRender(), which coalesces to a
 * single renderAll() in the next animation frame. Previously the observer's own
 * 80 ms timer and board-zoom's refit each produced a full board build.
 */
function bindBoardResize() {
  const vp = document.getElementById("board-viewport");
  if (!vp || vp.dataset.resizeBound) return;
  vp.dataset.resizeBound = "1";
  let renderedW = -1;
  let renderedH = -1;
  const renderForViewport = () => {
    if (!state) return;
    renderedW = vp.clientWidth;
    renderedH = vp.clientHeight;
    renderAll();
  };
  const observer = new ResizeObserver((entries) => {
    if (!state) return;
    const box = entries[0]?.contentRect;
    // The settle render already measured this exact box — nothing new to draw.
    if (box && Math.round(box.width) === renderedW && Math.round(box.height) === renderedH) return;
    requestRender();
  });
  observer.observe(vp);
  onViewportSettled("render", renderForViewport);
}

function bindDeckColumnResize() {
  const column = document.getElementById("deck-column");
  const table = document.getElementById("table-surface");
  if (!column || column.dataset.resizeBound) return;
  column.dataset.resizeBound = "1";
  const sync = () => syncDeckColumnFit();
  const observer = new ResizeObserver(sync);
  observer.observe(column);
  if (table) observer.observe(table);
  window.addEventListener("resize", sync);
}

function buildPauseSaveHooks() {
  return {
    canSave: () => canSaveGame(state),
    saveLabel: () => (state ? buildSaveLabel(state) : ""),
    isStandalone: () => isStandaloneMode(),
    getGameId: () => state?.gameId || null,
    getSeed: () => state?.seed || null,
    saveLocal: async () => {
      if (!canSaveGame(state)) throw new Error("Cannot save right now.");
      await saveGameLocal(state, launchConfig, { id: "autosave" });
    },
    saveCloud: async (name) => {
      if (!canSaveGame(state)) throw new Error("Cannot save right now.");
      const valid = name?.ok ? name : validateScoreName(name?.first, name?.last);
      if (!valid.ok) throw new Error(valid.message);
      await saveGameCloud(state, launchConfig, { playerName: valid.name });
    },
    loadLocal: async () => {
      const loaded = await loadGameLocal("autosave");
      if (!loaded) throw new Error("No device save found.");
      applyLoadedGame(loaded);
    },
    listLocal: () => listLocalSaves(),
    loadLocalById: async (id) => {
      const loaded = await loadGameLocal(id);
      if (!loaded) throw new Error("Device save not found.");
      applyLoadedGame(loaded);
    },
    deleteLocal: (id) => {
      deleteLocalSave(id);
    },
    saveAndExit: async () => {
      if (canSaveGame(state)) {
        await saveGameLocal(state, launchConfig, { id: "autosave" });
      }
      window.location.href = "index.html";
    },
    listCloud: async (name) => {
      const valid = name?.ok ? name : validateScoreName(name?.first, name?.last);
      if (!valid.ok) throw new Error(valid.message);
      const result = await listCloudSaves(valid.name);
      if (result.setupRequired) {
        throw new Error("Cloud saves are not configured on this server yet.");
      }
      return result.saves || [];
    },
    loadCloud: async (id) => {
      const loaded = await loadCloudSave(id);
      if (!loaded) throw new Error("Save not found.");
      applyLoadedGame(loaded);
    },
    deleteCloud: async (id) => {
      await deleteCloudSave(id);
    },
  };
}

function applyLoadedGame(loaded) {
  clearActionHistory();
  state = reattachGameRuntime(loaded.state);
  seedRandomness(state?.seed || null);
  recoverLegacySilver(state);
  launchConfig = {
    ...loaded.launchConfig,
    launchedAt: Date.now(),
    resumeSaveId: "autosave",
  };
  interactiveTutorialActive = false;
  document.body.classList.remove("tutorial-mode-active");
  hideTutorial();
  showScreen("screen-game");
  fitBoardToViewport();
  resetHandSnapshots(state);
  resetDeckColumnRender();
  resetBoardMotion(state);
  renderAll();
  narrate(state, "Dream resumed", loaded.label || "Your saved dream continues.");
}

function undoLastTableAction() {
  const prev = popActionCheckpoint();
  if (!prev || !state) return;
  hideRadialMenu();
  hideUtilityModal(true);
  restorePlayState(state, prev);
  reattachGameRuntime(state);
  recoverLegacySilver(state);
  resetHandSnapshots(state);
  resetDeckColumnRender();
  resetBoardMotion(state);
  lastTutorialSyncKey = null;
  lastTutorialStepId = null;
  lastTutorialCameraKey = null;
  pendingDreamerRadial = null;
  addLog(state, "Back — the last action was undone.");
  renderAll();
}

function scheduleAutoSave() {
  if (!canSaveGame(state)) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveGameLocal(state, launchConfig, { id: "autosave" }).catch(() => {});
  }, 1500);
}

function clearAutosave() {
  clearTimeout(autoSaveTimer);
  deleteLocalSave("autosave");
}

async function startGame(config) {
  launchConfig = config;
  clearActionHistory();

  if (config.resumeSaveId) {
    const loaded = await loadGameLocal(config.resumeSaveId);
    if (!loaded) {
      window.location.replace("index.html");
      return;
    }
    applyLoadedGame(loaded);
    return;
  }

  if (config.resumeCloudSaveId) {
    try {
      const loaded = await loadCloudSave(config.resumeCloudSaveId);
      if (!loaded) throw new Error("Save not found.");
      applyLoadedGame(loaded);
    } catch {
      window.location.replace("index.html");
    }
    return;
  }

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
    tutorialBriefPending = true;
    document.body.classList.add("tutorial-mode-active");
    narrate(
      state,
      "Tutorial Mode",
      "On-rails: click the highlighted Dreamer, cards, and hexes. The table keeps what you reveal.",
      ["Follow the progress bar — each step names the exact click."],
    );
  } else {
    state = createInitialState(gameData, {
      lengthKey: config.lengthKey,
      selectedDreamers,
      gentleStart: !!config.gentleStart,
      seed: config.seed || null,
    });
    // Hide the table until the opening deal plays (removed when it starts/skips).
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      document.body.classList.add("opening-cinematic-pending");
    }
    if (config.gentleStart) markGentleStartUsed();
    const opening = state.board.find((t) => !t.center && t.revealed && !t.wasteland);
    const openingLine = state.seedFlags?.somnia
      ? "The whole inner ring begins Revealed around The Bed (SOMNIA seed)."
      : opening
        ? `${opening.name} is the only Landscape touching The Bed that begins Revealed.`
        : "Only one Landscape touching The Bed begins Revealed.";
    const startTokens = state.players[0]?.powerTokens ?? 1;
    const seedLine = state.seed
      ? ` Game ID ${state.gameId} — enter it as a seed on the menu to replay this exact dream.`
      : "";
    narrate(
      state,
      "The Dreamscape forms",
      `Each Dreamer starts on The Bed with 5 Psyche and ${startTokens} Power Token${startTokens === 1 ? "" : "s"}. The Dreamscape is shuffled: ${openingLine}${seedLine} Round 1 begins in the Reveal Phase — discuss, plan, and act in any order. The Head Dreamer (★) should Draw the Dream when the group is ready.`,
      ["Reveal Phase: spend 1 Lucidity to flip Landscapes on the hex map"],
    );
  }

  showScreen("screen-game");
  resetMomentOverlay();
  resetQuestReadyFlashes();
  fitBoardToViewport();
  resetHandSnapshots(state);
  resetDeckColumnRender();
  resetBoardMotion(state);
  renderAll();
  if (config.tutorialMode) {
    showTutorialBrief(tutorialBriefHtml(), () => {
      tutorialBriefPending = false;
      syncInteractiveTutorial();
    });
  }
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
    onBack: handleTutorialBack,
  });
}

function handleTutorialJump(stepIndex) {
  if (!state?.tutorialMode || !isInteractiveTutorialActive(state)) return;
  if (stepIndex === state.tutorialStepIndex) return;
  jumpTutorialToStep(state, stepIndex);
  lastTutorialSyncKey = null;
  lastTutorialStepId = null;
  lastTutorialCameraKey = null;
  renderAll();
  const sync = syncTutorial(state);
  if (!sync || sync.complete) return;
  showTutorialStep(sync.step, sync.stepIndex, sync.total, {
    canAdvance: sync.canAdvance,
    roundLabel: sync.round,
    objective: sync.objective,
    onNext: handleTutorialNext,
    onSkip: handleTutorialSkip,
    onBack: handleTutorialBack,
    onJump: handleTutorialJump,
  });
  lastTutorialSyncKey = `${sync.stepIndex}:${sync.canAdvance}:${sync.step.id}`;
}

function handleTutorialBack() {
  if (state?.tutorialMode && isInteractiveTutorialActive(state)) {
    if (!retreatTutorialStep(state)) return;
    lastTutorialSyncKey = null;
    lastTutorialStepId = null;
    lastTutorialCameraKey = null;
    renderAll();
    const sync = syncTutorial(state);
    if (!sync || sync.complete) return;
    showTutorialStep(sync.step, sync.stepIndex, sync.total, {
      canAdvance: sync.canAdvance,
      roundLabel: sync.round,
      objective: sync.objective,
      onNext: handleTutorialNext,
      onSkip: handleTutorialSkip,
      onBack: handleTutorialBack,
      onJump: handleTutorialJump,
    });
    lastTutorialSyncKey = `${sync.stepIndex}:${sync.canAdvance}:${sync.step.id}`;
    return;
  }

  if (tutorialIndex > 0) {
    tutorialIndex -= 1;
    showTutorialAt(tutorialIndex);
  }
}

function finishTutorial() {
  hideTutorial();
  tutorialIndex = -1;
  markTutorialSeen();
  renderAll();
}

function handleTutorialSkip() {
  if (!confirm("Leave the guided steps? You can keep practicing on this table.")) return;
  clearTimeout(tutorialAutoAdvanceTimer);
  tutorialAutoAdvanceTimer = null;
  releaseTutorialToPractice(state);
  hideTutorial();
  interactiveTutorialActive = false;
  document.body.classList.remove("tutorial-mode-active");
  markTutorialSeen();
  lastTutorialSyncKey = null;
  lastTutorialStepId = null;
  lastTutorialCameraKey = null;
  narrate(
    state,
    "Practice table",
    "Open ? for the Dream Guide anytime. Return to the menu when you want a real Daydream.",
  );
  renderAll();
}

function scheduleTutorialAutoAdvance() {
  clearTimeout(tutorialAutoAdvanceTimer);
  tutorialAutoAdvanceTimer = setTimeout(() => {
    tutorialAutoAdvanceTimer = null;
    if (!isInteractiveTutorialActive(state)) return;
    const latest = syncTutorial(state);
    if (!latest?.step?.until || !latest.canAdvance) return;
    handleTutorialNext();
  }, 650);
}

function showTutorialGraduationPanel() {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="tutorial-graduate-panel">
      <h2>Tutorial complete</h2>
      <p>You finished the guided walkthrough. Replay it or return to the main menu.</p>
      <div class="utility-actions tutorial-graduate-actions">
        <button type="button" class="btn primary" id="tutorial-graduate-replay">Replay Tutorial</button>
        <button type="button" class="btn" id="tutorial-graduate-menu">Main Menu</button>
      </div>
    </div>
  `;

  body.querySelector("#tutorial-graduate-replay")?.addEventListener("click", () => {
    hideUtilityModal(true);
    launchReplayTutorial();
  });
  body.querySelector("#tutorial-graduate-menu")?.addEventListener("click", () => {
    hideUtilityModal(true);
    returnToMainMenu();
  });

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function finishTutorialGuidance() {
  graduateTutorialToPlay(state);
  hideTutorial();
  interactiveTutorialActive = false;
  document.body.classList.remove("tutorial-mode-active");
  markTutorialSeen();
  lastTutorialSyncKey = null;
  lastTutorialStepId = null;
  lastTutorialCameraKey = null;
  renderAll();
  showTutorialGraduationPanel();
}

function showTutorialGraduation() {
  finishTutorialGuidance();
}

function launchGentleDaydream() {
  writeLaunchConfig({
    lengthKey: "daydream",
    selectedDreamerIds: [...RECOMMENDED_STARTER_IDS],
    gentleStart: true,
    launchedAt: Date.now(),
  });
  const playUrl = new URL("play.html", window.location.href);
  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    playUrl.searchParams.set("dev", "1");
  }
  window.location.href = playUrl.href;
}

function launchReplayTutorial() {
  writeLaunchConfig({
    lengthKey: "daydream",
    selectedDreamerIds: [...RECOMMENDED_STARTER_IDS],
    tutorialMode: true,
    launchedAt: Date.now(),
  });
  window.location.href = "play.html";
}

function returnToMainMenu() {
  stopVictoryCelebration();
  releaseWakeLock();
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  window.location.href = "index.html";
}

function handleTutorialNext() {
  const current = syncTutorial(state);
  if (current?.step?.until && !current.canAdvance) return;

  const fromRect = getTutorialSpotlightRect();
  advanceTutorialStep(state);
  if (state.tutorialComplete) {
    completeTutorialGame(state);
    renderAll();
    return;
  }
  lastTutorialSyncKey = null;
  lastTutorialStepId = null;
  lastTutorialCameraKey = null;
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
    onBack: handleTutorialBack,
    onJump: handleTutorialJump,
  });
  lastTutorialSyncKey = `${nextSync.stepIndex}:${nextSync.canAdvance}:${nextSync.step.id}:${nextSync.step.spotlightBeat?.kind || "none"}:${nextSync.objective}`;
}

function syncInteractiveTutorial() {
  if (tutorialBriefPending) {
    hideTutorial();
    return;
  }
  if (!isInteractiveTutorialActive(state)) {
    hideTutorial();
    document.body.classList.remove("tutorial-mode-active");
    return;
  }

  const sync = syncTutorial(state);
  if (!sync) return;

  if (sync.complete) {
    completeTutorialGame(state);
    renderAll();
    return;
  }

  const { step, stepIndex, total, canAdvance, round, objective } = sync;
  const beatKind = step.spotlightBeat?.kind || "none";
  const syncKey = `${stepIndex}:${canAdvance}:${step.id}:${beatKind}:${objective}`;
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
    if (step.until && canAdvance) scheduleTutorialAutoAdvance();
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
    onBack: handleTutorialBack,
    onJump: handleTutorialJump,
  });
}

function queueDreamerBoardFocus(landscapeId) {
  if (!landscapeId) return;
  pendingDreamerFocusId = landscapeId;
  lastTutorialCameraKey = null;
}

function flushDreamerBoardFocus() {
  if (!pendingDreamerFocusId) return false;
  const tileId = pendingDreamerFocusId;
  pendingDreamerFocusId = null;
  focusOnLandscape(tileId);
  return true;
}

function maybeFocusTutorialLandscape() {
  if (!isInteractiveTutorialActive(state)) {
    lastTutorialCameraKey = null;
    return;
  }
  const focus = getTutorialCameraFocus(state);
  if (!focus?.tileId) return;
  if (focus.key === lastTutorialCameraKey) return;
  lastTutorialCameraKey = focus.key;
  focusOnLandscape(focus.tileId, { zoom: focus.zoom });
}

function buildPhaseHandlers() {
  return {
    drawDream: () => {
      const card = drawDreamCard(state, showModal);
      if (card) notifyTutorialDreamDrawn(state);
      renderAll();
    },
    revealLandscape: () => {
      revealLandscape(state);
      if (state.landscapePick?.mode === "reveal-deck-tops") {
        showRevealDeckTopModal((suit) => {
          hideUtilityModal(true);
          spendLucidityRevealOnDeck(state, suit);
          renderAll();
        });
      }
      renderAll();
    },
    revealDeckTop: () => {
      showRevealDeckTopModal((suit) => {
        hideUtilityModal(true);
        spendLucidityRevealOnDeck(state, suit);
        renderAll();
      });
    },
    activateExplore: () => { activateExplore(state); renderAll(); },
    gainMeetActions: () => { gainMeetActions(state); renderAll(); },
    meetEncounter: (mode) => {
      meetEncounter(state, mode, { onDone: () => renderAll() });
      renderAll();
    },
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
            const result = performLandscapeAction(state, actionId, {
              onResult: (card) => showModal(card),
            });
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
        notifyTutorialArchetypeAcquired(state);
        playSfx("acquire");
        requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("acquired-archetypes"), 16, "#f0c96a"));
      }
      renderAll();
    },
    useArchetypePower: (id) => {
      handleUseArchetypePower(state, id);
      if (state.tutorialMode) state.tutorialFlags.archetypePowerUsed = true;
      renderAll();
    },
    useDreamerPower: () => {
      const result = useDreamerPower(state);
      if (result?.ui) processDreamerPowerResult(result);
      else renderAll();
    },
    togglePhasePowerToken: () => {
      togglePhasePowerToken(state);
      renderAll();
    },
    powerBonus: () => {
      powerBonus(state);
      renderAll();
    },
    refundPowerBonus: () => {
      refundPowerBonus(state);
      renderAll();
    },
    defeatFinalArchetype: () => { handleDefeatFinalArchetype(state); renderAll(); },
    sacrificeForFinal: () => { handleSacrificeForFinal(state); renderAll(); },
    nextPhase: () => { requestEndPhase(state, () => renderAll()); },
  };
}

let lastDreamerTokenTap = { id: null, time: 0 };

function onObjectCardClick(card, zone) {
  const player = activePlayer(state);
  showModal(card, {
    objectZone: zone,
    canSpendPower: (player?.powerTokens || 0) >= 1,
    onUse: () => {
      hideModal();
      playObject(state, card.instanceId || card.id, { usePower: zone === "persistent" });
      renderAll();
    },
  });
}

function shortenRadialLabel(text, max = 20) {
  const raw = (text || "").trim();
  if (!raw) return "";
  const aliases = [
    [/^Draw & Resolve Dream$/i, "Draw Dream"],
    [/^Reveal Landscapes \(select Lucidity\)$/i, "Reveal"],
    [/^Reveal Landscapes \((\d+) for team\)$/i, "Reveal ($1)"],
    [/^Power Token as 1 (.+) \(on\)$/i, "Token as $1"],
    [/^Power Token as 1 (.+)$/i, "Token as $1"],
  ];
  let label = raw;
  for (const [pattern, replacement] of aliases) {
    if (pattern.test(label)) {
      label = label.replace(pattern, replacement);
      break;
    }
  }
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function clearDockSelectTimer() {
  if (!dockSelectTimer) return;
  clearTimeout(dockSelectTimer);
  dockSelectTimer = null;
}

function zoomMaxOnDreamer(playerId, tileId) {
  clearDockSelectTimer();
  pendingDreamerFocusId = null;
  pendingDreamerRadial = null;
  hideRadialMenu();
  hideUtilityModal(true);
  suppressDreamerOverlay(800);
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex >= 0) state.activePlayerIndex = playerIndex;
  if (getPhase(state) === "Meet" && tileId) state.selectedLandscapeId = tileId;
  if (playerId && tileId) focusOnDreamer(playerId, tileId);
  if (tileId) playLandscapeSfx(tileId);
  renderAll();
  suppressDreamerOverlay(800);
}

function showDreamerBoardRadialMenu(playerId, tileId, player) {
  if (isInteractiveTutorialActive(state)) {
    syncTutorial(state);
  }
  const handlers = buildPhaseHandlers();
  const options = getDreamerBoardRadialOptions(state, player, tileId, handlers)
    .map((opt) => {
      const kind = opt.kind || classifyPhaseAction({ label: opt.label });
      const allowed = !isInteractiveTutorialActive(state)
        || !kind
        || kind === "other"
        || isTutorialActionAllowed(state, kind, { action: opt, tileId });
      return {
        ...opt,
        label: shortenRadialLabel(opt.label),
        kind,
        disabled: !!opt.disabled || !allowed,
      };
    });

  options.unshift({
    id: "view",
    label: "View",
    hint: "Zoomed character details and hand",
    disabled: false,
    primary: options.length === 0,
    onPick: () => {},
  });

  const liveToken = document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${playerId}"]`)
    || document.querySelector(`.hex-tile[data-tile-id="${tileId}"]`);
  showRadialMenu(liveToken, options, (opt) => {
    if (opt.kind && !isTutorialActionAllowed(state, opt.kind, { action: opt.action, tileId })) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    opt.onPick?.();
    renderAll();
    if (opt.id === "view") {
      showDreamerDetail(player.dreamer, { player, state });
    }
  }, {
    ariaLabel: `${player.name} actions`,
    resolveAnchor: () => document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${playerId}"]`)
      || document.querySelector(`.hex-tile[data-tile-id="${tileId}"]`),
  });
}

function openDreamerBoardRadial(anchorEl, playerId, tileId) {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex < 0) return;
  clearDockSelectTimer();
  pendingDreamerFocusId = null;
  hideUtilityModal(true);
  const player = state.players[playerIndex];
  const sameDreamer = state.activePlayerIndex === playerIndex;
  const sameMeetTile = getPhase(state) !== "Meet" || state.selectedLandscapeId === tileId;
  state.activePlayerIndex = playerIndex;
  if (getPhase(state) === "Meet") state.selectedLandscapeId = tileId;
  playLandscapeSfx(tileId);
  const liveToken = document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${playerId}"]`);
  if (sameDreamer && sameMeetTile && liveToken?.isConnected) {
    showDreamerBoardRadialMenu(playerId, tileId, player);
    requestAnimationFrame(() => repositionRadialMenu());
    return;
  }
  pendingDreamerRadial = {
    playerId,
    tileId,
    player,
  };
  renderAll();
}

function openBeastBoardRadial(anchorEl, encounter, tileId) {
  const occupant = actorOnLandscape(state, tileId);
  if (occupant) {
    const idx = state.players.findIndex((p) => p.id === occupant.id);
    if (idx >= 0) state.activePlayerIndex = idx;
  }
  state.selectedLandscapeId = tileId;
  state.activeEncounter = encounter;
  state.activeEncounterLandscapeId = tileId;

  const handlers = buildPhaseHandlers();
  const canMeet = occupant && canDreamerMeetOnLandscape(state, occupant, tileId);

  const options = [
    {
      id: "accept",
      label: encounterPowerLabel(encounter, true),
      hint: `${encounterPayHint(encounter, true)} ${encounterAcceptSummary(encounter)} · pool Psyche on ${occupant?.name || "Dreamer"}'s hand`,
      disabled: !canMeet || (isInteractiveTutorialActive(state) && !isTutorialActionAllowed(state, "meetAccept", { tileId })),
      primary: true,
      kind: "meetAccept",
      onPick: () => handlers.meetEncounter("accept"),
    },
    !state.forcedAccept && {
      id: "reject",
      label: encounterPowerLabel(encounter, false),
      hint: `${encounterPayHint(encounter, false)} ${encounterRejectSummary(encounter)} · pool Psyche on ${occupant?.name || "Dreamer"}'s hand`,
      disabled: !canMeet || (isInteractiveTutorialActive(state) && !isTutorialActionAllowed(state, "meetReject", { tileId })),
      kind: "meetReject",
      onPick: () => handlers.meetEncounter("reject"),
    },
    {
      id: "view",
      label: "View",
      hint: "Dreambeast details, costs, and rewards",
      disabled: false,
      onPick: () => showModal(encounter),
    },
  ].filter(Boolean);

  showRadialMenu(anchorEl, options, (opt) => {
    if (opt.kind && !isTutorialActionAllowed(state, opt.kind, { tileId, encounterId: encounter?.id })) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    opt.onPick?.();
    renderAll();
  }, {
    ariaLabel: `${encounter.name} encounter`,
    resolveAnchor: () => document.querySelector(`.hex-occupant-beast[data-encounter-key="${encounterKey(encounter)}"]`)
      || document.querySelector(`.hex-tile[data-tile-id="${tileId}"] .hex-occupant-beast`)
      || document.querySelector(`.hex-tile[data-tile-id="${tileId}"]`),
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
  if (!wasSelected && !isTutorialActionAllowed(state, "handToggle", { card, owner })) {
    tutorialActionBlocked(state);
    renderAll();
    return;
  }
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
let lastObjectChoiceKey = null;

function maybeShowObjectChoice() {
  const pending = state?.pendingDreamChoice || state?.pendingEffectChoice || state?.pendingObjectChoice;
  const kind = state?.pendingDreamChoice ? "dream" : state?.pendingEffectChoice ? "effect" : "object";
  if (!pending) {
    lastObjectChoiceKey = null;
    return;
  }
  const key = `${kind}:${pending.cardId || pending.dreamId}:${pending.step}:${pending.ui}:${(pending.choices || []).map((c) => c.id).join(",")}:${(pending.order || []).length}:${(pending.cards || []).length}`;
  const modalHidden = document.getElementById("utility-modal")?.classList.contains("hidden");
  if (key === lastObjectChoiceKey && !modalHidden) return;
  lastObjectChoiceKey = key;
  const finish = (choiceId) => {
    hideUtilityModal(true);
    if (kind === "dream") resolveDreamChoice(state, choiceId, getEffectHelpers());
    else if (kind === "effect") resolveEffectChoice(state, choiceId, getEffectHelpers());
    else resolveObjectChoice(state, choiceId, getEffectHelpers());
    continueDeferredEventQueues(state);
    continueArchetypeQueues(state);
    lastObjectChoiceKey = null;
    renderAll();
  };
  if (pending.ui === "cards") {
    showObjectCardPicker(pending, finish);
    return;
  }
  if (pending.ui === "reorder") {
    showObjectReorderPicker(pending, finish);
    return;
  }
  if (pending.ui === "spend") {
    const toggleSpend = (choiceId) => {
      if (kind === "dream") resolveDreamChoice(state, choiceId, getEffectHelpers());
      else if (kind === "effect") resolveEffectChoice(state, choiceId, getEffectHelpers());
      else resolveObjectChoice(state, choiceId, getEffectHelpers());
    };
    showObjectSpendPicker(pending, toggleSpend, () => finish("confirm"));
    return;
  }
  showDreamerPowerChoice(pending, finish);
}

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
  if (state?.pendingDreamChoice || state?.pendingEffectChoice || state?.pendingObjectChoice) return;
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
  if (ui.type === "hand") {
    showObjectCardPicker(ui, (cardKey) => {
      dreamerPowerModalKey = null;
      processDreamerPowerResult(resolveDreamerPowerHandPick(state, cardKey));
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
  if (state?.pendingObjectChoice || state?.pendingDreamChoice || state?.pendingEffectChoice) return;
  if (!state?.pendingReturn) {
    lastReturnPickerKey = null;
    return;
  }
  const pending = state.pendingReturn;
  const key = `${pending.remaining}:${pending.picked.length}`;
  if (key === lastReturnPickerKey) return;
  lastReturnPickerKey = key;
  showSubconsciousPicker(state, {
    onConfirm: () => {
      lastReturnPickerKey = null;
      renderAll();
    },
    onSkip: () => {
      cancelPendingReturn(state);
      lastReturnPickerKey = null;
      renderAll();
    },
  });
}

function renderBoardArea() {
  if (!state) return;
  const pickHighlights = getTutorialPickHighlights(state, getLandscapePickHighlights(state));
  let legalMoves = getLegalExploreTargets(state).map((t) => t.id);
  if (isInteractiveTutorialActive(state)) {
    legalMoves = getTutorialExploreLegalMoveIds(state, legalMoves);
  }
  renderBoard(state, (id) => {
    if (!isTutorialActionAllowed(state, "boardClick", { tileId: id })) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    if (pickHighlights.reveal?.includes(id) || pickHighlights.choose?.includes(id)) {
      flashRevealOpenCursor();
    }
    const beat = currentRailBeat(state);
    if (isInteractiveTutorialActive(state) && beat?.kind === "exploreMove" && beat.playerIndex != null) {
      state.activePlayerIndex = beat.playerIndex;
    }
    const result = handleBoardTileClick(state, id);
    renderAll();
    if (result && typeof result === "object" && result.openRadial) {
      openDreamerBoardRadial(null, result.playerId, result.tileId);
    }
  }, legalMoves, pickHighlights, (id) => showLandscapeDetail(state, id, {
    onDreamerClick: (playerId, tileId) => {
      hideUtilityModal(true);
      openDreamerBoardRadial(null, playerId, tileId);
    },
    onBeastClick: (encounter, tileId) => {
      hideUtilityModal(true);
      openBeastBoardRadial(null, encounter, tileId);
    },
  }), {
    onDreamerTokenClick: (playerId, tileId, anchorEl, event) => {
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex < 0) return;
      if (!isTutorialActionAllowed(state, "dreamerSelect", { playerIndex })) {
        tutorialActionBlocked(state);
        return;
      }
      if (event?.detail >= 2) {
        lastDreamerTokenTap = { id: null, time: 0 };
        zoomMaxOnDreamer(playerId, tileId);
        return;
      }
      lastDreamerTokenTap = { id: playerId, time: Date.now() };
      openDreamerBoardRadial(anchorEl, playerId, tileId);
    },
    onBeastTokenClick: (encounter, tileId, anchorEl) => {
      openBeastBoardRadial(anchorEl, encounter, tileId);
    },
  });
  syncBoardZoomAfterRender();
}

function handleDrawPileClick(deckId) {
  if (!state || !deckId) return;
  if (state.tradeMode && deckId.startsWith("mindstream-")) return;

  if (state.landscapePick?.mode === "reveal-deck-tops" && deckId.startsWith("mindstream-")) {
    const suit = deckId.replace("mindstream-", "");
    const flipped = spendLucidityRevealOnDeck(state, suit);
    if (!flipped) {
      showRevealDeckTopModal((nextSuit) => {
        hideUtilityModal(true);
        spendLucidityRevealOnDeck(state, nextSuit);
        renderAll();
      });
    }
    renderAll();
    return;
  }

  if (deckId.startsWith("mindstream-")) {
    const suit = deckId.replace("mindstream-", "");
    const result = tryDrawMindstreamFromDeck(state, suit, {
      onResult: (card) => showModal(card),
    });
    if (result?.ok) {
      renderAll();
      return;
    }
    if (result?.reason === "meet") {
      narrate(state, "Meet first", "Open the Meet phase, then click a Mindstream card back from a matching Landscape.");
      return;
    }
    if (result?.reason === "suit" || result?.reason === "landscape") {
      const tile = result.tile;
      narrate(
        state,
        "Stand on the matching Landscape",
        tile
          ? `${state.players[state.activePlayerIndex]?.name || "That Dreamer"} is on ${tile.name}. Draw ${suit} Mindstream from a matching Landscape, or Forest's Draw Any Mindstream.`
          : "Select a Dreamer standing on a revealed Landscape, then click that Mindstream's card back.",
      );
    }
  }

  const peeked = state.revealedDeckTops?.[deckId] || [];
  if (peeked.length) {
    showRevealedTopsModal(state, deckId, (card) => showModal(card));
    return;
  }
  if (deckId === "dream" || deckId === "psyche") {
    showRevealedTopsModal(state, deckId, (card) => showModal(card));
  }
}

function renderAll() {
  if (!state) return;
  document.body.classList.toggle("seed-dmzemo", !!state.seedFlags?.dmzemo);
  bindUiRenderState(state);
  resolveStaleLandscapePick(state);
  checkDefeat(state);
  if (isInteractiveTutorialActive(state)) {
    syncTutorial(state);
  }

  if (state.status === "won") {
    syncDeckPressure(state);
    clearAutosave();
    hideTutorial();
    interactiveTutorialActive = false;
    document.body.classList.remove("tutorial-mode-active");
    if (!pendingScoreResult) {
      const breakdown = calculateFinalScore(state);
      const lengthLabel = state.tutorialVictory
        ? "Tutorial"
        : (state.lengthKey && LENGTHS[state.lengthKey]
          ? LENGTHS[state.lengthKey].label
          : `${state.goalPoints} pts`);
      const seconds = Math.max(0, Math.round((Date.now() - (state.gameStartedAt || Date.now())) / 1000));
      pendingScoreResult = { breakdown, seconds, difficulty: lengthLabel };
    }
    const msg = state.tutorialVictory
      ? `You collected ${state.acquiredPoints} Archetype point${state.acquiredPoints === 1 ? "" : "s"} and woke on The Bed — the same escape as a real Daydream.`
      : (state.finalRecurrence
        ? "All Remaining Archetypes defeated in the Final Recurrence!"
        : `You collected ${state.acquiredPoints} Archetype points and all Dreamers returned to the Bed!`);
    showEndScreen(true, msg, state.tutorialVictory ? { breakdown: pendingScoreResult.breakdown } : pendingScoreResult);
    document.getElementById("btn-start-daydream")?.classList.toggle("hidden", !state.tutorialVictory);
    document.getElementById("end-leaderboard")?.classList.toggle("hidden", !!state.tutorialVictory);
    if (!victoryShown) {
      victoryShown = true;
      startVictoryCelebration();
      playSfx("victory");
      if (!state.tutorialVictory) loadLeaderboardPreview();
    }
    return;
  }
  if (state.status === "lost") {
    if (state.tutorialMode && !state.tutorialComplete) {
      state.status = "playing";
    } else {
      syncDeckPressure(state);
      clearAutosave();
      stopVictoryCelebration();
      showEndScreen(false, state.log[0] || "The Dreamscape collapses.");
      return;
    }
  }

  recordActionCheckpoint(state);

  syncHandRemovals(state);

  renderHud(state, getPhaseHint(state));
  syncDeckPressure(state);
  renderPhaseStepper(state);

  const handlers = buildPhaseHandlers();
  const phaseActions = applyTutorialPhaseGates(state, getPhaseActions(state, handlers));
  let advanceAction = getPhaseAdvanceAction(state, handlers);
  if (advanceAction && isInteractiveTutorialActive(state)) {
    const advanceAllowed = isTutorialActionAllowed(state, "advancePhase");
    const onClick = advanceAction.onClick;
    advanceAction = {
      ...advanceAction,
      disabled: advanceAction.disabled || !advanceAllowed,
      onClick: () => {
        if (!isTutorialActionAllowed(state, "advancePhase")) {
          tutorialActionBlocked(state);
          renderAll();
          return;
        }
        onClick();
      },
    };
  }
  renderNarratorPanel(state);
  renderGuidePanel(state, phaseActions);
  renderPhaseAdvanceBar(advanceAction, {
    canUndo: canUndoAction(),
    stackSize: undoStackSize(),
    onUndo: undoLastTableAction,
  }, {
    visible: getPhase(state) === "Reveal",
    disabled: !!state.dreamDrawn || !isTutorialActionAllowed(state, "drawDream"),
    label: "Draw Dream",
    hint: state.dreamDrawn
      ? "This round's Dream is already drawn."
      : "Head Dreamer (★) draws and resolves this round's Dream.",
    onClick: () => {
      if (!isTutorialActionAllowed(state, "drawDream")) {
        tutorialActionBlocked(state);
        renderAll();
        return;
      }
      handlers.drawDream();
    },
  });
  renderPhaseActions(phaseActions, advanceAction, state);

  renderBoardArea();
  renderPlayers(state, (index) => {
    if (!isTutorialActionAllowed(state, "dreamerSelect", { playerIndex: index })) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    if (state.tradeMode && state.trade?.step === "pick-partner") {
      if (selectTradePartner(state, index)) {
        state.trade.step = "select-offer";
        renderAll();
        maybeShowTradePanel();
      }
      return;
    }
    hideRadialMenu();
    const prevId = state.players[state.activePlayerIndex]?.id;
    state.activePlayerIndex = index;
    const player = state.players[index];
    if (getPhase(state) === "Meet" && player?.landscapeId) {
      state.selectedLandscapeId = player.landscapeId;
    }
    if (player?.alive && player.landscapeId) {
      playLandscapeSfx(player.landscapeId);
    }
    const nextId = state.players[index]?.id;
    if (prevId && nextId && prevId !== nextId) {
      playDreamerHandSparkle(prevId, nextId);
    }
    if (prevId && nextId && prevId === nextId && player?.alive && player.landscapeId) {
      openDreamerBoardRadial(null, player.id, player.landscapeId);
      return;
    }
    renderAll();
    clearDockSelectTimer();
    dockSelectTimer = window.setTimeout(() => {
      dockSelectTimer = null;
      const focused = state.players[index];
      if (focused?.alive && focused.landscapeId) {
        queueDreamerBoardFocus(focused.landscapeId);
        flushDreamerBoardFocus();
      }
    }, DOCK_SELECT_DELAY_MS);
  }, (index) => {
    if (!isTutorialActionAllowed(state, "dreamerSelect", { playerIndex: index })) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    const player = state.players[index];
    zoomMaxOnDreamer(player?.id, player?.landscapeId);
  });

  if (phaseOpeningActive(state)) {
    renderPhaseSpendHands(state, onHandCardClick);
  } else if (getPhase(state) === "Meet" && state.meetActionBudget > 0) {
    renderCoopMeetHands(state, onHandCardClick);
  } else {
    renderMeetPoolGuide(state);
    renderHand(state, onHandCardClick, getNewHandCardIds(state));
  }
  renderSpreadTray(state, onHandCardClick, (() => {
    const opener = getPhaseOpenerAction(state, handlers);
    if (!opener) return null;
    const kind = opener.kind || "revealLandscape";
    return {
      ...opener,
      disabled: opener.disabled || !isTutorialActionAllowed(state, kind),
      onClick: () => {
        if (!isTutorialActionAllowed(state, kind)) {
          tutorialActionBlocked(state);
          renderAll();
          return;
        }
        opener.onClick?.();
      },
    };
  })());
  renderPowerTokens(state, {
    onTokenClick: (el) => openPowerTokenRadial(el),
  });

  renderObjects(state, onObjectCardClick);
  renderDecks(state, (deckId) => {
    if (deckId.startsWith("mindstream-") && state.tradeMode) return;
    showDiscardPileModal(state, deckId, (card) => showModal(card));
  }, (deckId) => {
    showRevealedTopsModal(state, deckId, (card) => showModal(card));
  }, (deckId) => {
    handleDrawPileClick(deckId);
  });
  renderActiveSlots(state, (card) => showModal(card), (questIndex) => {
    const kind = questIndex === 0 ? "completeQuest0" : "completeQuest1";
    if (!isTutorialActionAllowed(state, kind)) {
      tutorialActionBlocked(state);
      renderAll();
      return;
    }
    const result = handleQuestComplete(state, questIndex);
    if (result === "acquired") {
      notifyTutorialArchetypeAcquired(state);
      playSfx("acquire");
      requestAnimationFrame(() => burstSparklesAtElement(document.getElementById("acquired-archetypes"), 16, "#f0c96a"));
    }
    renderAll();
  });
  renderSubconsciousButton(state);
  renderActionMomentBanner(state);
  renderLog(state);

  if (state.pendingEventModal) {
    const eventCard = state.pendingEventModal;
    state.pendingEventModal = null;
    showModal(eventCard);
  }

  resolvePendingDeathDream(state, showModal);
  maybeShowDeathChoice();
  maybeShowNothingChoice();
  maybeShowObjectChoice();
  maybeShowRespawn();
  maybeShowRepressPicker();
  maybeShowReturnPicker();
  maybeShowDreamerPowerUI();

  const blocking = isBlockingGameChoice(state);
  setUtilityModalRequired(blocking, blockingChoiceLabel(state));
  const utilityModal = document.getElementById("utility-modal");
  document.body.classList.toggle(
    "utility-modal-open",
    utilityModal && !utilityModal.classList.contains("hidden") && !utilityModal.classList.contains("utility-modal-minimized")
  );

  if (isInteractiveTutorialActive(state)) {
    const step = getTutorialStep(state);
    if (step) ensureTutorialStepTargetsVisible(step);
    const tutorialSync = syncTutorial(state);
    if (typeof window !== "undefined") {
      window.__lastTutorialDecoratedStep = tutorialSync?.step || null;
    }
    syncInteractiveTutorial();
    if (!flushDreamerBoardFocus()) {
      maybeFocusTutorialLandscape();
    }
    requestAnimationFrame(() => {
      const active = syncTutorial(state)?.step;
      if (active) {
        applyTutorialHighlight(active, { animateIn: false });
        trackTutorialSpotlightWithCamera(480);
      }
    });
  } else {
    flushDreamerBoardFocus();
  }

  if (pendingDreamerRadial) {
    const radial = pendingDreamerRadial;
    pendingDreamerRadial = null;
    showDreamerBoardRadialMenu(radial.playerId, radial.tileId, radial.player);
    requestAnimationFrame(() => repositionRadialMenu());
  }

  updateFinalRecurrenceAtmosphere(state);
  updateHandSnapshots(state);
  syncBoardMotion(state);
  syncGameCursor(state);
  scheduleAutoSave();
  requestAnimationFrame(() => {
    runPendingCardFx(state);
    runPendingBoardFx();
  });
}

init();
