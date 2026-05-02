import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import {
  healPlayerBetweenEndlessLoops,
  resolveEndlessPalette,
  ENDLESS_LOOP_MESSAGE,
} from "../content/endlessStyle.js";
import { CHAMBERS } from "../content/chambers.js";
import { ClimbScene } from "./climb.js";

/** Interstitial after beating the Maw mid–endless run (worm tier just incremented). */
export class NestWormScene {
  constructor() {
    this.t = 0;
  }

  enter(game) {
    this.t = 0;
    const p = game.player;
    healPlayerBetweenEndlessLoops(p);
    SFX.confirm();
  }

  update(dt, game) {
    this.t += dt;
    if (this.t > 0.4 && game.input.wasPressed(" ", "Space", "Enter", "Mouse0")) {
      SFX.confirm();
      game.chamberIndex = 0;
      game.scenes.replace(new ClimbScene(0), game);
    }
  }

  render(ctx, game) {
    const ch0 = CHAMBERS[0];
    const { palette, wormTint } = resolveEndlessPalette(game, ch0.palette, ch0.wormTint);
    drawFleshBackground(ctx, this.t, wormTint * 1.05, palette);
    drawVeins(ctx, this.t, 2);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "NESTING DEEPER", W / 2, 76, 40, COLORS.bile, COLORS.blood);
    drawPanel(ctx, 140, 130, W - 280, 420);
    drawText(ctx, ENDLESS_LOOP_MESSAGE, W / 2, 200, {
      size: 22,
      color: COLORS.bone,
      align: "center",
      maxWidth: W - 220,
    });
    drawText(ctx, `(WORM LAYER ${game.wormTier} / 6 — things just got uglier)`, W / 2, 420, {
      size: 14,
      color: COLORS.boneDim,
      align: "center",
      bold: true,
    });

    const blink = Math.sin(this.t * 5) > 0;
    if (blink && this.t > 0.35) {
      drawText(ctx, ">> SPACE to climb again <<", W / 2, H - 48, {
        size: 20,
        color: COLORS.bile,
        align: "center",
        bold: true,
      });
    }
  }
}
