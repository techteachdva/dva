const MIN_SCALE = 0.45;
const MAX_SCALE = 3.5;
const ZOOM_SENSITIVITY = 0.0012;
const PAN_CLICK_THRESHOLD = 5;

let viewport = null;
let stage = null;
let scale = 1;
let panX = 0;
let panY = 0;
let userAdjusted = false;
let bound = false;

let spaceHeld = false;
let panning = false;
let panPointerId = null;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;
let panMoved = false;
let suppressClick = false;

function applyTransform() {
  if (!stage) return;
  stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function centerBoard() {
  if (!viewport || !stage) return;
  const board = stage.querySelector("#hex-board");
  if (!board) return;
  const bw = board.offsetWidth;
  const bh = board.offsetHeight;
  panX = (viewport.clientWidth - bw * scale) / 2;
  panY = (viewport.clientHeight - bh * scale) / 2;
  applyTransform();
}

export function resetBoardZoom() {
  scale = 1;
  panX = 0;
  panY = 0;
  userAdjusted = false;
  centerBoard();
}

export function syncBoardZoomAfterRender() {
  if (!userAdjusted) centerBoard();
  else applyTransform();
}

/** Suppress the next hex click after a space/alt pan drag so tiles are not selected accidentally. */
export function consumeBoardClickSuppression() {
  if (!suppressClick) return false;
  suppressClick = false;
  return true;
}

function canStartPan(event) {
  if (event.button === 1) return true;
  if (event.button === 0 && (spaceHeld || event.altKey)) return true;
  return false;
}

function setPanning(active) {
  panning = active;
  if (!viewport) return;
  viewport.classList.toggle("board-panning", active);
  viewport.classList.toggle("board-pan-ready", !active && spaceHeld);
}

function endPan(event) {
  if (!panning) return;
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

function onPointerDown(event) {
  if (!viewport?.contains(event.target)) return;
  if (!canStartPan(event)) return;

  panning = true;
  panPointerId = event.pointerId;
  panStartX = event.clientX;
  panStartY = event.clientY;
  panOriginX = panX;
  panOriginY = panY;
  panMoved = false;
  userAdjusted = true;
  setPanning(true);
  viewport.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event) {
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

function onPointerUp(event) {
  if (!panning || event.pointerId !== panPointerId) return;
  endPan(event);
}

function onPointerCancel(event) {
  if (!panning || event.pointerId !== panPointerId) return;
  endPan(event);
}

function onKeyDown(event) {
  if (event.code !== "Space" || event.repeat) return;
  spaceHeld = true;
  viewport?.classList.add("board-pan-ready");
  if (document.getElementById("screen-game")?.classList.contains("active")) {
    event.preventDefault();
  }
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

  const rect = viewport.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const factor = 1 - event.deltaY * ZOOM_SENSITIVITY;
  const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
  if (nextScale === scale) return;

  const wx = (mx - panX) / scale;
  const wy = (my - panY) / scale;
  panX = mx - wx * nextScale;
  panY = my - wy * nextScale;
  scale = nextScale;
  userAdjusted = true;
  applyTransform();
}

export function initBoardZoom() {
  viewport = document.getElementById("board-viewport");
  stage = document.getElementById("board-zoom-stage");
  if (!viewport || !stage || bound) return;
  bound = true;

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
    if (panning) endPan();
  });

  resetBoardZoom();
}
