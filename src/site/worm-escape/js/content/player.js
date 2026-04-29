import { getPact } from "./pacts.js";
import { applySynergy } from "./synergies.js";

// v0.17 Global outbound attack pacing — lengthen all weapon timers so
// button-mash wins are harder. Applied once per-run via cloneLoadout().
export const GLOBAL_ATTACK_CD_MULT = 1.38;

function cloneLoadout(lo) {
  return JSON.parse(JSON.stringify(lo));
}

function scaleLoadoutCooldowns(l, mult = GLOBAL_ATTACK_CD_MULT) {
  if (!l || !l.attack) return;
  l.attack.cooldown *= mult;
  l.special.cooldown *= mult;
  if (l.cryoThird && l.cryoThird.cooldown) l.cryoThird.cooldown *= mult;
}

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
  // v0.16 WIZARD - hard but powerful. Gated by "win as Viper" unlock.
  //   - Tiny HP pool, no armor, slow feet.
  //   - HUGE mana pool. While mana > 0, incoming damage drains MANA at
  //     2x rate before touching armor/HP (a "mana shield"). Burn through
  //     mana too fast and you're a wet noodle, but a careful caster can
  //     soak shocking amounts of punishment.
  //   - Every weapon hit (basic + special) gets +40% damage, but every
  //     attack costs +2 MP on top of the weapon's listed cost. Even a
  //     "free" 0-MP basic now costs 2.
  //   - Best paired with cheap-cost / fast-attack loadouts (Frost Wand,
  //     Ember Staff, Hex Staff). Painful with slow heavy weapons.
  wizard: {
    id: "wizard",
    name: "WIZARD",
    blurb: "Frail flesh, bottomless mana. Spells eat MP twice as fast.",
    hp: 60,
    mana: 110,
    armor: 0,
    armorSoak: 0,
    climbSpeed: 1.10,
    hopCooldown: 0.12,
    laneSwapCd: 0.12,
    dodgeWindow: 0.50,
    acidResist: 0.85,
    tankHits: 0,
    // Unique toggles
    manaShield: true,        // drain mana before HP/armor
    manaShieldRatio: 2,      // 2 MP absorbs 1 dmg
    spellAmpMult: 1.4,       // global +40% outgoing damage
    manaCostBonus: 2,        // every attack costs +2 MP on top of base
  },
  // --- v0.17 Core class picks (always selectable) ---
  balanced: {
    id: "balanced",
    name: "BALANCED",
    blurb: "Jack of all guts. No extreme highs — no hopeless lows.",
    hp: 105,
    mana: 52,
    armor: 12,
    armorSoak: 0.35,
    climbSpeed: 1.14,
    hopCooldown: 0.095,
    laneSwapCd: 0.10,
    dodgeWindow: 0.56,
    acidResist: 0.82,
    tankHits: 1,
    poisonPct: 0,
    poisonTime: 0,
  },
  tryHard: {
    id: "tryHard",
    name: "TRY-HARD",
    blurb: "All gas, paper skin. DOUBLE speed & damage — 10 HP and a dream.",
    hp: 10,
    mana: 52,
    armor: 0,
    armorSoak: 0,
    climbSpeed: 1.76,
    hopCooldown: 0.046,
    laneSwapCd: 0.05,
    dodgeWindow: 0.58,
    acidResist: 1.05,
    tankHits: 0,
    tryHardGimmick: true,
    poisonPct: 0,
    poisonTime: 0,
  },
  gambler: {
    id: "gambler",
    name: "GAMBLER",
    blurb: "Lady Luck kisses or slaps — each hit rolls ¼× to 3.5× pain.",
    hp: 88,
    mana: 62,
    armor: 0,
    armorSoak: 0,
    climbSpeed: 1.32,
    hopCooldown: 0.086,
    laneSwapCd: 0.08,
    dodgeWindow: 0.58,
    acidResist: 0.95,
    tankHits: 0,
    gamblerGimmick: true,
    poisonPct: 0,
    poisonTime: 0,
  },
  tamer: {
    id: "tamer",
    name: "TAMER",
    blurb: "Soft strikes — finishers sting when the prey is bloodied.",
    hp: 95,
    mana: 58,
    armor: 8,
    armorSoak: 0.22,
    climbSpeed: 1.22,
    hopCooldown: 0.098,
    laneSwapCd: 0.10,
    dodgeWindow: 0.56,
    acidResist: 0.88,
    tankHits: 1,
    tamerGimmick: true,
    poisonPct: 0,
    poisonTime: 0,
  },
  // Cheat-unlocked (typing "jackson" on forge screen). Death-mage vibe.
  necromancer: {
    id: "necromancer",
    name: "THE NECROMANCER",
    blurb: "Speaks bone. Mana drinks life before flesh is touched.",
    hp: 55,
    mana: 95,
    armor: 0,
    armorSoak: 0,
    climbSpeed: 1.05,
    hopCooldown: 0.11,
    laneSwapCd: 0.11,
    dodgeWindow: 0.52,
    acidResist: 0.82,
    tankHits: 0,
    manaShield: true,
    manaShieldRatio: 1.65,
    spellAmpMult: 1.25,
    manaCostBonus: 1,
    poisonPct: 0,
    poisonTime: 0,
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
  // ============================== v0.16 NEW WEAPONS ==============================
  // FRYING PAN - meme-tier blunt object. BONK. Decent damage for a kitchen utensil.
  fryingPan: {
    id: "fryingPan",
    name: "FRYING PAN",
    icon: "pan",
    blurb: "BONK. Heavy. Slightly greasy. Surprisingly murderous.",
    attack:  { name: "Bonk",       dmg: [18, 26], cooldown: 0.78, manaCost: 0,  sfx: "thud" },
    special: { name: "Skillet Slam", dmg: [30, 42], cooldown: 2.6, manaCost: 8, sfx: "crunch" },
    color: "#9aa0ac",
    strongVs: "teeth",
    weakVs:   "flesh",
  },
  // SABER - fast stab, devastating triple-stab special.
  saber: {
    id: "saber",
    name: "DUELIST'S SABER",
    icon: "saber",
    blurb: "A whisper of a blade. Stabs faster than you can flinch.",
    attack:  { name: "Stab",        dmg: [13, 19], cooldown: 0.42, manaCost: 0,  sfx: "slash" },
    // Triple Stab: implemented as a single big-damage hit (the three
    // slashes are flavor + animation only). High mana, high damage.
    special: { name: "Triple Stab", dmg: [36, 48], cooldown: 2.3,  manaCost: 12, sfx: "slash" },
    color: "#e0e4ec",
    strongVs: "flesh",
    weakVs:   "teeth",
  },
  // FISTS - no mana ever, fast as lightning, low damage. Pure technique.
  fists: {
    id: "fists",
    name: "BARE FISTS",
    icon: "fists",
    blurb: "No weapon, no mana cost, no excuses. Just rhythm.",
    attack:  { name: "Punch",       dmg: [7, 11],  cooldown: 0.30, manaCost: 0,  sfx: "thud" },
    // Special is also free - a flurry combo.
    special: { name: "Flurry",      dmg: [22, 32], cooldown: 1.8,  manaCost: 0,  sfx: "thud" },
    color: "#d4a07a",
    strongVs: "bile",       // good against soft splatty bile elementals
    weakVs:   "teeth",
  },
  // CLUB - slow, brutal, plain. Beats anything not made of armor.
  club: {
    id: "club",
    name: "GNARLED CLUB",
    icon: "club",
    blurb: "Heavy hardwood. Slow. Decisive. Concussive.",
    attack:  { name: "Clobber",     dmg: [26, 36], cooldown: 1.10, manaCost: 0,  sfx: "thud" },
    special: { name: "Skull Smash", dmg: [44, 60], cooldown: 4.0,  manaCost: 14, sfx: "crunch" },
    color: "#7a4f24",
    strongVs: "zombie",
    weakVs:   "flesh",
  },
  // MEGAPHONE - low damage, fast cycle. Unlock: win any run.
  megaphone: {
    id: "megaphone",
    name: "BATTLE MEGAPHONE",
    icon: "megaphone",
    blurb: "Yelling, but tactical. Rattles eardrums and resolve.",
    attack:  { name: "Sonic Yell",  dmg: [9, 13],   cooldown: 0.40, manaCost: 2,  sfx: "cast" },
    special: { name: "Riot Boom",   dmg: [24, 34],  cooldown: 2.4,  manaCost: 11, sfx: "cast" },
    color: "#ffd966",
    strongVs: "tentacle",
    weakVs:   "bile",
  },
  // BONE SPEAR - low damage, applies BLEED on every hit (reuses poison
  // pipeline under the hood, but the floater/log call it bleed).
  // Unlock: win any run.
  boneSpear: {
    id: "boneSpear",
    name: "BONE SPEAR",
    icon: "boneSpear",
    blurb: "Splintered shaft, jagged tip. Every hit drinks blood.",
    attack:  { name: "Jab",         dmg: [11, 15], cooldown: 0.42, manaCost: 1,  sfx: "slash",
               poisonPct: 0.04, poisonTime: 3, dotLabel: "BLEED" },
    special: { name: "Lunge",       dmg: [24, 32], cooldown: 2.0,  manaCost: 9,  sfx: "slash",
               poisonPct: 0.07, poisonTime: 4, dotLabel: "BLEED" },
    color: "#e8d6b0",
    strongVs: "flesh",
    weakVs:   "teeth",
  },
  // BLUNDERBUSS - one heavy boom per long cooldown. Unlock: win any run.
  blunderbuss: {
    id: "blunderbuss",
    name: "BRASS BLUNDERBUSS",
    icon: "blunderbuss",
    blurb: "One slow shot. Loud. Hot. Inevitable.",
    attack:  { name: "Boom Shot",   dmg: [28, 40], cooldown: 1.55, manaCost: 4,  sfx: "crunch" },
    special: { name: "Powder Slam", dmg: [40, 56], cooldown: 4.0,  manaCost: 16, sfx: "crunch" },
    color: "#c89e54",
    strongVs: "teeth",
    weakVs:   "tentacle",
  },
  // CURSED SCYTHE - lifesteal weapon. Heals you for a % of damage dealt
  // on every hit. Unlock: win as Viper.
  cursedScythe: {
    id: "cursedScythe",
    name: "CURSED SCYTHE",
    icon: "scythe",
    blurb: "Drinks the blood it spills. Dark magic, dark grin.",
    attack:  { name: "Reaping Slash", dmg: [13, 19], cooldown: 0.62, manaCost: 2, sfx: "slash",
               lifestealPct: 0.20, poisonPct: 0.03, poisonTime: 3, dotLabel: "BLEED" },
    special: { name: "Soul Harvest",  dmg: [28, 40], cooldown: 2.6,  manaCost: 12, sfx: "slash",
               lifestealPct: 0.35, poisonPct: 0.06, poisonTime: 4, dotLabel: "BLEED" },
    color: "#a048c8",
    strongVs: "zombie",
    weakVs:   "bile",
  },
  // RUSTY CHAINSAW - special is unreliable. 5/6 chance to misfire (no
  // damage, half cooldown), 1/6 chance to deal massive damage and apply
  // a long bleed DoT. Unlock: defeat any Elite.
  rustyChainsaw: {
    id: "rustyChainsaw",
    name: "RUSTY CHAINSAW",
    icon: "chainsaw",
    blurb: "Old engine. Mostly sputters. When it doesn't... pray.",
    attack:  { name: "Saw Swing",   dmg: [14, 20], cooldown: 0.65, manaCost: 0,  sfx: "slash" },
    special: { name: "REV UP",      dmg: [60, 80], cooldown: 6.0,  manaCost: 8,  sfx: "crunch",
               misfireChance: 5/6, poisonPct: 0.10, poisonTime: 6, dotLabel: "BLEED" },
    color: "#c25a2a",
    strongVs: "flesh",
    weakVs:   "teeth",
  },
  // CAT - meme weapon. Throws a cat. The cat is mad. Unlock: win as Wizard.
  cat: {
    id: "cat",
    name: "ANGRY CAT",
    icon: "cat",
    blurb: "MEOW. Extremely high damage. Deeply unwilling participant.",
    attack:  { name: "Hiss Swat",   dmg: [16, 22], cooldown: 0.70, manaCost: 1,  sfx: "slash" },
    special: { name: "MEOW!!!",     dmg: [50, 70], cooldown: 3.5,  manaCost: 14, sfx: "crunch" },
    color: "#ff9a3c",
    strongVs: "tentacle",
    weakVs:   "zombie",
  },
  // v0.17 — Engineer wrench (sentry DPS handled in combat.js).
  engineerWrench: {
    id: "engineerWrench",
    name: "ENGINEER'S WRENCH",
    icon: "wrench",
    blurb: "Light taps. Big metal friend does the real work.",
    attack:  { name: "Light Tap",   dmg: [7, 11],  cooldown: 0.58, manaCost: 1,  sfx: "thud" },
    special: { name: "Deploy Sentry", dmg: [2, 4], cooldown: 5.2, manaCost: 8, sfx: "confirm",
      sentryBuild: true, buildTime: 3, sentryDmg: [9, 14], sentryInterval: 0.5 },
    color: "#9aa0ac",
    strongVs: "teeth",
    weakVs:   "tentacle",
  },
  // The Void — climb mobility; combat uses Bare Fists (combatAs).
  voidWalker: {
    id: "voidWalker",
    name: "THE VOID",
    icon: "void",
    combatAs: "fists",
    blurb: "Run between worlds. No weapon — only echoes in the dark.",
    voidClimbMult: 2.5,
    voidDebrisIntervalMult: 0.52,
    climbOnly: true,
    color: "#1a0520",
    strongVs: "flesh",
    weakVs:   "teeth",
  },
  chair: {
    id: "chair",
    name: "FOLDING CHAIR",
    icon: "chair",
    blurb: "Audience participation. Hits like a disqualification.",
    chairClimbMult: 1.5,
    attack:  { name: "Chair Slam",    dmg: [28, 38], cooldown: 1.05, manaCost: 10, sfx: "crunch" },
    special: { name: "Oak Execution", dmg: [46, 62], cooldown: 3.9,  manaCost: 22, sfx: "thud" },
    color: "#8b5a2b",
    strongVs: "zombie",
    weakVs:   "teeth",
  },
  plasmids: {
    id: "plasmids",
    name: "ADAM PLASMIDS",
    icon: "plasmids",
    blurb: "Triple helix payloads: fire rot, fry ooze, lock jawlines.",
    attack:  { name: "Incinerate",  dmg: [8, 13],  cooldown: 0.75, manaCost: 4, sfx: "cast",
      plasmElement: "fire" },
    special: { name: "Tesla Burst", dmg: [26, 36], cooldown: 3.0,  manaCost: 18, sfx: "cast",
      plasmElement: "shock", shockStun: 2.5 },
    cryoThird: { name: "Cryo Shear",  dmg: [14, 20], cooldown: 1.15, manaCost: 5, sfx: "cast",
      plasmElement: "cryo", slowMul: 0.45, slowT: 1.5 },
    color: "#59f0dc",
    strongVs: "flesh",
    weakVs:   "teeth",
  },
};

// Multiplier returned when loadout `lId` attacks enemy art type `art`.
// 1.6 = devastating, 0.6 = mostly deflected, 1.0 = neutral.
export function matchupMultiplier(loadoutId, enemyArt) {
  const l = LOADOUTS[loadoutId];
  if (!l) return 1;
  if (l.combatAs) return matchupMultiplier(l.combatAs, enemyArt);
  if (l.strongVs === enemyArt) return 1.6;
  if (l.weakVs   === enemyArt) return 0.6;
  return 1;
}

/** Plasmids (and similar): per-move matchup — fire shocks flesh, flops on bile… */
export function plasmElementMult(element, enemyArt) {
  const rows = {
    fire: { flesh: 1.6, bile: 0.6 },
    shock:{ bile:  1.6, zombie: 0.6 },
    cryo: { teeth: 1.6, flesh: 0.6 },
  };
  const row = rows[element];
  if (!row || !enemyArt) return 1;
  return row[enemyArt] ?? 1;
}

export function matchupLabel(mult) {
  if (mult >= 1.5) return { text: "DEVASTATING!", color: "#ffd966" };
  if (mult <= 0.75) return { text: "GLANCING BLOW", color: "#8a9aff" };
  return null;
}

export function makePlayer(buildId, loadoutId, gameCheats = null) {
  const b = BUILDS[buildId];
  const def = LOADOUTS[loadoutId];
  if (!b || !def) throw new Error("Unknown build/loadout");

  // Resolve combat loadout (Void uses Bare Fists in fights).
  let l = cloneLoadout(def);
  if (def.combatAs && LOADOUTS[def.combatAs]) {
    const inner = cloneLoadout(LOADOUTS[def.combatAs]);
    l = {
      ...inner,
      id: def.id,
      name: def.name,
      blurb: def.blurb || inner.blurb,
      color: def.color || inner.color,
      icon: def.icon || inner.icon,
      chairClimbMult: def.chairClimbMult,
      cryoThird: def.cryoThird,
      sentryDeploy: def.special?.sentryBuild ? def.special : null,
      plasmCryoPlan: def.cryoThird,
    };
  }
  scaleLoadoutCooldowns(l);

  let climbSpeed = b.climbSpeed * (def.chairClimbMult || 1);
  if (def.voidClimbMult) climbSpeed *= def.voidClimbMult;
  const hopCd = def.voidClimbMult
    ? b.hopCooldown / Math.max(0.01, def.voidClimbMult)
    : b.hopCooldown;

  const p = {
    buildId,
    loadoutId,
    surfaceLoadoutId: loadoutId,
    surfaceLoadoutName: LOADOUTS[loadoutId]?.name ?? l.name,
    name: b.name,
    hp: b.hp,
    hpMax: b.hp,
    mana: b.mana,
    manaMax: b.mana,
    armor: b.armor,
    armorMax: b.armor,
    armorSoak: b.armorSoak,
    climbSpeed,
    hopCooldown: hopCd,
    laneSwapCd: b.laneSwapCd,
    dodgeWindow: b.dodgeWindow,
    acidResist: b.acidResist,
    tankHitsLeft: b.tankHits,
    tankHitsMax: b.tankHits,
    build: b,
    loadout: l,
    voidDebrisIntervalMult: def.voidDebrisIntervalMult ?? 1,
    acidTimer: 75,
    acidTimerMax: 75,
    bileHpDrain: 24,
    chamberIndex: 0,
    cooldowns: { attack: 0, special: 0, tertiary: 0 },
    dodgeRollCooldown: 0,
    invulnerable: !!(gameCheats && gameCheats.invulnerable),
    manaShield:      !!b.manaShield,
    manaShieldRatio: b.manaShieldRatio || 2,
    spellAmpMult:    b.spellAmpMult || 1,
    manaCostBonus:   b.manaCostBonus ?? 0,
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
      dmgMult: b.spellAmpMult || 1,  // global outgoing damage (Wizard pre-amps to 1.4)
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
    sentry: null,
    plasmCryoSlow: null,
    synergyDecay: false,
    synergyHeroTint: null,
    synergyId: null,
    synergyTitle: null,
  };

  if (loadoutId === "engineerWrench") {
    const spec = LOADOUTS.engineerWrench.special;
    p.sentry = {
      active: false,
      buildLeft: 0,
      nextPulse: 0,
      dmgRange: spec.sentryDmg || [9, 14],
      interval: spec.sentryInterval || 0.5,
      deployTime: spec.buildTime ?? 3,
      magicMult: p.sentryMagicMult || 1,
    };
  }

  // Class gimmicks
  if (b.tryHardGimmick) {
    p.pactMods.dmgMult *= 2;
    p.pactMods.specialDmgMult *= 2;
    p.climbSpeed *= 2;
  }
  if (b.gamblerGimmick) {
    p.pactMods.gamblerVariance = true;
  }
  if (b.tamerGimmick) {
    p.pactMods.tamerCull = true;
    p.pactMods.tamerCullThreshold = 0.38;
    p.pactMods.tamerCullMult = 1.85;
    p.pactMods.attackDmgMult *= 0.72;
    p.pactMods.specialDmgMult *= 0.72;
  }

  applySynergy(p, buildId, loadoutId);

  return p;
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
  if (p.cooldowns.tertiary !== undefined) p.cooldowns.tertiary = 0;
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
  if (p.invulnerable) return { armorTaken: 0, hpTaken: 0, manaTaken: 0 };
  // Pacts like Glass Gauntlets / Feed Frenzy amplify incoming damage.
  const inMult = p.pactMods ? p.pactMods.incomingDmgMult : 1;
  let remaining = amount * inMult;
  let armorTaken = 0;
  // v0.16 Wizard mana shield: drain mana before armor/HP at a configured
  // ratio (default 2 MP per 1 dmg blocked). Once mana hits 0 the rest
  // spills through normally.
  let manaTaken = 0;
  if (p.manaShield && p.mana > 0 && remaining > 0) {
    const ratio = p.manaShieldRatio || 2;
    const blockable = p.mana / ratio;        // how much dmg the current mana pool can soak
    const blocked   = Math.min(remaining, blockable);
    const manaSpent = blocked * ratio;
    p.mana = Math.max(0, p.mana - manaSpent);
    remaining -= blocked;
    manaTaken = manaSpent;
  }
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
    if (armorTaken > 0 || hpTaken > 0 || manaTaken > 0) p.score.hitsTaken++;
    p.score.totalHpLost += hpTaken;
    p.score.totalArmorLost += armorTaken;
  }
  return { armorTaken, hpTaken, manaTaken };
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
