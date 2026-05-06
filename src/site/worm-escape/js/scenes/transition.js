import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawBanner, drawPanel, drawBar, drawHero,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { resetChamber } from "../content/player.js";
import { ClimbScene } from "./climb.js";
import { VictoryScene } from "./victory.js";

const QUIPS = [
  "You kick open the sphincter. It squelches closed behind you. Rude!",
  "You squeeze through, covered in bile. Mom would be so proud.",
  "CLANG! The sphincter slams shut on a tentacle. +1 for style.",
  "Onward. Upward. Outward. That's the order today.",
  "You taste freedom. And also worm-snot. Mostly worm-snot.",
];

export class TransitionScene {
  constructor(completedChamberIdx) {
    this.completed = completedChamberIdx;
    this.nextIdx = completedChamberIdx + 1;
    this.t = 0;
    this.quip = QUIPS[completedChamberIdx % QUIPS.length];
  }

  enter(game) {
    if (this.nextIdx >= CHAMBERS.length) {
      // Ultra (Ancient Worm): classic run plays all chambers twice before victory.
      if (game.ultraHardMode && !game.endlessMode && (game.ultraClassicLap || 0) === 0) {
        game.ultraClassicLap = 1;
        resetChamber(game.player);
        game.chamberIndex = 0;
        game.scenes.replace(new ClimbScene(0), game);
        return;
      }
      SFX.victory();
      game.scenes.replace(new VictoryScene(), game);
      return;
    }
    resetChamber(game.player);
  }

  update(dt, game) {
    this.t += dt;
    if (this.nextIdx >= CHAMBERS.length) return;
    if (this.t > 0.5 && game.input.wasPressed(" ", "Space", "Enter", "Mouse0")) {
      SFX.confirm();
      game.chamberIndex = this.nextIdx;
      game.scenes.replace(new ClimbScene(this.nextIdx), game);
    }
  }

  render(ctx, game) {
    const p = game.player;
    drawBackdropCached(ctx, this.t, this.t, 1.0, null, this.nextIdx);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "CHAMBER CLEARED!", W / 2, 110, 48, COLORS.bile, COLORS.blood);

    drawPanel(ctx, 140, 180, W - 280, 480);

    const doneCh = CHAMBERS[this.completed];
    const next = CHAMBERS[this.nextIdx] || null;

    const tPanelMax = W - 280 - 40;
    drawText(ctx, `You survived: ${doneCh.name}`, W / 2, 220, {
      size: 26, color: COLORS.bone, align: "center", bold: true,
      maxWidth: tPanelMax,
    });
    drawText(ctx, `"${this.quip}"`, W / 2, 256, {
      size: 16, color: COLORS.bile, align: "center",
      maxWidth: tPanelMax,
    });

    // Hero portrait
    ctx.save();
    ctx.translate(W / 2, 360);
    ctx.scale(4, 4);
    drawHero(ctx, 0, 0, 1, this.t * 6, p.buildId, p.synergyId, p.loadoutId);
    ctx.restore();

    // Stats
    drawText(ctx, "HERO STATUS", W / 2, 450, {
      size: 15, color: COLORS.boneDim, align: "center",
    });
    const barX = 340, barW = W - 2 * barX;
    drawBar(ctx, barX, 470, barW, 18, p.hp / p.hpMax, {
      fill: COLORS.blood, label: `HP  ${Math.ceil(p.hp)}/${p.hpMax}`,
    });
    drawBar(ctx, barX, 494, barW, 18, p.mana / p.manaMax, {
      fill: COLORS.mana, label: `MP  ${Math.ceil(p.mana)}/${p.manaMax}`,
    });
    if (p.armorMax > 0) {
      drawBar(ctx, barX, 518, barW, 18, p.armor / p.armorMax, {
        fill: "#c0c4cc", label: `ARM ${Math.ceil(p.armor)}/${p.armorMax}`, labelColor: "#111",
      });
    }

    if (next) {
      drawText(ctx, "NEXT:", W / 2, 560, {
        size: 15, color: COLORS.boneDim, align: "center",
      });
      drawText(ctx, next.name, W / 2, 588, {
        size: 28, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
        maxWidth: tPanelMax,
      });
      drawText(ctx, next.tagline, W / 2, 618, {
        size: 15, color: COLORS.bone, align: "center",
        maxWidth: tPanelMax,
      });
    }

    const blink = Math.sin(this.t * 5) > 0;
    if (blink) {
      drawText(ctx, ">> SPACE to press onward <<", W / 2, H - 30, {
        size: 18, color: COLORS.bile, align: "center", bold: true,
      });
    }
  }
}
