/**
 * Shape shifter (shape): the shape is the answer.
 *  - form, morph: the wire blob keeps changing shape; tap the moment it takes the target's shape.
 *  - gon: a spark runs round a wire loop; tap as it reaches each corner of the target to bend an angle there.
 *  - cycl: the same spark, but each tap rounds a corner off, until the wire is a wheel and rolls away.
 *  - sphere: pump a flat disc into a ball (pump on the green), while the Rot lets air out.
 *  - plic, ply: a crease runs along a strip; tap on the fold line to fold it over, again and again.
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
const ANY = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
const pressed = (input) => input.taps.length > 0 || ANY.some((k) => input.pressed.has(k));
const holding = (input) => input.down || ANY.some((k) => input.keys.has(k));

// ── shapes as radius functions r(θ), circumradius 1 ──
const TAU = Math.PI * 2;
const poly = (n, rot0) => (a) => { const s = TAU / n; const k = ((((a - rot0) % s) + s) % s) - s / 2; return Math.cos(Math.PI / n) / Math.cos(k); };
const SHAPES = {
  circle: () => 0.9,
  triangle: poly(3, -Math.PI / 2),
  square: poly(4, Math.PI / 4),
  hexagon: poly(6, 0),
  star: (a) => { const s = TAU / 5; const k = Math.abs(((((a + Math.PI / 2) % s) + s) % s) - s / 2) / (s / 2); return 0.45 + 0.55 * (1 - k); },
  flower: (a) => 0.72 + 0.22 * Math.cos(6 * a),
};
const SHAPE_EMOJI = { circle: '⚪', triangle: '🔺', square: '🟥', hexagon: '⬡', star: '⭐', flower: '🌸' };
function outline(g, cx, cy, R, f, steps = 90) {
  g.beginPath();
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * TAU; const r = R * f(a); const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.closePath();
}

const MODE = { form: 'morph', morph: 'morph', gon: 'corners', cycl: 'round', sphere: 'pump', plic: 'fold', ply: 'fold' };
const HOW = {
  morph: 'means shape: tap the moment the changing blob takes the target shape.',
  corners: 'means angle: tap as the spark reaches each corner to bend the wire there.',
  round: 'means circle: tap as the spark reaches each corner to round it off into a wheel.',
  pump: 'means ball: pump when the needle is on green to blow the flat disc up into a ball.',
  fold: 'means to fold: tap when the crease is on the fold line to fold the strip over.',
};
const VERB = {
  morph: 'You caught every new shape.', corners: 'You bent the wire into angles.', round: 'You rounded it into a wheel.',
  pump: 'You blew it up into a ball.', fold: 'You folded it over and over.',
};

export default {
  seconds: 30,
  howTo(m) { return `${m.text} ${HOW[MODE[m.id] || 'morph']}`; },
  verb(m) { return VERB[MODE[m.id] || 'morph']; },
  start(ctx) {
    const mode = MODE[ctx.id] || 'morph';
    if (mode === 'morph') return morphGame(ctx);
    if (mode === 'pump') return pumpGame(ctx);
    if (mode === 'fold') return foldGame(ctx);
    return wireGame(ctx, mode);
  },
};

function bg(g, ctx) {
  const b = g.createRadialGradient(ctx.W / 2, 300, 40, ctx.W / 2, 300, 600);
  b.addColorStop(0, '#1b2440'); b.addColorStop(1, '#070a14');
  g.fillStyle = b; g.fillRect(0, 0, ctx.W, ctx.H);
}

// form / morph: tap when the blob holds the target shape.
function morphGame(ctx) {
  const { W, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const names = Object.keys(SHAPES);
  const need = [2, 3, 4][tier];
  const hold = [1.0, 0.7, 0.45][tier];
  const blend = 0.45;
  let done = 0; let miss = 0; let target = names[1 + Math.floor(rnd() * (names.length - 1))];
  let from = 'circle'; let to = 'circle'; let phase = 'hold'; let pt = 0; let since = 0; let lock = 0; let glitch = 0;
  const cx = W / 2 + 140; const cy = 300; const R = 150;
  function nextShape() {
    const others = names.filter((n) => n !== to && n !== target);
    since += 1;
    return since >= 3 || rnd() < 0.3 ? (since = 0, target) : others[Math.floor(rnd() * others.length)];
  }
  const shapeNow = (a) => {
    const k = phase === 'hold' ? 1 : Math.min(1, pt / blend);
    const e = k * k * (3 - 2 * k);
    const j = tier === 2 ? Math.sin(a * 9 + ctx.t * 14) * 0.03 : 0;
    return SHAPES[from](a) * (1 - e) + SHAPES[to](a) * e + j + Math.sin(a * 13 + ctx.t * 30) * 0.05 * glitch;
  };
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ to, target, phase, pt, blend, lock });
  return {
    update(dt) {
      glitch = Math.max(0, glitch - dt * 2);
      if (lock > 0) { lock -= dt; if (lock <= 0) { const n = names.filter((x) => x !== target && x !== to); target = n[Math.floor(rnd() * n.length)]; since = 0; } return; }
      pt += dt;
      if (phase === 'hold' && pt > hold) { phase = 'blend'; pt = 0; from = to; to = nextShape(); }
      else if (phase === 'blend' && pt > blend) { phase = 'hold'; pt = 0; }
      if (pressed(ctx.input)) {
        const matched = to === target && (phase === 'hold' || pt > blend * 0.75);
        if (matched) {
          done += 1; lock = 0.7; ctx.sfx.pickup(); fx.burst(cx, cy, palette.glow, 34); fx.burst(cx, cy, '#fff', 14);
          if (done >= need) ctx.win();
        } else { miss += 1; glitch = 1; ctx.sfx.bad(); if (miss >= 3) ctx.lose('rot'); }
      }
    },
    draw(g) {
      bg(g, ctx);
      // the target card
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(60, 150, 250, 300, 18); g.fill();
      text(g, 'TARGET', 185, 182, 16, 'rgba(255,255,255,0.6)');
      g.setLineDash([8, 6]); g.strokeStyle = '#ffe14d'; g.lineWidth = 4; outline(g, 185, 310, 90, SHAPES[target]); g.stroke(); g.setLineDash([]);
      text(g, target.toUpperCase(), 185, 425, 20, '#ffe14d');
      // the blob
      g.setLineDash([8, 6]); g.strokeStyle = 'rgba(255,225,77,0.35)'; g.lineWidth = 3; outline(g, cx, cy, R, SHAPES[target]); g.stroke(); g.setLineDash([]);
      outline(g, cx, cy, R, shapeNow);
      const fg = g.createRadialGradient(cx - 50, cy - 50, 10, cx, cy, R);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.3, palette.glow); fg.addColorStop(1, palette.accent);
      g.fillStyle = lock > 0 ? '#ffe14d' : fg; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
      if (glitch > 0) rot(g, cx + 120, cy - 120, 26 * glitch + 8, ctx.t);
      fx.draw(g);
      hud(g, ctx, `Tap when it turns into the ${target}`, done, need);
      text(g, 'TAP or SPACE when the shapes match', W / 2, ctx.H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// gon: bend corners in; cycl: round corners off.
function wireGame(ctx, mode) {
  const { W, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const corners = mode === 'round';
  const need = [1, 2, 2][tier];
  const spin = [1.5, 2.1, 2.8][tier];
  const tol = [0.32, 0.24, 0.17][tier];
  const cx = W / 2; const cy = 300; const R = 170;
  let done = 0; let miss = 0; let n = 3; let rot0 = 0; let bent = []; let a = 0; let roll = 0; let glitch = 0;
  function deal() {
    n = mode === 'round' ? [4, 5, 6][tier] + done : [3, 4, 5][tier] + done;
    rot0 = rnd() * TAU; bent = Array(n).fill(false); roll = 0;
  }
  const cornerAngle = (i) => rot0 + (i * TAU) / n;
  // Each corner owns the arc around it: bent (gon) or not yet rounded (cycl) shows the polygon there.
  const wire = (th) => {
    const s = TAU / n; const i = Math.round((((th - rot0) % TAU) + TAU) % TAU / s) % n;
    const sharp = corners ? !bent[i] : bent[i];
    return sharp ? poly(n, rot0)(th) : Math.cos(Math.PI / n);
  };
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ a, n, bent, roll, tol, cornerAngle });
  deal();
  return {
    update(dt) {
      glitch = Math.max(0, glitch - dt * 2);
      if (roll > 0) { roll += dt; if (roll > 1.1) { if (done >= need) { ctx.win(); return; } deal(); } return; }
      a += spin * dt;
      if (tier === 2) a += Math.sin(ctx.t * 1.3) * dt;
      if (pressed(ctx.input)) {
        let hit = -1;
        for (let i = 0; i < n; i++) { const d = Math.atan2(Math.sin(a - cornerAngle(i)), Math.cos(a - cornerAngle(i))); if (Math.abs(d) < tol && !bent[i]) hit = i; }
        if (hit >= 0) {
          bent[hit] = true; ctx.sfx.tick();
          const p = poly(n, rot0)(cornerAngle(hit)) * R;
          fx.burst(cx + Math.cos(cornerAngle(hit)) * p, cy + Math.sin(cornerAngle(hit)) * p, palette.glow, 16);
          if (bent.every(Boolean)) { done += 1; roll = 0.001; ctx.sfx.pickup(); fx.burst(cx, cy, '#fff', 30); }
        } else { miss += 1; glitch = 1; ctx.sfx.bad(); if (miss >= 3) ctx.lose('rot'); }
      }
    },
    draw(g) {
      bg(g, ctx);
      let ox = cx; let spinA = 0;
      if (roll > 0 && corners) { ox = cx + roll * roll * 500; spinA = roll * 6; }
      g.save(); g.translate(ox, cy); g.rotate(spinA);
      // the target
      g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255,225,77,0.45)'; g.lineWidth = 3;
      outline(g, 0, 0, R, corners ? () => Math.cos(Math.PI / n) : poly(n, rot0), 120); g.stroke(); g.setLineDash([]);
      // the wire
      outline(g, 0, 0, R, (th) => wire(th) + Math.sin(th * 15 + ctx.t * 30) * 0.03 * glitch, 240);
      g.lineWidth = 9; g.strokeStyle = roll > 0 ? '#ffe14d' : palette.glow; g.lineJoin = 'round'; g.stroke();
      if (corners && roll > 0) for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-3, 0, 6, R * 0.8); }
      // corner marks
      if (roll === 0) for (let i = 0; i < n; i++) { const p = poly(n, rot0)(cornerAngle(i)) * R; g.fillStyle = bent[i] ? '#ffe14d' : 'rgba(255,225,77,0.5)'; g.beginPath(); g.arc(Math.cos(cornerAngle(i)) * p, Math.sin(cornerAngle(i)) * p, bent[i] ? 7 : 10, 0, TAU); g.fill(); }
      g.restore();
      // the spark
      if (roll === 0) {
        const r = R * 1.12;
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 11, 0, TAU); g.fill();
        g.fillStyle = palette.accent; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, 0, TAU); g.fill();
      }
      if (glitch > 0) rot(g, cx, cy, 30 * glitch + 6, ctx.t);
      if (roll > 0 && !corners) text(g, `${n} angles!`, cx, cy, 40, '#ffe14d');
      fx.draw(g);
      hud(g, ctx, corners ? 'Round off every corner into a wheel' : `Bend the wire into ${n} angles`, done, need);
      text(g, 'TAP or SPACE as the spark reaches a corner', W / 2, ctx.H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// sphere: pump the disc into a ball.
function pumpGame(ctx) {
  const { W, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const zone = [0.3, 0.22, 0.15][tier];
  const leak = [0.02, 0.05, 0.08][tier];
  const needle = [1.6, 2.2, 3.0][tier];
  const cx = W / 2 + 80; const cy = 300; const R = 140;
  let air = 0.08; let ph = 0; let pumpT = 0; let doneT = 0; let wobble = 0;
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ ph, zone, air });
  return {
    update(dt) {
      if (doneT > 0) { doneT += dt; if (doneT > 0.9) ctx.win(); return; }
      ph += needle * dt;
      wobble = Math.max(0, wobble - dt * 3);
      pumpT = Math.max(0, pumpT - dt * 4);
      air = Math.max(0.05, air - leak * dt);
      if (pressed(ctx.input)) {
        const v = (Math.sin(ph) + 1) / 2;
        pumpT = 1;
        if (v > 1 - zone) { air += 0.2; ctx.sfx.tick(); fx.burst(cx - R - 40, cy + 40, palette.glow, 8, 120); } else if (v < 0.25) { air = Math.max(0.05, air - 0.1); wobble = 1; ctx.sfx.bad(); } else { air = Math.max(0.05, air - 0.02); ctx.sfx.click(); }
        if (air >= 1) { air = 1; doneT = 0.001; ctx.sfx.pickup(); fx.burst(cx, cy, palette.glow, 40); fx.burst(cx, cy, '#fff', 16); }
      }
    },
    draw(g) {
      bg(g, ctx);
      const ry = R * (0.12 + 0.88 * air);
      const bounce = doneT > 0 ? -Math.abs(Math.sin(doneT * 9)) * 60 : 0;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, cy + R + 10, R, 18, 0, 0, TAU); g.fill();
      const sy = cy + (R - ry) + bounce;
      const sg = g.createRadialGradient(cx - R * 0.35, sy - ry * 0.4, 10, cx, sy, R);
      sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.35, palette.glow); sg.addColorStop(1, palette.accent);
      g.fillStyle = sg; g.beginPath(); g.ellipse(cx + Math.sin(ctx.t * 40) * 6 * wobble, sy, R, ry, 0, 0, TAU); g.fill();
      if (air > 0.5) { g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx, sy + k * ry * 0.35, R * Math.sqrt(1 - (k * 0.35) ** 2), ry * 0.12, 0, 0, TAU); g.stroke(); } }
      // the pump
      const px = cx - R - 120;
      g.fillStyle = '#5a6a7c'; g.fillRect(px - 26, 260, 52, 160);
      g.fillStyle = '#c8d0dc'; g.fillRect(px - 6, 210 + pumpT * 50, 12, 60); g.fillRect(px - 40, 200 + pumpT * 50, 80, 14);
      g.strokeStyle = '#5a6a7c'; g.lineWidth = 8; g.beginPath(); g.moveTo(px + 26, 400); g.quadraticCurveTo(px + 90, 440, cx - R * 0.9, cy + 60); g.stroke();
      // the gauge
      const gx = 120; const gy = 190;
      g.lineWidth = 18;
      g.strokeStyle = '#ff5a7a'; g.beginPath(); g.arc(gx, gy, 70, Math.PI, Math.PI + Math.PI * 0.25); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.arc(gx, gy, 70, Math.PI + Math.PI * 0.25, TAU - Math.PI * zone); g.stroke();
      g.strokeStyle = '#4ade80'; g.beginPath(); g.arc(gx, gy, 70, TAU - Math.PI * zone, TAU); g.stroke();
      const v = (Math.sin(ph) + 1) / 2; const na = Math.PI + v * Math.PI;
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(na) * 66, gy + Math.sin(na) * 66); g.stroke();
      text(g, 'PUMP ON GREEN', gx, gy + 30, 13, 'rgba(255,255,255,0.7)');
      // air meter
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(W - 60, 120, 26, 330);
      g.fillStyle = palette.glow; g.fillRect(W - 60, 450 - 330 * air, 26, 330 * air);
      emoji(g, '⚽', W - 47, 100, 26);
      rot(g, cx + R * 0.7, cy + R - 10, 18 + leak * 120, ctx.t);
      fx.draw(g);
      hud(g, ctx, 'Pump the flat disc into a ball', Math.floor(air * 5), 5);
      text(g, 'TAP or SPACE to pump', W / 2, ctx.H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
    },
    destroy() {},
  };
}

// plic / ply: fold the strip over at its fold line.
function foldGame(ctx) {
  const { W, rnd, tier, palette } = ctx;
  const fx = makeFx(ctx);
  const need = [2, 3, 4][tier];
  const speed = [260, 360, 480][tier];
  const tol = [26, 18, 12][tier];
  const x0 = 120; const y = 300;
  let len = 720; let layers = 1; let line = 0; let c = 0; let dir = 1; let done = 0; let miss = 0; let flip = 0; let glitch = 0;
  function newLine() { line = len * (0.4 + rnd() * 0.2); }
  newLine();
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ c, line, tol, flip });
  return {
    update(dt) {
      glitch = Math.max(0, glitch - dt * 2);
      if (flip > 0) {
        flip += dt;
        if (flip > 0.45) { flip = 0; const right = len - line; len = Math.max(line, right); layers *= 2; done += 1; if (done >= need) { ctx.win(); return; } newLine(); c = 0; dir = 1; }
        return;
      }
      c += dir * speed * dt * (tier === 2 ? 1 + 0.4 * Math.sin(ctx.t * 3) : 1);
      if (c > len) { c = len; dir = -1; } else if (c < 0) { c = 0; dir = 1; }
      if (pressed(ctx.input)) {
        if (Math.abs(c - line) <= tol) { flip = 0.001; ctx.sfx.pickup(); fx.burst(x0 + line, y, palette.glow, 24); fx.burst(x0 + line, y, '#fff', 10); }
        else { miss += 1; glitch = 1; ctx.sfx.bad(); if (miss >= 3) ctx.lose('rot'); }
      }
    },
    draw(g) {
      bg(g, ctx);
      const h = 120;
      const paper = (x, w, shade) => {
        g.fillStyle = shade; g.fillRect(x, y - h / 2, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(x, y - h / 2, w, h);
      };
      const shade = ['#f4f0e6', '#e6dfcc', '#d6ccb2', '#c6b996', '#b6a67e'][Math.min(4, Math.log2(layers))];
      // the stack of layers under the strip
      for (let i = Math.min(4, Math.log2(layers)); i > 0; i--) paper(x0 + i * 4, len, 'rgba(0,0,0,0.25)');
      if (flip > 0) {
        const k = Math.min(1, flip / 0.45);
        paper(x0, line, shade);
        const sx = Math.cos(k * Math.PI);
        g.save(); g.translate(x0 + line, 0); g.scale(sx, 1);
        paper(0, len - line, sx > 0 ? shade : palette.glow);
        g.restore();
      } else {
        paper(x0, len, shade);
        if (glitch > 0) { g.strokeStyle = '#7dff4a'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 10; i++) g.lineTo(x0 + c - 40 + i * 9, y + (i % 2 ? -20 : 20)); g.stroke(); }
        g.setLineDash([10, 8]); g.strokeStyle = palette.accent; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x0 + line, y - h / 2 - 20); g.lineTo(x0 + line, y + h / 2 + 20); g.stroke(); g.setLineDash([]);
        text(g, 'FOLD', x0 + line, y + h / 2 + 40, 16, palette.accent);
        // the crease runner
        g.fillStyle = '#ffe14d'; g.beginPath(); g.moveTo(x0 + c, y - h / 2 - 8); g.lineTo(x0 + c - 14, y - h / 2 - 32); g.lineTo(x0 + c + 14, y - h / 2 - 32); g.fill();
        g.fillStyle = 'rgba(255,225,77,0.5)'; g.fillRect(x0 + c - 2, y - h / 2, 4, h);
      }
      text(g, `${layers} layer${layers > 1 ? 's' : ''}`, x0, y - h / 2 - 50, 18, '#fff', 'left');
      rot(g, x0 + len + 50, y, 20, ctx.t);
      fx.draw(g);
      hud(g, ctx, `Fold the strip ${need} times`, done, need);
      text(g, 'TAP or SPACE when the arrow is on the fold line', W / 2, ctx.H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}
