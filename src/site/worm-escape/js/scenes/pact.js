import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { getPactCardVisual, drawPactSigil } from "../engine/pactSigils.js";
import { SFX } from "../engine/audio.js";
import { rollPactChoices } from "../content/pacts.js";
import { applyPact } from "../content/player.js";
import { TransitionScene } from "./transition.js";
import { pointInRect } from "../engine/pointer.js";

// v0.12 PactScene - after every boss kill and before the chamber
// transition, the player seals trade-off pacts. Bubblegum cheat forces
// four separate 3-card rounds here instead of a single Elite 4-spread bonus.
export class PactScene {
  constructor(completedChamberIdx, opts = {}) {
    this.completedChamberIdx = completedChamberIdx;
    this.eliteReward = !!opts.eliteReward;
    /** Bubblegum: multiple 3-choice seals in one scene before transition */
    this.bubbleChains = Math.max(0, Math.floor(opts.bubbleSequential ?? 0));
    this.sealsLeft = 1;
    this.t = 0;
    this.idx = 0;
    this.choices = [];
    this.picked = null;
    this.confirmT = 0;
  }

  enter(game) {
    const p = game.player;
    const ranks = (p && p.pactRanks) ? p.pactRanks : {};
    const bubbleOn = this.bubbleChains >= 2;
    this.sealsLeft = bubbleOn ? this.bubbleChains : 1;
    const n = bubbleOn ? 3 : (this.eliteReward ? 4 : 3);
    this.choices = rollPactChoices(n, ranks);
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
        const pInner = game.player;
        const ranksInner = (pInner && pInner.pactRanks) ? pInner.pactRanks : {};
        this.sealsLeft--;
        if (this.sealsLeft > 0) {
          this.choices = rollPactChoices(3, ranksInner);
          if (this.choices.length === 0) {
            game.scenes.replace(new TransitionScene(this.completedChamberIdx), game);
            return;
          }
          this.idx = 0;
          this.picked = null;
          this.confirmT = 0;
          SFX.click();
          return;
        }
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
    } else if (game.input.wasPressed("Mouse0")) {
      const n = this.choices.length;
      if (n === 0) return;
      const gap = 24;
      const cardW = n >= 4 ? 260 : 320;
      const cardH = 440;
      const totalW = cardW * n + gap * (n - 1);
      const startX = (W - totalW) / 2;
      const y = 160;
      const mx = game.input.mouseX, my = game.input.mouseY;
      for (let i = 0; i < n; i++) {
        const x = startX + i * (cardW + gap);
        if (pointInRect(mx, my, x, y, cardW, cardH)) {
          this.idx = i;
          this.confirm(game);
          break;
        }
      }
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
    drawBackdropCached(ctx, this.t, this.t, 1.0, null, this.completedChamberIdx + 9);
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, W, H);
    // Subtle arcade scanlines
    ctx.save();
    ctx.globalAlpha = 0.08;
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, y, W, 2);
    }
    ctx.restore();

    const bubbleActive = this.bubbleChains >= 2;
    const sealIdx = bubbleActive ? (this.bubbleChains - this.sealsLeft + 1) : 1;

    drawBanner(ctx, bubbleActive
      ? `◆ BUBBLEGUM (${sealIdx}/${this.bubbleChains}) ◆`
      : (this.eliteReward ? "◆ ELITE BONUS — PACT SELECT ◆" : "◆ SEAL A PACT — ARCADE MODE ◆"),
    W / 2, 68, bubbleActive ? 32 : 36, COLORS.bile, COLORS.blood);
    drawText(ctx, bubbleActive
      ? `Pick 1 of 3 — pact ${sealIdx} of ${this.bubbleChains} (sweetened valve tax).`
      : (this.eliteReward
        ? "The guardian was Elite. Pick 1 of 4."
        : "The worm rewards the worthy. Pick 1 of 3."),
    W / 2, 114, { size: 15, color: COLORS.bone, align: "center" });

    const n = this.choices.length;
    const gap = 24;
    // Cards shrink slightly for 4-card (elite) mode.
    const cardW = n >= 4 ? 260 : 320;
    const cardH = 440;
    const totalW = cardW * n + gap * (n - 1);
    const startX = (W - totalW) / 2;
    const y = 160;

    const pr = (game.player && game.player.pactRanks) ? game.player.pactRanks : {};
    for (let i = 0; i < n; i++) {
      const c = this.choices[i];
      const x = startX + i * (cardW + gap);
      const selected = (i === this.idx) && !this.picked;
      const chosen   = (this.picked && this.choices[i] === this.picked);
      this.drawCard(ctx, c, x, y, cardW, cardH, selected, chosen, i + 1, pr);
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

  drawCard(ctx, pact, x, y, w, h, selected, chosen, num, pactRanks) {
    const cur = (pactRanks && pactRanks[pact.id]) || 0;
    const nextRank = Math.min(3, cur + 1);
    const vis = getPactCardVisual(pact.id);
    const t = this.t;

    ctx.save();
    // CRT cabinet inner shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, x + 6, y + 8, w, h, 12);
    ctx.fill();

    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    if (chosen) {
      g.addColorStop(0, "rgba(120,70,10,0.92)");
      g.addColorStop(1, "rgba(40,20,4,0.98)");
    } else if (selected) {
      g.addColorStop(0, vis.secondary);
      g.addColorStop(0.45, "rgba(20,8,28,0.94)");
      g.addColorStop(1, vis.primary + "33");
    } else {
      g.addColorStop(0, vis.secondary);
      g.addColorStop(0.5, "rgba(12,6,18,0.92)");
      g.addColorStop(1, "rgba(4,2,10,0.96)");
    }
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();

    // Phosphor edge sheen
    const sh = ctx.createLinearGradient(x, y, x, y + 40);
    sh.addColorStop(0, vis.primary + "55");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    roundRect(ctx, x + 2, y + 2, w - 4, 36, 8);
    ctx.fill();

    // Pixel-double border (retro bezel)
    const edge = chosen ? COLORS.gold : (selected ? vis.border : "rgba(255,255,255,0.22)");
    ctx.strokeStyle = edge;
    ctx.lineWidth = 4;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 10);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 8);
    ctx.stroke();
    ctx.restore();

    // Slot number — arcade insert coin slot
    ctx.save();
    ctx.fillStyle = "#0a0610";
    roundRect(ctx, x + 10, y + 10, 40, 32, 4);
    ctx.fill();
    ctx.strokeStyle = vis.border;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 10.5, y + 10.5, 39, 31, 4);
    ctx.stroke();
    drawText(ctx, String(num), x + 30, y + 26, {
      size: 20, bold: true, color: vis.glow, align: "center", baseline: "middle",
      shadow: false,
    });
    ctx.restore();

    const textMax = w - 36;
    drawText(ctx, pact.name, x + w / 2, y + 34, {
      size: 20, bold: true, color: selected ? vis.glow : COLORS.bone,
      align: "center", glow: selected ? vis.primary : null,
      maxWidth: textMax,
    });
    drawText(ctx, pact.blurb, x + w / 2, y + 62, {
      size: 12, color: COLORS.boneDim, align: "center",
      maxWidth: textMax,
    });
    if (cur > 0) {
      drawText(ctx, `▲ RANK UP → ${nextRank}/3`, x + w / 2, y + 84, {
        size: 11, color: vis.primary, align: "center", bold: true,
        maxWidth: textMax,
      });
    }

    const sealY = y + 178;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(x + w / 2, sealY, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = vis.border;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    drawPactSigil(ctx, x + w / 2, sealY, pact.id, t, { scale: 1.05, selected: selected || chosen });

    const rowsY = y + h - 198;
    const rowMax = w - 28;
    drawText(ctx, "▶ BUFF", x + 14, rowsY, { size: 11, color: "#7fff9a", bold: true });
    pact.pros.forEach((line, i) => {
      drawText(ctx, "» " + line, x + 14, rowsY + 18 + i * 17, {
        size: 11, color: "#b5f05a", maxWidth: rowMax,
      });
    });
    const cy = rowsY + 18 + pact.pros.length * 17 + 10;
    drawText(ctx, "▼ DEBT", x + 14, cy, { size: 11, color: "#ff7a7a", bold: true });
    pact.cons.forEach((line, i) => {
      drawText(ctx, "« " + line, x + 14, cy + 18 + i * 17, {
        size: 11, color: "#ffaaaa", maxWidth: rowMax,
      });
    });
  }
}
