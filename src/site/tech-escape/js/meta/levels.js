/**
 * Level progression.
 *
 * Difficulty (FIELD TRIP / AFTER HOURS / SYSTEM CRASH) answers "how hard do the
 * hunters hit". A LEVEL answers "what room am I in" - it changes the shape of
 * the maze, which threat dominates, how dark it is, how much loot is lying
 * around, and how far apart the terminals sit. The two multiply, so AFTER HOURS
 * in the tunnels is a different night from AFTER HOURS in the computer lab.
 *
 * Every level is beatable on every difficulty. Levels unlock in order by
 * escaping the previous one, and the unlock is stored per player profile.
 */

import { LAYOUT } from '../config.js';

/**
 * `enemies` and `loot` are multipliers applied to the difficulty preset, with an
 * optional flat add for the threat a level is meant to be ABOUT. Densities are
 * fractions of the open floor.
 */
export const LEVELS = [
  {
    id: 'lab',
    name: 'THE COMPUTER LAB',
    codename: 'LEVEL 1',
    blurb: 'Where it started. Loops everywhere and a desk to hide under.',
    flavor: 'Room 214. Your own project is still open on one of these machines.',
    layout: { size: 17, loopChance: 0.38, rooms: 5, roomMin: 3, roomMax: 5 },
    fogScale: 0.92,
    brightnessScale: 1.1,
    tableDensity: 0.1,
    propDensity: 0.05,
    terminalSeparation: 6,
    enemies: { miceMult: 0.8, miceAdd: 0, virusMult: 0.5, virusAdd: 0 },
    loot: { cheetos: 1.2, batteries: 1.2, sodas: 1.2, antivirus: 1 },
    escalationScale: 0.8,
    threat: 'Mostly mice. One virus, if any.',
  },
  {
    id: 'servers',
    name: 'THE SERVER ROOM',
    codename: 'LEVEL 2',
    blurb: 'Narrow aisles, almost nowhere to hide, and things that walk through walls.',
    flavor: 'The racks are still warm. Whatever is in here does not need the doors.',
    // Low loop chance plus no carved rooms makes real corridors and dead ends
    layout: { size: 19, loopChance: 0.12, rooms: 1, roomMin: 3, roomMax: 4 },
    fogScale: 1.18,
    brightnessScale: 0.92,
    // Few desks is the whole point: hiding is scarce, so you have to keep moving
    tableDensity: 0.08,
    propDensity: 0.12,
    terminalSeparation: 7,
    enemies: { miceMult: 0.8, miceAdd: 0, virusMult: 1.4, virusAdd: 1 },
    loot: { cheetos: 1, batteries: 0.85, sodas: 1, antivirus: 1.5 },
    escalationScale: 1,
    threat: 'Virus country. Racks do not stop them, and desks are rare.',
  },
  {
    id: 'library',
    name: 'THE LIBRARY ANNEX',
    codename: 'LEVEL 3',
    blurb: 'Long sight lines, a desk in every direction, and far too many mice.',
    flavor: 'Study tables end to end. Something is knocking books off the shelves.',
    layout: { size: 21, loopChance: 0.44, rooms: 7, roomMin: 4, roomMax: 6 },
    fogScale: 0.85,
    brightnessScale: 1.05,
    tableDensity: 0.16,
    propDensity: 0.06,
    terminalSeparation: 8,
    enemies: { miceMult: 1.7, miceAdd: 1, virusMult: 0.5, virusAdd: 0 },
    loot: { cheetos: 1.1, batteries: 1, sodas: 1.2, antivirus: 0.5 },
    escalationScale: 1.1,
    threat: 'A swarm - but you can always reach a table.',
  },
  {
    id: 'tunnels',
    name: 'THE MAINTENANCE TUNNELS',
    codename: 'LEVEL 4',
    blurb: 'A real maze under the school. Dark, long, and short on supplies.',
    flavor: 'Conduit and dust. The terminals down here are further apart than they should be.',
    layout: { size: 23, loopChance: 0.07, rooms: 0, roomMin: 3, roomMax: 4 },
    fogScale: 1.3,
    brightnessScale: 0.82,
    tableDensity: 0.09,
    propDensity: 0.04,
    // Terminals deliberately far apart, so every code piece is a journey
    terminalSeparation: 9,
    enemies: { miceMult: 1.2, miceAdd: 0, virusMult: 1.2, virusAdd: 0 },
    loot: { cheetos: 0.8, batteries: 0.8, sodas: 0.8, antivirus: 1 },
    escalationScale: 1.15,
    threat: 'Both, and you will not see either one coming.',
  },
  {
    id: 'mainframe',
    name: 'THE MAINFRAME',
    codename: 'LEVEL 5',
    blurb: 'Wide open, well lit, and everything in the building is awake.',
    flavor: 'This is the thing that logged in. You can see it all coming - that is the problem.',
    layout: { size: 21, loopChance: 0.52, rooms: 8, roomMin: 4, roomMax: 7 },
    // Brighter than anywhere else on purpose: watching the swarm arrive is worse
    fogScale: 0.78,
    brightnessScale: 1.15,
    tableDensity: 0.12,
    propDensity: 0.07,
    terminalSeparation: 7,
    enemies: { miceMult: 1.5, miceAdd: 1, virusMult: 1.5, virusAdd: 1 },
    loot: { cheetos: 1.1, batteries: 1.1, sodas: 1.2, antivirus: 1.5 },
    escalationScale: 1.3,
    threat: 'Everything at once, in a room with no corners.',
  },
];

export const LEVEL_COUNT = LEVELS.length;

/** Clamps an index into the table so a bad save can never crash a run. */
export function getLevel(index) {
  const i = Number.isFinite(index) ? Math.round(index) : 0;
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, i))];
}

export function levelIndexById(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i < 0 ? 0 : i;
}

/** Maze constructor options for a level, filled in from LAYOUT defaults. */
export function layoutFor(level) {
  return { ...LAYOUT, ...(level?.layout || null) };
}

/**
 * Concrete spawn counts for a level+difficulty pair. Enemy counts never drop
 * below one of each, and loot never drops below one of anything the difficulty
 * offers at all, so no combination can produce an unplayable run.
 */
export function budgetFor(level, diff) {
  const e = level?.enemies || {};
  const l = level?.loot || {};
  const lootCount = (base, mult) => {
    if (!base) return 0;
    return Math.max(1, Math.round(base * (mult ?? 1)));
  };
  return {
    mice: Math.max(1, Math.round(diff.mice * (e.miceMult ?? 1)) + (e.miceAdd || 0)),
    viruses: Math.max(1, Math.round(diff.viruses * (e.virusMult ?? 1)) + (e.virusAdd || 0)),
    cheetos: lootCount(diff.cheetos, l.cheetos),
    batteries: lootCount(diff.batteries, l.batteries),
    sodas: lootCount(diff.sodas ?? 0, l.sodas),
    antivirus: lootCount(diff.antivirus ?? 0, l.antivirus),
    escalationPerPiece: diff.escalationPerPiece * (level?.escalationScale ?? 1),
  };
}

/**
 * A difficulty preset merged with a level's budget, shaped exactly like the
 * plain DIFFICULTY object the entities already expect. Passing this instead of
 * the raw preset means mice, viruses and the player need no idea levels exist.
 */
export function runProfile(level, diff) {
  const b = budgetFor(level, diff);
  return {
    ...diff,
    mice: b.mice,
    viruses: b.viruses,
    cheetos: b.cheetos,
    batteries: b.batteries,
    sodas: b.sodas,
    antivirus: b.antivirus,
    escalationPerPiece: b.escalationPerPiece,
    levelId: level.id,
    levelName: level.name,
  };
}
