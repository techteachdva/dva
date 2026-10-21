/**
 * Build & make (struct, stru, fact, fac, fect, fic, act, techn): blocks fall one at a time,
 * and you steer and drop them into the dotted outline. A block that lands outside the plan
 * crumbles into Rot. The blocks only become the thing (a tower, a factory, a rocket) once
 * you have put every one in place.
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

const COLS = 10; const CELL = 44; const X0 = 480 - (COLS * CELL) / 2; const FLOOR = 470;
// Column heights for each plan, by tier (about 8, 12 and 16 blocks).
const PLANS = {
  build: [
    { name: 'a tower', h: [0, 0, 1, 2, 2, 2, 1, 0, 0, 0] },
    { name: 'a pyramid', h: [0, 1, 2, 3, 3, 2, 1, 0, 0, 0] },
    { name: 'a castle', h: [2, 3, 1, 1, 1, 1, 1, 1, 3, 2] },
  ],
  make: [
    { name: 'a factory', h: [0, 0, 2, 1, 1, 2, 2, 0, 0, 0] },
    { name: 'a factory', h: [0, 3, 1, 1, 1, 1, 3, 1, 0, 0] },
    { name: 'a factory', h: [1, 4, 1, 2, 2, 1, 4, 1, 0, 0] },
  ],
  act: [
    { name: 'a stage', h: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0] },
    { name: 'a staircase', h: [1, 2, 3, 4, 0, 0, 0, 0, 1, 1] },
    { name: 'a stadium', h: [1, 1, 2, 2, 3, 3, 2, 1, 1, 0] },
  ],
  techn: [
    { name: 'a rocket', h: [0, 0, 1, 1, 4, 1, 1, 0, 0, 0] },
    { name: 'a rocket', h: [0, 0, 1, 2, 6, 2, 1, 0, 0, 0] },
    { name: 'a rocket', h: [0, 1, 1, 3, 6, 3, 1, 1, 0, 0] },
  ],
};
const KIND = { struct: 'build', stru: 'build', fact: 'make', fac: 'make', fect: 'make', fic: 'make', act: 'act', techn: 'techn' };
const VERB = { build: 'You built it, block by block.', make: 'You made it from its parts.', act: 'You did it: every block in place.', techn: 'You crafted it with skill.' };
const SHAPE = { one: [[0, 0]], h2: [[0, 0], [1, 0]], v2: [[0, 0], [0, 1]] };
const ROTATE = { one: 'one', h2: 'v2', v2: 'h2' };
const BTN = { x: 110, y: 450, r: 38 };

export default {
  seconds: 30,
  howTo: () => 'Steer each falling block (move, or ← →) and drop it (tap, or Space) to fill the dotted plan. ⟳ or ↑ turns a long block.',
  verb: (m) => VERB[KIND[m.id] || 'build'],
  start(ctx) {
    const { tier, rnd, input, id } = ctx;
    const fx = sparks();
    const plan = PLANS[KIND[id] || 'build'][tier];
    const target = plan.h;
    const h = Array(COLS).fill(0);
    const fall = [55, 80, 110][tier];
    const twoP = [0, 0.3, 0.5][tier];
    let piece = null; let wait = 0.4; let crumble = null; let done = false; let lift = 0; let knock = null; let knockT = 6;
    let lastPtr = { x: input.x, y: input.y }; let lastC = Math.floor(COLS / 2) - 1;
    const need = (c) => target[c] - h[c];
    const fits = (type, c) => {
      if (type === 'one') return c >= 0 && c < COLS && h[c] < target[c];
      if (type === 'v2') return c >= 0 && c < COLS && h[c] + 2 <= target[c];
      return c >= 0 && c + 1 < COLS && h[c] === h[c + 1] && h[c] < target[c] && h[c + 1] < target[c + 1];
    };
    const anyFit = (type) => Array.from({ length: COLS }, (_, c) => c).some((c) => fits(type, c));
    const spawn = () => {
      let type = 'one';
      if (rnd() < twoP) { const t = rnd() < 0.5 ? 'h2' : 'v2'; if (anyFit(t) || anyFit(ROTATE[t])) type = t; }
      piece = { type, c: clamp(lastC, 0, COLS - (type === 'h2' ? 2 : 1)), y: 40, slam: false };
    };
    const land = () => {
      const cols = piece.type === 'h2' ? [piece.c, piece.c + 1] : [piece.c];
      const base = Math.max(...cols.map((c) => h[c]));
      if (fits(piece.type, piece.c)) {
        for (const c of cols) h[c] += piece.type === 'v2' ? 2 : 1;
        cols.forEach((c) => fx.burst(X0 + c * CELL + CELL / 2, FLOOR - h[c] * CELL + CELL / 2, ctx.palette.accent, 6, 140));
        ctx.sfx.click();
        if (h.every((v, c) => v === target[c])) { done = true; ctx.sfx.good(); fx.burst(480, 300, ctx.palette.accent, 40, 380); ctx.win(); }
        wait = 0.15;
      } else {
        const cells = SHAPE[piece.type].map(([dc, dr]) => ({ x: X0 + (piece.c + dc) * CELL, y: FLOOR - (base + dr + 1) * CELL }));
        crumble = { cells, t: 0 };
        cells.forEach((q) => fx.burst(q.x + CELL / 2, q.y + CELL / 2, '#39d353', 8, 160));
        // the Rot in the stray block spreads into the block it lands on
        const hit = cols.find((c) => h[c] === base && h[c] > 0);
        if (hit != null) h[hit] -= 1;
        ctx.sfx.bad(); wait = 0.8;
      }
      lastC = piece.c; piece = null;
    };
    const width = () => (piece && piece.type === 'h2' ? 2 : 1);
    const turn = () => { if (!piece) return; piece.type = ROTATE[piece.type]; piece.c = clamp(piece.c, 0, COLS - width()); };
    return {
      peek: () => ({ h: [...h], target, piece: piece && { ...piece }, fits: (t, c) => fits(t, c), COLS, X0, CELL, knock }),
      update(dt) {
        dt = Math.min(dt, 0.05);
        if (done) { lift += dt; return; }
        if (crumble && (crumble.t += dt) > 0.6) crumble = null;
        if (!piece && (wait -= dt) <= 0) spawn();
        // the Rot knocks a block off the top of a column (hard tier only)
        if (tier === 2) {
          knockT -= dt;
          if (!knock && knockT <= 0) { const cols = h.map((v, c) => (v > 0 ? c : -1)).filter((c) => c >= 0); if (cols.length) knock = { c: cols[Math.floor(rnd() * cols.length)], t: 1.2 }; knockT = 6; }
          if (knock && (knock.t -= dt) <= 0) { if (h[knock.c] > 0) { h[knock.c] -= 1; fx.burst(X0 + knock.c * CELL + CELL / 2, FLOOR - h[knock.c] * CELL - CELL / 2, '#39d353', 12, 200); ctx.sfx.bad(); } knock = null; }
        }
        if (!piece) return;
        const k = input.pressed;
        if (input.x !== lastPtr.x || input.y !== lastPtr.y) {
          lastPtr = { x: input.x, y: input.y };
          if (!input.taps.length && Math.hypot(input.x - BTN.x, input.y - BTN.y) > BTN.r) piece.c = clamp(Math.floor((input.x - X0) / CELL - (width() - 1) / 2), 0, COLS - width());
        }
        if (k.has('ArrowLeft') || k.has('a')) piece.c = Math.max(0, piece.c - 1);
        if (k.has('ArrowRight') || k.has('d')) piece.c = Math.min(COLS - width(), piece.c + 1);
        if (k.has('ArrowUp') || k.has('w')) turn();
        if (k.has(' ') || k.has('ArrowDown') || k.has('s')) piece.slam = true;
        for (const t of input.taps) {
          if (Math.hypot(t.x - BTN.x, t.y - BTN.y) < BTN.r) { turn(); continue; }
          piece.c = clamp(Math.floor((t.x - X0) / CELL - (width() - 1) / 2), 0, COLS - width());
          piece.slam = true;
        }
        piece.y += (piece.slam ? 1400 : fall) * dt;
        const base = Math.max(...SHAPE[piece.type].map(([dc]) => h[piece.c + dc]));
        const restY = FLOOR - (base + (piece.type === 'v2' ? 2 : 1)) * CELL;
        if (piece.y >= restY) land();
      },
      draw(g) {
        const t = ctx.t;
        g.fillStyle = '#2a2f45'; g.fillRect(X0 - 20, FLOOR, COLS * CELL + 40, 14);
        // the plan
        g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
        target.forEach((n, c) => { for (let r = 0; r < n; r++) g.strokeRect(X0 + c * CELL + 3, FLOOR - (r + 1) * CELL + 3, CELL - 6, CELL - 6); });
        g.setLineDash([]);
        const up = done ? (KIND[id] === 'techn' ? Math.min(400, lift * lift * 500) : 0) : 0;
        h.forEach((n, c) => {
          for (let r = 0; r < n; r++) {
            const x = X0 + c * CELL + 2; const y = FLOOR - (r + 1) * CELL + 2 - up;
            g.fillStyle = done ? ctx.palette.accent : '#5a6390';
            g.fillRect(x, y, CELL - 4, CELL - 4);
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, CELL - 4, 6);
          }
        });
        if (done && KIND[id] === 'techn') { for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#ffd36b' : '#ff7a1a'; g.beginPath(); g.arc(X0 + 4.5 * CELL + Math.sin(t * 30 + i) * 6, FLOOR - up + 10 + i * 14, 14 - i * 3, 0, TAU); g.fill(); } }
        if (crumble) { g.globalAlpha = 1 - crumble.t / 0.6; crumble.cells.forEach((q) => rot(g, q.x + CELL / 2, q.y + CELL / 2 + crumble.t * 40, 18, t, q.x)); g.globalAlpha = 1; }
        if (knock) { rot(g, X0 + knock.c * CELL + CELL / 2, FLOOR - h[knock.c] * CELL - 30 - Math.sin(t * 10) * 4, 20, t, 9); }
        if (piece) {
          const cells = SHAPE[piece.type];
          const base = Math.max(...cells.map(([dc]) => h[piece.c + dc]));
          const ok = fits(piece.type, piece.c);
          // drop guide: where it would land
          cells.forEach(([dc, dr]) => {
            g.fillStyle = ok ? 'rgba(127,224,255,0.18)' : 'rgba(255,90,90,0.18)';
            g.fillRect(X0 + (piece.c + dc) * CELL + 2, FLOOR - (base + dr + 1) * CELL + 2, CELL - 4, CELL - 4);
          });
          cells.forEach(([dc, dr]) => {
            const x = X0 + (piece.c + dc) * CELL + 2; const y = piece.y + ((piece.type === 'v2' ? 1 : 0) - dr) * CELL + 2;
            g.fillStyle = '#9fc6ff'; g.fillRect(x, y, CELL - 4, CELL - 4);
            g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x, y, CELL - 4, 6);
          });
          tileAt(g, ctx, X0 + (piece.c + (piece.type === 'h2' ? 1 : 0.5)) * CELL, piece.y + (piece.type === 'v2' ? CELL : CELL / 2), 18);
          if (piece.type !== 'one') {
            g.fillStyle = '#2a2f45'; g.beginPath(); g.arc(BTN.x, BTN.y, BTN.r, 0, TAU); g.fill();
            g.font = font(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('⟳', BTN.x, BTN.y + 2);
          }
        }
        const left = target.reduce((a, n, c) => a + n - h[c], 0);
        g.font = font(18); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`${left} to go`, 900, 470);
        hint(g, done ? `You made ${plan.name}!` : `BUILD ${plan.name}: fill the dotted plan`);
      },
      destroy() {},
    };
  },
};
