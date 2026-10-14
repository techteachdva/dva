import {
  addLog,
  revealLandscapeTile,
  beginFinalRecurrence,
  landscapeById,
  setEncounterOnLandscape,
  encountersOnLandscape,
  moveEncounterBetweenLandscapes,
  removeEncounterFromLandscape,
  tileEncounters,
  tileHasEncounters,
  clearEncountersOnLandscape,
  maybeMapRevealForgetThresholds,
  allLandscapesRevealed,
  revealNextDeckCard,
  peekFacedownDeckCard,
} from "../core/state.js";
import { shuffle } from "../core/data.js";
import { repressCard } from "../dreamers/subconscious.js";
import { narrate, logMoment } from "../core/narrator.js";
import { recordQuestEvent, activeQuestLandscapeIds } from "../dreamers/quests.js";
import { isEdgeLandscape } from "../core/hex.js";
import { markTileForgotten } from "../ui/fx.js";
import { queueTileForgetFx } from "./board-fx.js";
import { recordCancellableMove } from "../dreamers/dreamer-powers.js";
import {
  isFreeformBoard,
  vaultCards,
  vaultExhausted,
  refillVault,
  refreshVault,
  vaultRefreshCost,
  placementSlots,
  isPlacementSlot,
  makeBoardTile,
  isUnplacedLandscape,
  setAsideUnplacedLandscape,
  drawTopTile,
  putTileOnBottom,
  tileDeckCount,
  takeUnplacedLandscape,
  nearestPlacementSlot,
} from "./dreamscape-vault.js";

/** Revealed outer Landscapes — The Bed can never be forgotten. */
export function forgettableTiles(state) {
  return state.board.filter((t) => !t.center && t.id !== "bed" && t.revealed && !t.wasteland);
}

/** Every outer Landscape has been forgotten — face-down pool tiles do not count. */
export function allOuterTilesWasteland(state) {
  // Freeform: tiles still waiting in the Vault keep the dream alive.
  if (isFreeformBoard(state) && !vaultExhausted(state)) return false;
  const outer = state.board.filter((t) => !t.center && t.id !== "bed");
  if (!outer.length) return false;
  if (outer.some((t) => t.revealed && !t.wasteland)) return false;
  return outer.some((t) => t.wasteland || t.forgotten);
}

/** Freeform: Landscapes the table can still place (Vault + tile deck). */
export function placeableLandscapeCount(state) {
  if (!isFreeformBoard(state)) return 0;
  return vaultCards(state).length + tileDeckCount(state);
}

/** Reveals the table could still make: hidden or Forgotten tiles, plus Freeform tiles left to place. */
export function revealCapacity(state) {
  return revealableTiles(state).length + placeableLandscapeCount(state);
}

/** Tiles that can be revealed (wasteland back or hidden pool). */
export function revealableTiles(state) {
  return state.board.filter((t) => !t.center && (!t.revealed || t.wasteland));
}

function markExcessReveals(state, budget, extra = {}) {
  state.landscapePick = {
    mode: "reveal",
    remaining: budget,
    picked: extra.picked || [],
    excessOnly: true,
  };
  narrate(
    state,
    `Reveal budget: ${budget} — draw Psyche.`,
    `Every Landscape is already face-up. Each leftover Reveal draws 1 Psyche. The Dreamer whose turn it is draws, then the turn passes clockwise.`,
    [`${budget} Psyche draw(s) left`],
  );
  return true;
}

export function beginRevealPicking(state, budget) {
  if (budget <= 0) return false;
  if (revealableTiles(state).length === 0 && allLandscapesRevealed(state)) {
    return markExcessReveals(state, budget);
  }
  state.landscapePick = { mode: "reveal", remaining: budget, picked: [] };
  if (isFreeformBoard(state)) {
    narrate(
      state,
      `Reveal budget: ${budget} — build the Dreamscape.`,
      `Each Lucidity places one Landscape. Choose a tile in the Dreamscape Vault, then a glowing hex beside the dream. Refreshing the Vault costs ${vaultRefreshCost(state)} Lucidity. Unused Reveals draw 1 Psyche each, one Dreamer at a time.`,
      [`${budget} Lucidity to spend`, "Pick a Vault tile, then a glowing hex"],
    );
    return true;
  }
  narrate(
    state,
    `Reveal budget: ${budget} — click map tiles.`,
    `You spent Lucidity Psyche. Click up to ${budget} hex tiles on the map that show the Wasteland back to flip them to active Landscapes. Unused Reveals draw 1 Psyche each, one Dreamer at a time.`,
    [`${budget} tile(s) to reveal`, "Click the hex map in the center table"],
  );
  return true;
}

export function beginFreeRevealPicking(state, budget, followup = null) {
  if (budget <= 0) return false;
  if (isFreeformBoard(state) && !revealCapacity(state)) {
    addLog(state, "Nothing is left to place from the Dreamscape Vault.");
    return false;
  }
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
    isFreeformBoard(state)
      ? `Place ${budget} Landscape${budget === 1 ? "" : "s"} from the Dreamscape Vault, free. Choose a Vault tile, then a glowing hex.`
      : `Click ${budget} hex tile${budget === 1 ? "" : "s"} on the map that show the Wasteland back.`,
    [`${budget} tile(s) to reveal`],
  );
  return "pending";
}

/**
 * Reveal N right now (Dream, Event, and reward text). Fixed Board flips hidden
 * tiles. Freeform Board opens a free placement from the Vault instead.
 */
export function revealOrPlaceLandscapes(state, count, { source = "Reveal" } = {}) {
  const n = Math.max(0, Math.floor(count || 0));
  if (!n) return 0;
  if (isFreeformBoard(state)) {
    const capped = Math.min(n, revealCapacity(state));
    if (!capped) return 0;
    if (state.landscapePick?.mode === "reveal") {
      // A Reveal is already open: bank the free placements onto it.
      state.landscapePick.remaining = (state.landscapePick.remaining || 0) + capped;
      return capped;
    }
    if (state.landscapePick) return 0;
    beginFreeRevealPicking(state, capped);
    addLog(state, `${source}: place ${capped} Landscape${capped === 1 ? "" : "s"} from the Dreamscape Vault.`);
    return capped;
  }
  const hidden = state.board.filter((l) => !l.revealed && !l.center);
  const shown = Math.min(n, hidden.length);
  hidden.slice(0, shown).forEach((t) => revealLandscapeTile(state, t));
  if (shown) {
    recordQuestEvent(state, "reveal_landscape", { count: shown });
    addLog(state, `${source}: Reveal ${shown} Landscape${shown === 1 ? "" : "s"}.`);
  }
  return shown;
}

function forgetTile(state, tile) {
  if (tile.id === "bed" || tile.center) {
    addLog(state, "The Bed cannot be forgotten.");
    return;
  }
  tile.revealed = false;
  tile.wasteland = true;
  tile.forgotten = true;
  tileEncounters(tile).forEach((enc) => {
    repressCard(state, enc, { tileId: tile.id });
  });
  clearEncountersOnLandscape(state, tile.id);
  state.players
    .filter((p) => p.alive && p.landscapeId === tile.id)
    .forEach((p) => {
      if (p.hand.length) {
        const card = p.hand.pop();
        repressCard(state, card, { playerId: p.id, tileId: tile.id });
        addLog(state, `${p.name} on ${tile.name} discards 1 Psyche to the Subconscious.`);
      }
    });
  markTileForgotten(tile.id);
  queueTileForgetFx(tile.id);
  addLog(state, `Forgot ${tile.name} — now a Wasteland.`);
  maybeMapRevealForgetThresholds(state);
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

  state.landscapePick = {
    mode: "forget",
    remaining: count,
    picked: [],
    totalRequested: count,
    title: `Forget ${count} Landscape${count === 1 ? "" : "s"}`,
  };
  state.forgetPickActive = true;
  logMoment(
    state,
    `Forget ${count} Landscape${count === 1 ? "" : "s"} — click glowing map tiles.`,
    { forget: true },
  );
  narrate(
    state,
    `Forget ${count} Landscape(s) — click the map.`,
    `Choose ${count} revealed Landscape hex tiles (they pulse red). Each becomes a Wasteland: Encounters Repress to the Subconscious; Dreamers standing there lose 1 Psyche.`,
    [`${count} tile(s) to forget`, "The Bed cannot be forgotten"],
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
    const fromId = player.landscapeId;
    player.landscapeId = tile.id;
    recordCancellableMove(state, player, fromId, tile.id);
    addLog(state, `${player.name} moves to ${tile.name}.`);
    recordQuestEvent(state, "move_player", { count: 1 });
    return true;
  }

  if (action === "spawnEncounter") {
    if (!encounter) return false;
    setEncounterOnLandscape(state, tile.id, encounter);
    logMoment(state, `${encounter.name} appears on ${tile.name}!`);
    return true;
  }

  if (action === "moveEncounter") {
    const from = landscapeById(state, fromTileId);
    const enc = encounter || encountersOnLandscape(state, fromTileId)[0];
    if (!from || !enc) return false;
    moveEncounterBetweenLandscapes(state, fromTileId, tile.id, enc);
    addLog(state, `${enc.name} moves to ${tile.name}.`);
    return true;
  }

  if (action === "movePlayerAndEncounter") {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return false;
    const fromId = player.landscapeId;
    player.landscapeId = tile.id;
    recordCancellableMove(state, player, fromId, tile.id);
    const from = landscapeById(state, fromTileId);
    if (from && tileHasEncounters(from) && from.id !== tile.id) {
      const enc = tileEncounters(from)[0];
      if (enc) {
        moveEncounterBetweenLandscapes(state, from.id, tile.id, enc);
        addLog(state, `${player.name} and ${enc.name} move to ${tile.name}.`);
      } else {
        addLog(state, `${player.name} moves to ${tile.name}.`);
      }
    } else {
      addLog(state, `${player.name} moves to ${tile.name}.`);
    }
    recordQuestEvent(state, "move_player", { count: 1 });
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

    if (pick.flipCard) return false;
    revealLandscapeTile(state, tile);
    finishRevealStep(state, pick, tile, 1);
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
      state.forgetPickActive = false;
      if (allOuterTilesWasteland(state)) {
        triggerBedFinalRecurrence(state, "Landscapes collapsed — The Bed flips to Final Recurrence.");
      }
    } else if (allOuterTilesWasteland(state)) {
      state.landscapePick = null;
      state.forgetPickActive = false;
      triggerBedFinalRecurrence(state, "All Landscapes are Wastelands — Final Recurrence begins.");
    }
    return true;
  }

  return false;
}

/** Bookkeeping after one Reveal (flip, restore, or Freeform placement). */
function finishRevealStep(state, pick, tile, spent = 1) {
  pick.picked = pick.picked || [];
  if (tile) pick.picked.push(tile.id);
  pick.remaining -= spent;
  const freeform = isFreeformBoard(state);
  const more = freeform ? "Choose another Vault tile" : `Click ${pick.remaining} more tile(s)`;

  if (tile) {
    narrate(
      state,
      freeform ? `Placed ${tile.name}.` : `Revealed ${tile.name}.`,
      `${tile.name} is now an active Landscape on the map.${pick.remaining > 0 ? ` ${more}, or continue when done.` : " Reveal complete for this action."}`,
      pick.remaining > 0 ? [`${pick.remaining} reveal(s) left`] : ["Reveal action complete"],
    );
  }

  if (pick.remaining <= 0) {
    state.landscapePick = null;
    if (!pick.freeReveal) state.revealLandscapeUsed = true;
    recordQuestEvent(state, "reveal_landscape", { count: pick.picked.length });
    if (pick.followup) state.pendingObjectFollowup = pick.followup;
  } else if (!pick.freeReveal && !revealCapacity(state) && allLandscapesRevealed(state)) {
    markExcessReveals(state, pick.remaining, { picked: pick.picked });
  } else if (pick.freeReveal && !revealCapacity(state)) {
    // Nothing left to place: a free Reveal simply ends.
    state.landscapePick = null;
    recordQuestEvent(state, "reveal_landscape", { count: pick.picked.length });
    if (pick.followup) state.pendingObjectFollowup = pick.followup;
  }
}

/**
 * Freeform "Dream it open": a named Landscape still in the Vault or deck
 * surfaces on the open hex nearest the Dreamer who called it.
 */
export function surfaceLandscapeNear(state, landscapeId, nearTileId = "bed") {
  if (!isFreeformBoard(state)) return null;
  const anchor = landscapeById(state, nearTileId) || landscapeById(state, "bed");
  const slot = nearestPlacementSlot(state, anchor);
  if (!slot) return null;
  const card = takeUnplacedLandscape(state, landscapeId);
  if (!card) return null;
  const tile = makeBoardTile(card, slot.q, slot.r);
  state.board.push(tile);
  revealLandscapeTile(state, tile);
  return tile;
}

/** Board-tile fields that are not part of the Landscape card itself. */
const TILE_RUNTIME_KEYS = [
  "q", "r", "revealed", "wasteland", "forgotten", "finalRecurrenceSide",
  "encounters", "encounter", "finalArchetype", "finalArchetypes",
];

function tileToCard(tile) {
  const card = { ...tile };
  TILE_RUNTIME_KEYS.forEach((key) => delete card[key]);
  return card;
}

/**
 * Ainmos Dreamscape Reset. When the Vault and tile deck are both empty, the
 * next round begins with the dream dissolving: every Landscape but The Bed
 * shuffles back into the tile deck, ordinary Dreambeasts on them are Repressed,
 * Bosses drift back to The Bed, and every Dreamer wakes on The Bed.
 */
export function resetDreamscape(state) {
  if (!isFreeformBoard(state)) return false;
  const bed = state.board.find((t) => t.center || t.id === "bed");
  if (!bed) return false;
  const outer = state.board.filter((t) => t !== bed);
  const bosses = [];
  let repressed = 0;
  outer.forEach((tile) => {
    tileEncounters(tile).forEach((enc) => {
      if (enc.boss) bosses.push(enc);
      else {
        repressCard(state, enc, { tileId: tile.id });
        repressed += 1;
      }
    });
  });
  state.landscapeTileDeck = shuffle([
    ...(state.landscapeTileDeck || []),
    ...(state.landscapeVault || []),
    ...(state.landscapesSetAside || []),
    ...outer.map(tileToCard),
  ]);
  state.landscapeVault = [];
  state.landscapesSetAside = [];
  state.board = [bed];
  bosses.forEach((boss) => tileEncounters(bed).push(boss));
  state.players.forEach((player) => {
    if (player.alive) player.landscapeId = bed.id;
  });
  state.selectedLandscapeId = bed.id;
  state.landscapePick = null;
  refillVault(state);
  state.dreamscapeResets = (state.dreamscapeResets || 0) + 1;
  logMoment(
    state,
    `The Dreamscape dissolves and re-forms. Every Dreamer wakes on The Bed.${repressed ? ` ${repressed} Dreambeast${repressed === 1 ? " sinks" : "s sink"} into the Subconscious.` : ""}${bosses.length ? " The Boss drifts back to The Bed." : ""}`,
  );
  return true;
}

/** Freeform: choose which Vault tile the next placement uses (tap again to clear). */
export function selectVaultTile(state, index) {
  const pick = state.landscapePick;
  if (!isFreeformBoard(state) || pick?.mode !== "reveal" || pick.excessOnly) return false;
  if (pick.flipCard || (pick.remaining || 0) <= 0) return false;
  if (!vaultCards(state)[index]) return false;
  pick.vaultIndex = pick.vaultIndex === index ? null : index;
  return true;
}

/** The Landscape a tap on an empty hex would place right now, if any. */
export function pendingPlacementCard(state) {
  const pick = state.landscapePick;
  if (!isFreeformBoard(state) || pick?.mode !== "reveal" || pick.excessOnly) return null;
  if ((pick.remaining || 0) <= 0) return null;
  if (pick.flipCard) return pick.flipCard;
  const cards = vaultCards(state);
  if (pick.vaultIndex != null && cards[pick.vaultIndex]) return cards[pick.vaultIndex];
  return cards.length === 1 ? cards[0] : null;
}

/** Freeform: place the chosen Vault tile (or The Bed's flipped tile) on an empty hex. */
export function placeLandscapeAt(state, q, r) {
  const pick = state.landscapePick;
  const card = pendingPlacementCard(state);
  if (!card || !isPlacementSlot(state, q, r)) return false;
  if (pick.flipCard) {
    pick.flipCard = null;
  } else {
    const cards = vaultCards(state);
    const index = cards.indexOf(card);
    if (index < 0) return false;
    cards.splice(index, 1);
    pick.vaultIndex = null;
    refillVault(state);
  }
  const tile = makeBoardTile(card, q, r);
  state.board.push(tile);
  revealLandscapeTile(state, tile);
  finishRevealStep(state, pick, tile, 1);
  return true;
}

/** Freeform Reveal: pay the escalating cost to redeal the Vault. */
export function refreshVaultDuringReveal(state) {
  const pick = state.landscapePick;
  if (!isFreeformBoard(state) || pick?.mode !== "reveal" || pick.excessOnly) {
    return { ok: false, reason: "Refresh the Vault while you spend Lucidity in Reveal." };
  }
  if (pick.freeReveal || pick.flipCard) {
    return { ok: false, reason: "A free placement cannot refresh the Vault. Place the tile instead." };
  }
  if (!tileDeckCount(state)) {
    return { ok: false, reason: "The tile deck is empty, so a refresh would deal the same tiles." };
  }
  const cost = vaultRefreshCost(state);
  if ((pick.remaining || 0) < cost) {
    return { ok: false, reason: `Refreshing costs ${cost} Lucidity and ${pick.remaining || 0} is left. Place a tile instead.` };
  }
  refreshVault(state);
  pick.vaultIndex = null;
  addLog(state, `The Dreamscape Vault refreshes for ${cost} Lucidity.`);
  narrate(
    state,
    "The Vault shifts.",
    `New Landscapes surface. The next refresh this round costs ${vaultRefreshCost(state)}.`,
    [`${Math.max(0, pick.remaining - cost)} Lucidity left`],
  );
  finishRevealStep(state, pick, null, cost);
  return { ok: true, cost };
}

/**
 * The Bed, Freeform: flip the top tile of the deck (not the Vault).
 * The table places it free, or puts it on the bottom.
 */
export function beginBedTileFlip(state) {
  if (!isFreeformBoard(state)) return null;
  const card = drawTopTile(state);
  if (!card) return null;
  state.landscapePick = {
    mode: "reveal",
    remaining: 1,
    picked: [],
    freeReveal: true,
    flipCard: card,
    bedFlip: true,
  };
  narrate(
    state,
    `The Bed dreams onward: ${card.name}.`,
    `Place ${card.name} on a glowing hex beside the dream, free. Or put it on the bottom of the tile deck.`,
    ["Tap a glowing hex", "Or put it back"],
  );
  addLog(state, `The Bed flips ${card.name} from the top of the tile deck.`);
  return card;
}

/** Put The Bed's flipped tile on the bottom of the tile deck. */
export function buryFlippedTile(state) {
  const pick = state.landscapePick;
  if (!pick?.flipCard) return false;
  putTileOnBottom(state, pick.flipCard);
  addLog(state, `${pick.flipCard.name} goes to the bottom of the tile deck.`);
  state.landscapePick = null;
  return true;
}

export function cancelLandscapePick(state) {
  if (!state.landscapePick) return;
  // Never lose The Bed's flipped tile.
  if (state.landscapePick.flipCard) putTileOnBottom(state, state.landscapePick.flipCard);
  const revealMode = state.landscapePick.mode === "reveal" || state.landscapePick.mode === "reveal-deck-tops";
  // Paid Lucidity spend is complete even if the team reveals 0 tiles.
  if (revealMode && !state.landscapePick.freeReveal) {
    state.revealLandscapeUsed = true;
  }
  state.landscapePick = null;
  state.forgetPickActive = false;
  // Reveal turn token dies with the pick (avoids stale meetPassHolderId across phases).
  if (revealMode) state.meetPassHolderId = null;
}

/** Clear map pickers that have no valid targets left (prevents advance lock). */
export function resolveStaleLandscapePick(state) {
  const pick = state.landscapePick;
  if (!pick) return;

  // Freeform: tiles still in the Vault (or The Bed's flipped tile) keep the pick alive.
  if (pick.mode === "reveal" && pick.remaining > 0 && !pick.flipCard && revealCapacity(state) === 0) {
    if (!pick.freeReveal && allLandscapesRevealed(state)) {
      markExcessReveals(state, pick.remaining, { picked: pick.picked });
      return;
    }
    if (pick.picked.length > 0 && !pick.freeReveal) state.revealLandscapeUsed = true;
    if (pick.followup) state.pendingObjectFollowup = pick.followup;
    state.landscapePick = null;
    addLog(state, "No more Landscapes to reveal — reveal action complete.");
    return;
  }

  if (pick.mode === "forget" && pick.remaining > 0 && forgettableTiles(state).length === 0) {
    state.landscapePick = null;
    state.forgetPickActive = false;
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
      reveal: pick.flipCard ? [] : revealableTiles(state).map((t) => t.id),
      forget: [],
      choose: [],
      place: pendingPlacementCard(state) ? placementSlots(state).map((s) => `${s.q},${s.r}`) : [],
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

function forgettableUnoccupied(state) {
  return forgettableTiles(state).filter((t) => !tileHasEncounters(t));
}

/** Forget `count` random revealed Landscapes. Never The Bed. Optionally skip hexes that still host Dreambeasts. */
function questLandscapesLast(state, tiles) {
  const protect = new Set(activeQuestLandscapeIds(state));
  const open = [];
  const quest = [];
  tiles.forEach((tile) => {
    if (protect.has(tile.id)) quest.push(tile);
    else open.push(tile);
  });
  return [...shuffle(open), ...shuffle(quest)];
}

export function forgetRandomLandscapes(state, count, { skipOccupied = true } = {}) {
  const n = Math.max(0, Math.floor(count || 0));
  if (n <= 0) return [];
  const pool = questLandscapesLast(state, skipOccupied ? forgettableUnoccupied(state) : forgettableTiles(state));
  const picked = pool.slice(0, n);
  picked.forEach((t) => forgetTile(state, t));
  if (picked.length) {
    recordQuestEvent(state, "forget_landscape", { count: picked.length });
  }
  return picked;
}

/** Forget specific revealed Landscapes by id (Bed cannot be forgotten). */
export function forgetNamedLandscapes(state, ids, { preserveBeasts = false } = {}) {
  const forgotten = [];
  let missed = 0;
  (ids || []).forEach((id) => {
    const tile = landscapeById(state, id);
    // Freeform: a named Landscape still in the Vault or deck is set aside instead.
    if (!tile && isUnplacedLandscape(state, id)) {
      const card = setAsideUnplacedLandscape(state, id);
      if (card) {
        addLog(state, `${card.name} sinks out of the Dreamscape Vault. It is Forgotten.`);
        forgotten.push(card);
      }
      return;
    }
    if (!tile || tile.center || tile.id === "bed" || !tile.revealed || tile.wasteland) return;
    if (preserveBeasts && tileHasEncounters(tile)) {
      missed += 1;
      return;
    }
    forgetTile(state, tile);
    forgotten.push(tile);
  });
  const namedCount = forgotten.length;
  if (preserveBeasts && missed > 0) {
    forgetRandomLandscapes(state, missed, { skipOccupied: true }).forEach((t) => forgotten.push(t));
  }
  if (namedCount) {
    recordQuestEvent(state, "forget_landscape", { count: namedCount });
  }
  return forgotten.length;
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
  const picks = questLandscapesLast(state, edges).slice(0, count);
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

export function spendRevealOnMindstreamTop(state, suit) {
  const pick = state.landscapePick;
  if (pick?.mode !== "reveal-deck-tops") return null;
  if (pick.remaining <= 0) return null;
  const deckKey = `mindstream-${suit}`;
  const visionary = (state.players || []).find((p) => p.alive && p.dreamer?.id === "the-visionary");
  if (visionary && !state.tutorialMode && !state.visionaryPeekUsed) {
    const peeked = peekFacedownDeckCard(state, deckKey);
    if (peeked) {
      state.visionaryPeekUsed = true;
      pick.remaining -= 1;
      narrate(
        state,
        `The Visionary peeks ${peeked.name}.`,
        `${peeked.name} stays facedown on the ${suit} Mindstream.${pick.remaining > 0 ? ` ${pick.remaining} Reveal(s) left.` : ""}`,
      );
      addLog(state, `The Visionary peeks ${peeked.name} on the ${suit} Mindstream. It stays facedown.`);
      if (pick.remaining <= 0) {
        state.landscapePick = null;
        state.revealLandscapeUsed = true;
        recordQuestEvent(state, "reveal_landscape", { count: (pick.picked || []).length });
      }
      return peeked;
    }
  }
  const card = revealNextDeckCard(state, deckKey);
  if (!card) {
    addLog(state, `No facedown ${suit} Mindstream cards left to flip.`);
    return null;
  }
  pick.remaining -= 1;
  pick.flipped = pick.flipped || [];
  pick.flipped.push({ suit, name: card.name });
  narrate(
    state,
    `Flipped ${card.name}.`,
    `${card.name} is now face-up on the ${suit} Mindstream.${pick.remaining > 0 ? ` ${pick.remaining} Reveal(s) left — click another Mindstream back.` : " Lucidity Reveals are spent."}`,
    pick.remaining > 0 ? [`${pick.remaining} deck flip(s) left`] : ["Reveal action complete"],
  );
  addLog(state, `Lucidity Reveal flips ${card.name} on the ${suit} Mindstream.`);
  if (pick.remaining <= 0) {
    state.landscapePick = null;
    state.revealLandscapeUsed = true;
    recordQuestEvent(state, "reveal_landscape", { count: (pick.picked || []).length });
  }
  return card;
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
  // Ainmos has no Final Recurrence. The Bed stays; the night goes on to its last Boss.
  if (!state.tutorialMode) return false;
  if (state.finalRecurrence) return;

  assembleFinalRecurrenceDeck(state);
  beginFinalRecurrence(state);

  narrate(
    state,
    "The Bed flips — Final Recurrence!",
    reason || "The Dreamscape collapses to its final form. The Dream Deck is now only Final Recurrence cards. Each Remaining Archetype is Power 12. Pool up to 3 Psyche, including its suit, and win the dice battle to Acquire it.",
    [
      `${state.dreamDeck.length} Final Dream cards remain`,
      "Goal changes: defeat all Remaining Archetypes",
    ],
    { moment: "The Bed flips — Final Recurrence begins." },
  );
}
