import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, drawHero, ParticleSystem,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { IntroScene } from "./intro.js";

export class VictoryScene {
  constructor() {
    this.t = 0;
    this.particles = new ParticleSystem();
    this.nextEmit = 0;
  }
  update(dt, game) {
    this.t += dt;
    this.nextEmit -= dt;
    if (this.nextEmit <= 0) {
      this.nextEmit = 0.07;
      const cx = W / 2 + (Math.random() - 0.5) * 260;
      const cy = H * 0.42 + (Math.random() - 0.5) * 80;
      const color = [COLORS.gold, COLORS.bile, COLORS.bone][Math.floor(Math.random() * 3)];
      this.particles.burst(cx, cy, color, 10, 160, 1.0);
    }
    this.particles.update(dt);

    if (this.t > 1.2 && game.input.wasPressed(" ", "Space", "Enter", "Escape", "r")) {
      SFX.confirm();
      game.scenes.replace(new IntroScene(), game);
    }
  }
  render(ctx, game) {
    const p = game.player;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#ffd88c");
    g.addColorStop(0.6, "#e07a4c");
    g.addColorStop(1, "#2a0b33");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sunG = ctx.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H * 0.4, 400);
    sunG.addColorStop(0, "rgba(255, 255, 180, 0.95)");
    sunG.addColorStop(1, "rgba(255, 255, 180, 0)");
    ctx.fillStyle = sunG;
    ctx.fillRect(0, 0, W, H);

    // Worm maw silhouette at bottom
    ctx.fillStyle = "rgba(30, 10, 40, 0.95)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.72);
    for (let x = 0; x <= W; x += 24) {
      const y = H * 0.72 + Math.sin(x * 0.015 + this.t) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // Teeth on rim
    ctx.fillStyle = "#f6ecd0";
    for (let x = 30; x < W; x += 48) {
      const y = H * 0.72 + Math.sin(x * 0.015 + this.t) * 14;
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x, y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Hero soaring out
    const heroY = H * 0.45 + Math.sin(this.t * 3) * 14;
    ctx.save();
    ctx.translate(W / 2, heroY);
    ctx.scale(5, 5);
    ctx.rotate(Math.sin(this.t * 4) * 0.12);
    drawHero(ctx, 0, 0, 1, this.t * 10, p ? p.buildId : "swift");
    ctx.restore();

    this.particles.render(ctx);

    drawBanner(ctx, "YOU BURST FREE!", W / 2, 110, 68, COLORS.bile, COLORS.blood);
    drawBanner(ctx, "from the jaws of the purple worm", W / 2, 170, 24, COLORS.bone, COLORS.worm);

    drawPanel(ctx, 140, H - 220, W - 280, 180);
    drawText(ctx, "The worm gags. It hiccups. It HURLS -", W / 2, H - 184, {
      size: 20, color: COLORS.bone, align: "center",
    });
    drawText(ctx, "and you sail out of its maw like a champagne cork,", W / 2, H - 154, {
      size: 20, color: COLORS.bone, align: "center",
    });
    drawText(ctx, "sword raised, shouting something very cool.", W / 2, H - 124, {
      size: 20, color: COLORS.bone, align: "center",
    });
    drawText(ctx, "GUTS & GLORY - You win!", W / 2, H - 80, {
      size: 24, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
    });

    if (this.t > 1.2) {
      const blink = Math.sin(this.t * 5) > 0;
      if (blink) {
        drawText(ctx, ">> SPACE or R to start a new tale <<", W / 2, H - 40, {
          size: 16, color: COLORS.bone, align: "center", bold: true,
        });
      }
    }
  }
}
