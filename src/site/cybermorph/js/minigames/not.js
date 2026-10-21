/**
 * Not & against (un, in, non, dis, de, mis, anti, contra, ob).
 *   flip (un, in, non, dis)      turn every card into its opposite (locked → unlocked) while the Rot flips them back
 *   drop (de)                    cut the packets down from the Rot's balloons into the moving bin
 *   mis                          the Rot lights a button: press any button EXCEPT that one, on purpose
 *   push (anti, contra, ob)      push back against each Rot push, on the side it comes from, as it hits your shield
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

const MODE_OF = { un: 'flip', in: 'flip', non: 'flip', dis: 'flip', de: 'drop', mis: 'mis' };
const modeOf = (id) => MODE_OF[id] || 'push';
const HOW = {
  flip: 'Tap each card to turn it into its opposite, then keep them all that way: tap the Rot off before it flips one back.',
  drop: 'Tap a packet (or ← → and Space) to cut it down into the moving bin below.',
  mis: 'The Rot lights the buttons it wants you to press. Mis-press on purpose: press one it did NOT light (tap, or the arrow keys)!',
  push: 'When a Rot push reaches your shield, push back on that side (tap that side, or the arrow key).',
};
const VERB = {
  un: 'You undid every one.', in: 'You turned each into its opposite.', non: 'You made every one its “not”.',
  dis: 'You took them all apart.', de: 'You brought them all down.', mis: 'You did it wrong, on purpose, every time.',
  anti: 'You pushed back against the Rot.', contra: 'You pushed back against the Rot.', ob: 'You stood against every push.',
};
// [emoji, word, opposite emoji, opposite word]
const PAIRS = {
  un: [['🔒', 'locked', '🔓', 'unlocked'], ['📏', 'even', '〰️', 'uneven'], ['🎁', 'wrapped', '📦', 'unwrapped'],
    ['🎀', 'tied', '🧵', 'untied'], ['✅', 'done', '↩️', 'undone'], ['🧳', 'packed', '👕', 'unpacked']],
  in: [['👁️', 'visible', '👻', 'invisible'], ['⚡', 'active', '💤', 'inactive'], ['✔️', 'correct', '❌', 'incorrect'],
    ['🧩', 'complete', '🕳️', 'incomplete'], ['⬆️', 'direct', '↪️', 'indirect'], ['🎩', 'formal', '🧢', 'informal']],
  non: [['🛑', 'stop', '🔁', 'nonstop'], ['🧠', 'sense', '🤪', 'nonsense'], ['🐉', 'fiction', '📰', 'nonfiction'],
    ['🌱', 'living', '🧱', 'nonliving'], ['🍯', 'sticky', '🍳', 'nonstick'], ['☠️', 'toxic', '🥦', 'nontoxic']],
  dis: [['🔗', 'connected', '✂️', 'disconnected'], ['🐇', 'appear', '💨', 'disappear'], ['👍', 'agree', '👎', 'disagree'],
    ['❤️', 'like', '💔', 'dislike'], ['🙋', 'obey', '🙅', 'disobey'], ['🧩', 'assembled', '🔩', 'disassembled']],
};

// flip: make them all the opposite at once.
function flip(ctx, fx) {
  const { tier, rnd, input, id } = ctx;
  const n = [4, 6, 6][tier];
  const cols = n === 4 ? 2 : 3;
  const every = [1.4, 1.0, 0.75][tier];
  const crawl = [1.0, 0.8, 0.65][tier];
  const CW = 200; const CH = 150; const X0 = 480 - (cols * (CW + 20)) / 2 + 10; const Y0 = 100;
  const need = [4, 6, 7][tier]; // seconds with every card flipped
  const cards = [...PAIRS[id]].sort(() => rnd() - 0.5).slice(0, n).map((p, i) => ({ p, on: rnd() < 0.5, turn: 0, i }));
  let score = 0; let lock = 0;
  let sel = 0; let rotOn = null; let next = 1.5; let bad = -1; let badT = 0;
  const at = (i) => ({ x: X0 + (i % cols) * (CW + 20), y: Y0 + Math.floor(i / cols) * (CH + 24) });
  const tapCard = (i) => {
    if (lock > 0) return;
    const c = cards[i];
    if (rotOn && rotOn.i === i) { const q = at(i); fx.burst(q.x + CW / 2, q.y + CH / 2, '#39d353', 16, 240); rotOn = null; next = every; ctx.sfx.click(); return; }
    c.on = !c.on; c.turn = 1;
    if (c.on) {
      ctx.sfx.tick();
      const q = at(i); fx.burst(q.x + CW / 2, q.y + CH / 2, ctx.palette.accent, 8, 160);
    } else { bad = i; badT = 0.6; lock = 0.6; ctx.sfx.bad(); } // flipped it back: that was already the opposite
  };
  return {
    peek: () => ({ cards: cards.map((c) => c.on), rotOn: rotOn && { ...rotOn }, at, CW, CH, lock }),
    update(dt) {
      badT -= dt; lock -= dt;
      if (cards.every((c) => c.on)) {
        score += dt;
        if (score >= need) { fx.burst(480, 280, ctx.palette.accent, 40, 380); ctx.sfx.good(); ctx.win(); return; }
      }
      for (const c of cards) c.turn = Math.max(0, c.turn - dt * 4);
      if (!rotOn && (next -= dt) <= 0) {
        const onCards = cards.filter((c) => c.on);
        if (onCards.length) rotOn = { i: onCards[Math.floor(rnd() * onCards.length)].i, t: crawl };
        else next = 0.5;
      }
      if (rotOn && (rotOn.t -= dt) <= 0) { const c = cards[rotOn.i]; c.on = false; c.turn = 1; rotOn = null; next = every * (0.7 + rnd() * 0.6); ctx.sfx.rot(); }
      const k = input.pressed;
      if (k.has('ArrowLeft') || k.has('a')) sel = (sel + n - 1) % n;
      if (k.has('ArrowRight') || k.has('d')) sel = (sel + 1) % n;
      if (k.has('ArrowUp') || k.has('w')) sel = (sel + n - cols) % n;
      if (k.has('ArrowDown') || k.has('s')) sel = (sel + cols) % n;
      if (k.has(' ')) tapCard(sel);
      for (const t of input.taps) {
        const i = cards.findIndex((c) => { const q = at(c.i); return t.x > q.x && t.x < q.x + CW && t.y > q.y && t.y < q.y + CH; });
        if (i >= 0) { sel = i; tapCard(i); }
      }
    },
    draw(g) {
      const t = ctx.t;
      cards.forEach((c, i) => {
        const q = at(i);
        const sx = Math.abs(Math.cos(c.turn * Math.PI));
        g.save(); g.translate(q.x + CW / 2 + (i === bad && badT > 0 ? Math.sin(t * 60) * 5 : 0), q.y + CH / 2); g.scale(Math.max(0.05, sx), 1);
        g.fillStyle = c.on ? '#1f3a2e' : '#2a2f45';
        rrect(g, -CW / 2, -CH / 2, CW, CH, 16); g.fill();
        g.lineWidth = 4; g.strokeStyle = i === sel ? '#ffffff' : c.on ? ctx.palette.accent : '#4a5275'; g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '54px sans-serif'; g.fillText(c.on ? c.p[2] : c.p[0], 0, -18);
        g.font = font(22); g.fillStyle = c.on ? '#ffffff' : '#cfd6e2'; g.fillText(c.on ? c.p[3] : c.p[1], 0, 46);
        g.restore();
        if (rotOn && rotOn.i === i) rot(g, q.x + CW / 2, q.y + CH / 2 - 10 + (rotOn.t / crawl) * -30, 34, t, i);
      });
      tileAt(g, ctx, 90, 470, 34);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(330, 470, 300, 12);
      g.fillStyle = ctx.palette.accent; g.fillRect(330, 470, 300 * Math.min(1, score / need), 12);
      const left = cards.filter((c) => !c.on).length;
      hint(g, left ? `Turn them ALL into their OPPOSITE · ${left} to go` : 'All opposite! Keep the Rot off them…');
    },
  };
}

// drop: cut each packet down into the bin.
function drop(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const n = [3, 4, 5][tier];
  const bw = [150, 120, 95][tier];
  const bs = [110, 160, 210][tier];
  const BY = 460;
  const hooks = Array.from({ length: n }, (_, i) => ({ hx: (960 / (n + 1)) * (i + 1), ph: rnd() * TAU, state: 'hang', x: 0, y: 150, vy: 0, t: 0 }));
  let bx = 480; let dir = 1; let saved = 0; let sel = 0;
  const hangX = (h) => h.hx + Math.sin(ctx.t * 1.1 + h.ph) * 30;
  const cut = (h) => { if (h.state !== 'hang') return; h.state = 'fall'; h.x = hangX(h); h.y = 150; h.vy = 0; ctx.sfx.click(); };
  return {
    peek: () => ({ bx, dir, bs, bw, BY, hooks: hooks.map((h) => ({ x: hangX(h), y: h.y, state: h.state })), saved }),
    update(dt) {
      bx += dir * bs * dt;
      if (bx > 880 - bw / 2) { bx = 880 - bw / 2; dir = -1; } if (bx < 80 + bw / 2) { bx = 80 + bw / 2; dir = 1; }
      for (const h of hooks) {
        if (h.state === 'fall') {
          h.vy += 1200 * dt; h.y += h.vy * dt;
          if (h.y >= BY - 20) {
            if (Math.abs(h.x - bx) < bw / 2 - 10) {
              h.state = 'saved'; saved += 1; fx.burst(h.x, BY - 20, ctx.palette.accent, 20, 260);
              if (saved >= n) { ctx.sfx.good(); ctx.win(); return; }
              ctx.sfx.pickup();
            } else { h.state = 'splat'; h.t = 1; fx.burst(h.x, BY, '#39d353', 14, 200); ctx.sfx.bad(); }
          }
        } else if (h.state === 'splat' && (h.t -= dt) <= 0) h.state = 'hang';
      }
      const open = hooks.map((h, i) => (h.state === 'hang' ? i : -1)).filter((i) => i >= 0);
      if (open.length && !open.includes(sel)) sel = open[0];
      const k = input.pressed;
      if (open.length && (k.has('ArrowLeft') || k.has('a'))) sel = open[(open.indexOf(sel) + open.length - 1) % open.length];
      if (open.length && (k.has('ArrowRight') || k.has('d'))) sel = open[(open.indexOf(sel) + 1) % open.length];
      if (k.has(' ') && open.length) cut(hooks[sel]);
      for (const t of input.taps) {
        const h = hooks.find((q) => q.state === 'hang' && Math.abs(t.x - hangX(q)) < 50 && t.y > 40 && t.y < 200);
        if (h) cut(h);
      }
    },
    draw(g) {
      const t = ctx.t;
      hooks.forEach((h, i) => {
        if (h.state === 'saved') return;
        const x = hangX(h);
        rot(g, x, 70 + Math.sin(t * 2 + h.ph) * 6, 26, t, h.ph);
        if (h.state === 'hang') {
          g.strokeStyle = '#d9b26b'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 94); g.lineTo(x, 128); g.stroke();
          packet(g, ctx, x, 150, 44);
          if (i === sel) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x - 30, 120, 60, 60); }
        } else if (h.state === 'fall') packet(g, ctx, h.x, h.y, 44);
      });
      g.fillStyle = '#2a2f45'; g.fillRect(0, BY + 20, 960, 60);
      g.fillStyle = ctx.palette.accent; g.fillRect(bx - bw / 2, BY - 30, 8, 50); g.fillRect(bx + bw / 2 - 8, BY - 30, 8, 50); g.fillRect(bx - bw / 2, BY + 12, bw, 8);
      for (let i = 0; i < saved; i++) packet(g, ctx, bx - bw / 2 + 24 + (i % 3) * 30, BY - 4 - Math.floor(i / 3) * 14, 26);
      g.font = font(18); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`${saved} / ${n} down`, 920, 470);
      hint(g, 'Cut them DOWN into the bin');
    },
  };
}

// mis: inhibit the obvious press.
const BTNS = [
  { key: ['ArrowLeft', 'a'], x: 300, y: 300, sym: '◀' }, { key: ['ArrowUp', 'w'], x: 480, y: 170, sym: '▲' },
  { key: ['ArrowRight', 'd'], x: 660, y: 300, sym: '▶' }, { key: ['ArrowDown', 's'], x: 480, y: 430, sym: '▼' },
];
function mis(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const win = [1.6, 1.2, 0.9][tier];
  const need = [5, 6, 8][tier];
  const max = 3;
  const many = [1, 2, 3][tier];
  let lit = []; let left = 0; let gap = 1.0; let good = 0; let bad = 0; let flash = null;
  const result = (ok, i) => {
    flash = { ok, i, t: 0.4 }; lit = []; gap = 0.45;
    if (ok) {
      good += 1; fx.burst(BTNS[i].x, BTNS[i].y, ctx.palette.accent, 16, 240);
      if (good >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.tick();
    } else {
      bad += 1; ctx.sfx.bad();
      if (bad >= max) ctx.lose('rot');
    }
  };
  const press = (i) => { if (!lit.length) return; result(!lit.includes(i), i); };
  return {
    peek: () => ({ lit: [...lit], left, good, bad }),
    update(dt) {
      if (flash && (flash.t -= dt) <= 0) flash = null;
      if (!lit.length) { if ((gap -= dt) <= 0) { lit = [0, 1, 2, 3].sort(() => rnd() - 0.5).slice(0, many); left = win; } return; }
      left -= dt;
      if (left <= 0) { result(false, lit[0]); return; }
      BTNS.forEach((b, i) => { if (b.key.some((k) => input.pressed.has(k))) press(i); });
      for (const t of input.taps) { const i = BTNS.findIndex((b) => Math.hypot(t.x - b.x, t.y - b.y) < 70); if (i >= 0) press(i); }
    },
    draw(g) {
      const t = ctx.t;
      BTNS.forEach((b, i) => {
        const on = lit.includes(i);
        g.fillStyle = on ? '#39d353' : flash && flash.i === i ? (flash.ok ? ctx.palette.accent : '#ff5b6b') : '#2a2f45';
        g.beginPath(); g.arc(b.x, b.y, on ? 68 + Math.sin(t * 14) * 4 : 62, 0, TAU); g.fill();
        g.font = font(40); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on ? '#0b2a12' : '#ffffff';
        g.fillText(b.sym, b.x, b.y + 2);
      });
      rot(g, 480, 300, 36, t, 1);
      if (lit.length) {
        g.font = font(26, 800); g.textAlign = 'center'; g.fillStyle = '#7dffa0';
        g.fillText(`“PRESS ${lit.map((i) => BTNS[i].sym).join(' or ')}!”`, 480, 368);
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(380, 500, 200, 8);
        g.fillStyle = '#7dffa0'; g.fillRect(380, 500, 200 * (left / win), 8);
      }
      for (let i = 0; i < max; i++) { g.fillStyle = i < bad ? '#39d353' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(820 + i * 34, 120, 12, 0, TAU); g.fill(); }
      g.font = font(18); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`${good} / ${need} mistakes made`, 920, 470);
      hint(g, many > 1 ? 'Do it WRONG on purpose: press a button the Rot did NOT light' : 'Do it WRONG on purpose: press any button but that one');
    },
  };
}

// push: parry each push on the side it comes from.
const DIRS = [
  { key: ['ArrowLeft', 'a'], dx: -1, dy: 0 }, { key: ['ArrowRight', 'd'], dx: 1, dy: 0 },
  { key: ['ArrowUp', 'w'], dx: 0, dy: -1 }, { key: ['ArrowDown', 's'], dx: 0, dy: 1 },
];
function push(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const C = { x: 480, y: 290 }; const SH = 110;
  const sp = [150, 190, 230][tier];
  const every = [1.5, 1.1, 0.85][tier];
  const win = [90, 65, 48][tier];
  const need = [6, 8, 10][tier];
  let hp = [4, 3, 3][tier];
  const pushes = []; const flares = [0, 0, 0, 0];
  let next = 1.0; let cool = 0; let got = 0; let hurt = 0;
  const parry = (d) => {
    if (cool > 0) return;
    cool = 0.35; flares[d] = 0.25;
    const hit = pushes.find((p) => p.d === d && p.r < SH + win && p.r > 50);
    if (hit) {
      hit.back = true; got += 1;
      fx.burst(C.x + DIRS[d].dx * SH, C.y + DIRS[d].dy * SH, ctx.palette.accent, 16, 260);
      if (got >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.tick();
    }
  };
  return {
    peek: () => ({ pushes: pushes.map((p) => ({ d: p.d, r: p.r, back: p.back })), cool, got, hp, win, SH }),
    update(dt) {
      cool -= dt; hurt -= dt;
      for (let i = 0; i < 4; i++) flares[i] -= dt;
      if ((next -= dt) <= 0) {
        next = every * (0.75 + rnd() * 0.5);
        pushes.push({ d: Math.floor(rnd() * 4), r: 430, back: false });
        if (tier === 2 && rnd() < 0.25) pushes.push({ d: Math.floor(rnd() * 4), r: 520, back: false });
      }
      for (let i = pushes.length - 1; i >= 0; i--) {
        const p = pushes[i];
        p.r += (p.back ? 600 : -sp) * dt;
        if (p.back && p.r > 600) { pushes.splice(i, 1); continue; }
        if (!p.back && p.r <= 50) {
          pushes.splice(i, 1); hp -= 1; hurt = 0.4; ctx.sfx.bad(); fx.burst(C.x, C.y, '#39d353', 20, 260);
          if (hp <= 0) { ctx.lose('rot'); return; }
        }
      }
      DIRS.forEach((d, i) => { if (d.key.some((k) => input.pressed.has(k))) parry(i); });
      for (const t of input.taps) {
        const dx = t.x - C.x; const dy = t.y - C.y;
        parry(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3));
      }
    },
    draw(g) {
      const t = ctx.t;
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 60;
      g.beginPath(); g.moveTo(0, C.y); g.lineTo(960, C.y); g.moveTo(C.x, 0); g.lineTo(C.x, 540); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = win;
      g.beginPath(); g.arc(C.x, C.y, SH + win / 2, 0, TAU); g.stroke();
      DIRS.forEach((d, i) => {
        const a = Math.atan2(d.dy, d.dx);
        g.strokeStyle = flares[i] > 0 ? '#ffffff' : ctx.palette.accent; g.lineWidth = flares[i] > 0 ? 14 : 8;
        g.beginPath(); g.arc(C.x, C.y, SH, a - 0.55, a + 0.55); g.stroke();
      });
      for (const p of pushes) {
        const d = DIRS[p.d];
        const x = C.x + d.dx * p.r; const y = C.y + d.dy * p.r;
        rot(g, x, y, 28, t, p.d);
        g.fillStyle = '#39d353'; g.font = font(26); g.textAlign = 'center'; g.textBaseline = 'middle';
        if (!p.back) g.fillText(['▶', '◀', '▼', '▲'][p.d], x - d.dx * 44, y - d.dy * 44);
      }
      g.fillStyle = hurt > 0 ? '#ff5b6b' : '#20263a';
      g.beginPath(); g.arc(C.x, C.y, 46, 0, TAU); g.fill();
      g.strokeStyle = ctx.palette.accent; g.lineWidth = 3; g.stroke();
      tileAt(g, ctx, C.x, C.y, 26);
      for (let i = 0; i < hp; i++) { g.fillStyle = '#ff6b8b'; g.font = '22px sans-serif'; g.textAlign = 'left'; g.fillText('❤', 40 + i * 30, 80); }
      g.font = font(18); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(`${got} / ${need} pushed back`, 920, 470);
      hint(g, 'PUSH BACK on the side the Rot comes from');
    },
  };
}

function packet(g, ctx, x, y, s = 56) {
  g.fillStyle = '#20263a'; rrect(g, x - s / 2, y - s / 2, s, s, 10); g.fill();
  g.lineWidth = 3; g.strokeStyle = ctx.palette.accent; g.stroke();
  tileAt(g, ctx, x, y, s * 0.42);
}

const MODES = { flip, drop, mis, push };

export default {
  seconds: 30,
  howTo: (m) => HOW[modeOf(m.id)],
  verb: (m) => VERB[m.id] || 'You turned it around.',
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
