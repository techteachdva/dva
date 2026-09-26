import {
  loadSettings,
  saveSettings,
  MUSIC_TRACKS,
  VIEW_MODE_ORDER,
  VIEW_MODE_LABELS,
  footerCreditsHtml,
} from "./audio-settings.js";
import {
  applyAudioSettings,
  getAudioState,
  setMusicMode,
  setTrackId,
  setMusicMuted,
  setSfxMuted,
  setMusicVolume,
  setSfxVolume,
  setMusicPan,
  setSfxPan,
} from "./audio.js";
import { applyLayout, resetPanelLayout, setViewMode } from "./panel-layout.js";
import { getFormOverride, setFormOverride } from "./device-mode.js";
import { validateScoreName } from "./highscores.js";
import { showDreamFeedModal } from "./ui.js";

let open = false;
let onResume = null;
let gameSaveHooks = null;

function panLabel(value) {
  if (value < -0.25) return "◀ Left";
  if (value > 0.25) return "Right ▶";
  return "◎ Center";
}

function renderAudioTab() {
  const s = getAudioState();
  const trackOptions = MUSIC_TRACKS.map(
    (t) => `<option value="${t.id}" ${s.trackId === t.id ? "selected" : ""}>${t.title}</option>`,
  ).join("");

  return `
    <div class="pause-section">
      <h3>Music</h3>
      <label class="pause-field">
        <span>Mode</span>
        <select id="pause-music-mode">
          <option value="radio" ${s.musicMode === "radio" ? "selected" : ""}>📻 Radio (rotating playlist)</option>
          <option value="track" ${s.musicMode === "track" ? "selected" : ""}>🎵 Single track</option>
          <option value="off" ${s.musicMode === "off" ? "selected" : ""}>🔇 Music off</option>
        </select>
      </label>
      <label class="pause-field">
        <span>Track</span>
        <select id="pause-track" ${s.musicMode !== "track" ? "disabled" : ""}>${trackOptions}</select>
      </label>
      <label class="pause-toggle">
        <input type="checkbox" id="pause-music-mute" ${s.musicMuted ? "checked" : ""} />
        <span>Mute music</span>
      </label>
      <label class="pause-field">
        <span>Music volume</span>
        <input type="range" id="pause-music-vol" min="0" max="100" value="${Math.round(s.musicVolume * 100)}" />
      </label>
      <label class="pause-field pause-pan">
        <span>Stereo ◀ — music — ▶</span>
        <input type="range" id="pause-music-pan" min="-100" max="100" value="${Math.round(s.musicPan * 100)}" />
        <span class="pan-readout" id="pause-music-pan-label">${panLabel(s.musicPan)}</span>
      </label>
    </div>
    <div class="pause-section">
      <h3>Sound effects</h3>
      <label class="pause-toggle">
        <input type="checkbox" id="pause-sfx-mute" ${s.sfxMuted ? "checked" : ""} />
        <span>Mute sound effects</span>
      </label>
      <label class="pause-field">
        <span>SFX volume</span>
        <input type="range" id="pause-sfx-vol" min="0" max="100" value="${Math.round(s.sfxVolume * 100)}" />
      </label>
      <label class="pause-field pause-pan">
        <span>Stereo ◀ — SFX — ▶</span>
        <input type="range" id="pause-sfx-pan" min="-100" max="100" value="${Math.round(s.sfxPan * 100)}" />
        <span class="pan-readout" id="pause-sfx-pan-label">${panLabel(s.sfxPan)}</span>
      </label>
    </div>
    ${footerCreditsHtml()}
  `;
}

function renderDisplayTab() {
  const mode = loadSettings().viewMode || "auto";
  const modes = VIEW_MODE_ORDER.map(
    (m) => `<button type="button" class="btn ${mode === m ? "primary" : ""}" data-view-mode="${m}">${VIEW_MODE_LABELS[m] || m}</button>`,
  ).join("");
  const form = getFormOverride();
  const forms = ["auto", "phone", "tablet", "desktop"].map(
    (m) => `<button type="button" class="btn ${form === m ? "primary" : ""}" data-form-override="${m}">${m === "auto" ? "Auto" : m[0].toUpperCase() + m.slice(1)}</button>`,
  ).join("");

  return `
    <div class="pause-section">
      <h3>Device layout</h3>
      <p class="pause-hint">Auto follows this screen. Override if the table picks the wrong chrome.</p>
      <div class="pause-btn-row">${forms}</div>
    </div>
    <div class="pause-section">
      <h3>Interface size</h3>
      <p class="pause-hint">Auto matches your screen resolution and Windows display scaling. Presets still shrink so the table fits on smaller windows.</p>
      <div class="pause-btn-row">${modes}</div>
    </div>
    <div class="pause-section">
      <h3>Panel layout</h3>
      <p class="pause-hint">Drag the edges between panels in-game to resize. Reset restores the current preset.</p>
      <button type="button" class="btn" id="pause-reset-panels">Reset panel sizes</button>
    </div>
  `;
}

function saveRowHtml(save, { cloud = false } = {}) {
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

function renderGameTab() {
  const hooks = gameSaveHooks || {};
  const canSave = hooks.canSave?.() ?? false;
  const label = hooks.saveLabel?.() || "Current dream";
  const standalone = hooks.isStandalone?.() ?? false;
  const gameId = hooks.getGameId?.() || "";
  const seed = hooks.getSeed?.() || "";
  return `
    ${gameId ? `
    <div class="pause-section pause-game-id-section">
      <h3>This dream</h3>
      <div class="pause-game-id-row">
        <span class="pause-game-id" id="pause-game-id" title="Tap to copy">${gameId}</span>
        ${seed ? `<span class="pause-seed-badge">seed ${seed}</span>` : ""}
      </div>
      <p class="pause-hint">Share this Game ID as a seed on the menu to replay the same dream.</p>
    </div>` : ""}
    <div class="pause-section">
      <h3>Save progress</h3>
      <p class="pause-hint">${canSave ? `Autosave keeps <strong>${label}</strong> on this device.` : "Finish the guided tutorial steps to unlock saving, or start a Daydream from the menu."}</p>
      <div class="pause-btn-row pause-btn-col">
        <button type="button" class="btn primary" id="pause-save-local" ${canSave ? "" : "disabled"}>Save on this device</button>
        <button type="button" class="btn" id="pause-save-cloud" ${canSave && !standalone ? "" : "disabled"}>${standalone ? "Cloud save (web only)" : "Save to cloud"}</button>
        <button type="button" class="btn pause-exit-btn" id="pause-save-exit" ${canSave ? "" : "disabled"}>Save &amp; return to main menu</button>
      </div>
      <p id="pause-save-status" class="pause-hint" aria-live="polite"></p>
    </div>
    <div class="pause-section">
      <h3>Device saves</h3>
      <div id="pause-local-save-list" class="pause-save-list"></div>
    </div>
    <div class="pause-section">
      <h3>Cloud saves</h3>
      <p class="pause-hint">Enter the same first name and last initial you use for high scores.</p>
      <div class="pause-save-name-row">
        <label class="pause-field">
          <span>First name</span>
          <input type="text" id="pause-save-first" maxlength="16" placeholder="First name" autocomplete="given-name" />
        </label>
        <label class="pause-field pause-save-last-field">
          <span>Last initial</span>
          <input type="text" id="pause-save-last" class="pause-save-last" maxlength="1" placeholder="K" autocomplete="family-name" />
        </label>
      </div>
      <div class="pause-btn-row">
        <button type="button" class="btn" id="pause-load-list">List cloud saves</button>
      </div>
      <div id="pause-save-list" class="pause-save-list"></div>
    </div>
  `;
}

function readPauseSaveName(root) {
  const first = root.querySelector("#pause-save-first")?.value || "";
  const last = root.querySelector("#pause-save-last")?.value || "";
  return validateScoreName(first, last);
}

function bindGameControls(root) {
  const status = root.querySelector("#pause-save-status");
  const setStatus = (msg, isError = false) => {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle("pause-save-error", isError);
  };

  root.querySelector("#pause-game-id")?.addEventListener("click", async (e) => {
    const text = e.currentTarget.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Game ID ${text} copied — use it as a seed to replay this dream.`);
    } catch {
      setStatus(`Game ID: ${text}`);
    }
  });

  root.querySelector("#pause-save-local")?.addEventListener("click", async () => {
    try {
      await gameSaveHooks?.saveLocal?.();
      setStatus("Saved on this device.");
      renderLocalSaveList(root);
    } catch (e) {
      setStatus(e.message || "Could not save.", true);
    }
  });

  root.querySelector("#pause-save-cloud")?.addEventListener("click", async () => {
    const valid = readPauseSaveName(root);
    if (!valid.ok) {
      setStatus(valid.message, true);
      return;
    }
    try {
      await gameSaveHooks?.saveCloud?.(valid);
      setStatus("Saved to cloud.");
    } catch (e) {
      setStatus(e.message || "Could not save to cloud.", true);
    }
  });

  root.querySelector("#pause-save-exit")?.addEventListener("click", async () => {
    const btn = root.querySelector("#pause-save-exit");
    if (btn) btn.disabled = true;
    setStatus("Saving your dream…");
    try {
      await gameSaveHooks?.saveAndExit?.();
    } catch (e) {
      if (btn) btn.disabled = false;
      setStatus(e.message || "Could not save before leaving.", true);
    }
  });

  renderLocalSaveList(root);

  root.querySelector("#pause-load-list")?.addEventListener("click", async () => {
    const valid = readPauseSaveName(root);
    if (!valid.ok) {
      setStatus(valid.message, true);
      return;
    }
    const listEl = root.querySelector("#pause-save-list");
    if (!listEl) return;
    listEl.innerHTML = "<p class=\"pause-hint\">Loading…</p>";
    try {
      const saves = await gameSaveHooks?.listCloud?.(valid);
      if (!saves?.length) {
        listEl.innerHTML = "<p class=\"pause-hint\">No cloud saves for that name.</p>";
        return;
      }
      listEl.innerHTML = saves.map((save) => saveRowHtml(save, { cloud: true })).join("");
      listEl.querySelectorAll("[data-load-save]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await gameSaveHooks?.loadCloud?.(btn.dataset.loadSave);
            closePauseMenu();
          } catch (e) {
            setStatus(e.message || "Could not load save.", true);
          }
        });
      });
      listEl.querySelectorAll("[data-delete-save]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await gameSaveHooks?.deleteCloud?.(btn.dataset.deleteSave);
            btn.closest(".pause-save-row")?.remove();
            setStatus("Cloud save deleted.");
          } catch (e) {
            setStatus(e.message || "Could not delete save.", true);
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = "";
      setStatus(e.message || "Could not list saves.", true);
    }
  });
}

function renderLocalSaveList(root) {
  const listEl = root.querySelector("#pause-local-save-list");
  if (!listEl) return;
  const saves = (gameSaveHooks?.listLocal?.() || [])
    .slice()
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
  if (!saves.length) {
    listEl.innerHTML = "<p class=\"pause-hint\">No device saves yet.</p>";
    return;
  }
  listEl.innerHTML = saves.map((save) => saveRowHtml(save)).join("");
  listEl.querySelectorAll("[data-load-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await gameSaveHooks?.loadLocalById?.(btn.dataset.loadSave);
        closePauseMenu();
      } catch (e) {
        const status = document.getElementById("pause-save-status");
        if (status) {
          status.textContent = e.message || "Could not load save.";
          status.classList.add("pause-save-error");
        }
      }
    });
  });
  listEl.querySelectorAll("[data-delete-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        gameSaveHooks?.deleteLocal?.(btn.dataset.deleteSave);
        btn.closest(".pause-save-row")?.remove();
        if (!listEl.querySelector(".pause-save-row")) {
          listEl.innerHTML = "<p class=\"pause-hint\">No device saves yet.</p>";
        }
      } catch { /* ignore */ }
    });
  });
}

function renderHelpTab() {
  return `
    <div class="pause-section">
      <h3>Learn &amp; reference</h3>
      <div class="pause-btn-row pause-btn-col">
        <button type="button" class="btn" id="pause-info-hub">Dream Guide</button>
        <button type="button" class="btn" id="pause-tutorial">Tips</button>
      </div>
    </div>
  `;
}

function bindAudioControls(root) {
  root.querySelector("#pause-music-mode")?.addEventListener("change", (e) => {
    setMusicMode(e.target.value);
    const trackSel = root.querySelector("#pause-track");
    if (trackSel) trackSel.disabled = e.target.value !== "track";
    applyAudioSettings();
  });

  root.querySelector("#pause-track")?.addEventListener("change", (e) => {
    setTrackId(e.target.value);
    applyAudioSettings();
  });

  root.querySelector("#pause-music-mute")?.addEventListener("change", (e) => {
    setMusicMuted(e.target.checked);
  });

  root.querySelector("#pause-sfx-mute")?.addEventListener("change", (e) => {
    setSfxMuted(e.target.checked);
  });

  root.querySelector("#pause-music-vol")?.addEventListener("input", (e) => {
    setMusicVolume(Number(e.target.value) / 100);
  });

  root.querySelector("#pause-sfx-vol")?.addEventListener("input", (e) => {
    setSfxVolume(Number(e.target.value) / 100);
  });

  const musicPan = root.querySelector("#pause-music-pan");
  musicPan?.addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    setMusicPan(v);
    const label = root.querySelector("#pause-music-pan-label");
    if (label) label.textContent = panLabel(v);
  });

  const sfxPan = root.querySelector("#pause-sfx-pan");
  sfxPan?.addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    setSfxPan(v);
    const label = root.querySelector("#pause-sfx-pan-label");
    if (label) label.textContent = panLabel(v);
  });
}

function bindDisplayControls(root) {
  root.querySelectorAll("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setViewMode(btn.dataset.viewMode);
      showTab("display");
    });
  });
  root.querySelectorAll("[data-form-override]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFormOverride(btn.dataset.formOverride);
      showTab("display");
    });
  });
  root.querySelector("#pause-reset-panels")?.addEventListener("click", () => {
    resetPanelLayout();
  });
}

function showTab(tabId) {
  const menu = document.getElementById("pause-menu");
  if (!menu) return;
  menu.querySelectorAll("[data-pause-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pauseTab === tabId);
  });
  const body = menu.querySelector("#pause-menu-body");
  if (!body) return;
  if (tabId === "audio") {
    body.innerHTML = renderAudioTab();
    bindAudioControls(body);
  } else if (tabId === "display") {
    body.innerHTML = renderDisplayTab();
    bindDisplayControls(body);
  } else if (tabId === "game") {
    body.innerHTML = renderGameTab();
    bindGameControls(body);
  } else if (tabId === "help") {
    body.innerHTML = renderHelpTab();
    body.querySelector("#pause-info-hub")?.addEventListener("click", () => {
      closePauseMenu();
      showDreamFeedModal();
    });
    body.querySelector("#pause-tutorial")?.addEventListener("click", () => {
      closePauseMenu();
      document.getElementById("btn-tutorial")?.click();
    });
  }
}

export function isPauseMenuOpen() {
  return open;
}

export function openPauseMenu() {
  const menu = document.getElementById("pause-menu");
  if (!menu || open) return;
  open = true;
  menu.classList.remove("hidden");
  menu.setAttribute("aria-hidden", "false");
  showTab("audio");
}

export function closePauseMenu() {
  const menu = document.getElementById("pause-menu");
  if (!menu) return;
  open = false;
  menu.classList.add("hidden");
  menu.setAttribute("aria-hidden", "true");
  onResume?.();
}

export function initPauseMenu({ onResumeCallback, gameSaveHooks: hooks } = {}) {
  onResume = onResumeCallback || null;
  gameSaveHooks = hooks || null;
  const menu = document.getElementById("pause-menu");
  if (!menu || menu.dataset.bound) return;
  menu.dataset.bound = "1";

  menu.querySelector("#pause-resume")?.addEventListener("click", closePauseMenu);
  menu.querySelector(".pause-backdrop")?.addEventListener("click", closePauseMenu);

  menu.querySelectorAll("[data-pause-tab]").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.pauseTab));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (open) closePauseMenu();
    else openPauseMenu();
  }, { capture: true });
}

export function buildSetupAudioControls(container) {
  if (!container) return;
  const s = loadSettings();
  const trackOptions = MUSIC_TRACKS.map(
    (t) => `<option value="${t.id}" ${s.trackId === t.id ? "selected" : ""}>${t.title}</option>`,
  ).join("");

  container.innerHTML = `
    <h3>Audio &amp; display</h3>
    <p class="setup-hint">Music starts when you enter the dream table. Settings carry into the game.</p>
    <label class="field">
      <span>Music</span>
      <select id="setup-music-mode">
        <option value="radio" ${s.musicMode === "radio" ? "selected" : ""}>📻 Radio playlist</option>
        <option value="track" ${s.musicMode === "track" ? "selected" : ""}>🎵 Single track</option>
        <option value="off" ${s.musicMode === "off" ? "selected" : ""}>🔇 Off</option>
      </select>
    </label>
    <label class="field">
      <span>Track (single mode)</span>
      <select id="setup-track" ${s.musicMode !== "track" ? "disabled" : ""}>${trackOptions}</select>
    </label>
    <label class="field">
      <span>Interface size</span>
      <select id="setup-view-mode">
        <option value="auto" ${s.viewMode === "auto" ? "selected" : ""}>Auto — fits your screen</option>
        <option value="small" ${s.viewMode === "small" ? "selected" : ""}>Small</option>
        <option value="medium" ${s.viewMode === "medium" ? "selected" : ""}>Medium</option>
        <option value="large" ${s.viewMode === "large" ? "selected" : ""}>Large</option>
      </select>
    </label>
    ${footerCreditsHtml()}
  `;

  const persist = () => {
    const viewMode = container.querySelector("#setup-view-mode")?.value || "auto";
    saveSettings({
      musicMode: container.querySelector("#setup-music-mode")?.value || "radio",
      trackId: container.querySelector("#setup-track")?.value || "dreams-become-real",
      viewMode,
    });
    setViewMode(viewMode);
  };

  container.querySelector("#setup-music-mode")?.addEventListener("change", (e) => {
    const trackSel = container.querySelector("#setup-track");
    if (trackSel) trackSel.disabled = e.target.value !== "track";
    persist();
  });
  container.querySelector("#setup-track")?.addEventListener("change", persist);
  container.querySelector("#setup-view-mode")?.addEventListener("change", persist);
}
