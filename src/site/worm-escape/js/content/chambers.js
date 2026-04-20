// Chamber progression config.
//
// Bile rise is slow enough that both builds can clear the chamber with
// consistent climbing. Debris knockbacks + hesitation eat into that margin.
// If Ironhide gets dunked in bile, their armor soaks ~1s per point of armor
// before HP starts melting (see climb.js / player.js submersion logic).
//
// Tuning targets (v0.7 - longer, meaner climbs with 5 columns):
//   Chamber 0: gentle learner's cliff. ~35-45s climb.
//   Chamber 3: white-knuckle sprint with multi-column debris. ~55-70s climb.

export const CHAMBERS = [
  {
    id: "stomach",
    name: "THE STOMACH",
    tagline: "Sloshing acid and lost adventurers.",
    climbHeight: 1600,          // pixels of "wall" progress to clear (was 1100)
    bileRiseRate: 6.5,          // px/sec of vertical bile rise (was 10)
    debrisInterval: [1.2, 2.0], // seconds between falling debris (was 1.6-2.8)
    debrisSpeed: 220,
    multiDebrisChance: 0.18,    // chance each spawn spawns an extra in another column
    acidTimer: 90,
    guardian: "gulletTentacle",
    wormTint: 1.05,
  },
  {
    id: "lowerGut",
    name: "THE LOWER GUT",
    tagline: "Where the worm keeps its leftovers.",
    climbHeight: 1900,          // was 1300
    bileRiseRate: 8.5,          // was 13
    debrisInterval: [1.0, 1.7], // was 1.3-2.3
    debrisSpeed: 270,
    multiDebrisChance: 0.28,
    acidTimer: 80,
    guardian: "zombieGoblin",
    wormTint: 0.95,
  },
  {
    id: "heartHollow",
    name: "THE HEART-HOLLOW",
    tagline: "A thump-thump-thump louder than cannon fire.",
    climbHeight: 2200,          // was 1500
    bileRiseRate: 11,           // was 16
    debrisInterval: [0.75, 1.4], // was 1.0-1.9
    debrisSpeed: 320,
    multiDebrisChance: 0.38,
    acidTimer: 70,
    guardian: "fleshHorror",
    wormTint: 1.1,
  },
  {
    id: "gullet",
    name: "THE GULLET",
    tagline: "Daylight peeks through its hungry maw.",
    climbHeight: 2500,          // was 1700
    bileRiseRate: 13.5,         // was 19
    debrisInterval: [0.6, 1.1], // was 0.8-1.6
    debrisSpeed: 370,
    multiDebrisChance: 0.5,     // half of spawns come in pairs - panic scrambling
    acidTimer: 65,
    guardian: "bileElemental",
    wormTint: 0.9,
  },
];
