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

    // One outer panel containing all four numbered steps in a 2x2 grid.
    const panelX = 60, panelY = 130, panelW = W - 120, panelH = H - 220;
    drawPanel(ctx, panelX, panelY, panelW, panelH);

    const gapX = 24;
    const gapY = 18;
    const colW = (panelW - gapX * 3) / 2;
    const rowH = (panelH - gapY * 3) / 2;
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
                     ""],
      ["ACTIONS",    "[1] Attack   [2] Special (MP)   [3] Dodge Roll (+MP)",
                     "[4] Brace - time it LATE for +50% COUNTER bonus!"],
      ["TELLS",      "RED = Jab (dodge lane)  ORANGE = Heavy Slam (BRACE)",
                     "YELLOW = Triple Combo (brace covers all 3 hits)"],
      ["ENRAGE",     "Below 50% HP enemies ENRAGE: faster, harder, deadlier.",
                     "Stay mobile and time your braces."],
    ], { accent: "#ff9070" });

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
    });

    // Body rows - a small left-column "label" followed by wrapped description.
    const bodyY = y + 58;
    const rowStep = Math.max(42, Math.floor((h - 64) / Math.max(1, rows.length)));
    for (let i = 0; i < rows.length; i++) {
      const [label, l1, l2] = rows[i];
      const ry = bodyY + i * rowStep;
      if (label) {
        drawText(ctx, label, x + 16, ry, {
          size: 13, color: COLORS.bone, bold: true,
        });
      }
      const tx = x + 16 + (label ? 128 : 0);
      if (l1) {
        drawText(ctx, l1, tx, ry, {
          size: 13, color: COLORS.bone,
        });
      }
      if (l2) {
        drawText(ctx, l2, tx, ry + 18, {
          size: 13, color: COLORS.boneDim,
        });
      }
    }
  }
}
