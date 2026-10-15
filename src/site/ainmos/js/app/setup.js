import { bindMusicToggle, startMenuTheme, bindButtonRipples } from "../audio/audio.js";
import { initClickFeedback } from "../ui/click-feedback.js";
import { initDeviceMode } from "./device-mode.js";
import { initSomniaPwa } from "./pwa.js";
import { writeLaunchConfig, readStoredLaunchConfig } from "./launch-store.js";
import { initDialogAccessibility } from "../ui/dialog-a11y.js";
import { initFxLayer } from "../ui/fx.js";
import { initPanelLayout } from "../ui/panel-layout.js";
import { loadGameData, LENGTHS } from "../core/data.js";
import {
  listLocalSaves,
  deleteLocalSave,
  listCloudSaves,
  deleteCloudSave,
} from "../save/game-save.js";
import { validateScoreName } from "../save/highscores.js";
import { normalizeSeedInput, specialSeedLabel } from "../core/rng.js";
import { showSomniaChangelogModal } from "../meta/changelog.js";
import {
  renderDreamerPicker,
  renderSetupIntro,
  hideUtilityModal,
} from "../ui/ui.js";
import { hasSeenTutorial, hasCompletedBasicTutorial, hasUsedGentleStart } from "../meta/guide.js";
import { TUTORIAL_DREAMER_IDS } from "../tutorial/tutorial-mode.js";

const SPLASH_MIN_MS = 3200;
const SPLASH_DISSOLVE_MS = 1600;

let gameData = null;
let selectedDreamerIds = [];
let firstVisit = !hasSeenTutorial();

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

/** Ainmos is played by one Dreamer. */
function playerCount() {
  return 1;
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
  initSomniaPwa();
  initDialogAccessibility();
  initFxLayer();
  initClickFeedback();
  initPanelLayout();
  bindButtonRipples();
  startMenuTheme();
  bindMusicToggle();
  await preloadMenuSplashImage();
  gameData = await loadGameData();
  bindSetup();
  refreshLengthOptions();
  prefillLastSeed();
  bindChangelog();
  bindMenuIntro();
  bindModal();
  applyFirstVisitMenu();
  renderSetupIntro();
  refreshDreamerPicker();
  refreshContinueDream();
  await runMenuSplash(startedAt);
}

function bindMenuIntro() {
  const intro = document.getElementById("menu-intro");
  const spiral = document.getElementById("btn-menu-spiral");
  const closeBtn = document.getElementById("btn-menu-intro-close");
  if (!intro || !spiral) return;

  const open = () => {
    intro.classList.remove("hidden");
    spiral.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    intro.classList.add("hidden");
    spiral.setAttribute("aria-expanded", "false");
    spiral.focus();
  };

  spiral.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  intro.addEventListener("click", (event) => {
    if (event.target === intro) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !intro.classList.contains("hidden")) close();
  });
}

function bindChangelog() {
  document.getElementById("btn-somnia-changelog")?.addEventListener("click", () => {
    showSomniaChangelogModal();
  });
}

function applyFirstVisitMenu() {
  const row = document.querySelector(".setup-launch-row");
  const tutorial = document.getElementById("btn-tutorial-mode");
  const advanced = document.getElementById("btn-advanced-tutorial");
  const hint = document.querySelector(".menu-tutorial-hint");
  const basicDone = hasCompletedBasicTutorial();
  row?.classList.toggle("setup-launch-row--first-visit", firstVisit);
  if (advanced) {
    advanced.disabled = !basicDone;
    advanced.title = basicDone
      ? "Trade, objects, powers, death, and the boss on The Bed"
      : "Finish the Tutorial to unlock the longer night";
    advanced.setAttribute("aria-disabled", basicDone ? "false" : "true");
  }
  if (hint) {
    hint.innerHTML = "Pick one Dreamer and <strong>Begin Dreaming</strong>. New here? <strong>First Night</strong> is a real Daydream with a guide that walks you through your first two Cycles, step by step.";
  }
  if (firstVisit && tutorial) {
    tutorial.title = "A real Daydream with a step-by-step guide through your first two Cycles";
  }
}

/** The length labels live in index.html; nothing changes with the table size any more. */
function refreshLengthOptions() {}

const BOARD_MODE_KEY = "ainmos.boardMode";
const BOARD_MODE_HINTS = {
  fixed: "Fixed Board: every Landscape waits face down on the map.",
  freeform: "Freeform Board: start with only The Bed. Spend Lucidity to place Landscapes from the Dreamscape Vault, and shape the dream yourself.",
};

/** Ainmos always builds a Freeform Board. */
function selectedBoardMode() {
  return "freeform";
}

function refreshBoardModeHint() {
  const hint = document.getElementById("setup-board-hint");
  if (hint) hint.textContent = BOARD_MODE_HINTS[selectedBoardMode()];
}

function bindBoardMode() {
  let saved = "fixed";
  try {
    saved = localStorage.getItem(BOARD_MODE_KEY) === "freeform" ? "freeform" : "fixed";
  } catch {
    saved = "fixed";
  }
  const radio = document.querySelector(`input[name='setup-board'][value='${saved}']`);
  if (radio) radio.checked = true;
  refreshBoardModeHint();
  document.querySelectorAll("input[name='setup-board']").forEach((input) => {
    input.addEventListener("change", () => {
      try {
        localStorage.setItem(BOARD_MODE_KEY, selectedBoardMode());
      } catch {
        /* private window: the choice simply is not remembered */
      }
      refreshBoardModeHint();
    });
  });
}

function bindSetup() {
  bindBoardMode();
  document.getElementById("btn-start").addEventListener("click", () => launchGame());
  document.getElementById("btn-continue")?.addEventListener("click", () => {
    launchGame({ resumeSaveId: "autosave" });
  });
  document.getElementById("btn-tutorial-mode")?.addEventListener("click", () => launchTutorialMode("basic"));
  document.getElementById("btn-advanced-tutorial")?.addEventListener("click", () => {
    if (!hasCompletedBasicTutorial()) return;
    launchTutorialMode("advanced");
  });
  bindSeedInput();
  bindSavedDreams();
}

function bindSeedInput() {
  const input = document.getElementById("setup-seed");
  const preview = document.getElementById("setup-seed-preview");
  if (!input || !preview) return;
  const update = () => {
    const seed = normalizeSeedInput(input.value);
    if (!seed) {
      preview.classList.add("hidden");
      preview.textContent = "";
      return;
    }
    const special = specialSeedLabel(seed);
    preview.textContent = special
      || `Seeded dream — anyone who enters “${seed}” gets this exact same shuffle.`;
    preview.classList.toggle("seed-preview-special", Boolean(special));
    preview.classList.remove("hidden");
  };
  input.addEventListener("input", update);
  update();
}

/** Returning from a dream? Offer its seed again so a replay is one click away. */
function prefillLastSeed() {
  const input = document.getElementById("setup-seed");
  if (!input || input.value) return;
  const last = readStoredLaunchConfig();
  const seed = normalizeSeedInput(last?.seed);
  if (!seed) return;
  input.value = seed;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function savedDreamRowHtml(save, { cloud = false } = {}) {
  const title = save.gameId || save.label || `Round ${save.round || "?"}`;
  const when = save.updatedAt ? new Date(save.updatedAt).toLocaleString() : "";
  const dreamers = Array.isArray(save.dreamers) ? save.dreamers.join(", ") : (save.dreamers || "");
  const bits = [
    when,
    save.round ? `Round ${save.round}` : "",
    save.phase || "",
  ].filter(Boolean).join(" · ");
  return `
    <div class="pause-save-row">
      <div class="pause-save-info">
        <strong>${title}${cloud && save.name ? ` <span class="pause-save-owner">${save.name}</span>` : ""}</strong>
        <span class="pause-save-meta">${bits}</span>
        ${dreamers ? `<span class="pause-save-meta pause-save-dreamers">${dreamers}</span>` : ""}
      </div>
      <div class="pause-save-actions">
        <button type="button" class="btn btn-sm" data-load-save="${save.id}">Load</button>
        <button type="button" class="btn btn-sm" data-delete-save="${save.id}">Delete</button>
      </div>
    </div>
  `;
}

function bindSavedDreams() {
  document.getElementById("btn-saved-dreams")?.addEventListener("click", openSavedDreamsModal);
}

function openSavedDreamsModal() {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;
  body.innerHTML = `
    <div class="saved-dreams-modal">
      <h2>Saved Dreams</h2>
      <section class="saved-dreams-section">
        <h3>On this device</h3>
        <div id="saved-dreams-local" class="pause-save-list"></div>
      </section>
      <section class="saved-dreams-section">
        <h3>Cloud saves</h3>
        <p class="pause-hint">Enter the first name and last initial the dream was saved under.</p>
        <div class="pause-save-name-row">
          <label class="pause-field">
            <span>First name</span>
            <input type="text" id="saved-dreams-first" maxlength="16" placeholder="First name" autocomplete="given-name" />
          </label>
          <label class="pause-field pause-save-last-field">
            <span>Last initial</span>
            <input type="text" id="saved-dreams-last" class="pause-save-last" maxlength="1" placeholder="K" autocomplete="family-name" />
          </label>
        </div>
        <div class="pause-btn-row">
          <button type="button" class="btn" id="saved-dreams-list-cloud">List cloud saves</button>
        </div>
        <p id="saved-dreams-status" class="pause-hint" aria-live="polite"></p>
        <div id="saved-dreams-cloud" class="pause-save-list"></div>
      </section>
    </div>
  `;
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");
  renderLocalDreamList(body);
  bindCloudDreamList(body);
}

function renderLocalDreamList(body) {
  const listEl = body.querySelector("#saved-dreams-local");
  if (!listEl) return;
  const saves = listLocalSaves()
    .slice()
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
  if (!saves.length) {
    listEl.innerHTML = "<p class=\"pause-hint\">No dreams saved on this device yet.</p>";
    return;
  }
  listEl.innerHTML = saves.map((save) => savedDreamRowHtml(save)).join("");
  listEl.querySelectorAll("[data-load-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      launchGame({ resumeSaveId: btn.dataset.loadSave });
    });
  });
  listEl.querySelectorAll("[data-delete-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteLocalSave(btn.dataset.deleteSave);
      renderLocalDreamList(body);
      refreshContinueDream();
    });
  });
}

function bindCloudDreamList(body) {
  const status = body.querySelector("#saved-dreams-status");
  const setStatus = (msg, isError = false) => {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle("pause-save-error", isError);
  };
  body.querySelector("#saved-dreams-list-cloud")?.addEventListener("click", async () => {
    const first = body.querySelector("#saved-dreams-first")?.value || "";
    const last = body.querySelector("#saved-dreams-last")?.value || "";
    const valid = validateScoreName(first, last);
    if (!valid.ok) {
      setStatus(valid.message, true);
      return;
    }
    const listEl = body.querySelector("#saved-dreams-cloud");
    if (!listEl) return;
    listEl.innerHTML = "<p class=\"pause-hint\">Loading…</p>";
    setStatus("");
    try {
      const result = await listCloudSaves(valid.name);
      if (result.setupRequired) {
        listEl.innerHTML = "";
        setStatus("Cloud saves are not configured on this server yet.", true);
        return;
      }
      const saves = result.saves || [];
      if (!saves.length) {
        listEl.innerHTML = "<p class=\"pause-hint\">No cloud saves for that name.</p>";
        return;
      }
      listEl.innerHTML = saves.map((save) => savedDreamRowHtml(save, { cloud: true })).join("");
      listEl.querySelectorAll("[data-load-save]").forEach((btn) => {
        btn.addEventListener("click", () => {
          launchGame({ resumeCloudSaveId: btn.dataset.loadSave });
        });
      });
      listEl.querySelectorAll("[data-delete-save]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await deleteCloudSave(btn.dataset.deleteSave);
            btn.closest(".pause-save-row")?.remove();
            setStatus("Cloud save deleted.");
          } catch (e) {
            setStatus(e.message || "Could not delete save.", true);
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = "";
      setStatus(e.message || "Could not list cloud saves.", true);
    }
  });
}

function bindModal() {
  document.querySelector("#utility-modal .utility-backdrop")?.addEventListener("click", hideUtilityModal);
  document.querySelector("#utility-modal .utility-close")?.addEventListener("click", hideUtilityModal);
}

/** One Dreamer per run: picking another swaps to it. */
function toggleDreamer(id) {
  selectedDreamerIds = selectedDreamerIds.includes(id) ? [] : [id];
  refreshDreamerPicker();
}

function launchGame(config = null) {
  const lengthKey = document.getElementById("setup-length").value;
  const seed = normalizeSeedInput(document.getElementById("setup-seed")?.value);
  const payload = config || {
    lengthKey,
    boardMode: selectedBoardMode(),
    selectedDreamerIds: [...selectedDreamerIds],
    launchedAt: Date.now(),
    gentleStart: lengthKey === "daydream" && !hasUsedGentleStart(),
    ...(seed ? { seed } : {}),
  };
  if (payload.resumeSaveId || payload.resumeCloudSaveId) {
    payload.launchedAt = Date.now();
  }

  writeLaunchConfig(payload);

  const playUrl = new URL("play.html", window.location.href);
  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    playUrl.searchParams.set("dev", "1");
  }
  window.location.href = playUrl.href;
}

/** Ainmos First Night: a real Daydream with the step-by-step guide for its first two Cycles. */
function launchTutorialMode(_track = "basic") {
  launchGame({
    lengthKey: "daydream",
    boardMode: "freeform",
    selectedDreamerIds: [...TUTORIAL_DREAMER_IDS],
    guided: true,
    gentleStart: true,
    launchedAt: Date.now(),
  });
}

init();
