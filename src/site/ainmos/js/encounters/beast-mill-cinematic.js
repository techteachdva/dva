/**
 * Draw-until-a-Dreambeast.
 * Passed cards flip off the Mindstream, the Dreambeast flies up like a Dream,
 * then it either lands on its landscape or waits beside another beast for a choice.
 */

import { cardBackForDeckId } from "../cards/card-backs.js";
import { burstSparkles } from "../ui/fx.js";
import { playSfx } from "../audio/audio.js";

const SUIT_NAME = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function deckOrigin(suit) {
  const key = `mindstream-${suit || "lucidity"}`;
  const el = document.querySelector(`.deck-rail-row[data-deck-id="${key}"] .deck-rail-draw`)
    || document.querySelector(`[data-deck-id="${key}"]`);
  return centerOf(el) || { x: 88, y: window.innerHeight * 0.42 };
}

function discardOrigin(suit) {
  const key = `mindstream-${suit || "lucidity"}`;
  const el = document.querySelector(`.deck-rail-row[data-deck-id="${key}"] .deck-rail-discard`);
  return centerOf(el) || deckOrigin(suit);
}

function tileOrigin(tileId) {
  const el = document.querySelector(`.hex-tile[data-tile-id="${tileId}"]`);
  return centerOf(el);
}

function cssUrl(url) {
  if (!url) return "";
  return `url("${String(url).replace(/["\\]/g, "")}")`;
}

function faceCard(card, suit, className) {
  const el = document.createElement("div");
  el.className = className;
  const inner = document.createElement("div");
  inner.className = "beast-mill-card-inner";
  const back = document.createElement("div");
  back.className = "beast-mill-face beast-mill-face--back";
  back.style.backgroundImage = cssUrl(cardBackForDeckId(`mindstream-${suit || "lucidity"}`));
  const front = document.createElement("div");
  front.className = "beast-mill-face beast-mill-face--front";
  if (card?.image) front.style.backgroundImage = cssUrl(card.image);
  const title = document.createElement("span");
  title.className = "beast-mill-face-title";
  title.textContent = card?.name || "Card";
  front.appendChild(title);
  inner.append(back, front);
  el.appendChild(inner);
  return el;
}

function place(el, from) {
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
}

/**
 * @param {Array<{ suit: string, passed: object[], milledRest: number, beast: object, tileId: string|null, discarded: boolean }>} steps
 * @returns {Promise<void>}
 */
export function playBeastMillSequence(steps) {
  const list = (steps || []).filter((step) => step?.beast);
  return new Promise((resolve) => {
    if (!list.length || typeof document === "undefined" || reducedMotion()) {
      resolve();
      return;
    }

    const root = document.createElement("div");
    root.className = "beast-mill";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    const caption = document.createElement("p");
    caption.className = "beast-mill-caption";
    root.appendChild(caption);
    document.body.appendChild(root);
    document.body.classList.add("beast-mill-active");

    const present = list.length > 1 && list.every((step) => !step.tileId && !step.discarded);

    const run = async () => {
      for (let i = 0; i < list.length; i += 1) {
        await playStep(root, caption, list[i], {
          present,
          slot: i,
          total: list.length,
        });
      }
      if (present) {
        caption.textContent = "Choose which Dreambeast to meet. The other is discarded.";
        await wait(900);
      }
      root.classList.add("beast-mill--out");
      await wait(280);
      root.remove();
      document.body.classList.remove("beast-mill-active");
      resolve();
    };

    run().catch(() => {
      root.remove();
      document.body.classList.remove("beast-mill-active");
      resolve();
    });
  });
}

async function playStep(root, caption, step, { present, slot, total }) {
  const suitName = SUIT_NAME[step.suit] || "Mindstream";
  const from = deckOrigin(step.suit);
  const passed = step.passed || [];
  const shown = passed.slice(0, 4);
  const hidden = Math.max(0, passed.length - shown.length);
  caption.textContent = hidden
    ? `Drawing ${suitName}… ${hidden + shown.length} cards pass`
    : `Drawing ${suitName} until a Dreambeast…`;

  shown.forEach((card, index) => {
    const flip = faceCard(card, step.suit, "beast-mill-pass");
    place(flip, from);
    const to = discardOrigin(step.suit);
    flip.style.setProperty("--pass-x", `${to.x - from.x}px`);
    flip.style.setProperty("--pass-y", `${to.y - from.y - 18}px`);
    flip.style.animationDelay = `${index * 40}ms`;
    root.appendChild(flip);
    setTimeout(() => flip.remove(), 720 + index * 40);
  });
  if (shown.length) {
    try { playSfx("flip"); } catch { /* optional */ }
    await wait(150 * shown.length + 80);
  }

  if (step.milledRest > 0) {
    caption.textContent = `${step.beast?.name || "A Dreambeast"} — the rest of ${suitName} is discarded and shuffled.`;
  } else {
    caption.textContent = step.beast?.name || "Dreambeast";
  }

  const beast = faceCard(step.beast, step.suit, "beast-mill-beast");
  place(beast, from);
  const tile = step.tileId ? tileOrigin(step.tileId) : null;
  const meetScale = Math.min(4.6, Math.max(2.4, (window.innerHeight * 0.5) / 112));
  let to = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.44 };
  let scale = meetScale;
  let peak = meetScale;
  if (present) {
    scale = total > 1 ? meetScale * 0.78 : meetScale;
    peak = scale;
    const span = 78 * scale * 0.62;
    to = {
      x: window.innerWidth * 0.5 + (slot - (total - 1) / 2) * span,
      y: window.innerHeight * 0.46,
    };
  } else if (step.discarded) {
    to = discardOrigin(step.suit);
    scale = 0.72;
    peak = Math.min(meetScale, 3);
    caption.textContent = `${step.beast?.name || "Dreambeast"} is discarded.`;
  } else if (tile) {
    to = tile;
    scale = 0.85;
    peak = meetScale;
  }
  const peakPos = present ? to : { x: window.innerWidth * 0.5, y: window.innerHeight * 0.44 };
  beast.style.setProperty("--peak-x", `${peakPos.x}px`);
  beast.style.setProperty("--peak-y", `${peakPos.y}px`);
  beast.style.setProperty("--peak-scale", String(peak));
  beast.style.setProperty("--from-x", `${from.x}px`);
  beast.style.setProperty("--from-y", `${from.y}px`);
  beast.style.setProperty("--to-x", `${to.x}px`);
  beast.style.setProperty("--to-y", `${to.y}px`);
  beast.style.setProperty("--to-scale", String(scale));
  root.appendChild(beast);
  requestAnimationFrame(() => beast.classList.add("beast-mill-beast--fly"));
  try { playSfx("draw"); } catch { /* optional */ }
  burstSparkles(from.x, from.y, 12, step.suit === "willpower" ? "#ff8a8a" : step.suit === "elasticity" ? "#f0c830" : "#4a9eff");

  await wait(present || !tile ? 880 : 980);
  if (tile && !present && !step.discarded) {
    burstSparkles(tile.x, tile.y, 16, "#e84848");
    caption.textContent = `${step.beast?.name || "Dreambeast"} spawns.`;
  }
  if (!present) {
    beast.classList.add("beast-mill-beast--done");
    await wait(180);
    beast.remove();
  }
}
