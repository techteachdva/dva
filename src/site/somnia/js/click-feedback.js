import { playClickFeedback } from "./fx.js";

function shouldSkipClickFeedback(target) {
  if (!(target instanceof Element)) return true;
  if (target.closest(".power-token-radial-scrim, .radial-menu-scrim")) return true;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
  return false;
}

/** Global soft click ripples on board and UI. */
export function initClickFeedback() {
  if (typeof document === "undefined") return;
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (shouldSkipClickFeedback(event.target)) return;
    playClickFeedback(event.clientX, event.clientY);
  }, { capture: true, passive: true });
}
