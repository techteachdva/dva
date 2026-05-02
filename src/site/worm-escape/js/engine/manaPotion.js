// Shared mana vial mini-game (CombatScene + MawBossScene).

import { rand, randInt } from "./rng.js";
import { SFX } from "./audio.js";
import { drawText, roundRect } from "./render.js";

export const POTION_KEY_FORBIDDEN = new Set([
  "a", "d", "e", "f", "q", "r", "s", "w", "1", "2", "3", "4",
  "m", "p", "\\", "=",
  "t",
]);

export const POTION_KEY_POOL = "abcdefghijklmnopqrstuvwxyz"
  .split("")
  .filter((c) => !POTION_KEY_FORBIDDEN.has(c));

export const POTION_DRINK_CD_SEC = 22;
export const POTION_MINIGAME_TIME_SEC = 11;

export function pickTwoDistinctPotionKeys() {
  let a = POTION_KEY_POOL[randInt(0, POTION_KEY_POOL.length - 1)];
  let b = POTION_KEY_POOL[randInt(0, POTION_KEY_POOL.length - 1)];
  for (let i = 0; i < 20 && b === a; i++) {
    b = POTION_KEY_POOL[randInt(0, POTION_KEY_POOL.length - 1)];
  }
  return [a, b === a ? POTION_KEY_POOL.find((k) => k !== a) ?? "z" : b];
}

export function tickManaPotionMiniGame(st, dt, inp, onSuccess, onFail) {
  if (!st) return;
  if (typeof st.timeLeft === "number") st.timeLeft -= dt;
  if (st.hintFlash > 0) st.hintFlash -= dt;
  if (st.timeLeft <= 0) {
    onFail();
    return;
  }
  if (st.phase === "cork") {
    for (const k of POTION_KEY_POOL) {
      if (k === st.corkKey) continue;
      if (inp.wasPressed(k)) {
        st.hintFlash = 0.4;
        st.timeLeft -= 0.72;
        SFX.deny();
        break;
      }
    }
    if (inp.wasPressed(st.corkKey)) {
      st.corkPop = true;
      st.phase = "pour";
      st.tilt = 0;
      SFX.grab();
    }
  } else if (st.phase === "pour") {
    if (inp.isDown(st.pourKey)) {
      st.tilt = Math.min(1, st.tilt + dt * 3.4);
      const drain = dt * st.tilt * st.tilt * 0.92 + dt * st.tilt * 0.12;
      st.liquid = Math.max(0, st.liquid - drain);
      if (st.liquid <= 0.04) onSuccess();
    } else {
      st.tilt = Math.max(0, st.tilt - dt * 0.95);
    }
  }
}

/** Full-screen mana vial modal (combat waits while open). */
export function drawManaPotionModal(ctx, st, COLORS, player = null) {
  if (!st) return;

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const neckW = 32;
  const bulbW = 70;
  const neckH = 44;
  const bulbH = 96;
  const rBase = bulbW / 2;

  const pMana = player ? player.mana : (st.previewMana ?? 0);
  const pManaMax = player ? player.manaMax : (st.previewManaMax ?? 1);

  ctx.save();
  ctx.fillStyle = "rgba(8, 2, 12, 0.62)";
  ctx.fillRect(0, 0, W, H);

  const panelX = W / 2 - 274;
  const panelY = H / 2 - 246;
  const panelW = 548;
  const panelH = 428;

  ctx.fillStyle = "rgba(18, 8, 28, 0.96)";
  roundRect(ctx, panelX + 6, panelY + 8, panelW - 12, panelH - 16, 16);
  ctx.fill();
  ctx.strokeStyle = st.hintFlash > 0 ? "rgba(255,80,80,0.9)" : "rgba(180, 140, 220, 0.45)";
  ctx.lineWidth = st.hintFlash > 0 ? 3.5 : 2;
  roundRect(ctx, panelX + 6, panelY + 8, panelW - 12, panelH - 16, 16);
  ctx.stroke();

  drawText(ctx, "MANA VIAL", W / 2, panelY + 44, {
    size: 28, align: "center", bold: true, color: COLORS.bile,
    glow: "#204040",
  });
  const phaseLbl = st.phase === "cork"
    ? `Pop cork → press  [ ${String(st.corkKey).toUpperCase()} ]`
    : `Pour out → HOLD  [ ${String(st.pourKey).toUpperCase()} ]  to tilt`;
  drawText(ctx, phaseLbl, W / 2, panelY + 84, {
    size: 16, align: "center", color: COLORS.bone, maxWidth: panelW - 40,
    bold: true,
  });

  drawText(ctx,
    `TIME  ${Math.max(0, st.timeLeft).toFixed(1)}s  ·  MP  ${Math.floor(pMana)}/${Math.floor(pManaMax)}`,
    W / 2, panelY + 116, {
      size: 14, align: "center", color: COLORS.boneDim,
    });

  const cx = W / 2;
  const cy = panelY + 248;

  ctx.save();
  ctx.translate(cx, cy);
  const tilt = st.tilt * 0.95;
  ctx.rotate(-tilt);
  ctx.beginPath();
  ctx.moveTo(-neckW / 2, -neckH - bulbH * 0.5);
  ctx.lineTo(-bulbW * 0.38, bulbH * 0.12);
  ctx.quadraticCurveTo(-rBase, bulbH * 0.58, -rBase * 0.92, bulbH * 0.96);
  ctx.lineTo(rBase * 0.92, bulbH * 0.96);
  ctx.quadraticCurveTo(rBase, bulbH * 0.58, bulbW * 0.38, bulbH * 0.12);
  ctx.lineTo(neckW / 2, -neckH - bulbH * 0.5);
  ctx.closePath();
  ctx.strokeStyle = "rgba(220, 230, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(40, 55, 90, 0.22)";
  ctx.fill();
  ctx.stroke();

  const neckRimY = -neckH - bulbH * 0.48;
  const basinFloorY = bulbH * 1.08;
  const surfaceY = neckRimY + (1 - st.liquid) * (basinFloorY - neckRimY);
  ctx.beginPath();
  ctx.moveTo(-neckW / 2, -neckH - bulbH * 0.5);
  ctx.lineTo(-bulbW * 0.38, bulbH * 0.12);
  ctx.quadraticCurveTo(-rBase, bulbH * 0.58, -rBase * 0.92, bulbH * 0.96);
  ctx.lineTo(rBase * 0.92, bulbH * 0.96);
  ctx.quadraticCurveTo(rBase, bulbH * 0.58, bulbW * 0.38, bulbH * 0.12);
  ctx.lineTo(neckW / 2, -neckH - bulbH * 0.5);
  ctx.closePath();
  ctx.clip();
  const liqGrad = ctx.createLinearGradient(0, neckRimY, 0, basinFloorY);
  liqGrad.addColorStop(0, "#6ec8ff");
  liqGrad.addColorStop(0.5, "#1e6dff");
  liqGrad.addColorStop(1, "#0a2848");
  ctx.fillStyle = liqGrad;
  ctx.beginPath();
  ctx.rect(-bulbW * 0.62, surfaceY - 2, bulbW * 1.24, basinFloorY - surfaceY + 20);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-tilt);
  ctx.strokeStyle = "rgba(235, 245, 255, 0.75)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(-neckW / 2, -neckH - bulbH * 0.5);
  ctx.lineTo(-bulbW * 0.38, bulbH * 0.12);
  ctx.quadraticCurveTo(-rBase, bulbH * 0.58, -rBase * 0.92, bulbH * 0.96);
  ctx.arc(0, bulbH * 0.88, rBase * 0.92, Math.PI - 0.06, Math.PI * 2 + 0.06);
  ctx.quadraticCurveTo(rBase, bulbH * 0.58, bulbW * 0.38, bulbH * 0.12);
  ctx.lineTo(neckW / 2, -neckH - bulbH * 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(130, 200, 255, 0.55)";
  ctx.beginPath();
  ctx.ellipse(0, -neckH - bulbH * 0.48 - 6, neckW / 2 + 10, 6, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (!st.corkPop) {
    ctx.fillStyle = "#8a5f3e";
    roundRect(ctx, -14, -neckH - bulbH * 0.5 - 22, 28, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#c69b6a";
    ctx.fillRect(-8, -neckH - bulbH * 0.5 - 18, 16, 4);
  }
  ctx.restore();

  const jug = tilt * 1.06;
  if (st.phase === "pour" && st.tilt > 0.35 && st.liquid > 0.05) {
    const ly = -neckH - bulbH * 0.48 - 20;
    const px = cx - ly * Math.sin(-jug);
    const py = cy + ly * Math.cos(-jug);
    ctx.fillStyle = `rgba(140, 220, 255, ${0.35 + st.liquid * 0.5})`;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(
        px + Math.sin(jug + 1.35) * 24 + rand(-14, 8),
        py + Math.cos(jug + 1.35) * 24 + rand(24, 90) + i * 13,
        rand(2, 7),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  drawText(ctx, "Freeze the battlefield — combat waits on you!", W / 2, panelY + panelH - 62, {
    size: 12, align: "center", color: COLORS.boneDim, maxWidth: panelW - 40,
  });
  drawText(ctx, "Pause combat [P]", W / 2, panelY + panelH - 36, {
    size: 12, align: "center", color: "#8899aa",
  });

  ctx.restore();
}
