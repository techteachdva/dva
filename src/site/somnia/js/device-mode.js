/**
 * Detects form factor, pointer, and display capabilities.
 * Writes data-* attributes on <html> so CSS and JS share one profile.
 */

const MODES = ["desktop", "tablet", "mobile"];
const FORM_OVERRIDE_KEY = "somnia.formOverride";
const FORM_OVERRIDE_VALUES = ["phone", "tablet", "desktop"];

export function getFormOverride() {
  try {
    const value = localStorage.getItem(FORM_OVERRIDE_KEY);
    return FORM_OVERRIDE_VALUES.includes(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

export function setFormOverride(form) {
  try {
    if (!form || form === "auto") localStorage.removeItem(FORM_OVERRIDE_KEY);
    else if (FORM_OVERRIDE_VALUES.includes(form)) localStorage.setItem(FORM_OVERRIDE_KEY, form);
  } catch {
    /* private mode */
  }
  applyMode(detectDeviceMode());
}

function hasTouch() {
  return navigator.maxTouchPoints > 0;
}

function isCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function hasHover() {
  return window.matchMedia("(hover: hover)").matches;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function detectOrientation() {
  return window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
}

function detectDisplayMode() {
  if (window.matchMedia("(display-mode: fullscreen)").matches) return "fullscreen";
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  if (typeof navigator.standalone === "boolean" && navigator.standalone) return "standalone";
  return "browser";
}

function detectPointerKind() {
  const touch = hasTouch();
  const coarse = isCoarsePointer();
  const hover = hasHover();
  if (touch && !coarse && hover) return "hybrid";
  if (coarse || (touch && !hover)) return "coarse";
  return "fine";
}

function isIpad() {
  const ua = navigator.userAgent || "";
  if (/iPad/.test(ua)) return true;
  // iPadOS reports a desktop Macintosh, but still has a touch screen.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function detectForm() {
  const override = getFormOverride();
  if (override !== "auto") return override;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const minSide = Math.min(w, h);
  const maxSide = Math.max(w, h);
  const touch = hasTouch();
  const coarse = isCoarsePointer();
  const pointer = detectPointerKind();
  const hybrid = pointer === "hybrid";

  if (minSide <= 520 || (coarse && minSide <= 600 && maxSide <= 960)) {
    return "phone";
  }
  if (isIpad()) return "tablet";
  if (coarse) return "tablet";
  if (touch && minSide <= 1100 && maxSide <= 1400) return "tablet";
  if (touch && !hybrid && maxSide <= 1366) return "tablet";
  const dpr = window.devicePixelRatio || 1;
  if (minSide >= 700 && maxSide <= 1400 && (touch || coarse || (dpr >= 2 && maxSide <= 1366))) {
    return "tablet";
  }
  if (w <= 1100) return "tablet";
  return "desktop";
}

export function detectDeviceMode() {
  const form = detectForm();
  return form === "phone" ? "mobile" : form;
}

export function prefersTouchUi() {
  const pointer = detectPointerKind();
  return hasTouch() && pointer !== "fine";
}

export function getCapabilityProfile() {
  const form = detectForm();
  return {
    form,
    device: form === "phone" ? "mobile" : form,
    orientation: detectOrientation(),
    pointer: detectPointerKind(),
    hover: hasHover(),
    touch: hasTouch(),
    coarse: isCoarsePointer(),
    display: detectDisplayMode(),
    motion: prefersReducedMotion() ? "reduced" : "full",
    dpr: window.devicePixelRatio || 1,
  };
}

function applyMode(mode) {
  const root = document.documentElement;
  const body = document.body;
  const profile = getCapabilityProfile();
  if (!MODES.includes(mode)) mode = profile.device;
  if (!MODES.includes(mode)) mode = "desktop";

  root.dataset.device = mode;
  root.dataset.form = profile.form;
  root.dataset.touch = profile.touch ? "true" : "false";
  root.dataset.coarse = profile.coarse ? "true" : "false";
  root.dataset.hover = profile.hover ? "true" : "false";
  root.dataset.pointer = profile.pointer;
  root.dataset.orientation = profile.orientation;
  root.dataset.display = profile.display;
  root.dataset.motion = profile.motion;
  root.dataset.formOverride = getFormOverride();

  body?.classList.toggle("device-mobile", mode === "mobile");
  body?.classList.toggle("device-tablet", mode === "tablet");
  body?.classList.toggle("device-desktop", mode === "desktop");
  body?.classList.toggle("touch-device", profile.touch);
  body?.classList.toggle("compact-chrome", profile.form === "phone" || profile.form === "tablet");

  window.dispatchEvent(new CustomEvent("somnia:capabilities", { detail: profile }));
}

let resizeTimer = null;
let mediaBound = false;

function scheduleApply() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => applyMode(detectDeviceMode()), 120);
}

/**
 * iPad sometimes drops the click that should follow a finger tap, especially
 * when a button scales away under the fingertip. If no click arrives, fire one.
 */
function bindReliableTaps() {
  if (document.documentElement.dataset.tapRepair) return;
  document.documentElement.dataset.tapRepair = "1";

  let lastClickAt = 0;
  const starts = new Map();

  document.addEventListener("click", () => {
    lastClickAt = Date.now();
  }, true);

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    starts.set(event.pointerId, { x: event.clientX, y: event.clientY, t: Date.now() });
  }, true);

  document.addEventListener("pointerup", (event) => {
    const start = starts.get(event.pointerId);
    starts.delete(event.pointerId);
    if (!start) return;
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 28) return;
    if (Date.now() - start.t > 700) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest("input, textarea, select, a")) return;
    if (target.closest("#board-viewport")) return;
    const control = target.closest("button, [role='button'], .player-chip, .game-card, .deck-draw-back");
    if (!control || control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return;
    const armedAt = Date.now();
    window.setTimeout(() => {
      if (lastClickAt >= armedAt - 40) return;
      control.click();
    }, 80);
  }, true);

  document.addEventListener("pointercancel", (event) => {
    starts.delete(event.pointerId);
  }, true);
}

export function initDeviceMode() {
  applyMode(detectDeviceMode());
  bindReliableTaps();

  window.addEventListener("resize", scheduleApply);
  window.addEventListener("orientationchange", () => {
    setTimeout(() => applyMode(detectDeviceMode()), 200);
  });

  if (!mediaBound && typeof window.matchMedia === "function") {
    mediaBound = true;
    for (const query of [
      "(pointer: coarse)",
      "(hover: hover)",
      "(prefers-reduced-motion: reduce)",
      "(display-mode: standalone)",
      "(display-mode: fullscreen)",
    ]) {
      const mq = window.matchMedia(query);
      mq.addEventListener?.("change", scheduleApply);
    }
  }
}

export function getDeviceMode() {
  return document.documentElement.dataset.device || detectDeviceMode();
}
