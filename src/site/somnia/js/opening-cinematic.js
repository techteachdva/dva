/** Opening deal cinematic — the table shuffles, then the Dreamscape is placed
 *  tile by tile from a stack on The Bed, spiraling outward, and Psyche is dealt. */

import { hexRingCoords, POOL_RING3_CORNER_SLOTS, hexKey } from "./hex.js";
import { burstSparkles, playDreamWarble } from "./fx.js";
import { playSfx } from "./audio.js";
import { cardBackForDeckId } from "./card-backs.js";

const ROW_STEP_MS = 70;
const TILE_BASE_MS = 350;
const TILE_STEP_MS = 80;
const TILE_FLIGHT_MS = 300;
const DEAL_GHOST_BASE_MS = 1350;
const DEAL_STEP_MS = 90;
const DEAL_CARD_BASE_MS = 1450;
const TOKEN_BASE_MS = 2250;
const CHIP_BASE_MS = 2000;
const DREAM_PULSE_MS = 2620;
const END_MS = 2950;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
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

/** Copy the visible face of a hex tile so the flying ghost looks like the tile. */
function hexFaceStyle(tileEl, ghost) {
  const face = tileEl?.querySelector(".hex-face");
  if (!face) return;
  const cs = getComputedStyle(face);
  if (cs.backgroundImage && cs.backgroundImage !== "none") ghost.style.backgroundImage = cs.backgroundImage;
  ghost.style.backgroundColor = cs.backgroundColor || "#120f22";
  ghost.style.backgroundSize = cs.backgroundSize;
  ghost.style.backgroundPosition = cs.backgroundPosition;
}

/** A hex tile ghost that flies from the stack on The Bed to its board slot. */
function flyHexGhost(from, target, tileEl, delay) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !target) return;
  const ghost = document.createElement("div");
  ghost.className = "fx-hex-ghost fx-opening-ghost";
  ghost.style.width = `${target.w}px`;
  ghost.style.height = `${target.h}px`;
  ghost.style.left = `${from.x}px`;
  ghost.style.top = `${from.y}px`;
  ghost.style.animationDelay = `${delay}ms`;
  hexFaceStyle(tileEl, ghost);
  layer.appendChild(ghost);
  requestAnimationFrame(() => {
    ghost.style.setProperty("--fx-tx", `${target.x - from.x}px`);
    ghost.style.setProperty("--fx-ty", `${target.y - from.y}px`);
    ghost.classList.add("fx-hex-fly");
  });
  window.setTimeout(() => ghost.remove(), delay + TILE_FLIGHT_MS + 80);
}

/** The shrinking stack of face-down tiles waiting on The Bed. */
function placeTileStack(at, faceSourceEl, departTimes) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !at) return;
  const layers = [];
  for (let i = 0; i < 3; i += 1) {
    const ghost = document.createElement("div");
    ghost.className = "fx-hex-ghost fx-hex-stack fx-opening-ghost";
    ghost.style.width = `${at.w}px`;
    ghost.style.height = `${at.h}px`;
    ghost.style.left = `${at.x}px`;
    ghost.style.top = `${at.y - i * 3}px`;
    hexFaceStyle(faceSourceEl, ghost);
    layer.appendChild(ghost);
    layers.push(ghost);
  }
  // Peel one layer off the stack at the first, middle, and last placement.
  [0, Math.floor(departTimes.length / 2), departTimes.length - 1].forEach((slot, i) => {
    const atMs = departTimes[Math.min(slot, departTimes.length - 1)] ?? 0;
    window.setTimeout(() => {
      const layerEl = layers[2 - i];
      if (!layerEl) return;
      layerEl.classList.add("fx-hex-stack-fade");
      window.setTimeout(() => layerEl.remove(), 320);
    }, atMs);
  });
}

/** Spiral order around The Bed: center, ring 1, ring 2, then the ring-3 corners. */
function spiralSlots() {
  return [
    ...hexRingCoords(0),
    ...hexRingCoords(1),
    ...hexRingCoords(2),
    ...POOL_RING3_CORNER_SLOTS,
  ];
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

  // 2. The Dreamscape is placed from a stack on The Bed, spiraling outward.
  const tileByKey = new Map(state.board.map((t) => [hexKey(t.q, t.r), t]));
  const orderedTiles = spiralSlots()
    .map((slot) => tileByKey.get(hexKey(slot.q, slot.r)))
    .filter(Boolean);
  // Any tile outside the spiral slots tags along at the end.
  state.board.forEach((t) => {
    if (!orderedTiles.includes(t)) orderedTiles.push(t);
  });

  const bed = state.board.find((t) => t.center) || orderedTiles[0];
  const bedEl = bed && document.querySelector(`.hex-tile[data-tile-id="${bed.id}"]`);
  const bedCenter = centerOf(bedEl);
  const departTimes = [];

  orderedTiles.forEach((tile, i) => {
    const el = document.querySelector(`.hex-tile[data-tile-id="${tile.id}"]`);
    if (!el) return;
    if (tile === bed || i === 0) {
      el.style.setProperty("--deal-delay", "0ms");
      return;
    }
    const departAt = TILE_BASE_MS + (departTimes.length) * TILE_STEP_MS;
    departTimes.push(departAt);
    const target = centerOf(el);
    // The real tile pops in just as the ghost lands.
    el.style.setProperty("--deal-delay", `${departAt + TILE_FLIGHT_MS - 60}ms`);
    flyHexGhost(bedCenter, target, el, departAt);
  });

  if (bedCenter && departTimes.length) {
    const anyWasteland = orderedTiles.find((t) => t !== bed && !t.revealed) || orderedTiles[1];
    const stackFaceEl = anyWasteland
      ? document.querySelector(`.hex-tile[data-tile-id="${anyWasteland.id}"]`)
      : null;
    placeTileStack(bedCenter, stackFaceEl, departTimes);
  }

  later(() => {
    playDreamWarble(0.5);
    playSfx("reveal");
  }, TILE_BASE_MS);
  // A rhythmic placing beat as tiles land.
  for (let t = TILE_BASE_MS; t < TILE_BASE_MS + departTimes.length * TILE_STEP_MS; t += TILE_STEP_MS * 6) {
    later(() => playSfx("flip"), t);
  }

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
