/**
 * Level progression — each floor has its own maze shape, threat, visuals, and special enemy.
 */

import { LAYOUT } from '../config.js';

export const LEVELS = [
  {
    id: 'lab',
    name: 'THE COMPUTER LAB',
    codename: 'LEVEL 1',
    blurb: 'Where it started. Loops everywhere and a desk to hide under.',
    flavor: 'Room 214. Your own project is still open on one of these machines.',
    special: 'virus',
    layout: { size: 17, loopChance: 0.38, rooms: 5, roomMin: 3, roomMax: 5 },
    fogScale: 0.92,
    brightnessScale: 1.1,
    tableDensity: 0.1,
    propDensity: 0.05,
    terminalSeparation: 6,
    enemies: {
      miceMult: 0.75, miceAdd: 0,
      virusMult: 0.55, virusAdd: 1,
      bugsMult: 0, bugsAdd: 0,
      phishersMult: 0, phishersAdd: 0,
      cyberbulliesMult: 0, cyberbulliesAdd: 0,
    },
    loot: { cheetos: 1.25, batteries: 1.3, sodas: 1.2, antivirus: 1 },
    escalationScale: 0.75,
    threat: 'Mice and a lone virus. Map posters at dead ends.',
  },
  {
    id: 'servers',
    name: 'THE SERVER ROOM',
    codename: 'LEVEL 2',
    blurb: 'Narrow aisles and circuit beetles that sprint the racks.',
    flavor: 'The racks are still warm. Whatever is in here does not need the doors.',
    special: 'bug',
    layout: { size: 19, loopChance: 0.12, rooms: 1, roomMin: 3, roomMax: 4 },
    fogScale: 1.18,
    brightnessScale: 0.92,
    tableDensity: 0.08,
    propDensity: 0.12,
    terminalSeparation: 7,
    enemies: {
      miceMult: 0.7, miceAdd: 0,
      virusMult: 0, virusAdd: 0,
      bugsMult: 1.2, bugsAdd: 2,
      phishersMult: 0, phishersAdd: 0,
      cyberbulliesMult: 0, cyberbulliesAdd: 0,
    },
    loot: { cheetos: 1.1, batteries: 1.0, sodas: 1, antivirus: 1.4 },
    escalationScale: 0.95,
    threat: 'Circuit bugs — fast, but a whole cheetos bag kills one.',
  },
  {
    id: 'library',
    name: 'THE LIBRARY ANNEX',
    codename: 'LEVEL 3',
    blurb: 'Long sight lines and phishers casting lines from the stacks.',
    flavor: 'Study tables end to end. Something is knocking books off the shelves.',
    special: 'phisher',
    layout: { size: 21, loopChance: 0.44, rooms: 7, roomMin: 4, roomMax: 6 },
    fogScale: 0.85,
    brightnessScale: 1.05,
    tableDensity: 0.16,
    propDensity: 0.06,
    terminalSeparation: 8,
    enemies: {
      miceMult: 1.4, miceAdd: 0,
      virusMult: 0, virusAdd: 0,
      bugsMult: 0, bugsAdd: 0,
      phishersMult: 1.3, phishersAdd: 2,
      cyberbulliesMult: 0, cyberbulliesAdd: 0,
    },
    loot: { cheetos: 1.15, batteries: 1.1, sodas: 1.2, antivirus: 0.6 },
    escalationScale: 1.05,
    threat: 'Phishers steal loot or yank you from under a desk.',
  },
  {
    id: 'tunnels',
    name: 'THE MAINTENANCE TUNNELS',
    codename: 'LEVEL 4',
    blurb: 'A real maze under the school. Cyberbullies patrol the dark.',
    flavor: 'Conduit and dust. The terminals down here are further apart than they should be.',
    special: 'cyberbully',
    layout: { size: 23, loopChance: 0.07, rooms: 0, roomMin: 3, roomMax: 4 },
    fogScale: 1.3,
    brightnessScale: 0.82,
    tableDensity: 0.09,
    propDensity: 0.04,
    terminalSeparation: 9,
    enemies: {
      miceMult: 1.0, miceAdd: 0,
      virusMult: 0, virusAdd: 0,
      bugsMult: 0, bugsAdd: 0,
      phishersMult: 0, phishersAdd: 0,
      cyberbulliesMult: 1.25, cyberbulliesAdd: 2,
    },
    loot: { cheetos: 0.95, batteries: 1.0, sodas: 0.95, antivirus: 1 },
    escalationScale: 1.1,
    threat: 'Cyberbullies with bats — keep moving.',
  },
  {
    id: 'mainframe',
    name: 'THE MAINFRAME',
    codename: 'LEVEL 5',
    blurb: 'Wide open, well lit, and every threat in the building is awake.',
    flavor: 'This is the thing that logged in. You can see it all coming - that is the problem.',
    special: 'all',
    layout: { size: 21, loopChance: 0.52, rooms: 8, roomMin: 4, roomMax: 7 },
    fogScale: 0.78,
    brightnessScale: 1.15,
    tableDensity: 0.12,
    propDensity: 0.07,
    terminalSeparation: 7,
    enemies: {
      miceMult: 1.3, miceAdd: 1,
      virusMult: 0.9, virusAdd: 1,
      bugsMult: 0.8, bugsAdd: 1,
      phishersMult: 0.8, phishersAdd: 1,
      cyberbulliesMult: 0.8, cyberbulliesAdd: 1,
    },
    loot: { cheetos: 1.15, batteries: 1.15, sodas: 1.25, antivirus: 1.5 },
    escalationScale: 1.2,
    threat: 'Everything at once — use the map posters.',
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(index) {
  const i = Number.isFinite(index) ? Math.round(index) : 0;
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, i))];
}

export function levelIndexById(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i < 0 ? 0 : i;
}

export function layoutFor(level) {
  return { ...LAYOUT, ...(level?.layout || null) };
}

export function budgetFor(level, diff) {
  const e = level?.enemies || {};
  const l = level?.loot || {};
  const noEnemies = diff?.noEnemies === true;
  const lootScale = diff?.lootScale ?? 1;
  const enemyScale = diff?.enemyBudgetScale ?? 1;
  const lootCount = (base, mult) => {
    if (!base) return 0;
    return Math.max(1, Math.round(base * (mult ?? 1) * lootScale));
  };
  const enemyCount = (base, mult, add) => {
    if (noEnemies) return 0;
    const n = Math.round((Math.round(base * (mult ?? 1)) + (add || 0)) * enemyScale);
    return base ? Math.max(0, n) : 0;
  };
  return {
    mice: enemyCount(diff.mice, e.miceMult, e.miceAdd),
    viruses: enemyCount(diff.viruses, e.virusMult, e.virusAdd),
    bugs: enemyCount(2, e.bugsMult, e.bugsAdd),
    phishers: enemyCount(2, e.phishersMult, e.phishersAdd),
    cyberbullies: enemyCount(2, e.cyberbulliesMult, e.cyberbulliesAdd),
    cheetos: lootCount(diff.cheetos, l.cheetos),
    batteries: lootCount(diff.batteries, l.batteries),
    sodas: lootCount(diff.sodas ?? 0, l.sodas),
    antivirus: lootCount(diff.antivirus ?? 0, l.antivirus),
    escalationPerPiece: diff.escalationPerPiece * (level?.escalationScale ?? 1),
    specialEnemy: level?.special || 'virus',
  };
}

export function runProfile(level, diff, diffKey) {
  const b = budgetFor(level, diff);
  return {
    ...diff,
    key: diffKey || 'normal',
    mice: b.mice,
    viruses: b.viruses,
    bugs: b.bugs,
    phishers: b.phishers,
    cyberbullies: b.cyberbullies,
    cheetos: b.cheetos,
    batteries: b.batteries,
    sodas: b.sodas,
    antivirus: b.antivirus,
    escalationPerPiece: b.escalationPerPiece,
    specialEnemy: b.specialEnemy,
    levelId: level.id,
    levelName: level.name,
  };
}
