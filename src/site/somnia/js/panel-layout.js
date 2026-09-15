import { loadSettings, saveSettings, VIEW_PRESETS } from "./audio-settings.js";

const MIN = { sidebarW: 120, handH: 80, chromeH: 48, footerH: 56 };
const MAX = { sidebarW: 480, handH: 400, chromeH: 120, footerH: 220 };

let settings = loadSettings();
let viewportBound = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readViewport() {
  const vv = window.visualViewport;
  const w = Math.max(320, Math.round(vv?.width || window.innerWidth || 1280));
  const h = Math.max(320, Math.round(vv?.height || window.innerHeight || 720));
  return {
    w,
    h,
    dpr: window.devicePixelRatio || 1,
  };
}

function heightBand(h) {
  return h < 760 ? "short" : h < 960 ? "standard" : "tall";
}

function widthBand(w) {
  return w < 1180 ? "narrow" : w < 1600 ? "standard" : "wide";
}

/** Layout metrics derived from the actual CSS viewport (includes OS display scaling). */
export function computeViewportMetrics() {
  const { w, h, dpr } = readViewport();
  const widthScale = w / 1600;
  const heightScale = h / 900;
  const uiScale = Number(clamp(Math.min(widthScale, heightScale), 0.7, 1.08).toFixed(3));

  const chromeH = Math.round(clamp(h * 0.055, 44, 58));
  const sidebarW = Math.round(clamp(w * 0.2, 196, 340));
  const maxHand = Math.round(h * 0.46);
  const minBoard = Math.round(h * 0.44);
  const handH = Math.round(clamp(h * 0.30, 168, Math.min(maxHand, h - chromeH - minBoard)));
  const dockBudget = Math.round(handH * 0.58);
  const btnH = Math.round(clamp((dockBudget - 36) / 3, 34, 64));
  const btnFs = Number(clamp(btnH / 40, 0.82, 1.55).toFixed(2));

  return {
    w,
    h,
    dpr,
    uiScale,
    sidebarW,
    handH,
    chromeH,
    footerH: Math.round(handH * 0.35),
    actionBtnH: `${btnH}px`,
    actionBtnFs: `${btnFs}rem`,
    heightBand: heightBand(h),
    widthBand: widthBand(w),
  };
}

/** Menu/setup scaling — keeps triad panels inside side gutters around box art. */
export function computeMenuViewportMetrics() {
  const { w, h, dpr } = readViewport();
  const artSize = Math.min(w, h);
  const gutter = Math.max(0, (w - artSize) / 2);
  const menuUiScale = Number(clamp(
    Math.min(gutter / 300, h / 980, w / 1500),
    0.42,
    0.74,
  ).toFixed(3));
  const setupTypeScale = Number(clamp(
    Math.min(w / 620, h / 420, menuUiScale * 4.2),
    1.35,
    2.75,
  ).toFixed(2));
  const uiScale = Number(clamp(Math.min(w / 1600, h / 900), 0.75, 1.12).toFixed(3));

  return {
    w,
    h,
    dpr,
    artSize: `${artSize}px`,
    menuUiScale,
    setupTypeScale,
    uiScale,
    heightBand: heightBand(h),
    widthBand: widthBand(w),
    stackMenu: w < 980 || w / h < 0.85,
  };
}

function presetForMode(mode) {
  if (!mode || mode === "auto") return null;
  return VIEW_PRESETS[mode] || VIEW_PRESETS.medium;
}

function resolvedPanels() {
  const metrics = computeViewportMetrics();
  const mode = settings.viewMode || "auto";
  const p = settings.panels || {};
  const preset = presetForMode(mode);

  if (!preset) {
    return {
      sidebarW: p.sidebarW ?? metrics.sidebarW,
      handH: p.handH ?? metrics.handH,
      chromeH: p.chromeH ?? metrics.chromeH,
      footerH: p.footerH ?? metrics.footerH,
      uiScale: metrics.uiScale,
      actionBtnH: metrics.actionBtnH,
      actionBtnFs: metrics.actionBtnFs,
      metrics,
    };
  }

  return {
    sidebarW: p.sidebarW ?? Math.min(preset.sidebarW, Math.round(metrics.sidebarW * 1.15)),
    handH: p.handH ?? Math.min(preset.handH, metrics.handH),
    chromeH: p.chromeH ?? preset.chromeH,
    footerH: p.footerH ?? preset.footerH,
    uiScale: Math.min(preset.uiScale, Number((metrics.uiScale * 1.12).toFixed(3))),
    actionBtnH: metrics.actionBtnH,
    actionBtnFs: metrics.actionBtnFs,
    metrics,
  };
}

function applyViewportDataset(metrics) {
  const root = document.documentElement;
  root.dataset.viewportHeight = metrics.heightBand;
  root.dataset.viewportWidth = metrics.widthBand;
  root.dataset.viewportDpr = String(Math.round((metrics.dpr || 1) * 10) / 10);
}

function applyMenuDataset(metrics) {
  const root = document.documentElement;
  root.dataset.menuLayout = metrics.stackMenu ? "stack" : "triad";
  applyViewportDataset(metrics);
}

function applyMenuLayout() {
  const metrics = computeMenuViewportMetrics();
  const root = document.documentElement;
  root.style.setProperty("--menu-art-size", metrics.artSize);
  root.style.setProperty("--menu-ui-scale", String(metrics.menuUiScale));
  root.style.setProperty("--setup-type-scale", String(metrics.setupTypeScale));
  root.style.setProperty("--ui-scale", String(metrics.uiScale));
  applyMenuDataset(metrics);
  document.body.classList.remove("view-mode-small", "view-mode-medium", "view-mode-large", "view-mode-auto");
  document.body.classList.add(`view-mode-${settings.viewMode || "auto"}`);
}

export function applyLayout() {
  settings = loadSettings();
  if (document.body.classList.contains("menu-window")) {
    applyMenuLayout();
    return;
  }

  const panels = resolvedPanels();
  const root = document.documentElement;
  root.style.setProperty("--sidebar-w", `${panels.sidebarW}px`);
  root.style.setProperty("--hand-h", `${panels.handH}px`);
  root.style.setProperty("--chrome-h", `${panels.chromeH}px`);
  root.style.setProperty("--footer-h", `${panels.footerH}px`);
  root.style.setProperty("--ui-scale", String(panels.uiScale));
  root.style.setProperty("--action-btn-h", panels.actionBtnH);
  root.style.setProperty("--action-btn-fs", panels.actionBtnFs);
  applyViewportDataset(panels.metrics);
  document.body.classList.remove("view-mode-small", "view-mode-medium", "view-mode-large", "view-mode-auto");
  document.body.classList.add(`view-mode-${settings.viewMode || "auto"}`);
}

export function setViewMode(mode) {
  if (mode !== "auto" && !VIEW_PRESETS[mode]) return;
  settings = saveSettings({
    viewMode: mode,
    panels: { sidebarW: null, handH: null, chromeH: null, footerH: null },
  });
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

function bindViewportFit() {
  if (viewportBound) return;
  viewportBound = true;
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applyLayout(), 80);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => setTimeout(applyLayout, 180));
  window.visualViewport?.addEventListener("resize", onResize);
}

export function initPanelLayout() {
  settings = loadSettings();
  applyLayout();
  bindViewportFit();

  const panels = resolvedPanels();

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
}

export function getViewMode() {
  return loadSettings().viewMode || "auto";
}
