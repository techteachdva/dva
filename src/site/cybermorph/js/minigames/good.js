/**
 * Good deed (bene): sprites walk down the street and stop at your doorstep, each showing what
 * it needs. Pick the kind thing to do (water, a scarf, cheer, a scrub). There is also a 💰 GRAB
 * button, because the Rot keeps offering it, but grabbing never scores: it only feeds the Rot.
 * bene means good and well, so you win only by helping.
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

const NEEDS = [
  { id: 'thirsty', icon: '💧', tool: 0, say: 'thirsty' },
  { id: 'cold', icon: '🥶', tool: 1, say: 'cold' },
  { id: 'sad', icon: '😢', tool: 2, say: 'sad' },
  { id: 'slimed', icon: '🟢', tool: 3, say: 'slimed' },
];
const TOOLS = [
  { icon: '💧', name: 'water' }, { icon: '🧣', name: 'scarf' }, { icon: '💛', name: 'cheer' }, { icon: '🧽', name: 'scrub' },
];
const GRAB = { icon: '💰', name: 'GRAB', grab: true };
const SPOT = 480; const Y = 330;

export default {
  seconds: 40,
  howTo: () => 'Each sprite stops at your door and shows what it needs. Pick the kind thing to do for it (tap a button, or ← → and Space). Never grab!',
  verb: () => 'You did good deeds for everyone who passed.',
  start(ctx) {
    const { tier, rnd, input } = ctx;
    const fx = sparks();
    const needs = NEEDS.slice(0, tier === 0 ? 3 : 4);
    const tools = [...TOOLS.slice(0, needs.length), GRAB];
    const speed = [150, 170, 190][tier];
    const patience = [3.4, 2.6, 2.0][tier];
    const fineP = [0.15, 0.22, 0.28][tier];
    const need = [7, 10, 12][tier];
    const rotMax = [5, 4, 3][tier];
    const BW = 128; const BX = 480 - (tools.length * (BW + 12)) / 2 + 6; const BY = 440;
    const sprites = [];
    let helped = 0; let rotM = 0; let lock = 0; let sel = 0; let gap = 0.3; let msg = null; let press = -1; let pressT = 0;
    const say = (text, c = '#fff') => { msg = { text, c, t: 1.4 }; };
    const spawn = () => {
      const fine = rnd() < fineP;
      sprites.push({ x: -40, hue: Math.floor(rnd() * 360), need: fine ? null : needs[Math.floor(rnd() * needs.length)], state: 'walk', wait: 0, mood: 0, bounce: 0 });
    };
    const atSpot = () => sprites.find((s) => s.state === 'wait');
    const feedRot = (why) => { rotM += 1; ctx.sfx.rot(); say(why, '#7dffa0'); if (rotM >= rotMax) ctx.lose('rot'); };
    const use = (i) => {
      if (lock > 0) return;
      press = i; pressT = 0.2;
      const s = atSpot();
      const tool = tools[i];
      if (tool.grab) {
        if (s) { s.state = 'leave'; s.mood = -1; fx.burst(s.x, Y - 60, '#39d353', 14, 200); }
        feedRot('Grabbing never helps. It only feeds the Rot.');
        return;
      }
      if (!s) { say('Wait for someone to stop at your door.'); return; }
      if (!s.need) { say('This one is doing fine! Let it walk on.'); s.wait = Math.min(s.wait, 0.3); return; }
      if (tool === TOOLS[s.need.tool]) {
        helped += 1; s.state = 'leave'; s.mood = 1; s.need = null; s.bounce = 1;
        fx.burst(s.x, Y - 70, '#ff6b8b', 18, 240);
        if (helped >= need) { ctx.sfx.good(); fx.burst(SPOT, Y - 60, ctx.palette.accent, 40, 380); ctx.win(); } else ctx.sfx.pickup();
      } else { s.wait -= 0.6; s.bounce = 0.5; lock = 0.6; ctx.sfx.click(); say(`That won't help. It's ${s.need.say}.`); }
    };
    return {
      peek: () => ({ spot: atSpot() && { need: atSpot().need && atSpot().need.tool, wait: atSpot().wait }, tools: tools.map((t, i) => ({ x: BX + i * (BW + 12) + BW / 2, grab: !!t.grab })), BY, helped, rotM }),
      update(dt) {
        dt = Math.min(dt, 0.05);
        pressT -= dt; lock -= dt;
        if (msg && (msg.t -= dt) <= 0) msg = null;
        // a queue: the next sprite walks up and waits its turn behind the one at the door
        const queued = sprites.filter((s) => s.state === 'walk' && s.x < SPOT).length;
        if (queued < 3 && (gap -= dt) <= 0) { spawn(); gap = 0.5 + rnd() * 0.5; }
        let limit = atSpot() ? SPOT - 80 : SPOT;
        for (const s of sprites.filter((q) => q.state === 'walk').sort((a, b) => b.x - a.x)) {
          s.x = Math.min(s.x + speed * dt, limit);
          limit = s.x - 80;
        }
        for (const s of sprites) {
          s.bounce = Math.max(0, s.bounce - dt * 2);
          if (s.state === 'walk') {
            if (s.x >= SPOT) { s.x = SPOT; s.state = 'wait'; s.wait = s.need ? patience : 1.0; }
          } else if (s.state === 'wait') {
            s.wait -= dt;
            if (s.wait <= 0) {
              s.state = 'leave';
              if (s.need) { s.mood = -1; feedRot(`Nobody helped. That sprite was ${s.need.say}.`); }
            }
          } else s.x += speed * 1.6 * dt;
        }
        for (let i = sprites.length - 1; i >= 0; i--) if (sprites[i].x > 1010) sprites.splice(i, 1);
        const k = input.pressed;
        if (k.has('ArrowLeft') || k.has('a')) sel = Math.max(0, sel - 1);
        if (k.has('ArrowRight') || k.has('d')) sel = Math.min(tools.length - 1, sel + 1);
        if (k.has(' ')) use(sel);
        for (const t of input.taps) {
          const i = tools.findIndex((_, j) => Math.abs(t.x - (BX + j * (BW + 12) + BW / 2)) < BW / 2 && Math.abs(t.y - (BY + 34)) < 40);
          if (i >= 0) { sel = i; use(i); }
        }
      },
      draw(g) {
        const t = ctx.t;
        // the street
        g.fillStyle = '#20263a'; g.fillRect(0, Y, 960, 70);
        g.fillStyle = '#2a2f45'; g.fillRect(0, Y + 70, 960, 4);
        for (let x = 0; x < 960; x += 80) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 100, 60, Y - 120); }
        // your door and doorstep
        g.fillStyle = '#4a3a2a'; g.fillRect(SPOT - 40, Y - 150, 80, 150);
        g.fillStyle = ctx.palette.accent; g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4); g.fillRect(SPOT - 60, Y, 120, 14); g.globalAlpha = 1;
        tileAt(g, ctx, SPOT, Y - 120, 22);
        // the Rot grows as it's fed
        rot(g, 870, Y - 40, 26 + rotM * 12, t, 2);
        for (const s of sprites) {
          const y = Y - 34 - s.bounce * 26 - Math.abs(Math.sin(s.x * 0.08)) * (s.state === 'wait' ? 0 : 6);
          const slimed = s.need && s.need.id === 'slimed';
          g.fillStyle = slimed ? '#39d353' : `hsl(${s.hue},70%,62%)`;
          g.beginPath(); g.arc(s.x, y, 28, 0, TAU); g.fill();
          g.fillStyle = '#0b1020';
          g.beginPath(); g.arc(s.x - 9, y - 6, 4, 0, TAU); g.arc(s.x + 9, y - 6, 4, 0, TAU); g.fill();
          g.strokeStyle = '#0b1020'; g.lineWidth = 3;
          g.beginPath();
          if (s.mood > 0 || (!s.need && s.mood === 0)) g.arc(s.x, y + 4, 10, 0.2, Math.PI - 0.2);
          else g.arc(s.x, y + 16, 10, Math.PI + 0.3, -0.3);
          g.stroke();
          g.textAlign = 'center'; g.textBaseline = 'middle';
          if (s.need && s.state !== 'leave') {
            g.fillStyle = '#f4f2ea'; rrect(g, s.x - 26, y - 92, 52, 46, 12); g.fill();
            g.font = '30px sans-serif'; g.fillText(s.need.icon, s.x, y - 68);
            if (s.state === 'wait') { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(s.x - 30, y + 38, 60, 6); g.fillStyle = '#ffd36b'; g.fillRect(s.x - 30, y + 38, 60 * clamp(s.wait / patience, 0, 1), 6); }
          } else if (!s.need && s.mood === 0) { g.font = '26px sans-serif'; g.fillText('💰', s.x + 30, y + 14); }
          if (s.mood > 0 && s.state === 'leave') { g.font = '24px sans-serif'; g.fillText('💖', s.x, y - 50 - Math.sin(t * 6) * 4); }
          if (s.mood < 0 && s.state === 'leave') { g.font = '24px sans-serif'; g.fillText('💢', s.x, y - 50); }
        }
        tools.forEach((tool, i) => {
          const x = BX + i * (BW + 12);
          g.fillStyle = tool.grab ? '#1f3a24' : i === press && pressT > 0 ? ctx.palette.accent : '#2a2f45';
          rrect(g, x, BY, BW, 68, 14); g.fill();
          g.lineWidth = 3; g.strokeStyle = i === sel ? '#ffffff' : tool.grab ? '#39d353' : '#4a5275'; g.stroke();
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = '26px sans-serif'; g.fillText(tool.icon, x + BW / 2, BY + 24);
          g.font = font(16); g.fillStyle = tool.grab ? '#7dffa0' : '#fff'; g.fillText(tool.name, x + BW / 2, BY + 52);
        });
        g.font = font(18); g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(`💖 ${helped} / ${need} helped`, 30, 80);
        for (let i = 0; i < rotMax; i++) { g.fillStyle = i < rotM ? '#39d353' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(930 - i * 26, 80, 9, 0, TAU); g.fill(); }
        fx.draw(g, t);
        if (msg) { g.font = font(20); g.textAlign = 'center'; g.fillStyle = msg.c; g.fillText(msg.text, 480, 116); }
        hint(g, 'Do a GOOD deed for each sprite at your door');
      },
      destroy() {},
    };
  },
};
