// v0.12+ Pact data - offered after every boss kill.
//
// Each pact is a TRADE-OFF. Pacts may be taken up to 3 times (ranks 1→3):
// higher rank = stronger buff and softer drawback; rank 3 is meant to feel like a capstone.
// `p.pactRanks[id]` holds the current rank; `p.pacts` logs each seal (ids may repeat).
//
// Live modifiers are read from p.pactMods (see makePlayer in player.js).

export const PACTS = [
  // ------------- Offensive pacts -------------
  {
    id: "pact_of_vipers",
    name: "PACT OF VIPERS",
    blurb: "Strike like a snake, but fragile as one.",
    pros: ["+30% attack & special damage (ranks ↑ dmg, ↑ HP)"],
    cons: ["-15% max HP at rank 1 (softens on rank up)"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.dmgMult *= 1.30;
        p.hpMax = Math.max(1, Math.round(p.hpMax * 0.85));
      } else if (rank === 2) {
        p.pactMods.dmgMult *= 1.08;
        p.hpMax = Math.max(1, Math.round(p.hpMax * (0.92 / 0.85)));
      } else {
        p.pactMods.dmgMult *= 1.09;
        p.hpMax = Math.max(1, Math.round(p.hpMax * (0.98 / 0.92)));
      }
      p.hp = Math.min(p.hp, p.hpMax);
    },
  },
  {
    id: "patient_blade",
    name: "PATIENT BLADE",
    blurb: "Every swing lands cleaner, but slower.",
    pros: ["+25% crit at r1 (more per rank)", "attack CD softens on rank up"],
    cons: ["attacks cool slower at rank 1"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.critChance += 0.25;
        p.pactMods.attackCdMult *= 1.15;
      } else if (rank === 2) {
        p.pactMods.critChance += 0.10;
        p.pactMods.attackCdMult *= (1.11 / 1.15);
      } else {
        p.pactMods.critChance += 0.12;
        p.pactMods.attackCdMult *= (1.06 / 1.11);
      }
    },
  },
  {
    id: "perfectionist",
    name: "PERFECTIONIST",
    blurb: "Counter harder - but your baseline wilts.",
    pros: ["perfect-brace counter mult rises each rank"],
    cons: ["-10% base dmg at r1 (eases up)"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.counterMult = 2.0;
        p.pactMods.dmgMult *= 0.9;
      } else if (rank === 2) {
        p.pactMods.counterMult += 0.15;
        p.pactMods.dmgMult *= (0.93 / 0.9);
      } else {
        p.pactMods.counterMult += 0.2;
        p.pactMods.dmgMult *= (0.98 / 0.93);
      }
    },
  },
  {
    id: "glass_fangs",
    name: "GLASS FANGS",
    blurb: "One spectacular flurry. You'd better land it.",
    pros: ["+special focus (stronger each rank)"],
    cons: ["-20% basics at r1 (recovers slightly)"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.specialDmgMult *= 1.5;
        p.pactMods.specialCdMult *= 0.7;
        p.pactMods.attackDmgMult *= 0.8;
      } else if (rank === 2) {
        p.pactMods.specialDmgMult *= 1.08;
        p.pactMods.specialCdMult *= 0.97;
        p.pactMods.attackDmgMult *= (0.86 / 0.8);
      } else {
        p.pactMods.specialDmgMult *= 1.1;
        p.pactMods.specialCdMult *= 0.96;
        p.pactMods.attackDmgMult *= (0.92 / 0.86);
      }
    },
  },

  // ------------- Climb pacts -------------
  {
    id: "feather_cloak",
    name: "FEATHER CLOAK",
    blurb: "Every hop a glide; every shove a bruise.",
    pros: ["+climb / hop (grows)", "armor soak bite eases on rank up"],
    cons: ["-armor soak at r1"],
    tags: ["climb", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.climbSpeed *= 1.20;
        p.hopCooldown *= 0.80;
        p.armorSoak = Math.max(0, p.armorSoak - 0.15);
      } else if (rank === 2) {
        p.climbSpeed *= 1.05;
        p.hopCooldown *= 0.97;
        p.armorSoak = Math.min(0.95, p.armorSoak + 0.06);
      } else {
        p.climbSpeed *= 1.08;
        p.hopCooldown *= 0.95;
        p.armorSoak = Math.min(0.95, p.armorSoak + 0.08);
      }
    },
  },
  {
    id: "iron_gizzard",
    name: "IRON GIZZARD",
    blurb: "Absurd vitality bought with brick-feet.",
    pros: ["+max HP (more each rank)", "climb penalty softens"],
    cons: ["-climb speed at r1"],
    tags: ["climb", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.hpMax += 40;
        p.hp = p.hpMax;
        p.climbSpeed *= 0.90;
      } else if (rank === 2) {
        p.hpMax += 18;
        p.hp = Math.min(p.hpMax, p.hp + 18);
        p.climbSpeed *= (0.95 / 0.90);
      } else {
        p.hpMax += 22;
        p.hp = Math.min(p.hpMax, p.hp + 22);
        // Rank 3: full climb speed — you paid for the tank fantasy in triplicate.
        p.climbSpeed *= (1.0 / 0.95);
      }
    },
  },
  {
    id: "bile_tongue",
    name: "BILE TONGUE",
    blurb: "Acid kisses hurt less, strikes hurt less too.",
    pros: ["longer acid timer", "dmg penalty eases"],
    cons: ["-dmg at r1"],
    tags: ["climb", "combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.acidTimerMax = Math.round(p.acidTimerMax * 1.5);
        p.acidTimer = p.acidTimerMax;
        p.pactMods.dmgMult *= 0.85;
      } else if (rank === 2) {
        p.acidTimerMax = Math.round(p.acidTimerMax * 1.08);
        p.acidTimer = Math.min(p.acidTimerMax, p.acidTimer + 4);
        p.pactMods.dmgMult *= (0.90 / 0.85);
      } else {
        p.acidTimerMax = Math.round(p.acidTimerMax * 1.1);
        p.acidTimer = p.acidTimerMax;
        p.pactMods.dmgMult *= (0.96 / 0.90);
      }
    },
  },
  {
    id: "marathon_lungs",
    name: "MARATHON LUNGS",
    blurb: "Long haul. No breath between chambers.",
    pros: ["+acid timer & climb", "mana between chambers returns in part"],
    cons: ["mana regen 0 at r1"],
    tags: ["climb"],
    apply(p, rank) {
      if (rank === 1) {
        p.acidTimerMax += 12;
        p.acidTimer = p.acidTimerMax;
        p.climbSpeed *= 1.15;
        p.pactMods.manaRegen = 0;
      } else if (rank === 2) {
        p.acidTimerMax += 8;
        p.acidTimer = p.acidTimerMax;
        p.climbSpeed *= 1.03;
        p.pactMods.manaRegen = (p.pactMods.manaRegen || 0) + 6;
      } else {
        p.acidTimerMax += 12;
        p.acidTimer = p.acidTimerMax;
        p.climbSpeed *= 1.05;
        p.pactMods.manaRegen = (p.pactMods.manaRegen || 0) + 14;
      }
    },
  },
  {
    id: "tide_watcher",
    name: "TIDE WATCHER",
    blurb: "The bile crawls. So does the falling muck.",
    pros: ["slower bile & debris", "HP tax eases on rank up"],
    cons: ["-15% max HP at r1"],
    tags: ["climb", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.bileRiseMult *= 0.80;
        p.pactMods.debrisRateMult *= 1.15;
        p.hpMax = Math.max(1, Math.round(p.hpMax * 0.85));
        p.hp = Math.min(p.hp, p.hpMax);
      } else if (rank === 2) {
        p.pactMods.bileRiseMult *= 0.95;
        p.pactMods.debrisRateMult *= (1.20 / 1.15);
        p.hpMax = Math.max(1, Math.round(p.hpMax * (0.90 / 0.85)));
        p.hp = Math.min(p.hp, p.hpMax);
      } else {
        p.pactMods.bileRiseMult *= 0.92;
        p.pactMods.debrisRateMult *= (1.28 / 1.20);
        p.hpMax = Math.max(1, Math.round(p.hpMax * (0.95 / 0.90)));
        p.hp = Math.min(p.hp, p.hpMax);
      }
    },
  },
  {
    id: "ring_forger",
    name: "RING FORGER",
    blurb: "Start the next climb wrapped in borrowed plate.",
    pros: ["free Ring next climb (each rank)", "bile tax softens"],
    cons: ["faster bile at r1"],
    tags: ["climb"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.freeRingPending = true;
        p.pactMods.bileRiseMult *= 1.15;
      } else if (rank === 2) {
        p.pactMods.freeRingPending = true;
        p.pactMods.bileRiseMult *= (1.10 / 1.15);
      } else {
        p.pactMods.freeRingPending = true;
        p.pactMods.bileRiseMult *= (1.02 / 1.10);
      }
    },
  },

  // ------------- Defensive pacts -------------
  {
    id: "stone_skin",
    name: "STONE SKIN",
    blurb: "Hurts less. Moves less.",
    pros: ["+soak & armor", "speed penalty eases"],
    cons: ["-climb / lane swap at r1"],
    tags: ["stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.armorSoak = Math.min(0.95, p.armorSoak + 0.20);
        p.armorMax += 15;
        p.armor += 15;
        p.climbSpeed *= 0.90;
        p.laneSwapCd *= 1.10;
      } else if (rank === 2) {
        p.armorSoak = Math.min(0.95, p.armorSoak + 0.06);
        p.armorMax += 8;
        p.armor += 8;
        p.climbSpeed *= (0.94 / 0.90);
        p.laneSwapCd *= (1.07 / 1.10);
      } else {
        p.armorSoak = Math.min(0.95, p.armorSoak + 0.08);
        p.armorMax += 12;
        p.armor += 12;
        p.climbSpeed *= (0.99 / 0.94);
        p.laneSwapCd *= (1.03 / 1.07);
      }
    },
  },
  {
    id: "hollow_husk",
    name: "HOLLOW HUSK",
    blurb: "Learn to read the tells the hard way.",
    pros: ["+dodge & mana", "HP bite eases"],
    cons: ["-15% max HP at r1"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.dodgeWindow *= 1.30;
        p.manaMax = Math.round(p.manaMax * 1.15);
        p.mana = Math.min(p.manaMax, p.mana + 10);
        p.hpMax = Math.max(1, Math.round(p.hpMax * 0.85));
        p.hp = Math.min(p.hp, p.hpMax);
      } else if (rank === 2) {
        p.dodgeWindow *= 1.06;
        p.manaMax = Math.round(p.manaMax * 1.06);
        p.mana = Math.min(p.manaMax, p.mana + 8);
        p.hpMax = Math.max(1, Math.round(p.hpMax * (0.90 / 0.85)));
        p.hp = Math.min(p.hp, p.hpMax);
      } else {
        p.dodgeWindow *= 1.08;
        p.manaMax = Math.round(p.manaMax * 1.06);
        p.mana = Math.min(p.manaMax, p.mana + 12);
        p.hpMax = Math.max(1, Math.round(p.hpMax * (0.95 / 0.90)));
        p.hp = Math.min(p.hp, p.hpMax);
      }
    },
  },
  {
    id: "blood_tithe",
    name: "BLOOD TITHE",
    blurb: "Pay in blood, draw on stolen life.",
    pros: ["on-kill heal & dmg (scale up)", "HP cost eases on rank"],
    cons: ["-20 max HP at r1"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.lifestealOnKill = 20;
        p.pactMods.dmgMult *= 1.10;
        p.hpMax = Math.max(1, p.hpMax - 20);
        p.hp = Math.min(p.hp, p.hpMax);
      } else if (rank === 2) {
        p.pactMods.lifestealOnKill += 8;
        p.pactMods.dmgMult *= 1.05;
        p.hpMax = Math.max(1, p.hpMax + 6);
        p.hp = Math.min(p.hpMax, p.hp + 6);
      } else {
        p.pactMods.lifestealOnKill += 12;
        p.pactMods.dmgMult *= 1.07;
        p.hpMax = Math.max(1, p.hpMax + 12);
        p.hp = Math.min(p.hpMax, p.hp + 12);
      }
    },
  },

  // ------------- Utility / zany pacts -------------
  {
    id: "hex_eyed",
    name: "HEX-EYED",
    blurb: "Poison drips from every cut you make.",
    pros: ["stronger poison each rank", "direct dmg tax eases"],
    cons: ["-10% direct dmg at r1"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.poisonPct = Math.max(p.pactMods.poisonPct || 0, 0.03);
        p.pactMods.poisonTime = Math.max(p.pactMods.poisonTime || 0, 3);
        p.pactMods.dmgMult *= 0.90;
      } else if (rank === 2) {
        p.pactMods.poisonPct = Math.max(p.pactMods.poisonPct || 0, 0.038);
        p.pactMods.poisonTime = Math.max(p.pactMods.poisonTime || 0, 3.4);
        p.pactMods.dmgMult *= (0.93 / 0.90);
      } else {
        p.pactMods.poisonPct = Math.max(p.pactMods.poisonPct || 0, 0.056);
        p.pactMods.poisonTime = Math.max(p.pactMods.poisonTime || 0, 4.25);
        p.pactMods.dmgMult *= (0.99 / 0.93);
      }
    },
  },
  {
    id: "feed_frenzy",
    name: "FEED FRENZY",
    blurb: "Gorge on power-ups; you need every scrap.",
    pros: ["more drops & burger heal", "debris tax eases"],
    cons: ["+debris dmg at r1"],
    tags: ["climb"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.powerUpRateMult *= 2.0;
        p.pactMods.burgerBonusHp += 10;
        p.pactMods.debrisDmgMult *= 1.10;
      } else if (rank === 2) {
        p.pactMods.powerUpRateMult *= 1.12;
        p.pactMods.burgerBonusHp += 6;
        p.pactMods.debrisDmgMult *= (1.07 / 1.10);
      } else {
        p.pactMods.powerUpRateMult *= 1.14;
        p.pactMods.burgerBonusHp += 9;
        p.pactMods.debrisDmgMult *= (1.03 / 1.07);
      }
    },
  },
  {
    id: "glass_gauntlets",
    name: "GLASS GAUNTLETS",
    blurb: "Hurl yourself in. Regret nothing.",
    pros: ["counter & special (grow)", "incoming tax eases"],
    cons: ["+incoming dmg at r1"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.counterMult = Math.max(p.pactMods.counterMult, 1.5) + 0.40;
        p.pactMods.specialDmgMult *= 1.20;
        p.pactMods.incomingDmgMult *= 1.15;
      } else if (rank === 2) {
        p.pactMods.counterMult += 0.12;
        p.pactMods.specialDmgMult *= 1.06;
        p.pactMods.incomingDmgMult *= (1.12 / 1.15);
      } else {
        p.pactMods.counterMult += 0.16;
        p.pactMods.specialDmgMult *= 1.1;
        p.pactMods.incomingDmgMult *= (1.06 / 1.12);
      }
    },
  },
  {
    id: "worms_eye",
    name: "WORM'S EYE",
    blurb: "You see tells early, but MP flows slow.",
    pros: ["+dodge & heavy tell", "mana regen penalty eases"],
    cons: ["-50% pact mana regen at r1"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.dodgeWindow += 0.25;
        p.pactMods.heavyTellBonus += 0.2;
        p.pactMods.manaRegen = Math.round((p.pactMods.manaRegen ?? 25) * 0.5);
      } else if (rank === 2) {
        p.dodgeWindow += 0.08;
        p.pactMods.heavyTellBonus += 0.08;
        p.pactMods.manaRegen = Math.round((p.pactMods.manaRegen ?? 12) * 1.35);
      } else {
        p.dodgeWindow += 0.12;
        p.pactMods.heavyTellBonus += 0.1;
        p.pactMods.manaRegen = Math.round((p.pactMods.manaRegen || 12) * 1.42);
      }
    },
  },
  {
    id: "enders_rite",
    name: "ENDER'S RITE",
    blurb: "Finish fights fast, or starve.",
    pros: ["execute window & bonus improve", "off-HP dmg tax eases"],
    cons: ["-15% dmg outside execute at r1"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.executeThreshold = 0.4;
        p.pactMods.executeBonus = 1.4;
        p.pactMods.dmgMult *= 0.85;
      } else if (rank === 2) {
        p.pactMods.executeThreshold = Math.min(0.45, p.pactMods.executeThreshold + 0.03);
        p.pactMods.executeBonus *= 1.06;
        p.pactMods.dmgMult *= (0.90 / 0.85);
      } else {
        p.pactMods.executeThreshold = Math.min(0.52, p.pactMods.executeThreshold + 0.04);
        p.pactMods.executeBonus *= 1.1;
        p.pactMods.dmgMult *= (0.97 / 0.90);
      }
    },
  },

  {
    id: "fast_hands",
    name: "FAST HANDS",
    blurb: "Flash strikes — half muscle, half paper.",
    pros: ["half CDs stay; damage recovers slightly per rank"],
    cons: ["halved ability damage at r1"],
    tags: ["combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.fastHandsHalf = true;
        p.pactMods.attackCdMult *= 0.5;
        p.pactMods.specialCdMult *= 0.5;
        p.pactMods.attackDmgMult *= 0.5;
        p.pactMods.specialDmgMult *= 0.5;
        p.pactMods.dmgMult *= 0.5;
      } else if (rank === 2) {
        p.pactMods.attackDmgMult *= 1.10;
        p.pactMods.specialDmgMult *= 1.10;
        p.pactMods.dmgMult *= 1.08;
      } else {
        p.pactMods.attackDmgMult *= 1.14;
        p.pactMods.specialDmgMult *= 1.14;
        p.pactMods.dmgMult *= 1.1;
      }
    },
  },
  {
    id: "all_in_red",
    name: "ALL-IN ON RED",
    blurb: "Bleed stamina into the duel — soften every finishing blow.",
    pros: ["+max HP each rank", "flat dmg penalty eases"],
    cons: ["-20 flat per strike at r1"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.hpMax += 55;
        p.hp = Math.min(p.hpMax, p.hp + 55);
        p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) - 20;
      } else if (rank === 2) {
        p.hpMax += 22;
        p.hp = Math.min(p.hpMax, p.hp + 22);
        p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) + 8;
      } else {
        p.hpMax += 28;
        p.hp = Math.min(p.hpMax, p.hp + 28);
        p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) + 11;
      }
    },
  },
  {
    id: "all_in_black",
    name: "ALL-IN ON BLACK",
    blurb: "Borrow life for murder math.",
    pros: ["+flat strike damage (more per rank)", "HP cost eases"],
    cons: ["-50 max HP at r1"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.hpMax = Math.max(1, p.hpMax - 50);
        p.hp = Math.min(p.hp, p.hpMax);
        p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) + 25;
      } else if (rank === 2) {
        p.hpMax = Math.max(1, p.hpMax + 12);
        p.hp = Math.min(p.hpMax, p.hp + 12);
        p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) + 8;
      } else {
        p.hpMax = Math.max(1, p.hpMax + 18);
        p.hp = Math.min(p.hpMax, p.hp + 18);
        p.pactMods.outgoingFlat = (p.pactMods.outgoingFlat || 0) + 11;
      }
    },
  },
  {
    id: "split_fifty_fifty",
    name: "50 / 50",
    blurb: "The abyss flips its coin once per swing.",
    pros: ["coin flip magnitude grows with rank"],
    cons: ["variance stays risky"],
    tags: ["combat"],
    apply(p, rank) {
      p.pactMods.flipDamage5050 = true;
      if (rank === 1) p.pactMods.flipDamageAmt = 15;
      else if (rank === 2) p.pactMods.flipDamageAmt = 20;
      else p.pactMods.flipDamageAmt = 34;
    },
  },

  {
    id: "rotting",
    name: "ROTTING",
    blurb: "Regeneration with teeth.",
    pros: ["HoT each rank", "per-rank heal rises"],
    cons: ["Shaves max HP %"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      const pct = rank === 1 ? 0.05 : rank === 2 ? 0.045 : 0.04;
      p.hpMax = Math.max(1, Math.round(p.hpMax * (1 - pct)));
      p.hp = Math.min(p.hp, p.hpMax);
      p.pactMods.rottingHeal = rank === 1 ? 10 : rank === 2 ? 12 : 15;
      p.pactMods.rottingTick = rank === 3 ? 7.2 : 8;
    },
  },
  {
    id: "hopefull",
    name: "HOPEFULL",
    blurb: "Heavy soul. Light sword-arm.",
    pros: ["Big flat survivability stats", "damage tax softens on rank up"],
    cons: ["−25% outgoing damage at r1"],
    tags: ["combat", "stats"],
    apply(p, rank) {
      if (rank === 1) {
        p.pactMods.dmgMult *= 0.75;
        p.hpMax += 35;
        p.hp = Math.min(p.hpMax, p.hp + 35);
        p.manaMax += 35;
        p.mana += 35;
        p.armorMax += 35;
        p.armor = Math.min(p.armorMax, p.armor + 35);
        p.climbSpeed *= 1.07;
        p.dodgeWindow += 0.06;
        p.pactMods.manaRegen += 10;
      } else if (rank === 2) {
        p.pactMods.dmgMult *= 1.06;
        p.hpMax += 18;
        p.hp = Math.min(p.hpMax, p.hp + 18);
        p.manaMax += 18;
        p.mana = Math.min(p.manaMax, p.mana + 18);
        p.climbSpeed *= 1.03;
        p.dodgeWindow += 0.03;
      } else {
        p.pactMods.dmgMult *= 1.07;
        p.hpMax += 18;
        p.hp = Math.min(p.hpMax, p.hp + 18);
        p.manaMax += 18;
        p.mana = Math.min(p.manaMax, p.mana + 18);
        p.climbSpeed *= 1.03;
        p.dodgeWindow += 0.03;
      }
    },
  },
  {
    id: "happy_camper",
    name: "HAPPY CAMPER",
    blurb: "Trail snacks between bosses.",
    pros: ["Every 2 guardians: overheal + climb zeal", "rank scales overheal"],
    cons: ["Sluggish on ’early gut’ floors unless rested"],
    tags: ["climb", "stats"],
    apply(p, rank) {
      p.pactMods.happyCamper = true;
      p.pactMods.happyCamperOverheal = rank === 1 ? 60 : rank === 2 ? 72 : 84;
    },
  },
  {
    id: "hot_dog",
    name: "HOT DOG VENDOR",
    blurb: "Street meat calls.",
    pros: ["Snack restores you (+max HP)", "more relish each rank"],
    cons: ["Greasy fingers: −climb speed"],
    tags: ["climb", "stats"],
    apply(p, rank) {
      p.pactMods.hotDogPact = true;
      p.pactMods.hotDogHpBonus = rank === 1 ? 15 : rank === 2 ? 18 : 22;
      p.pactMods.hotDogClimbPenalty = rank === 1 ? 0.1 : rank === 2 ? 0.085 : 0.07;
      p.climbSpeed = Math.max(0.35, p.climbSpeed - (rank === 1 ? 0.1 : rank === 2 ? 0.085 : 0.07));
    },
  },
  {
    id: "slow_but_steady",
    name: "SLOW BUT STEADY",
    blurb: "Let bile wait.",
    pros: ["Acid clock slackens", "less debris", "chunk HP"],
    cons: ["Slower climb"],
    tags: ["climb", "stats"],
    apply(p, rank) {
      const hpAdd = rank === 1 ? 65 : rank === 2 ? 42 : 38;
      p.hpMax += hpAdd;
      p.hp += hpAdd;
      p.climbSpeed = Math.max(0.38, p.climbSpeed - 0.5);
      const bileEase = rank === 1 ? 0.6 : rank === 2 ? 0.68 : 0.74;
      p.pactMods.bileRiseMult *= bileEase;
      const debrisEase = rank === 1 ? 1.35 : rank === 2 ? 1.22 : 1.18;
      p.pactMods.debrisRateMult *= debrisEase;
    },
  },

  // ---- Silly pacts (unexpected trade-offs) ----
  {
    id: "silly_bile_express",
    name: "BILE EXPRESS",
    blurb: "Skip part of the gut-commute — the worm still collects its toll.",
    pros: ["Rank 1–2: big head start up the wall", "Rank 3: skip the whole climb"],
    cons: ["MP & max HP shrink when the shortcut fires (next climb entry)"],
    tags: ["climb"],
    apply(p, rank) {
      p.pactMods.sillyBileShortcutPending = true;
      p.pactMods.sillyBileShortcutRank = rank;
    },
  },
  {
    id: "silly_jitterbug_lease",
    name: "JITTERBUG LEASE",
    blurb: "Rent speed from your mana pool — feet first, brain later.",
    pros: ["Faster wall climb & lane hops (stronger each rank)"],
    cons: ["Shrinks max MP each rank"],
    tags: ["climb", "combat"],
    apply(p, rank) {
      if (rank === 1) {
        p.climbSpeed *= 1.15;
        p.hopCooldown *= 0.94;
        p.laneSwapCd *= 0.94;
        p.manaMax = Math.max(6, Math.round(p.manaMax * 0.9));
        p.mana = Math.min(p.mana, p.manaMax);
      } else if (rank === 2) {
        p.climbSpeed *= 1.42 / 1.15;
        p.hopCooldown *= 0.90;
        p.laneSwapCd *= 0.90;
        p.manaMax = Math.max(6, Math.round(p.manaMax * (0.75 / 0.9)));
        p.mana = Math.min(p.mana, p.manaMax);
      } else {
        p.climbSpeed *= 2.0 / 1.42;
        p.hopCooldown *= 0.62;
        p.laneSwapCd *= 0.62;
        p.manaMax = Math.max(4, Math.round(p.manaMax * (0.58 / 0.75)));
        p.mana = Math.min(p.mana, p.manaMax);
      }
    },
  },
  {
    id: "silly_worm_mirror",
    name: "WORM MIRROR",
    blurb: "The map lies; your blade does not. Mostly.",
    pros: ["Rank 1: +10% damage; A/D lanes flipped", "Rank 2+: W/S climb & brace flipped too", "Rank 3: ~2× total damage"],
    cons: ["Muscle memory weeps"],
    tags: ["climb", "combat"],
    apply(p, rank) {
      p.pactMods.sillyMirrorH = true;
      if (rank >= 2) p.pactMods.sillyMirrorV = true;
      if (rank === 1) p.pactMods.dmgMult *= 1.1;
      else if (rank === 2) p.pactMods.dmgMult *= 1.22;
      else p.pactMods.dmgMult *= 1.52;
    },
  },
];

const PACT_BY_ID = Object.fromEntries(PACTS.map((p) => [p.id, p]));
export function getPact(id) { return PACT_BY_ID[id] || null; }

/**
 * @param {number} n - number of cards
 * @param {Record<string, number>} pactRanks - per-pact rank already sealed (1–3); omit or {} for none
 */
export function rollPactChoices(n = 3, pactRanks = {}, game = null) {
  const ranks = pactRanks || {};
  const pool = PACTS.filter((p) => (ranks[p.id] || 0) < 3);
  if (game?.dealzPacts) {
    return pool.slice();
  }
  const result = [];
  const poolCopy = [...pool];
  while (result.length < n && poolCopy.length > 0) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    result.push(poolCopy.splice(idx, 1)[0]);
  }
  return result;
}
