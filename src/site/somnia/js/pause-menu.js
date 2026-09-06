import {
  loadSettings,
  saveSettings,
  MUSIC_TRACKS,
  VIEW_PRESETS,
  musicCreditHtml,
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
import { showOverviewModal, showRulesModal } from "./ui.js";

let open = false;
let onResume = null;

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
    ${musicCreditHtml()}
  `;
}

function renderDisplayTab() {
  const mode = loadSettings().viewMode || "medium";
  const modes = Object.keys(VIEW_PRESETS).map(
    (m) => `<button type="button" class="btn ${mode === m ? "primary" : ""}" data-view-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`,
  ).join("");

  return `
    <div class="pause-section">
      <h3>Interface size</h3>
      <p class="pause-hint">Quick presets for sidebar, hand, and text scale.</p>
      <div class="pause-btn-row">${modes}</div>
    </div>
    <div class="pause-section">
      <h3>Panel layout</h3>
      <p class="pause-hint">Drag the edges between panels in-game to resize. Reset restores the current preset.</p>
      <button type="button" class="btn" id="pause-reset-panels">Reset panel sizes</button>
    </div>
  `;
}

function renderHelpTab() {
  return `
    <div class="pause-section">
      <h3>Learn &amp; reference</h3>
      <div class="pause-btn-row pause-btn-col">
        <button type="button" class="btn" id="pause-overview">Game overview</button>
        <button type="button" class="btn" id="pause-rules">Full rules</button>
        <button type="button" class="btn" id="pause-tutorial">Tutorial</button>
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
    root.querySelector("#pause-music-pan-label")?.textContent = panLabel(v);
  });

  const sfxPan = root.querySelector("#pause-sfx-pan");
  sfxPan?.addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    setSfxPan(v);
    root.querySelector("#pause-sfx-pan-label")?.textContent = panLabel(v);
  });
}

function bindDisplayControls(root) {
  root.querySelectorAll("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setViewMode(btn.dataset.viewMode);
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
  } else if (tabId === "help") {
    body.innerHTML = renderHelpTab();
    body.querySelector("#pause-overview")?.addEventListener("click", () => {
      closePauseMenu();
      showOverviewModal();
    });
    body.querySelector("#pause-rules")?.addEventListener("click", () => {
      closePauseMenu();
      showRulesModal();
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

export function initPauseMenu({ onResumeCallback } = {}) {
  onResume = onResumeCallback || null;
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
        <option value="small" ${s.viewMode === "small" ? "selected" : ""}>Small</option>
        <option value="medium" ${s.viewMode === "medium" ? "selected" : ""}>Medium</option>
        <option value="large" ${s.viewMode === "large" ? "selected" : ""}>Large</option>
      </select>
    </label>
    ${musicCreditHtml()}
  `;

  const persist = () => {
    saveSettings({
      musicMode: container.querySelector("#setup-music-mode")?.value || "radio",
      trackId: container.querySelector("#setup-track")?.value || "dreams-become-real",
      viewMode: container.querySelector("#setup-view-mode")?.value || "medium",
    });
  };

  container.querySelector("#setup-music-mode")?.addEventListener("change", (e) => {
    const trackSel = container.querySelector("#setup-track");
    if (trackSel) trackSel.disabled = e.target.value !== "track";
    persist();
  });
  container.querySelector("#setup-track")?.addEventListener("change", persist);
  container.querySelector("#setup-view-mode")?.addEventListener("change", persist);
}
