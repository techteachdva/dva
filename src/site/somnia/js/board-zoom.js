import { prefersTouchUi } from "./device-mode.js";
import { getViewportRect, invalidateViewportRect } from "./frame-metrics.js";
import { onViewportSettled } from "./viewport-sync.js";

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 5.5;
const ZOOM_SENSITIVITY = 0.0012;
const BUTTON_ZOOM_FACTOR = 1.18;
const PAN_CLICK_THRESHOLD = 5;
/** A fingertip on iPad jitters well past 10px. Past this, the gesture becomes a pan. */
export const TOUCH_TAP_SLOP = 28;
const TOUCH_PAN_THRESHOLD = TOUCH_TAP_SLOP;
const ARROW_PAN_FRACTION = 0.06;
const EMPTY_DOUBLE_TAP_MS = 400;

let viewport = null;
let stage = null;
/** Multiplier on the viewport-fit hex size (native resize, not CSS scale). */
let zoom = 1;
let panX = 0;
let panY = 0;
let userAdjusted = false;
let bound = false;
let zoomChangeHandler = null;
let cameraMoveHandler = null;
let zoomRaf = 0;
let pendingPan = null;
/** Applied after the hex board is in the DOM (avoids focus races with re-render). */
let pendingFocus = null;

let spaceHeld = false;
let panning = false;
let pendingTouchPan = false;
let panPointerId = null;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;
let panMoved = false;
let suppressClick = false;

/* ---- Zero-allocation pointer tracking -----------------------------------
   Board gestures never need more than two fingers. Two preallocated slots
   replace a Map<id, {x,y}> that used to allocate an object on every
   pointermove and spread into arrays for distance/midpoint math. */
const slotA = { id: -1, x: 0, y: 0 };
const slotB = { id: -1, x: 0, y: 0 };
let pointerCount = 0;

function slotFor(id) {
  if (slotA.id === id) return slotA;
  if (slotB.id === id) return slotB;
  return null;
}

function trackPointer(id, x, y) {
  let slot = slotFor(id);
  if (!slot) {
    if (slotA.id === -1) slot = slotA;
    else if (slotB.id === -1) slot = slotB;
    else return null; // third finger: ignored
    slot.id = id;
    pointerCount += 1;
  }
  slot.x = x;
  slot.y = y;
  return slot;
}

function untrackPointer(id) {
  const slot = slotFor(id);
  if (!slot) return;
  slot.id = -1;
  pointerCount -= 1;
}

function clearPointers() {
  slotA.id = -1;
  slotB.id = -1;
  pointerCount = 0;
}

/** The single remaining tracked pointer after a pinch ends, or null. */
function remainingPointer() {
  if (pointerCount !== 1) return null;
  return slotA.id !== -1 ? slotA : slotB;
}

let pinchActive = false;
let pinchStartDist = 0;
let pinchStartZoom = 1;
let pinchOriginPanX = 0;
let pinchOriginPanY = 0;
let pinchMidX = 0;
let pinchMidY = 0;
let gestureScale = 1;

let lastEmptyTapAt = 0;
let cameraControls = null;

export function getBoardZoom() {
  return zoom;
}

export function getMaxBoardZoom() {
  return MAX_ZOOM;
}

export function setBoardZoomChangeHandler(handler) {
  zoomChangeHandler = handler;
}

export function setBoardCameraMoveHandler(handler) {
  cameraMoveHandler = handler;
}

/* ---- Camera transform: one style write per frame --------------------------
   pointermove can fire at 120 Hz on iPad Pro; writing style.transform (and
   notifying radial/spotlight followers) on every event forced layout reads
   between writes. Now moves only mark the camera dirty; the next animation
   frame writes the transform once and notifies followers once. */
let transformRaf = 0;
let transformDirty = false;
let lastTransformPanX = NaN;
let lastTransformPanY = NaN;
let lastTransformScale = NaN;
/** Set by animated focus snaps so followers know to track the CSS transition. */
let animatedCameraMove = false;

function flushTransform() {
  transformRaf = 0;
  if (!transformDirty || !stage) return;
  transformDirty = false;
  if (panX !== lastTransformPanX || panY !== lastTransformPanY || gestureScale !== lastTransformScale) {
    lastTransformPanX = panX;
    lastTransformPanY = panY;
    lastTransformScale = gestureScale;
    stage.style.transform = gestureScale !== 1
      ? `translate3d(${panX}px, ${panY}px, 0) scale(${gestureScale})`
      : `translate3d(${panX}px, ${panY}px, 0)`;
  }
  const animated = animatedCameraMove;
  animatedCameraMove = false;
  cameraMoveHandler?.(animated);
}

function applyTransform() {
  if (!stage) return;
  transformDirty = true;
  if (transformRaf) return;
  transformRaf = requestAnimationFrame(flushTransform);
}

/** Write the transform synchronously (used right after a full board render). */
function applyTransformNow() {
  if (!stage) return;
  transformDirty = true;
  if (transformRaf) {
    cancelAnimationFrame(transformRaf);
    transformRaf = 0;
  }
  flushTransform();
}

/**
 * Current camera for hit-testing: board-local = (viewportLocal - pan) / scale.
 * Writes into `out` (no allocation). `scale` is the live pinch multiplier only;
 * the committed zoom is already baked into the rendered hex size.
 * @param {{panX:number,panY:number,scale:number}} out
 */
export function getBoardCamera(out) {
  out.panX = panX;
  out.panY = panY;
  out.scale = gestureScale;
  return out;
}

function getBoardEl() {
  return stage?.querySelector("#hex-board");
}

export function centerBoardPan() {
  if (!viewport) return;
  const board = getBoardEl();
  if (!board) return;
  panX = (viewport.clientWidth - board.offsetWidth) / 2;
  panY = (viewport.clientHeight - board.offsetHeight) / 2;
  applyTransform();
}

function flushZoomRender() {
  zoomRaf = 0;
  zoomChangeHandler?.();
  if (pendingPan) {
    panX = pendingPan.panX;
    panY = pendingPan.panY;
    pendingPan = null;
  }
  applyTransform();
}

function scheduleZoomRender() {
  if (zoomRaf) return;
  zoomRaf = requestAnimationFrame(flushZoomRender);
}

export function resetBoardZoom() {
  zoom = 1;
  panX = 0;
  panY = 0;
  gestureScale = 1;
  userAdjusted = false;
}

/** Fit the full hex board in the viewport at maximum size (default table view). */
export function fitBoardToViewport() {
  zoom = 1;
  panX = 0;
  panY = 0;
  gestureScale = 1;
  userAdjusted = false;
  zoomChangeHandler?.();
}

function applyQueuedBoardFocus() {
  if (!pendingFocus || !viewport || !stage) return false;
  const { landscapeId, playerId, animate } = pendingFocus;
  pendingFocus = null;

  const token = playerId
    ? document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${playerId}"]`)
    : null;
  const tile = token || document.querySelector(`.hex-tile[data-tile-id="${landscapeId}"]`);
  if (!tile) return false;

  const tileRect = tile.getBoundingClientRect();
  const vpRect = viewport.getBoundingClientRect();
  const tileCx = tileRect.left + tileRect.width / 2;
  const tileCy = tileRect.top + tileRect.height / 2;
  const vpCx = vpRect.left + vpRect.width / 2;
  const vpCy = vpRect.top + vpRect.height / 2;
  panX += vpCx - tileCx;
  panY += vpCy - tileCy;

  const useMotion = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (useMotion) {
    stage.classList.add("board-focus-snap");
    animatedCameraMove = true;
    window.setTimeout(() => {
      stage.classList.remove("board-focus-snap");
      cameraMoveHandler?.(false);
    }, 420);
  }
  applyTransform();
  return true;
}

export function syncBoardZoomAfterRender() {
  invalidateViewportRect();
  if (!userAdjusted) centerBoardPan();
  applyTransformNow();
  applyQueuedBoardFocus();
}

/** Snap pan/zoom to center a landscape hex (e.g. dreamer selection). */
export function focusOnLandscape(landscapeId, { zoom: targetZoom = 2.35, animate = true, playerId = null } = {}) {
  if (!viewport || !stage || !landscapeId) return false;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
  const zoomChanged = Math.abs(nextZoom - zoom) > 0.001;
  zoom = nextZoom;
  userAdjusted = true;
  pendingFocus = { landscapeId, playerId, animate: animate !== false };

  if (zoomChanged) {
    zoomChangeHandler?.();
    return true;
  }

  applyQueuedBoardFocus();
  return true;
}

/** Max-zoom onto a Dreamer token on the board and center the camera on it. */
export function focusOnDreamer(playerId, landscapeId, options = {}) {
  return focusOnLandscape(landscapeId, {
    zoom: MAX_ZOOM,
    animate: options.animate !== false,
    playerId,
  });
}

/** Suppress the next hex click after a pan / pinch / inspect so tiles are not selected accidentally. */
export function consumeBoardClickSuppression() {
  if (!suppressClick) return false;
  suppressClick = false;
  return true;
}

export function suppressNextBoardClick() {
  suppressClick = true;
}

export function isBoardCameraBusy() {
  return panning || pinchActive;
}

export function cancelPendingBoardGesture() {
  pendingTouchPan = false;
  panPointerId = null;
  panMoved = false;
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function isTouchLike(event) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function canImmediatePan(event) {
  if (event.button === 1) return true;
  if (event.button === 0 && (spaceHeld || event.altKey)) return true;
  return false;
}

function setPanning(active) {
  panning = active;
  if (!viewport) return;
  viewport.classList.toggle("board-panning", active || pinchActive);
  viewport.classList.toggle("board-pan-ready", !active && !pinchActive && spaceHeld);
}

function pointerDistance() {
  if (pointerCount < 2) return 0;
  return Math.hypot(slotA.x - slotB.x, slotA.y - slotB.y);
}

function startPinch() {
  if (pointerCount < 2 || !viewport) return;
  // Viewport rect comes from frame-metrics (cached per frame) so the pinch anchor
  // is exact inside an iframe or with drawers open — same rect hit-testing uses.
  const rect = getViewportRect();
  pinchActive = true;
  pendingTouchPan = false;
  panning = false;
  pinchStartDist = Math.max(1, pointerDistance());
  pinchStartZoom = zoom;
  pinchOriginPanX = panX;
  pinchOriginPanY = panY;
  pinchMidX = (slotA.x + slotB.x) / 2 - rect.left;
  pinchMidY = (slotA.y + slotB.y) / 2 - rect.top;
  gestureScale = 1;
  userAdjusted = true;
  suppressClick = true;
  lastEmptyTapAt = 0;
  viewport.classList.add("board-panning");
}

function updatePinch() {
  if (!pinchActive || !viewport) return;
  const liveScale = pointerDistance() / pinchStartDist;
  const nextScale = clampZoom(pinchStartZoom * liveScale) / pinchStartZoom;
  const rect = getViewportRect();
  pinchMidX = (slotA.x + slotB.x) / 2 - rect.left;
  pinchMidY = (slotA.y + slotB.y) / 2 - rect.top;
  gestureScale = nextScale;
  panX = pinchMidX - (pinchMidX - pinchOriginPanX) * nextScale;
  panY = pinchMidY - (pinchMidY - pinchOriginPanY) * nextScale;
  applyTransform();
}

function endPinch() {
  if (!pinchActive) return;
  const committed = clampZoom(pinchStartZoom * gestureScale);
  const scaleChanged = Math.abs(committed - zoom) > 0.001;
  zoom = committed;
  gestureScale = 1;
  pinchActive = false;
  userAdjusted = true;
  suppressClick = true;
  viewport?.classList.toggle("board-panning", panning);
  if (scaleChanged) zoomChangeHandler?.();
  else applyTransform();
}

function beginTrackedPan(event, { capture = true } = {}) {
  panPointerId = event.pointerId;
  panStartX = event.clientX;
  panStartY = event.clientY;
  panOriginX = panX;
  panOriginY = panY;
  panMoved = false;
  if (capture) {
    lastEmptyTapAt = 0;
    userAdjusted = true;
    setPanning(true);
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }
}

function endPan(event) {
  pendingTouchPan = false;
  if (!panning) {
    panPointerId = null;
    panMoved = false;
    return;
  }
  if (panMoved) suppressClick = true;
  setPanning(false);
  panPointerId = null;
  panMoved = false;
  if (viewport && event?.pointerId != null) {
    try {
      viewport.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }
}

function isCameraControlTarget(target) {
  return target instanceof Element && !!target.closest(".board-camera-controls");
}

/** Buttons and fields keep their tap. A finger on them must not start a board pan. */
function isInteractiveControl(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest(".hex-tile, .hex-occupant-token")) return false;
  return !!target.closest("button, a, input, textarea, select, label, .board-camera-controls, .spread-tray, .btn");
}

function isBoardChrome(target) {
  if (!(target instanceof Element)) return false;
  if (isCameraControlTarget(target)) return false;
  if (target.closest(".hex-tile, .hex-occupant-token, button, a, input, textarea, select")) {
    return false;
  }
  return viewport?.contains(target);
}

function onPointerDown(event) {
  if (!viewport?.contains(event.target)) return;
  if (isCameraControlTarget(event.target)) return;

  if (!trackPointer(event.pointerId, event.clientX, event.clientY)) return;

  if (pointerCount >= 2) {
    startPinch();
    event.preventDefault();
    return;
  }

  if (canImmediatePan(event)) {
    beginTrackedPan(event, { capture: true });
    event.preventDefault();
    return;
  }

  if (event.button === 0 && isTouchLike(event) && !isInteractiveControl(event.target)) {
    pendingTouchPan = true;
    beginTrackedPan(event, { capture: false });
  }
}

function onPointerMove(event) {
  const slot = slotFor(event.pointerId);
  if (slot) {
    slot.x = event.clientX;
    slot.y = event.clientY;
  }

  if (pinchActive) {
    updatePinch();
    event.preventDefault();
    return;
  }

  if (pendingTouchPan && event.pointerId === panPointerId) {
    const dx = event.clientX - panStartX;
    const dy = event.clientY - panStartY;
    if (Math.hypot(dx, dy) > TOUCH_PAN_THRESHOLD) {
      pendingTouchPan = false;
      suppressClick = true;
      lastEmptyTapAt = 0;
      userAdjusted = true;
      panMoved = true;
      setPanning(true);
      try {
        viewport.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      panX = panOriginX + dx;
      panY = panOriginY + dy;
      applyTransform();
      event.preventDefault();
    }
    return;
  }

  if (!panning || event.pointerId !== panPointerId) return;
  const dx = event.clientX - panStartX;
  const dy = event.clientY - panStartY;
  if (Math.abs(dx) > PAN_CLICK_THRESHOLD || Math.abs(dy) > PAN_CLICK_THRESHOLD) {
    panMoved = true;
  }
  panX = panOriginX + dx;
  panY = panOriginY + dy;
  applyTransform();
  event.preventDefault();
}

function maybeFitOnEmptyDoubleTap(event) {
  if (pinchActive || panning || panMoved || suppressClick) return;
  if (!isBoardChrome(event.target)) {
    lastEmptyTapAt = 0;
    return;
  }
  const now = Date.now();
  if (now - lastEmptyTapAt < EMPTY_DOUBLE_TAP_MS) {
    lastEmptyTapAt = 0;
    fitBoardToViewport();
    return;
  }
  lastEmptyTapAt = now;
}

function continuePanFromRemainingPointer() {
  const point = remainingPointer();
  if (!point || !viewport) return;
  pendingTouchPan = false;
  panPointerId = point.id;
  panStartX = point.x;
  panStartY = point.y;
  panOriginX = panX;
  panOriginY = panY;
  panMoved = false;
  setPanning(true);
  try {
    viewport.setPointerCapture(point.id);
  } catch {
    // ignore
  }
}

function onPointerUp(event) {
  untrackPointer(event.pointerId);

  if (pinchActive) {
    endPinch();
    if (pointerCount === 1) continuePanFromRemainingPointer();
    return;
  }

  if (pendingTouchPan && event.pointerId === panPointerId) {
    pendingTouchPan = false;
    maybeFitOnEmptyDoubleTap(event);
    panPointerId = null;
    return;
  }

  if (panning && event.pointerId === panPointerId) {
    endPan(event);
  }
}

function onPointerCancel(event) {
  untrackPointer(event.pointerId);
  if (pinchActive && pointerCount < 2) endPinch();
  if (pendingTouchPan && event.pointerId === panPointerId) {
    pendingTouchPan = false;
    panPointerId = null;
    return;
  }
  if (panning && event.pointerId === panPointerId) endPan(event);
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function canUseBoardKeyboard() {
  const active = document.activeElement;
  if (isTypingTarget(active instanceof HTMLElement ? active : null)) return false;
  if (!document.getElementById("screen-game")?.classList.contains("active")) return false;
  if (!document.getElementById("card-modal")?.classList.contains("hidden")) return false;
  const utilityModal = document.getElementById("utility-modal");
  if (
    utilityModal
    && !utilityModal.classList.contains("hidden")
    && !utilityModal.classList.contains("utility-modal-minimized")
  ) {
    return false;
  }
  if (!document.getElementById("pause-menu")?.classList.contains("hidden")) return false;
  return true;
}

function getArrowPanStep() {
  if (!viewport) return 56;
  return Math.max(32, Math.round(Math.min(viewport.clientWidth, viewport.clientHeight) * ARROW_PAN_FRACTION));
}

function panBoardBy(dx, dy) {
  if (!stage) return false;
  panX += dx;
  panY += dy;
  userAdjusted = true;
  applyTransform();
  return true;
}

function zoomAroundPoint(nextZoom, mx, my) {
  const clamped = clampZoom(nextZoom);
  if (clamped === zoom) return false;
  const bx = mx - panX;
  const by = my - panY;
  const ratio = clamped / zoom;
  zoom = clamped;
  userAdjusted = true;
  pendingPan = { panX: mx - bx * ratio, panY: my - by * ratio };
  scheduleZoomRender();
  return true;
}

export function nudgeBoardZoom(direction) {
  if (!viewport) return;
  const factor = direction > 0 ? BUTTON_ZOOM_FACTOR : 1 / BUTTON_ZOOM_FACTOR;
  zoomAroundPoint(zoom * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
}

function onKeyDown(event) {
  if (!canUseBoardKeyboard()) return;

  if ((event.key === "f" || event.key === "F") && !event.repeat) {
    event.preventDefault();
    fitBoardToViewport();
    return;
  }

  const arrowPan = {
    ArrowUp: [0, getArrowPanStep()],
    ArrowDown: [0, -getArrowPanStep()],
    ArrowLeft: [getArrowPanStep(), 0],
    ArrowRight: [-getArrowPanStep(), 0],
  }[event.key];
  if (arrowPan) {
    event.preventDefault();
    panBoardBy(...arrowPan);
    return;
  }

  if (event.code !== "Space" || event.repeat) return;
  spaceHeld = true;
  viewport?.classList.add("board-pan-ready");
  event.preventDefault();
}

function onKeyUp(event) {
  if (event.code !== "Space") return;
  spaceHeld = false;
  viewport?.classList.remove("board-pan-ready");
  if (panning && panPointerId != null) endPan(event);
}

function onWheel(event) {
  if (!viewport?.contains(event.target)) return;
  event.preventDefault();

  const rect = getViewportRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const factor = 1 - event.deltaY * ZOOM_SENSITIVITY;
  zoomAroundPoint(zoom * factor, mx, my);
}

function boardHintText() {
  if (prefersTouchUi()) return "Pinch to zoom · drag to pan · tap Fit";
  if (document.documentElement?.dataset?.pointer === "hybrid") {
    return "Pinch or scroll to zoom · drag or Space+drag to pan · F fits";
  }
  return "F fit table · scroll zoom · arrow keys or Space + drag to pan";
}

function mountCameraControls() {
  if (!viewport || cameraControls) return;
  cameraControls = document.createElement("div");
  cameraControls.className = "board-camera-controls";
  cameraControls.setAttribute("role", "group");
  cameraControls.setAttribute("aria-label", "Board camera");
  cameraControls.innerHTML = `
    <button type="button" data-camera="in" aria-label="Zoom in" title="Zoom in">+</button>
    <button type="button" data-camera="out" aria-label="Zoom out" title="Zoom out">−</button>
    <button type="button" data-camera="fit" aria-label="Fit table" title="Fit table">Fit</button>
  `;
  cameraControls.addEventListener("pointerdown", (event) => event.stopPropagation());
  cameraControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-camera]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.camera;
    if (action === "in") nudgeBoardZoom(1);
    else if (action === "out") nudgeBoardZoom(-1);
    else if (action === "fit") fitBoardToViewport();
  });
  viewport.appendChild(cameraControls);
}

function showBoardPanHint() {
  if (!viewport || localStorage.getItem("somnia.boardPanHintSeen")) return;
  const hint = document.createElement("div");
  hint.className = "board-pan-hint";
  hint.setAttribute("role", "status");
  hint.textContent = boardHintText();
  viewport.appendChild(hint);
  localStorage.setItem("somnia.boardPanHintSeen", "1");
  window.setTimeout(() => hint.classList.add("fade-out"), 4200);
  window.setTimeout(() => hint.remove(), 5000);
}

export function initBoardZoom() {
  viewport = document.getElementById("board-viewport");
  stage = document.getElementById("board-zoom-stage");
  if (!viewport || !stage || bound) return;
  bound = true;

  viewport.title = boardHintText();
  mountCameraControls();

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerCancel);
  viewport.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  viewport.addEventListener("mousedown", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    spaceHeld = false;
    viewport?.classList.remove("board-pan-ready");
    clearPointers();
    if (pinchActive) endPinch();
    if (panning) endPan();
    pendingTouchPan = false;
  });

  bindViewportRefit();
  resetBoardZoom();
  showBoardPanHint();
}

/**
 * Camera phase of the viewport settle lane (see viewport-sync.js).
 *
 * Rotating an iPad, collapsing Safari's toolbar, or the host resizing the itch.io
 * iframe changes the board's fit. This runs *after* device-mode and panel-layout
 * have written their CSS variables and *before* the single render phase, so it
 * only adjusts camera state — the render that follows picks it up. Nothing here
 * calls zoomChangeHandler, which is what used to cause a second full board build.
 */
let refitBound = false;
function bindViewportRefit() {
  if (refitBound) return;
  refitBound = true;
  onViewportSettled("camera", (ctx) => {
    // The iOS keyboard only shrinks the visual viewport — the table is unchanged.
    if (ctx.keyboardToggled && !ctx.orientationFlipped) return;
    if (document.activeElement?.matches?.("input, textarea, select")) return;
    const grew = Math.abs(ctx.widthDelta) > 80 || Math.abs(ctx.heightDelta) > 80;
    if (!ctx.orientationFlipped && !grew) return;
    if (pinchActive || panning) return;
    if (userAdjusted && !ctx.orientationFlipped) {
      // Keep the player's zoom; the render phase re-fits the hex size to the new box.
      return;
    }
    zoom = 1;
    panX = 0;
    panY = 0;
    gestureScale = 1;
    userAdjusted = false;
  });
}
