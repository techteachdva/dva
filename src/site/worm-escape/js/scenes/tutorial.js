import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawPanel, drawBanner, roundRect, wrapText, drawBar,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { pointInRect } from "../engine/pointer.js";

const STEPS = [
  {
    title: "Welcome, escape artist",
    lines: [
      "Guts & Glory is a short roguelike run: you climb, you brawl sphincter guardians, you seal pacts, and you try to leap out of the worm alive.",
      "The right-hand preview sketches each real screen. Use NEXT / BACK or click the buttons. ESC exits.",
    ],
  },
  {
    title: "Title & meta",
    lines: [
      "The story panel sets the tone. SPACE skips the crawl; SPACE again opens the Forge (after the instructions interstitial).",
      "Codex (cheat dossiers) stays on the title screen. Difficulty and Endless live on the Forge — pick them before you confirm your hero.",
    ],
  },
  {
    title: "The Forge — class & weapon",
    lines: [
      "STEP 1: spin the three-card build wheel (A/D or click flanks). Center card confirms into STEP 2.",
      "STEP 2: pick a weapon from three offers. One reroll (R or Tab) if you do not like the row. Synergy titles glow when class + weapon match.",
      "STEP 3: confirm the summary, then SPACE plunges you into the first climb. Endless (if unlocked) must be toggled on the Forge before you launch.",
    ],
  },
  {
    title: "Climb — columns & bile",
    lines: [
      "Five columns: A/D or click the wall to hop. Hold UP / W or click above your hero to climb; DOWN / S or lower click braces (no slip).",
      "Red telegraphs warn of hazards; gold telegraphs are pickups. Rising bile from the bottom is the hard clock — stay above the surface.",
      "Boulders jam a column; green pustules pop into venom through armor. As you climb, the hero sits higher on screen.",
    ],
  },
  {
    title: "Combat — lanes & acid",
    lines: [
      "Fights use five lanes like the climb. Basic and special attacks spend mana; armor soaks chip damage depending on your class.",
      "Watch the acid timer in the UI — when it empties, the air eats you. Enemy name + matchup hints sit top-right.",
      "Top-left summarizes CLASS, WEAPON, and sealed PACTS next to your bars.",
    ],
  },
  {
    title: "Pacts — between chambers",
    lines: [
      "After each guardian you choose one of three pact cards (unless a cheat changes the offer). Ranks stack up to III.",
      "Read names carefully — they redefine damage, survival, and climb pacing for the rest of the run.",
    ],
  },
  {
    title: "Bosses & finale",
    lines: [
      "Standard guardians are lane brawlers with telegraphed acid gouts. Elites add twists; the final maw mixes climb pressure with a tooth mini-game.",
      "Endless mode nests another worm after victory — palettes shift and danger escalates each lap.",
    ],
  },
  {
    title: "Scoring & cheats",
    lines: [
      "The victory tally rewards clean climbs, pact diversity, and speed. Cheats (backslash terminal) log into the Codex when discovered.",
      "Tester tip: cheat dealz expands pact picks so you can preview every upgrade path quickly.",
    ],
  },
];

const NEXT_BTN = { x: W / 2 + 8, y: H - 72, w: 200, h: 44 };
const BACK_BTN = { x: W / 2 - 208, y: H - 72, w: 200, h: 44 };

const PANEL = { x: 40, y: 118, w: W - 80, h: H - 212 };
const ILLUS = { w: 392, gap: 22 };

export class TutorialScene {
  constructor() {
    this.idx = 0;
    this.t = 0;
  }

  enter() {
    this.t = 0;
  }

  update(dt, game) {
    this.t += dt;
    if (game.input.wasPressed("Escape")) {
      SFX.click();
      game.scenes.pop(game);
      return;
    }
    const last = STEPS.length - 1;
    if (game.input.wasPressed("ArrowRight") || game.input.wasPressed("Enter")) {
      if (this.idx < last) {
        this.idx++;
        SFX.click();
      } else {
        SFX.confirm();
        game.scenes.pop(game);
      }
      return;
    }
    if (game.input.wasPressed("ArrowLeft")) {
      if (this.idx > 0) {
        this.idx--;
        SFX.click();
      }
      return;
    }
    if (!game.input.wasPressed("Mouse0")) return;
    const mx = game.input.mouseX, my = game.input.mouseY;
    if (pointInRect(mx, my, BACK_BTN.x, BACK_BTN.y, BACK_BTN.w, BACK_BTN.h)) {
      if (this.idx > 0) {
        this.idx--;
        SFX.click();
      } else SFX.deny();
      return;
    }
    if (pointInRect(mx, my, NEXT_BTN.x, NEXT_BTN.y, NEXT_BTN.w, NEXT_BTN.h)) {
      if (this.idx < last) {
        this.idx++;
        SFX.click();
      } else {
        SFX.confirm();
        game.scenes.pop(game);
      }
    }
  }

  /** Framed preview chrome; inner area y0..y0+h use for fake UI. */
  drawIllusFrame(ctx, ix, iy, iw, ih) {
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, 12);
    const g = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    g.addColorStop(0, "rgba(22,12,32,0.97)");
    g.addColorStop(1, "rgba(6,2,10,0.98)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(155,255,102,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, "SCREEN PREVIEW (not interactive)", ix + iw / 2, iy + 16, {
      size: 11, color: COLORS.boneDim, align: "center", italic: true,
    });
    ctx.restore();
    return iy + 34;
  }

  drawFakeTitle(ctx, ix, iy0, iw, ih, pulse) {
    const cy = iy0 + 8;
    drawBanner(ctx, "GUTS & GLORY", ix + iw / 2, cy + 18, 16, COLORS.bile, COLORS.blood);
    drawText(ctx, "escape the purple worm", ix + iw / 2, cy + 44, {
      size: 11, color: COLORS.boneDim, align: "center",
    });
    const px = ix + 28, py = cy + 58, pw = iw - 56, ph = ih - cy - 58 - 56;
    drawPanel(ctx, px, py, pw, ph);
    for (let i = 0; i < 5; i++) {
      const alpha = 0.25 + (i / 5) * 0.35;
      ctx.fillStyle = `rgba(233,220,193,${alpha})`;
      const lw = pw - 36 - i * 12;
      ctx.fillRect(px + 18, py + 22 + i * 14, lw, 4);
    }
    roundRect(ctx, ix + (iw - 220) / 2, iy0 + ih - 40, 220, 30, 8);
    ctx.fillStyle = "rgba(26,18,62,0.95)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawText(ctx, "GUIDED TUTORIAL", ix + iw / 2, iy0 + ih - 25, {
      size: 11, color: COLORS.bile, align: "center", bold: true,
    });
    drawText(ctx, "▼ bile / worm frame on real title ▼", ix + iw / 2, iy0 + ih - 6, {
      size: 9, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakeMeta(ctx, ix, iy0, iw, ih, pulse) {
    drawPanel(ctx, ix + 20, iy0 + 10, iw - 40, 120);
    drawText(ctx, "Story beats…", ix + 32, iy0 + 28, { size: 12, color: COLORS.bone, bold: true });
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(233,220,193,0.35)";
      ctx.fillRect(ix + 32, iy0 + 48 + i * 16, iw - 80 - i * 18, 5);
    }
    const cx = ix + iw - 100, cyy = iy0 + ih - 52;
    roundRect(ctx, cx - 70, cyy, 140, 36, 8);
    ctx.fillStyle = "rgba(26,18,62,0.9)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.stroke();
    drawText(ctx, "CODEX", cx, cyy + 20, { size: 11, color: COLORS.bone, align: "center", bold: true });
    drawText(ctx, "Difficulty row lives on FORGE next step →", ix + iw / 2, iy0 + 138, {
      size: 11, color: COLORS.gold, align: "center", maxWidth: iw - 24,
    });
    ctx.fillStyle = `rgba(155,255,102,${0.12 + pulse * 0.08})`;
    roundRect(ctx, ix + 24, iy0 + 158, iw - 48, 36, 8);
    ctx.fill();
    drawText(ctx, "[WORM] [GREAT] [ANCIENT] [ENDLESS]", ix + iw / 2, iy0 + 178, {
      size: 10, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakeForge(ctx, ix, iy0, iw, ih, pulse) {
    const rowY = iy0 + 16;
    const bw = 78, gap = 6, x0 = ix + (iw - (bw * 4 + gap * 3)) / 2;
    for (let i = 0; i < 4; i++) {
      const on = i === 0;
      const x = x0 + i * (bw + gap);
      roundRect(ctx, x, rowY, bw, 22, 5);
      ctx.fillStyle = on ? "rgba(80,55,20,0.9)" : "rgba(18,12,28,0.85)";
      ctx.fill();
      ctx.strokeStyle = on ? COLORS.gold : "rgba(155,255,102,0.25)";
      ctx.stroke();
    }
    drawText(ctx, "Forge difficulty strip", ix + iw / 2, rowY + 34, {
      size: 10, color: COLORS.boneDim, align: "center",
    });

    const cardW = 92, cardH = 168, cGap = 10;
    const cx0 = ix + (iw - (cardW * 3 + cGap * 2)) / 2;
    const cTop = rowY + 52;
    for (let k = 0; k < 3; k++) {
      const x = cx0 + k * (cardW + cGap);
      const center = k === 1;
      ctx.save();
      ctx.globalAlpha = center ? 1 : 0.72;
      roundRect(ctx, x, cTop, cardW, cardH, 8);
      const g = ctx.createLinearGradient(x, cTop, x, cTop + cardH);
      g.addColorStop(0, center ? "rgba(55,22,68,0.95)" : "rgba(28,10,38,0.9)");
      g.addColorStop(1, "rgba(8,2,12,0.95)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = center ? COLORS.gold : "rgba(155,255,102,0.2)";
      ctx.lineWidth = center ? 3 : 1.5;
      ctx.stroke();
      ctx.restore();
      drawText(ctx, center ? "CLASS" : "···", x + cardW / 2, cTop + 28, {
        size: center ? 12 : 10, color: COLORS.bone, align: "center", bold: center,
      });
      ctx.fillStyle = "rgba(240,200,160,0.35)";
      ctx.fillRect(x + 10, cTop + 48, cardW - 20, 56);
      drawText(ctx, k === 1 ? "★ pick ★" : "", x + cardW / 2, cTop + 118, {
        size: 9, color: COLORS.bile, align: "center",
      });
    }
    drawText(ctx, "3-card wheel · center confirms", ix + iw / 2, cTop + cardH + 18, {
      size: 11, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakeClimb(ctx, ix, iy0, iw, ih, pulse) {
    const pad = 16;
    const innerH = ih - 24;
    const bileH = Math.floor(innerH * 0.22);
    const topY = iy0 + ih - bileH;
    const g = ctx.createLinearGradient(ix + pad, topY, ix + pad, iy0 + ih);
    g.addColorStop(0, "rgba(60,180,40,0.15)");
    g.addColorStop(0.5, "rgba(120,220,60,0.45)");
    g.addColorStop(1, "rgba(200,255,80,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(ix + pad, topY, iw - pad * 2, bileH);

    const cols = 5;
    const colW = (iw - pad * 2) / cols;
    const hx = ix + pad + 2 * colW + colW * 0.5;
    const hy = topY - 42 + Math.sin(this.t * 2.2) * 3;
    for (let c = 0; c < cols; c++) {
      const x = ix + pad + c * colW + colW * 0.35;
      ctx.fillStyle = "rgba(210,130,240,0.12)";
      ctx.fillRect(x - 8, iy0 + 20, 16, topY - iy0 - 24);
      for (let j = 0; j < 4; j++) {
        const yy = iy0 + 36 + j * 34 + (this.t * 40 + c * 17) % 28;
        if (yy > topY - 20) continue;
        ctx.fillStyle = "rgba(200,120,220,0.5)";
        ctx.beginPath();
        ctx.ellipse(x, yy, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c === 2) {
        ctx.fillStyle = "rgba(110,255,90,0.75)";
        ctx.beginPath();
        ctx.ellipse(x, topY - 70, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2a6a18";
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#f0c88a";
    ctx.beginPath();
    ctx.arc(hx, hy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a3020";
    ctx.lineWidth = 2;
    ctx.stroke();

    const tx = ix + pad + colW * 1.5;
    ctx.fillStyle = `rgba(255,70,70,${0.45 + pulse * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(tx, iy0 + 28);
    ctx.lineTo(tx + 20, iy0 + 88);
    ctx.lineTo(tx - 20, iy0 + 88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,217,102,${0.35 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(tx + colW * 2.2, iy0 + 32);
    ctx.lineTo(tx + colW * 2.2 + 16, iy0 + 82);
    ctx.lineTo(tx + colW * 2.2 - 16, iy0 + 82);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(90,72,58,0.95)";
    ctx.beginPath();
    ctx.arc(ix + pad + colW * 0.5, iy0 + 52, 14, 0, Math.PI * 2);
    ctx.fill();

    drawText(ctx, "hero · telegraphs · pustule · bile", ix + iw / 2, iy0 + ih - 8, {
      size: 9, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakeCombat(ctx, ix, iy0, iw, ih, pulse) {
    const lx = ix + 18;
    let y = iy0 + 12;
    roundRect(ctx, lx, y, 168, 52, 6);
    ctx.fillStyle = "rgba(14,8,22,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(155,255,102,0.2)";
    ctx.stroke();
    drawText(ctx, "HERO", lx + 8, y + 8, { size: 9, color: COLORS.bile, bold: true });
    drawText(ctx, "CLASS · WEAPON", lx + 8, y + 22, { size: 9, color: COLORS.bone });
    drawText(ctx, "PACTS ···", lx + 8, y + 36, { size: 8, color: COLORS.boneDim });
    y += 58;
    drawBar(ctx, lx, y, 164, 12, 0.72, { fill: COLORS.blood, label: "HP", labelColor: "#111" });
    y += 18;
    drawBar(ctx, lx, y, 164, 12, 0.55, { fill: COLORS.mana, label: "MP", labelColor: "#111" });
    y += 18;
    drawBar(ctx, lx, y, 164, 12, 0.4, { fill: COLORS.bile, label: "ACID", labelColor: "#111" });

    const rx = ix + iw - 178;
    drawPanel(ctx, rx, iy0 + 12, 162, 56);
    drawText(ctx, "GUARDIAN", rx + 81, iy0 + 28, {
      size: 11, color: COLORS.bile, align: "center", bold: true,
    });
    drawBar(ctx, rx + 8, iy0 + 42, 146, 12, 0.65, {
      fill: "#4a1010", label: null,
    });

    const arenaTop = iy0 + 118;
    const laneW = (iw - 36) / 5;
    for (let L = 0; L < 5; L++) {
      const ax = ix + 18 + L * laneW;
      ctx.fillStyle = L === 2 ? "rgba(155,255,102,0.08)" : "rgba(40,20,50,0.25)";
      ctx.fillRect(ax + 2, arenaTop, laneW - 4, 100);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(ax + 2, arenaTop, laneW - 4, 100);
    }
    ctx.fillStyle = "#c21a1a";
    ctx.beginPath();
    ctx.arc(ix + iw / 2 + 40, arenaTop + 50, 18, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, "lanes · you · foe", ix + iw / 2, arenaTop + 108, {
      size: 10, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakePacts(ctx, ix, iy0, iw, ih, pulse) {
    const cardW = 100, cardH = ih - 36, gap = 14;
    const x0 = ix + (iw - (cardW * 3 + gap * 2)) / 2;
    const cTop = iy0 + 20;
    for (let k = 0; k < 3; k++) {
      const x = x0 + k * (cardW + gap);
      const sel = k === 1;
      roundRect(ctx, x, cTop, cardW, cardH, 10);
      ctx.fillStyle = sel ? "rgba(50,28,62,0.95)" : "rgba(20,10,28,0.9)";
      ctx.fill();
      ctx.strokeStyle = sel ? COLORS.gold : "rgba(155,255,102,0.22)";
      ctx.lineWidth = sel ? 2.5 : 1.2;
      ctx.stroke();
      drawText(ctx, "PACT", x + cardW / 2, cTop + 22, {
        size: 11, color: COLORS.bone, align: "center", bold: true,
      });
      drawText(ctx, "rank II", x + cardW / 2, cTop + 40, {
        size: 9, color: COLORS.bile, align: "center",
      });
      ctx.strokeStyle = `rgba(155,255,102,${0.35 + pulse * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + cardW / 2, cTop + cardH * 0.55, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(233,220,193,0.2)";
      for (let r = 0; r < 3; r++) {
        ctx.fillRect(x + 12, cTop + cardH - 52 + r * 14, cardW - 24, 6);
      }
    }
    drawText(ctx, "pick one · seals stack to III", ix + iw / 2, iy0 + ih - 6, {
      size: 10, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakeMaw(ctx, ix, iy0, iw, ih, pulse) {
    const cx = ix + iw / 2;
    const mouthY = iy0 + ih * 0.55;
    ctx.strokeStyle = "#f6ecd0";
    ctx.lineWidth = 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const fx = cx + side * (40 + i * 28);
        const fy = mouthY - 20 + i * 8;
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + side * 22, fy + 50);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const tx = cx - 56 + i * 28;
      ctx.fillStyle = i === 2 ? "rgba(255,100,100,0.85)" : "#f6ecd0";
      roundRect(ctx, tx, mouthY + 38, 20, 28, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    drawBanner(ctx, "THE MAW", cx, iy0 + 36, 14, COLORS.blood, COLORS.worm);
    drawText(ctx, "teeth · climb pressure · endless lap 2+", ix + iw / 2, iy0 + ih - 10, {
      size: 10, color: COLORS.boneDim, align: "center", maxWidth: iw - 16,
    });
  }

  drawFakeScore(ctx, ix, iy0, iw, ih, pulse) {
    const bx = ix + 24, by = iy0 + 24, bw = iw - 48, bh = ih - 40;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(155,255,102,0.3)";
    ctx.stroke();
    drawText(ctx, "VICTORY TALLY", bx + bw / 2, by + 18, {
      size: 13, color: COLORS.gold, align: "center", bold: true,
    });
    const lines = [
      "Chambers cleared … +1200",
      "Hitless bonus … +400",
      "Pact diversity … +200",
      "Time … +150",
    ];
    let ly = by + 42;
    for (const ln of lines) {
      drawText(ctx, ln, bx + 14, ly, { size: 11, color: COLORS.bone });
      ly += 20;
    }
    const tx = bx + 12, ty = by + bh - 62, tw = bw - 24, th = 44;
    roundRect(ctx, tx, ty, tw, th, 6);
    ctx.fillStyle = "rgba(10,14,22,0.95)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.stroke();
    drawText(ctx, "> dealz_ ", tx + 10, ty + 14, {
      size: 12, color: COLORS.bile, font: "mono",
    });
    drawText(ctx, "cheat terminal  ( \\ )  ·  Codex logs", tx + 10, ty + 30, {
      size: 9, color: COLORS.boneDim, font: "mono",
    });
  }

  drawIllustration(ctx) {
    const { x: px, y: py, w: pw, h: ph } = PANEL;
    const ix = px + pw - ILLUS.w - 20;
    const iy = py + 56;
    const iw = ILLUS.w;
    const ih = ph - 72;
    const innerTop = this.drawIllusFrame(ctx, ix, iy, iw, ih);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3.5);
    const innerH = iy + ih - innerTop - 8;

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, ix + 2, innerTop, iw - 4, innerH + 8, 10);
    ctx.clip();

    switch (this.idx) {
      case 0: this.drawFakeTitle(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 1: this.drawFakeMeta(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 2: this.drawFakeForge(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 3: this.drawFakeClimb(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 4: this.drawFakeCombat(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 5: this.drawFakePacts(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 6: this.drawFakeMaw(ctx, ix, innerTop, iw, innerH, pulse); break;
      case 7: this.drawFakeScore(ctx, ix, innerTop, iw, innerH, pulse); break;
      default: break;
    }
    ctx.restore();
  }

  render(ctx, game) {
    void game;
    drawBackdropCached(ctx, this.t * 0.4, this.t * 0.4, 1.02, null, 1);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "GUIDED TOUR", W / 2, 64, 38, COLORS.bile, COLORS.blood);
    drawText(ctx, `${this.idx + 1} / ${STEPS.length}`, W / 2, 108, {
      size: 14, color: COLORS.boneDim, align: "center",
    });

    const { x: panelX, y: panelY, w: panelW, h: panelH } = PANEL;
    drawPanel(ctx, panelX, panelY, panelW, panelH);

    const step = STEPS[this.idx];
    const textMaxW = panelW - ILLUS.w - ILLUS.gap - 40;

    drawText(ctx, step.title, panelX + 24, panelY + 22, {
      size: 24, color: COLORS.gold, bold: true, maxWidth: textMaxW + 20,
    });

    let y = panelY + 58;
    const bodySize = 16;
    for (const para of step.lines) {
      const lines = wrapText(ctx, para, textMaxW, bodySize, {});
      const lineGap = 5;
      for (const ln of lines) {
        drawText(ctx, ln, panelX + 24, y, { size: bodySize, color: COLORS.bone });
        y += bodySize + lineGap;
      }
      y += 10;
    }

    this.drawIllustration(ctx);

    const drawBtn = (b, label, dim) => {
      ctx.save();
      ctx.globalAlpha = dim ? 0.45 : 1;
      roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = "rgba(26,18,62,0.9)";
      ctx.fill();
      ctx.strokeStyle = COLORS.bileGlow;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      drawText(ctx, label, b.x + b.w / 2, b.y + b.h / 2, {
        size: 17, color: COLORS.bone, align: "center", baseline: "middle", bold: true,
      });
    };

    drawBtn(BACK_BTN, "BACK", this.idx === 0);
    drawBtn(
      NEXT_BTN,
      this.idx >= STEPS.length - 1 ? "DONE" : "NEXT",
      false,
    );

    drawText(ctx, "← / → keys · ENTER advances · ESC closes", W / 2, H - 22, {
      size: 13, color: COLORS.boneDim, align: "center",
    });
  }
}
