import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawPanel, drawBanner, roundRect, wrapText, drawBar,
  drawAcid, drawHero, drawSphere, shade,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { pointInRect } from "../engine/pointer.js";
import { drawRunIdentityStrip } from "../engine/runHud.js";
import { drawPactSigil } from "../engine/pactSigils.js";

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

  drawAcidInRect(ctx, rx, ry, rw, rh, t, frac01) {
    const level = Math.max(0, Math.min(1, frac01));
    if (level <= 0) return;
    // drawAcid is tied to global canvas coords (W/H). Translate so the
    // rect bottom aligns with canvas bottom, then clip to the rect.
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, rx, ry, rw, rh, 10);
    ctx.clip();
    ctx.translate(0, (ry + rh) - H);
    drawAcid(ctx, t, (rh * level) / H);
    ctx.restore();
  }

  drawMiniBackdrop(ctx, rx, ry, rw, rh, tint = 1) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, rx, ry, rw, rh, 10);
    ctx.clip();
    const g = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    g.addColorStop(0, shade(COLORS.wormDeep, 0.95 * tint));
    g.addColorStop(0.45, shade(COLORS.worm, 0.95 * tint));
    g.addColorStop(1, shade(COLORS.ink, 1));
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
    // Subtle bruises/bump highlights like the real backdrop.
    for (let i = 0; i < 5; i++) {
      const cx = rx + (0.15 + i * 0.2) * rw;
      const cy = ry + (0.25 + (i % 2) * 0.22) * rh;
      const rr = 70 + i * 14;
      const gg = ctx.createRadialGradient(cx - 10, cy - 10, 2, cx, cy, rr);
      gg.addColorStop(0, "rgba(210, 107, 223, 0.16)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFakeTitle(ctx, ix, iy0, iw, ih, pulse) {
    const rx = ix + 14, ry = iy0 + 10, rw = iw - 28, rh = ih - 20;
    this.drawMiniBackdrop(ctx, rx, ry, rw, rh, 1.03);
    // Title banners (real style).
    drawBanner(ctx, "GUTS & GLORY", ix + iw / 2, ry + 54, 24, COLORS.bile, COLORS.blood);
    drawBanner(ctx, "escape the purple worm", ix + iw / 2, ry + 84, 12, COLORS.bone, COLORS.worm);

    // Story panel + tutorial button + acid at bottom.
    const px = rx + 18, py = ry + 110, pw = rw - 36, ph = rh - 190;
    drawPanel(ctx, px, py, pw, ph);
    for (let i = 0; i < 6; i++) {
      const alpha = 0.18 + (i / 6) * 0.24;
      ctx.fillStyle = `rgba(233,220,193,${alpha})`;
      const lw = pw - 40 - i * 14;
      ctx.fillRect(px + 20, py + 26 + i * 18, lw, 5);
    }
    const bW = 240, bH = 32;
    const bx = ix + (iw - bW) / 2, by = ry + rh - 112;
    roundRect(ctx, bx, by, bW, bH, 10);
    ctx.fillStyle = "rgba(26,18,62,0.9)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, "GUIDED TUTORIAL", bx + bW / 2, by + bH / 2, {
      size: 12, color: "#fffefb", align: "center", baseline: "middle", bold: true,
    });
    this.drawAcidInRect(ctx, rx, ry, rw, rh, this.t, 0.18 + pulse * 0.03);
  }

  drawFakeMeta(ctx, ix, iy0, iw, ih, pulse) {
    const rx = ix + 14, ry = iy0 + 10, rw = iw - 28, rh = ih - 20;
    this.drawMiniBackdrop(ctx, rx, ry, rw, rh, 1.0);
    const px = rx + 18, py = ry + 86, pw = rw - 36, ph = rh - 170;
    drawPanel(ctx, px, py, pw, ph);
    drawText(ctx, "TOP RUN:  4120  [A]", px + 18, py + 18, { size: 11, color: COLORS.gold, bold: true });
    drawText(ctx, "UNLOCKS:  4/10", px + 18, py + 38, { size: 10, color: COLORS.boneDim });
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "rgba(233,220,193,0.24)";
      ctx.fillRect(px + 18, py + 62 + i * 16, pw - 40 - i * 10, 4);
    }
    // Codex button (real placement vibe).
    const cx = rx + rw - 110, cy = ry + rh - 66;
    roundRect(ctx, cx - 78, cy, 156, 32, 8);
    ctx.fillStyle = "rgba(26,18,62,0.82)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, "INNER GUTS CODEX", cx, cy + 17, { size: 10, color: "#fffefb", align: "center", bold: true });
    // Acid lip at bottom.
    this.drawAcidInRect(ctx, rx, ry, rw, rh, this.t, 0.14 + pulse * 0.02);
  }

  drawFakeForge(ctx, ix, iy0, iw, ih, pulse) {
    const rx = ix + 14, ry = iy0 + 10, rw = iw - 28, rh = ih - 20;
    this.drawMiniBackdrop(ctx, rx, ry, rw, rh, 1.0);
    drawBanner(ctx, "FORGE YOUR HERO", ix + iw / 2, ry + 32, 16, COLORS.bile, COLORS.blood);

    // Difficulty row (more like the real forge chips).
    const rowY = ry + 56;
    const bw = 74, gap = 6, x0 = ix + (iw - (bw * 4 + gap * 3)) / 2;
    for (let i = 0; i < 4; i++) {
      const on = i === 0;
      const x = x0 + i * (bw + gap);
      roundRect(ctx, x, rowY, bw, 20, 6);
      ctx.fillStyle = on ? "rgba(60,40,10,0.88)" : "rgba(18,12,28,0.78)";
      ctx.fill();
      ctx.strokeStyle = on ? COLORS.gold : COLORS.bileGlow;
      ctx.lineWidth = on ? 2.2 : 1.2;
      ctx.stroke();
    }

    // Class cards with tiny hero art using drawHero.
    const cardW = 98, cardH = 176, cGap = 12;
    const cx0 = ix + (iw - (cardW * 3 + cGap * 2)) / 2;
    const cTop = rowY + 30;
    for (let k = 0; k < 3; k++) {
      const x = cx0 + k * (cardW + cGap);
      const center = k === 1;
      ctx.save();
      ctx.globalAlpha = center ? 1 : 0.75;
      roundRect(ctx, x, cTop, cardW, cardH, 10);
      const g = ctx.createLinearGradient(x, cTop, x, cTop + cardH);
      g.addColorStop(0, center ? "rgba(40,14,50,0.95)" : "rgba(14,5,20,0.85)");
      g.addColorStop(1, "rgba(6,2,10,0.95)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = center ? COLORS.gold : COLORS.bileGlow;
      ctx.lineWidth = center ? 2.8 : 1.4;
      ctx.stroke();
      ctx.restore();
      drawText(ctx, center ? "SWIFTFOOT" : "…", x + cardW / 2, cTop + 18, {
        size: 10, color: COLORS.bone, align: "center", bold: center,
      });
      ctx.save();
      ctx.translate(x + cardW / 2, cTop + 92);
      ctx.scale(2.1, 2.1);
      drawHero(ctx, 0, 0, 1, this.t * 2.5, center ? "swift" : "iron", null, "sword");
      ctx.restore();
    }

    drawText(ctx, "wheel cards · weapon step next", ix + iw / 2, ry + rh - 18, {
      size: 10, color: COLORS.boneDim, align: "center",
    });
  }

  drawFakeClimb(ctx, ix, iy0, iw, ih, pulse) {
    const rx = ix + 14, ry = iy0 + 10, rw = iw - 28, rh = ih - 20;
    this.drawMiniBackdrop(ctx, rx, ry, rw, rh, 1.0);

    // Wall columns (closer to climb.js look: cylinder + holds).
    const cols = 5;
    const colW = rw / cols;
    const arenaTop = ry + 44;
    for (let c = 0; c < cols; c++) {
      const x = rx + c * colW + colW * 0.5;
      const cg = ctx.createLinearGradient(x - 24, 0, x + 24, 0);
      cg.addColorStop(0, "rgba(210,130,240,0.04)");
      cg.addColorStop(0.5, "rgba(210,130,240,0.12)");
      cg.addColorStop(1, "rgba(0,0,0,0.10)");
      ctx.fillStyle = cg;
      ctx.fillRect(x - 24, arenaTop, 48, rh - 84);
      for (let j = 0; j < 6; j++) {
        const yy = arenaTop + 18 + j * 44 + ((this.t * 50 + c * 23) % 38);
        if (yy > ry + rh - 90) continue;
        const grd = ctx.createRadialGradient(x - 6, yy - 4, 2, x, yy, 16);
        grd.addColorStop(0, "rgba(210,107,223,0.35)");
        grd.addColorStop(1, "rgba(60,20,80,0.35)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(x, yy, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Telegraph wedges, boulder, pustule.
    const tx = rx + colW * 1.5;
    ctx.fillStyle = `rgba(255,70,70,${0.35 + pulse * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(tx, ry + 2);
    ctx.lineTo(tx + 18, ry + 64);
    ctx.lineTo(tx - 18, ry + 64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,217,102,${0.28 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(tx + colW * 2.15, ry + 6);
    ctx.lineTo(tx + colW * 2.15 + 14, ry + 56);
    ctx.lineTo(tx + colW * 2.15 - 14, ry + 56);
    ctx.closePath();
    ctx.fill();
    // Boulder (sphere-ish rock)
    drawSphere(ctx, rx + colW * 0.55, ry + 56, 18, "#4a4036", {
      highlight: "rgba(255,255,255,0.35)",
      rim: "rgba(220,220,240,0.18)",
      outline: "rgba(0,0,0,0.7)",
    });
    // Pustule
    ctx.fillStyle = "rgba(110,255,90,0.7)";
    ctx.beginPath();
    ctx.ellipse(rx + colW * 2.5, ry + 128, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(35, 95, 28, 0.95)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Hero (real drawHero) + bile.
    ctx.save();
    ctx.translate(rx + colW * 2.5, ry + rh - 118);
    ctx.scale(2.4, 2.4);
    drawHero(ctx, 0, 0, 1, this.t * 6, "swift", null, "sword");
    ctx.restore();
    this.drawAcidInRect(ctx, rx, ry, rw, rh, this.t, 0.26 + pulse * 0.03);
  }

  drawFakeCombat(ctx, ix, iy0, iw, ih, pulse) {
    const rx = ix + 14, ry = iy0 + 10, rw = iw - 28, rh = ih - 20;
    this.drawMiniBackdrop(ctx, rx, ry, rw, rh, 0.95);
    // Use the real identity strip renderer with a fake player.
    const fakeP = {
      buildId: "swift",
      build: { name: "SWIFTFOOT" },
      loadoutId: "sword",
      surfaceLoadoutName: "SWORD",
      pacts: ["tide_watcher", "ring_forger", "pact_of_vipers"],
      pactRanks: { tide_watcher: 2, ring_forger: 1, pact_of_vipers: 1 },
    };
    const bottom = drawRunIdentityStrip(ctx, fakeP, ry + 8);
    const barTop = bottom + 8;
    drawBar(ctx, rx + 10, barTop, 200, 14, 0.78, { fill: COLORS.blood, label: "HP", labelColor: "#111" });
    drawBar(ctx, rx + 10, barTop + 18, 200, 14, 0.58, { fill: COLORS.mana, label: "MP", labelColor: "#111" });
    drawBar(ctx, rx + 10, barTop + 36, 200, 14, 0.44, { fill: COLORS.bile, label: "ACID", labelColor: "#111" });

    // Enemy HUD panel (combat-style).
    drawPanel(ctx, rx + rw - 210, ry + 8, 196, 56);
    drawText(ctx, "SPHINCTER GUARDIAN", rx + rw - 112, ry + 24, {
      size: 11, color: COLORS.bile, align: "center", bold: true, maxWidth: 186,
    });
    drawBar(ctx, rx + rw - 200, ry + 40, 176, 14, 0.68, { fill: "#4a1010", label: "", labelColor: "#111" });

    // Lanes + hero + enemy using real hero renderer (scaled).
    const arenaTop = ry + 128;
    const laneW = (rw - 24) / 5;
    for (let L = 0; L < 5; L++) {
      const ax = rx + 12 + L * laneW;
      ctx.fillStyle = L === 2 ? "rgba(155,255,102,0.06)" : "rgba(40,20,50,0.18)";
      ctx.fillRect(ax + 2, arenaTop, laneW - 4, 112);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(ax + 2, arenaTop, laneW - 4, 112);
    }
    ctx.save();
    ctx.translate(rx + rw * 0.35, arenaTop + 92);
    ctx.scale(2.2, 2.2);
    drawHero(ctx, 0, 0, 1, this.t * 6, "swift", null, "sword");
    ctx.restore();
    drawSphere(ctx, rx + rw * 0.72, arenaTop + 86, 20, COLORS.blood, {
      highlight: "rgba(255,200,200,0.75)",
      rim: "rgba(255,120,120,0.35)",
      outline: "rgba(40,0,0,0.7)",
    });
  }

  drawFakePacts(ctx, ix, iy0, iw, ih, pulse) {
    const rx = ix + 14, ry = iy0 + 10, rw = iw - 28, rh = ih - 20;
    this.drawMiniBackdrop(ctx, rx, ry, rw, rh, 1.0);
    drawBanner(ctx, "SEAL A PACT", ix + iw / 2, ry + 30, 16, COLORS.bile, COLORS.blood);

    const ids = ["tide_watcher", "ring_forger", "pact_of_vipers"];
    const cardW = 106, cardH = rh - 76, gap = 14;
    const x0 = ix + (iw - (cardW * 3 + gap * 2)) / 2;
    const cTop = ry + 52;
    for (let k = 0; k < 3; k++) {
      const x = x0 + k * (cardW + gap);
      const sel = k === 1;
      roundRect(ctx, x, cTop, cardW, cardH, 10);
      const g = ctx.createLinearGradient(x, cTop, x, cTop + cardH);
      g.addColorStop(0, sel ? "rgba(40,14,50,0.95)" : "rgba(14,5,20,0.88)");
      g.addColorStop(1, "rgba(6,2,10,0.95)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = sel ? COLORS.gold : "rgba(155,255,102,0.22)";
      ctx.lineWidth = sel ? 2.8 : 1.2;
      ctx.stroke();

      drawText(ctx, "PACT", x + cardW / 2, cTop + 16, {
        size: 11, color: sel ? COLORS.bile : COLORS.boneDim, align: "center", bold: true,
      });
      drawText(ctx, sel ? "rank II" : "rank I", x + cardW / 2, cTop + 34, {
        size: 10, color: COLORS.boneDim, align: "center",
      });
      // Real sigil art
      drawPactSigil(ctx, x + cardW / 2, cTop + Math.floor(cardH * 0.55), ids[k], this.t, {
        scale: 0.85,
        selected: sel,
      });
      // Buff/debt line placeholders
      const yy = cTop + cardH - 54;
      drawText(ctx, "▶ BUFF", x + 12, yy, { size: 10, color: "#7fff9a", bold: true });
      ctx.fillStyle = "rgba(181,240,90,0.25)";
      ctx.fillRect(x + 12, yy + 14, cardW - 24, 6);
      drawText(ctx, "▼ DEBT", x + 12, yy + 26, { size: 10, color: "#ff7a7a", bold: true });
      ctx.fillStyle = "rgba(255,170,170,0.22)";
      ctx.fillRect(x + 12, yy + 40, cardW - 24, 6);
    }
    drawText(ctx, "bigger text + clear sigils", ix + iw / 2, ry + rh - 12, {
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
