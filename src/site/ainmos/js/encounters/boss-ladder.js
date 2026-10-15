/**
 * Ainmos: the Boss ladder.
 *
 * A night is a run of Cycles. Each Cycle is two Dreams and then a Boss Dream.
 * The ladder climbs from rung 10 (easiest) to rung 1 (Leviathan). Shorter
 * nights stop partway up: Daydream ends on rung 7, Nap on rung 4.
 *
 * Power climbs with the rung. A fight is about 40% at equal Power and about
 * 53% at Power + 2 whatever the size, so higher Power mostly means more Psyche
 * spent. Each Boss also carries a twist (rules text here, engine in A6).
 */

export const BOSS_LADDER = Object.freeze([
  {
    rung: 10,
    id: "winged-turtle",
    power: 4,
    stack: [2, 3, 4],
    twist: "All the way down",
    twistText: "Three turtles stand stacked. Beat the Power 2, then the 3, then the 4.",
  },
  {
    rung: 9,
    id: "shadows",
    power: 7,
    twist: "Lights out",
    twistText: "While the Shadows stand, Lucidity Landscape actions go dark.",
  },
  {
    rung: 8,
    id: "jackalope",
    power: 7,
    twist: "Hop",
    twistText: "At the start of each Meet, the Jackalope hops 2 hexes. A tight Dreamscape corners it.",
  },
  {
    rung: 7,
    id: "baku",
    power: 8,
    twist: "Dream eater",
    twistText: "If the Baku stands at dusk, it eats the next card of the Dream Deck.",
  },
  {
    rung: 6,
    id: "mindless",
    power: 9,
    twist: "No mind",
    twistText: "Dreamer stats add nothing against the Mindless.",
  },
  {
    rung: 5,
    id: "devourer",
    power: 9,
    twist: "Hunger",
    twistText: "If the Devourer stands at dusk, the table Discards 1 Object in play.",
  },
  {
    rung: 4,
    id: "bogey",
    power: 10,
    twist: "Under the Bed",
    twistText: "While the Bogey stands, The Bed's action is shut, and anyone ending Meet on The Bed Represses 1 Psyche.",
  },
  {
    rung: 3,
    id: "cerberus",
    power: 11,
    twist: "The gate",
    twistText: "While Cerberus stands, no one enters or leaves The Bed.",
  },
  {
    rung: 2,
    id: "double",
    power: 11,
    twist: "Mirror",
    twistText: "The Double gains Power equal to the fighter's matching stat.",
  },
  {
    rung: 1,
    id: "leviathan",
    power: 12,
    twist: "Rising tide",
    twistText: "Each dusk Leviathan stands, the edge Landscape farthest from The Bed is Forgotten.",
  },
]);

/** Mini-Boss Power by Cycle: two under that Cycle's Boss, two in the first. */
const MINI_BOSS_POWER = Object.freeze([3, 5, 5, 6, 7, 7, 8, 9, 9, 10]);

export function miniBossPower(ante) {
  return MINI_BOSS_POWER[Math.max(0, Math.min(MINI_BOSS_POWER.length - 1, (ante || 1) - 1))];
}

/** Cycles per night length. Each Cycle is 2 Dreams + 1 Boss Dream. */
export const ANTES_BY_LENGTH = Object.freeze({ daydream: 3, nap: 7, deep: 15 });
export const DREAMS_PER_ANTE = 2;

const BY_ID = new Map(BOSS_LADDER.map((rung) => [rung.id, rung]));

export function antesForLength(lengthKey) {
  return ANTES_BY_LENGTH[lengthKey] || ANTES_BY_LENGTH.daydream;
}

/** The Bosses a night of this length will meet, in order (rung 10 first). */
export function ladderForLength(lengthKey) {
  return BOSS_LADDER.slice(0, Math.min(BOSS_LADDER.length, antesForLength(lengthKey)));
}

export function finalBossForLength(lengthKey) {
  const ladder = ladderForLength(lengthKey);
  return ladder[ladder.length - 1];
}

export function ladderEntry(id) {
  return BY_ID.get(id) || null;
}

export function isLadderBoss(cardOrId) {
  const id = typeof cardOrId === "string" ? cardOrId : (cardOrId?.refId || cardOrId?.id);
  return BY_ID.has(id);
}

/** The Cycle (1-based) a ladder Boss closes. */
export function anteForBoss(id) {
  const entry = ladderEntry(id);
  return entry ? 11 - entry.rung : null;
}

/** Boss Dream card for a ladder rung, built from the Dreambeast's own card. */
export function bossDreamCard(beast, entry, uidFn) {
  return {
    ...beast,
    type: "boss-dream",
    boss: true,
    bossRung: entry.rung,
    ante: 11 - entry.rung,
    accept: entry.stack?.[0] ?? entry.power,
    reject: entry.stack?.[0] ?? entry.power,
    repress: entry.stack?.[0] ?? entry.power,
    stackIndex: entry.stack ? 0 : undefined,
    twist: entry.twist,
    twistText: entry.twistText,
    instanceId: uidFn("boss"),
    awake: entry.id === "leviathan" ? false : undefined,
  };
}
