/**
 * Ainmos Night Bar: the Dream Deck as a progress bar across the top of the table.
 *
 * Every card of the night sits left to right, grouped by Ante. Ordinary Dreams
 * are face down until drawn, then show their art. Boss Dreams are face up from
 * the start so the table can plan for them: dim while ahead, pulsing while
 * standing on the board, and starlit once defeated.
 */

import { ladderEntry } from "../encounters/boss-ladder.js";

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

function drawnArt(state, plan) {
  const found = (state.dreamDiscard || []).find((c) => c.instanceId === plan.instanceId)
    || (state.activeDream?.instanceId === plan.instanceId ? state.activeDream : null);
  return found?.image || plan.image || "";
}

export function renderNightBar(state) {
  const host = document.getElementById("hud-night-bar");
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

  const cells = plan.map((p, index) => {
    const drawn = !inDeck.has(p.instanceId);
    const isNext = index === nextIndex;
    if (p.boss) {
      const entry = ladderEntry(p.bossId);
      const state_ = defeated.has(p.bossId)
        ? "defeated"
        : drawn && bossStanding(state, p.bossId)
          ? "standing"
          : drawn
            ? "passed"
            : "ahead";
      const power = entry?.stack ? entry.stack.join(", then ") : entry?.power;
      const label = `Ante ${p.ante} Boss: ${p.name}${entry ? `, Power ${power}. ${entry.twist}: ${entry.twistText}` : ""}${state_ === "defeated" ? " Defeated." : state_ === "standing" ? " Standing on the Dreamscape." : ""}`;
      return `<span class="night-card night-boss is-${state_} suit-${p.suit || "none"}${isNext ? " is-next" : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        <span class="night-boss-face" style="background-image:url('${escapeHtml(p.image)}')"></span>
        <span class="night-boss-rung">${entry?.rung ?? ""}</span>
      </span>`;
    }
    const art = drawn ? drawnArt(state, p) : "";
    const label = drawn ? `Dream ${index + 1}: ${p.name || "drawn"}` : `Dream ${index + 1}: still asleep`;
    return `<span class="night-card night-dream${drawn ? " is-drawn" : ""}${isNext ? " is-next" : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"${art ? ` style="--night-art:url('${escapeHtml(art)}')"` : ""}></span>`;
  });

  // Group into Antes of three.
  const groups = [];
  for (let i = 0; i < cells.length; i += 3) {
    const ante = Math.floor(i / 3) + 1;
    groups.push(`<span class="night-ante" data-ante="${ante}">${cells.slice(i, i + 3).join("")}</span>`);
  }

  const key = `${groups.join("")}|${nextIndex}`;
  if (key === lastKey) return;
  lastKey = key;
  const left = state.dreamDeck?.length || 0;
  host.setAttribute("aria-label", `The night: ${left} of ${plan.length} Dreams left`);
  host.innerHTML = groups.join("");
}
