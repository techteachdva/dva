import {
  addLog,
  revealLandscapeTile,
  beginFinalRecurrence,
  landscapeById,
} from "./state.js";
import { shuffle } from "./data.js";
import { repressCard } from "./subconscious.js";
import { narrate } from "./narrator.js";
import { recordQuestEvent } from "./quests.js";

/** Revealed, non-center, not wasteland — valid Forget targets. */
export function forgettableTiles(state) {
  return state.board.filter((t) => !t.center && t.revealed && !t.wasteland);
}

/** All non-Bed tiles are wasteland (or unrevealed wasteland backs). */
export function allOuterTilesWasteland(state) {
  const outer = state.board.filter((t) => !t.center);
  if (!outer.length) return false;
  return outer.every((t) => t.wasteland || !t.revealed);
}

/** Tiles that can be revealed (wasteland back or hidden pool). */
export function revealableTiles(state) {
  return state.board.filter((t) => !t.center && (!t.revealed || t.wasteland));
}

export function beginRevealPicking(state, budget) {
  if (budget <= 0) return false;
  state.landscapePick = { mode: "reveal", remaining: budget, picked: [] };
  narrate(
    state,
    `Reveal budget: ${budget} — click map tiles.`,
    `You spent Lucidity Psyche. Click up to ${budget} hex tiles on the map that show the Wasteland back to flip them to active Landscapes.`,
    [`${budget} tile(s) to reveal`, "Click the hex map in the center table"],
  );
  return true;
}

function forgetTile(state, tile) {
  tile.revealed = false;
  tile.wasteland = true;
  if (tile.encounter) {
    repressCard(state, tile.encounter);
    tile.encounter = null;
  }
  state.players
    .filter((p) => p.alive && p.landscapeId === tile.id)
    .forEach((p) => {
      if (p.hand.length) {
        repressCard(state, p.hand.pop());
        addLog(state, `${p.name} on ${tile.name} discards 1 Psyche to the Subconscious.`);
      }
    });
  addLog(state, `Forgot ${tile.name} — now a Wasteland.`);
}

function applyAutoForget(state, count) {
  const edges = forgettableTiles(state).slice(0, count);
  edges.forEach((t) => forgetTile(state, t));
  return edges.length > 0;
}

export function beginForgetPicking(state, count) {
  if (state.finalRecurrence) {
    return applyAutoForget(state, count);
  }

  if (allOuterTilesWasteland(state)) {
    return triggerBedFinalRecurrence(state, "All Landscapes are Wastelands — The Bed flips to Final Recurrence.");
  }

  const targets = forgettableTiles(state);
  if (!targets.length) {
    return triggerBedFinalRecurrence(state, "No Landscapes left to Forget — The Bed flips to Final Recurrence.");
  }

  if (targets.length <= count) {
    targets.forEach((t) => forgetTile(state, t));
    if (allOuterTilesWasteland(state) || count > targets.length) {
      return triggerBedFinalRecurrence(state, "The Dreamscape collapses — Final Recurrence begins on The Bed.");
    }
    narrate(
      state,
      `Forgot ${targets.length} Landscape(s).`,
      `All chosen tiles are now Wasteland: ${targets.map((t) => t.name).join(", ")}.`,
    );
    return true;
  }

  state.landscapePick = { mode: "forget", remaining: count, picked: [], totalRequested: count };
  narrate(
    state,
    `Forget ${count} Landscape(s) — click the map.`,
    `Choose ${count} revealed Landscape hex tiles to turn into Wasteland. Encounters there are Repressed; Dreamers there lose 1 Psyche to the Subconscious.`,
    [`${count} tile(s) to forget`],
  );
  return true;
}

export function handleLandscapeTilePick(state, tileId) {
  const pick = state.landscapePick;
  if (!pick) return false;

  const tile = landscapeById(state, tileId);
  if (!tile || tile.center) return false;

  if (pick.mode === "reveal") {
    if (tile.revealed && !tile.wasteland) return false;
    if (pick.remaining <= 0) return false;

    revealLandscapeTile(state, tile);
    pick.picked.push(tile.id);
    pick.remaining -= 1;

    narrate(
      state,
      `Revealed ${tile.name}.`,
      `${tile.name} is now an active Landscape on the map.${pick.remaining > 0 ? ` Click ${pick.remaining} more tile(s), or continue when done.` : " Reveal complete for this action."}`,
      pick.remaining > 0 ? [`${pick.remaining} reveal(s) left`] : ["Reveal action complete"],
    );

    if (pick.remaining <= 0) {
      state.landscapePick = null;
      state.revealLandscapeUsed = true;
      recordQuestEvent(state, "reveal_landscape", { count: pick.picked.length });
    }
    return true;
  }

  if (pick.mode === "forget") {
    if (!tile.revealed || tile.wasteland) return false;
    if (pick.remaining <= 0) return false;

    forgetTile(state, tile);
    pick.picked.push(tile.id);
    pick.remaining -= 1;

    narrate(
      state,
      `Forgot ${tile.name}.`,
      `${tile.name} flips to Wasteland.${pick.remaining > 0 ? ` Choose ${pick.remaining} more.` : ""}`,
      pick.remaining > 0 ? [`${pick.remaining} forget(s) left`] : [],
    );

    if (pick.remaining <= 0) {
      state.landscapePick = null;
      const extra = (pick.totalRequested || pick.picked.length) - pick.picked.length;
      if (allOuterTilesWasteland(state) || extra > 0) {
        triggerBedFinalRecurrence(state, "Landscapes collapsed — The Bed flips to Final Recurrence.");
      }
    } else if (allOuterTilesWasteland(state)) {
      state.landscapePick = null;
      triggerBedFinalRecurrence(state, "All Landscapes are Wastelands — Final Recurrence begins.");
    }
    return true;
  }

  return false;
}

export function cancelLandscapePick(state) {
  if (!state.landscapePick) return;
  if (state.landscapePick.mode === "reveal" && state.landscapePick.picked.length > 0) {
    state.revealLandscapeUsed = true;
  }
  state.landscapePick = null;
}

export function getLandscapePickHighlights(state) {
  const pick = state.landscapePick;
  if (!pick) return { reveal: [], forget: [] };

  if (pick.mode === "reveal") {
    return {
      reveal: revealableTiles(state).map((t) => t.id),
      forget: [],
    };
  }
  if (pick.mode === "forget") {
    return {
      reveal: [],
      forget: forgettableTiles(state).map((t) => t.id),
    };
  }
  return { reveal: [], forget: [] };
}

export function requestForgetLandscapes(state, count) {
  if (count <= 0) return;
  beginForgetPicking(state, count);
}

/** @deprecated Import from state.js — delegates here. */
export function forgetLandscapes(state, count) {
  requestForgetLandscapes(state, count);
}

export function triggerBedFinalRecurrence(state, reason) {
  if (state.finalRecurrence) return;

  const bed = landscapeById(state, "bed");
  if (bed) {
    bed.finalRecurrenceSide = true;
    bed.revealed = true;
    bed.wasteland = false;
  }

  const allInPlay = [
    ...state.dreamDeck,
    ...(state.dreamDiscard || []),
  ];
  const finals = allInPlay.filter((c) => c.type === "final");
  state.dreamDeck = shuffle(finals.length ? finals : allInPlay.filter((c) => c.type === "final" || c.id === "final-recurrence"));
  state.dreamDiscard = [];

  beginFinalRecurrence(state);

  narrate(
    state,
    "The Bed flips — Final Recurrence!",
    reason || "The Dreamscape collapses to its final form. The Dream Deck is now only Final Recurrence cards. Defeat each Remaining Archetype on the map with 12-Psyche plays using opposing suits.",
    [
      `${state.dreamDeck.length} Final Dream cards remain`,
      "Goal changes: defeat all Remaining Archetypes",
    ],
  );
}
