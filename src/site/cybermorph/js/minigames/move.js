/**
 * Move it (port, fer, ject, mit/miss, tract, duct/duc/duce, mot/mobile/kine, liver).
 * Get the data packet across the gap, and the verb is the control:
 *   carry (port, fer)          hold to walk it over; let go to set it down while the Rot drips
 *   throw (ject)               pull back, aim and let go into a moving bin
 *   send (mit, miss)           launch along a sweeping beam to a receiver
 *   pull (tract)               tug the rope on the beat; off-beat tugs slip
 *   lead (duct, duc, duce)     guide a line of sprites to the door, around the Rot
 *   run (mot, mobile, kine)    keep a runner going: stride to stay ahead of the Rot wave
 *   pass (liver)               hand it over when the next bot reaches out
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

// ── Move it pieces ─────────────────────────────────────────────────
const MODE_OF = {
  port: 'carry', fer: 'carry', ject: 'throw', mit: 'send', miss: 'send', tract: 'pull',
  duct: 'lead', duc: 'lead', duce: 'lead', mot: 'run', mobile: 'run', kine: 'run', liver: 'pass',
};
const modeOf = (id) => MODE_OF[id] || 'carry';

const HOW = {
  carry: 'Hold down (or hold Space) to carry the packet across. Let go to stop when the Rot drips.',
  throw: 'Pull back, aim and let go to throw the packet into the moving bin.',
  send: 'Tap (or Space) to send a packet when the beam points at the receiver.',
  pull: 'Tap (or Space) on the beat to pull the rope. Tugs off the beat slip.',
  lead: 'Drag (or use the arrows) to lead your line of sprites to the door, around the Rot.',
  run: 'Tap (or Space) each time the runner lands to keep it going. Hop over the Rot puddles!',
  pass: 'Tap (or Space) when the next bot reaches out to hand the packet over.',
};
const VERB = {
  carry: 'You carried it across.', throw: 'You threw it in.', send: 'You sent it to the receiver.',
  pull: 'You pulled it free.', lead: 'You led them home.', run: 'You kept it moving.', pass: 'You handed it over.',
};

/** The data packet: a crate with the morpheme's tile on it. */
function packet(g, ctx, x, y, s = 56) {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  rrect(g, x - s / 2 + 3, y - s / 2 + 4, s, s, 10); g.fill();
  g.fillStyle = '#20263a';
  rrect(g, x - s / 2, y - s / 2, s, s, 10); g.fill();
  g.lineWidth = 3;
  g.strokeStyle = ctx.palette.accent;
  g.stroke();
  tileAt(g, ctx, x, y, s * 0.42);
}

/** A little courier bot. */
function bot(g, x, y, t, { walk = 0, arms = 0, color = '#9fc6ff', face = 1 } = {}) {
  const step = Math.sin(walk * 14) * 8;
  g.strokeStyle = '#cfd6e2';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 8, y - 24); g.lineTo(x - 8 + step, y); g.moveTo(x + 8, y - 24); g.lineTo(x + 8 - step, y); g.stroke();
  g.fillStyle = color;
  rrect(g, x - 22, y - 70, 44, 48, 12); g.fill();
  g.fillStyle = '#0b1020';
  rrect(g, x - 15 + face * 3, y - 62, 30, 18, 6); g.fill();
  g.fillStyle = '#7fe0ff';
  g.fillRect(x - 9 + face * 4, y - 57, 5, 8); g.fillRect(x + 3 + face * 4, y - 57, 5, 8);
  g.beginPath();
  const ay = y - 46 - arms * 34;
  g.moveTo(x - 20, y - 44); g.lineTo(x - 18, ay); g.moveTo(x + 20, y - 44); g.lineTo(x + 18, ay);
  g.stroke();
  g.lineCap = 'butt';
}

function gap(g, x0, x1, y) {
  g.fillStyle = '#0a0612';
  g.fillRect(x0, y, x1 - x0, 540 - y);
  g.fillStyle = '#2a2f45';
  g.fillRect(0, y, x0, 540 - y);
  g.fillRect(x1, y, 960 - x1, 540 - y);
  g.fillStyle = '#3a4160';
  g.fillRect(0, y, x0, 8);
  g.fillRect(x1, y, 960 - x1, 8);
}

// carry: hold to walk the packet across the gap; drips from the Rot pipe puddle in your way.
function carry(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const Y = 430; const X0 = 110; const X1 = 850;
  const speed = [135, 115, 105][tier];
  const every = [2.4, 1.8, 1.4][tier];
  const warn = [1.2, 1.0, 0.8][tier];
  const dry = [0.6, 0.8, 1.0][tier];
  let x = X0; let holding = false; let stun = 0; let walk = 0; let next = 0.9; let T = 0;
  const drips = [];
  const slimed = () => { stun = 0.7; x = Math.max(X0, x - 140); fx.burst(x, Y - 90, '#39d353', 16); ctx.sfx.bad(); };
  return {
    peek: () => ({ x, holding, drips: drips.map((d) => ({ x: d.x, t: d.t, wet: d.wet })), X1 }),
    update(dt) {
      T += dt;
      stun = Math.max(0, stun - dt);
      holding = (input.down || has(input.keys, ' ', 'ArrowRight', 'd')) && stun <= 0;
      if (holding) {
        const nx = x + speed * dt;
        if (drips.some((d) => d.t <= 0 && Math.abs(d.x - nx) < 36)) slimed();
        else { x = nx; walk += dt; }
      }
      next -= dt;
      if (next <= 0 && x < X1 - 90) {
        next = every * (0.75 + rnd() * 0.5);
        drips.push({ x: clamp(x + 90 + rnd() * 170, X0 + 70, X1 - 40), t: warn, wet: dry });
      }
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        if (d.t > 0) {
          d.t -= dt;
          if (d.t <= 0) { fx.burst(d.x, Y, '#39d353', 8, 140); if (Math.abs(d.x - x) < 36) slimed(); }
        } else if ((d.wet -= dt) <= 0) drips.splice(i, 1);
      }
      if (x >= X1) { fx.burst(X1 + 30, Y - 80, ctx.palette.accent, 30); ctx.sfx.good(); ctx.win(); }
    },
    draw(g) {
      const t = ctx.t;
      gap(g, 200, 760, Y);
      // the girder bridge
      g.fillStyle = '#4a5275';
      g.fillRect(200, Y, 560, 10);
      g.strokeStyle = '#4a5275'; g.lineWidth = 3;
      for (let bx = 200; bx < 760; bx += 40) { g.beginPath(); g.moveTo(bx, Y + 10); g.lineTo(bx + 20, Y + 40); g.lineTo(bx + 40, Y + 10); g.stroke(); }
      // the Rot pipe
      g.fillStyle = '#1d3a24';
      g.fillRect(0, 70, 960, 22);
      rot(g, 120 + ((t * 60) % 720), 92, 16, t, 1);
      // receiver dock
      g.fillStyle = ctx.palette.accent;
      g.globalAlpha = 0.3 + 0.2 * Math.sin(t * 4);
      g.fillRect(X1 + 10, Y - 120, 70, 120);
      g.globalAlpha = 1;
      g.font = font(18); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('DROP-OFF', X1 + 45, Y + 34);
      for (const d of drips) {
        if (d.t > 0) {
          g.fillStyle = `rgba(57,211,83,${0.25 + 0.35 * (1 - d.t / warn)})`;
          g.beginPath(); g.ellipse(d.x, Y + 2, 34, 8, 0, 0, TAU); g.fill();
          const fy = 92 + (Y - 92) * (1 - d.t / warn) ** 2;
          g.fillStyle = '#39d353';
          g.beginPath(); g.arc(d.x, fy, 10, 0, TAU); g.fill();
        } else {
          g.fillStyle = '#39d353';
          g.beginPath(); g.ellipse(d.x, Y + 1, 36, 10 + Math.sin(t * 8) * 2, 0, 0, TAU); g.fill();
        }
      }
      const arms = holding ? 1 : 0;
      bot(g, x, Y, t, { walk, arms, color: stun > 0 ? '#39d353' : '#9fc6ff' });
      if (holding) packet(g, ctx, x, Y - 108, 50);
      else packet(g, ctx, x + 40, Y - 22, 44);
      hint(g, holding ? 'Carrying…' : 'HOLD to carry it ▸');
    },
  };
}

// throw: slingshot aim (drag back and let go), or ↑↓ to aim and hold Space for power.
function toss(ctx, fx) {
  const { tier, input } = ctx;
  const L = { x: 150, y: 400 }; const GRAV = 900; const BIN_Y = 440;
  const binW = [150, 110, 88][tier];
  const need = [2, 3, 3][tier];
  const dots = [30, 12, 5][tier];
  let T = 0; let got = 0; let fly = null; let drag = null; let aim = null;
  let ang = 50; let charge = 0; let spaceWas = false;
  const binX = () => (tier === 0 ? 740 : tier === 1 ? 700 + Math.sin(T * 0.9) * 120 : 700 + Math.sin(T * 1.2) * 140);
  const rotAt = () => ({ x: 470, y: 250 + Math.sin(T * 1.3) * 130, r: [0, 34, 40][tier] });
  const keyAim = () => { const v = 320 + charge * 620; const a = (ang * Math.PI) / 180; return { vx: Math.cos(a) * v, vy: -Math.sin(a) * v }; };
  const launch = (v) => { fly = { x: L.x, y: L.y, vx: v.vx, vy: v.vy }; ctx.sfx.click(); };
  return {
    peek: () => ({ got, fly, binX: binX(), binW, rot: rotAt(), need, T }),
    update(dt) {
      T += dt;
      const k = input.keys;
      if (!fly) {
        if (input.taps.length) drag = { ...input.taps[0] };
        if (drag && input.down) {
          let vx = (drag.x - input.x) * 6; let vy = (drag.y - input.y) * 6;
          const m = Math.hypot(vx, vy);
          if (m > 940) { vx *= 940 / m; vy *= 940 / m; }
          aim = { vx, vy };
        } else if (drag && !input.down) {
          if (aim && Math.hypot(aim.vx, aim.vy) > 150) launch(aim);
          drag = null; aim = null;
        }
        if (has(k, 'ArrowUp', 'w')) ang = Math.min(80, ang + 50 * dt);
        if (has(k, 'ArrowDown', 's')) ang = Math.max(10, ang - 50 * dt);
        if (k.has(' ')) { charge = 0.5 - 0.5 * Math.cos(((T * TAU) / 1.6)); aim = keyAim(); }
        else if (spaceWas) { launch(keyAim()); aim = null; }
        spaceWas = k.has(' ');
      } else {
        const py = fly.y;
        fly.vy += GRAV * dt; fly.x += fly.vx * dt; fly.y += fly.vy * dt;
        const r = rotAt();
        if (r.r && Math.hypot(fly.x - r.x, fly.y - r.y) < r.r + 18) { fx.burst(fly.x, fly.y, '#39d353', 14); ctx.sfx.bad(); fly = null; return; }
        const bx = binX();
        if (fly.vy > 0 && py < BIN_Y - 40 && fly.y >= BIN_Y - 40 && Math.abs(fly.x - bx) < binW / 2) {
          got += 1; fx.burst(bx, BIN_Y - 40, ctx.palette.accent, 24); fly = null;
          if (got >= need) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.pickup();
          return;
        }
        if (fly.y > 560 || fly.x > 1000 || fly.x < -40) { fx.burst(clamp(fly.x, 10, 950), 520, '#888', 8, 120); fly = null; }
      }
    },
    draw(g) {
      const t = ctx.t;
      gap(g, 230, 960, 470);
      const bx = binX();
      g.fillStyle = '#2a2f45';
      g.fillRect(bx - binW / 2 - 6, BIN_Y - 40, binW + 12, 80);
      g.fillStyle = ctx.palette.accent;
      g.fillRect(bx - binW / 2 - 6, BIN_Y - 44, binW + 12, 8);
      g.font = font(18); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('BIN', bx, BIN_Y + 6);
      const r = rotAt();
      if (r.r) rot(g, r.x, r.y, r.r, t, 2);
      // launcher
      g.fillStyle = '#4a5275';
      g.fillRect(L.x - 40, L.y + 20, 80, 50);
      bot(g, L.x - 60, 470, t, { arms: 1 });
      if (aim) {
        let x = L.x; let y = L.y; let vx = aim.vx; let vy = aim.vy;
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < dots; i++) {
          for (let s = 0; s < 3; s++) { vy += GRAV * 0.02; x += vx * 0.02; y += vy * 0.02; }
          g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
        }
      }
      if (fly) packet(g, ctx, fly.x, fly.y, 40);
      else packet(g, ctx, L.x, L.y, 44);
      if (drag && input.down) {
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(drag.x, drag.y); g.lineTo(input.x, input.y); g.stroke();
      }
      hint(g, `Pull back and let go to THROW · ${got} / ${need}`);
    },
  };
}

// send: a sweeping transmitter; launch when it points at the moving receiver.
function send(ctx, fx) {
  const { tier, input } = ctx;
  const TX = { x: 110, y: 270 }; const RX = 860;
  const need = [2, 3, 4][tier];
  const w = [0.7, 0.95, 1.2][tier];
  const rr = [72, 60, 48][tier];
  const aimLen = [760, 260, 110][tier];
  const rots = [[], [{ x: 480, ph: 0, sp: 1.2 }], [{ x: 380, ph: 0, sp: 1.3 }, { x: 600, ph: 2, sp: 1.0 }]][tier];
  let T = 0; let got = 0; let cool = 0;
  const shots = [];
  const ang = () => Math.sin(T * w) * 0.8;
  const rxY = () => 270 + Math.sin(T * [0.4, 0.55, 0.8][tier]) * [90, 130, 160][tier];
  const rotY = (r) => 270 + Math.sin(T * r.sp + r.ph) * 170;
  return {
    peek: () => ({ got, ang: ang(), rxY: rxY(), rots: rots.map((r) => ({ x: r.x, y: rotY(r) })), shots: shots.length, cool, T }),
    update(dt) {
      T += dt; cool -= dt;
      if ((input.taps.length || input.pressed.has(' ')) && cool <= 0) {
        const a = ang();
        shots.push({ x: TX.x + Math.cos(a) * 50, y: TX.y + Math.sin(a) * 50, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900 });
        cool = 0.55; ctx.sfx.click();
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (rots.some((r) => Math.hypot(s.x - r.x, s.y - rotY(r)) < 50)) { fx.burst(s.x, s.y, '#39d353', 12); shots.splice(i, 1); continue; }
        if (s.x >= RX - 24) {
          shots.splice(i, 1);
          if (Math.abs(s.y - rxY()) < rr) {
            got += 1; fx.burst(RX, rxY(), ctx.palette.accent, 24);
            if (got >= need) { ctx.sfx.good(); ctx.win(); return; }
            ctx.sfx.pickup();
          } else fx.burst(RX, s.y, '#666', 6, 100);
          continue;
        }
        if (s.y < -20 || s.y > 560) shots.splice(i, 1);
      }
    },
    draw(g) {
      const t = ctx.t;
      // stars
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 40; i++) g.fillRect((i * 173) % 960, (i * 97) % 540, 2, 2);
      const a = ang();
      g.save();
      g.translate(TX.x, TX.y);
      g.setLineDash([10, 10]);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * aimLen, Math.sin(a) * aimLen); g.stroke();
      g.setLineDash([]);
      g.rotate(a);
      g.fillStyle = '#4a5275'; g.fillRect(0, -14, 58, 28);
      g.restore();
      g.fillStyle = '#2a2f45'; g.beginPath(); g.arc(TX.x, TX.y, 40, 0, TAU); g.fill();
      tileAt(g, ctx, TX.x, TX.y, 26);
      for (const r of rots) rot(g, r.x, rotY(r), 32, t, r.ph);
      const y = rxY();
      g.strokeStyle = ctx.palette.accent; g.lineWidth = 6;
      g.beginPath(); g.arc(RX + 40, y, rr, Math.PI * 0.6, Math.PI * 1.4); g.stroke();
      g.fillStyle = '#4a5275'; g.fillRect(RX + 36, y - 10, 70, 20);
      g.fillStyle = ctx.palette.accent; g.globalAlpha = 0.25; g.fillRect(RX - 6, y - rr, 12, rr * 2); g.globalAlpha = 1;
      for (const s of shots) packet(g, ctx, s.x, s.y, 30);
      hint(g, `Tap to SEND when it points at the receiver · ${got} / ${need}`);
    },
  };
}

// pull: tug-of-war with the Rot, played on a beat.
function pull(ctx, fx) {
  const { tier, input } = ctx;
  const beat = [0.9, 0.75, 0.62][tier];
  const win = [0.2, 0.14, 0.1][tier];
  const tug = [74, 60, 52][tier];
  const drift = [8, 14, 20][tier];
  const LEAD = 1;
  let T = 0; let x = 820; let used = -1; let lastBeat = -1; let flash = 0; let slip = 0; let yank = 0;
  return {
    peek: () => ({ x, T, beat, lead: LEAD, used }),
    update(dt) {
      T += dt; flash -= dt; slip -= dt; yank = Math.max(0, yank - dt * 4);
      const bt = T - LEAD;
      const n = Math.round(bt / beat);
      if (bt >= 0 && Math.floor(bt / beat) > lastBeat) { lastBeat = Math.floor(bt / beat); ctx.sfx.tick(); }
      if (bt > 0) x += drift * dt;
      if (input.taps.length || input.pressed.has(' ')) {
        const off = Math.abs(bt - n * beat);
        if (bt > -win && off < win && n !== used) { used = n; x -= tug; flash = 0.25; yank = 1; fx.burst(x - 40, 300, ctx.palette.accent, 8, 160); }
        else { x += 22; slip = 0.35; }
      }
      x = Math.min(x, 860);
      if (x <= 230) { fx.burst(230, 300, ctx.palette.accent, 30); ctx.sfx.good(); ctx.win(); }
    },
    draw(g) {
      const t = ctx.t;
      const bt = T - LEAD;
      // Rot pool on the right
      g.fillStyle = '#123d1d';
      g.beginPath(); g.ellipse(860, 360, 140, 40, 0, 0, TAU); g.fill();
      rot(g, 880, 300, 56, t, 3);
      g.fillStyle = '#2a2f45'; g.fillRect(0, 360, 260, 180);
      // the rope, sagging on a slip
      const sag = slip > 0 ? 40 : 6 + 10 * Math.sin(t * 3);
      g.strokeStyle = '#d9b26b'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(140, 300); g.quadraticCurveTo((140 + x) / 2, 300 + sag, x - 30, 300); g.stroke();
      packet(g, ctx, x, 300, 56);
      bot(g, 110 - yank * 12, 360, t, { arms: 0.6 + yank * 0.3, face: 1 });
      // the beat ring: shrinks onto the drum on every beat
      const cx = 480; const cy = 140;
      const ph = bt < 0 ? 1 + -bt / beat : (bt % beat) / beat;
      const ring = 22 + 70 * (1 - (ph % 1));
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4;
      g.beginPath(); g.arc(cx, cy, ring, 0, TAU); g.stroke();
      g.fillStyle = flash > 0 ? ctx.palette.accent : '#4a5275';
      g.beginPath(); g.arc(cx, cy, 26, 0, TAU); g.fill();
      g.font = font(18); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(bt < 0 ? 'ready…' : 'PULL', cx, cy + 6);
      if (slip > 0) { g.font = font(26, 800); g.fillStyle = '#ff6b6b'; g.fillText('slip!', x - 80, 250); }
      hint(g, 'Tap on the BEAT to pull it out of the Rot');
    },
  };
}

// lead: a snake of sprites follows your trail; the Rot scares off any it touches.
function lead(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const count = [4, 5, 6][tier];
  const need = [3, 4, 5][tier];
  const sp = 260; const GAP = 36; const DOOR = { x: 890, y: 270 };
  const L = { x: 90, y: 270 };
  const trail = [];
  for (let i = 0; i < 60; i++) trail.push({ x: L.x - i * 6, y: L.y });
  const line = Array.from({ length: count }, (_, i) => ({ i, hue: (i * 57) % 360 }));
  const strays = [];
  const rots = Array.from({ length: [2, 3, 4][tier] }, (_, i) => ({
    x: 300 + i * (440 / Math.max(1, [2, 3, 4][tier] - 1)) + (rnd() - 0.5) * 40, y: 120 + rnd() * 300,
    vx: (rnd() - 0.5) * [0, 90, 150][tier], vy: (rnd() < 0.5 ? -1 : 1) * [0, 60, 100][tier], r: 32,
  }));
  let stun = 0; let short = 0;
  const along = (d) => {
    let acc = 0;
    for (let i = 1; i < trail.length; i++) {
      const s = Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      if (acc + s >= d) { const f = (d - acc) / (s || 1); return { x: trail[i - 1].x + (trail[i].x - trail[i - 1].x) * f, y: trail[i - 1].y + (trail[i].y - trail[i - 1].y) * f }; }
      acc += s;
    }
    return { ...trail[trail.length - 1] };
  };
  return {
    peek: () => ({ L: { ...L }, line: line.length, strays: strays.map((s) => ({ x: s.x, y: s.y })), rots: rots.map((r) => ({ x: r.x, y: r.y, r: r.r })), DOOR, need }),
    update(dt) {
      stun -= dt; short -= dt;
      let mx = 0; let my = 0;
      const a = axis(input.keys);
      if (a.x || a.y) { const m = Math.hypot(a.x, a.y); mx = (a.x / m) * sp; my = (a.y / m) * sp; }
      else if (input.down) {
        const dx = input.x - L.x; const dy = input.y - L.y; const d = Math.hypot(dx, dy);
        if (d > 6) { mx = (dx / d) * Math.min(sp, d * 6); my = (dy / d) * Math.min(sp, d * 6); }
      }
      if (stun > 0) { mx *= 0.3; my *= 0.3; }
      L.x = clamp(L.x + mx * dt, 20, 940); L.y = clamp(L.y + my * dt, 80, 500);
      for (const r of rots) {
        r.x += r.vx * dt; r.y += r.vy * dt;
        if (r.x < 250 || r.x > 790) r.vx *= -1;
        if (r.y < 110 || r.y > 470) r.vy *= -1;
        const d = Math.hypot(L.x - r.x, L.y - r.y);
        if (d < r.r + 20) { const k = (r.r + 20 - d) / (d || 1); L.x += (L.x - r.x) * k; L.y += (L.y - r.y) * k; if (stun <= 0) { stun = 0.4; ctx.sfx.bad(); } }
      }
      const head = trail[0];
      if (Math.hypot(L.x - head.x, L.y - head.y) > 4) { trail.unshift({ x: L.x, y: L.y }); if (trail.length > 400) trail.pop(); }
      line.forEach((s, i) => { const p = along((i + 1) * GAP); s.x = p.x; s.y = p.y; });
      for (let i = line.length - 1; i >= 0; i--) {
        const s = line[i];
        if (rots.some((r) => Math.hypot(s.x - r.x, s.y - r.y) < r.r + 12)) {
          line.splice(i, 1); strays.push({ ...s, x: s.x + (rnd() - 0.5) * 60, y: clamp(s.y + (rnd() - 0.5) * 60, 90, 490) });
          fx.burst(s.x, s.y, '#39d353', 10, 160); ctx.sfx.bad();
        }
      }
      for (let i = strays.length - 1; i >= 0; i--) {
        const s = strays[i];
        if (Math.hypot(s.x - L.x, s.y - L.y) < 34) { strays.splice(i, 1); line.push(s); ctx.sfx.pickup(); }
      }
      if (Math.hypot(L.x - DOOR.x, L.y - DOOR.y) < 50) {
        if (line.length >= need) { fx.burst(DOOR.x, DOOR.y, ctx.palette.accent, 30); ctx.sfx.good(); ctx.win(); }
        else short = 0.5;
      }
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < 960; x += 48) g.fillRect(x, 0, 1, 540);
      for (let y = 0; y < 540; y += 48) g.fillRect(0, y, 960, 1);
      g.fillStyle = ctx.palette.accent;
      g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 4);
      rrect(g, DOOR.x - 40, DOOR.y - 60, 80, 120, 14); g.fill();
      g.globalAlpha = 1;
      g.font = font(18); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('DOOR', DOOR.x, DOOR.y + 84);
      for (const r of rots) rot(g, r.x, r.y, r.r, t, r.x);
      const sprite = (s, scared) => {
        g.fillStyle = `hsl(${s.hue},80%,${scared ? 45 : 65}%)`;
        g.beginPath(); g.arc(s.x, s.y + (scared ? Math.sin(t * 30) * 2 : 0), 13, 0, TAU); g.fill();
        g.fillStyle = '#0b1020';
        g.fillRect(s.x - 5, s.y - 3, 3, 4); g.fillRect(s.x + 2, s.y - 3, 3, 4);
      };
      for (const s of strays) { sprite(s, true); g.font = font(16); g.fillStyle = '#fff'; g.fillText('?', s.x, s.y - 20); }
      for (let i = line.length - 1; i >= 0; i--) sprite(line[i], false);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(L.x, L.y, 20, 0, TAU); g.fill();
      tileAt(g, ctx, L.x, L.y, 16);
      hint(g, short > 0 ? `Bring ${need - line.length} more to the door!` : `LEAD them to the door · ${line.length} in line (need ${need})`);
    },
  };
}

// run: each stride (on landing) adds speed; the Rot wave rolls in from behind.
function run(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const len = [2500, 3000, 3400][tier];
  const wave = [118, 150, 172][tier];
  const pw = [50, 70, 82][tier];
  const HOP = 0.34; const Y = 420;
  const puddles = [];
  for (let s = 460; s < len - 200; s += 340 + rnd() * 200) puddles.push(s);
  let T = 0; let s = 0; let v = 160; let air = 0; let stuck = 0; let w = -260;
  return {
    peek: () => ({ s, v, air, w, puddles, pw, len }),
    update(dt) {
      T += dt; stuck -= dt;
      if ((input.taps.length || input.pressed.has(' ') || input.pressed.has('ArrowUp') || input.pressed.has('w') || input.pressed.has('ArrowRight') || input.pressed.has('d')) && air <= 0) {
        air = HOP; v = Math.min(400, v + 75); ctx.sfx.tick();
      }
      air -= dt;
      v = Math.max(0, v - 85 * dt);
      if (air <= 0 && puddles.some((p) => s > p && s < p + pw)) { if (stuck <= 0) { v *= 0.45; fx.burst(300, Y, '#39d353', 6, 120); } stuck = 0.3; }
      s += v * dt;
      if (T > 0.6) w += wave * dt;
      if (w >= s - 20) { fx.burst(300, Y - 40, '#39d353', 24); ctx.lose('rot'); }
      if (s >= len) { fx.burst(300, Y - 40, ctx.palette.accent, 30); ctx.sfx.good(); ctx.win(); }
    },
    draw(g) {
      const t = ctx.t;
      const cam = s - 300;
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 12; i++) { const x = ((i * 140 - cam * 0.3) % 1680 + 1680) % 1680 - 100; g.fillRect(x, 140 + (i % 3) * 50, 80, 160); }
      g.fillStyle = '#2a2f45'; g.fillRect(0, Y, 960, 120);
      g.fillStyle = '#3a4160';
      for (let x = -((cam % 60) + 60) % 60; x < 960; x += 60) g.fillRect(x, Y, 30, 6);
      for (const p of puddles) { const x = p - cam; if (x > -100 && x < 1060) { g.fillStyle = '#39d353'; g.beginPath(); g.ellipse(x + pw / 2, Y + 2, pw / 2, 8, 0, 0, TAU); g.fill(); } }
      const fxx = len - cam;
      if (fxx < 1000) { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(fxx, Y - 160 + i * 20, 14, 20); } }
      const hop = air > 0 ? Math.sin(Math.PI * (1 - air / HOP)) * 46 : 0;
      bot(g, 300, Y - hop, t, { walk: s / 90, arms: 0.2, color: stuck > 0 ? '#39d353' : '#9fc6ff' });
      tileAt(g, ctx, 300, Y - hop - 46, 18);
      // the Rot wave
      const wx = w - cam;
      if (wx > -200) {
        g.fillStyle = 'rgba(57,211,83,0.85)';
        g.beginPath(); g.moveTo(-10, 540); g.lineTo(-10, 160);
        for (let y = 160; y <= 540; y += 20) g.lineTo(wx + Math.sin(y * 0.05 + t * 6) * 18, y);
        g.closePath(); g.fill();
        rot(g, wx - 40, 300 + Math.sin(t * 2) * 30, 40, t, 4);
      }
      // progress bar
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(280, 66, 400, 8);
      g.fillStyle = ctx.palette.accent; g.fillRect(280, 66, 400 * clamp(s / len, 0, 1), 8);
      hint(g, 'Tap each time you land to keep it MOVING');
    },
  };
}

// pass: a relay of bots; hand it over when the next one reaches out and the Rot is down.
function pass(ctx, fx) {
  const { tier, rnd, input } = ctx;
  const XS = [110, 295, 480, 665, 850]; const Y = 400;
  const open = [1.0, 0.65, 0.45][tier];
  const rotP = [0, 2.2, 1.7][tier];
  let T = 0; let h = 0; let fly = null; let drop = null;
  let phase = 0; let wait = 0.8 + rnd() * 0.6;
  const reaching = () => phase === 1;
  const rotUp = () => rotP > 0 && ((T % rotP) / rotP) < 0.45;
  return {
    peek: () => ({ h, reaching: reaching(), rotUp: rotUp(), busy: !!(fly || drop) }),
    update(dt) {
      T += dt;
      wait -= dt;
      if (wait <= 0) { phase = 1 - phase; wait = phase ? open : 0.7 + rnd() * 0.9; }
      if (fly) {
        fly.t += dt / 0.4;
        if (fly.t >= 1) {
          h += 1; fly = null; phase = 0; wait = 0.6 + rnd() * 0.6;
          fx.burst(XS[h], Y - 100, ctx.palette.accent, 14, 180);
          if (h >= XS.length - 1) { ctx.sfx.good(); ctx.win(); } else ctx.sfx.pickup();
        }
      } else if (drop) {
        drop.t += dt;
        if (drop.t > 0.8) { h = Math.max(0, h - 1); drop = null; }
      } else if (input.taps.length || input.pressed.has(' ')) {
        if (reaching() && !rotUp()) fly = { t: 0 };
        else { drop = { t: 0, x: (XS[h] + XS[h + 1]) / 2 }; fx.burst(drop.x, Y + 30, '#39d353', 14); ctx.sfx.bad(); }
      }
    },
    draw(g) {
      const t = ctx.t;
      g.fillStyle = '#2a2f45';
      XS.forEach((x) => g.fillRect(x - 50, Y, 100, 140));
      g.fillStyle = '#0a0612';
      for (let i = 0; i < XS.length - 1; i++) g.fillRect(XS[i] + 50, Y, XS[i + 1] - XS[i] - 100, 140);
      if (rotP) {
        const gx = (XS[h] + XS[Math.min(h + 1, XS.length - 1)]) / 2;
        const up = rotUp();
        rot(g, gx, up ? Y - 120 : Y + 40, 34, t, 5);
      }
      XS.forEach((x, i) => {
        const arms = i === h ? 1 : i === h + 1 && reaching() ? 0.9 : 0;
        bot(g, x, Y, t, { arms, color: i === XS.length - 1 ? ctx.palette.accent : '#9fc6ff', face: i <= h ? 1 : -1 });
        if (i === h + 1 && reaching()) { g.font = font(20, 800); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('✋', x, Y - 130); }
      });
      if (fly) {
        const a = XS[h]; const b = XS[h + 1]; const k = fly.t;
        packet(g, ctx, a + (b - a) * k, Y - 110 - Math.sin(Math.PI * k) * 60, 44);
      } else if (drop) packet(g, ctx, drop.x, Y + Math.min(1, drop.t * 2) * 120, 44);
      else packet(g, ctx, XS[h], Y - 110, 44);
      hint(g, 'HAND it over when the next bot reaches out ✋');
    },
  };
}

const MODES = { carry, throw: toss, send, pull, lead, run, pass };

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
