/** Board & special card flow animations — dreams, mindstream, tiles, encounters, repress. */

import { burstSparkles, playDreamRipple, playMeetFlash, playPointRipple, playDreamWarble, playBossFlash, playHaptic } from "./fx.js";
import { playSfx, playLandscapeSfx, playBossStinger } from "./audio.js";
import { cardBackForDeckId } from "./card-backs.js";

const queue = [];
const prevDreamerTiles = new Map();
const prevEncounterTiles = new Map();
const arrivingDreamers = new Set();
const departingDreamers = new Set();
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

function rippleAcrossBoard(origin, tone) {
  if (!origin || reducedMotion()) return;
  const forget = tone === "forget";
  const ringClass = forget ? "fx-forget-ripple" : "fx-reveal-ripple";
  const tileClass = forget ? "hex-ripple-forget" : "hex-ripple-reveal";
  const rings = forget ? 2 : 3;
  const stagger = forget ? 160 : 180;
  const life = forget ? 1100 : 1720;
  const reach = forget ? 240 : 300;
  const travel = forget ? 900 : 1360;
  for (let i = 0; i < rings; i += 1) {
    window.setTimeout(() => playPointRipple(origin.x, origin.y, ringClass, life), i * stagger);
  }
  document.querySelectorAll(".hex-tile").forEach((el) => {
    if (el.classList.contains("just-revealed") || el.classList.contains("just-forgotten")) return;
    const c = centerOf(el);
    if (!c) return;
    const dist = Math.hypot(c.x - origin.x, c.y - origin.y);
    if (dist > reach) return;
    const delay = Math.round((dist / reach) * travel);
    el.style.setProperty("--ripple-delay", `${delay}ms`);
    el.classList.add(tileClass);
    window.setTimeout(() => {
      el.classList.remove(tileClass);
      el.style.removeProperty("--ripple-delay");
    }, delay + 620);
  });
}

function deckEl(id) {
  return document.querySelector(`[data-deck-id="${id}"]`)
    || document.querySelector(`[data-deck="${id}"]`);
}

function pileZone(deckId, pile) {
  const row = document.querySelector(`.deck-rail-row[data-deck-id="${deckId}"]`);
  if (!row) return deckEl(deckId);
  const zone = row.querySelector(pile === "discard" ? ".deck-rail-discard" : ".deck-rail-draw");
  return zone || row;
}

function deckTitle(deckId) {
  if (deckId === "psyche") return "Psyche";
  if (deckId === "dream") return "Dream";
  if (deckId === "mindstream-lucidity") return "Lucidity";
  if (deckId === "mindstream-elasticity") return "Elasticity";
  if (deckId === "mindstream-willpower") return "Willpower";
  return "Mindstream";
}

function tableBanner(text) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !text) return;
  const el = document.createElement("div");
  el.className = "fx-table-banner";
  el.textContent = text;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

function hexTileEl(tileId) {
  return document.querySelector(`.hex-tile[data-tile-id="${tileId}"]`);
}

function encounterKey(encounter) {
  return encounter?.instanceId || encounter?.id || "";
}

export function isDreamerTokenHidden(playerId) {
  return arrivingDreamers.has(playerId) || departingDreamers.has(playerId);
}

export function isBeastTokenHidden(encKey) {
  return !!encKey && arrivingBeasts.has(encKey);
}

export function resetBoardMotion(state) {
  prevDreamerTiles.clear();
  prevEncounterTiles.clear();
  arrivingDreamers.clear();
  departingDreamers.clear();
  arrivingBeasts.clear();
  if (!state?.players) return;
  state.players.forEach((player) => {
    if (player.alive && player.landscapeId) prevDreamerTiles.set(player.id, player.landscapeId);
  });
  (state.board || []).forEach((tile) => {
    (tile.encounters || (tile.encounter ? [tile.encounter] : [])).forEach((enc) => {
      const key = encounterKey(enc);
      if (key) prevEncounterTiles.set(key, tile.id);
    });
  });
}

/** Diff Dreamer / encounter locations after state changes. Visual only. */
export function syncBoardMotion(state) {
  if (!state?.players) return;
  const animate = !reducedMotion();

  state.players.forEach((player) => {
    const prev = prevDreamerTiles.get(player.id);
    if (animate && player.alive && prev && player.landscapeId && prev !== player.landscapeId) {
      departingDreamers.add(player.id);
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
    const list = tile.encounters || (tile.encounter ? [tile.encounter] : []);
    list.forEach((encounter) => {
      const key = encounterKey(encounter);
      if (key) current.set(key, { tileId: tile.id, encounter });
    });
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
    departingDreamers.delete(id);
    document.querySelectorAll(`.hex-occupant-dreamer[data-dreamer-id="${id}"]`).forEach((el) => {
      el.classList.remove("is-arriving", "is-departing");
    });
  } else {
    arrivingBeasts.delete(id);
    document.querySelectorAll(`.hex-occupant-beast[data-encounter-key="${id}"]`).forEach((el) => {
      el.classList.remove("is-arriving");
    });
  }
}

function holdBodyClass(name, ms) {
  document.body.classList.add(name);
  window.setTimeout(() => document.body.classList.remove(name), ms);
}

function layWake(from, to, kind) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !to) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return;
  const el = document.createElement("div");
  el.className = kind === "beast" ? "fx-beast-crack" : "fx-dreamer-thread";
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  el.style.width = `${dist}px`;
  el.style.transform = `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)`;
  layer.appendChild(el);
  window.setTimeout(() => el.remove(), 980);
}

function flightMs(from, to) {
  const dist = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 180;
  return Math.round(Math.min(1320, 520 + dist * 0.38));
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

function playerChipEl(playerId) {
  return document.querySelector(`.player-chip[data-player-id="${playerId}"]`);
}

function dreamerTokenEl(playerId) {
  return document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${playerId}"]`);
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
  const suit = card?.suit || card?.mindstreamSuit || "lucidity";
  el.className = `fx-flying-card fx-flying-${kind} fx-card-${type} suit-${suit}`;
  if (card?.image && (kind === "repress" || kind === "return" || kind === "spawn" || kind === "discard" || kind === "accept")) {
    el.classList.add("fx-flying-face");
    el.style.backgroundImage = `url("${String(card.image).replace(/["\\]/g, "")}")`;
    el.innerHTML = `<span class="fx-card-name">${(card.name || "Card").slice(0, 18)}</span>`;
    return el;
  }

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

function flyCard(from, to, card, kind, delay = 0, size = { w: 44, h: 62 }, extraClass = "") {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !to) return;

  const ghost = ghostCard(card, kind);
  if (extraClass) ghost.classList.add(...extraClass.split(" ").filter(Boolean));
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

  const life = extraClass.includes("tarot") ? 1080 : 680;
  setTimeout(() => ghost.remove(), life + delay);
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

/** Drop pending short board flies when the POV cinematic will own the reveal. */
export function cancelQueuedMindstreamDrawFx() {
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (queue[i].type === "mindstream-draw") queue.splice(i, 1);
  }
}

export function queueMindstreamDiscardFx(tileId, suit, card, { wasted = false } = {}) {
  queue.push({ type: "mindstream-discard", tileId, suit, card, wasted });
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

export function queueRepressFx(card, { playerId = null, tileId = null, fromDeck = null } = {}) {
  if (!card) return;
  queue.push({ type: "repress", card, playerId, tileId, fromDeck });
}

export function queueReturnFx(card) {
  if (!card || typeof document === "undefined") return;
  const suit = card.mindstreamSuit || card.suit;
  let deckId = "psyche";
  let pile = "discard";
  if (card.type === "psyche-dreambeast" || card.isDreambeastPsyche) {
    deckId = `mindstream-${suit || "lucidity"}`;
    pile = "draw";
  } else if (card.type === "dream" || card.type === "boss-dream" || card.type === "final") {
    deckId = "dream";
  } else if (card.type === "psyche" || card.type === "psyche-power" || card.type === "wild") {
    deckId = "psyche";
  } else if (suit === "lucidity" || suit === "elasticity" || suit === "willpower") {
    deckId = `mindstream-${suit}`;
  }
  queue.push({ type: "return", card, deckId, pile });
}

export function cancelQueuedEncounterSpawn(instanceId) {
  if (!instanceId) return;
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const evt = queue[i];
    if (evt.type === "encounter-spawn" && (evt.encounter?.instanceId === instanceId)) {
      queue.splice(i, 1);
    }
  }
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

/** Accepted beast leaves the hex and settles into the Dreamer's hand. */
export function queueAcceptAllyFx(playerId, tileId, card) {
  if (!card) return;
  queue.push({ type: "accept-ally", playerId, tileId, card });
}

export function queuePsycheSwirlFx(cards, tileId) {
  if (!cards?.length) return;
  queue.push({ type: "psyche-swirl", cards, tileId });
}

export function queueReshuffleFx(suitOrId) {
  const raw = suitOrId || "lucidity";
  const deckId = raw === "psyche" || raw === "dream" || String(raw).startsWith("mindstream-")
    ? raw
    : `mindstream-${raw}`;
  queue.push({ type: "reshuffle", deckId });
}

export function queuePowerTokenSpendFx(playerId, count = 1) {
  if (count > 0) queue.push({ type: "power-spend", playerId, count });
}

export function queueDreamerPowerFx(playerId, dreamer, tileId = null) {
  queue.push({ type: "dreamer-power", playerId, dreamer, tileId });
}

export function queueDreamerDeathFx(playerId, name, tileId = null) {
  queue.push({ type: "dreamer-death", playerId, name, tileId });
}

export function queueArchetypePowerFx(archetype) {
  if (archetype) queue.push({ type: "archetype-power", archetype });
}

export function queueBossStingerFx(bossId, tileId = "bed") {
  queue.push({ type: "boss-stinger", bossId, tileId });
}

function playRailShuffle(deckId) {
  const from = centerOf(pileZone(deckId, "discard")) || centerOf(deckEl(deckId));
  const to = centerOf(pileZone(deckId, "draw")) || from;
  const layer = document.getElementById("fx-layer");
  if (!from || !to || !layer) return;
  const back = cardBackForDeckId(deckId);
  for (let i = 0; i < 7; i += 1) {
    const card = document.createElement("div");
    card.className = "fx-shuffle-card";
    card.style.backgroundImage = `url("${String(back).replace(/["\\]/g, "")}")`;
    card.style.left = `${from.x - 34}px`;
    card.style.top = `${from.y - 48}px`;
    card.style.setProperty("--fx-tx", `${to.x - from.x}px`);
    card.style.setProperty("--fx-ty", `${to.y - from.y}px`);
    card.style.setProperty("--riffle", `${(i - 3) * 16}px`);
    card.style.animationDelay = `${i * 68}ms`;
    layer.appendChild(card);
    setTimeout(() => card.remove(), 1280 + i * 68);
  }
  flashEl(pileZone(deckId, "draw"), "deck-shuffle", 1100);
  flashEl(pileZone(deckId, "discard"), "deck-shuffle", 1100);
  tableBanner(`${deckTitle(deckId)} discard shuffled into a new deck`);
  playSfx("flip");
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
    } else if (evt.type === "mindstream-discard") {
      const deckKey = `mindstream-${evt.suit || "lucidity"}`;
      const tile = hexTileEl(evt.tileId);
      const from = centerOf(tile) || boardCenter();
      const to = centerOf(deckEl(deckKey)) || boardCenter();
      if (from && to) {
        const ghostCard = evt.wasted ? { ...evt.card, name: "Unused" } : evt.card;
        flyCard(from, to, ghostCard, "discard", delay, { w: 48, h: 66 });
        pulseDeck(deckKey, "deck-pulse-loss");
        flashEl(tile, evt.wasted ? "hex-event-wasted" : "hex-mindstream-hit", 700);
      }
      delay += step;
    } else if (evt.type === "dreamer-move") {
      const from = centerOf(hexTileEl(evt.fromId)) || boardCenter();
      const to = centerOf(hexTileEl(evt.toId)) || boardCenter();
      const img = evt.image
        ? `<img src="${evt.image}" alt="">`
        : `<span class="fx-board-flyer-fallback">${(evt.name || "?").slice(0, 1)}</span>`;
      const duration = flightMs(from, to);
      layWake(from, to, "dreamer");
      flyDriftSnap(from, to, {
        className: "fx-dreamer-flyer",
        html: `<span class="fx-board-flyer-trail"></span>${img}`,
        duration,
      });
      burstSparkles(from.x, from.y, 8, "#c9a0ff");
      window.setTimeout(() => {
        burstSparkles(to.x, to.y, 10, "#f0c96a");
        playPointRipple(to.x, to.y, "fx-land-ripple");
        playHaptic("land");
        revealArriving("dreamer", evt.playerId);
      }, duration - 60);
      playDreamWarble(0.4);
      playSfx("move", { dist: Math.hypot(to.x - from.x, to.y - from.y) });
      delay += 40;
    } else if (evt.type === "encounter-move") {
      const from = centerOf(hexTileEl(evt.fromId)) || boardCenter();
      const to = centerOf(hexTileEl(evt.toId)) || boardCenter();
      const key = encounterKey(evt.encounter);
      const img = evt.encounter?.image
        ? `<img src="${evt.encounter.image}" alt="">`
        : `<span class="fx-board-flyer-fallback">⚔</span>`;
      const duration = flightMs(from, to);
      layWake(from, to, "beast");
      flyDriftSnap(from, to, {
        className: "fx-beast-flyer",
        html: `<span class="fx-board-flyer-trail"></span>${img}`,
        duration,
      });
      burstSparkles(from.x, from.y, 8, "#ff6b9d");
      window.setTimeout(() => {
        burstSparkles(to.x, to.y, 12, "#e84848");
        playPointRipple(to.x, to.y, "fx-summon-ripple");
        flashEl(hexTileEl(evt.toId), "hex-encounter-spawn", 700);
        playHaptic("land");
        revealArriving("beast", key);
      }, duration - 60);
      playDreamWarble(0.5);
      playSfx("move", { dist: Math.hypot(to.x - from.x, to.y - from.y), beast: true });
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
      if (c) {
        burstSparkles(c.x, c.y, 6, "#d8f6ff");
        rippleAcrossBoard(c, "reveal");
      }
      playDreamWarble(0.55);
      playHaptic("reveal");
      playLandscapeSfx(evt.tileId);
      delay += step * 0.5;
    } else if (evt.type === "tile-forget") {
      const tile = hexTileEl(evt.tileId);
      const c = centerOf(tile);
      if (c) {
        burstSparkles(c.x, c.y, 4, "#c46a80");
        floatLabel(c.x, c.y - 42, "Forgotten", "fx-loss", delay);
        rippleAcrossBoard(c, "forget");
      }
      playSfx("forget");
      playHaptic("forget");
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
      const to = centerOf(deckEl("subconscious")) || { x: window.innerWidth * 0.5, y: 48 };
      let from = evt.playerId ? centerOf(handAreaEl(evt.playerId)) : null;
      if (evt.tileId) from = centerOf(hexTileEl(evt.tileId)) || from;
      if (evt.fromDeck) from = centerOf(pileZone(evt.fromDeck, "draw")) || centerOf(deckEl(evt.fromDeck)) || from;
      if (!from) from = boardCenter();
      flyCard(from, to, evt.card, "repress", delay, { w: 86, h: 120 }, "fx-flying-tarot fx-repress-spiral");
      pulseDeck("subconscious", "deck-pulse-repress");
      const name = (evt.card?.name || "Card").slice(0, 22);
      floatLabel(to.x, Math.max(36, to.y - 36), `Repressed · ${name}`, "fx-return-label", delay + 60);
      playSfx("repress");
      playHaptic("repress");
      delay += 140;
    } else if (evt.type === "meet-flash") {
      playMeetFlash(evt.mode);
      playDreamWarble(evt.mode === "reject" ? 0.85 : 0.7);
      const tile = hexTileEl(evt.tileId);
      flashEl(tile, evt.mode === "reject" ? "hex-meet-reject" : "hex-meet-accept", 900);
      delay += step;
    } else if (evt.type === "accept-ally") {
      const from = centerOf(hexTileEl(evt.tileId)) || boardCenter();
      const to = centerOf(handAreaEl(evt.playerId)) || boardCenter();
      flyCard(
        from,
        to,
        { ...evt.card, type: "dreambeast" },
        "accept",
        delay,
        { w: 92, h: 128 },
        "fx-flying-accept",
      );
      burstSparkles(from.x, from.y, 16, "#f0c96a");
      window.setTimeout(() => {
        burstSparkles(to.x, to.y, 18, "#ffe7a8");
        playPointRipple(to.x, to.y, "fx-land-ripple");
        floatLabel(to.x, to.y - 24, `${(evt.card?.name || "Ally").slice(0, 18)} joins`, "fx-gain");
        playHaptic("accept");
      }, 780);
      playSfx("accept");
      flashEl(hexTileEl(evt.tileId), "hex-meet-accept", 1000);
      delay += 180;
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
    } else if (evt.type === "return") {
      const from = centerOf(deckEl("subconscious")) || { x: window.innerWidth * 0.5, y: 48 };
      const to = centerOf(pileZone(evt.deckId, evt.pile || "discard"))
        || centerOf(deckEl(evt.deckId))
        || boardCenter();
      flyCard(from, to, evt.card, "return", delay, { w: 86, h: 120 }, "fx-flying-tarot");
      flashEl(pileZone(evt.deckId, evt.pile || "discard"), "deck-pulse-gain", 800);
      const name = (evt.card?.name || "Card").slice(0, 22);
      const where = evt.pile === "draw" ? `${deckTitle(evt.deckId)} deck` : `${deckTitle(evt.deckId)} discard`;
      floatLabel(to.x, to.y - 40, `Returned to ${where}`, "fx-return-label", delay + 40);
      floatLabel(from.x, from.y + 18, name, "fx-return-label", delay);
      playSfx("flip");
      delay += 160;
    } else if (evt.type === "reshuffle") {
      playRailShuffle(evt.deckId || `mindstream-${evt.suit || "lucidity"}`);
      delay += 200;
    } else if (evt.type === "power-spend") {
      const from = centerOf(powerTokensEl());
      const to = boardCenter();
      if (from) {
        for (let i = 0; i < Math.min(evt.count, 3); i += 1) {
          flyCard(
            from,
            { x: to.x + (i - 1) * 18, y: to.y - 40 },
            { type: "psyche-power", powerTokens: 1 },
            "power",
            delay + i * 70,
            { w: 36, h: 48 },
          );
        }
        floatLabel(from.x, from.y - 18, `-${evt.count} Power`, "fx-loss", delay);
        flashEl(powerTokensEl(), "power-tokens-spend", 650);
        playSfx("deselect");
      }
      delay += step * 0.6;
    } else if (evt.type === "dreamer-power") {
      const from = centerOf(powerTokensEl()) || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.85 };
      const chip = playerChipEl(evt.playerId);
      const to = centerOf(chip) || boardCenter();
      flyCard(from, to, { type: "psyche-power", powerTokens: 1 }, "power", delay, { w: 36, h: 48 });
      flashEl(chip, "life-gain", 700);
      const burstAt = centerOf(dreamerTokenEl(evt.playerId))
        || (evt.tileId ? centerOf(hexTileEl(evt.tileId)) : null);
      const label = evt.dreamer?.name ? `${evt.dreamer.name} Power` : "Dreamer Power";
      window.setTimeout(() => {
        burstSparkles(to.x, to.y, 10, "#f0c96a");
        if (burstAt) {
          burstSparkles(burstAt.x, burstAt.y, 14, "#c9a0ff");
          playPointRipple(burstAt.x, burstAt.y, "fx-land-ripple");
          floatLabel(burstAt.x, burstAt.y - 30, label, "fx-gain");
        } else {
          floatLabel(to.x, to.y - 24, label, "fx-gain");
        }
      }, delay + 420);
      playSfx("sparkle");
      playDreamWarble(0.45);
      delay += step;
    } else if (evt.type === "dreamer-death") {
      const tile = evt.tileId ? hexTileEl(evt.tileId) : null;
      const c = centerOf(tile) || boardCenter();
      flashEl(tile, "hex-meet-reject", 900);
      burstSparkles(c.x, c.y, 12, "#8a8a9a");
      burstSparkles(c.x, c.y, 8, "#e84848");
      playPointRipple(c.x, c.y, "fx-summon-ripple");
      floatLabel(c.x, c.y - 26, `✖ ${evt.name || "Dreamer"} falls`, "fx-loss", delay);
      playSfx("dice-lose");
      delay += step;
    } else if (evt.type === "archetype-power") {
      const el = document.getElementById("acquired-archetypes");
      const c = centerOf(el) || boardCenter();
      flashEl(el, "objects-gain", 650);
      burstSparkles(c.x, c.y, 12, "#f0c96a");
      floatLabel(c.x, c.y - 22, evt.archetype?.name || "Archetype Power", "fx-gain", delay);
      playSfx("acquire");
      delay += step * 0.6;
    } else if (evt.type === "boss-stinger") {
      playBossFlash();
      playBossStinger(evt.bossId);
      const tile = hexTileEl(evt.tileId || "bed");
      const c = centerOf(tile) || boardCenter();
      flashEl(tile, "hex-boss-stinger", 1100);
      if (c) {
        burstSparkles(c.x, c.y, 22, "#e84848");
        burstSparkles(c.x, c.y, 14, "#f0c96a");
        floatLabel(c.x, c.y - 32, "☠ Boss", "fx-boss-label", delay);
        playPointRipple(c.x, c.y, "fx-boss-ripple");
      }
      delay += step * 1.2;
    }
  });
}
