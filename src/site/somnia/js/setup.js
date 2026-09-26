import { bindMusicToggle, startMenuTheme, bindButtonRipples } from "./audio.js";
import { initDeviceMode } from "./device-mode.js";
import { initSomniaPwa } from "./pwa.js";
import { writeLaunchConfig, readStoredLaunchConfig } from "./launch-store.js";
import { initDialogAccessibility } from "./dialog-a11y.js";
import { initFxLayer } from "./fx.js";
import { initPanelLayout } from "./panel-layout.js";
import { loadGameData, LENGTHS } from "./data.js";
import {
  listLocalSaves,
  deleteLocalSave,
  listCloudSaves,
  deleteCloudSave,
} from "./game-save.js";
import { validateScoreName } from "./highscores.js";
import { normalizeSeedInput, specialSeedLabel } from "./rng.js";
import { showSomniaChangelogModal } from "./changelog.js";
import {
  renderDreamerPicker,
  renderSetupIntro,
  hideDreamerDetailTooltip,
  hideUtilityModal,
} from "./ui.js";
import { hasSeenTutorial, hasUsedGentleStart } from "./guide.js";
import { TUTORIAL_DREAMER_IDS } from "./tutorial-mode.js";

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
  initSomniaPwa();
  initDialogAccessibility();
  initFxLayer();
  initPanelLayout();
  bindButtonRipples();
  startMenuTheme();
  bindMusicToggle();
  await preloadMenuSplashImage();
  gameData = await loadGameData();
  bindSetup();
  prefillLastSeed();
  bindChangelog();
  bindModal();
  applyFirstVisitMenu();
  renderSetupIntro();
  refreshDreamerPicker();
  refreshContinueDream();
  await runMenuSplash(startedAt);
}

function bindChangelog() {
  document.getElementById("btn-somnia-changelog")?.addEventListener("click", () => {
    showSomniaChangelogModal();
  });
}

function applyFirstVisitMenu() {
  const row = document.querySelector(".setup-launch-row");
  const tutorial = document.getElementById("btn-tutorial-mode");
  const hint = document.querySelector(".menu-tutorial-hint");
  row?.classList.toggle("setup-launch-row--first-visit", firstVisit);
  if (hint) {
    hint.innerHTML = firstVisit
      ? "New here? Start with <strong>Tutorial</strong> — two guided rounds. The Visionary and The Immovable are a balanced first pair."
      : "Tutorial Mode walks you through two guided rounds. Open <strong>?</strong> or Pause → Help anytime for rules.";
  }
  if (firstVisit && tutorial) {
    tutorial.title = "Two guided rounds with step-by-step coaching";
  }
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
  const seed = normalizeSeedInput(document.getElementById("setup-seed")?.value);
  const payload = config || {
    lengthKey,
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

function launchTutorialMode() {
  launchGame({
    lengthKey: "daydream",
    selectedDreamerIds: [...TUTORIAL_DREAMER_IDS],
    tutorialMode: true,
    launchedAt: Date.now(),
  });
}

init();
