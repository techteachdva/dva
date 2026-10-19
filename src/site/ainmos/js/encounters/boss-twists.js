/**
 * Ainmos Boss twists: each ladder Boss bends one rule while it stands.
 *
 *   Winged Turtle  none: a plain Power 3 Dreambeast, the first lesson
 *   Shadows        Lucidity Landscape actions go dark
 *   Jackalope      hops 2 hexes at the start of each Meet
 *   Baku           at dusk, eats the next ordinary Dream of the night
 *   Mindless       Dreamer stats add nothing against it
 *   Devourer       at dusk, the table Discards 1 Object in play
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
import { standingTwists, beastTwist } from "./beast-twists.js";
import { spendPowerTokens } from "../cards/power-tokens.js";
import { BEAST_POWER_CAP } from "./beast-wards.js";

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
  if (!tile || actionId === "draw-mindstream" || actionId === "call-dreambeast") return "";
  if (tile.suit === "lucidity" && bossStands(state, "shadows")) {
    return `The Shadows darken ${tile.name}. Its own action is shut while they stand; Calling a Dreambeast still works.`;
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
  return bossId(encounter) === "jackalope" || beastTwist(encounter)?.kind === "hop";
}

/** The Pooka (and any "hop" beast) hops 1 hex to a revealed Landscape. */
function hopTricksters(state) {
  standingTwists(state, "hop").forEach(({ tile, encounter }) => {
    const open = (state.board || []).filter((t) => t.id !== tile.id && t.revealed && !t.wasteland && hexDistance(t, tile) === 1);
    if (!open.length) return;
    const dest = open[Math.floor(random() * open.length)];
    moveEncounterBetweenLandscapes(state, tile.id, dest.id, encounter);
    logMoment(state, `${encounter.name} hops to ${dest.name}.`, { boss: true });
  });
}

export function applyBossTwistsAtMeetStart(state) {
  hopJackalope(state);
  hopTricksters(state);
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
    message: "Discard 1 Object in play. The table chooses which.",
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

function leviathanStands(state) {
  return allEncountersOnBoard(state).some(({ encounter }) => encounter?.boss && (bossId(encounter) === "leviathan" || encounter.megaTier));
}

function leviathanRises(state, forgetTileFn) {
  if (!leviathanStands(state)) return;
  const bed = landscapeById(state, "bed");
  const edges = (state.board || []).filter((t) => !t.center && t.id !== "bed" && t.revealed && !t.wasteland);
  if (!edges.length || !bed) return;
  const far = [...edges].sort((a, b) => hexDistance(b, bed) - hexDistance(a, bed))[0];
  forgetTileFn?.(state, far);
  logMoment(state, `The tide rises. ${far.name} is Forgotten.`, { boss: true });
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

// ---- Every Dreambeast's own twist (0.30) -------------------------------------

function soloDreamer(state) {
  return (state.players || []).find((p) => p.alive) || null;
}

function psycheInHand(player) {
  return (player?.hand || []).filter((c) => c.type !== "object" && c.type !== "psyche-power" && !c.isDreambeastPsyche && c.type !== "psyche-dreambeast");
}

/** Forget one Landscape next to this beast that no Dreamer stands on. */
function forgetNextTo(state, tile, encounter, forgetTileFn) {
  const occupied = new Set((state.players || []).filter((p) => p.alive).map((p) => p.landscapeId));
  const near = (state.board || []).filter((t) => t.id !== tile.id && !t.center && t.id !== "bed"
    && t.revealed && !t.wasteland && !occupied.has(t.id) && hexDistance(t, tile) === 1);
  if (!near.length || !forgetTileFn) return;
  const lost = near[Math.floor(random() * near.length)];
  forgetTileFn(state, lost);
  logMoment(state, `${encounter.name}: ${lost.name} is Forgotten.`, { boss: true });
}

/** Dusk: each standing beast's own twist, one clear line each. */
export function applyBeastTwistsAtDusk(state, helpers = {}) {
  const me = soloDreamer(state);
  standingTwists(state).forEach(({ tile, encounter, twist }) => {
    switch (twist.kind) {
      case "dusk-grow": {
        const now = Number(encounter.accept) || 0;
        if (now >= BEAST_POWER_CAP) return;
        const next = Math.min(BEAST_POWER_CAP, now + twist.n);
        encounter.accept = next;
        encounter.reject = next;
        encounter.repress = next;
        encounter.cycleBonus = (encounter.cycleBonus || 0) + (next - now);
        logMoment(state, `${encounter.name} grows under the moon: Power ${next}.`, { boss: true });
        return;
      }
      case "dusk-repress-hand":
        if (!me || !psycheInHand(me).length) return;
        enqueueRepressFromHand(state, me, twist.n, { reason: `${encounter.name}: Repress ${twist.n} Psyche.`, strict: true });
        return;
      case "dusk-object-hand": {
        const obj = (me?.objects || [])[0];
        if (!obj) return;
        me.objects = me.objects.filter((o) => o !== obj);
        repressCard(state, obj);
        logMoment(state, `${encounter.name} hoards your ${obj.name}.`, { boss: true });
        return;
      }
      case "dusk-forget-near":
        forgetNextTo(state, tile, encounter, helpers.forgetTile);
        return;
      case "dusk-glimmer": {
        const lost = Math.min(state.glimmer || 0, twist.n);
        if (!lost) return;
        state.glimmer -= lost;
        logMoment(state, `${encounter.name} watches. −${lost} Glimmer.`, { boss: true });
        return;
      }
      case "dusk-token":
        if (!me || (me.powerTokens || 0) < 1) return;
        spendPowerTokens(state, me, twist.n, { reason: encounter.name });
        logMoment(state, `${encounter.name} drains a Power Token.`, { boss: true });
        return;
      case "dusk-discard-hand": {
        const cards = psycheInHand(me);
        if (!cards.length) return;
        const card = cards[Math.floor(random() * cards.length)];
        me.hand = me.hand.filter((c) => c.instanceId !== card.instanceId);
        state.psycheDiscard.push(card);
        logMoment(state, `${encounter.name} takes ${card.name}.`, { boss: true });
        return;
      }
      default:
    }
  });
}

/** You lost a fight to this beast: its own loss twist, if it has one. */
export function applyBeastTwistOnLoss(state, actor, encounter, tile) {
  const twist = beastTwist(encounter);
  if (!twist || !actor) return;
  if (twist.kind === "loss-repress-hand" && psycheInHand(actor).length) {
    enqueueRepressFromHand(state, actor, twist.n, { reason: `${encounter.name}: Repress ${twist.n} Psyche.`, strict: true });
  } else if (twist.kind === "loss-object") {
    const obj = (actor.persistent || [])[0];
    if (!obj) return;
    actor.persistent = actor.persistent.filter((o) => o !== obj);
    repressCard(state, obj);
    logMoment(state, `${encounter.name} smashes your ${obj.name}.`, { boss: true });
  } else if (twist.kind === "loss-teleport" && tile) {
    const open = (state.board || []).filter((t) => t.id !== tile.id && t.revealed && !t.wasteland && !t.center && t.id !== "bed");
    if (!open.length) return;
    const dest = open[Math.floor(random() * open.length)];
    moveEncounterBetweenLandscapes(state, tile.id, dest.id, encounter);
    logMoment(state, `${encounter.name} grins and slips away to ${dest.name}.`, { boss: true });
  }
}
