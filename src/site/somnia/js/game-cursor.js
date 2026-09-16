import { getPhase } from "./state.js";
import { getLegalExploreTargets } from "./game.js";
import { psycheCursorBreakdown, suitIconHtml } from "./rules.js";

const SVG = {
  reveal: encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><ellipse cx="14" cy="14" rx="11" ry="7" fill="#5eb0ff" stroke="#1a4080" stroke-width="1.4"/><path d="M5 14 Q14 9 23 14" fill="none" stroke="#1a4080" stroke-width="2.2"/></svg>'),
  revealOpen: encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><ellipse cx="14" cy="14" rx="11" ry="7" fill="#5eb0ff" stroke="#1a4080" stroke-width="1.4"/><circle cx="14" cy="14" r="3.2" fill="#1a4080"/></svg>'),
  exploreDreamer: encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M8 14 H20 M16 10 L20 14 L16 18" fill="none" stroke="#f0c96a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  exploreMove: encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M6 14 H22 M10 10 L6 14 L10 18 M18 10 L22 14 L18 18" fill="none" stroke="#f0c96a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
  meetFist: encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect x="9" y="10" width="10" height="11" rx="3" fill="#e84848" stroke="#8a1818" stroke-width="1.2"/><rect x="7" y="8" width="4" height="7" rx="2" fill="#e84848"/><rect x="11" y="6" width="4" height="8" rx="2" fill="#e84848"/><rect x="15" y="7" width="4" height="7" rx="2" fill="#e84848"/><rect x="19" y="9" width="3.5" height="6" rx="1.8" fill="#e84848"/></svg>'),
  meetPoint: encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M6 22 L10 8 Q11 6 12 8 L14 14 L16 6 Q17 4 18 6 L22 20" fill="#f2b8b8" stroke="#c03030" stroke-width="1.2"/><path d="M12 8 L18 4 L20 7" fill="none" stroke="#c03030" stroke-width="1.6" stroke-linecap="round"/></svg>'),
};

function cursorUrl(key) {
  const svg = SVG[key];
  return svg ? `url("data:image/svg+xml,${svg}") 12 12, pointer` : "";
}

const CURSORS = {
  reveal: cursorUrl("reveal"),
  "reveal-open": cursorUrl("revealOpen"),
  "explore-dreamer": cursorUrl("exploreDreamer"),
  "explore-move": cursorUrl("exploreMove"),
  "meet-fist": cursorUrl("meetFist"),
  "meet-point": cursorUrl("meetPoint"),
};

const CURSOR_SELECTORS = {
  reveal: "#board-viewport, .hex-tile.pick-reveal, .hex-tile.pick-choose",
  "explore-dreamer": "#board-viewport .hex-occupant-dreamer, #player-list .player-chip",
  "explore-move": "#board-viewport .hex-tile.movable, #board-viewport",
  "meet-fist": "#board-viewport .hex-occupant-dreamer, #player-list .player-chip",
  "meet-point": "#board-viewport, #hand-bar, #phase-actions, #sidebar-right",
};

let revealOpenTimer = null;

export function flashRevealOpenCursor() {
  document.body.dataset.gameCursor = "reveal-open";
  clearTimeout(revealOpenTimer);
  revealOpenTimer = window.setTimeout(() => {
    if (document.body.dataset.gameCursor === "reveal-open") {
      syncGameCursor(window.__somniaCursorState || null);
    }
  }, 420);
}

export function syncGameCursor(state) {
  window.__somniaCursorState = state;
  const screen = document.getElementById("screen-game");
  if (!screen?.classList.contains("active") || !state) {
    document.body.dataset.gameCursor = "";
    applyCursorRules("");
    syncPsychePlayCursor(null);
    return;
  }

  const phase = getPhase(state);
  let mode = "";

  if (phase === "Reveal" && state.landscapePick) {
    mode = "reveal";
  } else if (phase === "Explore") {
    const canMove = state.exploreActivated
      && (state.exploreMovesLeft || 0) > 0
      && getLegalExploreTargets(state).length > 0;
    mode = canMove ? "explore-move" : "explore-dreamer";
  } else if (phase === "Meet") {
    const player = state.players[state.activePlayerIndex];
    const onSelectedLandscape = Boolean(
      state.selectedLandscapeId
      && player?.alive
      && player.landscapeId === state.selectedLandscapeId,
    );
    mode = onSelectedLandscape ? "meet-point" : "meet-fist";
  }

  if (document.body.dataset.gameCursor !== "reveal-open") {
    document.body.dataset.gameCursor = mode;
  }
  applyCursorRules(mode);
  syncPsychePlayCursor(state);
}

function applyCursorRules(mode) {
  const styleId = "somnia-game-cursor-rules";
  let style = document.getElementById(styleId);
  if (!mode) {
    style?.remove();
    return;
  }
  const cursor = CURSORS[mode];
  const selectors = CURSOR_SELECTORS[mode] || "#screen-game.active";
  if (!cursor) return;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  const rules = selectors.split(",").map((sel) => `${sel.trim()} { cursor: ${cursor} !important; }`).join("\n");
  style.textContent = rules;
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
  psycheHudEl.style.left = `${psycheHudX + 18}px`;
  psycheHudEl.style.top = `${psycheHudY + 6}px`;
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
    ? `<span class="psyche-play-need">A ${breakdown.acceptTotal}/${breakdown.acceptNeed}${breakdown.rejectNeed != null ? ` · R ${breakdown.rejectTotal}/${breakdown.rejectNeed}` : ""}</span>`
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
