// Chamber progression config.
//
// Bile rise timing target (with H=800, hero y ~= 620, death band ~180px of screen):
//   - Chamber 0 (easy)  : ~12-14s margin before bile reaches you for IRON build
//   - Chamber 3 (final) : ~3-5s margin for IRON build (white-knuckle)
//   Swift always has 30-40% more margin than Iron since Swift climbs faster.

export const CHAMBERS = [
  {
    id: "stomach",
    name: "THE STOMACH",
    tagline: "Sloshing acid and lost adventurers.",
    climbHeight: 1100,          // pixels of "wall" progress to clear
    bileRiseRate: 10,           // px/sec of vertical bile rise (slow, at bottom)
    debrisInterval: [1.6, 2.8], // seconds between falling debris
    debrisSpeed: 220,
    acidTimer: 90,              // seconds of "safe" before armor/flesh starts corroding
    guardian: "gulletTentacle",
    wormTint: 1.05,
  },
  {
    id: "lowerGut",
    name: "THE LOWER GUT",
    tagline: "Where the worm keeps its leftovers.",
    climbHeight: 1300,
    bileRiseRate: 13,
    debrisInterval: [1.3, 2.3],
    debrisSpeed: 270,
    acidTimer: 80,
    guardian: "zombieGoblin",
    wormTint: 0.95,
  },
  {
    id: "heartHollow",
    name: "THE HEART-HOLLOW",
    tagline: "A thump-thump-thump louder than cannon fire.",
    climbHeight: 1500,
    bileRiseRate: 16,
    debrisInterval: [1.0, 1.9],
    debrisSpeed: 320,
    acidTimer: 70,
    guardian: "fleshHorror",
    wormTint: 1.1,
  },
  {
    id: "gullet",
    name: "THE GULLET",
    tagline: "Daylight peeks through its hungry maw.",
    climbHeight: 1700,
    bileRiseRate: 19,
    debrisInterval: [0.8, 1.6],
    debrisSpeed: 370,
    acidTimer: 65,
    guardian: "bileElemental",
    wormTint: 0.9,
  },
];
