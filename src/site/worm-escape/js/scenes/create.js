import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel,
  drawHero, drawBar, drawSphere, drawPlate, drawDropShadow, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { BUILDS, LOADOUTS, makePlayer } from "../content/player.js";
import { loadSave } from "../engine/storage.js";
import { ClimbScene } from "./climb.js";

// v0.16 Full weapon pool. Weapons gated by `LOADOUT_UNLOCK` are filtered out
// of the random roll if the unlock isn't owned.
const ALL_LOADOUT_IDS = [
  "sword", "hammer", "emberStaff", "frostWand",
  "fryingPan", "saber", "fists", "club",
  "bileWhip", "hexStaff",
  "megaphone", "boneSpear", "blunderbuss",
  "cursedScythe", "rustyChainsaw", "cat",
  "engineerWrench", "voidWalker", "chair", "plasmids",
];

// v0.12 Unlock gating.
// Keys map a build / loadout id -> save.unlocks flag that must be true.
// If a build/loadout isn't in this map, it's always available.
const BUILD_UNLOCK  = {
  viper: "viperBuild",
  wizard: "wizardBuild",
  necromancer: "necromancerBuild",
};
const LOADOUT_UNLOCK = {
  bileWhip:      "bileWhip",
  hexStaff:      "hexStaff",
  megaphone:     "megaphone",
  boneSpear:     "boneSpear",
  blunderbuss:   "blunderbuss",
  cursedScythe:  "cursedScythe",
  rustyChainsaw: "rustyChainsaw",
  cat:           "cat",
};
const BUILD_UNLOCK_HINT  = {
  viper:  "UNLOCK: Clear any run with any build.",
  wizard: "UNLOCK: Clear a run with VIPER.",
  necromancer: "Defeat the dungeon — or use cheat JACKSON.",
};
const LOADOUT_UNLOCK_HINT = {
  bileWhip:      "UNLOCK: Clear the Gullet climb hitless.",
  hexStaff:      "UNLOCK: Defeat any Elite boss.",
  megaphone:     "UNLOCK: Clear any run.",
  boneSpear:     "UNLOCK: Clear any run.",
  blunderbuss:   "UNLOCK: Clear any run.",
  cursedScythe:  "UNLOCK: Clear a run with VIPER.",
  rustyChainsaw: "UNLOCK: Defeat any Elite boss.",
  cat:           "UNLOCK: Clear a run with WIZARD.",
};

// Fisher-Yates shuffle. Returns a NEW array; doesn't mutate input.
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Friendly labels for enemy "art" types used in weapon matchups.
const ART_LABEL = {
  tentacle: "TENTACLES",
  teeth:    "TOOTHED BEASTS",
  zombie:   "ROTTED HUSKS",
  flesh:    "FLESH HORRORS",
  bile:     "BILE OOZES",
};

/** Short perk blurbs for forge cards (matches BUILDS gimmicks). */
function getBuildPerkLines(id) {
  const map = {
    balanced: [
      "- Reliable stats — no harsh tradeoffs",
      "- Good learn-the-ropes baseline",
    ],
    tryHard: [
      "- 2× DAMAGE and 2× climb speed",
      "- Max HP locked at 10",
    ],
    gambler: [
      "- Damage per hit rolls between ¼× and 3.5×",
      "- High variance swings",
    ],
    tamer: [
      "- Bonus damage when prey is wounded",
      "- Weaker raw hits without finishers",
    ],
    swift: [
      "- Lightning hops between columns",
      "- Widest acid-gout dodge window",
      "- High base mana pool",
    ],
    iron: [
      "- Armor absorbs most chip damage",
      "- Debris soak + acid resistance",
    ],
    viper: [
      "- Poison on every attack",
      "- Balanced climb and modest armor soak",
    ],
    wizard: [
      "- Huge mana + mana shield",
      "- +outgoing spell damage, fragile body",
    ],
    necromancer: [
      "- Death-mage: mana shield + heavy spell amp",
      "- Unlocked via cheat JACKSON only",
    ],
  };
  return map[id] || ["- Forge your own legend."];
}

export class CreateScene {
  constructor() {
    this.t = 0;
    this.step = 0;
    this.buildWheelIdx = 0;
    this.loadIdx = 0;
    this.save = loadSave();
    this.buildIdsOrdered = this.computeBuildWheelIds();
    this.rerollsLeft = 1;
    this.unlockAllWeapons = false;
    this.dezPoolApplied = false;
    this.weaponChoices = this.rollLoadouts(3, false);
  }

  computeBuildWheelIds() {
    const u = this.save?.unlocks || {};
    const ids = ["balanced", "tryHard", "gambler", "tamer", "swift", "iron", "viper", "wizard"];
    if (u.necromancerBuild) ids.push("necromancer");
    return ids;
  }

  rollLoadouts(count = 3, cheatBrowseAll = false) {
    const cheat = cheatBrowseAll;
    const unlocked = ALL_LOADOUT_IDS.filter((id) => {
      if (cheat) return true;
      const flag = LOADOUT_UNLOCK[id];
      if (!flag) return true;
      return !!(this.save && this.save.unlocks && this.save.unlocks[flag]);
    });
    return shuffled(unlocked).slice(0, Math.min(count, unlocked.length || 3));
  }

  refreshFromGameCheats(game) {
    if (!game?.cheatSaveRefresh) return;
    this.save = loadSave();
    this.buildIdsOrdered = this.computeBuildWheelIds();
    this.buildWheelIdx = Math.min(
      this.buildWheelIdx,
      Math.max(0, this.buildIdsOrdered.length - 1),
    );
    game.cheatSaveRefresh = false;
  }

  isBuildIdUnlocked(id) {
    const flag = BUILD_UNLOCK[id];
    if (!flag) return true;
    return !!(this.save && this.save.unlocks && this.save.unlocks[flag]);
  }

  isLoadoutUnlocked(idx) {
    // After v0.16 the random roll already filters out locked loadouts, so
    // this should always return true. Kept for defensive symmetry with
    // builds (and to leave the door open for showing a locked teaser).
    const id = this.weaponChoices[idx];
    if (this.unlockAllWeapons) return true;
    const flag = LOADOUT_UNLOCK[id];
    if (!flag) return true;
    return !!(this.save && this.save.unlocks && this.save.unlocks[flag]);
  }

  update(dt, game) {
    this.t += dt;
    this.refreshFromGameCheats(game);

    if (game.pickAnyWeapon && !this.dezPoolApplied) {
      this.dezPoolApplied = true;
      this.unlockAllWeapons = true;
      this.weaponChoices = this.rollLoadouts(999, true);
      this.loadIdx = 0;
      this.rerollsLeft = 1;
    }

    if (this.step === 0) {
      const nB = this.buildIdsOrdered.length;
      if (game.input.wasPressed("ArrowRight", "d")) {
        this.buildWheelIdx = (this.buildWheelIdx + 1) % nB;
        SFX.click();
      } else if (game.input.wasPressed("ArrowLeft", "a")) {
        this.buildWheelIdx = (this.buildWheelIdx - 1 + nB) % nB;
        SFX.click();
      }
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        const bid = this.buildIdsOrdered[this.buildWheelIdx];
        if (!this.isBuildIdUnlocked(bid)) {
          SFX.deny();
        } else {
          SFX.confirm();
          this.step = 1;
        }
      }
    } else if (this.step === 1) {
      const N = this.weaponChoices.length;
      if (N === 0) return; // shouldn't happen but be safe
      if (game.input.wasPressed("ArrowLeft", "a")) {
        this.loadIdx = (this.loadIdx - 1 + N) % N;
        SFX.click();
      }
      if (game.input.wasPressed("ArrowRight", "d")) {
        this.loadIdx = (this.loadIdx + 1) % N;
        SFX.click();
      }
      // One reroll per forge session — then you're committed to what's offered.
      if (game.input.wasPressed("r", "R", "Tab")) {
        if (this.rerollsLeft <= 0) {
          if (typeof SFX.deny === "function") SFX.deny();
        } else {
          this.rerollsLeft--;
          const cheatBrowse = this.unlockAllWeapons;
          const n = cheatBrowse ? ALL_LOADOUT_IDS.length : 3;
          this.weaponChoices = this.rollLoadouts(n, cheatBrowse);
          this.loadIdx = 0;
          if (typeof SFX.click === "function") SFX.click();
        }
      }
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        if (!this.isLoadoutUnlocked(this.loadIdx)) {
          SFX.deny();
        } else {
          SFX.confirm();
          this.step = 2;
        }
      }
      if (game.input.wasPressed("Backspace", "Escape")) {
        SFX.deny();
        this.step = 0;
      }
    } else if (this.step === 2) {
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        SFX.confirm();
        const buildId = this.buildIdsOrdered[this.buildWheelIdx];
        const loadId = this.weaponChoices[this.loadIdx];
        game.pickAnyWeapon = false;
        game.player = makePlayer(buildId, loadId, game);
        game.chamberIndex = 0;
        game.scenes.replace(new ClimbScene(0), game);
      }
      if (game.input.wasPressed("Backspace", "Escape")) {
        SFX.deny();
        this.step = 1;
      }
    }
  }

  render(ctx, game) {
    drawFleshBackground(ctx, this.t, 1.0);
    drawVeins(ctx, this.t, 3);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "FORGE YOUR HERO", W / 2, 72, 44, COLORS.bile, COLORS.blood);

    if (this.step === 0) this.renderBuildSelect(ctx);
    else if (this.step === 1) this.renderLoadoutSelect(ctx, game);
    else this.renderConfirm(ctx);

    drawText(ctx, "A/D wheel   SPACE confirm   BACKSPACE back   M mute   Alt+Enter fullscreen   ZXNM cheats", W / 2, H - 26, {
      size: 13, color: COLORS.boneDim, align: "center",
    });
  }

  renderBuildSelect(ctx) {
    drawText(ctx, "STEP 1 / 2  -  PICK YOUR BUILD  (3-card wheel — center = choice)", W / 2, 130, {
      size: 15, color: COLORS.bone, align: "center", maxWidth: W - 40,
    });

    const ids = this.buildIdsOrdered;
    const N = ids.length;
    const center = this.buildWheelIdx;
    const slotIdx = [(center - 1 + N) % N, center, (center + 1) % N];

    const cardWc = 270;
    const cardWs = 214;
    const gap = 20;
    const yBase = 172;
    const totalW = cardWs + gap + cardWc + gap + cardWs;
    const originX = (W - totalW) / 2;

    const xs = [
      originX,
      originX + cardWs + gap,
      originX + cardWs + gap + cardWc + gap,
    ];
    const ws = [cardWs, cardWc, cardWs];
    const yOff = [24, 0, 24];
    const alpha = [0.78, 1, 0.78];

    for (let k = 0; k < 3; k++) {
      const id = ids[slotIdx[k]];
      const b = BUILDS[id];
      if (!b) continue;

      const x = xs[k];
      const y = yBase + yOff[k];
      const cardW = ws[k];
      const isCenter = k === 1;
      const unlocked = this.isBuildIdUnlocked(id);

      ctx.save();
      ctx.globalAlpha = alpha[k];
      this.drawCard(ctx, x, y, cardW, 480, isCenter && unlocked);

      const textMax = cardW - 14;
      drawText(ctx, b.name, x + cardW / 2, y + 26, {
        size: isCenter ? 22 : 18,
        bold: true,
        color: !unlocked ? "#555" : (isCenter ? COLORS.bile : COLORS.bone),
        align: "center",
        glow: (isCenter && unlocked) ? COLORS.blood : null,
        maxWidth: textMax,
      });
      drawText(ctx, b.blurb, x + cardW / 2, y + 52, {
        size: 11, color: COLORS.boneDim, align: "center", maxWidth: textMax,
      });

      ctx.save();
      ctx.translate(x + cardW / 2, y + 198);
      ctx.scale(isCenter ? 3.65 : 3.25, isCenter ? 3.65 : 3.25);
      drawHero(ctx, 0, 0, 1, this.t * 6, id);
      ctx.restore();

      const statsY = y + 302;
      const barMax = 150;
      this.drawStatRow(ctx, x + 12, statsY + 0, "HP", b.hp, barMax, COLORS.blood);
      this.drawStatRow(ctx, x + 12, statsY + 22, "MANA", b.mana, barMax, COLORS.mana);
      this.drawStatRow(ctx, x + 12, statsY + 44, "ARMOR", b.armor, barMax, "#c0c4cc");
      this.drawStatRow(ctx, x + 12, statsY + 66, "CLIMB", Math.round(b.climbSpeed * 100), barMax, COLORS.bile);
      this.drawStatRow(ctx, x + 12, statsY + 88, "ACID RES", Math.round((1 - b.acidResist) * 100), 100, COLORS.gold);

      drawText(ctx, "PERKS:", x + 12, statsY + 114, { size: 10, color: COLORS.bile, bold: true });
      const perks = getBuildPerkLines(id);
      perks.forEach((line, idx) => {
        drawText(ctx, line, x + 12, statsY + 128 + idx * 13, {
          size: 9, color: COLORS.bone, maxWidth: textMax,
        });
      });

      if (!unlocked) {
        this.drawLockedOverlay(ctx, x, y, cardW, 480, BUILD_UNLOCK_HINT[id] || "LOCKED");
      }
      ctx.restore();
    }

    drawText(ctx, `Class ${center + 1} / ${N}`, W / 2, H - 52, {
      size: 12, color: COLORS.boneDim, align: "center", italic: true,
    });
  }

  // Dim grayscale veil + padlock + unlock hint. Shared by build and loadout
  // cards so the UX is consistent.
  drawLockedOverlay(ctx, x, y, w, h, hint) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
    ctx.fill();
    // Padlock icon in the middle
    const cx = x + w / 2, cy = y + h / 2 - 40;
    ctx.fillStyle = "#888";
    ctx.fillRect(cx - 14, cy, 28, 22);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, Math.PI, 0);
    ctx.stroke();
    drawText(ctx, "LOCKED", cx, cy + 42, {
      size: 18, color: "#ffd966", align: "center", bold: true, glow: "#ffd966",
    });
    drawText(ctx, hint, cx, cy + 70, {
      size: 12, color: COLORS.bone, align: "center",
    });
    ctx.restore();
  }

  drawStatRow(ctx, x, y, label, value, maxBar, color) {
    drawText(ctx, label, x, y, { size: 11, color: COLORS.bone });
    const barX = x + 70;
    const barW = 130;
    const pct = Math.min(1, value / (maxBar * 1.0));
    drawBar(ctx, barX, y - 2, barW, 14, pct, { fill: color });
    drawText(ctx, String(value), barX + barW + 6, y, { size: 11, color: COLORS.bone });
  }

  renderLoadoutSelect(ctx, game) {
    const browseAll = !!(game && game.pickAnyWeapon);
    const rerollHint = this.rerollsLeft > 0 ? "press R once to reroll" : "no rerolls left — pick one";
    const head = browseAll
      ? `STEP 2 / 2  —  FULL POOL (DEZ)  (${rerollHint})`
      : `STEP 2 / 2  —  PICK A WEAPON  (3 random — ${rerollHint})`;
    drawText(ctx, head, W / 2, 130, {
      size: browseAll ? 14 : 15, color: COLORS.bone, align: "center", maxWidth: W - 80,
    });

    const N = this.weaponChoices.length;
    if (N === 0) return;

    const center = this.loadIdx;
    const idxTriple = browseAll && N > 1
      ? [(center - 1 + N) % N, center, (center + 1) % N]
      : [0, 1, 2];

    const cardWc = 268;
    const cardWs = 220;
    const gap = 18;
    const yBase = 174;
    const totalW = cardWs + gap + cardWc + gap + cardWs;
    const originX = (W - totalW) / 2;

    const xs = [originX, originX + cardWs + gap, originX + cardWs + gap + cardWc + gap];
    const ws = [cardWs, cardWc, cardWs];
    const yOff = [22, 0, 22];
    const al = [0.8, 1, 0.8];

    for (let k = 0; k < 3; k++) {
      const wi = idxTriple[k];
      const id = this.weaponChoices[wi];
      if (!id) continue;
      const l = LOADOUTS[id];
      if (!l) continue;

      const x = xs[k];
      const y = yBase + yOff[k];
      const cardW = ws[k];
      const isCenter = k === 1;
      const unlocked = this.isLoadoutUnlocked(wi);
      const selected = wi === center;

      ctx.save();
      ctx.globalAlpha = al[k];
      this.drawCard(ctx, x, y, cardW, 470, isCenter && unlocked && selected);

      const textMax = cardW - 16;
      drawText(ctx, l.name, x + cardW / 2, y + 26, {
        size: isCenter ? 19 : 17,
        bold: true,
        color: !unlocked ? "#555" : (selected && isCenter ? COLORS.bile : COLORS.bone),
        align: "center",
        glow: (selected && isCenter && unlocked) ? COLORS.blood : null,
        maxWidth: textMax,
      });

      this.drawWeaponIcon(ctx, x + cardW / 2, y + 140, l);

      drawText(ctx, l.blurb, x + cardW / 2, y + 232, {
        size: 11, color: COLORS.boneDim, align: "center", maxWidth: textMax,
      });

      const lx = x + 14;
      drawText(ctx, "ATTACK:", lx, y + 268, { size: 12, color: COLORS.bile, bold: true });
      drawText(ctx, l.attack.name, lx, y + 284, { size: 13, color: COLORS.bone, maxWidth: textMax });
      drawText(ctx, `DMG ${l.attack.dmg[0]}-${l.attack.dmg[1]}`, lx, y + 300, { size: 11, color: COLORS.boneDim });
      drawText(ctx, `CD ${l.attack.cooldown}s  MP ${l.attack.manaCost}`, lx, y + 314, { size: 11, color: COLORS.boneDim });
      let tagY = y + 328;
      if (l.attack.multiLane)    { drawText(ctx, "MULTI-LANE",   lx, tagY, { size: 10, color: "#b5f05a", bold: true }); tagY += 12; }
      if (l.attack.hexMark)      { drawText(ctx, "PLACES HEX",   lx, tagY, { size: 10, color: "#d978ff", bold: true }); tagY += 12; }
      if (l.attack.lifestealPct) { drawText(ctx, "LIFESTEAL",    lx, tagY, { size: 10, color: "#7fffa0", bold: true }); tagY += 12; }
      if (l.attack.poisonPct)    { drawText(ctx, l.attack.dotLabel || "BLEED", lx, tagY, { size: 10, color: "#ff8080", bold: true }); tagY += 12; }

      drawText(ctx, "SPECIAL:", lx, y + 352, { size: 12, color: COLORS.bile, bold: true });
      drawText(ctx, l.special.name, lx, y + 368, { size: 13, color: COLORS.bone, maxWidth: textMax });
      drawText(ctx, `DMG ${l.special.dmg[0]}-${l.special.dmg[1]}`, lx, y + 384, { size: 11, color: COLORS.boneDim });
      drawText(ctx, `CD ${l.special.cooldown}s  MP ${l.special.manaCost}`, lx, y + 398, { size: 11, color: COLORS.boneDim });
      let tagY2 = y + 412;
      if (l.special.hexDetonate)   { drawText(ctx, "DETONATES HEX", lx, tagY2, { size: 10, color: "#d978ff", bold: true }); tagY2 += 12; }
      if (l.special.misfireChance) { drawText(ctx, `1-IN-6 FIRE`,  lx, tagY2, { size: 10, color: "#ffb060", bold: true }); tagY2 += 12; }
      if (l.special.lifestealPct)  { drawText(ctx, "LIFESTEAL",    lx, tagY2, { size: 10, color: "#7fffa0", bold: true }); tagY2 += 12; }
      if (l.special.poisonPct)     { drawText(ctx, l.special.dotLabel || "BLEED", lx, tagY2, { size: 10, color: "#ff8080", bold: true }); tagY2 += 12; }

      drawText(ctx, "STRONG vs " + ART_LABEL[l.strongVs], lx, y + 444, {
        size: 11, color: "#ffd966", bold: true, maxWidth: textMax,
      });
      drawText(ctx, "WEAK vs " + ART_LABEL[l.weakVs], lx, y + 458, {
        size: 11, color: "#8a9aff", bold: true, maxWidth: textMax,
      });

      if (!unlocked) this.drawLockedOverlay(ctx, x, y, cardW, 470, LOADOUT_UNLOCK_HINT[id] || "LOCKED");
      ctx.restore();
    }

    if (browseAll) {
      drawText(ctx, `Weapon ${center + 1} / ${N}`, W / 2, H - 52, {
        size: 12, color: COLORS.boneDim, align: "center",
      });
    }
  }

  renderConfirm(ctx) {
    const buildId = this.buildIdsOrdered[this.buildWheelIdx];
    const b = BUILDS[buildId];
    const l = LOADOUTS[this.weaponChoices[this.loadIdx]];
    drawPanel(ctx, 220, 170, W - 440, 500);
    drawText(ctx, "READY TO GET DIGESTED?", W / 2, 210, {
      size: 28, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
    });

    ctx.save();
    ctx.translate(W / 2, 400);
    ctx.scale(7, 7);
    drawHero(ctx, 0, 0, 1, this.t * 6, b.id);
    ctx.restore();

    drawText(ctx, `${b.name} wielding ${l.name}`, W / 2, 530, {
      size: 22, color: COLORS.bone, align: "center", bold: true,
    });
    drawText(ctx, `"${b.blurb}"`, W / 2, 566, {
      size: 14, color: COLORS.boneDim, align: "center",
    });
    drawText(ctx, `"${l.blurb}"`, W / 2, 590, {
      size: 14, color: COLORS.boneDim, align: "center",
    });

    const blink = Math.sin(this.t * 5) > 0;
    if (blink) {
      drawText(ctx, ">> SPACE to plunge into the worm <<", W / 2, 640, {
        size: 18, color: COLORS.bile, align: "center", bold: true,
      });
    }
  }

  drawCard(ctx, x, y, w, h, selected) {
    ctx.save();
    // Backdrop with gradient
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, selected ? "rgba(40,14,50,0.95)" : "rgba(14,5,20,0.85)");
    g.addColorStop(1, "rgba(6,2,10,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Inner top highlight
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    // Border
    ctx.strokeStyle = selected ? COLORS.bile : COLORS.boneDim;
    ctx.lineWidth = selected ? 3 : 2;
    if (selected) {
      ctx.shadowColor = COLORS.bile;
      ctx.shadowBlur = 16;
    }
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  drawWeaponIcon(ctx, cx, cy, loadout) {
    ctx.save();
    ctx.translate(cx, cy);
    if (loadout.id === "sword") {
      // Blade with metallic gradient
      const g = ctx.createLinearGradient(-10, -70, 10, 30);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#e8ecf2");
      g.addColorStop(1, "#7a7f88");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -76);
      ctx.lineTo(10, 30);
      ctx.lineTo(-10, 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Fuller line
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -70); ctx.lineTo(0, 25);
      ctx.stroke();
      // Crossguard
      ctx.fillStyle = "#b38244";
      ctx.fillRect(-28, 30, 56, 10);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeRect(-28, 30, 56, 10);
      // Grip
      ctx.fillStyle = "#3a1f0f";
      ctx.fillRect(-5, 40, 10, 28);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.moveTo(-5, 42 + i * 7); ctx.lineTo(5, 42 + i * 7);
        ctx.stroke();
      }
      // Pommel
      drawSphere(ctx, 0, 72, 7, "#ffd966", { highlight: "rgba(255,255,255,1)" });
    } else if (loadout.id === "hammer") {
      // Head with gradient
      const g = ctx.createLinearGradient(-36, -60, 36, -20);
      g.addColorStop(0, "#d0d4dc");
      g.addColorStop(0.5, "#9aa0ac");
      g.addColorStop(1, "#5a5f6a");
      ctx.fillStyle = g;
      ctx.fillRect(-36, -60, 72, 42);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-36, -60, 72, 42);
      // Plate line
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.moveTo(-36, -22); ctx.lineTo(36, -22);
      ctx.stroke();
      // Shaft
      ctx.fillStyle = "#5a3418";
      ctx.fillRect(-6, -18, 12, 80);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-6, -18, 12, 80);
      // Grip wrap
      ctx.fillStyle = "#2a1508";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-7, 25 + i * 8, 14, 3);
      }
      // Studs
      drawSphere(ctx, -28, -52, 4, "#ffd966", { highlight: "rgba(255,255,255,1)" });
      drawSphere(ctx, 28, -52, 4, "#ffd966", { highlight: "rgba(255,255,255,1)" });
      drawSphere(ctx, -28, -28, 4, "#ffd966", { highlight: "rgba(255,255,255,1)" });
      drawSphere(ctx, 28, -28, 4, "#ffd966", { highlight: "rgba(255,255,255,1)" });
    } else if (loadout.id === "emberStaff") {
      // Staff
      ctx.fillStyle = "#3a1f0f";
      ctx.fillRect(-5, -40, 10, 100);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-5, -40, 10, 100);
      // Fire orb
      const g = ctx.createRadialGradient(0, -60, 2, 0, -60, 34);
      g.addColorStop(0, "#ffffee");
      g.addColorStop(0.3, "#ffeb66");
      g.addColorStop(0.6, "#ff7a2a");
      g.addColorStop(1, "rgba(200,40,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -60, 34, 0, Math.PI * 2);
      ctx.fill();
      // Core
      drawSphere(ctx, 0, -60, 10, "#ffea66", {
        highlight: "rgba(255,255,255,1)",
        rim: "rgba(255,100,20,0.9)",
        outline: null,
      });
      // Runes on staff
      ctx.fillStyle = "#ffd966";
      ctx.fillRect(-3, -10, 6, 2);
      ctx.fillRect(-3, 10, 6, 2);
      ctx.fillRect(-3, 30, 6, 2);
    } else if (loadout.id === "bileWhip") {
      // Handle
      ctx.fillStyle = "#4a2a10";
      ctx.fillRect(-4, -40, 8, 50);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-4, -40, 8, 50);
      // Grip wrap
      ctx.fillStyle = "#2a1508";
      for (let i = 0; i < 4; i++) ctx.fillRect(-5, -36 + i * 10, 10, 3);
      // Pommel knob
      drawSphere(ctx, 0, -44, 6, "#ffd966", { highlight: "rgba(255,255,255,1)" });
      // Whip lash in three curls
      ctx.strokeStyle = "#b5f05a";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.quadraticCurveTo(-24 + k * 14, 28 + k * 10, -34 + k * 22, 60);
        ctx.stroke();
      }
      // Wet droplets along lash
      ctx.fillStyle = "#7fe3ff";
      ctx.beginPath(); ctx.arc(-18, 34, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0,    46, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14,   38, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (loadout.id === "hexStaff") {
      // Dark shaft
      ctx.fillStyle = "#2a1535";
      ctx.fillRect(-5, -30, 10, 100);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-5, -30, 10, 100);
      // Purple hex runes glow
      ctx.fillStyle = "#d978ff";
      ctx.fillRect(-3, 0, 6, 2);
      ctx.fillRect(-3, 22, 6, 2);
      ctx.fillRect(-3, 44, 6, 2);
      // Hex crystal with purple aura
      ctx.save();
      ctx.shadowColor = "#d978ff";
      ctx.shadowBlur = 20;
      const g = ctx.createRadialGradient(0, -50, 2, 0, -50, 30);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#e9a8ff");
      g.addColorStop(1, "rgba(120, 20, 200, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -50, 30, 0, Math.PI * 2); ctx.fill();
      // Hexagon crystal
      ctx.fillStyle = "#a048c8";
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * 14, py = -50 + Math.sin(a) * 14;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Eye in the middle
      ctx.fillStyle = "#ffe5ff";
      ctx.beginPath(); ctx.arc(0, -50, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1a0520";
      ctx.beginPath(); ctx.arc(0, -50, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (loadout.id === "fryingPan") {
      // Pan handle
      ctx.fillStyle = "#3a1f0f";
      ctx.fillRect(-3, 0, 6, 60);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-3, 0, 6, 60);
      // Handle wrap
      ctx.fillStyle = "#1a0e08";
      ctx.fillRect(-4, 28, 8, 26);
      // Pan body (ellipse-ish disc)
      const g = ctx.createRadialGradient(-8, -22, 4, 0, -10, 40);
      g.addColorStop(0, "#cdd2da");
      g.addColorStop(0.7, "#7a808c");
      g.addColorStop(1, "#3a3f48");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -16, 38, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Inner ring
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -16, 30, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Stink lines (it bonks)
      ctx.strokeStyle = "rgba(255,217,102,0.7)";
      ctx.lineWidth = 1.5;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 16, -52);
        ctx.lineTo(k * 16, -42);
        ctx.stroke();
      }
    } else if (loadout.id === "saber") {
      // Curved blade (slim, glints)
      ctx.fillStyle = "#e0e4ec";
      ctx.beginPath();
      ctx.moveTo(0, -76);
      ctx.quadraticCurveTo(14, -32, 6, 30);
      ctx.lineTo(-2, 30);
      ctx.quadraticCurveTo(0, -32, -4, -74);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Highlight glint along blade
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-1, -70);
      ctx.quadraticCurveTo(2, -30, 4, 20);
      ctx.stroke();
      // Hilt guard (D-shaped)
      ctx.strokeStyle = "#b38244";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 38, 12, Math.PI * 0.1, Math.PI * 1.5, true);
      ctx.stroke();
      // Grip + pommel
      ctx.fillStyle = "#3a1f0f";
      ctx.fillRect(-3, 38, 6, 22);
      drawSphere(ctx, 0, 64, 5, "#ffd966", { highlight: "rgba(255,255,255,1)" });
    } else if (loadout.id === "fists") {
      // Two clenched fists
      drawSphere(ctx, -16, -10, 14, "#d4a07a", { highlight: "rgba(255,230,200,1)" });
      drawSphere(ctx,  16,  10, 14, "#d4a07a", { highlight: "rgba(255,230,200,1)" });
      // Knuckle creases
      ctx.strokeStyle = "rgba(80,40,20,0.7)";
      ctx.lineWidth = 1.4;
      for (const cx of [-16, 16]) {
        const cy = cx === -16 ? -10 : 10;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 2); ctx.lineTo(cx + 8, cy - 2);
        ctx.moveTo(cx - 8, cy + 2); ctx.lineTo(cx + 8, cy + 2);
        ctx.stroke();
      }
      // Hand-wraps
      ctx.fillStyle = "#f0e8d0";
      ctx.fillRect(-30, -4, 28, 4);
      ctx.fillRect(2, 16, 28, 4);
      // Speed lines
      ctx.strokeStyle = "rgba(255,217,102,0.65)";
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-38 - k * 6, -20 + k * 4);
        ctx.lineTo(-22 - k * 6, -20 + k * 4);
        ctx.stroke();
      }
    } else if (loadout.id === "club") {
      // Tapered wood club, wider at top
      const g = ctx.createLinearGradient(-24, -60, 24, 30);
      g.addColorStop(0, "#a6743a");
      g.addColorStop(0.5, "#7a4f24");
      g.addColorStop(1, "#3a2410");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-22, -60);
      ctx.quadraticCurveTo(-6, -10, -6, 30);
      ctx.lineTo(6, 30);
      ctx.quadraticCurveTo(6, -10, 22, -60);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Wood grain striations
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 4, -54); ctx.lineTo(k * 1.5, 28);
        ctx.stroke();
      }
      // Iron-stud caps
      drawSphere(ctx, -14, -52, 4, "#5a5f6a", { highlight: "rgba(255,255,255,0.7)" });
      drawSphere(ctx,  14, -52, 4, "#5a5f6a", { highlight: "rgba(255,255,255,0.7)" });
      drawSphere(ctx,   0, -36, 4, "#5a5f6a", { highlight: "rgba(255,255,255,0.7)" });
    } else if (loadout.id === "megaphone") {
      // Cone (megaphone bell)
      const g = ctx.createLinearGradient(-30, -40, 30, 30);
      g.addColorStop(0, "#fff2b5");
      g.addColorStop(0.5, "#ffd966");
      g.addColorStop(1, "#a06a18");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-32, -50);
      ctx.lineTo(32, -50);
      ctx.lineTo(10, 30);
      ctx.lineTo(-10, 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Inner disc
      ctx.fillStyle = "#3a2410";
      ctx.beginPath();
      ctx.ellipse(0, -50, 32, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Grip
      ctx.fillStyle = "#3a1f0f";
      ctx.fillRect(-4, 30, 8, 30);
      // SOUND WAVES
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(0, -50, 36 + k * 8, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (loadout.id === "boneSpear") {
      // Shaft (creamy bone)
      const g = ctx.createLinearGradient(-4, -70, 4, 30);
      g.addColorStop(0, "#fff5d8");
      g.addColorStop(1, "#a89878");
      ctx.fillStyle = g;
      ctx.fillRect(-3, -50, 6, 110);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-3, -50, 6, 110);
      // Jagged bone tip
      ctx.fillStyle = "#fff5d8";
      ctx.beginPath();
      ctx.moveTo(-8, -50);
      ctx.lineTo(-3, -60);
      ctx.lineTo(-2, -54);
      ctx.lineTo(0, -76);
      ctx.lineTo(2, -54);
      ctx.lineTo(3, -60);
      ctx.lineTo(8, -50);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Sinew wrap
      ctx.fillStyle = "#a02020";
      ctx.fillRect(-5, -22, 10, 3);
      ctx.fillRect(-5, -10, 10, 3);
      // Drip blood
      ctx.fillStyle = "#a02020";
      ctx.beginPath();
      ctx.arc(0, -42, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (loadout.id === "blunderbuss") {
      // Stock (wood)
      ctx.fillStyle = "#5a3418";
      ctx.beginPath();
      ctx.moveTo(-6, 60);
      ctx.lineTo(-6, 0);
      ctx.lineTo(6, -10);
      ctx.lineTo(6, 50);
      ctx.lineTo(-2, 60);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Barrel - flared end
      const g = ctx.createLinearGradient(-12, -70, 12, -10);
      g.addColorStop(0, "#c89e54");
      g.addColorStop(1, "#5a4018");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(-18, -70);
      ctx.lineTo(18, -70);
      ctx.lineTo(6, -10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.stroke();
      // Trigger
      ctx.fillStyle = "#3a3f48";
      ctx.fillRect(-1, 8, 2, 8);
      // Smoke puff at muzzle
      ctx.fillStyle = "rgba(220,220,220,0.5)";
      ctx.beginPath();
      ctx.arc(-6, -76, 6, 0, Math.PI * 2);
      ctx.arc(4, -78, 5, 0, Math.PI * 2);
      ctx.arc(-2, -84, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (loadout.id === "cursedScythe") {
      // Long curved blade
      ctx.fillStyle = "#a048c8";
      ctx.shadowColor = "#a048c8";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.quadraticCurveTo(-40, -40, -36, -8);
      ctx.quadraticCurveTo(-30, -22, -10, -30);
      ctx.quadraticCurveTo(-4, -42, 0, -50);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Blade highlight
      ctx.strokeStyle = "rgba(255,200,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -46);
      ctx.quadraticCurveTo(-20, -36, -28, -14);
      ctx.stroke();
      // Staff
      ctx.fillStyle = "#1a0e22";
      ctx.fillRect(-3, -50, 6, 110);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeRect(-3, -50, 6, 110);
      // Skull pommel
      drawSphere(ctx, 0, 64, 8, "#e6d0a0", { highlight: "rgba(255,255,255,0.9)" });
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(-3, 62, 2, 2);
      ctx.fillRect(1, 62, 2, 2);
      ctx.beginPath();
      ctx.moveTo(-2, 68); ctx.lineTo(2, 68);
      ctx.stroke();
    } else if (loadout.id === "rustyChainsaw") {
      // Engine housing (rear) — overlaps the bar so blade meets body cleanly.
      ctx.fillStyle = "#c25a2a";
      roundRect(ctx, -26, -4, 52, 40, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const barBottomY = 2;
      const barLen = 74;
      // Guide bar merges into housing (metal strip from engine into cutting edge).
      ctx.fillStyle = "#9a9aa6";
      roundRect(ctx, -4, -barLen + barBottomY - 10, 50, barLen + 10, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeRect(-4, -barLen + barBottomY - 10, 50, barLen + 10);

      // Chain teeth — along the top arc of bar
      ctx.fillStyle = "#3a3f48";
      for (let k = 0; k < 8; k++) {
        const ty = -barLen + barBottomY - 14 + Math.floor(k * 8.5);
        const tx = -1 + (k % 3) * 3;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + 5, ty - 5);
        ctx.lineTo(tx + 10, ty + 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = "#1a0a1a";
      roundRect(ctx, -14, -4, 28, 20, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.stroke();

      ctx.strokeStyle = "#e8c870";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.lineTo(-20, 24);
      ctx.stroke();

      ctx.fillStyle = "rgba(60,30,10,0.6)";
      for (const sp of [[-14, 6], [8, 10], [16, -2]]) {
        ctx.beginPath();
        ctx.arc(sp[0], sp[1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (loadout.id === "cat") {
      // Body (orange tabby blob)
      ctx.fillStyle = "#ff9a3c";
      ctx.beginPath();
      ctx.ellipse(0, 8, 26, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Stripes
      ctx.strokeStyle = "rgba(120,50,10,0.7)";
      ctx.lineWidth = 1.4;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 6, -10);
        ctx.lineTo(k * 6, 22);
        ctx.stroke();
      }
      // Head
      ctx.fillStyle = "#ff9a3c";
      ctx.beginPath();
      ctx.arc(0, -22, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.stroke();
      // Ears
      ctx.fillStyle = "#ff9a3c";
      ctx.beginPath();
      ctx.moveTo(-14, -32); ctx.lineTo(-10, -42); ctx.lineTo(-6, -30); ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, -32); ctx.lineTo(10, -42); ctx.lineTo(6, -30); ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Eyes (angry slits!)
      ctx.fillStyle = "#1a0a0a";
      ctx.beginPath(); ctx.ellipse(-5, -22, 1.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( 5, -22, 1.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      // Pupil glow
      ctx.fillStyle = "#ffe5a0";
      ctx.beginPath(); ctx.ellipse(-5, -23, 0.7, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( 5, -23, 0.7, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      // Nose
      ctx.fillStyle = "#a02020";
      ctx.beginPath();
      ctx.moveTo(0, -16); ctx.lineTo(-2, -14); ctx.lineTo(2, -14); ctx.closePath();
      ctx.fill();
      // HISS lines
      ctx.strokeStyle = "rgba(255,200,200,0.8)";
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-30 - k * 3, 0 + k * 6);
        ctx.lineTo(-22 - k * 3, 0 + k * 6);
        ctx.stroke();
      }
    } else if (loadout.id === "frostWand") {
      // Wand shaft
      ctx.fillStyle = "#2a2f38";
      ctx.fillRect(-4, -30, 8, 90);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeRect(-4, -30, 8, 90);
      // Runes
      ctx.fillStyle = "#7fe3ff";
      ctx.fillRect(-3, 0, 6, 2);
      ctx.fillRect(-3, 20, 6, 2);
      // Ice crystal with glow
      ctx.save();
      ctx.shadowColor = "#7fe3ff";
      ctx.shadowBlur = 16;
      const g = ctx.createLinearGradient(-18, -66, 18, -20);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, "#bff0ff");
      g.addColorStop(1, "#3b90a8");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -74);
      ctx.lineTo(16, -46);
      ctx.lineTo(0, -20);
      ctx.lineTo(-16, -46);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Inner glint
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(-3, -60);
      ctx.lineTo(3, -52);
      ctx.lineTo(0, -40);
      ctx.lineTo(-6, -50);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
