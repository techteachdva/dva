/**
 * Dusk, as its own beat (0.30). The table darkens, every Dreambeast still
 * standing steps forward with its toll (−2 each), and that many Psyche peel off
 * the Waking Mind one by one into the Subconscious. Then a single line sums it up.
 */

import { burstInkDissolve, playHaptic } from "./fx.js";
import { playSfx } from "../audio/audio.js";
import { markFxBusy } from "./fx-timeline.js";
import { cardBackForDeckId } from "../cards/card-backs.js";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function centerOf(el) {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

function wait(ms) {
  return new Promise((resolve) => { window.setTimeout(resolve, ms); });
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/** @returns {Promise<void>} */
export async function playDuskToll(job) {
  if (typeof document === "undefined" || !job?.count) return;
  const beasts = job.beasts || [];
  const taken = job.taken ?? job.count;
  const quiet = reducedMotion();
  const perCard = quiet ? 0 : 150;
  const total = quiet ? 1600 : 900 + beasts.length * 380 + taken * perCard + 1200;
  markFxBusy(total + 200);

  const root = document.createElement("div");
  root.className = "dusk-toll";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const extra = [
    job.omen ? `<span class="dt-extra">Omen −${job.omen}</span>` : "",
    job.long ? `<span class="dt-extra">Long Night −${job.long}</span>` : "",
  ].join("");
  root.innerHTML = `
    <div class="dt-veil" aria-hidden="true"></div>
    <div class="dt-panel">
      <p class="dt-kicker">Dusk</p>
      <h2 class="dt-title">${beasts.length ? `${beasts.length} Dreambeast${beasts.length === 1 ? "" : "s"} still stand${beasts.length === 1 ? "s" : ""}` : "The night deepens"}</h2>
      <div class="dt-beasts">
        ${beasts.map((b, i) => `
          <div class="dt-beast suit-${esc(b.suit)}" style="--i:${i}">
            <span class="dt-face" style="background-image:url('${esc(b.image)}')"></span>
            <span class="dt-name">${esc(b.name)}</span>
            <span class="dt-cost">−${esc(b.n)}</span>
          </div>`).join("")}
        ${extra}
      </div>
      <p class="dt-sum"><b>−${esc(taken)}</b> Psyche Repressed from the Waking Mind</p>
    </div>`;
  document.body.appendChild(root);
  document.body.classList.add("dusk-toll-active");
  playSfx("dice-lose");
  playHaptic("repress");

  await wait(quiet ? 200 : 700 + beasts.length * 380);
  root.classList.add("is-paying");
  const deck = document.querySelector('.deck-rail-row[data-deck-id="psyche"] .deck-rail-draw')
    || document.querySelector('[data-deck-id="psyche"]');
  const sub = document.querySelector('[data-deck-id="subconscious"]') || document.getElementById("btn-header-subconscious");
  const from = centerOf(deck) || { x: 90, y: window.innerHeight * 0.7 };
  const to = centerOf(sub) || { x: window.innerWidth / 2, y: 40 };
  const back = cardBackForDeckId("psyche");
  for (let i = 0; i < (quiet ? 0 : taken); i += 1) {
    const card = document.createElement("div");
    card.className = "dt-flying";
    card.style.left = `${from.x}px`;
    card.style.top = `${from.y}px`;
    if (back) card.style.backgroundImage = `url("${back}")`;
    document.body.appendChild(card);
    card.animate([
      { transform: "translate(-50%,-50%) scale(0.6) rotate(0deg)", opacity: 0 },
      { transform: `translate(calc(-50% + ${(to.x - from.x) * 0.5}px), calc(-50% + ${(to.y - from.y) * 0.5 - 60}px)) scale(1.1) rotate(${i % 2 ? 160 : -160}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(0.3) rotate(${i % 2 ? 340 : -340}deg)`, opacity: 0 },
    ], { duration: 720, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" });
    window.setTimeout(() => { burstInkDissolve(to.x, to.y); card.remove(); }, 720);
    if (i % 2 === 0) playSfx("repress");
    await wait(perCard);
  }
  await wait(quiet ? 1000 : 1100);
  root.classList.add("is-out");
  await wait(320);
  root.remove();
  document.body.classList.remove("dusk-toll-active");
}
