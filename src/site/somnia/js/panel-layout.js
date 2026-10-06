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

function readCssPx(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Playable box after the home indicator and status bar. Menu screens keep the full viewport. */
function insetPlayViewport(w, h) {
  if (!document.body?.classList.contains("play-window")) return { w, h };
  const insetX = readCssPx("--sal") + readCssPx("--sar");
  const insetY = readCssPx("--sat") + readCssPx("--sab");
  return {
    w: Math.max(320, w - insetX),
    h: Math.max(320, h - insetY),
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
  const raw = readViewport();
  const { form, orientation } = getCapabilityProfile();
  const phone = form === "phone";
  const tablet = form === "tablet";
  const play = phone || tablet ? insetPlayViewport(raw.w, raw.h) : { w: raw.w, h: raw.h };
  const { w, h } = play;
  const dpr = raw.dpr;
  const widthScale = w / 1600;
  const heightScale = h / 900;
  // Phones and tablets read at the root size. Scaling a tablet off a 1600×900
  // desktop made inherited type ~12px on an 11" iPad.
  const uiScale = phone || tablet
    ? 1
    : Number(clamp(Math.min(widthScale, heightScale), 0.7, 1.08).toFixed(3));

  const landscape = orientation === "landscape";
  const shortTablet = tablet && landscape && h < 780;
  const chromeH = tablet
    ? (landscape ? 92 : 100)
    : Math.round(clamp(h * (phone ? 0.10 : 0.11), phone ? 76 : 88, phone ? 104 : 120));
  const sidebarW = phone || (tablet && !landscape)
    ? 0
    : Math.round(clamp(
      w * (tablet ? 0.24 : 0.22),
      tablet ? 252 : 220,
      tablet ? 328 : 380,
    ));
  // Tablet landscape used to give the hand 31% and leave the 7-hex map at or
  // below the 44px floor (clipped on iPad mini). The map keeps ~60% of the height.
  const handFrac = tablet ? (landscape ? (shortTablet ? 0.21 : 0.20) : 0.22) : (phone ? 0.30 : 0.33);
  const handMin = tablet ? (landscape ? (shortTablet ? 152 : 168) : 240) : (phone ? 140 : 210);
  const handMaxFrac = tablet ? (landscape ? 0.24 : 0.26) : (phone ? 0.34 : 0.36);
  const minBoardFrac = tablet ? (landscape ? 0.60 : 0.54) : (phone ? 0.48 : 0.40);
  const maxHand = Math.round(h * handMaxFrac);
  const minBoard = Math.round(h * minBoardFrac);
  const handCap = Math.max(handMin, Math.min(maxHand, h - chromeH - minBoard));
  const handH = Math.round(clamp(h * handFrac, Math.min(handMin, handCap), handCap));
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
  const phoneLandscape = form === "phone" && orientation === "landscape";
  const menuLayout = phoneLandscape
    ? "split"
    : form === "phone" || w < 720 || w / h < 0.78
      ? "stack"
      : form === "tablet" || w < 1180
        ? "split"
        : "triad";
  // Triad panels are transform-scaled so the 340px launch panel stays in the
  // side gutter. Split and stack menus are not scaled (CSS sets scale to 1).
  const menuUiScale = menuLayout === "triad"
    ? Number(clamp(
      Math.min(Math.max(gutter - 12, 0) / 340, (h - 48) / 480, 1),
      0.62,
      1,
    ).toFixed(3))
    : 1;
  // Hold painted type near a readable size. On the triad, type grows when the
  // panel scale shrinks, so a 1366px laptop does not keep 12px Dreamer names.
  const setupTypeScale = Number(clamp(
    form === "phone"
      ? (phoneLandscape ? 1.22 : 1.42)
      : menuLayout === "stack"
        ? 1.42
        : menuLayout === "split"
          ? 1.2
          : 1.62 / Math.max(menuUiScale, 0.62),
    form === "phone" ? 1.2 : menuLayout === "stack" ? 1.42 : menuLayout === "split" ? 1.15 : 1.35,
    form === "phone" ? 1.42 : menuLayout === "stack" ? 1.42 : menuLayout === "split" ? 1.28 : 1.9,
  ).toFixed(2));
  const uiScale = form === "phone" || form === "tablet"
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
