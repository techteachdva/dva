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
    title: "IMPERIUM CHAINSWORD",
    blurb: "Ironhide + Longsword. Teeth that never stop — rev the column under your boots.",
    heroTint: "chainSword",
    apply(p) {
      p.pactMods.dmgMult *= 1.12;
      p.pactMods.attackDmgMult *= 1.08;
      p.pactMods.attackCdMult *= 1.22;
      p.laneSwapCd *= 1.18;
      p.chainSwordDps = 13.5; // continuous shred while you share the guardian's column
    },
  },
  monk: {
    id: "monk",
    title: "ASCETIC MONK",
    blurb: "Swiftfoot + Bare Fists. Chi-strikes — faster hands, heavier steps.",
    heroTint: "monk",
    apply(p) {
      p.pactMods.attackDmgMult *= 1.45;
      p.pactMods.attackCdMult *= 0.78;
      p.laneSwapCd *= 1.52;
      p.pactMods.manaRegen += 5;
    },
  },
  scout: {
    id: "scout",
    title: "PATHFINDER SCOUT",
    blurb: "Swiftfoot + Blunderbuss. Glass cannon skirmisher — one shot, one crater.",
    heroTint: "scout",
    apply(p) {
      p.hpMax = 40;
      p.hp = Math.min(p.hp, 40);
      p.pactMods.dmgMult *= 2;
      p.pactMods.attackDmgMult *= 2;
      p.pactMods.specialDmgMult *= 2;
      p.pactMods.critChance = (p.pactMods.critChance || 0) + 0.18;
      p.manaCostBonus = Math.max(0, (p.manaCostBonus || 0) - 2);
      p.pactMods.specialCdMult *= 0.72;
      p.pactMods.attackCdMult *= 0.82;
      if (p.loadout?.attack) p.loadout.attack.manaCost = Math.max(0, Math.round((p.loadout.attack.manaCost || 0) * 0.55));
      if (p.loadout?.special) p.loadout.special.manaCost = Math.max(0, Math.round((p.loadout.special.manaCost || 0) * 0.55));
    },
  },
  grimReaper: {
    id: "grimReaper",
    title: "GRIM REAPER",
    blurb: "Viper + Cursed Scythe. ROT — long, cruel decay instead of quick cuts.",
    heroTint: "grimReaper",
    apply(p) {
      p.pactMods.poisonPct = 0;
      p.pactMods.poisonTime = 0;
      p.synergyDecay = true;
      p.grimReaperRot = true;
      p.pactMods.dmgMult *= 0.92;
    },
  },
  whizid: {
    id: "whizid",
    title: "WHIZID",
    blurb: "Wizard + Plasmids. Plasma feedback loop — ruinous costs, ruinous power.",
    heroTint: "whizid",
    apply(p) {
      p.pactMods.dmgMult *= 2;
      p.pactMods.attackCdMult *= 0.5;
      p.pactMods.specialCdMult *= 0.5;
      p.manaCostBonus = Math.max(0, Math.round((p.manaCostBonus || 0) * 3));
      p.pactMods.manaRegen += 16;
      p.whizidRollMana = 6;
    },
  },
  turretSummoner: {
    id: "turretSummoner",
    title: "TURRET SUMMONER",
    blurb: "Wizard + Engineer Wrench. Feeble swings; brilliant, short-lived sentries.",
    heroTint: "turretSummoner",
    apply(p) {
      p.pactMods.attackDmgMult *= 0.62;
      p.pactMods.specialDmgMult *= 0.62;
      p.turretMagicMult = 2;
    },
  },
  heavyHitter: {
    id: "heavyHitter",
    title: "HEAVY HITTER",
    blurb: "Ironhide + Warhammer. Immovable. Every swing is a siege engine.",
    heroTint: "heavyHitter",
    apply(p) {
      p.pactMods.dmgMult *= 3;
      p.pactMods.attackCdMult *= 1.5;
      p.pactMods.specialCdMult *= 1.45;
      p.laneSwapCd *= 2.15;
      p.climbSpeed *= 0.68;
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
