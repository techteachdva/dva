/**
 * Fallback minigame, used by any family that has no template file yet: the meaning drifts
 * apart into word bubbles among decoys from other morphemes, and you tap its words back
 * together in order. Every family should replace this with a game where you DO the meaning.
 */

import { MORPHEMES } from '../data/morphemes.js';

const words = (s) => s.replace(/[;,()]/g, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 4);

export default {
  seconds: 30,
  howTo: (m) => `Tap the words of its meaning in order: “${words(m.meaning).join(' ')}”. Dodge the Rot's decoys.`,
  verb: (m) => `You put its meaning back together: ${m.meaning}.`,
  start(ctx) {
    const { W, H, rnd, palette } = ctx;
    const need = words(ctx.m.meaning);
    const decoyPool = Object.values(MORPHEMES).filter((x) => x.meaning !== ctx.m.meaning && x.origin !== 'lingo').flatMap((x) => words(x.meaning))
      .filter((w) => !need.includes(w));
    const decoys = Array.from({ length: 3 + ctx.tier * 2 }, () => decoyPool[Math.floor(rnd() * decoyPool.length)]);
    const speed = 50 + ctx.tier * 35;
    const bubbles = [...need.map((w, i) => ({ w, order: i })), ...decoys.map((w) => ({ w, order: -1 }))].map((b) => ({
      ...b, x: 80 + rnd() * (W - 160), y: 140 + rnd() * (H - 200), vx: (rnd() - 0.5) * speed, vy: (rnd() - 0.5) * speed, r: 26 + b.w.length * 7, done: false,
    }));
    let next = 0;
    let shake = 0;
    return {
      update(dt) {
        bubbles.forEach((b) => {
          if (b.done) return;
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
          if (b.y < 120 + b.r || b.y > H - b.r) b.vy *= -1;
        });
        shake = Math.max(0, shake - dt * 3);
        for (const t of ctx.input.taps) {
          const hit = bubbles.find((b) => !b.done && Math.hypot(t.x - b.x, t.y - b.y) < b.r);
          if (!hit) continue;
          if (hit.order === next) { hit.done = true; next += 1; ctx.sfx.tick(); if (next === need.length) ctx.win(); }
          else { shake = 1; ctx.sfx.bad(); if (hit.order < 0) { hit.vx *= 1.6; hit.vy *= 1.6; } }
        }
      },
      draw(g) {
        g.translate(Math.sin(shake * 30) * 6 * shake, 0);
        if (ctx.tile.ready) { const h = 70; const w = (ctx.tile.width / ctx.tile.height) * h; g.drawImage(ctx.tile, W / 2 - w / 2, 18, w, h); }
        g.font = '700 22px Lexend, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = palette.ink;
        g.fillText(need.map((w, i) => (i < next ? w : '___')).join(' '), W / 2, 112);
        bubbles.forEach((b) => {
          if (b.done) return;
          g.beginPath();
          g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fill();
          g.lineWidth = 3;
          g.strokeStyle = palette.glow;
          g.stroke();
          g.fillStyle = palette.ink;
          g.font = '700 20px Lexend, sans-serif';
          g.fillText(b.w, b.x, b.y + 7);
        });
      },
    };
  },
};
