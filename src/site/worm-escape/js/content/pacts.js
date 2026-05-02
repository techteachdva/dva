// v0.12 Pact data - offered after every boss kill.
//
// Each pact is a TRADE-OFF: one buff, one nerf. The goal is that no choice
// is strictly dominant; every pick has teeth. Pacts live in `p.pacts` as
// an array of ids and their modifiers are read live by climb.js and
// combat.js through helper getters in player.js.
//
// A pact is defined with:
//   id       - unique string, persisted in p.pacts
//   name     - short display label
//   blurb    - 1-line "why would I take this?" summary
//   pros     - array of strings shown in green ("+...")
//   cons     - array of strings shown in red   ("-...")
//   tags     - gameplay surfaces the pact touches ("climb" | "combat" | "stats")
//   apply(p) - mutator called ONCE when the pact is accepted
//
// Live modifiers that can't be baked in as simple number bumps (bile rise
// multiplier, crit chance, perfect brace bonus) are read from p.pactMods
// which is initialized in makePlayer.

export const PACTS = [
  // ------------- Offensive pacts -------------
  {
    id: "pact_of_vipers",
    name: "PACT OF VIPERS",
    blurb: "Strike like a snake, but fragile as one.",
    pros: ["+30% attack & special damage"],
    cons: ["-15% max HP (wounded now)"],
    tags: ["combat", "stats"],
    apply: (p) => {
      p.pactMods.dmgMult *= 1.30;
      p.hpMax = Math.max(1, Math.round(p.hpMax * 0.85));
      p.hp = Math.min(p.hp, p.hpMax);
    },
  },
  {
    id: "patient_blade",
    name: "PATIENT BLADE",
    blurb: "Every swing lands cleaner, but slower.",
    pros: ["+25% crit (devastating) chance"],
    cons: ["attacks cool 15% slower"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.critChance += 0.25;
      p.pactMods.attackCdMult *= 1.15;
    },
  },
  {
    id: "perfectionist",
    name: "PERFECTIONIST",
    blurb: "Counter harder - but your baseline wilts.",
    pros: ["perfect-brace counter: 1.5x -> 2.0x"],
    cons: ["-10% base damage"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.counterMult = 2.0;
      p.pactMods.dmgMult *= 0.9;
    },
  },
  {
    id: "glass_fangs",
    name: "GLASS FANGS",
    blurb: "One spectacular flurry. You'd better land it.",
    pros: ["+50% special damage", "special cools 30% faster"],
    cons: ["-20% basic attack damage"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.specialDmgMult *= 1.5;
      p.pactMods.specialCdMult  *= 0.7;
      p.pactMods.attackDmgMult  *= 0.8;
    },
  },

  // ------------- Climb pacts -------------
  {
    id: "feather_cloak",
    name: "FEATHER CLOAK",
    blurb: "Every hop a glide; every shove a bruise.",
    pros: ["+20% climb speed", "+25% faster hop cooldown"],
    cons: ["armor soak -15% (brittler plating)"],
    tags: ["climb", "stats"],
    apply: (p) => {
      p.climbSpeed *= 1.20;
      p.hopCooldown *= 0.80;
      p.armorSoak = Math.max(0, p.armorSoak - 0.15);
    },
  },
  {
    id: "iron_gizzard",
    name: "IRON GIZZARD",
    blurb: "Absurd vitality bought with brick-feet.",
    pros: ["+40 max HP (fully healed)"],
    cons: ["-10% climb speed"],
    tags: ["climb", "stats"],
    apply: (p) => {
      p.hpMax += 40;
      p.hp = p.hpMax;
      p.climbSpeed *= 0.90;
    },
  },
  {
    id: "bile_tongue",
    name: "BILE TONGUE",
    blurb: "Acid kisses hurt less, strikes hurt less too.",
    pros: ["+50% acid-timer duration"],
    cons: ["-15% attack damage"],
    tags: ["climb", "combat"],
    apply: (p) => {
      p.acidTimerMax = Math.round(p.acidTimerMax * 1.5);
      p.acidTimer = p.acidTimerMax;
      p.pactMods.dmgMult *= 0.85;
    },
  },
  {
    id: "marathon_lungs",
    name: "MARATHON LUNGS",
    blurb: "Long haul. No breath between chambers.",
    pros: ["+12s to every acid timer", "+15% climb speed"],
    cons: ["mana regen 0 between chambers"],
    tags: ["climb"],
    apply: (p) => {
      p.acidTimerMax += 12;
      p.acidTimer = p.acidTimerMax;
      p.climbSpeed *= 1.15;
      p.pactMods.manaRegen = 0;
    },
  },
  {
    id: "tide_watcher",
    name: "TIDE WATCHER",
    blurb: "The bile crawls. So does the falling muck.",
    pros: ["bile rises 20% slower", "debris spawns 15% slower"],
    cons: ["-15% max HP"],
    tags: ["climb", "stats"],
    apply: (p) => {
      p.pactMods.bileRiseMult *= 0.80;
      p.pactMods.debrisRateMult *= 1.15; // higher interval = slower spawns
      p.hpMax = Math.max(1, Math.round(p.hpMax * 0.85));
      p.hp = Math.min(p.hp, p.hpMax);
    },
  },
  {
    id: "ring_forger",
    name: "RING FORGER",
    blurb: "Start the next climb wrapped in borrowed plate.",
    pros: ["start next climb with free Ring of Armor"],
    cons: ["bile rises 15% faster this chamber"],
    tags: ["climb"],
    apply: (p) => {
      p.pactMods.freeRingPending = true;
      p.pactMods.bileRiseMult *= 1.15;
    },
  },

  // ------------- Defensive pacts -------------
  {
    id: "stone_skin",
    name: "STONE SKIN",
    blurb: "Hurts less. Moves less.",
    pros: ["armor soak +20%", "+15 max armor"],
    cons: ["-10% climb speed", "-10% lane swap speed"],
    tags: ["stats"],
    apply: (p) => {
      p.armorSoak = Math.min(0.95, p.armorSoak + 0.20);
      p.armorMax += 15;
      p.armor += 15;
      p.climbSpeed *= 0.90;
      p.laneSwapCd *= 1.10;
    },
  },
  {
    id: "hollow_husk",
    name: "HOLLOW HUSK",
    blurb: "Learn to read the tells the hard way.",
    pros: ["+30% dodge window", "+15% mana pool"],
    cons: ["-15% max HP"],
    tags: ["combat", "stats"],
    apply: (p) => {
      p.dodgeWindow *= 1.30;
      p.manaMax = Math.round(p.manaMax * 1.15);
      p.mana = Math.min(p.manaMax, p.mana + 10);
      p.hpMax = Math.max(1, Math.round(p.hpMax * 0.85));
      p.hp = Math.min(p.hp, p.hpMax);
    },
  },
  {
    id: "blood_tithe",
    name: "BLOOD TITHE",
    blurb: "Pay in blood, draw on stolen life.",
    pros: ["on kill: heal 20 HP", "+10% damage"],
    cons: ["-20 max HP (costs a pint)"],
    tags: ["combat", "stats"],
    apply: (p) => {
      p.pactMods.lifestealOnKill = 20;
      p.pactMods.dmgMult *= 1.10;
      p.hpMax = Math.max(1, p.hpMax - 20);
      p.hp = Math.min(p.hp, p.hpMax);
    },
  },

  // ------------- Utility / zany pacts -------------
  {
    id: "hex_eyed",
    name: "HEX-EYED",
    blurb: "Poison drips from every cut you make.",
    pros: ["attacks poison the foe for 3s (3% max HP/s)"],
    cons: ["-10% direct attack damage"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.poisonPct  = Math.max(p.pactMods.poisonPct || 0, 0.03);
      p.pactMods.poisonTime = Math.max(p.pactMods.poisonTime || 0, 3);
      p.pactMods.dmgMult   *= 0.90;
    },
  },
  {
    id: "feed_frenzy",
    name: "FEED FRENZY",
    blurb: "Gorge on power-ups; you need every scrap.",
    pros: ["power-ups drop twice as often", "burgers heal +10 HP"],
    cons: ["take 10% more damage from debris"],
    tags: ["climb"],
    apply: (p) => {
      p.pactMods.powerUpRateMult *= 2.0;
      p.pactMods.burgerBonusHp += 10;
      p.pactMods.debrisDmgMult *= 1.10;
    },
  },
  {
    id: "glass_gauntlets",
    name: "GLASS GAUNTLETS",
    blurb: "Hurl yourself in. Regret nothing.",
    pros: ["+40% counter-strike damage", "+20% special damage"],
    cons: ["all damage you take +15%"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.counterMult = Math.max(p.pactMods.counterMult, 1.5) + 0.40;
      p.pactMods.specialDmgMult *= 1.20;
      p.pactMods.incomingDmgMult *= 1.15;
    },
  },
  {
    id: "worms_eye",
    name: "WORM'S EYE",
    blurb: "You see tells early, but MP flows slow.",
    pros: ["+0.25s dodge window", "+0.2s heavy-slam telegraph"],
    cons: ["mana regen -50% between chambers"],
    tags: ["combat"],
    apply: (p) => {
      p.dodgeWindow += 0.25;
      p.pactMods.heavyTellBonus += 0.2;
      p.pactMods.manaRegen = Math.round((p.pactMods.manaRegen ?? 25) * 0.5);
    },
  },
  {
    id: "enders_rite",
    name: "ENDER'S RITE",
    blurb: "Finish fights fast, or starve.",
    pros: ["attacks under 40% enemy HP deal +40% damage"],
    cons: ["-15% damage otherwise"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.executeThreshold = 0.4;
      p.pactMods.executeBonus = 1.4;
      p.pactMods.dmgMult *= 0.85;
    },
  },

  // ---- v0.18 pact wave ----
  {
    id: "fast_hands",
    name: "FAST HANDS",
    blurb: "Flash strikes — half muscle, half paper.",
    pros: ["all ability cooldowns cut in half"],
    cons: ["all ability damage roughly halved"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.fastHandsHalf = true;
      p.pactMods.attackCdMult *= 0.5;
      p.pactMods.specialCdMult *= 0.5;
      p.pactMods.attackDmgMult *= 0.5;
      p.pactMods.specialDmgMult *= 0.5;
      p.pactMods.dmgMult *= 0.5;
    },
  },
  {
    id: "all_in_red",
    name: "ALL-IN ON RED",
    blurb: "Bleed stamina into the duel — soften every finishing blow.",
    pros: ["+55 max HP (healed)"],
    cons: ["-20 damage on each strike (after rolls)"],
    tags: ["combat", "stats"],
    apply: (p) => {
      p.hpMax += 55;
      p.hp = Math.min(p.hpMax, p.hp + 55);
      p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) - 20;
    },
  },
  {
    id: "all_in_black",
    name: "ALL-IN ON BLACK",
    blurb: "Borrow life for murder math.",
    pros: ["+25 damage on each strike (after rolls)"],
    cons: ["-50 max HP"],
    tags: ["combat", "stats"],
    apply: (p) => {
      p.hpMax = Math.max(1, p.hpMax - 50);
      p.hp = Math.min(p.hp, p.hpMax);
      p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) + 25;
    },
  },
  {
    id: "split_fifty_fifty",
    name: "50 / 50",
    blurb: "The abyss flips its coin once per swing.",
    pros: ["each strike rolls +15 damage OR −15"],
    cons: ["Damage spikes both directions—plan heals around blanks"],
    tags: ["combat"],
    apply: (p) => {
      p.pactMods.flipDamage5050 = true;
    },
  },
];

// Quick lookup by id.
const PACT_BY_ID = Object.fromEntries(PACTS.map((p) => [p.id, p]));
export function getPact(id) { return PACT_BY_ID[id] || null; }

// Pick N random pacts from the pool, excluding ones already taken.
// `taken` is an array of pact ids already in the player's list.
export function rollPactChoices(n = 3, taken = []) {
  const pool = PACTS.filter((p) => !taken.includes(p.id));
  const result = [];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}
