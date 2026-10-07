/**
 * Viewport sync — one coordinator for every "the screen changed size" reaction.
 *
 * iPad Safari collapses and expands its toolbars, the software keyboard shortens
 * the *visual* viewport without touching 100dvh, rotation swaps the axes, and the
 * itch.io iframe can be resized by the host page. Before this module four separate
 * debouncers (device-mode, panel-layout, board-zoom, play.js ResizeObserver) each
 * reacted on their own clock, producing two or three full board renders per rotation.
 *
 * Two lanes:
 *
 *  FAST lane (rAF-coalesced, every viewport event): write CSS custom properties so
 *  fixed overlays stay locked to the *visible* bounds — the DOM analogue of
 *  renderer.setSize(): `--vvh`, `--vvw`, `--vv-top`, `--vv-left`, `--kbd-h`,
 *  plus `data-keyboard` and `data-embedded` on <html>.
 *
 *  SETTLED lane (debounced): run subscribers in a fixed phase order —
 *  measure (device profile) -> layout (panel CSS vars) -> camera (board fit)
 *  -> render (one renderAll). That is the DOM analogue of
 *  camera.aspect = w/h; camera.updateProjectionMatrix(); render().
 *
 * INTEGRATION: `initViewportSync()` first thing in play.js/setup.js init(). Modules
 * register with `onViewportSettled(phase, fn)` instead of adding their own
 * resize listeners. `requestRender()` coalesces ad-hoc render requests
 * (ResizeObserver callbacks, fullscreen changes) into the same single frame.
 */

import { refreshFrameInfo, getFrameInfo, invalidateViewportRect } from "./frame-metrics.js";

export const PHASES = ["measure", "layout", "camera", "render"];

const SETTLE_MS = 160;
const ORIENTATION_SETTLE_MS = 320;
const MIN_DELTA_PX = 2;

const subscribers = { measure: [], layout: [], camera: [], render: [] };

let initialised = false;
let fastRaf = 0;
let settleTimer = 0;
let renderRaf = 0;
let lastW = 0;
let lastH = 0;
let lastOrientationLandscape = null;
let lastKeyboardInset = 0;

/** Last event that triggered the settle lane — subscribers can read it to decide how hard to react. */
const settleContext = {
  orientationFlipped: false,
  keyboardToggled: false,
  widthDelta: 0,
  heightDelta: 0,
  reason: "init",
};

const root = () => document.documentElement;

/* ---------------------------------------------------------------------------
 * FAST lane: CSS variables
 * ------------------------------------------------------------------------- */

function writeFrameVars() {
  fastRaf = 0;
  const info = refreshFrameInfo();
  const style = root().style;
  // Page pinch-zoom (accessibility zoom, or a host page the user zoomed) magnifies a
  // window onto the *layout* viewport; the layout must not shrink to that window,
  // so fall back to layout metrics whenever the visual viewport is scaled.
  const pageZoomed = Math.abs(info.vvScale - 1) > 0.01;
  const visibleH = pageZoomed ? info.layoutHeight : info.vvHeight;
  const visibleW = pageZoomed ? info.layoutWidth : info.vvWidth;
  // Visible height/width in CSS px. Fallbacks in CSS are 100dvh / 100vw.
  style.setProperty("--vvh", `${Math.round(visibleH)}px`);
  style.setProperty("--vvw", `${Math.round(visibleW)}px`);
  // Where the visible region sits inside the layout viewport (non-zero when Safari
  // has scrolled a focused input into view above the keyboard).
  style.setProperty("--vv-top", `${pageZoomed ? 0 : Math.round(info.vvOffsetTop)}px`);
  style.setProperty("--vv-left", `${pageZoomed ? 0 : Math.round(info.vvOffsetLeft)}px`);
  style.setProperty("--kbd-h", `${info.keyboardInset}px`);
  root().dataset.keyboard = info.keyboardInset > 0 ? "open" : "closed";
  root().dataset.embedded = info.embedded ? "true" : "false";
  invalidateViewportRect();
}

function scheduleFast() {
  if (fastRaf) return;
  fastRaf = requestAnimationFrame(writeFrameVars);
}

/* ---------------------------------------------------------------------------
 * SETTLED lane: ordered phases
 * ------------------------------------------------------------------------- */

function runPhase(name) {
  const list = subscribers[name];
  for (let i = 0; i < list.length; i += 1) {
    try {
      list[i](settleContext);
    } catch (err) {
      console.error(`Somnia viewport-sync: ${name} subscriber failed`, err);
    }
  }
}

function runSettled() {
  settleTimer = 0;
  const info = refreshFrameInfo();
  const w = info.layoutWidth;
  const h = info.layoutHeight;
  const landscape = w >= h;

  settleContext.widthDelta = w - lastW;
  settleContext.heightDelta = h - lastH;
  settleContext.orientationFlipped = lastOrientationLandscape != null && landscape !== lastOrientationLandscape;
  settleContext.keyboardToggled = (info.keyboardInset > 0) !== (lastKeyboardInset > 0);

  const moved = Math.abs(settleContext.widthDelta) >= MIN_DELTA_PX
    || Math.abs(settleContext.heightDelta) >= MIN_DELTA_PX;
  if (!moved && !settleContext.orientationFlipped && !settleContext.keyboardToggled && settleContext.reason !== "init") {
    return;
  }

  lastW = w;
  lastH = h;
  lastOrientationLandscape = landscape;
  lastKeyboardInset = info.keyboardInset;

  writeFrameVars();
  runPhase("measure");
  runPhase("layout");
  invalidateViewportRect();
  runPhase("camera");
  requestRender();
}

function scheduleSettle(reason, delay = SETTLE_MS) {
  settleContext.reason = reason;
  scheduleFast();
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(runSettled, delay);
}

function flushRender() {
  renderRaf = 0;
  invalidateViewportRect();
  runPhase("render");
}

/**
 * Coalesce any number of render requests in one frame into a single render phase.
 * ResizeObserver callbacks, fullscreenchange, drawer toggles — all funnel here.
 */
export function requestRender() {
  if (renderRaf) return;
  renderRaf = requestAnimationFrame(flushRender);
}

/**
 * Subscribe to a settle phase. Returns an unsubscribe function.
 * @param {"measure"|"layout"|"camera"|"render"} phase
 * @param {(ctx: typeof settleContext) => void} fn
 */
export function onViewportSettled(phase, fn) {
  if (!subscribers[phase]) throw new Error(`Unknown viewport phase: ${phase}`);
  subscribers[phase].push(fn);
  return () => {
    const list = subscribers[phase];
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  };
}

/** Current settle context (read-only; reused object, do not retain). */
export function getSettleContext() {
  return settleContext;
}

/** Run the settle lane now (e.g. right after the game screen becomes visible). */
export function forceViewportSettle(reason = "manual") {
  window.clearTimeout(settleTimer);
  settleTimer = 0;
  settleContext.reason = reason;
  runSettled();
}

export function initViewportSync() {
  if (initialised) return;
  initialised = true;

  const info = refreshFrameInfo();
  lastW = info.layoutWidth;
  lastH = info.layoutHeight;
  lastOrientationLandscape = lastW >= lastH;
  lastKeyboardInset = info.keyboardInset;
  writeFrameVars();

  window.addEventListener("resize", () => scheduleSettle("resize"));
  window.addEventListener("orientationchange", () => scheduleSettle("orientation", ORIENTATION_SETTLE_MS));
  screen.orientation?.addEventListener?.("change", () => scheduleSettle("orientation", ORIENTATION_SETTLE_MS));
  document.addEventListener("fullscreenchange", () => scheduleSettle("fullscreen"));
  window.addEventListener("pageshow", () => scheduleSettle("pageshow"));

  const vv = window.visualViewport;
  if (vv) {
    // Toolbar collapse and keyboard: fast lane immediately, settle lane after.
    vv.addEventListener("resize", () => scheduleSettle("visualViewport"));
    // Scroll of the visual viewport (page zoomed / input scrolled into view) only
    // moves the visible region — fast lane is enough, no relayout.
    vv.addEventListener("scroll", scheduleFast);
  }

  // Focus/blur on text fields is the earliest keyboard signal on iOS.
  document.addEventListener("focusin", (event) => {
    if (event.target?.matches?.("input, textarea, select")) scheduleSettle("keyboard");
  });
  document.addEventListener("focusout", (event) => {
    if (event.target?.matches?.("input, textarea, select")) scheduleSettle("keyboard", ORIENTATION_SETTLE_MS);
  });
}

export { getFrameInfo };
