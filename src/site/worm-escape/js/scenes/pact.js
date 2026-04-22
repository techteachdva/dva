import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { rollPactChoices } from "../content/pacts.js";
import { applyPact } from "../content/player.js";
import { TransitionScene } from "./transition.js";

// v0.12 PactScene - after every boss kill and before the chamber
// transition, the player picks ONE of 3 (or 4, vs elites) trade-off
// pacts. Each pact immediately mutates the player object for the rest
// of the run. Taken pacts are excluded from future rolls so every choice
// is unique per run (18 pacts, only 4 max in a full run; plenty of
// rerollability).
export class PactScene {
  constructor(completedChamberIdx, opts = {}) {
    this.completedChamberIdx = completedChamberIdx;
    this.eliteReward = !!opts.eliteReward;
    this.t = 0;
    this.idx = 0;
    this.choices = [];
    this.picked = null;
    this.confirmT = 0;
  }

  enter(game) {
    const p = game.player;
    const taken = (p && p.pacts) ? p.pacts : [];
    const n = this.eliteReward ? 4 : 3;
    this.choices = rollPactChoices(n, taken);
    if (this.choices.length === 0) {
      // Edge case: all 18 pacts already taken. Skip straight to transition.
      game.scenes.replace(new TransitionScene(this.completedChamberIdx), game);
      return;
    }
    this.idx = 0;
    SFX.click();
  }

  update(dt, game) {
    this.t += dt;
    if (this.picked) {
      this.confirmT += dt;
      if (this.confirmT > 1.1) {
        game.scenes.replace(new TransitionScene(this.completedChamberIdx), game);
      }
      return;
    }
    if (game.input.wasPressed("ArrowLeft", "a")) {
      this.idx = (this.idx - 1 + this.choices.length) % this.choices.length;
      SFX.click();
    } else if (game.input.wasPressed("ArrowRight", "d")) {
      this.idx = (this.idx + 1) % this.choices.length;
      SFX.click();
    } else if (game.input.wasPressed(" ", "Space", "Enter")) {
      this.confirm(game);
    } else if (game.input.wasPressed("1") && this.choices[0]) { this.idx = 0; this.confirm(game); }
    else if (game.input.wasPressed("2") && this.choices[1]) { this.idx = 1; this.confirm(game); }
    else if (game.input.wasPressed("3") && this.choices[2]) { this.idx = 2; this.confirm(game); }
    else if (game.input.wasPressed("4") && this.choices[3]) { this.idx = 3; this.confirm(game); }
  }

  confirm(game) {
    const pact = this.choices[this.idx];
    if (!pact) return;
    applyPact(game.player, pact.id);
    this.picked = pact;
    this.confirmT = 0;
    SFX.confirm();
  }

  render(ctx, game) {
    drawFleshBackground(ctx, this.t, 1.0);
    drawVeins(ctx, this.t, this.completedChamberIdx + 9);
    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, this.eliteReward ? "ELITE BONUS - CHOOSE A PACT" : "SEAL A PACT",
      W / 2, 70, 40, COLORS.bile, COLORS.blood);
    drawText(ctx, this.eliteReward
      ? "The guardian was Elite. Pick 1 of 4."
      : "The worm rewards the worthy. Pick 1 of 3.",
      W / 2, 114, { size: 15, color: COLORS.bone, align: "center" });

    const n = this.choices.length;
    const gap = 24;
    // Cards shrink slightly for 4-card (elite) mode.
    const cardW = n >= 4 ? 260 : 320;
    const cardH = 440;
    const totalW = cardW * n + gap * (n - 1);
    const startX = (W - totalW) / 2;
    const y = 160;

    for (let i = 0; i < n; i++) {
      const c = this.choices[i];
      const x = startX + i * (cardW + gap);
      const selected = (i === this.idx) && !this.picked;
      const chosen   = (this.picked && this.choices[i] === this.picked);
      this.drawCard(ctx, c, x, y, cardW, cardH, selected, chosen, i + 1);
    }

    if (this.picked) {
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 8);
      drawText(ctx, `"${this.picked.name}" sealed in blood.`, W / 2, H - 80, {
        size: 22, color: COLORS.bile, align: "center", bold: true,
        glow: COLORS.blood,
      });
      ctx.save();
      ctx.globalAlpha = pulse;
      drawText(ctx, "The worm tightens...", W / 2, H - 50, {
        size: 14, color: COLORS.boneDim, align: "center",
      });
      ctx.restore();
    } else {
      const blink = Math.sin(this.t * 5) > 0;
      drawText(ctx, "[LEFT/RIGHT] or [1-4] to choose   [SPACE/ENTER] to seal",
        W / 2, H - 48, {
        size: 14, color: COLORS.boneDim, align: "center",
      });
      if (blink) {
        drawText(ctx, ">> SEAL A PACT <<", W / 2, H - 22, {
          size: 16, color: COLORS.bile, align: "center", bold: true,
        });
      }
    }
  }

  drawCard(ctx, pact, x, y, w, h, selected, chosen, num) {
    ctx.save();

    // Card backdrop
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, chosen ? "rgba(120, 70, 10, 0.95)" : selected ? "rgba(40,14,50,0.95)" : "rgba(14,5,20,0.85)");
    g.addColorStop(1, "rgba(6,2,10,0.95)");
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();

    // Border
    ctx.strokeStyle = chosen ? COLORS.gold : (selected ? COLORS.bile : COLORS.boneDim);
    ctx.lineWidth = chosen ? 4 : (selected ? 3 : 2);
    if (selected || chosen) {
      ctx.shadowColor = chosen ? COLORS.gold : COLORS.bile;
      ctx.shadowBlur = 18;
    }
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10);
    ctx.stroke();
    ctx.restore();

    // Number badge
    ctx.save();
    ctx.fillStyle = selected ? COLORS.bile : COLORS.boneDim;
    ctx.beginPath();
    ctx.arc(x + 26, y + 26, 16, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, String(num), x + 26, y + 26, {
      size: 18, bold: true, color: "#120616", align: "center", baseline: "middle",
      shadow: false,
    });
    ctx.restore();

    // Title
    drawText(ctx, pact.name, x + w / 2, y + 30, {
      size: 22, bold: true, color: selected ? COLORS.bile : COLORS.bone,
      align: "center", glow: selected ? COLORS.blood : null,
    });
    // Blurb
    drawText(ctx, pact.blurb, x + w / 2, y + 64, {
      size: 13, color: COLORS.boneDim, align: "center",
    });

    // Decorative seal in the middle of the card - a wax-sigil.
    const sealY = y + 170;
    this.drawSeal(ctx, x + w / 2, sealY, selected, pact.tags);

    // Pros/cons
    const rowsY = y + h - 200;
    drawText(ctx, "GAINS", x + 16, rowsY, { size: 11, color: "#8fe97a", bold: true });
    pact.pros.forEach((line, i) => {
      drawText(ctx, "+ " + line, x + 16, rowsY + 20 + i * 18, {
        size: 12, color: "#b5f05a",
      });
    });
    const cy = rowsY + 20 + pact.pros.length * 18 + 14;
    drawText(ctx, "COSTS", x + 16, cy, { size: 11, color: "#ff9090", bold: true });
    pact.cons.forEach((line, i) => {
      drawText(ctx, "- " + line, x + 16, cy + 20 + i * 18, {
        size: 12, color: "#ff9090",
      });
    });
  }

  // Small circular seal sigil drawn at the center of each pact card so the
  // cards feel tactile / occult. The color shifts with the tag set.
  drawSeal(ctx, cx, cy, selected, tags) {
    const tag = tags && tags[0];
    const color = tag === "combat" ? "#c21a1a"
                : tag === "climb"  ? "#7fe3ff"
                : tag === "stats"  ? "#ffd966"
                :                    COLORS.bile;
    ctx.save();
    ctx.translate(cx, cy);
    // Outer ring
    ctx.strokeStyle = selected ? COLORS.bile : color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke();
    // Inner ring
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
    // Runic marks - 5-pointed polygon
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const r = 20 + Math.sin(this.t * 3 + k) * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Core dot
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
