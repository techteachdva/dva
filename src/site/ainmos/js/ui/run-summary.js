/**
 * Ainmos run summary: the end screen tells the story of the night.
 * Which Cycle you reached, every Boss on the ladder, your best spread,
 * the Form you leaned on, and the numbers behind the score.
 */

import { ladderForLength, ladderEntry, antesForLength } from "../encounters/boss-ladder.js";
import { formById, formLevel } from "../cards/dream-forms.js";
import { takenBoons } from "../dreamers/boons.js";

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

export function buildRunSummary(state) {
  const stats = state.runStats || {};
  const plan = state.nightPlan || [];
  const drawn = Math.max(0, plan.length - (state.dreamDeck?.length || 0));
  const antes = antesForLength(state.lengthKey);
  const cleared = (state.bossesDefeated || []).length;
  const ante = Math.min(antes, Math.max(1, Math.ceil(drawn / 3) || 1, cleared + (state.status === "won" ? 0 : 1)));
  const defeated = new Set(state.bossesDefeated || []);
  const standing = new Set();
  (state.board || []).forEach((tile) => (tile.encounters || []).forEach((enc) => {
    if (enc?.boss) standing.add(enc.refId || enc.id);
  }));
  const seen = new Set(plan.filter((p) => p.boss && !(state.dreamDeck || []).some((c) => c.instanceId === p.instanceId)).map((p) => p.bossId));
  const ladder = ladderForLength(state.lengthKey).map((entry) => {
    const card = plan.find((p) => p.bossId === entry.id);
    return {
      id: entry.id,
      rung: entry.rung,
      name: card?.name || entry.id,
      image: card?.image || "",
      status: defeated.has(entry.id) ? "defeated" : standing.has(entry.id) ? "standing" : seen.has(entry.id) ? "passed" : "unseen",
    };
  });

  const formsPlayed = stats.formsPlayed || {};
  const favorite = Object.entries(formsPlayed).sort((a, b) => b[1] - a[1])[0];

  return {
    won: state.status === "won",
    gaveUp: !!state.gaveUp,
    ante,
    antes,
    round: state.round,
    ladder,
    bestSpread: stats.bestSpread || null,
    favoriteForm: favorite ? { name: formById(favorite[0])?.name, count: favorite[1], level: formLevel(state, favorite[0]) } : null,
    archetypes: state.players.flatMap((p) => (p.acquiredArchetypes || []).map((a) => ({ name: a.name, points: a.points, image: a.image }))),
    boons: takenBoons(state).map((b) => b.name),
    grid: [
      ["Fights won", stats.fightsWon || 0],
      ["Fights lost", stats.fightsLost || 0],
      ["Landscapes placed", stats.landscapesPlaced || 0],
      ["Dreamscape resets", state.dreamscapeResets || 0],
      ["Objects found", stats.objectsBought || 0],
      ["Looked again", stats.rerolls || 0],
      ["Psyche spent shopping", stats.psycheSpentShopping || 0],
      ["Deaths", state.deathClock || 0],
    ],
  };
}

function cardChip(card) {
  const value = card.wild ? 5 : card.value;
  return `<span class="rs-card suit-${esc(card.suit || "wild")}${card.upgrade ? " has-upgrade" : ""}" title="${esc(card.name)}${card.upgrade ? ` (${esc(card.upgrade)})` : ""}">
    <b>${esc(value)}</b><small>${esc(SUIT_NAME[card.suit] || "Wild")}</small>
  </span>`;
}

export function runSummaryHtml(summary, breakdown) {
  const headline = summary.won
    ? `Woke after Cycle ${summary.ante} of ${summary.antes}`
    : summary.gaveUp
      ? `Let go in Cycle ${summary.ante} of ${summary.antes}`
      : `Lost in Cycle ${summary.ante} of ${summary.antes}`;
  const ladder = summary.ladder.map((boss) => `
    <li class="rs-boss is-${boss.status}" title="${esc(boss.name)}: ${esc(boss.status)}">
      <span class="rs-boss-face" style="background-image:url('${esc(boss.image)}')"></span>
      <span class="rs-boss-rung">${boss.rung}</span>
    </li>`).join("");
  const best = summary.bestSpread;
  const bestHtml = best
    ? `<div class="rs-best">
        <div class="rs-best-cards">${(best.cards || []).map(cardChip).join("")}</div>
        <p><strong>Power ${best.power}</strong>${best.form ? ` · ${esc(best.form)}` : ""} · ${esc(best.dreamer)} vs ${esc(best.vs)}${best.won ? "" : " (it held)"}</p>
      </div>`
    : `<p class="rs-muted">No spread was played.</p>`;
  const grid = summary.grid.map(([label, value]) => `<div class="rs-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("");
  const b = breakdown || {};
  return `
    <section class="run-summary">
      <p class="rs-headline">${esc(headline)}</p>
      <ol class="rs-ladder" aria-label="The Boss ladder">${ladder}</ol>
      <div class="rs-columns">
        <div class="rs-col">
          <h4>Best spread</h4>
          ${bestHtml}
          ${summary.favoriteForm ? `<h4>Favorite Form</h4><p>${esc(summary.favoriteForm.name)}, played ${summary.favoriteForm.count}× (level ${summary.favoriteForm.level})</p>` : ""}
          ${summary.boons.length ? `<h4>Boons</h4><p>${summary.boons.map(esc).join(" · ")}</p>` : ""}
          ${summary.archetypes.length ? `<h4>Archetypes</h4><p>${summary.archetypes.map((a) => `${esc(a.name)} (${a.points})`).join(" · ")}</p>` : ""}
        </div>
        <div class="rs-col">
          <div class="rs-grid">${grid}</div>
        </div>
      </div>
      <h3 class="rs-total">Score ${b.total ?? 0}</h3>
      <ul class="score-breakdown-list rs-breakdown">
        <li>Archetype points ×2 <strong>${b.archetypePoints ?? 0}</strong></li>
        <li>Bosses climbed <strong>${b.bossPoints ?? 0}</strong></li>
        <li>Best spread <strong>${b.bestSpread ?? 0}</strong></li>
        <li>Wake <strong>${b.escapeBonus ?? 0}</strong></li>
        <li>Objects, tokens, allies <strong>${(b.objects || 0) + (b.tokens || 0) + (b.allies || 0)}</strong></li>
      </ul>
    </section>`;
}

export function bossLadderLabel(id) {
  return ladderEntry(id)?.twist || "";
}
