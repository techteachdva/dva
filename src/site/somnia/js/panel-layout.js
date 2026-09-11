import { loadSettings, saveSettings, VIEW_PRESETS } from "./audio-settings.js";

const MIN = { sidebarW: 120, handH: 80, chromeH: 48, footerH: 56 };
const MAX = { sidebarW: 420, handH: 320, chromeH: 280, footerH: 220 };

let settings = loadSettings();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function presetForMode(mode) {
  return VIEW_PRESETS[mode] || VIEW_PRESETS.medium;
}

function resolvedPanels() {
  const preset = presetForMode(settings.viewMode);
  const p = settings.panels || {};
  return {
    sidebarW: p.sidebarW ?? preset.sidebarW,
    handH: p.handH ?? preset.handH,
    chromeH: p.chromeH ?? preset.chromeH,
    footerH: p.footerH ?? preset.footerH,
    uiScale: preset.uiScale,
  };
}

export function applyLayout() {
  settings = loadSettings();
  const panels = resolvedPanels();
  const root = document.documentElement;
  root.style.setProperty("--sidebar-w", `${panels.sidebarW}px`);
  root.style.setProperty("--hand-h", `${panels.handH}px`);
  root.style.setProperty("--chrome-h", `${panels.chromeH}px`);
  root.style.setProperty("--footer-h", `${panels.footerH}px`);
  root.style.setProperty("--ui-scale", String(panels.uiScale));
  document.body.classList.remove("view-mode-small", "view-mode-medium", "view-mode-large");
  document.body.classList.add(`view-mode-${settings.viewMode || "medium"}`);

  const guideOpen = settings.guideOpen === true;
  document.getElementById("guide-panel-wrap")?.classList.toggle("collapsed", !guideOpen);
  const guideBtn = document.getElementById("btn-toggle-guide");
  if (guideBtn) {
    guideBtn.setAttribute("aria-expanded", guideOpen ? "true" : "false");
    guideBtn.textContent = guideOpen ? "📋 Hide guide" : "📋 Guide";
  }
}

export function setViewMode(mode) {
  if (!VIEW_PRESETS[mode]) return;
  settings = saveSettings({ viewMode: mode, panels: { sidebarW: null, handH: null, chromeH: null, footerH: null } });
  applyLayout();
}

export function toggleGuidePanel() {
  settings = saveSettings({ guideOpen: !settings.guideOpen });
  applyLayout();
}

export function resetPanelLayout() {
  settings = saveSettings({ panels: { sidebarW: null, handH: null, chromeH: null, footerH: null } });
  applyLayout();
}

function persistPanel(key, value) {
  settings = saveSettings({ panels: { ...settings.panels, [key]: value } });
}

function bindResizeHandle(handle, axis, key, getStart, onMove) {
  if (!handle || handle.dataset.bound) return;
  handle.dataset.bound = "1";

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const start = getStart(e);
    handle.classList.add("dragging");
    document.body.classList.add("panel-resizing");

    const move = (ev) => onMove(ev, start);
    const up = () => {
      handle.classList.remove("dragging");
      document.body.classList.remove("panel-resizing");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });

  handle.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    const start = getStart(touch);
    handle.classList.add("dragging");
    document.body.classList.add("panel-resizing");

    const move = (ev) => {
      const t = ev.touches[0];
      if (t) onMove(t, start);
    };
    const up = () => {
      handle.classList.remove("dragging");
      document.body.classList.remove("panel-resizing");
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };

    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  }, { passive: false });
}

export function initPanelLayout() {
  settings = loadSettings();
  applyLayout();

  document.getElementById("btn-toggle-guide")?.addEventListener("click", () => toggleGuidePanel());

  const panels = resolvedPanels();

  bindResizeHandle(
    document.getElementById("resize-sidebar-left"),
    "x",
    "sidebarW",
    (e) => ({ x: e.clientX, w: panels.sidebarW }),
    (e, start) => {
      const w = clamp(start.w + (e.clientX - start.x), MIN.sidebarW, MAX.sidebarW);
      document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
      persistPanel("sidebarW", w);
    },
  );

  bindResizeHandle(
    document.getElementById("resize-sidebar-right"),
    "x",
    "sidebarW",
    (e) => ({ x: e.clientX, w: panels.sidebarW }),
    (e, start) => {
      const w = clamp(start.w - (e.clientX - start.x), MIN.sidebarW, MAX.sidebarW);
      document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
      persistPanel("sidebarW", w);
    },
  );

  bindResizeHandle(
    document.getElementById("resize-hand"),
    "y",
    "handH",
    (e) => ({ y: e.clientY, h: panels.handH }),
    (e, start) => {
      const h = clamp(start.h - (e.clientY - start.y), MIN.handH, MAX.handH);
      document.documentElement.style.setProperty("--hand-h", `${h}px`);
      persistPanel("handH", h);
    },
  );

  bindResizeHandle(
    document.getElementById("resize-chrome"),
    "y",
    "chromeH",
    (e) => ({ y: e.clientY, h: panels.chromeH }),
    (e, start) => {
      const h = clamp(start.h + (e.clientY - start.y), MIN.chromeH, MAX.chromeH);
      document.documentElement.style.setProperty("--chrome-h", `${h}px`);
      persistPanel("chromeH", h);
    },
  );

  bindResizeHandle(
    document.getElementById("resize-footer"),
    "y",
    "footerH",
    (e) => ({ y: e.clientY, h: panels.footerH }),
    (e, start) => {
      const h = clamp(start.h - (e.clientY - start.y), MIN.footerH, MAX.footerH);
      document.documentElement.style.setProperty("--footer-h", `${h}px`);
      persistPanel("footerH", h);
    },
  );
}

export function getViewMode() {
  return loadSettings().viewMode || "medium";
}
