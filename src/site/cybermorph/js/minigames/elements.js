/**
 * Elements (elements): balance a tiny world by sending the right element where it is missing.
 * Trouble pops up across the world: fires, frozen corners, sunken pits, airless bubbles, dark
 * patches of sky. Your element fixes only its own kind of trouble (water puts out fires, heat
 * melts ice, earth fills pits, air fills the airless, stars light the sky), and sending it to
 * the wrong trouble makes that worse.
 *  - hydro, hydr, aqua → water · therm → heat · geo → earth · atmo → air · astro → stars
 *  - cosm, eco, phys keep the WHOLE world in order: you hold every element and pick the right
 *    one for each trouble (cosm in space, eco around a house and garden, phys out in nature).
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

// ── the world ──
const ELEM = {
  water: { e: '💧', name: 'water', fixes: 'fire', worsens: 'ice' },
  heat: { e: '☀️', name: 'heat', fixes: 'ice', worsens: 'fire' },
  earth: { e: '⛰️', name: 'earth', fixes: 'pit' },
  air: { e: '💨', name: 'air', fixes: 'airless' },
  star: { e: '⭐', name: 'starlight', fixes: 'dark' },
};
const TROUBLE = {
  fire: { name: 'fires', fixed: '🌷' }, ice: { name: 'frozen corners', fixed: '🌼' }, pit: { name: 'sunken pits', fixed: '🌳' },
  airless: { name: 'airless bubbles', fixed: '😊' }, dark: { name: 'dark patches of sky', fixed: '🌟', sky: true },
};
const ELEMENT_OF = { hydro: 'water', hydr: 'water', aqua: 'water', therm: 'heat', geo: 'earth', atmo: 'air', astro: 'star' };
const WORLD = {
  cosm: { name: 'space', top: '#05051a', bottom: '#1a1040', ground: '#4a3a6a', deco: ['🪐', '🌍'] },
  eco: { name: 'home', top: '#7ac0ff', bottom: '#d6ecff', ground: '#5aa04a', deco: ['🏡', '🌳'] },
  phys: { name: 'nature', top: '#5aa0e0', bottom: '#c0e0ff', ground: '#6a9a3a', deco: ['⛰️', '🌲'] },
  one: { name: 'world', top: '#3a7ad0', bottom: '#b0d8ff', ground: '#6a9a3a', deco: ['🏠', '🌲'] },
};
const HOW = {
  water: 'means water: send water to put out every fire, but keep it off the ice.',
  heat: 'means heat: send heat to melt every frozen corner, but keep it off the fires.',
  earth: 'means earth: send earth to fill every sunken pit.',
  air: 'means air: send air to every airless bubble so they can breathe.',
  star: 'means star: send starlight to every dark patch of sky.',
  all: 'keeps the whole world in order: pick the element each trouble needs, then send it.',
};

export default {
  seconds: 32,
  howTo(m) { return `${m.text} ${HOW[ELEMENT_OF[m.id] || 'all']}`; },
  verb(m) {
    const el = ELEMENT_OF[m.id];
    return el ? `You sent ${ELEM[el].name} where the world needed it.` : 'You kept the whole world in order.';
  },
  start(ctx) {
    const { W, H, rnd, tier, palette, input } = ctx;
    const fx = makeFx(ctx);
    const only = ELEMENT_OF[ctx.id] || null;
    const world = WORLD[only ? 'one' : ctx.id] || WORLD.one;
    const tray = only ? [only] : Object.keys(ELEM);
    const target = only ? ELEM[only].fixes : null;
    const need = [4, 6, 8][tier];
    const patience = [7, 5.5, 4.5][tier];
    const every = [1.5, 1.15, 0.85][tier];
    const COLS = 6; const colX = (i) => 110 + i * 148;
    const GROUND = 400; const SKY = 165;
    let done = 0; let miss = 0; let spawnIn = 0.2; let held = 0; let sel = 0; let kbd = false;
    const trouble = []; const shots = []; const fixed = [];

    function spawn() {
      const kinds = Object.keys(TROUBLE);
      const kind = only ? (rnd() < 0.5 ? target : kinds.filter((k) => k !== target)[Math.floor(rnd() * 4)]) : kinds[Math.floor(rnd() * kinds.length)];
      const sky = !!TROUBLE[kind].sky;
      const free = [...Array(COLS).keys()].filter((c) => !trouble.some((o) => o.col === c && o.sky === sky));
      if (!free.length) return;
      const col = free[Math.floor(rnd() * free.length)];
      trouble.push({ kind, col, sky, x: colX(col), y: sky ? SKY : GROUND, t: 0, size: 1, mine: !only || kind === target });
    }
    function send(tr) {
      const el = tray[held];
      shots.push({ el, tr, t: 0, x0: W / 2, y0: H - 50 });
      ctx.sfx.click();
    }
    function land(s) {
      const tr = s.tr; const el = ELEM[s.el];
      if (!trouble.includes(tr)) return;
      if (el.fixes === tr.kind) {
        trouble.splice(trouble.indexOf(tr), 1); fixed.push({ x: tr.x, y: tr.y, e: TROUBLE[tr.kind].fixed, t: 1.2 });
        done += 1; ctx.sfx.pickup(); fx.burst(tr.x, tr.y, palette.glow, 24); fx.burst(tr.x, tr.y, '#fff', 10);
        if (done >= need) ctx.win();
      } else {
        tr.size = Math.min(1.6, tr.size + 0.3); miss += 1; ctx.sfx.bad(); fx.burst(tr.x, tr.y, '#7dff4a', 12, 160);
        if (miss >= 3) ctx.lose('rot');
      }
    }
    const pickable = () => [...trouble].sort((a, b) => a.x - b.x || a.y - b.y);

    // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
    if (ctx.debug) ctx.debug.peek = () => ({ trouble, tray, held, shots });
    function drawTrouble(g, tr) {
      const s = tr.size * (1 + Math.sin(ctx.t * 4 + tr.col) * 0.05);
      const warn = tr.mine && tr.t > patience * 0.65;
      g.save(); g.translate(tr.x, tr.y);
      if (warn) { g.strokeStyle = `rgba(255,90,122,${0.5 + 0.5 * Math.sin(ctx.t * 12)})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 54 * s, 0, 7); g.stroke(); }
      if (tr.kind === 'fire') { emoji(g, '🔥', 0, -6, 64 * s); }
      if (tr.kind === 'ice') { emoji(g, '🧊', 0, 0, 58 * s); emoji(g, '❄️', 26 * s, -30 * s, 22 * s); }
      if (tr.kind === 'pit') { g.fillStyle = '#1a0f05'; g.beginPath(); g.ellipse(0, 22, 56 * s, 20 * s, 0, 0, 7); g.fill(); emoji(g, '🕳️', 0, 10, 40 * s); }
      if (tr.kind === 'airless') { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(0, -4, 38 * s, 0, 7); g.stroke(); emoji(g, '😵', 0, -4, 40 * s); }
      if (tr.kind === 'dark') { g.fillStyle = 'rgba(10,10,30,0.9)'; g.beginPath(); g.ellipse(0, 0, 66 * s, 36 * s, 0, 0, 7); g.fill(); emoji(g, '🌑', 0, 0, 34 * s); }
      g.restore();
    }

    return {
      update(dt) {
        spawnIn -= dt;
        if (spawnIn <= 0) { spawn(); spawnIn = every * (0.8 + rnd() * 0.4); }
        for (let i = trouble.length - 1; i >= 0; i--) {
          const tr = trouble[i]; tr.t += dt;
          if (tr.t > patience) {
            trouble.splice(i, 1);
            if (tr.mine) { miss += 1; ctx.sfx.rot(); fx.burst(tr.x, tr.y, '#7dff4a', 18, 200); if (miss >= 3) { ctx.lose('rot'); return; } }
          }
        }
        for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.t += dt / 0.4; if (s.t >= 1) { shots.splice(i, 1); land(s); } }
        fixed.forEach((f) => { f.t -= dt; });
        for (let i = fixed.length - 1; i >= 0; i--) if (fixed[i].t <= 0) fixed.splice(i, 1);
        // keyboard: ◀ ▶ pick the trouble, ▲ ▼ pick the element, SPACE sends
        const list = pickable();
        if (keyIn(input.pressed, ['ArrowLeft', 'a'])) { kbd = true; sel = (sel + list.length - 1) % Math.max(1, list.length); }
        if (keyIn(input.pressed, ['ArrowRight', 'd'])) { kbd = true; sel = (sel + 1) % Math.max(1, list.length); }
        if (keyIn(input.pressed, ['ArrowUp', 'w'])) { held = (held + tray.length - 1) % tray.length; ctx.sfx.tick(); }
        if (keyIn(input.pressed, ['ArrowDown', 's'])) { held = (held + 1) % tray.length; ctx.sfx.tick(); }
        if (sel >= list.length) sel = 0;
        if (input.pressed.has(' ') && list[sel]) { kbd = true; send(list[sel]); }
        for (const t of input.taps) {
          kbd = false;
          if (t.y > H - 100 && tray.length > 1) {
            const bw = 96; const x0 = W / 2 - (tray.length * bw) / 2;
            const i = Math.floor((t.x - x0) / bw); if (i >= 0 && i < tray.length) { held = i; ctx.sfx.tick(); continue; }
          }
          const tr = trouble.find((o) => Math.hypot(o.x - t.x, o.y - t.y) < 62);
          if (tr) send(tr);
        }
      },
      draw(g) {
        const bg = g.createLinearGradient(0, 0, 0, GROUND);
        bg.addColorStop(0, world.top); bg.addColorStop(1, world.bottom); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        if (ctx.id === 'cosm') for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect((i * 173) % W, 70 + (i * 61) % 300, 2, 2); }
        g.fillStyle = world.ground; g.beginPath(); g.moveTo(0, GROUND - 20);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, GROUND - 20 + Math.sin(x / 90) * 10);
        g.lineTo(W, H); g.lineTo(0, H); g.fill();
        g.globalAlpha = 0.5; emoji(g, world.deco[0], 60, GROUND - 60, 50); emoji(g, world.deco[1], W - 50, GROUND - 60, 54); g.globalAlpha = 1;
        trouble.forEach((tr) => drawTrouble(g, tr));
        fixed.forEach((f) => { g.globalAlpha = Math.min(1, f.t); emoji(g, f.e, f.x, f.y - (1.2 - f.t) * 30, 50); g.globalAlpha = 1; });
        const list = pickable();
        if (kbd && list[sel]) { g.strokeStyle = '#ffe14d'; g.lineWidth = 5; g.beginPath(); g.arc(list[sel].x, list[sel].y, 60, 0, 7); g.stroke(); }
        shots.forEach((s) => {
          const k = Math.min(1, s.t); const x = s.x0 + (s.tr.x - s.x0) * k; const y = s.y0 + (s.tr.y - s.y0) * k - Math.sin(k * Math.PI) * 140;
          emoji(g, ELEM[s.el].e, x, y, 38);
        });
        // the tray: the element(s) you hold
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, H - 100, W, 100);
        const bw = 96; const x0 = W / 2 - (tray.length * bw) / 2;
        tray.forEach((el, i) => {
          const x = x0 + i * bw + bw / 2;
          g.fillStyle = i === held ? palette.accent : 'rgba(255,255,255,0.12)'; g.beginPath(); g.roundRect(x - 42, H - 92, 84, 64, 14); g.fill();
          if (i === held) { g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
          emoji(g, ELEM[el].e, x, H - 68, 32); text(g, ELEM[el].name, x, H - 40, 12, '#fff', 'center', 400);
        });
        fx.draw(g);
        hud(g, ctx, only ? `Send ${ELEM[only].name} to the ${TROUBLE[target].name}` : `Keep ${world.name} in order: fix each trouble`, done, need);
        text(g, only ? 'Tap the trouble · or ◀ ▶ and SPACE' : 'Pick an element, tap the trouble · ▲▼ ◀▶ SPACE', W - 16, H - 112, 13, 'rgba(255,255,255,0.8)', 'right', 400);
        misses(g, ctx, miss);
      },
      destroy() {},
    };
  },
};
