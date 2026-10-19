/**
 * A used set becomes its Archetype (0.30): the pieces fan out in a ring, spin
 * inward on a tightening spiral, and fold into a shadowy figure that takes the
 * Archetype's shape. The shadow lights from within and the name rises.
 *
 *   0.0s  dark falls, pieces fly out to a ring
 *   0.7s  the ring spins and tightens into the center (1.3s)
 *   2.0s  the shadow figure swells out of the vortex
 *   2.6s  it lights into the Archetype, name rises
 *   4.1s  everything fades
 */

import { burstSparkles, playPointRipple, playHaptic } from "./fx.js";
import { playSfx } from "../audio/audio.js";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function cssUrl(url) {
  return url ? `url("${String(url).replace(/["\\]/g, "")}")` : "none";
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export function playSetSpiral({ pieces = [], archetype = {}, label = "" } = {}) {
  if (typeof document === "undefined" || reducedMotion()) return;
  const root = document.createElement("div");
  root.className = "set-spiral";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.innerHTML = `
    <div class="set-spiral-veil"></div>
    <div class="set-spiral-stage">
      <div class="set-spiral-vortex" aria-hidden="true"></div>
      <div class="set-spiral-figure suit-${esc(archetype.suit)}" aria-hidden="true"></div>
      <p class="set-spiral-name"><small>${esc(label)} set</small>${esc(archetype.name || "Archetype")}</p>
    </div>`;
  document.body.appendChild(root);
  // An absolute URL: a var() url resolves against the stylesheet, not the page.
  if (archetype.image) root.querySelector(".set-spiral-figure").style.setProperty("--arch-art", cssUrl(new URL(archetype.image, document.baseURI).href));
  const stage = root.querySelector(".set-spiral-stage");
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const radius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
  const n = Math.max(1, pieces.length);

  pieces.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = `set-spiral-card suit-${esc(card.suit)}`;
    el.style.backgroundImage = cssUrl(card.image);
    stage.appendChild(el);
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    // A spiral: the angle turns 1.75 times while the radius shrinks to nothing.
    const frames = [{ transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)", opacity: 0, offset: 0 }];
    const ring = { x: Math.cos(a0) * radius, y: Math.sin(a0) * radius };
    frames.push({ transform: `translate(calc(-50% + ${ring.x}px), calc(-50% + ${ring.y}px)) scale(1) rotate(${(a0 * 180) / Math.PI + 90}deg)`, opacity: 1, offset: 0.24 });
    const steps = 10;
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const a = a0 + t * Math.PI * 3.5;
      const r = radius * (1 - t) ** 1.4;
      frames.push({
        transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(${1 - t * 0.82}) rotate(${(a * 180) / Math.PI + 90 + t * 360}deg)`,
        opacity: t > 0.92 ? 0 : 1,
        filter: `brightness(${1 - t * 0.85}) blur(${t * 2}px)`,
        offset: 0.24 + t * 0.76,
      });
    }
    el.animate(frames, { duration: 2000, delay: i * 40, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "forwards" });
  });

  playSfx("sparkle");
  window.setTimeout(() => {
    root.classList.add("is-vortex");
    playSfx("repress");
  }, 700);
  window.setTimeout(() => {
    root.classList.add("is-shadow");
    burstSparkles(cx, cy, 18, "#6b4a9a");
    playPointRipple(cx, cy, "fx-arch-ripple", 1200);
    playHaptic("repress");
  }, 2000);
  window.setTimeout(() => {
    root.classList.add("is-lit");
    burstSparkles(cx, cy, 34, "#f5d77a");
    burstSparkles(cx, cy, 20, "#c9a0ff");
    [0, 200, 420].forEach((ms) => window.setTimeout(() => playPointRipple(cx, cy, `fx-arch-ripple${ms ? " fx-echo" : ""}`, 1300), ms));
    playSfx("acquire");
    playHaptic("success");
  }, 2600);
  window.setTimeout(() => root.classList.add("is-out"), 4100);
  window.setTimeout(() => root.remove(), 4500);
}
