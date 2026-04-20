// Chamber progression config.
//
// Bile rise is slow enough that both builds can clear the chamber with
// consistent climbing. Debris knockbacks + hesitation eat into that margin.
// If Ironhide gets dunked in bile, their armor soaks ~1s per point of armor
// before HP starts melting (see climb.js / player.js submersion logic).
//
// Difficulty ramps three ways per chamber:
//   1. Bile rises faster.
//   2. Debris spawn interval tightens.
//   3. spawnCount grows - baseline number of telegraphs fired each cycle,
//      giving later chambers a rain of objects instead of a drizzle.
//   4. multiDebrisChance gives occasional bonus spawns.
//
// Palette shifts from blackish-purple (deep guts) toward reddish-pink
// (near the mouth, where daylight leaks through).

export const CHAMBERS = [
  {
    id: "stomach",
    name: "THE STOMACH",
    tagline: "Sloshing acid and lost adventurers.",
    climbHeight: 1600,
    bileRiseRate: 6.5,
    debrisInterval: [1.2, 2.0],
    debrisSpeed: 220,
    spawnCount: 1,              // base telegraphs per spawn cycle
    multiDebrisChance: 0.18,    // chance of +1 extra
    powerUpRarity: 0.14,        // chance a given spawn is a power-up instead
    acidTimer: 90,
    guardian: "gulletTentacle",
    wormTint: 1.05,
    // Darkest chamber: blackish purple, barely any light.
    palette: {
      deep:   "#08020a",
      mid:    "#22072a",
      bruise: "rgba(120, 50, 140, 0.14)",
      bump:   "rgba(170, 70, 190, 0.12)",
    },
  },
  {
    id: "lowerGut",
    name: "THE LOWER GUT",
    tagline: "Where the worm keeps its leftovers.",
    climbHeight: 1900,
    bileRiseRate: 8.5,
    debrisInterval: [1.0, 1.7],
    debrisSpeed: 270,
    spawnCount: 2,              // 2 objects per cycle now
    multiDebrisChance: 0.30,
    powerUpRarity: 0.11,
    acidTimer: 80,
    guardian: "zombieGoblin",
    wormTint: 0.95,
    // Purplish maroon. A little lighter, more red creeping in.
    palette: {
      deep:   "#1a0416",
      mid:    "#4a1040",
      bruise: "rgba(180, 60, 150, 0.18)",
      bump:   "rgba(210, 90, 180, 0.14)",
    },
  },
  {
    id: "heartHollow",
    name: "THE HEART-HOLLOW",
    tagline: "A thump-thump-thump louder than cannon fire.",
    climbHeight: 2200,
    bileRiseRate: 11,
    debrisInterval: [0.85, 1.5],
    debrisSpeed: 320,
    spawnCount: 2,
    multiDebrisChance: 0.45,    // nearly half of cycles drop 3
    powerUpRarity: 0.09,
    acidTimer: 70,
    guardian: "fleshHorror",
    wormTint: 1.1,
    // Heart chamber. Deep ventricle red.
    palette: {
      deep:   "#2a0812",
      mid:    "#6a1024",
      bruise: "rgba(220, 60, 80, 0.20)",
      bump:   "rgba(240, 100, 120, 0.16)",
    },
  },
  {
    id: "gullet",
    name: "THE GULLET",
    tagline: "Daylight peeks through its hungry maw.",
    climbHeight: 2500,
    bileRiseRate: 13.5,
    debrisInterval: [0.65, 1.15],
    debrisSpeed: 370,
    spawnCount: 3,              // 3 telegraphs per cycle, constant pressure
    multiDebrisChance: 0.55,
    powerUpRarity: 0.07,
    acidTimer: 65,
    guardian: "bileElemental",
    wormTint: 0.9,
    // Near the mouth. Reddish pink, daylight bleeding in.
    palette: {
      deep:   "#3a0a1a",
      mid:    "#9a2a3e",
      bruise: "rgba(255, 120, 140, 0.22)",
      bump:   "rgba(255, 160, 180, 0.20)",
    },
  },
];
