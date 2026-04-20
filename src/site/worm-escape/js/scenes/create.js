import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel,
  drawHero, drawBar, drawSphere, drawPlate, drawDropShadow, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { BUILDS, LOADOUTS, makePlayer } from "../content/player.js";
import { ClimbScene } from "./climb.js";

const BUILD_IDS = ["swift", "iron"];
const LOADOUT_IDS = ["sword", "hammer", "emberStaff", "frostWand"];

// Friendly labels for enemy "art" types used in weapon matchups.
const ART_LABEL = {
  tentacle: "TENTACLES",
  teeth:    "TOOTHED BEASTS",
  zombie:   "ROTTED HUSKS",
  flesh:    "FLESH HORRORS",
  bile:     "BILE OOZES",
};

export class CreateScene {
  constructor() {
    this.t = 0;
    this.step = 0;
    this.buildIdx = 0;
    this.loadIdx = 0;
  }

  update(dt, game) {
    this.t += dt;

    if (this.step === 0) {
      if (game.input.wasPressed("ArrowLeft", "a", "ArrowRight", "d")) {
        this.buildIdx = (this.buildIdx + 1) % BUILD_IDS.length;
        SFX.click();
      }
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        SFX.confirm();
        this.step = 1;
      }
    } else if (this.step === 1) {
      if (game.input.wasPressed("ArrowLeft", "a")) {
        this.loadIdx = (this.loadIdx - 1 + LOADOUT_IDS.length) % LOADOUT_IDS.length;
        SFX.click();
      }
      if (game.input.wasPressed("ArrowRight", "d")) {
        this.loadIdx = (this.loadIdx + 1) % LOADOUT_IDS.length;
        SFX.click();
      }
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        SFX.confirm();
        this.step = 2;
      }
      if (game.input.wasPressed("Backspace", "Escape")) {
        SFX.deny();
        this.step = 0;
      }
    } else if (this.step === 2) {
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        SFX.confirm();
        const buildId = BUILD_IDS[this.buildIdx];
        const loadId = LOADOUT_IDS[this.loadIdx];
        game.player = makePlayer(buildId, loadId);
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
    else if (this.step === 1) this.renderLoadoutSelect(ctx);
    else this.renderConfirm(ctx);

    drawText(ctx, "LEFT/RIGHT to choose   SPACE to confirm   BACKSPACE back   M mute", W / 2, H - 26, {
      size: 13, color: COLORS.boneDim, align: "center",
    });
  }

  renderBuildSelect(ctx) {
    drawText(ctx, "STEP 1 / 2  -  PICK YOUR BUILD  (you get ONE virtue)", W / 2, 130, {
      size: 16, color: COLORS.bone, align: "center",
    });

    const cardW = 480, cardH = 480;
    const gap = 60;
    const totalW = cardW * 2 + gap;
    const startX = (W - totalW) / 2;

    BUILD_IDS.forEach((id, i) => {
      const b = BUILDS[id];
      const x = startX + i * (cardW + gap);
      const y = 170;
      const selected = i === this.buildIdx;
      this.drawCard(ctx, x, y, cardW, cardH, selected);

      drawText(ctx, b.name, x + cardW / 2, y + 30, {
        size: 30, bold: true, color: selected ? COLORS.bile : COLORS.bone, align: "center",
        glow: selected ? COLORS.blood : null,
      });
      drawText(ctx, b.blurb, x + cardW / 2, y + 68, {
        size: 14, color: COLORS.boneDim, align: "center",
      });

      // Hero portrait (big)
      ctx.save();
      ctx.translate(x + cardW / 2, y + 200);
      ctx.scale(5, 5);
      drawHero(ctx, 0, 0, 1, this.t * 6, id);
      ctx.restore();

      // Stat rows
      const statsY = y + 310;
      const barMax = 150;
      this.drawStatRow(ctx, x + 40, statsY +  0,  "HP",       b.hp,      barMax, COLORS.blood);
      this.drawStatRow(ctx, x + 40, statsY + 26,  "MANA",     b.mana,    barMax, COLORS.mana);
      this.drawStatRow(ctx, x + 40, statsY + 52,  "ARMOR",    b.armor,   barMax, "#c0c4cc");
      this.drawStatRow(ctx, x + 40, statsY + 78,  "CLIMB",    Math.round(b.climbSpeed * 100), barMax, COLORS.bile);
      this.drawStatRow(ctx, x + 40, statsY + 104, "ACID RES", Math.round((1 - b.acidResist) * 100), 100, COLORS.gold);

      // Perk list
      drawText(ctx, "PERKS:", x + 40, statsY + 136, { size: 12, color: COLORS.bile, bold: true });
      const perks = id === "swift"
        ? ["- Lightning hops between columns", "- Longest acid-gout warning window", "- Highest mana pool"]
        : ["- Armor absorbs 75% of damage", "- 2 free debris tanks per chamber", "- Acid-timer ticks 65% slower"];
      perks.forEach((line, k) => {
        drawText(ctx, line, x + 40, statsY + 154 + k * 18, {
          size: 12, color: COLORS.bone,
        });
      });
    });
  }

  drawStatRow(ctx, x, y, label, value, maxBar, color) {
    drawText(ctx, label, x, y, { size: 13, color: COLORS.bone });
    const barX = x + 110;
    const barW = 230;
    const pct = Math.min(1, value / (maxBar * 1.0));
    drawBar(ctx, barX, y - 2, barW, 16, pct, { fill: color });
    drawText(ctx, String(value), barX + barW + 12, y, { size: 13, color: COLORS.bone });
  }

  renderLoadoutSelect(ctx) {
    drawText(ctx, "STEP 2 / 2  -  PICK YOUR LOADOUT", W / 2, 130, {
      size: 16, color: COLORS.bone, align: "center",
    });

    const cardW = 250, cardH = 470;
    const gap = 30;
    const totalW = cardW * 4 + gap * 3;
    const startX = (W - totalW) / 2;

    LOADOUT_IDS.forEach((id, i) => {
      const l = LOADOUTS[id];
      const x = startX + i * (cardW + gap);
      const y = 170;
      const selected = i === this.loadIdx;
      this.drawCard(ctx, x, y, cardW, cardH, selected);

      drawText(ctx, l.name, x + cardW / 2, y + 24, {
        size: 16, bold: true, color: selected ? COLORS.bile : COLORS.bone, align: "center",
        glow: selected ? COLORS.blood : null,
      });

      this.drawWeaponIcon(ctx, x + cardW / 2, y + 150, l);

      drawText(ctx, l.blurb, x + cardW / 2, y + 250, {
        size: 12, color: COLORS.boneDim, align: "center",
      });

      const lx = x + 18;
      drawText(ctx, "ATTACK:", lx, y + 284, { size: 12, color: COLORS.bile });
      drawText(ctx, l.attack.name, lx, y + 302, { size: 13, color: COLORS.bone });
      drawText(ctx, `DMG ${l.attack.dmg[0]}-${l.attack.dmg[1]}`, lx, y + 320, { size: 11, color: COLORS.boneDim });
      drawText(ctx, `CD ${l.attack.cooldown}s   MP ${l.attack.manaCost}`, lx, y + 334, { size: 11, color: COLORS.boneDim });

      drawText(ctx, "SPECIAL:", lx, y + 350, { size: 12, color: COLORS.bile });
      drawText(ctx, l.special.name, lx, y + 368, { size: 13, color: COLORS.bone });
      drawText(ctx, `DMG ${l.special.dmg[0]}-${l.special.dmg[1]}`, lx, y + 386, { size: 11, color: COLORS.boneDim });
      drawText(ctx, `CD ${l.special.cooldown}s   MP ${l.special.manaCost}`, lx, y + 400, { size: 11, color: COLORS.boneDim });

      // Matchup hints - which guardian art type this weapon excels/fails vs
      drawText(ctx, "STRONG vs " + ART_LABEL[l.strongVs], lx, y + 420, {
        size: 11, color: "#ffd966", bold: true,
      });
      drawText(ctx, "WEAK   vs " + ART_LABEL[l.weakVs], lx, y + 434, {
        size: 11, color: "#8a9aff", bold: true,
      });
    });
  }

  renderConfirm(ctx) {
    const b = BUILDS[BUILD_IDS[this.buildIdx]];
    const l = LOADOUTS[LOADOUT_IDS[this.loadIdx]];
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
