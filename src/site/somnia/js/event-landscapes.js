/**
 * Mindstream Event landscape icons — PDF rules:
 * - Each Event shows Landscape icon(s) on the card.
 * - Top effect always resolves.
 * - Bottom / "Affected Landscape" effects resolve only when ANY listed Landscape is Revealed (not Wasteland).
 * - "Affected Landscape" counts and riders use only matching Revealed tiles.
 */

export function eventLandscapeIds(event) {
  if (!event) return [];
  if (Array.isArray(event.landscapes) && event.landscapes.length) return event.landscapes;
  return [];
}

/** Revealed, active tiles on the board that match this event's landscape icons. */
export function getAffectedLandscapeTiles(state, event) {
  const ids = new Set(eventLandscapeIds(event));
  if (!ids.size) return [];
  return state.board.filter(
    (t) => t.revealed && !t.wasteland && !t.center && ids.has(t.id),
  );
}

export function countAffectedLandscapes(state, event) {
  return getAffectedLandscapeTiles(state, event).length;
}

export function hasAffectedLandscapes(state, event) {
  return countAffectedLandscapes(state, event) > 0;
}

export function getAffectedLandscapeIds(state, event) {
  return getAffectedLandscapeTiles(state, event).map((t) => t.id);
}

/** Dreamers standing on a Revealed Affected Landscape. */
export function dreamersOnAffectedLandscapes(state, event, { aliveOnly = true } = {}) {
  const ids = new Set(getAffectedLandscapeIds(state, event));
  if (!ids.size) return [];
  const pool = aliveOnly ? state.players.filter((p) => p.alive) : state.players;
  return pool.filter((p) => ids.has(p.landscapeId));
}

export function logAffectedStatus(state, event, label = "Event") {
  const tiles = getAffectedLandscapeTiles(state, event);
  const ids = eventLandscapeIds(event);
  if (!ids.length) return;
  if (!tiles.length) {
    state.log.push(`${label}: no Affected Landscapes revealed (${ids.length} icon${ids.length === 1 ? "" : "s"} on card). Bottom effect skipped.`);
    return;
  }
  const names = tiles.map((t) => t.name).join(", ");
  state.log.push(`${label}: Affected Landscapes active — ${names}.`);
}

export function eventDisplayText(event) {
  if (!event) return "";
  if (event.effectTop && event.effectBottom) {
    return `${event.effectTop}\n\n— If any Affected Landscape is Revealed —\n${event.effectBottom}`;
  }
  return event.text || event.effectTop || event.effectBottom || "";
}

export function landscapeImageForId(id, board = []) {
  const tile = board.find((t) => t.id === id);
  return tile?.image || `images/landscapes/${id}.png`;
}

export function revealedLandscapeIds(board = []) {
  return new Set(
    board.filter((t) => t.revealed && !t.wasteland && !t.center).map((t) => t.id),
  );
}
