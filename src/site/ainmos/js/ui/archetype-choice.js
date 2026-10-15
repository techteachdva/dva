/**
 * The Archetype Dream: the third Dream of every Cycle. Choose 1 of 3
 * Archetypes. The chosen one appears on one of its two home Landscapes (or The
 * Bed when neither is placed) and waits there to be Met. The others sink to
 * the bottom of the deck.
 */

import { archetypeChoiceOptions, archetypeHomeTiles, archetypeHomeNames, ARCHETYPE_POWER, ARCHETYPE_TOKEN_REWARD } from "../dreamers/archetype-board.js";

let lastKey = "";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

export function renderArchetypeChoice(state, { onChoose } = {}) {
  const host = document.getElementById("archetype-choice");
  if (!host) return;
  const options = state?.pendingArchetypeChoice ? archetypeChoiceOptions(state) : [];
  if (!options.length || state.lostFound?.open) {
    host.hidden = true;
    host.innerHTML = "";
    lastKey = "";
    document.body.classList.remove("archetype-choice-open");
    return;
  }
  host.hidden = false;
  document.body.classList.add("archetype-choice-open");
  const key = options.map((a) => a.id).join("|");
  if (key === lastKey) return;
  lastKey = key;
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window ac-window" role="dialog" aria-modal="true" aria-labelledby="ac-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="ac-title" class="lf-title">An Archetype Stirs</h3>
        <span class="lf-round">${state.acquiredPoints || 0} of ${goal} Acquired</span>
      </header>
      <p class="lf-whisper">Call one into the dream. It appears on one of its two Landscapes and slips 1 Landscape away from you as each Meet ends.</p>
      <div class="lf-shelf ac-shelf">
        ${options.map((arch) => {
          const placed = new Set(archetypeHomeTiles(state, arch).map((t) => t.id));
          const homes = (arch.landscapes || []).map((id, i) => `
            <span class="ac-home${placed.has(id) ? " is-placed" : ""}" title="${placed.has(id) ? "Placed: it can appear here" : "Not placed yet"}">${placed.has(id) ? "✓" : "○"} ${esc(archetypeHomeNames(state, arch)[i])}</span>`).join("");
          return `
          <article class="lf-item ac-card suit-${esc(arch.suit)}">
            <div class="lf-item-art ac-art" style="background-image:url('${esc(arch.image)}')"></div>
            <h4 class="lf-item-name">${esc(arch.name)}</h4>
            <p class="lf-item-kind">${esc(SUIT_NAME[arch.suit] || "")} · Power ${ARCHETYPE_POWER}</p>
            <div class="ac-homes">${homes}</div>
            <p class="lf-item-text"><b>${arch.passive ? "Passive" : "Power · 1⚡"}:</b> ${esc(arch.passive || arch.power || "")}</p>
            <div class="lf-item-foot">
              <button type="button" class="lf-btn lf-continue" data-arch="${esc(arch.id)}">Call ${esc(arch.name)}</button>
            </div>
          </article>`;
        }).join("")}
      </div>
      <p class="ac-foot">Meet it: its Event, then a spread that makes a Form against Power ${ARCHETYPE_POWER}. Win: +1 Archetype, +${ARCHETYPE_TOKEN_REWARD} Power Tokens, and its power.</p>
    </section>`;
  host.querySelectorAll("[data-arch]").forEach((el) => el.addEventListener("click", () => onChoose?.(el.dataset.arch)));
}
