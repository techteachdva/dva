/**
 * Ainmos Night Strip: the whole Dream Deck as a progress bar across the very
 * top of the screen.
 *
 * Every card of the night sits left to right, grouped by Cycle: Dream 1,
 * Dream 2 (it brings the Cycle's Mini-Boss to The Bed), then Dream 3, the Boss. Each
 * card has a tick; below it, one pip for every Dreambeast that arrived during
 * that round (coloured by suit). Ordinary Dreams are face down until drawn.
 * Mini-Bosses and Bosses are face up from the start so you can plan for them.
 * When the deck runs dry, the counter turns into the Long Night's toll.
 */

import { megaLeviathan, endlessStatusText } from "../encounters/endless.js";
import { longNightToll } from "../core/state.js";
import { cyclePosition, cyclePositionText, PHASE_SUITS, PHASE_NAMES, DREAMS_PER_CYCLE } from "../core/cycle.js";
import { suitIconHtml } from "../core/rules.js";

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

function drawnCard(state, plan) {
  return (state.dreamDiscard || []).find((c) => c.instanceId === plan.instanceId)
    || (state.activeDream?.instanceId === plan.instanceId ? state.activeDream : null);
}

function drawnArt(state, plan) {
  const found = drawnCard(state, plan);
  return absolute(found?.chosen?.image || found?.image || plan.image || "");
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

/** The Cycle the night is in, by the Dream Deck (a standing Boss does not hold the clock back). */
export function currentAnte(state) {
  return cyclePosition(state).cycle;
}

/**
 * The HUD Cycle tracker: "Cycle 2 of 4", then the Cycle's nine phases as three
 * Dreams of Reveal · Explore · Meet, the current one lit, the last one the Boss.
 */
function renderCycleTracker(state) {
  const host = document.getElementById("hud-cycle");
  if (!host) return;
  const pos = cyclePosition(state);
  const text = cyclePositionText(state);
  host.title = text;
  host.setAttribute("aria-label", text);
  if (pos.longNight) {
    host.classList.add("is-long-night");
    host.innerHTML = `<span class="cycle-label">Long Night</span>`;
    return;
  }
  host.classList.remove("is-long-night");
  const dreams = [];
  for (let d = 1; d <= DREAMS_PER_CYCLE; d += 1) {
    const pips = PHASE_SUITS.map((suit, i) => {
      const step = (d - 1) * 3 + i + 1;
      const when = step < pos.step ? "past" : step === pos.step ? "now" : "ahead";
      return `<span class="cycle-pip is-${when}" title="Dream ${d} · ${PHASE_NAMES[i]}">${suitIconHtml(suit, { className: "cycle-pip-icon", size: 10 })}</span>`;
    }).join("");
    const tag = d === 2 ? "Dreambeast" : d === DREAMS_PER_CYCLE ? (pos.endless && !(state.archetypeDeck || []).length ? "Leviathan" : "Archetype") : "Dream";
    dreams.push(`<span class="cycle-dream${d === pos.dream ? " is-now" : ""}" title="Dream ${d} of 3${tag ? ` · ${tag}` : ""}"><span class="cycle-dream-num">${d}</span>${pips}</span>`);
  }
  host.innerHTML = `
    <span class="cycle-label">${pos.endless ? `Endless · Cycle <b>${pos.cycle}</b>` : `Cycle <b>${pos.cycle}</b> of ${pos.cycles}`}</span>
    <span class="cycle-dreams">${dreams.join("")}</span>
    <span class="cycle-step">${pos.step}/9</span>`;
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
    if (p.kind === "archetype") {
      const card = drawn ? drawnCard(state, p) : null;
      const chosen = card?.chosen;
      const label = `Cycle ${p.ante}, Dream 3 · An Archetype: ${chosen ? `${chosen.name} answered.` : "choose 1 of 3."}`;
      return `<span class="night-card night-arch${chosen ? " is-drawn" : ""}${isNext ? " is-next" : ""}${chosen ? ` suit-${escapeHtml(chosen.suit || "none")}` : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        <span class="night-face"${chosen ? ` style="--night-art:url('${escapeHtml(absolute(chosen.image))}')"` : ""}></span>
        ${chosen ? "" : `<span class="night-arch-glyph" aria-hidden="true">★</span>`}
        <span class="night-tick" aria-hidden="true"></span>
      </span>`;
    }
    if (p.boss) {
      const entry = ladderEntry(p.bossId);
      const status = defeated.has(p.bossId)
        ? "defeated"
        : drawn && bossStanding(state, p.bossId)
          ? "standing"
          : drawn
            ? "passed"
            : "ahead";
      const mega = p.mega ? megaLeviathan(p.mega) : null;
      const power = mega ? mega.power : entry?.stack ? entry.stack.join(", then ") : entry?.power;
      const label = `Cycle ${p.ante}, Dream ${mega ? 3 : 2} · ${mega ? "Leviathan" : "Dreambeast"}: ${p.name}${mega ? `, Power ${power}. ${mega.flavor}` : entry ? `, Power ${power} + the Cycle. ${entry.twist}: ${entry.twistText}` : ""}${status === "defeated" ? " Defeated." : status === "standing" ? " Standing on the Dreamscape." : ""}${spawnLabel(spawns)}`;
      return `<span class="night-card night-boss is-${status} suit-${p.suit || "none"}${isNext ? " is-next" : ""}${mega ? ` is-mega mega-${mega.tier}` : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        <span class="night-face" style="--night-art:url('${escapeHtml(absolute(p.image))}')"></span>
        <span class="night-boss-rung">${mega ? `∞${mega.tier}` : (entry?.rung ?? "")}</span>
        <span class="night-tick" aria-hidden="true"></span>
        ${spawnPips(spawns)}
      </span>`;
    }
    const art = drawn ? drawnArt(state, p) : "";
    const miniNote = p.mini ? ` Mini-Boss: ${p.mini.name}, Power ${p.mini.power}, rises on The Bed.` : "";
    const where = `Cycle ${Math.floor(index / 3) + 1}, Dream ${(index % 3) + 1}`;
    const label = `${where}: ${drawn ? `${p.name || "drawn"}.` : "still asleep."}${miniNote}${spawnLabel(spawns)}`;
    const miniBadge = p.mini
      ? `<span class="night-mini suit-${escapeHtml(p.mini.suit || "none")}" style="--night-art:url('${escapeHtml(absolute(p.mini.image))}')"><b>${p.mini.power}</b></span>`
      : "";
    return `<span class="night-card night-dream${drawn ? " is-drawn" : ""}${isNext ? " is-next" : ""}${p.mini ? " has-mini" : ""}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="night-face"${art ? ` style="--night-art:url('${escapeHtml(art)}')"` : ""}></span>
      ${miniBadge}
      <span class="night-tick" aria-hidden="true"></span>
      ${spawnPips(spawns)}
    </span>`;
  });

  const ante = currentAnte(state);
  const groups = [];
  // Endless Mode: the plan keeps growing, so the strip shows the last Cycle and what lies ahead.
  const firstShown = state.endless ? Math.max(0, (ante - 2) * 3) : 0;
  for (let i = firstShown; i < cells.length; i += 3) {
    const n = Math.floor(i / 3) + 1;
    const when = n < ante ? "past" : n === ante ? "now" : "ahead";
    groups.push(`<span class="night-ante is-${when}" data-ante="${n}">
      <span class="night-ante-label">Cycle ${n}</span>
      <span class="night-ante-cards">${cells.slice(i, i + 3).join("")}</span>
    </span>`);
  }

  const left = state.dreamDeck?.length || 0;
  const antes = antesForLength(state.lengthKey);
  renderCycleTracker(state);

  const toll = longNightToll(state);
  const key = `${groups.join("")}|${nextIndex}|${left}|${toll}|${state.endless ? endlessStatusText(state) : ""}`;
  if (key === lastKey) return;
  lastKey = key;
  host.classList.toggle("is-long-night", !!state.longNight);
  host.setAttribute("aria-label", state.longNight
    ? `The Long Night: dusk Represses ${toll} more from the Waking Mind`
    : state.endless
      ? `Endless Mode: Cycle ${ante}. ${endlessStatusText(state)}`
      : `The night: Cycle ${ante} of ${antes}, ${left} of ${plan.length} Dreams left`);
  const counter = state.longNight
    ? `<span class="night-left night-long" title="The Long Night: the Dream Deck is empty. Each dusk Represses this many more from the Waking Mind, and it grows."><b>−${toll}</b><small>Long Night</small></span>`
    : state.endless
      ? `<span class="night-left night-endless" title="${escapeHtml(endlessStatusText(state))}"><b>∞</b><small>Endless</small></span>`
      : `<span class="night-left" title="Dreams left in the night"><b>${left}</b><small>left</small></span>`;
  host.innerHTML = `
    <div class="night-track">${groups.join("")}</div>
    ${counter}`;
}
