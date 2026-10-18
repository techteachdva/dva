/**
 * The Archetype Dream: the third Dream of every Cycle. Choose 1 of 3
 * Archetypes. Only one with a revealed home Landscape can be called: it
 * appears there and waits to be Met. The others sink to the bottom of the deck.
 * When none can be called, the window offers the search: Repress 1 Psyche to
 * pull the first missing home from the Landscape deck onto a random hex.
 */

import { archetypeChoiceOptions, archetypeHomeTiles, archetypeHomeNames, ARCHETYPE_POWER, ARCHETYPE_TOKEN_REWARD } from "../dreamers/archetype-board.js";
import { archetypeCallBlock, archetypeSearchNeeded, firstMissingHome } from "../dreamers/archetype-call.js";

let lastKey = "";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

export function renderArchetypeChoice(state, { onChoose, onSearch } = {}) {
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
  const placedKey = options.map((a) => archetypeHomeTiles(state, a).length).join(",");
  const key = `${options.map((a) => a.id).join("|")}:${placedKey}`;
  if (key === lastKey) return;
  lastKey = key;
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window ac-window" role="dialog" aria-modal="true" aria-labelledby="ac-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="ac-title" class="lf-title">An Archetype Stirs</h3>
        <span class="lf-round">★ ${state.acquiredPoints || 0}/${goal}</span>
      </header>
      <p class="lf-whisper">Call one. It appears on a revealed home and moves 1 after each Meet.</p>
      ${searchBanner(state)}
      <div class="lf-shelf ac-shelf">
        ${options.map((arch) => {
          const placed = new Set(archetypeHomeTiles(state, arch).map((t) => t.id));
          const homes = (arch.landscapes || []).map((id, i) => `
            <span class="ac-home${placed.has(id) ? " is-placed" : ""}" title="${placed.has(id) ? "In play" : "Not in play"}">${placed.has(id) ? "✓" : "○"} ${esc(archetypeHomeNames(state, arch)[i])}</span>`).join("");
          const block = archetypeCallBlock(state, arch);
          return `
          <article class="lf-item ac-card suit-${esc(arch.suit)}${block ? " is-blocked" : ""}">
            <div class="lf-item-art ac-art" style="background-image:url('${esc(arch.image)}')"></div>
            <h4 class="lf-item-name">${esc(arch.name)}</h4>
            <p class="lf-item-kind">${esc(SUIT_NAME[arch.suit] || "")} · Power ${ARCHETYPE_POWER}</p>
            <div class="ac-homes">${homes}</div>
            <p class="lf-item-text"><b>${arch.passive ? "Passive" : "Power · 1⚡"}:</b> ${esc(arch.passive || arch.power || "")}</p>
            <div class="lf-item-foot">
              <button type="button" class="lf-btn lf-continue" data-arch="${esc(arch.id)}"${block ? ` disabled aria-disabled="true" title="${esc(block)}"` : ""}>${block ? esc(block) : "Call"}</button>
            </div>
          </article>`;
        }).join("")}
      </div>
      <p class="ac-foot">Event, then a Form vs Power ${ARCHETYPE_POWER}. Win: +1 Archetype, +${ARCHETYPE_TOKEN_REWARD}⚡, its power.</p>
    </section>`;
  host.querySelectorAll("[data-arch]").forEach((el) => el.addEventListener("click", () => {
    if (el.disabled) return;
    onChoose?.(el.dataset.arch);
  }));
  host.querySelector("[data-ac-search]")?.addEventListener("click", () => onSearch?.());
}

function searchBanner(state) {
  if (!archetypeSearchNeeded(state)) return "";
  const found = firstMissingHome(state);
  if (!found) {
    return `<p class="ac-search">No homes left for these Archetypes.</p>`;
  }
  const name = archetypeHomeNames(state, found.arch)[(found.arch.landscapes || []).indexOf(found.landscapeId)] || "its home";
  return `<div class="ac-search" role="note">
      <p><b>No home revealed.</b> Repress your lowest Psyche to place <b>${esc(name)}</b> (${esc(found.arch.name)}'s home) on a random hex.</p>
      <button type="button" class="lf-btn lf-continue" data-ac-search>Repress 1 · Search</button>
    </div>`;
}
