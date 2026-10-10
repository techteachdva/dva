/**
 * Mindstream Event landscape icons:
 * - Each Event names one or two Landscapes.
 * - Bright is available when any of those Landscapes is Revealed.
 * - If every named Landscape is still a Wasteland, Bright is greyed out. Dim stays available.
 * - Bright pays more when more of the outer map is awake.
 * - "Affected Landscape" counts use only the named tiles that are Revealed.
 */

import { narrate, logMoment } from "../core/narrator.js";
import { getEventResolution } from "../effects/event-resolutions.js";

export function eventLandscapeIds(event) {
  if (!event) return [];
  if (Array.isArray(event.landscapes) && event.landscapes.length) return event.landscapes;
  return [];
}

function titleCaseId(id) {
  return String(id || "").replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function suitLabel(suit) {
  if (!suit) return "Mindstream";
  return titleCaseId(suit);
}

export function eventLandscapeNames(state, event) {
  const board = state?.board || [];
  return eventLandscapeIds(event).map((id) => {
    const tile = board.find((t) => t.id === id);
    return tile?.name || titleCaseId(id);
  });
}

export function formatNameList(names = []) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Revealed, active tiles on the board that match this event's landscape icons. */
export function getAffectedLandscapeTiles(state, event) {
  const ids = new Set(eventLandscapeIds(event));
  if (!ids.size) return [];
  return (state?.board || []).filter(
    (t) => t.revealed && !t.wasteland && !t.center && ids.has(t.id),
  );
}

export function countAffectedLandscapes(state, event) {
  return getAffectedLandscapeTiles(state, event).length;
}

export function hasAffectedLandscapes(state, event) {
  return countAffectedLandscapes(state, event) > 0;
}

export function outerLandscapeStats(state) {
  const outer = (state?.board || []).filter((t) => !t.center && t.id !== "bed");
  const awake = outer.filter((t) => t.revealed && !t.wasteland).length;
  return { awake, total: outer.length };
}

/** Shrink a Bright count when most of the map is still Wasteland. A full map pays the printed amount. */
export function scaleEventCount(base, state) {
  const n = Number(base) || 0;
  if (n <= 0) return n;
  const { awake, total } = outerLandscapeStats(state);
  if (!total || awake >= total) return n;
  return Math.max(1, Math.round(n * (awake / total)));
}

export function eventRewardSentence(state, baseCount) {
  const { awake, total } = outerLandscapeStats(state);
  if (!total) return "";
  if (awake >= total) return "The whole map is awake, so Bright pays in full.";
  const base = Number(baseCount) || 0;
  if (base > 0) {
    const scaled = scaleEventCount(base, state);
    if (scaled === base) return `${awake} of ${total} Landscapes are awake. Bright pays in full.`;
    return `${awake} of ${total} Landscapes are awake, so Bright pays ${scaled} instead of ${base}.`;
  }
  return `${awake} of ${total} Landscapes are awake, so Bright pays less than on a fully revealed map.`;
}

/** Plain sentence for why Bright is open or greyed out. */
export function eventGateSentence(state, event) {
  const ids = eventLandscapeIds(event);
  const names = eventLandscapeNames(state, event);
  if (!ids.length) return "Bright is open. This Event is not tied to a Landscape.";
  const revealed = revealedLandscapeIds(state?.board || []);
  const open = [];
  const closed = [];
  ids.forEach((id, index) => {
    if (revealed.has(id)) open.push(names[index]);
    else closed.push(names[index]);
  });
  if (open.length && !closed.length) {
    const verb = open.length === 1 ? "is" : "are";
    return `Bright is open because ${formatNameList(open)} ${verb} revealed.`;
  }
  if (!open.length) {
    const waste = closed.length === 1
      ? `${closed[0]} is still a Wasteland`
      : `${formatNameList(closed)} are still Wasteland`;
    const which = closed.length === 1 ? "it" : "one of them";
    return `Bright is greyed out because ${waste}. Reveal ${which} to open Bright.`;
  }
  const openVerb = open.length === 1 ? "is" : "are";
  const closedVerb = closed.length === 1 ? "is still a Wasteland" : "are still Wasteland";
  return `Bright is open because ${formatNameList(open)} ${openVerb} revealed. ${formatNameList(closed)} ${closedVerb}.`;
}

/** True when every listed Landscape icon is currently Revealed on the board. */
export function allListedLandscapesRevealed(state, event) {
  const ids = eventLandscapeIds(event);
  if (!ids.length) return false;
  const active = new Set(getAffectedLandscapeIds(state, event));
  return ids.every((id) => active.has(id));
}

export function getAffectedLandscapeIds(state, event) {
  return getAffectedLandscapeTiles(state, event).map((t) => t.id);
}

/** Events with listed icons only fire when at least one of those tiles is Revealed. */
export function eventCanResolve(state, event) {
  if (!eventLandscapeIds(event).length) return true;
  return hasAffectedLandscapes(state, event);
}

export function eventDiscardPileLabel(event) {
  return `${suitLabel(event?.suit || event?.mindstreamSuit)} Mindstream discard pile`;
}

export function describeEventResolution(state, event) {
  const needed = eventLandscapeNames(state, event);
  const tiles = getAffectedLandscapeTiles(state, event);
  const activeNames = tiles.map((t) => t.name);
  const wasted = Boolean(needed.length && !tiles.length);
  return {
    needed,
    activeNames,
    wasted,
    canResolve: !wasted,
    discardPile: eventDiscardPileLabel(event),
  };
}

/** Dreamers standing on a Revealed Affected Landscape. */
export function dreamersOnAffectedLandscapes(state, event, { aliveOnly = true } = {}) {
  const ids = new Set(getAffectedLandscapeIds(state, event));
  if (!ids.size) return [];
  const pool = aliveOnly ? state.players.filter((p) => p.alive) : state.players;
  return pool.filter((p) => ids.has(p.landscapeId));
}

export function logAffectedStatus(state, event, label = "Event") {
  const info = describeEventResolution(state, event);
  if (!info.needed.length) return;
  if (info.wasted) {
    state.log.push(`${label}: none of ${formatNameList(info.needed)} ${info.needed.length === 1 ? "is" : "are"} Revealed. Event discarded unused.`);
    return;
  }
  state.log.push(`${label}: listed Landscapes Revealed: ${formatNameList(info.activeNames)}.`);
}

/**
 * Gate Event resolution. Returns false when the Event is wasted and discarded unused.
 * Callers still place the card in its Mindstream discard pile.
 */
export function beginEventOrWaste(state, event) {
  if (!event) return false;
  const info = describeEventResolution(state, event);
  event.eventWasted = info.wasted;
  state.pendingEventModal = event;
  state.lastEventResolution = {
    id: event.id,
    name: event.name,
    wasted: info.wasted,
    needed: info.needed,
    activeNames: info.activeNames,
    discardPile: info.discardPile,
  };

  if (info.wasted) {
    const sentence = eventGateSentence(state, event);
    logMoment(state, `${event.name}: ${sentence}`, { forget: true });
    narrate(state, `${event.name}: Bright is closed`, sentence, ["Dim is still available"]);
    return false;
  }

  if (info.activeNames.length) {
    narrate(
      state,
      `${event.name} fires`,
      `${formatNameList(info.activeNames)} ${info.activeNames.length === 1 ? "is" : "are"} Revealed, so this Event resolves. After it resolves it is discarded to the ${info.discardPile}.`,
      [eventDisplayText(event)].filter(Boolean),
    );
  }
  return true;
}

export function eventDisplayText(event) {
  if (!event) return "";
  const resolution = getEventResolution(event.refId || event.id);
  if (resolution?.good?.hint || resolution?.bad?.hint) {
    const lines = [];
    if (resolution.good?.hint) lines.push(`Bright: ${resolution.good.hint}.`);
    if (resolution.bad?.hint) lines.push(`Dim: ${resolution.bad.hint}.`);
    return lines.join(" ");
  }
  const parts = [event.effectTop, event.effectBottom].filter(Boolean);
  if (parts.length) return parts.join("\n\n");
  return event.text || "";
}

export function landscapeImageForId(id, board = []) {
  const tile = board.find((t) => t.id === id);
  return tile?.image || `images/landscapes/${id}.webp`;
}

export function revealedLandscapeIds(board = []) {
  return new Set(
    board.filter((t) => t.revealed && !t.wasteland && !t.center).map((t) => t.id),
  );
}
