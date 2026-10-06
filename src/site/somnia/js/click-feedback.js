import { playClickFeedback } from "./fx.js";
import { playSfx } from "./audio.js";

const PRESSABLE = [
  "button",
  ".btn",
  "a",
  "[role='button']",
  ".hex-tile",
  ".hex-occupant-token",
  ".game-card",
  ".player-chip",
  ".deck-pile",
  ".ms-choice-btn",
  ".phase-stepper .step",
  "summary",
  "label",
].join(", ");

let lastTapAt = 0;
let pressed = null;

function shouldSkipClickFeedback(target) {
  if (!(target instanceof Element)) return true;
  if (target.closest(".power-token-radial-scrim, .radial-menu-scrim")) return true;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
  return false;
}

function pressableOf(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(PRESSABLE);
}

function releasePress() {
  pressed?.classList.remove("is-pressed");
  pressed = null;
}

/** Sparkle, chime, and a press on every click that is actually a control. */
export function initClickFeedback() {
  if (typeof document === "undefined") return;
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (shouldSkipClickFeedback(event.target)) return;
    playClickFeedback(event.clientX, event.clientY);

    const control = pressableOf(event.target);
    if (!control) return;
    if (control.closest("[data-music-toggle]")) return;
    if (control.disabled || control.getAttribute("aria-disabled") === "true") {
      playSfx("deselect");
      return;
    }

    releasePress();
    pressed = control;
    control.classList.add("is-pressed");
    const now = performance.now();
    if (now - lastTapAt > 70) {
      lastTapAt = now;
      playSfx("ui-tap");
    }
  }, { capture: true, passive: true });

  document.addEventListener("pointerup", releasePress, { capture: true });
  document.addEventListener("pointercancel", releasePress, { capture: true });
  window.addEventListener("blur", releasePress);
}
