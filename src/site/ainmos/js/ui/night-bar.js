/**
 * Ainmos Night Strip: the whole Dream Deck as a progress bar across the very
 * top of the screen.
 *
 * Every card of the night sits left to right, grouped by Ante. Each Dream has
 * a tick; below it, one pip for every Dreambeast that arrived during that
 * Dream's round (coloured by suit). Ordinary Dreams are face down until drawn,
 * then show their art. Boss Dreams are face up from the start so the table can
 * plan for them: dim while ahead, pulsing while standing, starlit once beaten.
 */

import { ladderEntry, antesForLength } from "../encounters/boss-ladder.js";

let lastKey = "";

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function bossStanding(state, bossId) {
  return (state.board || []).some((tile) => (tile.encounters || (tile.encounter ? [tile.encounter] : []))
    .some((enc) => enc && (enc.id === bossId || enc.refId === bossId)));
}

/** Absolute URL: a url() inside a CSS variable resolves against the stylesheet, not the page. */
function absolute(src) {
  return src ? new URL(src, document.baseURI).href : "";
}

function drawnArt(state, plan) {
  const found = (state.dreamDiscard || []).find((c) => c.instanceId === plan.instanceId)
    || (state.activeDream?.instanceId === plan.instanceId ? state.activeDream : null);
  return absolute(found?.image || plan.image || "");
}

function spawnPips(spawns) {
  if (!spawns?.length) return "";
  const shown = spawns.slice(0, 6).map((s) => `<i class="night-pip suit-${escapeHtml(s.suit || "none")}${s.boss ? " is-boss" : ""}"></i>`).join("");
  const more = spawns.length > 6 ? `<b class="night-pip-more">+${spawns.length - 6}</b>` : "";
  return `<span class="night-pips" aria-hidden="true">${shown}${more}</span>`;
}

function spawnLabel(spawns) {
  if (!spawns?.length) return "";
  return ` Dreambeasts that round: ${spawns.map((s) => s.name).join(", ")}.`;
}

export function currentAnte(state) {
  const plan = state.nightPlan || [];
  const drawn = plan.length - (state.dreamDeck?.length || 0);
  const cleared = (state.bossesDefeated || []).length;
  return Math.min(antesForLength(state.lengthKey), Math.max(1, Math.ceil(drawn / 3) || 1, cleared + 1));
}

export function renderNightBar(state) {
  const host = document.getElementById("night-strip");
  if (!host || !state) return;
  const plan = state.nightPlan || [];
  if (!plan.length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const inDeck = new Set((state.dreamDeck || []).map((c) => c.instanceId));
  const defeated = new Set(state.bossesDefeated || []);
  const nextIndex = plan.findIndex((p) => inDeck.has(p.instanceId));
  const spawnsBy = state.nightSpawns || {};

  const cells = plan.map((p, index) => {
    const drawn = !inDeck.has(p.instanceId);
    const isNext = index === nextIndex;
    const spawns = spawnsBy[p.instanceId];
    if (p.boss) {
      const entry = ladderEntry(p.bossId);
      const status = defeated.has(p.bossId)
        ? "defeated"
        : drawn && bossStanding(state, p.bossId)
          ? "standing"
          : drawn
            ? "passed"
            : "ahead";
      const power = entry?.stack ? entry.stack.join(", then ") : entry?.power;
      const label = `Ante ${p.ante} Boss: ${p.name}${entry ? `, Power ${power}. ${entry.twist}: ${entry.twistText}` : ""}${status === "defeated" ? " Defeated." : status === "standing" ? " Standing on the Dreamscape." : ""}${spawnLabel(spawns)}`;
      return `<span class="night-card night-boss is-${status} suit-${p.suit || "none"}${isNext ? " is-next" : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        <span class="night-face" style="--night-art:url('${escapeHtml(absolute(p.image))}')"></span>
        <span class="night-boss-rung">${entry?.rung ?? ""}</span>
        <span class="night-tick" aria-hidden="true"></span>
        ${spawnPips(spawns)}
      </span>`;
    }
    const art = drawn ? drawnArt(state, p) : "";
    const label = `${drawn ? `Dream ${index + 1}: ${p.name || "drawn"}.` : `Dream ${index + 1}: still asleep.`}${spawnLabel(spawns)}`;
    return `<span class="night-card night-dream${drawn ? " is-drawn" : ""}${isNext ? " is-next" : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="night-face"${art ? ` style="--night-art:url('${escapeHtml(art)}')"` : ""}></span>
      <span class="night-tick" aria-hidden="true"></span>
      ${spawnPips(spawns)}
    </span>`;
  });

  const ante = currentAnte(state);
  const groups = [];
  for (let i = 0; i < cells.length; i += 3) {
    const n = Math.floor(i / 3) + 1;
    const when = n < ante ? "past" : n === ante ? "now" : "ahead";
    groups.push(`<span class="night-ante is-${when}" data-ante="${n}">
      <span class="night-ante-label">Ante ${n}</span>
      <span class="night-ante-cards">${cells.slice(i, i + 3).join("")}</span>
    </span>`);
  }

  const left = state.dreamDeck?.length || 0;
  const antes = antesForLength(state.lengthKey);
  const anteEl = document.getElementById("hud-ante");
  if (anteEl) anteEl.textContent = `${ante}/${antes}`;

  const key = `${groups.join("")}|${nextIndex}|${left}`;
  if (key === lastKey) return;
  lastKey = key;
  host.setAttribute("aria-label", `The night: Ante ${ante} of ${antes}, ${left} of ${plan.length} Dreams left`);
  host.innerHTML = `
    <div class="night-track">${groups.join("")}</div>
    <span class="night-left" title="Dreams left in the night"><b>${left}</b><small>left</small></span>`;
}
