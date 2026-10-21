/**
 * Look & show (spect, spec, spic, vis, vid, vise, vide, scope, photo, cover).
 * You win by looking:
 *   watch (spect … vide)   the scene blinks and one screen changes: tap the one that changed
 *   scope                  everything is a speck until you zoom in with the scope; zap the Rot
 *   photo                  the room is dark; move your light and photograph the glitches
 *   cover                  a sheet hides the glitch and they shuffle; lift the one that hides it
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

const MODE_OF = { scope: 'scope', photo: 'photo', cover: 'cover' };
const modeOf = (id) => MODE_OF[id] || 'watch';
const HOW = {
  watch: 'Watch the screens. When the scene blinks, one of them changes: tap the one that changed.',
  scope: 'Move the scope to zoom in, then zap the tiny Rot hiding among the cells (tap it, or press Space).',
  photo: 'It’s dark! Move your light to see, and snap a photo (tap or Space) when a Rot glitch is in the light.',
  cover: 'Watch which sheet covers the Rot glitch while they shuffle, then lift that one.',
};
const VERB = {
  watch: 'You watched closely and spotted every change.',
  scope: 'You looked through the scope and zapped every hidden glitch.',
  photo: 'You lit them up and caught them on camera.',
  cover: 'You lifted the cover and found what it hid.',
};
const EMOJI = ['🌵', '🚀', '🎈', '🍩', '🐟', '⭐', '🔑', '🎲', '🧲', '🍄', '🪐', '🦊', '🌙', '🍎', '⚽', '🎸', '🧊', '🔔', '🐢', '🌻', '🍕', '📡', '🦉', '🎩'];

/** A pointer-or-arrows cursor: follows the mouse, a drag, or the arrow keys. */
function cursor(input, x, y, speed = 380) {
  const c = { x, y };
  let last = { x: input.x, y: input.y };
  c.update = (dt) => {
    // A fresh tap doesn't move it: the game decides (move there, or act if it was already there).
    if (input.x !== last.x || input.y !== last.y) { last = { x: input.x, y: input.y }; if (!input.taps.length) { c.x = input.x; c.y = input.y; } }
    const a = axis(input.keys);
    c.x = clamp(c.x + a.x * speed * dt, 20, 940); c.y = clamp(c.y + a.y * speed * dt, 70, 510);
  };
  return c;
}

// watch: change blindness. A ↔ A′ with a blink between, until you tap the changed screen.
function watch(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const [cols, rows] = [[3, 2], [4, 3], [5, 3]][tier];
  const show = [0.9, 0.8, 0.7][tier];
  const blank = [0, 0.2, 0.15][tier];
  const need = 3;
  const X0 = 110; const Y0 = 86; const CW = 740 / cols; const CH = 390 / rows;
  let cells = []; let target = 0; let alt = ''; let T = 0; let found = 0; let lock = 0; let next = 0; let bad = -1; let sel = 0;
  let pop = null;
  const round = () => {
    const pool = [...EMOJI].sort(() => rnd() - 0.5);
    cells = pool.slice(0, cols * rows);
    alt = pool[cols * rows];
    target = Math.floor(rnd() * cells.length);
    T = 0;
  };
  round();
  const phase = () => {
    if (T < 1.2) return 'A';
    const p = (T - 1.2) % (2 * (show + blank));
    if (p < blank) return '-';
    if (p < blank + show) return 'B';
    if (p < 2 * blank + show) return '-';
    return 'A';
  };
  const pick = (i) => {
    if (lock > 0 || next > 0 || T < 1.2) return;
    if (i === target) {
      found += 1; pop = { i, t: 0 };
      const cx = X0 + (i % cols) * CW + CW / 2; const cy = Y0 + Math.floor(i / cols) * CH + CH / 2;
      fx.burst(cx, cy, '#39d353', 22, 300);
      if (found >= need) { ctx.sfx.good(); ctx.win(); } else { ctx.sfx.pickup(); next = 0.9; }
    } else { bad = i; lock = 1.0; ctx.sfx.bad(); next = 1.0; }  // a wrong guess: the Rot hides it somewhere new
  };
  return {
    peek: () => ({ target, phase: phase(), T, found, cols, rows, X0, Y0, CW, CH, lock, next }),
    update(dt) {
      T += dt; lock -= dt;
      if (pop) pop.t += dt;
      if (next > 0 && (next -= dt) <= 0) { pop = null; round(); }
      const k = input.pressed;
      if (k.has('ArrowLeft') || k.has('a')) sel = (sel + cols * rows - 1) % (cols * rows);
      if (k.has('ArrowRight') || k.has('d')) sel = (sel + 1) % (cols * rows);
      if (k.has('ArrowUp') || k.has('w')) sel = (sel + cols * rows - cols) % (cols * rows);
      if (k.has('ArrowDown') || k.has('s')) sel = (sel + cols) % (cols * rows);
      if (k.has(' ')) pick(sel);
      for (const t of input.taps) {
        const c = Math.floor((t.x - X0) / CW); const r = Math.floor((t.y - Y0) / CH);
        if (c >= 0 && c < cols && r >= 0 && r < rows) { sel = r * cols + c; pick(sel); }
      }
    },
    draw(g) {
      const t = ctx.t;
      const ph = next > 0 ? 'B' : phase();
      cells.forEach((e, i) => {
        const x = X0 + (i % cols) * CW; const y = Y0 + Math.floor(i / cols) * CH;
        const shake = i === bad && lock > 0 ? Math.sin(t * 60) * 6 : 0;
        g.fillStyle = '#1b2033';
        rrect(g, x + 8 + shake, y + 8, CW - 16, CH - 16, 14); g.fill();
        g.lineWidth = 3;
        g.strokeStyle = i === sel ? '#ffffff' : '#3a4160';
        g.stroke();
        if (ph === '-') return;
        if (pop && pop.i === i) { rot(g, x + CW / 2, y + CH / 2 - pop.t * 60, 30, t, i); return; }
        g.font = `${Math.min(CW, CH) * 0.48}px sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(i === target && ph === 'B' ? alt : e, x + CW / 2 + shake, y + CH / 2 + 4);
      });
      if (ph === '-') { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X0, Y0, 740, 390); }
      rot(g, 900, 120 + Math.sin(t * 2) * 10, 20, t, 7);
      hint(g, T < 1.2 && next <= 0 ? 'Look carefully…' : `Which screen keeps CHANGING? · ${found} / ${need}`);
    },
  };
}

// scope: specks too small to tell apart until the lens zooms in on them.
function scope(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const C = { x: 480, y: 290, r: 215 };
  const n = [40, 60, 80][tier];
  const zoom = [3.2, 4, 4.6][tier];
  const grab = [14, 10, 8][tier];
  const LR = 95; const need = 3;
  const specks = [];
  const place = (kind) => {
    const a = rnd() * TAU; const d = Math.sqrt(rnd()) * (C.r - 14);
    specks.push({ kind, x: C.x + Math.cos(a) * d, y: C.y + Math.sin(a) * d, ph: rnd() * TAU, vx: (rnd() - 0.5) * 8, vy: (rnd() - 0.5) * 8 });
  };
  for (let i = 0; i < n; i++) place('cell');
  for (let i = 0; i < need; i++) place('rot');
  for (let i = 0; i < [0, 3, 6][tier]; i++) place('algae');
  const lens = cursor(input, 480, 290, 300);
  let found = 0; let lock = 0; let flash = 0; let miss = 0;
  const zap = () => {
    if (lock > 0) return;
    let best = null; let bd = grab;
    for (const s of specks) { if (s.kind !== 'rot') continue; const d = Math.hypot(s.x - lens.x, s.y - lens.y); if (d < bd) { bd = d; best = s; } }
    flash = 0.2;
    if (best) {
      best.kind = 'gone'; found += 1; fx.burst(lens.x, lens.y, '#39d353', 20, 260);
      if (found >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.pickup();
    } else { miss = 0.4; lock = 0.5; ctx.sfx.bad(); }
  };
  const drawSpecks = (g, detail, t) => {
    for (const s of specks) {
      if (s.kind === 'gone') continue;
      if (!detail) { g.fillStyle = '#8fa3c7'; g.beginPath(); g.arc(s.x, s.y, 2.6, 0, TAU); g.fill(); continue; }
      if (s.kind === 'rot') rot(g, s.x, s.y, 3.4, t, s.ph);
      else if (s.kind === 'algae') { g.fillStyle = '#39d353'; g.beginPath(); g.ellipse(s.x, s.y, 3.6, 2.4, s.ph, 0, TAU); g.fill(); }
      else {
        g.fillStyle = '#7fb4ff'; g.beginPath(); g.arc(s.x, s.y, 3.4, 0, TAU); g.fill();
        g.fillStyle = '#2a4f9a'; g.beginPath(); g.arc(s.x + 0.8, s.y - 0.5, 1.2, 0, TAU); g.fill();
      }
    }
  };
  return {
    peek: () => ({ lens: { x: lens.x, y: lens.y }, rots: specks.filter((s) => s.kind === 'rot').map((s) => ({ x: s.x, y: s.y })), found, lock }),
    update(dt) {
      lock -= dt; flash -= dt; miss -= dt;
      lens.update(dt);
      if (tier > 0) for (const s of specks) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (Math.hypot(s.x - C.x, s.y - C.y) > C.r - 10) { s.vx *= -1; s.vy *= -1; }
      }
      for (const t of input.taps) { if (Math.hypot(t.x - lens.x, t.y - lens.y) < 45) zap(); else { lens.x = t.x; lens.y = t.y; } }
      if (input.pressed.has(' ')) zap();
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#1b2236'; g.beginPath(); g.arc(C.x, C.y, C.r + 14, 0, TAU); g.fill();
      g.fillStyle = '#26314d'; g.beginPath(); g.arc(C.x, C.y, C.r, 0, TAU); g.fill();
      drawSpecks(g, false, t);
      g.save();
      g.beginPath(); g.arc(lens.x, lens.y, LR, 0, TAU); g.clip();
      g.fillStyle = '#dfe9ff'; g.fillRect(lens.x - LR, lens.y - LR, LR * 2, LR * 2);
      g.translate(lens.x, lens.y); g.scale(zoom, zoom); g.translate(-lens.x, -lens.y);
      g.fillStyle = '#c9d8f5'; g.beginPath(); g.arc(C.x, C.y, C.r, 0, TAU); g.fill();
      drawSpecks(g, true, t);
      g.restore();
      g.strokeStyle = miss > 0 ? '#ff5b6b' : '#e6ecff'; g.lineWidth = 8;
      g.beginPath(); g.arc(lens.x, lens.y, LR, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(30,40,70,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(lens.x - 16, lens.y); g.lineTo(lens.x + 16, lens.y); g.moveTo(lens.x, lens.y - 16); g.lineTo(lens.x, lens.y + 16); g.stroke();
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 2})`; g.beginPath(); g.arc(lens.x, lens.y, LR, 0, TAU); g.fill(); }
      tileAt(g, ctx, 90, 470, 34);
      hint(g, `ZOOM IN and zap the Rot · ${found} / ${need}`);
    },
  };
}

// photo: a dark room; only your light shows what's there.
function photo(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const R = [140, 110, 90][tier];
  const need = 3;
  const props = Array.from({ length: 14 }, () => ({ x: 60 + rnd() * 840, y: 110 + rnd() * 380, w: 50 + rnd() * 90, h: 40 + rnd() * 70, c: ['#3a4160', '#4a3a2a', '#2f4a3f'][Math.floor(rnd() * 3)] }));
  const glitches = [];
  while (glitches.length < need) {
    const p = { x: 80 + rnd() * 800, y: 120 + rnd() * 360, lit: 0, got: false };
    if (glitches.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 220) && Math.hypot(p.x - 480, p.y - 290) > 150) glitches.push(p);
  }
  const light = cursor(input, 480, 290, 340);
  let found = 0; let cool = 0; let flash = 0; let empty = 0;
  const album = [];
  const snap = () => {
    if (cool > 0) return;
    flash = 0.25;
    const hit = glitches.find((q) => !q.got && Math.hypot(q.x - light.x, q.y - light.y) < R * 0.8);
    if (hit) {
      hit.got = true; found += 1; album.push({ x: hit.x, y: hit.y, t: 0 }); fx.burst(hit.x, hit.y, '#ffffff', 18, 260); cool = 0.3;
      if (found >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.pickup();
    } else { cool = 1.2; empty = 0.9; ctx.sfx.click(); }
  };
  return {
    peek: () => ({ light: { x: light.x, y: light.y }, glitches: glitches.filter((q) => !q.got).map((q) => ({ x: q.x, y: q.y })), found, cool, R }),
    update(dt) {
      cool -= dt; flash -= dt; empty -= dt;
      light.update(dt);
      for (const t of input.taps) { if (Math.hypot(t.x - light.x, t.y - light.y) < R) snap(); else { light.x = t.x; light.y = t.y; } }
      if (input.pressed.has(' ')) snap();
      for (const q of glitches) {
        if (q.got) continue;
        const d = Math.hypot(q.x - light.x, q.y - light.y);
        q.lit = d < R ? q.lit + dt : 0;
        if (tier === 2 && q.lit > 0.7 && d > 1) { q.x = clamp(q.x + ((q.x - light.x) / d) * 130 * dt, 60, 900); q.y = clamp(q.y + ((q.y - light.y) / d) * 130 * dt, 100, 490); }
      }
      album.forEach((a) => { a.t += dt; });
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#151a28'; g.fillRect(0, 0, 960, 540);
      for (const p of props) { g.fillStyle = p.c; g.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 6); }
      for (const q of glitches) if (!q.got) rot(g, q.x, q.y, 18, t, q.x);
      // darkness with a hole for the light
      g.fillStyle = 'rgba(2,3,8,0.985)';
      g.beginPath(); g.rect(0, 0, 960, 540); g.arc(light.x, light.y, R, 0, TAU, true); g.fill();
      const grad = g.createRadialGradient(light.x, light.y, R * 0.6, light.x, light.y, R);
      grad.addColorStop(0, 'rgba(2,3,8,0)'); grad.addColorStop(1, 'rgba(2,3,8,0.9)');
      g.fillStyle = grad; g.beginPath(); g.arc(light.x, light.y, R, 0, TAU); g.fill();
      const warm = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, R);
      warm.addColorStop(0, 'rgba(255,236,170,0.28)'); warm.addColorStop(1, 'rgba(255,236,170,0)');
      g.fillStyle = warm; g.beginPath(); g.arc(light.x, light.y, R, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,240,180,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(light.x, light.y, R, 0, TAU); g.stroke();
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 2.4})`; g.fillRect(0, 0, 960, 540); }
      if (empty > 0) { g.font = font(20); g.textAlign = 'center'; g.fillStyle = '#ffd36b'; g.fillText('Nothing there. Keep looking…', light.x, light.y + R + 24); }
      // the photo album
      for (let i = 0; i < need; i++) {
        const x = 700 + i * 82; const y = 470;
        g.fillStyle = i < album.length ? '#f4f2ea' : 'rgba(255,255,255,0.12)';
        g.fillRect(x, y - 30, 70, 70);
        if (i < album.length) { g.fillStyle = '#151a28'; g.fillRect(x + 6, y - 24, 58, 46); rot(g, x + 35, y - 2, 13, t, i); }
      }
      tileAt(g, ctx, 90, 470, 34);
      hint(g, `Find them with your LIGHT and snap a photo · ${found} / ${need}`, 36, '#ffe9a8');
    },
  };
}

// cover: a shell game. The sheet hides the glitch; lift the one that's hiding it.
function cover(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const n = [3, 4, 5][tier];
  const swaps = [4, 6, 8][tier];
  const dur = [0.6, 0.45, 0.36][tier];
  const need = [2, 3, 3][tier];
  const Y = 330;
  const slotX = (i) => (960 / (n + 1)) * (i + 1);
  let covers = []; let hid = 0; let state = 'show'; let st = 0; let queue = []; let swap = null; let sel = 0; let found = 0; let lifted = new Set();
  const round = () => {
    covers = Array.from({ length: n }, (_, i) => ({ slot: i, x: slotX(i), lift: 1 }));
    hid = Math.floor(rnd() * n);
    queue = Array.from({ length: swaps }, () => { const a = Math.floor(rnd() * n); let b = Math.floor(rnd() * (n - 1)); if (b >= a) b += 1; return [a, b]; });
    state = 'show'; st = 0; lifted = new Set(); sel = Math.floor(n / 2);
  };
  round();
  const coverAt = (slot) => covers.find((c) => c.slot === slot);
  const lift = (slot) => {
    if (state !== 'pick') return;
    const c = coverAt(slot);
    lifted.add(covers.indexOf(c));
    if (covers.indexOf(c) === hid) {
      found += 1; fx.burst(c.x, Y, '#39d353', 24, 300); state = 'yes'; st = 0;
      if (found >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.pickup();
    } else { lifted.add(hid); found = Math.max(0, found - 1); state = 'no'; st = 0; ctx.sfx.bad(); }
  };
  return {
    peek: () => ({ state, hidSlot: covers[hid].slot, n, found }),
    update(dt) {
      st += dt;
      for (const c of covers) {
        const up = state === 'show' || lifted.has(covers.indexOf(c));
        c.lift += ((up ? 1 : 0) - c.lift) * Math.min(1, dt * 10);
      }
      if (state === 'show' && st > 1.3) { state = 'drop'; st = 0; }
      if (state === 'drop' && st > 0.5) { state = 'shuffle'; st = 0; }
      if (state === 'shuffle') {
        if (!swap && queue.length) { const [a, b] = queue.shift(); swap = { a: coverAt(a), b: coverAt(b), t: 0 }; }
        if (swap) {
          swap.t += dt / dur;
          const k = Math.min(1, swap.t); const e = k * k * (3 - 2 * k);
          const xa = slotX(swap.a.slot); const xb = slotX(swap.b.slot);
          swap.a.x = xa + (xb - xa) * e; swap.b.x = xb + (xa - xb) * e;
          swap.a.dy = -Math.sin(Math.PI * k) * 40; swap.b.dy = Math.sin(Math.PI * k) * 24;
          if (k >= 1) { const s = swap.a.slot; swap.a.slot = swap.b.slot; swap.b.slot = s; swap.a.dy = swap.b.dy = 0; swap = null; }
        } else { state = 'pick'; st = 0; }
      }
      if ((state === 'yes' && st > 0.9) || (state === 'no' && st > 1.2)) round();
      if (state === 'pick') {
        const k = input.pressed;
        if (k.has('ArrowLeft') || k.has('a')) sel = Math.max(0, sel - 1);
        if (k.has('ArrowRight') || k.has('d')) sel = Math.min(n - 1, sel + 1);
        if (k.has(' ')) lift(sel);
        for (const t of input.taps) {
          const slot = Math.round(t.x / (960 / (n + 1))) - 1;
          if (slot >= 0 && slot < n && Math.abs(t.y - Y) < 140) { sel = slot; lift(slot); }
        }
      }
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#2a2f45'; g.fillRect(60, Y + 50, 840, 16);
      covers.forEach((c, i) => {
        if (i === hid) rot(g, c.x, Y + 18, 26, t, 3);
        const y = Y - c.lift * 120 + (c.dy || 0);
        g.fillStyle = ctx.palette.accent;
        g.beginPath();
        g.moveTo(c.x - 56, y + 50);
        g.quadraticCurveTo(c.x - 60, y - 50, c.x, y - 56);
        g.quadraticCurveTo(c.x + 60, y - 50, c.x + 56, y + 50);
        for (let k = 0; k <= 6; k++) g.lineTo(c.x + 56 - k * (112 / 6), y + 50 + (k % 2 ? 8 : 0));
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.stroke();
        if (state === 'pick' && c.slot === sel) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); }
      });
      const msg = { show: 'Watch where the Rot hides…', drop: 'Covered!', shuffle: 'Keep your eyes on it…', pick: 'LIFT the sheet that hides it', yes: 'Found it!', no: 'Not that one. Here it was.' }[state];
      tileAt(g, ctx, 90, 470, 34);
      hint(g, `${msg} · ${found} / ${need}`);
    },
  };
}

const MODES = { watch, scope, photo, cover };

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
