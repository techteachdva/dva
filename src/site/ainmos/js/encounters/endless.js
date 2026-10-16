/**
 * Ainmos 0.25: Endless Mode.
 *
 * After you wake, you may keep dreaming. The night grows Cycle by Cycle:
 * each one is a Dream, a Dreambeast (the rest of the Boss ladder first, then
 * any beast left in the Mindstream), and an Archetype Dream while Archetypes
 * remain. Once every Archetype is gone from the deck, each Cycle ends with a
 * new Leviathan instead, each more broken than the last:
 *
 *   Leviathan+ (13) → Leviathan_x (14) → LeviaTHAN (16) → L3V1@+H@N (20)
 *   → L3V1@+H@N D3$TR0Y3R 0F DR3@M$ (99)
 *
 * The run ends when you lose, or when the last one falls.
 * Leviathan Power is printed, not grown by the Cycle.
 */

import { uid, archetypeDreamCard } from "../core/data.js";
import { BOSS_LADDER, bossDreamCard } from "./boss-ladder.js";
import { addLog } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { random } from "../core/rng.js";

export const ENDLESS_LEVIATHANS = Object.freeze([
  {
    tier: 1,
    id: "leviathan-plus",
    name: "Leviathan+",
    power: 13,
    image: "art/endless/leviathan-plus.webp",
    ward: { formId: "chord", amount: 5 },
    flavor: "It came back. It always comes back.",
  },
  {
    tier: 2,
    id: "leviathan-x",
    name: "Leviathan_x",
    power: 14,
    image: "art/endless/leviathan-x.webp",
    ward: { formId: "echo", amount: 5 },
    flavor: "The tide forgets its own name, and remembers yours.",
  },
  {
    tier: 3,
    id: "leviathan-caps",
    name: "LeviaTHAN",
    power: 16,
    image: "art/endless/leviathan-caps.webp",
    ward: { formId: "trinity", amount: 5 },
    flavor: "IT IS LOUDER NOW.",
  },
  {
    tier: 4,
    id: "l3v1athan",
    name: "L3V1@+H@N",
    power: 20,
    image: "art/endless/l3v1athan.webp",
    ward: { formId: "trifecta", amount: 5 },
    flavor: "3RR0R: dr3@m n0t f0und. c0nt1nu3 dr3@m1ng?",
  },
  {
    tier: 5,
    id: "l3v1athan-destroyer",
    name: "L3V1@+H@N D3$TR0Y3R 0F DR3@M$",
    power: 99,
    image: "art/endless/l3v1athan-destroyer.webp",
    ward: { formId: "all", amount: 5 },
    flavor: "W@K3 UP. W@K3 UP. W@K3 UP.",
  },
]);

export const FINAL_TIER = ENDLESS_LEVIATHANS.length;

/** Score for felling each Leviathan, by tier. */
export const LEVIATHAN_POINTS = Object.freeze([10, 15, 25, 40, 99]);

export function isEndless(state) {
  return !!state?.endless;
}

export function megaLeviathan(tier) {
  return ENDLESS_LEVIATHANS.find((l) => l.tier === tier) || null;
}

/** The Boss Dream card for one of the Endless Leviathans. */
export function megaLeviathanCard(tier, ante) {
  const def = megaLeviathan(tier);
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    suit: "lucidity",
    beastKind: "nightmare",
    flavor: def.flavor,
    image: def.image,
    type: "boss-dream",
    boss: true,
    megaTier: def.tier,
    fixedPower: true,
    ward: { ...def.ward },
    ante,
    accept: def.power,
    reject: def.power,
    repress: def.power,
    twist: "Rising tide",
    twistText: "Each dusk any Leviathan stands, the edge Landscape farthest from The Bed is Forgotten.",
    instanceId: uid("mega"),
  };
}

function planEntry(card, ante) {
  return {
    kind: card.type === "archetype-dream" ? "archetype" : card.boss ? "beast" : "dream",
    instanceId: card.instanceId,
    boss: !!card.boss,
    bossId: card.boss ? card.id : null,
    name: card.name,
    image: card.image,
    suit: card.boss ? card.suit : null,
    ante,
    mini: null,
    mega: card.megaTier || null,
  };
}

function ordinaryDream(state) {
  const pool = [...(state.dreamDiscard || []), ...(state.dreamDeck || [])]
    .filter((c) => c && c.type === "dream" && !c.boss);
  if (!pool.length) {
    return { id: "quiet", name: "Quiet", type: "dream", image: "images/dreams/quiet.webp", text: "Nothing stirs.", instanceId: uid("dream") };
  }
  const pick = pool[Math.floor(random() * pool.length)];
  const { chosen, miniBoss, miniSpawned, ...card } = pick;
  return { ...card, instanceId: uid("dream") };
}

/** The next Dreambeast for an Endless Cycle: the rest of the ladder, then any Mindstream beast. */
function endlessBeast(state, ante) {
  const used = new Set((state.nightPlan || []).filter((p) => p.bossId).map((p) => p.bossId));
  const entry = BOSS_LADDER.find((rung) => !used.has(rung.id));
  const catalog = state.endless?.beastCatalog || {};
  if (entry && catalog[entry.id]) {
    return { ...bossDreamCard(catalog[entry.id], entry, uid), ante, awake: undefined };
  }
  const pool = state.nightmarePool || [];
  if (!pool.length) return null;
  const index = Math.floor(random() * pool.length);
  const [beast] = pool.splice(index, 1);
  const { called, basePower, cycleBonus, ward, ...card } = beast;
  return {
    ...card,
    type: "boss-dream",
    boss: true,
    endlessBeast: true,
    ante,
    instanceId: uid("boss"),
  };
}

function plannedCycles(state) {
  return Math.ceil((state.nightPlan || []).length / 3);
}

/** Has every Archetype been called out of the deck and Acquired? */
export function archetypesExhausted(state) {
  const standing = (state.board || []).some((tile) => (tile.finalArchetypes || []).some((a) => a && !a.defeated));
  return !(state.archetypeDeck || []).length && !standing && !state.pendingArchetypeChoice;
}

/**
 * Add one more Cycle (always three cards: Dream, Dreambeast, closer) to the end
 * of the Dream Deck and the Night Bar. The closer is an Archetype Dream while
 * Archetypes wait in the deck, the next Leviathan once every Archetype is
 * Acquired, and otherwise one more Dream.
 */
export function appendEndlessCycle(state) {
  const ante = plannedCycles(state) + 1;
  const cards = [ordinaryDream(state), endlessBeast(state, ante) || ordinaryDream(state)];
  const plannedArchetypes = (state.dreamDeck || []).filter((c) => c.type === "archetype-dream").length;
  if ((state.archetypeDeck || []).length > plannedArchetypes) {
    cards.push(archetypeDreamCard(ante));
  } else if (archetypesExhausted(state) && (state.endless.tierPlanned || 0) < FINAL_TIER) {
    state.endless.tierPlanned = (state.endless.tierPlanned || 0) + 1;
    cards.push(megaLeviathanCard(state.endless.tierPlanned, ante));
  } else {
    cards.push(ordinaryDream(state));
  }
  if (cards.some((card) => !card)) return 0;
  state.dreamDeck.push(...cards);
  state.nightPlan.push(...cards.map((card) => planEntry(card, ante)));
  if (state.deckCaps) state.deckCaps.dream = Math.max(state.deckCaps.dream || 0, state.dreamDeck.length);
  return cards.length;
}

/** Keep at least one full Cycle waiting in the Dream Deck. */
export function ensureEndlessDeck(state) {
  if (!isEndless(state) || state.status !== "playing") return;
  let guard = 4;
  while ((state.dreamDeck || []).length < 3 && guard-- > 0) {
    if (!appendEndlessCycle(state)) break;
  }
}

/** Keep dreaming after waking. `beastCatalog` maps ladder ids to their Dreambeast cards. */
export function startEndless(state, { beastCatalog = {} } = {}) {
  if (!state || state.endless) return false;
  state.endless = {
    startedRound: state.round,
    startedCycle: plannedCycles(state),
    goalAtWake: state.acquiredPoints || 0,
    tierPlanned: 0,
    tiersFelled: [],
    beastCatalog,
  };
  state.status = "playing";
  state.longNight = false;
  state.longNightRounds = 0;
  state.endlessTriumph = false;
  ensureEndlessDeck(state);
  logMoment(state, "You do not wake. Not yet. The dream goes on, and it remembers you.", { boss: true, durationMs: 9000 });
  addLog(state, "Endless Mode: Archetypes and Dreambeasts keep coming. Once every Archetype is yours, each Cycle ends with a Leviathan.");
  return true;
}

/** A Leviathan of the Endless ladder falls. The last one ends the dream for good. */
export function noteLeviathanFelled(state, encounter) {
  if (!isEndless(state) || !encounter?.megaTier) return false;
  const felled = state.endless.tiersFelled || (state.endless.tiersFelled = []);
  if (!felled.includes(encounter.megaTier)) felled.push(encounter.megaTier);
  if (encounter.megaTier === FINAL_TIER) {
    state.endlessTriumph = true;
    state.status = "won";
    addLog(state, "L3V1@+H@N D3$TR0Y3R 0F DR3@M$ falls. The dream has nothing left to dream.");
    return true;
  }
  logMoment(state, `${encounter.name} falls. Something worse is already rising.`, { boss: true });
  return false;
}

export function endlessPoints(state) {
  return (state?.endless?.tiersFelled || []).reduce((sum, tier) => sum + (LEVIATHAN_POINTS[tier - 1] || 0), 0);
}

/** "Endless · Leviathan+ next" style status for the HUD. */
export function endlessStatusText(state) {
  if (!isEndless(state)) return "";
  const felled = (state.endless.tiersFelled || []).length;
  if (!archetypesExhausted(state) && (state.archetypeDeck || []).length) {
    return `Endless · ${(state.archetypeDeck || []).length} Archetype${(state.archetypeDeck || []).length === 1 ? "" : "s"} left in the deck`;
  }
  const next = megaLeviathan((state.endless.tierPlanned || 0) + 1);
  return next ? `Endless · ${felled} Leviathan${felled === 1 ? "" : "s"} felled · ${next.name} comes next` : `Endless · ${felled} of ${FINAL_TIER} Leviathans felled`;
}
