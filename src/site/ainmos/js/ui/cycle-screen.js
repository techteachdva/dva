/**
 * The Cycle screen: the night's next Cycle, laid out before you walk into it.
 *
 * A Cycle is three Dreams, and each Dream is one Reveal · Explore · Meet: nine
 * phases. Dream 1 is a Dream card to survive, Dream 2 brings the Cycle's
 * Dreambeast, and Dream 3 calls an Archetype (choose 1 of 3). The window shows
 * that map, what each Dream brings, and the Dreambeasts climbing in Power.
 */

import { getPhase } from "../core/state.js";
import { ladderEntry } from "../encounters/boss-ladder.js";
import { megaLeviathan } from "../encounters/endless.js";
import { beastWardText, powerForCycle } from "../encounters/beast-wards.js";
import { twistInfo } from "../encounters/beast-twists.js";
import { cyclesForLength, PHASE_NAMES, PHASE_SUITS, DREAMS_PER_CYCLE } from "../core/cycle.js";
import { suitIconHtml } from "../core/rules.js";

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

/** The Cycle about to begin, or 0 when no Cycle screen is due. */
export function cycleAboutToBegin(state) {
  if (!state || state.status !== "playing" || state.tutorialMode) return 0;
  if (state.lostFound?.open || state.pendingBoonDraft) return 0;
  if (typeof document !== "undefined" && document.body.classList.contains("opening-cinematic-pending")) return 0;
  const next = nextPlanIndex(state);
  if (next < 0) return 0;
  let cycle = 0;
  // Round 1 already holds the opening Dream; its Cycle is the first.
  if (state.round === 1 && next === 1) cycle = 1;
  else if (next % DREAMS_PER_CYCLE === 0 && getPhase(state) === "Reveal" && !state.dreamDrawn) cycle = next / DREAMS_PER_CYCLE + 1;
  if (!cycle || cycle <= (state.anteIntroSeen || 0)) return 0;
  return cycle;
}

export function cycleScreenWanted(state) {
  return cycleAboutToBegin(state) > 0;
}

/** A Cycle's Dreambeast Power as it will arrive: printed + the Cycle (Leviathans of Endless Mode are fixed). */
function bossPower(entry, cycle = 0, plan = null, sep = "·") {
  if (plan?.mega) return String(megaLeviathan(plan.mega)?.power ?? "?");
  if (!entry) return plan?.accept != null ? String(powerForCycle(plan, Number(plan.accept), cycle)) : "?";
  return String(powerForCycle(entry, entry.power, cycle));
}

/** Nine phases as three Dreams of Reveal · Explore · Meet. */
function phaseMapHtml() {
  return Array.from({ length: DREAMS_PER_CYCLE }, (_, d) => {
    const phases = PHASE_SUITS.map((suit, i) => {
      const n = d * 3 + i + 1;
      return `<span class="cy-phase suit-${suit}">
        <span class="cy-phase-n">${n}</span>
        ${suitIconHtml(suit, { className: "cy-phase-icon", size: 14 })}
        <span class="cy-phase-name">${PHASE_NAMES[i]}</span>
      </span>`;
    }).join("");
    return `<div class="cy-dream">
      <p class="cy-dream-name">Dream ${d + 1}</p>
      <div class="cy-phases">${phases}</div>
    </div>`;
  }).join(`<span class="cy-arrow" aria-hidden="true">›</span>`);
}

/** Every Boss of the night, left to right, with its Power: the climb at a glance. */
function ladderHtml(state, cycle) {
  const defeated = new Set(state.bossesDefeated || []);
  const bosses = (state.nightPlan || []).filter((p) => p.boss);
  return bosses.map((p, i) => {
    const entry = ladderEntry(p.bossId);
    const n = p.ante || i + 1;
    const when = defeated.has(p.bossId) ? "beaten" : n < cycle ? "past" : n === cycle ? "now" : "ahead";
    return `<span class="cy-rung is-${when}" title="Cycle ${n}: ${esc(p.name)}, Power ${esc(bossPower(entry, n, p))}${when === "beaten" ? " (beaten)" : ""}">
      <span class="cy-rung-face" style="background-image:url('${esc(absolute(p.image))}')"></span>
      <span class="cy-rung-power">${esc(bossPower(entry, n, p))}</span>
      <span class="cy-rung-n">${n}</span>
    </span>`;
  }).join("");
}

/**
 * @param {object} state
 * @param {{ onEnter:()=>void, onRetry:()=>void }} handlers
 */
export function renderCycleScreen(state, handlers = {}) {
  const host = document.getElementById("cycle-screen");
  if (!host) return;
  // While the opening plays, look again shortly so the Cycle screen follows it.
  if (document.body.classList.contains("opening-cinematic-pending") && !retryTimer) {
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      handlers.onRetry?.();
    }, 500);
  }
  const cycle = cycleAboutToBegin(state);
  document.body.classList.toggle("cycle-screen-open", !!cycle);
  if (!cycle) {
    if (!host.hidden) {
      host.classList.add("is-leaving");
      window.setTimeout(() => {
        if (!document.body.classList.contains("cycle-screen-open")) {
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
  const key = `${cycle}|${state.round}`;
  if (key === lastKey) return;
  lastKey = key;

  const plan = state.nightPlan || [];
  const [dream, boss, closer] = plan.slice((cycle - 1) * 3, cycle * 3);
  const entry = boss?.bossId ? ladderEntry(boss.bossId) : null;
  const twist = twistInfo(boss?.bossId ? { id: boss.bossId } : boss);
  const endless = !!state.endless;
  const cycles = cyclesForLength(state.lengthKey);
  const finalCycle = !endless && cycle === cycles;
  const mega = closer?.mega ? megaLeviathan(closer.mega) : null;
  const ward = boss?.bossId ? beastWardText({ id: boss.bossId, accept: entry?.power ?? 9 }) : "";
  const openingDrawn = cycle === 1 && !!dream?.name && !!state.dreamDrawn;
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  const have = state.acquiredPoints || 0;
  const offered = (state.archetypeDeck || []).slice(0, 3);

  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window cy-window" role="dialog" aria-modal="true" aria-labelledby="cy-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="cy-title" class="lf-title">Cycle ${cycle} <small>${endless ? "· Endless" : `of ${cycles}`}</small></h3>
        <span class="lf-round">★ ${endless ? have : `${have}/${goal}`} Archetypes</span>
      </header>
      ${endless || finalCycle ? `<p class="lf-whisper">${endless ? (mega ? `Ends with ${esc(mega.name)}.` : "The dream goes on.") : "Last Cycle. Last Archetype."}</p>` : ""}
      <div class="cy-map" aria-label="This Cycle: three Dreams of Reveal, Explore, Meet">${phaseMapHtml()}</div>
      <div class="lf-shelf cy-shelf">
        <article class="lf-item cy-item cy-dream-card">
          <div class="cy-art cy-art-back" aria-hidden="true"><span>?</span></div>
          <p class="cy-step">Dream 1</p>
          <h4 class="lf-item-name">${openingDrawn ? esc(state.activeDream?.name || dream.name) : "A Dream"}</h4>
          <p class="lf-item-kind">${openingDrawn ? "Drawn" : "Face down"}</p>
          <p class="lf-item-text">Endure it.</p>
        </article>
        <article class="lf-item cy-item cy-boss suit-${esc(boss?.suit || "none")}">
          <div class="cy-art" style="background-image:url('${esc(absolute(boss?.image))}')"></div>
          <p class="cy-step">Dream 2 · Dreambeast</p>
          <h4 class="lf-item-name">${esc(boss?.name || "A Dreambeast")}</h4>
          <p class="lf-item-kind">Power ${esc(bossPower(entry, cycle, boss, ", then "))} · ${esc(SUIT_NAME[boss?.suit] || "")}${ward ? ` · <span class="beast-ward">${esc(ward)}</span>` : ""}</p>
          <p class="lf-item-text">${twist ? `<strong>${esc(twist.twist)}.</strong> ${esc(twist.twistText)} ` : ""}Chases you. −2 Psyche each dusk.</p>
          <p class="cy-reward">Win: 2 Power Tokens or a ${esc(SUIT_NAME[boss?.suit] || "")} Object</p>
        </article>
        ${mega ? `
        <article class="lf-item cy-item cy-boss cy-mega mega-${mega.tier}">
          <div class="cy-art" style="background-image:url('${esc(absolute(mega.image))}')"></div>
          <p class="cy-step">Dream 3 · Leviathan ${mega.tier}/5</p>
          <h4 class="lf-item-name">${esc(mega.name)}</h4>
          <p class="lf-item-kind">Power ${mega.power} · <span class="beast-ward">${esc(beastWardText({ ward: mega.ward }))}</span></p>
          <p class="lf-item-text"><em>${esc(mega.flavor)}</em> At dusk, Forget the edge Landscape farthest from The Bed.</p>
          <p class="cy-reward">${mega.tier === 5 ? "Win: the dream ends" : "Win before the next one rises"}</p>
        </article>` : `
        <article class="lf-item cy-item cy-arch">
          <div class="cy-art cy-art-back" aria-hidden="true"><span>★</span></div>
          <p class="cy-step">Dream 3 · Archetype</p>
          <h4 class="lf-item-name">Choose 1 of 3</h4>
          <p class="lf-item-kind">${offered.length ? esc(offered.map((x) => x.name).join(" · ")) : "No Archetypes left"}</p>
          <p class="lf-item-text">Appears on its revealed home. Moves 1 after each Meet. Beat Power 12 with a Form.</p>
          <p class="cy-reward">Win: +1 Archetype, +1 Power Token, its power</p>
        </article>`}
      </div>
      <div class="cy-ladder" aria-label="The Boss of every Cycle and its Power">
        <span class="cy-ladder-title">Dreambeasts ahead</span>
        <span class="cy-rungs">${ladderHtml(state, cycle)}</span>
      </div>
      <footer class="lf-foot cy-foot">
        <span class="cy-note"></span>
        <button type="button" class="lf-btn lf-continue" data-cy-enter="1">Begin Cycle ${cycle}</button>
      </footer>
    </section>`;

  const enter = host.querySelector("[data-cy-enter]");
  enter?.addEventListener("click", () => {
    state.anteIntroSeen = cycle;
    handlers.onEnter?.();
  });
  requestAnimationFrame(() => enter?.focus());
}
