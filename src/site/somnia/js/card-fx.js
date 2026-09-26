/** Card flow animations — draws, discards, spends, and life (hand size) feedback. */

import { burstSparkles } from "./fx.js";
import { cardBackForCard } from "./card-backs.js";

const queue = [];
const queuedDiscardIds = new Set();

const SUIT_COLORS = {
  lucidity: "#4a9eff",
  elasticity: "#f0c830",
  willpower: "#e84848",
  wild: "#c9a0ff",
};

function cardSnapshot(card) {
  const wild = card.suit === "wild" || card.type === "wild" || card.name === "Wild";
  return {
    instanceId: card.instanceId,
    suit: wild ? "wild" : card.suit,
    value: card.value,
    type: card.type,
    name: card.name,
    isWild: wild,
    isDreambeast: card.type === "psyche-dreambeast" || card.isDreambeastPsyche,
    image: card.image || "",
    back: cardBackForCard(card),
  };
}

export function queueCardDraw(playerId, cards, source = "psyche") {
  const list = Array.isArray(cards) ? cards : [cards];
  list.forEach((card) => {
    if (!card?.instanceId) return;
    queue.push({ type: "draw", playerId, card: cardSnapshot(card), source });
  });
}

export function queueCardDiscard(playerId, cards, target = "discard", reason = "discard") {
  const list = Array.isArray(cards) ? cards : [cards];
  list.forEach((card) => {
    if (!card?.instanceId) return;
    queuedDiscardIds.add(card.instanceId);
    queue.push({ type: "discard", playerId, card: cardSnapshot(card), target, reason });
  });
}

export function queueHandDelta(playerId, delta) {
  if (!delta) return;
  queue.push({ type: "life", playerId, delta });
}

export function queueCardTrade(fromPlayerId, toPlayerId, cards) {
  const list = Array.isArray(cards) ? cards : [cards];
  list.forEach((card) => {
    if (!card?.instanceId) return;
    queuedDiscardIds.add(card.instanceId);
    queue.push({ type: "trade", fromPlayerId, toPlayerId, card: cardSnapshot(card) });
  });
}

export function syncHandRemovals(state) {
  if (!state?.players) return;
  state.players.forEach((player) => {
    const prev = prevHandsByPlayer.get(player.id);
    if (!prev) return;
    const currIds = new Set(player.hand.map((c) => c.instanceId));
    for (const [id, card] of prev) {
      if (!currIds.has(id) && !queuedDiscardIds.has(id)) {
        queue.push({
          type: "discard",
          playerId: player.id,
          card,
          target: "discard",
          reason: "lost",
        });
      }
    }
  });
}

export function updateHandSnapshots(state) {
  if (!state?.players) return;
  state.players.forEach((player) => {
    const map = new Map(player.hand.map((c) => [c.instanceId, cardSnapshot(c)]));
    const prev = prevHandsByPlayer.get(player.id);
    if (prev) {
      const delta = map.size - prev.size;
      if (delta !== 0) {
        const hasLife = queue.some((e) => e.type === "life" && e.playerId === player.id);
        if (!hasLife) queueHandDelta(player.id, delta);
      }
    }
    prevHandsByPlayer.set(player.id, map);
  });
  queuedDiscardIds.clear();
}

const prevHandsByPlayer = new Map();

export function resetHandSnapshots(state) {
  prevHandsByPlayer.clear();
  queue.length = 0;
  queuedDiscardIds.clear();
  if (!state?.players) return;
  state.players.forEach((player) => {
    prevHandsByPlayer.set(
      player.id,
      new Map(player.hand.map((c) => [c.instanceId, cardSnapshot(c)])),
    );
  });
}

function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function deckEl(id) {
  return document.querySelector(`[data-deck-id="${id}"]`);
}

function handCardEl(playerId, instanceId) {
  return document.querySelector(
    `.game-card[data-instance-id="${instanceId}"][data-player-id="${playerId}"], #hand .game-card[data-instance-id="${instanceId}"]`,
  );
}

function handAreaEl(playerId) {
  const handRoot = document.getElementById("hand");
  if (handRoot?.dataset.playerId === playerId) {
    return document.getElementById("hand-primary") || handRoot;
  }
  const primary = document.getElementById("hand-primary");
  if (primary) return primary;
  return document.getElementById("hand-bar") || document.getElementById("hand");
}

function playerChipEl(playerId) {
  return document.querySelector(`.player-chip[data-player-id="${playerId}"]`);
}

function ghostCard(card, kind) {
  const el = document.createElement("div");
  const suit = card.isWild ? "wild" : (card.suit || "lucidity");
  el.className = `fx-flying-card fx-flying-${kind} suit-${suit}`;
  const face = card.isDreambeast
    ? `<span class="fx-card-value">3</span><span class="fx-card-suit">⚔</span>`
    : card.isWild
      ? `<span class="fx-card-value">★</span>`
      : `<span class="fx-card-value">${card.value ?? ""}</span>`;
  if (kind === "draw") {
    el.classList.add("fx-flip-card");
    const back = card.back || cardBackForCard(card);
    const art = card.image ? ` style="background-image:url('${card.image}')"` : "";
    el.innerHTML = `
      <div class="fx-flip-inner">
        <div class="fx-flip-face fx-flip-back" style="background-image:url('${back}')"></div>
        <div class="fx-flip-face fx-flip-front"${art}>${art ? "" : face}</div>
      </div>
    `;
    return el;
  }
  el.innerHTML = face;
  return el;
}

function flyCard(from, to, card, kind, delay = 0) {
  const layer = document.getElementById("fx-layer");
  if (!layer || !from || !to) return;

  const ghost = ghostCard(card, kind);
  const w = 44;
  const h = 62;
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

  setTimeout(() => {
    ghost.remove();
    if (kind === "draw" || kind === "spend" || kind === "trade") {
      burstSparkles(to.x, to.y, kind === "draw" ? 8 : 6, kind === "draw" ? "#6dffb0" : "#c9a0ff");
    }
  }, 650 + delay);
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

function flashEl(el, className, ms = 700) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}

function pulseDeck(deckId, className) {
  flashEl(deckEl(deckId), className);
}

export function runPendingCardFx(state) {
  if (!queue.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    queue.length = 0;
    return;
  }

  const items = queue.splice(0);
  let delay = 0;
  const step = 70;

  items.forEach((evt) => {
    if (evt.type === "draw") {
      const source = deckEl(evt.source || "psyche");
      const target = handCardEl(evt.playerId, evt.card.instanceId)
        || centerOf(handAreaEl(evt.playerId));
      const from = centerOf(source) || { x: window.innerWidth * 0.12, y: window.innerHeight * 0.55 };
      const to = typeof target === "object" && target.x ? target : centerOf(target);
      if (to) {
        flyCard(from, to, evt.card, "draw", delay);
        pulseDeck(evt.source || "psyche", "deck-pulse-gain");
        const hand = handCardEl(evt.playerId, evt.card.instanceId);
        if (hand) flashEl(hand, "card-landed", 500);
      }
      delay += step;
    } else if (evt.type === "discard") {
      const from = centerOf(handAreaEl(evt.playerId)) || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.85 };
      const targetId = evt.target === "subconscious" ? "subconscious" : "psyche";
      const to = centerOf(deckEl(targetId)) || { x: window.innerWidth * 0.12, y: window.innerHeight * 0.7 };
      const kind = evt.reason === "spend" ? "spend" : evt.reason === "repress" ? "repress" : "discard";
      flyCard(from, to, evt.card, kind, delay);
      pulseDeck(targetId, kind === "repress" ? "deck-pulse-repress" : "deck-pulse-loss");
      delay += step;
    } else if (evt.type === "trade") {
      const from = centerOf(handAreaEl(evt.fromPlayerId)) || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.85 };
      const to = centerOf(playerChipEl(evt.toPlayerId))
        || centerOf(handAreaEl(evt.toPlayerId))
        || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.2 };
      flyCard(from, to, evt.card, "trade", delay);
      delay += step;
    } else if (evt.type === "life") {
      const chip = playerChipEl(evt.playerId);
      const handStats = document.getElementById("hand-stats");
      const area = centerOf(chip) || centerOf(handStats) || { x: window.innerWidth * 0.5, y: window.innerHeight * 0.88 };
      const gain = evt.delta > 0;
      const text = gain ? `+${evt.delta} Psyche` : `${evt.delta} Psyche`;
      floatLabel(area.x, area.y - 10, text, gain ? "fx-gain" : "fx-loss", delay);
      flashEl(chip, gain ? "life-gain" : "life-loss");
      flashEl(handStats, gain ? "life-gain" : "life-loss");
      flashEl(document.getElementById("hand"), gain ? "hand-gain" : "hand-loss");
      flashEl(handAreaEl(evt.playerId), gain ? "hand-gain" : "hand-loss");
      delay += step;
    }
  });
}
