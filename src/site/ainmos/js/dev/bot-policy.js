/**
 * Ainmos 41.0 — Bot policy shared by the spectator bot (bot-ai.js) and the sim
 * (scripts/somnia-41-bot-sim.mjs). The Mind-keeper: watch the Waking Mind, spend
 * surplus Psyche to Remember, chase the Archetype closest to true.
 */

import { wakingMindCount, duskMillCount } from "../encounters/meet-phase.js";
import { returnableCards, returnableCount, isDreambeastPsycheCard } from "../dreamers/subconscious.js";
import { rememberPriority, rememberFuel, REMEMBER_CHOICE_ID } from "../effects/remember.js";
import { isQuestConditionMet, rowArchetypes } from "../dreamers/quests.js";

/** Cards above this many in hand are fuel, not safety. */
export const SAFE_HAND = 6;
/** At or under this many rounds of mind, Remember comes first. */
export const LOW_RUNWAY = 3;

export function mindRunway(state) {
  const dusk = Math.max(1, duskMillCount(state));
  return wakingMindCount(state) / dusk;
}

export function handSurplus(player) {
  return Math.max(0, (player?.hand?.length || 0) - SAFE_HAND);
}

/** Should this Dreamer spend an action to Remember right now? */
export function wantsRemember(state, player) {
  if (!player || returnableCount(state) < 1) return false;
  const subPsyche = (state.subconscious?.psyche || []).length;
  if (subPsyche < 1) return false;
  if (mindRunway(state) <= LOW_RUNWAY) return true;
  return handSurplus(player) > 0;
}

/** How many Psyche to discard into a Remember N offer. */
export function rememberDiscardCount(state, player, maxDiscard) {
  if (maxDiscard <= 0) return 0;
  const fuel = rememberFuel(player).length;
  const keep = mindRunway(state) <= LOW_RUNWAY ? 3 : SAFE_HAND;
  return Math.max(0, Math.min(maxDiscard, fuel - keep));
}

/** Pick the Remember choice id from a pendingEffectChoice. */
export function pickRememberChoice(state, pending) {
  if (pending?.cardId !== REMEMBER_CHOICE_ID) return null;
  const player = state.players.find((p) => p.id === pending.playerId);
  const options = (pending.choices || [])
    .filter((c) => !c.disabled)
    .map((c) => ({ id: c.id, k: Number(String(c.id).replace("discard-", "")) || 0 }));
  if (!options.length) return null;
  const maxK = Math.max(...options.map((o) => o.k));
  const want = rememberDiscardCount(state, player, maxK);
  const best = options.reduce((acc, o) => (Math.abs(o.k - want) < Math.abs(acc.k - want) ? o : acc), options[0]);
  return best.id;
}

/** Best card to Return: plain Psyche (highest value), then Wilds/tokens, Objects, Events, beasts. */
export function pickReturnInstance(state, alreadyPicked = []) {
  const taken = new Set(alreadyPicked.map((c) => c.instanceId || c));
  const pool = returnableCards(state, state.pendingReturn?.filter || null)
    .filter((c) => !taken.has(c.instanceId))
    .sort((a, b) => rememberPriority(a) - rememberPriority(b));
  return pool[0]?.instanceId || null;
}

/** Card to give up when an effect asks for a discard or Repress from hand: cheapest, never an ally first. */
export function pickHandLoss(player, pending) {
  const picked = new Set((pending?.picked || []).map((c) => c.instanceId));
  const filter = pending?.cardFilter || null;
  const pool = (player?.hand || []).filter((c) => !picked.has(c.instanceId))
    .filter((c) => !filter?.payablePsyche || (c.type !== "psyche-power" && c.type !== "object"))
    .filter((c) => !filter?.suit || c.suit === filter.suit || c.wild || String(c.id || "").startsWith("wild-"));
  const ranked = [...pool].sort((a, b) => lossCost(a) - lossCost(b));
  return ranked[0] || null;
}

function lossCost(card) {
  if (isDreambeastPsycheCard(card)) return 100 + (card.value || 0);
  if (card.wild || String(card.id || "").startsWith("wild-")) return 50;
  if (card.type === "psyche-power") return 40;
  return card.value || 0;
}

/** A Persistent Remember Object this Dreamer can tap (in play) or place (in hand). */
export function rememberObject(player, zone = "persistent") {
  const list = zone === "persistent" ? (player?.persistent || []) : (player?.objects || []);
  return list.find((o) => (o.remember || 0) > 0 && (zone === "persistent" || o.subtype === "persistent")) || null;
}

/** A Persistent Remember Object in play that has not tapped this Meet. */
export function rememberObjectReady(state, player) {
  const used = new Set(state.usedMeetActionsByPlayer?.[player?.id] || []);
  return (player?.persistent || []).find((o) => (o.remember || 0) > 0 && !used.has(`object:${o.instanceId}`)) || null;
}

/** Can this Dreamer Remember with an action right now (ready Object or open Memory tile underfoot)? */
export function canRememberNow(state, player, tileOf) {
  if (!player || !wantsRemember(state, player)) return false;
  if (rememberObjectReady(state, player)) return true;
  return memoryTileOpen(state, tileOf(player.landscapeId));
}

export function isMemoryTile(tile) {
  return !!tile && tile.uniqueAction === "remember-2" && tile.revealed && !tile.wasteland;
}

/** Memory tile whose action the table has not used this Meet. */
export function memoryTileOpen(state, tile) {
  if (!isMemoryTile(tile)) return false;
  return !(state.usedUniqueActionsThisMeet || []).includes(`remember-2@${tile.id}`);
}

export function memoryTiles(state) {
  return (state.board || []).filter(isMemoryTile);
}

/** Row Archetype with the fewest quests still false (ties: cheaper first). */
export function bestRowArchetype(state) {
  const row = rowArchetypes(state);
  if (!row.length) return null;
  const scored = row.map((arch) => {
    const missing = (arch.quests || []).filter((q) => !isQuestConditionMet(state, arch.id, q)).length;
    return { arch, missing, points: arch.points || 0 };
  });
  scored.sort((a, b) => (a.missing - b.missing) || (a.points - b.points));
  return scored[0].arch;
}

/** Row Archetype whose quests are all true right now. */
export function readyArchetype(state) {
  return rowArchetypes(state).find((arch) => (arch.quests || []).length
    && arch.quests.every((q) => isQuestConditionMet(state, arch.id, q))) || null;
}
