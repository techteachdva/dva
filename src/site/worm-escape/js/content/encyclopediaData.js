// Inner Guts Encyclopedia — lore + STATS pulled from gameplay data (see SYNERGY_STATS below).
//
// ⚠ KEEP IN SYNC WHEN YOU EDIT: `player.js` (classes/weapons/globals), `enemies.js`,
// `synergies.js`, `chambers.js`, `pacts.js`, `elites.js`, `climb.js`/`combat.js`.
// Tweaking numbers elsewhere? Bump the matching lines here too so the cheating scholar stays honest.

import { BUILDS, LOADOUTS, GLOBAL_ATTACK_CD_MULT, plasmElementMult } from "./player.js";
import { SYNERGIES, listSynergyPairings } from "./synergies.js";
import { ENEMIES } from "./enemies.js";
import { CHAMBERS } from "./chambers.js";
import { PACTS } from "./pacts.js";
import { ELITE_TWISTS } from "./elites.js";

/** @typedef {{ id: string, category: string, title: string, subtitle: string, facts: string[], flavor: string }} CodexEntry */

const ART_LABEL = {
  tentacle: "tentacles",
  teeth: "tooth nightmares",
  zombie: "zombie soup",
  flesh: "flesh blobs",
  bile: "bile beasts",
};

function matchupLine(strongVs, weakVs) {
  return `MATCHUP • strong vs ${ART_LABEL[strongVs] ?? strongVs} (+60%), weak vs ${ART_LABEL[weakVs] ?? weakVs} (-40%) — see Mechanics / Weapon matchups`;
}

/** Human-readable synergy stat notes (mirror `apply()` in synergies.js). */
const SYNERGY_STAT_LINES = {
  chainSword: [
    "pactMods.dmgMult ×1.12",
    "attack damage ×1.08",
    "attack CDs ×1.22 (longer swings)",
    "lane swap cooldown ×1.18",
    "Passive: chainSword DPS 13.5 while sharing the guardian’s lane (see combat)",
  ],
  monk: [
    "attack damage ×1.45",
    "attack CDs ×0.78 (spammy)",
    "lane swap cooldown ×1.52 (squish boots)",
    "+5 pact mana regen / chamber",
  ],
  scout: [
    "forces hpMax → 40 when synergy applies",
    "dmgMult / attack dmg / special dmg all ×2 (ouch)",
    "critChance +18%",
    "manaCostBonus −2 (after wizard tax math)",
    "special CdMult ×0.72, attack CdMult ×0.82",
    "attack MP cost rounded ×55%, special MP rounded ×55%",
  ],
  grimReaper: [
    "turns poison into ROT (uses decay pipeline)",
    "pact poison bonus zeroed-out",
    "dmgMult ×0.92 (grim tax)",
  ],
  whizid: [
    "dmgMult ×2, attack/special CdMult ×0.5",
    "manaCostBonus ×3 (rounding), +16 pact manaRegen/chamber",
    "whizidRollMana gimmick (+6 mana on roll mechanic)",
  ],
  turretSummoner: [
    "attack/special dmg mult ×0.62 (cheap swings)",
    "turretMagicMult = 2 (turret DPS synergy)",
  ],
  heavyHitter: [
    "dmgMult ×3 (bonk)",
    "attack CdMult ×1.5, special CdMult ×1.45",
    "laneSwapCd ×2.15, climbSpeed ×0.68",
  ],
};

const CLASS_BARF = {
  swift:
    "The gym sock of adventurers: looks lightweight, smells like adrenaline, probably wins dodgeball forever.",
  iron:
    "Walking geometry homework: all rectangles, maximum tank. If you hug them you dent your face.",
  viper:
    "That kid who insists they’re stealthy because they hiss before pranking you.",
  wizard:
    "Math club president who figured out mana is edible if you yell loud enough.",
  balanced:
    "Ordered plain yogurt for stats. Loudly insists it tastes ‘complex’.",
  tryHard:
    "Speedruns lunch and complains ghosts are ‘too RNG’. Has 10 HP and main-character syndrome.",
  gambler:
    "Will roll dice to pick who goes first at recess. Ends up eating glue once. Still undefeated.",
  tamer:
    "Brings snacks to tame monsters then forgets monsters prefer meat.",
  necromancer:
    'Talks to bones. Bones talk back sometimes with "PLEASE STOP".',
};

const WEAPON_GOOF = {
  sword:
    "Fancy stabby rectangle. Great for chopping tentacles spaghetti-style.",
  hammer:
    "If it works on walnuts it works on undead jaws. OSHA would like a word.",
};

function weaponFlavor(id) {
  return WEAPON_GOOF[id] || "Some adventurer glued stats to this object and called it heroic.";
}

function scaledCd(seconds) {
  return (seconds * GLOBAL_ATTACK_CD_MULT).toFixed(2);
}

function summarizeLoadout(id, lo) {
  /** @type {string[]} */
  const lines = [];
  lines.push(lo.blurb || "");
  if (lo.chairClimbMult) lines.push(`Climb gimmick • chair ×${lo.chairClimbMult}`);
  if (lo.combatAs) lines.push(`Combat uses LOADOUT '${lo.combatAs}' internally (still shows as '${id}' in menus).`);

  const atk = lo.attack;
  const spec = lo.special;
  lines.push("");
  lines.push(`GLOBAL_NOTE • Listed cooldowns × ${GLOBAL_ATTACK_CD_MULT.toFixed(2)} in real combat (GLOBAL_ATTACK_CD_MULT).`);

  if (atk) {
    const tag = atk.multiLane ? " [MULTI-LANE]" : atk.hexMark ? " [MARK]" : atk.plasmBolt ? " [PLASM Q]" : atk.plasmCycle ? " [PLASM ROTATE]" : "";
    lines.push(`ATTACK • ${atk.name}${tag} — dmg ${atk.dmg[0]}-${atk.dmg[1]}, CD ${scaledCd(atk.cooldown)}s, ${atk.manaCost} MP`);
    const tags = [];
    if (atk.lifestealPct) tags.push(`${Math.round(atk.lifestealPct * 100)}% lifesteal`);
    if (atk.poisonPct) tags.push(`bleed-ish ${atk.poisonPct * 100}% max HP (${atk.poisonTime}s)`);
    if (tags.length) lines.push(`  extras: ${tags.join(", ")}`);
  } else {
    lines.push("ATTACK • (none — climb/loadout gimmick)");
  }

  if (spec) {
    let extra = "";
    if (spec.sentryBuild) extra = ` [SENTRY BUILD ${spec.buildTime ?? "?"}s, DPS ${JSON.stringify(spec.sentryDmg || [])}]`;
    if (spec.plasmCycle) extra += " [gene mode cycle]";
    if (spec.misfireChance) extra += ` [~${Math.round((1 - spec.misfireChance) * 100)}% real rev]`;
    lines.push(`SPECIAL • ${spec.name}${extra} — dmg ${spec.dmg[0]}-${spec.dmg[1]}, CD ${scaledCd(spec.cooldown)}s, ${spec.manaCost} MP`);
  }

  if (lo.plasmModes?.length) {
    lines.push("");
    lines.push(`PLASM • Q / [1] fires the active gene bolt · E / [2] cycles FIRE → SHOCK → CRYO`);
    lo.plasmModes.forEach((m) => {
      lines.push(`  • ${m.label}: ${m.boltName} — ${m.dmg[0]}-${m.dmg[1]}, CD ${scaledCd(m.cooldown)}s, ${m.manaCost} MP, elt ${m.plasmElement}`);
    });
    lines.push("  TEETH NOTE • teeth art always ×1 damage for bolts (neutral). Others use plasmElementMult()");
  }

  if (lo.strongVs) lines.push(matchupLine(lo.strongVs, lo.weakVs));

  return lines.filter(Boolean);
}

function buildClassEntries() {
  /** @type {CodexEntry[]} */
  const out = [];
  for (const [id, b] of Object.entries(BUILDS)) {
    /** @type {string[]} */
    const facts = [
      `${b.name} (${id})`,
      `HP ${b.hp} · Mana ${b.mana} · Armor ${b.armor} · Armor soak ${Math.round((b.armorSoak || 0) * 100)}%`,
      `Climb speed ×${b.climbSpeed} · hopCooldown ${b.hopCooldown}s · laneSwap ${b.laneSwapCd}s`,
      `Acid corrosion pace ×${b.acidResist}`,
      `Tank debris freebies: ${b.tankHits ?? 0}`,
    ];
    if (b.poisonPct) facts.push(`Viper gimmick poison: ${Math.round((b.poisonPct || 0) * 100)}% enemy max HP / s for ${b.poisonTime}s after hits`);
    if (b.tryHardGimmick) facts.push("Try-hard: dmg & climb speed multiplied elsewhere (stats screen shows base).");
    if (b.gamblerGimmick) facts.push("Gambler: each outgoing hit dmg rolls roughly ×0.5–×3 (RNG).");
    if (b.tamerGimmick) facts.push("Tamer: +10 HP cap, +10 mana cap, +10 armor cap, heal 10 HP, and ~+3.5% global damage multiplier per foe slain.");
    if (b.manaShield) {
      facts.push(
        `Caster kit: Mana shield drains MP before armor/HP (${b.manaShieldRatio ?? "?"} MP per 1 dmg), outgoing spell amp ×${b.spellAmpMult}, +${b.manaCostBonus} mana tax baked into weapon buttons.`,
      );
    }

    out.push({
      id: `class:${id}`,
      category: "class",
      title: b.name,
      subtitle: `Build ID: ${id}`,
      facts,
      flavor: CLASS_BARF[id] || "This class wandered in from dodgeball detention with extra homework.",
    });
  }
  return out;
}

function buildWeaponEntries() {
  /** @type {CodexEntry[]} */
  const out = [];
  for (const [id, lo] of Object.entries(LOADOUTS)) {
    if (!lo?.name) continue;
    const facts = summarizeLoadout(id, lo);
    out.push({
      id: `weapon:${id}`,
      category: "weapon",
      title: lo.name,
      subtitle: `Loadout '${id}'`,
      facts,
      flavor: `${lo.blurb ?? ""}\nFlavor: ${weaponFlavor(id)}`,
    });
  }
  return out;
}

function buildEnemyEntries() {
  /** @type {CodexEntry[]} */
  const out = [];
  for (const e of Object.values(ENEMIES)) {
    /** @type {string[]} */
    const facts = [
      `Enemy art tag: '${e.art}' (drives matchup math)`,
      `HP pool ${e.hp}`,
      `Acid spit interval ~${JSON.stringify(e.acidInterval)}s`,
      `Standard slap ${JSON.stringify(e.attackDmg)} · chunky slam ${JSON.stringify(e.heavyDmg)}`,
      `ENRAGE near ${Math.round(e.enrageAt * 100)}% HP`,
    ];
    facts.push("", 'Tips: matchupMultiplier(loadout,' + `'${e.art}'` + ') → DEVASTATING 1.6 / GLANCING 0.6');
    facts.push(`${e.flavorIntro}`);

    out.push({
      id: `enemy:${e.id}`,
      category: "enemy",
      title: e.name,
      subtitle: `${e.art} vibes`,
      facts,
      flavor:
        `"${String(e.flavorDeath)}" Sounds metal until you realize you’re quoting stomach acid.\nHeavy move: ${e.flavorHeavy}\nCombo: ${e.flavorCombo}`,
    });
  }
  return out;
}

function buildSynergyEntries() {
  /** @type {CodexEntry[]} */
  const out = [];
  for (const pairing of listSynergyPairings()) {
    const syn = SYNERGIES[pairing.synergyId];
    if (!syn) continue;
    const lines = SYNERGY_STAT_LINES[pairing.synergyId] || ["Inspect synergies.js apply() for gritty truth."];
    const facts = [
      `PAIRING • ${pairing.buildId} + ${pairing.loadoutId} → synergy id '${syn.id}'`,
      `Official blurb • ${syn.blurb}`,
      "",
      "...stat sauce...",
      ...lines.map((l) => `• ${l}`),
    ];

    out.push({
      id: `synergy:${pairing.synergyId}`,
      category: "synergy",
      title: syn.title,
      subtitle: `${pairing.buildId} × ${pairing.loadoutId}`,
      facts,
      flavor:
        `"${syn.title}" is what happens when the forge ships headcanon DLC. Glow filter: '${syn.heroTint ?? "stock hero"}'\nSeriously though: combos like this intentionally break balance in fun ways.`,
    });
  }

  return out;
}

function buildMechanicEntries() {
  /** @type {CodexEntry[]} */
  const out = [];

  out.push({
    id: "mech:glob",
    category: "mechanic",
    title: "Global cadence scaler",
    subtitle: `${GLOBAL_ATTACK_CD_MULT.toFixed(2)}× attack/special timings`,
    facts: [
      "`GLOBAL_ATTACK_CD_MULT` stretches every LOADOUT cooldown after cloning (attacks, specials, plasm bolts, tertiary cryo, etc.).",
      "Why? So button mashers hydrate between swings — dev comment in player.js confesses.",
    ],
    flavor: "If your fingers catch fire now, pretend it’s immersion.",
  });

  /** @type {string[]} */
  const plasmTable = [];
  const arts = ["flesh", "bile", "zombie", "tentacle", "teeth"];
  arts.forEach((art) => {
    plasmTable.push(
      `${art.padEnd(10)} • fire ×${plasmElementMult("fire", art)}  shock ×${plasmElementMult("shock", art)}  cryo ×${plasmElementMult("cryo", art)}`,
    );
  });

  out.push({
    id: "mech:matchups-generic",
    category: "mechanic",
    title: "Weapon matchups vs enemy art tags",
    subtitle: "`matchupMultiplier / matchupLabel`",
    facts: [
      "Weapons carry strongVs + weakVs which map onto ENEMIES[].art (+60% glorious / −40% ouch unless override).",
      "UI text shouts DEVASTATING / GLANCING when mult ≥ 1.5 / ≤ 0.75.",
      "...",
      "",
      "...ADAM ELEMENT TABLE (gene bolts) sampled:",
      ...plasmTable,
    ],
    flavor:
      'Think Pokémon but your mom only lets you yell "SCIENCE FAIR PROJECT" instead of elemental names.',
  });

  CHAMBERS.forEach((ch) => {
    out.push({
      id: `mech:chamber-${ch.id}`,
      category: "mechanic",
      title: `Chamber — ${ch.name}`,
      subtitle: ch.tagline,
      facts: [
        ` climbHeight=${ch.climbHeight}px`,
        ` bileRise=${ch.bileRiseRate} px/s (before pact bileRiseMult)`,
        ` debris cadence=${JSON.stringify(ch.debrisInterval)}s spawnCount=${ch.spawnCount} multiChance=${ch.multiDebrisChance} speed=${ch.debrisSpeed}`,
        ` PU rarity=${ch.powerUpRarity}`,
        ` acidTimer=${ch.acidTimer}s guardian=${ch.guardian}${ch.isMaw ? " (FINAL MAW)" : ""}`,
      ],
      flavor: `If bile were a classmate, '${ch.name}' would be when it secretly starts raising its hand.`,
    });
  });

  out.push({
    id: "mech:pact-ranks-overview",
    category: "mechanic",
    title: "Pacts — ranks & re-seals",
    subtitle: "Same pact id can seal again until rank 3 — see pacts.js",
    facts: [
      "After each sphincter guardian you pick one pact (3 cards normally, 4 if the guardian was Elite, or Bubblegum’s four separate 3-card rounds after twin fights).",
      "Each pact id tracks rank 1 → 2 → 3. Re-choosing that pact applies apply(p, rank): buffs scale up a notch and drawbacks ease slightly at ranks 2 and 3.",
      "The random pool still offers a pact until that id reaches rank 3, then it is excluded for the rest of the run.",
      "`player.pactRanks` stores current rank per id; `player.pacts` is an ordered log of every seal (ids may repeat). Scoreboard ‘Pacts Survived’ still uses seal count × chambers cleared × the pact weight.",
      "Pact picker UI shows NEXT SEAL · RANK n/3 when you already hold that pact at rank ≥ 1.",
    ],
    flavor:
      "The worm initials the contract in triplicate. Same fine print, bigger crayon each time.",
  });

  PACTS.forEach((p) => {
    out.push({
      id: `mech:pact-${p.id}`,
      category: "mechanic",
      title: p.name,
      subtitle: `Pact (${p.tags?.join(", ") || "mixed"}) — ranks 1–3`,
      facts: [
        p.blurb,
        ...(p.pros || []).map((x) => ` + ${x}`),
        ...(p.cons || []).map((x) => ` − ${x}`),
        "Each seal calls applyPact → apply(p, rank) with rank 1, 2, or 3 for this id (see pacts.js). Higher rank = stronger benefit line + milder cost line for that pact.",
      ],
      flavor:
        `Think of '${p.name}' like trading cafeteria desserts: glorious sugar crash included.`,
    });
  });

  ELITE_TWISTS.forEach((t) => {
    out.push({
      id: `mech:elite-${t.id}`,
      category: "mechanic",
      title: `Elite twist — ${t.name}`,
      subtitle: combatEliteFacts(),
      facts: [`${t.blurb}`, "(See elites.js combat wiring for crunchy behavior.)"],
      flavor: `"${t.name}" is secretly the worm cosplaying Destiny raid mechanics badly.`,
    });
  });

  out.push({
    id: "mech:cheats-help",
    category: "mechanic",
    title: "Cheat keypad",
    subtitle: '\\ key opens this terminal — it never prints hints',
    facts: [
      '\\ still opens contraband, but victorious runs also populate the CHEATS tab.',
      'Title screen INNER GUTS CODEX chip opens lore without wiping your save preview.',
      "Exact passphrases stay locked until RNG blesses them after a WIN — poke the CHEATS tab.",
      "End-of-run score (Victory breakdown + Game Over partials) reads runtime flags when the run ends. Type nocheats before the finale if you want those rows cleared.",
      "Benefit-style toggles subtract; harder-mode toggles add. Implemented in engine/cheatScore.js — approximate rows: Easy forge (Dez / pick-any) −2400 · Pink Floyd +1700 · Jilly −2100 · Bubblegum −2800 · Wyrm easy −3400 · Dragon hard +2600 · Rowan −900 · Lemon −700 (stacks if multiple are ON).",
      "Acererack invulnerability is still its own −1,000,000 line when first turned ON during the run (separate from the table above).",
    ],
    flavor: "The keypad itself is coy; a full roster on the billboard would have been vulgar.",
  });

  out.push({
    id: "mech:climb-bits",
    category: "mechanic",
    title: "Climb debris & pickups (high level)",
    subtitle: "`climb.js` telegraphs vs hazards",
    facts: [
      "Hazard types: armor-absorb, pierce, armor-direct, flesh-only (+ more edge cases)",
      'Power-ups: feather boosts progress, burgers heal HP, mana flasks refill MP (~42% typical), ring spikes armor soak',
      "CHAMBER_DMG_SCALE array bumps sting per depth.",
      "~11% occasional extra spawn burst + odd/even column bias sprinkle drama.",
      "Bile climbs while you climb — pause not included unless you mashed P (not here).",
    ],
    flavor: "If an apple fell on Newton in this gut, he'd measure acid splash radius first.",
  });

  out.push({
    id: "mech:combat-bits",
    category: "mechanic",
    title: "Combat loop cheat sheet",
    subtitle: "`combat.js` vibes",
    facts: [
      "Five lanes guardian arena; telegraphs show acid blobs; brace mitigates, perfect braces cash counters.",
      "Weapons may multi-lane, hex mark, sentry deploy… see individual weapon codex tabs.",
      "Mana pot mini-game still exists somewhere under R / button 3 (check HUD).",
    ],
    flavor: 'Turn-based menu combat with extra digestive trauma for students who peaked in middle school dodgeball.',
  });

  out.push({
    id: "mech:maw-bits",
    category: "mechanic",
    title: "Maw finale (tooth rave)",
    subtitle: "`tongueBoss.js` boss wall",
    facts: [
      "Five lanes vs five molars; top teeth slam telegraphed; brace & perfect-timing counters still matter.",
      "Bottom bar: Q/E/F like combat · R/[3] = mana vial mini-game (same as sphincter fights).",
      "X dodge-twitch hops a lane (+3 MP) with a short invulnerability flash — separate from mana vials.",
      "Matchup vs TEETH weapon tags still applies · knocked molars respawn slowly (juggle timings).",
    ],
    flavor:
      '"Whack five teeth at once" is honestly the coolest science fair hypothesis ever pitched by a bile worm.',
  });

  return out;
}

function combatEliteFacts() {
  return "+30% HP, +15% dmg, enrage 60% HP, gold aura aura aura";
}

/** Build searchable codex chunks once at cold load — safe to import anywhere. */
export function buildCodexEntries() {
  return [
    ...buildClassEntries(),
    ...buildWeaponEntries(),
    ...buildEnemyEntries(),
    ...buildSynergyEntries(),
    ...buildMechanicEntries(),
  ];
}
