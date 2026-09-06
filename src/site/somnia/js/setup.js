import { bindMusicToggle, initSoundtrack, bindButtonRipples } from "./audio.js";
import { initFxLayer } from "./fx.js";
import { loadGameData } from "./data.js";
import {
  TUTORIAL_STEPS,
  markTutorialSeen,
} from "./guide.js";
import {
  renderDreamerPicker,
  renderSetupIntro,
  showRulesModal,
  showOverviewModal,
  showTutorialStep,
  hideTutorial,
} from "./ui.js";

const LAUNCH_KEY = "somnia.launch";
const PLAY_WINDOW_NAME = "somnia-play";

let gameData = null;
let selectedDreamerIds = [];
let tutorialIndex = -1;

async function init() {
  initFxLayer();
  bindButtonRipples();
  initSoundtrack();
  bindMusicToggle();
  gameData = await loadGameData();
  bindSetup();
  bindHelp();
  bindModal();
  renderSetupIntro();
  renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer);
}

function bindSetup() {
  document.getElementById("btn-start").addEventListener("click", launchGameWindow);
  document.getElementById("setup-players").addEventListener("change", () => {
    selectedDreamerIds = [];
    renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer);
    document.getElementById("btn-start").disabled = true;
  });
}

function bindModal() {
  document.querySelector("#utility-modal .utility-backdrop")?.addEventListener("click", hideUtilityModal);
  document.querySelector("#utility-modal .utility-close")?.addEventListener("click", hideUtilityModal);
}

function hideUtilityModal() {
  document.getElementById("utility-modal").classList.add("hidden");
}

function bindHelp() {
  document.getElementById("btn-setup-overview")?.addEventListener("click", showOverviewModal);
  document.getElementById("btn-setup-help")?.addEventListener("click", showRulesModal);
  document.getElementById("btn-setup-tutorial")?.addEventListener("click", () => startMenuTutorial());
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

function launchGameWindow() {
  const lengthKey = document.getElementById("setup-length").value;
  const payload = {
    lengthKey,
    selectedDreamerIds: [...selectedDreamerIds],
    launchedAt: Date.now(),
  };

  const playUrl = new URL("play.html", window.location.href);
  playUrl.searchParams.set("launch", btoa(JSON.stringify(payload)));
  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    playUrl.searchParams.set("dev", "1");
  }
  const playHref = playUrl.href;

  const features = [
    "popup=yes",
    "width=1440",
    "height=900",
  ].join(",");

  const win = window.open(playHref, PLAY_WINDOW_NAME, features);

  if (!win) {
    sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(payload));
    window.location.href = playHref;
    return;
  }

  try {
    win.focus();
  } catch {
    /* focus may fail in some browsers */
  }
}

function startMenuTutorial() {
  tutorialIndex = 0;
  showTutorialAt(tutorialIndex);
}

function showTutorialAt(index) {
  const step = TUTORIAL_STEPS[index];
  if (!step) {
    finishMenuTutorial();
    return;
  }
  showTutorialStep(step, index, TUTORIAL_STEPS.length, {
    onNext: () => {
      tutorialIndex += 1;
      if (tutorialIndex >= TUTORIAL_STEPS.length) finishMenuTutorial();
      else showTutorialAt(tutorialIndex);
    },
    onSkip: finishMenuTutorial,
  });
}

function finishMenuTutorial() {
  hideTutorial();
  tutorialIndex = -1;
  markTutorialSeen();
}

init();
