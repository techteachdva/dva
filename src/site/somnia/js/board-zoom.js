const MIN_SCALE = 0.45;
const MAX_SCALE = 3.5;
const ZOOM_SENSITIVITY = 0.0012;

let viewport = null;
let stage = null;
let scale = 1;
let panX = 0;
let panY = 0;
let userAdjusted = false;
let bound = false;

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
  resetBoardZoom();
}
