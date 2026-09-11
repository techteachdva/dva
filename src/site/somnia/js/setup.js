import { bindMusicToggle, initMenuAudioSettings, bindButtonRipples, footerCreditsHtml, boxArtSplashCreditHtml } from "./audio.js";
import { isStandaloneMode } from "./standalone.js";
import { initDeviceMode } from "./device-mode.js";
import { initDialogAccessibility } from "./dialog-a11y.js";
import { buildSetupAudioControls } from "./pause-menu.js";
import { initFxLayer } from "./fx.js";
import { loadGameData } from "./data.js";
import {
  renderDreamerPicker,
  renderSetupIntro,
  showOverviewModal,
  hideDreamerDetailTooltip,
  hideUtilityModal,
} from "./ui.js";

const LAUNCH_KEY = "somnia.launch";
const PLAY_WINDOW_NAME = "somnia-play";
const SPLASH_MIN_MS = 3200;
const SPLASH_DISSOLVE_MS = 1600;

let gameData = null;
let selectedDreamerIds = [];

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function preloadMenuSplashImage() {
  const img = document.querySelector(".menu-splash-art");
  if (!img) return Promise.resolve();
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener("load", resolve, { once: true });
    img.addEventListener("error", resolve, { once: true });
  });
}

async function dissolveMenuSplash() {
  const splash = document.getElementById("menu-splash");
  if (!splash) return;

  document.body.classList.add("menu-splash-ready");
  splash.classList.add("dissolving");
  splash.setAttribute("aria-hidden", "true");

  const duration = prefersReducedMotion() ? 0 : SPLASH_DISSOLVE_MS;
  await wait(duration);
  splash.remove();
  document.body.classList.remove("menu-splash-active", "menu-splash-ready");
}

async function runMenuSplash(startedAt) {
  const minMs = prefersReducedMotion() ? 0 : SPLASH_MIN_MS;
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) await wait(minMs - elapsed);
  await dissolveMenuSplash();
}

function playerCount() {
  return Number(document.getElementById("setup-players").value);
}

function updateBeginDreamButton() {
  const btn = document.getElementById("btn-start");
  if (!btn) return;
  const ready = selectedDreamerIds.length === playerCount();
  btn.disabled = !ready;
  btn.classList.toggle("begin-dream-ready", ready);
  btn.setAttribute("aria-disabled", String(!ready));
}

function refreshDreamerPicker() {
  renderDreamerPicker(gameData.dreamers, selectedDreamerIds, toggleDreamer, {
    playerCount: playerCount(),
  });
  updateBeginDreamButton();
}

async function init() {
  const startedAt = Date.now();
  initDeviceMode();
  initDialogAccessibility();
  initFxLayer();
  bindButtonRipples();
  initMenuAudioSettings();
  bindMusicToggle();
  const splashCreditEl = document.getElementById("menu-splash-credit");
  if (splashCreditEl) splashCreditEl.innerHTML = boxArtSplashCreditHtml();
  const creditEl = document.getElementById("menu-footer-credit");
  if (creditEl) creditEl.innerHTML = footerCreditsHtml();

  await preloadMenuSplashImage();
  gameData = await loadGameData();
  buildSetupAudioControls(document.getElementById("setup-audio-display"));
  bindSetup();
  bindModal();
  renderSetupIntro();
  refreshDreamerPicker();
  await runMenuSplash(startedAt);
}

function bindSetup() {
  document.getElementById("btn-start").addEventListener("click", () => launchGameWindow());
  document.getElementById("setup-players").addEventListener("change", () => {
    selectedDreamerIds = [];
    hideDreamerDetailTooltip();
    refreshDreamerPicker();
  });
  document.getElementById("btn-setup-overview")?.addEventListener("click", showOverviewModal);
  document.getElementById("btn-tutorial-mode")?.addEventListener("click", () => launchTutorialMode());
}

function bindModal() {
  document.querySelector("#utility-modal .utility-backdrop")?.addEventListener("click", hideUtilityModal);
  document.querySelector("#utility-modal .utility-close")?.addEventListener("click", hideUtilityModal);
}

function toggleDreamer(id) {
  const count = playerCount();
  if (selectedDreamerIds.includes(id)) {
    selectedDreamerIds = selectedDreamerIds.filter((x) => x !== id);
  } else if (selectedDreamerIds.length < count) {
    selectedDreamerIds.push(id);
  }
  refreshDreamerPicker();
}

function launchGameWindow(config = null) {
  const lengthKey = document.getElementById("setup-length").value;
  const payload = config || {
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

  if (isStandaloneMode()) {
    sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(payload));
    window.location.href = playHref;
    return;
  }

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

function launchTutorialMode() {
  launchGameWindow({
    lengthKey: "daydream",
    selectedDreamerIds: ["the-visionary", "the-runner"],
    tutorialMode: true,
    launchedAt: Date.now(),
  });
}

init();
