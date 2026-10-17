/**
 * Ainmos: Archetypes on the Dreamscape.
 *
 * The one goal of a night is to Acquire Archetypes (3, 6, or 12, by length).
 * The third Dream of every Cycle offers 1 of 3 Archetypes. Only one with a
 * revealed home Landscape can be called; it appears there and stays until
 * Acquired (see archetype-call.js for the search when none can be called). As each Meet ends it steps 1 hex away from you.
 *
 * Meeting an Archetype costs 1 Meet action and opens with one of its Events,
 * drawn from the Events tied to its home Landscapes. Bright (only while one of
 * the Event's Landscapes is placed) costs Psyche and helps the fight; Dim is
 * free and makes it harder. Then the fight: a spread of Psyche that makes at
 * least 1 Dream Form, rolled against Power 12. Win, and the Archetype is
 * Acquired: +1 toward waking, +1 Power Token, and its power is yours.
 *
 * Archetypes stand on tile.finalArchetypes, the board's Archetype slot.
 */

import { addLog, landscapeById } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { random } from "../core/rng.js";
import { hexDistance, adjacentTiles } from "../core/hex.js";
import { matchingForms } from "../cards/dream-forms.js";
import { queueArchetypeArriveFx, queueArchetypeFleeFx } from "../board/board-fx.js";
import { searchForArchetypeHome } from "./archetype-call.js";
import { brightSide, dimSide } from "./archetype-events.js";

export const ARCHETYPE_POWER = 12;
export const ARCHETYPE_TOKEN_REWARD = 1;
export const ARCHETYPE_CHOICES = 3;
export const ARCHETYPE_SPREAD_CAP = 3;
/** Psyche an Acquired Archetype Returns from the Subconscious. */
export const ARCHETYPE_RETURN = 4;

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function standing(tile) {
  return (tile?.finalArchetypes || []).filter((arch) => arch && !arch.defeated);
}

function syncTileArchetype(tile) {
  tile.finalArchetype = standing(tile)[0] || null;
}

/** Every Archetype standing on the Dreamscape, with its tile. */
export function boardArchetypes(state) {
  const out = [];
  (state?.board || []).forEach((tile) => {
    standing(tile).forEach((arch) => out.push({ tile, arch }));
  });
  return out;
}

export function archetypesOnTile(state, tileId) {
  return standing(landscapeById(state, tileId));
}

export function findBoardArchetype(state, archId) {
  return boardArchetypes(state).find((entry) => entry.arch.id === archId) || null;
}

function placedLandscape(tile) {
  return !!(tile && tile.revealed && !tile.wasteland && !tile.forgotten);
}

/** The home Landscapes of an Archetype that are placed right now. */
export function archetypeHomeTiles(state, arch) {
  return (arch?.landscapes || [])
    .map((id) => landscapeById(state, id))
    .filter(placedLandscape);
}

export function archetypeHomeNames(state, arch) {
  return (arch?.landscapes || []).map((id) => landscapeById(state, id)?.name || titleCase(id));
}

const SMALL_WORDS = new Set(["of", "the", "in"]);

function titleCase(id) {
  return String(id || "").split("-")
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function hostArchetype(state, tile, arch) {
  if (!tile.finalArchetypes) tile.finalArchetypes = [];
  const placed = { ...arch, defeated: false, landscapeId: tile.id, arrivedRound: state.round };
  tile.finalArchetypes.push(placed);
  syncTileArchetype(tile);
  return placed;
}

/** Place an Archetype on one of its revealed home Landscapes (The Bed only as a last resort). */
export function spawnArchetype(state, arch) {
  if (!arch) return null;
  const homes = archetypeHomeTiles(state, arch);
  const tile = homes.length
    ? homes[Math.floor(random() * homes.length)]
    : landscapeById(state, "bed");
  if (!tile) return null;
  const placed = hostArchetype(state, tile, arch);
  const where = homes.length ? tile.name : `The Bed (${archetypeHomeNames(state, arch).join(" and ")} not yet placed)`;
  logMoment(state, `${arch.name} appears on ${where}. Meet it to Acquire it.`, { boss: true });
  queueArchetypeArriveFx(tile.id, arch.name);
  addLog(state, `${arch.name} appears on ${where}.`);
  return placed;
}

/** The third Dream of a Cycle: offer up to 3 Archetypes from the deck. */
export function beginArchetypeChoice(state) {
  const deck = state.archetypeDeck || [];
  if (!deck.length) {
    logMoment(state, "No Archetypes are left to stir.");
    return false;
  }
  const options = deck.slice(0, ARCHETYPE_CHOICES);
  state.pendingArchetypeChoice = { options: options.map((a) => a.id), round: state.round };
  return true;
}

export function archetypeChoiceOptions(state) {
  const ids = state?.pendingArchetypeChoice?.options || [];
  return ids.map((id) => (state.archetypeDeck || []).find((a) => a.id === id)).filter(Boolean);
}

/** Take the chosen Archetype onto the board; the others go under the deck. */
export function chooseArchetype(state, archId) {
  const pending = state.pendingArchetypeChoice;
  if (!pending) return false;
  const deck = state.archetypeDeck || [];
  const index = deck.findIndex((a) => a.id === archId && pending.options.includes(a.id));
  if (index < 0) return false;
  // Ainmos 0.25: an Archetype is called only onto one of its own revealed homes.
  if (!archetypeHomeTiles(state, deck[index]).length) return false;
  const [chosen] = deck.splice(index, 1);
  const passed = pending.options.filter((id) => id !== archId);
  passed.forEach((id) => {
    const at = deck.findIndex((a) => a.id === id);
    if (at >= 0) deck.push(deck.splice(at, 1)[0]);
  });
  state.pendingArchetypeChoice = null;
  markArchetypeDream(state, chosen);
  spawnArchetype(state, chosen);
  return true;
}

/** Stamp the drawn Archetype Dream with who answered, so the Night Bar can show it. */
function markArchetypeDream(state, arch) {
  const dream = [...(state.dreamDiscard || [])].reverse().find((c) => c.type === "archetype-dream" && !c.chosen);
  if (dream) dream.chosen = { id: arch.id, name: arch.name, image: arch.image, suit: arch.suit };
}

/**
 * If a choice is skipped (an effect ate the Dream), the first Archetype in the
 * deck with a revealed home appears on its own. If none has one, the deck is
 * searched for the top Archetype's home first (paid from the Waking Mind).
 */
export function spawnTopArchetype(state) {
  const deck = state.archetypeDeck || [];
  let index = deck.findIndex((arch) => archetypeHomeTiles(state, arch).length);
  if (index < 0 && deck.length) {
    const found = searchForArchetypeHome(state, null, { payFromDeck: true });
    index = found ? deck.findIndex((arch) => arch.id === found.arch.id) : 0;
  }
  const chosen = index >= 0 ? deck.splice(index, 1)[0] : null;
  if (chosen) {
    markArchetypeDream(state, chosen);
    spawnArchetype(state, chosen);
  }
  return chosen || null;
}

function dreamerTiles(state) {
  return (state.players || [])
    .filter((p) => p.alive)
    .map((p) => landscapeById(state, p.landscapeId))
    .filter(Boolean);
}

function nearestDreamerDistance(tile, dreamers) {
  if (!dreamers.length) return Infinity;
  return Math.min(...dreamers.map((d) => hexDistance(tile, d)));
}

/** End of Meet: each Archetype steps 1 hex away from you, if it can. */
export function stepArchetypesAway(state) {
  if (state.tutorialMode) return 0;
  const dreamers = dreamerTiles(state);
  if (!dreamers.length) return 0;
  let moved = 0;
  boardArchetypes(state).forEach(({ tile, arch }) => {
    const here = nearestDreamerDistance(tile, dreamers);
    const options = adjacentTiles(state, tile.id)
      .filter((next) => placedLandscape(next) && !next.center)
      .map((next) => ({ next, d: nearestDreamerDistance(next, dreamers) }))
      .filter((o) => o.d > here)
      .sort((a, b) => b.d - a.d);
    const dest = options[0]?.next;
    if (!dest) return;
    tile.finalArchetypes = (tile.finalArchetypes || []).filter((a) => a !== arch);
    syncTileArchetype(tile);
    arch.landscapeId = dest.id;
    if (!dest.finalArchetypes) dest.finalArchetypes = [];
    dest.finalArchetypes.push(arch);
    syncTileArchetype(dest);
    addLog(state, `${arch.name} slips away to ${dest.name}.`);
    queueArchetypeFleeFx(dest.id);
    moved += 1;
  });
  return moved;
}

/** The next Landscape on the shortest walk from one placed tile to another, or null. */
export function nextStepToward(state, fromId, toId) {
  if (fromId === toId) return null;
  const walkable = (t) => placedLandscape(t) || t?.center || t?.id === "bed";
  const prev = new Map([[toId, null]]);
  const queue = [toId];
  while (queue.length) {
    const id = queue.shift();
    if (id === fromId) break;
    adjacentTiles(state, id).forEach((n) => {
      if (!walkable(n) || prev.has(n.id)) return;
      prev.set(n.id, id);
      queue.push(n.id);
    });
  }
  if (!prev.has(fromId)) return null;
  return landscapeById(state, prev.get(fromId));
}

/** Move an Archetype one Landscape along the walk toward a Dreamer (a lure). */
export function lureArchetype(state, archId, towardTileId) {
  const found = findBoardArchetype(state, archId);
  const target = landscapeById(state, towardTileId);
  if (!found || !target) return false;
  const { tile, arch } = found;
  if (tile.id === target.id) return false;
  const dest = nextStepToward(state, tile.id, target.id);
  if (!dest) return false;
  tile.finalArchetypes = (tile.finalArchetypes || []).filter((a) => a !== arch);
  syncTileArchetype(tile);
  arch.landscapeId = dest.id;
  if (!dest.finalArchetypes) dest.finalArchetypes = [];
  dest.finalArchetypes.push(arch);
  syncTileArchetype(dest);
  addLog(state, `${arch.name} is drawn toward ${dest.name}.`);
  return true;
}

/** A Landscape that leaves play sends its Archetypes to The Bed. */
export function rehomeArchetypesFrom(state, tile) {
  const list = standing(tile);
  if (!list.length) return 0;
  const bed = landscapeById(state, "bed");
  if (!bed || bed === tile) return 0;
  tile.finalArchetypes = (tile.finalArchetypes || []).filter((a) => a.defeated);
  syncTileArchetype(tile);
  list.forEach((arch) => {
    arch.landscapeId = "bed";
    if (!bed.finalArchetypes) bed.finalArchetypes = [];
    bed.finalArchetypes.push(arch);
  });
  syncTileArchetype(bed);
  addLog(state, `${list.map((a) => a.name).join(" and ")} retreat${list.length === 1 ? "s" : ""} to The Bed.`);
  return list.length;
}

export function removeBoardArchetype(state, archId) {
  (state.board || []).forEach((tile) => {
    (tile.finalArchetypes || []).forEach((arch) => {
      if (arch.id === archId) arch.defeated = true;
    });
    tile.finalArchetypes = (tile.finalArchetypes || []).filter((a) => !a.defeated);
    syncTileArchetype(tile);
  });
}

// ── Each Archetype's Events ───────────────────────────────────────────────

/** Events whose Landscapes include one of this Archetype's homes. */
export function archetypeEventPool(state, arch) {
  const homes = new Set(arch?.landscapes || []);
  return (state.eventCatalog || []).filter((event) => (event.landscapes || []).some((id) => homes.has(id)));
}

/** Draw the next Event for this Archetype; its deck reshuffles when spent. */
export function drawArchetypeEvent(state, arch) {
  if (!state.archetypeEventDecks) state.archetypeEventDecks = {};
  let deck = state.archetypeEventDecks[arch.id];
  if (!deck?.length) {
    deck = shuffled(archetypeEventPool(state, arch).map((e) => e.id));
    state.archetypeEventDecks[arch.id] = deck;
  }
  const id = deck.shift();
  return (state.eventCatalog || []).find((e) => e.id === id) || null;
}

// ── Bright and Dim: what an Event does to the coming fight ────────────────

/** The Bright and Dim this Event offers before a fight with this Archetype (see archetype-events.js). */
export function archetypeEventSides(event, arch = null) {
  const name = arch?.name || "The Archetype";
  return { bright: brightSide(event, name), dim: dimSide(event, name) };
}

/** The fight's rules after its Event: Power, card cap, Form need, and dice. */
export function fightRules(state) {
  const mods = state?.archetypeFight?.mods || {};
  return {
    power: Math.max(1, ARCHETYPE_POWER + (mods.power || 0)),
    cap: mods.cap || ARCHETYPE_SPREAD_CAP,
    formNeed: mods.formNeed || "any",
    dice: mods.dice || 0,
    statMult: mods.noStat ? 0 : (mods.statMult || 1),
    keepOnLoss: !!mods.keepOnLoss,
    loseRepress: mods.loseRepress || 0,
  };
}

const THREE_CARD_FORMS = new Set(["ladder", "chord", "trinity", "trifecta", "unity"]);

/** "" when the spread meets the fight's Form rule, otherwise why not. */
export function formRuleProblem(cards, formNeed = "any") {
  if (formNeed === "none") return "";
  const forms = matchingForms(cards);
  if (formNeed === "three") {
    return forms.some((f) => THREE_CARD_FORMS.has(f))
      ? ""
      : "This fight needs a three-card Form: Ladder, Chord, Trinity, Trifecta, or Unity.";
  }
  return forms.length ? "" : "The spread must make a Dream Form (two cards of one value is an Echo).";
}

/** The Boon an Acquired Archetype leaves behind: its power, or its passive. */
export function archetypeBoon(arch) {
  return {
    id: `archetype:${arch.id}`,
    kind: "archetype",
    name: arch.name,
    image: arch.image,
    suit: arch.suit,
    text: arch.passive ? `Passive: ${arch.passive}.` : `1 Power Token, any phase: ${arch.power}`,
    archetype: arch,
  };
}

/** Is this card the third Dream of a Cycle (the Archetype offer)? */
export function isArchetypeDream(card) {
  return card?.type === "archetype-dream";
}
