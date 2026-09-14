/** Brief HUD text that flashes on the dreamscape, then fades — one sentence explaining what just happened. */

const DEFAULT_DURATION_MS = 2600;
const QUEUE_GAP_MS = 140;

let momentQueue = [];
let momentPlaying = false;
let playTimer = null;

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureElement() {
  let el = document.getElementById("moment-overlay");
  if (el) return el;
  const surface = document.getElementById("table-surface");
  el = document.createElement("div");
  el.id = "moment-overlay";
  el.className = "moment-overlay hidden";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "assertive");
  (surface || document.body).appendChild(el);
  return el;
}

export function initMomentOverlay() {
  ensureElement();
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

/** Queue a one-line moment overlay. Newest message replaces the queue when not playing. */
export function showMomentOverlay(message, options = {}) {
  const text = String(message || "").trim();
  if (!text || typeof document === "undefined") return;

  const item = { message: text, durationMs: options.durationMs || DEFAULT_DURATION_MS };
  if (momentPlaying) {
    momentQueue = [item];
    return;
  }
  momentQueue.push(item);
  playNextMoment();
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

function playNextMoment() {
  if (playTimer) {
    window.clearTimeout(playTimer);
    playTimer = null;
  }
  const next = momentQueue.shift();
  if (!next) {
    momentPlaying = false;
    return;
  }

  momentPlaying = true;
  const el = ensureElement();
  const duration = reducedMotion() ? 1200 : next.durationMs;

  el.textContent = next.message;
  el.style.setProperty("--moment-duration", `${duration}ms`);
  el.classList.remove("hidden", "is-playing");
  void el.offsetWidth;
  el.classList.add("is-playing");

  playTimer = window.setTimeout(() => {
    el.classList.remove("is-playing");
    el.classList.add("hidden");
    playTimer = window.setTimeout(() => {
      playTimer = null;
      playNextMoment();
    }, QUEUE_GAP_MS);
  }, duration);
}
