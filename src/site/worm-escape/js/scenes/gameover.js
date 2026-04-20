import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { IntroScene } from "./intro.js";

export class GameOverScene {
  constructor(reason) {
    this.reason = reason || "You got digested.";
    this.t = 0;
  }
  update(dt, game) {
    this.t += dt;
    if (this.t > 0.5 && game.input.wasPressed(" ", "Space", "Enter", "Escape", "r")) {
      SFX.confirm();
      game.scenes.replace(new IntroScene(), game);
    }
  }
  render(ctx, game) {
    drawFleshBackground(ctx, this.t, 0.7);
    drawVeins(ctx, this.t, 7);
    ctx.fillStyle = "rgba(80, 0, 0, 0.55)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "YOU GOT DIGESTED", W / 2, 200, 72, COLORS.blood, COLORS.ink);
    drawBanner(ctx, "adventurer soup for supper", W / 2, 260, 24, COLORS.bone, COLORS.blood);

    drawPanel(ctx, 200, 340, W - 400, 260, { border: COLORS.blood, borderGlow: COLORS.blood });
    drawText(ctx, this.reason, W / 2, 390, {
      size: 22, color: COLORS.bone, align: "center",
    });
    drawText(ctx, "The worm lets out a long, satisfied burp.", W / 2, 440, {
      size: 16, color: COLORS.bile, align: "center",
    });
    drawText(ctx, "Somewhere, a bard starts writing your obituary.", W / 2, 470, {
      size: 16, color: COLORS.boneDim, align: "center",
    });

    const blink = Math.sin(this.t * 5) > 0;
    if (blink) {
      drawText(ctx, ">> SPACE or R to try again <<", W / 2, 540, {
        size: 22, color: COLORS.bile, align: "center", bold: true,
      });
    }
  }
}
