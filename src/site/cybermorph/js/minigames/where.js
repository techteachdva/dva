/**
 * Where & when (where): the position is the answer.
 *  - Drop modes: a marker moves and you drop the piece in the right place against it:
 *    below (under, sub, hypo), above (over, super, hyper), between (inter), on the middle (mid),
 *    far from it (tele), and before / after a moving NOW on a timeline (pre, fore / post).
 *  - Steer modes: you drive the piece and the place is the goal: across a wall through its moving
 *    gap (trans, dia, per), into a spinning ring (in2, intro), out of it (ex, e, out), and toward a
 *    moving beacon (ad, pro).
 *  - chron: tap the pictures in time order to lay them on the timeline.
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
function piece(g, ctx, x, y, h = 46, alpha = 1) {
  const t = ctx.tile;
  g.globalAlpha = alpha;
  if (t.ready) { const w = (t.width / t.height) * h; g.drawImage(t, x - w / 2, y - h / 2, w, h); } else { g.fillStyle = ctx.palette.glow; g.fillRect(x - 30, y - h / 2, 60, h); }
  g.globalAlpha = 1;
}
const keyIn = (set, ks) => ks.some((k) => set.has(k));
const LEFT = ['ArrowLeft', 'a']; const RIGHT = ['ArrowRight', 'd']; const UP = ['ArrowUp', 'w']; const DOWN = ['ArrowDown', 's'];
function keyDir(input) {
  return { x: (keyIn(input.keys, RIGHT) ? 1 : 0) - (keyIn(input.keys, LEFT) ? 1 : 0), y: (keyIn(input.keys, DOWN) ? 1 : 0) - (keyIn(input.keys, UP) ? 1 : 0) };
}

// ── the game ──
const MODE = {
  under: 'below', sub: 'below', hypo: 'below', over: 'above', super: 'above', hyper: 'above',
  inter: 'between', mid: 'middle', tele: 'far', pre: 'before', fore: 'before', post: 'after',
  trans: 'across', dia: 'across', per: 'across', in2: 'in', intro: 'in', ex: 'out', e: 'out', out: 'out',
  ad: 'toward', pro: 'toward', chron: 'chron',
};
const GOAL = {
  below: 'Drop it BELOW the moving platform', above: 'Drop it ABOVE the moving platform',
  between: 'Drop it BETWEEN the two posts', middle: 'Drop it on the MIDDLE of the bar',
  far: 'Drop it FAR from the dish', before: 'Drop it just BEFORE the NOW line', after: 'Drop it just AFTER the NOW line',
  across: 'Get it ACROSS the firewall', in: 'Get it INSIDE the ring', out: 'Get it OUT of the ring',
  toward: 'Move it TO the beacon', chron: 'Tap them in TIME order: first to last',
};
const HOW = {
  below: 'goes below: drop the piece under the moving platform.',
  above: 'goes above: drop the piece over the moving platform.',
  between: 'goes between: drop the piece in the gap between the two posts.',
  middle: 'is the middle: drop the piece right on the middle of the moving bar.',
  far: 'means far: drop the piece far away from the dish.',
  before: 'means before: drop the piece just before the NOW line on the timeline.',
  after: 'means after: drop the piece just after the NOW line on the timeline.',
  across: 'means across: steer the piece across the wall through its moving gap.',
  in: 'means into: steer the piece inside the spinning ring through its gap.',
  out: 'means out: steer the piece out of the spinning ring before the Rot gets it.',
  toward: 'means toward: steer the piece to the moving beacon.',
  chron: 'means time: tap the pictures in the order they happen.',
};
const VERB = {
  below: 'You put it below.', above: 'You put it above.', between: 'You put it between.', middle: 'You hit the middle.',
  far: 'You sent it far away.', before: 'You put it before.', after: 'You put it after.', across: 'You carried it across.',
  in: 'You got it in.', out: 'You got it out.', toward: 'You moved it toward the goal.', chron: 'You put time in order.',
};
const DROP = ['below', 'above', 'between', 'middle', 'far', 'before', 'after'];

export default {
  seconds: 30,
  howTo(m) { return `${m.text} ${HOW[MODE[m.id]] || HOW.below}`; },
  verb(m) { return VERB[MODE[m.id]] || VERB.below; },
  start(ctx) {
    const mode = MODE[ctx.id] || 'below';
    if (mode === 'chron') return chronGame(ctx);
    if (DROP.includes(mode)) return dropGame(ctx, mode);
    return steerGame(ctx, mode);
  },
};

function backdrop(g, ctx, top, bottom) {
  const bg = g.createLinearGradient(0, 0, 0, ctx.H);
  bg.addColorStop(0, top); bg.addColorStop(1, bottom);
  g.fillStyle = bg; g.fillRect(0, 0, ctx.W, ctx.H);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let y = 80; y < ctx.H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(ctx.W, y); g.stroke(); }
}

// Drop the piece in the right place against a moving marker.
function dropGame(ctx, mode) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const need = [3, 4, 5][tier];
  const speed = [90, 150, 230][tier];
  let done = 0; let miss = 0; let kbd = false; let gx = W / 2; let gy = 140;
  const mk = { x: W / 2, y: mode === 'below' ? 230 : mode === 'above' ? 360 : 300, dir: rnd() < 0.5 ? -1 : 1, gap: 180 };
  const placed = [];
  const rots = Array.from({ length: tier }, (_, i) => ({ x: 120 + rnd() * 700, y: 120 + rnd() * 340, vx: (rnd() - 0.5) * 140, vy: (rnd() - 0.5) * 140, i }));
  const timeline = mode === 'before' || mode === 'after';
  const zoneW = [220, 170, 130][tier];

  function zoneOf() {
    // the right place right now, as a box { x0, x1, y0, y1 } (or null for far)
    const half = 95;
    if (mode === 'below') return { x0: mk.x - half, x1: mk.x + half, y0: mk.y + 18, y1: mk.y + 170 };
    if (mode === 'above') return { x0: mk.x - half, x1: mk.x + half, y0: mk.y - 170, y1: mk.y - 18 };
    if (mode === 'between') return { x0: mk.x - mk.gap / 2 + 16, x1: mk.x + mk.gap / 2 - 16, y0: mk.y - 100, y1: mk.y + 100 };
    if (mode === 'middle') { const t = [42, 30, 20][tier]; return { x0: mk.x - t, x1: mk.x + t, y0: mk.y - 50, y1: mk.y + 40 }; }
    if (mode === 'before') return { x0: mk.x - zoneW, x1: mk.x - 12, y0: mk.y - 45, y1: mk.y + 45 };
    if (mode === 'after') return { x0: mk.x + 12, x1: mk.x + zoneW, y0: mk.y - 45, y1: mk.y + 45 };
    return null;
  }
  const farR = [300, 360, 400][tier];
  function good(x, y) {
    if (mode === 'far') return Math.hypot(x - mk.x, y - mk.y) > farR;
    const z = zoneOf();
    return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  }
  function drop(x, y) {
    if (y < 70) return;
    const eaten = rots.find((r) => Math.hypot(r.x - x, r.y - y) < 40);
    if (!eaten && good(x, y)) {
      done += 1; ctx.sfx.pickup();
      placed.push({ dx: x - mk.x, dy: y - mk.y, life: 0.9, ok: true });
      fx.burst(x, y, palette.glow, 26); fx.burst(x, y, '#fff', 10);
      if (done >= need) ctx.win();
    } else {
      miss += 1; ctx.sfx.bad();
      placed.push({ dx: x - mk.x, dy: y - mk.y, life: 0.7, ok: false });
      fx.burst(x, y, '#7dff4a', 14, 180);
      if (miss >= 3) ctx.lose('rot');
    }
  }

  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ good, rots });
  return {
    update(dt) {
      // move the marker
      if (mode === 'far') {
        mk.x = W / 2 + Math.cos(ctx.t * speed / 200) * 300; mk.y = 300 + Math.sin(ctx.t * speed / 140) * 120;
      } else {
        mk.x += mk.dir * speed * dt;
        const lim = mode === 'between' ? mk.gap / 2 + 40 : 140;
        if (mk.x < lim) { mk.x = lim; mk.dir = 1; } else if (mk.x > W - lim) { mk.x = W - lim; mk.dir = -1; }
        if (tier === 2 && rnd() < dt * 0.4) mk.dir *= -1;
        if (mode === 'between') mk.gap = 190 + Math.sin(ctx.t * 1.7) * [40, 60, 70][tier];
        if (mode === 'below' || mode === 'above') mk.y += Math.sin(ctx.t * 2) * 20 * dt;
      }
      rots.forEach((r) => {
        r.x += r.vx * dt; r.y += r.vy * dt;
        if (r.x < 40 || r.x > W - 40) r.vx *= -1;
        if (r.y < 100 || r.y > H - 70) r.vy *= -1;
      });
      placed.forEach((p) => { p.life -= dt; });
      for (let i = placed.length - 1; i >= 0; i--) if (placed[i].life <= 0) placed.splice(i, 1);
      // the ghost piece follows the pointer, or the arrows
      const d = keyDir(input);
      if (d.x || d.y) { kbd = true; gx += d.x * 480 * dt; gy += d.y * 480 * dt; } else if (!kbd || input.down) { gx = input.x; gy = input.y; }
      gx = Math.max(20, Math.min(W - 20, gx)); gy = Math.max(80, Math.min(H - 20, gy));
      if (input.pressed.has(' ')) { kbd = true; drop(gx, gy); return; }
      for (const t of input.taps) { kbd = false; gx = t.x; gy = t.y; drop(t.x, t.y); return; }
    },
    draw(g) {
      if (timeline) backdrop(g, ctx, '#1d1230', '#0a0612');
      else if (mode === 'far') backdrop(g, ctx, '#020617', '#0b1d3a');
      else backdrop(g, ctx, '#0b2240', '#04101e');
      const showZone = tier === 0;
      if (mode === 'below' || mode === 'above') {
        g.fillStyle = palette.accent; g.beginPath(); g.roundRect(mk.x - 95, mk.y - 14, 190, 28, 14); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(mk.x - 80, mk.y - 8, 160, 4);
        for (let i = -1; i <= 1; i += 2) { g.fillStyle = `rgba(127,224,255,${0.4 + 0.3 * Math.sin(ctx.t * 20 + i)})`; g.beginPath(); g.moveTo(mk.x + i * 60 - 12, mk.y + 14); g.lineTo(mk.x + i * 60 + 12, mk.y + 14); g.lineTo(mk.x + i * 60, mk.y + 34); g.fill(); }
        emoji(g, '🛸', mk.x, mk.y - 6, 30);
      } else if (mode === 'between') {
        [-1, 1].forEach((s) => {
          const x = mk.x + s * mk.gap / 2;
          g.fillStyle = palette.accent; g.fillRect(x - 12, mk.y - 110, 24, 220);
          g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(x, mk.y - 118, 12, 0, 7); g.fill();
        });
      } else if (mode === 'middle') {
        g.fillStyle = palette.accent; g.beginPath(); g.roundRect(mk.x - 170, mk.y - 12, 340, 24, 12); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = -4; i <= 4; i++) if (i) g.fillRect(mk.x + i * 38 - 1, mk.y - 8, 2, 16);
        g.fillStyle = '#ffe14d'; g.fillRect(mk.x - 2, mk.y + 14, 4, 12);
      } else if (mode === 'far') {
        g.setLineDash([6, 10]); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
        g.beginPath(); g.arc(mk.x, mk.y, farR, 0, 7); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(127,224,255,${0.5 - ((ctx.t + i / 3) % 1) * 0.5})`; g.beginPath(); g.arc(mk.x, mk.y, 30 + ((ctx.t + i / 3) % 1) * 120, 0, 7); g.stroke(); }
        emoji(g, '📡', mk.x, mk.y, 56);
      } else {
        // timeline with a moving NOW
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(20, mk.y - 45, W - 40, 90);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, mk.y); g.lineTo(W - 30, mk.y); g.stroke();
        text(g, '◀ EARLIER', 40, mk.y + 66, 16, 'rgba(255,255,255,0.6)', 'left');
        text(g, 'LATER ▶', W - 40, mk.y + 66, 16, 'rgba(255,255,255,0.6)', 'right');
        g.fillStyle = '#ff5a7a'; g.fillRect(mk.x - 3, mk.y - 70, 6, 140);
        text(g, 'NOW', mk.x, mk.y - 84, 18, '#ff5a7a');
      }
      if (showZone && mode !== 'far') { const z = zoneOf(); g.fillStyle = 'rgba(255,225,77,0.16)'; g.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); }
      rots.forEach((r) => rot(g, r.x, r.y, 22, ctx.t + r.i));
      placed.forEach((p) => {
        piece(g, ctx, mk.x + p.dx, mk.y + p.dy, 46, Math.min(1, p.life * 2));
        if (!p.ok) rot(g, mk.x + p.dx, mk.y + p.dy, 18 * p.life + 6, ctx.t);
      });
      piece(g, ctx, gx, gy, 46, 0.75);
      g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx - 8, gy + 34); g.lineTo(gx + 8, gy + 34); g.moveTo(gx, gy + 26); g.lineTo(gx, gy + 42); g.stroke();
      fx.draw(g);
      hud(g, ctx, GOAL[mode], done, need);
      text(g, 'Tap where it goes · or arrows and SPACE', W / 2, H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// Steer the piece to its place.
function steerGame(ctx, mode) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const need = [2, 3, 3][tier];
  const R = 22; const speed = 330;
  let done = 0; let miss = 0; let target = null; let hold = 0; let grace = 0; let stun = 0;
  const p = { x: 0, y: 0 };
  const ring = { x: W / 2, y: 300, r: 120, a: 0, gap: [1.25, 1.0, 0.9][tier], spin: [0.9, 1.2, 1.45][tier] };
  const wall = { x: W / 2, gapY: 300, gapH: [170, 130, 105][tier], t: 0 };
  const beacon = { x: 0, y: 0, vx: 0, vy: 0 };
  let rots = [];
  let side = 1;

  function setup() {
    target = null; hold = 0; grace = mode === 'out' ? 0 : 0.35; // out starts in the middle, already clear of the Rot
    if (mode === 'across') { side = done % 2 ? -1 : 1; p.x = side > 0 ? 90 : W - 90; p.y = 150 + rnd() * 300; rots = Array.from({ length: tier }, (_, i) => ({ x: W / 2 + (i ? 90 : -90), y: 150 + rnd() * 300, vy: (i ? 1 : -1) * (120 + tier * 40), i })); }
    if (mode === 'in' || mode === 'out') {
      ring.x = 260 + rnd() * 440; ring.y = 270 + rnd() * 80; ring.a = rnd() * 6.28;
      if (mode === 'in') { const a = rnd() * 6.28; p.x = ring.x + Math.cos(a) * 250; p.y = ring.y + Math.sin(a) * 180; p.x = Math.max(60, Math.min(W - 60, p.x)); p.y = Math.max(110, Math.min(H - 60, p.y)); }
      else { p.x = ring.x; p.y = ring.y; }
      rots = mode === 'out' ? Array.from({ length: 1 + tier }, (_, i) => ({ a: (i * Math.PI * 2) / (1 + tier) + 1, d: 70, i })) : Array.from({ length: tier }, (_, i) => ({ a: i * 3.1, d: 175, i }));
    }
    if (mode === 'toward') {
      p.x = 100; p.y = 300 + (rnd() - 0.5) * 200;
      beacon.x = 700 + rnd() * 180; beacon.y = 130 + rnd() * 320; const a = rnd() * 6.28; const s = [70, 120, 180][tier];
      beacon.vx = Math.cos(a) * s; beacon.vy = Math.sin(a) * s;
      rots = Array.from({ length: 1 + tier }, (_, i) => ({ x: 380 + i * 160, y: 150 + rnd() * 300, vy: (i % 2 ? 1 : -1) * (100 + tier * 40), i }));
    }
  }
  function blocked(x, y) {
    if (x < R || x > W - R || y < 64 + R || y > H - R) return true;
    if (mode === 'across') {
      if (Math.abs(x - wall.x) < 16 + R && Math.abs(y - wall.gapY) > wall.gapH / 2 - R) return true;
    }
    if (mode === 'in' || mode === 'out') {
      const d = Math.hypot(x - ring.x, y - ring.y);
      if (Math.abs(d - ring.r) < R + 6) {
        let da = Math.atan2(y - ring.y, x - ring.x) - ring.a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > ring.gap / 2 - R / ring.r) return true;
      }
    }
    return false;
  }
  function success() {
    done += 1; ctx.sfx.pickup();
    fx.burst(p.x, p.y, palette.glow, 30); fx.burst(p.x, p.y, '#fff', 12);
    if (done >= need) { ctx.win(); return; }
    setup();
  }
  function hurt() {
    miss += 1; ctx.sfx.bad(); fx.burst(p.x, p.y, '#7dff4a', 18, 200);
    if (miss >= 3) { ctx.lose('rot'); return; }
    setup();
    stun = 0.6; // a beat to look again before moving
    if (mode !== 'out') grace = stun + 0.3;
  }
  function rotPos(r) {
    if (mode === 'in' || mode === 'out') return { x: ring.x + Math.cos(r.a) * r.d, y: ring.y + Math.sin(r.a) * r.d };
    return r;
  }

  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ p, ring, wall, beacon, side, rots: rots.map(rotPos), grace });
  setup();
  return {
    update(dt) {
      // world motion
      wall.t += dt; wall.gapY = 300 + Math.sin(wall.t * [1.0, 1.4, 1.9][tier]) * 150;
      ring.a += ring.spin * dt;
      beacon.x += beacon.vx * dt; beacon.y += beacon.vy * dt;
      if (beacon.x < 300 || beacon.x > W - 60) beacon.vx *= -1;
      if (beacon.y < 110 || beacon.y > H - 70) beacon.vy *= -1;
      rots.forEach((r) => {
        // inside the ring they orbit against its spin, so they sweep past the gap instead of parking in it
        if (mode === 'in' || mode === 'out') { r.a += (mode === 'out' ? -[1.3, 1.7, 2.0][tier] : -0.8) * dt; if (mode === 'out') r.d = 78 + Math.sin(ctx.t * 2 + r.i) * 16; }
        else { r.y += r.vy * dt; if (r.y < 100 || r.y > H - 60) r.vy *= -1; }
      });
      // steering: arrows, or glide toward where you tap / hold
      stun -= dt;
      const d = stun > 0 ? { x: 0, y: 0 } : keyDir(input);
      let vx = 0; let vy = 0;
      if (stun > 0) target = null;
      else if (d.x || d.y) { target = null; const n = Math.hypot(d.x, d.y); vx = d.x / n; vy = d.y / n; }
      else {
        if (input.down || input.taps.length) target = { x: input.x, y: input.y };
        if (target) { const dx = target.x - p.x; const dy = target.y - p.y; const n = Math.hypot(dx, dy); if (n > 6) { vx = dx / n; vy = dy / n; } else target = null; }
      }
      const nx = p.x + vx * speed * dt; const ny = p.y + vy * speed * dt;
      if (!blocked(nx, ny)) { p.x = nx; p.y = ny; } else if (!blocked(nx, p.y)) p.x = nx; else if (!blocked(p.x, ny)) p.y = ny;
      else if (mode === 'in' || mode === 'out') {
        // slide round the curved ring instead of sticking to it
        const rx = p.x - ring.x; const ry = p.y - ring.y; const rn = Math.hypot(rx, ry) || 1;
        const tx = -ry / rn; const ty = rx / rn; const k = (vx * tx + vy * ty) * speed * dt;
        if (!blocked(p.x + tx * k, p.y + ty * k)) { p.x += tx * k; p.y += ty * k; }
      }
      // the Rot
      grace -= dt;
      if (grace <= 0) for (const r of rots) { const q = rotPos(r); if (Math.hypot(q.x - p.x, q.y - p.y) < R + 20) { hurt(); return; } }
      // goal
      if (mode === 'across' && (side > 0 ? p.x > W - 90 : p.x < 90)) success();
      else if (mode === 'in' && Math.hypot(p.x - ring.x, p.y - ring.y) < ring.r - R - 10) { hold += dt; if (hold > 0.25) success(); }
      else if (mode === 'out' && Math.hypot(p.x - ring.x, p.y - ring.y) > ring.r + R + 14) success();
      else if (mode === 'toward' && Math.hypot(p.x - beacon.x, p.y - beacon.y) < R + 30) success();
    },
    draw(g) {
      backdrop(g, ctx, '#0b2240', '#04101e');
      if (mode === 'across') {
        const goalX = side > 0 ? W - 90 : 0;
        g.fillStyle = 'rgba(255,225,77,0.12)'; g.fillRect(goalX, 64, 90, H - 64);
        text(g, 'GOAL', side > 0 ? W - 45 : 45, 100, 16, '#ffe14d'); text(g, side > 0 ? '▶' : '◀', side > 0 ? W - 45 : 45, 124, 20, '#ffe14d');
        const top = wall.gapY - wall.gapH / 2; const bot = wall.gapY + wall.gapH / 2;
        const fire = (y0, y1) => { const fg = g.createLinearGradient(wall.x - 16, 0, wall.x + 16, 0); fg.addColorStop(0, '#ff3b1a'); fg.addColorStop(0.5, '#ffb000'); fg.addColorStop(1, '#ff3b1a'); g.fillStyle = fg; g.fillRect(wall.x - 16, y0, 32, y1 - y0); };
        fire(64, top); fire(bot, H);
        for (let y = 80; y < H; y += 26) if (y < top || y > bot) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wall.x - 16, y, 32, 3); }
      }
      if (mode === 'in' || mode === 'out') {
        g.lineWidth = 12; g.strokeStyle = palette.accent; g.lineCap = 'round';
        g.beginPath(); g.arc(ring.x, ring.y, ring.r, ring.a + ring.gap / 2, ring.a + Math.PI * 2 - ring.gap / 2); g.stroke();
        g.lineCap = 'butt';
        g.fillStyle = mode === 'in' ? 'rgba(255,225,77,0.12)' : 'rgba(125,255,74,0.08)';
        g.beginPath(); g.arc(ring.x, ring.y, ring.r - 8, 0, 7); g.fill();
        if (mode === 'in') text(g, 'IN', ring.x, ring.y, 34, 'rgba(255,225,77,0.5)');
      }
      if (mode === 'toward') {
        for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,225,77,${0.6 - ((ctx.t + i / 3) % 1) * 0.6})`; g.lineWidth = 3; g.beginPath(); g.arc(beacon.x, beacon.y, 20 + ((ctx.t + i / 3) % 1) * 50, 0, 7); g.stroke(); }
        emoji(g, '📡', beacon.x, beacon.y, 46);
        g.setLineDash([4, 10]); g.strokeStyle = 'rgba(255,225,77,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(beacon.x, beacon.y); g.stroke(); g.setLineDash([]);
      }
      rots.forEach((r) => { const q = rotPos(r); rot(g, q.x, q.y, 22, ctx.t + r.i); });
      piece(g, ctx, p.x, p.y, 44, grace > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(ctx.t * 12)) : 1);
      if (target) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(target.x, target.y, 10, 0, 7); g.stroke(); }
      fx.draw(g);
      hud(g, ctx, GOAL[mode], done, need);
      text(g, 'Arrows to steer · or tap where to go', W / 2, H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// chron: tap the pictures in the order they happen.
const STORIES = [
  ['🥚', '🐣', '🐥', '🐔'], ['🌱', '🌿', '🌳', '🍎'], ['👶', '🧒', '🧑', '🧓'], ['🌑', '🌓', '🌕', '🌗'],
  ['😴', '⏰', '🥣', '🚌'], ['🛒', '🥕', '🍲', '😋'], ['🐛', '🛌', '🦋', '🌸'], ['❄️', '🌷', '☀️', '🍂'],
  ['🌧️', '💧', '🌈', '☀️'], ['🧱', '🏗️', '🏠', '🎉'],
];
function chronGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const len = [3, 4, 4][tier];
  const need = [1, 2, 3][tier];
  const drift = [20, 45, 80][tier];
  let story = 0; let next = 0; let miss = 0; let sel = 0; let kbd = false; let cards = []; let wait = 0;
  const pool = [...STORIES].sort(() => rnd() - 0.5);
  function deal() {
    const s = pool[story % pool.length].slice(0, len);
    next = 0; sel = 0;
    const xs = s.map((_, i) => 160 + i * ((W - 320) / (len - 1)));
    const order = s.map((_, i) => i).sort(() => rnd() - 0.5);
    cards = s.map((e, i) => ({ e, i, x: xs[order[i]], y: 200 + rnd() * 80, vx: (rnd() - 0.5) * drift, vy: (rnd() - 0.5) * drift, ph: rnd() * 6, placed: false, shake: 0 }));
  }
  const slotX = (i) => W / 2 + (i - (len - 1) / 2) * 130;
  function pick(c) {
    if (c.i === next) {
      c.placed = true; next += 1; ctx.sfx.pickup(); fx.burst(slotX(c.i), 430, palette.glow, 18);
      if (next >= len) { story += 1; fx.burst(W / 2, 430, '#fff', 30); if (story >= need) { ctx.win(); return; } wait = 0.7; }
    } else { c.shake = 1; miss += 1; ctx.sfx.bad(); if (miss >= 3) ctx.lose('rot'); }
  }
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ cards, next, wait });
  deal();
  return {
    update(dt) {
      if (wait > 0) { wait -= dt; if (wait <= 0) deal(); return; }
      const loose = cards.filter((c) => !c.placed);
      loose.forEach((c) => {
        c.x += c.vx * dt; c.y += c.vy * dt + Math.sin(ctx.t * 2 + c.ph) * 10 * dt;
        if (c.x < 70 || c.x > W - 70) c.vx *= -1;
        if (c.y < 140 || c.y > 320) c.vy *= -1;
        c.shake = Math.max(0, c.shake - dt * 2.5);
      });
      const ordered = [...loose].sort((a, b) => a.x - b.x);
      if (sel >= ordered.length) sel = 0;
      if (keyIn(input.pressed, LEFT)) { kbd = true; sel = (sel + ordered.length - 1) % ordered.length; ctx.sfx.click(); }
      if (keyIn(input.pressed, RIGHT)) { kbd = true; sel = (sel + 1) % ordered.length; ctx.sfx.click(); }
      if (input.pressed.has(' ') && ordered[sel]) { kbd = true; pick(ordered[sel]); return; }
      for (const t of input.taps) { const c = loose.find((o) => Math.abs(t.x - o.x) < 52 && Math.abs(t.y - o.y) < 52); if (c) { kbd = false; pick(c); return; } }
    },
    draw(g) {
      backdrop(g, ctx, '#22112e', '#0a0612');
      // the timeline
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 430); g.lineTo(W - 80, 430); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(W - 70, 430); g.lineTo(W - 90, 418); g.lineTo(W - 90, 442); g.fill();
      text(g, 'FIRST', slotX(0), 486, 15, 'rgba(255,255,255,0.6)'); text(g, 'LAST', slotX(len - 1), 486, 15, 'rgba(255,255,255,0.6)');
      for (let i = 0; i < len; i++) { g.strokeStyle = 'rgba(255,225,77,0.5)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.strokeRect(slotX(i) - 46, 384, 92, 92); g.setLineDash([]); }
      const ordered = cards.filter((c) => !c.placed).sort((a, b) => a.x - b.x);
      cards.forEach((c) => {
        const x = c.placed ? slotX(c.i) : c.x + Math.sin(c.shake * 40) * 8 * c.shake; const y = c.placed ? 430 : c.y;
        g.fillStyle = c.placed ? 'rgba(255,225,77,0.22)' : 'rgba(255,255,255,0.1)';
        g.beginPath(); g.roundRect(x - 46, y - 46, 92, 92, 16); g.fill();
        g.lineWidth = kbd && ordered[sel] === c ? 6 : 2; g.strokeStyle = kbd && ordered[sel] === c ? '#ffe14d' : palette.glow; g.stroke();
        emoji(g, c.e, x, y + 2, 56);
      });
      rot(g, W - 60 + Math.sin(ctx.t) * 20, 120, 20, ctx.t);
      fx.draw(g);
      hud(g, ctx, GOAL.chron, story, need);
      text(g, kbd ? '◀ ▶ choose · SPACE place' : 'Tap the earliest one · or ◀ ▶ and SPACE', W / 2, 96, 15, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}
