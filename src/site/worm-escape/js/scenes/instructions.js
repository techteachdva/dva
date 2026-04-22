import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CreateScene } from "./create.js";

// v0.11 - One-page gameplay briefing shown right after the intro story and
// before character creation. Designed to fit inside the 1280x800 canvas
// without scrolling so first-timers can take it in at a glance.
export class InstructionsScene {
  constructor() {
    this.t = 0;
  }

  enter() {
    this.t = 0;
    SFX.click();
  }

  update(dt, game) {
    this.t += dt;
    if (game.input.wasPressed(" ", "Space", "Enter")) {
      SFX.confirm();
      game.scenes.replace(new CreateScene(), game);
    }
  }

  render(ctx, game) {
    drawFleshBackground(ctx, this.t, 1.0);
    drawVeins(ctx, this.t, 1);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "HOW TO ESCAPE A WORM", W / 2, 60, 44, COLORS.bile, COLORS.blood);
    drawText(ctx, "A survival guide for freshly-swallowed heroes", W / 2, 104, {
      size: 14, color: COLORS.bone, align: "center",
    });

    // One outer panel containing all four numbered steps in a 2x2 grid,
    // plus a v0.12 strip beneath covering Pacts & Elites.
    const panelX = 60, panelY = 130, panelW = W - 120, panelH = H - 220;
    drawPanel(ctx, panelX, panelY, panelW, panelH);

    const gapX = 24;
    const gapY = 16;
    const stripH = 100;          // v0.12 "Pacts & Elites" micro-card height
    const gridH = panelH - stripH - gapY * 4;
    const colW = (panelW - gapX * 3) / 2;
    const rowH = gridH / 2;
    const x1 = panelX + gapX;
    const x2 = panelX + gapX * 2 + colW;
    const y1 = panelY + gapY;
    const y2 = panelY + gapY * 2 + rowH;

    this.drawStep(ctx, 1, "CHOOSE YOUR ADVENTURER", x1, y1, colW, rowH, [
      ["SWIFTFOOT", "Fast hops, light armor. Dodges debris easily,",
                    "but the bile bites hard."],
      ["IRONHIDE",  "Slow hops, heavy armor + TANK pips. Shrugs off",
                    "hits; don't count on speed."],
      ["",          "The character select screen shows full stats:",
                    "HP, MP, armor, climb speed, and cooldowns."],
    ], { accent: COLORS.bile });

    this.drawStep(ctx, 2, "CHOOSE YOUR WEAPON", x2, y1, colW, rowH, [
      ["SWORD / HAMMER",      "Melee. Hammer hits harder but cools slower.",
                              ""],
      ["STAFF / FROST WAND",  "Magic. Uses MP but ranges far; frost also slows",
                              "enemy tells."],
      ["MATCHUPS",            "Each weapon is STRONG vs one enemy type and",
                              "WEAK vs another - shown on the weapon card."],
    ], { accent: COLORS.gold });

    this.drawStep(ctx, 3, "CLIMB YOUR WAY OUT", x1, y2, colW, rowH, [
      ["GOAL",     "Climb to 100% before the rising BILE drowns you.",
                   ""],
      ["CONTROLS", "[UP/W] climb   [DOWN/S] brace   [P/ESC] pause",
                   "[LEFT/RIGHT] or [A/D] hop ONE column (5 total)"],
      ["HAZARDS",  "Rocks/bones (armor soaks), daggers/swords (pierce HP),",
                   "maces (hit armor, STUN if bare), meat (bounces)."],
      ["POWER-UPS","GOLD telegraphs = catch them! Feather (climb boost),",
                   "Cheeseburger (heal HP), Ring of Armor (RARE!)"],
    ], { accent: "#b5f05a" });

    this.drawStep(ctx, 4, "FIGHT TO ESCAPE", x2, y2, colW, rowH, [
      ["GOAL",       "Kill the SPHINCTER GUARDIAN to unlock the next chamber.",
                     "Final chamber: the WORM'S TONGUE (mouse-aim puzzle)."],
      ["ACTIONS",    "[Q/1] Attack  [E/2] Special (MP)  [R/3] Dodge (+MP)",
                     "[F/4] Brace - time it LATE for +50% COUNTER bonus!"],
      ["TELLS",      "RED = Jab (dodge lane)  ORANGE = Heavy Slam (BRACE)",
                     "YELLOW = Triple Combo (brace covers all 3 hits)"],
      ["THE MAW",    "Use the MOUSE to aim a reticle inside the GREEN circle.",
                     "Attacks only land when LOCKED. Dodge the RED lash zones."],
    ], { accent: "#ff9070" });

    // v0.12 micro-card: Pacts & Elites strip
    const stripX = x1;
    const stripY = y2 + rowH + gapY;
    const stripW = panelW - gapX * 2;
    this.drawPactElitesStrip(ctx, stripX, stripY, stripW, stripH);

    // Footer prompt - blinks to draw the eye
    const blink = Math.sin(this.t * 5) > 0;
    if (blink) {
      drawText(ctx, ">> PRESS SPACE TO FORGE YOUR HERO <<", W / 2, H - 60, {
        size: 22, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
      });
    }
    drawText(ctx, "Tip: press [M] at any time to mute music and sound.",
      W / 2, H - 28, {
      size: 13, color: COLORS.boneDim, align: "center",
    });
  }

  // v0.12 addendum strip: new systems (Pacts, Elites) and meta-progression.
  drawPactElitesStrip(ctx, x, y, w, h) {
    const accent = "#ffd966"; // gold
    ctx.save();
    ctx.fillStyle = "rgba(30, 18, 8, 0.65)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Numbered badge
    ctx.save();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + 26, y + h / 2, 18, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, "5", x + 26, y + h / 2, {
      size: 22, color: "#0a0410", bold: true, align: "center", baseline: "middle",
      shadow: false,
    });
    ctx.restore();

    drawText(ctx, "PACTS & ELITES", x + 56, y + 10, {
      size: 18, color: accent, bold: true, glow: accent,
    });
    drawText(ctx, "replay-shaping twists", x + 56, y + 32, {
      size: 11, color: COLORS.boneDim,
    });

    // Three columns of bite-sized info.
    const col1 = x + 56;
    const col2 = x + Math.floor(w * 0.42);
    const col3 = x + Math.floor(w * 0.72);

    drawText(ctx, "PACTS", col1, y + 54, {
      size: 13, color: COLORS.bone, bold: true,
    });
    drawText(ctx, "After each boss, pick 1 of 3 (or 4)", col1, y + 72, {
      size: 12, color: COLORS.bone,
    });
    drawText(ctx, "tradeoff cards. Pros AND cons.", col1, y + 86, {
      size: 12, color: COLORS.boneDim,
    });

    drawText(ctx, "ELITES", col2, y + 54, {
      size: 13, color: accent, bold: true,
    });
    drawText(ctx, "Gold-ringed bosses: +HP/DMG, unique", col2, y + 72, {
      size: 12, color: COLORS.bone,
    });
    drawText(ctx, "twists. FANGED/SHIELDED/HEX/BLOATED", col2, y + 86, {
      size: 12, color: COLORS.boneDim,
    });

    drawText(ctx, "UNLOCKS", col3, y + 54, {
      size: 13, color: COLORS.bile, bold: true,
    });
    drawText(ctx, "Scores save to localStorage.", col3, y + 72, {
      size: 12, color: COLORS.bone,
    });
    drawText(ctx, "New builds/weapons unlock by play.", col3, y + 86, {
      size: 12, color: COLORS.boneDim,
    });
  }

  // Individual step card. `rows` is an array of [label, ...text-lines].
  drawStep(ctx, num, title, x, y, w, h, rows, opts = {}) {
    const accent = opts.accent || COLORS.bile;

    // Inner frame
    ctx.save();
    ctx.fillStyle = "rgba(10, 6, 22, 0.55)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Numbered badge
    ctx.save();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + 26, y + 26, 18, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, String(num), x + 26, y + 26, {
      size: 22, color: "#0a0410", bold: true, align: "center", baseline: "middle",
      shadow: false,
    });
    ctx.restore();

    // Title
    drawText(ctx, title, x + 56, y + 18, {
      size: 20, color: accent, bold: true, glow: accent,
      maxWidth: w - 72,
    });

    // Body rows - a small left-column "label" followed by wrapped description.
    const bodyY = y + 58;
    const rowStep = Math.max(42, Math.floor((h - 64) / Math.max(1, rows.length)));
    const labelW = 120;
    for (let i = 0; i < rows.length; i++) {
      const [label, l1, l2] = rows[i];
      const ry = bodyY + i * rowStep;
      if (label) {
        drawText(ctx, label, x + 16, ry, {
          size: 13, color: COLORS.bone, bold: true,
          maxWidth: labelW - 4,
        });
      }
      const tx = x + 16 + (label ? labelW + 8 : 0);
      const tw = w - (tx - x) - 14;
      if (l1) {
        drawText(ctx, l1, tx, ry, {
          size: 13, color: COLORS.bone, maxWidth: tw,
        });
      }
      if (l2) {
        drawText(ctx, l2, tx, ry + 18, {
          size: 13, color: COLORS.boneDim, maxWidth: tw,
        });
      }
    }
  }
}
