/**
 * The Ante screen: the night's next step, laid out before you walk into it.
 *
 * Like a blind select, it opens at the start of every Ante, in the same window
 * as the Lost & Found: the Dream (face down, it always hurts), the Mini-Boss
 * that rises on The Bed with the second Dream, and the Boss with its twist,
 * each with what beating it pays. One button walks you in.
 */

import { getPhase } from "../core/state.js";
import { ladderEntry, antesForLength } from "../encounters/boss-ladder.js";

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

let lastKey = "";
let retryTimer = null;

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function absolute(src) {
  return src ? new URL(src, document.baseURI).href : "";
}

/** Index in the night plan of the next card still in the Dream Deck. */
function nextPlanIndex(state) {
  const inDeck = new Set((state.dreamDeck || []).map((c) => c.instanceId));
  return (state.nightPlan || []).findIndex((p) => inDeck.has(p.instanceId));
}

/** The Ante about to begin, or 0 when no Ante screen is due. */
export function anteAboutToBegin(state) {
  if (!state || state.status !== "playing" || state.tutorialMode) return 0;
  if (state.lostFound?.open || state.pendingBoonDraft) return 0;
  if (typeof document !== "undefined" && document.body.classList.contains("opening-cinematic-pending")) return 0;
  const next = nextPlanIndex(state);
  if (next < 0) return 0;
  let ante = 0;
  // Round 1 already holds the opening Dream; its Ante is the first.
  if (state.round === 1 && next === 1) ante = 1;
  else if (next % 3 === 0 && getPhase(state) === "Reveal" && !state.dreamDrawn) ante = next / 3 + 1;
  if (!ante || ante <= (state.anteIntroSeen || 0)) return 0;
  return ante;
}

export function anteScreenWanted(state) {
  return anteAboutToBegin(state) > 0;
}

function bossPowerText(entry) {
  if (!entry) return "";
  return entry.stack ? `Power ${entry.stack.join(", then ")}` : `Power ${entry.power}`;
}

/**
 * @param {object} state
 * @param {{ onEnter:()=>void }} handlers
 */
export function renderAnteScreen(state, handlers = {}) {
  const host = document.getElementById("ante-screen");
  if (!host) return;
  // While the opening plays, look again shortly so the Ante screen follows it.
  if (document.body.classList.contains("opening-cinematic-pending") && !retryTimer) {
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      handlers.onRetry?.();
    }, 500);
  }
  const ante = anteAboutToBegin(state);
  document.body.classList.toggle("ante-screen-open", !!ante);
  if (!ante) {
    if (!host.hidden) {
      host.classList.add("is-leaving");
      window.setTimeout(() => {
        if (!document.body.classList.contains("ante-screen-open")) {
          host.hidden = true;
          host.classList.remove("is-leaving");
          host.innerHTML = "";
        }
      }, 260);
    }
    lastKey = "";
    return;
  }
  host.hidden = false;
  host.classList.remove("is-leaving");
  const key = `${ante}|${state.round}`;
  if (key === lastKey) return;
  lastKey = key;

  const plan = state.nightPlan || [];
  const cards = plan.slice((ante - 1) * 3, ante * 3);
  const [dream, second, boss] = cards;
  const mini = second?.mini;
  const entry = boss?.bossId ? ladderEntry(boss.bossId) : null;
  const antes = antesForLength(state.lengthKey);
  const finalAnte = ante === antes;
  const openingDrawn = ante === 1 && !!dream?.name && !!state.dreamDrawn;

  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window as-window" role="dialog" aria-modal="true" aria-labelledby="as-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="as-title" class="lf-title">Ante ${ante}</h3>
        <span class="lf-round">${ante} of ${antes}${finalAnte ? " · the last" : ""}</span>
      </header>
      <p class="lf-whisper">${finalAnte ? "Beat this Boss with your goal met, and wake." : "Three rounds. Then the Boss."}</p>
      <div class="lf-shelf as-shelf">
        <article class="lf-item as-item as-dream">
          <div class="as-art as-art-back" aria-hidden="true"><span>?</span></div>
          <p class="as-step">Round 1</p>
          <h4 class="lf-item-name">${openingDrawn ? esc(dream.name) : "A Dream"}</h4>
          <p class="lf-item-kind">${openingDrawn ? "Drawn" : "Face down"}</p>
          <p class="lf-item-text">Every Dream hurts. Endure it, then build, walk, and meet.</p>
        </article>
        <article class="lf-item as-item as-mini suit-${esc(mini?.suit || "none")}">
          <div class="as-art" style="background-image:url('${esc(absolute(mini?.image))}')"></div>
          <p class="as-step">Round 2 · Mini-Boss</p>
          <h4 class="lf-item-name">${esc(mini?.name || "A Dreambeast")}</h4>
          <p class="lf-item-kind">Power ${mini?.power ?? "?"} · ${esc(SUIT_NAME[mini?.suit] || "")}</p>
          <p class="lf-item-text">Rises on The Bed with the second Dream. Bleeds 1 Psyche every dusk it stands.</p>
          <p class="as-reward">Beat it: +1 Power Token</p>
        </article>
        <article class="lf-item as-item as-boss suit-${esc(boss?.suit || "none")}">
          <div class="as-art" style="background-image:url('${esc(absolute(boss?.image))}')"></div>
          <p class="as-step">Round 3 · Boss</p>
          <h4 class="lf-item-name">${esc(boss?.name || "The Boss")}</h4>
          <p class="lf-item-kind">${esc(bossPowerText(entry))} · ${esc(SUIT_NAME[boss?.suit] || "")}</p>
          <p class="lf-item-text">${entry ? `<strong>${esc(entry.twist)}.</strong> ${esc(entry.twistText)}` : ""} Lands on a random Landscape and stalks you.</p>
          <p class="as-reward">Beat it: a Boon, then dawn (draw 3)</p>
        </article>
      </div>
      <footer class="lf-foot as-foot">
        <span class="as-note">${state.boons?.length ? `${state.boons.length} Boon${state.boons.length === 1 ? "" : "s"} carried` : "No Boons yet"}</span>
        <button type="button" class="lf-btn lf-continue" data-as-enter="1">Enter Ante ${ante} →</button>
      </footer>
    </section>`;

  const enter = host.querySelector("[data-as-enter]");
  enter?.addEventListener("click", () => {
    state.anteIntroSeen = ante;
    handlers.onEnter?.();
  });
  requestAnimationFrame(() => enter?.focus());
}
