/** Brief HUD toasts stacked at the top of the table viewport — up to 6 at once. */

const DEFAULT_DURATION_MS = 14000;
const MAX_VISIBLE = 6;
const HISTORY_MAX = 80;
const REDUCED_MOTION_MS = 11000;

let activeToasts = [];
let momentHistory = [];
let toastIdCounter = 0;

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function ensureStack() {
  const legacy = document.getElementById("moment-overlay");
  if (legacy?.parentNode) legacy.remove();

  let stack = document.getElementById("moment-overlay-stack");
  if (stack) return stack;

  const surface = document.getElementById("table-surface");
  stack = document.createElement("div");
  stack.id = "moment-overlay-stack";
  stack.className = "moment-overlay-stack";
  stack.setAttribute("role", "status");
  stack.setAttribute("aria-live", "polite");
  (surface || document.body).appendChild(stack);
  return stack;
}

export function initMomentOverlay() {
  ensureStack();
}

/** Clear visible toasts and history (new game). */
export function resetMomentOverlay() {
  activeToasts.forEach((toast) => {
    window.clearTimeout(toast.timerId);
    window.clearTimeout(toast.fadeTimerId);
    toast.el?.remove?.();
  });
  activeToasts = [];
  momentHistory = [];
  updateHistoryBadge();
}

export function getMomentHistory() {
  return momentHistory.slice();
}

function recordHistory(message) {
  momentHistory.unshift({ message, at: Date.now() });
  if (momentHistory.length > HISTORY_MAX) momentHistory.length = HISTORY_MAX;
  updateHistoryBadge();
}

function updateHistoryBadge() {
  const btn = document.getElementById("btn-moment-history");
  if (!btn) return;
  const count = momentHistory.length;
  btn.classList.toggle("moment-history-has-items", count > 0);
  btn.title = count
    ? `Moment narration history (${count} entries)`
    : "Moment narration history";
}

/**
 * Turn narrator / log data into a single player-facing sentence.
 * @param {{ title?: string, detail?: string, consequences?: string[], moment?: boolean|string|{ message?: string, because?: string, source?: string } }} narration
 */
export function formatMomentSentence(narration) {
  const { title, detail, consequences, moment } = narration || {};
  if (typeof moment === "string" && moment.trim()) return moment.trim();
  if (moment && typeof moment === "object" && moment.message) return moment.message.trim();

  const because = moment && typeof moment === "object"
    ? (moment.because || moment.source)
    : null;
  if (because && title) return `${title} — ${because}.`.replace(/\.\.$/, ".");

  const primary = title || detail || "";
  const secondary = detail && detail !== title ? detail : "";
  const extra = Array.isArray(consequences) && consequences.length === 1
    ? consequences[0]
    : "";

  if (secondary && !isInstructionalDetail(secondary)) {
    const joined = `${primary} — ${secondary}`;
    return extra && !joined.includes(extra) ? `${joined} (${extra}).` : `${joined}.`;
  }
  if (extra && primary && !primary.includes(extra)) return `${primary} — ${extra}.`;
  return primary.endsWith(".") ? primary : `${primary}.`;
}

function isInstructionalDetail(detail) {
  if (!detail || detail.length > 96) return true;
  return /Head Dreamer|One Dreamer spends|click to focus|Cooperate/i.test(detail);
}

function removeToast(toast, immediate = false) {
  if (!toast) return;
  window.clearTimeout(toast.timerId);
  window.clearTimeout(toast.fadeTimerId);
  activeToasts = activeToasts.filter((t) => t.id !== toast.id);
  const el = toast.el;
  if (!el) return;
  el.classList.remove("is-playing");
  if (immediate) {
    el.remove?.();
    return;
  }
  el.classList.add("is-fading");
  toast.fadeTimerId = window.setTimeout(() => {
    el.remove?.();
  }, 300);
}

/** Show a one-line moment toast. Multiple moments stack (max 6 visible). */
export function showMomentOverlay(message, options = {}) {
  const text = String(message || "").trim();
  if (!text || typeof document === "undefined") return;

  recordHistory(text);

  const stack = ensureStack();
  const duration = reducedMotion() ? REDUCED_MOTION_MS : (options.durationMs || DEFAULT_DURATION_MS);
  const id = ++toastIdCounter;

  const el = document.createElement("div");
  el.className = `moment-toast${options.boss ? " moment-toast-boss" : ""}${options.victory ? " moment-toast-victory" : ""}`;
  el.textContent = text;
  if (typeof el.style?.setProperty === "function") {
    el.style.setProperty("--moment-duration", `${duration}ms`);
  }

  stack.insertBefore(el, stack.firstChild);

  const toast = { id, message: text, el, timerId: null, fadeTimerId: null };
  activeToasts.unshift(toast);

  while (activeToasts.length > MAX_VISIBLE) {
    removeToast(activeToasts[activeToasts.length - 1], true);
  }

  requestAnimationFrame(() => {
    void el.offsetWidth;
    el.classList.add("is-playing");
  });

  toast.timerId = window.setTimeout(() => removeToast(toast, false), duration);
}

/** Build and show a moment from narrator-style data. */
export function showMomentFromNarration(narration, momentOptions = true) {
  const message = formatMomentSentence({ ...narration, moment: momentOptions });
  if (message) showMomentOverlay(message);
}

export function flashMoment(message, options) {
  showMomentOverlay(message, options);
}

/** Flash round modifiers when a new phase begins (deferred Dream effects). */
export function flashPhaseEntryMoments(state, phase) {
  if (!state || !phase) return;
  const lines = [];
  if (phase === "Explore") {
    if (state.wanderlustTarget > 0) {
      lines.push(`Wanderlust — explore ${state.wanderlustTarget} Landscapes this round for a reward.`);
    }
    if (state.freeExploreNextRound) {
      lines.push("Travel Dream — free movement anywhere this Explore Phase.");
    }
  }
  if (phase === "Meet") {
    if (state.paradoxMeet) {
      lines.push("Paradox — Willpower and Elasticity costs swap this Meet Phase.");
    }
    if (state.skipLandscapeActionsNextMeet) {
      lines.push("Landscape Meet actions skipped this round.");
    }
    if (state.meetOnlyRound) {
      lines.push("Abduction — only Meet actions for carried Encounters this round.");
    }
  }
  lines.forEach((line) => showMomentOverlay(line));
}
