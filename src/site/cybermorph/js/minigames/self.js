/**
 * Self (auto): autopilot. Lay arrow tiles on the course, press AUTO, and let go: the Morpher
 * flies itself and turns on each arrow. Touching anything while it runs grabs the controls
 * back and stops it. auto means self, so you win only by making it work on its own.
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

const COLS = 9; const ROWS = 5; const CELL = 68;
const GX = 480 - (COLS * CELL) / 2; const GY = 92;
const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const ARROW = ['▶', '▼', '◀', '▲'];
const BTN = { x: 480, y: 482, w: 180, h: 48 };
const key = (c, r) => `${c},${r}`;

/** Fewest arrows needed from start to goal (0-1 BFS over cell + heading). */
function fewestTurns(start, goal, blocked) {
  const best = new Map(); const dq = [[start[0], start[1], 0, 0]];
  while (dq.length) {
    const [c, r, d, n] = dq.shift();
    const k = `${c},${r},${d}`;
    if (best.has(k) && best.get(k) <= n) continue;
    best.set(k, n);
    if (c === goal[0] && r === goal[1]) return n;
    for (let nd = 0; nd < 4; nd++) {
      const nc = c + DIR[nd][0]; const nr = r + DIR[nd][1];
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || blocked.has(key(nc, nr))) continue;
      if (nd === d) dq.unshift([nc, nr, nd, n]); else dq.push([nc, nr, nd, n + 1]);
    }
  }
  return Infinity;
}

export default {
  seconds: 40,
  howTo: () => 'Tap squares to lay arrows (or use the arrow keys and Space), press AUTO, then let go! It flies itself. Touch anything and it stops.',
  verb: () => 'You set it to run by itself, and let it.',
  start(ctx) {
    const { tier, rnd, input } = ctx;
    const fx = sparks();
    const courses = [1, 2, 2][tier];
    const blocks = [6, 9, 12][tier];
    const turns = [[1, 2], [2, 4], [3, 5]][tier];
    const spare = [9, 2, 1][tier];
    let course = 0; let start; let goal; let blocked; let limit; let arrows; let need;
    const build = () => {
      for (let tries = 0; tries < 400; tries++) {
        start = [0, Math.floor(rnd() * ROWS)]; goal = [COLS - 1, Math.floor(rnd() * ROWS)];
        blocked = new Set();
        while (blocked.size < blocks) {
          const c = 1 + Math.floor(rnd() * (COLS - 2)); const r = Math.floor(rnd() * ROWS);
          blocked.add(key(c, r));
        }
        need = fewestTurns(start, goal, blocked);
        if (need >= turns[0] && need <= turns[1]) break;
      }
      limit = need + spare; arrows = new Map();
    };
    build();
    let state = 'setup'; let ship = null; let msg = null; let cur = [0, start[1]]; let st = 0; let full = 0;
    const say = (text, c = '#ffd36b') => { msg = { text, c, t: 1.8 }; };
    const launch = () => {
      if (state !== 'setup') return;
      state = 'run'; st = 0;
      ship = { c: start[0], r: start[1], d: arrows.has(key(...start)) ? arrows.get(key(...start)) : 0, k: 0, trail: [] };
      ctx.sfx.click();
    };
    const stop = (text, c) => { state = 'setup'; ship = null; say(text, c); };
    const cycle = (c, r) => {
      if (blocked.has(key(c, r)) || (c === goal[0] && r === goal[1])) return;
      const k = key(c, r);
      if (!arrows.has(k)) {
        if (arrows.size >= limit) { full = 0.6; say(`Only ${limit} arrows! Turn one off to move it.`); return; }
        arrows.set(k, 0);
      } else if (arrows.get(k) === 3) arrows.delete(k);
      else arrows.set(k, arrows.get(k) + 1);
      ctx.sfx.tick();
    };
    return {
      peek: () => ({ state, start, goal, blocked: [...blocked], arrows: [...arrows], need, limit, course, ship: ship && { c: ship.c, r: ship.r, d: ship.d } }),
      update(dt) {
        dt = Math.min(dt, 0.05);
        st += dt; full -= dt;
        if (msg && (msg.t -= dt) <= 0) msg = null;
        const k = input.pressed;
        if (state === 'run') {
          if (input.taps.length || k.size) { stop('Hands off! auto means it steers itSELF.', '#ff8a8a'); ctx.sfx.bad(); return; }
          ship.k += dt * 5;
          if (ship.k >= 1) {
            ship.k = 0;
            const nc = ship.c + DIR[ship.d][0]; const nr = ship.r + DIR[ship.d][1];
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || blocked.has(key(nc, nr))) {
              fx.burst(GX + (ship.c + 0.5 + DIR[ship.d][0] * 0.5) * CELL, GY + (ship.r + 0.5 + DIR[ship.d][1] * 0.5) * CELL, '#39d353', 18, 220);
              ctx.sfx.bad(); stop('Crashed! Fix your arrows and try AUTO again.'); return;
            }
            ship.trail.push([ship.c, ship.r]);
            if (ship.trail.length > 60) { stop('It’s going in circles! Change an arrow.'); return; }
            ship.c = nc; ship.r = nr;
            if (arrows.has(key(nc, nr))) ship.d = arrows.get(key(nc, nr));
            if (nc === goal[0] && nr === goal[1]) {
              fx.burst(GX + (nc + 0.5) * CELL, GY + (nr + 0.5) * CELL, ctx.palette.accent, 34, 320);
              course += 1;
              if (course >= courses) { state = 'done'; ctx.sfx.good(); ctx.win(); return; }
              ctx.sfx.pickup(); state = 'next'; st = 0;
            }
          }
          return;
        }
        if (state === 'next') { if (st > 1.1) { build(); state = 'setup'; ship = null; cur = [0, start[1]]; say('Next course!', '#7dffa0'); } return; }
        if (state !== 'setup') return;
        if (k.has('ArrowLeft') || k.has('a')) cur[0] = Math.max(0, cur[0] - 1);
        if (k.has('ArrowRight') || k.has('d')) cur[0] = Math.min(COLS - 1, cur[0] + 1);
        if (k.has('ArrowUp') || k.has('w')) cur[1] = Math.max(0, cur[1] - 1);
        if (k.has('ArrowDown') || k.has('s')) cur[1] = Math.min(ROWS, cur[1] + 1);
        if (k.has(' ')) { if (cur[1] === ROWS) launch(); else cycle(cur[0], cur[1]); }
        for (const t of input.taps) {
          if (Math.abs(t.x - BTN.x) < BTN.w / 2 && Math.abs(t.y - BTN.y) < BTN.h / 2) { launch(); break; }
          const c = Math.floor((t.x - GX) / CELL); const r = Math.floor((t.y - GY) / CELL);
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) { cur = [c, r]; cycle(c, r); }
        }
      },
      draw(g) {
        const t = ctx.t;
        for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
          const x = GX + c * CELL; const y = GY + r * CELL;
          g.fillStyle = (c + r) % 2 ? '#1b2033' : '#20263a'; g.fillRect(x, y, CELL, CELL);
          if (blocked.has(key(c, r))) rot(g, x + CELL / 2, y + CELL / 2, 22, t, c * 7 + r);
          const a = arrows.get(key(c, r));
          if (a != null) {
            g.fillStyle = 'rgba(127,224,255,0.18)'; g.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
            g.font = font(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7fe0ff'; g.fillText(ARROW[a], x + CELL / 2, y + CELL / 2 + 2);
          }
        }
        const gx = GX + (goal[0] + 0.5) * CELL; const gy = GY + (goal[1] + 0.5) * CELL;
        g.strokeStyle = ctx.palette.accent; g.lineWidth = 4;
        g.beginPath(); g.arc(gx, gy, 24 + Math.sin(t * 5) * 3, 0, TAU); g.stroke();
        g.font = font(14); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('GOAL', gx, gy - 38 < GY ? gy + 40 : gy - 36);
        if (state === 'setup' && cur[1] < ROWS) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(GX + cur[0] * CELL + 2, GY + cur[1] * CELL + 2, CELL - 4, CELL - 4); }
        // the Morpher
        let sc = start[0]; let sr = start[1]; let sd = arrows.has(key(...start)) ? arrows.get(key(...start)) : 0;
        if (ship) { sc = ship.c + DIR[ship.d][0] * ship.k; sr = ship.r + DIR[ship.d][1] * ship.k; sd = ship.d; }
        if (state !== 'next' && state !== 'done') {
          g.save(); g.translate(GX + (sc + 0.5) * CELL, GY + (sr + 0.5) * CELL); g.rotate((sd * Math.PI) / 2);
          g.fillStyle = '#9fc6ff'; g.beginPath(); g.moveTo(24, 0); g.lineTo(-16, -18); g.lineTo(-8, 0); g.lineTo(-16, 18); g.closePath(); g.fill();
          if (state === 'run') { g.fillStyle = '#ffb000'; g.beginPath(); g.arc(-14, 0, 5 + Math.sin(t * 40) * 2, 0, TAU); g.fill(); }
          g.restore();
          tileAt(g, ctx, GX + (sc + 0.5) * CELL, GY + (sr + 0.5) * CELL - 30, 14);
        }
        // AUTO button
        const sel = state === 'setup' && cur[1] === ROWS;
        g.fillStyle = state === 'run' ? '#2f6f3a' : '#2a2f45';
        rrect(g, BTN.x - BTN.w / 2, BTN.y - BTN.h / 2, BTN.w, BTN.h, 14); g.fill();
        g.lineWidth = 3; g.strokeStyle = sel ? '#fff' : ctx.palette.accent; g.stroke();
        g.font = font(22, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
        g.fillText(state === 'run' ? 'AUTO ON ✋' : 'AUTO ▸', BTN.x, BTN.y + 1);
        g.font = font(18); g.textAlign = 'left'; g.fillStyle = full > 0 ? '#ff8a8a' : '#fff';
        g.fillText(`arrows ${arrows.size} / ${limit}`, 40, 482);
        g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`course ${Math.min(course + 1, courses)} / ${courses}`, 920, 482);
        fx.draw(g, t);
        if (msg) { g.font = font(20); g.textAlign = 'center'; g.fillStyle = msg.c; g.fillText(msg.text, 480, 74); }
        hint(g, state === 'run' ? 'HANDS OFF! Let it fly itself…' : 'Lay arrows, then press AUTO', 34);
      },
      destroy() {},
    };
  },
};
