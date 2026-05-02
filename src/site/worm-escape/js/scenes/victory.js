import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, drawHero, ParticleSystem,
  roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { loadSave, recordRun, findScoreRank } from "../engine/storage.js";
import { IntroScene } from "./intro.js";

// --- v0.10 Scoring ---
// A proper end-of-run scoreboard. Rewards:
//   - Finishing the run at all                   (base per chamber)
//   - Leftover HP / Armor / MP                   (survivor bonuses)
//   - Perfect braces / counter-strikes           (skill)
//   - Power-ups + rings collected                (exploration)
//   - Fewer hits taken                           (defensive skill)
// Time is logged but not scored, to avoid punishing cautious play.

const WEIGHTS = {
  basePerChamber:   500,
  bossKill:         300,
  hpPct:            700,  // x (hp / hpMax)
  armorPct:         350,  // x (armor / armorMax) if armorMax > 0
  manaPct:          100,  // x (mana / manaMax)
  perfectBrace:     150,  // each
  counterStrike:    100,  // each
  powerUp:           50,  // each non-ring power-up
  ringBonus:        250,  // each ring of armor
  hitPenaltyEach:   -25,  // per distinct hit taken
  hitPenaltyCap:   -800,  // floor so one horrible chamber can't zero you
  // v0.12 additions
  pactPerChamber:    75,  // per pact active per chamber cleared
  eliteKilled:      400,  // each elite defeated
  hitlessChamber:   300,  // each chamber cleared without taking a hit
};

function calcScore(p) {
  const s = p.score || {};
  const parts = [];
  const push = (label, value) => parts.push({ label, value });

  push("Chambers Cleared",
    (s.chambersCleared || 0) * WEIGHTS.basePerChamber);
  push("Sphincter Guardians Slain",
    (s.bossesDefeated || 0) * WEIGHTS.bossKill);
  push(`HP Remaining (${Math.ceil(p.hp)}/${p.hpMax})`,
    Math.round(WEIGHTS.hpPct * Math.max(0, p.hp) / Math.max(1, p.hpMax)));
  push(`MP Remaining (${Math.ceil(p.mana)}/${p.manaMax})`,
    Math.round(WEIGHTS.manaPct * Math.max(0, p.mana) / Math.max(1, p.manaMax)));
  if (p.armorMax > 0) {
    push(`Armor Remaining (${Math.ceil(p.armor)}/${p.armorMax})`,
      Math.round(WEIGHTS.armorPct * Math.max(0, p.armor) / Math.max(1, p.armorMax)));
  }
  push(`Perfect Braces (x${s.perfectBraces || 0})`,
    (s.perfectBraces || 0) * WEIGHTS.perfectBrace);
  push(`Counter Strikes (x${s.counterStrikes || 0})`,
    (s.counterStrikes || 0) * WEIGHTS.counterStrike);
  push(`Power-ups Grabbed (x${s.powerUpsCollected || 0})`,
    (s.powerUpsCollected || 0) * WEIGHTS.powerUp);
  if ((s.ringsCollected || 0) > 0) {
    push(`Rings of Armor (x${s.ringsCollected})`,
      s.ringsCollected * WEIGHTS.ringBonus);
  }
  const rawHitPenalty = (s.hitsTaken || 0) * WEIGHTS.hitPenaltyEach;
  const hitPenalty = Math.max(WEIGHTS.hitPenaltyCap, rawHitPenalty);
  push(`Hits Taken Penalty (${s.hitsTaken || 0} hits)`, hitPenalty);

  // v0.12: pacts taken, elites killed, hitless chambers.
  const pactCount = (s.pactsTaken || p.pacts || []).length;
  if (pactCount > 0) {
    const pactScore = pactCount * (s.chambersCleared || 0) * WEIGHTS.pactPerChamber;
    push(`Pacts Survived (x${pactCount})`, pactScore);
  }
  if ((s.elitesKilled || 0) > 0) {
    push(`Elites Vanquished (x${s.elitesKilled})`,
      s.elitesKilled * WEIGHTS.eliteKilled);
  }
  if ((s.hitlessChambers || 0) > 0) {
    push(`Hitless Chambers (x${s.hitlessChambers})`,
      s.hitlessChambers * WEIGHTS.hitlessChamber);
  }

  if (s.usedAcerCheat) {
    push("Acererack invulnerability surcharge", -1000000);
  }

  const total = Math.max(0, parts.reduce((a, b) => a + b.value, 0));
  return { parts, total };
}

function grade(total) {
  if (total >= 4000) return { rank: "S+", label: "Worm-Slayer Eternal",   color: "#ffd966" };
  if (total >= 3200) return { rank: "S",  label: "Worm-Slayer",           color: "#ffd966" };
  if (total >= 2500) return { rank: "A",  label: "Heroic",                color: "#bfff00" };
  if (total >= 1800) return { rank: "B",  label: "Seasoned",              color: "#7fc0ff" };
  if (total >= 1100) return { rank: "C",  label: "Bruised but Breathing", color: "#f6ecd0" };
  if (total >= 500)  return { rank: "D",  label: "Scraped Through",       color: "#e0b090" };
  return                        { rank: "E",  label: "Barely Ejected",       color: "#ff9070" };
}

export class VictoryScene {
  constructor() {
    this.t = 0;
    this.abruptFinale = false;
    this.particles = new ParticleSystem();
    this.nextEmit = 0;
    this.score = null;
    this.grade = null;
    // Animated count-up: each line index reveals over time.
    this.revealT = 0;          // seconds since scoreboard started revealing
    this.displayTotal = 0;     // lerps toward this.score.total

    // v0.12 persistent save state - populated in enter().
    this.save = null;
    this.newUnlocks = [];
    this.myRank = -1;          // index into save.highScores (-1 if off-list)
  }

  enter(game) {
    const p = game.player;
    this.abruptFinale = !!game.victoryAbruptReveal;
    if (game.victoryAbruptReveal) game.victoryAbruptReveal = false;
    this.score = calcScore(p);
    this.grade = grade(this.score.total);
    // Persist the run + compute unlocks.
    const save = loadSave();
    const result = {
      win: true,
      score: this.score.total,
      rank: this.grade.rank,
      buildId: p.buildId,
      loadoutId: p.loadoutId,
      chambersCleared: p.score ? p.score.chambersCleared : 0,
      hitlessChambers: p.score ? p.score.hitlessChambers : 0,
      gullethitless:   p.score ? !!p.score.gullethitless : false,
      elitesKilled:    p.score ? p.score.elitesKilled || 0 : 0,
    };
    const { save: updated, newUnlocks, entry } = recordRun(save, result);
    this.save = updated;
    this.newUnlocks = newUnlocks;
    this.myRank = findScoreRank(updated, entry);

    if (this.abruptFinale) {
      this.revealT = 999999;
      this.displayTotal = this.score.total;
    }
  }

  update(dt, game) {
    this.t += dt;
    this.nextEmit -= dt;
    if (!this.abruptFinale && this.nextEmit <= 0) {
      this.nextEmit = 0.07;
      const cx = W / 2 + (Math.random() - 0.5) * 260;
      const cy = H * 0.32 + (Math.random() - 0.5) * 80;
      const color = [COLORS.gold, COLORS.bile, COLORS.bone][Math.floor(Math.random() * 3)];
      this.particles.burst(cx, cy, color, 10, 160, 1.0);
    }
    this.particles.update(dt);

    // Score reveal starts immediately; each row takes ~0.35s to appear.
    this.revealT += dt;
    const target = this.score ? this.score.total : 0;
    // Clamp displayTotal to the sum of revealed lines so the running total
    // always matches what the player can see on screen.
    const perRow = 0.35;
    const revealedRows = Math.min(this.score ? this.score.parts.length : 0,
      Math.floor(this.revealT / perRow));
    const revealedSum = this.score
      ? this.score.parts.slice(0, revealedRows).reduce((a, b) => a + b.value, 0)
      : 0;
    // Smoothly animate to revealedSum (then to final total when everything's up)
    const goal = revealedRows >= (this.score ? this.score.parts.length : 0)
      ? target : revealedSum;
    this.displayTotal += (goal - this.displayTotal) * Math.min(1, dt * 4);

    // Wait until scoreboard is fully shown before allowing restart.
    const fullyShown = this.score
      ? this.revealT > this.score.parts.length * perRow + 0.6
      : true;
    if (fullyShown && game.input.wasPressed(" ", "Space", "Enter", "Escape", "r", "Mouse0")) {
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

    const sunG = ctx.createRadialGradient(W / 2, H * 0.28, 30, W / 2, H * 0.28, 380);
    sunG.addColorStop(0, "rgba(255, 255, 180, 0.85)");
    sunG.addColorStop(1, "rgba(255, 255, 180, 0)");
    ctx.fillStyle = sunG;
    ctx.fillRect(0, 0, W, H);

    // Worm maw silhouette (shrunk a bit to leave room for the scoreboard)
    ctx.fillStyle = "rgba(30, 10, 40, 0.95)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.88);
    for (let x = 0; x <= W; x += 24) {
      const y = H * 0.88 + Math.sin(x * 0.015 + this.t) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f6ecd0";
    for (let x = 30; x < W; x += 48) {
      const y = H * 0.88 + Math.sin(x * 0.015 + this.t) * 10;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 22);
      ctx.closePath();
      ctx.fill();
    }

    // Hero soaring at top
    const heroY = H * 0.28 + Math.sin(this.t * 3) * 10;
    ctx.save();
    ctx.translate(W * 0.18, heroY);
    ctx.scale(3.2, 3.2);
    ctx.rotate(Math.sin(this.t * 4) * 0.1);
      drawHero(ctx, 0, 0, 1, this.t * 10, p ? p.buildId : "swift", p?.synergyId);
    ctx.restore();

    this.particles.render(ctx);

    drawBanner(
      ctx,
      this.abruptFinale ? "STACK UNWOUND (?)" : "YOU BURST FREE!",
      W / 2,
      70,
      44,
      this.abruptFinale ? COLORS.gold : COLORS.bile,
      COLORS.blood,
    );

    // --- Scoreboard panel ---
    this.drawScoreboard(ctx);

    // v0.12 top-5 high-score table + unlock banners. Drawn only when the
    // reveal is finished so it doesn't distract from the scoreboard.
    const parts = this.score ? this.score.parts : [];
    const fullyShownGate = this.revealT > parts.length * 0.35 + 0.6;
    if (fullyShownGate && this.save) {
      this.drawHighScoreStrip(ctx);
      this.drawUnlockBanners(ctx);
    }

    // Prompt to continue once everything is revealed
    const fullyShown = this.score
      ? this.revealT > this.score.parts.length * 0.35 + 0.6
      : true;
    if (fullyShown) {
      const blink = Math.sin(this.t * 5) > 0;
      if (blink) {
        drawText(ctx, ">> SPACE or R to start a new tale <<", W / 2, H - 18, {
          size: 16, color: COLORS.bone, align: "center", bold: true,
        });
      }
    }
  }

  drawScoreboard(ctx) {
    if (!this.score) return;
    const parts = this.score.parts;
    const panelX = W / 2 - 340;
    const panelY = 130;
    const panelW = 680;
    const rowH = 26;
    const panelH = 100 + parts.length * rowH + 100;
    drawPanel(ctx, panelX, panelY, panelW, panelH);
    drawText(ctx, "FINAL SCORE", W / 2, panelY + 20, {
      size: 20, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
    });

    // Row-by-row reveal
    const perRow = 0.35;
    for (let i = 0; i < parts.length; i++) {
      const showAt = i * perRow;
      if (this.revealT < showAt) continue;
      const local = Math.min(1, (this.revealT - showAt) / 0.25);
      const y = panelY + 54 + i * rowH;
      const part = parts[i];
      ctx.save();
      ctx.globalAlpha = local;
      // Reserve ~100px on the right for the value so the label truncates
      // before it could ever collide with the score number.
      drawText(ctx, part.label, panelX + 24, y, {
        size: 14, color: COLORS.bone, maxWidth: panelW - 48 - 100,
      });
      const color = part.value < 0 ? "#ff9a9a"
                   : part.value === 0 ? COLORS.boneDim
                   : "#bfff00";
      const sign = part.value > 0 ? "+" : "";
      drawText(ctx, `${sign}${part.value}`, panelX + panelW - 24, y, {
        size: 14, color, align: "right", bold: true,
      });
      ctx.restore();
    }

    // Total + rank, revealed at the end
    const totalY = panelY + 54 + parts.length * rowH + 18;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, panelX + 16, totalY - 4, panelW - 32, 40, 6);
    ctx.fill();
    drawText(ctx, "TOTAL", panelX + 24, totalY + 18, {
      size: 18, color: COLORS.bone, bold: true,
    });
    drawText(ctx, `${Math.floor(this.displayTotal)}`, panelX + panelW - 24, totalY + 18, {
      size: 22, color: COLORS.gold, align: "right", bold: true, glow: COLORS.blood,
    });
    ctx.restore();

    // Rank badge
    const fullyShown = this.revealT > parts.length * perRow + 0.4;
    if (fullyShown) {
      const rankY = totalY + 56;
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 5);
      const g = this.grade;
      drawText(ctx, `RANK  ${g.rank}`, W / 2, rankY, {
        size: 30, color: g.color, align: "center", bold: true,
        glow: g.color,
      });
      ctx.save();
      ctx.globalAlpha = pulse;
      drawText(ctx, g.label, W / 2, rankY + 26, {
        size: 15, color: COLORS.bone, align: "center", bold: true,
      });
      ctx.restore();
    }
  }

  // Compact top-5 sidebar rendered in the unused right edge of the screen.
  drawHighScoreStrip(ctx) {
    const hs = this.save.highScores || [];
    if (hs.length === 0) return;
    const panelX = W - 230;
    const panelY = 130;
    const panelW = 214;
    const panelH = 210;
    drawPanel(ctx, panelX, panelY, panelW, panelH);
    drawText(ctx, "TOP 5 RUNS", panelX + panelW / 2, panelY + 18, {
      size: 14, color: COLORS.bile, align: "center", bold: true,
    });
    for (let i = 0; i < Math.min(5, hs.length); i++) {
      const e = hs[i];
      const y = panelY + 44 + i * 30;
      const isMe = i === this.myRank;
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 6);
      const color = isMe ? `rgba(255, 217, 102, ${0.7 + pulse * 0.3})`
                         : COLORS.bone;
      drawText(ctx, `${i + 1}.`, panelX + 10, y, {
        size: 13, color, bold: isMe,
      });
      drawText(ctx, `${e.score}`, panelX + 32, y, {
        size: 13, color, bold: isMe, maxWidth: 56,
      });
      drawText(ctx, `[${e.rank}]`, panelX + 94, y, {
        size: 12, color, bold: isMe, maxWidth: 38,
      });
      drawText(ctx, String((e.buildId || "?").slice(0, 5)).toUpperCase(),
        panelX + 136, y, {
          size: 11, color: isMe ? color : COLORS.boneDim, bold: isMe,
          maxWidth: 40,
      });
      drawText(ctx, String(e.chambersCleared) + "ch",
        panelX + panelW - 10, y, {
          size: 11, color: COLORS.boneDim, align: "right",
      });
    }
    if (this.myRank === 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
      drawText(ctx, "!! NEW BEST !!", panelX + panelW / 2, panelY + panelH - 12, {
        size: 14, color: `rgba(255, 217, 102, ${0.7 + pulse * 0.3})`,
        align: "center", bold: true, glow: COLORS.gold,
      });
    } else if (this.myRank >= 0) {
      drawText(ctx, `Your run: #${this.myRank + 1}`,
        panelX + panelW / 2, panelY + panelH - 12, {
        size: 12, color: COLORS.bone, align: "center", bold: true,
      });
    }
  }

  // Flashy banner strip over the worm maw when new unlocks fire.
  drawUnlockBanners(ctx) {
    if (!this.newUnlocks || this.newUnlocks.length === 0) return;
    const baseY = H - 150;
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 7);
    for (let i = 0; i < this.newUnlocks.length; i++) {
      const u = this.newUnlocks[i];
      const y = baseY + i * 38;
      ctx.save();
      ctx.fillStyle = `rgba(255, 217, 102, ${0.25 + pulse * 0.3})`;
      roundRect(ctx, W / 2 - 360, y - 18, 720, 32, 10);
      ctx.fill();
      drawText(ctx, u.label, W / 2, y, {
        size: 18, color: COLORS.gold, align: "center", bold: true,
        glow: COLORS.gold, baseline: "middle",
        maxWidth: 700,
      });
      ctx.restore();
    }
  }
}
