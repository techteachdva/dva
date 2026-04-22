import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { loadSave, recordRun, findScoreRank } from "../engine/storage.js";
import { IntroScene } from "./intro.js";

export class GameOverScene {
  constructor(reason) {
    this.reason = reason || "You got digested.";
    this.t = 0;
    // v0.12 persistence.
    this.save = null;
    this.newUnlocks = [];
    this.myRank = -1;
    this.finalScore = 0;
  }
  enter(game) {
    const p = game.player;
    // Lightly-scored losses: award progress partials so the leaderboard
    // isn't entirely wins. Matches the Victory scoring shape loosely.
    const s = p && p.score ? p.score : {};
    const partial =
      (s.chambersCleared || 0) * 400 +
      (s.bossesDefeated || 0) * 200 +
      (s.hitlessChambers || 0) * 200 +
      (s.elitesKilled || 0) * 300 +
      (s.powerUpsCollected || 0) * 30;
    this.finalScore = Math.max(0, Math.floor(partial));

    const save = loadSave();
    const result = {
      win: false,
      score: this.finalScore,
      rank: "-",
      buildId: p ? p.buildId : "?",
      loadoutId: p ? p.loadoutId : "?",
      chambersCleared: s.chambersCleared || 0,
      hitlessChambers: s.hitlessChambers || 0,
      gullethitless:   !!s.gullethitless,
      elitesKilled:    s.elitesKilled || 0,
    };
    const { save: updated, newUnlocks, entry } = recordRun(save, result);
    this.save = updated;
    this.newUnlocks = newUnlocks;
    this.myRank = findScoreRank(updated, entry);
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

    drawBanner(ctx, "YOU GOT DIGESTED", W / 2, 140, 64, COLORS.blood, COLORS.ink);
    drawBanner(ctx, "adventurer soup for supper", W / 2, 190, 22, COLORS.bone, COLORS.blood);

    const gPanelW = W - 400;
    drawPanel(ctx, 200, 240, gPanelW, 180, { border: COLORS.blood, borderGlow: COLORS.blood });
    drawText(ctx, this.reason, W / 2, 280, {
      size: 22, color: COLORS.bone, align: "center", maxWidth: gPanelW - 40,
    });
    drawText(ctx, "The worm lets out a long, satisfied burp.", W / 2, 326, {
      size: 16, color: COLORS.bile, align: "center", maxWidth: gPanelW - 40,
    });
    drawText(ctx, `Run score: ${this.finalScore}`, W / 2, 362, {
      size: 18, color: COLORS.gold, align: "center", bold: true,
    });
    drawText(ctx, "Somewhere, a bard starts writing your obituary.", W / 2, 390, {
      size: 14, color: COLORS.boneDim, align: "center",
    });

    // Top-5 table. Rendered centered below the panel.
    if (this.save) this.drawHighScoreTable(ctx);
    // Unlock banners (rare on a loss, but possible for Hex Staff / Gullet).
    if (this.save) this.drawUnlockBanners(ctx);

    const blink = Math.sin(this.t * 5) > 0;
    if (blink) {
      drawText(ctx, ">> SPACE or R to try again <<", W / 2, H - 40, {
        size: 22, color: COLORS.bile, align: "center", bold: true,
      });
    }
  }

  drawHighScoreTable(ctx) {
    const hs = this.save.highScores || [];
    if (hs.length === 0) return;
    const panelW = 560;
    const panelH = 180;
    const panelX = W / 2 - panelW / 2;
    const panelY = 450;
    drawPanel(ctx, panelX, panelY, panelW, panelH);
    drawText(ctx, "TOP 5 RUNS", panelX + panelW / 2, panelY + 14, {
      size: 16, color: COLORS.bile, align: "center", bold: true,
    });
    for (let i = 0; i < Math.min(5, hs.length); i++) {
      const e = hs[i];
      const y = panelY + 46 + i * 24;
      const isMe = i === this.myRank;
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 6);
      const color = isMe ? `rgba(255, 217, 102, ${0.7 + pulse * 0.3})` : COLORS.bone;
      drawText(ctx, `${i + 1}.`, panelX + 20, y, { size: 14, color, bold: isMe });
      drawText(ctx, String(e.score), panelX + 60, y, { size: 14, color, bold: isMe });
      drawText(ctx, `[${e.rank}]`, panelX + 150, y, { size: 13, color, bold: isMe });
      drawText(ctx, String(e.buildId || "?").toUpperCase(),
        panelX + 210, y, { size: 12, color, bold: isMe });
      drawText(ctx, String(e.loadoutId || "?"),
        panelX + 320, y, { size: 12, color: COLORS.boneDim });
      drawText(ctx, `${e.chambersCleared}ch ${e.win ? "WIN" : "   "}`,
        panelX + panelW - 20, y, {
          size: 12, color: COLORS.boneDim, align: "right",
        });
    }
  }

  drawUnlockBanners(ctx) {
    if (!this.newUnlocks || this.newUnlocks.length === 0) return;
    const baseY = 420;
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 7);
    for (let i = 0; i < this.newUnlocks.length; i++) {
      const u = this.newUnlocks[i];
      const y = baseY - i * 36;
      ctx.save();
      ctx.fillStyle = `rgba(255, 217, 102, ${0.25 + pulse * 0.3})`;
      roundRect(ctx, W / 2 - 360, y - 16, 720, 30, 10);
      ctx.fill();
      drawText(ctx, u.label, W / 2, y, {
        size: 16, color: COLORS.gold, align: "center", bold: true,
        glow: COLORS.gold, baseline: "middle",
        maxWidth: 700,
      });
      ctx.restore();
    }
  }
}
