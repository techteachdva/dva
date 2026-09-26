import { loadSettings, saveSettings } from "./audio-settings.js";
import { getCapabilityProfile } from "./device-mode.js";
import { onViewportSettled } from "./viewport-sync.js";

const MIN = { sidebarW: 120, handH: 80, chromeH: 72, footerH: 56 };
const MAX = { sidebarW: 480, handH: 480, chromeH: 140, footerH: 220 };

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
  const { form, orientation } = getCapabilityProfile();
  const compact = form === "phone" || form === "tablet";
  const phone = form === "phone";
  const widthScale = w / 1600;
  const heightScale = h / 900;
  // 30.2: phones already run a 12px root (game.css `html[data-form="phone"]`),
  // so the extra 0.62 body scale produced 7.4px text across the whole table.
  // Phone body text now stays at the root size; tablet/desktop keep the fit.
  const uiScale = phone
    ? 1
    : Number(clamp(Math.min(widthScale, heightScale), 0.7, 1.08).toFixed(3));

  const chromeH = Math.round(clamp(h * (phone ? 0.10 : 0.11), phone ? 76 : 88, phone ? 104 : 120));
  const sidebarW = phone || (form === "tablet" && orientation === "portrait")
    ? 0
    : Math.round(clamp(
      w * (form === "tablet" ? 0.34 : compact ? 0.22 : 0.22),
      form === "tablet" ? 340 : compact ? 220 : 220,
      form === "tablet" ? 460 : compact ? 320 : 380,
    ));
  const maxHand = Math.round(h * (phone ? 0.34 : compact ? 0.34 : 0.36));
  const minBoard = Math.round(h * (phone ? 0.48 : compact ? 0.46 : 0.40));
  const handH = Math.round(clamp(
    h * (phone ? 0.30 : compact ? 0.31 : 0.33),
    phone ? 140 : compact ? 168 : 210,
    Math.min(maxHand, h - chromeH - minBoard),
  ));
  const dockBudget = Math.round(handH * (phone ? 0.48 : 0.58));
  const btnH = Math.round(clamp((dockBudget - 36) / 3, phone ? 32 : 34, phone ? 44 : 64));
  const btnFs = Number(clamp(btnH / 40, 0.78, 1.55).toFixed(2));

  return {
    w,
    h,
    dpr,
    uiScale,
    sidebarW,
    handH,
    chromeH,
    footerH: Math.round(handH * (phone ? 0.28 : 0.35)),
    actionBtnH: `${btnH}px`,
    actionBtnFs: `${btnFs}rem`,
    heightBand: heightBand(h),
    widthBand: widthBand(w),
    form,
    orientation,
  };
}

/** Menu/setup scaling — keeps triad panels inside side gutters around box art. */
export function computeMenuViewportMetrics() {
  const { w, h, dpr } = readViewport();
  const { form, orientation } = getCapabilityProfile();
  const artSize = Math.min(w, h);
  const gutter = Math.max(0, (w - artSize) / 2);
  const compact = form === "phone" || form === "tablet";
  const menuUiScale = Number(clamp(
    form === "phone" ? 0.72 : compact ? 0.88 : Math.min(gutter / 300, h / 980, w / 1500),
    form === "phone" ? 0.62 : compact ? 0.78 : 0.42,
    form === "phone" ? 0.78 : compact ? 0.92 : 0.74,
  ).toFixed(3));
  const phoneLandscape = form === "phone" && orientation === "landscape";
  const menuLayout = phoneLandscape
    ? "split"
    : form === "phone" || w < 720 || w / h < 0.78
      ? "stack"
      : form === "tablet" || w < 1180
        ? "split"
        : "triad";
  // 30.2: stacked / split menus are not transform-scaled (see game.css
  // `html[data-menu-layout="stack"] .menu-glass-panel { transform: none }`), so
  // the type scale is the only thing standing between the player and 5px labels.
  // Phones read at ~1.4 on a 12px root (≈13-15px body, 48px buttons); the
  // column scrolls, so nothing is squeezed to fit.
  const setupTypeScale = Number(clamp(
    form === "phone"
      ? (phoneLandscape ? 1.22 : 1.42)
      : menuLayout === "stack"
        ? 1.42
        : compact
          ? Math.min(w / 920, h / 820, 0.9)
          : Math.min(w / 620, h / 420, menuUiScale * 4.2),
    form === "phone" ? 1.2 : menuLayout === "stack" ? 1.42 : compact ? 0.78 : 1.35,
    form === "phone" ? 1.42 : menuLayout === "stack" ? 1.42 : compact ? 0.9 : 2.75,
  ).toFixed(2));
  const uiScale = form === "phone"
    ? 1
    : Number(clamp(Math.min(w / 1600, h / 900), 0.75, 1.12).toFixed(3));

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
    stackMenu: menuLayout !== "triad",
    menuLayout,
  };
}

/**
 * 30.2: the table always sizes itself from the real viewport + device form
 * (desktop / tablet / phone). The old Small / Medium / Large presets are gone;
 * a stored preset from an earlier version is read as "auto". On desktop the
 * player may still drag panel edges (persisted in settings.panels); compact
 * forms ignore those drags because their chrome is computed per orientation.
 */
function resolvedPanels() {
  const metrics = computeViewportMetrics();
  const p = settings.panels || {};
  const compact = metrics.form === "phone" || metrics.form === "tablet";

  if (compact) {
    return {
      sidebarW: metrics.sidebarW,
      handH: metrics.handH,
      chromeH: metrics.chromeH,
      footerH: metrics.footerH,
      uiScale: metrics.uiScale,
      actionBtnH: metrics.actionBtnH,
      actionBtnFs: metrics.actionBtnFs,
      metrics,
    };
  }

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

function applyViewportDataset(metrics) {
  const root = document.documentElement;
  root.dataset.viewportHeight = metrics.heightBand;
  root.dataset.viewportWidth = metrics.widthBand;
  root.dataset.viewportDpr = String(Math.round((metrics.dpr || 1) * 10) / 10);
}

function applyMenuDataset(metrics) {
  const root = document.documentElement;
  root.dataset.menuLayout = metrics.menuLayout || (metrics.stackMenu ? "stack" : "triad");
  applyViewportDataset(metrics);
}

function applyMenuLayout() {
  const metrics = computeMenuViewportMetrics();
  const targets = [document.documentElement, document.body].filter(Boolean);
  for (const el of targets) {
    el.style.setProperty("--menu-art-size", metrics.artSize);
    el.style.setProperty("--menu-ui-scale", String(metrics.menuUiScale));
    el.style.setProperty("--setup-type-scale", String(metrics.setupTypeScale));
    el.style.setProperty("--ui-scale", String(metrics.uiScale));
  }
  applyMenuDataset(metrics);
  document.body.classList.remove("view-mode-small", "view-mode-medium", "view-mode-large");
  document.body.classList.add("view-mode-auto");
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
  root.style.setProperty("--topbar-h", `${panels.chromeH}px`);
  root.style.setProperty("--footer-h", `${panels.footerH}px`);
  root.style.setProperty("--ui-scale", String(panels.uiScale));
  root.style.setProperty("--action-btn-h", panels.actionBtnH);
  root.style.setProperty("--action-btn-fs", panels.actionBtnFs);
  applyViewportDataset(panels.metrics);
  document.body.classList.remove("view-mode-small", "view-mode-medium", "view-mode-large");
  document.body.classList.add("view-mode-auto");
}

/** Kept for older call sites; every mode now resolves to auto-fit. */
export function setViewMode() {
  settings = saveSettings({
    viewMode: "auto",
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

/**
 * Panel resize handles use Pointer Events with capture: once the handle captures
 * the pointer, every pointermove/pointerup is delivered to the handle itself, so
 * nothing needs window-level touch listeners. (The hand bar and sidebar are
 * quarantined overlays — see input-quarantine.js — which stop touch events at
 * their boundary; window listeners would never have seen the touchend.)
 * One pointer at a time; a second finger is ignored rather than fighting the drag.
 */
function bindResizeHandle(handle, axis, key, getStart, onMove) {
  if (!handle || handle.dataset.bound) return;
  handle.dataset.bound = "1";

  let activePointer = null;
  let start = null;

  const finish = (e) => {
    if (activePointer == null || (e && e.pointerId !== activePointer)) return;
    activePointer = null;
    start = null;
    handle.classList.remove("dragging");
    document.body.classList.remove("panel-resizing");
    try {
      if (e && handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  handle.addEventListener("pointerdown", (e) => {
    if (activePointer != null) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    activePointer = e.pointerId;
    start = getStart(e);
    handle.classList.add("dragging");
    document.body.classList.add("panel-resizing");
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — moves still arrive while the pointer is over the handle */
    }
  });

  handle.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePointer || !start) return;
    onMove(e, start);
  });
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("lostpointercapture", finish);
}

/**
 * VIEWPORT SYNC: panel CSS variables are the "layout" phase of the single settle
 * lane, after device-mode has refreshed the profile and before the board camera
 * and the one render. Keyboard-only changes skip relayout — the table did not move.
 */
function bindViewportFit() {
  if (viewportBound) return;
  viewportBound = true;
  onViewportSettled("layout", (ctx) => {
    if (ctx.keyboardToggled && !ctx.orientationFlipped
      && Math.abs(ctx.widthDelta) < 2 && Math.abs(ctx.heightDelta) < 2) return;
    applyLayout();
  });
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
