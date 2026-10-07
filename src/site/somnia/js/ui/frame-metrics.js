/**
 * Frame metrics — the single authority for "where is the table on screen".
 *
 * Somnia's board is a DOM hex grid inside #board-viewport, panned and scaled by a
 * CSS transform on #board-zoom-stage. Pointer hit-testing therefore needs the same
 * thing a WebGL raycaster needs: the live bounding rect of the render surface and
 * the camera transform, resolved against whatever frame we are embedded in
 * (itch.io iframe, Vercel full-bleed, Home Screen standalone).
 *
 * Everything here is allocation-free on the hot path: rects are cached per animation
 * frame and results are written into caller-supplied `out` objects.
 *
 * INTEGRATION: imported by board-zoom.js (camera), ui.js (tile hit-testing),
 * viewport-sync.js (CSS variables). Nothing here touches game state.
 */

let viewportEl = null;
let rectFrame = -1;
let frameCounter = 0;
let rafPending = false;

/** Cached #board-viewport rect (CSS px, relative to the layout viewport). */
const viewportRect = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };

/** Frame environment — refreshed by viewport-sync on every viewport event. */
const frame = {
  embedded: false,
  dpr: 1,
  /** visualViewport scale (page pinch-zoom). 1 unless the user zoomed the page. */
  vvScale: 1,
  vvOffsetLeft: 0,
  vvOffsetTop: 0,
  vvWidth: 0,
  vvHeight: 0,
  layoutWidth: 0,
  layoutHeight: 0,
  /** Height stolen by the software keyboard (0 when closed). */
  keyboardInset: 0,
};

function bumpFrame() {
  frameCounter += 1;
  rafPending = false;
}

/** Bump the cache generation once per rendered frame (cheap; only one rAF alive). */
function armFrameTick() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(bumpFrame);
}

function resolveViewportEl() {
  if (viewportEl && viewportEl.isConnected) return viewportEl;
  viewportEl = document.getElementById("board-viewport");
  return viewportEl;
}

/** True when Somnia is running inside another page's <iframe> (itch.io wrapper). */
export function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent throws on access — that *is* an embed.
    return true;
  }
}

/** Re-read the environment. Called by viewport-sync; safe to call any time. */
export function refreshFrameInfo() {
  const vv = window.visualViewport;
  frame.embedded = isEmbedded();
  frame.dpr = window.devicePixelRatio || 1;
  frame.layoutWidth = window.innerWidth;
  frame.layoutHeight = window.innerHeight;
  if (vv) {
    frame.vvScale = vv.scale || 1;
    frame.vvOffsetLeft = vv.offsetLeft || 0;
    frame.vvOffsetTop = vv.offsetTop || 0;
    frame.vvWidth = vv.width || window.innerWidth;
    frame.vvHeight = vv.height || window.innerHeight;
  } else {
    frame.vvScale = 1;
    frame.vvOffsetLeft = 0;
    frame.vvOffsetTop = 0;
    frame.vvWidth = window.innerWidth;
    frame.vvHeight = window.innerHeight;
  }
  // iOS reports the keyboard purely as a shorter visual viewport at scale 1.
  const stolen = frame.layoutHeight - frame.vvHeight;
  frame.keyboardInset = frame.vvScale === 1 && stolen > 80 ? Math.round(stolen) : 0;
  return frame;
}

/** Read-only snapshot of the frame environment (no allocation). */
export function getFrameInfo() {
  return frame;
}

/**
 * Live #board-viewport rect, measured at most once per animation frame.
 * This is the DOM equivalent of `canvas.getBoundingClientRect()` — always taken
 * fresh from the element so iframe offsets, drawers, and safe-area padding are
 * already baked in.
 */
export function getViewportRect() {
  if (rectFrame === frameCounter) return viewportRect;
  const el = resolveViewportEl();
  if (!el) return viewportRect;
  const r = el.getBoundingClientRect();
  viewportRect.left = r.left;
  viewportRect.top = r.top;
  viewportRect.width = r.width;
  viewportRect.height = r.height;
  viewportRect.right = r.right;
  viewportRect.bottom = r.bottom;
  rectFrame = frameCounter;
  armFrameTick();
  return viewportRect;
}

/** Force the next getViewportRect() to re-measure (call after layout-affecting writes). */
export function invalidateViewportRect() {
  rectFrame = -1;
}

/**
 * Map a pointer's clientX/clientY into viewport-local CSS pixels.
 * clientX/Y and getBoundingClientRect share the same coordinate space in every
 * frame (iframe or not, page-zoomed or not), so no DPR or visualViewport offset
 * is applied here — DPR only matters for raster surfaces, and this board is DOM.
 * @param {number} clientX
 * @param {number} clientY
 * @param {{x:number,y:number}} out
 */
export function clientToViewport(clientX, clientY, out) {
  const r = getViewportRect();
  out.x = clientX - r.left;
  out.y = clientY - r.top;
  return out;
}

/**
 * Normalised device coordinates (-1..+1) inside the board viewport, matching the
 * convention a Three.js raycaster expects. Kept for parity with the brief and for
 * any future canvas layer (e.g. dice battle) drawn over the same rect.
 * @param {number} clientX
 * @param {number} clientY
 * @param {{x:number,y:number}} out
 */
export function clientToNdc(clientX, clientY, out) {
  const r = getViewportRect();
  out.x = r.width > 0 ? ((clientX - r.left) / r.width) * 2 - 1 : 0;
  out.y = r.height > 0 ? -(((clientY - r.top) / r.height) * 2 - 1) : 0;
  return out;
}

/** Is a client point inside the board viewport? */
export function isPointInViewport(clientX, clientY) {
  const r = getViewportRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}
