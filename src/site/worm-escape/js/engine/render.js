// Canvas helpers: flesh backgrounds, veins, acid, glow text, screen shake, particles.
// Style: cel-shaded + rim-lit, top-left light source, drop shadows for volume.

export const W = 1280;
export const H = 800;

// Virtual sun direction (top-left), used to place highlights and cast shadows.
export const LIGHT = { x: -1, y: -1.2 };

export const COLORS = {
  bone: "#e9dcc1",
  boneDim: "#a9976f",
  bile: "#9bff66",
  bileDark: "#2e6b1f",
  bileGlow: "#d7ff9b",
  blood: "#c21a1a",
  bloodDark: "#571010",
  worm: "#6b2a7a",
  wormLight: "#a855b6",
  wormHi: "#d26bdf",
  wormDeep: "#2a0b33",
  worm2: "#42125a",
  ink: "#1a0a1f",
  shadow: "rgba(0,0,0,0.55)",
  mana: "#4fc3ff",
  manaDark: "#1e5a8c",
  gold: "#ffd966",
  steel: "#c0c4cc",
  steelDark: "#545a66",
  steelHi: "#f6f8fc",
  skin: "#f0c88a",
  skinDark: "#7a5535",
  skinHi: "#ffe3b0",
};

// ---- screen shake ----
let shakeTime = 0;
let shakeMag = 0;

export function screenShake(magnitude = 8, duration = 0.25) {
  shakeMag = Math.max(shakeMag, magnitude);
  shakeTime = Math.max(shakeTime, duration);
}

export function applyShake(ctx, dt) {
  if (shakeTime > 0) {
    const m = shakeMag * (shakeTime / 0.25);
    const ox = (Math.random() - 0.5) * m * 2;
    const oy = (Math.random() - 0.5) * m * 2;
    ctx.translate(ox, oy);
    shakeTime -= dt;
    if (shakeTime <= 0) {
      shakeTime = 0;
      shakeMag = 0;
    }
  }
}

// ---- background: pulsing flesh with depth layers ----
// If `palette` is provided, it overrides the base flesh colors:
//   { deep, mid, bruise, bump } - lets chambers shift from blackish purple
//   (deep guts) to reddish pink (near the mouth).
function drawFleshBackgroundCore(ctx, t, tint = 1, palette = null) {
  const pulse = (Math.sin(t * 1.6) * 0.5 + 0.5) * 0.12 + 0.88;
  const deep   = palette?.deep   || COLORS.wormDeep;
  const mid    = palette?.mid    || COLORS.worm;
  const bruise = palette?.bruise || "rgba(168, 85, 182, 0.16)";
  const bump   = palette?.bump   || "rgba(210, 107, 223, 0.14)";

  // Base vertical gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(deep, pulse));
  g.addColorStop(0.5, shade(mid, pulse * tint));
  g.addColorStop(1, shade(deep, pulse * 0.65));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Deep radial "bruises" far in the background
  for (let i = 0; i < 10; i++) {
    const cx = ((i * 163 + Math.sin(t * 0.5 + i) * 40) % W + W) % W;
    const cy = ((i * 101 + Math.cos(t * 0.3 + i) * 30) % H + H) % H;
    const r = 160 + Math.sin(t + i) * 40;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, bruise);
    rg.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  // Radial "bumps" with top-left highlight (suggests 3D)
  for (let i = 0; i < 14; i++) {
    const cx = ((i * 97 + Math.sin(t * 0.4 + i * 1.3) * 10) % W + W) % W;
    const cy = ((i * 131 + Math.cos(t * 0.35 + i * 0.9) * 8) % H + H) % H;
    const r = 70 + (i % 4) * 20;
    // Light spot from top-left
    const rg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
    rg.addColorStop(0, bump);
    rg.addColorStop(0.5, "rgba(0, 0, 0, 0.05)");
    rg.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle vignette (atmospheric depth)
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ---- veins overlay (with small shadow offset to look raised) ----
function drawVeinsCore(ctx, t, seedOffset = 0) {
  ctx.save();
  // Shadow layer
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const baseX = ((i * 173 + seedOffset * 37) % W);
    ctx.beginPath();
    let x = baseX + 2;
    let y = -8;
    ctx.moveTo(x, y);
    while (y < H + 10) {
      y += 18;
      x += Math.sin((y + i * 30 + t * 20) * 0.04) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Main vein
  ctx.strokeStyle = "rgba(160, 40, 60, 0.75)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const baseX = ((i * 173 + seedOffset * 37) % W);
    ctx.beginPath();
    let x = baseX;
    let y = -10;
    ctx.moveTo(x, y);
    while (y < H + 10) {
      y += 18;
      x += Math.sin((y + i * 30 + t * 20) * 0.04) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Highlight along vein (top-left sheen)
  ctx.strokeStyle = "rgba(255, 170, 190, 0.2)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const baseX = ((i * 173 + seedOffset * 37) % W);
    ctx.beginPath();
    let x = baseX - 1;
    let y = -12;
    ctx.moveTo(x, y);
    while (y < H + 10) {
      y += 18;
      x += Math.sin((y + i * 30 + t * 20) * 0.04) * 14 - 0.5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Thinner capillary layer
  ctx.strokeStyle = "rgba(220, 60, 80, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const baseX = ((i * 91 + seedOffset * 53 + 40) % W);
    ctx.beginPath();
    let x = baseX;
    let y = -10;
    ctx.moveTo(x, y);
    while (y < H + 10) {
      y += 12;
      x += Math.sin((y + i * 17 + t * 30) * 0.08) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Uncached API (encyclopedia / tools that draw flesh alone). */
export function drawFleshBackground(ctx, t, tint = 1, palette = null) {
  drawFleshBackgroundCore(ctx, t, tint, palette);
}

export function drawVeins(ctx, t, seedOffset = 0) {
  drawVeinsCore(ctx, t, seedOffset);
}

function backdropPaletteKey(palette) {
  if (!palette) return "";
  return [palette.deep, palette.mid, palette.bruise, palette.bump].join("|");
}

let _backdropCanvas = null;
let _backdropKey = "";

/**
 * Renders flesh + veins to an offscreen canvas when (quantized) params change,
 * then blits — avoids ~60–90ms of gradient/loop work every frame when only
 * gameplay sprites moved.
 */
export function drawBackdropCached(ctx, tFlesh, tVeins, tint = 1, palette = null, veinSeed = 0) {
  const qf = Math.floor(tFlesh * 4);
  const qv = Math.floor(tVeins * 4);
  const pk = backdropPaletteKey(palette);
  const key = `${qf}|${qv}|${tint}|${pk}|${veinSeed}`;
  if (typeof document === "undefined") {
    drawFleshBackgroundCore(ctx, tFlesh, tint, palette);
    drawVeinsCore(ctx, tVeins, veinSeed);
    return;
  }
  if (!_backdropCanvas) {
    _backdropCanvas = document.createElement("canvas");
    _backdropCanvas.width = W;
    _backdropCanvas.height = H;
  }
  const bctx = _backdropCanvas.getContext("2d");
  if (key !== _backdropKey) {
    _backdropKey = key;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, W, H);
    drawFleshBackgroundCore(bctx, tFlesh, tint, palette);
    drawVeinsCore(bctx, tVeins, veinSeed);
  }
  ctx.drawImage(_backdropCanvas, 0, 0);
}

// ---- acid pool (bottom wave) - now with foam layer + inner glow ----
export function drawAcid(ctx, t, level /* 0..1 fraction of screen */) {
  if (level <= 0) return;
  const yTop = H - H * level;
  ctx.save();

  // Deep shadow under the surface (gives depth)
  const shadowG = ctx.createLinearGradient(0, yTop - 30, 0, yTop + 10);
  shadowG.addColorStop(0, "rgba(0,0,0,0)");
  shadowG.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = shadowG;
  ctx.fillRect(0, yTop - 30, W, 40);

  // Acid body gradient
  const g = ctx.createLinearGradient(0, yTop, 0, H);
  g.addColorStop(0, "rgba(180,255,120,0.95)");
  g.addColorStop(0.25, "rgba(155,255,102,0.95)");
  g.addColorStop(0.7, "rgba(90,200,50,0.97)");
  g.addColorStop(1, "rgba(30,90,20,1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, yTop + 20);
  for (let x = 0; x <= W; x += 8) {
    const y = yTop
      + Math.sin((x + t * 220) * 0.03) * 5
      + Math.sin((x + t * 140) * 0.08) * 3
      + Math.sin((x + t * 60) * 0.12) * 1.5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Inner caustic glow
  const caustic = ctx.createLinearGradient(0, yTop, 0, yTop + 60);
  caustic.addColorStop(0, "rgba(215,255,155,0.5)");
  caustic.addColorStop(1, "rgba(215,255,155,0)");
  ctx.fillStyle = caustic;
  ctx.fillRect(0, yTop, W, 60);

  // Bubbles (layered for depth)
  for (let i = 0; i < 28; i++) {
    const bx = ((i * 61 + t * (30 + i * 3)) % W);
    const by = yTop + 10 + ((i * 13 + t * 80 * (0.5 + (i % 5) * 0.2)) % Math.max(10, H - yTop - 10));
    const br = 2 + (i % 5);
    // Shadow
    ctx.fillStyle = "rgba(30, 90, 20, 0.5)";
    ctx.beginPath(); ctx.arc(bx + 1, by + 1, br, 0, Math.PI * 2); ctx.fill();
    // Body
    ctx.fillStyle = "rgba(200,255,160,0.7)";
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    // Specular
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(bx - br * 0.4, by - br * 0.4, br * 0.35, 0, Math.PI * 2); ctx.fill();
  }

  // Bright foam top (with glow)
  ctx.shadowColor = "rgba(215,255,155,0.8)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "rgba(240,255,200,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = yTop
      + Math.sin((x + t * 220) * 0.03) * 5
      + Math.sin((x + t * 140) * 0.08) * 3
      + Math.sin((x + t * 60) * 0.12) * 1.5;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ---- text with glow ----
// v0.14 legibility pass: canonical outlined text for high contrast on ANY
// background. Default font is a sans-serif stack (much more readable at
// small sizes than Courier); opt into monospace with `font: "mono"`.
//
// Every call gets a dark stroke behind the fill by default, which is the
// industry-standard technique for game-canvas UI over busy imagery. An
// optional `glow` adds a colored bloom, and `bg` draws a rounded plate
// behind the text. `maxWidth` auto-ellipsizes if the string is too long,
// eliminating overflow into neighboring UI elements.
const FONT_SANS = '"Segoe UI", Inter, Roboto, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const FONT_MONO = '"Consolas", "Courier New", ui-monospace, monospace';

// Shared measurement helper that honors the same font stack drawText uses,
// so width calculations match what actually renders.
function setFont(ctx, size, { bold = false, italic = false, font = "sans" } = {}) {
  const family = font === "mono" ? FONT_MONO : FONT_SANS;
  // 600 is a touch bolder than "normal" so non-bold text reads well over
  // busy backgrounds without looking cartoonish.
  const weight = bold ? "700" : "500";
  const style = italic ? "italic " : "";
  ctx.font = `${style}${weight} ${size}px ${family}`;
}

// Truncate `text` to fit within `maxWidth` (in px) for the currently-set
// font. Returns the possibly-shortened string. Appends an ellipsis.
const TRUNC_CACHE = new Map();
const TRUNC_CACHE_CAP = 500;

function truncateToWidth(ctx, text, maxWidth) {
  if (maxWidth == null || maxWidth <= 0) return text;
  const font = ctx.font || "";
  const key = `${font}\x00${maxWidth}\x00${text}`;
  const hit = TRUNC_CACHE.get(key);
  if (hit !== undefined) return hit;
  if (ctx.measureText(text).width <= maxWidth) {
    if (TRUNC_CACHE.size >= TRUNC_CACHE_CAP) TRUNC_CACHE.clear();
    TRUNC_CACHE.set(key, text);
    return text;
  }
  const ell = "\u2026";
  let s = text;
  while (s.length > 1 && ctx.measureText(s + ell).width > maxWidth) {
    s = s.slice(0, -1);
  }
  const out = s + ell;
  if (TRUNC_CACHE.size >= TRUNC_CACHE_CAP) TRUNC_CACHE.clear();
  TRUNC_CACHE.set(key, out);
  return out;
}

export function drawText(ctx, text, x, y, opts = {}) {
  const {
    size = 18,
    color = COLORS.bone,
    glow = null,
    align = "left",
    baseline = "top",
    bold = false,
    italic = false,
    outline = true,
    outlineColor = "rgba(0, 0, 0, 0.92)",
    outlineWidth = null,
    maxWidth = null,
    font = "sans",
    bg = null,
  } = opts;

  ctx.save();
  setFont(ctx, size, { bold, italic, font });
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  const str = truncateToWidth(ctx, String(text), maxWidth);

  if (bg) {
    const mw = ctx.measureText(str).width;
    let bx = x, by = y;
    if (align === "center") bx = x - mw / 2;
    else if (align === "right") bx = x - mw;
    if (baseline === "middle") by = y - size * 0.6;
    else if (baseline === "bottom" || baseline === "alphabetic") by = y - size;
    const px = typeof bg === "object" ? (bg.padX ?? 8) : 8;
    const py = typeof bg === "object" ? (bg.padY ?? 4) : 4;
    const fill = (typeof bg === "object" && bg.fill) ? bg.fill : "rgba(0, 0, 0, 0.6)";
    const rr = Math.min(10, (size + py * 2) / 2);
    const rx = bx - px, ry = by - py, rw = mw + px * 2, rh = size + py * 2;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(rx + rr, ry);
    ctx.lineTo(rx + rw - rr, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
    ctx.lineTo(rx + rw, ry + rh - rr);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
    ctx.lineTo(rx + rr, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
    ctx.lineTo(rx, ry + rr);
    ctx.quadraticCurveTo(rx, ry, rx + rr, ry);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Colored glow pass (behind outline/fill). Laid down first so the
  // outline crisply occludes the blur directly around the glyphs.
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = Math.max(10, size * 0.7);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Dark outline stroke - the magic ingredient for readability on busy
  // flesh backgrounds. Scales with font size so small text stays crisp
  // while big headlines get a chunky silhouette.
  if (outline) {
    const ow = outlineWidth != null ? outlineWidth : Math.max(2.5, Math.round(size / 6));
    ctx.save();
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = ow;
    ctx.strokeText(str, x, y);
    ctx.restore();
  }

  // Final fill pass on top.
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Text measurement helper matching drawText's font. Useful for layouts
// that need to align to actual rendered width.
export function measureText(ctx, text, opts = {}) {
  const { size = 18, bold = false, italic = false, font = "sans" } = opts;
  ctx.save();
  setFont(ctx, size, { bold, italic, font });
  const w = ctx.measureText(String(text)).width;
  ctx.restore();
  return w;
}

export function wrapText(ctx, text, maxWidth, size = 16, opts = {}) {
  ctx.save();
  setFont(ctx, size, opts);
  const words = String(text).split(/\s+/).filter(Boolean);
  const breakWord = (w) => {
    if (!maxWidth || maxWidth <= 0 || ctx.measureText(w).width <= maxWidth) return [w];
    const out = [];
    let piece = "";
    for (const ch of w) {
      const t = piece + ch;
      if (ctx.measureText(t).width > maxWidth && piece) {
        out.push(piece);
        piece = ch;
      } else {
        piece = t;
      }
    }
    if (piece) out.push(piece);
    return out.length ? out : [w];
  };
  const pieces = [];
  for (const w of words) pieces.push(...breakWord(w));

  const lines = [];
  let line = "";
  for (const part of pieces) {
    const test = line ? line + " " + part : part;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line);
      line = part;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

// ---- bar (HP/Mana/Acid) with soft inner gradient ----
export function drawBar(ctx, x, y, w, h, pct, opts = {}) {
  const {
    fill = COLORS.blood,
    back = "#1a0a1f",
    border = COLORS.bone,
    label = null,
    labelColor = COLORS.bone,
  } = opts;
  let p =
    typeof pct === "number" && Number.isFinite(pct)
      ? Math.max(0, Math.min(1, pct))
      : 0;
  ctx.save();
  // Back
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  // Fill w/ gradient for subtle volume
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(fill, 1.25));
  g.addColorStop(0.5, fill);
  g.addColorStop(1, shade(fill, 0.72));
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, y + 2, (w - 4) * p, h - 4);
  // Top highlight sheen
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + 2, y + 2, (w - 4) * p, Math.max(2, (h - 4) * 0.35));
  // Border
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  if (label) {
    // If the label is a dark color (e.g. "#111" on colored bars), pair it
    // with a LIGHT outline so the text pops. Otherwise use the default
    // dark outline for light-colored labels on dark bars.
    const lc = String(labelColor).toLowerCase();
    const labelIsDark =
      /^#[0-3]/.test(lc) || lc === "#111" || lc === "#000" || lc === "black";
    drawText(ctx, label, x + w / 2, y + h / 2, {
      size: 12,
      color: labelColor,
      align: "center",
      baseline: "middle",
      bold: true,
      outlineColor: labelIsDark ? "rgba(255, 255, 255, 0.85)" : "rgba(0, 0, 0, 0.9)",
      maxWidth: w - 8,
    });
  }
  ctx.restore();
}

// ---- particles ----
export class ParticleSystem {
  constructor() {
    this.ps = [];
  }
  emit(p) {
    this.ps.push(p);
  }
  burst(x, y, color, count = 12, speed = 120, life = 0.6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.ps.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: 2 + Math.random() * 3,
        color,
        gravity: 200,
      });
    }
  }
  update(dt) {
    for (const p of this.ps) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
    }
    this.ps = this.ps.filter((p) => p.life > 0);
  }
  render(ctx) {
    for (const p of this.ps) {
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      // Soft glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ---- utility: darken/lighten a hex or rgb ----
export function shade(hex, mult) {
  if (hex.startsWith("rgb")) return hex; // leave alone
  const c = hex.replace("#", "");
  const r = Math.min(255, Math.max(0, Math.floor(parseInt(c.slice(0, 2), 16) * mult)));
  const g = Math.min(255, Math.max(0, Math.floor(parseInt(c.slice(2, 4), 16) * mult)));
  const b = Math.min(255, Math.max(0, Math.floor(parseInt(c.slice(4, 6), 16) * mult)));
  return `rgb(${r},${g},${b})`;
}

// ---- dashed panel (for menus) ----
export function drawPanel(ctx, x, y, w, h, opts = {}) {
  const {
    fill = "rgba(10, 4, 14, 0.82)",
    border = COLORS.bone,
    borderGlow = COLORS.bile,
  } = opts;
  ctx.save();
  // Panel fill with subtle gradient
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(22, 10, 30, 0.92)");
  g.addColorStop(1, "rgba(6, 2, 10, 0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Top inner highlight
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
  // Border with glow
  ctx.shadowColor = borderGlow;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// ---- Drop shadow under a character on a virtual ground ----
export function drawDropShadow(ctx, cx, cy, rx, ry, strength = 0.5) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Volumetric ball (sphere-shaded disc) ----
export function drawSphere(ctx, cx, cy, r, baseColor, opts = {}) {
  const {
    shadowColor = "rgba(0,0,0,0.55)",
    highlight = "rgba(255,255,255,0.85)",
    rim = null, // optional rim color
    outline = "rgba(0,0,0,0.6)",
    lightX = -0.4,
    lightY = -0.4,
  } = opts;
  ctx.save();
  // Ambient occlusion shadow below the sphere
  const aoR = r * 1.05;
  const aoG = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, aoR);
  aoG.addColorStop(0, shadowColor);
  aoG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aoG;
  ctx.beginPath(); ctx.arc(cx, cy, aoR, 0, Math.PI * 2); ctx.fill();

  // Base body
  ctx.fillStyle = baseColor;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // Shading gradient (dark side opposite the light)
  const sG = ctx.createRadialGradient(
    cx + lightX * r * 0.6, cy + lightY * r * 0.6, r * 0.05,
    cx, cy, r * 1.05
  );
  sG.addColorStop(0, "rgba(255,255,255,0.28)");
  sG.addColorStop(0.4, "rgba(255,255,255,0)");
  sG.addColorStop(0.75, "rgba(0,0,0,0)");
  sG.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = sG;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // Rim light (opposite side glow)
  if (rim) {
    const rG = ctx.createRadialGradient(
      cx - lightX * r * 0.85, cy - lightY * r * 0.85, r * 0.05,
      cx, cy, r
    );
    rG.addColorStop(0, rim);
    rG.addColorStop(0.6, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rG;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // Specular highlight
  if (highlight) {
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(cx + lightX * r * 0.55, cy + lightY * r * 0.55, r * 0.28, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outline
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Rounded rectangle with cel-shading (top highlight + bottom shadow + outline).
export function drawPlate(ctx, x, y, w, h, r, baseColor, opts = {}) {
  const {
    highlight = "rgba(255,255,255,0.35)",
    lowlight = "rgba(0,0,0,0.45)",
    outline = "rgba(0,0,0,0.75)",
  } = opts;
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, shade(baseColor, 1.25));
  g.addColorStop(0.4, baseColor);
  g.addColorStop(1, shade(baseColor, 0.62));
  ctx.fillStyle = g;
  ctx.fill();
  // Bevel highlight (top-left)
  ctx.fillStyle = highlight;
  roundRect(ctx, x + 1, y + 1, w - 2, Math.max(2, h * 0.18), Math.max(1, r - 1));
  ctx.fill();
  // Bottom shadow
  ctx.fillStyle = lowlight;
  roundRect(ctx, x + 1, y + h - Math.max(2, h * 0.18), w - 2, Math.max(2, h * 0.18), Math.max(1, r - 1));
  ctx.fill();
  // Outline
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- hero render: 3D-ish cel-shaded chonk ----
//  scale: rendered at 1x; caller scales via ctx.scale() if needed.
export function drawHero(ctx, x, y, facing = 1, anim = 0, build = "swift", synergyId = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const leg = Math.sin(anim * 2) * 2.2;
  const bob = Math.abs(Math.sin(anim)) * 0.8;

  // --- Drop shadow on the ground ---
  drawDropShadow(ctx, 0, 22, 18, 5, 0.55);

  // --- Cape (behind body) ---
  // v0.16 per-build palette (viper = green snake-leather, wizard = deep arcane robe).
  let capeBase = "#2d4eaf", capeHi = "#4c7bdf";
  if (build === "iron")        { capeBase = "#394155"; capeHi = "#5a6680"; }
  else if (build === "viper")  { capeBase = "#1f3a1a"; capeHi = "#3f7a36"; }
  else if (build === "wizard") { capeBase = "#231548"; capeHi = "#5a3aa0"; }
  else if (build === "balanced") { capeBase = "#4a5568"; capeHi = "#6b7a93"; }
  else if (build === "tryHard") { capeBase = "#5a2418"; capeHi = "#c43a26"; }
  else if (build === "gambler") { capeBase = "#1a3824"; capeHi = "#2f8a54"; }
  else if (build === "tamer")   { capeBase = "#3d3020"; capeHi = "#7a6138"; }
  else if (build === "necromancer") { capeBase = "#120818"; capeHi = "#3d2050"; }
  ctx.save();
  ctx.translate(0, bob);
  // Cape shadow
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.moveTo(-13, -3);
  ctx.quadraticCurveTo(-24 + Math.sin(anim) * 3, 6, -18, 18);
  ctx.lineTo(-6, 14);
  ctx.lineTo(-6, -3);
  ctx.closePath();
  ctx.fill();
  // Cape body gradient
  const cg = ctx.createLinearGradient(-18, -4, -6, 18);
  cg.addColorStop(0, capeHi);
  cg.addColorStop(1, shade(capeBase, 0.55));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.quadraticCurveTo(-22 + Math.sin(anim) * 2, 6, -16, 16);
  ctx.lineTo(-6, 14);
  ctx.lineTo(-6, -4);
  ctx.closePath();
  ctx.fill();
  // Fold highlight
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.quadraticCurveTo(-14, 6, -10, 14);
  ctx.stroke();
  ctx.restore();

  // --- Legs (walk cycle) ---
  ctx.save();
  ctx.translate(0, bob);
  // Back leg (slightly shifted for depth) - tinted per build.
  let legBack  = "#4a2510", legFront = "#6a3a1a";
  if (build === "iron")        { legBack = "#4a3020"; legFront = "#5a3820"; }
  else if (build === "viper")  { legBack = "#1a2a18"; legFront = "#2a4a26"; }
  else if (build === "wizard") { legBack = "#1f1538"; legFront = "#2f2050"; }
  else if (build === "balanced") { legBack = "#383e48"; legFront = "#4f5662"; }
  else if (build === "tryHard") { legBack = "#502018"; legFront = "#682820"; }
  else if (build === "gambler") { legBack = "#1f3028"; legFront = "#2f5042"; }
  else if (build === "tamer")   { legBack = "#3a3018"; legFront = "#524628"; }
  else if (build === "necromancer") { legBack = "#201028"; legFront = "#382040"; }
  drawPlate(ctx, 1, 11, 6, 9 - leg, 1.5, legBack);
  drawPlate(ctx, -7, 11, 6, 9 + leg, 1.5, legFront);
  // Boots
  drawPlate(ctx, -8, 18 + leg, 8, 4, 1, "#1a0f08");
  drawPlate(ctx, 0, 18 - leg, 8, 4, 1, "#1a0f08");
  ctx.restore();

  // --- Torso (body) ---
  ctx.save();
  ctx.translate(0, bob);
  if (build === "necromancer") {
    drawPlate(ctx, -12, -9, 24, 24, 5, "#221028");
    ctx.strokeStyle = "rgba(200,230,230,0.35)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-11, -8 + i * 5);
      ctx.lineTo(11, -8 + i * 5);
      ctx.stroke();
    }
    ctx.fillStyle = "#e8eef0";
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.fillStyle = "#1a0810";
    ctx.fillRect(-12, 7, 24, 4);
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-6, -3, 2, 2);
    ctx.fillRect(2, -3, 2, 2);
    ctx.strokeStyle = "#7a8898";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-9, -3);
    ctx.lineTo(-3, -3); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, -3); ctx.lineTo(3, -3); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (build === "wizard") {
    // Long arcane robe with embroidered trim.
    drawPlate(ctx, -12, -9, 24, 24, 5, "#3a2470");
    // Robe trim highlight
    ctx.fillStyle = "#7a52d4";
    ctx.fillRect(-12, -10, 24, 2);
    ctx.fillRect(-12, 13, 24, 2);
    // Star sigil on chest
    ctx.fillStyle = "#ffd966";
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      const r = k % 2 === 0 ? 4 : 1.6;
      const px = Math.cos(a) * r, py = 0 + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Sash belt
    ctx.fillStyle = "#1a0f30";
    ctx.fillRect(-12, 7, 24, 4);
    // Buckle
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
  } else if (build === "viper") {
    // Snakeskin leather doublet (dark green) with venom-vial bandolier.
    drawPlate(ctx, -10, -9, 20, 21, 4, "#3f7a36");
    // Scale pattern lines
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-9, -4 + i * 6);
      ctx.lineTo(9, -4 + i * 6);
      ctx.stroke();
    }
    // Belt
    drawPlate(ctx, -11, 7, 22, 4, 1, "#1a2a18");
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
    // Venom vial bandolier (bright green dots across chest)
    ctx.fillStyle = "#b5f05a";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-7 + i * 7, -2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hood collar
    ctx.fillStyle = "#0e1a0c";
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.quadraticCurveTo(0, -4, 8, -8);
    ctx.lineTo(10, -10);
    ctx.quadraticCurveTo(0, -6, -10, -10);
    ctx.closePath();
    ctx.fill();
  } else if (build === "iron") {
    // Breastplate
    drawPlate(ctx, -11, -9, 22, 21, 4, "#9aa0ac");
    // Chest emblem (worm sigil)
    ctx.fillStyle = "#5a6070";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d0d4dc";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.stroke();
    // Armor plate lines
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(10, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 4);  ctx.lineTo(10, 4);  ctx.stroke();
    // Pauldrons
    drawSphere(ctx, -12, -7, 5, "#8a909c", { highlight: "rgba(255,255,255,0.6)", rim: "rgba(255,255,255,0.35)" });
    drawSphere(ctx,  12, -7, 5, "#8a909c", { highlight: "rgba(255,255,255,0.6)", rim: "rgba(255,255,255,0.35)" });
  } else if (build === "tryHard") {
    drawPlate(ctx, -8, -8, 16, 19, 3, "#6a3828");
    ctx.strokeStyle = "rgba(200,56,42,0.85)";
    ctx.lineWidth = 1.8;
    roundRect(ctx, -8.5, -8.5, 17, 20, 3.5); ctx.stroke();
    drawPlate(ctx, -11, 7, 22, 4, 1, "#3a1a14");
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
    ctx.fillStyle = "rgba(255,220,200,0.55)";
    ctx.fillRect(5, 2, 4, 8);
    ctx.fillRect(-9, 2, 4, 8);
  } else if (build === "gambler") {
    drawPlate(ctx, -10, -9, 20, 21, 4, "#26563a");
    ctx.fillStyle = "#ffd966";
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-3, 1);
    ctx.lineTo(3, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    drawPlate(ctx, -11, 7, 22, 4, 1, "#1a3018");
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#d42a2a" : "#111";
      ctx.fillRect(-8 + i * 3, 12, 2, 2);
    }
  } else if (build === "tamer") {
    drawPlate(ctx, -10, -9, 20, 21, 4, "#a08050");
    ctx.strokeStyle = "rgba(60,44,28,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.stroke();
    drawPlate(ctx, -11, 7, 22, 4, 1, "#3a2814");
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
    ctx.strokeStyle = "#4a3016";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-16, 10, 6, 0.2, 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-18, 12, 5, 0.1, 1.2);
    ctx.stroke();
  } else if (build === "balanced") {
    drawPlate(ctx, -10, -9, 20, 21, 4, "#5a6578");
    ctx.fillStyle = "#7a8aa0";
    ctx.fillRect(-8, -6, 16, 2);
    drawPlate(ctx, -11, 7, 22, 4, 1, "#2a3038");
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
  } else {
    drawPlate(ctx, -10, -9, 20, 21, 4, "#b88a4a");
    // Belt
    drawPlate(ctx, -11, 7, 22, 4, 1, "#3a1f0f");
    // Buckle
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-2, 8, 4, 2);
    // Cross-strap
    ctx.fillStyle = "#5a2f0a";
    ctx.beginPath();
    ctx.moveTo(-9, -8); ctx.lineTo(6, 10); ctx.lineTo(9, 10); ctx.lineTo(-6, -8);
    ctx.closePath();
    ctx.fill();
    // Hood collar
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.quadraticCurveTo(0, -4, 8, -8);
    ctx.lineTo(10, -10);
    ctx.quadraticCurveTo(0, -6, -10, -10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- Head ---
  ctx.save();
  ctx.translate(0, bob);
  // Helmet / hood base
  if (build === "wizard") {
    // Skin sphere
    drawSphere(ctx, 0, -14, 7, COLORS.skin, { highlight: "rgba(255,227,176,0.9)", rim: "rgba(255,200,150,0.4)" });
    // Bushy white beard
    ctx.fillStyle = "#e6e6f0";
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.quadraticCurveTo(-7, -2, -3, 2);
    ctx.lineTo(3, 2);
    ctx.quadraticCurveTo(7, -2, 5, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Eyes (just visible above beard)
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-3, -15, 2, 2);
    ctx.fillRect(1, -15, 2, 2);
    // Pointed wizard hat
    ctx.fillStyle = "#231548";
    ctx.beginPath();
    ctx.moveTo(-9, -19);
    ctx.lineTo(2 + Math.sin(anim * 1.5) * 1.2, -32);
    ctx.lineTo(9, -19);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Hat brim
    ctx.fillStyle = "#1a0f30";
    ctx.fillRect(-11, -19, 22, 3);
    // Hat band stars
    ctx.fillStyle = "#ffd966";
    ctx.fillRect(-6, -18, 1.5, 1.5);
    ctx.fillRect(0, -18, 1.5, 1.5);
    ctx.fillRect(6, -18, 1.5, 1.5);
  } else if (build === "viper") {
    // Skin sphere (slightly paler/greener)
    drawSphere(ctx, 0, -14, 7, "#e8c8a0", { highlight: "rgba(220,255,200,0.7)", rim: "rgba(180,240,150,0.4)" });
    // Dark hood
    ctx.fillStyle = "#0e1a0c";
    ctx.beginPath();
    ctx.arc(0, -14, 8.5, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0e1a0c";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood points (peaked over forehead)
    ctx.fillStyle = "#1a2a18";
    ctx.beginPath();
    ctx.moveTo(-8, -19);
    ctx.lineTo(-3, -14);
    ctx.lineTo(-7, -13);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -19);
    ctx.lineTo(3, -14);
    ctx.lineTo(7, -13);
    ctx.closePath();
    ctx.fill();
    // Eyes - venom-yellow slits with glow
    ctx.fillStyle = "#b5f05a";
    ctx.shadowColor = "#b5f05a";
    ctx.shadowBlur = 4;
    ctx.fillRect(-3, -15, 2, 1.5);
    ctx.fillRect(1, -15, 2, 1.5);
    ctx.shadowBlur = 0;
    // Mask line across cheek
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5, -12); ctx.lineTo(5, -12);
    ctx.stroke();
  } else if (build === "iron") {
    // Helmet dome
    drawSphere(ctx, 0, -15, 8, "#a8aeba", { highlight: "rgba(255,255,255,0.8)", rim: "rgba(200,210,230,0.5)" });
    // Visor slit
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-5, -15, 10, 2);
    ctx.fillStyle = "#c21a1a";
    ctx.fillRect(-4, -14.5, 2, 1);
    ctx.fillRect(2, -14.5, 2, 1);
    // Crest plume
    ctx.fillStyle = "#c21a1a";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(5, -18, 3, -14);
    ctx.quadraticCurveTo(-1, -18, 0, -22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (build === "necromancer") {
    drawSphere(ctx, 0, -14, 7, "#c8bcd8", { highlight: "rgba(255,240,255,0.8)", rim: "rgba(140,100,180,0.45)" });
    ctx.fillStyle = "#120618";
    ctx.beginPath();
    ctx.arc(0, -15, 9.2, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#381850";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#8a4ad4";
    ctx.shadowColor = "#d080ff";
    ctx.shadowBlur = 5;
    ctx.fillRect(-4, -15, 2.2, 2.2);
    ctx.fillRect(1.2, -15, 2.2, 2.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0a0408";
    ctx.beginPath();
    ctx.arc(-3, -14.8, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(2.8, -14.8, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(200,200,220,0.4)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-4, -11); ctx.quadraticCurveTo(0, -8, 4, -11); ctx.stroke();
  } else if (build === "balanced") {
    drawSphere(ctx, 0, -14, 7, COLORS.skin, { highlight: "rgba(255,227,176,0.9)", rim: "rgba(255,200,150,0.4)" });
    ctx.fillStyle = "#363d4a";
    ctx.beginPath();
    ctx.arc(0, -14, 8.5, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2a3340";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-3, -15, 2, 2);
    ctx.fillRect(1, -15, 2, 2);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(-3, -15, 1, 1);
    ctx.fillRect(1, -15, 1, 1);
    ctx.fillStyle = "#2a3440";
    ctx.fillRect(-7, -20, 14, 3);
    ctx.strokeStyle = "#ffd966";
    ctx.strokeRect(-8, -20.5, 15, 4);
  } else if (build === "tryHard") {
    drawSphere(ctx, 0, -14, 6.6, COLORS.skin, { highlight: "rgba(255,227,176,0.9)", rim: "rgba(255,200,150,0.4)" });
    ctx.fillStyle = "#c83228";
    ctx.fillRect(-8, -20, 16, 3);
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-3.2, -15.8, 1.9, 1.9);
    ctx.fillRect(1.1, -15.8, 1.9, 1.9);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-2, -11); ctx.lineTo(2, -11); ctx.stroke();
    ctx.strokeStyle = "rgba(240,210,210,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, -6); ctx.lineTo(-6, -12); ctx.stroke();
  } else if (build === "gambler") {
    drawSphere(ctx, 0, -14, 7, "#e8c8a8", { highlight: "rgba(255,240,215,0.85)", rim: "rgba(200,170,140,0.5)" });
    ctx.fillStyle = "#1f4028";
    ctx.beginPath();
    ctx.moveTo(-9, -17);
    ctx.quadraticCurveTo(0, -26, 9, -17);
    ctx.quadraticCurveTo(8, -12, -8, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffd966";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-4, -15.2, 2, 2.2);
    ctx.fillRect(1.8, -15.2, 2, 2.2);
    ctx.fillStyle = "#ffd966";
    ctx.globalAlpha = 0.95;
    ctx.fillRect(-1, -21, 2, 2);
    ctx.globalAlpha = 1;
  } else if (build === "tamer") {
    drawSphere(ctx, 0, -14, 7, COLORS.skin, { highlight: "rgba(255,227,176,0.9)", rim: "rgba(255,200,150,0.35)" });
    ctx.fillStyle = "#786040";
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.lineTo(-2, -24);
    ctx.lineTo(8, -16);
    ctx.quadraticCurveTo(10, -10, -10, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    ctx.fillStyle = "#2a4860";
    ctx.globalAlpha = 0.92;
    ctx.fillRect(-3, -15, 2, 1.8);
    ctx.fillRect(1, -15, 2, 1.8);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(40,110,220,0.8)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(-2, -14.9, 0.65, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(2, -14.9, 0.65, 0, Math.PI * 2); ctx.stroke();
  } else {
    drawSphere(ctx, 0, -14, 7, COLORS.skin, { highlight: "rgba(255,227,176,0.9)", rim: "rgba(255,200,150,0.4)" });
    // Hood outline behind head
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath();
    ctx.arc(0, -14, 8.5, Math.PI, 0, true);
    ctx.closePath();
    ctx.strokeStyle = "#2a1a0a";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Eyes
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-3, -15, 2, 2);
    ctx.fillRect(1, -15, 2, 2);
    // Eye highlights
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(-3, -15, 1, 1);
    ctx.fillRect(1, -15, 1, 1);
  }
  ctx.restore();

  // --- Weapon arm (right hand) ---
  ctx.save();
  ctx.translate(0, bob);
  // Shoulder
  if (build === "iron") {
    // pauldron already drawn with torso
  } else if (build === "wizard") {
    ctx.fillStyle = "#3a2470";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else if (build === "viper") {
    ctx.fillStyle = "#3f7a36";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else if (build === "necromancer") {
    ctx.fillStyle = "#2a1438";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else if (build === "balanced") {
    ctx.fillStyle = "#4a5668";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else if (build === "tryHard") {
    ctx.fillStyle = "#5a3828";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else if (build === "gambler") {
    ctx.fillStyle = "#26563a";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else if (build === "tamer") {
    ctx.fillStyle = "#905040";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  } else {
    ctx.fillStyle = "#b88a4a";
    roundRect(ctx, 8, -5, 5, 10, 1);
    ctx.fill();
  }
  // Hand glove
  let gloveColor = "#2a1a0a";
  if (build === "iron")        gloveColor = "#5a5f6a";
  else if (build === "wizard") gloveColor = "#1a0f30";
  else if (build === "viper")  gloveColor = "#0e1a0c";
  else if (build === "necromancer") gloveColor = "#1a0820";
  else if (build === "balanced") gloveColor = "#282e38";
  else if (build === "tryHard") gloveColor = "#402018";
  else if (build === "gambler") gloveColor = "#142822";
  else if (build === "tamer")   gloveColor = "#3a2614";
  ctx.fillStyle = gloveColor;
  ctx.fillRect(9, 4, 5, 4);
  // Wizard: faint glowing orb floating above hand
  if (build === "wizard") {
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(anim * 0.6));
    ctx.save();
    ctx.shadowColor = "#7a52d4";
    ctx.shadowBlur = 8 * pulse;
    ctx.fillStyle = "rgba(180, 140, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(13, -2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (build === "necromancer") {
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(anim * 0.7));
    ctx.save();
    ctx.shadowColor = "#a060d0";
    ctx.shadowBlur = 6 * pulse;
    ctx.fillStyle = "rgba(120, 80, 160, 0.85)";
    ctx.beginPath();
    ctx.arc(13, -2, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  if (synergyId) {
    const bobSy = Math.abs(Math.sin(anim)) * 0.8;
    drawHeroSynergyLayer(ctx, anim, bobSy, synergyId);
  }

  ctx.restore();
}

/** Glinting weapon / tool held in the right hand when a class+weapon synergy is active. */
function drawHeroSynergyLayer(ctx, anim, bob, synergyId) {
  ctx.save();
  ctx.translate(4, bob);
  const t = anim * 5;
  ctx.globalAlpha = 0.88;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + t * 0.4;
    const pr = 26 + (i % 3) * 3;
    ctx.fillStyle = `rgba(255, 250, 230, ${0.05 + (i % 4) * 0.04})`;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * pr, -10 + Math.sin(ang * 1.3) * pr * 0.4, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = "rgba(255,230,200,0.9)";
  ctx.shadowBlur = 6;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.2;

  if (synergyId === "chainSword") {
    ctx.fillStyle = "#3a1020";
    roundRect(ctx, 12, -6, 26, 10, 2);
    ctx.fill();
    ctx.strokeRect(12, -6, 26, 10);
    ctx.strokeStyle = "#c01a1a";
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(13 + i * 2.1, -4);
      ctx.lineTo(14 + i * 2.1, 3);
      ctx.stroke();
    }
  } else if (synergyId === "monk") {
    ctx.fillStyle = "#ffd9a4";
    ctx.beginPath();
    ctx.arc(19, 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,200,140,0.85)";
    ctx.stroke();
  } else if (synergyId === "scout") {
    ctx.fillStyle = "#654";
    roundRect(ctx, 14, -3, 28, 9, 3);
    ctx.fill();
    ctx.fillStyle = "#8a3";
    ctx.fillRect(39, 2, 8, 6);
  } else if (synergyId === "grimReaper") {
    ctx.strokeStyle = "#a040d0";
    ctx.beginPath();
    ctx.arc(26, 0, 12, -0.4, 1.9);
    ctx.stroke();
    ctx.fillStyle = "#1a0a20";
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.lineTo(18, 22);
    ctx.lineTo(14, 23);
    ctx.closePath();
    ctx.fill();
  } else if (synergyId === "whizid") {
    ctx.fillStyle = "#40e0d8";
    ctx.beginPath();
    ctx.moveTo(16, 12);
    ctx.lineTo(30, -4);
    ctx.lineTo(38, 10);
    ctx.closePath();
    ctx.fill();
  } else if (synergyId === "turretSummoner") {
    ctx.fillStyle = "#8899aa";
    roundRect(ctx, 16, -2, 10, 14, 3);
    ctx.fill();
    ctx.fillStyle = "#ffa020";
    ctx.beginPath();
    ctx.arc(34, 10, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (synergyId === "heavyHitter") {
    ctx.fillStyle = "#5a4836";
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(24, -10);
    ctx.lineTo(30, -8);
    ctx.lineTo(20, 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---- chunky title banner (with backplate for readability) ----
export function drawBanner(ctx, text, cx, y, size = 40, color = COLORS.bile, glow = COLORS.blood) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px "Courier New", monospace`;
  // Outer glow
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y);
  // Second pass (brighter core) to amp it up
  ctx.shadowBlur = 10;
  ctx.fillText(text, cx, y);
  // Outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 2;
  ctx.strokeText(text, cx, y);
  ctx.restore();
}
