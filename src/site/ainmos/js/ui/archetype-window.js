/**
 * The Archetypes window: a floating, movable, minimizable glass window on the
 * table that tracks the night's one goal. It shows how many Archetypes you
 * have, every Archetype standing on the Dreamscape (where, how far, and what
 * to do next), and which ones the next Archetype Dream will offer.
 * Tap an Archetype to fly the camera to it.
 */

import { endlessStatusText } from "../encounters/endless.js";
import { boardArchetypes, fightRules, ARCHETYPE_POWER } from "../dreamers/archetype-board.js";
import { landscapeById, getPhase } from "../core/state.js";
import { hexDistance } from "../core/hex.js";
import { focusOnLandscape } from "../board/board-zoom.js";
import { initFloatWindow, restoreFloatWindow } from "./float-window.js";

const KEY = "archetypes";
let lastKey = "";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function statusFor(state, arch, tile, me) {
  const fight = state.archetypeFight?.archId === arch.id ? state.archetypeFight : null;
  if (fight) {
    const rules = fightRules(state);
    return { cls: "is-fight", text: `${fight.side === "bright" ? "Bright" : fight.side === "dim" ? "Dim" : "Ready"} · fight Power ${rules.power}` };
  }
  if (!me) return { cls: "", text: "" };
  const here = landscapeById(state, me.landscapeId);
  const d = here ? hexDistance(here, tile) : null;
  if (d === 0) {
    return getPhase(state) === "Meet"
      ? { cls: "is-here", text: "Here · Meet it" }
      : { cls: "is-here", text: "Here · Meet it in Meet" };
  }
  return { cls: "", text: d == null ? "" : `${d} step${d === 1 ? "" : "s"} away` };
}

export function renderArchetypeWindow(state, { onFocus } = {}) {
  const host = document.getElementById("archetype-window");
  if (!host) return;
  if (!state || state.status !== "playing" || state.tutorialMode) {
    host.hidden = true;
    lastKey = "";
    return;
  }
  initFloatWindow(host, KEY);
  host.hidden = false;
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  const have = state.acquiredPoints || 0;
  const me = (state.players || []).find((p) => p.alive) || null;
  const standing = boardArchetypes(state);
  const acquired = (state.players || []).flatMap((p) => p.acquiredArchetypes || []);
  const next = (state.archetypeDeck || []).slice(0, 3);
  const key = JSON.stringify([
    goal, have, me?.landscapeId, getPhase(state), state.archetypeFight,
    standing.map(({ tile, arch }) => `${arch.id}@${tile.id}`),
    acquired.map((a) => a.id), next.map((a) => a.id),
  ]);
  if (key === lastKey) return;
  lastKey = key;

  const pips = Array.from({ length: goal }, (_, i) => {
    const got = acquired[i];
    return got
      ? `<span class="aw-pip is-got" title="${esc(got.name)}" style="background-image:url('${esc(got.image)}')"></span>`
      : `<span class="aw-pip" aria-hidden="true"></span>`;
  }).join("");

  const rows = standing.length
    ? standing.map(({ tile, arch }) => {
      const status = statusFor(state, arch, tile, me);
      return `
        <button type="button" class="aw-row suit-${esc(arch.suit)} ${status.cls}" data-aw-tile="${esc(tile.id)}" title="Show ${esc(arch.name)} on the Dreamscape">
          <span class="aw-face" style="background-image:url('${esc(arch.image)}')"></span>
          <span class="aw-main">
            <span class="aw-name">${esc(arch.name)}</span>
            <span class="aw-where">on ${esc(tile.name)}</span>
          </span>
          <span class="aw-status">${esc(status.text)}</span>
        </button>`;
    }).join("")
    : `<p class="aw-empty">None yet. Dream 3 of each Cycle calls one.</p>`;

  host.innerHTML = `
    <div class="aw-window" role="region" aria-label="Archetypes">
      <div class="aw-titlebar" data-float-handle>
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="aw-title">Archetypes</span>
        <span class="aw-count" title="Acquired / needed to wake"><b>${have}</b>/${goal}</span>
        <button type="button" class="aw-min" data-float-min aria-label="Minimize Archetypes">–</button>
      </div>
      <div class="aw-body">
        <div class="aw-pips" aria-label="${have} of ${goal} Acquired">${pips}</div>
        <div class="aw-list">${rows}</div>
        <p class="aw-rule">Meet it: an Event, then a Form vs Power ${ARCHETYPE_POWER}.</p>
        ${next.length ? `<p class="aw-next"><span>Next:</span> ${next.map((a) => esc(a.name)).join(" · ")}</p>` : ""}
      </div>
    </div>`;
  restoreFloatWindow(host, KEY);
  host.querySelectorAll("[data-aw-tile]").forEach((el) => el.addEventListener("click", () => {
    const tileId = el.dataset.awTile;
    focusOnLandscape(tileId, { zoom: 1.6 });
    onFocus?.(tileId);
  }));
}

/** The left rail's Wake block: the count, with a portrait per Archetype Acquired. */
export function renderWakeGoal(state) {
  const host = document.getElementById("wake-goal");
  if (!host || !state) return;
  const goal = state.scoringGoalPoints || state.goalPoints || 0;
  const acquired = (state.players || []).flatMap((p) => p.acquiredArchetypes || []);
  const endless = !!state.endless;
  const line = endless ? endlessStatusText(state) : "";
  const key = `${goal}|${acquired.map((a) => a.id).join(",")}|${state.longNight ? 1 : 0}|${line}`;
  if (host.dataset.key === key) return;
  host.dataset.key = key;
  // Endless Mode: every Archetype of the deck is a slot to fill.
  const total = endless ? Math.max(goal, acquired.length, (state.boonCatalog || []).length || 12) : goal;
  const slots = Array.from({ length: total }, (_, i) => {
    const got = acquired[i];
    return got
      ? `<span class="wake-slot is-got" title="${esc(got.name)}" style="background-image:url('${esc(got.image)}')"></span>`
      : `<span class="wake-slot" aria-hidden="true">★</span>`;
  }).join("");
  host.innerHTML = `
    <p class="wake-count"><b>${acquired.length}</b><span>of ${total} Archetypes${endless ? " · Endless" : ""}</span></p>
    <div class="wake-slots">${slots}</div>
    ${endless || state.longNight ? `<p class="wake-line">${endless ? esc(line) : "Long Night: each dusk takes more."}</p>` : ""}`;
}
