/**
 * Life & body (life): keep a creature alive by caring for the part the morpheme names.
 *  - bio: tap the life sparks (water, sun, seeds) so they fly in and the wilting creature blooms.
 *  - gen: tap each egg as it wobbles to hatch a new one, but never a Rot egg.
 *  - cardi: tap in time as each pulse ring reaches the heart, to keep the heartbeat going.
 *  - derm: tap the Rot spots off the creature's skin before they spread.
 *  - neur: a nerve signal races from the brain; tap the hand or foot it reaches just as it arrives.
 *  - ped: step left, right, left, right to walk away from the Rot.
 *  - manu: move the hands to catch the food and dodge the Rot.
 *  - zoo: feed each hungry animal in the zoo, and never the Rot hiding in a pen.
 */

// ── juice (each template keeps its own copy so it stands alone) ──
const font = (px, w = 700) => `${w} ${px}px Lexend, sans-serif`;
const EMOJI = '"Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif';
function text(g, s, x, y, px, color, align = 'center', w = 700) {
  g.font = font(px, w); g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y);
}
function emoji(g, e, x, y, px) { g.font = `${px}px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(e, x, y); }
function makeFx(ctx) {
  const parts = [];
  let last = ctx.t;
  return {
    burst(x, y, color, n = 22, speed = 280) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2; const s = speed * (0.3 + Math.random());
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.5, c: color, r: 3 + Math.random() * 5 });
      }
    },
    draw(g) {
      const dt = Math.min(0.05, ctx.t - last); last = ctx.t;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      }
      g.globalAlpha = 1;
    },
  };
}
function rot(g, x, y, r, t) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(125,255,74,0.88)'; g.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2; const rr = r * (0.8 + 0.2 * Math.sin(t * 7 + i * 2.3));
    if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.fill();
  if (Math.sin(t * 13 + x * 0.1) > 0.55) { g.fillStyle = '#d4ff3a'; g.fillRect(-r * 1.1, -r * 0.2 + Math.sin(t * 40) * r * 0.4, r * 2.2, 4); }
  g.fillStyle = '#0b1a05'; g.beginPath(); g.arc(-r * 0.3, -r * 0.15, r * 0.14, 0, 7); g.arc(r * 0.3, -r * 0.15, r * 0.14, 0, 7); g.fill();
  g.restore();
}
function hud(g, ctx, goal, done, need) {
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, ctx.W, 64);
  const t = ctx.tile;
  if (t.ready) { const h = 44; const w = (t.width / t.height) * h; g.drawImage(t, 16, 10, w, h); }
  // shrink the goal until it fits between the tile and the pips
  const room = ctx.W - 2 * Math.max(130, need * 26 + 30);
  let px = 25; g.font = font(px); while (px > 15 && g.measureText(goal).width > room) { px -= 1; g.font = font(px); }
  text(g, goal, ctx.W / 2, 33, px, '#fff');
  for (let i = 0; i < need; i++) {
    g.beginPath(); g.arc(ctx.W - 26 - (need - 1 - i) * 26, 33, 9, 0, 7);
    g.fillStyle = i < done ? ctx.palette.glow : 'rgba(255,255,255,0.2)'; g.fill();
  }
}
function misses(g, ctx, n) { for (let i = 0; i < 3; i++) rot(g, 30 + i * 34, ctx.H - 36, i < n ? 13 : 5, ctx.t + i); }
const keyIn = (set, ks) => ks.some((k) => set.has(k));
function cursor(ctx) {
  const c = { x: ctx.W / 2, y: 300, on: false };
  c.update = (dt) => {
    const i = ctx.input;
    const dx = (keyIn(i.keys, ['ArrowRight', 'd']) ? 1 : 0) - (keyIn(i.keys, ['ArrowLeft', 'a']) ? 1 : 0);
    const dy = (keyIn(i.keys, ['ArrowDown', 's']) ? 1 : 0) - (keyIn(i.keys, ['ArrowUp', 'w']) ? 1 : 0);
    if (dx || dy) { c.on = true; c.x = Math.max(30, Math.min(ctx.W - 30, c.x + dx * 560 * dt)); c.y = Math.max(90, Math.min(ctx.H - 30, c.y + dy * 560 * dt)); }
    const taps = i.taps.map((t) => ({ x: t.x, y: t.y }));
    if (taps.length) c.on = false;
    if (i.pressed.has(' ')) { c.on = true; taps.push({ x: c.x, y: c.y }); }
    return taps;
  };
  c.draw = (g) => { if (!c.on) return; g.strokeStyle = '#ffe14d'; g.lineWidth = 4; g.beginPath(); g.arc(c.x, c.y, 38, 0, 7); g.stroke(); };
  return c;
}
// The creature: a round friend with hands, feet and a heart. health 0..1 fades it toward grey.
function creature(g, ctx, x, y, s, o = {}) {
  const h = o.health ?? 1;
  const col = h > 0.5 ? ctx.palette.glow : h > 0.25 ? '#b8b08a' : '#8a8a8a';
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col;
  const lf = o.leftFoot || 0; const rf = o.rightFoot || 0;
  g.beginPath(); g.ellipse(-40, 92 - lf * 16, 30, 16, 0, 0, 7); g.ellipse(40, 92 - rf * 16, 30, 16, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(-100, 10 - (o.leftHand || 0) * 30, 22, 0, 7); g.arc(100, 10 - (o.rightHand || 0) * 30, 22, 0, 7); g.fill();
  const bg = g.createRadialGradient(-30, -40, 10, 0, 0, 100);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.3, col); bg.addColorStop(1, h > 0.5 ? ctx.palette.accent : '#555');
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, 92, 0, 7); g.fill();
  g.fillStyle = '#10131c'; const blink = Math.sin(ctx.t * 1.3) > 0.97 ? 0.15 : 1;
  g.beginPath(); g.ellipse(-30, -22, 10, 14 * blink, 0, 0, 7); g.ellipse(30, -22, 10, 14 * blink, 0, 0, 7); g.fill();
  g.strokeStyle = '#10131c'; g.lineWidth = 5; g.beginPath();
  if (h > 0.5) g.arc(0, 8, 22, 0.2, Math.PI - 0.2); else g.arc(0, 34, 18, Math.PI + 0.3, -0.3);
  g.stroke();
  if (o.heart) { const k = o.heart; g.fillStyle = '#ff3b5c'; g.save(); g.translate(0, 48); g.scale(k, k); g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-24, -10, -10, -26, 0, -12); g.bezierCurveTo(10, -26, 24, -10, 0, 8); g.fill(); g.restore(); }
  g.restore();
}
function backdrop(g, ctx, a, b) {
  const bg = g.createLinearGradient(0, 0, 0, ctx.H); bg.addColorStop(0, a); bg.addColorStop(1, b); g.fillStyle = bg; g.fillRect(0, 0, ctx.W, ctx.H);
}

const MODE = { bio: 'bio', gen: 'gen', cardi: 'heart', derm: 'skin', neur: 'nerve', ped: 'feet', manu: 'hands', zoo: 'zoo' };
const HOW = {
  bio: 'means life: tap the water, sun and seeds so they fly in and bring the creature back to life.',
  gen: 'means birth: tap each egg as it wobbles to hatch it, but leave the green Rot eggs alone.',
  heart: 'means heart: tap each time a pulse ring reaches the heart to keep it beating.',
  skin: 'means skin: tap the Rot spots off the creature’s skin before they spread.',
  nerve: 'means nerve: tap the hand or foot just as the nerve signal reaches it.',
  feet: 'means foot: step left, right, left, right to walk away from the Rot.',
  hands: 'means hand: move the hands to catch the food and dodge the Rot.',
  zoo: 'means animal: feed each hungry animal, and never the Rot hiding in a pen.',
};
const VERB = {
  bio: 'You brought it to life.', gen: 'You helped new ones get born.', heart: 'You kept its heart beating.',
  skin: 'You healed its skin.', nerve: 'You sent the signal down every nerve.', feet: 'You walked it to safety, foot by foot.',
  hands: 'You caught the food with both hands.', zoo: 'You fed every animal.',
};

export default {
  seconds: 30,
  howTo(m) { return `${m.text} ${HOW[MODE[m.id] || 'bio']}`; },
  verb(m) { return VERB[MODE[m.id] || 'bio']; },
  start(ctx) {
    const mode = MODE[ctx.id] || 'bio';
    return { bio: bioGame, gen: genGame, heart: heartGame, skin: skinGame, nerve: nerveGame, feet: feetGame, hands: handsGame, zoo: zooGame }[mode](ctx);
  },
};

// bio: tap the life sparks.
function bioGame(ctx) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx); const cur = cursor(ctx);
  const need = [5, 7, 9][tier];
  const cx = W / 2; const cy = 300;
  let done = 0; let miss = 0; let spawnIn = 0; const floats = [];
  const LIFE = ['💧', '☀️', '🌱', '🍎'];
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ floats });
  return {
    update(dt) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = [0.9, 0.75, 0.6][tier];
        const left = rnd() < 0.5; const isRot = rnd() < [0.2, 0.33, 0.42][tier];
        floats.push({ e: LIFE[Math.floor(rnd() * LIFE.length)], rot: isRot, x: left ? -30 : W + 30, y: 120 + rnd() * 330, vx: (left ? 1 : -1) * (90 + rnd() * 60) * (1 + tier * 0.25), vy: (rnd() - 0.5) * 40, fly: 0 });
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        if (f.fly) { f.fly += dt; f.x += (cx - f.x) * dt * 8; f.y += (cy - f.y) * dt * 8; if (f.fly > 0.35) { floats.splice(i, 1); fx.burst(cx, cy, palette.glow, 14); } continue; }
        f.x += f.vx * dt; f.y += f.vy * dt + Math.sin(ctx.t * 3 + i) * 20 * dt;
        if (f.x < -60 || f.x > W + 60) floats.splice(i, 1);
      }
      for (const t of cur.update(dt)) {
        const f = floats.find((o) => !o.fly && Math.hypot(o.x - t.x, o.y - t.y) < 42);
        if (!f) continue;
        if (f.rot) { floats.splice(floats.indexOf(f), 1); miss += 1; ctx.sfx.bad(); fx.burst(f.x, f.y, '#7dff4a', 14, 160); if (miss >= 3) { ctx.lose('rot'); return; } }
        else { f.fly = 0.001; done += 1; ctx.sfx.pickup(); if (done >= need) { fx.burst(cx, cy, palette.glow, 40); ctx.win(); return; } }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#183a2a', '#06140c');
      const life = done / need;
      for (let i = 0; i < Math.floor(life * 8); i++) { const a = (i / 8) * Math.PI * 2 + ctx.t * 0.2; emoji(g, '🌸', cx + Math.cos(a) * 130, cy + Math.sin(a) * 120, 28); }
      creature(g, ctx, cx, cy, 0.9 + life * 0.25, { health: 0.2 + life });
      floats.forEach((f) => { if (f.rot) rot(g, f.x, f.y, 26, ctx.t); else { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(f.x, f.y, 32, 0, 7); g.fill(); emoji(g, f.e, f.x, f.y, 40); } });
      cur.draw(g); fx.draw(g);
      hud(g, ctx, 'Tap the life sparks to bring it to life', done, need);
      text(g, 'Tap 💧☀️🌱🍎 · never the Rot · or arrows and SPACE', W / 2, H - 34, 16, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// gen: hatch the wobbling eggs.
function genGame(ctx) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx); const cur = cursor(ctx);
  const need = [3, 5, 6][tier];
  const wobbleFor = [1.8, 1.3, 0.9][tier];
  const eggs = Array.from({ length: 5 }, (_, i) => ({ x: 170 + i * 155, y: 350, state: 'sleep', t: rnd() * 1.5 + 0.5 * i, rot: false, chick: 0 }));
  let done = 0; let miss = 0;
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ eggs });
  return {
    update(dt) {
      eggs.forEach((e) => {
        e.t -= dt;
        if (e.state === 'sleep' && e.t <= 0) { e.state = 'wobble'; e.rot = tier > 0 && rnd() < 0.3; e.t = wobbleFor; }
        else if (e.state === 'wobble' && e.t <= 0) { e.state = 'sleep'; e.t = 0.8 + rnd() * 2; }
        else if (e.state === 'hatched' && e.t <= 0) { e.state = 'sleep'; e.t = 1 + rnd() * 1.5; }
        e.chick = Math.max(0, e.chick - dt);
      });
      for (const t of cur.update(dt)) {
        const e = eggs.find((o) => Math.abs(o.x - t.x) < 60 && Math.abs(o.y - t.y) < 80);
        if (!e || e.state === 'hatched') continue;
        if (e.state === 'wobble' && !e.rot) {
          e.state = 'hatched'; e.t = 1.2; e.chick = 1.2; done += 1; ctx.sfx.pickup(); fx.burst(e.x, e.y, palette.glow, 24); fx.burst(e.x, e.y, '#fff', 10);
          if (done >= need) { ctx.win(); return; }
        } else {
          miss += 1; ctx.sfx.bad(); fx.burst(e.x, e.y, '#7dff4a', 12, 150);
          if (e.rot) { e.state = 'sleep'; e.t = 1.5; }
          if (miss >= 3) { ctx.lose('rot'); return; }
        }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#3a2a14', '#120c04');
      g.fillStyle = '#8a5a2a'; g.fillRect(80, 400, W - 160, 40);
      for (let x = 90; x < W - 90; x += 22) { g.strokeStyle = '#c08a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 400); g.lineTo(x + 18, 440); g.stroke(); }
      eggs.forEach((e) => {
        if (e.state === 'hatched') { emoji(g, '🐣', e.x, e.y - e.chick * 20, 64); return; }
        const wob = e.state === 'wobble' ? Math.sin(ctx.t * 24) * 0.25 : 0;
        g.save(); g.translate(e.x, e.y + 40); g.rotate(wob); g.translate(0, -40);
        g.fillStyle = e.state === 'wobble' && e.rot ? '#9cff6a' : '#fff6e0';
        g.beginPath(); g.ellipse(0, 0, 44, 58, 0, 0, 7); g.fill();
        if (e.state === 'wobble' && e.rot) { g.fillStyle = '#2e7a1a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i * 2.1) * 22, Math.sin(i * 1.7) * 30, 6, 0, 7); g.fill(); } }
        else { g.fillStyle = 'rgba(160,120,60,0.35)'; g.beginPath(); g.arc(-12, -14, 6, 0, 7); g.arc(14, 10, 5, 0, 7); g.fill(); }
        if (e.state === 'wobble' && !e.rot) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-30, -6); g.lineTo(-12, 4); g.lineTo(2, -8); g.lineTo(16, 4); g.lineTo(30, -6); g.stroke(); }
        g.restore();
      });
      emoji(g, '🐔', W - 110, 170, 70);
      cur.draw(g); fx.draw(g);
      hud(g, ctx, 'Hatch each egg while it wobbles', done, need);
      text(g, 'Tap a wobbling egg · never a green Rot egg', W / 2, H - 34, 16, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// cardi: tap as the pulse ring meets the heart.
function heartGame(ctx) {
  const { W, H, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const need = [5, 6, 8][tier];
  const beat = [1.0, 0.85, 0.65][tier];
  const travel = 1.3;
  const tol = [0.17, 0.12, 0.08][tier];
  const cx = W / 2; const cy = 300; const hy = cy + 44;
  let done = 0; let miss = 0; let next = 0.5; let pump = 0; let health = 0.5;
  const rings = [];
  const ANY = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ rings, travel });
  return {
    update(dt) {
      pump = Math.max(0, pump - dt * 4);
      next -= dt; if (next <= 0) { rings.push({ t: 0 }); next = beat; }
      rings.forEach((r) => { r.t += dt; });
      for (let i = rings.length - 1; i >= 0; i--) if (rings[i].t > travel + tol) { rings.splice(i, 1); health = Math.max(0, health - 0.12); if (tier === 2) { miss += 1; ctx.sfx.bad(); if (miss >= 3) { ctx.lose('rot'); return; } } }
      if (ctx.input.taps.length || ANY.some((k) => ctx.input.pressed.has(k))) {
        const r = rings.find((o) => Math.abs(o.t - travel) <= tol);
        if (r) {
          rings.splice(rings.indexOf(r), 1); done += 1; pump = 1; health = Math.min(1, health + 0.15); ctx.sfx.tick();
          fx.burst(cx, hy, '#ff3b5c', 14, 200);
          if (done >= need) { fx.burst(cx, cy, palette.glow, 40); ctx.win(); return; }
        } else { miss += 1; ctx.sfx.bad(); health = Math.max(0, health - 0.15); if (miss >= 3) { ctx.lose('rot'); return; } }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#3a0f1e', '#12040a');
      // the heartbeat line
      g.strokeStyle = 'rgba(255,90,122,0.4)'; g.lineWidth = 3; g.beginPath();
      for (let x = 0; x <= W; x += 6) { const k = ((x / W) * 4 + ctx.t * 1.2) % 1; const y = 140 + (k > 0.45 && k < 0.5 ? -40 : k > 0.5 && k < 0.55 ? 30 : 0); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
      creature(g, ctx, cx, cy, 1.1, { health, heart: 1.6 + pump * 0.8 });
      rings.forEach((r) => {
        const k = 1 - r.t / travel; const rad = 26 + Math.max(0, k) * 260;
        g.strokeStyle = Math.abs(r.t - travel) <= tol ? '#ffe14d' : 'rgba(255,90,122,0.8)'; g.lineWidth = 6;
        g.beginPath(); g.arc(cx, hy, rad, 0, 7); g.stroke();
      });
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.arc(cx, hy, 26, 0, 7); g.stroke(); g.setLineDash([]);
      rot(g, cx + 190, cy - 110, 16 + (1 - health) * 20, ctx.t);
      fx.draw(g);
      hud(g, ctx, 'Keep the heart beating: tap as the ring hits it', done, need);
      text(g, 'TAP or SPACE when the ring reaches the heart', W / 2, H - 34, 16, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// derm: heal the Rot spots on the skin.
function skinGame(ctx) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx); const cur = cursor(ctx);
  const need = [6, 8, 10][tier];
  const grow = [6, 9, 13][tier];
  const cx = W / 2; const cy = 310; const S = 1.6;
  let done = 0; let miss = 0; let spawnIn = 0.3; const spots = []; const patches = [];
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ spots });
  return {
    update(dt) {
      spawnIn -= dt;
      if (spawnIn <= 0 && spots.length < 5) {
        spawnIn = [1.0, 0.8, 0.6][tier];
        const a = rnd() * Math.PI * 2; const d = 30 + rnd() * 100;
        spots.push({ x: cx + Math.cos(a) * d * 1.1, y: cy + Math.sin(a) * d, r: 8 });
      }
      for (let i = spots.length - 1; i >= 0; i--) {
        const s = spots[i]; s.r += grow * dt;
        if (s.r > 44) { spots.splice(i, 1); miss += 1; ctx.sfx.rot(); fx.burst(s.x, s.y, '#7dff4a', 18, 200); if (miss >= 3) { ctx.lose('rot'); return; } }
      }
      patches.forEach((p) => { p.t -= dt; });
      for (const t of cur.update(dt)) {
        const s = spots.find((o) => Math.hypot(o.x - t.x, o.y - t.y) < o.r + 22);
        if (!s) continue;
        spots.splice(spots.indexOf(s), 1); patches.push({ x: s.x, y: s.y, t: 1 }); done += 1; ctx.sfx.pickup();
        fx.burst(s.x, s.y, palette.glow, 16);
        if (done >= need) { ctx.win(); return; }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#2a1a30', '#0c0610');
      creature(g, ctx, cx, cy, S, { health: 1 - miss * 0.25 });
      patches.forEach((p) => { if (p.t > 0) { g.globalAlpha = p.t; emoji(g, '✨', p.x, p.y, 34); g.globalAlpha = 1; } });
      spots.forEach((s) => rot(g, s.x, s.y, s.r, ctx.t + s.x));
      cur.draw(g); fx.draw(g);
      hud(g, ctx, 'Heal the skin: tap the Rot spots off', done, need);
      text(g, 'Tap the spots before they get big · or arrows and SPACE', W / 2, H - 36, 15, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// neur: tap the limb the nerve signal reaches.
function nerveGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const need = [4, 5, 6][tier];
  const travel = [1.1, 0.85, 0.6][tier];
  const late = 0.32;
  const cx = W / 2; const cy = 320;
  const brain = { x: cx, y: 120 };
  const LIMBS = [
    { name: 'left hand', x: cx - 150, y: cy + 10, key: ['ArrowLeft', 'a'] },
    { name: 'right hand', x: cx + 150, y: cy + 10, key: ['ArrowRight', 'd'] },
    { name: 'foot', x: cx + 55, y: cy + 140, key: ['ArrowDown', 's'] },
  ];
  let done = 0; let miss = 0; let sig = null; let wait = 0.6; const twitch = [0, 0, 0];
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ sig, travel, LIMBS });
  const path = (i, k) => { const L = LIMBS[i]; const mx = (brain.x + L.x) / 2 + (i === 2 ? 60 : 0); const my = cy - 60; const u = 1 - k; return { x: u * u * brain.x + 2 * u * k * mx + k * k * L.x, y: u * u * brain.y + 2 * u * k * my + k * k * L.y }; };
  function fire(i) {
    if (!sig) return;
    const k = sig.t / travel;
    if (i === sig.limb && k >= 0.82) {
      twitch[i] = 1; done += 1; ctx.sfx.pickup(); fx.burst(LIMBS[i].x, LIMBS[i].y, palette.glow, 20); sig = null; wait = 0.35 + rnd() * 0.4;
      if (done >= need) ctx.win();
    } else { miss += 1; ctx.sfx.bad(); fx.burst(LIMBS[i].x, LIMBS[i].y, '#7dff4a', 10, 150); sig = null; wait = 0.6; if (miss >= 3) ctx.lose('rot'); }
  }
  return {
    update(dt) {
      twitch.forEach((v, i) => { twitch[i] = Math.max(0, v - dt * 3); });
      if (!sig) { wait -= dt; if (wait <= 0) sig = { limb: Math.floor(rnd() * 3), t: 0 }; }
      else { sig.t += dt; if (sig.t > travel + late) { miss += 1; ctx.sfx.bad(); sig = null; wait = 0.6; if (miss >= 3) { ctx.lose('rot'); return; } } }
      LIMBS.forEach((L, i) => { if (keyIn(input.pressed, L.key)) fire(i); });
      for (const t of input.taps) { const i = LIMBS.findIndex((L) => Math.hypot(L.x - t.x, L.y - t.y) < 70); if (i >= 0) fire(i); }
    },
    draw(g) {
      backdrop(g, ctx, '#101a3a', '#03060f');
      creature(g, ctx, cx, cy, 1.25, { leftHand: twitch[0], rightHand: twitch[1], rightFoot: twitch[2] });
      // brain and nerves
      emoji(g, '🧠', brain.x, brain.y, 60);
      LIMBS.forEach((L, i) => {
        g.strokeStyle = sig && sig.limb === i ? '#ffe14d' : 'rgba(255,225,77,0.3)'; g.lineWidth = sig && sig.limb === i ? 5 : 3;
        g.beginPath(); for (let k = 0; k <= 1.001; k += 0.05) { const p = path(i, k); if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } g.stroke();
        const ready = sig && sig.limb === i && sig.t / travel >= 0.82;
        g.strokeStyle = ready ? '#4ade80' : 'rgba(255,255,255,0.35)'; g.lineWidth = ready ? 6 : 3; g.beginPath(); g.arc(L.x, L.y, 40, 0, 7); g.stroke();
        text(g, ['◀', '▶', '▼'][i], L.x + (i === 0 ? -64 : i === 1 ? 64 : 0), L.y + (i === 2 ? 60 : 0), 20, 'rgba(255,255,255,0.6)');
      });
      if (sig) { const p = path(sig.limb, Math.min(1, sig.t / travel)); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 12, 0, 7); g.fill(); fx.burst(p.x, p.y, '#ffe14d', 1, 40); }
      rot(g, W - 90, 140 + Math.sin(ctx.t) * 20, 20, ctx.t);
      fx.draw(g);
      hud(g, ctx, 'Tap the hand or foot as the signal arrives', done, need);
      text(g, 'Tap it when it glows green · or ◀ ▶ ▼', W / 2, H - 36, 15, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// ped: left, right, left, right.
function feetGame(ctx) {
  const { W, H, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const goal = 760; const stepLen = 40;
  const rotSpeed = [22, 34, 48][tier];
  let x = 120; let last = null; let lf = 0; let rf = 0; let stumble = 0; let rotX = -40; let steps = 0; let winT = 0;
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ last, stumble });
  function step(foot) {
    if (stumble > 0) return;
    if (foot === last) { stumble = 0.45; ctx.sfx.bad(); fx.burst(x, 420, '#7dff4a', 8, 120); return; }
    last = foot; x += stepLen; steps += 1; ctx.sfx.step();
    if (foot === 'L') lf = 1; else rf = 1;
    fx.burst(x + (foot === 'L' ? -20 : 20), 432, palette.glow, 5, 90);
    if (x >= goal) { winT = 0.001; ctx.sfx.pickup(); fx.burst(x, 300, palette.glow, 40); }
  }
  return {
    update(dt) {
      if (winT > 0) { winT += dt; if (winT > 0.5) ctx.win(); return; }
      lf = Math.max(0, lf - dt * 4); rf = Math.max(0, rf - dt * 4); stumble = Math.max(0, stumble - dt);
      rotX += rotSpeed * dt * (1 + ctx.t * 0.04);
      if (rotX > x - 70) { ctx.lose('rot'); return; }
      if (keyIn(input.pressed, ['ArrowLeft', 'a'])) step('L');
      if (keyIn(input.pressed, ['ArrowRight', 'd'])) step('R');
      for (const t of input.taps) if (t.y > 440) step(t.x < W / 2 ? 'L' : 'R');
    },
    draw(g) {
      backdrop(g, ctx, '#3a5a8a', '#a0c4e8');
      g.fillStyle = '#6a8a4a'; g.fillRect(0, 400, W, 140);
      for (let px = 0; px < W; px += 60) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(px, 420, 30, 6); }
      emoji(g, '🏁', goal + 60, 360, 60);
      g.fillStyle = 'rgba(125,255,74,0.25)'; g.fillRect(0, 140, Math.max(0, rotX), 300);
      rot(g, rotX, 330, 54, ctx.t);
      creature(g, ctx, x, 330 + (stumble > 0 ? Math.sin(ctx.t * 40) * 4 : -Math.max(lf, rf) * 6), 0.7, { leftFoot: lf, rightFoot: rf });
      // the two foot buttons
      [['L', 'LEFT FOOT ◀', W / 2 - 170], ['R', '▶ RIGHT FOOT', W / 2 + 170]].forEach(([f, label, bx]) => {
        const next = last !== f;
        g.fillStyle = next ? 'rgba(255,225,77,0.85)' : 'rgba(255,255,255,0.2)'; g.beginPath(); g.roundRect(bx - 140, 452, 280, 52, 14); g.fill();
        text(g, label, bx, 478, 20, next ? '#2a1a02' : '#fff');
      });
      fx.draw(g);
      hud(g, ctx, 'Step LEFT, RIGHT to outwalk the Rot', Math.floor((x - 120) / (goal - 120) * 6), 6);
      text(g, '◀ ▶ arrow keys, or tap the feet in turn', W / 2, 92, 15, 'rgba(255,255,255,0.85)', 'center', 400);
    },
    destroy() {},
  };
}

// manu: catch food with the hands.
function handsGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const need = [5, 7, 9][tier];
  const fall = [150, 200, 260][tier];
  const FOOD = ['🍎', '🍌', '🥕', '🍓', '🥪', '🍪'];
  let hx = W / 2; let done = 0; let miss = 0; let spawnIn = 0.3; const drops = []; let clap = 0;
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ drops, hx });
  return {
    update(dt) {
      clap = Math.max(0, clap - dt * 4);
      const d = (keyIn(input.keys, ['ArrowRight', 'd']) ? 1 : 0) - (keyIn(input.keys, ['ArrowLeft', 'a']) ? 1 : 0);
      if (d) hx += d * 520 * dt; else if (input.down) hx += (input.x - hx) * Math.min(1, dt * 12);
      for (const t of input.taps) hx = t.x;
      hx = Math.max(90, Math.min(W - 90, hx));
      spawnIn -= dt;
      if (spawnIn <= 0) { spawnIn = [0.95, 0.75, 0.6][tier]; drops.push({ x: 80 + rnd() * (W - 160), y: 70, rot: rnd() < [0.2, 0.3, 0.4][tier], e: FOOD[Math.floor(rnd() * FOOD.length)], vy: fall * (0.85 + rnd() * 0.3) }); }
      for (let i = drops.length - 1; i >= 0; i--) {
        const o = drops[i]; o.y += o.vy * dt;
        if (o.y > 400 && o.y < 450 && Math.abs(o.x - hx) < 80) {
          drops.splice(i, 1); clap = 1;
          if (o.rot) { miss += 1; ctx.sfx.bad(); fx.burst(o.x, o.y, '#7dff4a', 14, 150); if (miss >= 3) { ctx.lose('rot'); return; } }
          else { done += 1; ctx.sfx.pickup(); fx.burst(o.x, o.y, palette.glow, 16); if (done >= need) { ctx.win(); return; } }
        } else if (o.y > H + 30) drops.splice(i, 1);
      }
    },
    draw(g) {
      backdrop(g, ctx, '#2a3a5a', '#0a1020');
      drops.forEach((o) => { if (o.rot) rot(g, o.x, o.y, 24, ctx.t + o.x); else emoji(g, o.e, o.x, o.y, 44); });
      creature(g, ctx, hx, 520, 0.8, {});
      // two big hands, cupped
      g.fillStyle = palette.glow;
      [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(hx + s * (56 - clap * 14), 430, 40, 26, s * 0.4, 0, 7); g.fill(); });
      emoji(g, '🤲', hx, 420, 50);
      fx.draw(g);
      hud(g, ctx, 'Catch the food with your hands', done, need);
      text(g, 'Drag, tap or ◀ ▶ to move the hands · dodge the Rot', W / 2, 90, 15, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// zoo: feed the hungry animals.
function zooGame(ctx) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx); const cur = cursor(ctx);
  const need = [5, 7, 9][tier];
  const patience = [3.2, 2.6, 2.0][tier];
  const ANIMALS = ['🐘', '🦒', '🐒', '🦁', '🐧', '🦓'];
  const pens = ANIMALS.map((e, i) => ({ e, x: 170 + (i % 3) * 310, y: i < 3 ? 200 : 390, state: 'full', t: 1 + rnd() * 3, munch: 0 }));
  let done = 0; let miss = 0;
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ pens });
  return {
    update(dt) {
      pens.forEach((p) => {
        p.t -= dt; p.munch = Math.max(0, p.munch - dt);
        if (p.state === 'full' && p.t <= 0) {
          if (tier > 0 && rnd() < 0.25) { p.state = 'rot'; p.t = 2; } else { p.state = 'hungry'; p.t = patience; }
        } else if (p.state === 'hungry' && p.t <= 0) { p.state = 'full'; p.t = 2 + rnd() * 2; miss += 1; ctx.sfx.bad(); if (miss >= 3) ctx.lose('rot'); }
        else if (p.state === 'rot' && p.t <= 0) { p.state = 'full'; p.t = 1 + rnd() * 2; }
      });
      for (const t of cur.update(dt)) {
        const p = pens.find((o) => Math.abs(o.x - t.x) < 130 && Math.abs(o.y - t.y) < 80);
        if (!p) continue;
        if (p.state === 'hungry') { p.state = 'full'; p.t = 2 + rnd() * 3; p.munch = 0.8; done += 1; ctx.sfx.pickup(); fx.burst(p.x, p.y, palette.glow, 18); if (done >= need) { ctx.win(); return; } }
        else if (p.state === 'rot') { p.state = 'full'; p.t = 2; miss += 1; ctx.sfx.bad(); fx.burst(p.x, p.y, '#7dff4a', 14, 160); if (miss >= 3) { ctx.lose('rot'); return; } }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#4a7a3a', '#2a4a1a');
      pens.forEach((p) => {
        g.fillStyle = 'rgba(255,240,200,0.25)'; g.beginPath(); g.roundRect(p.x - 135, p.y - 80, 270, 160, 18); g.fill();
        g.strokeStyle = '#7a5528'; g.lineWidth = 4; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(p.x + k * 60, p.y + 50); g.lineTo(p.x + k * 60, p.y + 80); g.stroke(); }
        g.beginPath(); g.moveTo(p.x - 135, p.y + 60); g.lineTo(p.x + 135, p.y + 60); g.stroke();
        if (p.state === 'rot') { rot(g, p.x, p.y, 40, ctx.t); emoji(g, '🍖', p.x + 70, p.y - 50, 26); return; }
        const hungry = p.state === 'hungry';
        g.globalAlpha = hungry ? 0.55 + 0.45 * (p.t / patience) : 1;
        emoji(g, p.e, p.x, p.y + (p.munch > 0 ? Math.sin(ctx.t * 30) * 4 : 0), 70);
        g.globalAlpha = 1;
        if (hungry) {
          g.fillStyle = '#fff'; g.beginPath(); g.roundRect(p.x + 40, p.y - 78, 56, 44, 12); g.fill();
          emoji(g, '🍖', p.x + 68, p.y - 56, 26);
          g.fillStyle = '#ff5a7a'; g.fillRect(p.x - 60, p.y - 70, 90 * (p.t / patience), 8);
        }
        if (p.munch > 0) emoji(g, '💛', p.x - 50, p.y - 50, 26);
      });
      cur.draw(g); fx.draw(g);
      hud(g, ctx, 'Feed the hungry animals', done, need);
      text(g, 'Tap an animal that wants food · never the Rot', W / 2, H - 36, 15, 'rgba(255,255,255,0.8)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}
