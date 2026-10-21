/**
 * Mind & feeling (mind): read the crowd. People stroll past, each showing a feeling on their face
 * and in their bubble, and you send your morpheme's feeling to everyone who shows it:
 *  - phil (love): the ones who love something get a heart.
 *  - path (feeling; disease): the sad and the sick get a hug.
 *  - psych (mind): the thinkers get a bright idea.
 *  - soph (wisdom): the wise get a graduation cap.
 *  - cred (believe): the believers get a badge.
 *  - sense (perceive): the ones looking, listening and sniffing get a sparkle.
 *  - phob (fear) is played the other way round: you ARE the scared one, and you run from the
 *    spiders to each safe door.
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
const keyIn = (set, ks) => ks.some((k) => set.has(k));
function keyDir(input) {
  return { x: (keyIn(input.keys, ['ArrowRight', 'd']) ? 1 : 0) - (keyIn(input.keys, ['ArrowLeft', 'a']) ? 1 : 0), y: (keyIn(input.keys, ['ArrowDown', 's']) ? 1 : 0) - (keyIn(input.keys, ['ArrowUp', 'w']) ? 1 : 0) };
}

// ── the crowd ──
// Each feeling: faces that show it, what is in their bubble, and what you send them.
const FEEL = {
  phil: { name: 'LOVE', faces: ['😍', '🥰'], bubble: ['🐶', '🍕', '⚽', '🎵'], gift: '💖', verb: 'loves something' },
  path: { name: 'FEEL', faces: ['😢', '🤒'], bubble: ['💔', '🤕', '🌧️'], gift: '🤗', verb: 'feels sad or sick' },
  psych: { name: 'THINK', faces: ['🤔'], bubble: ['💭', '❓', '🧩'], gift: '💡', verb: 'is thinking' },
  soph: { name: 'WISE', faces: ['🧐', '🧙'], bubble: ['📚', '🦉', '📜'], gift: '🎓', verb: 'is wise' },
  cred: { name: 'BELIEVE', faces: ['😌', '🙏'], bubble: ['✅', '👍'], gift: '🏅', verb: 'believes it' },
  sense: { name: 'SENSE', faces: ['👀', '😮'], bubble: ['👂', '👃', '👅'], gift: '✨', verb: 'is using their senses' },
  phob: { name: 'FEAR', faces: ['😱', '😨'], bubble: ['🕷️', '🐍', '👻'], gift: '', verb: 'is scared' },
  meh: { name: 'MEH', faces: ['😐', '😴'], bubble: ['💤', '…'], gift: '', verb: '' },
};
const HOW = {
  phil: 'means love: send a heart to everyone who loves something.',
  path: 'means feeling: send a hug to everyone who feels sad or sick.',
  psych: 'means mind: send a bright idea to everyone who is thinking.',
  soph: 'means wisdom: send a cap to everyone who is wise.',
  cred: 'means believe: send a badge to everyone who believes.',
  sense: 'means to sense: send a sparkle to everyone looking, listening or sniffing.',
  phob: 'means fear: you are scared of spiders, so run from them to each safe door.',
};
const VERB = {
  phil: 'You found everyone who loves something.', path: 'You comforted everyone who was hurting.', psych: 'You found every thinking mind.',
  soph: 'You found the wise ones.', cred: 'You found the believers.', sense: 'You found everyone using their senses.', phob: 'You ran from what you fear.',
};

export default {
  seconds: 30,
  howTo(m) { return `${m.text} ${HOW[m.id] || HOW.phil}`; },
  verb(m) { return VERB[m.id] || VERB.phil; },
  start(ctx) { return ctx.id === 'phob' ? fleeGame(ctx) : crowdGame(ctx); },
};

function crowdGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const want = FEEL[ctx.id] ? ctx.id : 'phil';
  const others = Object.keys(FEEL).filter((k) => k !== want);
  const need = [4, 6, 8][tier];
  const speed = [80, 110, 150][tier];
  const LANES = [210, 360];
  let done = 0; let miss = 0; let spawnIn = 0; let kbd = false; let k = 0;
  const cur = { x: W / 2, y: 300 };
  const folk = []; const gifts = [];
  function spawn() {
    const lane = k % 2; k += 1;
    const isRot = tier > 0 && rnd() < 0.12;
    const feel = isRot ? null : rnd() < 0.42 ? want : others[Math.floor(rnd() * others.length)];
    const f = feel ? FEEL[feel] : null;
    const dir = lane ? -1 : 1;
    folk.push({
      feel, rot: isRot, x: dir > 0 ? -60 : W + 60, y: LANES[lane], vx: dir * speed * (0.85 + rnd() * 0.3),
      face: f ? f.faces[Math.floor(rnd() * f.faces.length)] : '', bub: f ? f.bubble[Math.floor(rnd() * f.bubble.length)] : '', ph: rnd() * 6, got: false, shake: 0,
    });
  }
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ folk, want });
  function tag(x, y) {
    const p = folk.filter((o) => !o.got).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (!p || Math.hypot(p.x - x, p.y - y) > 60) return;
    if (p.feel === want) {
      p.got = true; done += 1; ctx.sfx.pickup(); gifts.push({ e: FEEL[want].gift, x: p.x, y: p.y - 40, t: 1.2 });
      fx.burst(p.x, p.y, palette.glow, 20);
      if (done >= need) ctx.win();
    } else {
      p.shake = 1; miss += 1; ctx.sfx.bad(); fx.burst(p.x, p.y, '#7dff4a', 10, 150);
      if (miss >= 3) ctx.lose('rot');
    }
  }
  return {
    update(dt) {
      spawnIn -= dt;
      if (spawnIn <= 0) { spawn(); spawnIn = [1.0, 0.8, 0.6][tier] * (0.8 + rnd() * 0.4); }
      folk.forEach((p) => { p.x += p.vx * dt; p.shake = Math.max(0, p.shake - dt * 3); });
      for (let i = folk.length - 1; i >= 0; i--) if (folk[i].x < -90 || folk[i].x > W + 90) folk.splice(i, 1);
      gifts.forEach((gf) => { gf.t -= dt; gf.y -= 40 * dt; });
      for (let i = gifts.length - 1; i >= 0; i--) if (gifts[i].t <= 0) gifts.splice(i, 1);
      const d = keyDir(input);
      if (d.x || d.y) { kbd = true; cur.x = Math.max(30, Math.min(W - 30, cur.x + d.x * 560 * dt)); cur.y = Math.max(100, Math.min(H - 40, cur.y + d.y * 560 * dt)); }
      if (input.pressed.has(' ')) { kbd = true; tag(cur.x, cur.y); }
      for (const t of input.taps) { kbd = false; tag(t.x, t.y); }
    },
    draw(g) {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#ffd6a5'); bg.addColorStop(1, '#ffadad');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      LANES.forEach((y) => { g.fillStyle = 'rgba(120,60,40,0.25)'; g.fillRect(0, y + 40, W, 16); });
      folk.forEach((p) => {
        const bob = Math.abs(Math.sin(ctx.t * 8 + p.ph)) * 6; const sx = Math.sin(p.shake * 40) * 6 * p.shake;
        if (p.rot) { rot(g, p.x, p.y - bob, 30, ctx.t + p.ph); return; }
        // body
        g.fillStyle = 'rgba(60,40,80,0.6)'; g.beginPath(); g.roundRect(p.x - 18 + sx, p.y + 8 - bob, 36, 34, 10); g.fill();
        emoji(g, p.face, p.x + sx, p.y - bob, 50);
        // their bubble
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(p.x + 40 + sx, p.y - 52 - bob, 26, 20, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(p.x + 20 + sx, p.y - 30 - bob, 5, 0, 7); g.fill();
        emoji(g, p.bub, p.x + 40 + sx, p.y - 52 - bob, 22);
        if (p.got) emoji(g, FEEL[want].gift, p.x - 30, p.y - 40 - bob, 26);
      });
      gifts.forEach((gf) => { g.globalAlpha = Math.min(1, gf.t); emoji(g, gf.e, gf.x, gf.y, 40); g.globalAlpha = 1; });
      if (kbd) { g.strokeStyle = '#7a2a8a'; g.lineWidth = 4; g.beginPath(); g.arc(cur.x, cur.y, 44, 0, 7); g.stroke(); }
      fx.draw(g);
      hud(g, ctx, `Send ${FEEL[want].gift} to everyone who ${FEEL[want].verb}`, done, need);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.roundRect(W / 2 - 230, H - 52, 460, 30, 10); g.fill();
      text(g, 'Tap the right faces · or arrows and SPACE', W / 2, H - 37, 15, '#fff', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}

// phob: run from the spiders to the safe door.
function fleeGame(ctx) {
  const { W, H, rnd, tier, palette, input } = ctx;
  const fx = makeFx(ctx);
  const need = [2, 3, 4][tier];
  const chase = [60, 90, 125][tier];
  const R = 24; const speed = 300;
  let done = 0; let miss = 0; let target = null; let grace = 0;
  const me = { x: W / 2, y: 300 };
  const door = { x: 0, y: 0 };
  let spiders = [];
  function setup() {
    grace = 0.8; target = null;
    door.x = me.x < W / 2 ? W - 90 - rnd() * 120 : 90 + rnd() * 120; door.y = 130 + rnd() * 320;
    spiders = Array.from({ length: 1 + tier }, () => {
      let x; let y;
      do { x = 60 + rnd() * (W - 120); y = 110 + rnd() * (H - 180); } while (Math.hypot(x - me.x, y - me.y) < 220);
      return { x, y, ph: rnd() * 6 };
    });
  }
  // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
  if (ctx.debug) ctx.debug.peek = () => ({ me, door, spiders });
  setup();
  return {
    update(dt) {
      grace -= dt;
      const d = keyDir(input);
      let vx = 0; let vy = 0;
      if (d.x || d.y) { target = null; const n = Math.hypot(d.x, d.y); vx = d.x / n; vy = d.y / n; }
      else {
        if (input.down || input.taps.length) target = { x: input.x, y: input.y };
        if (target) { const dx = target.x - me.x; const dy = target.y - me.y; const n = Math.hypot(dx, dy); if (n > 6) { vx = dx / n; vy = dy / n; } else target = null; }
      }
      me.x = Math.max(R, Math.min(W - R, me.x + vx * speed * dt)); me.y = Math.max(70 + R, Math.min(H - R, me.y + vy * speed * dt));
      spiders.forEach((s) => {
        const dx = me.x - s.x; const dy = me.y - s.y; const n = Math.hypot(dx, dy) || 1;
        s.x += (dx / n) * chase * dt + Math.sin(ctx.t * 3 + s.ph) * 30 * dt; s.y += (dy / n) * chase * dt + Math.cos(ctx.t * 3 + s.ph) * 30 * dt;
        if (grace <= 0 && n < R + 22) {
          grace = 1.2; miss += 1; ctx.sfx.bad(); fx.burst(me.x, me.y, '#7dff4a', 14, 180);
          s.x -= (dx / n) * 160; s.y -= (dy / n) * 160;
          if (miss >= 3) ctx.lose('rot');
        }
      });
      if (Math.hypot(me.x - door.x, me.y - door.y) < R + 34) {
        done += 1; ctx.sfx.pickup(); fx.burst(door.x, door.y, palette.glow, 30); fx.burst(door.x, door.y, '#fff', 12);
        if (done >= need) { ctx.win(); return; }
        setup();
      }
    },
    draw(g) {
      g.fillStyle = '#1a1424'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, 64 + i * 40); g.lineTo(W, 100 + i * 40); g.stroke(); }
      // web in the corner
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 64); g.lineTo(Math.cos(i * 0.3) * 200, 64 + Math.sin(i * 0.3) * 200); g.stroke(); }
      const glow = g.createRadialGradient(door.x, door.y, 10, door.x, door.y, 90); glow.addColorStop(0, 'rgba(255,225,77,0.45)'); glow.addColorStop(1, 'rgba(255,225,77,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(door.x, door.y, 90, 0, 7); g.fill();
      emoji(g, '🚪', door.x, door.y, 64); text(g, 'SAFE', door.x, door.y + 46, 14, '#ffe14d');
      spiders.forEach((s) => emoji(g, '🕷️', s.x, s.y + Math.sin(ctx.t * 10 + s.ph) * 3, 48));
      g.globalAlpha = grace > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(ctx.t * 12)) : 1;
      emoji(g, '😱', me.x, me.y, 52);
      g.globalAlpha = 1;
      if (target) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(target.x, target.y, 10, 0, 7); g.stroke(); }
      fx.draw(g);
      hud(g, ctx, 'Run from the spiders to the safe door!', done, need);
      text(g, 'Arrows to run · or tap / hold where to run', W / 2, H - 34, 16, 'rgba(255,255,255,0.6)', 'center', 400);
      misses(g, ctx, miss);
    },
    destroy() {},
  };
}
