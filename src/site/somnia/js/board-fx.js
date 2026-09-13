/** Board & special card flow animations — dreams, mindstream, tiles, encounters, repress. */

import { burstSparkles, playDreamRipple, playMeetFlash, playPointRipple, playDreamWarble } from "./fx.js";
import { playSfx } from "./audio.js";

const queue = [];
const prevDreamerTiles = new Map();
const prevEncounterTiles = new Map();
const arrivingDreamers = new Set();
const arrivingBeasts = new Set();

const FLY_MS = 820;

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

function encounterKey(encounter) {
  return encounter?.instanceId || encounter?.id || "";
}

export function isDreamerTokenHidden(playerId) {
  return arrivingDreamers.has(playerId);
}

export function isBeastTokenHidden(encKey) {
  return !!encKey && arrivingBeasts.has(encKey);
}

export function resetBoardMotion(state) {
  prevDreamerTiles.clear();
  prevEncounterTiles.clear();
  arrivingDreamers.clear();
  arrivingBeasts.clear();
  if (!state?.players) return;
  state.players.forEach((player) => {
    if (player.alive && player.landscapeId) prevDreamerTiles.set(player.id, player.landscapeId);
  });
  (state.board || []).forEach((tile) => {
    const key = encounterKey(tile.encounter);
    if (key) prevEncounterTiles.set(key, tile.id);
  });
}

/** Diff Dreamer / encounter locations after state changes. Visual only. */
export function syncBoardMotion(state) {
  if (!state?.players) return;
  const animate = !reducedMotion();

  state.players.forEach((player) => {
    const prev = prevDreamerTiles.get(player.id);
    if (animate && player.alive && prev && player.landscapeId && prev !== player.landscapeId) {
      arrivingDreamers.add(player.id);
      queue.push({
        type: "dreamer-move",
        playerId: player.id,
        name: player.dreamer?.name || player.name,
        image: player.dreamer?.image || "",
        fromId: prev,
        toId: player.landscapeId,
      });
    }
    if (player.alive && player.landscapeId) prevDreamerTiles.set(player.id, player.landscapeId);
    else prevDreamerTiles.delete(player.id);
  });

  const current = new Map();
  (state.board || []).forEach((tile) => {
    const key = encounterKey(tile.encounter);
    if (key) current.set(key, { tileId: tile.id, encounter: tile.encounter });
  });
  current.forEach((now, key) => {
    const prevId = prevEncounterTiles.get(key);
    if (animate && prevId && prevId !== now.tileId) {
      arrivingBeasts.add(key);
      queue.push({
        type: "encounter-move",
        encounter: now.encounter,
        fromId: prevId,
        toId: now.tileId,
      });
    }
  });
  prevEncounterTiles.clear();
  current.forEach((now, key) => prevEncounterTiles.set(key, now.tileId));
}

function revealArriving(kind, id) {
  if (kind === "dreamer") {
    arrivingDreamers.delete(id);
    document.querySelectorAll(`.hex-occupant-dreamer[data-dreamer-id="${id}"]`).forEach((el) => {
      el.classList.remove("is-arriving");
    });
  } else {
    arrivingBeasts.delete(id);
    document.querySelectorAll(`.hex-occupant-beast[data-encounter-key="${id}"]`).forEach((el) => {
      el.classList.remove("is-arriving");
    });
  }
}

function flyDriftSnap(from, to, { html, className = "", duration = FLY_MS } = {}) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !to) return;
  const el = document.createElement("div");
  el.className = `fx-board-flyer ${className}`;
  el.innerHTML = html;
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  layer.appendChild(el);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const lift = Math.min(128, 42 + dist * 0.32);
  const drift = (dx === 0 && dy === 0) ? 0 : 26;
  const midX = dx * 0.42 + (dy >= 0 ? -drift : drift);
  const midY = dy * 0.32 - lift;
  const overX = dx + (dx === 0 ? 0 : Math.sign(dx) * 14);
  const overY = dy - 10;

  el.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.78) rotate(-12deg)", offset: 0, opacity: 0.12 },
      { transform: `translate(calc(-50% + ${midX}px), calc(-50% + ${midY}px)) scale(1.12) rotate(8deg)`, offset: 0.48, opacity: 1 },
      { transform: `translate(calc(-50% + ${overX}px), calc(-50% + ${overY}px)) scale(1.2) rotate(-3deg)`, offset: 0.78, opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9) rotate(2deg)`, offset: 0.9, opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(0deg)`, offset: 1, opacity: 1 },
    ],
    { duration, easing: "cubic-bezier(0.14, 0.72, 0.18, 1.18)", fill: "forwards" },
  );

  window.setTimeout(() => el.remove(), duration + 40);
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

export function queueObjectPlayFx(card, { to = "mindstream", suit = null } = {}) {
  if (!card) return;
  queue.push({ type: "object-play", card, to, suit });
}

export function queueMeetFlashFx(mode, tileId, cards = []) {
  queue.push({ type: "meet-flash", mode, tileId, cards });
}

export function queuePsycheSwirlFx(cards, tileId) {
  if (!cards?.length) return;
  queue.push({ type: "psyche-swirl", cards, tileId });
}

export function runPendingBoardFx() {
  if (!queue.length) return;
  if (reducedMotion()) {
    queue.length = 0;
    return;
  }

  const items = queue.splice(0);
  const movedEncKeys = new Set(
    items.filter((evt) => evt.type === "encounter-move").map((evt) => encounterKey(evt.encounter)),
  );
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
      playDreamRipple();
      playDreamWarble();
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
    } else if (evt.type === "dreamer-move") {
      const from = centerOf(hexTileEl(evt.fromId)) || boardCenter();
      const to = centerOf(hexTileEl(evt.toId)) || boardCenter();
      const img = evt.image
        ? `<img src="${evt.image}" alt="">`
        : `<span class="fx-board-flyer-fallback">${(evt.name || "?").slice(0, 1)}</span>`;
      flyDriftSnap(from, to, {
        className: "fx-dreamer-flyer",
        html: `<span class="fx-board-flyer-trail"></span>${img}`,
      });
      burstSparkles(from.x, from.y, 8, "#c9a0ff");
      window.setTimeout(() => {
        burstSparkles(to.x, to.y, 10, "#f0c96a");
        playPointRipple(to.x, to.y, "fx-land-ripple");
        revealArriving("dreamer", evt.playerId);
      }, FLY_MS - 60);
      playDreamWarble(0.4);
      playSfx("move");
      delay += 40;
    } else if (evt.type === "encounter-move") {
      const from = centerOf(hexTileEl(evt.fromId)) || boardCenter();
      const to = centerOf(hexTileEl(evt.toId)) || boardCenter();
      const key = encounterKey(evt.encounter);
      const img = evt.encounter?.image
        ? `<img src="${evt.encounter.image}" alt="">`
        : `<span class="fx-board-flyer-fallback">⚔</span>`;
      flyDriftSnap(from, to, {
        className: "fx-beast-flyer",
        html: `<span class="fx-board-flyer-trail"></span>${img}`,
      });
      burstSparkles(from.x, from.y, 8, "#ff6b9d");
      window.setTimeout(() => {
        burstSparkles(to.x, to.y, 12, "#e84848");
        playPointRipple(to.x, to.y, "fx-summon-ripple");
        flashEl(hexTileEl(evt.toId), "hex-encounter-spawn", 700);
        revealArriving("beast", key);
      }, FLY_MS - 60);
      playDreamWarble(0.5);
      playSfx("move");
      delay += 40;
    } else if (evt.type === "encounter-spawn") {
      if (movedEncKeys.has(encounterKey(evt.encounter))) return;
      const tile = hexTileEl(evt.landscapeId);
      const to = centerOf(tile) || boardCenter();
      const suit = evt.suit || evt.encounter?.suit || "willpower";
      const from = centerOf(deckEl(`mindstream-${suit}`)) || centerOf(deckEl("dream"));
      if (from && to) {
        flyCard(from, to, { ...evt.encounter, type: "dreambeast" }, "spawn", delay, { w: 52, h: 72 });
        flashEl(tile, "hex-encounter-spawn", 900);
        burstSparkles(to.x, to.y, 16, "#e84848");
        floatLabel(to.x, to.y - 28, "⚔ Dreambeast", "fx-spawn-label", delay + 120);
        window.setTimeout(() => playPointRipple(to.x, to.y, "fx-summon-ripple"), delay + 280);
      }
      delay += step;
    } else if (evt.type === "tile-reveal") {
      const tile = hexTileEl(evt.tileId);
      const c = centerOf(tile);
      flashEl(tile, "hex-flash-reveal", 800);
      if (c) burstSparkles(c.x, c.y, 14, "#4ad4ff");
      playDreamWarble(0.55);
      playSfx("flip");
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
    } else if (evt.type === "meet-flash") {
      playMeetFlash(evt.mode);
      playDreamWarble(evt.mode === "reject" ? 0.85 : 0.7);
      const tile = hexTileEl(evt.tileId);
      flashEl(tile, evt.mode === "reject" ? "hex-meet-reject" : "hex-meet-accept", 700);
      delay += step;
    } else if (evt.type === "psyche-swirl") {
      const tile = hexTileEl(evt.tileId);
      const to = centerOf(tile) || boardCenter();
      const discard = centerOf(deckEl("psyche")) || { x: window.innerWidth * 0.12, y: window.innerHeight * 0.82 };
      const cards = evt.cards.slice(0, 3);
      cards.forEach((card, i) => {
        const ghost = ghostCard(card, "swirl");
        const layer = document.getElementById("fx-layer");
        if (!layer) return;
        ghost.style.width = "46px";
        ghost.style.height = "64px";
        ghost.style.left = `${to.x - 23}px`;
        ghost.style.top = `${to.y - 32}px`;
        ghost.style.setProperty("--swirl-i", String(i));
        ghost.classList.add("fx-psyche-swirl");
        layer.appendChild(ghost);
        window.setTimeout(() => {
          ghost.classList.remove("fx-psyche-swirl");
          ghost.style.setProperty("--fx-tx", `${discard.x - to.x}px`);
          ghost.style.setProperty("--fx-ty", `${discard.y - to.y}px`);
          ghost.classList.add("fx-flying-active");
          window.setTimeout(() => ghost.remove(), 520);
        }, 520 + i * 40);
      });
      flashEl(tile, "hex-psyche-gold", 720);
      delay += 220;
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
    } else if (evt.type === "object-play") {
      const persistentEl = document.getElementById("player-persistent");
      const from = centerOf(objectsAreaEl()) || centerOf(persistentEl);
      const suit = evt.suit || evt.card?.mindstreamSuit || evt.card?.suit;
      const deckKey = suit ? `mindstream-${suit}` : "mindstream-lucidity";
      let to = centerOf(deckEl(deckKey));
      if (evt.to === "persistent") to = centerOf(persistentEl);
      else if (evt.to === "subconscious") to = centerOf(deckEl("subconscious"));
      else if (evt.to === "activate") to = centerOf(persistentEl) || from;
      if (from && to) {
        const kind = evt.to === "persistent" || evt.to === "activate" ? "draw" : evt.to === "subconscious" ? "repress" : "discard";
        flyCard(from, to, { ...evt.card, type: "object" }, kind, delay, { w: 46, h: 64 });
        if (evt.to === "persistent" || evt.to === "activate") {
          flashEl(persistentEl, "objects-gain", 600);
        } else if (evt.to === "subconscious") {
          pulseDeck("subconscious", "deck-pulse-repress");
        } else {
          pulseDeck(deckKey, "deck-pulse-loss");
        }
      }
      delay += step;
    }
  });
}
