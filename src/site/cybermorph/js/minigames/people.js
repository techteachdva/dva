/**
 * People & rule (people): run a tiny town. Job cards slide down the town chute toward the Rot,
 * and you hand each one to the right person: THE PEOPLE (demo) vote and decide together, THE
 * RULER (arch, crat) or THE GOVERNMENT (cracy) is in charge, THE LAW (nom) is the rule everyone
 * follows, and THE HERO (hero) is the brave one who steps up. Most cards belong to your
 * morpheme's station; the rest go elsewhere, so who is in charge decides.
 * anthrop sorts arrivals at the town gate instead: humans to the human hall, not robots or animals.
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

// ── the town ──
const STATION = {
  people: { e: '👥', name: 'THE PEOPLE', cards: [['🗳️', 'Everyone votes'], ['📣', 'The crowd decides'], ['🎉', 'A party for all'], ['🙋', 'Ask the whole town']] },
  ruler: { e: '👑', name: 'THE RULER', cards: [['🏰', 'Run the castle'], ['📯', 'Give the orders'], ['⚔️', 'Lead the army'], ['🪑', 'Sit on the throne']] },
  gov: { e: '🏛️', name: 'THE GOVERNMENT', cards: [['🛣️', 'Build the roads'], ['💰', 'Collect the taxes'], ['🏫', 'Run the schools'], ['📋', 'Plan the town']] },
  law: { e: '📜', name: 'THE LAW', cards: [['🚦', 'Stop at red'], ['🚯', 'No littering'], ['⚖️', 'Settle it fairly'], ['🚸', 'Slow near schools']] },
  hero: { e: '🦸', name: 'THE HERO', cards: [['🔥', 'Save the cat from the fire'], ['🐉', 'Dragon attack!'], ['🌊', 'Rescue the swimmer'], ['🦹', 'Stop the villain']] },
  human: { e: '🧑', name: 'HUMANS', cards: [['👩', ''], ['👨', ''], ['🧒', ''], ['👵', ''], ['👴', '']] },
  robot: { e: '🤖', name: 'MACHINES', cards: [['🤖', ''], ['🚂', ''], ['📱', ''], ['🚗', '']] },
  animal: { e: '🐾', name: 'ANIMALS', cards: [['🐒', ''], ['🐶', ''], ['🦁', ''], ['🐸', '']] },
};
const MINE = { demo: 'people', arch: 'ruler', crat: 'ruler', cracy: 'gov', nom: 'law', hero: 'hero', anthrop: 'human' };
const HOW = {
  people: 'means the people: hand every job for the whole town to THE PEOPLE.',
  ruler: 'means a ruler: hand every job for the one in charge to THE RULER.',
  gov: 'means rule by a government: hand every job of running the town to THE GOVERNMENT.',
  law: 'means law: hand every rule to THE LAW.',
  hero: 'means a brave person: hand every brave rescue to THE HERO.',
  human: 'means human: send every human to the human hall, and the rest where they belong.',
};
const VERB = {
  people: 'You gave the people their say.', ruler: 'You put the ruler in charge.', gov: 'You let the government run the town.',
  law: 'You made the laws.', hero: 'You sent the hero to the rescue.', human: 'You found every human.',
};

export default {
  seconds: 32,
  howTo(m) { return `${m.text} ${HOW[MINE[m.id] || 'people']}`; },
  verb(m) { return VERB[MINE[m.id] || 'people']; },
  start(ctx) {
    const { W, H, rnd, tier, palette, input } = ctx;
    const fx = makeFx(ctx);
    const mine = MINE[ctx.id] || 'people';
    let ids;
    if (mine === 'human') ids = ['human', 'robot', 'animal'];
    else ids = ['people', mine === 'gov' ? 'gov' : 'ruler', 'law', 'hero'];
    if (tier === 0 && ids.length > 3) ids = ids.filter((s, i) => s === mine || i < 3).slice(0, 3);
    if (!ids.includes(mine)) ids[ids.length - 1] = mine;
    const slots = [{ x: 140, y: 210 }, { x: W - 140, y: 210 }, { x: 140, y: 400 }, { x: W - 140, y: 400 }];
    const stations = ids.map((id, i) => ({ id, ...STATION[id], ...slots[i], flash: 0 }));
    const need = [4, 6, 8][tier];
    const fall = [65, 90, 125][tier];
    const TOP = 100; const PIT = 470;
    let done = 0; let miss = 0; let sel = 0; let spawnIn = 0;
    const cards = []; const flying = [];

    function spawn() {
      const id = rnd() < 0.55 ? mine : ids.filter((s) => s !== mine)[Math.floor(rnd() * (ids.length - 1))];
      const deck = STATION[id].cards; const [e, label] = deck[Math.floor(rnd() * deck.length)];
      cards.push({ id, e, label, y: TOP, x: W / 2 });
    }
    const current = () => cards.reduce((a, c) => (!a || c.y > a.y ? c : a), null);
    function send(si) {
      const c = current(); const st = stations[si];
      if (!c || !st) return;
      cards.splice(cards.indexOf(c), 1);
      flying.push({ ...c, tx: st.x, ty: st.y, t: 0, ok: c.id === st.id });
      if (c.id === st.id) {
        st.flash = 1; ctx.sfx.pickup(); fx.burst(st.x, st.y, palette.glow, 22);
        if (c.id === mine) { done += 1; if (done >= need) ctx.win(); }
      } else { ctx.sfx.bad(); miss += 1; fx.burst(st.x, st.y, '#7dff4a', 12, 150); if (miss >= 3) ctx.lose('rot'); }
    }
    // Test-only: a playtest bot reads state through ctx.debug (the harness never sets it).
    if (ctx.debug) ctx.debug.peek = () => ({ card: current(), stations });
    return {
      update(dt) {
        spawnIn -= dt;
        if (spawnIn <= 0 && cards.length < 3) { spawn(); spawnIn = 150 / fall; }
        for (let i = cards.length - 1; i >= 0; i--) {
          const c = cards[i]; c.y += fall * dt;
          if (c.y > PIT) {
            cards.splice(i, 1); ctx.sfx.rot(); fx.burst(c.x, PIT, '#7dff4a', 14, 160);
            if (c.id === mine) { miss += 1; if (miss >= 3) { ctx.lose('rot'); return; } }
          }
        }
        flying.forEach((f) => { f.t += dt * 3; });
        for (let i = flying.length - 1; i >= 0; i--) if (flying[i].t >= 1) flying.splice(i, 1);
        stations.forEach((s) => { s.flash = Math.max(0, s.flash - dt * 2); });
        if (keyIn(input.pressed, ['ArrowLeft', 'a', 'ArrowUp', 'w'])) { sel = (sel + stations.length - 1) % stations.length; ctx.sfx.tick(); }
        if (keyIn(input.pressed, ['ArrowRight', 'd', 'ArrowDown', 's'])) { sel = (sel + 1) % stations.length; ctx.sfx.tick(); }
        if (input.pressed.has(' ')) send(sel);
        for (const t of input.taps) { const i = stations.findIndex((s) => Math.abs(s.x - t.x) < 120 && Math.abs(s.y - t.y) < 80); if (i >= 0) { sel = i; send(i); } }
      },
      draw(g) {
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#8fd3ff'); bg.addColorStop(1, '#e6f6ff');
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = '#9ccf7a'; g.fillRect(0, 300, W, H - 300);
        g.globalAlpha = 0.35; ['🏠', '🏡', '⛪', '🏪', '🏠'].forEach((e, i) => emoji(g, e, 300 + i * 90, 290, 46)); g.globalAlpha = 1;
        // the chute
        g.fillStyle = 'rgba(80,60,40,0.35)'; g.fillRect(W / 2 - 110, TOP - 30, 220, PIT - TOP + 30);
        rot(g, W / 2, PIT + 30, 40, ctx.t);
        stations.forEach((s, i) => {
          g.fillStyle = s.flash > 0 ? `rgba(255,225,77,${0.5 + s.flash * 0.5})` : 'rgba(255,255,255,0.85)';
          g.beginPath(); g.roundRect(s.x - 115, s.y - 70, 230, 140, 18); g.fill();
          g.strokeStyle = i === sel ? '#ff7a1a' : 'rgba(0,0,0,0.2)'; g.lineWidth = i === sel ? 6 : 2; g.stroke();
          emoji(g, s.e, s.x, s.y - 16, 56);
          text(g, s.name, s.x, s.y + 44, s.name.length > 10 ? 15 : 18, '#2a2a3a');
          if (s.id === mine && ctx.tile.ready) { const h = 26; const w = (ctx.tile.width / ctx.tile.height) * h; g.drawImage(ctx.tile, s.x + 112 - w, s.y - 66, w, h); }
        });
        const cur = current();
        cards.forEach((c) => {
          const big = c === cur;
          g.fillStyle = '#fffdf2'; g.beginPath(); g.roundRect(c.x - 100, c.y - 40, 200, 80, 12); g.fill();
          g.strokeStyle = big ? '#ff7a1a' : '#c9b98a'; g.lineWidth = big ? 4 : 2; g.stroke();
          emoji(g, c.e, c.x - (c.label ? 66 : 0), c.y, c.label ? 38 : 50);
          if (c.label) {
            g.font = font(15); const words = c.label.split(' '); const lines = []; let line = '';
            words.forEach((w) => { if (g.measureText(`${line} ${w}`).width > 116 && line) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w; });
            lines.push(line);
            lines.forEach((l, i) => text(g, l, c.x + 22, c.y + (i - (lines.length - 1) / 2) * 18, 15, '#2a2a3a'));
          }
        });
        flying.forEach((f) => {
          const k = f.t; const x = f.x + (f.tx - f.x) * k; const y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 60;
          g.globalAlpha = 1 - k * 0.6; emoji(g, f.e, x, y, 40); g.globalAlpha = 1;
          if (!f.ok) rot(g, x, y, 14, ctx.t);
        });
        fx.draw(g);
        hud(g, ctx, mine === 'human' ? 'Send every human to the human hall' : `Give each job to who does it, like ${STATION[mine].name}`, done, need);
        text(g, 'Tap who the top card belongs to · or ◀ ▶ and SPACE', W / 2, H - 36, 15, '#2a2a3a', 'center', 400);
        misses(g, ctx, miss);
      },
      destroy() {},
    };
  },
};
