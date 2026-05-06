import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { getPactCardVisual, drawPactSigil } from "../engine/pactSigils.js";
import { SFX, setBGM } from "../engine/audio.js";
import { rollPactChoices } from "../content/pacts.js";
import { applyPact } from "../content/player.js";
import { TransitionScene } from "./transition.js";
import { pointInRect } from "../engine/pointer.js";

const DEALZ_PER_PAGE = 6;

function layoutPactCards(n) {
  const gap = n >= 4 ? 16 : 22;
  const cardW = n >= 4 ? 286 : 346;
  const cardH = Math.min(580, H - 168);
  const totalW = cardW * n + gap * (n - 1);
  const startX = (W - totalW) / 2;
  const y = 78;
  return { gap, cardW, cardH, totalW, startX, y };
}

/** 3×2 grid for cheat dealz full-list picker */
function layoutDealzGrid() {
  const cols = 3;
  const cardW = 214;
  const cardH = 318;
  const gap = 14;
  const totalW = cols * cardW + (cols - 1) * gap;
  const startX = (W - totalW) / 2;
  const y = 96;
  return { cols, cardW, cardH, gap, startX, y };
}

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
    /** Two-step seal: modal gate so mis-clicks never commit */
    this.confirmModal = false;
    /** Full pact list mode (cheat dealz) */
    this._dealzMode = false;
  }

  enter(game) {
    setBGM("music/pact_screen_music.mp3", { volume: 0.45, loop: true, restart: true });
    const p = game.player;
    const ranks = (p && p.pactRanks) ? p.pactRanks : {};
    const bubbleOn = this.bubbleChains >= 2;
    this.sealsLeft = bubbleOn ? this.bubbleChains : 1;
    const n = bubbleOn ? 3 : (this.eliteReward ? 4 : 3);
    this.choices = rollPactChoices(n, ranks, game);
    if (this.choices.length === 0) {
      game.scenes.replace(new TransitionScene(this.completedChamberIdx), game);
      return;
    }
    this._dealzMode = !!(game.dealzPacts && this.choices.length > 0);
    this.idx = 0;
    this.confirmModal = false;
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
          this.choices = rollPactChoices(3, ranksInner, game);
          if (this.choices.length === 0) {
            game.scenes.replace(new TransitionScene(this.completedChamberIdx), game);
            return;
          }
          this.idx = 0;
          this.picked = null;
          this.confirmT = 0;
          this.confirmModal = false;
          this._dealzMode = !!(game.dealzPacts && this.choices.length > 0);
          SFX.click();
          return;
        }
        game.scenes.replace(new TransitionScene(this.completedChamberIdx), game);
      }
      return;
    }

    const n = this.choices.length;
    if (n === 0) return;

    if (this._dealzMode) {
      const pages = Math.max(1, Math.ceil(n / DEALZ_PER_PAGE));
      const curPage = Math.floor(this.idx / DEALZ_PER_PAGE);
      if (game.input.wasPressed("[", "BracketLeft") && curPage > 0) {
        this.idx = (curPage - 1) * DEALZ_PER_PAGE;
        SFX.click();
      }
      if (game.input.wasPressed("]", "BracketRight") && curPage < pages - 1) {
        this.idx = Math.min(n - 1, (curPage + 1) * DEALZ_PER_PAGE);
        SFX.click();
      }
    }

    const L = this._dealzMode ? layoutDealzGrid() : layoutPactCards(n);

    if (this.confirmModal) {
      if (game.input.wasPressed("Escape")) {
        this.confirmModal = false;
        SFX.click();
        return;
      }
      const padX = W / 2 - 220;
      const padY = H / 2 - 38;
      const yes = { x: padX, y: padY + 58, w: 200, h: 44 };
      const no = { x: padX + 240, y: padY + 58, w: 200, h: 44 };
      if (game.input.wasPressed(" ", "Space", "Enter")) {
        this.sealPact(game);
        return;
      }
      if (game.input.wasPressed("Mouse0")) {
        const mx = game.input.mouseX, my = game.input.mouseY;
        if (pointInRect(mx, my, yes.x, yes.y, yes.w, yes.h)) {
          this.sealPact(game);
        } else if (pointInRect(mx, my, no.x, no.y, no.w, no.h)) {
          this.confirmModal = false;
          SFX.click();
        }
      }
      return;
    }

    if (game.input.wasPressed("ArrowLeft", "a")) {
      this.idx = (this.idx - 1 + n) % n;
      SFX.click();
    } else if (game.input.wasPressed("ArrowRight", "d")) {
      this.idx = (this.idx + 1) % n;
      SFX.click();
    } else if (game.input.wasPressed(" ", "Space", "Enter")) {
      this.confirmModal = true;
      SFX.click();
    } else if (game.input.wasPressed("Mouse0")) {
      const mx = game.input.mouseX, my = game.input.mouseY;
      if (this._dealzMode) {
        const start = Math.floor(this.idx / DEALZ_PER_PAGE) * DEALZ_PER_PAGE;
        for (let slot = 0; slot < DEALZ_PER_PAGE; slot++) {
          const gi = start + slot;
          if (gi >= n) break;
          const row = Math.floor(slot / 3);
          const col = slot % 3;
          const x = L.startX + col * (L.cardW + L.gap);
          const y = L.y + row * (L.cardH + L.gap);
          if (pointInRect(mx, my, x, y, L.cardW, L.cardH)) {
            if (this.idx === gi) {
              this.confirmModal = true;
              SFX.click();
            } else {
              this.idx = gi;
              SFX.click();
            }
            break;
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          const x = L.startX + i * (L.cardW + L.gap);
          if (pointInRect(mx, my, x, L.y, L.cardW, L.cardH)) {
            if (this.idx === i) {
              this.confirmModal = true;
              SFX.click();
            } else {
              this.idx = i;
              SFX.click();
            }
            break;
          }
        }
      }
    } else if (game.input.wasPressed("1") && this.choices[0]) {
      this.idx = 0;
      SFX.click();
    } else if (game.input.wasPressed("2") && this.choices[1]) {
      this.idx = 1;
      SFX.click();
    } else if (game.input.wasPressed("3") && this.choices[2]) {
      this.idx = 2;
      SFX.click();
    } else if (game.input.wasPressed("4") && this.choices[3]) {
      this.idx = 3;
      SFX.click();
    }
  }

  sealPact(game) {
    const pact = this.choices[this.idx];
    if (!pact) return;
    applyPact(game.player, pact.id);
    this.picked = pact;
    this.confirmT = 0;
    this.confirmModal = false;
    SFX.confirm();
  }

  render(ctx, game) {
    drawBackdropCached(ctx, this.t, this.t, 1.0, null, this.completedChamberIdx + 9);
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, W, H);
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
    W / 2, 52, bubbleActive ? 30 : 34, COLORS.bile, COLORS.blood);
    const n = this.choices.length;
    const dealzOn = this._dealzMode && n > 0;
    drawText(ctx, bubbleActive
      ? `Pick 1 of 3 — pact ${sealIdx} of ${this.bubbleChains} (sweetened valve tax).`
      : (dealzOn
        ? `DEALZ — every upgradable pact · page ${Math.floor(this.idx / DEALZ_PER_PAGE) + 1}/${Math.max(1, Math.ceil(n / DEALZ_PER_PAGE))} · [ ] flip`
        : (this.eliteReward
          ? "The guardian was Elite. Pick 1 of 4."
          : "The worm rewards the worthy. Pick 1 of 3.")),
    W / 2, 96, { size: 16, color: COLORS.bone, align: "center" });

    const pr = (game.player && game.player.pactRanks) ? game.player.pactRanks : {};
    if (dealzOn) {
      const DG = layoutDealzGrid();
      const start = Math.floor(this.idx / DEALZ_PER_PAGE) * DEALZ_PER_PAGE;
      for (let slot = 0; slot < DEALZ_PER_PAGE; slot++) {
        const gi = start + slot;
        if (gi >= n) break;
        const row = Math.floor(slot / 3);
        const col = slot % 3;
        const x = DG.startX + col * (DG.cardW + DG.gap);
        const y = DG.y + row * (DG.cardH + DG.gap);
        const c = this.choices[gi];
        const selected = (gi === this.idx) && !this.picked;
        const chosen = (this.picked && this.choices[gi] === this.picked);
        this.drawCard(ctx, c, x, y, DG.cardW, DG.cardH, selected, chosen, gi + 1, pr, { compact: true });
      }
    } else {
      const L = layoutPactCards(n);
      const { gap, cardW, cardH, startX, y } = L;
      for (let i = 0; i < n; i++) {
        const c = this.choices[i];
        const x = startX + i * (cardW + gap);
        const selected = (i === this.idx) && !this.picked;
        const chosen = (this.picked && this.choices[i] === this.picked);
        this.drawCard(ctx, c, x, y, cardW, cardH, selected, chosen, i + 1, pr, { compact: false });
      }
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
    } else if (this.confirmModal) {
      const padX = W / 2 - 220;
      const padY = H / 2 - 38;
      ctx.save();
      ctx.fillStyle = "rgba(8,4,16,0.92)";
      roundRect(ctx, padX - 12, padY - 12, 464, 140, 14);
      ctx.fill();
      ctx.strokeStyle = COLORS.bile;
      ctx.lineWidth = 3;
      roundRect(ctx, padX - 12, padY - 12, 464, 140, 14);
      ctx.stroke();
      ctx.restore();
      const pact = this.choices[this.idx];
      drawText(ctx, "Take this Pact?", W / 2, padY + 18, {
        size: 26, color: COLORS.bone, align: "center", bold: true, glow: COLORS.blood,
      });
      if (pact) {
        drawText(ctx, pact.name, W / 2, padY + 48, {
          size: 17, color: COLORS.bile, align: "center", bold: true, maxWidth: 420,
        });
      }
      const yes = { x: padX, y: padY + 58, w: 200, h: 44 };
      const no = { x: padX + 240, y: padY + 58, w: 200, h: 44 };
      drawPanel(ctx, yes.x, yes.y, yes.w, yes.h);
      drawPanel(ctx, no.x, no.y, no.w, no.h);
      drawText(ctx, "YES — SEAL IT", yes.x + yes.w / 2, yes.y + yes.h / 2, {
        size: 18, color: "#b5f05a", align: "center", baseline: "middle", bold: true,
      });
      drawText(ctx, "KEEP CHOOSING", no.x + no.w / 2, no.y + no.h / 2, {
        size: 18, color: COLORS.bone, align: "center", baseline: "middle", bold: true,
      });
    } else {
      const blink = Math.sin(this.t * 5) > 0;
      drawText(ctx, "[LEFT/RIGHT] choose card · click twice same card · [SPACE] confirm",
        W / 2, H - 48, {
        size: 15, color: COLORS.boneDim, align: "center",
      });
      if (blink) {
        drawText(ctx, ">> SELECT, THEN CONFIRM <<", W / 2, H - 22, {
          size: 17, color: COLORS.bile, align: "center", bold: true,
        });
      }
    }
  }

  drawCard(ctx, pact, x, y, w, h, selected, chosen, num, pactRanks, opts = {}) {
    const compact = !!opts.compact;
    const cur = (pactRanks && pactRanks[pact.id]) || 0;
    const nextRank = Math.min(3, cur + 1);
    const vis = getPactCardVisual(pact.id);
    const t = this.t;
    const pop = (selected && !chosen) ? 1 + 0.018 * Math.sin(t * 5.5) : 1;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(x + w / 2), -(y + h / 2));

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

    const sweep = ctx.createLinearGradient(x, y, x + w * 1.1, y + h * 0.35);
    const swA = 0.07 + 0.06 * Math.sin(t * 2.8);
    sweep.addColorStop(0, `rgba(255,255,255,${swA})`);
    sweep.addColorStop(0.45, "rgba(255,255,255,0)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 9);
    ctx.fill();

    const sh = ctx.createLinearGradient(x, y, x, y + 52);
    sh.addColorStop(0, vis.primary + "55");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    roundRect(ctx, x + 2, y + 2, w - 4, 44, 8);
    ctx.fill();

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

    ctx.save();
    ctx.fillStyle = "#0a0610";
    roundRect(ctx, x + 10, y + 10, 44, 36, 4);
    ctx.fill();
    ctx.strokeStyle = vis.border;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 10.5, y + 10.5, 43, 35, 4);
    ctx.stroke();
    drawText(ctx, String(num), x + 32, y + 28, {
      size: compact ? 18 : 24, bold: true, color: vis.glow, align: "center", baseline: "middle",
      shadow: false,
    });
    ctx.restore();

    const textMax = w - 36;
    const nmSz = compact ? 19 : 28;
    const blurbSz = compact ? 14 : 17;
    const rankSz = compact ? 13 : 15;
    const bodySz = compact ? 14 : 16;
    const bodyGap = compact ? 17 : 23;
    drawText(ctx, pact.name, x + w / 2, y + (compact ? 34 : 42), {
      size: nmSz, bold: true, color: selected ? vis.glow : COLORS.bone,
      align: "center", glow: selected ? vis.primary : null,
      maxWidth: textMax,
    });
    drawText(ctx, pact.blurb, x + w / 2, y + (compact ? 54 : 78), {
      size: blurbSz, color: COLORS.boneDim, align: "center",
      maxWidth: textMax,
    });
    if (cur > 0) {
      drawText(ctx, `▲ RANK UP → ${nextRank}/3`, x + w / 2, y + (compact ? 72 : 102), {
        size: rankSz, color: vis.primary, align: "center", bold: true,
        maxWidth: textMax,
      });
    }

    const sealY = y + (compact ? 128 : 210);
    const sealR = compact ? 40 : 62;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(x + w / 2, sealY, sealR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = vis.border;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    drawPactSigil(ctx, x + w / 2, sealY, pact.id, t, { scale: compact ? 0.72 : 1.08, selected: selected || chosen });

    const rowsY = y + h - (compact ? 118 : 248);
    const rowMax = w - 28;
    drawText(ctx, "▶ BUFF", x + 14, rowsY, { size: bodySz, color: "#7fff9a", bold: true });
    pact.pros.forEach((line, i) => {
      drawText(ctx, "» " + line, x + 14, rowsY + bodyGap + i * (bodyGap + 1), {
        size: bodySz, color: "#b5f05a", maxWidth: rowMax,
      });
    });
    const cy = rowsY + bodyGap + pact.pros.length * (bodyGap + 1) + 8;
    drawText(ctx, "▼ DEBT", x + 14, cy, { size: bodySz, color: "#ff7a7a", bold: true });
    pact.cons.forEach((line, i) => {
      drawText(ctx, "« " + line, x + 14, cy + bodyGap + i * (bodyGap + 1), {
        size: bodySz, color: "#ffaaaa", maxWidth: rowMax,
      });
    });
  }
}
