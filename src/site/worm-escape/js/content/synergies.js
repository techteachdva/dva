// v0.17 Class + Weapon synergy "subclasses" — applied in makePlayer after base stats.
// Each synergy sets display name tint, optional hero filter id, and nudges pactMods.

/**
 * @typedef {Object} SynergyDef
 * @property {string} id
 * @property {string} title
 * @property {string} blurb
 * @property {string} [heroTint]   // passed to drawHero as synergyBuild override
 * @property {function(object): void} [apply]  // mutates player in place
 */

/** @type {Record<string, SynergyDef>} */
export const SYNERGIES = {
  chainSword: {
    id: "chainSword",
    title: "CHAIN SWORD (WIP)",
    blurb: "Ironhide + Longsword. A roaring chain-teeth blade — slow, savage.",
    heroTint: "chainSword",
    apply(p) {
      p.pactMods.dmgMult *= 1.15;
      p.pactMods.attackDmgMult *= 1.1;
      p.pactMods.attackCdMult *= 1.35;
      p.laneSwapCd *= 1.25;
    },
  },
  monk: {
    id: "monk",
    title: "MONK",
    blurb: "Swiftfoot + Bare Fists. Chi strikes; faster hands, heavier steps.",
    heroTint: "monk",
    apply(p) {
      p.pactMods.attackDmgMult *= 1.35;
      p.pactMods.attackCdMult *= 0.82;
      p.laneSwapCd *= 1.45;
      p.pactMods.manaRegen += 4;
    },
  },
  scout: {
    id: "scout",
    title: "SCOUT",
    blurb: "Swiftfoot + Blunderbuss. Glass cannon skirmisher — enormous boom, brittle frame.",
    heroTint: "scout",
    apply(p) {
      p.hp = Math.min(40, p.hp);
      p.hpMax = 40;
      p.pactMods.dmgMult *= 2;
      p.pactMods.attackDmgMult *= 2;
      p.pactMods.specialDmgMult *= 2;
      p.pactMods.critChance = (p.pactMods.critChance || 0) + 0.22;
      p.manaCostBonus = Math.max(0, (p.manaCostBonus || 0) - 1);
      p.pactMods.specialCdMult *= 0.85;
      p.pactMods.attackCdMult *= 0.9;
    },
  },
  grimReaper: {
    id: "grimReaper",
    title: "GRIM REAPER",
    blurb: "Viper + Cursed Scythe. ROT — decay burns brighter than poison.",
    heroTint: "grimReaper",
    apply(p) {
      p.pactMods.poisonPct = 0;
      p.pactMods.poisonTime = 0;
      p.synergyDecay = true; // combat reads: stronger burn DoT via loadout bleed fields
      p.pactMods.dmgMult *= 1.08;
    },
  },
  whizid: {
    id: "whizid",
    title: "WHIZID",
    blurb: "Wizard + Plasmids. Plasma feedback loop — furious costs, frantic power.",
    heroTint: "whizid",
    apply(p) {
      p.pactMods.dmgMult *= 2;
      p.pactMods.attackCdMult *= 0.5;
      p.pactMods.specialCdMult *= 0.5;
      p.manaCostBonus = Math.round((p.manaCostBonus || 0) * 3);
      p.pactMods.manaRegen += 18;
    },
  },
  turretSummoner: {
    id: "turretSummoner",
    title: "TURRET SUMMONER",
    blurb: "Wizard + Engineer Wrench. Arcane batteries — feeble swings, brutal sentries.",
    heroTint: "turretSummoner",
    apply(p) {
      p.pactMods.attackDmgMult *= 0.65;
      p.pactMods.specialDmgMult *= 0.65;
      p.sentryMagicMult = 2;
    },
  },
  heavyHitter: {
    id: "heavyHitter",
    title: "HEAVY HITTER",
    blurb: "Ironhide + Warhammer. Immovable object. Each swing is a siege engine.",
    heroTint: "heavyHitter",
    apply(p) {
      p.pactMods.dmgMult *= 3;
      p.pactMods.attackCdMult *= 1.55;
      p.pactMods.specialCdMult *= 1.5;
      p.laneSwapCd *= 1.6;
      p.climbSpeed *= 0.72;
    },
  },
};

const KEY = (b, w) => `${b}:${w}`;

/** Maps buildId + loadoutId -> synergy id */
const TABLE = {
  [KEY("iron", "sword")]: "chainSword",
  [KEY("swift", "fists")]: "monk",
  [KEY("swift", "blunderbuss")]: "scout",
  [KEY("viper", "cursedScythe")]: "grimReaper",
  [KEY("wizard", "plasmids")]: "whizid",
  [KEY("wizard", "engineerWrench")]: "turretSummoner",
  [KEY("iron", "hammer")]: "heavyHitter",
};

export function resolveSynergy(buildId, loadoutId) {
  const sid = TABLE[KEY(buildId, loadoutId)];
  return sid ? SYNERGIES[sid] : null;
}

export function applySynergy(p, buildId, loadoutId) {
  const syn = resolveSynergy(buildId, loadoutId);
  if (!syn) {
    p.synergyId = null;
    p.synergyTitle = null;
    p.synergyHeroTint = null;
    return;
  }
  p.synergyId = syn.id;
  p.synergyTitle = syn.title;
  p.synergyHeroTint = syn.heroTint || null;
  if (syn.apply) syn.apply(p);
}
