/**
 * Somnia 36.0 — Mindstream draw cinematic.
 * Card lifts from the left-rail Mindstream deck, swoops toward the camera,
 * grows until it fills the view, then dissolves into the fullscreen choice.
 */

import { cardBackForDeckId } from "./card-backs.js";
import { burstSparkles } from "./fx.js";
import { playSfx } from "./audio.js";

const DURATION_MS = 1650;
const FADE_MS = 380;

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

function deckOrigin(suit) {
  const key = `mindstream-${suit || "lucidity"}`;
  const el = document.querySelector(`.deck-rail-draw[data-deck-id="${key}"]`)
    || document.querySelector(`[data-deck-id="${key}"]`)
    || document.querySelector(`[data-deck="${key}"]`);
  return centerOf(el) || { x: 72, y: window.innerHeight * 0.42, w: 48, h: 68 };
}

/**
 * @param {{ card: object, suit?: string }} opts
 * @returns {Promise<void>}
 */
export function playMindstreamDrawCinematic({ card, suit } = {}) {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || !card) {
      resolve();
      return;
    }
    if (reducedMotion()) {
      resolve();
      return;
    }

    const msSuit = suit || card.mindstreamSuit || card.suit || "lucidity";
    const from = deckOrigin(msSuit);
    const art = card.image || "";
    const back = cardBackForDeckId(`mindstream-${msSuit}`);

    const root = document.createElement("div");
    root.className = "ms-draw-cinematic";
    root.dataset.suit = msSuit;
    root.innerHTML = `
      <div class="ms-draw-veil" aria-hidden="true"></div>
      <div class="ms-draw-card" style="--from-x:${from.x}px;--from-y:${from.y}px;">
        <div class="ms-draw-card-inner">
          <div class="ms-draw-face ms-draw-face--back" style="background-image:url('${back}')"></div>
          <div class="ms-draw-face ms-draw-face--front"${art ? ` style="background-image:url('${art}')"` : ""}>
            ${art ? "" : `<span class="ms-draw-face-title">${card.name || "Mindstream"}</span>`}
          </div>
        </div>
      </div>
      <div class="ms-draw-swallow" aria-hidden="true"${art ? ` style="background-image:url('${art}')"` : ""}></div>
    `;
    document.body.appendChild(root);
    document.body.classList.add("ms-draw-cinematic-active");

    try {
      playSfx("draw");
    } catch {
      /* optional */
    }
    burstSparkles(from.x, from.y, 16, msSuit === "willpower" ? "#ff8a8a" : msSuit === "elasticity" ? "#f0c830" : "#4a9eff");

    requestAnimationFrame(() => {
      root.classList.add("ms-draw-cinematic--play");
    });

    // Mid-flight sparkle near screen center as the card flips and grows.
    window.setTimeout(() => {
      burstSparkles(window.innerWidth * 0.5, window.innerHeight * 0.48, 22, "#f0e8ff");
      try {
        playSfx("dream");
      } catch {
        /* optional */
      }
    }, 720);

    window.setTimeout(() => {
      root.classList.add("ms-draw-cinematic--swallow");
    }, DURATION_MS - FADE_MS);

    window.setTimeout(() => {
      root.remove();
      document.body.classList.remove("ms-draw-cinematic-active");
      resolve();
    }, DURATION_MS);
  });
}
