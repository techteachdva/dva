import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawBanner, drawPanel, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { loadSave } from "../engine/storage.js";
import { InstructionsScene } from "./instructions.js";
import { EncyclopediaScene } from "./encyclopedia.js";
import { pointInRect } from "../engine/pointer.js";

function cheatKnown(save, cheatId) {
  const k = save?.knownCheats;
  return Array.isArray(k) && k.includes(cheatId);
}

// Total possible persistent unlocks - keep this in sync with DEFAULT_SAVE.unlocks.
// v0.16: viperBuild, wizardBuild, bileWhip, hexStaff, megaphone, boneSpear,
// blunderbuss, cursedScythe, rustyChainsaw, cat = 10
const UNLOCK_TOTAL = 10;
// Order kept matching DEFAULT_SAVE.unlocks (excluding the informational
// `anyElite` flag which is implied by hexStaff/rustyChainsaw).
const UNLOCK_KEYS = [
  "viperBuild", "wizardBuild", "bileWhip", "hexStaff",
  "megaphone", "boneSpear", "blunderbuss",
  "cursedScythe", "rustyChainsaw", "cat",
];

// Title screen Codex launcher (CHEATS shelf includes victory-unlocked dossiers).
const CODEX_BTN = { x: W - 308, y: H - 128, w: 288, h: 48 };

const ROW_Y = H - 178;
const BTN = { w: 156, h: 36, gap: 10 };
function rowBtn(i) {
  const total = BTN.w * 4 + BTN.gap * 3;
  const x0 = (W - total) / 2;
  return { x: x0 + i * (BTN.w + BTN.gap), y: ROW_Y, w: BTN.w, h: BTN.h };
}

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
    const save = this.save;
    const uk = save?.knownCheats || [];
    const showWorm = cheatKnown(save, "wyrm") || game.easyMode;
    const showDragon = cheatKnown(save, "dragon") || game.hardMode;
    const showAncient = cheatKnown(save, "greatwyrm") || game.ultraHardMode;
    const showEndless = !!save?.unlocks?.endlessUnlocked;

    if (
      game.input.wasPressed("Mouse0") &&
      pointInRect(mx, my, CODEX_BTN.x, CODEX_BTN.y, CODEX_BTN.w, CODEX_BTN.h)
    ) {
      SFX.click();
      game.scenes.push(new EncyclopediaScene(), game);
      return;
    }

    if (game.input.wasPressed("Mouse0") && this.reveal >= STORY.join("\n").length) {
      for (let i = 0; i < 4; i++) {
        const b = rowBtn(i);
        if (!pointInRect(mx, my, b.x, b.y, b.w, b.h)) continue;
        if (i === 0 && !showWorm) { SFX.deny(); return; }
        if (i === 1 && !showDragon) { SFX.deny(); return; }
        if (i === 2 && !showAncient) { SFX.deny(); return; }
        if (i === 3 && !showEndless) { SFX.deny(); return; }
        SFX.click();
        if (i === 0) {
          game.easyMode = true;
          game.hardMode = false;
          game.ultraHardMode = false;
        } else if (i === 1) {
          game.hardMode = true;
          game.easyMode = false;
          game.ultraHardMode = false;
        } else if (i === 2) {
          game.ultraHardMode = true;
          game.easyMode = false;
          game.hardMode = false;
        } else if (i === 3) {
          game.endlessSelected = !game.endlessSelected;
        }
        return;
      }
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
        drawText(ctx, ">> PRESS SPACE TO FORGE YOUR HERO <<", W / 2, H - 70, {
          size: 20, color: COLORS.bile, align: "center", bold: true, glow: COLORS.blood,
        });
      }
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

    const storyDone = this.reveal >= STORY.join("\n").length;
    if (storyDone) {
      const save = this.save;
      const labels = [
        { label: "[WORM]", sub: "easy", ok: cheatKnown(save, "wyrm") || game.easyMode, on: game.easyMode },
        { label: "[GREAT WORM]", sub: "hard", ok: cheatKnown(save, "dragon") || game.hardMode, on: game.hardMode },
        { label: "[ANCIENT]", sub: "ultra", ok: cheatKnown(save, "greatwyrm") || game.ultraHardMode, on: game.ultraHardMode },
        { label: "ENDLESS", sub: game.endlessSelected ? "ON" : "OFF", ok: !!save?.unlocks?.endlessUnlocked, on: !!game.endlessSelected },
      ];
      for (let i = 0; i < 4; i++) {
        const b = rowBtn(i);
        const row = labels[i];
        const pulse = 0.65 + 0.35 * Math.sin(this.pulse * 6 + i * 0.4);
        ctx.save();
        ctx.globalAlpha = row.ok ? 1 : 0.38;
        ctx.fillStyle = row.on ? "rgba(60,40,10,0.88)" : "rgba(18,12,28,0.78)";
        roundRect(ctx, b.x, b.y, b.w, b.h, 8);
        ctx.fill();
        ctx.strokeStyle = row.on ? COLORS.gold : (row.ok ? COLORS.bileGlow : "#444");
        ctx.lineWidth = row.on ? 3 : 2;
        roundRect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 8);
        ctx.stroke();
        if (row.ok && row.on) {
          ctx.fillStyle = `rgba(255,220,140,${0.12 * pulse})`;
          roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, 10, 6);
          ctx.fill();
        }
        ctx.restore();
        drawText(ctx, row.label, b.x + b.w / 2, b.y + 13, {
          size: i === 3 ? 11 : 12,
          color: row.ok ? COLORS.bone : COLORS.boneDim,
          align: "center",
          bold: true,
          maxWidth: b.w - 4,
        });
        drawText(ctx, row.sub, b.x + b.w / 2, b.y + 28, {
          size: 10,
          color: row.on ? COLORS.gold : COLORS.boneDim,
          align: "center",
          maxWidth: b.w - 4,
        });
      }
      drawText(ctx, "Unlock with cheats: wyrm · dragon · greatwyrm  ·  Endless after first victory", W / 2, ROW_Y - 18, {
        size: 11, color: COLORS.boneDim, align: "center", maxWidth: W - 40,
      });
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
