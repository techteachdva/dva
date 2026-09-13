import {
  addLog,
  revealLandscapeTile,
  beginFinalRecurrence,
  landscapeById,
  setEncounterOnLandscape,
} from "./state.js";
import { shuffle } from "./data.js";
import { repressCard } from "./subconscious.js";
import { narrate } from "./narrator.js";
import { recordQuestEvent } from "./quests.js";
import { isEdgeLandscape } from "./hex.js";
import { markTileForgotten } from "./fx.js";
import { queueTileForgetFx, queueRepressFx } from "./board-fx.js";

/** Revealed outer Landscapes — The Bed can never be forgotten. */
export function forgettableTiles(state) {
  return state.board.filter((t) => !t.center && t.id !== "bed" && t.revealed && !t.wasteland);
}

/** Every outer Landscape has been forgotten — face-down pool tiles do not count. */
export function allOuterTilesWasteland(state) {
  const outer = state.board.filter((t) => !t.center && t.id !== "bed");
  if (!outer.length) return false;
  if (outer.some((t) => t.revealed && !t.wasteland)) return false;
  return outer.some((t) => t.wasteland || t.forgotten);
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

export function beginFreeRevealPicking(state, budget, followup = null) {
  if (budget <= 0) return false;
  state.landscapePick = {
    mode: "reveal",
    remaining: budget,
    picked: [],
    freeReveal: true,
    followup,
  };
  narrate(
    state,
    `Reveal ${budget} Landscape${budget === 1 ? "" : "s"}`,
    `Click ${budget} hex tile${budget === 1 ? "" : "s"} on the map that show the Wasteland back.`,
    [`${budget} tile(s) to reveal`],
  );
  return "pending";
}

function forgetTile(state, tile) {
  if (tile.id === "bed" || tile.center) {
    addLog(state, "The Bed cannot be forgotten.");
    return;
  }
  tile.revealed = false;
  tile.wasteland = true;
  tile.forgotten = true;
  if (tile.encounter) {
    queueRepressFx(tile.encounter, { tileId: tile.id });
    repressCard(state, tile.encounter);
    tile.encounter = null;
  }
  state.players
    .filter((p) => p.alive && p.landscapeId === tile.id)
    .forEach((p) => {
      if (p.hand.length) {
        const card = p.hand.pop();
        queueRepressFx(card, { playerId: p.id, tileId: tile.id });
        repressCard(state, card);
        addLog(state, `${p.name} on ${tile.name} discards 1 Psyche to the Subconscious.`);
      }
    });
  markTileForgotten(tile.id);
  queueTileForgetFx(tile.id);
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
    if (allOuterTilesWasteland(state)) {
      return triggerBedFinalRecurrence(state, "All Landscapes are Wastelands — The Bed flips to Final Recurrence.");
    }
    addLog(state, "Nothing to Forget — The Bed stays. Final Recurrence does not begin.");
    return false;
  }

  if (targets.length <= count) {
    targets.forEach((t) => forgetTile(state, t));
    if (allOuterTilesWasteland(state)) {
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

function shouldAutoChooseTile(state) {
  return !!state.tutorialMode;
}

export function resolveChooseTile(state, tileId, opts) {
  const tile = landscapeById(state, tileId);
  if (!tile) return false;
  const { action, playerId, fromTileId, encounter } = opts;

  if (action === "movePlayer") {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return false;
    player.landscapeId = tile.id;
    addLog(state, `${player.name} moves to ${tile.name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
    return true;
  }

  if (action === "spawnEncounter") {
    if (!encounter || tile.encounter) return false;
    setEncounterOnLandscape(state, tile.id, encounter);
    addLog(state, `${encounter.name} appears on ${tile.name}!`);
    return true;
  }

  if (action === "moveEncounter") {
    const from = landscapeById(state, fromTileId);
    if (!from?.encounter || tile.encounter) return false;
    const enc = from.encounter;
    from.encounter = null;
    setEncounterOnLandscape(state, tile.id, enc);
    addLog(state, `${enc.name} moves to ${tile.name}.`);
    return true;
  }

  if (action === "record") return true;

  return false;
}

/** Ask the player to pick a tile, or auto-pick when only one option / tutorial. */
function finishChoosePick(state, pick) {
  state.landscapePick = null;
  if (pick.followup) {
    state.pendingObjectFollowup = {
      ...pick.followup,
      lastTileId: pick.picked?.[pick.picked.length - 1] || null,
      pickedIds: pick.picked || [],
    };
  }
}

export function requestChooseTile(state, {
  allowedIds,
  action,
  playerId = null,
  fromTileId = null,
  encounter = null,
  title = "Choose a Landscape",
  detail = "Click a highlighted hex on the map.",
  remaining = 1,
  followup = null,
} = {}) {
  const allowed = [...new Set(allowedIds || [])].filter((id) => landscapeById(state, id));
  if (!allowed.length) return false;

  const count = Math.max(1, remaining);
  const autoOne = count === 1 && (allowed.length === 1 || shouldAutoChooseTile(state));
  if (autoOne) {
    const ok = resolveChooseTile(state, allowed[0], { action, playerId, fromTileId, encounter });
    if (ok && followup) {
      state.pendingObjectFollowup = {
        ...followup,
        lastTileId: allowed[0],
        pickedIds: [allowed[0]],
      };
    }
    return ok;
  }

  state.landscapePick = {
    mode: "choose",
    remaining: Math.min(count, allowed.length),
    picked: [],
    allowed,
    action,
    playerId,
    fromTileId,
    encounter,
    title,
    detail,
    followup,
  };
  narrate(state, title, detail, [`Click ${state.landscapePick.remaining} highlighted Landscape(s)`]);
  return "pending";
}

export function handleLandscapeTilePick(state, tileId) {
  const pick = state.landscapePick;
  if (!pick) return false;

  const tile = landscapeById(state, tileId);
  if (!tile) return false;
  if (pick.mode === "choose") {
    if (!pick.allowed?.includes(tileId)) return false;
    const ok = resolveChooseTile(state, tileId, pick);
    if (!ok) return false;
    pick.picked = pick.picked || [];
    pick.picked.push(tileId);
    pick.remaining = (pick.remaining || 1) - 1;
    pick.allowed = (pick.allowed || []).filter((id) => id !== tileId);
    if (pick.remaining > 0 && pick.allowed.length) {
      narrate(
        state,
        pick.title || "Choose a Landscape",
        `${tile.name} selected. ${pick.remaining} more to pick.`,
        [`${pick.remaining} Landscape(s) left`],
      );
      return true;
    }
    finishChoosePick(state, pick);
    return true;
  }
  if (pick.mode === "reveal" && tile.center) return false;

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
      if (!pick.freeReveal) state.revealLandscapeUsed = true;
      recordQuestEvent(state, "reveal_landscape", { count: pick.picked.length });
      if (pick.followup) state.pendingObjectFollowup = pick.followup;
    }
    return true;
  }

  if (pick.mode === "forget") {
    if (!tile.revealed || tile.wasteland) return false;
    if (!forgettableTiles(state).some((t) => t.id === tileId)) return false;
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
      if (allOuterTilesWasteland(state)) {
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
  if (
    state.landscapePick.mode === "reveal"
    && state.landscapePick.picked.length > 0
    && !state.landscapePick.freeReveal
  ) {
    state.revealLandscapeUsed = true;
  }
  state.landscapePick = null;
}

/** Clear map pickers that have no valid targets left (prevents advance lock). */
export function resolveStaleLandscapePick(state) {
  const pick = state.landscapePick;
  if (!pick) return;

  if (pick.mode === "reveal" && pick.remaining > 0 && revealableTiles(state).length === 0) {
    if (pick.picked.length > 0 && !pick.freeReveal) state.revealLandscapeUsed = true;
    if (pick.followup) state.pendingObjectFollowup = pick.followup;
    state.landscapePick = null;
    addLog(state, "No more Landscapes to reveal — reveal action complete.");
    return;
  }

  if (pick.mode === "forget" && pick.remaining > 0 && forgettableTiles(state).length === 0) {
    state.landscapePick = null;
    addLog(state, "No Landscapes left to forget — forget action complete.");
    return;
  }

  if (pick.mode === "choose") {
    const valid = (pick.allowed || []).filter((id) => landscapeById(state, id));
    if (!valid.length) {
      state.landscapePick = null;
      addLog(state, "No valid Landscapes left to choose.");
    }
  }
}

export function getLandscapePickHighlights(state) {
  const pendingPower = state.pendingDreamerPower;
  if (pendingPower?.step === "reveal-landscape" && (pendingPower.revealRemaining ?? 0) > 0) {
    return {
      reveal: revealableTiles(state).map((t) => t.id),
      forget: [],
      choose: [],
    };
  }

  const pick = state.landscapePick;
  if (!pick) return { reveal: [], forget: [], choose: [] };

  if (pick.mode === "reveal") {
    return {
      reveal: revealableTiles(state).map((t) => t.id),
      forget: [],
      choose: [],
    };
  }
  if (pick.mode === "forget") {
    return {
      reveal: [],
      forget: forgettableTiles(state).map((t) => t.id),
    };
  }
  if (pick.mode === "choose") {
    return {
      reveal: [],
      forget: [],
      choose: pick.allowed || [],
    };
  }
  return { reveal: [], forget: [], choose: [] };
}

export function requestForgetLandscapes(state, count) {
  if (count <= 0) return;
  beginForgetPicking(state, count);
}

/** @deprecated Import from state.js — delegates here. */
export function forgetLandscapes(state, count) {
  requestForgetLandscapes(state, count);
}

/** Forget up to `count` revealed edge Landscapes (auto-pick when possible). */
export function forgetEdgeLandscapes(state, count) {
  if (count <= 0) return 0;
  const edges = forgettableTiles(state).filter((t) => isEdgeLandscape(state, t));
  if (!edges.length) {
    requestForgetLandscapes(state, count);
    return 0;
  }
  const picks = shuffle(edges).slice(0, count);
  picks.forEach((t) => forgetTile(state, t));
  if (picks.length) {
    recordQuestEvent(state, "forget_landscape", { count: picks.length });
    narrate(
      state,
      `Forgot ${picks.length} edge Landscape(s).`,
      picks.map((t) => t.name).join(", "),
    );
  }
  if (picks.length < count) {
    requestForgetLandscapes(state, count - picks.length);
  }
  return picks.length;
}

function assembleFinalRecurrenceDeck(state) {
  const deck = state.dreamDeck || [];
  const discard = state.dreamDiscard || [];
  const neverWake = [...deck, ...discard].find((c) => c.id === "you-never-wake");
  const remainingEffects = deck.filter(
    (c) => c.type === "final" && c.id !== "you-never-wake" && c.id !== "final-recurrence",
  );
  state.dreamDeck = [...shuffle(remainingEffects), ...(neverWake ? [neverWake] : [])];
}

export function triggerBedFinalRecurrence(state, reason) {
  if (state.finalRecurrence) return;

  assembleFinalRecurrenceDeck(state);
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
