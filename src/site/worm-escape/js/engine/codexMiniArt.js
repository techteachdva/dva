/**
 * Retro codex thumbnails — enemies by art tag, pact badges, etc.
 */

import { ENEMIES } from "../content/enemies.js";
import { drawPactSigil } from "./pactSigils.js";
import { roundRect } from "./render.js";

export function getEnemyByCodexId(entryId) {
  if (!entryId || !entryId.startsWith("enemy:")) return null;
  const eid = entryId.slice("enemy:".length);
  return Object.values(ENEMIES).find((e) => e.id === eid) || null;
}

/**
 * Stylized silhouette from guardian `art` tag + enemy accent color.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} art — tentacle | teeth | zombie | flesh | bile
 * @param {string} color — hex from ENEMIES
 */
export function drawEnemyCodexSprite(ctx, art, color, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  const c = color || "#aa6688";
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.95;

  switch (art) {
    case "tentacle": {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#c86bff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(18, 32);
      ctx.bezierCurveTo(-28, 8, -32, -28, 4, -36);
      ctx.bezierCurveTo(28, -40, 36, -8, 12, 20);
      ctx.stroke();
      ctx.fillStyle = "rgba(120,40,160,0.35)";
      ctx.beginPath();
      ctx.arc(-4, -8, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "teeth": {
      ctx.fillStyle = "#f6ecd0";
      for (let i = 0; i < 5; i++) {
        const a = -0.5 + i * 0.28;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
        ctx.lineTo(Math.cos(a + 0.12) * 26, Math.sin(a + 0.12) * 26);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "#8a6040";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, 22, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "zombie": {
      ctx.fillStyle = "#6ea34a";
      ctx.strokeStyle = "#2a4a18";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 4, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1a3010";
      ctx.fillRect(-10, -6, 8, 6);
      ctx.fillRect(2, -6, 8, 6);
      ctx.fillStyle = "#3a2010";
      ctx.fillRect(-6, 12, 12, 4);
      break;
    }
    case "flesh": {
      const g = ctx.createRadialGradient(-8, -8, 2, 0, 4, 32);
      g.addColorStop(0, "#ff8899");
      g.addColorStop(0.5, c);
      g.addColorStop(1, "#501018");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 4, 28, 22, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "bile": {
      const g = ctx.createRadialGradient(0, -10, 2, 0, 8, 36);
      g.addColorStop(0, "#d7ff9b");
      g.addColorStop(0.45, "#9bff66");
      g.addColorStop(1, "#1a4a10");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.bezierCurveTo(30, -10, 28, 28, 0, 34);
      ctx.bezierCurveTo(-28, 28, -30, -10, 0, -30);
      ctx.fill();
      ctx.strokeStyle = "#2a6a1a";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    default: {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Small pact badge for codex mechanic list (mech:pact-*). */
export function drawPactCodexBadge(ctx, pactId, cx, cy, t) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, cx - 52, cy - 44, 104, 88, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  roundRect(ctx, cx - 52 + 0.5, cy - 44 + 0.5, 103, 87, 8);
  ctx.stroke();
  drawPactSigil(ctx, cx, cy, pactId, t, { scale: 0.72, selected: false });
  ctx.restore();
}
