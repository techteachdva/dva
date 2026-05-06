import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { loadSave } from "../engine/storage.js";
import { InstructionsScene } from "./instructions.js";
import { EncyclopediaScene } from "./encyclopedia.js";
import { TutorialScene } from "./tutorial.js";
import { CreditsScene } from "./credits.js";
import { pointInRect } from "../engine/pointer.js";

// Total possible persistent unlocks - keep this in sync with DEFAULT_SAVE.unlocks.
// v0.16: viperBuild, wizardBuild, bileWhip, hexStaff, megaphone, boneSpear,
// blunderbuss, cursedScythe, rustyChainsaw, cat = 10
const UNLOCK_TOTAL = 11;
// Order kept matching DEFAULT_SAVE.unlocks (excluding the informational
// `anyElite` flag which is implied by hexStaff/rustyChainsaw).
const UNLOCK_KEYS = [
  "viperBuild", "wizardBuild", "bileWhip", "hexStaff",
  "megaphone", "boneSpear", "blunderbuss",
  "cursedScythe", "rustyChainsaw", "cat",
  "creditsUnlocked",
];

// Title screen Codex launcher (CHEATS shelf includes victory-unlocked dossiers).
const CODEX_BTN = { x: W - 308, y: H - 128, w: 288, h: 48 };
const CREDITS_BTN = { x: W - 308, y: H - 184, w: 288, h: 44 };

// Centered under the story panel — full-game guided tour.
const TUTORIAL_BTN = { x: (W - 320) / 2, y: 684, w: 320, h: 44 };

const STORY = [
  "Oh FART NUGGETS!",
  "",
  "You just got swallowed alive (and thankfully WHOLE) by a",
  "massive purple worm the size of a castle tower!",
  "",
  "Quick - climb your way out its gullet and JUMP OUT ITS MAW",
  "before its belly-acid turns you into adventurer-soup!",
  "",
  "The wall is slick. The debris is sharp. The teeth are hungry.",
  "Pack your courage, say a prayer, and maybe pick one good weapon.",
  "",
  "Press SPACE or ENTER to begin.",
];

export class IntroScene {
  constructor() {
    this.t = 0;
    this.reveal = 0;
    this.charSpeed = 44;
    this.pulse = 0;
  }

  enter() {
    this.t = 0;
    this.reveal = 0;
    this.save = loadSave();
  }

  update(dt, game) {
    this.t += dt;
    this.pulse += dt;
    const total = STORY.join("\n").length;

    const mx = game.input.mouseX, my = game.input.mouseY;
    const storyDone = this.reveal >= STORY.join("\n").length;

    if (game.input.wasPressed("Mouse0")) {
      if (pointInRect(mx, my, CODEX_BTN.x, CODEX_BTN.y, CODEX_BTN.w, CODEX_BTN.h)) {
        SFX.click();
        game.scenes.push(new EncyclopediaScene(), game);
        return;
      }
      if (this.save?.unlocks?.creditsUnlocked && pointInRect(mx, my, CREDITS_BTN.x, CREDITS_BTN.y, CREDITS_BTN.w, CREDITS_BTN.h)) {
        SFX.click();
        game.scenes.push(new CreditsScene(), game);
        return;
      }
    }

    if (
      storyDone
      && game.input.wasPressed("Mouse0")
      && pointInRect(mx, my, TUTORIAL_BTN.x, TUTORIAL_BTN.y, TUTORIAL_BTN.w, TUTORIAL_BTN.h)
    ) {
      SFX.click();
      game.scenes.push(new TutorialScene(), game);
      return;
    }

    if (game.input.wasPressed(" ", "Space", "Enter", "Mouse0")) {
      if (this.reveal < total) {
        this.reveal = total;
        SFX.click();
      } else {
        SFX.confirm();
        game.scenes.replace(new InstructionsScene(), game);
        return;
      }
    }
    if (this.reveal < total) {
      this.reveal = Math.min(total, this.reveal + this.charSpeed * dt);
    }
  }

  render(ctx, game) {
    drawBackdropCached(ctx, this.t, this.t, 1.05, null, 1);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);

    drawBanner(ctx, "GUTS & GLORY", W / 2, 110, 72, COLORS.bile, COLORS.blood);
    drawBanner(ctx, "escape the purple worm", W / 2, 172, 26, COLORS.bone, COLORS.worm);

    // v0.12 meta line: current top run + unlocks owned.
    this.drawMetaLine(ctx);

    const panelX = 110, panelY = 230, panelW = W - 220, panelH = 440;
    drawPanel(ctx, panelX, panelY, panelW, panelH);

    const shown = STORY.join("\n").slice(0, Math.floor(this.reveal));
    const lines = shown.split("\n");
    let y = panelY + 40;
    for (const line of lines) {
      const bold = line.startsWith("Oh FART");
      const color = bold ? COLORS.bile : COLORS.bone;
      const size = bold ? 34 : 22;
      drawText(ctx, line, panelX + 40, y, {
        size, color, bold,
        glow: bold ? COLORS.blood : null,
        maxWidth: panelW - 80,
      });
      y += size + 8;
    }

    const total = STORY.join("\n").length;
    if (this.reveal >= total) {
      const blink = Math.sin(this.pulse * 5) > 0;
      if (blink) {
        drawText(ctx, ">> PRESS SPACE TO FORGE YOUR HERO <<", W / 2, H - 118, {
          size: 20, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
        });
      }
      ctx.save();
      roundRect(ctx, TUTORIAL_BTN.x, TUTORIAL_BTN.y, TUTORIAL_BTN.w, TUTORIAL_BTN.h, 10);
      ctx.fillStyle = "rgba(26,18,62,0.88)";
      ctx.fill();
      ctx.strokeStyle = COLORS.bileGlow;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      drawText(ctx, "GUIDED TUTORIAL — full run walkthrough", TUTORIAL_BTN.x + TUTORIAL_BTN.w / 2, TUTORIAL_BTN.y + TUTORIAL_BTN.h / 2, {
        size: 15, color: "#fffefb", align: "center", baseline: "middle", bold: true,
        maxWidth: TUTORIAL_BTN.w - 16,
      });
    } else {
      drawText(ctx, "(SPACE to skip)", W / 2, H - 70, {
        size: 13, color: COLORS.boneDim, align: "center",
      });
    }

    ctx.save();
    roundRect(ctx, CODEX_BTN.x, CODEX_BTN.y, CODEX_BTN.w, CODEX_BTN.h, 8);
    ctx.fillStyle = "rgba(26,18,62,0.82)";
    ctx.fill();
    ctx.strokeStyle = COLORS.bileGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, "INNER GUTS CODEX (cheats) — CLICK", CODEX_BTN.x + CODEX_BTN.w / 2, CODEX_BTN.y + CODEX_BTN.h / 2, {
      size: 13, color: "#fffefb", align: "center", baseline: "middle", bold: true,
    });
    ctx.restore();

    if (this.save?.unlocks?.creditsUnlocked) {
      ctx.save();
      roundRect(ctx, CREDITS_BTN.x, CREDITS_BTN.y, CREDITS_BTN.w, CREDITS_BTN.h, 8);
      ctx.fillStyle = "rgba(26,18,62,0.70)";
      ctx.fill();
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, "CREDITS — CLICK", CREDITS_BTN.x + CREDITS_BTN.w / 2, CREDITS_BTN.y + CREDITS_BTN.h / 2, {
        size: 13, color: "#fffefb", align: "center", baseline: "middle", bold: true,
      });
      ctx.restore();
    }

    this.drawWormFrame(ctx);
  }

  drawMetaLine(ctx) {
    if (!this.save) return;
    const hs = this.save.highScores || [];
    const u = this.save.unlocks || {};
    const unlockCount = UNLOCK_KEYS.reduce((n, k) => n + (u[k] ? 1 : 0), 0);
    const top = hs.length > 0 ? hs[0] : null;
    const y = 200;
    if (top) {
      const line =
        `TOP RUN: ${top.score} [${top.rank}]  `
        + `${String(top.buildId || "?").toUpperCase()} / ${String(top.loadoutId || "?")}  `
        + `(${top.chambersCleared}ch)`;
      drawText(ctx, line, W / 2, y, {
        size: 14, color: COLORS.gold, align: "center", bold: true,
        maxWidth: W - 200,
      });
    } else {
      drawText(ctx, "No runs yet - be the first to escape!", W / 2, y, {
        size: 14, color: COLORS.boneDim, align: "center",
      });
    }
    const unlockText = `UNLOCKS: ${unlockCount}/${UNLOCK_TOTAL}`;
    drawText(ctx, unlockText, W / 2, y + 18, {
      size: 12,
      color: unlockCount === UNLOCK_TOTAL ? COLORS.bile : COLORS.boneDim,
      align: "center",
      bold: unlockCount === UNLOCK_TOTAL,
    });
  }

  drawWormFrame(ctx) {
    const draw = (x, y, flip) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      for (let i = 0; i < 5; i++) {
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.arc(i * 18 + 2, Math.sin(i + this.t * 2) * 4 + 2, 12 - i * 0.8, 0, Math.PI * 2);
        ctx.fill();
        // Body with gradient
        const cx = i * 18;
        const cy = Math.sin(i + this.t * 2) * 4;
        const rr = 12 - i * 0.8;
        const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, rr);
        g.addColorStop(0, COLORS.wormHi);
        g.addColorStop(1, COLORS.worm);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Head
      ctx.fillStyle = COLORS.blood;
      ctx.beginPath();
      ctx.arc(-6, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(-8, -1, 2, 2);
      ctx.fillRect(-5, -1, 2, 2);
      ctx.restore();
    };
    draw(40, H - 40, 1);
    draw(W - 40, H - 40, -1);
  }
}
