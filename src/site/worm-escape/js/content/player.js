import { getPact } from "./pacts.js";

// Player model, builds, and loadouts.
//
// Balance philosophy:
//   Swift  = glass cannon. Fast climb, fast hops, big dodge window, low HP/no armor.
//   Iron   = brick wall. Slow climb, slow hops, smaller dodge window BUT armor absorbs
//            75% of damage until broken, more tank-hits, way slower acid corrosion.
//
// Both builds must be able to *barely* outrun the rising bile - the chamber config
// is tuned so that continuous climbing wins with a ~5s buffer.

export const BUILDS = {
  swift: {
    id: "swift",
    name: "SWIFTFOOT",
    blurb: "Light leathers. Quick fingers. Quicker feet.",
    hp: 80,
    mana: 70,
    armor: 0,
    armorSoak: 0,          // 0% of damage soaked into armor
    climbSpeed: 1.45,      // climb px/s multiplier (200 base * 1.45 = ~290)
    hopCooldown: 0.07,     // seconds between climb column hops
    laneSwapCd: 0.06,      // seconds between combat lane swaps
    dodgeWindow: 0.65,     // seconds of telegraph warning before acid gout lands
    acidResist: 1.0,       // acid timer tick multiplier (1.0 = normal)
    tankHits: 0,
  },
  iron: {
    id: "iron",
    name: "IRONHIDE",
    blurb: "Plate and pride. Slow, but built like a keep.",
    hp: 150,
    mana: 45,
    armor: 60,
    armorSoak: 0.75,       // armor eats 75% of damage until depleted
    climbSpeed: 0.95,      // slower climb
    hopCooldown: 0.22,     // chunky hops on the wall
    laneSwapCd: 0.20,      // chunky footwork in combat too
    dodgeWindow: 0.55,     // almost as much warning as Swift (previously too harsh)
    acidResist: 0.35,      // armor repels the bile vapors - timer ticks slow
    tankHits: 2,           // two free debris soaks per chamber
  },
  // v0.12 VIPER - middle-ground build. Gated by "win any run" unlock.
  // Less HP than Iron, more armor than Swift. Signature ability:
  // every attack poisons the enemy for 3s, ticking 5% of enemy max HP/s.
  viper: {
    id: "viper",
    name: "VIPER",
    blurb: "Quiet steps, venom breath. Outlasts, doesn't overpower.",
    hp: 100,
    mana: 55,
    armor: 20,
    armorSoak: 0.30,       // armor soaks 30% - a lean buffer, not a wall
    climbSpeed: 1.20,      // in between swift and iron
    hopCooldown: 0.10,
    laneSwapCd: 0.09,
    dodgeWindow: 0.55,
    acidResist: 0.80,      // slightly better than Swift
    tankHits: 1,           // one free debris soak per chamber
    // Unique toggle - read by combat.js
    poisonPct: 0.05,       // poison ticks 5% of enemy max HP / sec
    poisonTime: 3,         // for 3 seconds after each hit (refreshes duration)
  },
};

export const LOADOUTS = {
  sword: {
    id: "sword",
    name: "KEEN LONGSWORD",
    icon: "sword",
    blurb: "Balanced. Bites clean through rot and hide.",
    attack:  { name: "Slash",       dmg: [16, 24], cooldown: 0.62, manaCost: 0, sfx: "slash" },
    special: { name: "Riposte",     dmg: [28, 38], cooldown: 2.4,  manaCost: 8, sfx: "slash" },
    color: "#e0e4ec",
    strongVs: "zombie",   // +60% vs digested goblin (clean slicing through rot)
    weakVs:   "tentacle", // -40% vs tentacle (coils around the blade)
  },
  hammer: {
    id: "hammer",
    name: "WARHAMMER",
    icon: "hammer",
    blurb: "Heavy. Turns teeth into gravel; plows through ribs.",
    attack:  { name: "Smash",       dmg: [22, 32], cooldown: 0.95, manaCost: 0,  sfx: "crunch" },
    special: { name: "Quake Bash",  dmg: [34, 46], cooldown: 3.0,  manaCost: 10, sfx: "thud" },
    color: "#b38244",
    strongVs: "teeth",   // +60% vs tooth beast (it's just bone after all)
    weakVs:   "flesh",   // -40% vs flesh horror (the meat absorbs blunt impact)
  },
  emberStaff: {
    id: "emberStaff",
    name: "STAFF OF EMBERS",
    icon: "staff-fire",
    blurb: "Cinder-tipped. Cauterizes rot; sputters in bile.",
    attack:  { name: "Ember Bolt",  dmg: [14, 20], cooldown: 0.55, manaCost: 3,  sfx: "cast" },
    special: { name: "Firestorm",   dmg: [30, 42], cooldown: 2.6,  manaCost: 14, sfx: "cast" },
    color: "#ff7a2a",
    strongVs: "flesh",   // +60% vs flesh horror (burns wet meat beautifully)
    weakVs:   "bile",    // -40% vs bile elemental (fizzles in wet acid)
  },
  frostWand: {
    id: "frostWand",
    name: "FROSTBITE WAND",
    icon: "wand-ice",
    blurb: "Freezes the soft bits solid. Useless on bone.",
    attack:  { name: "Ice Shard",   dmg: [12, 18], cooldown: 0.45, manaCost: 2,  sfx: "cast" },
    special: { name: "Glacial Pike", dmg: [26, 36], cooldown: 2.2, manaCost: 12, sfx: "cast" },
    color: "#7fe3ff",
    strongVs: "bile",    // +60% vs bile elemental (freezes the whole blob)
    weakVs:   "teeth",   // -40% vs tooth beast (ice shatters on enamel)
  },
  // v0.12 BILE WHIP - unlocked by clearing Gullet climb hitless.
  // Its attack hits ALL THREE combat lanes at once (the sphincter guardian
  // stays in one lane but this matters against Shielded elites whose
  // shield-break condition is number-of-hits). Each "lane" takes reduced
  // damage individually, but the total is competitive with single hits.
  bileWhip: {
    id: "bileWhip",
    name: "BILE WHIP",
    icon: "whip",
    blurb: "Lashes all three lanes. Wet, theatrical, effective.",
    attack:  { name: "Triple Lash", dmg: [9, 13],  cooldown: 0.70, manaCost: 0,  sfx: "slash",  multiLane: true },
    special: { name: "Coil Lash",   dmg: [32, 44], cooldown: 2.8,  manaCost: 10, sfx: "crunch", multiLane: false },
    color: "#b5f05a",
    strongVs: "flesh",
    weakVs:   "teeth",
  },
  // v0.12 HEX STAFF - unlocked by defeating any Elite boss.
  // Attacks place a HEX MARK on the enemy; each mark adds +20% to the
  // damage of your NEXT 3 hits (stacking up to 3 marks). Special "Runic
  // Bolt" consumes ALL marks for a big burst (plus a per-mark bonus).
  hexStaff: {
    id: "hexStaff",
    name: "HEX STAFF",
    icon: "staff-hex",
    blurb: "Mark them. Wait. Detonate. Repeat.",
    attack:  { name: "Hex Bolt",    dmg: [10, 14], cooldown: 0.55, manaCost: 3,  sfx: "cast", hexMark: true },
    special: { name: "Runic Bolt",  dmg: [22, 30], cooldown: 2.6,  manaCost: 12, sfx: "cast", hexDetonate: true },
    color: "#d978ff",
    strongVs: "tentacle",
    weakVs:   "zombie",
  },
};

// Multiplier returned when loadout `lId` attacks enemy art type `art`.
// 1.6 = devastating, 0.6 = mostly deflected, 1.0 = neutral.
export function matchupMultiplier(loadoutId, enemyArt) {
  const l = LOADOUTS[loadoutId];
  if (!l) return 1;
  if (l.strongVs === enemyArt) return 1.6;
  if (l.weakVs   === enemyArt) return 0.6;
  return 1;
}

export function matchupLabel(mult) {
  if (mult >= 1.5) return { text: "DEVASTATING!", color: "#ffd966" };
  if (mult <= 0.75) return { text: "GLANCING BLOW", color: "#8a9aff" };
  return null;
}

export function makePlayer(buildId, loadoutId) {
  const b = BUILDS[buildId];
  const l = LOADOUTS[loadoutId];
  return {
    buildId,
    loadoutId,
    name: b.name,
    hp: b.hp,
    hpMax: b.hp,
    mana: b.mana,
    manaMax: b.mana,
    armor: b.armor,
    armorMax: b.armor,
    armorSoak: b.armorSoak,
    climbSpeed: b.climbSpeed,
    hopCooldown: b.hopCooldown,
    laneSwapCd: b.laneSwapCd,
    dodgeWindow: b.dodgeWindow,
    acidResist: b.acidResist,
    tankHitsLeft: b.tankHits,
    tankHitsMax: b.tankHits,
    build: b,
    loadout: l,
    acidTimer: 75,
    acidTimerMax: 75,
    // Bile-submersion grace: while the hero is literally under the rising bile,
    // armor is eaten at 1 point per second. Ironhide (60 armor) therefore gets
    // ~60 seconds of emergency grace to claw back out. Swift (0 armor) drowns
    // fast. Once armor hits 0 while submerged, HP melts at `bileHpDrain` /s.
    bileHpDrain: 24,
    chamberIndex: 0,
    cooldowns: { attack: 0, special: 0 },
    // --- v0.10 Score tracking ---
    // Every time the hero takes damage (climb debris, acid gout, melee,
    // bile submersion) we bump `hitsTaken`. Individual scenes also
    // contribute to the other counters. The VictoryScene reads all of
    // these for its scoring breakdown.
    score: {
      hitsTaken: 0,           // total distinct damage instances absorbed
      totalHpLost: 0,         // raw HP lost (before healing) across the run
      totalArmorLost: 0,      // raw armor lost across the run
      perfectBraces: 0,       // counter-strike procs earned
      counterStrikes: 0,      // counter-strikes actually landed
      powerUpsCollected: 0,   // feathers + burgers
      ringsCollected: 0,      // rings of armor (extra rare bonus)
      bossesDefeated: 0,      // sphincter guardians killed
      chambersCleared: 0,     // chambers escaped (count on climb completion)
      timeSpent: 0,           // total seconds of climb+combat gameplay
      // v0.12 replayability counters
      hitlessChambers: 0,     // count of chambers fully cleared without taking any hit
      gullethitless: false,   // specifically the Gullet chamber cleared hitless
      elitesKilled: 0,        // number of Elite sphincter guardians slain
      pactsTaken: [],         // array of pact ids chosen this run (display + scoring)
    },
    // v0.12 Pacts - array of ids the player has taken. `pactMods` holds
    // all live tuning values pacts (and builds) want to nudge. Pre-init
    // to safe neutrals so consumers can blindly read-multiply/add.
    pacts: [],
    pactMods: {
      dmgMult: 1,             // global outgoing damage
      attackDmgMult: 1,       // basic attack only
      specialDmgMult: 1,      // special only
      attackCdMult: 1,        // basic attack cooldown multiplier
      specialCdMult: 1,       // special cooldown multiplier
      critChance: 0,          // added crit chance for dealtoenemy
      counterMult: 1.5,       // perfect brace counter multiplier
      incomingDmgMult: 1,     // damage the player takes (multiplier)
      debrisDmgMult: 1,       // climb debris damage only
      bileRiseMult: 1,        // climb bile rise multiplier
      debrisRateMult: 1,      // climb debris INTERVAL multiplier (>1 = slower)
      powerUpRateMult: 1,     // climb powerup rarity multiplier
      burgerBonusHp: 0,       // extra HP on burger pickup
      freeRingPending: false, // start next climb with a free ring
      manaRegen: 25,          // between-chamber mana restore
      poisonPct: (b.poisonPct ?? 0),
      poisonTime: (b.poisonTime ?? 0),
      heavyTellBonus: 0,      // extra seconds added to heavy slam telegraph
      lifestealOnKill: 0,     // HP healed when enemy dies
      executeThreshold: 0,    // enemy HP% below which execute bonus applies
      executeBonus: 1,        // damage multiplier for execute
    },
  };
}

// Apply a pact by id. Safe to call multiple times; updates tracking on
// the player so the scoreboard can list "Pacts taken this run".
export function applyPact(p, pactId) {
  if (!p || !pactId) return false;
  const pact = getPact(pactId);
  if (!pact) return false;
  if (p.pacts.includes(pactId)) return false;
  p.pacts.push(pactId);
  if (p.score) p.score.pactsTaken = [...p.pacts];
  pact.apply(p);
  return true;
}

export function resetChamber(p) {
  p.tankHitsLeft = p.tankHitsMax;
  p.acidTimer = p.acidTimerMax;
  p.cooldowns.attack = 0;
  p.cooldowns.special = 0;
  // Mana regen between chambers. Some pacts zero this out (Marathon Lungs).
  const regen = p.pactMods ? p.pactMods.manaRegen : 25;
  p.mana = Math.min(p.manaMax, p.mana + regen);
  // Patch wounds
  p.hp = Math.min(p.hpMax, p.hp + 25);
  // Armor repairs partially
  if (p.armorMax > 0) p.armor = Math.min(p.armorMax, p.armor + 20);
}

// Apply a damage instance against a player's armor+HP, honoring armorSoak.
// Returns { armorTaken, hpTaken } for logging/visuals.
// Also updates score.hitsTaken / totalHpLost / totalArmorLost when the
// player has a `score` object (post-v0.10 saves always do).
export function applyDamage(p, amount) {
  // Pacts like Glass Gauntlets / Feed Frenzy amplify incoming damage.
  const inMult = p.pactMods ? p.pactMods.incomingDmgMult : 1;
  let remaining = amount * inMult;
  let armorTaken = 0;
  if (p.armor > 0 && p.armorSoak > 0) {
    const soakable = remaining * p.armorSoak;
    const absorb = Math.min(p.armor, soakable);
    p.armor -= absorb;
    armorTaken = absorb;
    remaining -= absorb;
  }
  const hpTaken = Math.min(p.hp, remaining);
  p.hp = Math.max(0, p.hp - remaining);
  if (p.score) {
    if (armorTaken > 0 || hpTaken > 0) p.score.hitsTaken++;
    p.score.totalHpLost += hpTaken;
    p.score.totalArmorLost += armorTaken;
  }
  return { armorTaken, hpTaken };
}

// Record a direct (non-soak) HP hit. Used for pierce debris, mace bonus
// damage, bile submersion drain, combat acid-timer corrosion - places
// where we don't go through applyDamage but still want the counters
// updated.
export function recordDirectHpHit(p, hpAmount, { countAsHit = true } = {}) {
  if (!p.score) return;
  if (hpAmount <= 0) return;
  p.score.totalHpLost += hpAmount;
  if (countAsHit) p.score.hitsTaken++;
}

// Same as above but for armor only (mace clang on armor).
export function recordDirectArmorHit(p, armorAmount, { countAsHit = true } = {}) {
  if (!p.score) return;
  if (armorAmount <= 0) return;
  p.score.totalArmorLost += armorAmount;
  if (countAsHit) p.score.hitsTaken++;
}
