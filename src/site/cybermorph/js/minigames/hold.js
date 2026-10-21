/**
 * Hold, take, stand (ten … the). Four ways to keep or put a piece:
 *   hold  (ten, tent, tain, tin, tinu)            Rot tendrils pull the packet; hold on and pull back to keep it in the ring
 *   take  (cap, capt, ceit, ceive, cept, cip)     close your claw on the packets that fall, not on the Rot
 *   stand (sta, sist, stat, stit)                 stay upright on a plate that tilts as Rot blobs land on it
 *   place (pos, pose, posit, pon, pone, the)      drop each piece from the crane into the slot of its shape
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

const MODE_OF = {
  ten: 'hold', tent: 'hold', tain: 'hold', tin: 'hold', tinu: 'hold',
  cap: 'take', capt: 'take', ceit: 'take', ceive: 'take', cept: 'take', cip: 'take',
  sta: 'stand', sist: 'stand', stat: 'stand', stit: 'stand',
};
const modeOf = (id) => MODE_OF[id] || 'place';
const HOW = {
  hold: 'Hold on! Press and drag (or use the arrows) against the Rot’s pull to keep the packet inside the ring.',
  take: 'Move the claw (or ← →) and grab (tap, or Space) the packets as they fall. Don’t grab the Rot!',
  stand: 'Walk your bot (move, or ← →) to keep the plate level as the Rot lands on it. Stay standing!',
  place: 'Tap (or Space) to drop each piece from the crane into the slot with its shape.',
};
const VERB = {
  hold: 'You held on tight.', take: 'You took every piece you grabbed for.',
  stand: 'You stood your ground.', place: 'You put every piece in its place.',
};

/** Move with the pointer (hover or drag) or the arrow keys; returns the new x. */
function steerX(input, x, speed, mem, dt) {
  if (input.x !== mem.x) { mem.x = input.x; x = input.x; }
  return x + axis(input.keys).x * speed * dt;
}

// hold: tendrils pull; your push (toward the pointer, or the arrows) holds it in.
function hold(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const C = { x: 480, y: 290 };
  const R = [150, 125, 105][tier];
  const Fmax = [90, 135, 170][tier];
  const need = [7, 10, 12][tier];
  const P = { x: C.x, y: C.y };
  let pulls = []; let held = 0; let gripping = false; let gap = 0.6;
  const pushAt = () => {
    const a = axis(input.keys);
    if (a.x || a.y) { const m = Math.hypot(a.x, a.y); return { x: (a.x / m) * 230, y: (a.y / m) * 230 }; }
    if (input.down) {
      const dx = input.x - P.x; const dy = input.y - P.y; const d = Math.hypot(dx, dy) || 1; const s = Math.min(230, d * 3);
      return { x: (dx / d) * s, y: (dy / d) * s };
    }
    return null;
  };
  return {
    peek: () => ({ P: { ...P }, C, R, held, pulls: pulls.map((p) => ({ a: p.a, f: p.f })) }),
    update(dt) {
      gap -= dt;
      if (gap <= 0 && pulls.length < (tier === 2 ? 2 : 1)) {
        pulls.push({ a: rnd() * TAU, t: 0, dur: 1.6 + rnd() * 1.6, f: 0, max: Fmax * (0.7 + rnd() * 0.3) });
        gap = tier === 2 ? 1.1 : 0.4;
      }
      let vx = 0; let vy = 0;
      for (const p of pulls) {
        p.t += dt; p.f = p.max * Math.sin(Math.PI * Math.min(1, p.t / p.dur));
        vx += Math.cos(p.a) * p.f; vy += Math.sin(p.a) * p.f;
      }
      pulls = pulls.filter((p) => p.t < p.dur);
      const push = pushAt();
      gripping = !!push;
      if (push) { vx += push.x; vy += push.y; } else { vx *= 1.6; vy *= 1.6; }
      P.x += vx * dt; P.y += vy * dt;
      const d = Math.hypot(P.x - C.x, P.y - C.y);
      if (d > R) { fx.burst(P.x, P.y, '#39d353', 24, 260); ctx.lose('rot'); return; }
      if (gripping) held += dt;
      if (held >= need) { fx.burst(P.x, P.y, ctx.palette.accent, 30, 320); ctx.sfx.good(); ctx.win(); }
    },
    draw(g) {
      const t = ctx.t;
      g.strokeStyle = ctx.palette.accent; g.lineWidth = 5; g.setLineDash([12, 10]);
      g.beginPath(); g.arc(C.x, C.y, R, 0, TAU); g.stroke(); g.setLineDash([]);
      for (const p of pulls) {
        const ex = C.x + Math.cos(p.a) * 420; const ey = C.y + Math.sin(p.a) * 420;
        g.strokeStyle = `rgba(57,211,83,${0.4 + (p.f / Fmax) * 0.6})`; g.lineWidth = 6 + (p.f / Fmax) * 8;
        g.beginPath(); g.moveTo(P.x, P.y);
        g.quadraticCurveTo((P.x + ex) / 2 + Math.sin(t * 5 + p.a) * 30, (P.y + ey) / 2 + Math.cos(t * 4) * 30, ex, ey); g.stroke();
        rot(g, C.x + Math.cos(p.a) * 300, C.y + Math.sin(p.a) * 230, 30, t, p.a);
      }
      if (gripping && input.down && !axis(input.keys).x && !axis(input.keys).y) {
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(input.x, input.y); g.stroke();
        g.fillStyle = '#fff'; g.font = font(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✊', input.x, input.y);
      }
      packet(g, ctx, P.x, P.y, 60);
      // the hold meter
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(330, 492, 300, 12);
      g.fillStyle = ctx.palette.accent; g.fillRect(330, 492, 300 * clamp(held / need, 0, 1), 12);
      hint(g, gripping ? `HOLDING… ${Math.max(0, need - held).toFixed(1)} s` : 'HOLD ON! Press and pull against the Rot');
    },
  };
}

// take: grab what falls.
function take(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const HY = 440;
  const reach = [60, 46, 38][tier];
  const speed = [120, 165, 210][tier];
  const every = [1.0, 0.8, 0.65][tier];
  const rotP = [0.2, 0.33, 0.42][tier];
  const need = [5, 7, 9][tier];
  const items = []; const mem = { x: input.x };
  let x = 480; let got = 0; let next = 0.5; let close = 0; let stun = 0;
  const grab = () => {
    if (close > 0 || stun > 0) return;
    close = 0.28;
    const inReach = items.filter((it) => Math.abs(it.x - x) < reach && it.y > HY - 70 && it.y < HY + 20);
    if (!inReach.length) return;
    const it = inReach.sort((a, b) => b.y - a.y)[0];
    items.splice(items.indexOf(it), 1);
    if (it.rot) { stun = 1; got = Math.max(0, got - 1); fx.burst(x, HY, '#39d353', 20, 240); ctx.sfx.bad(); return; }
    got += 1; fx.burst(x, HY - 20, ctx.palette.accent, 14, 220);
    if (got >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.pickup();
  };
  return {
    peek: () => ({ x, got, items: items.map((i) => ({ x: i.x, y: i.y, rot: i.rot })), close, stun, reach, HY }),
    update(dt) {
      close -= dt; stun -= dt;
      next -= dt;
      if (next <= 0) { next = every * (0.7 + rnd() * 0.6); items.push({ x: 120 + rnd() * 720, y: 60, rot: rnd() < rotP, s: speed * (0.85 + rnd() * 0.3) }); }
      for (const it of items) it.y += it.s * dt;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].y > 540) items.splice(i, 1);
      if (stun <= 0) x = clamp(steerX(input, x, 520, mem, dt), 60, 900);
      for (const t of input.taps) { x = clamp(t.x, 60, 900); grab(); }
      if (input.pressed.has(' ')) grab();
    },
    draw(g) {
      const t = ctx.t;
      for (const it of items) { if (it.rot) rot(g, it.x, it.y, 24, t, it.x); else packet(g, ctx, it.x, it.y, 44); }
      // the claw
      const open = close > 0 ? 0.15 : 1;
      g.strokeStyle = stun > 0 ? '#39d353' : '#cfd6e2'; g.lineWidth = 10; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, 540); g.lineTo(x, HY + 30); g.stroke();
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(x, HY + 30); g.lineTo(x + s * (12 + reach * 0.7 * open), HY); g.lineTo(x + s * (4 + reach * 0.5 * open), HY - 26); g.stroke();
      }
      g.lineCap = 'butt';
      g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2; g.strokeRect(x - reach, HY - 70, reach * 2, 90);
      g.font = font(20); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`${got} / ${need}`, 920, 80);
      hint(g, 'GRAB the packets as they fall. Not the Rot!');
    },
  };
}

// stand: a plate tilts toward its heavy side; your weight is the only counter.
function stand(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const PV = { x: 480, y: 400 }; const L = 230;
  const slide = [120, 170, 210][tier];
  const every = [2.2, 1.8, 1.5][tier];
  const weight = [1.2, 1.3, 1.4][tier];
  const need = [9, 12, 15][tier];
  const FALL = 0.45;
  const blobs = []; const mem = { x: input.x };
  let s = 0; let th = 0; let T = 0; let next = 1.2; let walk = 0;
  return {
    peek: () => ({ s, th, T, need, blobs: blobs.map((b) => ({ s: b.s, w: b.w, land: b.land })), L }),
    update(dt) {
      T += dt; next -= dt;
      if (next <= 0) {
        // the Rot piles onto the side that's already down, unless that side is already loaded
        const load = blobs.reduce((a, q) => a + q.w * q.s, 0);
        let side = Math.abs(th) > 0.03 ? Math.sign(th) : rnd() < 0.5 ? -1 : 1;
        if (side * load > 180) side = -side;
        next = every * (0.75 + rnd() * 0.5);
        blobs.push({ s: side * (60 + rnd() * 110), land: 0.8, life: 2.6 + tier * 0.4, w: weight });
      }
      for (const b of blobs) { if (b.land > 0) { b.land -= dt; if (b.land <= 0) fx.burst(PV.x + b.s, PV.y - 10, '#39d353', 8, 140); } else b.life -= dt; }
      for (let i = blobs.length - 1; i >= 0; i--) if (blobs[i].life <= 0) blobs.splice(i, 1);
      // walk: toward the pointer, or with the arrows
      const ax = axis(input.keys).x;
      let goal = null;
      if (input.x !== mem.x || input.down) { mem.x = input.x; goal = input.x - PV.x; }
      const before = s;
      if (ax) s += ax * 240 * dt;
      else if (goal != null) s += clamp(goal - s, -300 * dt, 300 * dt);
      s += Math.sin(th) * slide * dt;
      s = clamp(s, -L, L);
      walk += Math.abs(s - before) / 300;
      const torque = s + blobs.filter((b) => b.land <= 0).reduce((a, b) => a + b.w * b.s, 0);
      const goalTh = clamp(torque / (L * 1.6), -1.2, 1.2) * 0.6;
      th += (goalTh - th) * [1.4, 1.9, 2.4][tier] * dt;
      if (Math.abs(th) > FALL) { fx.burst(PV.x + s, PV.y - 40, '#9fc6ff', 20, 260); ctx.lose('rot'); return; }
      if (T >= need) { fx.burst(PV.x + s, PV.y - 60, ctx.palette.accent, 30, 300); ctx.sfx.good(); ctx.win(); }
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#2a2f45';
      g.beginPath(); g.moveTo(PV.x, PV.y); g.lineTo(PV.x - 40, 520); g.lineTo(PV.x + 40, 520); g.closePath(); g.fill();
      g.save(); g.translate(PV.x, PV.y); g.rotate(th);
      g.fillStyle = Math.abs(th) > FALL * 0.7 ? '#ff6b6b' : ctx.palette.accent;
      g.fillRect(-L - 20, -10, (L + 20) * 2, 14);
      for (const b of blobs) if (b.land <= 0) rot(g, b.s, -34, 24, t, b.s);
      bot(g, s, -10, t, { walk, arms: Math.abs(th) * 1.5 });
      tileAt(g, ctx, s, -56, 18);
      g.restore();
      for (const b of blobs) if (b.land > 0) {
        const bx = PV.x + Math.cos(th) * b.s;
        g.fillStyle = 'rgba(57,211,83,0.35)'; g.beginPath(); g.ellipse(bx, PV.y + Math.sin(th) * b.s - 8, 26, 6, 0, 0, TAU); g.fill();
        rot(g, bx, PV.y - 30 - b.land * 380, 24, t, b.s);
      }
      // tilt gauge and time
      g.font = font(20); g.textAlign = 'left'; g.fillStyle = Math.abs(th) > FALL * 0.7 ? '#ff6b6b' : '#fff';
      g.fillText(`tilt ${Math.round((th * 180) / Math.PI)}°`, 40, 480);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(330, 66, 300, 10);
      g.fillStyle = ctx.palette.accent; g.fillRect(330, 66, 300 * clamp(T / need, 0, 1), 10);
      hint(g, 'STAND your ground: keep the plate level');
    },
  };
}

// place: a crane carries each piece; drop it into the slot of its shape.
const SHAPES = ['circle', 'square', 'triangle', 'star', 'hex'];
const COLORS = ['#ff7a59', '#ffd36b', '#5ad1ff', '#b98cff', '#7dffa0'];
function shape(g, kind, x, y, r, fill, stroke) {
  g.beginPath();
  if (kind === 'circle') g.arc(x, y, r, 0, TAU);
  else if (kind === 'square') g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (kind === 'triangle') { g.moveTo(x, y - r); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
  else { for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 4; g.stroke(); }
}
function place(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const n = [3, 4, 5][tier];
  const sp = [150, 210, 280][tier];
  const tol = [44, 30, 20][tier];
  const SY = 440; const HY = 120;
  const kinds = [...SHAPES].sort(() => rnd() - 0.5).slice(0, n);
  const slots = kinds.map((k, i) => ({ k, c: COLORS[SHAPES.indexOf(k)], x: (960 / (n + 1)) * (i + 1), full: false }));
  let hx = 140; let dir = 1; let piece = null; let drop = null; let back = null; let squat = null; let squatT = 3;
  const nextPiece = () => { const open = slots.filter((s) => !s.full); piece = open.length ? open[Math.floor(rnd() * open.length)].k : null; };
  nextPiece();
  return {
    peek: () => ({ hx, dir, sp, piece, drop, back, slots: slots.map((s) => ({ k: s.k, x: s.x, full: s.full })), tol, squat }),
    update(dt) {
      hx += dir * sp * dt;
      if (hx > 860) { hx = 860; dir = -1; } if (hx < 100) { hx = 100; dir = 1; }
      if (tier === 2) {
        squatT -= dt;
        if (!squat && squatT <= 0) { const open = slots.filter((s) => !s.full); if (open.length > 1) squat = { s: open[Math.floor(rnd() * open.length)], t: 2.5 }; squatT = 4; }
        if (squat && (squat.t -= dt) <= 0) squat = null;
      }
      if (back && (back.t += dt) > 0.6) back = null;
      if (piece && !drop && !back && (input.taps.length || input.pressed.has(' '))) { drop = { x: hx, y: HY + 40, vy: 0 }; ctx.sfx.click(); }
      if (drop) {
        drop.vy += 1400 * dt; drop.y += drop.vy * dt;
        if (drop.y >= SY) {
          const slot = slots.find((s) => Math.abs(s.x - drop.x) < tol);
          if (slot && !slot.full && slot.k === piece && !(squat && squat.s === slot)) {
            slot.full = true; fx.burst(slot.x, SY, slot.c, 22, 260);
            drop = null;
            if (slots.every((s) => s.full)) { ctx.sfx.good(); ctx.win(); return; }
            ctx.sfx.pickup(); nextPiece();
          } else { back = { x: drop.x, t: 0 }; fx.burst(drop.x, SY, '#39d353', 10, 180); drop = null; ctx.sfx.bad(); }
        }
      }
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#2a2f45'; g.fillRect(60, 70, 840, 12);
      g.fillStyle = '#4a5275'; g.fillRect(hx - 30, 66, 60, 22);
      g.strokeStyle = '#cfd6e2'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, 88); g.lineTo(hx, HY + 10); g.stroke();
      g.fillStyle = '#2a2f45'; g.fillRect(60, SY + 40, 840, 20);
      for (const s of slots) {
        g.fillStyle = '#1b2033'; g.fillRect(s.x - 50, SY - 40, 100, 80);
        shape(g, s.k, s.x, SY, 32, s.full ? s.c : null, s.full ? null : 'rgba(255,255,255,0.6)');
        if (squat && squat.s === s) rot(g, s.x, SY - 6, 30, t, s.x);
      }
      if (piece && !back) {
        const c = COLORS[SHAPES.indexOf(piece)];
        const x = drop ? drop.x : hx; const y = drop ? drop.y : HY + 40;
        if (!drop) { g.strokeStyle = 'rgba(255,255,255,0.15)'; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(x, y + 34); g.lineTo(x, SY - 40); g.stroke(); g.setLineDash([]); }
        shape(g, piece, x, y, 32, c, '#0b1020');
        tileAt(g, ctx, x, y, 16);
      }
      if (back) { g.globalAlpha = 1 - back.t / 0.6; shape(g, piece, back.x, SY - back.t * 300, 32, COLORS[SHAPES.indexOf(piece)], null); g.globalAlpha = 1; }
      hint(g, 'DROP it into the slot with the same shape');
    },
  };
}

// The packet and the bot, as in Move it.
function packet(g, ctx, x, y, s = 56) {
  g.fillStyle = 'rgba(0,0,0,0.35)'; rrect(g, x - s / 2 + 3, y - s / 2 + 4, s, s, 10); g.fill();
  g.fillStyle = '#20263a'; rrect(g, x - s / 2, y - s / 2, s, s, 10); g.fill();
  g.lineWidth = 3; g.strokeStyle = ctx.palette.accent; g.stroke();
  tileAt(g, ctx, x, y, s * 0.42);
}
function bot(g, x, y, t, { walk = 0, arms = 0, color = '#9fc6ff' } = {}) {
  const step = Math.sin(walk * 14) * 8;
  g.strokeStyle = '#cfd6e2'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 8, y - 24); g.lineTo(x - 8 + step, y); g.moveTo(x + 8, y - 24); g.lineTo(x + 8 - step, y); g.stroke();
  g.fillStyle = color; rrect(g, x - 22, y - 70, 44, 48, 12); g.fill();
  g.fillStyle = '#0b1020'; rrect(g, x - 15, y - 62, 30, 18, 6); g.fill();
  g.fillStyle = '#7fe0ff'; g.fillRect(x - 9, y - 57, 5, 8); g.fillRect(x + 3, y - 57, 5, 8);
  g.beginPath(); g.moveTo(x - 20, y - 44); g.lineTo(x - 40, y - 44 - arms * 30); g.moveTo(x + 20, y - 44); g.lineTo(x + 40, y - 44 + arms * 30); g.stroke();
  g.lineCap = 'butt';
}

const MODES = { hold, take, stand, place };

export default {
  seconds: 30,
  howTo: (m) => HOW[modeOf(m.id)],
  verb: (m) => VERB[modeOf(m.id)],
  start(ctx) {
    const fx = sparks();
    const game = MODES[modeOf(ctx.id)](ctx, fx);
    return {
      peek: game.peek,
      update: (dt) => game.update(Math.min(dt, 0.05)),
      draw(g) { game.draw(g); fx.draw(g, ctx.t); },
      destroy() {},
    };
  },
};
