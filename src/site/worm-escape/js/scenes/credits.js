import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawPanel, drawBanner, roundRect, wrapText,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";

const LINES = [
  "Credits:",
  "",
  "Game Design: DMZemo",
  "Programming: DMZemo + Cursor",
  "Weapons Designer & Art: D.S.",
  "Necromancer & Compupu Design: J.L.",
  "",
  "Music:",
  "main_screen_music: \"Level Up\"",
  "forge_music: \"Limit 70\"",
  "climbing_music: \"Beauty Flow\"",
  "fight_music: \"Raving Energy (faster)\"",
  "pact_music: \"Tyrant\"",
  "tooth_maw_music: \"Mega Hyper Ultrastorm\"",
  "death_screen_music: \"Hypnothis\"",
  "win_screen_music: \"Inspired\"",
  "",
  "All music by Kevin MacLeod (incompetech.com)",
  "Licensed under Creative Commons: By Attribution 4.0 License",
  "http://creativecommons.org/licenses/by/4.0/",
];

export class CreditsScene {
  constructor() {
    this.t = 0;
  }

  enter() {
    this.t = 0;
  }

  update(dt, game) {
    this.t += dt;
    if (game.input.wasPressed("Escape", "Backspace", " ", "Space", "Enter", "Mouse0")) {
      SFX.click();
      game.scenes.pop(game);
    }
  }

  render(ctx, game) {
    void game;
    drawBackdropCached(ctx, this.t * 0.35, this.t * 0.35, 1.02, null, 1);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "CREDITS", W / 2, 70, 44, COLORS.bile, COLORS.blood);

    const panelX = 120, panelY = 140, panelW = W - 240, panelH = H - 240;
    drawPanel(ctx, panelX, panelY, panelW, panelH);

    let y = panelY + 28;
    for (const raw of LINES) {
      const isHead = raw === "Credits:" || raw === "Music:";
      const size = isHead ? 22 : 16;
      const color = isHead ? COLORS.gold : (raw.startsWith("http") ? "#8a9aff" : COLORS.bone);
      if (!raw) { y += 12; continue; }
      const lines = wrapText(ctx, raw, panelW - 64, size, {});
      for (const ln of lines) {
        drawText(ctx, ln, panelX + 32, y, { size, color, bold: isHead });
        y += size + 6;
      }
      y += isHead ? 8 : 2;
    }

    ctx.save();
    ctx.globalAlpha = 0.9;
    roundRect(ctx, W / 2 - 240, H - 82, 480, 44, 10);
    ctx.fillStyle = "rgba(26,18,62,0.85)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    drawText(ctx, "ESC / SPACE / CLICK to return", W / 2, H - 60, {
      size: 16, color: COLORS.bone, align: "center", baseline: "middle", bold: true,
    });
  }
}

