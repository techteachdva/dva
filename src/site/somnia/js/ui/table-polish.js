/**
 * Table chrome: holographic foil light, dream-dust motes, and stat-need pulse.
 * Motion stays off when the player asks for reduced motion.
 */

import { loadSettings } from "../audio/audio-settings.js";

const SUITS = ["lucidity", "elasticity", "willpower"];
const SUIT_RGB = {
  lucidity: [110, 176, 255],
  elasticity: [236, 198, 96],
  willpower: [232, 104, 120],
  dream: [186, 156, 255],
};

let dustSuit = "dream";
let dustRgb = SUIT_RGB.dream.slice();
let dustRunning = false;
let dustFrame = 0;
let particles = [];
let canvas = null;
let ctx = null;
let reduced = false;
let litCard = null;
let tiltBound = false;
let tiltAsked = false;
let statFrame = 0;

function prefersReduced() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export function refreshHoloFromSettings() {
  const seeded = document.body.classList.contains("seed-dmzemo");
  document.body.classList.toggle("holo-foil", seeded || !!loadSettings().holoFoil);
}

function dominantSuit(state) {
  const counts = { lucidity: 0, elasticity: 0, willpower: 0 };
  for (const suit of SUITS) {
    counts[suit] += state?.mindstreamDecks?.[suit]?.length || 0;
  }
  for (const tile of state?.board || []) {
    const encs = tile.encounters || (tile.encounter ? [tile.encounter] : []);
    for (const enc of encs) {
      const suit = enc.mindstreamSuit || enc.suit;
      if (counts[suit] != null) counts[suit] += 3;
    }
  }
  let best = "dream";
  let bestN = 0;
  for (const suit of SUITS) {
    if (counts[suit] > bestN) {
      best = suit;
      bestN = counts[suit];
    }
  }
  return bestN > 0 ? best : "dream";
}

const HUD_PILL = {
  lucidity: ".hud-pill-lucidity",
  elasticity: ".hud-pill-elasticity",
  willpower: ".hud-pill-willpower",
};

export function syncStatNeed() {
  const open = document.querySelector("#utility-modal:not(.hidden) .ms-choice-fullscreen[data-suit]")
    || document.querySelector("#utility-modal:not(.hidden) .phase-opener-menu[data-suit]");
  const suit = SUITS.includes(open?.dataset.suit) ? open.dataset.suit : "";
  document.querySelectorAll(".hand-stats-suits .stat, .dreamer-stats .stat").forEach((el) => {
    el.classList.toggle("stat-need", !!suit && el.classList.contains(`suit-${suit}`));
  });
  for (const name of SUITS) {
    document.querySelector(HUD_PILL[name])?.classList.toggle("stat-need", name === suit);
  }
}

function queueStatNeed() {
  if (statFrame) return;
  statFrame = requestAnimationFrame(() => {
    statFrame = 0;
    syncStatNeed();
  });
}

/** Called after each table render so foil, dust color, and stat pulse stay in step. */
export function syncTablePolish(state) {
  const seeded = !!state?.seedFlags?.dmzemo;
  document.body.classList.toggle("seed-dmzemo", seeded);
  document.body.classList.toggle("holo-foil", seeded || !!loadSettings().holoFoil);
  dustSuit = dominantSuit(state);
  syncStatNeed();
}

function ensureCanvas() {
  const host = document.getElementById("board-viewport");
  if (!host) return null;
  if (canvas?.isConnected) return canvas;
  canvas = document.createElement("canvas");
  canvas.id = "dream-dust";
  canvas.className = "dream-dust";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  ctx = canvas.getContext("2d", { alpha: true });
  return canvas;
}

function resizeCanvas() {
  if (!canvas?.parentElement) return;
  const host = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const pw = Math.max(1, Math.floor(host.clientWidth * dpr));
  const ph = Math.max(1, Math.floor(host.clientHeight * dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
}

function spawnParticle(anywhere) {
  return {
    x: Math.random(),
    y: anywhere ? Math.random() : 1.04,
    r: 0.7 + Math.random() * 1.5,
    vy: -(0.00007 + Math.random() * 0.00018),
    vx: (Math.random() - 0.5) * 0.0001,
    a: 0.12 + Math.random() * 0.32,
    phase: Math.random() * Math.PI * 2,
  };
}

let lastDraw = 0;
function tick(now) {
  if (!dustRunning) return;
  dustFrame = requestAnimationFrame(tick);
  if (document.hidden) return;
  if (now - lastDraw < 34) return;
  const dt = Math.min(50, now - lastDraw || 34);
  lastDraw = now;
  if (!ensureCanvas() || !ctx) return;
  resizeCanvas();
  const target = SUIT_RGB[dustSuit] || SUIT_RGB.dream;
  const k = Math.min(1, dt / 700);
  dustRgb = dustRgb.map((channel, i) => channel + (target[i] - channel) * k);
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const [r, g, b] = dustRgb;
  for (const p of particles) {
    p.phase += dt * 0.0011;
    p.x += p.vx * dt + Math.sin(p.phase) * 0.00012 * dt;
    p.y += p.vy * dt;
    if (p.y < -0.05 || p.x < -0.06 || p.x > 1.06) Object.assign(p, spawnParticle(false));
    const alpha = p.a * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(p.phase)));
    ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, p.r * (w > 800 ? 1.6 : 1.2), 0, Math.PI * 2);
    ctx.fill();
  }
}

function startDust() {
  if (dustRunning || reduced) return;
  if (!ensureCanvas()) return;
  if (!particles.length) particles = Array.from({ length: 28 }, () => spawnParticle(true));
  dustRunning = true;
  lastDraw = 0;
  dustFrame = requestAnimationFrame(tick);
}

function stopDust() {
  dustRunning = false;
  if (dustFrame) cancelAnimationFrame(dustFrame);
  dustFrame = 0;
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function onPointerMove(event) {
  if (!document.body.classList.contains("holo-foil")) {
    if (litCard) {
      litCard.classList.remove("is-holo-lit");
      litCard = null;
    }
    return;
  }
  const card = event.target instanceof Element ? event.target.closest(".game-card") : null;
  if (litCard && litCard !== card) litCard.classList.remove("is-holo-lit");
  litCard = card;
  if (!card) return;
  card.classList.add("is-holo-lit");
  const rect = card.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  const py = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
  card.style.setProperty("--holo-px", px.toFixed(3));
  card.style.setProperty("--holo-py", py.toFixed(3));
}

function onTilt(event) {
  const gx = Math.max(-1, Math.min(1, (event.gamma || 0) / 32));
  const gy = Math.max(-1, Math.min(1, ((event.beta || 0) - 42) / 32));
  document.documentElement.style.setProperty("--holo-gx", gx.toFixed(3));
  document.documentElement.style.setProperty("--holo-gy", gy.toFixed(3));
  document.body.classList.add("holo-tilt");
}

async function enableTilt() {
  if (tiltBound || tiltAsked || reduced) return;
  if (!document.body.classList.contains("holo-foil")) return;
  tiltAsked = true;
  const Orientation = window.DeviceOrientationEvent;
  if (typeof Orientation?.requestPermission === "function") {
    try {
      const result = await Orientation.requestPermission();
      if (result !== "granted") return;
    } catch {
      return;
    }
  }
  window.addEventListener("deviceorientation", onTilt, { passive: true });
  tiltBound = true;
}

export function initTablePolish() {
  if (typeof document === "undefined" || document.body.dataset.tablePolish) return;
  document.body.dataset.tablePolish = "1";
  reduced = prefersReduced();
  refreshHoloFromSettings();
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerdown", () => { enableTilt(); }, { passive: true });
  document.addEventListener("somnia-settings", refreshHoloFromSettings);
  const modal = document.getElementById("utility-modal");
  if (modal) {
    const observer = new MutationObserver(queueStatNeed);
    observer.observe(modal, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopDust();
    else startDust();
  });
  if (!reduced) startDust();
}
