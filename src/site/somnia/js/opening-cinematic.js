/** Opening deal cinematic — the table shuffles, the Dreamscape blooms, Psyche is dealt. */

import { hexDistance, tileCoords } from "./hex.js";
import { burstSparkles, playDreamWarble } from "./fx.js";
import { playSfx } from "./audio.js";
import { cardBackForDeckId } from "./card-backs.js";

const ROW_STEP_MS = 70;
const TILE_BASE_MS = 480;
const TILE_STEP_MS = 100;
const DEAL_GHOST_BASE_MS = 1120;
const DEAL_STEP_MS = 100;
const DEAL_CARD_BASE_MS = 1220;
const TOKEN_BASE_MS = 1820;
const CHIP_BASE_MS = 1900;
const DREAM_PULSE_MS = 2150;
const END_MS = 2650;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function deckEl(id) {
  return document.querySelector(`[data-deck-id="${id}"]`);
}

function handAreaEl() {
  return document.getElementById("hand-primary")
    || document.getElementById("hand-bar")
    || document.getElementById("hand");
}

function flyGhost(from, to, { className = "", html = "", back = null, delay = 0, w = 44, h = 62 } = {}) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !to) return;
  const ghost = document.createElement("div");
  ghost.className = `fx-flying-card fx-opening-ghost ${className}`.trim();
  if (back) {
    ghost.style.backgroundImage = `url('${back}')`;
    ghost.style.backgroundSize = "cover";
    ghost.style.backgroundColor = "#120f22";
  }
  if (html) ghost.innerHTML = html;
  ghost.style.width = `${w}px`;
  ghost.style.height = `${h}px`;
  ghost.style.left = `${from.x - w / 2}px`;
  ghost.style.top = `${from.y - h / 2}px`;
  ghost.style.animationDelay = `${delay}ms`;
  layer.appendChild(ghost);
  requestAnimationFrame(() => {
    ghost.style.setProperty("--fx-tx", `${to.x - from.x}px`);
    ghost.style.setProperty("--fx-ty", `${to.y - from.y}px`);
    ghost.classList.add("fx-flying-active");
  });
  window.setTimeout(() => ghost.remove(), 780 + delay);
}

/**
 * Choreographed new-game opening over the already-rendered table.
 * Purely visual — state is fully set up before this runs.
 * Any tap or key skips to the end. Returns the full duration in ms.
 */
export function playOpeningCinematic(state) {
  if (!state?.board?.length || reducedMotion()) return 0;
  const body = document.body;
  if (body.classList.contains("opening-cinematic")) return 0;
  body.classList.add("opening-cinematic");

  const timers = [];
  const later = (fn, ms) => timers.push(window.setTimeout(fn, ms));

  // 1. Deck rail slides in — the shuffle.
  document.querySelectorAll(".deck-rail-row").forEach((row, i) => {
    row.style.setProperty("--deal-delay", `${i * ROW_STEP_MS}ms`);
  });
  later(() => playSfx("flip"), 120);
  later(() => playSfx("flip"), 300);

  // 2. The Dreamscape blooms outward from The Bed.
  const bed = state.board.find((t) => t.center) || state.board[0];
  const bedCoords = bed ? tileCoords(bed) : { q: 0, r: 0 };
  document.querySelectorAll(".hex-tile").forEach((el) => {
    const tile = state.board.find((t) => t.id === el.dataset.tileId);
    const dist = tile ? hexDistance(tileCoords(tile), bedCoords) : 2;
    const jitter = Math.floor(Math.random() * 36);
    el.style.setProperty("--deal-delay", `${TILE_BASE_MS + dist * TILE_STEP_MS + jitter}ms`);
  });
  later(() => {
    playDreamWarble(0.5);
    playSfx("reveal");
  }, TILE_BASE_MS);

  // 3. Psyche is dealt — card backs fly from the Psyche deck to the hand.
  const handCards = [...document.querySelectorAll(
    "#hand .game-card, #hand-primary .game-card, .coop-hand-row .game-card",
  )];
  handCards.forEach((el, i) => {
    el.style.setProperty("--deal-delay", `${DEAL_CARD_BASE_MS + i * DEAL_STEP_MS}ms`);
  });
  const psycheFrom = centerOf(deckEl("psyche"));
  const handTo = centerOf(handAreaEl());
  const back = cardBackForDeckId("psyche");
  const dealCount = Math.max(3, Math.min(5, handCards.length || 5));
  for (let i = 0; i < dealCount; i += 1) {
    flyGhost(psycheFrom, handTo, {
      back,
      className: "fx-flying-draw",
      delay: DEAL_GHOST_BASE_MS + i * DEAL_STEP_MS,
    });
  }
  later(() => playSfx("draw"), DEAL_GHOST_BASE_MS + 60);
  later(() => playSfx("draw"), DEAL_GHOST_BASE_MS + 60 + 2 * DEAL_STEP_MS);

  // 4. Power tokens land.
  const tokensTo = centerOf(document.getElementById("power-tokens")) || handTo;
  const mid = (state.players.length - 1) / 2;
  state.players.forEach((player, i) => {
    const to = tokensTo ? { x: tokensTo.x + (i - mid) * 16, y: tokensTo.y } : null;
    flyGhost(psycheFrom, to, {
      className: "fx-flying-power",
      html: `<span class="fx-card-value">⚡</span>`,
      delay: TOKEN_BASE_MS + i * 80,
      w: 36,
      h: 48,
    });
  });
  later(() => playSfx("sparkle"), TOKEN_BASE_MS + 80);

  // 5. Player chips settle in.
  document.querySelectorAll(".player-chip").forEach((el, i) => {
    el.style.setProperty("--deal-delay", `${CHIP_BASE_MS + i * 90}ms`);
  });

  // 6. The Dream deck beckons — the first draw is yours.
  later(() => {
    const dream = deckEl("dream");
    dream?.classList.add("deck-pulse-gain");
    window.setTimeout(() => dream?.classList.remove("deck-pulse-gain"), 600);
    const c = centerOf(dream);
    if (c) burstSparkles(c.x, c.y, 10, "#c9a0ff");
  }, DREAM_PULSE_MS);

  const finish = () => {
    timers.forEach((t) => window.clearTimeout(t));
    body.classList.remove("opening-cinematic");
    document.querySelectorAll(".fx-opening-ghost").forEach((el) => el.remove());
    document.querySelectorAll("[style*='--deal-delay']").forEach((el) => {
      el.style.removeProperty("--deal-delay");
    });
    document.removeEventListener("pointerdown", finish, true);
    document.removeEventListener("keydown", finish, true);
  };
  later(finish, END_MS);
  // An impatient Dreamer skips with any tap or key.
  document.addEventListener("pointerdown", finish, true);
  document.addEventListener("keydown", finish, true);

  return END_MS;
}
