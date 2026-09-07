/**
 * Detects desktop / tablet / mobile and applies layout classes for responsive play.
 */

const MODES = ["desktop", "tablet", "mobile"];

function hasTouch() {
  return navigator.maxTouchPoints > 0 || "ontouchstart" in window;
}

function isCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

export function detectDeviceMode() {
  const w = window.innerWidth;
  const touch = hasTouch();
  const coarse = isCoarsePointer();

  if (w <= 640 || (touch && coarse && w <= 768)) return "mobile";
  if (w <= 1100 || (touch && w <= 1280)) return "tablet";
  return "desktop";
}

function applyMode(mode) {
  const root = document.documentElement;
  const body = document.body;
  if (!MODES.includes(mode)) mode = "desktop";

  root.dataset.device = mode;
  root.dataset.touch = hasTouch() ? "true" : "false";
  root.dataset.coarse = isCoarsePointer() ? "true" : "false";
  body?.classList.toggle("device-mobile", mode === "mobile");
  body?.classList.toggle("device-tablet", mode === "tablet");
  body?.classList.toggle("device-desktop", mode === "desktop");
  body?.classList.toggle("touch-device", hasTouch());
}

let resizeTimer = null;

export function initDeviceMode() {
  applyMode(detectDeviceMode());

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applyMode(detectDeviceMode()), 120);
  });

  window.addEventListener("orientationchange", () => {
    setTimeout(() => applyMode(detectDeviceMode()), 200);
  });
}

export function getDeviceMode() {
  return document.documentElement.dataset.device || detectDeviceMode();
}
