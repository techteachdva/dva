/**
 * Input quarantine — keeps HTML overlay gestures out of the table underneath.
 *
 * Somnia's overlays (modals, pause menu, drawers, radial menus, tutorial card)
 * float over #board-viewport, which owns pan / pinch / tap-to-select. Three things
 * let a finger on an overlay reach the board:
 *
 *  1. Follow-through taps: an overlay closes on pointerdown/click and the very same
 *     touch sequence finishes (pointerup, synthesized click) on the hex tile that
 *     is now exposed. -> `armBoardTapShield()` + `consumeBoardTapShield()`.
 *  2. Propagation to document-level listeners (radial dismiss hook, cinematic
 *     finisher, ripple feedback) from touches that began on an overlay.
 *     -> `stopPropagation()` at the overlay boundary, bubble phase only, never
 *        `preventDefault()` so native scrolling, focus and click synthesis survive.
 *  3. Browser gestures: Safari page pinch-zoom / double-tap zoom starting on chrome,
 *     rubber-band overscroll on the body. -> `gesturestart` guard + CSS
 *     `touch-action: pan-x pan-y` on body.in-game (see game.css "Input quarantine").
 *
 * INTEGRATION: `initInputQuarantine()` from play.js init(); overlays that are created
 * dynamically call `quarantineOverlay(el)`; anything that hides an overlay calls
 * `armBoardTapShield()`; the board's tap/click handlers call `consumeBoardTapShield()`.
 */

/** Static overlay roots present in play.html / index.html. */
const OVERLAY_SELECTOR = [
  ".modal",
  ".pause-menu",
  "#sidebar-right",
  "#hand-bar",
  "#deck-column",
  "#guide-panel",
  "#header-more-panel",
  ".tutorial-card",
  ".chrome-drawer-backdrop",
  ".dice-battle-stage",
  ".radial-menu-layer",
  ".fullscreen-prompt",
].join(", ");

/** Touch-sequence events that must not escape an overlay. `click` is deliberately absent. */
const QUARANTINED_EVENTS = ["pointerdown", "pointerup", "pointercancel", "touchstart", "touchend", "touchcancel"];

const QUARANTINE_MARK = "quarantined";
const DEFAULT_SHIELD_MS = 420;

let shieldUntil = 0;
let shieldPointerId = null;
let initialised = false;

function stopAtBoundary(event) {
  // The overlay's own listeners (bubble phase, deeper in the tree) have already run.
  event.stopPropagation();
}

/**
 * Seal one overlay root. Idempotent. Listeners are passive so the browser can still
 * start a native scroll on the overlay's first touchmove without waiting on us.
 */
export function quarantineOverlay(el) {
  if (!(el instanceof Element) || el.dataset[QUARANTINE_MARK]) return;
  el.dataset[QUARANTINE_MARK] = "1";
  for (const type of QUARANTINED_EVENTS) {
    el.addEventListener(type, stopAtBoundary, { passive: true });
  }
}

/**
 * Swallow the next board tap that completes within `ms`. Call from any code path
 * that hides an overlay in response to a pointer/touch, so the finger that closed
 * the overlay cannot also select the tile that was underneath it.
 * @param {number} [ms]
 * @param {PointerEvent|null} [event] the dismissing pointer, if known
 */
export function armBoardTapShield(ms = DEFAULT_SHIELD_MS, event = null) {
  shieldUntil = performance.now() + ms;
  shieldPointerId = event && typeof event.pointerId === "number" ? event.pointerId : null;
}

/**
 * True (and disarms) when a board tap should be dropped because an overlay was
 * dismissed a moment ago. Touch/pen only — see the mouse note below.
 * @param {PointerEvent|MouseEvent|null} [event]
 */
export function consumeBoardTapShield(event = null) {
  if (!shieldUntil) return false;
  // Follow-through only exists for touch/pen sequences; a mouse click that closed an
  // overlay has already completed on the overlay. Let mouse users click straight through.
  if (event && event.pointerType === "mouse") return false;
  if (document.documentElement.dataset.touch !== "true") return false;
  const now = performance.now();
  if (now > shieldUntil) {
    shieldUntil = 0;
    shieldPointerId = null;
    return false;
  }
  // A different, later pointer (second finger, new tap) is a real intent — let it through
  // only once the original pointer has been seen or the window is nearly spent.
  if (
    shieldPointerId != null
    && event
    && typeof event.pointerId === "number"
    && event.pointerId !== shieldPointerId
    && shieldUntil - now < DEFAULT_SHIELD_MS * 0.5
  ) {
    return false;
  }
  shieldUntil = 0;
  shieldPointerId = null;
  return true;
}

export function isBoardTapShielded() {
  return shieldUntil > 0 && performance.now() <= shieldUntil;
}

function isEditable(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest("input, textarea, select, [contenteditable='true']");
}

/**
 * Safari-only proprietary gesture events fire for two-finger page zoom regardless
 * of touch-action on older iPadOS. Cancel them while a game is on the table; the
 * board has its own pinch handling on #board-viewport.
 */
function bindPageGestureGuard() {
  const inGame = () => document.body.classList.contains("in-game");
  const cancel = (event) => {
    if (!inGame()) return;
    if (event.cancelable) event.preventDefault();
  };
  document.addEventListener("gesturestart", cancel, { passive: false });
  document.addEventListener("gesturechange", cancel, { passive: false });
  // Double-tap-to-zoom on non-interactive chrome (touch-action: manipulation covers
  // buttons; this covers labels, headers, and panel padding).
  document.addEventListener("dblclick", (event) => {
    if (!inGame() || isEditable(event.target)) return;
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
}

/** Seal any overlay root added later (radial layers, toasts, cinematic prompts). */
function observeDynamicOverlays() {
  if (typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(OVERLAY_SELECTOR)) quarantineOverlay(node);
        node.querySelectorAll?.(OVERLAY_SELECTOR).forEach(quarantineOverlay);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
}

export function initInputQuarantine() {
  if (initialised) return;
  initialised = true;
  document.querySelectorAll(OVERLAY_SELECTOR).forEach(quarantineOverlay);
  observeDynamicOverlays();
  bindPageGestureGuard();
}
