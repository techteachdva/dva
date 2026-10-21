/**
 * Join up (join): together is the win.
 *  - con, syn: pieces drift away from the core; tap each one to snap it back before it escapes.
 *  - homo: the same, but only pieces of the SAME kind as the core may join; let the others go.
 *  - kai: tap two things that go together (bread AND butter) to link them with "and".
 *  - soci: herd the wandering companions into one group around the campfire.
 *  - o, i: two word parts slide apart and back; drop the linking vowel in when the gap fits it.
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
function keyDir(input) {
  return { x: (keyIn(input.keys, ['ArrowRight', 'd']) ? 1 : 0) - (keyIn(input.keys, ['ArrowLeft', 'a']) ? 1 : 0), y: (keyIn(input.keys, ['ArrowDown', 's']) ? 1 : 0) - (keyIn(input.keys, ['ArrowUp', 'w']) ? 1 : 0) };
}
// A keyboard cursor for tap games: arrows move it, SPACE taps under it.
function cursor(ctx) {
  const c = { x: ctx.W / 2, y: 300, on: false };
  c.update = (dt) => {
    const d = keyDir(ctx.input);
    if (d.x || d.y) { c.on = true; c.x = Math.max(30, Math.min(ctx.W - 30, c.x + d.x * 560 * dt)); c.y = Math.max(90, Math.min(ctx.H - 30, c.y + d.y * 560 * dt)); }
    const taps = ctx.input.taps.map((t) => ({ x: t.x, y: t.y }));
    if (taps.length) c.on = false;
    if (ctx.input.pressed.has(' ')) { c.on = true; taps.push({ x: c.x, y: c.y }); }
    return taps;
  };
  c.draw = (g) => { if (!c.on) return; g.strokeStyle = '#ffe14d'; g.lineWidth = 4; g.beginPath(); g.arc(c.x, c.y, 38, 0, 7); g.stroke(); };
  return c;
}
function backdrop(g, ctx, a, b) {
  const bg = g.createRadialGradient(ctx.W / 2, 300, 30, ctx.W / 2, 300, 620);
  bg.addColorStop(0, a); bg.addColorStop(1, b); g.fillStyle = bg; g.fillRect(0, 0, ctx.W, ctx.H);
}

const MODE = { con: 'pull', syn: 'pull', homo: 'same', kai: 'pair', soci: 'herd', o: 'glue', i: 'glue' };
const HOW = {
  con: 'means together: tap the pieces drifting away to snap them back onto the core.',
  syn: 'means together: tap the notes drifting away to bring them back into one chord.',
  homo: 'means same: snap back only the pieces that are the same as the core, and let the rest float off.',
  kai: 'means and: tap two things that go together to link them with “and”.',
  soci: 'means a group: herd the wanderers into one group around the campfire.',
  o: 'is the glue between two Greek parts: drop it in when the gap is just the right size.',
  i: 'is the glue between two Latin parts: drop it in when the gap is just the right size.',
};
const VERB = {
  con: 'You brought the pieces together.', syn: 'You brought the notes together.', homo: 'You joined only the same kind.',
  kai: 'You linked this AND that.', soci: 'You gathered a group.', o: 'You glued the parts with o.', i: 'You glued the parts with i.',
};

export default {
  seconds: 30,
  howTo(m) { return `${m.text} ${HOW[m.id] || HOW.con}`; },
  verb(m) { return VERB[m.id] || VERB.con; },
  start(ctx) {
    const mode = MODE[ctx.id] || 'pull';
    if (mode === 'pair') return pairGame(ctx);
    if (mode === 'herd') return herdGame(ctx);
    if (mode === 'glue') return glueGame(ctx);
    return pullGame(ctx, mode === 'same');
  },
};

// con / syn / homo: snap drifting pieces back onto the core.
const KINDS = [
  { name: 'triangles', color: '#ff7a59', draw: (g, r) => { g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.9, r * 0.7); g.lineTo(-r * 0.9, r * 0.7); g.closePath(); } },
  { name: 'circles', color: '#5ab0ff', draw: (g, r) => { g.beginPath(); g.arc(0, 0, r * 0.85, 0, 7); } },
  { name: 'squares', color: '#ffd84d', draw: (g, r) => { g.beginPath(); g.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5); } },
];
function pullGame(ctx, same) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const cur = cursor(ctx);
  const need = [5, 6, 8][tier];
  const drift = [55, 80, 110][tier];
  const every = [1.3, 1.0, 0.8][tier];
  const cx = W / 2; const cy = 300; const coreR = 54;
  const kind = Math.floor(rnd() * KINDS.length);
  const look = ctx.id === 'syn' ? '🎵' : null;
  let done = 0; let miss = 0; let spawnIn = 0.2;
  const pieces = [];
  function spawn() {
    const a = rnd() * Math.PI * 2;
    const k = same ? (rnd() < 0.5 ? kind : (kind + 1 + Math.floor(rnd() * 2)) % 3) : kind;
    pieces.push({ x: cx + Math.cos(a) * (coreR + 20), y: cy + Math.sin(a) * (coreR + 20), vx: Math.cos(a) * drift, vy: Math.sin(a) * drift, k, state: 'loose', t: 0, slot: 0, spin: rnd() * 6 });
  }
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ pieces, kind, same });
  const slotPos = (i) => { const a = (i / need) * Math.PI * 2 - Math.PI / 2; return { x: cx + Math.cos(a) * (coreR + 34), y: cy + Math.sin(a) * (coreR + 34) }; };
  return {
    update(dt) {
      spawnIn -= dt;
      if (spawnIn <= 0 && pieces.filter((p) => p.state === 'loose').length < 6) { spawn(); spawnIn = every; }
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i]; p.t += dt; p.spin += dt;
        if (p.state === 'loose') {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < -30 || p.x > W + 30 || p.y < 50 || p.y > H + 30) {
            pieces.splice(i, 1);
            if (!same || p.k === kind) { miss += 1; ctx.sfx.rot(); if (miss >= 3) { ctx.lose('rot'); return; } }
          }
        } else if (p.state === 'home') {
          const s = slotPos(p.slot); p.x += (s.x - p.x) * Math.min(1, dt * 10); p.y += (s.y - p.y) * Math.min(1, dt * 10);
        } else if (p.state === 'bounce') { p.x += p.vx * dt * 3; p.y += p.vy * dt * 3; if (p.t > 0.6) pieces.splice(i, 1); }
      }
      for (const t of cur.update(dt)) {
        const p = pieces.filter((o) => o.state === 'loose').sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
        if (!p || Math.hypot(p.x - t.x, p.y - t.y) > 52) continue;
        if (!same || p.k === kind) {
          p.state = 'home'; p.slot = done; done += 1; ctx.sfx.pickup();
          fx.burst(p.x, p.y, palette.glow, 14); fx.burst(cx, cy, '#fff', 8, 160);
          if (done >= need) { fx.burst(cx, cy, palette.glow, 40); ctx.win(); return; }
        } else { p.state = 'bounce'; p.t = 0; miss += 1; ctx.sfx.bad(); fx.burst(p.x, p.y, '#7dff4a', 10, 150); if (miss >= 3) { ctx.lose('rot'); return; } }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#1d2a52', '#070a14');
      // the Rot waits at the edges
      for (let i = 0; i < 6; i++) rot(g, i < 3 ? 20 : W - 20, 130 + (i % 3) * 160 + Math.sin(ctx.t + i) * 20, 24, ctx.t + i);
      // the core
      const cg = g.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, coreR);
      cg.addColorStop(0, '#fff'); cg.addColorStop(0.4, palette.glow); cg.addColorStop(1, palette.accent);
      g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, coreR, 0, 7); g.fill();
      if (same) { g.save(); g.translate(cx, cy); KINDS[kind].draw(g, 30); g.fillStyle = KINDS[kind].color; g.fill(); g.restore(); }
      else if (ctx.tile.ready) { const h = 34; const w = (ctx.tile.width / ctx.tile.height) * h; g.drawImage(ctx.tile, cx - w / 2, cy - h / 2, w, h); }
      pieces.forEach((p) => {
        if (p.state === 'home') { g.strokeStyle = palette.glow; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(p.x, p.y); g.stroke(); }
        g.save(); g.translate(p.x, p.y); g.globalAlpha = p.state === 'bounce' ? 1 - p.t / 0.6 : 1;
        if (look) { emoji(g, look, 0, 0, 40); } else {
          g.rotate(p.spin); KINDS[p.k].draw(g, 24); g.fillStyle = KINDS[p.k].color; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
        }
        g.restore();
      });
      cur.draw(g);
      fx.draw(g);
      hud(g, ctx, same ? `Snap back only the ${KINDS[kind].name}` : ctx.id === 'syn' ? 'Bring the notes back together' : 'Snap the pieces back together', done, need);
      text(g, 'Tap a piece before it escapes · or arrows and SPACE', W / 2, H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// kai: link two things that go together with "and".
const PAIRS = [['🍞', '🧈'], ['🧦', '👟'], ['🍪', '🥛'], ['🐝', '🌼'], ['🔑', '🔒'], ['✏️', '📄'], ['⚽', '🥅'], ['🌧️', '☂️'], ['🐟', '🍟'], ['🍦', '🍒'], ['🎸', '🎤'], ['🐶', '🦴']];
function pairGame(ctx) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const cur = cursor(ctx);
  const need = [3, 4, 5][tier];
  const nPairs = [2, 3, 4][tier];
  const drift = [30, 55, 85][tier];
  let done = 0; let miss = 0; let things = []; let picked = null; let linked = []; let deck = [...PAIRS].sort(() => rnd() - 0.5); let di = 0;
  function add() {
    const pr = deck[di % deck.length]; di += 1;
    pr.forEach((e) => things.push({ e, pair: pr, x: 100 + rnd() * (W - 200), y: 130 + rnd() * 280, vx: (rnd() - 0.5) * drift * 2, vy: (rnd() - 0.5) * drift * 2, shake: 0 }));
  }
  for (let i = 0; i < nPairs; i++) add();
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ things, picked });
  return {
    update(dt) {
      things.forEach((o) => {
        o.x += o.vx * dt; o.y += o.vy * dt; o.shake = Math.max(0, o.shake - dt * 3);
        if (o.x < 60 || o.x > W - 60) o.vx *= -1;
        if (o.y < 110 || o.y > H - 130) o.vy *= -1;
      });
      linked.forEach((l) => { l.t += dt; });
      linked = linked.filter((l) => l.t < 1.2);
      for (const t of cur.update(dt)) {
        const o = things.find((q) => Math.hypot(q.x - t.x, q.y - t.y) < 44);
        if (!o) continue;
        if (!picked) { picked = o; ctx.sfx.click(); continue; }
        if (picked === o) { picked = null; continue; }
        if (picked.pair === o.pair) {
          done += 1; ctx.sfx.pickup();
          linked.push({ a: picked.e, b: o.e, x: (picked.x + o.x) / 2, y: (picked.y + o.y) / 2, t: 0 });
          fx.burst((picked.x + o.x) / 2, (picked.y + o.y) / 2, palette.glow, 26);
          things = things.filter((q) => q !== o && q !== picked); picked = null;
          if (done >= need) { ctx.win(); return; }
          add();
        } else { o.shake = 1; picked.shake = 1; picked = null; miss += 1; ctx.sfx.bad(); if (miss >= 3) { ctx.lose('rot'); return; } }
      }
    },
    draw(g) {
      backdrop(g, ctx, '#3a2050', '#120818');
      things.forEach((o) => {
        const sx = Math.sin(o.shake * 40) * 6 * o.shake;
        g.fillStyle = picked === o ? 'rgba(255,225,77,0.35)' : 'rgba(255,255,255,0.12)';
        g.beginPath(); g.arc(o.x + sx, o.y, 40, 0, 7); g.fill();
        if (picked === o) { g.strokeStyle = '#ffe14d'; g.lineWidth = 4; g.stroke(); }
        emoji(g, o.e, o.x + sx, o.y + 2, 46);
      });
      if (picked) { g.setLineDash([6, 8]); g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.beginPath(); g.moveTo(picked.x, picked.y); g.lineTo(ctx.input.x, ctx.input.y); g.stroke(); g.setLineDash([]); }
      linked.forEach((l) => {
        const y = l.y - l.t * 120; g.globalAlpha = Math.max(0, 1 - l.t / 1.2);
        emoji(g, l.a, l.x - 60, y, 44); text(g, 'and', l.x, y, 26, '#ffe14d'); emoji(g, l.b, l.x + 60, y, 44);
        g.globalAlpha = 1;
      });
      // the shelf of linked pairs
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, H - 110, W, 60);
      text(g, done ? `${done} linked` : 'link two that go together', W / 2, H - 80, 18, 'rgba(255,255,255,0.7)');
      rot(g, W - 60, H - 80, 18, ctx.t);
      cur.draw(g);
      fx.draw(g);
      hud(g, ctx, 'Link two things that go together: ___ AND ___', done, need);
      text(g, 'Tap one, then its partner · or arrows and SPACE', W / 2, H - 30, 15, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// soci: herd the wanderers into a group around the campfire.
function herdGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const need = [4, 5, 6][tier];
  const n = need + 2;
  const ring = { x: W / 2, y: 310, r: 140 };
  const dog = { x: W / 2, y: 470 };
  const FACES = ['🧒', '👧', '👦', '🧑', '👩', '👨', '🧓', '👵'];
  const pals = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { e: FACES[i % FACES.length], x: W / 2 + Math.cos(a) * 380, y: 300 + Math.sin(a) * 180, vx: 0, vy: 0, wa: rnd() * 6, inT: 0 };
  });
  const rotty = { x: 80, y: 120, vx: 120, vy: 90 };
  let winT = 0; let inside = 0;
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ pals, ring, dog, inside });
  return {
    update(dt) {
      if (winT > 0) { winT += dt; if (winT > 0.6) ctx.win(); return; }
      // the herder: arrows, or follow the pointer while it's held
      const d = keyDir(input);
      if (d.x || d.y) { dog.x += d.x * 360 * dt; dog.y += d.y * 360 * dt; } else if (input.down) { const dx = input.x - dog.x; const dy = input.y - dog.y; const m = Math.hypot(dx, dy); if (m > 4) { dog.x += (dx / m) * Math.min(m, 420 * dt); dog.y += (dy / m) * Math.min(m, 420 * dt); } }
      dog.x = Math.max(30, Math.min(W - 30, dog.x)); dog.y = Math.max(90, Math.min(H - 30, dog.y));
      inside = 0;
      pals.forEach((p) => {
        const inRing = Math.hypot(p.x - ring.x, p.y - ring.y) < ring.r - 20;
        p.wa += (rnd() - 0.5) * dt * 3;
        const wander = inRing ? 8 : [30, 45, 60][tier];
        p.vx += Math.cos(p.wa) * wander * dt * 3; p.vy += Math.sin(p.wa) * wander * dt * 3;
        // they shy away from the herder (but feel safe once they're in the group)
        const dx = p.x - dog.x; const dy = p.y - dog.y; const m = Math.hypot(dx, dy);
        if (m < 130 && !inRing) { p.vx += (dx / m) * (130 - m) * 6 * dt; p.vy += (dy / m) * (130 - m) * 6 * dt; }
        // and from the Rot
        const rx = p.x - rotty.x; const ry = p.y - rotty.y; const rm = Math.hypot(rx, ry);
        if (tier > 0 && rm < 110) { p.vx += (rx / rm) * (110 - rm) * 5 * dt; p.vy += (ry / rm) * (110 - rm) * 5 * dt; }
        // and like company: near the group they drift in
        const gx = ring.x - p.x; const gy = ring.y - p.y; const gm = Math.hypot(gx, gy);
        if (gm < ring.r + 90 && gm > 30) { p.vx += (gx / gm) * 40 * dt; p.vy += (gy / gm) * 40 * dt; }
        // a soft fence keeps them off the edges, so the dog can always get behind them
        if (p.x < 110) p.vx += (110 - p.x) * 3 * dt; else if (p.x > W - 110) p.vx -= (p.x - W + 110) * 3 * dt;
        if (p.y < 150) p.vy += (150 - p.y) * 3 * dt; else if (p.y > H - 100) p.vy -= (p.y - H + 100) * 3 * dt;
        const damp = inRing ? 0.86 : 0.95;
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 30 || p.x > W - 30) { p.vx *= -1; p.x = Math.max(30, Math.min(W - 30, p.x)); }
        if (p.y < 90 || p.y > H - 40) { p.vy *= -1; p.y = Math.max(90, Math.min(H - 40, p.y)); }
        if (inRing) { if (p.inT === 0) { ctx.sfx.tick(); fx.burst(p.x, p.y, palette.glow, 6, 100); } p.inT += dt; inside += 1; } else p.inT = 0;
      });
      if (tier > 0) {
        rotty.x += rotty.vx * dt * (0.6 + tier * 0.3); rotty.y += rotty.vy * dt * (0.6 + tier * 0.3);
        if (rotty.x < 40 || rotty.x > W - 40) rotty.vx *= -1;
        if (rotty.y < 100 || rotty.y > H - 40) rotty.vy *= -1;
      }
      if (inside >= need) { winT = 0.001; ctx.sfx.pickup(); fx.burst(ring.x, ring.y, palette.glow, 40); fx.burst(ring.x, ring.y, '#fff', 16); }
    },
    draw(g) {
      g.fillStyle = '#1f3a24'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 40; i++) g.fillRect((i * 211) % W, 70 + (i * 131) % (H - 70), 18, 6);
      const glow = g.createRadialGradient(ring.x, ring.y, 10, ring.x, ring.y, ring.r);
      glow.addColorStop(0, 'rgba(255,180,60,0.45)'); glow.addColorStop(1, 'rgba(255,180,60,0.05)');
      g.fillStyle = glow; g.beginPath(); g.arc(ring.x, ring.y, ring.r, 0, 7); g.fill();
      g.setLineDash([10, 8]); g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
      emoji(g, '🔥', ring.x, ring.y, 44);
      if (tier > 0) rot(g, rotty.x, rotty.y, 24, ctx.t);
      pals.forEach((p) => { emoji(g, p.e, p.x, p.y, 40); if (p.inT > 0) emoji(g, '💛', p.x + 16, p.y - 22, 16); });
      // the herder
      g.fillStyle = 'rgba(255,225,77,0.15)'; g.beginPath(); g.arc(dog.x, dog.y, 130, 0, 7); g.fill();
      emoji(g, '🐕', dog.x, dog.y, 46);
      fx.draw(g);
      hud(g, ctx, `Herd ${need} friends into the group`, Math.min(need, inside), need);
      text(g, 'Drag (or arrows) to move the dog · they walk away from it', W / 2, H - 36, 15, 'rgba(255,255,255,0.6)', 'center', 400);
    },
    destroy() {},
  };
}

// o / i: drop the linking vowel into the joint when the gap fits.
const JOINTS = {
  o: [['therm', 'meter'], ['speed', 'meter'], ['chron', 'logy'], ['hydr', 'plane'], ['micr', 'phone'], ['phot', 'graph'], ['ge', 'graphy']],
  i: [['carn', 'vore'], ['herb', 'vore'], ['agr', 'culture'], ['man', 'cure'], ['equ', 'lateral'], ['ped', 'cure'], ['omn', 'vore']],
};
function glueGame(ctx) {
  const { W, H, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const v = ctx.id === 'i' ? 'i' : 'o';
  const list = [...JOINTS[v]].sort(() => rnd() - 0.5);
  const need = [2, 3, 4][tier];
  const spd = [1.4, 2.0, 2.7][tier];
  const tol = [20, 13, 8][tier];
  const GW = 46; const cy = 300;
  let done = 0; let miss = 0; let ph = 0; let drop = 0; let dropOk = false; let wait = 0;
  const gap = () => 80 + Math.sin(ph) * 80; // 0 … 160
  let pair = list[0];
  const ANY = [' ', 'ArrowDown', 's', 'ArrowUp', 'w'];
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ gap: gap(), GW, tol, drop, wait });
  return {
    update(dt) {
      if (wait > 0) { wait -= dt; if (wait <= 0) { pair = list[done % list.length]; drop = 0; } return; }
      if (drop > 0) {
        drop += dt;
        if (drop > 0.35) {
          if (dropOk) { done += 1; ctx.sfx.pickup(); fx.burst(W / 2, cy, palette.glow, 30); fx.burst(W / 2, cy, '#fff', 12); if (done >= need) { ctx.win(); return; } wait = 0.9; }
          else { miss += 1; ctx.sfx.bad(); fx.burst(W / 2, cy + 40, '#7dff4a', 14, 160); if (miss >= 3) { ctx.lose('rot'); return; } drop = 0; }
        }
        return;
      }
      ph += spd * dt * (tier === 2 ? 1 + 0.3 * Math.sin(ctx.t * 2.3) : 1);
      if (ctx.input.taps.length || ANY.some((k) => ctx.input.pressed.has(k))) { drop = 0.001; dropOk = Math.abs(gap() - GW) <= tol; }
    },
    draw(g) {
      backdrop(g, ctx, '#16304a', '#050c16');
      const joined = wait > 0;
      const gw = joined ? GW : drop > 0 && dropOk ? GW : gap();
      g.font = font(54);
      const lw = g.measureText(pair[0]).width + 30; const rw = g.measureText(pair[1]).width + 30;
      const lx = W / 2 - gw / 2 - lw; const rx = W / 2 + gw / 2;
      // rail
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(60, cy + 50, W - 120, 8);
      const box = (x, w, s) => { g.fillStyle = palette.ink; g.beginPath(); g.roundRect(x, cy - 40, w, 80, 14); g.fill(); text(g, s, x + w / 2, cy + 2, 54, palette.bg); };
      box(lx, lw, pair[0]); box(rx, rw, pair[1]);
      // the gap guide: green when the glue fits
      if (!joined && drop === 0) { const fits = Math.abs(gap() - GW) <= tol; g.strokeStyle = fits ? '#4ade80' : 'rgba(255,255,255,0.25)'; g.lineWidth = 3; g.strokeRect(W / 2 - GW / 2, cy - 40, GW, 80); }
      // the glue tile
      let gy = 150; if (drop > 0) gy = 150 + Math.min(1, drop / 0.3) * (cy - 150); if (joined) gy = cy;
      const gx = W / 2;
      if (!(drop > 0.3 && !dropOk)) {
        g.fillStyle = '#ffe14d'; g.beginPath(); g.roundRect(gx - GW / 2, gy - 40, GW, 80, 12); g.fill();
        text(g, v, gx, gy + 2, 54, '#3b2a08');
      } else rot(g, gx, cy + 40, 26, ctx.t);
      if (joined) text(g, `${pair[0]}${v}${pair[1]}`, W / 2, 440, 34, '#ffe14d');
      fx.draw(g);
      hud(g, ctx, `Glue the parts with “${v}”`, done, need);
      text(g, 'TAP or SPACE when the gap turns green', W / 2, H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}
