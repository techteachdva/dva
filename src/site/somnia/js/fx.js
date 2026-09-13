let revealedTiles = new Set();
let forgottenTiles = new Set();
let phasePulse = false;
let dreamFeedNudge = false;

export function initFxLayer() {
  if (document.getElementById("fx-layer")) return;
  const layer = document.createElement("div");
  layer.id = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
}

export function markTileRevealed(id) {
  if (id) revealedTiles.add(id);
}

export function markTileForgotten(id) {
  if (id) forgottenTiles.add(id);
}

export function consumeRevealedTiles() {
  const tiles = [...revealedTiles];
  revealedTiles.clear();
  return tiles;
}

export function consumeForgottenTiles() {
  const tiles = [...forgottenTiles];
  forgottenTiles.clear();
  return tiles;
}

export function markPhasePulse() {
  phasePulse = true;
}

export function consumePhasePulse() {
  const pulse = phasePulse;
  phasePulse = false;
  return pulse;
}

export function markDreamFeedNudge() {
  dreamFeedNudge = true;
}

export function consumeDreamFeedNudge() {
  const nudge = dreamFeedNudge;
  dreamFeedNudge = false;
  return nudge;
}

export function burstSparkles(x, y, count = 10, color = "#c9a0ff") {
  const layer = document.getElementById("fx-layer");
  if (!layer) return;

  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("span");
    el.className = "fx-sparkle";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 28 + Math.random() * 52;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty("--sx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--sy", `${Math.sin(angle) * dist}px`);
    el.style.background = color;
    el.style.boxShadow = `0 0 8px ${color}, 0 0 14px rgba(123, 92, 255, 0.8)`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

export function burstSparklesAtElement(el, count = 10, color = "#c9a0ff") {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  burstSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, count, color);
}

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureOverlay(id, className) {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement("div");
  el.id = id;
  el.className = className;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

function playOverlay(id, className, ms) {
  if (typeof document === "undefined" || reducedMotion()) return;
  const el = ensureOverlay(id, className);
  el.classList.remove("hidden");
  el.classList.remove("is-playing");
  void el.offsetWidth;
  el.classList.add("is-playing");
  window.setTimeout(() => {
    el.classList.remove("is-playing");
    el.classList.add("hidden");
  }, ms);
}

/** Brief full-screen ripple when a Dream is drawn and resolved. */
export function playDreamRipple() {
  playOverlay("fx-dream-ripple", "fx-screen-overlay fx-dream-ripple", 720);
}

/** Accept: bluish-gold speckled purple. Reject: red-orange cracked with void lightning. */
export function playMeetFlash(mode = "accept") {
  const reject = mode === "reject" || mode === "repress";
  playOverlay(
    reject ? "fx-meet-reject" : "fx-meet-accept",
    `fx-screen-overlay ${reject ? "fx-meet-reject" : "fx-meet-accept"}`,
    reject ? 680 : 620,
  );
}

/** Ripple that expands from a point — used when a Dreambeast lands. */
export function playPointRipple(x, y, className = "fx-point-ripple") {
  const layer = document.getElementById("fx-layer");
  if (!layer || reducedMotion()) return;
  const el = document.createElement("span");
  el.className = className;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);
  window.setTimeout(() => el.remove(), 900);
}

export function playPointRippleAtElement(el, className) {
  if (!el) {
    playPointRipple(window.innerWidth / 2, window.innerHeight * 0.42, className);
    return;
  }
  const rect = el.getBoundingClientRect();
  playPointRipple(rect.left + rect.width / 2, rect.top + rect.height / 2, className);
}
