/**
 * Heavy psychedelic overlay: motion trails, sparkles, edge starbursts.
 * `game._pfTrail` is cleared on scene changes and `nocheats`.
 */

import { W, H } from "./render.js";
import { visualMods } from "./visualMods.js";

const TRAIL_MAX = 96;
const TRAIL_LIFE = 1.45;

export function clearPinkFloydTrail(game) {
  if (!game) return;
  game._pfTrail = { points: [], lastX: null, lastY: null };
}

/**
 * Call each frame after gameplay `update` so stale points decay.
 */
export function tickPinkFloydTrail(game) {
  if (!game?.pinkFloydMode || !game._pfTrail?.points?.length) return;
  const now = game.t ?? 0;
  const pts = game._pfTrail.points;
  let w = 0;
  for (let i = 0; i < pts.length; i++) {
    if (now - pts[i].born < TRAIL_LIFE) pts[w++] = pts[i];
  }
  pts.length = w;
}

/**
 * Record hero position for rainbow motion trails (climb / combat / maw).
 */
export function recordPinkFloydTrail(game, x, y, minDist = 2.2) {
  if (!game?.pinkFloydMode) return;
  if (!game._pfTrail) game._pfTrail = { points: [], lastX: null, lastY: null };
  const tr = game._pfTrail;
  if (tr.lastX != null) {
    const d = Math.hypot(x - tr.lastX, y - tr.lastY);
    if (d < minDist) return;
  }
  tr.lastX = x;
  tr.lastY = y;
  const born = game.t ?? 0;
  const hue = (born * 95 + tr.points.length * 37) % 360;
  tr.points.push({ x, y, born, hue });
  while (tr.points.length > TRAIL_MAX) tr.points.shift();
}

export function drawPinkFloydTrails(ctx, game) {
  if (!visualMods.pinkFloyd || !game?._pfTrail?.points?.length) return;
  const pts = game._pfTrail.points;
  const now = game.t ?? visualMods.t;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const age = Math.max(0, now - b.born);
    const alpha = Math.max(0, 1 - age / TRAIL_LIFE);
    const hue = (b.hue + age * 140) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.24 * alpha})`;
    ctx.lineWidth = 2 + 4 * alpha;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dense twinkling field (screen space). Kept light — no shadowBlur (very costly on 2D canvas). */
export function drawPinkFloydAmbientSparkles(ctx) {
  if (!visualMods.pinkFloyd) return;
  const tm = visualMods.t;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 0;
  for (let i = 0; i < 34; i++) {
    const seed = i * 7919 + Math.floor(tm * 14);
    const u = Math.abs(Math.sin(seed * 0.0017));
    const v = Math.abs(Math.cos(seed * 0.0023));
    const px = u * W;
    const py = v * H;
    const tw = 0.5 + 0.5 * Math.sin(tm * 8 + i * 0.7);
    const hue = (tm * 72 + i * 41 + px * 0.08) % 360;
    const r = 0.8 + (i % 5) * 0.55 + tw * 1.2;
    ctx.fillStyle = `hsla(${hue}, 100%, 72%, ${0.06 + 0.14 * tw})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Short-lived starbursts hugging the screen edges. */
export function drawPinkFloydEdgeBursts(ctx) {
  if (!visualMods.pinkFloyd) return;
  const tm = visualMods.t;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 0;
  const bursts = 4;
  for (let i = 0; i < bursts; i++) {
    const cycle = 2.8;
    const phase = ((tm + i * 0.41) % cycle) / cycle;
    if (phase > 0.22) continue;
    const t = phase / 0.22;
    const edge = Math.floor((i * 1.7 + tm * 1.3) % 4);
    let cx;
    let cy;
    if (edge === 0) {
      cx = ((i * 211 + tm * 80) % (W - 100)) + 50;
      cy = 28 + t * 40;
    } else if (edge === 1) {
      cx = W - 32 - t * 50;
      cy = ((i * 173 + tm * 60) % (H - 120)) + 60;
    } else if (edge === 2) {
      cx = ((i * 199 + tm * 70) % (W - 100)) + 50;
      cy = H - 36 - t * 45;
    } else {
      cx = 36 + t * 55;
      cy = ((i * 157 + tm * 65) % (H - 120)) + 60;
    }
    const rays = 9;
    const spread = 28 + t * 160;
    const hue = (tm * 200 + i * 67) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 68%, ${0.5 * (1 - t)})`;
    ctx.lineWidth = 2;
    for (let r = 0; r < rays; r++) {
      const ang = (r / rays) * Math.PI * 2 + tm * 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * spread, cy + Math.sin(ang) * spread);
      ctx.stroke();
    }
    ctx.fillStyle = `hsla(${(hue + 20) % 360}, 100%, 85%, ${0.35 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 5 + (1 - t) * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

let _pfCssKey = "";

/** Browser-level hue/sat on the whole framebuffer. Only mutates styles when values change (avoid forced compositor sync every rAF). */
export function applyPinkFloydCanvasCss(canvas, game, cheatMenuOpen) {
  if (!canvas) return;
  if (game?.pinkFloydMode && !cheatMenuOpen) {
    const t = game.t ?? 0;
    const hBucket = Math.floor(((t * 48) % 360) / 6) * 6;
    const sk = Math.round(Math.sin(t * 1.15) * 45) / 100;
    const next = `${hBucket}|${sk}`;
    if (next !== _pfCssKey) {
      _pfCssKey = next;
      canvas.style.filter =
        `saturate(1.85) contrast(1.1) hue-rotate(${hBucket}deg) brightness(1.06)`;
      canvas.style.transform = `scale(1.004) skewX(${sk}deg)`;
    }
  } else {
    if (_pfCssKey !== "") {
      _pfCssKey = "";
      canvas.style.filter = "";
      canvas.style.transform = "";
    }
  }
}
