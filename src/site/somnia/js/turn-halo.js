/**
 * Faint circular sparkle over the Dreamer who holds the action turn.
 * Same ring, glow, and orbiting stars as the tutorial spotlight.
 */

const SPARKLE_COUNT = 12;

let haloEl = null;
let tracker = null;
let targetEl = null;
let cameraRaf = 0;

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureHalo() {
  if (haloEl) return haloEl;

  const layer = document.createElement("div");
  layer.id = "turn-halo-layer";
  layer.className = "tutorial-sparkle-layer turn-halo-layer";
  layer.setAttribute("aria-hidden", "true");

  haloEl = document.createElement("div");
  haloEl.id = "turn-halo";
  haloEl.className = "tutorial-spotlight turn-halo hidden";
  haloEl.style.setProperty("--sparkle-count", String(SPARKLE_COUNT));
  haloEl.innerHTML = `
    <div class="tutorial-spotlight-glow"></div>
    <div class="tutorial-spotlight-glow tutorial-spotlight-glow-alt"></div>
    <div class="tutorial-spotlight-ring"></div>
    <div class="tutorial-spotlight-sparkles"></div>
  `;

  if (!reducedMotion()) {
    const host = haloEl.querySelector(".tutorial-spotlight-sparkles");
    for (let i = 0; i < SPARKLE_COUNT; i += 1) {
      const sparkle = document.createElement("span");
      sparkle.className = "tutorial-sparkle";
      sparkle.style.setProperty("--sparkle-i", String(i));
      sparkle.innerHTML = `
        <span class="tutorial-sparkle-rays" aria-hidden="true"></span>
        <span class="tutorial-sparkle-star" aria-hidden="true">✦</span>
      `;
      host.appendChild(sparkle);
    }
  }

  layer.appendChild(haloEl);
  document.body.appendChild(layer);
  return haloEl;
}

function stopTracker() {
  tracker?.disconnect();
  tracker = null;
  window.removeEventListener("resize", positionTurnHalo);
  window.removeEventListener("scroll", positionTurnHalo, true);
}

function dreamerAnchor(playerId) {
  if (!playerId) return null;
  const safe = window.CSS?.escape ? CSS.escape(playerId) : playerId;
  const token = document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${safe}"]`);
  if (token) {
    const rect = token.getBoundingClientRect();
    if (rect.width > 8 && rect.height > 8) return token;
  }
  return document.querySelector(`.player-chip[data-player-id="${safe}"]`);
}

export function positionTurnHalo() {
  if (!haloEl) return;
  if (!targetEl?.isConnected) {
    haloEl.classList.add("hidden");
    return;
  }
  if (targetEl.classList.contains("tutorial-highlight")) {
    haloEl.classList.add("hidden");
    return;
  }
  const rect = targetEl.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) {
    haloEl.classList.add("hidden");
    return;
  }
  const size = Math.max(rect.width, rect.height, 52) * 1.42;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  haloEl.classList.remove("hidden");
  haloEl.style.left = `${cx - size / 2}px`;
  haloEl.style.top = `${cy - size / 2}px`;
  haloEl.style.width = `${size}px`;
  haloEl.style.height = `${size}px`;
  haloEl.style.setProperty("--orbit-r", `${size * 0.46}px`);
}

function startTracker() {
  stopTracker();
  if (!targetEl) return;
  positionTurnHalo();
  if (typeof ResizeObserver !== "undefined") {
    tracker = new ResizeObserver(() => positionTurnHalo());
    tracker.observe(targetEl);
  }
  window.addEventListener("resize", positionTurnHalo);
  window.addEventListener("scroll", positionTurnHalo, true);
}

/** Show, move, or hide the ring for the Dreamer who may act. */
export function syncTurnHalo(playerId) {
  if (typeof document === "undefined") return;
  ensureHalo();
  const next = playerId ? dreamerAnchor(playerId) : null;
  if (!next) {
    targetEl = null;
    haloEl.classList.add("hidden");
    stopTracker();
    return;
  }
  const changed = next !== targetEl;
  targetEl = next;
  if (changed) haloEl.classList.add("tutorial-spotlight-arriving");
  startTracker();
  if (changed) {
    window.setTimeout(() => haloEl?.classList.remove("tutorial-spotlight-arriving"), 520);
  }
}

export function trackTurnHaloWithCamera(durationMs = 480) {
  if (cameraRaf) cancelAnimationFrame(cameraRaf);
  const end = performance.now() + durationMs;
  const frame = (now) => {
    positionTurnHalo();
    cameraRaf = now < end ? requestAnimationFrame(frame) : 0;
  };
  cameraRaf = requestAnimationFrame(frame);
}
