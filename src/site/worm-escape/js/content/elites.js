// v0.12 Elite Guardians - randomized variants that wrap the base enemy
// with extra stats AND a unique "twist" mechanic that combat.js reads.
//
// Elite chance ramps per chamber so later fights get spicier. An Elite:
//   - adds +30% HP and +15% damage to the base enemy
//   - enrages earlier (60% HP vs 50% normally)
//   - gets a gold aura + "ELITE" prefix in the UI
//   - has ONE twist drawn from the four defined here
//   - drops a 4-card pact choice instead of 3 on defeat
//
// Twists are implemented as string constants that combat.js branches on,
// so we don't need to plumb callbacks through content files.

const ELITE_CHANCE_BY_CHAMBER = [0.30, 0.40, 0.45, 0.50];

export const ELITE_TWISTS = [
  {
    id: "FANGED",
    name: "FANGED",
    blurb: "Rogue acid gouts punctuate the fight.",
    color: "#b5f05a",
  },
  {
    id: "SHIELDED",
    name: "SHIELDED",
    blurb: "At 75% HP, enters a shielded phase. Perfect-brace to break it.",
    color: "#9adaff",
  },
  {
    id: "HEX-EYED",
    name: "HEX-EYED",
    blurb: "Each heavy slam speeds up the NEXT tell. Stacking!",
    color: "#d978ff",
  },
  {
    id: "BLOATED",
    name: "BLOATED",
    blurb: "On death: explodes. Brace the killing blow to halve it.",
    color: "#ff7a2a",
  },
];

const TWIST_BY_ID = Object.fromEntries(ELITE_TWISTS.map((t) => [t.id, t]));
export function getTwist(id) { return TWIST_BY_ID[id] || null; }

// Roll whether a chamber's guardian is an Elite, and which twist it has.
// Returns null if the roll fails; otherwise returns { twistId, twist }.
export function rollElite(chamberIdx) {
  const chance = ELITE_CHANCE_BY_CHAMBER[chamberIdx] ?? 0.30;
  if (Math.random() >= chance) return null;
  const twist = ELITE_TWISTS[Math.floor(Math.random() * ELITE_TWISTS.length)];
  return { twistId: twist.id, twist };
}

// Apply elite stat modifiers on top of a base enemy object. Mutates and
// returns the same object for chaining.
export function applyElite(enemy, twistId) {
  const twist = TWIST_BY_ID[twistId];
  if (!twist) return enemy;
  enemy.elite = true;
  enemy.eliteTwist = twistId;
  enemy.eliteColor = twist.color;
  enemy.name = "ELITE " + enemy.name;
  enemy.hpMax = Math.round(enemy.hpMax * 1.3);
  enemy.hp = enemy.hpMax;
  // +15% damage baked into the roll ranges.
  if (enemy.attackDmg) {
    enemy.attackDmg = enemy.attackDmg.map((x) => Math.round(x * 1.15));
  }
  if (enemy.heavyDmg) {
    enemy.heavyDmg = enemy.heavyDmg.map((x) => Math.round(x * 1.15));
  }
  // Enrages earlier.
  enemy.enrageAt = 0.6;

  // Twist-specific state baked in.
  if (twistId === "SHIELDED") {
    enemy.shielded = false;           // true during the shielded phase
    enemy.shieldTriggerFrac = 0.75;   // at HP fraction
    enemy.shieldDuration = 6;         // seconds
    enemy.shieldHitsLeft = 3;         // perfect braces needed to break
    enemy.shieldCooldown = 0;         // internal timer
    enemy.shieldUsed = false;         // one-shot flag per fight
  }
  return enemy;
}
