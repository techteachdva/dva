import {
  W, H, COLORS,
  drawText, drawBanner,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { VictoryScene } from "./victory.js";
import { ENDLESS_RECURSION_SENTENCE } from "../content/endlessStyle.js";

/**
 * Finale for clearing all six nested worms — fake crash, recursion spam, abrupt score.
 */
export class EndlessCrashScene {
  constructor() {
    this.t = 0;
    this.phase = "glitch"; // glitch | recurse
    this.lines = [];
    this.nextLineAt = 0;
  }

  enter(game) {
    this.t = 0;
    this.phase = "glitch";
    this.lines = [];
    this.nextLineAt = 0;
    game.victoryAbruptReveal = true;
    SFX.deny?.();
  }

  update(dt, game) {
    this.t += dt;

    if (this.phase === "glitch") {
      if (this.t >= 3.4) {
        this.phase = "recurse";
        this.nextLineAt = 0;
        this.lines = [];
      }
      return;
    }

    if (this.phase === "recurse") {
      this.nextLineAt -= dt;
      if (this.nextLineAt <= 0 && this.lines.length < 220) {
        this.lines.push(ENDLESS_RECURSION_SENTENCE);
        this.nextLineAt = 0.065;
      }
      const maxLines = Math.floor((H - 120) / 18);
      if (this.lines.length >= maxLines + 48 || this.t > 14) {
        game.endlessMode = false;
        game.wormTier = 1;
        game.scenes.replace(new VictoryScene(), game);
      }
      return;
    }
  }

  render(ctx, _game) {
    if (this.phase === "glitch") {
      const noise = Math.random();
      ctx.save();
      if (noise > 0.55) {
        ctx.translate((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 14);
      }
      const sliceH = 18 + Math.floor(Math.random() * 40);
      for (let y = 0; y < H; y += sliceH) {
        const skew = Math.sin(this.t * 40 + y * 0.02) * (8 + noise * 20);
        const phase = ((y + this.t * 180) ^ (this.t * 77 | 0)) % 3;
        const bg =
          phase === 0 ? "#f0ffd0"
          : phase === 1 ? "#ff50c8"
          : "#001018";
        ctx.fillStyle = bg;
        ctx.fillRect(skew + (Math.random() - 0.5) * 30, y, W + 40, sliceH + 2);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * W, Math.random() * H);
        ctx.lineTo(Math.random() * W, Math.random() * H);
        ctx.stroke();
      }
      ctx.restore();
      drawBanner(ctx, "⚠ DRIVER STOPPED ⚠", W / 2, 140, 28, COLORS.blood, "#000");
      drawText(ctx, "MEMORY AT 0x" + (((this.t * 1e8) | 0) % (256 * 65536)).toString(16).toUpperCase(), W / 2, 200, {
        size: 16,
        color: "#bfffb0",
        align: "center",
        glow: COLORS.bile,
      });
      return;
    }

    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, W, H);
    const lh = 18;
    let y = 38;
    for (const ln of this.lines) {
      const jitter = Math.sin(y * 0.07 + this.t * 22) * 2;
      drawText(ctx, ln, jitter + W * 0.04, y, {
        size: 15,
        color: "#cfe8dd",
        align: "left",
        maxWidth: W * 0.92,
      });
      y += lh;
      if (y > H - 36) break;
    }
    drawBanner(ctx, "STACK OVERFLOW?", W / 2, H - 64, 18, COLORS.blood, "#000");
  }
}
