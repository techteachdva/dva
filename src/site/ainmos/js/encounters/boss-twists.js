/**
 * Ainmos Boss twists: each ladder Boss bends one rule while it stands.
 *
 *   Winged Turtle  three stacked fights, Power 1, then 2, then 3
 *   Shadows        Lucidity Landscape actions go dark
 *   Jackalope      hops 2 hexes at the start of each Meet
 *   Baku           at dusk, eats the next ordinary Dream of the night
 *   Mindless       Dreamer stats add nothing against it
 *   Devourer       at dusk, the table Represses 1 Object in play
 *   Bogey          The Bed's action is shut; ending Meet on The Bed Represses 1
 *   Cerberus       no one enters or leaves The Bed
 *   Double         gains Power equal to the fighter's matching stat
 *   Leviathan      at dusk, the edge Landscape farthest from The Bed is Forgotten
 */

import {
  addLog,
  allEncountersOnBoard,
  landscapeById,
  moveEncounterBetweenLandscapes,
} from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { hexDistance } from "../core/hex.js";
import { random } from "../core/rng.js";
import { ladderEntry } from "./boss-ladder.js";
import { repressCard, enqueueRepressFromHand } from "../dreamers/subconscious.js";
import { offerEffectChoice, registerEffectResolver } from "../effects/effect-choices.js";

function bossId(encounter) {
  return encounter?.refId || encounter?.id;
}

/** The ladder Boss with this id, if it stands anywhere on the Dreamscape. */
export function standingBoss(state, id) {
  return allEncountersOnBoard(state).find(({ encounter }) => encounter?.boss && bossId(encounter) === id) || null;
}

export function bossStands(state, id) {
  return !!standingBoss(state, id);
}

// ---- Fights --------------------------------------------------------------

/** Mindless: the fighter's stat adds nothing. */
export function statIgnoredBy(encounter) {
  return bossId(encounter) === "mindless";
}

/** Double: the beast gains the fighter's matching stat. */
export function bossExtraPower(encounter, fighterStat) {
  return bossId(encounter) === "double" ? Math.max(0, fighterStat || 0) : 0;
}

/** Turtle stack: the opening Power of a fresh Boss card. */
export function openingBossPower(entry) {
  return entry?.stack?.length ? entry.stack[0] : entry?.power;
}

/**
 * Winged Turtle: a win against a turtle with more beneath it reveals the next
 * one instead of ending the fight. Returns true when the stack goes on.
 */
export function advanceBossStack(state, encounter, tile) {
  const entry = ladderEntry(bossId(encounter));
  const stack = entry?.stack;
  if (!stack?.length) return false;
  const index = encounter.stackIndex || 0;
  if (index >= stack.length - 1) return false;
  const next = index + 1;
  encounter.stackIndex = next;
  encounter.accept = stack[next];
  encounter.reject = stack[next];
  encounter.repress = stack[next];
  logMoment(state, `The turtle falls away. Another stands beneath it, larger: Power ${stack[next]}. (${stack.length - next} left)`, { boss: true });
  addLog(state, `${encounter.name} on ${tile?.name || "the Dreamscape"}: the next turtle is Power ${stack[next]}.`);
  return true;
}

// ---- Movement and Landscape actions ------------------------------------------

/** Cerberus: no one enters or leaves The Bed. Returns a reason, or "". */
export function moveBlockedByBoss(state, fromId, toId) {
  if (fromId === toId) return "";
  if ((fromId === "bed" || toId === "bed") && bossStands(state, "cerberus")) {
    return "Cerberus guards The Bed. No one enters or leaves while it stands.";
  }
  return "";
}

/** Shadows dim Lucidity actions; the Bogey shuts The Bed. Returns a reason, or "". */
export function landscapeActionBlockedByBoss(state, tile, actionId) {
  if (!tile || actionId === "draw-mindstream") return "";
  if (tile.suit === "lucidity" && bossStands(state, "shadows")) {
    return `The Shadows darken ${tile.name}. Its action is shut while they stand. Draw Mindstream still works.`;
  }
  if ((tile.id === "bed" || tile.center) && bossStands(state, "bogey")) {
    return "The Bogey is under The Bed. Its action is shut while the Bogey stands.";
  }
  return "";
}

// ---- Start of Meet -------------------------------------------------------------

/** Jackalope: hops 2 hexes. A tight Dreamscape corners it. */
function hopJackalope(state) {
  const found = standingBoss(state, "jackalope");
  if (!found) return;
  const { tile, encounter } = found;
  const open = (state.board || []).filter((t) => t.id !== tile.id && t.revealed && !t.wasteland);
  const two = open.filter((t) => hexDistance(t, tile) === 2);
  const one = open.filter((t) => hexDistance(t, tile) === 1);
  const pool = two.length ? two : one;
  if (!pool.length) {
    addLog(state, "The Jackalope is cornered. It cannot hop.");
    return;
  }
  const dest = pool[Math.floor(random() * pool.length)];
  moveEncounterBetweenLandscapes(state, tile.id, dest.id, encounter);
  logMoment(state, `The Jackalope hops to ${dest.name}.`, { boss: true });
}

/** Bosses that move on their own at the start of Meet (they skip the normal step). */
export function bossSkipsStep(encounter) {
  return bossId(encounter) === "jackalope";
}

export function applyBossTwistsAtMeetStart(state) {
  hopJackalope(state);
}

// ---- Dusk -----------------------------------------------------------------------

function bakuEatsADream(state, discardDream, popDream) {
  if (!bossStands(state, "baku")) return;
  const card = popDream?.(state, { fromTop: true });
  if (!card) return;
  discardDream?.(state, card);
  logMoment(state, `The Baku eats a Dream: ${card.name} is gone from the night.`, { boss: true });
}

function devourerHungers(state) {
  if (!bossStands(state, "devourer")) return;
  const held = [];
  state.players.forEach((p) => {
    if (!p.alive) return;
    (p.persistent || []).forEach((obj) => held.push({ player: p, obj }));
  });
  if (!held.length) {
    addLog(state, "The Devourer finds no Object in play to eat.");
    return;
  }
  const chooser = held[0].player;
  offerEffectChoice(state, chooser, {
    cardId: "devourer-hunger",
    title: "The Devourer hungers",
    message: "Repress 1 Object in play. The table chooses which.",
    choices: held.map(({ player, obj }) => ({ id: `${player.id}:${obj.instanceId}`, label: `${obj.name} (${player.name})` })),
  });
}

registerEffectResolver("devourer-hunger", (state, choiceId) => {
  state.pendingEffectChoice = null;
  const [playerId, instanceId] = String(choiceId || "").split(":");
  const player = state.players.find((p) => p.id === playerId);
  const obj = player?.persistent?.find((o) => o.instanceId === instanceId);
  if (!player || !obj) return true;
  player.persistent = player.persistent.filter((o) => o.instanceId !== instanceId);
  repressCard(state, obj);
  logMoment(state, `The Devourer eats ${obj.name}.`, { boss: true });
  return true;
});

function bogeyUnderTheBed(state) {
  if (!bossStands(state, "bogey")) return;
  state.players.forEach((p) => {
    if (!p.alive || p.landscapeId !== "bed") return;
    enqueueRepressFromHand(state, p, 1, {
      reason: `${p.name} ends Meet on The Bed with the Bogey beneath it. Repress 1 Psyche.`,
      strict: true,
    });
  });
}

function leviathanRises(state, forgetTileFn) {
  if (!bossStands(state, "leviathan")) return;
  const bed = landscapeById(state, "bed");
  const edges = (state.board || []).filter((t) => !t.center && t.id !== "bed" && t.revealed && !t.wasteland);
  if (!edges.length || !bed) return;
  const far = [...edges].sort((a, b) => hexDistance(b, bed) - hexDistance(a, bed))[0];
  forgetTileFn?.(state, far);
  logMoment(state, `Leviathan's tide rises. ${far.name} is Forgotten.`, { boss: true });
}

/**
 * Dusk twists. The helpers come from callers to avoid import cycles:
 * { discardDream, popDream, forgetTile }.
 */
export function applyBossTwistsAtDusk(state, helpers = {}) {
  bakuEatsADream(state, helpers.discardDream, helpers.popDream);
  devourerHungers(state);
  bogeyUnderTheBed(state);
  leviathanRises(state, helpers.forgetTile);
}
