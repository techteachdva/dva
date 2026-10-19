/**
 * Every texture is drawn on a canvas at runtime: no image files to fetch on a school network.
 *
 * Morpheme faces carry two non-colour cues:
 *   shape = type    prefix has a pin on its right, suffix a socket on its left,
 *                   base is a square keystone, a linking vowel is a pill, a Lingo word is a paper tag
 *   look  = origin  amber CRT glass (Anglo-Saxon), grey marble (Latin), holo blue (Greek), lined paper (Lingo)
 */

import { THREE } from './renderer.js';
import { morph } from '../data/morphemes.js';

const cache = new Map();
export const TYPE_COLOR = { pfx: '#39d0ff', base: '#ffd23f', sfx: '#ff4fd8', link: '#9dff7a', word: '#f4f4ef' };
export const ORIGIN_ACCENT = { anglo: '#ffb000', latin: '#cfd6e2', greek: '#38b6ff', lingo: '#2f6fde' };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function seeded(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Fill the face background for an origin style, clipped to the current path. */
function paintOrigin(ctx, origin, x, y, w, h, seed) {
  const rnd = seeded(seed);
  if (origin === 'anglo') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#3a2104');
    g.addColorStop(1, '#140900');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffb000';
    for (let yy = y; yy < y + h; yy += 5) ctx.fillRect(x, yy, w, 1.5);
    ctx.restore();
  } else if (origin === 'latin') {
    ctx.fillStyle = '#c7cad1';
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(80,84,92,${0.15 + rnd() * 0.3})`;
      ctx.lineWidth = 1 + rnd() * 2.5;
      ctx.beginPath();
      const sx = x + rnd() * w;
      ctx.moveTo(sx, y);
      ctx.bezierCurveTo(sx + (rnd() - 0.5) * 120, y + h * 0.3, sx + (rnd() - 0.5) * 120, y + h * 0.7, sx + (rnd() - 0.5) * 80, y + h);
      ctx.stroke();
    }
    ctx.restore();
  } else if (origin === 'greek') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(12,70,160,0.95)');
    g.addColorStop(0.5, 'rgba(40,150,255,0.85)');
    g.addColorStop(1, 'rgba(10,60,140,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#bff0ff';
    for (let i = -h; i < w; i += 18) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.fillStyle = '#fbfbf4';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(70,120,220,0.45)';
    ctx.lineWidth = 1.5;
    for (let yy = y + 22; yy < y + h; yy += 20) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,60,60,0.6)';
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + 20, y + h);
    ctx.stroke();
    ctx.restore();
  }
}

const TEXT_STYLE = {
  anglo: { fill: '#ffd36b', glow: '#ffb000', stroke: null },
  latin: { fill: '#1d2129', glow: null, stroke: 'rgba(255,255,255,0.6)' },
  greek: { fill: '#ffffff', glow: '#7fe0ff', stroke: null },
  lingo: { fill: '#20242c', glow: null, stroke: null },
};

/**
 * Draw a morpheme tile. `spec` is a morpheme id or { text, type, origin }.
 * Returns { texture, aspect } where aspect = width / height of the drawn tile.
 */
export function morphemeTexture(spec, { blank = false, dim = false } = {}) {
  const m = typeof spec === 'string' ? morph(spec) : spec;
  const key = `m:${m.type}:${m.origin}:${m.text}:${blank}:${dim}`;
  if (cache.has(key)) return cache.get(key);
  const H = 160;
  const label = blank ? '—' : m.text;
  const bodyW = Math.max(150, 64 + label.length * 54);
  const bump = 34;
  const W = bodyW + bump * 2;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const x = bump;
  const y = 14;
  const h = H - 28;
  const w = bodyW;

  // Silhouette by type.
  ctx.save();
  if (m.type === 'link') rr(ctx, x + 10, y, w - 20, h, h / 2);
  else if (m.type === 'word') {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - 26, y);
    ctx.lineTo(x + w, y + 26);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else rr(ctx, x, y, w, h, m.type === 'base' ? 6 : 18);
  if (m.type === 'pfx') {
    ctx.moveTo(x + w, y + h / 2);
    ctx.arc(x + w, y + h / 2, 26, -Math.PI / 2, Math.PI / 2);
  }
  paintOrigin(ctx, m.origin, 0, 0, W, H, m.text);
  ctx.restore();

  // Suffix socket: cut a half-circle notch out of the left edge.
  if (m.type === 'sfx') {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y + h / 2, 26, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.restore();
  }

  // Type stripe and border.
  ctx.save();
  if (m.type === 'link') rr(ctx, x + 10, y, w - 20, h, h / 2);
  else rr(ctx, x, y, w, h, m.type === 'base' ? 6 : 18);
  ctx.lineWidth = m.type === 'base' ? 7 : 5;
  ctx.strokeStyle = TYPE_COLOR[m.type];
  ctx.globalAlpha = dim ? 0.4 : 1;
  ctx.stroke();
  ctx.restore();
  if (m.type === 'base') {
    ctx.strokeStyle = TYPE_COLOR.base;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
    ctx.globalAlpha = 1;
  }
  if (m.type === 'pfx') {
    ctx.beginPath();
    ctx.arc(x + w, y + h / 2, 26, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = TYPE_COLOR.pfx;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  if (m.type === 'sfx') {
    ctx.beginPath();
    ctx.arc(x, y + h / 2, 26, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = TYPE_COLOR.sfx;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // Text.
  const ts = TEXT_STYLE[m.origin] || TEXT_STYLE.lingo;
  ctx.font = `800 ${label.length > 8 ? 62 : 76}px "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tx = x + w / 2 + (m.type === 'sfx' ? 10 : m.type === 'pfx' ? -6 : 0);
  if (ts.glow) { ctx.shadowColor = ts.glow; ctx.shadowBlur = 18; }
  ctx.globalAlpha = dim || blank ? 0.45 : 1;
  ctx.fillStyle = ts.fill;
  ctx.fillText(label, tx, y + h / 2 + 4);
  ctx.shadowBlur = 0;
  if (ts.stroke) { ctx.strokeStyle = ts.stroke; ctx.lineWidth = 1.2; ctx.strokeText(label, tx, y + h / 2 + 4); }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const out = { texture, aspect: W / H };
  cache.set(key, out);
  return out;
}

/** A plain CSS-ready data URL of a morpheme tile, for DOM inventories. */
export function morphemeDataUrl(id) {
  const { texture } = morphemeTexture(id);
  return texture.image.toDataURL();
}

export function patternTexture(pattern, color) {
  const key = `p:${pattern}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  const base = new THREE.Color(color);
  const dark = `#${base.clone().multiplyScalar(0.55).getHexString()}`;
  const light = `#${base.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString()}`;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = dark;
  ctx.fillStyle = dark;
  if (pattern === 'stripes') {
    ctx.lineWidth = 12;
    for (let i = -128; i < 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke(); }
  } else if (pattern === 'dots') {
    for (let yy = 12; yy < 128; yy += 26) for (let xx = (yy / 26) % 2 ? 24 : 12; xx < 128; xx += 26) { ctx.beginPath(); ctx.arc(xx, yy, 6, 0, Math.PI * 2); ctx.fill(); }
  } else if (pattern === 'checker') {
    for (let yy = 0; yy < 128; yy += 32) for (let xx = (yy / 32) % 2 ? 32 : 0; xx < 128; xx += 64) ctx.fillRect(xx, yy, 32, 32);
  } else if (pattern === 'circuit') {
    ctx.lineWidth = 4;
    ctx.strokeStyle = light;
    const r = seeded(color + pattern);
    for (let i = 0; i < 9; i++) {
      const sx = Math.floor(r() * 8) * 16;
      const sy = Math.floor(r() * 8) * 16;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 32, sy);
      ctx.lineTo(sx + 32, sy + 32);
      ctx.stroke();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(sx + 32, sy + 32, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'glow') {
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 80);
    g.addColorStop(0, light);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  } else if (pattern === 'camo') {
    const r = seeded(color);
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = `rgba(60,64,72,${0.2 + r() * 0.3})`;
      ctx.beginPath();
      const sx = r() * 128;
      ctx.moveTo(sx, 0);
      ctx.bezierCurveTo(sx + 40, 40, sx - 40, 80, sx + 10, 128);
      ctx.stroke();
    }
  } else if (pattern === 'chrome') {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, light);
    g.addColorStop(0.45, color);
    g.addColorStop(0.55, dark);
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function faceTexture(pattern, color) {
  const key = `f:${pattern}:${color}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#05060c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const eye = (x, y, r = 10) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const star = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr2 = i % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
    }
    ctx.fill();
  };
  const heart = (cx, cy, s) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx - s * 1.2, cy - s * 0.2, cx - s * 0.5, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.1, cx + s * 1.2, cy - s * 0.2, cx, cy + s * 0.7);
    ctx.fill();
  };
  const smile = () => { ctx.beginPath(); ctx.arc(64, 74, 22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); };
  switch (pattern) {
    case 'visor': ctx.fillRect(18, 44, 92, 18); ctx.fillRect(48, 86, 32, 6); break;
    case 'pixel': ctx.fillRect(34, 40, 16, 16); ctx.fillRect(78, 40, 16, 16); ctx.fillRect(38, 80, 52, 10); ctx.fillRect(30, 72, 10, 10); ctx.fillRect(88, 72, 10, 10); break;
    case 'cat':
      ctx.beginPath(); ctx.moveTo(30, 54); ctx.lineTo(42, 42); ctx.lineTo(54, 54); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(74, 54); ctx.lineTo(86, 42); ctx.lineTo(98, 54); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(44, 80); ctx.quadraticCurveTo(54, 92, 64, 80); ctx.quadraticCurveTo(74, 92, 84, 80); ctx.stroke();
      break;
    case 'shades': ctx.shadowBlur = 0; ctx.fillStyle = '#111'; rr(ctx, 22, 40, 36, 22, 6); ctx.fill(); rr(ctx, 70, 40, 36, 22, 6); ctx.fill(); ctx.fillStyle = color; ctx.fillRect(56, 46, 16, 5); ctx.fillRect(28, 44, 10, 4); ctx.fillRect(76, 44, 10, 4); smile(); break;
    case 'stars': star(42, 52, 16); star(86, 52, 16); smile(); break;
    case 'hearts': heart(42, 52, 14); heart(86, 52, 14); smile(); break;
    case 'mono': eye(44, 52, 9); ctx.beginPath(); ctx.arc(86, 52, 16, 0, Math.PI * 2); ctx.stroke(); eye(86, 52, 7); ctx.beginPath(); ctx.moveTo(100, 62); ctx.lineTo(108, 96); ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 7; smile(); break;
    case 'glasses': ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(42, 52, 16, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(86, 52, 16, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(58, 52); ctx.lineTo(70, 52); ctx.stroke(); eye(42, 52, 5); eye(86, 52, 5); ctx.lineWidth = 7; smile(); break;
    case 'glitch': ctx.fillStyle = '#ff2a6d'; ctx.fillRect(30, 40, 18, 18); ctx.fillStyle = '#05d9e8'; ctx.fillRect(36, 44, 18, 18); ctx.fillStyle = color; ctx.fillRect(78, 42, 18, 18); ctx.fillRect(30, 84, 30, 6); ctx.fillRect(66, 80, 32, 6); break;
    default: eye(44, 52); eye(84, 52); smile();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** A crisp text label drawn to a sprite that always faces the camera. */
export function labelSprite(text, { color = '#ffffff', bg = 'rgba(8,6,20,0.82)', border = null, size = 46, height = 0.42 } = {}) {
  const pad = 22;
  const c0 = canvas(8, 8).getContext('2d');
  c0.font = `700 ${size}px "Segoe UI", Roboto, Arial, sans-serif`;
  const tw = Math.ceil(c0.measureText(text).width);
  const c = canvas(tw + pad * 2, size + pad * 1.4);
  const ctx = c.getContext('2d');
  rr(ctx, 2, 2, c.width - 4, c.height - 4, 14);
  ctx.fillStyle = bg;
  ctx.fill();
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 4; ctx.stroke(); }
  ctx.font = `700 ${size}px "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(height * (c.width / c.height), height, 1);
  s.renderOrder = 10;
  return s;
}

/** A flat screen texture with a few lines of text (terminals, arcade cabinets, plaques). */
export function screenTexture(lines, { fg = '#5cf2ff', bg = '#03060c', w = 256, h = 160, font = 30, border = null } = {}) {
  const key = `s:${lines.join('|')}:${fg}:${bg}:${w}:${h}:${font}:${border}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8); }
  ctx.fillStyle = fg;
  ctx.shadowColor = fg;
  ctx.shadowBlur = bg === 'transparent' ? 0 : 10;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${font}px "Segoe UI", Roboto, Arial, sans-serif`;
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * font * 1.25));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
