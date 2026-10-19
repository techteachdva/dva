/**
 * Placing every Landscape is a feat (0.30). Two beats:
 *
 *   The Dream is Whole   gold light runs out from The Bed across every tile,
 *                        the reward lands, and the table is told it will fold.
 *   The Dream folds      at the next Dream the tiles spiral in, outer ring
 *                        first, and sink into The Bed. A new Dreamscape begins.
 */

import { burstSparkles, burstInkDissolve, playPointRipple, playHaptic, playDreamRipple } from "./fx.js";
import { playSfx } from "../audio/audio.js";
import { markFxBusy } from "./fx-timeline.js";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function tileEls() {
  return [...document.querySelectorAll(".hex-tile[data-tile-id]")];
}

function centerOf(el) {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/** Copies of the drawn tiles and where they sit, taken before the board changes. */
export function snapshotDreamscape() {
  if (typeof document === "undefined") return [];
  return tileEls().map((el) => {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.tileId,
      bed: el.dataset.tileId === "bed",
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      html: el.outerHTML,
    };
  }).filter((t) => t.rect.width > 0);
}

/** Beat 1: the reward. */
export function playDreamscapeWhole({ placed = 24, tokens = 0, returns = 0 } = {}) {
  if (typeof document === "undefined") return;
  const els = tileEls();
  const bed = els.find((el) => el.dataset.tileId === "bed");
  const origin = centerOf(bed) || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const quiet = reducedMotion();
  markFxBusy(quiet ? 1800 : 3600);

  // Gold runs outward from The Bed, nearest tiles first.
  els.forEach((el) => {
    const c = centerOf(el);
    if (!c) return;
    const d = Math.hypot(c.x - origin.x, c.y - origin.y);
    window.setTimeout(() => {
      el.classList.remove("hex-dream-whole");
      void el.offsetWidth;
      el.classList.add("hex-dream-whole");
      if (!quiet) burstSparkles(c.x, c.y, 5, "#f5d77a");
      window.setTimeout(() => el.classList.remove("hex-dream-whole"), 1600);
    }, quiet ? 0 : Math.min(900, d * 1.6));
  });

  const root = document.createElement("div");
  root.className = "dream-whole";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const gifts = [
    tokens ? `<span class="dw-gift">+${tokens}⚡</span>` : "",
    returns ? `<span class="dw-gift">Return ${returns}</span>` : "",
  ].join("");
  root.innerHTML = `
    <div class="dw-glow" aria-hidden="true"></div>
    <div class="dw-card">
      <p class="dw-kicker">All ${esc(placed)} Landscapes</p>
      <h2 class="dw-title">The Dream is Whole</h2>
      ${gifts ? `<div class="dw-gifts">${gifts}</div>` : ""}
      <p class="dw-note">Next Dream, it folds into The Bed and begins again.</p>
    </div>`;
  document.body.appendChild(root);
  playDreamRipple("bright");
  playSfx("acquire");
  playHaptic("success");
  if (!quiet) {
    [0, 260, 520].forEach((ms) => window.setTimeout(() => playPointRipple(origin.x, origin.y, `fx-arch-ripple${ms ? " fx-echo" : ""}`, 1400), ms));
    window.setTimeout(() => burstSparkles(window.innerWidth / 2, window.innerHeight * 0.42, 40, "#f5d77a"), 900);
  }
  window.setTimeout(() => root.classList.add("is-out"), quiet ? 1500 : 3100);
  window.setTimeout(() => root.remove(), quiet ? 1800 : 3600);
}

/** Beat 2: the fold. `tiles` is a snapshot from before the reset. */
export function playDreamscapeCollapse(tiles = []) {
  if (typeof document === "undefined" || !tiles.length) return;
  const layer = document.getElementById("fx-layer") || document.body;
  const bed = tiles.find((t) => t.bed);
  const target = bed
    ? { x: bed.rect.left + bed.rect.width / 2, y: bed.rect.top + bed.rect.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const outer = tiles.filter((t) => !t.bed);
  const far = Math.max(1, ...outer.map((t) => Math.hypot(t.rect.left + t.rect.width / 2 - target.x, t.rect.top + t.rect.height / 2 - target.y)));

  const banner = document.createElement("div");
  banner.className = "dream-fold-banner";
  banner.setAttribute("role", "status");
  banner.innerHTML = `<p>The Dream folds.</p><small>A new one begins on The Bed.</small>`;
  document.body.appendChild(banner);
  document.body.classList.add("dream-folding");

  outer.forEach((t) => {
    const wrap = document.createElement("div");
    wrap.className = "dream-fold-tile";
    wrap.style.left = `${t.rect.left}px`;
    wrap.style.top = `${t.rect.top}px`;
    wrap.style.width = `${t.rect.width}px`;
    wrap.style.height = `${t.rect.height}px`;
    wrap.innerHTML = t.html;
    const inner = wrap.firstElementChild;
    if (inner) {
      inner.style.position = "absolute";
      inner.style.inset = "0";
      inner.style.left = "0";
      inner.style.top = "0";
      inner.style.width = "100%";
      inner.style.height = "100%";
      inner.style.margin = "0";
      inner.style.transform = "none";
    }
    layer.appendChild(wrap);
    const cx = t.rect.left + t.rect.width / 2;
    const cy = t.rect.top + t.rect.height / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const d = Math.hypot(dx, dy);
    // Outer ring folds first; each tile curls around The Bed as it sinks.
    const delay = 200 + (1 - d / far) * 700;
    const side = (dx * 0.35 + dy * -0.35);
    wrap.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, filter: "brightness(1)" },
      { transform: `translate(${dx * 0.45 - dy * 0.25}px, ${dy * 0.45 + dx * 0.25}px) scale(0.72) rotate(${side > 0 ? 160 : -160}deg)`, opacity: 0.9, filter: "brightness(0.7) saturate(0.6)", offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(${side > 0 ? 360 : -360}deg)`, opacity: 0, filter: "brightness(0.2) blur(3px)" },
    ], { duration: 1100, delay, easing: "cubic-bezier(0.55, 0, 0.35, 1)", fill: "forwards" });
    window.setTimeout(() => burstInkDissolve(cx, cy), delay);
    window.setTimeout(() => wrap.remove(), delay + 1150);
  });
  playSfx("forget");
  playHaptic("forget");
  window.setTimeout(() => {
    burstSparkles(target.x, target.y, 26, "#c9a0ff");
    burstSparkles(target.x, target.y, 14, "#f5d77a");
    playPointRipple(target.x, target.y, "fx-arch-ripple", 1300);
    playDreamRipple();
  }, 1900);
  window.setTimeout(() => banner.classList.add("is-out"), 2100);
  window.setTimeout(() => {
    banner.remove();
    document.body.classList.remove("dream-folding");
  }, 2500);
}
