/**
 * How many, how big (count): the number is the answer.
 *  - mono, bi, tri, tris, deka: pop the bubble holding exactly that many, while the Rot sneaks
 *    pieces from bubble to bubble (so you count, not guess).
 *  - multi, poly: pop the bubble holding MANY, while the Rot shuffles the bubbles around.
 *  - micro, mega: hold to shrink (or grow) the orb until it fills the dashed ring, then let go.
 *  - meter, metr: hold to run the tape measure along the beam and let go right at its end.
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
const keyIn = (set, ks) => ks.some((k) => set.has(k));
const LEFT = ['ArrowLeft', 'a'];
const RIGHT = ['ArrowRight', 'd'];
const HOLD = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd'];

// ── the game ──
const NUM = { mono: 1, bi: 2, tri: 3, tris: 3, deka: 10 };
const WORD = { 1: 'ONE', 2: 'TWO', 3: 'THREE', 10: 'TEN' };
const modeOf = (id) => (id in NUM ? 'count' : id === 'multi' || id === 'poly' ? 'many'
  : id === 'micro' || id === 'mega' ? 'size' : 'measure');
const THINGS = ['🤖', '⭐', '🍎', '👾', '💎', '🐟', '🎈', '🍩', '🐞'];

export default {
  seconds: 30,
  howTo(m) {
    const mode = modeOf(m.id);
    if (mode === 'count') return `${m.text} means ${NUM[m.id]}: pop the bubble with exactly ${NUM[m.id]} inside. Count fast, the Rot moves them!`;
    if (mode === 'many') return `${m.text} means many: pop the bubble that holds MANY, even when the Rot shuffles them.`;
    if (m.id === 'micro') return 'micro means small: hold to shrink the orb, and let go when it just fills the tiny ring.';
    if (m.id === 'mega') return 'mega means huge: hold to grow the orb, and let go when it just fills the giant ring.';
    return `${m.text} means to measure: hold to stretch the tape, and let go right at the end of the beam.`;
  },
  verb(m) {
    const mode = modeOf(m.id);
    if (mode === 'count') return `You found ${WORD[NUM[m.id]].toLowerCase()} every time.`;
    if (mode === 'many') return 'You picked out the many every time.';
    if (m.id === 'micro') return 'You shrank it small enough to slip through.';
    if (m.id === 'mega') return 'You made it huge and squashed the Rot.';
    return 'You measured every beam to the end.';
  },
  start(ctx) {
    const mode = modeOf(ctx.id);
    if (mode === 'size') return sizeGame(ctx);
    if (mode === 'measure') return measureGame(ctx);
    return bubbleGame(ctx, mode);
  },
};

// Pop the bubble with N (or MANY).
function bubbleGame(ctx, mode) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const N = NUM[ctx.id];
  const need = [3, 4, 5][tier];
  const nBubbles = tier === 0 ? 3 : 4;
  const R = 94;
  let done = 0; let wrong = 0; let bubbles = []; let sel = 0; let kbd = false; let wait = 0;
  const rotty = { x: -60, y: 120, task: null, cool: 2.2, carry: false };
  const rotEvery = [99, 3.2, 2.0][tier];

  function deal() {
    let counts;
    if (mode === 'many') {
      const lo = tier === 2 ? 2 : 1;
      counts = [7 + Math.floor(rnd() * 5)];
      while (counts.length < nBubbles) counts.push(lo + Math.floor(rnd() * (tier === 2 ? 3 : 2)));
    } else {
      const deltas = (tier === 0 ? [-3, -2, 2, 3] : [-2, -1, 1, 2, 3]).map((d) => N + d).filter((n) => n > 0);
      counts = [N];
      while (counts.length < nBubbles) { const c = deltas[Math.floor(rnd() * deltas.length)]; if (!counts.includes(c)) counts.push(c); }
    }
    counts.sort(() => rnd() - 0.5);
    const e = THINGS[Math.floor(rnd() * THINGS.length)];
    bubbles = counts.map((n, i) => ({ n, e, x: (W / (nBubbles + 1)) * (i + 1), y: 300, hx: 0, ph: rnd() * 6, shake: 0, pop: 0 }));
    bubbles.forEach((b) => { b.hx = b.x; });
    sel = 0;
  }
  const isAnswer = (b) => (mode === 'many' ? b.n === Math.max(...bubbles.map((o) => o.n)) : b.n === N);

  function pick(b) {
    if (isAnswer(b)) {
      done += 1; b.pop = 1; ctx.sfx.pickup();
      fx.burst(b.x, b.y, palette.glow, 30); fx.burst(b.x, b.y, '#fff', 12);
      if (done >= need) { ctx.win(); return; }
      wait = 0.55;
    } else {
      wrong += 1; b.shake = 1; ctx.sfx.bad();
      fx.burst(b.x, b.y, '#7dff4a', 10, 160);
      if (wrong >= 3) ctx.lose('rot');
    }
  }

  function rotStep(dt) {
    if (mode === 'many') {
      // The Rot swaps two bubbles' places: a shell game.
      rotty.cool -= dt;
      if (rotty.cool <= 0) {
        rotty.cool = rotEvery;
        const a = Math.floor(rnd() * bubbles.length); let b = Math.floor(rnd() * bubbles.length);
        if (a === b) b = (b + 1) % bubbles.length;
        const t = bubbles[a].hx; bubbles[a].hx = bubbles[b].hx; bubbles[b].hx = t;
        ctx.sfx.click();
      }
      rotty.x += ((bubbles[0] ? W / 2 : 0) - rotty.x) * dt; rotty.y = 110;
      return;
    }
    // The Rot carries one piece from bubble to bubble, so counts change.
    if (!rotty.task) {
      rotty.cool -= dt;
      if (rotty.cool > 0) { rotty.x += (W / 2 - rotty.x) * dt * 0.8; rotty.y = 110 + Math.sin(ctx.t * 2) * 10; return; }
      const order = bubbles.map((_, i) => i).sort(() => rnd() - 0.5);
      for (const a of order) {
        for (const b of order) {
          if (a === b || bubbles[a].n <= 1) continue;
          const after = bubbles.map((o, i) => o.n + (i === b ? 1 : 0) - (i === a ? 1 : 0));
          if (after.filter((n) => n === N).length === 1) { rotty.task = { a, b }; rotty.carry = false; break; }
        }
        if (rotty.task) break;
      }
      rotty.cool = rotEvery;
      return;
    }
    const { a, b } = rotty.task;
    const tgt = rotty.carry ? bubbles[b] : bubbles[a];
    const dx = tgt.x - rotty.x; const dy = tgt.y - R - 10 - rotty.y; const d = Math.hypot(dx, dy);
    const sp = 420 * dt;
    if (d > sp) { rotty.x += (dx / d) * sp; rotty.y += (dy / d) * sp; return; }
    if (!rotty.carry) { bubbles[a].n -= 1; rotty.carry = true; ctx.sfx.click(); } else { bubbles[b].n += 1; rotty.task = null; rotty.carry = false; ctx.sfx.click(); }
  }

  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ bubbles, wait, isAnswer });
  deal();
  return {
    update(dt) {
      if (wait > 0) { wait -= dt; if (wait <= 0) deal(); return; }
      bubbles.forEach((b) => { b.x += (b.hx - b.x) * Math.min(1, dt * 4); b.y = 300 + Math.sin(ctx.t * 1.6 + b.ph) * 16; b.shake = Math.max(0, b.shake - dt * 2.5); });
      if (tier > 0) rotStep(dt);
      if (keyIn(input.pressed, LEFT)) { kbd = true; sel = (sel + bubbles.length - 1) % bubbles.length; ctx.sfx.click(); }
      if (keyIn(input.pressed, RIGHT)) { kbd = true; sel = (sel + 1) % bubbles.length; ctx.sfx.click(); }
      const ordered = [...bubbles].sort((p, q) => p.x - q.x);
      if (input.pressed.has(' ')) { kbd = true; pick(ordered[sel]); return; }
      for (const t of input.taps) {
        const b = bubbles.find((o) => Math.hypot(t.x - o.x, t.y - o.y) < R);
        if (b) { kbd = false; pick(b); return; }
      }
    },
    draw(g) {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0d1b3a'); bg.addColorStop(1, '#03070f');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(56,182,255,0.12)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x, H); g.stroke(); }
      const ordered = [...bubbles].sort((p, q) => p.x - q.x);
      bubbles.forEach((b) => {
        if (b.pop && wait > 0) return;
        const sx = Math.sin(b.shake * 40) * 10 * b.shake;
        g.save(); g.translate(b.x + sx, b.y);
        g.beginPath(); g.arc(0, 0, R, 0, 7);
        const rg = g.createRadialGradient(-30, -30, 10, 0, 0, R);
        rg.addColorStop(0, 'rgba(255,255,255,0.22)'); rg.addColorStop(1, 'rgba(56,182,255,0.06)');
        g.fillStyle = rg; g.fill();
        g.lineWidth = kbd && ordered[sel] === b ? 7 : 3;
        g.strokeStyle = kbd && ordered[sel] === b ? '#ffe14d' : palette.glow; g.stroke();
        const n = b.n; const cols = n >= 10 ? 5 : n <= 3 ? n : n === 4 ? 2 : 3;
        const cell = n > 9 ? 33 : n > 6 ? 38 : 46; const rows = Math.ceil(n / cols);
        for (let i = 0; i < n; i++) {
          const r = Math.floor(i / cols); const c = i % cols; const inRow = Math.min(cols, n - r * cols);
          emoji(g, b.e, (c - (inRow - 1) / 2) * cell, (r - (rows - 1) / 2) * cell, cell * 0.78);
        }
        g.restore();
      });
      if (tier > 0) {
        rot(g, rotty.x, rotty.y, 26, ctx.t);
        if (rotty.carry && bubbles[0]) emoji(g, bubbles[0].e, rotty.x, rotty.y + 30, 26);
      }
      fx.draw(g);
      hud(g, ctx, mode === 'many' ? 'Pop the bubble with MANY' : `Pop the bubble with exactly ${N}  (${WORD[N]})`, done, need);
      text(g, kbd ? '◀ ▶ choose · SPACE pop' : 'Tap a bubble · or ◀ ▶ and SPACE', W / 2, H - 34, 16, 'rgba(255,255,255,0.55)', 'center', 400);
      for (let i = 0; i < 3; i++) rot(g, 30 + i * 34, H - 36, i < wrong ? 13 : 5, ctx.t + i);
    },
    destroy() {},
  };
}

// micro / mega: hold to shrink or grow the orb until it fills the dashed ring.
function sizeGame(ctx) {
  const { W, H, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const micro = ctx.id === 'micro';
  const targets = micro ? [[90, 55, 34], [70, 40, 22], [60, 32, 16]][tier] : [[120, 180, 230], [110, 170, 240], [100, 165, 235]][tier];
  const startSize = micro ? 210 : 20;
  const rate = [0.75, 1.0, 1.35][tier];
  const tol = [0.24, 0.16, 0.11][tier];
  const cx = W / 2; const cy = 300;
  let round = 0; let size = startSize; let was = false; let misses = 0; let anim = 0; let animKind = ''; let msg = ''; let msgT = 0;

  function reset() { size = startSize; was = false; }
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ size, target: targets[round], tol, anim });
  return {
    update(dt) {
      msgT = Math.max(0, msgT - dt);
      if (anim > 0) {
        anim -= dt;
        if (anim <= 0) { if (animKind === 'pass') { round += 1; if (round >= targets.length) { ctx.win(); return; } } reset(); }
        return;
      }
      const target = targets[round];
      const holding = input.down || keyIn(input.keys, HOLD);
      if (holding) {
        size *= Math.exp((micro ? -1 : 1) * rate * dt);
        if (Math.floor(ctx.t * 8) !== Math.floor((ctx.t - dt) * 8)) ctx.sfx.tick();
        const over = micro ? size < target * (1 - tol) : size > target * (1 + tol);
        if (over) {
          misses += 1; anim = 0.8; animKind = 'miss'; msg = micro ? 'Too tiny! The Rot swallowed it.' : 'Too big! It burst.'; msgT = 1.2;
          ctx.sfx.bad(); fx.burst(cx, cy, '#7dff4a', 20);
          if (misses >= 3) ctx.lose('rot');
          return;
        }
      } else if (was) {
        if (Math.abs(size - target) <= target * tol) {
          anim = 0.75; animKind = 'pass'; msg = micro ? 'It fits!' : 'Squashed!'; msgT = 1;
          ctx.sfx.pickup(); fx.burst(cx, cy, palette.glow, 34); fx.burst(cx, cy, '#fff', 14);
        } else {
          misses += 1; anim = 0.7; animKind = 'miss'; msg = micro ? 'Still too big to fit.' : 'Still too small to cover it.'; msgT = 1.2;
          ctx.sfx.bad();
          if (misses >= 3) ctx.lose('rot');
        }
      }
      was = holding;
    },
    draw(g) {
      g.fillStyle = micro ? '#06121f' : '#170a24'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect((i * 173) % W, 70 + ((i * 97) % (H - 80)), 2, 2); }
      const target = targets[Math.min(round, targets.length - 1)];
      const passing = anim > 0 && animKind === 'pass';
      // the Rot hides inside the ring
      if (!passing) rot(g, cx, cy, Math.max(8, target * 0.45), ctx.t);
      // the orb
      let r = size; let ox = cx; let oy = cy; let alpha = 1;
      if (passing) { const k = 1 - anim / 0.75; if (micro) { oy = cy - k * 400; r = size * (1 - k * 0.5); } else { r = size * (1 + Math.sin(k * Math.PI) * 0.15); } alpha = 1 - k * 0.6; }
      if (anim > 0 && animKind === 'miss') alpha = anim;
      g.globalAlpha = alpha;
      const og = g.createRadialGradient(ox - r * 0.35, oy - r * 0.35, r * 0.1, ox, oy, r);
      og.addColorStop(0, '#ffffff'); og.addColorStop(0.35, palette.glow); og.addColorStop(1, palette.accent);
      g.fillStyle = og; g.beginPath(); g.arc(ox, oy, Math.max(2, r), 0, 7); g.fill();
      if (r > 30) emoji(g, '🤖', ox, oy + 2, r * 0.9);
      g.globalAlpha = 1;
      // the ring goes on top, so you can see it through the orb
      g.setLineDash([10, 8]); g.lineWidth = 5; g.strokeStyle = '#ffe14d';
      g.beginPath(); g.arc(cx, cy, target, 0, 7); g.stroke(); g.setLineDash([]);
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,225,77,0.35)';
      g.beginPath(); g.arc(cx, cy, target * (1 + tol), 0, 7); g.arc(cx, cy, target * (1 - tol), 0, 7); g.stroke();
      fx.draw(g);
      hud(g, ctx, micro ? 'Shrink it to fit the ring' : 'Grow it to fill the ring', round, targets.length);
      text(g, `${micro ? '÷' : '×'} ${(micro ? startSize / size : size / startSize).toFixed(1)}`, W - 90, H - 70, 30, '#ffe14d');
      text(g, 'HOLD (mouse or SPACE) · let go when it fits', W / 2, H - 34, 16, 'rgba(255,255,255,0.6)', 'center', 400);
      if (msgT > 0) text(g, msg, W / 2, 110, 26, animKind === 'pass' ? '#9dffb0' : '#ff8a8a');
      for (let i = 0; i < 3; i++) rot(g, 30 + i * 34, H - 36, i < misses ? 13 : 5, ctx.t + i);
    },
    destroy() {},
  };
}

// meter / metr: hold to stretch the tape to the end of the beam.
function measureGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const U = 70; const x0 = 100; const beamY = 260;
  const speed = [190, 260, 360][tier];
  const tol = [22, 14, 9][tier];
  const need = 3;
  let done = 0; let misses = 0; let len = 0; let tape = 0; let was = false; let anim = 0; let animKind = ''; let msg = ''; let msgT = 0;
  const BEAMS = ['🐊', '🐍', '🚂', '🦕', '🐋'];
  let beamE = BEAMS[0];
  function deal() { len = U * (4 + Math.floor(rnd() * 7)) + (tier === 2 ? Math.floor(rnd() * 2) * U / 2 : 0); tape = 0; was = false; beamE = BEAMS[Math.floor(rnd() * BEAMS.length)]; }
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ tape, len, tol, anim });
  deal();
  return {
    update(dt) {
      msgT = Math.max(0, msgT - dt);
      if (anim > 0) { anim -= dt; if (anim <= 0) { if (animKind === 'pass' && done >= need) { ctx.win(); return; } deal(); } return; }
      const holding = input.down || keyIn(input.keys, HOLD);
      if (holding) {
        tape += speed * dt;
        if (Math.floor(tape / U) !== Math.floor((tape - speed * dt) / U)) ctx.sfx.tick();
        if (tape > len + tol) { misses += 1; anim = 0.8; animKind = 'miss'; msg = 'Too long! Measure again.'; msgT = 1.2; ctx.sfx.bad(); if (misses >= 3) ctx.lose('rot'); return; }
      } else if (was) {
        if (Math.abs(tape - len) <= tol) {
          done += 1; anim = 0.9; animKind = 'pass'; msg = `It measures ${(len / U).toString()} m!`; msgT = 1.1;
          ctx.sfx.pickup(); fx.burst(x0 + len, beamY, palette.glow, 30); fx.burst(x0 + len, beamY, '#fff', 12);
        } else { misses += 1; anim = 0.8; animKind = 'miss'; msg = 'Too short! Keep going to the end.'; msgT = 1.2; ctx.sfx.bad(); if (misses >= 3) ctx.lose('rot'); return; }
      }
      was = holding;
    },
    draw(g) {
      g.fillStyle = '#10141c'; g.fillRect(0, 0, W, H);
      // ruler
      g.fillStyle = '#e8c46a'; g.fillRect(x0 - 10, 360, W - x0 - 40, 54);
      for (let i = 0; i * U <= W - x0 - 60; i++) {
        g.fillStyle = '#3b2a08'; g.fillRect(x0 + i * U - 1, 360, 3, 26);
        if (i * U + U / 2 <= W - x0 - 60) g.fillRect(x0 + i * U + U / 2 - 1, 360, 2, 14);
        text(g, String(i), x0 + i * U, 400, 16, '#3b2a08');
      }
      // the beam (a creature to measure)
      const bg = g.createLinearGradient(0, beamY - 26, 0, beamY + 26);
      bg.addColorStop(0, palette.glow); bg.addColorStop(1, palette.accent);
      g.fillStyle = bg; g.beginPath(); g.roundRect(x0, beamY - 22, len, 44, 12); g.fill();
      emoji(g, beamE, x0 + 30, beamY - 52, 44);
      if (!(anim > 0 && animKind === 'pass')) rot(g, x0 + len + 4, beamY - 30, 16, ctx.t);
      // the tape
      g.fillStyle = '#ffe14d'; g.fillRect(x0, beamY + 34, tape, 12);
      g.fillStyle = '#c8a400'; for (let x = 0; x < tape; x += U / 2) g.fillRect(x0 + x, beamY + 34, 2, 12);
      g.fillStyle = '#ffe14d'; g.beginPath(); g.moveTo(x0 + tape, beamY + 28); g.lineTo(x0 + tape + 10, beamY + 40); g.lineTo(x0 + tape, beamY + 52); g.fill();
      text(g, `${(tape / U).toFixed(1)} m`, x0 + tape, beamY + 74, 18, '#ffe14d');
      fx.draw(g);
      hud(g, ctx, 'Measure the beam: stop the tape at its end', done, need);
      text(g, 'HOLD (mouse or SPACE) to stretch · let go at the end', W / 2, H - 34, 16, 'rgba(255,255,255,0.6)', 'center', 400);
      if (msgT > 0) text(g, msg, W / 2, 120, 26, animKind === 'pass' ? '#9dffb0' : '#ff8a8a');
      for (let i = 0; i < 3; i++) rot(g, 30 + i * 34, H - 36, i < misses ? 13 : 5, ctx.t + i);
    },
    destroy() {},
  };
}
