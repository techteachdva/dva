import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { loadSave } from "../engine/storage.js";
import { InstructionsScene } from "./instructions.js";
import { makePlayer } from "../content/player.js";
import { CHAMBERS } from "../content/chambers.js";
import { TongueBossScene } from "./tongueBoss.js";

// Total possible persistent unlocks - keep this in sync with DEFAULT_SAVE.unlocks.
const UNLOCK_TOTAL = 3; // viperBuild, bileWhip, hexStaff

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

    // DEV / TEST: press B from the title screen to jump straight into the
    // final boss (The Worm's Tongue) with a stock Swift + Sword loadout,
    // so the reticle puzzle and enrage animation can be tested without
    // having to clear every chamber first.
    if (game.input.wasPressed("b", "B")) {
      SFX.confirm();
      startBossTest(game);
      return;
    }

    if (game.input.wasPressed(" ", "Space", "Enter")) {
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
    drawFleshBackground(ctx, this.t, 1.05);
    drawVeins(ctx, this.t, 1);

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

    // Dev/test hotkey hint - press B to jump straight to the final boss.
    drawText(ctx, "[B] dev: test final boss fight", W / 2, H - 22, {
      size: 12, color: COLORS.boneDim, align: "center", italic: true,
    });

    this.drawWormFrame(ctx);
  }

  drawMetaLine(ctx) {
    if (!this.save) return;
    const hs = this.save.highScores || [];
    const u = this.save.unlocks || {};
    const unlockCount =
      (u.viperBuild ? 1 : 0) + (u.bileWhip ? 1 : 0) + (u.hexStaff ? 1 : 0);
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

// Build a fresh "test pilot" player and drop straight into the final-boss
// scene. This is for devs/QA who want to see the Worm's Tongue animation
// and verify the reticle/enrage behavior without playing through the run.
// We award a little extra HP/MP so a fumbled first attempt doesn't end
// the test in 5 seconds, but we do NOT pre-apply any pacts - you see the
// boss exactly as a first-time victor would meet it.
function startBossTest(game) {
  const mawIdx = CHAMBERS.findIndex(c => c.isMaw);
  if (mawIdx < 0) return; // no final chamber defined; bail silently
  const p = makePlayer("swift", "sword");
  p.hp = p.hpMax;
  p.mana = p.manaMax;
  if (p.armorMax > 0) p.armor = p.armorMax;
  p.tankHitsLeft = p.tankHitsMax;
  game.player = p;
  game.chamberIndex = mawIdx;
  game.scenes.replace(new TongueBossScene(mawIdx), game);
}
