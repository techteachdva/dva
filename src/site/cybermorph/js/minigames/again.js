/**
 * Again & back (re): a three-act rewind. A bot carries the packet along a path and the Rot
 * splats it at the end. ◀◀ REWIND: walk it BACK along its footprints to the start.
 * ▶ AGAIN: the footprints fade, so walk the same path AGAIN from memory and deliver it.
 * re means again and back, so repeating and reversing is the only way through.
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

const COLS = 7; const ROWS = 4; const CELL = 92;
const GX = 480 - (COLS * CELL) / 2; const GY = 110;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const cellXY = ([c, r]) => ({ x: GX + c * CELL + CELL / 2, y: GY + r * CELL + CELL / 2 });

export default {
  seconds: 40,
  howTo: () => 'Watch the bot’s path. Then walk it BACK to the start, and walk it AGAIN from memory (tap the next square, or use the arrow keys).',
  verb: () => 'You went back, then did it again.',
  start(ctx) {
    const { tier, rnd, input } = ctx;
    const fx = sparks();
    const len = [5, 7, 9][tier];
    const maxMiss = [6, 4, 3][tier];
    const hintAfter = [0, 1, 99][tier]; // in AGAIN: how many wrong steps before the next footprint shows
    // a self-avoiding walk with a few turns in it, so there's something to remember
    const minTurns = [2, 3, 4][tier];
    const turnsIn = (pts) => pts.slice(2).filter((q, i) => q[0] - pts[i + 1][0] !== pts[i + 1][0] - pts[i][0] || q[1] - pts[i + 1][1] !== pts[i + 1][1] - pts[i][1]).length;
    let path;
    for (let tries = 0; tries < 400; tries++) {
      path = [[0, Math.floor(rnd() * ROWS)]];
      const seen = new Set([path[0].join()]);
      while (path.length <= len) {
        const [c, r] = path[path.length - 1];
        const opts = STEPS.filter(([dc, dr]) => { const nc = c + dc; const nr = r + dr; return nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && !seen.has(`${nc},${nr}`); });
        if (!opts.length) break;
        const w = opts.map(([dc]) => (dc > 0 ? 1 : dc < 0 ? 0.35 : 1.2));
        let k = rnd() * w.reduce((x, y) => x + y, 0); let i = 0;
        while (k > w[i]) { k -= w[i]; i += 1; }
        const pick = [c + opts[i][0], r + opts[i][1]];
        path.push(pick); seen.add(pick.join());
      }
      if (path.length === len + 1 && turnsIn(path) >= minTurns) break;
    }
    let act = 'watch'; let at = 0; let pos = path[0]; let anim = null; let st = 0; let misses = 0; let wrongRun = 0; let bonk = null; let splat = 0;
    const walkTo = (cell) => { anim = { from: cellXY(pos), to: cellXY(cell), t: 0 }; pos = cell; ctx.sfx.tick(); };
    const want = () => (act === 'back' ? path[at - 1] : path[at + 1]);
    const tryStep = (cell) => {
      if (anim || bonk || (act !== 'back' && act !== 'again')) return;
      const w = want();
      if (w && cell[0] === w[0] && cell[1] === w[1]) {
        walkTo(cell); wrongRun = 0;
        at += act === 'back' ? -1 : 1;
        if (act === 'back' && at === 0) { act = 'flip'; st = 0; fx.burst(cellXY(pos).x, cellXY(pos).y, ctx.palette.accent, 20, 260); ctx.sfx.pickup(); }
        if (act === 'again' && at === path.length - 1) { act = 'done'; fx.burst(cellXY(pos).x, cellXY(pos).y, ctx.palette.accent, 40, 360); ctx.sfx.good(); ctx.win(); }
      } else {
        bonk = { cell, t: 0.45 }; misses += 1; wrongRun += 1; ctx.sfx.bad();
        if (misses >= maxMiss) ctx.lose('rot');
      }
    };
    const stepDir = (dc, dr) => tryStep([pos[0] + dc, pos[1] + dr]);
    return {
      peek: () => ({ act, at, pos, path, anim: !!anim, bonk: !!bonk }),
      update(dt) {
        dt = Math.min(dt, 0.05);
        st += dt; splat = Math.max(0, splat - dt);
        if (anim && (anim.t += dt / 0.22) >= 1) anim = null;
        if (bonk && (bonk.t -= dt) <= 0) bonk = null;
        if (act === 'watch') {
          if (st > 0.9 && !anim) {
            if (at < path.length - 1) { at += 1; walkTo(path[at]); st = 0.6; }
            else { act = 'splat'; st = 0; splat = 1; fx.burst(cellXY(pos).x, cellXY(pos).y, '#39d353', 30, 300); ctx.sfx.rot(); }
          }
        } else if (act === 'splat' && st > 1.3) { act = 'back'; st = 0; }
        else if (act === 'flip' && st > 1.1) { act = 'again'; st = 0; }
        if (act !== 'back' && act !== 'again') return;
        const k = input.pressed;
        if (k.has('ArrowRight') || k.has('d')) stepDir(1, 0);
        else if (k.has('ArrowLeft') || k.has('a')) stepDir(-1, 0);
        else if (k.has('ArrowDown') || k.has('s')) stepDir(0, 1);
        else if (k.has('ArrowUp') || k.has('w')) stepDir(0, -1);
        for (const t of input.taps) {
          const c = Math.floor((t.x - GX) / CELL); const r = Math.floor((t.y - GY) / CELL);
          if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
          const dc = c - pos[0]; const dr = r - pos[1];
          if (Math.abs(dc) + Math.abs(dr) === 1) tryStep([c, r]);
          else if (dc || dr) stepDir(Math.abs(dc) > Math.abs(dr) ? Math.sign(dc) : 0, Math.abs(dc) > Math.abs(dr) ? 0 : Math.sign(dr));
        }
      },
      draw(g) {
        const t = ctx.t;
        const tape = act === 'back' || act === 'splat';
        for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
          g.fillStyle = (c + r) % 2 ? '#1b2033' : '#20263a';
          g.fillRect(GX + c * CELL, GY + r * CELL, CELL, CELL);
        }
        // footprints: all of them while watching and rewinding; in AGAIN only the ones walked (plus a hint)
        const showUpTo = act === 'watch' ? at : act === 'back' || act === 'splat' ? path.length - 1 : act === 'again' || act === 'done' ? at : -1;
        path.forEach((cell, i) => {
          const hintOne = act === 'again' && i === at + 1 && wrongRun >= hintAfter;
          if (i > showUpTo && !hintOne) return;
          const q = cellXY(cell);
          g.globalAlpha = hintOne ? 0.25 + 0.2 * Math.sin(t * 6) : act === 'again' || act === 'done' ? 0.8 : act === 'back' && i > at ? 0.25 : 0.7;
          g.fillStyle = ctx.palette.accent;
          g.beginPath(); g.ellipse(q.x - 10, q.y + 6, 7, 11, -0.3, 0, TAU); g.ellipse(q.x + 10, q.y - 6, 7, 11, -0.3, 0, TAU); g.fill();
          g.globalAlpha = 1;
        });
        const s = cellXY(path[0]); const e = cellXY(path[path.length - 1]);
        g.font = font(16); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
        g.fillText('START', s.x, s.y - CELL / 2 + 14);
        g.fillStyle = ctx.palette.accent; g.globalAlpha = 0.35; g.fillRect(e.x - CELL / 2 + 4, e.y - CELL / 2 + 4, CELL - 8, CELL - 8); g.globalAlpha = 1;
        if (act !== 'done') rot(g, e.x + 26, e.y - 26, splat > 0 ? 30 : 18, t, 3);
        if (bonk) { const q = cellXY(bonk.cell); g.strokeStyle = '#ff5b6b'; g.lineWidth = 4; g.strokeRect(q.x - CELL / 2 + 6, q.y - CELL / 2 + 6, CELL - 12, CELL - 12); }
        let p = cellXY(pos);
        if (anim) { const k = Math.min(1, anim.t); p = { x: anim.from.x + (anim.to.x - anim.from.x) * k, y: anim.from.y + (anim.to.y - anim.from.y) * k }; }
        const bob = Math.sin(t * 8) * 2 + (bonk ? Math.sin(t * 60) * 4 : 0);
        g.fillStyle = act === 'splat' ? '#39d353' : '#9fc6ff';
        rrect(g, p.x - 22 + bob, p.y - 26, 44, 44, 12); g.fill();
        g.fillStyle = '#0b1020'; rrect(g, p.x - 15 + bob, p.y - 18, 30, 14, 5); g.fill();
        g.fillStyle = '#7fe0ff'; g.fillRect(p.x - 8 + bob, p.y - 15, 5, 7); g.fillRect(p.x + 3 + bob, p.y - 15, 5, 7);
        if (act !== 'splat') { g.fillStyle = '#20263a'; rrect(g, p.x - 15, p.y - 58, 30, 30, 7); g.fill(); g.strokeStyle = ctx.palette.accent; g.lineWidth = 2; g.stroke(); tileAt(g, ctx, p.x, p.y - 43, 13); }
        // the VHS tape look while rewinding
        if (tape) {
          g.fillStyle = 'rgba(255,255,255,0.05)';
          for (let y = (t * 300) % 8; y < 540; y += 8) g.fillRect(0, y, 960, 2);
          g.fillStyle = 'rgba(160,200,255,0.12)'; g.fillRect(0, ((t * 170) % 600) - 30, 960, 26);
        }
        g.font = font(34, 800); g.textAlign = 'left'; g.fillStyle = act === 'back' ? '#ffd36b' : '#7dffa0';
        const badge = { watch: '▶ PLAY', splat: '■ STOP', back: '◀◀ REWIND', flip: '▶ PLAY AGAIN', again: '▶ AGAIN', done: '✔ DONE' }[act];
        g.fillText(badge, 40, 500);
        for (let i = 0; i < maxMiss; i++) { g.fillStyle = i < misses ? '#39d353' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(900 - i * 30, 495, 10, 0, TAU); g.fill(); }
        const msg = {
          watch: 'Watch the path…', splat: 'The Rot splatted it! Rewind…', back: 'Walk it BACK to the start',
          flip: 'Now do it again!', again: 'Walk the same path AGAIN, from memory', done: 'Delivered!',
        }[act];
        fx.draw(g, t);
        hint(g, msg, 36, act === 'back' ? '#ffd36b' : '#ffffff');
      },
      destroy() {},
    };
  },
};
