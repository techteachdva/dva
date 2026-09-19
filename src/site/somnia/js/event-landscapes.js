/**
 * Mindstream Event landscape icons:
 * - Each Event lists Landscape icon(s).
 * - The Event only resolves if ANY listed Landscape is Revealed (not Wasteland).
 * - Top and bottom effects both require that gate.
 * - If none of the listed Landscapes are Revealed, the Event is wasted and discarded.
 * - "Affected Landscape" counts and riders use only matching Revealed tiles.
 */

import { narrate, logMoment } from "./narrator.js";
import { allDreamersDiscardPsyche } from "./psyche-pressure.js";

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
    allDreamersDiscardPsyche(state, 2);
    logMoment(
      state,
      `${event.name} fizzles — the Dreamscape is hidden. Each Dreamer discards 2 Psyche.`,
      { forget: true },
    );
    narrate(
      state,
      `${event.name} cannot resolve`,
      `None of this Event's Landscapes are Revealed (${formatNameList(info.needed)}). The Event is wasted: every Dreamer discards 2 Psyche, then the card goes to the ${info.discardPile}.`,
      ["Each Dreamer discards 2 Psyche", `Discarded unused to the ${info.discardPile}`],
    );
    return false;
  }

  if (info.activeNames.length) {
    narrate(
      state,
      `${event.name} fires`,
      `${formatNameList(info.activeNames)} ${info.activeNames.length === 1 ? "is" : "are"} Revealed, so this Event resolves. After it resolves it is discarded to the ${info.discardPile}.`,
      [event.effectTop, event.effectBottom].filter(Boolean),
    );
  }
  return true;
}

export function eventDisplayText(event) {
  if (!event) return "";
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
