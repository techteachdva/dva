/**
 * Break & cut (rupt): burst through three walls to free the packet. Each wall shows a crack,
 * and only a hit on the crack breaks it. A Rot blob crawls to the crack to seal it, and a
 * swing that misses the crack only speeds the Rot up. Brick, then marble, then the Rot's own
 * glass, whose cracks slide around.
 */

// ── Shared bits (each minigame file stands alone) ──────────────────
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const font = (px, w = 700) => `${w} ${px}px Lexend, sans-serif`;
const has = (k, ...names) => names.some((n) => k.has(n));
const axis = (k) => ({ x: has(k, 'ArrowRight', 'd') - has(k, 'ArrowLeft', 'a'), y: has(k, 'ArrowDown', 's') - has(k, 'ArrowUp', 'w') });
function sparks() {
  const ps = [];
  let last = null;
  return {
    burst(x, y, c, n = 18, sp = 260) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU; const v = sp * (0.3 + Math.random() * 0.7);
        ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.25, life: 0.45 + Math.random() * 0.4, c, r: 2 + Math.random() * 3.5 });
      }
    },
    draw(g, t) {
      const dt = last == null ? 0 : clamp(t - last, 0, 0.05);
      last = t;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        g.globalAlpha = clamp(p.life * 2, 0, 1);
        g.fillStyle = p.c;
        g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      g.globalAlpha = 1;
    },
  };
}
/** The Rot: a green, glitchy blob with eyes. */
function rot(g, x, y, r, t, seed = 0) {
  g.save();
  g.translate(x, y);
  const jx = Math.sin(t * 17 + seed * 5) > 0.9 ? Math.sin(t * 91) * r * 0.25 : 0;
  g.fillStyle = 'rgba(90,255,120,0.18)';
  g.beginPath(); g.arc(0, 0, r * 1.35, 0, TAU); g.fill();
  g.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU;
    const rr = r * (1 + 0.13 * Math.sin(a * 3 + t * 4 + seed) + 0.07 * Math.sin(a * 5 - t * 7));
    g.lineTo(Math.cos(a) * rr + jx, Math.sin(a) * rr * 0.9);
  }
  g.closePath();
  g.fillStyle = '#39d353';
  g.fill();
  g.fillStyle = 'rgba(8,70,24,0.5)';
  g.fillRect(-r + jx * 2, Math.sin(t * 9 + seed) * r * 0.4, r * 2, r * 0.16);
  for (const s of [-1, 1]) {
    g.fillStyle = '#eafff0';
    g.beginPath(); g.arc(s * r * 0.32, -r * 0.15, r * 0.2, 0, TAU); g.fill();
    g.fillStyle = '#0b2a12';
    g.beginPath(); g.arc(s * r * 0.32 + Math.sin(t * 2 + seed) * r * 0.06, -r * 0.12, r * 0.09, 0, TAU); g.fill();
  }
  g.restore();
}
function tileAt(g, ctx, x, y, h) {
  if (!ctx.tile.ready) return;
  const w = (ctx.tile.width / ctx.tile.height) * h;
  g.drawImage(ctx.tile, x - w / 2, y - h / 2, w, h);
}
function hint(g, text, y = 36, c = '#ffffff') {
  g.font = font(22);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.strokeText(text, 480, y);
  g.fillStyle = c;
  g.fillText(text, 480, y);
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const WALLS = [
  { name: 'BRICK', face: '#8a4b3a', line: '#5a2c22' },
  { name: 'MARBLE', face: '#c9ccd6', line: '#8e93a3' },
  { name: 'ROT GLASS', face: 'rgba(40,120,60,0.85)', line: '#0f3d1b' },
];
const BOX = { x: 250, y: 110, w: 460, h: 340 };

export default {
  seconds: 38,
  howTo: () => 'Hit each wall right on its glowing crack (tap it, or aim with the arrows and press Space) before the Rot seals it.',
  verb: () => 'You burst through all three walls.',
  start(ctx) {
    const { tier, rnd, input } = ctx;
    const fx = sparks();
    const hps = [[2, 3, 4], [3, 4, 5], [4, 5, 6]][tier];
    const hitR = [62, 46, 36][tier];
    const gooSp = [45, 70, 95][tier];
    let wall = 0; let hp = hps[0]; let crack = null; let respawn = 0.3; let shake = 0; let swing = null; let cool = 0;
    let slide = 0; let freed = 0; let pendingAvoid = null; let lastDraw = 0;
    const ret = { x: 480, y: 280 };
    let lastPtr = { x: input.x, y: input.y };
    let fractures = []; let patches = []; let chunks = [];
    const inBox = (x, y, pad = 50) => ({ x: clamp(x, BOX.x + pad, BOX.x + BOX.w - pad), y: clamp(y, BOX.y + pad, BOX.y + BOX.h - pad) });
    const edge = () => {
      const s = Math.floor(rnd() * 4);
      if (s === 0) return { x: BOX.x + rnd() * BOX.w, y: BOX.y };
      if (s === 1) return { x: BOX.x + rnd() * BOX.w, y: BOX.y + BOX.h };
      if (s === 2) return { x: BOX.x, y: BOX.y + rnd() * BOX.h };
      return { x: BOX.x + BOX.w, y: BOX.y + rnd() * BOX.h };
    };
    const newCrack = (avoid) => {
      let p;
      for (let i = 0; i < 20; i++) { p = inBox(BOX.x + rnd() * BOX.w, BOX.y + rnd() * BOX.h); if (!avoid || Math.hypot(p.x - avoid.x, p.y - avoid.y) > 150) break; }
      let goo = edge();
      for (let i = 0; i < 6 && Math.hypot(goo.x - p.x, goo.y - p.y) < 180; i++) goo = edge();
      const legs = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * TAU + rnd() * 0.6, l: 20 + rnd() * 22 }));
      crack = { ...p, goo, legs, age: 0, vx: wall === 2 ? (rnd() < 0.5 ? -1 : 1) * [25, 45, 60][tier] : 0, vy: wall === 2 ? (rnd() < 0.5 ? -1 : 1) * [20, 35, 50][tier] : 0 };
    };
    const fracture = (x, y) => {
      for (let i = 0; i < 4; i++) {
        let a = rnd() * TAU; let px = x; let py = y; const pts = [{ x, y }];
        for (let j = 0; j < 4; j++) { a += (rnd() - 0.5) * 0.9; px += Math.cos(a) * (18 + rnd() * 26); py += Math.sin(a) * (18 + rnd() * 26); pts.push(inBox(px, py, 2)); }
        fractures.push(pts);
      }
    };
    const burstWall = () => {
      const W = WALLS[wall];
      for (let i = 0; i < 26; i++) {
        chunks.push({ x: BOX.x + rnd() * BOX.w, y: BOX.y + rnd() * BOX.h, vx: (rnd() - 0.5) * 700, vy: -200 - rnd() * 400, r: rnd() * TAU, vr: (rnd() - 0.5) * 10, s: 18 + rnd() * 30, c: W.face, life: 1.4 });
      }
      fx.burst(480, 280, ctx.palette.accent, 30, 360);
      shake = 0.6;
      fractures = []; patches = []; crack = null;
      wall += 1;
      if (wall >= WALLS.length) { freed = 0.01; ctx.sfx.good(); ctx.win(); return; }
      ctx.sfx.pickup();
      hp = hps[wall]; slide = 1; respawn = 0.8;
    };
    const strike = (x, y) => {
      if (cool > 0 || slide > 0 || wall >= WALLS.length) return;
      cool = 0.18; swing = { x, y, t: 0.16 };
      if (crack && Math.hypot(x - crack.x, y - crack.y) < hitR) {
        hp -= 1; shake = 0.3; fracture(crack.x, crack.y);
        fx.burst(crack.x, crack.y, WALLS[wall].face === 'rgba(40,120,60,0.85)' ? '#7dffa0' : WALLS[wall].face, 16, 300);
        ctx.sfx.click();
        const at = { x: crack.x, y: crack.y };
        crack = null;
        if (hp <= 0) burstWall(); else { respawn = 0.25; pendingAvoid = at; }
      } else {
        fx.burst(x, y, '#9aa0b5', 6, 120);
        cool = 0.5; // a thunk on solid wall bounces the hammer back
        if (crack) { const dx = crack.x - crack.goo.x; const dy = crack.y - crack.goo.y; const d = Math.hypot(dx, dy) || 1; const k = Math.min(40, d - 1) / d; crack.goo.x += dx * k; crack.goo.y += dy * k; }
      }
    };
    return {
      peek: () => ({ wall, hp, crack: crack && { x: crack.x, y: crack.y, goo: { ...crack.goo } }, slide, ret: { ...ret }, cool, hitR }),
      update(dt) {
        dt = Math.min(dt, 0.05);
        cool -= dt; shake = Math.max(0, shake - dt * 2); slide = Math.max(0, slide - dt * 2.2);
        if (swing && (swing.t -= dt) <= 0) swing = null;
        // aim
        if (input.x !== lastPtr.x || input.y !== lastPtr.y) { ret.x = input.x; ret.y = input.y; lastPtr = { x: input.x, y: input.y }; }
        const a = axis(input.keys);
        ret.x = clamp(ret.x + a.x * 480 * dt, 0, 960); ret.y = clamp(ret.y + a.y * 480 * dt, 0, 540);
        for (const t of input.taps) { ret.x = t.x; ret.y = t.y; strike(t.x, t.y); }
        if (input.pressed.has(' ')) strike(ret.x, ret.y);
        if (wall >= WALLS.length) return;
        if (!crack && slide <= 0 && (respawn -= dt) <= 0) { newCrack(pendingAvoid); pendingAvoid = null; }
        if (crack) {
          crack.age += dt;
          if (crack.vx || crack.vy) {
            crack.x += crack.vx * dt; crack.y += crack.vy * dt;
            if (crack.x < BOX.x + 50 || crack.x > BOX.x + BOX.w - 50) crack.vx *= -1;
            if (crack.y < BOX.y + 50 || crack.y > BOX.y + BOX.h - 50) crack.vy *= -1;
          }
          const dx = crack.x - crack.goo.x; const dy = crack.y - crack.goo.y; const d = Math.hypot(dx, dy);
          if (d < 12) {
            patches.push({ x: crack.x, y: crack.y, r: 26 + rnd() * 10 });
            fx.burst(crack.x, crack.y, '#39d353', 10, 140); ctx.sfx.bad();
            pendingAvoid = { x: crack.x, y: crack.y }; crack = null; respawn = 0.35;
          } else { crack.goo.x += (dx / d) * gooSp * dt; crack.goo.y += (dy / d) * gooSp * dt; }
        }
      },
      draw(g) {
        const t = ctx.t;
        g.save();
        if (shake > 0) g.translate(Math.sin(t * 70) * 10 * shake, Math.cos(t * 53) * 6 * shake);
        // the trapped packet behind the walls
        const pr = 60 + Math.sin(t * 3) * 4 + (freed ? 30 : 0);
        g.fillStyle = ctx.palette.accent; g.globalAlpha = 0.25;
        g.beginPath(); g.arc(480, 280, pr + 40, 0, TAU); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#20263a';
        rrect(g, 480 - pr, 280 - pr, pr * 2, pr * 2, 18); g.fill();
        g.strokeStyle = ctx.palette.accent; g.lineWidth = 4; g.stroke();
        tileAt(g, ctx, 480, 280, pr * 0.7);
        if (wall < WALLS.length) {
          const W = WALLS[wall];
          g.save();
          g.translate(0, -slide * 420);
          g.fillStyle = W.face;
          g.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
          g.strokeStyle = W.line; g.lineWidth = 3;
          if (wall === 0) {
            for (let r = 0; r < 9; r++) {
              const y = BOX.y + r * 38;
              g.beginPath(); g.moveTo(BOX.x, y); g.lineTo(BOX.x + BOX.w, y); g.stroke();
              for (let x = BOX.x + (r % 2 ? 38 : 0); x < BOX.x + BOX.w; x += 76) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 38); g.stroke(); }
            }
          } else if (wall === 1) {
            g.lineWidth = 2;
            for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(BOX.x, BOX.y + 30 + i * 50); g.bezierCurveTo(BOX.x + 150, BOX.y + i * 47, BOX.x + 300, BOX.y + 80 + i * 40, BOX.x + BOX.w, BOX.y + 20 + i * 52); g.stroke(); }
          } else {
            g.fillStyle = 'rgba(160,255,190,0.15)';
            for (let i = 0; i < 6; i++) g.fillRect(BOX.x, BOX.y + ((t * 80 + i * 61) % BOX.h), BOX.w, 6);
          }
          g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
          for (const f of fractures) { g.beginPath(); f.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
          for (const p of patches) { g.fillStyle = '#2fae47'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
          g.lineWidth = 6; g.strokeStyle = '#3a4160'; g.strokeRect(BOX.x, BOX.y, BOX.w, BOX.h);
          if (crack) {
            const glow = 0.6 + 0.4 * Math.sin(t * 10);
            g.strokeStyle = `rgba(255,${wall === 2 ? 120 : 220},80,${glow})`; g.lineWidth = 5;
            for (const l of crack.legs) {
              g.beginPath(); g.moveTo(crack.x, crack.y);
              g.lineTo(crack.x + Math.cos(l.a) * l.l * 0.5 + 6, crack.y + Math.sin(l.a) * l.l * 0.5 - 4);
              g.lineTo(crack.x + Math.cos(l.a) * l.l, crack.y + Math.sin(l.a) * l.l); g.stroke();
            }
            g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.setLineDash([6, 8]);
            g.beginPath(); g.arc(crack.x, crack.y, hitR, 0, TAU); g.stroke(); g.setLineDash([]);
            g.strokeStyle = 'rgba(57,211,83,0.5)'; g.lineWidth = 8;
            g.beginPath(); g.moveTo(crack.goo.x, crack.goo.y); g.lineTo(crack.goo.x - (crack.x - crack.goo.x) * 0.15, crack.goo.y - (crack.y - crack.goo.y) * 0.15); g.stroke();
            rot(g, crack.goo.x, crack.goo.y, 18, t, 2);
          }
          g.restore();
          g.font = font(18); g.textAlign = 'left'; g.fillStyle = '#fff';
          g.fillText(`WALL ${wall + 1} / 3 · ${W.name}`, BOX.x, BOX.y + BOX.h + 26);
          for (let i = 0; i < hps[wall]; i++) { g.fillStyle = i < hps[wall] - hp ? ctx.palette.accent : 'rgba(255,255,255,0.25)'; g.fillRect(BOX.x + BOX.w - 24 - i * 30, BOX.y + BOX.h + 14, 22, 14); }
        }
        const d = clamp(t - lastDraw, 0, 0.05); lastDraw = t;
        for (const c of chunks) {
          c.vy += 900 * d; c.x += c.vx * d; c.y += c.vy * d; c.r += c.vr * d; c.life -= d;
          if (c.life <= 0) continue;
          g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillStyle = c.c;
          g.beginPath(); g.moveTo(-c.s / 2, -c.s / 3); g.lineTo(c.s / 2, -c.s / 2); g.lineTo(c.s / 3, c.s / 2); g.lineTo(-c.s / 2, c.s / 3); g.closePath(); g.fill();
          g.restore();
        }
        chunks = chunks.filter((c) => c.life > 0);
        g.restore();
        fx.draw(g, t);
        // hammer and aim
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.arc(ret.x, ret.y, 14, 0, TAU); g.moveTo(ret.x - 22, ret.y); g.lineTo(ret.x + 22, ret.y); g.moveTo(ret.x, ret.y - 22); g.lineTo(ret.x, ret.y + 22); g.stroke();
        if (swing) {
          g.save(); g.translate(swing.x, swing.y); g.rotate(-0.9 + (1 - swing.t / 0.16) * 0.9);
          g.fillStyle = '#9fc6ff'; g.fillRect(-6, -90, 12, 80); g.fillStyle = '#cfd6e2'; g.fillRect(-28, -108, 56, 30);
          g.restore();
        }
        hint(g, wall < WALLS.length ? 'Hit the CRACK to break the wall!' : 'BURST!');
      },
      destroy() {},
    };
  },
};
