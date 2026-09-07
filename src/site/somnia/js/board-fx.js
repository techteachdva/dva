/** Board & special card flow animations — dreams, mindstream, tiles, encounters, repress. */

import { burstSparkles } from "./fx.js";

const queue = [];

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

function hexTileEl(tileId) {
  return document.querySelector(`.hex-tile[data-tile-id="${tileId}"]`);
}

function handAreaEl(playerId) {
  const handRoot = document.getElementById("hand");
  if (handRoot?.dataset.playerId === playerId) {
    return document.getElementById("hand-primary") || handRoot;
  }
  const primary = document.getElementById("hand-primary");
  if (primary) return primary;
  return document.getElementById("hand-bar");
}

function objectsAreaEl() {
  return document.getElementById("player-objects") || document.getElementById("hand-bar");
}

function powerTokensEl() {
  return document.getElementById("power-tokens") || document.getElementById("hand-bar");
}

function boardCenter() {
  const vp = document.getElementById("board-viewport");
  return centerOf(vp) || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42 };
}

function flashEl(el, className, ms = 750) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}

function pulseDeck(deckId, className) {
  flashEl(deckEl(deckId), className);
}

function ghostCard(card, kind) {
  const el = document.createElement("div");
  const type = card?.type || "psyche";
  const suit = card?.suit || "lucidity";
  el.className = `fx-flying-card fx-flying-${kind} fx-card-${type} suit-${suit}`;

  if (type === "dream" || kind === "dream") {
    el.classList.add("fx-flying-dream");
    el.innerHTML = `<span class="fx-card-label">💤</span><span class="fx-card-name">${card?.name?.split(" ")[0] || "Dream"}</span>`;
  } else if (type === "dreambeast" || card?.isDreambeast) {
    el.innerHTML = `<span class="fx-card-value">⚔</span><span class="fx-card-suit">${card?.name?.split(" ")[0] || "Beast"}</span>`;
  } else if (type === "object") {
    el.innerHTML = `<span class="fx-card-value">◆</span><span class="fx-card-suit">${card?.name?.split(" ")[0] || "Object"}</span>`;
  } else if (type === "power-token" || type === "psyche-power") {
    el.innerHTML = `<span class="fx-card-value">⚡</span><span class="fx-card-suit">+${card?.powerTokens || 2}</span>`;
  } else if (type === "event" || type === "draw-dream") {
    el.innerHTML = `<span class="fx-card-value">✦</span><span class="fx-card-suit">Event</span>`;
  } else if (suit === "wild" || card?.isWild) {
    el.innerHTML = `<span class="fx-card-value">★</span>`;
  } else {
    el.innerHTML = `<span class="fx-card-value">${card?.value ?? ""}</span>`;
  }
  return el;
}

function flyCard(from, to, card, kind, delay = 0, size = { w: 44, h: 62 }) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !to) return;

  const ghost = ghostCard(card, kind);
  ghost.style.width = `${size.w}px`;
  ghost.style.height = `${size.h}px`;
  ghost.style.left = `${from.x - size.w / 2}px`;
  ghost.style.top = `${from.y - size.h / 2}px`;
  ghost.style.animationDelay = `${delay}ms`;
  layer.appendChild(ghost);

  requestAnimationFrame(() => {
    ghost.style.setProperty("--fx-tx", `${to.x - from.x}px`);
    ghost.style.setProperty("--fx-ty", `${to.y - from.y}px`);
    ghost.classList.add("fx-flying-active");
  });

  setTimeout(() => ghost.remove(), 680 + delay);
}

function floatLabel(x, y, text, className, delay = 0) {
  const layer = document.getElementById("fx-layer");
  if (!layer) return;
  const el = document.createElement("div");
  el.className = `fx-float-label ${className}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.animationDelay = `${delay}ms`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1200 + delay);
}

export function queueDreamDrawFx(card) {
  queue.push({ type: "dream-draw", card });
}

export function queueMindstreamDrawFx(tileId, suit, card) {
  queue.push({ type: "mindstream-draw", tileId, suit, card });
}

export function queueEncounterSpawnFx(landscapeId, encounter, suit = null) {
  queue.push({ type: "encounter-spawn", landscapeId, encounter, suit });
}

export function queueTileRevealFx(tileId) {
  queue.push({ type: "tile-reveal", tileId });
}

export function queueTileForgetFx(tileId) {
  queue.push({ type: "tile-forget", tileId });
}

export function queuePowerTokensFx(playerId, count) {
  if (count > 0) queue.push({ type: "power-tokens", playerId, count });
}

export function queueRepressFx(card, { playerId = null, tileId = null } = {}) {
  queue.push({ type: "repress", card, playerId, tileId });
}

export function queueObjectDrawFx(playerId, card, suit = "lucidity") {
  queue.push({ type: "object-draw", playerId, card, suit });
}

export function runPendingBoardFx() {
  if (!queue.length) return;
  if (reducedMotion()) {
    queue.length = 0;
    return;
  }

  const items = queue.splice(0);
  let delay = 0;
  const step = 85;

  items.forEach((evt) => {
    if (evt.type === "dream-draw") {
      const from = centerOf(deckEl("dream")) || { x: window.innerWidth * 0.1, y: window.innerHeight * 0.35 };
      const to = boardCenter();
      flyCard(from, to, { ...evt.card, type: "dream" }, "dream", delay, { w: 56, h: 78 });
      pulseDeck("dream", "deck-pulse-gain");
      burstSparkles(from.x, from.y, 14, "#c9a0ff");
      burstSparkles(to.x, to.y, 10, "#f0c96a");
      delay += step;
    } else if (evt.type === "mindstream-draw") {
      const deckKey = `mindstream-${evt.suit || "lucidity"}`;
      const from = centerOf(deckEl(deckKey)) || centerOf(deckEl("mindstream-lucidity"));
      const tile = hexTileEl(evt.tileId);
      const to = centerOf(tile) || boardCenter();
      if (from && to) {
        const kind = evt.card?.type === "dreambeast" ? "spawn" : "draw";
        flyCard(from, to, evt.card, kind, delay, { w: 48, h: 66 });
        pulseDeck(deckKey, "deck-pulse-gain");
        flashEl(tile, "hex-mindstream-hit", 700);
        if (evt.card?.type === "dreambeast") {
          burstSparkles(to.x, to.y, 12, "#ff6b9d");
        }
      }
      delay += step;
    } else if (evt.type === "encounter-spawn") {
      const tile = hexTileEl(evt.landscapeId);
      const to = centerOf(tile) || boardCenter();
      const suit = evt.suit || evt.encounter?.suit || "willpower";
      const from = centerOf(deckEl(`mindstream-${suit}`)) || centerOf(deckEl("dream"));
      if (from && to) {
        flyCard(from, to, { ...evt.encounter, type: "dreambeast" }, "spawn", delay, { w: 52, h: 72 });
        flashEl(tile, "hex-encounter-spawn", 900);
        burstSparkles(to.x, to.y, 16, "#e84848");
        floatLabel(to.x, to.y - 28, "⚔ Dreambeast", "fx-spawn-label", delay + 120);
      }
      delay += step;
    } else if (evt.type === "tile-reveal") {
      const tile = hexTileEl(evt.tileId);
      const c = centerOf(tile);
      flashEl(tile, "hex-flash-reveal", 800);
      if (c) burstSparkles(c.x, c.y, 14, "#4ad4ff");
      delay += step * 0.5;
    } else if (evt.type === "tile-forget") {
      const tile = hexTileEl(evt.tileId);
      const c = centerOf(tile);
      flashEl(tile, "hex-flash-forget", 900);
      if (c) {
        burstSparkles(c.x, c.y, 10, "#ff6b6b");
        floatLabel(c.x, c.y, "Forgotten", "fx-loss", delay);
      }
      delay += step;
    } else if (evt.type === "power-tokens") {
      const target = centerOf(powerTokensEl());
      const from = centerOf(deckEl("psyche")) || { x: window.innerWidth * 0.12, y: window.innerHeight * 0.8 };
      if (target) {
        for (let i = 0; i < Math.min(evt.count, 4); i += 1) {
          flyCard(
            from,
            { x: target.x + (i - 1) * 12, y: target.y },
            { type: "psyche-power", powerTokens: 1 },
            "power",
            delay + i * 60,
            { w: 36, h: 48 },
          );
        }
        floatLabel(target.x, target.y - 18, `+${evt.count} Power`, "fx-gain", delay);
        flashEl(powerTokensEl(), "power-tokens-gain", 650);
      }
      delay += step;
    } else if (evt.type === "repress") {
      const to = centerOf(deckEl("subconscious"));
      let from = centerOf(handAreaEl(evt.playerId));
      if (evt.tileId) from = centerOf(hexTileEl(evt.tileId)) || from;
      if (from && to) {
        flyCard(from, to, evt.card, "repress", delay);
        pulseDeck("subconscious", "deck-pulse-repress");
      }
      delay += step;
    } else if (evt.type === "object-draw") {
      const deckKey = evt.suit ? `mindstream-${evt.suit}` : "mindstream-lucidity";
      const from = centerOf(deckEl(deckKey));
      const to = centerOf(objectsAreaEl());
      if (from && to) {
        flyCard(from, to, { ...evt.card, type: "object" }, "draw", delay, { w: 46, h: 64 });
        pulseDeck(deckKey, "deck-pulse-gain");
        flashEl(objectsAreaEl(), "objects-gain", 600);
      }
      delay += step;
    }
  });
}
