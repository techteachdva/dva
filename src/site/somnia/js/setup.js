import { bindMusicToggle, initMenuAudioSettings, bindButtonRipples, footerCreditsHtml, boxArtSplashCreditHtml } from "./audio.js";
import { initDeviceMode } from "./device-mode.js";
import { initDialogAccessibility } from "./dialog-a11y.js";
import { initFxLayer } from "./fx.js";
import { initPanelLayout, setViewMode } from "./panel-layout.js";
import { loadSettings, VIEW_MODE_ORDER } from "./audio-settings.js";
import { loadGameData, LENGTHS } from "./data.js";
import { listLocalSaves } from "./game-save.js";
import {
  renderDreamerPicker,
  renderSetupIntro,
  hideDreamerDetailTooltip,
  hideUtilityModal,
} from "./ui.js";

const LAUNCH_KEY = "somnia.launch";
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

function refreshContinueDream() {
  const wrap = document.getElementById("setup-continue-wrap");
  const meta = document.getElementById("setup-continue-meta");
  if (!wrap || !meta) return;
  const saves = listLocalSaves();
  const autosave = saves.find((s) => s.id === "autosave") || saves[0];
  if (!autosave || autosave.status !== "playing") {
    wrap.classList.add("hidden");
    return;
  }
  const lengthLabel = LENGTHS[autosave.lengthKey]?.label || autosave.lengthKey || "Dream";
  const when = autosave.updatedAt
    ? new Date(autosave.updatedAt).toLocaleString()
    : "recently";
  wrap.classList.remove("hidden");
  meta.textContent = `${autosave.label || `Round ${autosave.round}`} · ${lengthLabel} · saved ${when}`;
}

async function init() {
  const startedAt = Date.now();
  initDeviceMode();
  initDialogAccessibility();
  initFxLayer();
  initPanelLayout();
  bindButtonRipples();
  initMenuAudioSettings();
  bindMusicToggle();
  const splashCreditEl = document.getElementById("menu-splash-credit");
  if (splashCreditEl) splashCreditEl.innerHTML = boxArtSplashCreditHtml();
  const creditEl = document.getElementById("menu-footer-credit");
  if (creditEl) creditEl.innerHTML = footerCreditsHtml();

  await preloadMenuSplashImage();
  gameData = await loadGameData();
  bindSetup();
  bindViewMode();
  bindModal();
  renderSetupIntro();
  refreshDreamerPicker();
  refreshContinueDream();
  await runMenuSplash(startedAt);
}

function bindViewMode() {
  const select = document.getElementById("setup-view-mode");
  if (!select) return;
  const mode = loadSettings().viewMode || "auto";
  if (VIEW_MODE_ORDER.includes(mode)) select.value = mode;
  select.addEventListener("change", () => setViewMode(select.value));
}

function bindSetup() {
  document.getElementById("btn-start").addEventListener("click", () => launchGame());
  document.getElementById("btn-continue")?.addEventListener("click", () => {
    launchGame({ resumeSaveId: "autosave" });
  });
  document.getElementById("setup-players").addEventListener("change", () => {
    selectedDreamerIds = [];
    hideDreamerDetailTooltip();
    refreshDreamerPicker();
  });
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

function launchGame(config = null) {
  const lengthKey = document.getElementById("setup-length").value;
  const payload = config || {
    lengthKey,
    selectedDreamerIds: [...selectedDreamerIds],
    launchedAt: Date.now(),
  };
  if (payload.resumeSaveId) {
    payload.launchedAt = Date.now();
  }

  sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(payload));

  const playUrl = new URL("play.html", window.location.href);
  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    playUrl.searchParams.set("dev", "1");
  }
  window.location.href = playUrl.href;
}

function launchTutorialMode() {
  launchGame({
    lengthKey: "daydream",
    selectedDreamerIds: ["the-visionary", "the-runner"],
    tutorialMode: true,
    launchedAt: Date.now(),
  });
}

init();
