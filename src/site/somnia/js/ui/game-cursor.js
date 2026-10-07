import { getPhase } from "../core/state.js";
import { getLegalExploreTargets } from "../core/game.js";
import { psycheCursorBreakdown, suitIconHtml } from "../core/rules.js";

const EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M4 17 Q16 8 28 17" fill="none" stroke="#14386e" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M5 17 Q16 23 27 17" fill="#8fd0ff" stroke="#14386e" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M9 14 L7.5 10 M16 12.5 L16 8.5 M23 14 L24.5 10" fill="none" stroke="#14386e" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M3 16 Q16 5 29 16 Q16 27 3 16 Z" fill="#f7fbff" stroke="#14386e" stroke-width="1.6"/>
  <circle cx="16" cy="16" r="6.2" fill="#2f7dff"/>
  <circle cx="16" cy="16" r="3" fill="#0c1c38"/>
  <circle cx="13.8" cy="13.6" r="1.3" fill="#fff"/>
</svg>`;

const ARROW = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M7 25 L22 10" fill="none" stroke="#c48a12" stroke-width="5" stroke-linecap="round"/>
  <path d="M7 25 L22 10" fill="none" stroke="#ffe27a" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M12 8 H24 V20" fill="none" stroke="#c48a12" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M12 8 H24 V20" fill="none" stroke="#ffe27a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

const ARROW_BOTH = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M5 16 H27" fill="none" stroke="#c48a12" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M5 16 H27" fill="none" stroke="#ffe27a" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M10 11 L4 16 L10 21" fill="#ffe27a" stroke="#c48a12" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M22 11 L28 16 L22 21" fill="#ffe27a" stroke="#c48a12" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

const FIST = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <ellipse cx="8.2" cy="18.5" rx="3.6" ry="5.2" fill="#ff5c5c" stroke="#7a1212" stroke-width="1.2" transform="rotate(-32 8.2 18.5)"/>
  <rect x="10" y="13.5" width="15" height="12.5" rx="5" fill="#e02626" stroke="#7a1212" stroke-width="1.3"/>
  <ellipse cx="13.2" cy="13.2" rx="2.7" ry="3.6" fill="#ff6a6a" stroke="#7a1212" stroke-width="1.1"/>
  <ellipse cx="17.4" cy="11.6" rx="2.7" ry="3.8" fill="#ff7878" stroke="#7a1212" stroke-width="1.1"/>
  <ellipse cx="21.5" cy="12.8" rx="2.5" ry="3.4" fill="#ff6262" stroke="#7a1212" stroke-width="1.1"/>
  <ellipse cx="24.8" cy="15.4" rx="2.1" ry="2.8" fill="#f04a4a" stroke="#7a1212" stroke-width="1"/>
  <path d="M12 20.5 H22" fill="none" stroke="#ffb0b0" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
</svg>`;

const FINGER = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect x="12.2" y="3.2" width="6.2" height="15" rx="3.1" fill="#ff4d4d" stroke="#7a1212" stroke-width="1.2"/>
  <circle cx="15.3" cy="4.6" r="3.1" fill="#ff7070" stroke="#7a1212" stroke-width="1.1"/>
  <ellipse cx="21.2" cy="18.5" rx="2.5" ry="3.6" fill="#e02626" stroke="#7a1212" stroke-width="1"/>
  <ellipse cx="24.4" cy="20.2" rx="2.2" ry="3.1" fill="#d42020" stroke="#7a1212" stroke-width="1"/>
  <rect x="9.5" y="16.5" width="14.5" height="11" rx="5" fill="#e02626" stroke="#7a1212" stroke-width="1.3"/>
  <ellipse cx="8.4" cy="21" rx="3.2" ry="4.2" fill="#ff5c5c" stroke="#7a1212" stroke-width="1.1" transform="rotate(-36 8.4 21)"/>
</svg>`;

function cursorCss(svg, x, y) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, auto`;
}

const CURSORS = {
  reveal: cursorCss(EYE_CLOSED, 16, 16),
  "reveal-open": cursorCss(EYE_OPEN, 16, 16),
  "explore-dreamer": cursorCss(ARROW, 24, 8),
  "explore-move": cursorCss(ARROW_BOTH, 16, 16),
  "meet-fist": cursorCss(FIST, 17, 18),
  "meet-point": cursorCss(FINGER, 15, 4),
};

let pressed = false;
let lingerMode = "";
let lingerTimer = null;

export function flashRevealOpenCursor() {
  holdCursor("reveal-open", 560);
}

function holdCursor(mode, ms) {
  lingerMode = mode;
  clearTimeout(lingerTimer);
  lingerTimer = window.setTimeout(() => {
    lingerMode = "";
    syncGameCursor(window.__somniaCursorState || null);
  }, ms);
}

function exploreCanStep(state) {
  return Boolean(
    state.exploreActivated
    && (state.exploreMovesLeft || 0) > 0
    && getLegalExploreTargets(state).length > 0,
  );
}

function restingMode(state) {
  const phase = getPhase(state);
  if (phase === "Reveal") return "reveal";
  if (phase === "Explore") return exploreCanStep(state) ? "explore-move" : "explore-dreamer";
  if (phase === "Meet") return "meet-fist";
  return "";
}

function shownMode(rest) {
  if (lingerMode) return lingerMode;
  if (!pressed || !rest) return rest;
  if (rest.startsWith("reveal")) return "reveal-open";
  if (rest.startsWith("explore")) return "explore-move";
  if (rest.startsWith("meet")) return "meet-point";
  return rest;
}

export function syncGameCursor(state) {
  window.__somniaCursorState = state;
  const screen = document.getElementById("screen-game");
  const playing = Boolean(screen?.classList.contains("active") && state);
  bindCursorChrome();
  if (!playing) {
    document.body.dataset.gameCursor = "";
    applyCursorRules("");
    syncPsychePlayCursor(null);
    return;
  }

  const rest = restingMode(state);
  const mode = shownMode(rest);
  document.body.dataset.gameCursor = mode;
  applyCursorRules(mode);
  syncPsychePlayCursor(state);
}

let chromeBound = false;
let lastTrail = 0;

function bindCursorChrome() {
  if (chromeBound || typeof window === "undefined") return;
  chromeBound = true;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const release = () => {
    if (!pressed) return;
    pressed = false;
    const mode = document.body.dataset.gameCursor;
    if (mode === "reveal-open") holdCursor("reveal-open", 420);
    else if (mode === "meet-point") holdCursor("meet-point", 280);
    else if (mode === "explore-move") holdCursor("explore-move", 220);
    else syncGameCursor(window.__somniaCursorState || null);
  };

  window.addEventListener("pointerdown", () => {
    if (!document.getElementById("screen-game")?.classList.contains("active")) return;
    pressed = true;
    lingerMode = "";
    syncGameCursor(window.__somniaCursorState || null);
  });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  if (!fine || reduce) return;
  window.addEventListener("pointermove", (event) => {
    if (!document.getElementById("screen-game")?.classList.contains("active")) return;
    const now = performance.now();
    if (now - lastTrail < 28) return;
    lastTrail = now;
    spawnRainbowDust(event.clientX, event.clientY);
  }, { passive: true });
}

function spawnRainbowDust(x, y) {
  const layer = document.getElementById("fx-layer");
  if (!layer) return;
  const bits = 2 + (Math.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < bits; i += 1) {
    const dot = document.createElement("span");
    dot.className = "fx-cursor-mote";
    const hue = (Math.floor(performance.now() / 18) + i * 48) % 360;
    const dx = (Math.random() - 0.5) * 22;
    const dy = 8 + Math.random() * 16;
    dot.style.left = `${x + (Math.random() - 0.5) * 8}px`;
    dot.style.top = `${y + (Math.random() - 0.5) * 8}px`;
    dot.style.setProperty("--mote-hue", String(hue));
    dot.style.setProperty("--mote-dx", `${dx}px`);
    dot.style.setProperty("--mote-dy", `${dy}px`);
    dot.style.setProperty("--mote-size", `${4 + Math.random() * 4}px`);
    layer.appendChild(dot);
    window.setTimeout(() => dot.remove(), 760);
  }
}

function applyCursorRules(mode) {
  const styleId = "somnia-game-cursor-rules";
  let style = document.getElementById(styleId);
  if (!mode || !CURSORS[mode]) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  const cursor = CURSORS[mode];
  style.textContent = `
    #screen-game.active, #screen-game.active * { cursor: ${cursor} !important; }
    #screen-game.active input, #screen-game.active textarea, #screen-game.active [contenteditable="true"] { cursor: text !important; }
  `;
}

let psycheHudEl = null;
let psycheHudX = 0;
let psycheHudY = 0;
let psycheHudMoveBound = false;

function ensurePsychePlayCursor() {
  if (!psycheHudEl) {
    psycheHudEl = document.createElement("div");
    psycheHudEl.id = "psyche-play-cursor";
    psycheHudEl.className = "hidden";
    psycheHudEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(psycheHudEl);
  }
  if (!psycheHudMoveBound) {
    psycheHudMoveBound = true;
    window.addEventListener("pointermove", (event) => {
      psycheHudX = event.clientX;
      psycheHudY = event.clientY;
      positionPsychePlayCursor();
    }, { passive: true });
  }
}

function positionPsychePlayCursor() {
  if (!psycheHudEl || psycheHudEl.classList.contains("hidden")) return;
  psycheHudEl.style.left = `${psycheHudX + 22}px`;
  psycheHudEl.style.top = `${psycheHudY + 10}px`;
}

function suitChip(suit, value) {
  return `<span class="psyche-play-chip suit-${suit}${value ? "" : " is-zero"}">${suitIconHtml(suit, { size: 12 })}<strong>${value || 0}</strong></span>`;
}

function syncPsychePlayCursor(state) {
  ensurePsychePlayCursor();
  const breakdown = state ? psycheCursorBreakdown(state) : null;
  if (!breakdown) {
    psycheHudEl.classList.add("hidden");
    psycheHudEl.innerHTML = "";
    return;
  }

  const extras = (breakdown.extras || [])
    .filter((extra) => extra.value)
    .map((extra) => {
      const icon = extra.suit ? suitIconHtml(extra.suit, { size: 11 }) : "";
      return `<span class="psyche-play-extra">${icon}+${extra.value}${extra.label ? ` ${extra.label}` : ""}</span>`;
    })
    .join("");

  const meetLine = breakdown.acceptNeed != null
    ? `<span class="psyche-play-need">A ${breakdown.acceptTotal} vs P${breakdown.acceptNeed} (rec ${breakdown.acceptRec})${breakdown.rejectNeed != null ? ` · R ${breakdown.rejectTotal} vs P${breakdown.rejectNeed} (rec ${breakdown.rejectRec})` : ""}</span>`
    : "";

  psycheHudEl.innerHTML = `
    <span class="psyche-play-suits">
      ${suitChip("lucidity", breakdown.bySuit.lucidity)}
      ${suitChip("elasticity", breakdown.bySuit.elasticity)}
      ${suitChip("willpower", breakdown.bySuit.willpower)}
      ${breakdown.wild ? `<span class="psyche-play-chip wild">Wild <strong>${breakdown.wild}</strong></span>` : ""}
    </span>
    ${extras}
    <span class="psyche-play-total">= ${breakdown.total}</span>
    ${meetLine}
  `;
  psycheHudEl.classList.remove("hidden");
  positionPsychePlayCursor();
}
